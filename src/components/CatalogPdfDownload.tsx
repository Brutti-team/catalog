import { useRef, useState } from "react";
import { Download, X } from "lucide-react";
import type { Category, Product } from "../lib/types";
import { selectPdfProducts, type PdfSelection } from "../lib/catalog-pdf-plan";
import "./catalog-pdf-download.css";

function favouriteIds():string[] {
  try { const value:unknown=JSON.parse(localStorage.getItem("brutti-catalog-favourites")||"[]");return Array.isArray(value)?value.filter((x):x is string=>typeof x==="string"):[]; } catch {return [];}
}
export default function CatalogPdfDownload({products,categories,disabled}:{products:Product[];categories:Category[];disabled:boolean}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const running=useRef(false);
  const [mode,setMode]=useState<PdfSelection>("all");
  const [category,setCategory]=useState("");
  const [favourites,setFavourites]=useState<string[]>([]);
  const [progress,setProgress]=useState<number|null>(null);
  const [message,setMessage]=useState("");
  const [failed,setFailed]=useState(false);
  const count=selectPdfProducts(products,mode,category,favourites).length;
  const download=async()=>{
    if(running.current||!count)return;
    running.current=true;setProgress(0);setMessage("");setFailed(false);
    try {
      const {generateCatalogPdf}=await import("../lib/catalog-pdf");
      const result=await generateCatalogPdf(products,categories,mode,category,favourites,(done,total)=>setProgress(Math.round(done/total*100)));
      const url=URL.createObjectURL(result.blob);
      const link=document.createElement("a");link.href=url;link.download="Benua-Brutti-Catalogue-"+new Date().toISOString().slice(0,10)+".pdf";
      document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),60000);
      setMessage(result.missing ? "PDF created. "+result.missing+" product or category image(s) could not be loaded." : "Your catalogue PDF is ready.");
    } catch {setFailed(true);setMessage("Unable to create the PDF. Check your connection and try again.");}
    finally {running.current=false;setProgress(null);}
  };
  return <>
    <button className="pub-pdf-trigger" type="button" disabled={disabled||!products.length}
      onClick={()=>{setFavourites(favouriteIds());setMessage("");setFailed(false);dialog.current?.showModal();}}>
      <Download size={17} aria-hidden="true"/> Download Catalogue
    </button>
    <dialog ref={dialog} className="pub-pdf-dialog" aria-labelledby="pub-pdf-title"
      onCancel={e=>{if(running.current)e.preventDefault();}}>
      <div className="pub-pdf-dialog-head">
        <div><p>BENUA BRUTTI</p><h2 id="pub-pdf-title">Download Catalogue</h2><span>Take our collection with you.</span></div>
        <button type="button" aria-label="Close download options" disabled={progress!==null} onClick={()=>dialog.current?.close()}><X size={20}/></button>
      </div>
      <fieldset disabled={progress!==null}>
        <legend>Choose your collection</legend>
        {([{id:"all",title:"Full Catalogue",desc:"All published products and original category covers"},
          {id:"best",title:"Best Sellers",desc:"Our selected best-selling pieces"},
          {id:"category",title:"By Category",desc:"Choose one product category"},
          {id:"favourites",title:"My Favourites",desc:"Products you have saved"}] as const).map(option=>
            <label key={option.id} className="pub-pdf-option"><input type="radio" name="catalog-pdf-mode" value={option.id}
              checked={mode===option.id} onChange={()=>{setMode(option.id);setMessage("");}}/><span><strong>{option.title}</strong><small>{option.desc}</small></span></label>)}
        {mode==="category"&&<select aria-label="Choose a category" value={category} onChange={e=>setCategory(e.target.value)}>
          <option value="">Select category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>}
      </fieldset>
      <p className="pub-pdf-summary">PDF · A4 portrait · {count} {count===1?"product":"products"} · Original Brutti covers</p>
      {progress!==null&&<div role="status" className="pub-pdf-progress"><progress max={100} value={progress}/><span>Preparing PDF · {progress}%</span></div>}
      {message&&<p role={failed?"alert":"status"} className="pub-pdf-message">{message}</p>}
      <button type="button" className="pub-pdf-download" disabled={progress!==null||!count} onClick={()=>void download()}><Download size={17}/> {progress!==null?"Preparing catalogue…":"Download PDF"}</button>
    </dialog>
  </>;
}
