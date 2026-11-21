import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Images, Upload, Download, Search, Check, Trash2, LoaderCircle, Eye,
  Package, Layers, RefreshCw, ImageOff, ArrowUpRight, Folder, FolderOpen, Plus, ArrowLeft, ChevronDown, Crop, Grid2X2, Table2, AlertTriangle, LockKeyhole, Save,
} from "lucide-react";
import type { Category, Product } from "../lib/types";
import {
  albumPhotoCategoryIds, combineAlbumPhotos, listAlbumRecords,
  removeUnassignedAlbumPhoto, saveAlbumPhotoDetails, uploadAlbumPhotos,
  type AlbumPhoto, type AlbumRecord, type AlbumPhotoDetailsUpdate,
} from "../lib/album";
import Modal from "./Modal";
import SafeImage from "./SafeImage";
import { AlbumCategoryTable, AlbumPhotoTable } from "./AlbumTableView";
import PhotoCoverStudio from "./PhotoCoverStudio";
import { downloadCatalogPhoto, type PhotoDownloadFormat } from "../lib/photo-download";
import "./album-library.css";

type Props = {
  products: Product[];
  categories: Category[];
  onSelect?: (photos: AlbumPhoto[]) => void;
  onEditProduct?: (id: string) => void;
  onCreateProductFromPhoto?: (photo: AlbumPhoto, details: AlbumPhotoDetailsUpdate) => void;
  onAttachPhotoToProduct?: (productId: string, photo: AlbumPhoto, details: AlbumPhotoDetailsUpdate) => void;
  onAddCategory?: () => void;
  onClose?: () => void;
  maxSelect?: number;
  excludedUrls?: string[];
};

type AlbumCategorySelectProps = {
  categories: Category[];
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

/** The menu is placed inside the native dialog's top layer (rather than inside
 * its scrollable content). That prevents the category list being clipped. */
function AlbumCategorySelect({ categories, value, disabled, onChange }: AlbumCategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLDialogElement | null>(null);
  const [position, setPosition] = useState<{
    left: number; width: number; maxHeight: number;
    top?: number; bottom?: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const choices = [
    { id: "none", name: "Automatic / Uncategorised" },
    ...categories.map(item => ({ id: item.id, name: item.name })),
  ];
  const selected = choices.find(item => item.id === value) || choices[0];
  function closeMenu(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }
  function openMenu() {
    if (disabled || !triggerRef.current) return;
    const trigger = triggerRef.current;
    const dialog = trigger.closest("dialog") as HTMLDialogElement | null;
    if (!dialog) return;
    const anchor = trigger.getBoundingClientRect();
    const bounds = dialog.getBoundingClientRect();
    const header = dialog.querySelector(".modal-heading")?.getBoundingClientRect();
    const aboveSpace = Math.max(0, anchor.top - (header?.bottom ?? bounds.top) - 14);
    const belowSpace = Math.max(0, bounds.bottom - anchor.bottom - 16);
    const above = belowSpace < 285 && aboveSpace > belowSpace;
    const available = above ? aboveSpace : belowSpace;
    const maxHeight = Math.max(75, Math.min(365, available - 5));
    setPosition({
      left: Math.max(13, Math.min(anchor.left - bounds.left, bounds.width - anchor.width - 13)),
      width: Math.min(anchor.width, bounds.width - 26),
      maxHeight,
      ...(above
        ? { bottom: bounds.bottom - anchor.top + 7 }
        : { top: anchor.bottom - bounds.top + 7 }),
    });
    setPortalRoot(dialog);
    setOpen(true);
  }
  useEffect(() => {
    if (!open) return;
    const onOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
    };
    const onScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      closeMenu();
    };
    const onResize = () => closeMenu();
    document.addEventListener("pointerdown", onOutside, true);
    window.addEventListener("keydown", onEscape, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onOutside, true);
      window.removeEventListener("keydown", onEscape, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
      ?.focus({ preventScroll: true });
  }, [open, portalRoot]);
  return (
    <div className="brutti-album__detail-category-picker">
      <button ref={triggerRef} type="button"
        className={`brutti-album__detail-category-trigger${open ? " is-open" : ""}`}
        disabled={disabled} aria-label="Assign photo to Album category"
        aria-haspopup="listbox" aria-expanded={open}
        onClick={() => open ? closeMenu() : openMenu()}
        onKeyDown={event => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key) && !open) {
            event.preventDefault(); openMenu();
          }
        }}>
        <Folder size={17} aria-hidden="true"/>
        <span>{selected.name}</span>
        <ChevronDown size={16} aria-hidden="true"/>
      </button>
      {open && portalRoot && position && createPortal(
        <div ref={menuRef} className="brutti-album__detail-category-popover"
          role="listbox" aria-label="Album category options"
          style={{
            left: position.left, width: position.width, maxHeight: position.maxHeight,
            top: position.top, bottom: position.bottom,
          }}
          onKeyDown={event => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
            if (!options.length) return;
            const index = options.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === "Home" ? 0 :
              event.key === "End" ? options.length - 1 :
              event.key === "ArrowDown" ? (index + 1) % options.length :
              (index + options.length - 1) % options.length;
            options[next].focus({ preventScroll: true });
            options[next].scrollIntoView({ block: "nearest" });
          }}>
          <p className="brutti-album__detail-category-menu-title">ORGANISE PHOTO</p>
          <div className="brutti-album__detail-category-options">
            {choices.map(item => (
              <button type="button" role="option" aria-selected={item.id === value}
                className={item.id === value ? "is-selected" : ""}
                key={item.id}
                onClick={() => { onChange(item.id); closeMenu(true); }}>
                <span>{item.name}</span>
                {item.id === value && <Check size={16} aria-hidden="true"/>}
              </button>
            ))}
          </div>
        </div>, portalRoot)}
    </div>
  );
}

