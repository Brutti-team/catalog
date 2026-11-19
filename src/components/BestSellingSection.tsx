import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Category, Product } from "../lib/types";
import { publicAssetUrl } from "../lib/assets";
import { photoCropStyle } from "../lib/photo-crop";
import { recordCatalogEvent } from "../lib/customer-analytics";
import ProductPrice from "./ProductPrice";
import "./best-selling-section.css";

type Props = {
  products: Product[];
  categories: Category[];
  loading: boolean;
  onBrowse: () => void;
};

/**
 * The Best Selling gallery is explicitly curated by Admin, independently of
 * Featured. It only displays Published products with an uploaded photograph.
 * These are editorial picks: no fabricated sales counts or discounts.
 */
export default function BestSellingSection({ products, categories, loading, onBrowse }: Props) {
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
  const filtered = curated
    .filter(product => selectedCategory === "all" || product.categoryId === selectedCategory)
    .slice(0, 8);
  const categoryName = (id: string) =>
    categories.find(category => category.id === id)?.name || "Furniture";

  return (
    <section className="brutti-best-selling" id="pub-best-selling" aria-label="Best-selling furniture">
      <div className="brutti-best-selling__head">
        <p className="brutti-best-selling__eyebrow">BENUA BRUTTI / CURATED PICKS</p>
        <h2>Our Best-Selling <em>Furniture</em></h2>
        <p className="brutti-best-selling__lede">
          Discover statement pieces and practical designs, thoughtfully selected
          for spaces that feel like your own.
        </p>
      </div>
      {loading ? (
        <p className="brutti-best-selling__notice" role="status">Preparing our product selection…</p>
      ) : curated.length > 0 ? (
        <>
          <div className="brutti-best-selling__filters" role="group" aria-label="Filter selected furniture by category">
            <button
              type="button"
              className={selectedCategory === "all" ? "is-selected" : ""}
              aria-pressed={selectedCategory === "all"}
              onClick={() => setSelectedCategory("all")}
            >
              All designs
            </button>
            {visibleCategories.map(category => (
              <button
                type="button"
                key={category.id}
                className={selectedCategory === category.id ? "is-selected" : ""}
                aria-pressed={selectedCategory === category.id}
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
          <div className="brutti-best-selling__grid">
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
                    <img
                      src={publicAssetUrl(photo.url)}
                      alt={photo.alt || product.name}
                      loading="lazy"
                      decoding="async"
                      style={photoCropStyle(photo)}
                    />
                    <span className="brutti-best-selling__flag">BEST SELLING</span>
                  </span>
                  <span className="brutti-best-selling__product-copy">
                    <span className="brutti-best-selling__category">{categoryName(product.categoryId)}</span>
                    <strong>{product.name}</strong>
                    <span className="brutti-best-selling__price"><ProductPrice product={product} /></span>
                  </span>
                </a>
              );
            })}
          </div>
          <div className="brutti-best-selling__footer">
            <span>{filtered.length} selected {filtered.length === 1 ? "piece" : "pieces"}</span>
            <button type="button" onClick={onBrowse}>Explore all products <ArrowRight size={17} aria-hidden="true" /></button>
          </div>
        </>
      ) : (
        <div className="brutti-best-selling__empty" role="status">
          <span className="brutti-best-selling__empty-heading">Our selected collection is coming together.</span>
          <p>Products marked Best Selling and Published in Admin will appear here with their real photos, names and prices.</p>
          <button type="button" onClick={onBrowse}>Browse the collection <ArrowRight size={17} aria-hidden="true" /></button>
        </div>
      )}
    </section>
  );
}
