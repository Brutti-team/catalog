import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight, ChartNoAxesCombined, ChevronDown, Eye, Layers3, MousePointerClick,
  RefreshCw, UsersRound, Zap
} from "lucide-react";
import SafeImage from "./SafeImage";
import Modal from "./Modal";
import { loadCustomerInsights, loadCustomerSessionDetails, type CustomerInsightData, type CustomerSessionDetails, type InsightPeriod } from "../lib/customer-analytics";
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
const sessionTimestamp = (iso: string) => new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(iso)) + " MYT";

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
  const yTop = 18, yBase = 131, xStart = 52, xEnd = 736;
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
      <svg viewBox="0 0 766 165" role="img"
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
            <text className="customer-insights-x-label" x={x} y="156" textAnchor="middle">{bin.label}</text>
          </g>;
        })}
      </svg>
      {data.totalViews === 0 && <p className="customer-insights-chart-empty">No product views recorded for this period.</p>}
    </div>
  );
}

export default function CustomerInsights({ products, categories, loading: productsLoading, enabled, onOpenCategory, compact: compactLayout = false }: Props) {
  const [days, setDays] = useState<InsightPeriod>(30);
  const [data, setData] = useState<CustomerInsightData | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [sessionDetailsOpen, setSessionDetailsOpen] = useState(false);
  const [sessionDetails, setSessionDetails] = useState<CustomerSessionDetails | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const sessionRequest = useRef(0);
  function openSessionDetails() {
    if (busy || !data?.visitorSessions) return;
    const request = ++sessionRequest.current;
    setSessionDetailsOpen(true);
    setSessionBusy(true);
    setSessionError(null);
    setSessionDetails(null);
    void loadCustomerSessionDetails(days).then(result => {
      if (request !== sessionRequest.current) return;
      setSessionDetails(result);
      setSessionBusy(false);
    }).catch((reason: unknown) => {
      if (request !== sessionRequest.current) return;
      setSessionError(reason instanceof Error ? reason.message : "Unable to load session details.");
      setSessionBusy(false);
    });
  }
  function closeSessionDetails() {
    ++sessionRequest.current;
    setSessionDetailsOpen(false);
  }
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
    <section className={`customer-insights-panel${compactLayout ? " is-compact" : ""}`} aria-labelledby="customer-insights-title">
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
            {totals.map(item => {
              const details = <>
                <span className="customer-insights-kpi-icon"><item.Icon size={23} strokeWidth={1.7} aria-hidden="true" /></span>
                <div><strong>{busy || !data ? "—" : compact(item.value ?? 0)}</strong><span>{compactLayout ? ({ "Total product views": "Views", "Visitor sessions": "Sessions", "Product clicks": "Clicks", "Products viewed": "Products" }[item.name] ?? item.name) : item.name}</span></div>
              </>;
              return item.name === "Visitor sessions"
                ? <button key={item.name} type="button"
                    className="customer-insights-kpi customer-insights-kpi--sessions"
                    disabled={busy || !data?.visitorSessions}
                    aria-label={`View details for ${compact(item.value ?? 0)} anonymous visitor sessions`}
                    title={data?.visitorSessions ? "View session details" : "No sessions recorded"}
                    onClick={openSessionDetails}>
                    {details}
                    <ArrowUpRight className="customer-insights-kpi-link" size={15} aria-hidden="true" />
                  </button>
                : <div key={item.name} className="customer-insights-kpi">{details}</div>;
            })}
          </div>
          <div className="customer-insights-mid">
            <div className="customer-insights-chart-wrap">
              {data ? <CustomerInterestChart data={data} days={days} /> :
                <p className="customer-insights-loading">Loading customer interest…</p>}
            </div>
            {!compactLayout && <div className="customer-insights-categories">
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
      {sessionDetailsOpen && <Modal
        title="Visitor sessions"
        eyebrow="PRODUCT VIEW ANALYTICS"
        description={`Anonymous catalog visits · Last ${days} days (Malaysia time)`}
        className="customer-session-dialog"
        onClose={closeSessionDetails}>
        {sessionBusy ? <div className="customer-session-loading" role="status">Loading session activity…</div> :
          sessionError ? <div className="customer-session-error" role="alert">
            <p>{sessionError}</p>
            <button type="button" onClick={openSessionDetails}><RefreshCw size={14} /> Retry</button>
          </div> :
          <div className="customer-session-content">
            <div className="customer-session-summary">
              <strong>{compact(sessionDetails?.totalSessions ?? 0)} recorded {sessionDetails?.totalSessions === 1 ? "session" : "sessions"}</strong>
              <span>Sessions count browser visits, not unique people.</span>
            </div>
            {sessionDetails?.sessions.length ? <div className="customer-session-list">
              {sessionDetails.sessions.map(session => <article className="customer-session-item" key={session.number}>
                <div className="customer-session-item-heading">
                  <span className="customer-session-label"><UsersRound size={15} aria-hidden="true" /> Session {session.number}</span>
                  <time dateTime={session.firstSeen}>{sessionTimestamp(session.firstSeen)}</time>
                </div>
                <div className="customer-session-events">
                  <span>Catalog opened <strong>{session.catalogOpens}</strong></span>
                  <span>Product views <strong>{session.productViews}</strong></span>
                  <span>Product clicks <strong>{session.productClicks}</strong></span>
                </div>
                {session.lastSeen !== session.firstSeen && <p className="customer-session-last">Last activity: {sessionTimestamp(session.lastSeen)}</p>}
              </article>)}
            </div> : <p className="customer-session-empty">No sessions found for this period.</p>}
            {(sessionDetails?.totalSessions ?? 0) > (sessionDetails?.sessions.length ?? 0) &&
              <p className="customer-session-limit">Showing the latest {sessionDetails?.sessions.length} sessions.</p>}
            <p className="customer-session-privacy">Sessions are anonymous and are not unique people. Names, emails, IPs and device fingerprints are not collected by these analytics; raw session IDs are not shown. Admin previews are excluded.</p>
          </div>}
      </Modal>}
    </section>
  );
}
