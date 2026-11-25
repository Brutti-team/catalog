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
    if(slides.length<2)return;
    let cancelled=false;
    let timer:number|undefined;
    let fadeTimer:number|undefined;
    let loadTimer:number|undefined;
    let cursor=0;
    let visibleIndex=0;
    let pending:HTMLImageElement|undefined;
    const advance=()=>{
      if(cancelled)return;
      const next=(cursor+1)%slides.length;
      const image=new Image();
      pending=image;
      let settled=false;
      const finish=(loaded:boolean)=>{
        if(settled||cancelled)return;
        settled=true;
        window.clearTimeout(loadTimer);
        cursor=next;
        if(loaded){
          setPrevious(visibleIndex);
          setActive(next);
          visibleIndex=next;
          window.clearTimeout(fadeTimer);
          fadeTimer=window.setTimeout(()=>setPrevious(null),650);
        }
        timer=window.setTimeout(advance,loaded?3200:250);
      };
      image.onload=()=>finish(true);
      image.onerror=()=>finish(false);
      // A stalled image must not freeze the entire slideshow.
      loadTimer=window.setTimeout(()=>finish(false),5000);
      image.src=publicAssetUrl(slides[next].src);
      if(image.complete && image.naturalWidth>0)finish(true);
    };
    timer=window.setTimeout(advance,1800+(offset%4)*200);
    return ()=>{
      cancelled=true;
      window.clearTimeout(timer);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(loadTimer);
      if(pending){pending.onload=null;pending.onerror=null;}
    };
    // Reduced-motion users still see each photo, without the fade animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[signature,offset]);
  const current=slides[active]||slides[0];
  const last=previous===null?undefined:slides[previous];
  if(!current)return null;
  return <div className="category-slideshow" aria-hidden="true">
    {!reduced && last && last.src!==current.src && <SafeImage className="category-slide-image category-slide-previous" src={last.src} alt="" style={{objectPosition:last.position}}/>}
    <SafeImage key={current.src} className={`category-slide-image${last&&!reduced?" category-slide-enter":""}`} src={current.src} alt={name} loading="eager" decoding="async" style={{objectPosition:current.position}}/>
  </div>;
}
