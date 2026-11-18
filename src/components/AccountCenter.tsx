import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, RefreshCw, Save, ShieldCheck, UserRound, UsersRound, Package, Layers3, Trash2, Plus, ArrowLeftRight, UserPlus, Send, Mail } from "lucide-react";
import {
  catalogActivityMYTRange, getAccountSummary, initials, listCatalogActivity, listCatalogStaff,
  roleLabel, updateOwnDisplayName, updateStaffRole, inviteCatalogStaff, listPendingCatalogStaff,
  type AccountSummary, type ActivityEntry, type ActivityPeriod, type StaffMember, type StaffRole, type PendingCatalogStaff,
} from "../lib/account-center";
import { requestPasswordReset } from "../lib/catalog";
import Modal from "./Modal";
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
  const [pendingStaff, setPendingStaff] = useState<PendingCatalogStaff[]>([]);
  const [events, setEvents] = useState<ActivityEntry[]>([]);
  const [activityFilter, setActivityFilter] = useState<"all" | "products" | "categories">("all");
  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>("today");
  const [mytTodayStart, setMytTodayStart] = useState(() => catalogActivityMYTRange("today").start);
  const activityLoadRequest = useRef(0);
  const [draftRoles, setDraftRoles] = useState<Record<string, string>>({});
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<StaffRole>("editor");

  const load = useCallback(async () => {
    const request = ++activityLoadRequest.current;
    setPending(true); setError(""); setMessage("");
    try {
      const current = await getAccountSummary();
      if (request !== activityLoadRequest.current) return;
      setAccount(current);
      setDisplayName(current.displayName);
      if (view === "users") {
        const [staff, waiting] = await Promise.all([listCatalogStaff(), listPendingCatalogStaff()]);
        if (request !== activityLoadRequest.current) return;
        setMembers(staff);
        setPendingStaff(waiting);
        setDraftRoles({});
      } else if (view === "activity") {
        const entries = await listCatalogActivity(activityPeriod);
        if (request !== activityLoadRequest.current) return;
        setEvents(entries);
      }
    } catch (e) {
      if (request === activityLoadRequest.current)
        setError(e instanceof Error ? e.message : "Unable to load this page.");
    } finally {
      if (request === activityLoadRequest.current) setPending(false);
    }
  }, [view, activityPeriod]);
  // Keep the daily activity view current when a page is left open past midnight MYT.
  useEffect(() => {
    if (view !== "activity") return;
    const checkMalaysiaDate = () => {
      setMytTodayStart(catalogActivityMYTRange("today").start);
    };
    checkMalaysiaDate();
    const timer = window.setInterval(checkMalaysiaDate, 30_000);
    return () => window.clearInterval(timer);
  }, [view]);
  useEffect(() => { void load(); }, [load, mytTodayStart]);

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
    if (account?.role !== "super_admin") { setError("Only a Super Admin can change account roles."); return; }
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

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (account?.role !== "super_admin" || busyId) return;
    setBusyId("invite"); setError(""); setMessage("");
    try {
      const result = await inviteCatalogStaff({
        email: inviteEmail,
        displayName: inviteName,
        role: inviteRole,
      });
      setInviteOpen(false);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("editor");
      const [staff, waiting] = await Promise.all([listCatalogStaff(), listPendingCatalogStaff()]);
      setMembers(staff);
      setPendingStaff(waiting);
      setMessage(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invitation failed. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  function openInvitation(candidate?: PendingCatalogStaff) {
    setError("");
    setInviteName(candidate?.display_name || "");
    setInviteEmail(candidate?.email || "");
    setInviteRole(candidate?.proposed_role || "editor");
    setInviteOpen(true);
  }

  const visibleEvents = activityFilter === "all"
    ? events : events.filter(item => item.resource_type === activityFilter);
  return (
    <section className={`account-center account-center--${view}`}>
      <div className="account-heading">
        <div>
          <span className="eyebrow">{view === "users" ? "CATALOG ACCESS CONTROL" : "YOUR BRUTTI WORKSPACE"}</span>
          <h1>{view === "profile" ? "My profile." : view === "users" ? "Account Permission" : "Activity history."}</h1>
          <p>{view === "profile"
            ? "Your name, account and access in one simple place."
            : view === "users"
              ? "Catalog permissions are visible to Admin and Super Admin. Only Super Admin can change roles."
              : "A trustworthy record of changes made by your team."}</p>
        </div>
        <div className="account-heading-actions">
          {view === "users" && account?.role === "super_admin" && (
            <button type="button" className="button primary account-add-user" disabled={pending || busyId !== null}
              onClick={() => openInvitation()}>
              <UserPlus size={17} aria-hidden="true" /> Add user
            </button>
          )}
          <button type="button" className="button secondary" disabled={pending || busyId !== null} onClick={() => void load()}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
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
        !["super_admin", "admin"].includes(account.role ?? "") || !account.managementReady
          ? <div className="account-empty"><ShieldCheck size={28} /><h2>Restricted access</h2>
              <p>{!["super_admin", "admin"].includes(account.role ?? "")
                ? "Only Admin and Super Admin can view account permissions."
                : "Account permission management is not enabled on this workspace yet."}</p></div>
          : <div className="account-table-wrap">
              <div className="account-table-title"><UsersRound size={19} /><strong>Catalog users</strong><span>{members.length}</span></div>
              <p className="account-hint account-table-hint">Only invited Catalog users appear here. OS single sign-on is not connected yet. Super Admin can invite staff; Admin can view permissions.</p>
              <div className="account-scroll"><table className="account-table">
                <thead><tr><th>Person</th><th>Last login</th><th>Access</th>{account.role === "super_admin" && <th />}</tr></thead>
                <tbody>{members.map(user => {
                  const draft = draftRoles[user.user_id] ?? user.role ?? "none";
                  return <tr key={user.user_id}>
                    <td><strong>{user.display_name || user.email.split("@")[0]}</strong><span>{user.email}</span>
                    {account.id === user.user_id && <small>Your account</small>}
                    {account.id !== user.user_id && (
                      <small className={user.last_sign_in_at ? "catalog-account-status catalog-account-status--active" : "catalog-account-status catalog-account-status--invited"}>
                        {user.last_sign_in_at ? "Active" : "Invited · awaiting first login"}
                      </small>
                    )}</td>
                    <td>{dateText(user.last_sign_in_at)}</td>
                    <td>{account.role === "super_admin" ? (
                      <select aria-label={`Role for ${user.email}`} value={draft}
                        disabled={account.id === user.user_id || busyId !== null}
                        onChange={e => setDraftRoles(prev => ({ ...prev, [user.user_id]: e.target.value }))}>
                        {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.title}</option>)}
                      </select>
                    ) : (
                      <span className="catalog-access-role-readonly">{roleLabel(user.role)}</span>
                    )}</td>
                    {account.role === "super_admin" && (
                      <td><button type="button" className="button secondary"
                        disabled={account.id === user.user_id || busyId !== null || draft === (user.role || "none")}
                        onClick={() => void saveMember(user)}>Save</button></td>
                    )}
                  </tr>;
                })}</tbody>
              </table></div>
              {!members.length && <p className="account-muted">No invited users found.</p>}
              {pendingStaff.length > 0 && (
                <section className="catalog-pending-staff" aria-labelledby="catalog-pending-staff-title">
                  <header className="catalog-pending-staff-heading">
                    <div>
                      <h2 id="catalog-pending-staff-title">OS staff · pending catalog access</h2>
                      <p>These people were matched from Brutti OS details where available. They cannot log in to Catalog until invited and verified. This does not activate OS single sign-on.</p>
                    </div>
                    <span className="catalog-pending-staff-count">{pendingStaff.length} pending</span>
                  </header>
                  <div className="catalog-pending-staff-list">
                    {pendingStaff.map(candidate => (
                      <div className="catalog-pending-staff-item" key={candidate.candidate_id}>
                        <div className="catalog-pending-staff-identity">
                          <strong>{candidate.display_name}</strong>
                          <small>{candidate.email || "Email not confirmed in OS"}</small>
                        </div>
                        <span className="catalog-pending-staff-role">{roleLabel(candidate.proposed_role)}</span>
                        <span className="catalog-pending-staff-state">Not invited</span>
                        {account.role === "super_admin" && (
                          <button type="button" className="catalog-pending-staff-invite"
                            disabled={pending || busyId !== null}
                            onClick={() => openInvitation(candidate)}>
                            <UserPlus size={14} aria-hidden="true" />
                            Invite
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
      )}
      {view === "activity" && !pending && account && (
        <div className="account-table-wrap account-activity-panel">
          <div className="account-activity-toolbar">
            <div className="account-activity-toolbar-heading">
              <div className="account-activity-toolbar-icon" aria-hidden="true"><Clock3 size={20}/></div>
              <div>
                <h2>Recent changes <span className="account-activity-count">{events.length}</span></h2>
                <p>{activityPeriod === "all" ? "Latest recorded changes to your catalog" : activityPeriod === "today" ? "Changes recorded today · Malaysia time" : "Changes recorded yesterday · Malaysia time"}</p>
              </div>
            </div>
            <div className="account-activity-controls">
              <div className="account-activity-period" role="group" aria-label="Filter activity by date">
                <CalendarDays size={16} aria-hidden="true" />
                {([
                  { id: "all", label: "All dates" },
                  { id: "today", label: "Today" },
                  { id: "yesterday", label: "Yesterday" },
                ] as const).map(period => (
                  <button
                    type="button"
                    key={period.id}
                    className={`account-activity-period-button${activityPeriod === period.id ? " is-active" : ""}`}
                    aria-pressed={activityPeriod === period.id}
                    disabled={pending}
                    onClick={() => setActivityPeriod(period.id)}
                  >{period.label}</button>
                ))}
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
          </div>
          {!events.length ? (
            <div className="account-empty"><Clock3 size={24}/><p>{activityPeriod === "today" ? "No activity recorded today." : activityPeriod === "yesterday" ? "No activity recorded yesterday." : "No activity has been recorded yet."}</p></div>
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
          {events.length === (activityPeriod === "all" ? 50 : 200) && (
            <p className="account-activity-limit">Displaying the latest {events.length} recorded changes {activityPeriod === "all" ? "overall" : `for ${activityPeriod}`}.</p>
          )}
        </div>
      )}
      {view === "users" && inviteOpen && account?.role === "super_admin" && (
        <Modal title="Add catalog user" eyebrow="BRUTTI / TEAM ACCESS"
          description="Invite a staff member securely. They receive an email to set up their Catalog access."
          className="catalog-user-invite-dialog"
          onClose={() => { if (busyId !== "invite") setInviteOpen(false); }}>
          <form className="catalog-user-invite-form" onSubmit={event => { void submitInvite(event); }}>
            <label htmlFor="catalog-invite-name">Full name <span>*</span></label>
            <input id="catalog-invite-name" type="text" autoComplete="name"
              minLength={2} maxLength={80} required placeholder="e.g. Arnie"
              value={inviteName} onChange={e => setInviteName(e.target.value)}
              disabled={busyId === "invite"}/>
            <label htmlFor="catalog-invite-email">Email address <span>*</span></label>
            <div className="catalog-invite-email-wrap">
              <Mail size={17} aria-hidden="true" />
              <input id="catalog-invite-email" type="email" autoComplete="off"
                required placeholder="name@example.com" maxLength={254}
                value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                disabled={busyId === "invite"}/>
            </div>
            <label htmlFor="catalog-invite-role">Catalog access <span>*</span></label>
            <select id="catalog-invite-role" value={inviteRole}
              onChange={e => setInviteRole(e.target.value as StaffRole)}
              disabled={busyId === "invite"}>
              <option value="editor">Editor · Products</option>
              <option value="admin">Admin · View permissions</option>
              <option value="super_admin">Super Admin · Manage access</option>
            </select>
            <p className="catalog-user-invite-note">
              This sends a separate Catalog invitation. Brutti OS login is not linked yet.
              Only grant access to the intended team member; no password is shared.
            </p>
            {error && <p className="catalog-user-invite-error" role="alert">{error}</p>}
            <div className="catalog-user-invite-actions">
              <button type="button" className="button secondary" disabled={busyId === "invite"}
                onClick={() => setInviteOpen(false)}>Cancel</button>
              <button className="button primary" type="submit" disabled={busyId === "invite"}>
                <Send size={16} aria-hidden="true"/> {busyId === "invite" ? "Sending invitation…" : "Send invitation"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      <div className="account-privacy"><UserRound size={15} /> Every session is connected to a unique Supabase user ID. Activity actors are written by database triggers, not by the browser.</div>
    </section>
  );
}
