import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { BookOpen, Check, Download, FileText, Heart, Layers3, Star, X } from "lucide-react";
import type { Category, Product } from "../lib/types";
import { selectPdfProducts, type PdfSelection } from "../lib/catalog-pdf-plan";
import PdfCategoryDropdown from "./PdfCategoryDropdown";
import "./catalog-pdf-download.css";
import { useFavouriteIds } from "../lib/customer-favourites";
import { downloadCustomerCatalogue } from "../lib/download-customer-catalogue";

export type CatalogPdfDownloadHandle = { open: () => void };
type Props = {products:Product[];categories:Category[];disabled:boolean;openRef?:Ref<CatalogPdfDownloadHandle>;hideTrigger?:boolean};
export default function CatalogPdfDownload({products,categories,disabled,openRef,hideTrigger=false}:Props) {
  const dialog=useRef<HTMLDialogElement>(null);
  const running=useRef(false);
  const [mode,setMode]=useState<PdfSelection>("all");
  const [category,setCategory]=useState("");
  const favourites=useFavouriteIds();
  const [progress,setProgress]=useState<number|null>(null);
  const [message,setMessage]=useState("");
  const [failed,setFailed]=useState(false);
  const count=selectPdfProducts(products,mode,category,[...favourites]).length;
  const open=()=>{
    if(disabled||!products.length||dialog.current?.open)return;
    setMessage("");setFailed(false);dialog.current?.showModal();
  };
  useImperativeHandle(openRef,()=>({open}));
  const download=async()=>{
    if(running.current||!count)return;
    running.current=true;setProgress(0);setMessage("");setFailed(false);
    try {
      const result=await downloadCustomerCatalogue(products,categories,mode,category,favourites,(done,total)=>setProgress(Math.round(done/total*100)));
      setMessage(result.missing ? "PDF created. "+result.missing+" product or category image(s) could not be loaded." : "Your catalogue PDF is ready.");
    } catch(error) {
      console.error("[Catalogue PDF] Download failed", {mode,category,productCount:count}, error);
      setFailed(true);
      setMessage(error instanceof Error && error.message.startsWith("The original catalogue cover")
        ? error.message : "Unable to create the PDF. Refresh the page and try again.");
    }
    finally {running.current=false;setProgress(null);}
  };
  return <>
    {!hideTrigger&&<button className="pub-pdf-trigger" type="button" disabled={disabled||!products.length}
      aria-haspopup="dialog" onClick={open}>
      <Download size={17} aria-hidden="true"/> Download Catalogue
    </button>}
    <dialog ref={dialog} className="pub-pdf-dialog" aria-labelledby="pub-pdf-title"
      onCancel={e=>{if(running.current)e.preventDefault();}}>
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
      {progress!==null&&<div role="status" className="pub-pdf-progress"><progress max={100} value={progress}/><span>Preparing PDF · {progress}%</span></div>}
      {message&&<p role={failed?"alert":"status"} className="pub-pdf-message">{message}</p>}
      <button type="button" className="pub-pdf-download" disabled={progress!==null||!count} onClick={()=>void download()}><Download size={17}/> {progress!==null?"Preparing catalogue…":"Download PDF"}</button>
    </dialog>
  </>;
}
