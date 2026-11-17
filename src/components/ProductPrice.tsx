import type { Product } from "../lib/types";
import { formatProductPrice } from "../lib/price";
import { discountPercent, hasProductDiscount } from "../lib/discount-price";

type Props = {
  product: Pick<Product, "price" | "originalPrice" | "priceBasis">;
  surface?: "admin" | "editor" | "public";
};

export default function ProductPrice({ product, surface = "public" }: Props) {
  const price = formatProductPrice(product, surface);
  if (!hasProductDiscount(product)) {
    return <span className="catalog-price-current">{price}</span>;
  }

  const original = new Intl.NumberFormat("en-MY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(product.originalPrice as number);

  return (
    <span className="catalog-price-line">
      <span className="catalog-price-current">{price}</span>
      <del className="catalog-price-old" aria-label={`Original price RM ${original}`}>
        RM {original}
      </del>
      <span className="catalog-price-discount">{discountPercent(product)}% off</span>
    </span>
  );
}
