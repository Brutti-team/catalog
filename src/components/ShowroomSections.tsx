import { ArrowRight, DraftingCompass, Hammer, Layers3 } from "lucide-react";
import type { Category, Product } from "../lib/types";
import { categoryCover } from "../lib/category-covers";
import { publicAssetUrl } from "../lib/assets";

const referenceImage = (name: string) =>
  import.meta.env.BASE_URL + "reference/" + name + ".jpg";

type ShowroomSectionsProps = {
  onExplore: (keyword: string) => void;
  onSelectCategory?: (categoryId: string) => void;
  categories?: Category[];
  publishedProducts?: Product[];
  section?: "categories" | "approach";
};

/** Use the same live category records and category-cover logic as Admin.
 * Only published product photos may appear on the public landing page.
 */
export default function ShowroomSections({
  onExplore,
  onSelectCategory,
  categories = [],
  publishedProducts = [],
  section = "categories",
}: ShowroomSectionsProps) {
  if (section === "categories") return (
    <>
      <section className="pub-reference-intro" id="pub-expertise">
        <div className="pub-reference-intro-head">
          <p className="pub-reference-eyebrow">WHAT WE CREATE / BENUA BRUTTI</p>
          <h2>Furniture, kiosks<br /><em>and joinery.</em></h2>
        </div>
        <p>Benua Brutti builds custom furniture, retail kiosks, cabinetry and commercial fit-outs in Sabah.</p>
      </section>

      {categories.length > 0 && (
        <section className="pub-reference-category-grid" aria-label="Explore Brutti catalog categories">
          {categories.map((category, index) => {
            const items = publishedProducts.filter(product => product.categoryId === category.id);
            const cover = categoryCover(category.name, items);
            return (
              <button
                type="button"
                key={category.id}
                className="pub-reference-category-tile"
                onClick={() => onSelectCategory?.(category.id)}
                aria-label={`Browse ${category.name} category`}
              >
                <img
                  src={publicAssetUrl(cover.src)}
                  loading="lazy"
                  decoding="async"
                  alt={items.length ? `${category.name} product photograph` : "Category cover coming soon"}
                  style={{ objectPosition: cover.position }}
                  onError={event => {
                    const fallback = publicAssetUrl("/images/placeholder.svg");
                    if (!event.currentTarget.src.endsWith("/images/placeholder.svg"))
                      event.currentTarget.src = fallback;
                  }}
                />
                <span className="pub-reference-category-shade" />
                <span className="pub-reference-category-index">
                  {String(index + 1).padStart(2, "0")} / CATEGORY
                </span>
                <span className="pub-reference-category-caption">
                  <span>
                    <strong>{category.name}</strong>
                    <small>{category.description?.trim() || "Explore furniture and projects in this collection."}</small>
                  </span>
                  <ArrowRight size={23} />
                </span>
              </button>
            );
          })}
        </section>
      )}
      <p className="pub-reference-image-note">
        {categories.length
          ? "Explore categories from the Brutti collection. Images feature published products."
          : "Explore our available projects in the collection below."}
      </p>
    </>
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
