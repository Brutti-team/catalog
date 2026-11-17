import { useEffect, useId, useMemo, useState } from "react";
import {
  ArrowUpRight, ChartNoAxesCombined, ChevronDown, Eye, Layers3, MousePointerClick,
  RefreshCw, UsersRound, Zap
} from "lucide-react";
import SafeImage from "./SafeImage";
import { loadCustomerInsights, type CustomerInsightData, type InsightPeriod } from "../lib/customer-analytics";
import type { Category, Product } from "../lib/types";

type Props = {
  products: Product[];
  categories: Category[];
  loading: boolean;
  enabled: boolean;
  onOpenCategory: (id: string) => void;
  compact?: boolean;
};

const nfmt = new Intl.NumberFormat("en-MY");
const fdate = (date: string) => new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));
const compact = (value: number) => nfmt.format(value);

function CustomerInterestChart({ data, days }: { data: CustomerInsightData; days: InsightPeriod }) {
  const id = useId().replace(/:/g, "");
  const binSize = days === 7 ? 1 : days === 30 ? 5 : 15;
  const bins = Array.from({ length: Math.ceil(data.trend.length / binSize) }, (_, index) => {
    const rows = data.trend.slice(index * binSize, index * binSize + binSize);
    return {
      views: rows.reduce((sum, row) => sum + row.views, 0),
      label: rows.length ? fdate(rows[Math.floor((rows.length - 1) / 2)].date) : "",
      range: rows.length ? fdate(rows[0].date) + " – " + fdate(rows[rows.length - 1].date) : "",
    };
  });
  const max = Math.max(2, ...bins.map(bin => bin.views));
  const yTop = 27, yBase = 194, xStart = 52, xEnd = 736;
  const slot = (xEnd - xStart) / Math.max(1, bins.length);
  const bw = Math.min(66, slot * .63);
  const y = (v: number) => yBase - v / max * (yBase - yTop);
  const grid = [max, Math.round(max / 2), 0];
  return (
    <div className="customer-insights-chart">
      <div className="customer-insights-chart-heading">
        <div><span className="customer-insights-chart-dot" /><strong>Product interest (views)</strong></div>
        <span>{days === 7 ? "Daily" : days === 30 ? "5-day groups" : "15-day groups"}</span>
      </div>
      <svg viewBox="0 0 766 235" role="img"
        aria-label={`Product views in the last ${days} days: ${compact(data.totalViews)}. Each bar represents a date group.`}>
        <defs><linearGradient id={`customer-gradient-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#236344" />
          <stop offset="100%" stopColor="#a1c3a5" />
        </linearGradient></defs>
        {grid.map((value, index) => <g key={index} className="customer-insights-gridline">
          <line x1={xStart} x2={xEnd} y1={y(value)} y2={y(value)} />
          <text x={xStart - 15} y={y(value) + 5} textAnchor="end">{value}</text>
        </g>)}
        {bins.map((bin, index) => {
          const x = xStart + (index + .5) * slot;
          const height = bin.views / max * (yBase - yTop);
          return <g key={bin.range}>
            <title>{bin.range}: {bin.views} views</title>
            <rect className="customer-insights-bar-track" x={x - bw / 2} y={yTop} width={bw} height={yBase - yTop} rx="9" />
            {bin.views > 0
              ? <rect x={x - bw / 2} y={yBase - height} width={bw} height={height}
                  rx={Math.min(9, height / 2)} fill={`url(#customer-gradient-${id})`} />
              : <rect className="customer-insights-zero" x={x - bw / 2} y={yBase - 2} width={bw} height={2} rx="1" />}
            {bin.views > 0 && <text className="customer-insights-bar-number" x={x}
              y={Math.max(18, yBase - height - 8)} textAnchor="middle">{compact(bin.views)}</text>}
            <text className="customer-insights-x-label" x={x} y="225" textAnchor="middle">{bin.label}</text>
          </g>;
        })}
      </svg>
      {data.totalViews === 0 && <p className="customer-insights-chart-empty">No product views recorded for this period.</p>}
    </div>
  );
}

