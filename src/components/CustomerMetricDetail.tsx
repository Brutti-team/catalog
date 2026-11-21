import { useMemo } from "react";
import { Eye, Layers3, MousePointerClick } from "lucide-react";
import SafeImage from "./SafeImage";
import type { Product } from "../lib/types";
import type { CustomerInsightData, CustomerSessionDetails, CustomerSessionProductAction } from "../lib/customer-analytics";

export type CustomerMetricKey = "views" | "sessions" | "clicks" | "products";

type MetricProps = {
  mode: Exclude<CustomerMetricKey, "sessions">;
  summary: CustomerInsightData;
  details: CustomerSessionDetails | null;
  products: Product[];
};

const fmt = new Intl.NumberFormat("en-MY");
const atMYT = (iso: string) => new Intl.DateTimeFormat("en-MY", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur",
}).format(new Date(iso)) + " MYT";

export default function CustomerMetricDetail({ mode, summary, details, products }: MetricProps) {
  const productLookup = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);
  const recorded = useMemo(() => (details?.sessions ?? []).flatMap(session =>
    session.productActions.map(action => ({ ...action, sessionNumber: session.number }))
  ).sort((a, b) => b.at.localeCompare(a.at)), [details]);
  const rows = recorded.filter(action => action.kind === (mode === "clicks" ? "product_click" : "product_view"));

  const productsWithViews = useMemo(() => {
    const grouped = new Map<string, { sample: CustomerSessionProductAction; views: number; clicks: number }>();
    for (const action of recorded) {
      if (!action.productId && !action.productName && !action.productSku) continue;
      const key = action.productId ?? (action.productSku || action.productName || "");
      const found = grouped.get(key);
      if (found) {
        if (action.kind === "product_view") found.views += 1;
        else found.clicks += 1;
      } else {
        grouped.set(key, { sample: action, views: action.kind === "product_view" ? 1 : 0, clicks: action.kind === "product_click" ? 1 : 0 });
      }
    }
    return [...grouped.values()].filter(group => group.views > 0).sort((a, b) => b.views - a.views);
  }, [recorded]);

  const total = mode === "views" ? summary.totalViews : mode === "clicks" ? summary.productClicks : summary.productsViewed;
  const title = mode === "views" ? "Product detail views" : mode === "clicks" ? "Product card clicks" : "Products viewed";
  const explanation = mode === "views"
    ? "Times visitors opened a product detail. Multiple views of a product may count separately."
    : mode === "clicks"
      ? "Times a visitor selected a product card from the public catalog."
      : "Distinct products with recorded detail views in this period, not the total number of products in your catalog.";

  return (
    <div className="customer-metric-detail">
      <section className="customer-metric-detail-summary" aria-label={title}>
        <span className="customer-metric-detail-summary-icon" aria-hidden="true">
          {mode === "views" ? <Eye size={20} /> : mode === "clicks" ? <MousePointerClick size={20} /> : <Layers3 size={20} />}
        </span>
        <div className="customer-metric-detail-summary-copy">
          <small>{title}</small>
          <strong>{fmt.format(total)}</strong>
          <p>{explanation}</p>
        </div>
      </section>

      {total === 0 ? (
        <div className="customer-metric-detail-empty">
          <strong>No activity yet</strong>
          <p>{mode === "clicks" ? "No product card clicks were recorded in the selected period."
            : mode === "views" ? "No product detail views were recorded in the selected period."
            : "No products have recorded detail views in the selected period."}</p>
        </div>
      ) : mode === "products" ? (
        <section className="customer-metric-detail-section">
          <div className="customer-metric-detail-section-head">
            <strong>Products with recorded views</strong>
            <small>Latest available activity</small>
          </div>
          {productsWithViews.length ? (
            <div className="customer-metric-detail-list">
              {productsWithViews.map((row, index) => {
                const product = row.sample.productId ? productLookup.get(row.sample.productId) : null;
                return (
                  <div className="customer-metric-detail-row" key={row.sample.productId ?? row.sample.productSku ?? row.sample.productName ?? index}>
                    <span className="customer-metric-detail-image">
                      {product?.images[0]?.url ? <SafeImage src={product.images[0].url} alt="" loading="lazy" /> : <Layers3 size={20} />}
                    </span>
                    <div className="customer-metric-detail-product">
                      <strong>{row.sample.productName || product?.name || "Product no longer available"}</strong>
                      <small>{row.sample.productSku || product?.sku || "Product ID unavailable"}</small>
                    </div>
                    <div className="customer-metric-detail-stat">
                      <strong>{fmt.format(row.views)}</strong>
                      <small>visible views</small>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="customer-metric-detail-none">Detailed product records are not available in the latest session activity.</p>}
        </section>
      ) : (
        <section className="customer-metric-detail-section">
          <div className="customer-metric-detail-section-head">
            <strong>{mode === "views" ? "Recent detail views" : "Recent product clicks"}</strong>
            <small>Latest available activity</small>
          </div>
          {rows.length ? <div className="customer-metric-detail-list">
            {rows.map((action, index) => {
              const product = action.productId ? productLookup.get(action.productId) : null;
              return <div className="customer-metric-detail-row" key={`${action.at}-${action.sessionNumber}-${index}`}>
                <span className="customer-metric-detail-image">
                  {product?.images[0]?.url ? <SafeImage src={product.images[0].url} alt="" loading="lazy" /> : <Layers3 size={20} />}
                </span>
                <div className="customer-metric-detail-product">
                  <strong>{action.productName || product?.name || "Product no longer available"}</strong>
                  <small>{action.productSku || product?.sku || "Product ID unavailable"}</small>
                </div>
                <div className="customer-metric-detail-when">
                  <small>Session {action.sessionNumber}</small>
                  <time dateTime={action.at}>{atMYT(action.at)}</time>
                </div>
              </div>;
            })}
          </div> : <p className="customer-metric-detail-none">Detailed events are not available in the latest session activity.</p>}
        </section>
      )}
      <p className="customer-metric-detail-footnote">
        Totals reflect the selected reporting period. Detailed rows show the latest available anonymous session records and may not include every event. Admin previews and unpublished products are excluded.
      </p>
    </div>
  );
}
