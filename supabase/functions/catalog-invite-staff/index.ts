import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.0";

import { catalogInvitationHeaders, catalogInvitationRedirect, catalogStaffOriginAllowed } from "../_shared/catalog-origins.ts";

const ALLOWED_ROLES = new Set(["super_admin", "admin", "editor"]);

/** Only the authenticated Brutti Catalog Super Admin can send invitations.
 *  OS login is a different Supabase Auth project; never copy OS passwords.
 */
Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  const headers = catalogInvitationHeaders(origin);
  const json = (payload: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(payload), { status, headers });
  if (!catalogStaffOriginAllowed(origin)) return json({ error: "Origin not allowed." }, 403);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Sign in required." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Catalog invitation service is not configured." }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const jwt = authHeader.slice(7).trim();
  const { data: userResult, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userResult.user) return json({ error: "Session expired. Sign in again." }, 401);

  const { data: roleInfo, error: roleError } = await admin
    .from("catalog_staff_roles")
    .select("role,onboarding_active")
    .eq("user_id", userResult.user.id)
    .maybeSingle();
  if (roleError || roleInfo?.role !== "super_admin" || !roleInfo.onboarding_active) {
    return json({ error: "Only the Catalog Super Admin can invite staff." }, 403);
  }

  let payload: Record<string, unknown>;
  try {
    const received = await request.json();
    if (!received || typeof received !== "object" || Array.isArray(received)) throw new Error();
    payload = received as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid invitation request." }, 400);
  }

  // Reinvite an existing, unaccepted Catalog account without changing its access.
  if (payload.action === "reinvite") {
    const targetId = typeof payload.userId === "string" ? payload.userId : "";
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(targetId) || targetId === userResult.user.id)
      return json({ error: "Invalid invitation target." }, 400);
    const { data: targetRole, error: targetRoleError } = await admin.from("catalog_staff_roles").select("role,onboarding_active").eq("user_id", targetId).maybeSingle();
    if (targetRoleError) return json({ error: "Could not verify Catalog access." }, 503);
    if (!targetRole || targetRole.onboarding_active || !ALLOWED_ROLES.has(targetRole.role)) return json({ error: "This account no longer has Catalog access." }, 409);
    const { data: targetResult, error: targetError } = await admin.auth.admin.getUserById(targetId);
    const target = targetResult?.user;
    if (targetError || !target?.email) return json({ error: "Catalog account not found." }, 404);
    if (!target.invited_at) return json({ error: "This invitation is no longer pending. Refresh the staff list." }, 409);
    if (target.email_confirmed_at || target.last_sign_in_at) {
      const { error: recoveryError } = await admin.auth.resetPasswordForEmail(target.email, { redirectTo: catalogInvitationRedirect(origin) });
      if (recoveryError) return json({ error: recoveryError.message || "Could not send a new password setup link." }, 422);
      return json({ ok: true, status: "invited", message: "A new password setup link has been sent." });
    }
    const { data: renewed, error: resendError } = await admin.auth.admin.inviteUserByEmail(target.email, {
      redirectTo: catalogInvitationRedirect(origin),
    });
    if (resendError || renewed.user?.id !== targetId) return json({ error: resendError?.message || "Could not resend this invitation." }, 422);
    return json({ ok: true, status: "invited", message: "Invitation resent successfully." });
  }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const displayName = typeof payload.displayName === "string" ? payload.displayName.trim().replace(/\s+/g, " ") : "";
  const role = typeof payload.role === "string" ? payload.role : "";
  const candidateId = typeof payload.candidateId === "string" ? payload.candidateId : null;
  if (candidateId && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(candidateId)) {
    return json({ error: "Invalid staff candidate." }, 400);
  }

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Enter a valid work email." }, 400);
  }
  if (displayName.length < 2 || displayName.length > 80) {
    return json({ error: "Enter the staff member's full name (2–80 characters)." }, 400);
  }
  if (!ALLOWED_ROLES.has(role)) return json({ error: "Invalid catalog role." }, 400);

  // Precheck against existing Auth users; never overwrite an existing login.
  const { data: existing, error: listingError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listingError) return json({ error: "Could not validate existing accounts." }, 503);
  const previousUser = existing.users.find(user => user.email?.toLowerCase() === email);
  if (previousUser) {
    // Removing Catalog access intentionally retains the Auth identity and audit
    // history. Allow the Super Admin to invite a previously invited, revoked
    // account again, without overwriting an active or pending membership.
    if (previousUser.id === userResult.user.id || !previousUser.invited_at) {
      return json({ error: "This existing account cannot be invited again. Manage its access in Account Permission." }, 409);
    }
    const { data: currentRole, error: currentRoleError } = await admin
      .from("catalog_staff_roles").select("role,onboarding_active").eq("user_id", previousUser.id).maybeSingle();
    const { data: legacyAccess, error: legacyError } = await admin
      .from("catalog_admins").select("user_id").eq("user_id", previousUser.id).maybeSingle();
    if (currentRoleError || legacyError) return json({ error: "Could not verify the existing Catalog account." }, 503);
    if (currentRole) return json({ error: currentRole.onboarding_active
      ? "This account already has Catalog access. Use the role selector."
      : "An invitation is already pending. Open Pending invitations and select Reinvite." }, 409);
    if (legacyAccess) return json({ error: "This account already has Catalog access. Use the role selector." }, 409);

    // INSERT (not UPSERT) prevents concurrent requests overwriting another role.
    const { error: restoreError } = await admin.from("catalog_staff_roles").insert({
      user_id: previousUser.id, role, onboarding_active: false,
      password_setup_at: null, password_login_at: null,
    });
    if (restoreError) {
      console.error("Catalog reinvitation membership restore failed", restoreError.code);
      return json({ error: "Could not restore pending access. Refresh Account Permission and try again." }, 409);
    }
    let deliveryError;
    if (previousUser.email_confirmed_at || previousUser.last_sign_in_at) {
      const result = await admin.auth.resetPasswordForEmail(email, { redirectTo: catalogInvitationRedirect(origin) });
      deliveryError = result.error;
    } else {
      const result = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: catalogInvitationRedirect(origin) });
      deliveryError = result.error || (result.data.user?.id !== previousUser.id ? new Error("Unexpected invitation account.") : null);
    }
    if (deliveryError) {
      console.error("Catalog restored invitation email failed", deliveryError.message);
      return json({ error: "Account restored as pending, but email could not be sent. Refresh Account Permission and select Reinvite." }, 422);
    }
    if (candidateId) {
      const { error: syncError } = await admin.from("catalog_staff_candidates")
        .update({ email, updated_at: new Date().toISOString() }).eq("id", candidateId);
      if (syncError) console.error("Catalog candidate reconciliation failed", syncError.code);
    }
    return json({ ok: true, email, role, status: "invited",
      message: "Account invited again. Catalog access remains pending until password setup and password sign-in are completed." });
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      data: { full_name: displayName },
      redirectTo: catalogInvitationRedirect(origin),
    },
  );
  if (inviteError || !invited.user) {
    return json({ error: inviteError?.message || "Could not send invitation." }, 422);
  }

  // The invitation creates a Catalog Auth ID; only then grant the requested Catalog role.
  const { error: grantedError } = await admin.from("catalog_staff_roles")
    .upsert({ user_id: invited.user.id, role, onboarding_active: false }, { onConflict: "user_id" });
  if (grantedError) {
    console.error("Catalog invitation role grant failed", grantedError.code);
    return json({ error: "Invitation sent but role assignment failed. Contact the Super Admin." }, 500);
  }
  // Catalog membership is granted only after a verified password sign-in.

  if (candidateId) {
    // Reconcile staged OS personnel with their new Catalog Auth identity.
    const { error: syncError } = await admin.from("catalog_staff_candidates")
      .update({ email, updated_at: new Date().toISOString() })
      .eq("id", candidateId);
    if (syncError) {
      console.error("Catalog candidate reconciliation failed", syncError.code);
      // The invitation and role were already granted; do not mask success.
    }
  }

  return json({
    ok: true,
    email,
    role,
    status: "invited",
    message: "Invitation sent. Access becomes active after the recipient sets a password and signs in with it.",
  });
});
