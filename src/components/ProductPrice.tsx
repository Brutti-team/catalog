import type { Product } from "../lib/types";
import { formatProductPrice } from "../lib/price";
import { discountPercent, hasProductDiscount } from "../lib/discount-price";

type Props = {
  product: Pick<Product, "price" | "originalPrice" | "priceBasis">;
  surface?: "admin" | "editor" | "public";
  /** Present starting-from prices on two deliberately styled lines in cards. */
  stackedBasis?: boolean;
};

export default function ProductPrice({ product, surface = "public", stackedBasis = false }: Props) {
  // Public catalogue prices are displayed as starting prices consistently.
  // Keep stored amounts and the administrative price basis unchanged.
  const displayProduct = surface === "public" ? { ...product, priceBasis: "starting-from" as const } : product;
  const price = formatProductPrice(displayProduct, surface);
  const separateBasis = stackedBasis && product.price !== null && displayProduct.priceBasis === "starting-from";
  const currentPrice = (
    <span className={separateBasis ? "catalog-price-current catalog-price-current--stacked" : "catalog-price-current"}>
      {separateBasis ? (
        <>
          <small className="catalog-price-basis">Starting from</small>
          <span className="catalog-price-amount">{formatProductPrice({ price: product.price, priceBasis: "fixed" }, surface)}</span>
        </>
      ) : price}
    </span>
  );
  if (!hasProductDiscount(product)) {
    return currentPrice;
  }

  const original = new Intl.NumberFormat("en-MY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(product.originalPrice as number);

  return (
    <span className="catalog-price-line">
      {currentPrice}
      <del className="catalog-price-old" aria-label={`Original price RM ${original}`}>
        RM {original}
      </del>
      <span className="catalog-price-discount">{discountPercent(product)}% off</span>
    </span>
  );
}
