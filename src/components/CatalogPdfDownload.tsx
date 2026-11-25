import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { ArrowLeft, Armchair, BedDouble, BookOpen, Check, Download, Eye, FileText, Heart, LampFloor, Layers3, LibraryBig, Sofa, Star, Table2, X } from "lucide-react";
import type { Category, Product } from "../lib/types";
import { selectPdfProducts, type PdfSelection } from "../lib/catalog-pdf-plan";
import PdfCategoryDropdown from "./PdfCategoryDropdown";
import "./catalog-pdf-download.css";
import { useFavouriteIds } from "../lib/customer-favourites";
import { customerCatalogueFilename, downloadCustomerCatalogue, prepareCustomerCatalogue } from "../lib/download-customer-catalogue";

// Decorative repeating furniture scan, independent of real export progress.
const furnitureIcons = [BedDouble, Sofa, Armchair, Table2, LibraryBig, LampFloor];
const furnitureSequence = [...furnitureIcons, ...furnitureIcons, ...furnitureIcons];

function CatalogueLoading({ progress }: { progress: number }) {
  const track = () => <div className="pub-pdf-furniture-track">
    {furnitureSequence.map((Furniture, index) => <span key={index}><Furniture size={23} strokeWidth={1.7} /></span>)}
  </div>;
  return <div className="pub-pdf-progress pub-pdf-furniture-loader" role="progressbar"
    aria-label="Preparing PDF" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
    <div className="pub-pdf-furniture-animation" aria-hidden="true">
      <div className="pub-pdf-furniture-window">{track()}</div>
      <div className="pub-pdf-furniture-magnifier"><div className="pub-pdf-furniture-lens">{track()}</div></div>
    </div>
    <div className="pub-pdf-furniture-caption">
      <div><strong>Preparing your catalogue</strong><small>Creating your PDF</small></div>
      <strong className="pub-pdf-furniture-percent">{progress}%</strong>
    </div>
    <div className="pub-pdf-furniture-rail" aria-hidden="true"><span style={{width: progress + "%"}} /></div>
  </div>;
}

