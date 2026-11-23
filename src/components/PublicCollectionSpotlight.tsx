import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Eye, X } from "lucide-react";
import type { Product } from "../lib/types";
import { photoCropStyle } from "../lib/photo-crop";
import { publicAssetUrl } from "../lib/assets";
import { recordCatalogEvent } from "../lib/customer-analytics";
import ProductPrice from "./ProductPrice";
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

export default function PublicCollectionSpotlight({ product, categoryName }: Props) {
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const image = product.images[0];
  const detailUrl = "#/product/" + encodeURIComponent(product.id);
  const description = product.description?.trim();

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
  const trackDetails = () => {
    recordCatalogEvent("product_click", product.id);
    setQuickViewOpen(false);
  };
  const fallbackImage = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const target = event.currentTarget;
    const fallback = publicAssetUrl("/images/placeholder.svg");
    if (target.src !== fallback) target.src = fallback;
  };

  return (
    <>
      <article className="pub-spotlight" aria-label={product.name}>
        <button
          type="button"
          className="pub-spotlight__photo"
          onClick={openQuickView}
          aria-label={"Quick view of " + product.name}
        >
          <img
            src={publicAssetUrl(image?.url)}
            alt={image?.alt || product.name}
            className={image?.crop ? "catalog-image-cropped" : ""}
            style={photoCropStyle(image)}
            loading="lazy"
            onError={fallbackImage}
          />
          <span className="pub-spotlight__photo-caption"><Eye size={17} /> Quick view</span>
        </button>
        <div className="pub-spotlight__info">
          <div className="pub-spotlight__overline"><span>FEATURED FROM THE COLLECTION</span><span>01 / 01</span></div>
          <div className="pub-spotlight__main">
            <span className="pub-spotlight__category">{categoryName}</span>
            <h3>{product.name}</h3>
            <div className="pub-spotlight__availability">
              <span className={"pub-spotlight__status pub-spotlight__status--" + product.availability} />
              {availabilityLabels[product.availability]}
            </div>
            {description && <p className="pub-spotlight__description">{description}</p>}
            {product.materials?.trim() && <p className="pub-spotlight__materials"><span>Materials</span>{product.materials}</p>}
            <div className="pub-spotlight__price"><span>PRICE GUIDE</span><strong><ProductPrice product={product} /></strong></div>
            <div className="pub-spotlight__actions">
              <a href={detailUrl} className="pub-spotlight__details" onClick={trackDetails}>
                Explore product <ArrowUpRight size={18} />
              </a>
              <button type="button" className="pub-spotlight__quick" onClick={openQuickView}>
                Quick view <Eye size={17} />
              </button>
            </div>
          </div>
          <div className="pub-spotlight__footnote"><span>BENUA BRUTTI</span><span>CRAFTED WITH PURPOSE · SABAH</span></div>
        </div>
      </article>

      <dialog
        ref={dialogRef}
        className="pub-quickview"
        aria-labelledby="pub-quickview-title"
        onClose={() => setQuickViewOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="pub-quickview__panel">
          <button type="button" className="pub-quickview__close" aria-label="Close quick view" onClick={() => setQuickViewOpen(false)}>
            <X size={20} />
          </button>
          <div className="pub-quickview__image">
            <img
              src={publicAssetUrl(image?.url)}
              alt={image?.alt || product.name}
              className={image?.crop ? "catalog-image-cropped" : ""}
              style={photoCropStyle(image)}
              onError={fallbackImage}
            />
          </div>
          <div className="pub-quickview__content">
            <span className="pub-quickview__eyebrow">THE BRUTTI COLLECTION / QUICK VIEW</span>
            <span className="pub-quickview__category">{categoryName}</span>
            <h2 id="pub-quickview-title">{product.name}</h2>
            <div className="pub-quickview__availability"><span className={"pub-spotlight__status pub-spotlight__status--" + product.availability} />{availabilityLabels[product.availability]}</div>
            {description && <p className="pub-quickview__description">{description}</p>}
            {product.materials?.trim() && <div className="pub-quickview__spec"><span>MATERIALS</span><p>{product.materials}</p></div>}
            <div className="pub-quickview__price"><span>PRICE GUIDE</span><strong><ProductPrice product={product} /></strong></div>
            <a href={detailUrl} className="pub-quickview__cta" onClick={trackDetails}>
              View full product details <ArrowRight size={18} />
            </a>
            <span className="pub-quickview__note">Crafted for real spaces, thoughtfully made in Sabah.</span>
          </div>
        </div>
      </dialog>
    </>
  );
}
