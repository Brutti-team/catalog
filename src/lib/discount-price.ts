import type { Product } from "./types";

type Pricing = Pick<Product, "price" | "originalPrice">;

export function hasProductDiscount(product: Pricing): boolean {
  return product.price != null &&
    product.originalPrice != null &&
    Number.isFinite(product.price) &&
    Number.isFinite(product.originalPrice) &&
    product.originalPrice > product.price &&
    product.originalPrice > 0;
}

/** Show the displayed integer percent off, not a stored/possibly stale field. */
export function discountPercent(product: Pricing): number {
  if (!hasProductDiscount(product)) return 0;
  const price = product.price as number;
  const original = product.originalPrice as number;
  return Math.max(1, Math.min(100, Math.round(((original - price) / original) * 100)));
}
