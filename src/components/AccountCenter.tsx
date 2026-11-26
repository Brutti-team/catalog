import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, RefreshCw, Save, ShieldCheck, UserRound, UsersRound, Package, Layers3, Trash2, Plus, ArrowLeftRight, UserPlus, Send, Mail, ChevronDown, Check, ListFilter, Pencil, Eye, EyeOff, Archive, type LucideIcon } from "lucide-react";
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

const inviteAccessOptions = [
  { value: "editor", title: "Editor", detail: "Products", Icon: Pencil, tone: "blue" },
  { value: "admin", title: "Admin", detail: "View permissions", Icon: ShieldCheck, tone: "amber" },
  { value: "super_admin", title: "Super Admin", detail: "Manage access", Icon: ShieldCheck, tone: "violet" },
] as const;

function InviteRolePicker({ value, onChange, disabled }: { value: StaffRole; onChange: (role: StaffRole) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = inviteAccessOptions.find(role => role.value === value) ?? inviteAccessOptions[0];
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
    const outside = (e: PointerEvent) => {
      if (e.target instanceof Node && !root.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); };
  return <div ref={root} className="catalog-invite-role-picker"
    onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}
    onKeyDown={e => {
      if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); close(); }
      if (open && ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const items = Array.from(root.current?.querySelectorAll<HTMLButtonElement>(".catalog-invite-role-option") ?? []);
        if (!items.length) return;
        const i = items.indexOf(document.activeElement as HTMLButtonElement);
        items[e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      }
    }}>
    <button id="catalog-invite-role" ref={trigger} type="button" disabled={disabled} className="catalog-invite-role-trigger"
      aria-label={"Catalog access: " + current.title + ", " + current.detail} aria-expanded={open}
      aria-controls={open ? "catalog-invite-role-options" : undefined} onClick={() => open ? close() : setOpen(true)}>
      <span className={"catalog-invite-role-icon is-" + current.tone}><current.Icon size={17} aria-hidden="true"/></span>
      <span className="catalog-invite-role-copy"><strong>{current.title}</strong><small>{current.detail}</small></span>
      <ChevronDown size={16} className={open ? "is-open" : ""} aria-hidden="true"/>
    </button>
    {open && <div id="catalog-invite-role-options" className="catalog-invite-role-menu" role="group" aria-label="Choose catalog access">
      <small className="catalog-invite-role-menu-label">Access level</small>
      {inviteAccessOptions.map(role => <button key={role.value} type="button" className={"catalog-invite-role-option" + (role.value === value ? " is-selected" : "")}
        aria-pressed={role.value === value} disabled={disabled} onClick={() => { onChange(role.value); close(); }}>
        <span className={"catalog-invite-role-icon is-" + role.tone}><role.Icon size={17} aria-hidden="true"/></span>
        <span className="catalog-invite-role-copy"><strong>{role.title}</strong><small>{role.detail}</small></span>
        {role.value === value && <Check size={16} aria-hidden="true"/>}
      </button>)}
    </div>}
  </div>;
}

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
    products_published: "Product published",
    products_unpublished: "Product unpublished",
    products_archived: "Product archived",
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
  const [activityFilter, setActivityFilter] = useState("all");
  const [activityActor, setActivityActor] = useState("all");
  const [activityNames, setActivityNames] = useState<Record<string,string>>({});
  const [activityMenuOpen, setActivityMenuOpen] = useState(false);
  const activityMenuRef = useRef<HTMLDivElement>(null);
  const activityTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!activityMenuOpen) return;
    const close = (event: PointerEvent) => {
      if (!activityMenuRef.current?.contains(event.target as Node)) setActivityMenuOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setActivityMenuOpen(false); activityTriggerRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key); };
  }, [activityMenuOpen]);
  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>("today");
  useEffect(() => { setActivityMenuOpen(false); }, [view, activityPeriod]);
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
  const [inviteCandidateId, setInviteCandidateId] = useState<string | null>(null);

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
        const [entries, staff] = await Promise.all([
          listCatalogActivity(activityPeriod),
          current.managementReady && (current.role === "admin" || current.role === "super_admin")
            ? listCatalogStaff().catch(() => [] as StaffMember[])
            : Promise.resolve([] as StaffMember[]),
        ]);
        if (request !== activityLoadRequest.current) return;
        const names: Record<string,string> = {};
        for (const member of staff) if (member.display_name?.trim()) names[member.user_id] = member.display_name.trim();
        if (current.displayName.trim()) names[current.id] = current.displayName.trim();
        setActivityNames(names);
        setEvents(entries);
        setActivityActor("all");
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
        ...(inviteCandidateId ? { candidateId: inviteCandidateId } : {}),
      });
      setInviteOpen(false);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("editor");
      setInviteCandidateId(null);
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
    setInviteCandidateId(candidate?.candidate_id || null);
    setInviteOpen(true);
  }

  type FilterOption = { id: string; label: string; icon: LucideIcon; group: string; tone?: string; matches: (entry: ActivityEntry) => boolean };
  const actionMatches = (entry: ActivityEntry, pattern: RegExp) => pattern.test(entry.action.toLowerCase());
  const options: FilterOption[] = [
    {id:"all",label:"All activity",icon:ListFilter,group:"Overview",matches:()=>true},
    {id:"products",label:"Products",icon:Package,group:"Overview",matches:e=>e.resource_type==="products"},
    {id:"categories",label:"Categories",icon:Layers3,group:"Overview",matches:e=>e.resource_type==="categories"},
    {id:"system",label:"System",icon:ShieldCheck,group:"Overview",matches:e=>activityType(e)==="system"},
    {id:"created",label:"Added / created",icon:Plus,group:"Actions",matches:e=>actionMatches(e,/(?:^|_)(created|added|inserted)(?:_|$)/)},
    {id:"updated",label:"Edited / updated",icon:Pencil,group:"Actions",matches:e=>actionMatches(e,/(?:^|_)(updated|edited|modified)(?:_|$)/)},
    {id:"published",label:"Published",icon:Eye,group:"Actions",matches:e=>actionMatches(e,/(?:^|_)(published|publish)(?:_|$)/)},
    {id:"unpublished",label:"Unpublished",icon:EyeOff,group:"Actions",matches:e=>actionMatches(e,/(?:^|_)(unpublished|unpublish)(?:_|$)/)},
    {id:"deleted",label:"Deleted",icon:Trash2,group:"Actions",tone:"danger",matches:e=>actionMatches(e,/(?:^|_)(deleted|removed|delete)(?:_|$)/)},
    {id:"archived",label:"Archived",icon:Archive,group:"Actions",matches:e=>actionMatches(e,/(?:^|_)(archived|archive)(?:_|$)/)},
    {id:"migrated",label:"ID migration",icon:ArrowLeftRight,group:"Actions",matches:e=>actionMatches(e,/migrated|migration/)},
  ];
  const knownActions=options.filter(option=>option.group==="Actions");
  for(const action of [...new Set(events.map(e=>e.action))].sort()){
    if(events.some(e=>e.action===action&&knownActions.some(option=>option.matches(e))))continue;
    const example=events.find(e=>e.action===action);
    if(example)options.push({id:"action:"+action,label:actionText(example),icon:Clock3,group:"Other recorded actions",matches:e=>e.action===action});
  }
  const selectedFilter=options.find(option=>option.id===activityFilter)??options[0];
  const actorKey=(entry:ActivityEntry)=>entry.actor_id ? "id:"+entry.actor_id : entry.actor_email ? "email:"+entry.actor_email.toLowerCase() : "system";
  const actorName=(entry:ActivityEntry)=> (entry.actor_id && activityNames[entry.actor_id]) || (entry.actor_email ? entry.actor_email : "System");
  const actorOptions=Array.from(new Map(events.map(entry=>[actorKey(entry),actorName(entry)])).entries()).sort((a,b)=>a[1].localeCompare(b[1]));
  const visibleEvents=events.filter(entry=>selectedFilter.matches(entry)&&(activityActor==="all"||actorKey(entry)===activityActor));
  return (
    <section className={`account-center account-center--${view}`}>
      <div className="account-heading">
        <div>
          <span className="eyebrow">{view === "users" ? "CATALOG ACCESS CONTROL" : "YOUR BRUTTI WORKSPACE"}</span>
          <h1>{view === "profile" ? "My profile." : view === "users" ? "Account Permission" : "Activity history."}</h1>
          <p>{view === "profile"
            ? "Your name, account and access in one simple place."
            : view === "users"
              ? "Manage team access and invitations. Only Super Admin can change roles."
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
          : <div className="account-table-wrap ap-directory">
              <section className="ap-panel" aria-labelledby="catalog-users-heading">
              <div className="account-table-title">
                <div className="ap-section-icon"><UsersRound size={19} aria-hidden="true"/></div>
                <div className="ap-section-copy"><h2 id="catalog-users-heading">Catalog users</h2><p>Admin can view permissions. Super Admin can manage access.</p></div>
                <span aria-label={members.length + " catalog users"}>{members.length}</span>
              </div>
              <div className="account-scroll"><table className="account-table">
                <thead><tr><th>Team member</th><th>Last login</th><th>Access role</th>{account.role === "super_admin" && <th>Action</th>}</tr></thead>
                <tbody>{members.map(user => {
                  const draft = draftRoles[user.user_id] ?? user.role ?? "none";
                  return <tr key={user.user_id} data-role={user.role || "none"}>
                    <td><div className="ap-person"><span className="ap-avatar" aria-hidden="true">{initials(user.display_name || user.email.split("@")[0])}</span><div className="ap-person-copy"><strong>{user.display_name || user.email.split("@")[0]}</strong><span className="ap-email">{user.email}</span>
                    {account.id === user.user_id && <small>Your account</small>}
                    {account.id !== user.user_id && (
                      <small className={user.last_sign_in_at ? "catalog-account-status catalog-account-status--active" : "catalog-account-status catalog-account-status--invited"}>
                        {user.last_sign_in_at ? "Active" : "Invited · awaiting first login"}
                      </small>
                    )}</div></div></td>
                    <td><div className="ap-last-login"><Clock3 size={14} aria-hidden="true"/>{dateText(user.last_sign_in_at)}</div></td>
                    <td>{account.role === "super_admin" ? (
                      <div className="ap-role-field" data-role={draft}><ShieldCheck size={14} aria-hidden="true"/><select aria-label={`Role for ${user.email}`} value={draft}
                        disabled={account.id === user.user_id || busyId !== null}
                        onChange={e => setDraftRoles(prev => ({ ...prev, [user.user_id]: e.target.value }))}>
                        {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.title}</option>)}
                      </select></div>
                    ) : (
                      <span className="catalog-access-role-readonly"><ShieldCheck size={13} aria-hidden="true"/>{roleLabel(user.role)}</span>
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
              </section>
              {pendingStaff.length > 0 && (
                <section className="catalog-pending-staff ap-panel" aria-labelledby="catalog-pending-staff-title">
                  <header className="catalog-pending-staff-heading">
                    <span className="ap-section-icon is-pending"><Mail size={19} aria-hidden="true"/></span>
                    <div className="ap-section-copy">
                      <h2 id="catalog-pending-staff-title">Pending invitations</h2>
                      <p>Brutti OS staff awaiting access. Staff can sign in after invitation and verification. OS single sign-on is not connected.</p>
                    </div>
                    <span className="catalog-pending-staff-count">{pendingStaff.length} pending</span>
                  </header>
                  <div className="catalog-pending-staff-list">
                    <div className={"ap-pending-columns" + (account.role === "super_admin" ? "" : " is-readonly")} aria-hidden="true"><span>Team member</span><span>Access role</span><span>Status</span>{account.role === "super_admin" && <span>Action</span>}</div>
                    {pendingStaff.map(candidate => (
                      <div className="catalog-pending-staff-item" key={candidate.candidate_id} data-role={candidate.proposed_role}>
                        <div className="catalog-pending-staff-identity">
                          <span className="ap-avatar" aria-hidden="true">{initials(candidate.display_name)}</span>
                          <div className="ap-person-copy"><strong>{candidate.display_name}</strong>
                          <small className="ap-email">{candidate.email || "Email not confirmed in OS"}</small></div>
                        </div>
                        <span className="catalog-pending-staff-role">{candidate.proposed_role === "editor" ? <Pencil size={13} aria-hidden="true"/> : <ShieldCheck size={13} aria-hidden="true"/>}{roleLabel(candidate.proposed_role)}</span>
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
                <h2>Recent changes <span className="account-activity-count">{visibleEvents.length}</span></h2>
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
              <div className="activity-actor-picker">
                <UsersRound size={16} aria-hidden="true"/>
                <select aria-label="Filter activity by staff name" value={activityActor} onChange={event=>setActivityActor(event.target.value)}>
                  <option value="all">All staff</option>
                  {actorOptions.map(([key,name])=><option value={key} key={key}>{name}</option>)}
                </select>
                <ChevronDown size={15} aria-hidden="true"/>
              </div>
              <div className="activity-type-dropdown" ref={activityMenuRef}>
                <button ref={activityTriggerRef} type="button" className={"activity-type-trigger"+(activityMenuOpen?" is-open":"")}
                  aria-expanded={activityMenuOpen} aria-controls={activityMenuOpen?"activity-type-options":undefined}
                  onClick={()=>setActivityMenuOpen(open=>!open)}>
                  <selectedFilter.icon size={17} strokeWidth={1.8} aria-hidden="true"/>
                  <span>{selectedFilter.label}</span>
                  <ChevronDown className="activity-type-chevron" size={16} aria-hidden="true"/>
                </button>
                {activityMenuOpen&&<div id="activity-type-options" className="activity-type-menu" role="group" aria-label="Filter activity by type"
                  onBlur={event=>{if(event.relatedTarget&&!activityMenuRef.current?.contains(event.relatedTarget as Node))setActivityMenuOpen(false);}}>
                  {[...new Set(options.map(option=>option.group))].map(group=><div className="activity-type-group" key={group}>
                    <p>{group}</p>
                    {options.filter(option=>option.group===group).map(option=><button type="button" key={option.id}
                      className={"activity-type-option"+(selectedFilter.id===option.id?" is-selected":"")+(option.tone?" is-"+option.tone:"")}
                      aria-pressed={selectedFilter.id===option.id}
                      onClick={()=>{setActivityFilter(option.id);setActivityMenuOpen(false);activityTriggerRef.current?.focus();}}>
                      <option.icon size={16} strokeWidth={1.8} aria-hidden="true"/>
                      <span>{option.label}</span>
                      <small>{events.filter(option.matches).length}</small>
                      <span className="activity-type-check">{selectedFilter.id===option.id&&<Check size={15} aria-hidden="true"/>}</span>
                    </button>)}
                  </div>)}
                </div>}
              </div>
            </div>
          </div>
          {!events.length ? (
            <div className="account-empty account-activity-empty-state" role="status">
              <span className="account-activity-empty-icon" aria-hidden="true"><Clock3 size={23} strokeWidth={1.7}/></span>
              <strong>{activityPeriod === "today" ? "No activity recorded today." : activityPeriod === "yesterday" ? "No activity recorded yesterday." : "No activity has been recorded yet."}</strong>
              <p>Product and category updates will appear here when recorded.</p>
            </div>
          ) : !visibleEvents.length ? (
            <div className="account-activity-empty account-activity-empty-state" role="status">
              <span className="account-activity-empty-icon" aria-hidden="true"><Clock3 size={23} strokeWidth={1.7}/></span>
              <strong>No matching activity records.</strong>
              <p>Try another staff member, activity type or date.</p>
            </div>
          ) : (
            <div className="account-timeline" role="list" aria-label="Recent catalog changes">
              {visibleEvents.map(item => {
                const type = activityType(item);
                const deleted = /(?:^|_)(deleted|removed|delete)(?:_|$)/.test(item.action);
                const published = /(?:^|_)(published|publish)(?:_|$)/.test(item.action);
                const unpublished = /(?:^|_)(unpublished|unpublish)(?:_|$)/.test(item.action);
                const added = item.action.endsWith("_created");
                const migrated = item.action.includes("migrated");
                const Icon = migrated ? ArrowLeftRight : deleted ? Trash2 : published ? Eye : unpublished ? EyeOff : added ? Plus : type === "categories" ? Layers3 : type === "products" ? Package : ShieldCheck;
                const typeLabel = type === "products" ? "Product" : type === "categories" ? "Category" : "System";
                const name = actorName(item);
                return (
                  <article className={`account-event account-event--${type}`} key={item.id} role="listitem">
                    <div className="account-event-track" aria-hidden="true">
                      <span className="account-event-icon"><Icon size={17} strokeWidth={1.9}/></span>
                    </div>
                    <div className="account-event-main">
                      <div className="account-event-heading">
                        <strong>{item.resource_name || item.resource_type}</strong>
                        <span className={`account-event-type account-event-type--${type}`}>{typeLabel}</span>
                      </div>
                      <p className="account-event-resource">{actionText(item)}</p>
                    </div>
                    <div className="account-event-person" title={item.actor_email || name}>
                      <span className="account-event-avatar" aria-hidden="true">{name==="System"?<ShieldCheck size={15}/>:initials(name)}</span>
                      <div><small>By</small><strong>{name}</strong></div>
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
              minLength={2} maxLength={80} required placeholder="e.g. Wani"
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
            <InviteRolePicker value={inviteRole} onChange={setInviteRole} disabled={busyId === "invite"}/>
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
