import { useEffect, useState } from "react";
import { History, ImageOff, ZoomIn } from "lucide-react";
import { getLatestEditedOrAddedProduct, type ActivityEntry } from "../lib/account-center";
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

/** Show the real audit date, weekday, and time in Malaysia local time. */
function formatOverviewActivityTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")} (${get("weekday")}), ${get("hour")}:${get("minute")} ${get("dayPeriod").toLowerCase()} MYT`;
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
}: {
  authenticated: boolean;
  refreshKey: CatalogData;
  onHistory: () => void;
}) {
  const [latest, setLatest] = useState<ActivityEntry | null>(null);
  const [status, setStatus] = useState<RecordStatus>("not-enabled");

  useEffect(() => {
    let mounted = true;
    if (!authenticated) return;
    // Do not fabricate actor/time from product timestamps while audit is absent.
    void getLatestEditedOrAddedProduct().then(record => {
      if (!mounted) return;
      setLatest(record);
      setStatus(record ? "ready" : "empty");
    }).catch(() => {
      if (!mounted) return;
      setLatest(null);
      setStatus("error");
    });
    return () => { mounted = false; };
  }, [authenticated, refreshKey]);

  // Only use the exact audited product ID. Missing/removed product photos are
  // never replaced with an unrelated catalog image.
  const changedProduct = latest?.resource_id
    ? refreshKey.products.find(product => product.id === latest.resource_id)
    : undefined;
  const productPhoto = changedProduct?.images.find(image => image.url.trim());

  const visibleStatus = authenticated ? (status === "not-enabled" ? "loading" : status) : "not-enabled";

  return (
    <section className="catalog-last-activity catalog-latest-updates" aria-label="Latest catalog updates">
      <div className="catalog-last-activity-heading">
        <span className="catalog-latest-title-icon" aria-hidden="true"><History size={18} strokeWidth={1.9} /></span>
        <h2>Latest updates</h2>
      </div>
      {visibleStatus === "ready" && latest ? (
        <div className="catalog-last-activity-details">
          <p className="catalog-latest-product" title={latest.resource_name || latest.resource_type}>
            <strong>{latest.resource_name || latest.resource_type}</strong>{" "}
            <span className="catalog-latest-action">({latest.action === "products_created" ? "added" : "edited"})</span>
          </p>
          <p className="catalog-latest-actor">By {latest.actor_email || "System"}</p>
          <time className="catalog-latest-time" dateTime={latest.created_at}>
            {formatOverviewActivityTime(latest.created_at)}
          </time>
        </div>
      ) : (
        <p className="catalog-last-activity-placeholder">
          {visibleStatus === "loading" ? "Checking latest updates…"
            : visibleStatus === "empty" ? "No product additions or edits recorded yet."
              : visibleStatus === "error" ? "Latest updates are temporarily unavailable."
                : "Updates will appear when your administrator account is verified."}
        </p>
      )}
      {productPhoto ? (
        <a
          className="catalog-last-activity-photo has-photo catalog-latest-photo-link"
          href={publicAssetUrl(productPhoto.url)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={"Open full-size photo of " + (changedProduct?.name ?? "latest product")}
          title="View full product photo"
        >
          <SafeImage
            src={productPhoto.url}
            alt={"Product: " + (changedProduct?.name ?? "")}
            loading="lazy"
          />
          <span className="catalog-latest-photo-zoom" aria-hidden="true"><ZoomIn size={15} /></span>
        </a>
      ) : (
        <div className="catalog-last-activity-photo is-empty" aria-label="No product photo available">
          <span className="catalog-last-activity-photo-empty">
            <ImageOff size={24} aria-hidden="true" />
            <small>No product photo</small>
          </span>
        </div>
      )}
    </section>
  );
}