export default function AlbumLibrary({
  products, categories, onSelect, onEditProduct, onCreateProductFromPhoto, onAttachPhotoToProduct, onAddCategory, onClose,
  maxSelect = 8, excludedUrls = [],
}: Props) {
  const picker = Boolean(onSelect);
  const [records, setRecords] = useState<AlbumRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "by-category" | "published">("all");
  const [viewMode, setViewMode] = useState<"gallery" | "table">("gallery");
  const [category, setCategory] = useState("all");
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [categoryMenuAbove, setCategoryMenuAbove] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const categoryTriggerRef = useRef<HTMLButtonElement>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [uploadCategory, setUploadCategory] = useState("none");
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [detailsDraft, setDetailsDraft] = useState<AlbumPhotoDetailsUpdate>({
    name: "", description: "", categoryId: null,
  });
  const [attachProductId, setAttachProductId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<AlbumPhoto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AlbumPhoto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [editingAlbumPhoto, setEditingAlbumPhoto] = useState<AlbumPhoto | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<PhotoDownloadFormat>("jpg");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [progress, setProgress] = useState<{done:number,total:number}|null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => { mounted.current = false; };
  }, []);
  async function reload() {
    setLoading(true); setError("");
    try {
      const data = await listAlbumRecords();
      if (mounted.current) setRecords(data);
    } catch(e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Album could not be loaded.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (!categoryMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!categoryMenuRef.current?.contains(event.target as Node)) {
        setCategoryMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setCategoryMenuOpen(false);
        categoryTriggerRef.current?.focus();
      }
    };
    const closeOnScroll = (event: Event) => {
      if (categoryMenuRef.current?.contains(event.target as Node)) return;
      setCategoryMenuOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnScroll);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnScroll);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [categoryMenuOpen]);
  const toggleCategoryMenu = () => {
    if (!categoryMenuOpen && categoryTriggerRef.current) {
      const rect = categoryTriggerRef.current.getBoundingClientRect();
      setCategoryMenuAbove(window.innerHeight - rect.bottom < Math.min(330, (categories.length + 1) * 42 + 58)
        && rect.top > window.innerHeight - rect.bottom);
    }
    setCategoryMenuOpen(open => !open);
  };
  const selectAlbumCategory = (value: string) => {
    setCategory(value);
    setCategoryMenuOpen(false);
    categoryTriggerRef.current?.focus();
  };
  const photos = useMemo(()=>combineAlbumPhotos(records,products,categories),[records,products,categories]);
  const uncategorised = (photo: AlbumPhoto) => albumPhotoCategoryIds(photo).length === 0;
  const assigned = photos.filter(photo => photo.usedBy.length > 0 || photo.categoryCovers.length > 0).length;
  const publishedIds = useMemo(
    () => new Set(products.filter(product => product.status === "published").map(product => product.id)),
    [products],
  );
  const isPublishedPhoto = (photo: AlbumPhoto) => photo.usedBy.some(product => publishedIds.has(product.id));
  const publishedCount = photos.filter(isPublishedPhoto).length;
  const groups = useMemo(() => categories.map(item => {
    const items = photos.filter(photo => albumPhotoCategoryIds(photo).includes(item.id));
    return { category: item, items, cover: items.find(photo => photo.url)?.url };
  }), [categories, photos]);
  const ungrouped = useMemo(() => photos.filter(uncategorised), [photos]);
  const visible = useMemo(()=>photos.filter(photo=>{
    const ids = albumPhotoCategoryIds(photo);
    const text=[photo.name,...photo.usedBy.map(product=>product.name),
      ...photo.categoryCovers, ...categories.filter(item=>ids.includes(item.id)).map(item=>item.name)]
      .join(" ").toLowerCase();
    const inFolder = filter !== "by-category" ||
      (selectedFolder === "__uncategorized__" ? ids.length===0 :
        selectedFolder !== null && ids.includes(selectedFolder));
    return (filter!=="published" || photo.usedBy.some(product => publishedIds.has(product.id))) &&
      inFolder &&
      (filter==="by-category" || category==="all" || ids.includes(category)) &&
      (!search.trim() || text.includes(search.trim().toLowerCase()));
  }),[photos,filter,category,selectedFolder,search,categories,publishedIds]);
  const folderTitle = selectedFolder === "__uncategorized__" ? "Uncategorised" :
    categories.find(item => item.id === selectedFolder)?.name || "Category";
  function selectFilter(next: "all" | "by-category" | "published") {
    setFilter(next);
    setSelectedFolder(null);
    setCategory("all");
    setCategoryMenuOpen(false);
    if (next !== "by-category") setUploadCategory("none");
  }
  function openFolder(id: string) {
    setFilter("by-category");
    setSelectedFolder(id);
    setUploadCategory(id === "__uncategorized__" ? "none" : id);
  }
  // Product-linked photos should open the real Product Editor, as product cards do.
  // Standalone Album/legacy library photos do not have a product record, so open
  // the matching Photo Editor instead of inventing an editable product.
  function openPhotoEditor(photo: AlbumPhoto) {
    setDownloadError("");
    setDownloadFormat("jpg");
    // External Product Library photos may have a matching SKU even when their
    // original URL was not attached to the Product's image array. Only route
    // when the match is unambiguous; never create a fake Product record.
    const matchingProducts = photo.usedBy.length
      ? photo.usedBy
      : photo.sourceCode
        ? products.filter(product => product.sku?.trim().toLowerCase() === photo.sourceCode!.trim().toLowerCase())
        : [];
    if (!picker && onEditProduct && matchingProducts.length === 1) {
      setPreview(null);
      onEditProduct(matchingProducts[0].id);
      return;
    }
    setDetailsDraft({
      name: photo.name,
      description: photo.sourceDetails.description || "",
      categoryId: photo.manualCategoryId,
    });
    setAttachProductId("");
    setDetailsError("");
    setPreview(photo);
  }
  const detailsDirty = !!preview && (
    detailsDraft.name !== preview.name ||
    detailsDraft.description !== (preview.sourceDetails.description || "") ||
    detailsDraft.categoryId !== preview.manualCategoryId
  );
  function closePhotoEditor() {
    if (savingDetails) return;
    if (detailsDirty && !window.confirm("Discard unsaved Album details?")) return;
    setPreview(null);
    setDetailsError("");
  }
  const busy = progress!==null;
  async function upload(files: FileList|null) {
    if (!files?.length || busy) return;
    setError("");setNotice("");
    const batch=Array.from(files);
    if (batch.length>30) {
      setError("Select up to 30 photos per upload. You can upload another batch afterward.");
      return;
    }
    setProgress({done:0,total:batch.length});
    try {
      const result=await uploadAlbumPhotos(batch,uploadCategory === "none" ? null : uploadCategory,(done,total)=>{
        if(mounted.current)setProgress({done,total});
      });
      if(!mounted.current)return;
      if(result.uploaded.length){
        setRecords(old=>{
          const paths=new Set(old.map(r=>r.storage_path));
          return [...result.uploaded.filter(r=>!paths.has(r.storage_path)),...old];
        });
      }
      if(result.failures.length)setError(result.failures.slice(0,5).join("\n")+(result.failures.length>5?"\nMore uploads failed.":""));
      if(result.uploaded.length)setNotice(`${result.uploaded.length} photo${result.uploaded.length===1?"":"s"} saved to Album. You can reuse them in Product Editor.`);
    } catch(e) {
      if(mounted.current)setError(e instanceof Error?e.message:"Album upload failed.");
    } finally {
      if(mounted.current)setProgress(null);
      if(fileRef.current) fileRef.current.value="";
    }
  }
  function toggle(photo:AlbumPhoto) {
    if(excludedUrls.includes(photo.url))return;
    setSelected(ids=>{
      if(ids.includes(photo.key))return ids.filter(id=>id!==photo.key);
      if(ids.length>=maxSelect){setError(`Choose up to ${maxSelect} more photo${maxSelect===1?"":"s"}.`);return ids;}
      setError("");
      return [...ids,photo.key];
    });
  }
  // Saving Album details changes only media-library metadata, never Product.
  // Product publishing always happens through the existing Product Editor.
  async function persistPhotoDetails(photo: AlbumPhoto): Promise<AlbumPhoto | null> {
    if (savingDetails) return null;
    if (!photo.id) {
      setDetailsError("This photo has no Album record yet. Refresh Album before saving its details.");
      return null;
    }
    setSavingDetails(true);
    setDetailsError("");
    try {
      const saved = await saveAlbumPhotoDetails(photo, detailsDraft);
      const updated: AlbumPhoto = {
        ...photo,
        name: saved.name,
        manualCategoryId: saved.categoryId,
        sourceDetails: saved.sourceDetails,
      };
      setRecords(old => old.map(item => item.id === photo.id
        ? { ...item, name: saved.name, category_id: saved.categoryId, source_details: saved.sourceDetails }
        : item,
      ));
      setPreview(current => current?.id === photo.id ? updated : current);
      setDetailsDraft({
        name: saved.name,
        description: saved.sourceDetails.description || "",
        categoryId: saved.categoryId,
      });
      setNotice("Album details saved.");
      return updated;
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : "Could not save Album details.");
      return null;
    } finally {
      setSavingDetails(false);
    }
  }
  async function startProductFromPhoto(photo: AlbumPhoto, targetProductId?: string) {
    if (!detailsDraft.name.trim()) {
      setDetailsError("Name is required before using this photo in a product.");
      return;
    }
    // Save first so the Album and the product draft display identical metadata.
    // Unindexed linked images still open the Product Editor without fake saves.
    const savedPhoto = photo.id && detailsDirty ? await persistPhotoDetails(photo) : photo;
    if (!savedPhoto) return;
    const details: AlbumPhotoDetailsUpdate = {
      name: detailsDraft.name.trim(),
      categoryId: detailsDraft.categoryId,
      description: detailsDraft.description,
    };
    setPreview(null);
    if (targetProductId) {
      onAttachPhotoToProduct?.(targetProductId, savedPhoto, details);
    } else {
      onCreateProductFromPhoto?.(savedPhoto, details);
    }
  }
  async function download(photo: AlbumPhoto) {
    if (downloading) return;
    setDownloading(true);
    setDownloadError("");
    try {
      await downloadCatalogPhoto({
        url: photo.url,
        storagePath: photo.storagePath,
        name: photo.name,
      }, downloadFormat);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Image download failed.");
    } finally {
      setDownloading(false);
    }
  }
  function requestDelete(photo: AlbumPhoto) {
    if (photo.usedBy.length || photo.categoryCovers.length) {
      setDownloadError("This photo is still linked to a product or category cover. Unlink it before deleting.");
      return;
    }
    if (!photo.id) {
      setDownloadError("This photo has no Album record. Refresh and try again.");
      return;
    }
    setDeleteError("");
    setDeleteTarget(photo);
  }
  function closeDeleteConfirmation() {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError("");
  }
  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    const photo = deleteTarget;
    setDeleting(true);
    setDeleteError("");
    try {
      await removeUnassignedAlbumPhoto(photo);
      setRecords(old => old.filter(item => item.id !== photo.id));
      setSelected(ids => ids.filter(id => id !== photo.key));
      setPreview(null);
      setDeleteTarget(null);
      setDownloadError("");
      setError("");
      setNotice(photo.sourceKind === "external"
        ? "Photo removed from Brutti Album. Original source image is unchanged."
        : "Photo deleted from Brutti Album.");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete this photo.");
    } finally {
      setDeleting(false);
    }
  }
  const selectedPhotos=photos.filter(p=>selected.includes(p.key));
  const albumStats=(
    <div className="brutti-album__stats" aria-label="Album counts">
      <span><strong>{photos.length}</strong> All photos</span>
      <span><strong>{assigned}</strong> In use</span>
      <span><strong>{publishedCount}</strong> Published</span>
    </div>
  );
  return (
    <section className={`brutti-album ${picker?"brutti-album--picker":""}`} aria-label={picker?"Choose photos from Album":"Brutti media Album"}>
      {!picker && (
        <header className="brutti-album__heading brutti-album__header-v2">
          <div className="brutti-album__heading-copy">
            <p className="brutti-album__eyebrow">BRUTTI CATALOG / MEDIA LIBRARY</p>
            <h1>Album</h1>
            <p>Organise your furniture photos and reuse them across products.</p>
            {albumStats}
          </div>
          <div className="brutti-album__heading-actions">
            <label className="brutti-album__destination">
              <span>Upload photos to</span>
              <select aria-label="Category for new uploads" value={uploadCategory}
                onChange={event=>setUploadCategory(event.target.value)} disabled={busy}>
                <option value="none">Uncategorised</option>
                {categories.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
            </label>
            <div className="brutti-album__action-buttons">
              {onAddCategory && <button type="button" className="brutti-album__secondary" onClick={onAddCategory}>
                <Plus size={16} aria-hidden="true"/> Add category
              </button>}
              <button type="button" className="brutti-album__primary" onClick={()=>fileRef.current?.click()} disabled={busy}>
                <Upload size={17} aria-hidden="true"/> Add photos
              </button>
            </div>
          </div>
        </header>
      )}
      {picker && <div className="brutti-album__picker-intro">
        Choose up to {maxSelect} images to attach. Existing images will be linked, not uploaded twice.
      </div>}
      <input type="file" ref={fileRef} hidden multiple accept="image/jpeg,image/png,image/webp"
        onChange={e=>void upload(e.target.files)} disabled={busy}/>
      {picker && albumStats}
      <div className="brutti-album__toolbar">
        <div className="brutti-album__tabs" aria-label="Album views">
          <button type="button" className={filter==="all"?"is-current":""} aria-pressed={filter==="all"} onClick={()=>selectFilter("all")}>All photos</button>
          <button type="button" className={filter==="by-category"?"is-current":""} aria-pressed={filter==="by-category"} onClick={()=>selectFilter("by-category")}><Folder size={14}/> By category</button>
          <button type="button" className={filter==="published"?"is-current":""} aria-pressed={filter==="published"} onClick={()=>selectFilter("published")}>Published</button>
        </div>
        <label className="brutti-album__search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search photos or product names…" aria-label="Search Album"/></label>
        {filter !== "by-category" && <div ref={categoryMenuRef}
          className={`brutti-album__category-picker${categoryMenuOpen ? " is-open" : ""}${categoryMenuAbove ? " is-above" : ""}`}>
          <button ref={categoryTriggerRef} type="button" className="brutti-album__category-trigger"
            aria-label="Filter album photos by category"
            aria-expanded={categoryMenuOpen}
            aria-haspopup="true"
            onClick={toggleCategoryMenu}
            onKeyDown={event => {
              if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !categoryMenuOpen) {
                event.preventDefault();
                toggleCategoryMenu();
              }
            }}>
            <Layers size={17} aria-hidden="true"/>
            <span>{category === "all" ? "All categories" : categories.find(item => item.id === category)?.name || "All categories"}</span>
            <ChevronDown size={16} aria-hidden="true" className="brutti-album__category-chevron"/>
          </button>
          {categoryMenuOpen && <div className="brutti-album__category-menu"
            role="group" aria-label="Choose a category"
            onKeyDown={event => {
              if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
              if (!buttons.length) return;
              const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
              const next = event.key === "Home" ? 0 :
                event.key === "End" ? buttons.length - 1 :
                event.key === "ArrowDown" ? (current + 1) % buttons.length :
                (current + buttons.length - 1) % buttons.length;
              buttons[next].focus();
            }}>
            <div className="brutti-album__category-menu-title">BROWSE COLLECTIONS</div>
            <div className="brutti-album__category-options">
              <button type="button" className={category === "all" ? "is-active" : ""}
                aria-pressed={category === "all"}
                onClick={() => selectAlbumCategory("all")}>
                <span>All categories</span>
                <span className="brutti-album__category-count">{photos.length}</span>
                {category === "all" && <Check size={15} aria-hidden="true"/>}
              </button>
              {categories.map(item => (
                <button type="button" key={item.id}
                  className={category === item.id ? "is-active" : ""}
                  aria-pressed={category === item.id}
                  onClick={() => selectAlbumCategory(item.id)}>
                  <span>{item.name}</span>
                  <span className="brutti-album__category-count">{groups.find(group => group.category.id === item.id)?.items.length ?? 0}</span>
                  {category === item.id && <Check size={15} aria-hidden="true"/>}
                </button>
              ))}
            </div>
          </div>}
        </div>}
        <div className="brutti-album__view-switch" role="group" aria-label="Album display style">
          <button type="button" className={viewMode==="gallery"?"is-active":""}
            aria-pressed={viewMode==="gallery"} aria-label="Gallery view" title="Gallery view"
            onClick={()=>setViewMode("gallery")}><Grid2X2 size={16} aria-hidden="true"/><span>Gallery</span></button>
          <button type="button" className={viewMode==="table"?"is-active":""}
            aria-pressed={viewMode==="table"} aria-label="Table view" title="Table view"
            onClick={()=>setViewMode("table")}><Table2 size={17} aria-hidden="true"/><span>Table</span></button>
        </div>
        <button type="button" className="brutti-album__refresh" disabled={busy||loading} onClick={()=>void reload()} title="Refresh Album" aria-label="Refresh Album"><RefreshCw size={17}/></button>
      </div>
      {picker && <div className="brutti-album__picker-add">
        <label className="brutti-album__destination">
          Add photos to
          <select value={uploadCategory} disabled={busy} aria-label="Album category for new photos"
            onChange={event=>setUploadCategory(event.target.value)}>
            <option value="none">Uncategorised</option>
            {categories.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <button type="button" className="brutti-album__upload-small" onClick={()=>fileRef.current?.click()} disabled={busy}>
          <Upload size={15}/> Add photos to Album
        </button>
      </div>}
      {filter==="by-category" && selectedFolder!==null && <div className="brutti-album__folder-path">
        <button type="button" onClick={()=>setSelectedFolder(null)}><ArrowLeft size={16}/> All categories</button>
        <span aria-hidden="true">/</span>
        <strong>{folderTitle}</strong>
        <span className="brutti-album__folder-items">{visible.length} photos</span>
        <button type="button" className="brutti-album__folder-add" disabled={busy}
          onClick={()=>{setUploadCategory(selectedFolder==="__uncategorized__"?"none":selectedFolder);fileRef.current?.click();}}>
          <Plus size={16}/> Add photos
        </button>
      </div>}
      {progress && <p className="brutti-album__message" role="status"><LoaderCircle className="brutti-album__spin" size={16}/> Uploading {progress.done} / {progress.total} photos…</p>}
      {error && <p className="brutti-album__error" role="alert">{error}</p>}
      {notice && <p className="brutti-album__success" role="status">{notice}</p>}
      {loading ? <div className="brutti-album__empty" role="status"><LoaderCircle className="brutti-album__spin"/>Loading your photos…</div> :
        filter === "by-category" && selectedFolder === null ? (
          viewMode === "table" ? (
            <AlbumCategoryTable
              groups={groups}
              uncategorised={ungrouped}
              search={search}
              onOpen={openFolder}
            />
          ) : (
          <div className="brutti-album__folders" aria-label="Photo folders by category">
            {groups.filter(({category:item,items})=>!search.trim() ||
              item.name.toLowerCase().includes(search.trim().toLowerCase()) ||
              items.some(photo=>photo.name.toLowerCase().includes(search.trim().toLowerCase())))
              .map(({category:item,items,cover})=>(
              <button type="button" key={item.id} className="brutti-album__folder"
                onClick={()=>openFolder(item.id)} aria-label={`Open ${item.name}: ${items.length} photos`}>
                <span className="brutti-album__folder-cover">
                  {cover?<SafeImage src={cover} alt="" loading="lazy"/>:<Folder size={44}/>}
                  <span className="brutti-album__folder-mark"><FolderOpen size={18}/></span>
                </span>
                <span className="brutti-album__folder-copy"><strong>{item.name}</strong><small>{items.length} photos</small></span>
                <span className="brutti-album__folder-open" aria-hidden="true"><ArrowUpRight size={17}/></span>
              </button>
            ))}
            {(!search.trim() || "uncategorised".includes(search.trim().toLowerCase()) ||
              ungrouped.some(photo=>photo.name.toLowerCase().includes(search.trim().toLowerCase()))) && (
              <button type="button" className="brutti-album__folder" onClick={()=>openFolder("__uncategorized__")}>
                <span className="brutti-album__folder-cover brutti-album__folder-cover--empty">
                  <Folder size={44}/><span className="brutti-album__folder-mark"><FolderOpen size={18}/></span>
                </span>
                <span className="brutti-album__folder-copy"><strong>Uncategorised</strong><small>{ungrouped.length} photos</small></span>
                <span className="brutti-album__folder-open" aria-hidden="true"><ArrowUpRight size={17}/></span>
              </button>
            )}
          </div>
          )
        ) : visible.length===0 ? (
          <div className="brutti-album__empty">
            <ImageOff size={28}/>
            <strong>{search || filter!=="all" || category!=="all" ? "No matching photos" : "Your Album is ready"}</strong>
            <p>{search || filter!=="all" || category!=="all" ? "Try a different search or filter." : "Upload product photos to keep them organised here."}</p>
          </div>
        ) : viewMode === "table" ? (
          <AlbumPhotoTable
            photos={visible}
            categories={categories}
            publishedIds={publishedIds}
            picker={picker}
            selectedKeys={selected}
            excludedUrls={excludedUrls}
            onView={openPhotoEditor}
            onSelect={toggle}
            onEditCover={setEditingAlbumPhoto}
          />
        ) : (
          <div className="brutti-album__grid">
            {visible.map(photo=>{
              const checked=selected.includes(photo.key);
              const disabled=picker && excludedUrls.includes(photo.url);
              return <div key={photo.key} className={`brutti-album__card${checked?" is-selected":""}`}>
                <button type="button" className="brutti-album__thumb" onClick={()=>picker?toggle(photo):openPhotoEditor(photo)} disabled={disabled} aria-label={picker?`Select ${photo.name}`:`Edit ${photo.name}`}>
                  <SafeImage src={photo.url} alt={photo.name} loading="lazy"/>
                  {picker && <span className="brutti-album__check">{checked?<Check size={16}/>:disabled?"Added":<span/>}</span>}
                </button>
                <div className="brutti-album__card-info">
                  <strong title={photo.name}>{photo.name}</strong>
                  <small>{disabled?"Already added":photo.usedBy.length?`${photo.usedBy.length} product${photo.usedBy.length>1?"s":""}`:photo.categoryCovers.length?"Category cover":photo.sourceKind==="external"?"Product Library":"Unassigned"}</small>
                  <span className="brutti-album__list-category" title="Photo category">
                    {albumPhotoCategoryIds(photo).map(id=>categories.find(item=>item.id===id)?.name).filter(Boolean).join(", ") || "Uncategorised"}
                  </span>
                  {!picker && <div className="brutti-album__card-actions">
                    <button type="button" onClick={()=>openPhotoEditor(photo)} aria-label={"Open editor for " + photo.name}><Eye size={14}/> Open</button>
                    <button type="button" onClick={()=>setEditingAlbumPhoto(photo)} aria-label={"Edit background and cover for " + photo.name}><Crop size={14}/> Edit cover</button>
                  </div>}
                </div>
              </div>;
            })}
          </div>
        )}
      {picker && <div className="brutti-album__picker-footer">
        <span>{selectedPhotos.length} / {maxSelect} selected</span>
        <div>
          <button type="button" className="brutti-album__secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="brutti-album__primary" disabled={!selectedPhotos.length||busy} onClick={()=>onSelect?.(selectedPhotos)}>
            <Check size={16}/> Add {selectedPhotos.length||""} photos
          </button>
        </div>
      </div>}
      {preview && <Modal title={detailsDraft.name || preview.name} eyebrow="BRUTTI CATALOG / PHOTO EDITOR" className="brutti-album-preview-modal brutti-album-editor-dialog" onClose={closePhotoEditor}>
        <div className="brutti-album__editor-canvas">
          <section className="brutti-album__editor-section">
            <header className="brutti-album__editor-section-heading">
              <span className="brutti-album__editor-step">01</span>
              <h3>Details</h3>
            </header>
            <div className="brutti-album__editable-details">
              <label className="brutti-album__editor-field">
                <span>Name <b aria-hidden="true">*</b></span>
                <input type="text" maxLength={120} required value={detailsDraft.name}
                  placeholder="e.g. Sulob Shoe Rack"
                  disabled={savingDetails}
                  onChange={e => setDetailsDraft(current => ({...current,name:e.target.value}))}/>
              </label>
              <div className="brutti-album__field-pair">
                <div className="brutti-album__editor-field">
                  <span>Product ID</span>
                  <output className="brutti-album__reference-id">
                    <strong>{preview.sourceCode || "Assigned in Product Editor"}</strong>
                    <LockKeyhole size={16} strokeWidth={1.8} aria-hidden="true"/>
                  </output>
                  <small>{preview.sourceCode
                    ? "Original library reference · cannot be changed here"
                    : "A unique Product ID is generated when you create the product"}</small>
                </div>
                <div className="brutti-album__editor-field">
                  <span>Category</span>
                  <AlbumCategorySelect
                    categories={categories}
                    value={detailsDraft.categoryId || "none"}
                    disabled={savingDetails || !preview.id}
                    onChange={value => setDetailsDraft(current => ({...current,categoryId:value === "none" ? null : value}))}
                  />
                  <small>Saved in Album; used as the initial category for a new product.</small>
                </div>
              </div>
              <label className="brutti-album__editor-field">
                <span>Description <small>Optional until product publishing</small></span>
                <textarea rows={4} maxLength={10000} value={detailsDraft.description}
                  placeholder="Describe the furniture, materials, finish or important photo notes."
                  disabled={savingDetails}
                  onChange={e => setDetailsDraft(current => ({...current,description:e.target.value}))}/>
              </label>
              {detailsError && <p className="brutti-album__error" role="alert">{detailsError}</p>}
              {!preview.id && <p className="brutti-album__details-note">This image has no Album record yet. You can open its linked product, but Album metadata cannot be saved until it is indexed.</p>}
            </div>
          </section>
          <section className="brutti-album__editor-section">
            <header className="brutti-album__editor-section-heading">
              <span className="brutti-album__editor-step">02</span>
              <h3>Media <small>(Photo)</small></h3>
            </header>
            <div className="brutti-album__editor-media">
              <div className="brutti-album__editor-media-image">
                <SafeImage src={preview.url} alt={preview.name}/>
                <span><Images size={15} aria-hidden="true"/> Brutti Catalog media</span>
              </div>
              <div className="brutti-album__editor-media-tools">
                <span className="brutti-album__photo-status">
                  <span className={preview.usedBy.length || preview.categoryCovers.length ? "is-in-use" : "is-available"} aria-hidden="true"/>
                  {preview.usedBy.length
                    ? `Used in ${preview.usedBy.length} product${preview.usedBy.length===1?"":"s"}`
                    : preview.categoryCovers.length ? "Used as category cover"
                      : preview.sourceKind==="external" ? "Product Library · Available" : "Unassigned photo"}
                </span>
                <button type="button" className="brutti-album__edit-cover"
                  disabled={savingDetails || busy}
                  onClick={() => setEditingAlbumPhoto(preview)}>
                  <Images size={16} aria-hidden="true"/> Edit cover · Cutout, background, crop & zoom
                </button>
                {preview.sourceKind === "external" && <div className="brutti-album__source-details">
                  <span className="brutti-album__detail-label">ORIGINAL PRODUCT LIBRARY INFO</span>
                  <dl>
                    {(["category","size","materials","colour","finishing"] as const)
                      .filter(field=>preview.sourceDetails[field]).map(field=>(
                      <div key={field}><dt>{field==="colour"?"Colour":field==="size"?"Size":field==="materials"?"Materials":field==="finishing"?"Finishing":"Category"}</dt>
                        <dd>{preview.sourceDetails[field]}</dd></div>
                    ))}
                  </dl>
                  <p>Original source image is retained. Album changes do not alter the original file.</p>
                </div>}
                {!!preview.categoryCovers.length && <p className="brutti-album__category-note">Category cover: {preview.categoryCovers.join(", ")}</p>}
                {!!preview.usedBy.length && <div className="brutti-album__detail-related">
                  <span className="brutti-album__detail-label">USED IN PRODUCTS</span>
                  {preview.usedBy.map(product => <button type="button" className="brutti-album__linked-product" key={product.id}
                    onClick={()=>{setPreview(null);onEditProduct?.(product.id);}}>
                    <Package size={17} aria-hidden="true"/><span>{product.name}</span><ArrowUpRight size={16} aria-hidden="true"/>
                  </button>)}
                </div>}
                {!picker && onAttachPhotoToProduct && <div className="brutti-album__attach-product">
                  <span className="brutti-album__detail-label">ADD TO EXISTING PRODUCT</span>
                  <div className="brutti-album__attach-product-row">
                    <select value={attachProductId} onChange={e => setAttachProductId(e.target.value)}
                      aria-label="Choose product to attach photo">
                      <option value="">Choose a product</option>
                      {products.map(product=><option key={product.id} value={product.id}>{product.sku || "No ID"} · {product.name}</option>)}
                    </select>
                    <button type="button" disabled={!attachProductId || savingDetails}
                      onClick={() => void startProductFromPhoto(preview,attachProductId)}>
                      <Plus size={15} aria-hidden="true"/> Add photo
                    </button>
                  </div>
                  <small>Opens Product Editor with this photo attached. Save the product there to confirm.</small>
                </div>}
                {downloadError && <p className="brutti-album__error" role="alert">{downloadError}</p>}
                <div className="brutti-album__detail-download">
                  <span className="brutti-album__detail-label">DOWNLOAD PHOTO</span>
                  <div className="brutti-album__format-switch" role="group" aria-label="Download file format">
                    {(["jpg","png","webp"] as const).map(format => (
                      <button key={format} type="button"
                        className={downloadFormat === format ? "is-selected" : ""}
                        aria-pressed={downloadFormat === format}
                        disabled={downloading} onClick={() => setDownloadFormat(format)}>
                        {format === "jpg" ? "JPG" : format === "png" ? "PNG" : "WebP"}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="brutti-album__primary brutti-album__download-main"
                    disabled={downloading} onClick={()=>void download(preview)}>
                    {downloading ? <LoaderCircle size={17} className="brutti-album__spin" aria-hidden="true"/> : <Download size={17} aria-hidden="true"/>}
                    {downloading ? "Preparing image…" : `Download ${downloadFormat.toUpperCase()}`}
                  </button>
                </div>
                <div className="brutti-album__detail-bottom">
                  {preview.usedBy.length || preview.categoryCovers.length || !preview.id
                    ? <span className="brutti-album__protected-photo"><Check size={15}/> In use · Protected from deletion</span>
                    : <button type="button" className="brutti-album__delete"
                        disabled={deleting} onClick={() => requestDelete(preview)}>
                        <Trash2 size={15} aria-hidden="true"/> Delete photo
                      </button>}
                </div>
              </div>
            </div>
          </section>
        </div>
        <footer className="brutti-album__editor-footer">
          <span>Changes are saved when you select Save details. Publishing happens in Product Editor.</span>
          <div className="brutti-album__editor-footer-actions">
            <button type="button" className="brutti-album__editor-back"
              disabled={savingDetails} onClick={closePhotoEditor}>
              <ArrowLeft size={16} aria-hidden="true"/> Back
            </button>
            <button type="button" className="brutti-album__editor-edit"
              disabled={savingDetails || !detailsDraft.name.trim() || !preview.id || !detailsDirty}
              onClick={()=>void persistPhotoDetails(preview)}>
              {savingDetails ? <LoaderCircle size={16} className="brutti-album__spin"/> : <Save size={16}/>}
              {savingDetails ? "Saving…" : "Save details"}
            </button>
            {onCreateProductFromPhoto && <button type="button" className="brutti-album__editor-create"
              disabled={savingDetails || !detailsDraft.name.trim()}
              onClick={()=>void startProductFromPhoto(preview)}>
              <Plus size={16} aria-hidden="true"/> Create product
            </button>}
          </div>
        </footer>
      </Modal>}
      {deleteTarget && <Modal
        title="Delete photo?"
        eyebrow="BRUTTI / ALBUM"
        className="brutti-album-delete-confirm-modal"
        onClose={closeDeleteConfirmation}
      >
        <div className="brutti-album__delete-confirm-body">
          <span className="brutti-album__delete-confirm-icon">
            <AlertTriangle size={22} strokeWidth={1.8} aria-hidden="true"/>
          </span>
          <p className="brutti-album__delete-confirm-heading">Remove this photo from Album?</p>
          <p className="brutti-album__delete-confirm-name">{deleteTarget.name}</p>
          <p className="brutti-album__delete-confirm-message">
            {deleteTarget.sourceKind === "external"
              ? "This removes the photo reference from Brutti Album only. The original image on GitHub or Google will not be deleted."
              : "This permanently removes the photo from Album and deletes its stored image. This action cannot be undone."}
          </p>
          {deleteError && <p className="brutti-album__delete-confirm-error" role="alert">{deleteError}</p>}
        </div>
        <div className="brutti-album__delete-confirm-actions">
          <button type="button" className="brutti-album__delete-confirm-cancel"
            disabled={deleting} onClick={closeDeleteConfirmation}>Cancel</button>
          <button type="button" className="brutti-album__delete-confirm-submit"
            disabled={deleting} onClick={() => void confirmDelete()}>
            {deleting ? <LoaderCircle size={16} className="brutti-album__spin" aria-hidden="true"/>
              : <Trash2 size={16} aria-hidden="true"/>}
            {deleting ? "Deleting…" : "Yes, delete photo"}
          </button>
        </div>
      </Modal>}
      {editingAlbumPhoto && (
        <PhotoCoverStudio
          key={editingAlbumPhoto.key}
          imageUrl={editingAlbumPhoto.url}
          imageName={editingAlbumPhoto.name}
          saveLabel="Save edited photo to Album"
          onClose={() => setEditingAlbumPhoto(null)}
          onSave={async file => {
            const result = await uploadAlbumPhotos([file], editingAlbumPhoto.manualCategoryId);
            if (result.failures.length) throw new Error(result.failures.join(" | "));
            if (!result.uploaded.length) throw new Error("Edited image was not saved. Please try again.");
            setRecords(old => [...result.uploaded, ...old]);
            setEditingAlbumPhoto(null);
            setPreview(null);
            setNotice("Edited image saved as a new Album photo. You can choose it from Product Editor for any product cover.");
          }}
        />
      )}
    </section>
  );
}
