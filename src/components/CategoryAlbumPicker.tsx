import { useEffect, useMemo, useState } from "react";
import { Check, Images, Search, LoaderCircle, RefreshCw, ChevronDown } from "lucide-react";
import type { Category, Product } from "../lib/types";
import { combineAlbumPhotos, listAlbumRecords, type AlbumRecord } from "../lib/album";
import SafeImage from "./SafeImage";

export default function CategoryAlbumPicker({products,categories,selected,onChange,disabled=false}:{
  products: Product[];
  categories: Category[];
  selected: string[];
  onChange: (ids:string[])=>void;
  disabled?: boolean;
}) {
  const [records,setRecords]=useState<AlbumRecord[]>([]);
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    if(!open)return;
    let active=true;
    setLoading(true);setError("");
    listAlbumRecords().then(result=>{if(active)setRecords(result);})
      .catch(err=>{if(active)setError(err instanceof Error?err.message:"Could not load Album.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[open,revision]);
  const available=useMemo(()=>combineAlbumPhotos(records,products,categories)
    .filter(photo=>photo.id && !photo.manualCategoryId && !photo.usedBy.length && !photo.categoryCovers.length),
    [records,products,categories]);
  const visible=available.filter(photo=>photo.name.toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="category-cover-picker category-album-picker" aria-label="Choose unassigned Album photos">
    <div className="category-cover-picker-heading">
      <div><strong>Album photos</strong><p>Add unassigned photos to this category.</p></div>
      <span>{selected.length} selected</span>
    </div>
    <button type="button" className="category-cover-auto" aria-expanded={open} disabled={disabled} onClick={()=>setOpen(value=>!value)}>
      <Images size={18}/><span><strong>Choose from Album</strong><small>Unassigned photos only</small></span>
      <ChevronDown size={17} style={{transform:open?"rotate(180deg)":undefined}}/>
    </button>
    {open && <>
      <div className="category-album-search">
        <Search size={16}/><input aria-label="Search unassigned photos" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search photos..." disabled={disabled}/>
        <button type="button" aria-label="Refresh photos" title="Refresh photos" disabled={loading||disabled} onClick={()=>setRevision(value=>value+1)}><RefreshCw size={16}/></button>
      </div>
      {loading ? <p className="category-cover-picker-empty"><LoaderCircle size={18}/> Loading Album...</p>
        : error ? <p role="alert" className="category-cover-picker-warning">{error}</p>
        : visible.length ? <div className="category-cover-picker-grid" aria-label="Unassigned photos">
          {visible.map(photo=>{
            const id=photo.id!;
            const checked=selected.includes(id);
            return <button type="button" key={id} disabled={disabled} aria-pressed={checked}
              aria-label={`Select ${photo.name}`} className={`category-cover-option${checked?" is-selected":""}`}
              onClick={()=>onChange(checked?selected.filter(item=>item!==id):[...selected,id])}>
              <span className="category-cover-option-image"><SafeImage src={photo.url} alt="" loading="lazy"/>
                {checked && <span className="category-cover-option-check"><Check size={16}/></span>}
              </span>
              <strong title={photo.name}>{photo.name}</strong>
            </button>;
          })}
        </div> : <p className="category-cover-picker-empty"><Images size={18}/> {search.trim()?"No matching photos.":"No unassigned photos available."}</p>}
    </>}
    <p className="category-cover-picker-notice">Selected photos will be added to this category when you save. They will not become published products.</p>
  </section>;
}