export type CatalogPdfDownloadHandle = { open: () => void };
type Props = {products:Product[];categories:Category[];disabled:boolean;openRef?:Ref<CatalogPdfDownloadHandle>;hideTrigger?:boolean;staffPreview?:boolean};
export default function CatalogPdfDownload({products,categories,disabled,openRef,hideTrigger=false,staffPreview=false}:Props) {
  const dialog=useRef<HTMLDialogElement>(null);
  const running=useRef(false);
  const [mode,setMode]=useState<PdfSelection>("all");
  const [category,setCategory]=useState("");
  const favourites=useFavouriteIds();
  const [progress,setProgress]=useState<number|null>(null);
  const [message,setMessage]=useState("");
  const [failed,setFailed]=useState(false);
  const [preview,setPreview]=useState<{blob:Blob;missing:number;filename:string}|null>(null);
  const [previewUrl,setPreviewUrl]=useState("");
  useEffect(()=>{
    if(!preview)return;
    const url=URL.createObjectURL(preview.blob);
    setPreviewUrl(url);
    return()=>URL.revokeObjectURL(url);
  },[preview]);
  const clearPreview=()=>{setPreviewUrl("");setPreview(null);};
  const count=selectPdfProducts(products,mode,category,[...favourites]).length;
  const open=()=>{
    if(disabled||!products.length||dialog.current?.open)return;
    clearPreview();setMessage("");setFailed(false);dialog.current?.showModal();
  };
  useImperativeHandle(openRef,()=>({open}));
  const download=async()=>{
    if(running.current||!count)return;
    running.current=true;setProgress(0);setMessage("");setFailed(false);
    try {
      const reportProgress=(done:number,total:number)=>setProgress(Math.round(done/total*100));
      if(staffPreview){
        const result=await prepareCustomerCatalogue(products,categories,mode,category,favourites,reportProgress);
        setPreview({...result,filename:customerCatalogueFilename(mode)});
      }else{
        const result=await downloadCustomerCatalogue(products,categories,mode,category,favourites,reportProgress);
        setMessage(result.missing ? "PDF created. "+result.missing+" product or category image(s) could not be loaded." : "Your catalogue PDF is ready.");
      }
    } catch(error) {
      console.error("[Catalogue PDF] Download failed", {mode,category,productCount:count}, error);
      setFailed(true);
      setMessage(error instanceof Error && /^(The original catalogue cover|The PDF module|PDF page rendering failed|PDF rendering is unavailable|No published products)/.test(error.message)
        ? error.message : "Unable to create the PDF. Refresh the page and try again. If the issue continues, contact Brutti.");
    }
    finally {running.current=false;setProgress(null);}
  };
  return <>
    {!hideTrigger&&<button className="pub-pdf-trigger" type="button" disabled={disabled||!products.length}
      aria-haspopup="dialog" onClick={open}>
      <Download size={17} aria-hidden="true"/> Download Catalogue
    </button>}
    <dialog ref={dialog} className={"pub-pdf-dialog"+(preview?" staff-pdf-preview-dialog":"")} aria-labelledby="pub-pdf-title"
      onClose={clearPreview}
      onCancel={e=>{if(running.current)e.preventDefault();}}>
      {preview?<div className="staff-pdf-preview">
        <header className="staff-pdf-preview-head">
          <button type="button" className="staff-pdf-preview-back" onClick={clearPreview} aria-label="Back to catalogue options"><ArrowLeft size={19}/></button>
          <div><h2 id="pub-pdf-title">Catalogue preview</h2><p>Review your PDF before downloading.</p></div>
          <button type="button" className="staff-pdf-preview-close" onClick={()=>dialog.current?.close()} aria-label="Close preview"><X size={20}/></button>
        </header>
        {preview.missing>0&&<p className="staff-pdf-preview-warning" role="status">{preview.missing} product or category image(s) could not be loaded.</p>}
        {previewUrl?<iframe className="staff-pdf-preview-frame" src={previewUrl+"#view=FitH"} title="Catalogue PDF preview"/>:<p role="status">Opening preview…</p>}
        <footer className="staff-pdf-preview-footer">
          <a href={previewUrl||undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!previewUrl}>Open PDF in new tab</a>
          <a className="staff-pdf-preview-download" href={previewUrl||undefined} download={preview.filename} aria-disabled={!previewUrl}><Download size={17}/> Download PDF</a>
        </footer>
      </div>:<>
      <div className="pub-pdf-dialog-head">
        <div className="pub-pdf-heading"><span className="pub-pdf-heading-icon"><FileText size={22} strokeWidth={1.7} aria-hidden="true"/></span><div><p>BENUA BRUTTI / COLLECTION</p><h2 id="pub-pdf-title">Download Catalogue</h2><span>Choose a collection to keep or share.</span></div></div>
        <button type="button" aria-label="Close download options" disabled={progress!==null} onClick={()=>dialog.current?.close()}><X size={20}/></button>
      </div>
      <fieldset disabled={progress!==null}>
        <legend>Choose your collection</legend>
        {([{id:"all",title:"Full Catalogue",desc:"All products and original collection covers",icon:BookOpen},
          {id:"best",title:"Best Sellers",desc:"Our selected best-selling pieces",icon:Star},
          {id:"category",title:"By Category",desc:"Explore a specific product collection",icon:Layers3},
          {id:"favourites",title:"My Favourites",desc:"Your saved products in one PDF",icon:Heart}] as const).map(option=>
            <label key={option.id} className="pub-pdf-option"><input type="radio" name="catalog-pdf-mode" value={option.id}
              checked={mode===option.id} onChange={()=>{setMode(option.id);setMessage("");}}/><span className="pub-pdf-option-icon"><option.icon size={19} strokeWidth={1.7} aria-hidden="true"/></span><span className="pub-pdf-option-copy"><strong>{option.title}</strong><small>{option.desc}</small></span><span className="pub-pdf-option-check" aria-hidden="true"><Check size={12} strokeWidth={2.7}/></span></label>)}
        {mode==="category"&&<PdfCategoryDropdown categories={categories} products={products} value={category}
          disabled={progress!==null} onChange={id=>{setCategory(id);setMessage("");setFailed(false);}} />}
      </fieldset>
      <div className="pub-pdf-summary"><span className="pub-pdf-summary-icon"><FileText size={17} strokeWidth={1.7} aria-hidden="true"/></span><div><strong>{count} {count===1?"product":"products"} selected</strong><small>PDF · A4 portrait · Original Brutti covers</small></div></div>
      {progress!==null&&<CatalogueLoading progress={progress}/>}
      {message&&<p role={failed?"alert":"status"} className="pub-pdf-message">{message}</p>}
      <button type="button" className="pub-pdf-download" disabled={progress!==null||!count} onClick={()=>void download()}>{staffPreview?<Eye size={17}/>:<Download size={17}/>} {progress!==null?"Preparing catalogue…":staffPreview?"Preview PDF":"Download PDF"}</button>
      </>}
    </dialog>
  </>;
}
