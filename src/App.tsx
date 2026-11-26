import "./components/catalog-best-seller-controls.css";
import SafeImage from "./components/SafeImage";
import { photoCropStyle, catalogCardPhotoStyle } from "./lib/photo-crop";
import { formatProductPrice } from "./lib/price";
import { publicAssetUrl } from "./lib/assets";
import { categoryCover } from "./lib/category-covers";
import { curatedCategoryCover } from "./lib/curated-category-covers";
import { resolveAppRoute } from "./lib/routes";
import { useState, useEffect, useCallback, useRef, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard,
  Package,
  Images,
  Layers,
  ArrowUpRight,
  Plus,
  Search,
  Grid2X2,
  Store,
  List,
  MoreHorizontal,
  Pencil,
  Copy,
  Archive,
  Trash2,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Menu,
  X,
  LogOut,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Bell,
  ChevronDown,
  UsersRound,
  History,
  Star,
  FileDown,
} from "lucide-react";
import type { Product, Category, CatalogData } from "./lib/types";
import {
  loadCatalog,
  subscribeCatalog,
  saveProduct,
  setProductBestSelling,
  type ProductModelChange,
  deleteProduct,
  saveCategory,
  deleteCategoryWithProducts,
  signIn,
  signOut,
  getAuthState,
  subscribeAuth,
  initialPasswordIntent,
  hasPasswordCallbackSession,
  completePassword,
  requestPasswordReset,
} from "./lib/catalog";
import ProductEditor from "./components/ProductEditor";
import BackgroundCutoutToast from "./components/BackgroundCutoutToast";
import BackgroundGalleryOverlay from "./components/BackgroundGalleryOverlay";
import { getBackgroundJobSnapshot } from "./lib/photo-background-jobs";
import CatalogOverviewStudio from "./components/CatalogOverviewStudio";
import PublicCatalog from "./components/PublicCatalog";
import CatalogPdfDownload, { type CatalogPdfDownloadHandle } from "./components/CatalogPdfDownload";
import Modal from "./components/Modal";
import AccountCenter from "./components/AccountCenter";
import CataloguePhotoImport from "./components/CataloguePhotoImport";
import AlbumLibrary from "./components/AlbumLibrary";
import { albumPhotoToProductImage, combineAlbumPhotos, listAlbumRecords, setAlbumPhotoCategory, type AlbumRecord } from "./lib/album";
import LastChange from "./components/LastChange";
import CategoryFilter from "./components/CategoryFilter";
import CategoryAlbumPicker from "./components/CategoryAlbumPicker";
import CategorySlideshow, { type CategorySlide } from "./components/CategorySlideshow";
import "./components/category-cover-picker.css";
import SortFilter from "./components/SortFilter";
import { getAccountSummary, initials, type StaffRole } from "./lib/account-center";
import { useAdminTheme } from "./lib/admin-theme";

