import { useEffect, useMemo, useRef, useState } from "react";
import {
  Images, Upload, Search, Check, X, Trash2, LoaderCircle, Eye,
  Package, Layers, RefreshCw, ImageOff, ArrowUpRight,
} from "lucide-react";
import type { Category, Product } from "../lib/types";
import {
  albumPhotoToProductImage, combineAlbumPhotos, listAlbumRecords,
  removeUnassignedAlbumPhoto, uploadAlbumPhotos,
  type AlbumPhoto, type AlbumRecord,
} from "../lib/album";
import Modal from "./Modal";
import SafeImage from "./SafeImage";
import "./album-library.css";

type Props = {
  products: Product[];
  categories: Category[];
  onSelect?: (photos: AlbumPhoto[]) => void;
  onEditProduct?: (id: string) => void;
  onClose?: () => void;
  maxSelect?: number;
  excludedUrls?: string[];
};

export default function AlbumLibrary({
  products, categories, onSelect, onEditProduct, onClose,
  maxSelect = 8, excludedUrls = [],
}: Props) {
  const picker = Boolean(onSelect);
  const [records, setRecords] = useState<AlbumRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unassigned">("all");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<AlbumPhoto | null>(null);
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
  const photos = useMemo(()=>combineAlbumPhotos(records,products,categories),[records,products,categories]);
  const assigned = photos.filter(p=>p.usedBy.length>0||p.categoryCovers.length>0).length;
  const available = photos.filter(p=>!p.usedBy.length&&!p.categoryCovers.length).length;
  const visible = useMemo(()=>photos.filter(photo=>{
    const text=[photo.name,...photo.usedBy.map(p=>p.name),...photo.categoryCovers].join(" ").toLowerCase();
    return (filter==="all" || (!photo.usedBy.length && !photo.categoryCovers.length)) &&
      (category==="all" || photo.usedBy.some(product=>product.categoryId===category)) &&
      (!search.trim() || text.includes(search.trim().toLowerCase()));
  }),[photos,filter,category,search]);
  const chosen = visible.filter(photo=>selected.includes(photo.key));
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
      const result=await uploadAlbumPhotos(batch,(done,total)=>{
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
            <button type="button" className="brutti-album__primary" onClick={()=>fileRef.current?.click()} disabled={busy}>
              <Upload size={17}/> Upload photos
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
        <span><strong>{available}</strong> Unassigned</span>
      </div>
      <div className="brutti-album__toolbar">
        <div className="brutti-album__tabs" aria-label="Photo status">
          <button type="button" className={filter==="all"?"is-current":""} aria-pressed={filter==="all"} onClick={()=>setFilter("all")}>All photos</button>
          <button type="button" className={filter==="unassigned"?"is-current":""} aria-pressed={filter==="unassigned"} onClick={()=>setFilter("unassigned")}>Unassigned</button>
        </div>
        <label className="brutti-album__search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search photos or product names…" aria-label="Search Album"/></label>
        <label className="brutti-album__category">
          <Layers size={17}/>
          <select value={category} onChange={e=>setCategory(e.target.value)} aria-label="Filter album by category">
            <option value="all">All categories</option>
            {categories.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <button type="button" className="brutti-album__refresh" disabled={busy||loading} onClick={()=>void reload()} title="Refresh Album" aria-label="Refresh Album"><RefreshCw size={17}/></button>
      </div>
      {picker && <button type="button" className="brutti-album__upload-small" onClick={()=>fileRef.current?.click()} disabled={busy}><Upload size={15}/> Upload new photos to Album</button>}
      {progress && <p className="brutti-album__message" role="status"><LoaderCircle className="brutti-album__spin" size={16}/> Uploading {progress.done} / {progress.total} photos…</p>}
      {error && <p className="brutti-album__error" role="alert">{error}</p>}
      {notice && <p className="brutti-album__success" role="status">{notice}</p>}
      {loading ? <div className="brutti-album__empty" role="status"><LoaderCircle className="brutti-album__spin"/>Loading your photos…</div> :
        visible.length===0 ? (
          <div className="brutti-album__empty">
            <ImageOff size={28}/>
            <strong>{search || filter!=="all" || category!=="all" ? "No matching photos" : "Your Album is ready"}</strong>
            <p>{search || filter!=="all" || category!=="all" ? "Try a different search or filter." : "Upload product photos to keep them organised here."}</p>
          </div>
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
                  {!picker && <button type="button" onClick={()=>setPreview(photo)} aria-label={`View details for ${photo.name}`}><Eye size={14}/> View</button>}
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
        <div className="brutti-album__preview-image"><SafeImage src={preview.url} alt={preview.name}/></div>
        <div className="brutti-album__preview-info">
          <strong>{preview.name}</strong>
          <small>{preview.usedBy.length?"Used in product listings":preview.categoryCovers.length?"Used as category cover":"Unassigned photo"}</small>
        </div>
        {preview.usedBy.map(p=><button type="button" className="brutti-album__linked-product" key={p.id} onClick={()=>{setPreview(null);onEditProduct?.(p.id);}}>
          <Package size={16}/>{p.name}<ArrowUpRight size={15}/>
        </button>)}
        {!!preview.categoryCovers.length && <p className="brutti-album__category-note">Category cover: {preview.categoryCovers.join(", ")}</p>}
        <div className="brutti-album__preview-actions">
          <button type="button" className="brutti-album__secondary" onClick={()=>setPreview(null)}>Close</button>
          {!picker && <button type="button" className="brutti-album__delete" disabled={!!preview.usedBy.length||!!preview.categoryCovers.length||!preview.id}
            title={preview.usedBy.length||preview.categoryCovers.length?"Unlink from products and category covers before deleting":undefined}
            onClick={()=>void remove(preview)}><Trash2 size={15}/> Delete unassigned photo</button>}
        </div>
      </Modal>}
    </section>
  );
}
