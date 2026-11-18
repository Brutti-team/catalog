import type { User } from "@supabase/supabase-js";
import { catalogClient, getAuthState } from "./catalog";

export type StaffRole = "super_admin" | "admin" | "editor";
export type AccountSummary = {
  id: string;
  email: string;
  displayName: string;
  role: StaffRole | null;
  managementReady: boolean;
  lastSignIn: string | null;
};
export type StaffMember = {
  user_id: string;
  email: string;
  display_name: string;
  role: StaffRole | null;
  last_sign_in_at: string | null;
};
export type ActivityEntry = {
  id: string;
  actor_id: string | null;
  actor_email: string;
  action: string;
  resource_type: string;
  resource_name: string;
  /** Server-side audit row ID of the affected product/category, not a name guess. */
  resource_id?: string | null;
  created_at: string;
};

const allowedRoles: StaffRole[] = ["super_admin", "admin", "editor"];

export function isStaffRole(input: unknown): input is StaffRole {
  return typeof input === "string" && allowedRoles.includes(input as StaffRole);
}
export function safeDisplayName(user: Pick<User, "email" | "user_metadata">): string {
  const candidate = user.user_metadata?.full_name;
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim().slice(0, 80) : (user.email?.split("@")[0] || "Staff");
}
export function roleLabel(role: StaffRole | null): string {
  return role === "super_admin" ? "Super Admin"
    : role === "editor" ? "Editor"
    : role === "admin" ? "Admin" : "Catalog administrator";
}
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0]
    : (parts[0] || "B").slice(0, 2)).toUpperCase();
}
function isUnavailableFeature(code?: string): boolean {
  return code === "PGRST202" || code === "42883";
}

/** Role is read from server permission tables, never inferred from email. */
export async function getAccountSummary(): Promise<AccountSummary> {
  const db = catalogClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new Error("Please sign in again to view your profile.");
  const { data: result, error: roleError } = await db.rpc("catalog_my_role");
  if (roleError && !isUnavailableFeature(roleError.code))
    throw new Error(`Unable to verify staff permissions: ${roleError.message}`);
  return {
    id: user.id,
    email: user.email || "",
    displayName: safeDisplayName(user),
    role: !roleError && isStaffRole(result) ? result : null,
    managementReady: !roleError,
    lastSignIn: user.last_sign_in_at || null,
  };
}

/** Only the owner's own Auth metadata can be edited from this client. */
export async function updateOwnDisplayName(name: string): Promise<string> {
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length < 2 || clean.length > 80)
    throw new Error("Display name must be between 2 and 80 characters.");
  const db = catalogClient();
  const { data: { user }, error: sessionError } = await db.auth.getUser();
  if (sessionError || !user) throw new Error("Your session has expired. Sign in again.");
  const { error } = await db.auth.updateUser({ data: { full_name: clean } });
  if (error) throw new Error(error.message);
  return clean;
}

export async function listCatalogStaff(): Promise<StaffMember[]> {
  const account = await getAccountSummary();
  if (!account.managementReady || !["super_admin", "admin"].includes(account.role ?? ""))
    throw new Error("Account Permission is available to Admin and Super Admin only.");
  const { data, error } = await catalogClient().rpc("catalog_list_staff");
  if (error) throw new Error(error.message);
  return (data || []) as StaffMember[];
}
export async function updateStaffRole(userId: string, role: StaffRole | null): Promise<void> {
  const account = await getAccountSummary();
  if (!account.managementReady || account.role !== "super_admin")
    throw new Error("Super Admin access is required.");
  if (account.id === userId) throw new Error("You cannot change your own role.");
  if (role !== null && !isStaffRole(role)) throw new Error("Invalid role.");
  const { error } = await catalogClient().rpc("catalog_set_staff_role", {
    p_user_id: userId, p_role: role,
  });
  if (error) throw new Error(error.message);
}
export type PendingCatalogStaff = {
  candidate_id: string;
  display_name: string;
  email: string | null;
  proposed_role: "admin" | "editor";
};

