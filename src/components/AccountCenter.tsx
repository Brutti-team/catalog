import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Clock3, RefreshCw, Save, ShieldCheck, UserRound, UsersRound, Package, Layers3, Trash2, Plus, ArrowLeftRight } from "lucide-react";
import {
  getAccountSummary, initials, listCatalogActivity, listCatalogStaff,
  roleLabel, updateOwnDisplayName, updateStaffRole,
  type AccountSummary, type ActivityEntry, type StaffMember, type StaffRole,
} from "../lib/account-center";
import { requestPasswordReset } from "../lib/catalog";
import "./account-center.css";
import "./catalog-activity-history-premium.css";

type View = "profile" | "users" | "activity";

const roleOptions: { value: StaffRole | "none"; title: string }[] = [
  { value: "super_admin", title: "Super Admin" },
  { value: "admin", title: "Admin" },
  { value: "editor", title: "Editor" },
  { value: "none", title: "No access" },
];

function dateText(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown"
    : new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }).format(date) + " MYT";
}
function actionText(event: ActivityEntry): string {
  const labels: Record<string, string> = {
    products_created: "Product added",
    products_updated: "Product updated",
    products_deleted: "Product deleted",
    products_id_migrated: "Product IDs migrated",
    categories_created: "Category added",
    categories_updated: "Category updated",
    categories_deleted: "Category deleted",
  };
  return labels[event.action] || event.action.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}
