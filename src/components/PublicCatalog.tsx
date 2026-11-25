import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowUp,
  Check,
  ChevronDown,
  Download,
  Image as ImageIcon,
  Box as BoxIcon,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
  ZoomIn,
} from "lucide-react";
import type { Category, Product, ProductImage, ProductSpecification } from "../lib/types";
import { publicPhotoCropStyle, isStudioEditedPhoto, effectivePhotoCrop } from "../lib/photo-crop";
import { publicAssetUrl } from "../lib/assets";
import ProductPrice from "./ProductPrice";
import CatalogPdfDownload, { type CatalogPdfDownloadHandle } from "./CatalogPdfDownload";
import { recommendProducts, recentProductIds, searchMatches } from "../lib/product-recommendations";
import MaterialsContent from "./MaterialsContent";
import { splitSpecifications, primaryFinishingRow } from "../lib/specification-groups";
import { formatProductDimensions, formatSpecificationMeasurement } from "../lib/dimensions";
import { productIdFromHash } from "../lib/routes";
import { recordCatalogEvent } from "../lib/customer-analytics";
import { BRUTTI_WHATSAPP_NUMBER, productWhatsAppUrl } from "../lib/whatsapp-enquiry";
import ShowroomSections from "./ShowroomSections";
import BestSellingSection from "./BestSellingSection";
import PublicCollectionSpotlight from "./PublicCollectionSpotlight";
import CustomerPhotoZoom from "./CustomerPhotoZoom";
import CustomerFavourites from "./CustomerFavourites";
import "./public.css";
import "./brutti-3d.css";
import "./public-reference.css";
const ProductModelViewer = lazy(() => import('./ProductModelViewer'));

/** Preserve dimensions while showing component counts, e.g. Drawer: 2 pcs. */
function specificationDisplayValue(item: ProductSpecification): string {
  const quantity = Number.isInteger(item.quantity) && (item.quantity ?? 0) > 0
    ? `${item.quantity} pcs` : "";
  return [item.kind === "measurement" ? formatSpecificationMeasurement(item.value) : item.value.trim(), quantity].filter(Boolean).join(" · ");
}
function specificationHasContent(item: ProductSpecification): boolean {
  return Boolean(item.name.trim() && specificationDisplayValue(item));
}

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

/** Crisp, full-colour Gmail mark for the footer email actions. */
function GmailLogo() {
  return (
    <svg width={24} height={24} viewBox="0 0 28 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 6.25v12.2A2.05 2.05 0 0 0 5.05 20.5H8V10.0L3 6.25Z" fill="#4285F4" />
      <path d="M20 10.0v10.5h2.95A2.05 2.05 0 0 0 25 18.45V6.25L20 10.0Z" fill="#34A853" />
      <path d="M8 6.25 14 10.75 20 6.25v5.15L14 15.9 8 11.4V6.25Z" fill="#EA4335" />
      <path d="M3 6.25V5.35c0-1.85 2.1-2.9 3.6-1.77L8 4.63v6.77L3 7.65v-1.4Z" fill="#C5221F" />
      <path d="M20 4.63 21.4 3.58c1.5-1.13 3.6-.08 3.6 1.77v2.3l-5 3.75V4.63Z" fill="#FBBC04" />
      <path d="M8 4.63 14 9.13 20 4.63v5.15l-6 4.5-6-4.5V4.63Z" fill="#EA4335" />
    </svg>
  );
}

// Exact brand silhouettes from Simple Icons, rendered locally without third-party image requests.
const socialLogoPaths: Record<"tiktok" | "instagram" | "facebook" | "threads" | "whatsapp", string> = {
  "tiktok": "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  "instagram": "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077",
  "facebook": "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z",
  "threads": "M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z",
  "whatsapp": "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
};

function SocialBrandIcon({ brand }: { brand: "tiktok" | "instagram" | "facebook" | "threads" | "whatsapp" }) {
  return (
    <svg viewBox="0 0 24 24" width="23" height="23" fill="currentColor" focusable="false" aria-hidden="true">
      <path d={socialLogoPaths[brand]} />
    </svg>
  );
}

const configuredEmail = (import.meta.env.VITE_ENQUIRY_EMAIL || "").trim();
const enquiryEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail)
  ? configuredEmail
  : null;

