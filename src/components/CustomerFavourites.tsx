import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Download, Heart, X } from "lucide-react";
import type { Category, Product } from "../lib/types";
import { publicAssetUrl } from "../lib/assets";
import { FAVOURITE_NOTICE, toggleFavouriteId, useFavouriteIds } from "../lib/customer-favourites";
import { downloadCustomerCatalogue } from "../lib/download-customer-catalogue";
import ProductPrice from "./ProductPrice";
import "./customer-favourites.css";

type Props={products:Product[];categories:Category[];loading:boolean;error:string|null;onOpen:()=>void};
export default function CustomerFavourites({products,categories,loading,error,onOpen}:Props){
  const ids=useFavouriteIds();
  const saved=ids.map(id=>products.find(p=>p.id===id&&p.status==="published")).filter((p):p is Product=>Boolean(p));
  const dialog=useRef<HTMLDialogElement>(null);
  const running=useRef(false);
  const [progress,setProgress]=useState<number|null>(null);
  const [message,setMessage]=useState("");
  const [failed,setFailed]=useState(false);
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    let timeout:number|undefined;
    const receive=(event:Event)=>{
      const detail=(event as CustomEvent<{added:boolean}>).detail;
      setNotice(detail.added?"Added to your favourites":"Removed from favourites");
      window.clearTimeout(timeout);
      timeout=window.setTimeout(()=>setNotice(""),2200);
    };
    window.addEventListener(FAVOURITE_NOTICE,receive);
    return()=>{window.removeEventListener(FAVOURITE_NOTICE,receive);window.clearTimeout(timeout);};
  },[]);
  const close=()=>{if(!running.current)dialog.current?.close();};
  const download=async()=>{
    if(running.current||!saved.length)return;
    running.current=true;setProgress(0);setMessage("");setFailed(false);
    try{
      const result=await downloadCustomerCatalogue(products,categories,"favourites","",saved.map(p=>p.id),(done,total)=>setProgress(Math.round(done/total*100)));
      setMessage(result.missing?"PDF created. Some images could not be loaded.":"Your favourites PDF is ready.");
    }catch{setFailed(true);setMessage("Unable to create the PDF. Please try again.");}
    finally{running.current=false;setProgress(null);}
  };
  return <>
    <button type="button" className="pub-favourites-trigger" aria-label={"My favourites, "+saved.length+" saved products"}
      title="My Favourites" aria-haspopup="dialog" onClick={()=>{onOpen();setMessage("");setFailed(false);setNotice("");dialog.current?.showModal();}}>
      <Heart size={19} strokeWidth={1.8} fill={saved.length?"currentColor":"none"} aria-hidden="true"/>
      {saved.length>0&&<span className="pub-favourites-count">{saved.length}</span>}
    </button>
    <span className={"pub-favourites-toast"+(notice?" is-visible":"")} role="status" aria-live="polite">
      {notice&&<><Check size={16} aria-hidden="true"/>{notice}</>}
    </span>
    <dialog ref={dialog} className="pub-favourites-dialog" aria-labelledby="pub-favourites-title" onCancel={event=>{if(running.current)event.preventDefault();}}
      onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();}}}>
      <div className="pub-favourites-head">
        <div className="pub-favourites-icon"><Heart size={23} strokeWidth={1.7}/></div>
        <div><p>YOUR COLLECTION</p><h2 id="pub-favourites-title">My Favourites</h2><span>{saved.length} saved {saved.length===1?"piece":"pieces"}</span></div>
        <button type="button" className="pub-favourites-close" aria-label="Close favourites" disabled={progress!==null} onClick={close}><X size={20}/></button>
      </div>
      <div className="pub-favourites-list">
        {loading?<p role="status">Loading your collection…</p>:error?<p role="alert">Unable to load your saved products. Try refreshing the catalogue.</p>:saved.length?saved.map(product=>
          <article className="pub-favourites-item" key={product.id}>
            <a className="pub-favourites-photo" href={"#/product/"+encodeURIComponent(product.id)} onClick={close} aria-label={"View "+product.name}>
              <img src={publicAssetUrl(product.images[0]?.url)} alt={product.images[0]?.alt||product.name} loading="lazy"
                onError={event=>{if(!event.currentTarget.src.endsWith("/images/placeholder.svg"))event.currentTarget.src=publicAssetUrl("/images/placeholder.svg");}}/>
            </a>
            <div className="pub-favourites-item-copy"><a href={"#/product/"+encodeURIComponent(product.id)} onClick={close}>{product.name}</a>
              <span>{categories.find(c=>c.id===product.categoryId)?.name||"Furniture"}</span>
              <div className="pub-favourites-price"><ProductPrice product={product} stackedBasis/></div>
            </div>
            <button type="button" className="pub-favourites-remove" disabled={progress!==null} aria-label={"Remove "+product.name+" from favourites"}
              title="Remove from favourites" onClick={()=>{toggleFavouriteId(product.id,product.name);setMessage("");}}><Heart size={18} fill="currentColor"/></button>
          </article>
        ):<div className="pub-favourites-empty"><Heart size={30} strokeWidth={1.2}/><strong>No favourites yet</strong><p>Tap the heart on any product to save it here.</p><button type="button" onClick={close}>Continue exploring <ArrowRight size={15}/></button></div>}
      </div>
      <div className="pub-favourites-footer">
        <p>Saved on this browser. No account needed.</p>
        {progress!==null&&<div className="pub-favourites-progress" role="status"><progress max={100} value={progress}/><span>Preparing PDF · {progress}%</span></div>}
        {message&&<p role={failed?"alert":"status"} className={failed?"is-error":""}>{message}</p>}
        <button className="pub-favourites-download" type="button" disabled={!saved.length||loading||Boolean(error)||progress!==null} onClick={()=>void download()}>
          <Download size={17}/>{progress!==null?"Preparing PDF…":"Download My Favourites"}
        </button>
      </div>
    </dialog>
  </>;
}
