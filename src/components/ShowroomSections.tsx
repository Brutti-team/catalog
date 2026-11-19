import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, DraftingCompass, Hammer, Layers3 } from "lucide-react";
import type { Category, Product } from "../lib/types";
import { publicAssetUrl } from "../lib/assets";
import { photoCropStyle } from "../lib/photo-crop";
import { curatedCategoryCover } from "../lib/curated-category-covers";
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

/** Official Brutti project boards are collages, so crop a single photographed object only.
 * These covers are used solely when a category has no published product photo.
 * An Admin-published Featured / Best Selling product takes precedence automatically.
 */
function officialCategoryCover(name: string): { url: string; position: string; zoom: string } {
  const title = name.toLowerCase();
  let file = "others.webp";
  let position = "0% 9%";
  let zoom = "215% auto";

  if (/bed|bunk/.test(title)) {
    file = "bed & bunkbed.webp";
    position = "100% 12%"; // Timber bunk bed (top-right of the original project board).
    zoom = "225% auto";
  } else if (/cabinet|wardrobe/.test(title)) {
    file = "built in cabinet.webp";
    position = "0% 5%"; // Built-in wood cabinet, not the full montage.
    zoom = "210% auto";
  } else if (/kiosk/.test(title)) {
    file = "kiosk.webp";
    position = "0% 12%"; // Single curved timber kiosk.
    zoom = "215% auto";
  } else if (/rack|shel/.test(title)) {
    file = "racks & shelves.webp";
    position = "100% 12%"; // Tall timber display rack.
    zoom = "225% auto";
  } else if (/table|kitchen/.test(title)) {
    file = "table & counters.webp";
    position = "100% 10%"; // Timber counter with shelves.
    zoom = "215% auto";
  } else if (/reception|counter/.test(title)) {
    file = "table & counters.webp";
    position = "100% 12%"; // One counter, rather than the montage.
    zoom = "215% auto";
  } else if (/memento|souvenir|memorabil/.test(title)) {
    file = "memento.webp";
    position = "100% 9%"; // Wooden commemorative display box.
    zoom = "220% auto";
  } else if (/panel|sign|display/.test(title)) {
    file = "Signages.webp";
    position = "0% 3%"; // One Brutti timber sign.
    zoom = "208% auto";
  } else if (/rental/.test(title)) {
    file = "kiosk.webp";
    position = "0% 12%"; // Event kiosk suitable for temporary rental.
    zoom = "215% auto";
  }

  return {
    url: "https://brutti.my/assets/what-we-build/" + encodeURIComponent(file),
    position,
    zoom,
  };
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
      // Staff choose the showcase item by marking a published product Featured
      // (or Best Selling). Never reveal private Draft/Archived product photos.
      const categoryProducts = publishedProducts
        .filter(product => product.categoryId === category.id && product.images.some(image => image.url?.trim()))
        .sort((a, b) =>
          Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
          Number(Boolean(b.bestSelling)) - Number(Boolean(a.bestSelling)) ||
          (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
          a.name.localeCompare(b.name)
        );
      const photo = categoryProducts[0]?.images.find(image => image.url?.trim());
      // A Staff Portal-selected cover takes priority even when its original product
      // stays Draft. Selecting the photo intentionally publishes only that image.
      const chosenCover = category.cover_image_url?.trim();
      const curatedCover = curatedCategoryCover(category.id);
      const selectedPhoto = chosenCover || curatedCover?.imageUrl;
      return {
        id: category.id,
        name: category.name,
        // Pinned Brutti Library photos do not change when new products are uploaded.
        image: selectedPhoto ? publicAssetUrl(selectedPhoto) : photo ? publicAssetUrl(photo.url) : null,
        photo: selectedPhoto ? undefined : photo,
        fallback: officialCategoryCover(category.name),
      };
    });

    const chooseCategory = (id: string, name: string) => {
      if (onCategorySelect) onCategorySelect(id);
      else onExplore(name);
    };

    const group = (copyIndex: number) => (
      <div className="pub-category-rail-group" aria-hidden={copyIndex ? "true" : undefined} key={`group-${copyIndex}`}>
        {categoryCards.map(card => (
          <button
            className="pub-category-rail-item"
            type="button"
            key={card.id}
            tabIndex={copyIndex ? -1 : 0}
            onClick={() => chooseCategory(card.id, card.name)}
            title={card.name}
          >
            <span className="pub-category-rail-image">
              <span
                className="pub-category-rail-single-fallback"
                aria-hidden="true"
                style={{
                  backgroundImage: `url("${card.fallback.url}")`,
                  backgroundPosition: card.fallback.position,
                  backgroundSize: card.fallback.zoom,
                }}
              />
              {card.image && (
                <img
                  src={card.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={photoCropStyle(card.photo)}
                  onError={event => {
                    // Leave the single-object branded photo underneath as fallback.
                    event.currentTarget.style.display = "none";
                  }}
                />
              )}
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
            <h2 style={{ fontFamily: '"Manrope", "DM Sans", system-ui, sans-serif', fontWeight: 650, letterSpacing: "-0.043em" }}>Shop Furniture by Category</h2>
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
                {[0, 1, 2, 3].map(group)}
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