/** Only Catalog Admin and Super Admin may view the small, staged OS staff shortlist. */
export async function listPendingCatalogStaff(): Promise<PendingCatalogStaff[]> {
  const account = await getAccountSummary();
  if (!account.managementReady || !["admin", "super_admin"].includes(account.role ?? ""))
    throw new Error("Account Permission is available to Admin and Super Admin only.");
  const { data, error } = await catalogClient().rpc("catalog_list_pending_staff");
  if (error) throw new Error(error.message);
  return (data ?? []) as PendingCatalogStaff[];
}

export type CatalogInvitationRole = "super_admin" | "admin" | "editor";

/** Invite a separate Catalog Auth account without exposing service credentials. */
export async function inviteCatalogStaff({
  email, displayName, role,
}: {
  email: string;
  displayName: string;
  role: CatalogInvitationRole;
}): Promise<string> {
  const account = await getAccountSummary();
  if (!account.managementReady || account.role !== "super_admin")
    throw new Error("Only the Super Admin can invite catalog users.");
  const { data, error } = await catalogClient().functions.invoke<{
    ok?: boolean; message?: string; error?: string;
  }>("catalog-invite-staff", {
    body: { email: email.trim(), displayName: displayName.trim(), role },
  });
  if (error) {
    const ctx = "context" in error ? error.context : null;
    let readable = error.message;
    if (ctx instanceof Response) {
      const response = await ctx.clone().json().catch(() => null) as { error?: string } | null;
      readable = response?.error || readable;
    }
    throw new Error(readable || "Could not send invitation.");
  }
  if (!data?.ok) throw new Error(data?.error || "Could not send invitation.");
  return data.message || "Invitation sent. The account will activate when the user accepts and signs in.";
}

/** Latest persisted server audit record, not a guessed products.updated_at timestamp. */
export async function getLatestCatalogActivity(): Promise<ActivityEntry | null> {
  const access = await getAuthState();
  if (!access.authenticated || !access.isAdmin)
    throw new Error("An approved catalog administrator is required to view activity.");
  const { data, error } = await catalogClient()
    .from("catalog_activity")
    .select("id,actor_id,actor_email,action,resource_type,resource_name,created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as ActivityEntry | undefined) ?? null;
}

/** Latest real add/edit product activity, used for the photo-backed Overview snapshot.
 * The audit row's resource_id is matched to a loaded product; never use a
 * random product photo to illustrate another event. */
export async function getLatestEditedOrAddedProduct(): Promise<ActivityEntry | null> {
  const access = await getAuthState();
  if (!access.authenticated || !access.isAdmin)
    throw new Error("An approved catalog administrator is required to view activity.");
  const { data, error } = await catalogClient()
    .from("catalog_activity")
    .select("id,actor_id,actor_email,action,resource_type,resource_name,resource_id,created_at")
    .eq("resource_type", "products")
    .in("action", ["products_created", "products_updated"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as ActivityEntry | undefined) ?? null;
}

export type ActivityPeriod = "all" | "today" | "yesterday";

/** MYT is UTC+08:00 year-round. Calculate the query boundaries from the
 * actual calendar date in Kuala Lumpur, never from a browser's local timezone.
 * Use a half-open [start, end) range to avoid midnight double counting. */
export function catalogActivityMYTRange(
  period: Exclude<ActivityPeriod, "all">,
  now: Date = new Date(),
): { start: string; end: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value);
  const year = part("year"), month = part("month"), day = part("day");
  const makeDate = (offset: number) =>
    new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
  return {
    start: `${makeDate(period === "yesterday" ? -1 : 0)}T00:00:00+08:00`,
    end: `${makeDate(period === "yesterday" ? 0 : 1)}T00:00:00+08:00`,
  };
}

/** Date-scoped filters are queried server-side, not filtered from the latest
 * 50 audit rows, so yesterday remains findable even on a busy day. */
export async function listCatalogActivity(period: ActivityPeriod = "all"): Promise<ActivityEntry[]> {
  const access = await getAuthState();
  if (!access.authenticated || !access.isAdmin)
    throw new Error("An approved catalog administrator is required to view activity.");
  let query = catalogClient()
    .from("catalog_activity")
    .select("id,actor_id,actor_email,action,resource_type,resource_name,created_at");
  if (period !== "all") {
    const { start, end } = catalogActivityMYTRange(period);
    query = query.gte("created_at", start).lt("created_at", end);
  }
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(period === "all" ? 50 : 200);
  if (error) throw new Error(error.message);
  return (data || []) as ActivityEntry[];
}