export default function CustomerInsights({ products, categories, loading: productsLoading, enabled, onOpenCategory, compact = false }: Props) {
  const [days, setDays] = useState<InsightPeriod>(30);
  const [data, setData] = useState<CustomerInsightData | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void loadCustomerInsights(days).then(result => {
      if (!live) return;
      setData(result);
      setError(null);
      setBusy(false);
    }).catch((reason: unknown) => {
      if (!live) return;
      setError(reason instanceof Error ? reason.message : "Customer insights could not be loaded.");
      setData(null);
      setBusy(false);
    });
    return () => { live = false; };
  }, [days, enabled, refresh]);

  const topProduct = data?.topProductId ? products.find(item => item.id === data.topProductId) : null;
  const categoryLookup = useMemo(() => new Map(categories.map(category => [category.id, category.name])), [categories]);
  const categoryRows = data?.categories ?? [];
  const categoryMax = Math.max(1, ...categoryRows.map(row => row.views));
  const clickRate = data?.totalViews ? (data.productClicks / data.totalViews * 100).toFixed(1) + "%" : "—";
  const viewsPerSession = data?.visitorSessions ? (data.totalViews / data.visitorSessions).toFixed(1) : "—";
  const totals = [
    { name: "Total product views", value: data?.totalViews, Icon: Eye },
    { name: "Visitor sessions", value: data?.visitorSessions, Icon: UsersRound },
    { name: "Product clicks", value: data?.productClicks, Icon: MousePointerClick },
    { name: "Products viewed", value: data?.productsViewed, Icon: Layers3 },
  ];

  return (
    <section className={`customer-insights-panel${compact ? " is-compact" : ""}`} aria-labelledby="customer-insights-title">
      <header className="customer-insights-header">
        <div className="customer-insights-heading">
          <ChartNoAxesCombined size={27} strokeWidth={1.8} aria-hidden="true" />
          <div>
            <h2 id="customer-insights-title">Product View Analytics</h2>
            <p>Understand what customers explore in your public catalog.</p>
          </div>
        </div>
        <label className="customer-insights-period">
          <span className="sr-only">Customer insights time range</span>
          <select value={days} onChange={event => { setDays(Number(event.target.value) as InsightPeriod); setBusy(true); }}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <ChevronDown size={17} aria-hidden="true" />
        </label>
      </header>
      {error ? <div className="customer-insights-error" role="alert">
        <span>{error}</span>
        <button type="button" onClick={() => { setBusy(true); setRefresh(v => v + 1); }}>
          <RefreshCw size={14} aria-hidden="true" /> Retry
        </button>
      </div> : (
        <>
          <div className="customer-insights-kpis" aria-live="polite">
            {totals.map(item => <div key={item.name} className="customer-insights-kpi">
              <span className="customer-insights-kpi-icon"><item.Icon size={23} strokeWidth={1.7} aria-hidden="true" /></span>
              <div><strong>{busy || !data ? "—" : compact(item.value ?? 0)}</strong><span>{item.name}</span></div>
            </div>)}
          </div>
          <div className="customer-insights-mid">
            <div className="customer-insights-chart-wrap">
              {data ? <CustomerInterestChart data={data} days={days} /> :
                <p className="customer-insights-loading">Loading customer interest…</p>}
            </div>
            {!compact && <div className="customer-insights-categories">
              <h3>Most viewed categories</h3>
              {categoryRows.length ? categoryRows.map(row => <button key={row.id} type="button"
                className="customer-insights-category" onClick={() => onOpenCategory(row.id)}>
                <span className="customer-insights-category-head"><span>{categoryLookup.get(row.id) ?? row.name}</span>
                  <strong>{compact(row.views)} <small>({data?.totalViews ? Math.round(row.views / data.totalViews * 100) : 0}%)</small></strong>
                </span>
                <span className="customer-insights-category-track"><i style={{ width: row.views / categoryMax * 100 + "%" }} /></span>
              </button>) : <p className="customer-insights-no-category">{busy || !data ? "Loading category interest…" : "No category views yet. Results appear after customers open published products."}</p>}
            </div>}
          </div>
          <footer className="customer-insights-footer">
            <div className="customer-insights-footer-top">
              <span className="customer-insights-feature-photo">
                {topProduct?.images[0]?.url ? <SafeImage src={topProduct.images[0].url} alt={topProduct.name} loading="lazy" /> : <Layers3 size={22} aria-hidden="true" />}
              </span>
              <div>
                <small>Top product</small>
                <strong>{topProduct ? topProduct.name : "No product views yet"}</strong>
                <span>{data?.topProductViews ? `${compact(data.topProductViews)} views · ${compact(data.topProductClicks)} clicks` : "Based on actual catalog visits"}</span>
              </div>
            </div>
            <div className="customer-insights-footer-metric">
              <span className="customer-insights-footer-icon"><Zap size={20} aria-hidden="true" /></span>
              <div><small>Click-to-view ratio</small><strong>{busy ? "—" : clickRate}</strong><span>Product card clicks ÷ detail views</span></div>
            </div>
            <div className="customer-insights-footer-metric">
              <span className="customer-insights-footer-icon"><UsersRound size={20} aria-hidden="true" /></span>
              <div><small>Views per session</small><strong>{busy ? "—" : viewsPerSession}</strong><span>Sessions are not unique people</span></div>
            </div>
          </footer>
          <p className="customer-insights-privacy">
            {productsLoading ? "Checking published products…" :
              products.some(product => product.status === "published")
                ? "Live, session-based analytics. Admin previews and unpublished products are excluded; historic traffic is unavailable."
                : "Customer product views start when products are published. All current products are drafts; historic traffic is unavailable."}
          </p>
        </>
      )}
    </section>
  );
}
