import { useEffect, useId, useRef, useState, type SyntheticEvent } from "react";
import { ArrowRight, Eye, Heart, Sparkles, Star, X } from "lucide-react";
import type { Product } from "../lib/types";
import { publicPhotoCropStyle, isStudioEditedPhoto, catalogCardPhotoStyle, effectivePhotoCrop } from "../lib/photo-crop";
import { readPhotoColours, type PhotoColour } from "../lib/photo-colours";
import { publicAssetUrl } from "../lib/assets";
import { recordCatalogEvent } from "../lib/customer-analytics";
import ProductPrice from "./ProductPrice";
import MaterialsContent from "./MaterialsContent";
import { discountPercent, hasProductDiscount } from "../lib/discount-price";
import "./public-spotlight.css";
import { useFavouriteIds, toggleFavouriteId } from "../lib/customer-favourites";

interface Props {
  product: Product;
  categoryName: string;
  onView?: (id: string) => void;
  showColours?: boolean;
}

const availabilityLabels: Record<Product["availability"], string> = {
  available: "Ready Stock",
  "made-to-order": "Pre-order",
  unavailable: "Unavailable",
};

/** Only use explicitly recorded product colours, not inferred photo backgrounds. */
const colourSamples: Record<string, string> = {
  white: "#ffffff", black: "#252525", grey: "#909396", gray: "#909396",
  brown: "#795338", beige: "#d8c8b1", cream: "#f3ead5", ivory: "#f6f0e4",
  green: "#537d56", "sage green": "#9cae98", "forest green": "#244c36",
  blue: "#517fa3", "navy blue": "#293e59", navy: "#293e59",
  red: "#b74b45", pink: "#d995a7", yellow: "#e3bf51", orange: "#d88b4d",
  purple: "#8870a4", natural: "#c4a47d", "natural wood": "#c4a47d",
  oak: "#c7a478", walnut: "#76523a", teak: "#ad8250", "light wood": "#d8bb91",
  "dark wood": "#67482f", silver: "#c4c7ca", gold: "#c5a35b",
  putih: "#ffffff", hitam: "#252525", coklat: "#795338", kelabu: "#909396",
  hijau: "#537d56", biru: "#517fa3", merah: "#b74b45", kuning: "#e3bf51"
};
function recordedColours(product: Product) {
  const seen = new Set<string>();
  return (product.specifications ?? [])
    .filter(row => row.kind !== "section" && /^(?:product\s+)?(?:colou?rs?|warna)(?:\s+(?:options?|finishes?))?$/i.test(row.name.trim()))
    .flatMap(row => row.value.split(/[,;\n\/|&]+|\s+and\s+|\s+dan\s+/i))
    .map(value => value.trim())
    .filter(label => {
      const key = label.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(label => ({
      label,
      hex: /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(label)
        ? label : Object.prototype.hasOwnProperty.call(colourSamples, label.toLowerCase())
          ? colourSamples[label.toLowerCase()] : undefined,
    }));
}

/** Approximate colours of the furniture visible in the supplied reference
 * photos. These are not selectable finishes or a claim of stock availability.
 * Staff-entered colour specifications always take precedence. */
const referencePhotoColours: Record<string, { label: string; hex: string }[]> = {
  kaanagan: [
    { label: "Off-white", hex: "#e1e3dc" },
    { label: "Light sage grey", hex: "#c0ceca" },
    { label: "Natural wood", hex: "#ad8558" },
  ],
  palangko: [
    { label: "Off-white", hex: "#e5e4dc" },
    { label: "Natural wood", hex: "#c59c63" },
  ],
  tomodon: [
    { label: "Blue-grey", hex: "#77949d" },
    { label: "Natural light wood", hex: "#c6aa8e" },
  ],
};

/** A regular catalogue card with an optional quick-view modal, not a full-width hero. */
export default function PublicCollectionSpotlight({ product, categoryName, onView, showColours = false }: Props) {
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const quickViewTitleId = useId();
  const photo = product.images[0];
  const detailUrl = "#/product/" + encodeURIComponent(product.id);
  const description = product.description?.trim();
  const savedColours = showColours ? recordedColours(product) : [];
  const referenceKey = product.name.trim().toLowerCase();
  const photoColours = showColours && photo?.url && Object.prototype.hasOwnProperty.call(referencePhotoColours, referenceKey)
    ? referencePhotoColours[referenceKey] : [];
  const photoUrl = photo?.url ? publicAssetUrl(photo.url) : "";
  const autoPhotoUrl = showColours && !savedColours.length && !photoColours.length ? photoUrl : "";
  const [detected, setDetected] = useState<{ url: string; colours: PhotoColour[] } | null>(null);
  useEffect(() => {
    if (!autoPhotoUrl) return;
    let active = true;
    void readPhotoColours(autoPhotoUrl).then(colours => {
      if (active) setDetected({ url: autoPhotoUrl, colours });
    });
    return () => { active = false; };
  }, [autoPhotoUrl]);
  const automaticColours = autoPhotoUrl && detected?.url === autoPhotoUrl ? detected.colours : [];
  const colours = savedColours.length ? savedColours : photoColours.length ? photoColours : automaticColours;
  const shownInPhoto = savedColours.length === 0 && colours.length > 0;
  const automatic = shownInPhoto && !photoColours.length;
  const colourPending = Boolean(autoPhotoUrl && detected?.url !== autoPhotoUrl);
  const sale = hasProductDiscount(product);
  const saving = sale ? discountPercent(product) : 0;
  const favouriteIds = useFavouriteIds();
  const isFavourite = favouriteIds.includes(product.id);
  const toggleFavourite = () => toggleFavouriteId(product.id, product.name);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (quickViewOpen && !dialog.open) dialog.showModal();
    if (!quickViewOpen && dialog.open) dialog.close();
  }, [quickViewOpen]);

  // Recording a recommendation signal can rerank the shelf and unmount
  // this card. Defer that signal until the modal has actually closed.
  const pendingQuickViewId = useRef<string | null>(null);
  const openQuickView = () => {
    pendingQuickViewId.current = product.id;
    recordCatalogEvent("product_click", product.id);
    setQuickViewOpen(true);
  };
  const finishQuickView = () => {
    setQuickViewOpen(false);
    const viewedId = pendingQuickViewId.current;
    pendingQuickViewId.current = null;
    if (viewedId) onView?.(viewedId);
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
              className={photo?.crop ? "catalog-image-cropped" : isStudioEditedPhoto(photo) ? "catalog-image-studio-edited" : ""}
              key={photoUrl}
              style={catalogCardPhotoStyle(photo, product.sku)}
              loading="lazy"
              onLoad={event => {
                const image = event.currentTarget;
                image.classList.toggle("is-portrait-photo", image.naturalHeight > image.naturalWidth && image.naturalWidth > 0);
              }}
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
          ) : product.bestSelling ? (
            <span className="pub-catalog-tile__featured pub-catalog-tile__best"><Star size={12} fill="currentColor" /> Best Seller</span>
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
            <div className="pub-catalog-tile__summary">
              <a className="pub-catalog-tile__title" href={detailUrl} onClick={openDetails}>
                <h3>{product.name}</h3>
              </a>
              {colours.length > 0 && (
                <div className="pub-catalog-tile__colours" role="group" aria-label={shownInPhoto ? "Approximate photo colours, may include surroundings; not finish options" : "Recorded product colours"}>
                  {shownInPhoto && <span className="pub-catalog-tile__colour-label" title={automatic ? "Automatically sampled photo colours; may include surroundings" : "Approximate colours of pictured furniture"}>{automatic ? "Photo:" : "Shown:"}</span>}
                  {colours.slice(0, 4).map(colour => colour.hex ? (
                    <span key={colour.label} className="pub-catalog-tile__swatch" style={{ backgroundColor: colour.hex }} data-colour-name={colour.label} tabIndex={0} role="img" aria-label={shownInPhoto ? `Pictured colour: ${colour.label}` : colour.label} />
                  ) : (
                    <span key={colour.label} className="pub-catalog-tile__colour-label" title={colour.label}>{colour.label}</span>
                  ))}
                  {colours.length > 4 && <span className="pub-catalog-tile__colour-label" title={colours.slice(4).map(colour => colour.label).join(", ")}>+{colours.length - 4}</span>}
                </div>
              )}
              {showColours && !colours.length && !colourPending && <span className="pub-catalog-tile__colour-label">Colour not specified</span>}
              {sale && product.bestSelling && <span className="pub-catalog-tile__best-inline"><Star size={11} fill="currentColor" /> Best Seller</span>}
              {description && <p className="pub-catalog-tile__description" title={description}>{description}</p>}
            </div>
            <div className="pub-catalog-tile__pricing">
              <div className="pub-catalog-tile__price"><ProductPrice product={product} stackedBasis /></div>
              {sale && <span className="pub-catalog-tile__save">SAVE {saving}%</span>}
            </div>
          </div>
        </div>
      </article>

      <dialog
        ref={dialogRef}
        className="pub-quickview"
        aria-labelledby={quickViewTitleId}
        onClose={finishQuickView}
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
          <div className={"pub-quickview__image" + (effectivePhotoCrop(photo) ? " has-saved-framing" : "")}>
            <div className="pub-quickview__photo-frame">
            <img
              src={publicAssetUrl(photo?.url)}
              alt={photo?.alt || product.name}
              className={photo?.crop ? "catalog-image-cropped" : isStudioEditedPhoto(photo) ? "catalog-image-studio-edited" : ""}
              style={publicPhotoCropStyle(photo)}
              onError={handleImageError}
            />
            </div>
          </div>
          <div className="pub-quickview__content">
            <span className="pub-quickview__eyebrow">QUICK VIEW</span>
            <span className="pub-quickview__category">{categoryName}</span>
            <h2 id={quickViewTitleId}>{product.name}</h2>
            <span className="pub-quickview__availability">
              <span className={"pub-catalog-tile__dot pub-catalog-tile__dot--" + product.availability} />
              {availabilityLabels[product.availability]}
            </span>
            {description && <p className="pub-quickview__description">{description}</p>}
            {product.materials?.trim() && (
              <div className="pub-quickview__spec"><span className="pub-quickview__section-label">Materials</span><MaterialsContent value={product.materials} /></div>
            )}
            <div className="pub-quickview__price">
              <div className="pub-quickview__price-value"><ProductPrice product={product} stackedBasis /></div>
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
