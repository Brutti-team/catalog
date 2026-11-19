import { Check, Images, RotateCcw } from "lucide-react";
import type { Product } from "../lib/types";
import { publicAssetUrl } from "../lib/assets";
import "./category-cover-picker.css";

type Props = {
  products: Product[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
};

/** Intentionally makes only a chosen picture public, without publishing its product. */
export default function CategoryCoverPicker({ products, value, onChange, disabled = false }: Props) {
  const photos = products.flatMap(product =>
    product.images.filter(photo => Boolean(photo.url?.trim())).map(photo => ({ product, photo }))
  );
  return (
    <section className="category-cover-picker" aria-label="Category carousel cover photo">
      <div className="category-cover-picker-heading">
        <div><strong>Category cover photo</strong><p>Pick one product photo to appear in the public category carousel.</p></div>
        <span>{photos.length} photos</span>
      </div>
      <button type="button" className={`category-cover-auto${value ? "" : " is-selected"}`} disabled={disabled}
        aria-pressed={!value} onClick={() => onChange(null)}>
        <RotateCcw size={17} aria-hidden="true" />
        <span><strong>Automatic cover</strong><small>Featured published product or Brutti fallback</small></span>
        {!value && <Check size={16} aria-hidden="true" />}
      </button>
      {photos.length ? (
        <div className="category-cover-picker-grid">
          {photos.map(({ product, photo }, index) =>
            <button type="button" key={`${product.id}-${photo.id}-${index}`}
              className={`category-cover-option${value === photo.url ? " is-selected" : ""}`}
              disabled={disabled} aria-pressed={value === photo.url}
              aria-label={`Choose ${product.name} photo as category cover`}
              onClick={() => onChange(photo.url)}>
              <span className="category-cover-option-image">
                <img src={publicAssetUrl(photo.url)} alt="" loading="lazy" decoding="async" />
                {value === photo.url && <span className="category-cover-option-check"><Check size={16} /></span>}
              </span>
              <strong title={product.name}>{product.name}</strong>
              <small>{product.sku} · {product.status}</small>
            </button>
          )}
        </div>
      ) : (
        <p className="category-cover-picker-empty"><Images size={18} aria-hidden="true" /> No product photos in this category yet.</p>
      )}
      {Boolean(value) && !photos.some(({ photo }) => photo.url === value) && (
        <p className="category-cover-picker-warning">The saved photo is no longer available in this category. Choose another or select Automatic.</p>
      )}
      <p className="category-cover-picker-notice"><strong>Public preview:</strong> Choosing a Draft or Archived product's image makes that photo visible to customers in the category carousel. It does not publish the product or its details.</p>
    </section>
  );
}