type Tab = "overview" | "products" | "album" | "categories" | "profile" | "users" | "activity";
const label = (s: string) =>
  s
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
function newProduct(categoryId = ""): Product {
  return {
    id: crypto.randomUUID(),
    name: "",
    sku: "",
    categoryId,
    description: "",
    materials: "",
    width: 0,
    depth: 0,
    height: 0,
    price: null,
    status: "draft",
    availability: "available",
    featured: false,
    bestSelling: false,
    images: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function App() {
  const { theme, toggleTheme } = useAdminTheme();
  const [passwordIntent, setPasswordIntent] = useState(initialPasswordIntent);
  const [callbackVerified, setCallbackVerified] = useState(false);
  const [route, setRoute] = useState(() => resolveAppRoute(window.location));
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<CatalogData>({
    products: [],
    categories: [],
  });
  const [loading, setLoading] = useState(true);
  const [, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [auth, setAuth] = useState({
    authenticated: false,
    isAdmin: false,
    email: "",
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [accountRole, setAccountRole] = useState<StaffRole | null>(null);
  const [accountName, setAccountName] = useState("");
  const [accountsReady, setAccountsReady] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("recent");
  const [productView, setProductView] = useState<"table" | "gallery">(() => {
    try { return window.localStorage.getItem("brutti-catalog-product-view") === "gallery" ? "gallery" : "table"; }
    catch { return "table"; }
  });
  const changeProductView = (next: "table" | "gallery") => {
    setProductView(next);
    try { window.localStorage.setItem("brutti-catalog-product-view", next); }
    catch { /* Keep the selected view in this session. */ }
  };
  const [editor, setEditor] = useState<Product | null>(null);
  const [photoOpenRequest, setPhotoOpenRequest] = useState<{
    productId: string; imageId: string; requestId: number;
  } | null>(null);
  const [photoImportOpen, setPhotoImportOpen] = useState(false);
  const [catEditor, setCatEditor] = useState<Category | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [productDeleteError, setProductDeleteError] = useState("");
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [categoryDeleteInput, setCategoryDeleteInput] = useState("");
  const [categoryDeleteError, setCategoryDeleteError] = useState("");
  const [catName, setCatName] = useState("");
  const [categoryAlbumSelection, setCategoryAlbumSelection] = useState<string[]>([]);
  const [albumRevision, setAlbumRevision] = useState(0);
  const [categoryAlbumRecords, setCategoryAlbumRecords] = useState<AlbumRecord[]>([]);
  useEffect(()=>{
    if(tab!=="categories" || !auth.isAdmin || route.startsWith("#/catalog") || route.startsWith("#/product/")) {
      setCategoryAlbumRecords([]);
      return;
    }
    let active=true;
    listAlbumRecords().then(records=>{if(active)setCategoryAlbumRecords(records);})
      .catch(error=>{if(active){setCategoryAlbumRecords([]);console.warn("Category Album slides unavailable",error);}});
    return()=>{active=false;};
  },[tab,auth.isAdmin,route,albumRevision]);
  const [actionError, setActionError] = useState("");
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const staffPdfRef = useRef<CatalogPdfDownloadHandle>(null);
  // Open the full sidebar by default so names and live counts stay visible.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [railTooltip, setRailTooltip] = useState<{ label: string; left: number; top: number } | null>(null);
  const showRailTooltip = (target: EventTarget | null, rail: HTMLElement) => {
    if (!sidebarCollapsed || !window.matchMedia("(min-width: 801px)").matches || !(target instanceof Element)) return;
    const item = target.closest<HTMLElement>("[data-rail-label]");
    if (!item || !rail.contains(item) || !item.dataset.railLabel) return;
    const bounds = item.getBoundingClientRect();
    setRailTooltip({
      label: item.dataset.railLabel,
      left: rail.getBoundingClientRect().right + 9,
      top: Math.max(20, Math.min(window.innerHeight - 20, bounds.top + bounds.height / 2)),
    });
  };
  useEffect(() => {
    setRailTooltip(null);
    if (!sidebarCollapsed) return;
    const hide = () => setRailTooltip(null);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") hide(); };
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, true);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", hide);
      window.removeEventListener("scroll", hide, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [sidebarCollapsed, tab, route]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  // Read receipts are local to this browser and scoped to the signed-in account.
  const notificationReadKey = auth.isAdmin && auth.email
    ? "brutti-catalog-notification-read:" + auth.email.trim().toLowerCase() : "";
  const [notificationReceipts, setNotificationReceipts] = useState<{ key: string; seen: Record<string, string> }>({ key: "", seen: {} });
  useEffect(() => {
    let seen: Record<string, string> = {};
    if (notificationReadKey) {
      try {
        const raw = JSON.parse(window.localStorage.getItem(notificationReadKey) || "{}");
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          seen = Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
        }
      } catch { /* Use an empty receipt list if storage is unavailable. */ }
    }
    setNotificationReceipts({ key: notificationReadKey, seen });
  }, [notificationReadKey]);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const headerSearchRef = useRef<HTMLInputElement>(null);
  const toggleSidebar = () => {
    if (window.matchMedia("(max-width: 800px)").matches) {
      setMobileNav(false);
      return;
    }
    setSidebarCollapsed(value => !value);
  };
  const [busy, setBusy] = useState(false);
  const catalogRequest = useRef(0);
  const catalogInFlight = useRef(false);
  const authRequest = useRef(0);
  const authInFlight = useRef<Promise<void> | null>(null);
  const refresh = useCallback(async (background = false) => {
    if (background && catalogInFlight.current) return;
    const request = ++catalogRequest.current;
    catalogInFlight.current = true;
    if (!background) setLoading(true);
    if (background) setSyncing(true);
    setError(null);
    try {
      const next = await loadCatalog();
      if (request === catalogRequest.current) {
        setData(next);
        setLastSyncedAt(Date.now());
      }
    } catch (e) {
      if (request === catalogRequest.current)
        setError(e instanceof Error ? e.message : "Unable to load the catalog.");
    } finally {
      if (request === catalogRequest.current) {
        catalogInFlight.current = false;
        setLoading(false);
        setSyncing(false);
      }
    }
  }, []);
  const refreshAuth = useCallback((force = false): Promise<void> => {
    if (!force && authInFlight.current) return authInFlight.current;
    const request = ++authRequest.current;
    const run = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const a = await getAuthState();
      const callback = initialPasswordIntent ? a.authenticated && await hasPasswordCallbackSession() : false;
      if (request !== authRequest.current) return;
      setAuth({ ...a, email: a.email || "" });
      setCallbackVerified(callback);
      if (!a.isAdmin) setData(current => ({ ...current, products: current.products.filter(product => product.status === 'published') }));
    } catch (e) {
      if (request !== authRequest.current) return;
      setAuth({ authenticated: false, isAdmin: false, email: "" });
      setCallbackVerified(false);
      setData(current => ({ ...current, products: current.products.filter(product => product.status === 'published') }));
      setAuthError(e instanceof Error ? e.message : "Unable to verify access.");
    } finally {
      if (request === authRequest.current) setAuthLoading(false);
    }
    };
    const task = run();
    authInFlight.current = task;
    void task.finally(() => { if (authInFlight.current === task) authInFlight.current = null; });
    return task;
  }, []);
  useEffect(() => () => {
    ++catalogRequest.current;
    ++authRequest.current;
    authInFlight.current = null;
  }, []);
  useEffect(() => {
    const fn = () => setRoute(resolveAppRoute(window.location));
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => {
    void refreshAuth();
    const unsub = subscribeAuth(event => {
      // Supabase can re-emit SIGNED_IN when tabs gain focus. Explicit login
      // verifies the session below; do not restart the verification spinner.
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") return;
      void refreshAuth(true);
    });
    return unsub;
  }, [refreshAuth]);
  const publicRoute =
    route.startsWith("#/catalog") || route.startsWith("#/product/");
  const canReadCatalog = !authLoading && (auth.isAdmin || publicRoute) && !passwordIntent;
  useEffect(() => {
    if (!canReadCatalog) return;
    void refresh();
    return subscribeCatalog(() => refresh(true));
  }, [canReadCatalog, refresh]);
  useEffect(() => {
    let active = true;
    if (!auth.isAdmin) {
      setAccountRole(null);
      setAccountsReady(false);
      setAccountName("");
      return;
    }
    void getAccountSummary().then(info => {
      if (!active) return;
      setAccountRole(info.role);
      setAccountsReady(info.managementReady);
      setAccountName(info.displayName);
    }).catch(() => {
      if (active) {
        setAccountRole(null);
        setAccountsReady(false);
      }
    });
    return () => { active = false; };
  }, [auth.isAdmin, auth.email]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), toast.startsWith("Upload completed") ? 7000 : 4000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationOpen(false);
        setAccountMenuOpen(false);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        if (document.activeElement?.tagName !== "INPUT" || document.activeElement !== headerSearchRef.current) {
          event.preventDefault();
          headerSearchRef.current?.focus();
        }
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest(".catalog-header-popover-anchor")) {
        setNotificationOpen(false);
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);
  const navigate = (dest: string) => {
    window.location.hash = dest;
    setMobileNav(false);
  };
  const switchTab = (next: Tab) => {
    setTab(next);
    setMobileNav(false);
    setSearch("");
    setStatus("all");
    setCategory("all");
    setMenu(null);
    setNotificationOpen(false);
    setAccountMenuOpen(false);
    window.scrollTo(0, 0);
  };
  async function persist(p: Product, modelChange?: ProductModelChange, autoProductId = false) {
    const saved = await saveProduct(p, modelChange, autoProductId);
    await refresh();
    setToast(saved.cleanupWarning || `${saved.name} saved · ${saved.sku}`);
    return saved;
  }
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setActionError("");
    try {
      const result = await fn();
      await refresh();
      setToast(result && typeof result === 'object' && 'cleanupWarning' in result && typeof result.cleanupWarning === 'string'
        ? result.cleanupWarning : message);
    } catch (e) {
      setActionError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
      setMenu(null);
    }
  }
  function toggleBestSeller(p: Product) {
    const selected = p.bestSelling !== true;
    void action(() => setProductBestSelling(p.id, selected),
      selected ? "Added to Best Sellers" : "Removed from Best Sellers");
  }
  async function confirmProductDeletion() {
    const product = productToDelete;
    if (!product || busy) return;
    setBusy(true);
    setProductDeleteError("");
    try {
      const result = await deleteProduct(product.id);
      await refresh();
      setProductToDelete(null);
      if (editor?.id === product.id) {
        setEditor(null);
        setPhotoOpenRequest(null);
      }
      setToast(result.cleanupWarning || `${product.name} deleted successfully.`);
    } catch (error) {
      setProductDeleteError(error instanceof Error ? error.message : "Unable to delete product. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function requestCategoryDeletion(category: Category) {
    setCategoryToDelete(category);
    setCategoryDeleteInput("");
    setCategoryDeleteError("");
  }
  const categoryDeleteCount = categoryToDelete
    ? data.products.filter(product => product.categoryId === categoryToDelete.id).length
    : 0;
  async function confirmCategoryDeletion() {
    const category = categoryToDelete;
    if (!category || busy) return;
    const count = data.products.filter(product => product.categoryId === category.id).length;
    if (count > 0 && categoryDeleteInput.trim() !== category.name) return;
    setBusy(true);
    setCategoryDeleteError("");
    try {
      const result = await deleteCategoryWithProducts(category.id, category.name, count);
      await refresh();
      setCategoryToDelete(null);
      setCategoryDeleteInput("");
      setToast(result.cleanupWarning ||
        `Category deleted${count ? ` with ${count} product${count === 1 ? "" : "s"}` : ""}`);
    } catch (error) {
      setCategoryDeleteError(error instanceof Error ? error.message : "Unable to delete category. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function editCategory(c: Category) {
    setCatEditor(c);
    setCatName(c.name);
    setCategoryAlbumSelection([]);
    setActionError("");
  }
  async function submitCategory(e: FormEvent) {
    e.preventDefault();
    if (!catEditor) return;
    setBusy(true);
    setActionError("");
    try {
      // Recheck Album eligibility before writing: never move an already assigned photo.
      const selectedIds = [...categoryAlbumSelection];
      if (selectedIds.length) {
        const available = combineAlbumPhotos(await listAlbumRecords(), data.products, data.categories);
        if (selectedIds.some(id => !available.some(photo=>photo.id===id && !photo.manualCategoryId && !photo.usedBy.length && !photo.categoryCovers.length))) {
          throw new Error("Some selected photos are no longer unassigned. Refresh your selection and try again.");
        }
      }
      // Preserve existing description and public cover metadata; this form
      // edits the category name and assigns Album photos only.
      const saved = await saveCategory({...catEditor,name:catName.trim()});
      setCatEditor(saved);
      const failed: string[] = [];
      let assignedCount = 0;
      for (const id of selectedIds) {
        try {
          const assigned = await setAlbumPhotoCategory(id,saved.id);
          if (assigned !== saved.id) throw new Error("Photo assignment was not confirmed.");
          assignedCount++;
          setCategoryAlbumSelection(current=>current.filter(item=>item!==id));
        } catch (err) {
          failed.push(err instanceof Error?err.message:"Could not assign photo.");
        }
      }
      setAlbumRevision(value=>value+1);
      await refresh();
      if (failed.length) {
        setActionError(`Category saved. ${assignedCount} photos assigned; ${failed.length} failed. ${failed[0]} Retry to assign the remaining photos.`);
        return;
      }
      setCatEditor(null);
      setToast(selectedIds.length ? `Category saved · ${assignedCount} photo${assignedCount===1?"":"s"} added` : "Category saved");
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Unable to save category.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (publicRoute && !passwordIntent)
    return (
      <>
        <PublicCatalog
          products={data.products}
          categories={data.categories}
          loading={loading}
          error={error}
          onRetry={() => void refresh()}
          onAdmin={() => navigate("/admin")}
        />
        {toast && (
          <div className="toast" role="status">
            <CheckCircle2 size={17} />
            {toast}
          </div>
        )}
      </>
    );
  if (authLoading)
    return (
      <div className="admin-app admin-access-shell" data-theme={theme}>
      <div className="access-page">
        <LoaderCircle className="spin" style={{ color: "#fff" }} />
        <p style={{ color: "#fff" }}>Preparing your workspace…</p>
      </div>
      </div>
    );
  if (passwordIntent)
    return <div className="admin-app admin-access-shell" data-theme={theme}><PasswordAccess intent={passwordIntent} verified={callbackVerified} onDone={async () => {
      setPasswordIntent(null);
      const clean = new URL(window.location.href);
      clean.searchParams.delete("auth");
      clean.hash = "/admin";
      window.history.replaceState(null, "", clean);
      setRoute("#/admin");
      await refreshAuth();
    }} /></div>;
  if (!auth.isAdmin)
    return (
      <div className="admin-app admin-access-shell" data-theme={theme}>
      <Login
        setupError={authError || actionError}
        authenticated={auth.authenticated}
        onSuccess={async () => { await refreshAuth(true); }}
        onCatalog={() => navigate("/catalog")}
      />
      </div>
    );
  const publishedCount = data.products.filter((p) => p.status === "published").length;
  const draftCount = data.products.filter((p) => p.status === "draft").length;
  const archivedCount = data.products.filter((p) => p.status === "archived").length;
  const withPhotos = data.products.filter((p) => p.images.length > 0).length;
  // Keep the established overview photograph fixed. Adding or renaming a
  // catalogue product must not unexpectedly change the dashboard banner.
  const heroProduct = data.products.find(product =>
    product.id === "98cc7854-10c5-43a3-b4ab-71b1e886754b" && product.images.length > 0
  );
  const filtered = data.products
    .filter((p) => {
      const needle = search.toLowerCase();
      return (
        `${p.name} ${p.sku} ${p.materials}`.toLowerCase().includes(needle) &&
        (status === "all" || p.status === status) &&
        (category === "all" || p.categoryId === category)
      );
    })
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "price"
          ? (a.price ?? Infinity) - (b.price ?? Infinity)
          : sort === "display-order"
            ? (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  const recentUpdates = [...data.products]
    .filter(product => product.updatedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  const receiptsReady = !!notificationReadKey && notificationReceipts.key === notificationReadKey;
  const isUnreadUpdate = (product: Product) => receiptsReady && notificationReceipts.seen[product.id] !== product.updatedAt;
  const unreadNotificationCount = recentUpdates.filter(isUnreadUpdate).length;
  const markUpdatesRead = (products: Product[]) => {
    if (!receiptsReady) return;
    const seen = { ...notificationReceipts.seen };
    for (const product of products) seen[product.id] = product.updatedAt;
    setNotificationReceipts({ key: notificationReadKey, seen });
    try { window.localStorage.setItem(notificationReadKey, JSON.stringify(seen)); }
    catch { /* Receipts still work for this session. */ }
  };
  return (
    <div className={"admin-app brutti-staff-redesign catalog-os-layout" + (sidebarCollapsed ? " catalog-sidebar-collapsed" : "")} data-theme={theme} data-active-tab={tab}>
      <aside className={"sidebar" + (mobileNav ? " sidebar-open" : "")}
        onPointerOver={event => { if (event.pointerType === "mouse" || event.pointerType === "pen") showRailTooltip(event.target, event.currentTarget); }}
        onPointerOut={event => {
          const item = event.target instanceof Element ? event.target.closest("[data-rail-label]") : null;
          if (item && (!(event.relatedTarget instanceof Node) || !item.contains(event.relatedTarget))) setRailTooltip(null);
        }}
        onPointerLeave={() => setRailTooltip(null)}
        onFocus={event => { if (event.target.matches(":focus-visible")) showRailTooltip(event.target, event.currentTarget); }}
        onBlur={() => setRailTooltip(null)}
        onClickCapture={() => setRailTooltip(null)}>
        <div className="catalog-sidebar-head">
          <a href="#/admin" className="catalog-sidebar-identity" onClick={() => switchTab("overview")} aria-label="Brutti Catalog overview">
            <span className="catalog-sidebar-logo">
              <img src={publicAssetUrl("/images/brutti-wordmark.svg")} alt="" />
            </span>
            <span className="catalog-sidebar-title"><strong>Brutti Catalog</strong><small>COLLECTION STUDIO</small></span>
          </a>
          <button type="button" className="catalog-sidebar-toggle" onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            data-rail-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? undefined : "Collapse sidebar"}>
            <Menu size={19} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Admin navigation">
          <span className="nav-group-label">WORKSPACE</span>
          {(
            [
              { id: "overview", text: "Overview", icon: LayoutDashboard },
              { id: "categories", text: "Categories", icon: Layers },
              { id: "products", text: "Products", icon: Package },
              { id: "album", text: "Album", icon: Images },
            ] as const
          ).filter((n) => accountRole !== "editor" || n.id !== "categories").map((n) => (
            <button
              key={n.id}
              className={`nav-item ${tab === n.id ? "active" : ""}`}
              aria-current={tab === n.id ? "page" : undefined}
              data-rail-label={n.text}
              title={sidebarCollapsed ? undefined : n.text}
              onClick={() => switchTab(n.id)}
            >
              <span className="nav-icon" aria-hidden="true"><n.icon size={19} strokeWidth={1.9} /></span>
              {n.text}
              {(n.id === "products" || n.id === "categories") && (
                <span className="nav-count">
                  {n.id === "categories" ? data.categories.length : data.products.length}
                </span>
              )}
            </button>
          ))}
          {auth.isAdmin && (
            <span className="nav-group-label nav-group-second">HISTORY & ACCESS</span>
          )}
          {auth.isAdmin && (
            <button className={`nav-item ${tab === "activity" ? "active" : ""}`}
              aria-current={tab === "activity" ? "page" : undefined}
              data-rail-label="Activity log"
              title={sidebarCollapsed ? undefined : "Activity log"}
              onClick={() => switchTab("activity")}>
              <span className="nav-icon" aria-hidden="true"><History size={19} strokeWidth={1.9} /></span> Activity log
            </button>
          )}
          {auth.isAdmin && accountsReady && (accountRole === "super_admin" || accountRole === "admin") && (
            <button className={`nav-item ${tab === "users" ? "active" : ""}`}
              aria-current={tab === "users" ? "page" : undefined}
              data-rail-label="Account Permission"
              title={sidebarCollapsed ? undefined : "Account Permission"}
              onClick={() => switchTab("users")}>
              <span className="nav-icon" aria-hidden="true"><ShieldCheck size={19} strokeWidth={1.9} /></span> Account Permission
            </button>
          )}
          <button type="button" className="nav-item"
            data-rail-label="Download Catalogue"
            title={sidebarCollapsed ? undefined : "Download Catalogue"}
            aria-haspopup="dialog"
            disabled={loading || publishedCount === 0}
            onClick={() => {
              setMobileNav(false);
              setRailTooltip(null);
              staffPdfRef.current?.open();
            }}>
            <span className="nav-icon" aria-hidden="true"><FileDown size={19} strokeWidth={1.9} /></span> Download Catalogue
          </button>
        </nav>
        <div className="brutti-background-sidebar-host" id="brutti-background-sidebar-host"
          aria-label="Photo background removal progress"/>
        <div className="sidebar-utility">
          <button type="button" className="sidebar-public-link catalog-photo-link"
            onClick={() => navigate("/catalog")} aria-label="View public catalog" data-rail-label="View public catalog" title={sidebarCollapsed ? undefined : "View public catalog"}>
            <SafeImage
              className="catalog-sidebar-product-photo"
              src="/reference/sofa.jpg"
              alt="" loading="lazy" aria-hidden="true"
            />
            <span className="sidebar-public-icon" aria-hidden="true"><Store size={19} strokeWidth={1.9} /></span>
            <span className="sidebar-public-copy">
              <strong>View public catalog</strong>
              <small className={`sidebar-public-sync ${error ? "sync-error" : !lastSyncedAt ? "sync-pending" : "sync-success"}`}
                role="status" aria-live="polite">
                <span className="sidebar-sync-dot" aria-hidden="true" />
                {error ? "Sync needs attention" : lastSyncedAt ? "Catalog synced" : "Checking catalog..."}
              </small>
            </span>
            <span className="catalog-sidebar-brand" aria-hidden="true">
              <img src={publicAssetUrl("/images/brutti-wordmark.svg")} alt="" />
            </span>
            <ArrowUpRight size={15} className="sidebar-public-arrow" aria-hidden="true" />
          </button>
        </div>
      </aside>
      {sidebarCollapsed && railTooltip && createPortal(
        <div aria-hidden="true" className="catalog-rail-tooltip" style={{
          position: "fixed", zIndex: 10000, left: railTooltip.left, top: railTooltip.top,
          transform: "translateY(-50%)", pointerEvents: "none",
          whiteSpace: "nowrap", padding: "8px 12px", borderRadius: 9,
          background: theme === "dark" ? "rgba(43,65,54,.96)" : "rgba(32,79,56,.94)",
          color: "#fff", font: '600 12px/1.4 Inter, "DM Sans", system-ui, sans-serif',
          boxShadow: "0 5px 16px rgba(16,44,29,.18)", backdropFilter: "blur(12px)",
        }}>{railTooltip.label}</div>, document.body)}
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <main className="admin-main">
        <header className="topbar catalog-os-topbar">
          <div className="topbar-actions">
            <button type="button" className="catalog-mobile-menu" aria-label="Open navigation"
              aria-expanded={mobileNav} onClick={() => setMobileNav(true)}>
              <Menu size={21} aria-hidden="true" />
            </button>
            <form className="catalog-header-search" role="search" onSubmit={(event) => {
              event.preventDefault();
              const term = search;
              switchTab("products");
              setSearch(term);
              headerSearchRef.current?.blur();
            }}>
              <Search size={18} aria-hidden="true" />
              <input ref={headerSearchRef} aria-label="Search catalog products" placeholder="Search all Brutti Catalog..."
                value={search} onChange={(event) => setSearch(event.target.value)} />
              <span className="catalog-search-shortcut" aria-hidden="true">Ctrl K</span>
              <button type="submit" className="catalog-search-submit" aria-label="Search products"><ArrowRight size={15} /></button>
            </form>
            <div className="brutti-background-task-mobile-host" id="brutti-background-task-mobile-host"
              aria-label="Photo background removal progress on mobile"/>
            <button type="button" className="theme-toggle" onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-pressed={theme === "dark"} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
              {theme === "dark" ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
            </button>
            <div className="catalog-header-popover-anchor">
              <button type="button" className={"catalog-header-icon-button" + (notificationOpen ? " is-open" : "")}
                aria-label={unreadNotificationCount ? `Recent catalog activity, ${unreadNotificationCount} unread` : "Recent catalog activity"} aria-expanded={notificationOpen} aria-haspopup="dialog"
                title="Catalog activity" onClick={() => { setNotificationOpen(open => !open); setAccountMenuOpen(false); }}>
                <Bell size={19} aria-hidden="true" />
                {unreadNotificationCount > 0 ? <span className="catalog-bell-count" aria-hidden="true">{unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}</span> : error ? <span className="catalog-bell-alert" aria-label="Sync needs attention" /> : null}
              </button>
              {notificationOpen && (
                <section className="catalog-header-popover catalog-notification-menu" role="dialog" aria-label="Recent catalog activity">
                  <div className="catalog-notification-heading">
                    <span className="catalog-notification-heading-icon"><Bell size={18} aria-hidden="true" /></span>
                    <div className="catalog-notification-heading-copy"><strong>Notifications</strong><small>Recent catalog updates</small></div>
                    {unreadNotificationCount > 0 && <span className="catalog-notification-unread-total">{unreadNotificationCount} unread</span>}
                  </div>
                  {unreadNotificationCount > 0 && <div className="catalog-notification-toolbar">
                    <span>Recent activity</span>
                    <button type="button" className="catalog-notification-mark-read" onClick={() => markUpdatesRead(recentUpdates)}><CheckCircle2 size={13} aria-hidden="true" /> Mark all as read</button>
                  </div>}
                  {error && <p className="catalog-sync-warning">Sync needs attention. Check your connection and retry.</p>}
                  <div className="catalog-notification-list">
                    {recentUpdates.length ? recentUpdates.map(product => {
                      const unread = isUnreadUpdate(product);
                      return <button type="button" className={"catalog-notification-item" + (unread ? " is-unread" : "")} key={product.id}
                        aria-label={(product.name || "Untitled product") + (unread ? ", unread update" : ", read update")}
                        onClick={() => { markUpdatesRead([product]); switchTab("products"); setSearch(product.name); }}>
                        <span className="catalog-notification-photo" aria-hidden="true">
                          {product.images[0]?.url ? <SafeImage src={product.images[0].url} alt="" loading="lazy" /> : <Package size={19} />}
                        </span>
                        <span className="catalog-notification-copy"><strong>{product.name || "Untitled product"}</strong>
                          <small>Updated {new Date(product.updatedAt).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" })}</small>
                        </span>
                        <span className={"catalog-notification-dot" + (unread ? "" : " is-read")} aria-hidden="true" />
                      </button>;
                    }) : <div className="catalog-empty-updates"><Bell size={25} aria-hidden="true" /><strong>No recent updates</strong><span>Product updates will appear here.</span></div>}
                  </div>
                  <button type="button" className="catalog-popover-footer" onClick={() => switchTab("activity")}><History size={15} aria-hidden="true" /> View activity log <ArrowRight size={15} aria-hidden="true" /></button>
                </section>
              )}
            </div>
            <div className="catalog-header-popover-anchor">
              <button type="button" className={"header-profile" + (accountMenuOpen ? " active" : "")}
                aria-label="Open account menu" aria-expanded={accountMenuOpen} aria-haspopup="menu"
                title="My account" onClick={() => { setAccountMenuOpen(open => !open); setNotificationOpen(false); }}>
                <span className="profile-avatar" aria-hidden="true">{initials(accountName || auth.email.split("@")[0] || "BB")}</span>
                <span className="profile-copy"><strong>{accountName || auth.email.split("@")[0] || "Account"}</strong></span>
                <ChevronDown className="catalog-account-chevron" size={16} aria-hidden="true" />
              </button>
              {accountMenuOpen && (
                <div className="catalog-header-popover catalog-account-menu" role="menu" aria-label="Account">
                  <div className="catalog-account-menu-heading">
                    <strong>{accountName || auth.email.split("@")[0] || "Account"}</strong>
                    <small>{auth.email}</small>
                  </div>
                  <button type="button" role="menuitem" onClick={() => switchTab("profile")}>
                    <UsersRound size={17} aria-hidden="true" /> My profile
                  </button>
                  <button type="button" role="menuitem" onClick={() => {
                    setAccountMenuOpen(false);
                    void signOut().catch((e) => setActionError(e instanceof Error ? e.message : "Sign out failed."));
                  }}>
                    <LogOut size={17} aria-hidden="true" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="admin-content">
          {tab === "profile" || tab === "users" || tab === "activity" ? (
            <AccountCenter view={tab} onProfileChanged={setAccountName} />
          ) : (<>
          {tab === "overview" ? (
            <section className="catalog-command brutti-editorial-hero" aria-labelledby="catalog-overview-title">
              <div className="catalog-command-content">
                <div className="catalog-command-eyebrow">BRUTTI'S COLLECTION</div>
                <h1 id="catalog-overview-title">Catalog overview</h1>
                <p>A considered home for every piece, from workshop photography to the final published collection.</p>
                <div className="catalog-command-actions">
                  <button type="button" className="catalog-hero-primary" disabled={loading || busy}
                    onClick={() => setEditor(newProduct(data.categories[0]?.id))}>
                    <Plus size={17} aria-hidden="true" /> Add product
                  </button>
                  <button type="button" className="catalog-hero-secondary"
                    onClick={() => { switchTab("products"); setStatus(draftCount > 0 ? "draft" : "all"); }}>
                    {draftCount > 0 ? "Review drafts" : "View products"} <ArrowUpRight size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className="catalog-hero-tertiary" onClick={() => { switchTab("products"); changeProductView("gallery"); }}>
                    Open gallery <Images size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="catalog-command-meta" aria-label="Current catalog totals">
                  <span><strong>{loading ? "—" : data.products.length}</strong> Products</span>
                  <span><strong>{loading ? "—" : data.categories.length}</strong> Categories</span>
                  <span><strong>{loading ? "—" : draftCount}</strong> In review</span>
                </div>
              </div>
              <div className="catalog-command-art" aria-label={heroProduct ? `Catalog photo: ${heroProduct.name}` : "Brutti kiosk design reference"}>
                {heroProduct ? (
                  <SafeImage src={heroProduct.images[0]?.url} alt={heroProduct.images[0]?.alt || heroProduct.name} style={photoCropStyle(heroProduct.images[0])} loading="lazy" />
                ) : (
                  <img src={import.meta.env.BASE_URL + "reference/kiosk.jpg"} alt="Benua Brutti kiosk showroom design reference" loading="lazy" />
                )}
                <span className="catalog-command-art-label">{heroProduct ? heroProduct.name : "BRUTTI / SHOWROOM INSPIRATION"}</span>
                <span className="brutti-editorial-photo-index" aria-hidden="true">B / B · EST. SABAH</span>
              </div>
            </section>
          ) : tab === "products" ? (
            <section className="catalog-product-hero" aria-labelledby="catalog-products-title">
              <div className="catalog-product-hero-main">
                <span className="catalog-product-hero-eyebrow">Inventory</span>
                <h1 id="catalog-products-title">Products</h1>
                <p>Organise, review and manage your collection from one workspace.</p>
                <div className="catalog-product-hero-meta">
                  <span><Package size={14} aria-hidden="true" /> {data.products.length} products</span>
                  <span><Images size={14} aria-hidden="true" /> {withPhotos} with photos</span>
                  <span><Layers size={14} aria-hidden="true" /> {data.categories.length} categories</span>
                </div>
              </div>
              <div className="catalog-product-hero-side">
                <div className="catalog-product-hero-status">
                  <span>Drafts to review</span>
                  <div><strong>{draftCount}</strong><span>Draft products</span></div>
                </div>
                <div className="catalog-product-hero-actions">
                  <button className="catalog-products-add-button" type="button" disabled={loading || busy}
                    onClick={() => setEditor(newProduct(data.categories[0]?.id))}>
                    <Plus size={17} aria-hidden="true" /> Add product
                  </button>
                  <button type="button" className="catalog-products-bulk-import-button"
                    aria-label="Bulk import photos"
                    disabled={loading || busy}
                    onClick={() => setPhotoImportOpen(true)}>
                    <Images size={17} aria-hidden="true" /> Bulk import photos
                  </button>
                </div>
              </div>
            </section>
          ) : tab === "categories" ? (
            <section className="page-heading catalog-management-heading" aria-labelledby="catalog-categories-heading">
              <div className="catalog-categories-heading-copy">
                <span className="eyebrow">BRUTTI CATALOG WORKSPACE</span>
                <h1 id="catalog-categories-heading">Categories</h1>
                <p>Manage how customers discover your collections.</p>
              </div>
              <div className="catalog-categories-heading-actions">
                <div className="catalog-categories-total" aria-live="polite" aria-label={`Total categories: ${loading ? "loading" : data.categories.length}`}>
                  <span className="catalog-categories-total-icon" aria-hidden="true">
                    <Layers size={19} strokeWidth={1.8} />
                  </span>
                  <div className="catalog-categories-total-detail">
                    <strong>{loading ? "—" : data.categories.length}</strong>
                    <span>Total categories</span>
                  </div>
                </div>
                <button type="button" className="button primary" disabled={loading || busy}
                  onClick={() => editCategory({ id: crypto.randomUUID(), name: "", description: "" })}>
                  <Plus size={17} aria-hidden="true" /> Add category
                </button>
              </div>
            </section>
          ) : null}
          {(error || actionError) && !catEditor && (
            <div className="notice error" role="alert">
              <AlertCircle size={18} />
              <span>{error || actionError}</span>
              {error && (
                <button onClick={() => void refresh()}>Try again</button>
              )}
            </div>
          )}
          {tab === "album" && (
            <AlbumLibrary key={albumRevision} products={data.products} categories={data.categories}
              onDeleteProduct={(id) => {
                if (busy) return;
                const product = data.products.find(item => item.id === id);
                if (product) { setProductDeleteError(""); setProductToDelete(product); }
              }}
              onAddCategory={accountRole !== "editor"
                ? () => editCategory({ id: crypto.randomUUID(), name: "", description: "" })
                : undefined}
              onEditProduct={(id) => {
                const product = data.products.find(item => item.id === id);
                if (product) setEditor(product);
              }}
              onCreateProductFromPhoto={(photo, details) => {
                const draft = newProduct(details.categoryId || "");
                setEditor({
                  ...draft,
                  name: details.name.trim(),
                  description: details.description,
                  materials: details.materials,
                  specifications: [
                    ...(details.size.trim() ? [{ id: crypto.randomUUID(), name: "Dimensions", value: details.size.trim() }] : []),
                    ...(details.colour.trim() ? [{ id: crypto.randomUUID(), name: "Colour", value: details.colour.trim() }] : []),
                    ...(details.finishing.trim() ? [{ id: crypto.randomUUID(), name: "Finishing", value: details.finishing.trim() }] : []),
                  ],
                  images: [albumPhotoToProductImage({ ...photo, name: details.name.trim() })],
                });
              }}
              onAttachPhotoToProduct={(productId, photo) => {
                const product = data.products.find(item => item.id === productId);
                if (!product) {
                  setToast("That product could not be found. Refresh and try again.");
                  return;
                }
                const alreadyAttached = product.images.some(image =>
                  image.url === photo.url || (!!photo.storagePath && image.storagePath === photo.storagePath));
                setEditor(alreadyAttached ? product : {
                  ...product,
                  images: [...product.images, albumPhotoToProductImage(photo)],
                });
                if (alreadyAttached) setToast("Photo already belongs to this product.");
              }} />
          )}
          {tab === "overview" && (
            <>
              <CatalogOverviewStudio
                products={data.products}
                categories={data.categories}
                loading={loading}
                asOfMs={lastSyncedAt ?? 0}
                canManageCategories={accountRole !== "editor"}
                enabled={auth.isAdmin}
                onOpenProducts={next => { switchTab("products"); setStatus(next); }}
                onOpenCategory={id => { switchTab("products"); setCategory(id); }}
                onManageCategories={() => switchTab(accountRole === "editor" ? "products" : "categories")}
              />
              <div className="brutti-overview-audit">
                <LastChange
                  authenticated={auth.isAdmin}
                  refreshKey={data}
                  onHistory={() => switchTab("activity")}
                />
              </div>
            </>
          )}
          {tab === "products" ? (
            <section className="table-panel catalog-collection-v3 catalog-products-panel">
              {tab === "products" && (
                <div className="catalog-product-controls">
                  <div className="catalog-status-tabs" role="group" aria-label="Quick product status filters">
                    {[
                      { id: "all", title: "All", total: data.products.length },
                      { id: "draft", title: "Draft", total: draftCount },
                      { id: "published", title: "Published", total: publishedCount },
                      { id: "archived", title: "Archived", total: archivedCount },
                    ].map(item => (
                      <button type="button" key={item.id}
                        className={`catalog-status-tab ${status === item.id ? "selected" : ""}`}
                        aria-pressed={status === item.id} onClick={() => setStatus(item.id)}>
                        {item.title} <span>{item.total}</span>
                      </button>
                    ))}
                  </div>
                  <div className="catalog-view-switch" role="group" aria-label="Product display mode">
                    <button type="button" aria-label="Table view" aria-pressed={productView === "table"}
                      className={productView === "table" ? "selected" : ""} onClick={() => changeProductView("table")}>
                      <List size={17} aria-hidden="true" /><span>Table</span>
                    </button>
                    <button type="button" aria-label="Gallery view" aria-pressed={productView === "gallery"}
                      className={productView === "gallery" ? "selected" : ""} onClick={() => changeProductView("gallery")}>
                      <Grid2X2 size={17} aria-hidden="true" /><span>Gallery</span>
                    </button>
                  </div>
                </div>
              )}
              <div className="table-toolbar">
                <div className="search-input">
                  <Search size={17} />
                  <input
                    aria-label="Search products"
                    placeholder="Search by product name, SKU or material…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      aria-label="Clear search"
                      onClick={() => setSearch("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="filters">
                  <CategoryFilter categories={data.categories} value={category} onChange={setCategory} />
                  <SortFilter value={sort} onChange={setSort} />
                </div>
              </div>
              {tab === "products" && (search || status !== "all" || category !== "all") && (
                <div className="catalog-products-filter-summary">
                  <button type="button" onClick={() => { setSearch(""); setStatus("all"); setCategory("all"); }}>
                    <X size={13} aria-hidden="true" /> Clear filters
                  </button>
                </div>
              )}
              {tab === "products" && productView === "gallery" ? (
                <div className="catalog-gallery">
                  {loading ? Array.from({ length: 6 }, (_, index) => <div className="skeleton" key={index} />)
                    : filtered.map(p => (
                      <div className="catalog-best-gallery-wrap" key={p.id}>
                      <button className="catalog-gallery-card" type="button"
                        data-product-sku={p.sku.trim().toUpperCase()}
                        onClick={() => {
                          const job = getBackgroundJobSnapshot();
                          if (job.status === "running" && job.productId === p.id && job.image?.id) {
                            setPhotoOpenRequest(previous => ({
                              productId: p.id, imageId: job.image!.id,
                              requestId: (previous?.requestId ?? 0) + 1,
                            }));
                          } else {
                            setPhotoOpenRequest(null);
                          }
                          setEditor(p);
                        }} aria-label={`Edit ${p.name}`}>
                        <div className="catalog-gallery-photo">
                          <SafeImage src={p.images[0]?.url || "/images/placeholder.svg"} alt="" style={catalogCardPhotoStyle(p.images[0], p.sku)} loading="lazy" decoding="async" />
                          <BackgroundGalleryOverlay productId={p.id} coverImageId={p.images[0]?.id}/>
                          <span className={`status-badge status-${p.status}`}><i />{label(p.status)}</span>
                        </div>
                        <div className="catalog-gallery-body">
                          <span className="catalog-gallery-category">{data.categories.find(c => c.id === p.categoryId)?.name || "Uncategorised"}</span>
                          <strong>{p.name}</strong>
                          <div className="catalog-gallery-bottom">
                            <span className="catalog-gallery-product-id" title={p.sku || p.id}>
                              <span className="catalog-gallery-id-label">Product ID</span>
                              <span className="catalog-gallery-id-value">{p.sku || p.id}</span>
                            </span>
                            <span className="catalog-gallery-edit-action"><Pencil size={15} aria-hidden="true" /> Edit</span>
                          </div>
                        </div>
                      </button>
                      <button type="button" className="catalog-best-toggle catalog-best-gallery-toggle"
                        style={{ right: 48 }}
                        disabled={busy} aria-pressed={p.bestSelling === true}
                        aria-label={`${p.bestSelling ? "Remove" : "Mark"} ${p.name} ${p.bestSelling ? "from" : "as"} Best Seller`}
                        title={p.bestSelling ? "Remove from Best Sellers" : "Mark as Best Seller"}
                        onClick={() => toggleBestSeller(p)}>
                        <Star size={15} fill={p.bestSelling ? "currentColor" : "none"} aria-hidden="true" />
                        <span>{p.bestSelling ? "Best Seller" : "Set Best Seller"}</span>
                      </button>
                      <button type="button" className="catalog-best-toggle catalog-best-gallery-toggle"
                        style={{ color: "#a63136", background: "#fff1f1", borderColor: "#f3c7c9", padding: "7px", minWidth: 32, justifyContent: "center" }}
                        disabled={busy} aria-label={`Delete ${p.name}`} title="Delete product"
                        onClick={() => { setProductDeleteError(""); setProductToDelete(p); }}>
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                      </div>
                    ))}
                </div>
              ) : (
              <div className="table-scroll">
                <table className="catalog-inventory-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Availability</th>
                      <th>Price</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 4 }, (_, i) => (
                          <tr key={i}>
                            <td colSpan={6}>
                              <div className="skeleton" />
                            </td>
                          </tr>
                        ))
                      : filtered.map((p) => (
                            <tr key={p.id} className="catalog-inventory-row">
                              <td>
                                <button
                                  className="product-cell"
                                  onClick={() => setEditor(p)}
                                >
                                  <SafeImage
                                    src={p.images[0]?.url || "/images/placeholder.svg"}
                                    alt=""
                                    style={photoCropStyle(p.images[0])}
                                  />
                                  <span>
                                    <strong>{p.name}</strong>
                                    <small>
                                      {p.sku}
                                      {p.bestSelling && <span className="catalog-best-inline"> · Best Seller</span>}
                                      {p.featured && (
                                        <span
                                          className="featured-dot"
                                          title="Featured product"
                                        >
                                          {" "}
                                          · FEATURED
                                        </span>
                                      )}
                                    </small>
                                    <span className="catalog-product-updated">Updated {new Intl.DateTimeFormat("en-MY", { month: "short", day: "numeric", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(p.updatedAt))}</span>
                                  </span>
                                </button>
                              </td>
                              <td>
                                <span className="catalog-table-category">
                                  {data.categories.find(
                                    (c) => c.id === p.categoryId,
                                  )?.name || "Uncategorised"}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`status-badge status-${p.status}`}
                                >
                                  <i />
                                  {label(p.status)}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`availability ${p.availability === "unavailable" ? "muted" : ""}`}
                                >
                                  {label(p.availability)}
                                </span>
                              </td>
                              <td className="price-cell">{formatProductPrice(p)}</td>
                              <td>
                                <div className="row-actions">
                                  <button type="button" className="icon-button catalog-best-toggle"
                                    disabled={busy} aria-pressed={p.bestSelling === true}
                                    aria-label={`${p.bestSelling ? "Remove" : "Mark"} ${p.name} ${p.bestSelling ? "from" : "as"} Best Seller`}
                                    title={p.bestSelling ? "Remove from Best Sellers" : "Mark as Best Seller"}
                                    onClick={() => toggleBestSeller(p)}>
                                    <Star size={16} fill={p.bestSelling ? "currentColor" : "none"} aria-hidden="true" />
                                  </button>
                                  <button
                                    className="icon-button edit-row"
                                    aria-label={`Edit ${p.name}`}
                                    onClick={() => setEditor(p)}
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <div className="action-menu">
                                    <button
                                      className="icon-button"
                                      aria-label={`More actions for ${p.name}`}
                                      aria-expanded={menu === p.id}
                                      onClick={() =>
                                        setMenu(menu === p.id ? null : p.id)
                                      }
                                    >
                                      <MoreHorizontal size={18} />
                                    </button>
                                    {menu === p.id && (
                                      <div className="dropdown">
                                        <button
                                          onClick={() => {
                                            setEditor({
                                              ...structuredClone(p),
                                              id: crypto.randomUUID(),
                                              model: undefined,
                                              bestSelling: false,
                                              name: `${p.name} (copy)`,
                                              sku: `${p.sku}-COPY`,
                                              status: "draft",
                                              createdAt:
                                                new Date().toISOString(),
                                            });
                                            setMenu(null);
                                          }}
                                        >
                                          <Copy size={14} />
                                          Duplicate
                                        </button>
                                        <button
                                          disabled={busy}
                                          onClick={() =>
                                            void action(
                                              () =>
                                                saveProduct({
                                                  ...p,
                                                  status:
                                                    p.status === "archived"
                                                      ? "draft"
                                                      : "archived",
                                                }),
                                              "Product status updated",
                                            )
                                          }
                                        >
                                          <Archive size={14} />
                                          {p.status === "archived"
                                            ? "Restore to draft"
                                            : "Archive"}
                                        </button>
                                        <button
                                          className="danger-text"
                                          disabled={busy}
                                          onClick={() => {
                                            if (
                                              window.confirm(
                                                `Delete ${p.name}? This cannot be undone.`,
                                              )
                                            )
                                              void action(
                                                () => deleteProduct(p.id),
                                                "Product deleted",
                                              );
                                          }}
                                        >
                                          <Trash2 size={14} />
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                  </tbody>
                </table>
              </div>
              )}
              {!loading && !filtered.length && (
                <div className="empty-state">
                  <Package size={30} />
                  <h3>
                    {search || status !== "all" || category !== "all"
                      ? "No pieces found"
                      : "Your collection starts here"}
                  </h3>
                  <p>
                    {search || status !== "all" || category !== "all"
                      ? "Try a different search or clear your filters."
                      : "Add your first product to begin."}
                  </p>
                  {(tab !== "products" || !(search || status !== "all" || category !== "all")) && (
                    <button
                      className="button secondary"
                      onClick={() => {
                        if (search || status !== "all" || category !== "all") {
                          setSearch("");
                          setStatus("all");
                          setCategory("all");
                        } else setEditor(newProduct());
                      }}
                    >
                      {search || status !== "all" || category !== "all"
                        ? "Clear filters"
                        : "Add a product"}
                    </button>
                  )}
                </div>
              )}
              <footer className="table-footer">
                <span>
                  Showing{" "}
                  {filtered.length}{" "}
                  of {data.products.length} products
                </span>
                <span>
                  <ShieldCheck size={13} aria-hidden="true" /> Staff workspace
                </span>
              </footer>
            </section>
          ) : tab === "categories" ? (
            <section className="category-grid">
              {loading ? (
                <div className="skeleton" />
              ) : (
                data.categories.map((c, index) => {
                  const items = data.products.filter(
                    (p) => p.categoryId === c.id,
                  );
                  const curatedCover = curatedCategoryCover(c.id);
                  const cover = c.cover_image_url
                    ? { src: c.cover_image_url, position: "center" }
                    : curatedCover
                      ? { src: curatedCover.imageUrl, position: "center" }
                      : categoryCover(c.name, items);
                  const slidesByUrl = new Map<string,CategorySlide>();
                  for (const item of items) for (const image of item.images) {
                    if (image.url?.trim()) slidesByUrl.set(image.url,{src:image.url,position:image.crop ? `${image.crop.x}% ${image.crop.y}%` : "center"});
                  }
                  for (const photo of categoryAlbumRecords) {
                    if(photo.category_id===c.id && photo.url?.trim() && !slidesByUrl.has(photo.url))
                      slidesByUrl.set(photo.url,{src:photo.url,position:"center"});
                  }
                  const slides = Array.from(slidesByUrl.values());
                  const preferredIndex=slides.findIndex(slide=>slide.src===cover.src);
                  if(preferredIndex>0)slides.unshift(...slides.splice(preferredIndex,1));
                  if(!slides.length && cover.src)slides.push(cover);
                  return (
                    <article className={`category-card${slides.length ? "" : " category-card--without-cover"}`} key={c.id}>
                      <button
                        type="button"
                        className="category-cover"
                        aria-label={`View products in ${c.name}`}
                        onClick={() => { switchTab("products"); setCategory(c.id); }}
                      >
                        <CategorySlideshow slides={slides} name={c.name} offset={index}/>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                      </button>
                      <div className="category-card-corner-actions">
                        <button type="button" className="category-corner-edit"
                          title="Edit category" aria-label={`Edit ${c.name} category`}
                          disabled={busy} onClick={() => editCategory(c)}>
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                        <button type="button" className="category-corner-delete"
                          disabled={busy} title={`Delete ${c.name} category — confirmation required`}
                          aria-label={`Delete ${c.name} category`}
                          onClick={() => requestCategoryDeletion(c)}>
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="category-card-body" onClick={() => { switchTab("products"); setCategory(c.id); }}>
                        <div className="section-title">
                          <h2 title={c.name}><button type="button" className="category-title-link" aria-label={`View products in ${c.name}`} onClick={event=>{event.stopPropagation();switchTab("products");setCategory(c.id);}}>{c.name}</button></h2>
                          <span className="category-count">
                            {items.length} pieces
                          </span>
                        </div>
                        <p title={c.description || "A thoughtful category for your collection."}>
                          {c.description ||
                            "A thoughtful category for your collection."}
                        </p>
                      </div>
                    </article>
                  );
                })
              )}
              {!loading && !data.categories.length && (
                <div className="empty-state">
                  <Layers size={30} />
                  <h3>Give every piece a place.</h3>
                  <p>Add your first category to organise your products.</p>
                </div>
              )}
            </section>
          ) : null}
          <footer className="workspace-footer">
            <span>© {new Date().getFullYear()} Benua Brutti Sdn. Bhd.</span>
            <span>Thoughtfully crafted in Sabah, Malaysia.</span>
          </footer>
          </>)}
        </div>
      </main>
      <CatalogPdfDownload products={data.products} categories={data.categories}
        disabled={loading || publishedCount === 0} openRef={staffPdfRef} hideTrigger staffPreview />
      {photoImportOpen && (
        <CataloguePhotoImport
          onClose={() => setPhotoImportOpen(false)}
          onDone={async ({ ready, total, attached, skipped }) => {
            await refresh(true);
            setToast(`Upload completed: ${ready}/${total} photos ready · ${attached} newly attached, ${skipped} already linked.`);
          }}
        />
      )}
      {editor && (
        <ProductEditor
          key={editor.id}
          product={editor}
          photoOpenRequest={photoOpenRequest}
          categories={data.categories}
          existingProducts={data.products}
          isNewProduct={!data.products.some(item => item.id === editor.id)}
          orderingEnabled={data.capabilities?.ordering === true}
          modelEditingEnabled={data.capabilities?.productModels === true}
          showCategories={accountRole !== "editor"}
          showUsers={accountsReady && accountRole === "super_admin"}
          productCount={data.products.length}
          onNavigate={(target) => {
            if (target === "catalog") navigate("/catalog");
            else switchTab(target);
          }}
          onSave={persist}
          onDelete={() => {
            if (busy) return;
            const savedProduct = data.products.find(item => item.id === editor.id);
            if (savedProduct) {
              setProductDeleteError("");
              setProductToDelete(savedProduct);
            }
          }}
          onClose={(warning) => {
            setEditor(null);
            setPhotoOpenRequest(null);
            if (warning) setToast(warning);
          }}
        />
      )}{" "}
      {productToDelete && (
        <Modal
          title="Delete product?"
          eyebrow="PERMANENT ACTION"
          className="catalog-product-delete-dialog"
          onClose={() => {
            if (!busy) { setProductToDelete(null); setProductDeleteError(""); }
          }}
        >
          <div className="product-delete-body" aria-busy={busy}>
            <div className="product-delete-card">
              <span className="product-delete-thumb" aria-hidden="true">
                {productToDelete.images[0]?.url
                  ? <SafeImage src={productToDelete.images[0].url} alt="" />
                  : <Package size={24} strokeWidth={1.6} />}
              </span>
              <div className="product-delete-name">
                <strong>{productToDelete.name}</strong>
                <small>Product ID: {productToDelete.sku || productToDelete.id}</small>
              </div>
            </div>
            <div className="product-delete-message">
              <AlertCircle size={17} strokeWidth={1.8} aria-hidden="true" />
              <p>This product will be permanently removed from the catalog. This action cannot be undone.</p>
            </div>
            {productDeleteError && <p className="notice error" role="alert">{productDeleteError}</p>}
            <div className="product-delete-actions">
              <button type="button" disabled={busy} autoFocus
                onClick={() => { setProductToDelete(null); setProductDeleteError(""); }}>
                Cancel
              </button>
              <button type="button" className="product-delete-submit"
                disabled={busy} onClick={() => void confirmProductDeletion()}>
                {busy ? <LoaderCircle size={15} className="spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}
                {busy ? "Deleting…" : "Delete product"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {categoryToDelete && (
        <Modal
          title={`Delete ${categoryToDelete.name}?`}
          eyebrow="CONFIRM DELETION"
          className="catalog-category-delete-dialog"
          description="Review what will be removed before you continue."
          onClose={() => {
            if (!busy) {
              setCategoryToDelete(null);
              setCategoryDeleteInput("");
              setCategoryDeleteError("");
            }
          }}
        >
          <div className="catalog-delete-confirmation" aria-busy={busy}>
            <div className="catalog-delete-warning" role="alert">
              <AlertCircle size={22} strokeWidth={1.8} aria-hidden="true" />
              <div>
                <strong>{categoryDeleteCount
                  ? `${categoryDeleteCount} product${categoryDeleteCount === 1 ? "" : "s"} will also be deleted`
                  : "This category has no products"}</strong>
                <p>{categoryDeleteCount
                  ? "Deleting this category will permanently remove ALL its products, product listings and related records. This cannot be undone."
                  : "Only this empty category will be removed. This cannot be undone."}</p>
              </div>
            </div>
            {categoryDeleteCount > 0 && (
              <label className="catalog-delete-confirm-label">
                To confirm, type <strong>{categoryToDelete.name}</strong>
                <input
                  value={categoryDeleteInput}
                  onChange={event => setCategoryDeleteInput(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Type the category name"
                  disabled={busy}
                  aria-label="Type category name to confirm deletion"
                />
              </label>
            )}
            {categoryDeleteError && <p className="notice error" role="alert">{categoryDeleteError}</p>}
            <div className="catalog-delete-confirm-actions">
              <button type="button" className="button secondary" disabled={busy}
                onClick={() => { setCategoryToDelete(null); setCategoryDeleteInput(""); setCategoryDeleteError(""); }}>
                Cancel
              </button>
              <button type="button" className="button catalog-delete-confirm-button"
                disabled={busy || (categoryDeleteCount > 0 && categoryDeleteInput.trim() !== categoryToDelete.name)}
                onClick={() => void confirmCategoryDeletion()}>
                <Trash2 size={16} aria-hidden="true" />
                {busy ? "Deleting…" : categoryDeleteCount ? `Delete category + ${categoryDeleteCount} products` : "Delete category"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {catEditor && (
        <Modal
          title={catEditor.name ? "Edit category" : "Add category"}
          eyebrow="COLLECTION MANAGEMENT"
          description={catEditor.name ? "Update the details customers see in your catalog." : "Organise your products into a collection."}
          className="category-editor-dialog"
          onClose={() => !busy && setCatEditor(null)}
        >
          <form className="category-form" onSubmit={submitCategory} aria-busy={busy}>
            <div className="category-editor-scroll-body">
            <label className="category-editor-field">
              <span className="category-editor-label">Category name <span className="category-required" aria-hidden="true">*</span></span>
              <input
                required
                maxLength={80}
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="e.g. Seating"
              />
            </label>
            <CategoryAlbumPicker
              products={data.products}
              categories={data.categories}
              selected={categoryAlbumSelection}
              onChange={setCategoryAlbumSelection}
              disabled={busy}
            />
            {actionError && (
              <div className="notice error" role="alert">
                {actionError}
              </div>
            )}
            </div>
            <div className="button-row justify-end category-editor-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setCatEditor(null)}
              >
                Cancel
              </button>
              <button type="submit" className="button primary" disabled={busy}>
                {busy ? "Saving…" : "Save category"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
      <BackgroundCutoutToast onEditResult={(productId, imageId) => {
        const target = editor?.id === productId
          ? editor
          : data.products.find(item => item.id === productId);
        if (!target || (editor?.id !== productId && !target.images.some(image => image.id === imageId))) {
          setToast("The source photo is no longer attached. You can still download the transparent PNG.");
          return false;
        }
        // Return to the product workspace as well as reopening its exact
        // Photo Studio image. Do not lose the AI Worker in another modal.
        switchTab("products");
        setEditor(target);
        setPhotoOpenRequest(previous => ({
          productId, imageId, requestId: (previous?.requestId ?? 0) + 1,
        }));
        return true;
      }}/>
    </div>
  );
}
function Login({
  authenticated,
  onSuccess,
  onCatalog,
  setupError,
}: {
  authenticated: boolean;
  onSuccess: () => Promise<void>;
  onCatalog: () => void;
  setupError: string | null;
}) {
  const [resetSent, setResetSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(email, password);
      await onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordReset() {
    setError("");
    setResetSent(false);
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setResetSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="access-page catalog-login-page brutti-login-redesign">
      <div className="catalog-login-shell">
        <section className="catalog-login-story" aria-label="Brutti Catalog collection studio" style={{ backgroundImage: `url("${publicAssetUrl("/images/brutti-collection-hero.webp")}")` }}>
          <div className="catalog-login-story-top">
            <a href="#/catalog" className="catalog-login-wordmark" aria-label="Open Brutti public catalog">
              <img src={publicAssetUrl("/images/brutti-wordmark.svg")} alt="Brutti" />
            </a>
            <span className="catalog-login-story-serial">CUSTOM FURNITURE · KIOSKS</span>
          </div>
          <div className="catalog-login-story-art" aria-hidden="true">
            <span className="catalog-login-wood-disc" />
            <span className="catalog-login-wood-line" />
            <span className="catalog-login-grain" />
          </div>
          <div className="catalog-login-story-copy">
            <span className="catalog-login-story-kicker">BENUA BRUTTI · COLLECTION STUDIO</span>
            <h2>Crafted with care.<br /><em>Managed with ease.</em></h2>
            <p>Crafting considered spaces. Curating every detail.</p>
          </div>
          <div className="catalog-login-story-foot">
            <span>BENUA BRUTTI</span>
            <span>KOTA KINABALU · SABAH</span>
          </div>
        </section>

        <main className="catalog-login-form-side">
          <div className="brutti-login-top">
            <button type="button" className="brutti-login-back" onClick={onCatalog}>
              <ArrowLeft size={15} aria-hidden="true" /> Back to collection
            </button>
          </div>
          <div className="catalog-login-auth-surface">
            <div className="brutti-login-brand">
              <img src={publicAssetUrl("/images/brutti-wordmark.svg")} alt="Brutti official logo" />
            </div>
            <div className="catalog-login-kicker">
              <span className="catalog-login-kicker-dot" aria-hidden="true" />
              STAFF PORTAL
            </div>
            <div className="catalog-login-heading">
              <h1>{authenticated ? "Access restricted." : "Welcome back."}</h1>
              {authenticated && (
                <p className="catalog-login-description">
                  Your account does not have catalog administrator access. Please contact your workspace owner.
                </p>
              )}
            </div>

            {setupError && <div className="notice error catalog-login-alert" role="alert">{setupError}</div>}

            {authenticated ? (
              <button type="button" className="catalog-login-submit" disabled={busy}
                onClick={() => {
                  void signOut().catch((e) =>
                    setError(e instanceof Error ? e.message : "Sign out failed."),
                  );
                }}>
                Sign out <ArrowRight size={17} aria-hidden="true" />
              </button>
            ) : (
              <form className="catalog-login-form" onSubmit={submit}>
                <div className="catalog-login-field">
                  <label htmlFor="catalog-login-email">Email</label>
                  <div className="catalog-login-input">
                    <Mail size={18} aria-hidden="true" />
                    <input
                      id="catalog-login-email"
                      autoComplete="username"
                      inputMode="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      type="email"
                      placeholder="Enter your email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="catalog-login-field">
                  <div className="catalog-login-field-head">
                    <label htmlFor="catalog-login-password">Password</label>
                    <button type="button" className="catalog-login-forgot" disabled={busy}
                      onClick={() => void sendPasswordReset()}>Forgot password?</button>
                  </div>
                  <div className="catalog-login-input">
                    <LockKeyhole size={18} aria-hidden="true" />
                    <input
                      id="catalog-login-password"
                      autoComplete="current-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button type="button" className="catalog-login-reveal" disabled={busy}
                      onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}>
                      {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                <button type="submit" className="catalog-login-submit" disabled={busy}>
                  <span>{busy ? "Signing in…" : "Sign in"}</span>
                  {busy ? <LoaderCircle className="spin" size={18} aria-hidden="true" />
                    : <ArrowRight size={18} aria-hidden="true" />}
                </button>
                {resetSent && <p role="status" className="catalog-login-reset-status">
                  If this account exists, a password reset link has been sent.
                </p>}
              </form>
            )}
            {error && <div className="notice error catalog-login-alert" role="alert">{error}</div>}
            <div className="catalog-login-divider"><span>PUBLIC COLLECTION</span></div>
            <button type="button" className="catalog-login-public" onClick={onCatalog}>
              Explore public catalog <ArrowUpRight size={17} aria-hidden="true" />
            </button>
            <p className="catalog-login-security"><ShieldCheck size={15} aria-hidden="true" />
              Secure access for authorised Brutti Catalog staff only.
            </p>
          </div>
          <div className="catalog-login-form-foot"><span>BENUA BRUTTI © 2026</span></div>
        </main>
      </div>
    </div>
  );
}

function PasswordAccess({ intent, verified, onDone }: { intent: "invite" | "recovery"; verified: boolean; onDone: () => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    try { await completePassword(password); await onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to set password."); }
    finally { setBusy(false); }
  }
  return <div className="access-page">
    <a href="#/catalog" className="brand"><img src={publicAssetUrl("/images/brutti-wordmark.svg")} alt="Brutti" className="brutti-official-logo" /></a>
    <div className="access-card">
      <ShieldCheck size={25} /><span className="eyebrow">THE CATALOG WORKSPACE</span>
      <h1>{intent === "invite" ? "Set your password." : "Reset your password."}</h1>
      <p className="muted">Choose a password for your Supabase account. Administrator access is granted separately by the workspace owner.</p>
      {verified ? <form onSubmit={submit}>
        <label>New password<input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label>Confirm password<input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
        <button className="button primary full" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
      </form> : <div className="notice error" role="alert">This link is expired or invalid. Request a new link and try again.</div>}
      {error && <div className="notice error" role="alert">{error}</div>}
      <button className="text-button" disabled={busy} onClick={() => void onDone()}>Back to sign in</button>
    </div>
  </div>;
}
