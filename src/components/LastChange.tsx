import { useEffect, useState } from "react";
import { History, ImageOff, ArrowRight } from "lucide-react";
import { getTodayProductUpdates, catalogActivityMYTRange, type ActivityEntry } from "../lib/account-center";
import SafeImage from "./SafeImage";
import { publicAssetUrl } from "../lib/assets";
import type { CatalogData } from "../lib/types";

type RecordStatus = "not-enabled" | "loading" | "ready" | "empty" | "error";

/** Dates are always shown in Brutti's local Malaysia time zone. */
export function formatActivityTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return `${new Intl.DateTimeFormat("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date)} MYT`;
}

export function activityLabel(event: Pick<ActivityEntry, "action" | "resource_type">): string {
  const translated: Record<string, string> = {
    products_created: "Product added",
    products_updated: "Product edited",
    products_deleted: "Product deleted",
    categories_created: "Category added",
    categories_updated: "Category edited",
    categories_deleted: "Category deleted",
    product_published: "Product published",
    product_draft: "Product moved to draft",
    product_archived: "Product archived",
    staff_role_changed: "Staff access changed",
    staff_access_revoked: "Staff access removed",
  };
  return translated[event.action] ?? event.action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function LastChange({
  authenticated,
  refreshKey,
  onHistory,
}: {
  authenticated: boolean;
  refreshKey: CatalogData;
  onHistory: () => void;
}) {
  const [updates, setUpdates] = useState<ActivityEntry[]>([]);
  const [status, setStatus] = useState<RecordStatus>("not-enabled");
  const [day, setDay] = useState(() => catalogActivityMYTRange("today").start);

  useEffect(() => {
    if (!authenticated) return;
    const checkDay = () => setDay(catalogActivityMYTRange("today").start);
    const timer = window.setInterval(checkDay, 15000);
    window.addEventListener("focus", checkDay);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", checkDay); };
  }, [authenticated]);

  useEffect(() => {
    let mounted = true;
    if (!authenticated) { setUpdates([]); setStatus("not-enabled"); return; }
    setStatus("loading");
    void getTodayProductUpdates(new Date(day)).then(records => {
      if (!mounted) return;
      setUpdates(records);
      setStatus(records.length ? "ready" : "empty");
    }).catch(() => {
      if (!mounted) return;
      setUpdates([]);
      setStatus("error");
    });
    return () => { mounted = false; };
  }, [authenticated, refreshKey, day]);

  const visibleStatus = authenticated ? (status === "not-enabled" ? "loading" : status) : "not-enabled";
  return (
    <section className="catalog-today-feed" aria-label="Latest catalog updates">
      <header className="catalog-today-feed-head">
        <span className="catalog-today-feed-icon" aria-hidden="true"><History size={19} strokeWidth={1.8} /></span>
        <div className="catalog-today-feed-title"><h2>Latest updates</h2><p>Today's catalog activity</p></div>
        <button type="button" className="catalog-today-feed-history" onClick={onHistory}>View activity <ArrowRight size={15} aria-hidden="true" /></button>
      </header>
      <div className="catalog-today-feed-list" aria-live="polite" aria-busy={visibleStatus === "loading"}>
        {visibleStatus === "ready" ? updates.map(event => {
          const product = event.resource_id ? refreshKey.products.find(p => p.id === event.resource_id) : undefined;
          const photo = product?.images.find(image => image.url.trim());
          const added = event.action === "products_created";
          const name = event.resource_name || event.resource_type;
          const date = new Date(event.created_at);
          const time = Number.isNaN(date.getTime()) ? "Time unavailable" : new Intl.DateTimeFormat("en-MY", {
            timeZone: "Asia/Kuala_Lumpur", hour: "numeric", minute: "2-digit", hour12: true,
          }).format(date).toUpperCase();
          return <article key={event.id} className="catalog-today-feed-row">
            {photo ? <a className="catalog-today-feed-photo" href={publicAssetUrl(photo.url)} target="_blank" rel="noopener noreferrer" aria-label={"Open full-size photo of " + name} title="View full product photo">
              <SafeImage src={photo.url} alt="" loading="lazy" />
            </a> : <span className="catalog-today-feed-photo" aria-label="No product photo available"><ImageOff size={19} aria-hidden="true" /></span>}
            <div className="catalog-today-feed-copy">
              <div className="catalog-today-feed-name"><strong title={name}>{name}</strong><span className={"catalog-today-feed-action" + (added ? " is-added" : "")}>{added ? "Added" : "Edited"}</span></div>
              <small>By {event.actor_email || "System"}</small>
            </div>
            <time className="catalog-today-feed-time" dateTime={event.created_at} title={formatActivityTime(event.created_at)}><strong>{time}</strong><small>Today · MYT</small></time>
          </article>;
        }) : <p className="catalog-today-feed-empty">{visibleStatus === "loading" ? "Checking latest updates…" : visibleStatus === "empty" ? "No product additions or edits today." : visibleStatus === "error" ? "Latest updates are temporarily unavailable." : "Updates will appear when your administrator account is verified."}</p>}
      </div>
    </section>
  );
}
