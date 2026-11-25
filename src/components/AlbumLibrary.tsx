import { useEffect, useMemo, useRef, useState } from "react";
import {
  Images, Upload, Download, Search, Check, Trash2, LoaderCircle, Eye,
  Package, Layers, RefreshCw, ImageOff, ArrowUpRight, Folder, FolderOpen, Plus, ArrowLeft, ChevronDown, Crop, Grid2X2, Table2, AlertTriangle, LockKeyhole, Save, X,
} from "lucide-react";
import type { Category, Product } from "../lib/types";
import {
  albumPhotoCategoryIds, combineAlbumPhotos, listAlbumRecords,
  removeUnassignedAlbumPhoto, saveAlbumPhotoDetails, albumDetailSpec, uploadAlbumPhotos,
  type AlbumPhoto, type AlbumRecord, type AlbumPhotoDetailsUpdate,
} from "../lib/album";
import EditorCategoryPicker from "./EditorCategoryPicker";
import Modal from "./Modal";
import SafeImage from "./SafeImage";
import { AlbumCategoryTable, AlbumPhotoTable } from "./AlbumTableView";
import PhotoCoverStudio from "./PhotoCoverStudio";
import { downloadCatalogPhoto, downloadCatalogPhotosHtml, type PhotoDownloadFormat } from "../lib/photo-download";
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

