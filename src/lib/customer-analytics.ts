import { catalogClient } from "./catalog";

export type CatalogEventKind = "catalog_open" | "product_view" | "product_click";
export type InsightPeriod = 7 | 30 | 90;
export type InsightPoint = { date: string; views: number };
export type InsightCategory = { id: string; name: string; views: number };
export interface CustomerInsightData {
  totalViews: number;
  visitorSessions: number;
  productClicks: number;
  productsViewed: number;
  trend: InsightPoint[];
  categories: InsightCategory[];
  topProductId: string | null;
  topProductViews: number;
  topProductClicks: number;
}

const blank: CustomerInsightData = {
  totalViews: 0, visitorSessions: 0, productClicks: 0, productsViewed: 0,
  trend: [], categories: [], topProductId: null, topProductViews: 0, topProductClicks: 0,
};

export async function loadCustomerInsights(days: InsightPeriod): Promise<CustomerInsightData> {
  const { data, error } = await catalogClient().rpc("catalog_customer_insights", { p_days: days });
  if (error) throw new Error("Unable to load customer insights. " + error.message);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Customer analytics returned an invalid response.");
  const record = data as Record<string, unknown>;
  const count = (value: unknown): number => typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
  return {
    ...blank,
    totalViews: count(record.totalViews),
    visitorSessions: count(record.visitorSessions),
    productClicks: count(record.productClicks),
    productsViewed: count(record.productsViewed),
    topProductId: typeof record.topProductId === "string" ? record.topProductId : null,
    topProductViews: count(record.topProductViews),
    topProductClicks: count(record.topProductClicks),
    trend: Array.isArray(record.trend) ? record.trend.flatMap(item =>
      item && typeof item.date === "string" ? [{ date: item.date, views: count(item.views) }] : []) : [],
    categories: Array.isArray(record.categories) ? record.categories.flatMap(item =>
      item && typeof item.id === "string" && typeof item.name === "string"
        ? [{ id: item.id, name: item.name, views: count(item.views) }] : []) : [],
  };
}

export type CustomerSessionProductAction = {
  kind: "product_view" | "product_click";
  at: string;
  productId: string | null;
  productName: string | null;
  productSku: string | null;
};
export type CustomerSessionSummary = {
  number: number;
  firstSeen: string;
  lastSeen: string;
  catalogOpens: number;
  productViews: number;
  productClicks: number;
  productActions: CustomerSessionProductAction[];
};
export type CustomerSessionDetails = {
  totalSessions: number;
  sessions: CustomerSessionSummary[];
};

/** Administrator-only anonymous session summary. Session IDs and visitor identities
 * are deliberately not returned by the database RPC. */
export async function loadCustomerSessionDetails(days: InsightPeriod): Promise<CustomerSessionDetails> {
  const { data, error } = await catalogClient().rpc("catalog_customer_session_details", { p_days: days });
  if (error) throw new Error("Unable to load session details. " + error.message);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Customer sessions returned an invalid response.");
  }
  const raw = data as Record<string, unknown>;
  const count = (n: unknown): number => typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
  const sessions = Array.isArray(raw.sessions) ? raw.sessions.flatMap((row: unknown) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const item = row as Record<string, unknown>;
    if (typeof item.firstSeen !== "string" || typeof item.lastSeen !== "string") return [];
    if (!Number.isFinite(Date.parse(item.firstSeen)) || !Number.isFinite(Date.parse(item.lastSeen))) return [];
    return [{
      number: count(item.number),
      firstSeen: item.firstSeen,
      lastSeen: item.lastSeen,
      catalogOpens: count(item.catalogOpens),
      productViews: count(item.productViews),
      productClicks: count(item.productClicks),
      productActions: Array.isArray(item.productActions) ? item.productActions.flatMap((event: unknown) => {
        if (!event || typeof event !== "object" || Array.isArray(event)) return [];
        const action = event as Record<string, unknown>;
        if (action.kind !== "product_view" && action.kind !== "product_click") return [];
        if (typeof action.at !== "string" || !Number.isFinite(Date.parse(action.at))) return [];
        return [{
          kind: action.kind,
          at: action.at,
          productId: typeof action.productId === "string" ? action.productId : null,
          productName: typeof action.productName === "string" ? action.productName : null,
          productSku: typeof action.productSku === "string" ? action.productSku : null,
        }];
      }) : [],
    }];
  }) : [];
  return { totalSessions: count(raw.totalSessions), sessions };
}

let sessionToken: string | null = null;
const recentEvents = new Map<string, number>();

function activeSessionId(): string {
  if (sessionToken) return sessionToken;
  try {
    const key = "brutti-catalog-visitor-session-v1";
    const stored = window.sessionStorage.getItem(key);
    if (stored && /^[a-f\d]{8}-([a-f\d]{4}-){3}[a-f\d]{12}$/i.test(stored)) {
      sessionToken = stored;
      return stored;
    }
    sessionToken = crypto.randomUUID();
    window.sessionStorage.setItem(key, sessionToken);
  } catch {
    sessionToken = crypto.randomUUID();
  }
  return sessionToken;
}

/** Best-effort anonymous collection; no customer profile, email, IP, or user-agent fields.
 * Counts are per browser tab/session, NOT identifiable or guaranteed unique people. */
export function recordCatalogEvent(kind: CatalogEventKind, productId: string | null = null): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const key = kind + ":" + (productId ?? "catalog");
  // React StrictMode and fast repeated clicks do not inflate event counts.
  if (now - (recentEvents.get(key) ?? 0) < 16_000) return;
  recentEvents.set(key, now);
  try {
    void Promise.resolve(catalogClient().rpc("catalog_record_customer_event", {
      p_event_type: kind,
      p_product_id: productId,
      p_session_id: activeSessionId(),
    })).then(({ error }) => {
      if (error && import.meta.env.DEV) console.warn("Customer analytics event not stored:", error.message);
    }).catch((error: unknown) => {
      if (import.meta.env.DEV) console.warn("Customer analytics tracking unavailable:", error);
    });
  } catch (error) {
    if (import.meta.env.DEV) console.warn("Customer analytics tracking unavailable:", error);
  }
}
