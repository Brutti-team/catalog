import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { ArrowRight, Eye, Heart, Sparkles, X } from "lucide-react";
import type { Product } from "../lib/types";
import { photoCropStyle } from "../lib/photo-crop";
import { publicAssetUrl } from "../lib/assets";
import { recordCatalogEvent } from "../lib/customer-analytics";
import ProductPrice from "./ProductPrice";
import { discountPercent, hasProductDiscount } from "../lib/discount-price";
import "./public-spotlight.css";

interface Props {
  product: Product;
  categoryName: string;
}

const availabilityLabels: Record<Product["availability"], string> = {
  available: "Available",
  "made-to-order": "Made to order",
  unavailable: "Currently unavailable",
};

/** A regular catalogue card with an optional quick-view modal, not a full-width hero. */
export default function PublicCollectionSpotlight({ product, categoryName }: Props) {
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const photo = product.images[0];
  const detailUrl = "#/product/" + encodeURIComponent(product.id);
  const description = product.description?.trim();
  const sale = hasProductDiscount(product);
  const saving = sale ? discountPercent(product) : 0;
  const [isFavourite, setIsFavourite] = useState(() => {
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem("brutti-catalog-favourites") || "[]");
      return Array.isArray(saved) && saved.includes(product.id);
    } catch {
      return false;
    }
  });

  const toggleFavourite = () => {
    const next = !isFavourite;
    setIsFavourite(next);
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem("brutti-catalog-favourites") || "[]");
      const ids = Array.isArray(saved) ? saved.filter((value): value is string => typeof value === "string") : [];
      const updated = next ? [...new Set([...ids, product.id])] : ids.filter(id => id !== product.id);
      window.localStorage.setItem("brutti-catalog-favourites", JSON.stringify(updated));
    } catch {
      // Local storage may be disabled; the visible toggle still works for this session.
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (quickViewOpen && !dialog.open) dialog.showModal();
    if (!quickViewOpen && dialog.open) dialog.close();
  }, [quickViewOpen]);

  const openQuickView = () => {
    recordCatalogEvent("product_click", product.id);
    setQuickViewOpen(true);
  };
  const openDetails = () => {
    recordCatalogEvent("product_click", product.id);
    setQuickViewOpen(false);
  };
  const handleImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    const node = event.currentTarget;
    if (!node.src.endsWith("/images/placeholder.svg")) {
      node.src = publicAssetUrl("/images/placeholder.svg");
    }
  };

  return (
    <>
      <article className="pub-catalog-tile" aria-label={product.name}>
        <div className="pub-catalog-tile__visual">
          <a
            href={detailUrl}
            className="pub-catalog-tile__preview"
            onClick={openDetails}
            aria-label={"View details for " + product.name}
          >
            <img
              src={publicAssetUrl(photo?.url)}
              alt={photo?.alt || product.name}
              className={photo?.crop ? "catalog-image-cropped" : ""}
              style={photoCropStyle(photo)}
              loading="lazy"
              onError={handleImageError}
            />
          </a>
          <button
            type="button"
            className={"pub-catalog-tile__favourite" + (isFavourite ? " is-saved" : "")}
            aria-label={(isFavourite ? "Remove " : "Save ") + product.name + (isFavourite ? " from" : " to") + " favourites"}
            aria-pressed={isFavourite}
            title={isFavourite ? "Remove from favourites" : "Save to favourites"}
            onClick={toggleFavourite}
          >
            <Heart size={20} fill={isFavourite ? "currentColor" : "none"} strokeWidth={1.7} />
          </button>
          {sale ? (
            <span className="pub-catalog-tile__sale">SALE</span>
          ) : product.featured ? (
            <span className="pub-catalog-tile__featured"><Sparkles size={12} /> Featured</span>
          ) : null}
          <button
            type="button"
            className="pub-catalog-tile__eye"
            onClick={openQuickView}
            aria-label={"Open quick view for " + product.name}
            title="Quick view"
          >
            <Eye size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="pub-catalog-tile__copy">
          <div className="pub-catalog-tile__meta">
            <span className="pub-catalog-tile__category">{categoryName}</span>
            <span className="pub-catalog-tile__availability">
              <span className={"pub-catalog-tile__dot pub-catalog-tile__dot--" + product.availability} aria-hidden="true" />
              {availabilityLabels[product.availability]}
            </span>
          </div>
          <div className="pub-catalog-tile__details-row">
            <div className="pub-catalog-tile__identity">
              <a className="pub-catalog-tile__title" href={detailUrl} onClick={openDetails}>
                <h3>{product.name}</h3>
              </a>
              {description && <p className="pub-catalog-tile__description" title={description}>{description}</p>}
            </div>
            <div className="pub-catalog-tile__pricing">
              <div className="pub-catalog-tile__price"><ProductPrice product={product} /></div>
              {sale && <span className="pub-catalog-tile__save">SAVE {saving}%</span>}
            </div>
          </div>
        </div>
      </article>

      <dialog
        ref={dialogRef}
        className="pub-quickview"
        aria-labelledby={"pub-quickview-title-" + product.id}
        onClose={() => setQuickViewOpen(false)}
        onClick={event => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="pub-quickview__panel">
          <button
            type="button"
            className="pub-quickview__close"
            onClick={() => setQuickViewOpen(false)}
            aria-label="Close quick view"
          >
            <X size={19} />
          </button>
          <div className="pub-quickview__image">
            <img
              src={publicAssetUrl(photo?.url)}
              alt={photo?.alt || product.name}
              className={photo?.crop ? "catalog-image-cropped" : ""}
              style={photoCropStyle(photo)}
              onError={handleImageError}
            />
          </div>
          <div className="pub-quickview__content">
            <span className="pub-quickview__eyebrow">THE BRUTTI COLLECTION / QUICK VIEW</span>
            <span className="pub-quickview__category">{categoryName}</span>
            <h2 id={"pub-quickview-title-" + product.id}>{product.name}</h2>
            <span className="pub-quickview__availability">
              <span className={"pub-catalog-tile__dot pub-catalog-tile__dot--" + product.availability} />
              {availabilityLabels[product.availability]}
            </span>
            {description && <p className="pub-quickview__description">{description}</p>}
            {product.materials?.trim() && (
              <div className="pub-quickview__spec"><span>MATERIALS</span><p>{product.materials}</p></div>
            )}
            <div className="pub-quickview__price">
              <span>PRICE GUIDE</span>
              <strong><ProductPrice product={product} /></strong>
            </div>
            <a href={detailUrl} className="pub-quickview__cta" onClick={openDetails}>
              View product details <ArrowRight size={17} />
            </a>
          </div>
        </div>
      </dialog>
    </>
  );
}
