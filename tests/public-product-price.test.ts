import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProductPrice from "../src/components/ProductPrice";

describe("consistent public starting prices", () => {
  it.each(["fixed", "starting-from", undefined] as const)("stacks a starting price for %s", priceBasis => {
    const html = renderToStaticMarkup(createElement(ProductPrice, { product: { price: 797, priceBasis }, stackedBasis: true }));
    expect(html).toContain('class="catalog-price-basis">Starting from');
    expect(html).toContain("RM 797");
  });
  it("uses the same label for detail and discounted prices", () => {
    const html = renderToStaticMarkup(createElement(ProductPrice, { product: { price: 1427, originalPrice: 2000, priceBasis: "fixed" } }));
    expect(html).toContain("Starting from RM 1,427");
    expect(html).toContain("29% off");
  });
  it("leaves unpriced and admin fixed-price products unchanged", () => {
    const missing = renderToStaticMarkup(createElement(ProductPrice, { product: { price: null }, stackedBasis: true }));
    expect(missing).toContain("On enquiry");
    expect(missing).not.toContain("Starting from");
    const admin = renderToStaticMarkup(createElement(ProductPrice, { product: { price: 797, priceBasis: "fixed" }, surface: "admin" }));
    expect(admin).not.toContain("Starting from");
  });
});
