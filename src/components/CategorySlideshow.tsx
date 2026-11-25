import { useEffect, useState } from "react";
import SafeImage from "./SafeImage";
import { publicAssetUrl } from "../lib/assets";
export type CategorySlide = {src:string;position:string};

// All category cards subscribe to the same clock. Image loading never
// advances a card independently: a ready image waits for the next shared tick.
const slideListeners = new Set<() => void>();
let slideClock: number | undefined;
function subscribeToSlides(listener: () => void) {
  slideListeners.add(listener);
  if (slideClock === undefined) {
    slideClock = window.setInterval(() => {
      if (!document.hidden) slideListeners.forEach(advance => advance());
    }, 4000);
  }
  return () => {
    slideListeners.delete(listener);
    if (!slideListeners.size) {
      window.clearInterval(slideClock);
      slideClock = undefined;
    }
  };
}

export default function CategorySlideshow({slides, name}:{slides:CategorySlide[];name:string;offset?:number}) {
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
  useEffect(()=>{
    setActive(0);
    setPrevious(null);
    const frames=JSON.parse(signature) as CategorySlide[];
    if(frames.length<2)return;
    let cancelled=false;
    let visibleIndex=0;
    let ready:number|null=null;
    let pending:HTMLImageElement|undefined;
    let loadTimer:number|undefined;
    let fadeTimer:number|undefined;
    const preload=(candidate:number, remaining:number)=>{
      if(cancelled || remaining<=0 || candidate===visibleIndex)return;
      const image=new Image();
      pending=image;
      let settled=false;
      const finish=(loaded:boolean)=>{
        if(cancelled||settled)return;
        settled=true;
        window.clearTimeout(loadTimer);
        image.onload=null;
        image.onerror=null;
        pending=undefined;
        if(loaded) ready=candidate;
        else preload((candidate+1)%frames.length,remaining-1);
      };
      image.onload=()=>finish(true);
      image.onerror=()=>finish(false);
      loadTimer=window.setTimeout(()=>finish(false),5000);
      image.src=publicAssetUrl(frames[candidate].src);
      if(image.complete && image.naturalWidth>0)finish(true);
    };
    const prepareNext=()=>preload((visibleIndex+1)%frames.length,frames.length-1);
    prepareNext();
    const unsubscribe=subscribeToSlides(()=>{
      if(cancelled)return;
      if(ready===null){
        // Keep the current cover if loading is slow; retry at a shared tick.
        if(!pending)prepareNext();
        return;
      }
      const next=ready;
      ready=null;
      setPrevious(visibleIndex);
      setActive(next);
      visibleIndex=next;
      window.clearTimeout(fadeTimer);
      fadeTimer=window.setTimeout(()=>setPrevious(null),650);
      prepareNext();
    });
    return ()=>{
      cancelled=true;
      unsubscribe();
      window.clearTimeout(loadTimer);
      window.clearTimeout(fadeTimer);
      if(pending){pending.onload=null;pending.onerror=null;}
    };
  },[signature]);
  const current=slides[active]||slides[0];
  const last=previous===null?undefined:slides[previous];
  if(!current)return null;
  return <div className="category-slideshow" aria-hidden="true">
    {!reduced && last && last.src!==current.src && <SafeImage className="category-slide-image category-slide-previous" src={last.src} alt="" style={{objectPosition:last.position}}/>}
    <SafeImage key={current.src} className={`category-slide-image${last&&!reduced?" category-slide-enter":""}`} src={current.src} alt={name} loading="eager" decoding="async" style={{objectPosition:current.position}}/>
  </div>;
}
