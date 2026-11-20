import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Images, Upload, Download, Search, Check, Trash2, LoaderCircle, Eye,
  Package, Layers, RefreshCw, ImageOff, ArrowUpRight, Folder, FolderOpen, Plus, ArrowLeft, ChevronDown, Crop, Grid2X2, Table2,
} from "lucide-react";
import type { Category, Product } from "../lib/types";
import {
  albumPhotoCategoryIds, combineAlbumPhotos, listAlbumRecords,
  removeUnassignedAlbumPhoto, setAlbumPhotoCategory, uploadAlbumPhotos,
  type AlbumPhoto, type AlbumRecord,
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
  products, categories, onSelect, onEditProduct, onAddCategory, onClose,
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
  const [categorising, setCategorising] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<AlbumPhoto | null>(null);
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
  async function assignCategory(photo: AlbumPhoto, next: string) {
    if (!photo.id || categorising) {
      setDownloadError("This photo needs an Album record first. Refresh and retry.");
      return;
    }
    setCategorising(true); setDownloadError("");
    try {
      const chosen = next === "none" ? null : next;
      const saved = await setAlbumPhotoCategory(photo.id, chosen);
      setRecords(old => old.map(item =>
        item.id === photo.id ? { ...item, category_id: saved } : item
      ));
      setPreview(current =>
        current && current.id === photo.id ? { ...current, manualCategoryId: saved } : current
      );
      setNotice("Photo category updated.");
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Could not save the category.");
    } finally {
      setCategorising(false);
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
  async function remove(photo: AlbumPhoto) {
    if(photo.usedBy.length||photo.categoryCovers.length){
      setError("This photo is used by a product or category. Remove those links first.");
      return;
    }
    if(!photo.id){setError("This photo has no Album record. Refresh and try again.");return;}
    if(!window.confirm(`Permanently delete "${photo.name}" from Album storage? This cannot be undone.`))return;
    setError("");setNotice("");
    try{
      await removeUnassignedAlbumPhoto(photo);
      setRecords(old=>old.filter(item=>item.id!==photo.id));
      setPreview(null);
      setSelected(ids=>ids.filter(id=>id!==photo.key));
      setNotice("Unassigned photo removed.");
    }catch(e){setError(e instanceof Error?e.message:"Could not remove the photo.");void reload();}
  }
  const selectedPhotos=photos.filter(p=>selected.includes(p.key));
  return (
    <section className={`brutti-album ${picker?"brutti-album--picker":""}`} aria-label={picker?"Choose photos from Album":"Brutti media Album"}>
      {!picker && (
        <div className="brutti-album__heading">
          <div>
            <p className="brutti-album__eyebrow">BRUTTI CATALOG / MEDIA LIBRARY</p>
            <h1>Album</h1>
            <p>One place for your furniture photos. Upload once, reuse across products.</p>
          </div>
          <div className="brutti-album__heading-actions">
            <span className="brutti-album__total"><Images size={17}/><strong>{photos.length}</strong> photos</span>
            {onAddCategory && <button type="button" className="brutti-album__secondary" onClick={onAddCategory}>
              <Plus size={16}/> Add category
            </button>}
            <label className="brutti-album__destination">
              Add photos to
              <select aria-label="Category for new uploads" value={uploadCategory}
                onChange={event=>setUploadCategory(event.target.value)} disabled={busy}>
                <option value="none">Uncategorised</option>
                {categories.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
            </label>
            <button type="button" className="brutti-album__primary" onClick={()=>fileRef.current?.click()} disabled={busy}>
              <Upload size={17}/> Add photos
            </button>
          </div>
        </div>
      )}
      {picker && <div className="brutti-album__picker-intro">
        Choose up to {maxSelect} images to attach. Existing images will be linked, not uploaded twice.
      </div>}
      <input type="file" ref={fileRef} hidden multiple accept="image/jpeg,image/png,image/webp"
        onChange={e=>void upload(e.target.files)} disabled={busy}/>
      <div className="brutti-album__stats" aria-label="Album counts">
        <span><strong>{photos.length}</strong> All photos</span>
        <span><strong>{assigned}</strong> In use</span>
        <span><strong>{publishedCount}</strong> Published</span>
      </div>
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
            onView={setPreview}
            onSelect={toggle}
            onEditCover={setEditingAlbumPhoto}
          />
        ) : (
          <div className="brutti-album__grid">
            {visible.map(photo=>{
              const checked=selected.includes(photo.key);
              const disabled=picker && excludedUrls.includes(photo.url);
              return <div key={photo.key} className={`brutti-album__card${checked?" is-selected":""}`}>
                <button type="button" className="brutti-album__thumb" onClick={()=>picker?toggle(photo):setPreview(photo)} disabled={disabled} aria-label={picker?`Select ${photo.name}`:`Preview ${photo.name}`}>
                  <SafeImage src={photo.url} alt={photo.name} loading="lazy"/>
                  {picker && <span className="brutti-album__check">{checked?<Check size={16}/>:disabled?"Added":<span/>}</span>}
                </button>
                <div className="brutti-album__card-info">
                  <strong title={photo.name}>{photo.name}</strong>
                  <small>{disabled?"Already added":photo.usedBy.length?`${photo.usedBy.length} product${photo.usedBy.length>1?"s":""}`:photo.categoryCovers.length?"Category cover":"Unassigned"}</small>
                  <span className="brutti-album__list-category" title="Photo category">
                    {albumPhotoCategoryIds(photo).map(id=>categories.find(item=>item.id===id)?.name).filter(Boolean).join(", ") || "Uncategorised"}
                  </span>
                  {!picker && <div className="brutti-album__card-actions">
                    <button type="button" onClick={()=>setPreview(photo)} aria-label={"View details for " + photo.name}><Eye size={14}/> View</button>
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
      {preview && <Modal title="Photo details" eyebrow="BRUTTI / ALBUM" className="brutti-album-preview-modal" onClose={()=>setPreview(null)}>
        <div className="brutti-album__detail-layout">
          <div className="brutti-album__detail-visual">
            <div className="brutti-album__preview-image"><SafeImage src={preview.url} alt={preview.name}/></div>
            <div className="brutti-album__visual-caption">
              <Images size={15} aria-hidden="true"/>
              <span>Brutti Catalog media</span>
            </div>
          </div>
          <div className="brutti-album__detail-content">
            <div className="brutti-album__preview-info">
              <span className="brutti-album__detail-label">PRODUCT PHOTO</span>
              <h3>{preview.name}</h3>
              <span className="brutti-album__photo-status">
                <span className={preview.usedBy.length || preview.categoryCovers.length ? "is-in-use" : "is-available"} aria-hidden="true"/>
                {preview.usedBy.length
                  ? `Used in ${preview.usedBy.length} product${preview.usedBy.length===1?"":"s"}`
                  : preview.categoryCovers.length ? "Used as category cover" : "Unassigned photo"}
              </span>
            </div>
            {preview.usedBy.length>0 && <div className="brutti-album__detail-related">
              <span className="brutti-album__detail-label">LINKED PRODUCTS</span>
              {preview.usedBy.map(p=><button type="button" className="brutti-album__linked-product" key={p.id} onClick={()=>{setPreview(null);onEditProduct?.(p.id);}}>
                <Package size={17} aria-hidden="true"/><span>{p.name}</span><ArrowUpRight size={16} aria-hidden="true"/>
              </button>)}
            </div>}
            {!!preview.categoryCovers.length && <p className="brutti-album__category-note">Category cover: {preview.categoryCovers.join(", ")}</p>}
            {!picker && <div className="brutti-album__assign-category">
              <span id="brutti-album-photo-category-label">Album category</span>
              <AlbumCategorySelect
                categories={categories}
                value={preview.manualCategoryId || "none"}
                disabled={categorising || !preview.id}
                onChange={value=>void assignCategory(preview,value)}
              />
              <small>Organise this photo in Album. Product categories remain unchanged.</small>
            </div>}
            {!picker && (
              <button type="button" className="brutti-album__edit-cover"
                onClick={() => setEditingAlbumPhoto(preview)} disabled={downloading || busy}>
                <Images size={16} aria-hidden="true" /> Edit cover · Cutout, background, crop & zoom
              </button>
            )}
            {downloadError && <p className="brutti-album__error" role="alert">{downloadError}</p>}
            <div className="brutti-album__detail-download">
              <span className="brutti-album__detail-label">DOWNLOAD PHOTO</span>
              <div className="brutti-album__format-switch" role="group" aria-label="Download file format">
                {(["jpg", "png", "webp"] as const).map(format => (
                  <button
                    key={format}
                    type="button"
                    className={downloadFormat === format ? "is-selected" : ""}
                    aria-pressed={downloadFormat === format}
                    disabled={downloading}
                    onClick={() => setDownloadFormat(format)}
                  >
                    {format === "jpg" ? "JPG" : format === "png" ? "PNG" : "WebP"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="brutti-album__primary brutti-album__download-main"
                disabled={downloading}
                onClick={() => void download(preview)}
              >
                {downloading
                  ? <LoaderCircle size={17} className="brutti-album__spin" aria-hidden="true"/>
                  : <Download size={17} aria-hidden="true"/>}
                {downloading ? "Preparing image…" : `Download ${downloadFormat.toUpperCase()}`}
              </button>
              <p className="brutti-album__download-help">
                Saved as an image file, not an HTML page.
              </p>
            </div>
            <div className="brutti-album__detail-bottom">
              {!picker && (
                preview.usedBy.length || preview.categoryCovers.length || !preview.id
                  ? <span className="brutti-album__protected-photo">
                      <Check size={15} aria-hidden="true"/> In use · Protected from deletion
                    </span>
                  : <button type="button" className="brutti-album__delete"
                      onClick={() => void remove(preview)}>
                      <Trash2 size={15} aria-hidden="true"/> Delete photo
                    </button>
              )}
            </div>
          </div>
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
