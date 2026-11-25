import { useEffect, useImperativeHandle, useRef, useState, useId, useLayoutEffect, type Ref } from "react";
import { ArrowLeft, Armchair, BedDouble, BookOpen, Check, Download, Eye, FileText, Heart, LampFloor, Layers3, LibraryBig, Sofa, Star, Table2, X } from "lucide-react";
import type { Category, Product } from "../lib/types";
import { selectPdfProducts, type PdfSelection } from "../lib/catalog-pdf-plan";
import PdfCategoryDropdown from "./PdfCategoryDropdown";
import "./catalog-pdf-download.css";
import { useFavouriteIds } from "../lib/customer-favourites";
import { customerCatalogueFilename, downloadCustomerCatalogue, prepareCustomerCatalogue } from "../lib/download-customer-catalogue";

// Self-contained SVG scanner: the lens and icon clipping remain intact even
// when an older cached stylesheet is served. Progress comes from the PDF exporter.
const furnitureIcons = [BedDouble, Sofa, Armchair, Table2, LibraryBig, LampFloor];
const furnitureSequence = [...furnitureIcons, ...furnitureIcons, ...furnitureIcons];

function CatalogueLoading({ progress }: { progress: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const lensId = "pdf-lens-" + uid;
  const fadeId = "pdf-fade-" + uid;
  const maskId = "pdf-mask-" + uid;
  const railId = "pdf-rail-" + uid;
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    query.addEventListener("change", update);
    update();
    return () => query.removeEventListener("change", update);
  }, []);
  const track = () => <g>
    {!reducedMotion && <animateTransform attributeName="transform" type="translate" from="0 0" to="-216 0" dur="5.4s" repeatCount="indefinite" />}
    {furnitureSequence.map((Furniture, index) => <Furniture key={index} x={-78 + index * 36} y={22} size={24} strokeWidth={1.7} />)}
  </g>;
  return <div className="pub-pdf-progress pub-pdf-furniture-loader" role="progressbar"
    aria-label="Preparing PDF" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}
    style={{display:"grid",gap:6,margin:"2px 0 10px",padding:"8px 12px",border:"1px solid rgba(111,157,126,.25)",borderRadius:13,background:"var(--scan-surface, rgba(125,165,140,.08))"}}>
    <svg aria-hidden="true" viewBox="0 0 300 76" width="228" height="58" style={{display:"block",width:"100%",maxWidth:228,height:"auto",margin:"0 auto",overflow:"hidden"}}>
      <defs>
        <clipPath id={lensId}><circle cx="150" cy="34" r="24" /></clipPath>
        <linearGradient id={fadeId}><stop offset="0" stopColor="white" stopOpacity="0"/><stop offset=".22" stopColor="white"/><stop offset=".78" stopColor="white"/><stop offset="1" stopColor="white" stopOpacity="0"/></linearGradient>
        <mask id={maskId}><rect width="300" height="76" fill={`url(#${fadeId})`}/></mask>
        <linearGradient id={railId} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#397b59"/><stop offset="1" stopColor="#204d39"/></linearGradient>
      </defs>
      <g mask={`url(#${maskId})`} color="#6c947d" opacity=".7">{track()}</g>
      <path d="M168 53 L182 67" stroke="#25583f" strokeWidth="6" strokeLinecap="round"/>
      <circle cx="150" cy="34" r="27" fill={`url(#${railId})`}/>
      <g clipPath={`url(#${lensId})`} color="#f7fff9">{track()}</g>
      <circle cx="150" cy="34" r="24" fill="none" stroke="#b8dfc5" strokeOpacity=".65" strokeWidth="1.5"/>
      <path d="M132 22 A22 22 0 0 1 149 12" fill="none" stroke="white" strokeOpacity=".32" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
    <div className="pub-pdf-furniture-caption" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
      <div style={{display:"grid",gap:2,minWidth:0}}><strong style={{fontSize:12}}>Preparing your catalogue</strong><small style={{fontSize:11,opacity:.75}}>Creating your PDF</small></div>
      <strong className="pub-pdf-furniture-percent" style={{fontSize:17,fontVariantNumeric:"tabular-nums"}}>{progress}%</strong>
    </div>
    <div className="pub-pdf-furniture-rail" aria-hidden="true" style={{height:4,borderRadius:999,background:"var(--scan-rail,rgba(105,145,116,.2))",overflow:"hidden"}}>
      <span style={{display:"block",height:"100%",borderRadius:999,width:progress+"%",background:"linear-gradient(90deg,#245a43,#65a57c)",transition:reducedMotion?"none":"width .25s ease-out"}}/>
    </div>
  </div>;
}

export type CatalogPdfDownloadHandle = { open: () => void };
type Props = {products:Product[];categories:Category[];disabled:boolean;openRef?:Ref<CatalogPdfDownloadHandle>;hideTrigger?:boolean;staffPreview?:boolean};
export default function CatalogPdfDownload({products,categories,disabled,openRef,hideTrigger=false,staffPreview=false}:Props) {
  const dialog=useRef<HTMLDialogElement>(null);
  const running=useRef(false);
  const optionsViewport=useRef<HTMLDivElement>(null);
  const optionsContent=useRef<HTMLDivElement>(null);
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
  // Keep the options modal fully inside the visible viewport without scrolling.
  // Measure natural content height (including loading, errors and category choices)
  // before applying a proportional transform. The PDF preview is not affected.
  useLayoutEffect(() => {
    const modal = dialog.current;
    const viewport = optionsViewport.current;
    const content = optionsContent.current;
    if (preview || !modal || !viewport || !content) return;
    const fit = () => {
      if (!modal.open || !content.offsetHeight || !modal.offsetWidth) return;
      const css = getComputedStyle(modal);
      const chrome = (parseFloat(css.paddingTop) || 0) + (parseFloat(css.paddingBottom) || 0)
        + (parseFloat(css.borderTopWidth) || 0) + (parseFloat(css.borderBottomWidth) || 0);
      const inheritedScale = modal.getBoundingClientRect().width / modal.offsetWidth || 1;
      const visibleHeight = Math.min(window.innerHeight, window.visualViewport?.height ?? window.innerHeight);
      const cssMaxHeight = parseFloat(css.maxHeight);
      const available = Math.max(1, Math.min((visibleHeight - 24) / inheritedScale,
        Number.isFinite(cssMaxHeight) ? cssMaxHeight : Infinity) - chrome - 2);
      const naturalHeight = content.offsetHeight;
      const scale = Math.min(1, available / naturalHeight);
      viewport.style.height = Math.ceil(naturalHeight * scale) + "px";
      content.style.transform = scale < 1 ? "scale(" + scale + ")" : "none";
    };
    const observer = new ResizeObserver(fit);
    observer.observe(content);
    const openObserver = new MutationObserver(fit);
    openObserver.observe(modal, { attributes: true, attributeFilter: ["open"] });
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    fit();
    return () => {
      observer.disconnect();
      openObserver.disconnect();
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
    };
  }, [preview]);
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
      </div>:<div ref={optionsViewport} className="pub-pdf-options-viewport"><div ref={optionsContent} className="pub-pdf-options-content">
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
      </div></div>}
    </dialog>
  </>;
}