export default function AlbumLibrary({
  products, categories, onSelect, onEditProduct, onCreateProductFromPhoto, onAttachPhotoToProduct, onAddCategory, onClose,
  maxSelect = 8, excludedUrls = [],
}: Props) {
  const picker = Boolean(onSelect);
  const [records, setRecords] = useState<AlbumRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "by-category" | "by-product" | "published">(picker?"all":"by-product");
  const [selectedProductFolder, setSelectedProductFolder] = useState<string | null>(null);
  const [exportingFolder, setExportingFolder] = useState(false);
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
    name: "", description: "", categoryId: null, size: "", materials: "", colour: "", finishing: "",
  });
  const editorCanvasRef = useRef<HTMLDivElement>(null);
  const [attachProductId, setAttachProductId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<AlbumPhoto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AlbumPhoto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [editingAlbumPhoto, setEditingAlbumPhoto] = useState<AlbumPhoto | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<PhotoDownloadFormat | "html">("jpg");
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
    setSelectedProductFolder(null);
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
  // Group by the real product UUID, never by filename or similar-looking photos.
  // Preserve product image order (the first image is its cover).
  const productGroups = useMemo(() => {
    const byKey = new Map(photos.map(photo=>[photo.key,photo]));
    const byUrl = new Map(photos.map(photo=>[photo.url,photo]));
    return products.map(product=>({
      product,
      items: product.images.flatMap((image,index)=>{
        const photo=byKey.get(image.storagePath || image.url) || byUrl.get(image.url);
        return photo?[{...photo,name:`${product.name}_${index+1}`}]:[];
      }),
    })).filter(group=>group.items.length>0);
  },[photos,products]);
  const productNames = useMemo(()=>{
    const names=new Map<string,string>();
    for(const group of productGroups) for(const photo of group.items)
      if(!names.has(photo.key))names.set(photo.key,photo.name);
    return names;
  },[productGroups]);
  const standalonePhotos=photos.filter(photo=>photo.usedBy.length===0);
  const currentProductGroup=productGroups.find(group=>group.product.id===selectedProductFolder);
  const needle=search.trim().toLowerCase();
  const inCategoryFolder = filter==="by-category" && selectedFolder!==null;
  const showProductFolders = filter==="by-product" || inCategoryFolder;
  const matchesFolderCategory = (id: string) => inCategoryFolder
    ? (selectedFolder==="__uncategorized__" ? !id || !categories.some(item=>item.id===id) : id===selectedFolder)
    : category==="all" || id===category;
  const matchingProductGroups=productGroups.filter(({product,items})=>
    matchesFolderCategory(product.categoryId) &&
    (!needle || [product.name,product.sku,categories.find(item=>item.id===product.categoryId)?.name || ""].some(value=>value.toLowerCase().includes(needle))
      || items.some(photo=>(photo.name+" "+(photos.find(item=>item.key===photo.key)?.name || "")).toLowerCase().includes(needle))));
  const matchingStandalone=standalonePhotos.filter(photo=>{
    const ids=albumPhotoCategoryIds(photo);
    const inScope=inCategoryFolder
      ? (selectedFolder==="__uncategorized__" ? ids.length===0 : ids.includes(selectedFolder!))
      : category==="all" || ids.includes(category);
    return inScope && (!needle || photo.name.toLowerCase().includes(needle));
  });
  const displayedPhotos=showProductFolders
    ? selectedProductFolder==="__standalone__"?matchingStandalone:currentProductGroup?.items || []
    : visible.map(photo=>({...photo,name:productNames.get(photo.key) || photo.name}));
  const displayedName=(photo:AlbumPhoto)=>currentProductGroup?.items.find(item=>item.key===photo.key)?.name || productNames.get(photo.key) || photo.name;
  async function exportProductFolder() {
    if(exportingFolder || !displayedPhotos.length)return;
    setExportingFolder(true);setError("");
    try {
      await downloadCatalogPhotosHtml(currentProductGroup?.product.name || "Unassigned photos",displayedPhotos);
    } catch(error) {setError(error instanceof Error?error.message:"HTML export failed.");}
    finally {setExportingFolder(false);}
  }
  const folderTitle = selectedFolder === "__uncategorized__" ? "Uncategorised" :
    categories.find(item => item.id === selectedFolder)?.name || "Category";
  function selectFilter(next: "all" | "by-category" | "by-product" | "published") {
    setSelectedProductFolder(null);
    setFilter(next);
    setSelectedFolder(null);
    setCategory("all");
    setCategoryMenuOpen(false);
    if (next !== "by-category") setUploadCategory("none");
  }
  function openFolder(id: string) {
    setFilter("by-category");
    setSelectedProductFolder(null);
    setSelectedFolder(id);
    setUploadCategory(id === "__uncategorized__" ? "none" : id);
  }
  // Product-linked photos should open the real Product Editor, as product cards do.
  // Standalone Album/legacy library photos do not have a product record, so open
  // the matching Photo Editor instead of inventing an editable product.
  function openPhotoEditor(photo: AlbumPhoto) {
    // Display names are generated per product; preserve the original media metadata.
    photo = photos.find(item=>item.key===photo.key) || photo;
    setDownloadError("");
    setDownloadFormat("jpg");
    // Album is the media library. Open its Photo Editor for every image,
    // including images linked to a Product. Product Editor stays available
    // via explicit linked-product actions and Create Product.
    setDetailsDraft({
      name: photo.name,
      description: photo.sourceDetails.description || "",
      categoryId: photo.manualCategoryId,
      size: albumDetailSpec(photo, "size"),
      materials: albumDetailSpec(photo, "materials"),
      colour: albumDetailSpec(photo, "colour"),
      finishing: albumDetailSpec(photo, "finishing"),
    });
    setAttachProductId("");
    setDetailsError("");
    setPreview(photo);
  }
  const detailsDirty = !!preview && (
    detailsDraft.name !== preview.name ||
    detailsDraft.description !== (preview.sourceDetails.description || "") ||
    detailsDraft.categoryId !== preview.manualCategoryId ||
    (["size", "materials", "colour", "finishing"] as const)
      .some(field => detailsDraft[field] !== albumDetailSpec(preview, field))
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
        size: saved.sourceDetails.album_size ?? saved.sourceDetails.size ?? "",
        materials: saved.sourceDetails.album_materials ?? saved.sourceDetails.materials ?? "",
        colour: saved.sourceDetails.album_colour ?? saved.sourceDetails.colour ?? "",
        finishing: saved.sourceDetails.album_finishing ?? saved.sourceDetails.finishing ?? "",
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
      size: detailsDraft.size,
      materials: detailsDraft.materials,
      colour: detailsDraft.colour,
      finishing: detailsDraft.finishing,
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
      const namedPhoto={url:photo.url,storagePath:photo.storagePath,name:displayedName(photo)};
      if(downloadFormat==="html")await downloadCatalogPhotosHtml(namedPhoto.name,[namedPhoto]);
      else await downloadCatalogPhoto(namedPhoto,downloadFormat);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Image download failed.");
    } finally {
      setDownloading(false);
    }
  }
  function requestDelete(photo: AlbumPhoto) {
    photo = photos.find(item=>item.key===photo.key) || photo;
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
          <button type="button" className={filter==="by-product"?"is-current":""} aria-pressed={filter==="by-product"} onClick={()=>selectFilter("by-product")}><Package size={14}/> By product</button>
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
        <button type="button" onClick={()=>{setSelectedProductFolder(null);setSelectedFolder(null);}}><ArrowLeft size={16}/> All categories</button>
        <span aria-hidden="true">/</span>
        {selectedProductFolder!==null ? <button type="button" onClick={()=>setSelectedProductFolder(null)}>{folderTitle}</button> : <strong>{folderTitle}</strong>}
        {selectedProductFolder!==null && <>
          <span aria-hidden="true">/</span>
          <strong>{currentProductGroup?.product.name || "Unassigned photos"}{currentProductGroup?.product.sku ? ` · ${currentProductGroup.product.sku}` : ""}</strong>
        </>}
        <span className="brutti-album__folder-items">{selectedProductFolder===null ? `${matchingProductGroups.length} products` : `${displayedPhotos.length} photos`}</span>
        {selectedProductFolder!==null && !picker && <button type="button" className="brutti-album__folder-add" disabled={exportingFolder||!displayedPhotos.length}
          onClick={()=>void exportProductFolder()}>{exportingFolder?<LoaderCircle size={16} className="brutti-album__spin"/>:<Download size={16}/>} Download HTML</button>}
        {selectedProductFolder===null && <button type="button" className="brutti-album__folder-add" disabled={busy}
          onClick={()=>{setUploadCategory(selectedFolder==="__uncategorized__"?"none":selectedFolder);fileRef.current?.click();}}>
          <Plus size={16}/> Add photos
        </button>}
      </div>}
      {filter==="by-product" && selectedProductFolder!==null && <div className="brutti-album__folder-path">
        <button type="button" onClick={()=>setSelectedProductFolder(null)}><ArrowLeft size={16}/> All products</button>
        <span aria-hidden="true">/</span>
        <strong>{currentProductGroup?.product.name || "Unassigned photos"}</strong>
        <span className="brutti-album__folder-items">{displayedPhotos.length} photos</span>
        {!picker && <button type="button" className="brutti-album__folder-add" disabled={exportingFolder||!displayedPhotos.length}
          onClick={()=>void exportProductFolder()}>{exportingFolder?<LoaderCircle size={16} className="brutti-album__spin"/>:<Download size={16}/>} Download HTML</button>}
      </div>}
      {progress && <p className="brutti-album__message" role="status"><LoaderCircle className="brutti-album__spin" size={16}/> Uploading {progress.done} / {progress.total} photos…</p>}
      {error && <p className="brutti-album__error" role="alert">{error}</p>}
      {notice && <p className="brutti-album__success" role="status">{notice}</p>}
      {loading ? <div className="brutti-album__empty" role="status"><LoaderCircle className="brutti-album__spin"/>Loading your photos…</div> :
        showProductFolders && selectedProductFolder===null ? (
          !matchingProductGroups.length && !matchingStandalone.length ? <div className="brutti-album__empty"><ImageOff size={28}/><strong>No matching products or photos</strong></div> :
          viewMode==="table" ? (
            <div className="brutti-album__table-shell"><table className="brutti-album__table brutti-album__table--folders">
              <thead><tr><th scope="col">Cover</th><th scope="col">Product</th><th scope="col">Photos</th><th scope="col">Action</th></tr></thead>
              <tbody>{matchingProductGroups.map(({product,items})=><tr key={product.id}>
                <td className="brutti-album__table-preview"><span className="brutti-album__table-thumb"><SafeImage src={items[0].url} alt="" loading="lazy"/></span></td>
                <td className="brutti-album__table-title"><strong>{product.name}</strong><small>{product.sku}</small></td>
                <td className="brutti-album__table-count">{items.length} photos</td>
                <td className="brutti-album__table-action"><button type="button" onClick={()=>setSelectedProductFolder(product.id)}>Open <ArrowUpRight size={15}/></button></td>
              </tr>)}
              {!!matchingStandalone.length&&<tr><td className="brutti-album__table-preview"><span className="brutti-album__table-thumb"><Folder size={24}/></span></td><td className="brutti-album__table-title"><strong>Unassigned photos</strong><small>Not linked to a product</small></td><td className="brutti-album__table-count">{matchingStandalone.length} photos</td><td className="brutti-album__table-action"><button type="button" onClick={()=>setSelectedProductFolder("__standalone__")}>Open <ArrowUpRight size={15}/></button></td></tr>}
              </tbody></table></div>
          ) : (
            <div className="brutti-album__grid" aria-label="Photo folders by product">
              {matchingProductGroups.map(({product,items})=><div className="brutti-album__card" key={product.id}>
                <button type="button" className="brutti-album__thumb" aria-label={`Open ${product.name}: ${items.length} photos`} onClick={()=>setSelectedProductFolder(product.id)}>
                  <SafeImage src={items[0].url} alt={product.name} loading="lazy"/>
                </button>
                <div className="brutti-album__card-info">
                  <strong title={product.name}>{product.name}</strong>
                  <small>{product.sku} · {items.length} photo{items.length===1?"":"s"}</small>
                  <span className="brutti-album__list-category">{categories.find(item=>item.id===product.categoryId)?.name || "Uncategorised"}</span>
                  <div className="brutti-album__card-actions"><button type="button" onClick={()=>setSelectedProductFolder(product.id)}><FolderOpen size={14}/> Open photos</button>
                    {!picker && onEditProduct && <button type="button" onClick={()=>onEditProduct(product.id)}><Package size={14}/> Product</button>}
                  </div>
                </div>
              </div>)}
              {!!matchingStandalone.length&&<div className="brutti-album__card">
                <button type="button" className="brutti-album__thumb" onClick={()=>setSelectedProductFolder("__standalone__")} aria-label="Open unassigned photos"><SafeImage src={matchingStandalone[0].url} alt="" loading="lazy"/></button>
                <div className="brutti-album__card-info"><strong>Unassigned photos</strong><small>{matchingStandalone.length} photos</small><div className="brutti-album__card-actions"><button type="button" onClick={()=>setSelectedProductFolder("__standalone__")}><FolderOpen size={14}/> Open photos</button></div></div>
              </div>}
            </div>
          )
        ) : filter === "by-category" && selectedFolder === null ? (
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
        ) : displayedPhotos.length===0 ? (
          <div className="brutti-album__empty">
            <ImageOff size={28}/>
            <strong>{search || filter!=="all" || category!=="all" ? "No matching photos" : "Your Album is ready"}</strong>
            <p>{search || filter!=="all" || category!=="all" ? "Try a different search or filter." : "Upload product photos to keep them organised here."}</p>
          </div>
        ) : viewMode === "table" ? (
          <AlbumPhotoTable
            photos={displayedPhotos}
            categories={categories}
            publishedIds={publishedIds}
            picker={picker}
            selectedKeys={selected}
            excludedUrls={excludedUrls}
            onView={openPhotoEditor}
            onSelect={toggle}
            onEditCover={setEditingAlbumPhoto}
            onDelete={requestDelete}
          />
        ) : (
          <div className="brutti-album__grid">
            {displayedPhotos.map(photo=>{
              const checked=selected.includes(photo.key);
              const disabled=picker && excludedUrls.includes(photo.url);
              return <div key={photo.key} className={`brutti-album__card${checked?" is-selected":""}`} style={{position:"relative"}}>
                <button type="button" className="brutti-album__thumb" onClick={()=>picker?toggle(photo):openPhotoEditor(photo)} disabled={disabled} aria-label={picker?`Select ${photo.name}`:`Edit ${photo.name}`}>
                  <SafeImage src={photo.url} alt={photo.name} loading="lazy"/>
                  {picker && <span className="brutti-album__check">{checked?<Check size={16}/>:disabled?"Added":<span/>}</span>}
                </button>
                {!picker && !photo.usedBy.length && !photo.categoryCovers.length && photo.id && <button type="button" title="Delete photo" aria-label={`Delete ${photo.name}`} disabled={deleting} onClick={()=>requestDelete(photo)}
                  style={{position:"absolute",top:10,right:10,zIndex:6,display:"grid",placeItems:"center",width:34,height:34,padding:0,border:"1px solid #f3c7c9",borderRadius:10,background:"#fff1f1",color:"#a63136",boxShadow:"0 2px 8px rgba(0,0,0,.1)",cursor:"pointer"}}>
                  <Trash2 size={16} aria-hidden="true"/>
                </button>}
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
      {preview && <Modal title="Edit photo" wide eyebrow="BRUTTI CATALOG / PHOTO EDITOR" className="product-editor-dialog product-editor-dialog--editing brutti-album-preview-modal brutti-album-editor-dialog brutti-album__product-parity" onClose={closePhotoEditor}>
        <div className="editor-form product-editor-v2 brutti-album__parity-form">
          <header className="catalog-editor-actionbar" aria-label="Album photo editor actions">
            <div className="catalog-editor-actionbar-identity">
              <button type="button" className="catalog-editor-back catalog-editor-back-icon"
                title="Back to Album" aria-label="Back to Album" disabled={savingDetails} onClick={closePhotoEditor}>
                <ArrowLeft size={19} aria-hidden="true"/>
              </button>
              <div className="catalog-editor-header-title">
                <span className="catalog-editor-header-eyebrow">BRUTTI CATALOG / PHOTO EDITOR</span>
                <strong title={detailsDraft.name || preview.name}>{detailsDraft.name || preview.name}</strong>
              </div>
            </div>
            <div className="catalog-editor-header-actions">
              <div className="catalog-editor-header-meta" aria-label="Photo information">
                <span className="catalog-editor-header-sku">{preview.sourceCode || "Album photo"}</span>
                <span className="catalog-editor-header-status catalog-editor-header-status--draft">
                  {preview.usedBy.length ? "In use" : "In Album"}
                </span>
              </div>
              <button type="button" className="catalog-editor-header-close" title="Close editor"
                aria-label="Close photo editor" disabled={savingDetails} onClick={closePhotoEditor}>
                <X size={20} strokeWidth={1.9} aria-hidden="true"/>
              </button>
            </div>
          </header>
          <nav className="product-editor-jump brutti-album__section-nav" aria-label="Album editor sections">
          {([
            ["01","Essentials","product-editor-basics"],
            ["02","Photos","brutti-media-section"],
            ["03","Specifications","product-editor-specs"],
            ["04","Publishing","product-editor-publish"],
          ] as const).map(([number,label,id]) => (
            <button type="button" key={id} onClick={() =>
              editorCanvasRef.current?.querySelector<HTMLElement>(`#${id}`)
                ?.scrollIntoView({behavior:"smooth",block:"start"})
            }>
              <span className="product-editor-jump-number">{number}</span><span>{label}</span>
            </button>
          ))}
        </nav>
          <div className="editor-columns brutti-album__parity-columns">
            <div ref={editorCanvasRef} className="editor-primary brutti-album__editor-canvas">
          <section id="product-editor-basics" className="form-section product-editor-section brutti-editor-section-card brutti-album__editor-section">
            <div className="product-editor-section-heading brutti-album__editor-section-heading">
              <span className="product-editor-step brutti-album__editor-step">01</span>
              <div><h3>Details</h3><p>Name, product code, category and description.</p></div>
            </div>
            <div className="brutti-album__editable-details">
              <label className="brutti-album__editor-field">
                <span>Name <b aria-hidden="true">*</b></span>
                <input type="text" maxLength={120} required value={detailsDraft.name}
                  placeholder="e.g. Sulob Shoe Rack"
                  disabled={savingDetails}
                  onChange={e => setDetailsDraft(current => ({...current,name:e.target.value}))}/>
              </label>
              <div className="field-pair brutti-album__field-pair">
                <div className="catalog-product-id-field brutti-album__editor-field">
                  <span className="catalog-product-id-label">Product ID</span>
                  <output className="catalog-product-id-display brutti-album__reference-id">
                    <strong>{preview.sourceCode || "Assigned in Product Editor"}</strong>
                    <LockKeyhole size={16} strokeWidth={1.8} aria-hidden="true"/>
                  </output>
                  <small>{preview.sourceCode
                    ? "Original library reference · cannot be changed here"
                    : "A unique Product ID is generated when you create the product"}</small>
                </div>
                <div className="catalog-editor-category-field brutti-album__editor-field">
                  <span className="catalog-editor-category-label">Category</span>
                  <EditorCategoryPicker
                    categories={categories}
                    value={detailsDraft.categoryId || "none"}
                    allowUncategorised
                    disabled={savingDetails || !preview.id}
                    onChange={value => setDetailsDraft(current => ({...current,categoryId:value === "none" ? null : value}))}
                  />
                  <small>Saved in Album; used as the initial category for a new product.</small>
                </div>
              </div>
              <label className="brutti-album__editor-field">
                <span>Description <small className="product-editor-publish-hint">Required to publish</small></span>
                <textarea rows={4} maxLength={10000} value={detailsDraft.description}
                  placeholder="Describe the furniture, materials, finish or important photo notes."
                  disabled={savingDetails}
                  onChange={e => setDetailsDraft(current => ({...current,description:e.target.value}))}/>
              </label>
              {detailsError && <p className="brutti-album__error" role="alert">{detailsError}</p>}
              {!preview.id && <p className="brutti-album__details-note">This image has no Album record yet. You can open its linked product, but Album metadata cannot be saved until it is indexed.</p>}
            </div>
          </section>
          <section id="brutti-media-section" className="brutti-product-media brutti-editor-section-card brutti-album__editor-section">
            <div className="product-editor-section-heading brutti-album__editor-section-heading brutti-media-section-heading">
              <span className="product-editor-step brutti-album__editor-step">02</span>
              <div><h3>Media <small>(Photos &amp; 3D)</small></h3><p>Manage this Album photo and prepare it for your product.</p></div>
            </div>
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
                {downloadError && <p className="brutti-album__error" role="alert">{downloadError}</p>}
                <div className="brutti-album__detail-download">
                  <span className="brutti-album__detail-label">DOWNLOAD PHOTO</span>
                  <div className="brutti-album__format-switch" role="group" aria-label="Download file format">
                    {(["jpg","png","webp","html"] as const).map(format => (
                      <button key={format} type="button"
                        className={downloadFormat === format ? "is-selected" : ""}
                        aria-pressed={downloadFormat === format}
                        disabled={downloading} onClick={() => setDownloadFormat(format)}>
                        {format === "jpg" ? "JPG" : format === "png" ? "PNG" : format === "html" ? "HTML" : "WebP"}
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

          <section id="product-editor-specs" className="form-section product-editor-section brutti-editor-section-card brutti-album__editor-section">
            <div className="product-editor-section-heading brutti-album__editor-section-heading">
              <span className="product-editor-step brutti-album__editor-step">03</span>
              <div><h3>Specifications</h3><p>Product measurements, materials and finishing notes.</p></div>
            </div>
            <div className="brutti-album__editable-details">
              <label className="brutti-album__editor-field">
                <span>Dimensions / Size</span>
                <input value={detailsDraft.size} maxLength={2000}
                  placeholder="e.g. 7ft H × 4ft W"
                  disabled={savingDetails}
                  onChange={event=>setDetailsDraft(current=>({...current,size:event.target.value}))}/>
              </label>
              <label className="brutti-album__editor-field">
                <span>Materials</span>
                <input value={detailsDraft.materials} maxLength={2000}
                  placeholder="e.g. Solid timber and plywood"
                  disabled={savingDetails}
                  onChange={event=>setDetailsDraft(current=>({...current,materials:event.target.value}))}/>
              </label>
              <div className="brutti-album__field-pair">
                <label className="brutti-album__editor-field">
                  <span>Colour</span>
                  <input value={detailsDraft.colour} maxLength={2000}
                    placeholder="e.g. Natural timber"
                    disabled={savingDetails}
                    onChange={event=>setDetailsDraft(current=>({...current,colour:event.target.value}))}/>
                </label>
                <label className="brutti-album__editor-field">
                  <span>Finishing</span>
                  <input value={detailsDraft.finishing} maxLength={2000}
                    placeholder="e.g. Satin clear coat"
                    disabled={savingDetails}
                    onChange={event=>setDetailsDraft(current=>({...current,finishing:event.target.value}))}/>
                </label>
              </div>
              <p className="brutti-album__details-note">Specifications are saved with the photo in Album. They will prefill the Product Editor when you create a product; verify measurements before publishing.</p>
            </div>
          </section>
          <section id="product-editor-publish" className="form-section product-editor-section brutti-editor-section-card brutti-album__editor-section">
            <div className="product-editor-section-heading brutti-album__editor-section-heading">
              <span className="product-editor-step brutti-album__editor-step">04</span>
              <div><h3>Publishing</h3><p>Choose where this photo is used in your Catalog.</p></div>
            </div>
            <div className="brutti-album__editable-details brutti-album__publishing-content">
              <div className="brutti-album__publish-status">
                <span className="brutti-album__detail-label">ALBUM STATUS</span>
                <strong>{preview.usedBy.length ? "Used in Products" : "Saved in Album"}</strong>
                <p>A photo in Album is not a published product. Only Product Editor can publish the finished product to Public Catalog.</p>
              </div>
              {onCreateProductFromPhoto && <button type="button" className="brutti-album__publish-create"
                disabled={savingDetails || !detailsDraft.name.trim()}
                onClick={()=>void startProductFromPhoto(preview)}>
                <Plus size={17} aria-hidden="true"/> Create product draft from this photo
                <ArrowUpRight size={16} aria-hidden="true"/>
              </button>}
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
              {!!preview.usedBy.length && <div className="brutti-album__publish-linked">
                <span className="brutti-album__detail-label">EXISTING PRODUCTS USING THIS PHOTO</span>
                {preview.usedBy.map(item=><button type="button" className="brutti-album__linked-product"
                  key={item.id} onClick={()=>{setPreview(null);onEditProduct?.(item.id);}}>
                  <Package size={17} aria-hidden="true"/><span>{item.name}</span>
                  <ArrowUpRight size={16} aria-hidden="true"/>
                </button>)}
              </div>}
            </div>
          </section>
            </div>
          </div>
          <footer className="editor-footer brutti-album__editor-footer">
            <span className="tiny muted">Changes are saved when you select Save.</span>
            <div className="button-row brutti-album__editor-footer-actions">
              <button type="button" className="button primary brutti-album__editor-edit"
                disabled={savingDetails || !detailsDraft.name.trim() || !preview.id}
                onClick={()=>void persistPhotoDetails(preview)}>
                {savingDetails ? <LoaderCircle size={16} className="brutti-album__spin"/> : <Save size={16}/>}
                {savingDetails ? "Saving…" : "Save details"}
              </button>
              {onCreateProductFromPhoto && <button type="button" className="button secondary brutti-album__editor-create"
                disabled={savingDetails || !detailsDraft.name.trim()}
                onClick={()=>void startProductFromPhoto(preview)}>
                <Plus size={16} aria-hidden="true"/> Create product
              </button>}
            </div>
          </footer>
        </div>
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
