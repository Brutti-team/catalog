import { useMemo, useState } from "react";
import { ArrowRight, Star } from "lucide-react";
import type { Category, Product } from "../lib/types";
import { catalogCardPhotoStyle } from "../lib/photo-crop";
import SafeImage from "./SafeImage";
import { recordCatalogEvent } from "../lib/customer-analytics";
import ProductPrice from "./ProductPrice";
import "./best-selling-section.css";

type Props = {
  products: Product[];
  categories: Category[];
  loading: boolean;
  onBrowse: () => void;
  onBrowseBestSellers: () => void;
};

/**
 * The Best Selling gallery is explicitly curated by Admin, independently of
 * Featured. It only displays Published products with an uploaded photograph.
 * These are editorial picks: no fabricated sales counts or discounts.
 */
export default function BestSellingSection({ products, categories, loading, onBrowse, onBrowseBestSellers }: Props) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const curated = useMemo(() => (
    products
      .filter(product =>
        product.status === "published" &&
        product.bestSelling === true &&
        product.images.some(image => Boolean(image.url?.trim()))
      )
      .sort((a, b) =>
        (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
        a.name.localeCompare(b.name)
      )
  ), [products]);
  const visibleCategories = useMemo(
    () => categories.filter(category => curated.some(product => product.categoryId === category.id)),
    [categories, curated],
  );
  const activeCategory = visibleCategories.some(category => category.id === selectedCategory) ? selectedCategory : "all";
  const matching = curated.filter(product => activeCategory === "all" || product.categoryId === activeCategory);
  const filtered = matching.slice(0, 8);
  const categoryName = (id: string) =>
    categories.find(category => category.id === id)?.name || "Furniture";

  return (
    <section className="brutti-best-selling" id="pub-best-selling" aria-label="Best-selling furniture">
      <div className="brutti-best-selling__head">
        <p className="brutti-best-selling__eyebrow"><Star size={14} aria-hidden="true"/> CURATED BY BRUTTI</p>
        <h2>Best-selling <em>furniture</em></h2>
        <p className="brutti-best-selling__lede">
          Discover our curated selection of furniture for your space.
        </p>
      </div>
      {loading ? (
        <p className="brutti-best-selling__notice" role="status">Preparing our product selection…</p>
      ) : curated.length > 0 ? (
        <>
          {visibleCategories.length > 1 && <div className="brutti-best-selling__filters" role="group" aria-label="Filter selected furniture by category">
            <button
              type="button"
              className={activeCategory === "all" ? "is-selected" : ""}
              aria-pressed={activeCategory === "all"}
              onClick={() => setSelectedCategory("all")}
            >
              All designs
            </button>
            {visibleCategories.map(category => (
              <button
                type="button"
                key={category.id}
                className={activeCategory === category.id ? "is-selected" : ""}
                aria-pressed={activeCategory === category.id}
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>}
          <div className={`brutti-best-selling__grid${filtered.length === 1 ? " is-single" : ""}`}>
            {filtered.map(product => {
              const photo = product.images.find(image => Boolean(image.url?.trim()));
              if (!photo) return null;
              return (
                <a
                  key={product.id}
                  href={`#/product/${encodeURIComponent(product.id)}`}
                  className="brutti-best-selling__item"
                  aria-label={`View ${product.name}`}
                  onClick={() => recordCatalogEvent("product_click", product.id)}
                >
                  <span className="brutti-best-selling__photo">
                    <SafeImage
                      src={photo.url}
                      alt={photo.alt || product.name}
                      loading="lazy"
                      decoding="async"
                      style={catalogCardPhotoStyle(photo, product.sku)}
                    />
                    <span className="brutti-best-selling__flag"><Star size={12} fill="currentColor" aria-hidden="true"/> Best Seller</span>
                  </span>
                  <span className="brutti-best-selling__product-copy">
                    <span className="brutti-best-selling__category">{categoryName(product.categoryId)}</span>
                    <strong>{product.name}</strong>
                    <span className="brutti-best-selling__price"><ProductPrice product={product} stackedBasis /></span>
                    <span className="brutti-best-selling__view">View details <ArrowRight size={16} aria-hidden="true"/></span>
                  </span>
                </a>
              );
            })}
          </div>
          <div className="brutti-best-selling__footer">
            <span>{matching.length} {matching.length === 1 ? "piece" : "pieces"} in this selection</span>
            <button type="button" onClick={onBrowseBestSellers}>View All Best Sellers <ArrowRight size={17} aria-hidden="true" /></button>
          </div>
        </>
      ) : (
        <div className="brutti-best-selling__empty" role="status">
          <span className="brutti-best-selling__empty-heading">Our selected collection is coming together.</span>
          <p>Explore our collection while we prepare our next selection.</p>
          <button type="button" onClick={onBrowse}>Browse the collection <ArrowRight size={17} aria-hidden="true" /></button>
        </div>
      )}
    </section>
  );
}
