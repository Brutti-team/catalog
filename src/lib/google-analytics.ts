// Public catalog GA4, separate from existing Supabase Customer Insights.
export const GA_ID = "G-V8LXKRYFF3";
const HOST = "catalog.brutti.my";
const KEY = "brutti-ga4-consent-v1";
export type AnalyticsChoice = "granted" | "denied" | null;
type TagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  "ga-disable-G-V8LXKRYFF3"?: boolean;
};
let choice: AnalyticsChoice = null;
let initialized = false;
let lastPage = "";
export function publicAnalyticsPage(): boolean {
  return typeof window !== "undefined" && window.location.hostname === HOST &&
    (window.location.pathname === "/" || /^\/product\/[a-f0-9-]+\/?$/i.test(window.location.pathname)) &&
    !/[?&](?:auth|code|token|access_token|refresh_token|token_hash)=/i.test(window.location.search) &&
    !/(?:access_token|refresh_token|token_hash)=/i.test(window.location.hash);
}
export function readAnalyticsChoice(): AnalyticsChoice {
  if (!publicAnalyticsPage()) return null;
  try {
    const value = localStorage.getItem(KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch { return choice; }
}
function tagWindow(): TagWindow { return window as TagWindow; }
export function setAnalyticsChoice(value: Exclude<AnalyticsChoice, null>): void {
  if (!publicAnalyticsPage()) return;
  choice = value;
  try { localStorage.setItem(KEY, value); } catch { /* storage unavailable */ }
  const w = tagWindow();
  w["ga-disable-G-V8LXKRYFF3"] = value !== "granted";
  if (value === "denied") {
    lastPage = "";
    w.gtag?.("consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    return;
  }
  if (!initialized) {
    const layer = w.dataLayer ?? (w.dataLayer = []);
    w.gtag = function () { layer.push(arguments); };
    w.gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    w.gtag("consent", "update", { analytics_storage: "granted" });
    w.gtag("js", new Date());
    w.gtag("config", GA_ID, {
      send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
      cookie_domain: HOST, cookie_flags: "SameSite=Lax;Secure",
      page_location: "https://" + HOST + window.location.pathname,
      page_referrer: safeReferrer(),
    });
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(script);
    initialized = true;
  } else {
    w.gtag?.("consent", "update", { analytics_storage: "granted" });
  }
}
function safeReferrer(): string {
  try {
    const url = new URL(document.referrer);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin + "/" : "";
  } catch { return ""; }
}
function send(name: string, params: Record<string, string | number> = {}): void {
  if (!publicAnalyticsPage() || choice !== "granted" || !initialized) return;
  tagWindow().gtag?.("event", name, {
    ...params, send_to: GA_ID, page_location: "https://" + HOST + window.location.pathname,
    page_referrer: safeReferrer(),
  });
}
export function trackAnalyticsPage(productId: string | null, productName: string): void {
  if (!publicAnalyticsPage() || choice !== "granted" || !initialized) return;
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  if (lastPage === path) return;
  lastPage = path;
  send("page_view", { page_title: productName ? productName + " | Benua Brutti" : "Brutti Catalog" });
  if (productId) send("view_item", { item_id: productId, item_name: productName });
}
export function trackWhatsAppEnquiry(productId?: string): void {
  send("whatsapp_enquiry", productId ? { item_id: productId } : {});
}
export function trackCatalogueDownload(): void { send("catalogue_pdf_download"); }
