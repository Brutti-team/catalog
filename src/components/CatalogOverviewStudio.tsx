import { useId, useMemo, useState } from "react";
import {
  Archive, ArrowRight, ArrowUpRight, CheckCircle2, ChevronDown, ChevronRight,
  ChartNoAxesCombined, Images, Layers3, Package, Pencil, ShieldCheck
} from "lucide-react";
import SafeImage from "./SafeImage";
import type { Product, Category } from "../lib/types";

type StatusFilter = "all" | "draft" | "published" | "archived";
type Days = 7 | 30 | 90;

interface Props {
  products: Product[];
  categories: Category[];
  loading: boolean;
  asOfMs: number;
  canManageCategories: boolean;
  onOpenProducts: (status: StatusFilter) => void;
  onOpenCategory: (categoryId: string) => void;
  onManageCategories: () => void;
}

/** Date-bucket the current products' most recent update in Malaysian local time.
 * This is NOT an audit log and intentionally never invents events or growth. */
function mytDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const get = (part: string) => parts.find(item => item.type === part)?.value ?? "";
  return get("year") + "-" + get("month") + "-" + get("day");
}

export function getUpdateActivity(
  products: readonly Pick<Product, "updatedAt">[], days: number, asOfMs: number
): { keys: string[]; cumulative: number[]; total: number } {
  const period = Math.max(1, Math.min(90, Math.trunc(days)));
  const today = mytDateKey(new Date(asOfMs));
  const todayUtc = Date.parse(today + "T00:00:00Z");
  const keys = Array.from({ length: period }, (_, index) =>
    new Date(todayUtc - (period - 1 - index) * 86_400_000).toISOString().slice(0, 10));
  const counts = new Map(keys.map(key => [key, 0]));
  for (const product of products) {
    const timestamp = Date.parse(product.updatedAt);
    if (!Number.isFinite(timestamp) || timestamp > asOfMs) continue;
    const key = mytDateKey(new Date(timestamp));
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let running = 0;
  const cumulative = keys.map(key => (running += counts.get(key) ?? 0));
  return { keys, cumulative, total: running };
}

const shortDate = (dateKey: string): string =>
  new Intl.DateTimeFormat("en-MY", { month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(dateKey + "T12:00:00Z"));

function ActivityChart({ products, days, asOfMs }: {
  products: Product[]; days: Days; asOfMs: number
}) {
  const gradientId = useId().replace(/:/g, "");
  const activity = useMemo(() => getUpdateActivity(products, days, asOfMs), [products, days, asOfMs]);

  // Display real last-update counts, grouped to avoid 30/90 cramped daily columns.
  // Unlike a cumulative line, this does not imply continuous growth or invented activity.
  const binSize = days === 7 ? 1 : days === 30 ? 5 : 10;
  const dailyCounts = activity.cumulative.map((count, index) =>
    count - (activity.cumulative[index - 1] ?? 0));
  const bins = Array.from({ length: Math.ceil(activity.keys.length / binSize) }, (_, index) => {
    const start = index * binSize;
    const end = Math.min(start + binSize, activity.keys.length);
    const count = dailyCounts.slice(start, end).reduce((sum, value) => sum + value, 0);
    const firstDate = shortDate(activity.keys[start]);
    const lastDate = shortDate(activity.keys[end - 1]);
    return {
      count,
      label: shortDate(activity.keys[Math.floor((start + end - 1) / 2)]),
      range: firstDate === lastDate ? firstDate : firstDate + " – " + lastDate,
    };
  });
  const max = Math.max(2, ...bins.map(bin => bin.count));
  const xStart = 55, xEnd = 625, yTop = 28, yBase = 157;
  const barSlot = (xEnd - xStart) / bins.length;
  const barWidth = Math.min(45, barSlot * .54);
  const yValue = (value: number) => yBase - (value / max) * (yBase - yTop);
  const gridValues = [max, Math.round(max / 2), 0];
  const granularity = days === 7 ? "daily" : days === 30 ? "5-day" : "10-day";

  return (
    <div className="brutti-activity-chart">
      <div className="brutti-activity-chart-legend" aria-hidden="true">
        <span className="brutti-activity-chart-key" />
        Product updates
        <span className="brutti-activity-chart-granularity">{granularity} groups</span>
      </div>
      <svg viewBox="0 0 640 197" role="img"
        aria-label={"Products by latest update date over the last " + days + " days: " + activity.total + " products"}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#245c40" />
            <stop offset="100%" stopColor="#83a68a" />
          </linearGradient>
        </defs>
        {gridValues.map((value, index) => (
          <g key={index} className="brutti-activity-gridline">
            <line x1={xStart} x2={xEnd} y1={yValue(value)} y2={yValue(value)} />
            <text x={xStart - 12} y={yValue(value) + 4} textAnchor="end">{value}</text>
          </g>
        ))}
        {bins.map((bin, index) => {
          const x = xStart + (index + .5) * barSlot;
          const height = bin.count / max * (yBase - yTop);
          return (
            <g key={bin.range} className={bin.count ? "brutti-activity-bin is-active" : "brutti-activity-bin"}>
              <title>{bin.range + ": " + bin.count + (bin.count === 1 ? " product" : " products")}</title>
              <rect className="brutti-activity-bar-track" x={x - barWidth / 2}
                y={yTop} width={barWidth} height={yBase - yTop} rx="7" />
              {bin.count > 0 ? (
                <>
                  <rect className="brutti-activity-bar" x={x - barWidth / 2}
                    y={yBase - height} width={barWidth} height={height}
                    rx={Math.min(7, height / 2)} fill={"url(#" + gradientId + ")"} />
                  <text className="brutti-activity-bar-value" x={x}
                    y={Math.max(15, yBase - height - 8)} textAnchor="middle">{bin.count}</text>
                </>
              ) : (
                <rect className="brutti-activity-bar-zero" x={x - barWidth / 2}
                  y={yBase - 2} width={barWidth} height="2" rx="1" />
              )}
              <text className="brutti-activity-axis-date" x={x} y="188"
                textAnchor="middle">{bin.label}</text>
            </g>
          );
        })}
      </svg>
      {activity.total === 0 && (
        <p className="brutti-activity-empty">No product updates recorded in this period.</p>
      )}
    </div>
  );
}

export default function CatalogOverviewStudio({
  products, categories, loading, asOfMs, canManageCategories,
  onOpenProducts, onOpenCategory, onManageCategories,
}: Props) {
  const [days, setDays] = useState<Days>(30);
  const total = products.length;
  const drafts = products.filter(product => product.status === "draft");
  const published = products.filter(product => product.status === "published").length;
  const archived = products.filter(product => product.status === "archived").length;
  const withPhotos = products.filter(product => product.images.length > 0).length;
  const activeInPeriod = getUpdateActivity(products, days, asOfMs).total;
  const categoryInsights = categories.map(category => ({
    ...category,
    count: products.filter(product => product.categoryId === category.id).length,
    photo: products.find(product =>
      product.categoryId === category.id && product.images.length > 0)?.images[0],
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const maxCategoryCount = Math.max(1, ...categoryInsights.map(item => item.count));
  const featuredPhoto = products.find(product => product.images.length)?.images[0];

  const cards = [
    { title: "Categories", value: categories.length, caption: "Collection groups", icon: Layers3, status: "categories" as const },
    { title: "Drafts", value: drafts.length, caption: "Awaiting final review", icon: Pencil, status: "draft" as const },
    { title: "Published", value: published, caption: "Live in public catalog", icon: CheckCircle2, status: "published" as const },
    { title: "Archived", value: archived, caption: "Stored from public view", icon: Archive, status: "archived" as const },
  ];

  return (
    <section className="brutti-glass-overview" aria-label="Collection overview">
      <div className="brutti-glass-backdrop" aria-hidden="true">
        {featuredPhoto && <SafeImage src={featuredPhoto.url} alt="" loading="lazy" />}
      </div>
      <div className="brutti-glass-topline">
        <div>
          <span className="brutti-glass-kicker">BRUTTI COLLECTION / OVERVIEW</span>
          <h2>Collection snapshot</h2>
        </div>
        <span className="brutti-glass-live"><span aria-hidden="true" /> Live inventory</span>
      </div>
      <div className="overview-stats brutti-glass-kpis">
        <button type="button" className="overview-stat brutti-glass-kpi brutti-glass-kpi-featured"
          disabled={loading} aria-label="View all products" onClick={() => onOpenProducts("all")}>
          {featuredPhoto && <SafeImage className="brutti-glass-kpi-photo" src={featuredPhoto.url} alt="" loading="lazy" />}
          <span className="brutti-glass-kpi-head">
            <span className="brutti-glass-icon"><Package size={20} strokeWidth={1.7} aria-hidden="true" /></span>
            <span className="brutti-glass-kpi-title">Total products</span>
          </span>
          <strong>{loading ? "—" : total}</strong>
          <span className="brutti-glass-kpi-caption">Pieces in the collection <ArrowUpRight size={13} aria-hidden="true" /></span>
        </button>
        <div className="brutti-metric-tray" role="group" aria-label="Collection status">
          {cards.map(card => (
            <button type="button" className="overview-stat brutti-glass-kpi" key={card.title}
              disabled={loading}
              aria-label={"View " + card.title.toLowerCase()}
              onClick={() => card.status === "categories" ? onManageCategories() : onOpenProducts(card.status)}>
              <span className="brutti-glass-kpi-head">
                <span className="brutti-glass-icon"><card.icon size={19} strokeWidth={1.8} aria-hidden="true" /></span>
                <span className="brutti-glass-kpi-title">{card.title}</span>
              </span>
              <strong>{loading ? "—" : card.value}</strong>
              <span className="brutti-glass-kpi-caption">{card.caption}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="brutti-glass-panels atelier-workbench">
        <section className="brutti-activity-panel atelier-review" aria-labelledby="brutti-activity-title">
          <div className="brutti-glass-panel-heading">
            <div className="brutti-glass-panel-title">
              <ChartNoAxesCombined size={21} aria-hidden="true" />
              <div>
                <h2 id="brutti-activity-title">Catalog activity</h2>
                <p>Latest product changes from saved records.</p>
              </div>
            </div>
            <label className="brutti-activity-range">
              <span className="sr-only">Activity time range</span>
              <select value={days} onChange={event => setDays(Number(event.target.value) as Days)}>
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </label>
          </div>
          <div className="brutti-activity-layout">
            <ActivityChart products={products} days={days} asOfMs={asOfMs} />
            <aside className="brutti-activity-summary" aria-label="Publishing overview">
              <div className="brutti-activity-summary-item">
                <span>Awaiting review</span>
                <strong className="brutti-activity-big">{loading ? "—" : drafts.length}</strong>
              </div>
              <div className="brutti-activity-summary-item">
                <span>Updated in {days} days</span>
                <strong className="brutti-activity-updated">{activeInPeriod}</strong>
              </div>
              <button type="button" onClick={() => onOpenProducts("draft")}>
                Review drafts <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            </aside>
          </div>
          <div className="brutti-activity-readiness">
            <div>
              <span><Images size={14} aria-hidden="true" /> With photos <strong>{withPhotos} / {total}</strong></span>
              <progress value={withPhotos} max={Math.max(1, total)} aria-label="Products with photos" />
            </div>
            <div>
              <span><ShieldCheck size={14} aria-hidden="true" /> Published <strong>{published} / {total}</strong></span>
              <progress value={published} max={Math.max(1, total)} aria-label="Published products" />
            </div>
          </div>
        </section>
        <section className="brutti-category-panel atelier-categories" aria-labelledby="brutti-category-title">
          <div className="brutti-glass-panel-heading">
            <div className="brutti-glass-panel-title">
              <Layers3 size={21} aria-hidden="true" />
              <div>
                <h2 id="brutti-category-title">Categories</h2>
                <p>Explore your collection by category.</p>
              </div>
            </div>
            {canManageCategories && (
              <button type="button" className="brutti-category-manage" onClick={onManageCategories}>
                Manage categories <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="brutti-category-list">
            {categoryInsights.slice(0, 5).map(item => (
              <button type="button" key={item.id} className="atelier-category-row brutti-category-row"
                onClick={() => onOpenCategory(item.id)}
                aria-label={"View " + item.name + ", " + item.count + " products"}>
                <span className="brutti-category-image">
                  {item.photo ? <SafeImage src={item.photo.url} alt="" loading="lazy" /> :
                    <Layers3 size={21} aria-hidden="true" />}
                </span>
                <span className="brutti-category-name">
                  <strong>{item.name}</strong>
                  <span className="atelier-category-track"><span style={{ width: item.count / maxCategoryCount * 100 + "%" }} /></span>
                </span>
                <span className="brutti-category-count">{item.count} <span>products</span></span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ))}
            {!categoryInsights.length && <p className="brutti-category-empty">No categories yet.</p>}
          </div>
          {categoryInsights.length > 5 && <button type="button" className="brutti-all-categories" onClick={onManageCategories}>
            View all {categoryInsights.length} categories <ArrowRight size={14} aria-hidden="true" />
          </button>}
        </section>
      </div>
    </section>
  );
}
