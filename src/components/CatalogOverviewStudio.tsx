import {
  Archive, ArrowRight, ArrowUpRight, CheckCircle2, ChevronRight,
  Layers3, Package, Pencil
} from "lucide-react";
import CustomerInsights from "./CustomerInsights";
import SafeImage from "./SafeImage";
import type { Product, Category } from "../lib/types";

type StatusFilter = "all" | "draft" | "published" | "archived";

interface Props {
  products: Product[];
  categories: Category[];
  loading: boolean;
  asOfMs: number;
  canManageCategories: boolean;
  enabled: boolean;
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

export default function CatalogOverviewStudio({
  products, categories, loading, canManageCategories, enabled,
  onOpenProducts, onOpenCategory, onManageCategories,
}: Props) {
  const total = products.length;
  const drafts = products.filter(product => product.status === "draft");
  const published = products.filter(product => product.status === "published").length;
  const archived = products.filter(product => product.status === "archived").length;
  const categoryInsights = categories.map(category => ({
    ...category,
    count: products.filter(product => product.categoryId === category.id).length,
    photo: products.find(product =>
      product.categoryId === category.id && product.images.length > 0)?.images[0],
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const maxCategoryCount = Math.max(1, ...categoryInsights.map(item => item.count));
  // Use the earlier white cabinet photograph consistently. Picking the first
  // database row made the cover unexpectedly switch to event/party images.
  const featuredPhoto =
    products.find(product =>
      product.name === "White Base Cabinet With Timber Display Shelves" &&
      product.images.length > 0
    )?.images[0]
    ?? products.find(product =>
      product.sku === "PNL-16" && product.images.length > 0
    )?.images[0]
    ?? products.find(product => product.images.length > 0)?.images[0];

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
      <div className="brutti-glass-panels atelier-workbench customer-insights-workbench">
        <CustomerInsights products={products} categories={categories}
          loading={loading} enabled={enabled} onOpenCategory={onOpenCategory} compact />
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