const availabilityLabels = {
  available: "Ready Stock",
  "made-to-order": "Pre-order",
  unavailable: "Unavailable",
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
      className={`${className}${image?.crop ? " catalog-image-cropped" : isStudioEditedPhoto(image) ? " catalog-image-studio-edited" : ""}`.trim()}
      style={publicPhotoCropStyle(image)}
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
  const publicPageRef = useRef<HTMLDivElement>(null);
  // Animate the hero only when entering the homepage; scrolling never triggers motion.
  useEffect(() => {
    if (previewProduct || productId !== null) return;
    const root = publicPageRef.current;
    if (!root || !("animate" in Element.prototype)) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    const animations = Array.from(root.querySelectorAll(
      ".pub-hero-copy > .pub-eyebrow, .pub-hero-copy > h1, .pub-hero-copy > .pub-hero-description, .pub-hero-copy > .pub-primary-button"
    )).map((element, index) => element.animate(
      [{ opacity: 0, translate: "0 12px" }, { opacity: 1, translate: "0 0" }],
      { duration: 620, delay: Math.min(index * 55, 165), easing: "cubic-bezier(.22,.8,.25,1)", fill: "backwards" }
    ));
    const cancel = () => animations.forEach(animation => animation.cancel());
    const syncMotion = () => { if (motion.matches) cancel(); };
    motion.addEventListener("change", syncMotion);
    return () => {
      cancel();
      motion.removeEventListener("change", syncMotion);
    };
  }, [productId, previewProduct]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [bestOnly, setBestOnly] = useState(false);
  const [collectionExpanded, setCollectionExpanded] = useState(false);
  // The collapsed collection shows two complete rows at each CSS breakpoint.
  const getCollectionLimit = () => {
    if (typeof window === "undefined") return 8;
    if (window.matchMedia("(max-width: 365px)").matches) return 2;
    if (window.matchMedia("(max-width: 850px)").matches) return 4;
    if (window.matchMedia("(max-width: 1199px)").matches) return 6;
    return 8;
  };
  const [collectionLimit, setCollectionLimit] = useState(getCollectionLimit);
  useEffect(() => {
    const queries = ["(max-width: 365px)", "(max-width: 850px)", "(max-width: 1199px)"]
      .map(query => window.matchMedia(query));
    const syncLimit = () => setCollectionLimit(getCollectionLimit());
    syncLimit();
    queries.forEach(query => query.addEventListener("change", syncLimit));
    return () => queries.forEach(query => query.removeEventListener("change", syncLimit));
  }, []);
  // Keep recommendation signals in this catalog session only, not in analytics or persistent storage.
  const [viewedIds, setViewedIds] = useState<string[]>([]);
  const [searchedIds, setSearchedIds] = useState<string[]>([]);
  const noteViewed = useCallback((id: string) => setViewedIds(ids => recentProductIds(ids, [id])), []);
  // When an Admin deletes a category, avoid keeping a stale public filter.
  useEffect(() => {
    if (!loading && category !== "all" && !categories.some(item => item.id === category)) {
      setCategory("all");
    }
  }, [category, categories, loading]);
  const [sort, setSort] = useState("curated");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [photoZoomOpen, setPhotoZoomOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"photos" | "3d">("photos");
  const [mobileMenu, setMobileMenu] = useState(false);
  const pdfDownloadRef = useRef<CatalogPdfDownloadHandle>(null);
  const openCatalogueDownload = () => {
    setMobileMenu(false);
    pdfDownloadRef.current?.open();
  };
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
      setPhotoZoomOpen(false);
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
  const product = previewProduct ?? (
    productId === null ? undefined : published.find((item) => item.id === productId)
  );
  const finishingRow = primaryFinishingRow(product?.specifications);
  const specificationGroups = splitSpecifications((product?.specifications ?? []).filter(row => row.id !== finishingRow?.id));
  const viewedProductId = product?.status === "published" ? product.id : undefined;
  useEffect(() => {
    if (!previewProduct && !loading && !error && viewedProductId) noteViewed(viewedProductId);
  }, [previewProduct, loading, error, viewedProductId, noteViewed]);
  useEffect(() => {
    if (previewProduct || loading || error || !query.trim()) return;
    const timeout = window.setTimeout(() => {
      const matches = published.filter(item => searchMatches(item, query)).slice(0, 16).map(item => item.id);
      if (matches.length) setSearchedIds(ids => recentProductIds(ids, matches));
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [query, published, previewProduct, loading, error]);
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
        (!bestOnly || item.bestSelling === true) &&
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
  }, [published, query, category, sort, bestOnly]);
  useEffect(() => { setCollectionExpanded(false); }, [query, category, sort, bestOnly]);
  const canExpandCollection = !bestOnly && filtered.length > collectionLimit;
  const visibleProducts = bestOnly || collectionExpanded ? filtered : filtered.slice(0, collectionLimit);
  const browseCollection = () => {
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
    setBestOnly(false);
    browseCollection();
  };
  const browseShowroom = () => {
    setMobileMenu(false);
    if (productId !== null) {
      window.location.hash = "/catalog";
      window.setTimeout(
        () => document.getElementById("pub-showroom")?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    } else {
      document.getElementById("pub-showroom")?.scrollIntoView({ behavior: "smooth" });
    }
  };
  const browseBestSellers = () => {
    setMobileMenu(false);
    if (productId !== null) {
      window.location.hash = "/catalog";
      window.setTimeout(
        () => document.getElementById("pub-best-selling")?.scrollIntoView({ behavior: "smooth" }),
        60,
      );
    } else {
      document.getElementById("pub-best-selling")?.scrollIntoView({ behavior: "smooth" });
    }
  };
  const resetFilters = () => {
    setQuery("");
    setCategory("all");
    setBestOnly(false);
  };
  const showAllBestSellers = () => {
    setQuery("");
    setCategory("all");
    setBestOnly(true);
    browseCollection();
  };
  const related = useMemo(() => recommendProducts(published, viewedIds, searchedIds, product?.id),
    [published, viewedIds, searchedIds, product?.id]);
  const recommendations = (home: boolean) => (
    <section id="pub-recommendations" className={home ? "pub-related pub-home-recommendations" : "pub-related"} aria-labelledby="pub-recommendations-title">
      <div className="pub-section-heading">
        <div>
          <p className="pub-eyebrow">CURATED FOR YOU</p>
          <h2 id="pub-recommendations-title">You May Also Like</h2>
          <p className="pub-recommendations-copy">Discover more pieces based on your recent views and searches.</p>
        </div>
        <button type="button" className="pub-recommendations-browse" onClick={() => { resetFilters(); browseCollection(); }}>
          View all products <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="pub-products-grid pub-products-grid--catalog">
        {related.map(item => <PublicCollectionSpotlight key={item.id} product={item}
          categoryName={categoryName(item.categoryId)} onView={noteViewed} showColours />)}
      </div>
    </section>
  );

  return (
    <div ref={publicPageRef} className={previewProduct ? `pub-app pub-refined pub-private-preview${previewProduct.price === null ? " pub-private-preview-no-price" : ""}` : "pub-app pub-refined"}>
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
          <button className="pub-nav-active" onClick={() => { resetFilters(); browseCollection(); }}>
            Collection
          </button>
          <button onClick={browseShowroom}>
            Categories
          </button>
          <button onClick={browseBestSellers}>
            Best sellers
          </button>
          <button type="button" className="pub-nav-download" aria-haspopup="dialog"
            disabled={loading || Boolean(error) || !published.length} onClick={openCatalogueDownload}>
            Download Catalogue
          </button>
          <a className="pub-nav-website" href="https://brutti.my" onClick={() => setMobileMenu(false)}>
            Main Website <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        </nav>}
        {!previewProduct && <div className="pub-header-actions">
          <CustomerFavourites products={published} categories={categories} loading={loading} error={error} onOpen={() => setMobileMenu(false)} />
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
      {!previewProduct && <CatalogPdfDownload products={published} categories={categories}
        disabled={loading || Boolean(error)} openRef={pdfDownloadRef} hideTrigger />}

      <main id="pub-main" tabIndex={-1}>
        {productId === null && (
          <>
            <section className="pub-hero">
              <div className="pub-hero-copy">
                <p className="pub-eyebrow">
                  <span /> BRUTTI'S COLLECTION
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
                <img
                  className="pub-brutti-collection-hero"
                  src={publicAssetUrl("/images/brutti-collection-hero.webp")}
                  alt=""
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  onLoad={event => event.currentTarget.classList.add("is-loaded")}
                  onError={event => { event.currentTarget.style.visibility = "hidden"; }}
                />
                <span className="pub-hero-number">
                  BRUTTI / BESPOKE BY NATURE
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
            </div>
            <ShowroomSections onExplore={exploreShowroom} onCategorySelect={(categoryId) => { setQuery(""); setCategory(categoryId); setBestOnly(false); browseCollection(); }} categories={categories} publishedProducts={published} loading={loading} />
            <section id="pub-collection" className="pub-collection">
              <div className="pub-collection-green-header">
                <div className="pub-section-heading">
                <div>
                  <p className="pub-eyebrow">EXPLORE THE COLLECTION</p>
                  <h2>
                    Browse by category
                  </h2>
                </div>
              </div>
              <div className="pub-collection-tools">
                <label className="pub-search">
                  <Search size={19} aria-hidden="true" />
                  <span className="pub-sr-only">Search the catalog</span>
                  <input
                    type="search"
                    placeholder="Search projects, products or materials"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                      <X size={15} />
                    </button>
                  )}
                </label>
                <div className="pub-collection-actions">
                  <button className="pub-pdf-trigger" type="button" aria-haspopup="dialog" disabled={loading || Boolean(error) || !published.length} onClick={openCatalogueDownload}>
                    <Download size={17} aria-hidden="true"/> Download Catalogue
                  </button>
                  <div className="pub-sort" ref={sortRef}>
                    <div className="pub-sort-control">
                      <button
                        type="button"
                        className="pub-sort-trigger"
                        aria-label="Sort products by"
                        aria-expanded={sortOpen}
                        aria-controls="pub-sort-options"
                        onClick={() => setSortOpen((isOpen) => !isOpen)}
                      >
                        <span className="pub-sort-caption">Sort by:</span>
                        <span className="pub-sort-current">
                          {sort === "name" ? "Name A–Z" : sort === "price" ? "Lowest price" : "Recommended"}
                        </span>
                        <ChevronDown size={14} aria-hidden="true" />
                      </button>
                      {sortOpen && (
                        <div id="pub-sort-options" className="pub-sort-menu" role="group" aria-label="Sort order">
                          {([
                            { value: "curated", label: "Recommended" },
                            { value: "name", label: "Name A–Z" },
                            { value: "price", label: "Lowest price" },
                          ] as const).map(option => (
                            <button
                              type="button"
                              key={option.value}
                              className={"pub-sort-option" + (sort === option.value ? " is-selected" : "")}
                              aria-pressed={sort === option.value}
                              onClick={() => { setSort(option.value); setSortOpen(false); }}
                            >
                              <span>{option.label}</span>
                              {sort === option.value && <Check size={14} aria-hidden="true" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="pub-filter-row">
                <div className="pub-category-filters" aria-label="Filter by category">
                  <button
                    type="button"
                    aria-pressed={category === "all" && !bestOnly}
                    className={category === "all" && !bestOnly ? "pub-filter-active" : ""}
                    onClick={() => { setCategory("all"); setBestOnly(false); }}
                  >
                    All projects
                  </button>
                  <button type="button" aria-pressed={bestOnly}
                    className={bestOnly ? "pub-filter-active" : ""}
                    onClick={() => { setCategory("all"); setBestOnly(value => !value); }}>
                    Best Sellers
                  </button>
                  {categories.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      aria-pressed={category === item.id}
                      className={category === item.id ? "pub-filter-active" : ""}
                      onClick={() => setCategory(item.id)}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
              </div>
              {(loading || query || category !== "all" || bestOnly) && (
                <div className="pub-results-label" role="status">
                  {loading && "Loading the collection…"}
                  {(query || category !== "all" || bestOnly) && (
                    <button onClick={resetFilters}>
                      Clear filters <X size={12} />
                    </button>
                  )}
                </div>
              )}
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
                <>
                <div id="pub-collection-product-grid" className="pub-products-grid pub-products-grid--catalog">
                  {visibleProducts.map(item => (
                    <PublicCollectionSpotlight
                      key={item.id}
                      product={item}
                      categoryName={categoryName(item.categoryId)}
                      onView={noteViewed}
                    />
                  ))}
                </div>
                {canExpandCollection && <>
                  <div className="pub-collection-more-divider">
                    <button type="button" className="pub-collection-more-button"
                      aria-controls="pub-collection-product-grid" aria-expanded={collectionExpanded}
                      onClick={event => {
                        const button = event.currentTarget;
                        setCollectionExpanded(!collectionExpanded);
                        if (collectionExpanded) requestAnimationFrame(() => {
                          if (button.isConnected) button.scrollIntoView({ block: "nearest", behavior: "instant" });
                        });
                      }}>
                      {collectionExpanded ? "See less" : "See more"}
                      <ChevronDown size={15} aria-hidden="true" style={{ transform: collectionExpanded ? "rotate(180deg)" : undefined }} />
                    </button>
                  </div>
                  <span className="pub-sr-only" role="status">Showing {visibleProducts.length} of {filtered.length} products.</span>
                </>}
                </>
              ) : published.length === 0 && !query && category === "all" ? (
                <div className="pub-empty-state pub-empty-state--unpublished">
                  <div className="pub-empty-editorial">
                    <span className="pub-empty-eyebrow">BRUTTI · THE COLLECTION</span>
                    <span className="pub-empty-icon" aria-hidden="true"><BoxIcon size={21} /></span>
                    <h3>A collection in the making.</h3>
                    <p>We're preparing our furniture and bespoke fit-out projects for this gallery. Explore the kinds of spaces we create in the meantime.</p>
                    <button type="button" className="pub-empty-explore" onClick={browseShowroom}>
                      Explore our categories <ArrowUpRight size={17} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="pub-empty-visual">
                    <img
                      src="https://brutti.my/assets/what-we-build/built%20in%20cabinet.webp"
                      alt="A built-in cabinet project by Brutti"
                      loading="lazy"
                      onError={(event) => { event.currentTarget.closest(".pub-empty-visual")?.classList.add("is-image-unavailable"); }}
                    />
                    <span>THOUGHTFULLY MADE IN SABAH</span>
                  </div>
                </div>
              ) : (
                <div className="pub-empty-state pub-empty-state--compact pub-empty-state--no-results">
                  <span className="pub-empty-icon" aria-hidden="true"><Search size={20} /></span>
                  <h3>No matching projects.</h3>
                  <p>Try another search term or select a different category.</p>
                  <button className="pub-primary-button" type="button" onClick={resetFilters}>
                    View all projects <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </section>
          </>
        )}
        {productId !== null && (
          <section className="pub-detail-section">
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
                    <div className={"pub-detail-main-image" + (effectivePhotoCrop(product.images[imageIndex] || product.images[0]) ? " has-saved-framing" : "")}>
                      <div className="pub-detail-photo-frame">
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
                      </div>
                      {!previewProduct && Boolean((product.images[imageIndex] || product.images[0])?.url) && (
                        <button type="button" className="pub-photo-zoom-trigger"
                          aria-label={`Zoom in on ${product.name} photo`} onClick={() => setPhotoZoomOpen(true)}>
                          <span><ZoomIn size={19} aria-hidden="true" /></span>
                        </button>
                      )}
                      {product.bestSelling ? (
                        <span className="pub-featured-tag catalog-best-public-tag"><Star size={12} fill="currentColor" /> Best Seller</span>
                      ) : product.featured && (
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
                    {previewProduct && <p className="catalog-preview-kicker" title="Current edits only. Opening this preview does not save or publish changes.">PRIVATE CATALOG PREVIEW</p>}
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
                        : <ProductPrice product={product} stackedBasis />}
                    </p>
                    {previewProduct && (
                      <>
                    <a
                      className="pub-primary-button pub-enquiry-button pub-whatsapp-enquiry"
                      href={productWhatsAppUrl(product)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Enquire about ${product.name} on WhatsApp`}
                    >
                      Enquire about this piece <ArrowUpRight size={16} aria-hidden="true" />
                    </a>
                      </>
                    )}
                    {(!previewProduct ||
                      Boolean(product.materials?.trim()) || Boolean(finishingRow?.value.trim()) ||
                      [product.width, product.depth, product.height].some(value => Number.isFinite(value) && value > 0) ||
                      specificationGroups.primary.some(item => specificationHasContent(item)) ||
                      specificationGroups.sections.some(section => section.rows.some(item => specificationHasContent(item)))
                    ) && <div className="pub-specifications">
                      <h2 id="pub-specifications-heading">The details</h2>
                      <div className="pub-specifications-scroll" tabIndex={previewProduct ? undefined : 0}
                        role={previewProduct ? undefined : "region"} aria-labelledby={previewProduct ? undefined : "pub-specifications-heading"}>
                      {previewProduct ? (
                      <dl>
                        {Boolean(product.materials?.trim()) && (
                          <div>
                            <dt>Materials</dt>
                            <dd><MaterialsContent value={product.materials} /></dd>
                          </div>
                        )}
                        {finishingRow?.value.trim() && (
                          <div>
                            <dt>Finishing</dt>
                            <dd><MaterialsContent value={finishingRow.value} /></dd>
                          </div>
                        )}
                        {[product.width, product.depth, product.height].some(value => Number.isFinite(value) && value > 0) && (
                          <div>
                            <dt>Dimensions</dt>
                            <dd>{formatProductDimensions(product)}</dd>
                          </div>
                        )}
                        <div className="catalog-preview-hidden-meta">
                          <dt>Category</dt>
                          <dd>{categoryName(product.categoryId)}</dd>
                        </div>
                        {specificationGroups.primary.filter(item => specificationHasContent(item)).map((item) => (
                          <div key={item.id}>
                            <dt>{item.name}</dt>
                            <dd>{specificationDisplayValue(item)}</dd>
                          </div>
                        ))}
                      </dl>
                      ) : (
                        <>
                          <dl>
                            <div>
                              <dt>Category</dt>
                              <dd>{categoryName(product.categoryId)}</dd>
                            </div>
                          </dl>
                          {(Boolean(product.materials?.trim()) || Boolean(finishingRow?.value.trim()) ||
                            [product.width, product.depth, product.height].some(value => Number.isFinite(value) && value > 0) ||
                            specificationGroups.primary.some(specificationHasContent)) && (
                            <div className="pub-spec-section">
                              <h3>Specifications</h3>
                              <dl>
                                {Boolean(product.materials?.trim()) && (
                                  <div>
                                    <dt>Materials</dt>
                                    <dd><MaterialsContent value={product.materials} /></dd>
                                  </div>
                                )}
                                {finishingRow?.value.trim() && (
                                  <div>
                                    <dt>Finishing</dt>
                                    <dd><MaterialsContent value={finishingRow.value} /></dd>
                                  </div>
                                )}
                                {[product.width, product.depth, product.height].some(value => Number.isFinite(value) && value > 0) && (
                                  <div>
                                    <dt>Dimensions</dt>
                                    <dd>{formatProductDimensions(product)}</dd>
                                  </div>
                                )}
                                {specificationGroups.primary.filter(item => specificationHasContent(item)).map((item) => (
                                  <div key={item.id}>
                                    <dt>{item.name}</dt>
                                    <dd>{specificationDisplayValue(item)}</dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                          )}
                        </>
                      )}
                      {specificationGroups.sections.filter(section => section.rows.some(specificationHasContent)).map(section => (
                        <div className="pub-spec-section" key={section.id}>
                          <h3>{section.title.trim() || "Specifications"}</h3>
                          <dl>
                            {section.rows.filter(specificationHasContent).map(item => (
                              <div key={item.id}>
                                <dt>{item.name}</dt>
                                <dd>{specificationDisplayValue(item)}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      ))}
                      </div>
                    </div>}
                    <div className="pub-detail-promise">
                      <span className="pub-promise-symbol"><img src={publicAssetUrl("/images/brutti-wordmark.svg")} alt="Brutti" className="pub-promise-logo" /></span>
                      <p>
                        Made for the spaces you imagine.
                        <br />
                        <span>Crafted with care by Brutti.</span>
                      </p>
                      {!previewProduct && (
                        <a className="pub-primary-button pub-enquiry-button pub-whatsapp-enquiry pub-promise-enquiry"
                          href={productWhatsAppUrl(product)}
                          target="_blank" rel="noopener noreferrer"
                          aria-label={`Enquire about ${product.name} on WhatsApp`}>
                          Enquire about this piece <ArrowUpRight size={16} aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                {!previewProduct && photoZoomOpen && product.images.length > 0 && (
                  <CustomerPhotoZoom key={product.id} images={product.images} productName={product.name}
                    initialIndex={imageIndex} onClose={() => setPhotoZoomOpen(false)} />
                )}
                {!previewProduct && related.length > 0 && recommendations(false)}
              </>
            )}
          </section>
        )}
        {productId === null && <BestSellingSection products={published} categories={categories} loading={loading}
          onBrowse={() => { resetFilters(); browseCollection(); }} onBrowseBestSellers={showAllBestSellers} onView={noteViewed} />}
        {!previewProduct && productId === null && !loading && !error && related.length > 0 && recommendations(true)}
      </main>
      {!previewProduct && <footer className="pub-footer pub-footer--reference" id="pub-contact">
        <div className="pub-footer__layout">
          <div className="pub-footer__contact">
            <a href="#/catalog" className="pub-footer__brand pub-wordmark" aria-label="Brutti Catalog home">
              <img src={publicAssetUrl("/images/brutti-wordmark.svg")} alt="Brutti" className="pub-official-logo" />
            </a>
            <div className="pub-footer__intro">
              <p className="pub-footer__eyebrow">GET IN TOUCH</p>
              <h2>For enquiries, collaborations and careers.</h2>
            </div>
            <div className="pub-footer__emails">
              <a className="pub-footer__email" href={`mailto:${enquiryEmail ?? "hi@brutti.my"}`} aria-label="Email Brutti general enquiries">
                <span className="pub-footer__email-icon" aria-hidden="true"><GmailLogo /></span>
                <span className="pub-footer__email-copy"><span>GENERAL ENQUIRIES</span><strong>{enquiryEmail ?? "hi@brutti.my"}</strong></span>
                <ArrowUpRight className="pub-footer__email-arrow" size={17} aria-hidden="true" />
              </a>
              <a className="pub-footer__email" href="mailto:hr@brutti.my" aria-label="Email Brutti HR">
                <span className="pub-footer__email-icon" aria-hidden="true"><GmailLogo /></span>
                <span className="pub-footer__email-copy"><span>CAREERS & HR</span><strong>hr@brutti.my</strong></span>
                <ArrowUpRight className="pub-footer__email-arrow" size={17} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="pub-footer__connect">
            <div className="pub-footer__social" aria-label="Follow Brutti">
              <p className="pub-footer__eyebrow">FOLLOW BRUTTI</p>
              <div className="pub-footer__social-links">
                <a href="https://www.tiktok.com/@brutti.my?_r=1&_t=ZS-99FmWlcm2fQ" target="_blank" rel="noopener noreferrer" aria-label="Brutti TikTok" title="TikTok" className="pub-footer__social-link pub-footer__social-link--tiktok"><SocialBrandIcon brand="tiktok" /></a>
                <a href="https://www.instagram.com/brutti.my?igsi=ZnU3dHVqOXRnZTJk" target="_blank" rel="noopener noreferrer" aria-label="Brutti Instagram" title="Instagram" className="pub-footer__social-link pub-footer__social-link--instagram"><SocialBrandIcon brand="instagram" /></a>
                <a href="https://www.facebook.com/share/1EfVN5HMJm/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" aria-label="Brutti Facebook" title="Facebook" className="pub-footer__social-link pub-footer__social-link--facebook"><SocialBrandIcon brand="facebook" /></a>
                <a href="https://www.threads.com/@brutti.my?igshid=NTc4MTIwNjQ2YQ==" target="_blank" rel="noopener noreferrer" aria-label="Brutti Threads" title="Threads" className="pub-footer__social-link pub-footer__social-link--threads"><SocialBrandIcon brand="threads" /></a>
                <a href={`https://wa.me/${BRUTTI_WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" aria-label="Chat with Brutti on WhatsApp" title="WhatsApp" className="pub-footer__social-link pub-footer__social-link--whatsapp"><SocialBrandIcon brand="whatsapp" /></a>
              </div>
            </div>
            <div className="pub-footer__actions">
              <a href="https://brutti.my" className="pub-footer__browse">
                Back to website <ArrowUpRight size={16} aria-hidden="true"/>
              </a>
              <button type="button" className="pub-footer__backtop" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                Back to top <ArrowUp size={17} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
        <div className="pub-footer__bottom">© {new Date().getFullYear()} Brutti. Crafted in Sabah.</div>
      </footer>}
    </div>
  );
}
