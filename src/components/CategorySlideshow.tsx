import { useEffect, useState } from "react";
import SafeImage from "./SafeImage";
import { publicAssetUrl } from "../lib/assets";
export type CategorySlide = {src:string;position:string};

export default function CategorySlideshow({slides, name, offset=0}:{slides:CategorySlide[];name:string;offset?:number}) {
  const [active,setActive]=useState(0);
  const [previous,setPrevious]=useState<number|null>(null);
  const [reduced,setReduced]=useState(()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const signature=JSON.stringify(slides);
  useEffect(()=>{
    const query=window.matchMedia("(prefers-reduced-motion: reduce)");
    const change=()=>setReduced(query.matches);
    query.addEventListener("change",change);
    return ()=>query.removeEventListener("change",change);
  },[]);
  useEffect(()=>{setActive(0);setPrevious(null);},[signature]);
  useEffect(()=>{
    if(reduced || slides.length<2)return;
    let cancelled=false;
    let timer:number|undefined;
    let fadeTimer:number|undefined;
    let cursor=active % slides.length;
    const advance=()=>{
      if(cancelled)return;
      if(document.hidden){timer=window.setTimeout(advance,4000);return;}
      const next=(cursor+1)%slides.length;
      const image=new Image();
      image.onload=()=>{
        if(cancelled)return;
        setPrevious(cursor);setActive(next);cursor=next;
        fadeTimer=window.setTimeout(()=>setPrevious(null),650);
        timer=window.setTimeout(advance,4000);
      };
      image.onerror=()=>{
        if(cancelled)return;
        // Continue past broken URLs without replacing the current visible image.
        cursor=next;
        timer=window.setTimeout(advance,4000);
      };
      image.src=publicAssetUrl(slides[next].src);
    };
    timer=window.setTimeout(advance,4000+(offset%4)*350);
    return ()=>{cancelled=true;window.clearTimeout(timer);window.clearTimeout(fadeTimer);};
    // The stable signature avoids restarting when the parent updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[signature,reduced,offset]);
  const current=slides[active]||slides[0];
  const last=previous===null?undefined:slides[previous];
  if(!current)return null;
  return <div className="category-slideshow" aria-hidden="true">
    {last && last.src!==current.src && <SafeImage className="category-slide-image category-slide-previous" src={last.src} alt="" style={{objectPosition:last.position}}/>}
    <SafeImage key={current.src} className={`category-slide-image${last&&!reduced?" category-slide-enter":""}`} src={current.src} alt={name} loading="lazy" decoding="async" style={{objectPosition:current.position}}/>
  </div>;
}
