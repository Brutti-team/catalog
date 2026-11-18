import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Image as ImageIcon,
  Box as BoxIcon,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import type { Category, Product, ProductImage } from "../lib/types";
import { photoCropStyle } from "../lib/photo-crop";
import { publicAssetUrl } from "../lib/assets";
import ProductPrice from "./ProductPrice";
import { productIdFromHash } from "../lib/routes";
import { recordCatalogEvent } from "../lib/customer-analytics";
import { BRUTTI_WHATSAPP_NUMBER, productWhatsAppUrl } from "../lib/whatsapp-enquiry";
import ShowroomSections from "./ShowroomSections";
import "./public.css";
import "./brutti-3d.css";
import "./public-reference.css";
const ProductModelViewer = lazy(() => import('./ProductModelViewer'));

interface Props {
  products: Product[];
  categories: Category[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onAdmin: () => void;
  /** Private admin-only rendering of draft product data without publishing. */
  previewProduct?: Product;
}

const configuredEmail = (import.meta.env.VITE_ENQUIRY_EMAIL || "").trim();
const enquiryEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail)
  ? configuredEmail
  : null;

const availabilityLabels = {
  available: "Available",
  "made-to-order": "Made to order",
  unavailable: "Currently unavailable",
};
function currentProductId() {
  return productIdFromHash(window.location.hash);
}
function FurnitureImage({
  src,
  alt,
  className = "",
  eager = false,
  image,
  fallbackToPlaceholder = true,
}: {
  src?: string;
  alt: string;
  className?: string;
  eager?: boolean;
  image?: ProductImage;
  fallbackToPlaceholder?: boolean;
}) {
  return (
    <img
      src={publicAssetUrl(src)}
      alt={alt}
      className={`${className}${image?.crop ? " catalog-image-cropped" : ""}`.trim()}
      style={photoCropStyle(image)}
      loading={eager ? "eager" : "lazy"}
      onError={(event) => {
        if (!fallbackToPlaceholder) {
          // The homepage hero should only show real catalog photography.
          event.currentTarget.style.visibility = "hidden";
        } else if (!event.currentTarget.src.endsWith("/images/placeholder.svg")) {
          event.currentTarget.src = publicAssetUrl("/images/placeholder.svg");
        }
      }}
    />
  );
}

