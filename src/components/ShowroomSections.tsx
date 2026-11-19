import { ArrowRight, DraftingCompass, Hammer, Layers3 } from "lucide-react";
import type { Category, Product } from "../lib/types";
import { publicAssetUrl } from "../lib/assets";
import { photoCropStyle } from "../lib/photo-crop";
import { recordCatalogEvent } from "../lib/customer-analytics";

const referenceImage = (name: string) =>
  import.meta.env.BASE_URL + "reference/" + name + ".jpg";

type ShowroomSectionsProps = {
  onExplore: (keyword: string) => void;
  categories?: Category[];
  publishedProducts?: Product[];
  loading?: boolean;
  section?: "categories" | "approach";
};

/** Featured-only editorial showroom; category browsing lives exclusively below. */
export default function ShowroomSections({
  onExplore,
  categories = [],
  publishedProducts = [],
  loading = false,
  section = "categories",
}: ShowroomSectionsProps) {
  const featured = publishedProducts
    .filter(product => product.featured && Boolean(product.images?.[0]?.url))
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 4);
  const categoryName = (id: string) =>
    categories.find(category => category.id === id)?.name || "Bespoke furniture";

  if (section === "categories") return (
    <section id="pub-showroom" className="pub-curated-showroom" aria-label="Curated showroom">
      <div className="pub-curated-intro">
        <div>
          <p className="pub-reference-eyebrow">SELECTED WORK / BENUA BRUTTI</p>
          <h2>Curated <em>showroom.</em></h2>
        </div>
        <div className="pub-curated-intro-side">
          <p>A closer look at our featured furniture, cabinetry and crafted spaces.</p>
          <button type="button" onClick={() => onExplore("")}>
            Browse by category <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="pub-curated-loading" role="status">Preparing the showroom…</div>
      ) : featured.length ? (
        <div className="pub-curated-grid" data-count={featured.length}>
          {featured.map((product, index) => (
            <a
              key={product.id}
              className="pub-curated-piece"
              href={`#/product/${encodeURIComponent(product.id)}`}
              onClick={() => recordCatalogEvent("product_click", product.id)}
              aria-label={`View ${product.name}`}
            >
              <img
                src={publicAssetUrl(product.images[0].url)}
                alt={product.images[0].alt || product.name}
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
                style={photoCropStyle(product.images[0])}
                onError={event => {
                  event.currentTarget.style.opacity = "0";
                }}
              />
              <span className="pub-curated-piece-shade" aria-hidden="true" />
              <span className="pub-curated-piece-top">
                <span>{String(index + 1).padStart(2, "0")} / FEATURED</span>
                <span>{categoryName(product.categoryId)}</span>
              </span>
              <span className="pub-curated-piece-caption">
                <span>
                  <strong>{product.name}</strong>
                  <small>{categoryName(product.categoryId)}</small>
                </span>
                <ArrowRight size={22} aria-hidden="true" />
              </span>
            </a>
          ))}
        </div>
      ) : (
        <div className="pub-curated-editorial">
          <img
            src="https://brutti.my/assets/what-we-build/built%20in%20cabinet.webp"
            alt="Benua Brutti bespoke cabinetry"
            loading="lazy"
            onError={event => {
              event.currentTarget.src = referenceImage("cabinetry");
              event.currentTarget.onerror = null;
            }}
          />
          <div className="pub-curated-editorial-copy">
            <p className="pub-reference-eyebrow">CRAFTED IN SABAH</p>
            <h3>Made for the spaces that matter.</h3>
            <p>Our featured projects will appear here as they are published. Explore the collection by category below.</p>
            <button type="button" onClick={() => onExplore("")}>
              Browse categories <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
  return (
    <>
      <section className="pub-reference-process" id="pub-process">
        <div className="pub-reference-process-top">
          <div><p className="pub-reference-eyebrow">OUR APPROACH</p><h2>From brief<br /><em>to installation.</em></h2></div>
          <p>From measurements and material selection to fabrication and finishing, we work around the needs of each project.</p>
        </div>
        <div className="pub-reference-process-grid">
          <article><DraftingCompass size={27} strokeWidth={1.4} /><span>01 / DESIGN</span><h3>Tailored by nature</h3><p>Solutions built around your brief, business and daily operation.</p></article>
          <article><Layers3 size={27} strokeWidth={1.4} /><span>02 / MATERIALS</span><h3>Material character</h3><p>Timber, stone, metal and finishes considered as one composition.</p></article>
          <article><Hammer size={27} strokeWidth={1.4} /><span>03 / CRAFT</span><h3>Made with intention</h3><p>Thoughtful construction and practical details that last.</p></article>
        </div>
      </section>
      <section className="pub-reference-wide-feature">
        <img src={referenceImage("hero")} alt="Bespoke interior design inspiration" loading="lazy" />
        <div>
          <p className="pub-reference-eyebrow">YOUR SPACE. OUR CRAFT.</p>
          <h2>Made for the<br /><em>way you work.</em></h2>
          <button type="button" onClick={() => onExplore("")}>Explore the collection <ArrowRight size={18} /></button>
        </div>
      </section>
    </>
  );
}