function activityDate(value: string, kind: "date" | "time"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-MY", kind === "date"
    ? { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" }
    : { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kuala_Lumpur" }).format(date);
}
function activityType(entry: ActivityEntry): "products" | "categories" | "system" {
  return entry.action === "products_id_migrated" ? "system"
    : entry.resource_type === "products" ? "products"
    : entry.resource_type === "categories" ? "categories"
    : "system";
}

export default function AccountCenter({
  view, onProfileChanged,
}: {
  view: View;
  onProfileChanged?: (displayName: string) => void;
}) {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [events, setEvents] = useState<ActivityEntry[]>([]);
  const [activityFilter, setActivityFilter] = useState<"all" | "products" | "categories">("all");
  const [draftRoles, setDraftRoles] = useState<Record<string, string>>({});
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setPending(true); setError(""); setMessage("");
    try {
      const current = await getAccountSummary();
      setAccount(current);
      setDisplayName(current.displayName);
      if (view === "users") {
        setMembers(await listCatalogStaff());
        setDraftRoles({});
      } else if (view === "activity") {
        setEvents(await listCatalogActivity());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load this page.");
    } finally {
      setPending(false);
    }
  }, [view]);
  useEffect(() => { void load(); }, [load]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyId("profile"); setError(""); setMessage("");
    try {
      const saved = await updateOwnDisplayName(displayName);
      setDisplayName(saved);
      setAccount(prev => prev ? { ...prev, displayName: saved } : prev);
      onProfileChanged?.(saved);
      setMessage("Your profile has been updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save your profile.");
    } finally { setBusyId(null); }
  }

  async function sendReset() {
    if (!account) return;
    setBusyId("reset"); setError(""); setMessage("");
    try {
      await requestPasswordReset(account.email);
      setMessage("If email delivery is available, a password reset link will arrive in your inbox.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not request a password reset.");
    } finally { setBusyId(null); }
  }

  async function saveMember(user: StaffMember) {
    const requested = draftRoles[user.user_id] ?? (user.role ?? "none");
    const role = requested === "none" ? null : requested as StaffRole;
    if (!window.confirm(`Change access for ${user.email} to ${role ? roleLabel(role) : "No access"}?`)) return;
    setBusyId(user.user_id); setError(""); setMessage("");
    try {
      await updateStaffRole(user.user_id, role);
      setMembers(await listCatalogStaff());
      setDraftRoles({});
      setMessage(`Access updated for ${user.email}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update access.");
    } finally { setBusyId(null); }
  }

  const visibleEvents = activityFilter === "all"
    ? events : events.filter(item => item.resource_type === activityFilter);
  return (
    <section className={`account-center${view === "activity" ? " account-center--activity" : ""}`}>
      <div className="account-heading">
        <div>
          <span className="eyebrow">{view === "users" ? "CATALOG ACCESS CONTROL" : "YOUR BRUTTI WORKSPACE"}</span>
          <h1>{view === "profile" ? "My profile." : view === "users" ? "Account Permission" : "Activity history."}</h1>
          <p>{view === "profile"
            ? "Your name, account and access in one simple place."
            : view === "users"
              ? "View and manage catalog access roles. Only Super Admins can update permissions."
              : "A trustworthy record of changes made by your team."}</p>
        </div>
        <button type="button" className="button secondary" disabled={pending || busyId !== null} onClick={() => void load()}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      {error && <div className="notice error" role="alert"><AlertCircle size={18} /> {error}</div>}
      {message && <div className="account-success" role="status"><CheckCircle2 size={17} /> {message}</div>}
      {pending && <p className="account-muted" role="status">Loading your workspace…</p>}
      {view === "profile" && account && !pending && (
        <div className="account-cards">
          <div className="account-identity">
            <div className="account-initials">{initials(account.displayName)}</div>
            <div className="account-identity-body">
              <h2>{account.displayName}</h2>
              <p>{account.email}</p>
              <span className="account-role"><ShieldCheck size={15} /> {roleLabel(account.role)}</span>
            </div>
          </div>
          <form className="account-settings" onSubmit={(e) => { void saveProfile(e); }}>
            <h3>Personal details</h3>
            <label htmlFor="account-name">Display name</label>
            <input id="account-name" autoComplete="name" maxLength={80} minLength={2} required
              value={displayName} onChange={e => setDisplayName(e.target.value)} />
            <label htmlFor="account-email">Login email</label>
            <input id="account-email" value={account.email} readOnly aria-describedby="account-email-hint" />
            <p id="account-email-hint" className="account-hint">Your login email is managed securely through Supabase Auth.</p>
            <div className="account-profile-actions">
              <button className="button primary" disabled={busyId !== null}><Save size={16} /> Save profile</button>
              <button type="button" className="button secondary" onClick={() => void sendReset()} disabled={busyId !== null}>Reset password</button>
            </div>
          </form>
          <div className="account-mini">
            <Clock3 size={19} />
            <div><strong>Last sign in</strong><p>{dateText(account.lastSignIn)}</p></div>
          </div>
        </div>
      )}
      {view === "users" && !pending && account && (
        account.role !== "super_admin" || !account.managementReady
          ? <div className="account-empty"><ShieldCheck size={28} /><h2>Restricted access</h2>
              <p>{account.role !== "super_admin"
                ? "Only Super Admins can view or change account permissions."
                : "Account permission management is not enabled on this workspace yet."}</p></div>
          : <div className="account-table-wrap">
              <div className="account-table-title"><UsersRound size={19} /><strong>Catalog users</strong><span>{members.length}</span></div>
              <p className="account-hint account-table-hint">Invite new people through Supabase Authentication first. You can then assign their catalog role here. Never share passwords.</p>
              <div className="account-scroll"><table className="account-table">
                <thead><tr><th>Person</th><th>Last login</th><th>Access</th><th /></tr></thead>
                <tbody>{members.map(user => {
                  const draft = draftRoles[user.user_id] ?? user.role ?? "none";
                  return <tr key={user.user_id}>
                    <td><strong>{user.display_name || user.email.split("@")[0]}</strong><span>{user.email}</span>
                    {account.id === user.user_id && <small>Your account</small>}</td>
                    <td>{dateText(user.last_sign_in_at)}</td>
                    <td><select aria-label={`Role for ${user.email}`} value={draft}
                      disabled={account.id === user.user_id || busyId !== null}
                      onChange={e => setDraftRoles(prev => ({ ...prev, [user.user_id]: e.target.value }))}>
                      {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.title}</option>)}
                    </select></td>
                    <td><button type="button" className="button secondary"
                      disabled={account.id === user.user_id || busyId !== null || draft === (user.role || "none")}
                      onClick={() => void saveMember(user)}>Save</button></td>
                  </tr>;
                })}</tbody>
              </table></div>
              {!members.length && <p className="account-muted">No invited users found.</p>}
            </div>
      )}
      {view === "activity" && !pending && account && (
        <div className="account-table-wrap account-activity-panel">
          <div className="account-activity-toolbar">
            <div className="account-activity-toolbar-heading">
              <div className="account-activity-toolbar-icon" aria-hidden="true"><Clock3 size={20}/></div>
              <div>
                <h2>Recent changes <span className="account-activity-count">{events.length}</span></h2>
                <p>Latest recorded changes to your catalog</p>
              </div>
            </div>
            <div className="account-activity-filters" role="group" aria-label="Filter activity by type">
              {([
                { id: "all", label: "All activity" },
                { id: "products", label: "Products" },
                { id: "categories", label: "Categories" },
              ] as const).map(filter => (
                <button
                  type="button"
                  key={filter.id}
                  className={`account-activity-filter${activityFilter === filter.id ? " is-active" : ""}`}
                  aria-pressed={activityFilter === filter.id}
                  onClick={() => setActivityFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          {!events.length ? (
            <div className="account-empty"><Clock3 size={24}/><p>No activity has been recorded yet.</p></div>
          ) : !visibleEvents.length ? (
            <div className="account-activity-empty"><Clock3 size={20}/><p>No {activityFilter} changes in the latest records.</p></div>
          ) : (
            <div className="account-timeline" role="list" aria-label="Recent catalog changes">
              {visibleEvents.map(item => {
                const type = activityType(item);
                const deleted = item.action.endsWith("_deleted");
                const added = item.action.endsWith("_created");
                const migrated = item.action.includes("migrated");
                const Icon = migrated ? ArrowLeftRight : deleted ? Trash2 : added ? Plus : type === "categories" ? Layers3 : type === "products" ? Package : ShieldCheck;
                const typeLabel = type === "products" ? "Product" : type === "categories" ? "Category" : "System";
                return (
                  <article className={`account-event account-event--${type}`} key={item.id} role="listitem">
                    <div className="account-event-track" aria-hidden="true">
                      <span className="account-event-icon"><Icon size={17} strokeWidth={1.9}/></span>
                    </div>
                    <div className="account-event-main">
                      <div className="account-event-heading">
                        <strong>{actionText(item)}</strong>
                        <span className={`account-event-type account-event-type--${type}`}>{typeLabel}</span>
                      </div>
                      <p className="account-event-resource">{item.resource_name || item.resource_type}</p>
                      <div className="account-event-byline">
                        <UserRound size={12} aria-hidden="true"/>
                        <span>{item.actor_email || "System"}</span>
                      </div>
                    </div>
                    <time className="account-event-when" dateTime={item.created_at}>
                      <span>{activityDate(item.created_at, "date")}</span>
                      <small>{activityDate(item.created_at, "time")} MYT</small>
                    </time>
                  </article>
                );
              })}
            </div>
          )}
          {events.length === 50 && (
            <p className="account-activity-limit">Displaying the latest 50 recorded changes.</p>
          )}
        </div>
      )}
      <div className="account-privacy"><UserRound size={15} /> Every session is connected to a unique Supabase user ID. Activity actors are written by database triggers, not by the browser.</div>
    </section>
  );
}
