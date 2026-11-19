import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, DraftingCompass, Hammer, Layers3 } from "lucide-react";
import type { Category, Product } from "../lib/types";
import { publicAssetUrl } from "../lib/assets";
import "./public-category-carousel.css";

const referenceImage = (name: string) =>
  import.meta.env.BASE_URL + "reference/" + name + ".jpg";

type ShowroomSectionsProps = {
  onExplore: (keyword: string) => void;
  onCategorySelect?: (categoryId: string) => void;
  categories?: Category[];
  publishedProducts?: Product[];
  loading?: boolean;
  section?: "categories" | "approach";
};

/** Fallbacks are real Brutti images from its official What We Build website. */
function officialCategoryPhoto(name: string) {
  const title = name.toLowerCase();
  const file =
    /bed|bunk/.test(title) ? "bed & bunkbed.webp" :
    /cabinet|wardrobe/.test(title) ? "built in cabinet.webp" :
    /kiosk/.test(title) ? "kiosk.webp" :
    /rack|shel/.test(title) ? "racks & shelves.webp" :
    /table|counter|reception/.test(title) ? "table & counters.webp" :
    /memento|souvenir/.test(title) ? "memento.webp" :
    /sign|panel|display/.test(title) ? "Signages.webp" :
    /camper/.test(title) ? "our camper.webp" :
    "others.webp";
  return "https://brutti.my/assets/what-we-build/" + encodeURIComponent(file);
}

/**
 * Categories and names come from the live Admin category records.
 * The carousel never reveals an unpublished product's private photos.
 */
export default function ShowroomSections({
  onExplore,
  onCategorySelect,
  categories = [],
  publishedProducts = [],
  loading = false,
  section = "categories",
}: ShowroomSectionsProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointerPaused = useRef(false);
  const manualUntil = useRef(0);

  useEffect(() => {
    if (section !== "categories" || categories.length === 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let lastTime = 0;
    let loopWidth = 0;
    const measure = () => {
      loopWidth = viewport.querySelector<HTMLElement>(".pub-category-rail-group")?.offsetWidth ?? 0;
    };
    measure();
    const animate = (now: number) => {
      if (lastTime === 0) lastTime = now;
      const delta = Math.min(now - lastTime, 60);
      lastTime = now;
      if (!document.hidden && !reducedMotion.matches && !pointerPaused.current && now > manualUntil.current && loopWidth > 0) {
        const next = viewport.scrollLeft + delta * 0.027;
        viewport.scrollLeft = next >= loopWidth ? next - loopWidth : next;
      }
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [categories.length, section]);

  const moveCategories = (direction: -1 | 1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    manualUntil.current = performance.now() + 1400;
    const cycleWidth = viewport.querySelector<HTMLElement>(".pub-category-rail-group")?.offsetWidth ?? 0;
    const step = Math.min(260, Math.max(145, viewport.clientWidth * 0.28));
    if (cycleWidth > 0 && direction < 0 && viewport.scrollLeft < step) {
      viewport.scrollLeft += cycleWidth;
    } else if (cycleWidth > 0 && direction > 0 && viewport.scrollLeft + step > cycleWidth) {
      viewport.scrollLeft -= cycleWidth;
    }
    viewport.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  if (section === "categories") {
    const categoryCards = categories.map(category => {
      const categoryProducts = publishedProducts.filter(
        product => product.categoryId === category.id && product.images.some(image => image.url?.trim())
      );
      const selected = categoryProducts.find(product => product.featured) ?? categoryProducts[0];
      const photo = selected?.images.find(image => image.url?.trim());
      return {
        id: category.id,
        name: category.name,
        image: photo ? publicAssetUrl(photo.url) : officialCategoryPhoto(category.name),
        fallback: officialCategoryPhoto(category.name),
      };
    });

    const chooseCategory = (id: string, name: string) => {
      if (onCategorySelect) onCategorySelect(id);
      else onExplore(name);
    };

    const group = (duplicate: boolean) => (
      <div className="pub-category-rail-group" aria-hidden={duplicate ? "true" : undefined} key={duplicate ? "repeat" : "original"}>
        {categoryCards.map(card => (
          <button
            className="pub-category-rail-item"
            type="button"
            key={card.id}
            tabIndex={duplicate ? -1 : 0}
            onClick={() => chooseCategory(card.id, card.name)}
            title={card.name}
          >
            <span className="pub-category-rail-image">
              <img
                src={card.image}
                alt=""
                loading="lazy"
                decoding="async"
                onError={event => {
                  const img = event.currentTarget;
                  if (img.src !== card.fallback) {
                    img.src = card.fallback;
                  } else {
                    img.style.opacity = "0";
                  }
                }}
              />
            </span>
            <span className="pub-category-rail-name">{card.name}</span>
          </button>
        ))}
      </div>
    );

    return (
      <section id="pub-showroom" className="pub-category-marquee" aria-label="Browse product categories">
        <div className="pub-category-marquee-heading">
          <div>
            <p className="pub-category-marquee-eyebrow">THE BENUA BRUTTI COLLECTION</p>
            <h2>Shop Furniture by Category</h2>
          </div>
          <button type="button" className="pub-category-marquee-all" onClick={() => onExplore("")}>
            Explore all <ArrowRight size={19} aria-hidden="true" />
          </button>
        </div>
        {loading && categories.length === 0 ? (
          <p className="pub-category-marquee-empty" role="status">Loading categories…</p>
        ) : categoryCards.length === 0 ? (
          <p className="pub-category-marquee-empty">Categories will appear here when added in Admin.</p>
        ) : (
          <div className="pub-category-marquee-controls">
            <button type="button" className="pub-category-marquee-arrow" aria-label="Previous categories" onClick={() => moveCategories(-1)}>
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <div
              className="pub-category-marquee-viewport"
              ref={viewportRef}
              onMouseEnter={() => { pointerPaused.current = true; }}
              onMouseLeave={() => { pointerPaused.current = false; }}
              onFocusCapture={() => { pointerPaused.current = true; }}
              onBlurCapture={() => { pointerPaused.current = false; }}
              onTouchStart={() => { pointerPaused.current = true; }}
              onTouchEnd={() => { pointerPaused.current = false; manualUntil.current = performance.now() + 1800; }}
              aria-label="Furniture and project categories"
            >
              <div className="pub-category-marquee-track">
                {group(false)}
                {group(true)}
              </div>
            </div>
            <button type="button" className="pub-category-marquee-arrow" aria-label="Next categories" onClick={() => moveCategories(1)}>
              <ArrowRight size={20} aria-hidden="true" />
            </button>
          </div>
        )}
      </section>
    );
  }

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
