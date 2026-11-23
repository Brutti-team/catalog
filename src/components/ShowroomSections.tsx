import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from "react";
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

/** The carousel never falls back to collage images with people.
 * For an empty or broken category photo, show a neutral brand placeholder.
 */
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
  const dragState = useRef<{
    pointerId: number;
    startX: number;
    scrollStart: number;
    loopWidth: number;
    dragging: boolean;
  } | null>(null);
  const suppressClickUntil = useRef(0);
  // Includes names and selected covers, not only the number of rows: renames,
  // additions, deletions and new Admin cover selections all resync the carousel.
  const categorySignature = categories
    .map(({ id, name, cover_image_url }) => `${id}:${name}:${cover_image_url ?? ""}`)
    .join("|");

  useEffect(() => {
    if (section !== "categories" || categories.length === 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    // Show the same first category as Staff Portal after any Admin change.
    // Slow automatic motion resumes after a short reading pause.
    viewport.scrollLeft = 0;
    manualUntil.current = performance.now() + 4500;

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
  }, [categorySignature, section]);

  // Mouse / trackpad drag on desktop. Touch is left to native horizontal
  // scrolling for smooth iOS/Android swipes and normal vertical page scroll.
  const startCategoryDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || event.button !== 0 || !event.isPrimary) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    pointerPaused.current = true;
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollStart: viewport.scrollLeft,
      loopWidth: viewport.querySelector<HTMLElement>(".pub-category-rail-group")?.offsetWidth ?? 0,
      dragging: false,
    };
  };

  const moveCategoryDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    const viewport = viewportRef.current;
    if (!drag || !viewport || event.pointerId !== drag.pointerId) return;
    const distance = event.clientX - drag.startX;
    if (!drag.dragging && Math.abs(distance) < 7) return;
    if (!drag.dragging) {
      drag.dragging = true;
      // Clone groups make the rail seamless even when dragged to the left
      // from its initial position. Reposition by one identical loop.
      if (drag.loopWidth > 0 && viewport.scrollLeft < drag.loopWidth * .65) {
        viewport.scrollLeft += drag.loopWidth;
        drag.scrollStart += drag.loopWidth;
      }
      viewport.classList.add("is-dragging");
      try { viewport.setPointerCapture(event.pointerId); } catch { /* no capture support */ }
    }
    event.preventDefault();
    let next = drag.scrollStart - distance;
    if (drag.loopWidth > 0) {
      // Keep interaction in the middle clones without reaching a hard edge.
      if (next < drag.loopWidth * .3) {
        next += drag.loopWidth;
        drag.scrollStart += drag.loopWidth;
      } else if (next > drag.loopWidth * 2.4) {
        next -= drag.loopWidth;
        drag.scrollStart -= drag.loopWidth;
      }
    }
    viewport.scrollLeft = next;
    manualUntil.current = performance.now() + 3500;
  };

  const stopCategoryDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const viewport = viewportRef.current;
    if (drag.dragging) {
      // Do not navigate to a category when the user only meant to drag it.
      suppressClickUntil.current = performance.now() + 400;
    }
    if (viewport) {
      viewport.classList.remove("is-dragging");
      if (viewport.hasPointerCapture?.(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId);
      }
    }
    dragState.current = null;
    pointerPaused.current = Boolean(viewport?.matches(":hover, :focus-within"));
    manualUntil.current = performance.now() + 4000;
  };

  const preventDragClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    // Keyboard activation remains available immediately after a drag.
    if (event.detail > 0 && performance.now() < suppressClickUntil.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

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
    // The Admin category records are the only authority for public categories.
    // Match the alphabetical ordering used in Staff Portal; stable ID breaks ties.
    const adminCategories = [...categories].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
      a.id.localeCompare(b.id)
    );
    const categoryCards = adminCategories.map(category => {
      // Images come from Admin cover selection, a pinned product-only Brutti
      // fallback, or published products; labels ALWAYS come from Admin records.
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
              <span className="pub-category-rail-single-fallback" aria-hidden="true">
                <Layers3 size={28} strokeWidth={1.4} />
              </span>
              {card.image && (
                <img
                  src={card.image}
                  alt=""
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  style={photoCropStyle(card.photo)}
                  onError={event => {
                    // Keep the neutral placeholder instead of loading a collage with people.
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
              onPointerDown={startCategoryDrag}
              onPointerMove={moveCategoryDrag}
              onPointerUp={stopCategoryDrag}
              onPointerCancel={stopCategoryDrag}
              onClickCapture={preventDragClick}
              onDragStart={event => event.preventDefault()}
              onMouseEnter={() => { pointerPaused.current = true; }}
              onMouseLeave={() => { pointerPaused.current = false; }}
              onFocusCapture={() => { pointerPaused.current = true; }}
              onBlurCapture={() => { pointerPaused.current = false; }}
              onTouchStart={() => { pointerPaused.current = true; }}
              onTouchEnd={() => { pointerPaused.current = false; manualUntil.current = performance.now() + 1800; }}
              aria-label="Furniture and project categories; drag horizontally to browse"
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