export default function PublicCatalog({
  products,
  categories,
  loading,
  error,
  onRetry,
  onAdmin,
  previewProduct,
}: Props) {
  const [routeProductId, setProductId] = useState(currentProductId);
  const productId = previewProduct ? previewProduct.id : routeProductId;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [sort, setSort] = useState("curated");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"photos" | "3d">("photos");
  const [mobileMenu, setMobileMenu] = useState(false);
  useEffect(() => {
    if (!sortOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !sortRef.current?.contains(event.target)) {
        setSortOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSortOpen(false);
        sortRef.current?.querySelector<HTMLButtonElement>(".pub-sort-trigger")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [sortOpen]);
  useEffect(() => {
    if (previewProduct) {
      // A nested editor dialog may already be scrolled to its Save footer.
      // Always start the private customer preview from the top.
      const dialog = document.querySelector<HTMLDialogElement>("dialog.catalog-private-preview-dialog");
      if (dialog) dialog.scrollTop = 0;
      return;
    }
    const changeRoute = () => {
      setProductId(currentProductId());
      setImageIndex(0);
      setViewMode("photos");
      setMobileMenu(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", changeRoute);
    return () => window.removeEventListener("hashchange", changeRoute);
  }, [previewProduct]);
  const published = useMemo(
    () => products.filter((product) => product.status === "published"),
    [products],
  );
  // Use a real, published Brutti product photograph instead of the stock hero reference.
  // Featured products get priority; other published products provide a safe fallback.
  const heroProduct = useMemo(() => {
    const photographed = published.filter((item) => item.images.some((image) => image.url?.trim()));
    return photographed.find((item) => item.featured) ?? photographed[0];
  }, [published]);
  const heroImage = heroProduct?.images.find((image) => image.url?.trim());
  const product = previewProduct ?? (
    productId === null ? undefined : published.find((item) => item.id === productId)
  );
  // Track only the public catalog, never the admin's private product preview.
  useEffect(() => {
    if (!previewProduct && !loading && !error) recordCatalogEvent("catalog_open");
  }, [previewProduct, loading, error]);
  useEffect(() => {
    if (!previewProduct && !loading && !error && product?.status === "published") {
      recordCatalogEvent("product_view", product.id);
    }
  }, [previewProduct, loading, error, product?.id, product?.status]);
  const selectedModel = product?.model;
  const showingModel = viewMode === '3d' && Boolean(selectedModel);
  const categoryName = (id: string) =>
    categories.find((item) => item.id === id)?.name || "Furniture";
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const list = published.filter(
      (item) =>
        (category === "all" || item.categoryId === category) &&
        (!featuredOnly || item.featured) &&
        (!text ||
          `${item.name} ${item.sku} ${item.description} ${item.materials}`
            .toLowerCase()
            .includes(text)),
    );
    return [...list].sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "price"
          ? (a.price ?? Infinity) - (b.price ?? Infinity)
          : Number(b.featured) - Number(a.featured) || (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
    );
  }, [published, query, category, featuredOnly, sort]);
  const browseCollection = (featured = false) => {
    setFeaturedOnly(featured);
    setMobileMenu(false);
    if (productId !== null) {
      window.location.hash = "/catalog";
      window.setTimeout(
        () =>
          document
            .getElementById("pub-collection")
            ?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    } else
      document
        .getElementById("pub-collection")
        ?.scrollIntoView({ behavior: "smooth" });
  };
  const exploreShowroom = (keyword: string) => {
    setQuery(keyword);
    setCategory("all");
    setFeaturedOnly(false);
    browseCollection(false);
  };
  const resetFilters = () => {
    setQuery("");
    setCategory("all");
    setFeaturedOnly(false);
  };
  const related = product
    ? published
        .filter(
          (item) =>
            item.id !== product.id && item.categoryId === product.categoryId,
        )
        .slice(0, 3)
    : [];
  const card = (item: Product) => (
    <a
      href={`#/product/${encodeURIComponent(item.id)}`}
      className="pub-product-card"
      key={item.id}
      onClick={() => { if (!previewProduct) recordCatalogEvent("product_click", item.id); }}
    >
      <div className="pub-card-image">
        <FurnitureImage
          src={item.images[0]?.url}
          alt={item.images[0]?.alt || item.name}
          image={item.images[0]}
        />
        {item.featured && (
          <span className="pub-featured-tag">
            <Sparkles size={11} /> Featured
          </span>
        )}
        <span className="pub-card-open" aria-hidden="true">
          <ArrowUpRight size={20} />
        </span>
      </div>
      <div className="pub-card-meta">
        <span>{categoryName(item.categoryId)}</span>
        <span className={`pub-availability pub-${item.availability}`}>
          <i />
          {availabilityLabels[item.availability]}
        </span>
      </div>
      <div className="pub-card-bottom">
        <h3>{item.name}</h3>
        <span className="pub-card-price"><ProductPrice product={item} /></span>
      </div>
      <p className="pub-card-material">{item.materials}</p>
    </a>
  );

  return (
    <div className={previewProduct ? `pub-app pub-refined pub-private-preview${previewProduct.price === null ? " pub-private-preview-no-price" : ""}` : "pub-app pub-refined"}>
      {!previewProduct && <a
        className="pub-skip-link"
        href="#pub-main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("pub-main")?.focus();
        }}
      >
        Skip to content
      </a>}
      <header className="pub-header">
        <a
          href={previewProduct ? undefined : "#/catalog"}
          onClick={previewProduct ? (event) => event.preventDefault() : undefined}
          className="pub-wordmark"
          aria-label="Brutti catalog home"
        >
          <img src={publicAssetUrl("/images/brutti-wordmark.svg")} alt="Brutti" className="pub-official-logo" />
        </a>
        {!previewProduct && <nav
          id="pub-mobile-nav"
          className={mobileMenu ? "pub-nav pub-nav-open" : "pub-nav"}
          aria-label="Main navigation"
        >
          <button className="pub-nav-active" onClick={() => browseCollection()}>
            Collection
          </button>
          <button onClick={() => browseCollection(true)}>
            Featured
          </button>
          <button
            onClick={() => {
              document
                .getElementById("pub-process")
                ?.scrollIntoView({ behavior: "smooth" });
              setMobileMenu(false);
            }}
          >
            Our approach
          </button>
        </nav>}
        {!previewProduct && <div className="pub-header-actions">
          <button className="pub-admin-link" onClick={onAdmin}>
            Staff portal <ArrowUpRight size={15} />
          </button>
          <button
            className="pub-menu-toggle"
            aria-expanded={mobileMenu}
            aria-controls="pub-mobile-nav"
            aria-label={mobileMenu ? "Close navigation" : "Open navigation"}
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            {mobileMenu ? <X size={22} /> : <SlidersHorizontal size={22} />}
          </button>
        </div>}
        {previewProduct && <span className="pub-private-preview-label">Preview only · Not published</span>}
      </header>

      <main id="pub-main" tabIndex={-1}>
        {productId === null && (
          <>
            <section className="pub-hero">
              <div className="pub-hero-copy">
                <p className="pub-eyebrow">
                  <span /> THE BENUA BRUTTI COLLECTION · SABAH
                </p>
                <h1>
                  Considered spaces.
                  <br />
                  <em>Crafted to belong.</em>
                </h1>
                <p className="pub-hero-description">
                  Bespoke furniture, kiosks and fit-outs, thoughtfully made
                  around the way you live, work and welcome others.
                </p>
                <button
                  className="pub-primary-button"
                  onClick={() => browseCollection()}
                >
                  View the collection <ArrowRight size={17} />
                </button>
                <div className="pub-hero-footnote">
                  <span className="pub-hero-line" /> CUSTOM BUILT · SABAH
                </div>
              </div>
              <div className="pub-hero-visual">
                {heroImage && (
                  <FurnitureImage
                    key={heroImage.url}
                    src={heroImage.url}
                    alt={heroImage.alt || `Benua Brutti product: ${heroProduct?.name ?? "bespoke furniture"}`}
                    image={heroImage}
                    eager
                    fallbackToPlaceholder={false}
                  />
                )}
                <div className="pub-hero-image-label">
                  <span>FURNITURE · JOINERY · INTERIORS</span>
                  <ArrowUpRight size={23} />
                </div>
                <span className="pub-hero-number">
                  BENUA BRUTTI / BESPOKE BY NATURE
                </span>
              </div>
            </section>
            <div className="pub-values-strip">
              <span>
                <Check size={15} /> Materials with purpose
              </span>
              <span>
                <Check size={15} /> Custom-made solutions
              </span>
              <span>
                <Check size={15} /> Crafted for real spaces
              </span>
              <span className="pub-strip-location">
                BENUA BRUTTI SDN. BHD. <ArrowDown size={14} />
              </span>
            </div>
            <ShowroomSections onExplore={exploreShowroom} />
            <section id="pub-collection" className="pub-collection">
              <div className="pub-section-heading">
                <div>
                  <p className="pub-eyebrow">EXPLORE OUR WORK</p>
                  <h2>
                    The collection
                  </h2>
                </div>
                <p>
                  Kiosks, counters, cabinetry and furniture.
                  <br />
                  Explore the details behind every piece.
                </p>
              </div>
              <div className="pub-collection-tools">
                <label className="pub-search">
                  <Search size={18} />
                  <span className="pub-sr-only">Search the catalog</span>
                  <input
                    type="search"
                    placeholder="Search kiosks, counters, materials…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                    >
                      <X size={15} />
                    </button>
                  )}
                </label>
                <div className="pub-sort" ref={sortRef}>
                  <span>Sort by</span>
                  <div className="pub-sort-control">
                    <button
                      type="button"
                      className="pub-sort-trigger"
                      aria-label="Sort products"
                      aria-expanded={sortOpen}
                      aria-controls="pub-sort-options"
                      onClick={() => setSortOpen((isOpen) => !isOpen)}
                    >
                      <span>{sort === "name" ? "Name: A–Z" : sort === "price" ? "Price: low to high" : "Curated selection"}</span>
                      <ChevronDown size={15} aria-hidden="true" />
                    </button>
                    {sortOpen && (
                      <div id="pub-sort-options" className="pub-sort-menu" role="group" aria-label="Sort order">
                        {([
                          { value: "curated", label: "Curated selection" },
                          { value: "name", label: "Name: A–Z" },
                          { value: "price", label: "Price: low to high" },
                        ] as const).map(option => (
                          <button
                            type="button"
                            key={option.value}
                            className={"pub-sort-option" + (sort === option.value ? " is-selected" : "")}
                            aria-pressed={sort === option.value}
                            onClick={() => { setSort(option.value); setSortOpen(false); }}
                          >
                            {option.label}
                            {sort === option.value && <Check size={15} aria-hidden="true" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="pub-filter-row">
                <div
                  className="pub-category-filters"
                  aria-label="Filter by category"
                >
                  <button
                    aria-pressed={category === "all"}
                    className={category === "all" ? "pub-filter-active" : ""}
                    onClick={() => setCategory("all")}
                  >
                    All projects <span>{published.length}</span>
                  </button>
                  {categories.map((item) => (
                    <button
                      key={item.id}
                      aria-pressed={category === item.id}
                      className={
                        category === item.id ? "pub-filter-active" : ""
                      }
                      onClick={() => setCategory(item.id)}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
                <button
                  className={`pub-featured-filter ${featuredOnly ? "pub-filter-featured-active" : ""}`}
                  aria-pressed={featuredOnly}
                  onClick={() => setFeaturedOnly(!featuredOnly)}
                >
                  <Sparkles size={14} /> Featured only
                </button>
              </div>
              <div className="pub-results-label" role="status">
                {loading
                  ? "Loading the collection…"
                  : `${filtered.length} ${filtered.length === 1 ? "project" : "projects"}${query ? ` matching “${query}”` : " in the collection"}`}
                {(query || category !== "all" || featuredOnly) && (
                  <button onClick={resetFilters}>
                    Clear filters <X size={12} />
                  </button>
                )}
              </div>
              {loading ? (
                <div
                  className="pub-products-grid"
                  aria-label="Loading products"
                  aria-busy="true"
                >
                  {Array.from({ length: 6 }, (_, index) => (
                    <div className="pub-skeleton-card" key={index}>
                      <div />
                      <span />
                      <span />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="pub-empty-state" role="alert">
                  <h3>The collection is taking a moment.</h3>
                  <p>{error}</p>
                  <button className="pub-primary-button" onClick={onRetry}>
                    Try again <ArrowRight size={16} />
                  </button>
                </div>
              ) : filtered.length ? (
                <div className="pub-products-grid">{filtered.map(card)}</div>
              ) : (
                <div className="pub-empty-state">
                  <span className="pub-empty-icon" aria-hidden="true"><Search size={23} /></span>
                  <h3>{!published.length && !query && category === "all" && !featuredOnly
                    ? "Our collection is taking shape."
                    : "No matching projects."}</h3>
                  <p>{!published.length && !query && category === "all" && !featuredOnly
                    ? "A curated selection of Benua Brutti projects will appear here as they are published."
                    : "Try another search or choose a different category to explore our work."}</p>
                  {(query || category !== "all" || featuredOnly) && (
                    <button className="pub-primary-button" onClick={resetFilters}>
                      View all projects <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              )}
            </section>
          </>
        )}
        {productId !== null && (
          <section className="pub-detail-section">
            {!previewProduct && <a href="#/catalog" className="pub-back-link">
              <ArrowLeft size={16} /> Back to the collection
            </a>}
            {loading ? (
              <div className="pub-detail-loading" aria-busy="true">
                <div className="pub-skeleton-card">
                  <div />
                </div>
                <div>
                  <div className="pub-skeleton-line" />
                  <div className="pub-skeleton-line" />
                  <div className="pub-skeleton-line" />
                </div>
              </div>
            ) : error ? (
              <div className="pub-empty-state" role="alert">
                <h2>We couldn’t load this piece.</h2>
                <p>{error}</p>
                <button className="pub-primary-button" onClick={onRetry}>
                  Try again <ArrowRight size={16} />
                </button>
              </div>
            ) : !product ? (
              <div className="pub-empty-state">
                <h2>This piece isn’t in the collection.</h2>
                <p>It may be unpublished or no longer available.</p>
                <a href="#/catalog" className="pub-primary-button">
                  Explore the collection <ArrowRight size={16} />
                </a>
              </div>
            ) : (
              <>
                <div className="pub-product-detail">
                  <div className="pub-detail-gallery">
                    {previewProduct && (
                      <div className="catalog-preview-media-tabs" role="group" aria-label="Preview image format">
                        <button type="button" className={!showingModel ? "is-active" : ""} aria-pressed={!showingModel} onClick={() => setViewMode("photos")}><ImageIcon size={15} aria-hidden="true" /> Photo</button>
                        <button type="button" className={showingModel ? "is-active" : ""} disabled={!selectedModel} aria-pressed={showingModel} onClick={() => setViewMode("3d")}><BoxIcon size={15} aria-hidden="true" /> 3D</button>
                      </div>
                    )}
                    {!previewProduct && selectedModel && (
                      <div className="pub-media-switch" role="group" aria-label="Product viewing mode">
                        <button type="button" aria-pressed={viewMode === '3d'} onClick={() => setViewMode("3d")}>Interactive 3D</button>
                        <button type="button" aria-pressed={viewMode === 'photos'} onClick={() => setViewMode("photos")}>Original photos</button>
                      </div>
                    )}
                    {showingModel && selectedModel ? (
                      <Suspense fallback={<div className="product-model-stage"><p className="product-model-message" role="status">Loading 3D viewer…</p></div>}>
                        <ProductModelViewer model={selectedModel} productName={product.name} poster={product.images[0]?.url} />
                      </Suspense>
                    ) : (
                    <div className="pub-detail-main-image">
                      <FurnitureImage
                        src={
                          (product.images[imageIndex] || product.images[0])?.url
                        }
                        alt={
                          (product.images[imageIndex] || product.images[0])
                            ?.alt || product.name
                        }
                        image={product.images[imageIndex] || product.images[0]}
                        eager
                      />
                      {product.featured && (
                        <span className="pub-featured-tag">
                          <Sparkles size={12} /> Featured piece
                        </span>
                      )}
                      {previewProduct && (
                        <span className="catalog-preview-photo-caption">
                          Original photo · {selectedModel ? "3D model available" : "3D not yet available"}
                        </span>
                      )}
                    </div>
                    )}
                    {!showingModel && product.images.length > 1 && (
                      <div
                        className="pub-gallery-thumbnails"
                        aria-label="Product image gallery"
                      >
                        {product.images.map((item, index) => (
                          <button
                            key={item.id}
                            aria-label={`View image ${index + 1}: ${item.alt || product.name}`}
                            aria-pressed={imageIndex === index}
                            className={
                              imageIndex === index ? "pub-thumbnail-active" : ""
                            }
                            onClick={() => setImageIndex(index)}
                          >
                            <FurnitureImage src={item.url} alt="" image={item} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="pub-detail-copy">
                    <p className="pub-eyebrow">
                      {categoryName(product.categoryId)}{previewProduct ? "" : ` · ${product.sku}`}
                    </p>
                    <h1>{product.name}</h1>
                    <div
                      className={`pub-detail-availability pub-availability pub-${product.availability}`}
                    >
                      <i />
                      {availabilityLabels[product.availability]}
                    </div>
                    <p className="pub-detail-description">
                      {product.description}
                    </p>
                    <p className="pub-detail-price">
                      {previewProduct && product.price === null
                        ? <span className="catalog-price-current">Price on request</span>
                        : <ProductPrice product={product} />}
                      {product.price !== null && (
                        <small>
                          Indicative price · Confirm details on enquiry
                        </small>
                      )}
                    </p>
                    <a
                      className="pub-primary-button pub-enquiry-button pub-whatsapp-enquiry"
                      href={productWhatsAppUrl(product)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Enquire about ${product.name} on WhatsApp`}
                    >
                      Enquire about this piece <ArrowUpRight size={16} aria-hidden="true" />
                    </a>
                    <p className="pub-enquiry-note">
                      Opens WhatsApp with a ready-to-send message about this product. You can review it before sending.
                    </p>
                    <div className="pub-specifications">
                      <h2>The details</h2>
                      <dl>
                        <div>
                          <dt>Materials</dt>
                          <dd>{product.materials}</dd>
                        </div>
                        <div>
                          <dt>Dimensions</dt>
                          <dd>
                            {product.width} W × {product.depth} D ×{" "}
                            {product.height} H cm
                          </dd>
                        </div>
                        <div className={previewProduct ? "catalog-preview-hidden-meta" : ""}>
                          <dt>Category</dt>
                          <dd>{categoryName(product.categoryId)}</dd>
                        </div>
                        {(product.specifications ?? []).map((item) => (
                          <div key={item.id}>
                            <dt>{item.name}</dt>
                            <dd>{item.value}</dd>
                          </div>
                        ))}
                        <div className={previewProduct ? "catalog-preview-hidden-meta" : ""}>
                          <dt>Product reference</dt>
                          <dd>{product.sku}</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="pub-detail-promise">
                      <span className="pub-promise-symbol">b.</span>
                      <p>
                        Made for the spaces you imagine.
                        <br />
                        <span>Crafted with care by Benua Brutti.</span>
                      </p>
                    </div>
                  </div>
                </div>
                {!previewProduct && related.length > 0 && (
                  <section className="pub-related">
                    <div className="pub-section-heading">
                      <div>
                        <p className="pub-eyebrow">MORE FROM THE WORKSHOP</p>
                        <h2>Explore related works.</h2>
                      </div>
                      <a href="#/catalog">
                        View the collection <ArrowRight size={16} />
                      </a>
                    </div>
                    <div className="pub-products-grid">{related.map(card)}</div>
                  </section>
                )}
              </>
            )}
          </section>
        )}
        {productId === null && <ShowroomSections onExplore={exploreShowroom} section="approach" />}
        {!previewProduct && <section className="pub-story" id="pub-story">
          <div>
            <p className="pub-eyebrow">CUSTOM BY NATURE</p>
            <h2>
              Built around your brief.
              <br />
              <em>Made for daily use.</em>
            </h2>
          </div>
          <div>
            <p>
              Every kiosk, custom counter and furnishing project begins with a purpose. We bring together practical design, material character and workshop craftsmanship.
            </p>
            <button onClick={() => browseCollection()}>
              View our work <ArrowRight size={18} />
            </button>
          </div>
        </section>}
      </main>
      {!previewProduct && <footer className="pub-footer">
        <div>
          <a href="#/catalog" className="pub-wordmark">
            <img src={publicAssetUrl("/images/brutti-wordmark.svg")} alt="Brutti" className="pub-official-logo" />
          </a>
          <p>
            BENUA BRUTTI SDN. BHD.
            <br />
            Bespoke furniture, kiosks & commercial fit-out.
          </p>
        </div>
        <div className="pub-footer-right">
          {enquiryEmail ? (
            <a href={`mailto:${enquiryEmail}`}>
              Let’s make room. <ArrowUpRight size={15} />
            </a>
          ) : (
            <a href={`https://wa.me/${BRUTTI_WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer">
              Chat on WhatsApp <ArrowUpRight size={15} />
            </a>
          )}
          <small>
            © {new Date().getFullYear()} Benua Brutti Sdn. Bhd.
          </small>
        </div>
      </footer>}
    </div>
  );
}
