import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { ProductImage } from "../lib/types";
import { publicAssetUrl } from "../lib/assets";
import { boundZoom, initialZoom, zoomAt, type ZoomView } from "../lib/photo-zoom";
import "./customer-photo-zoom.css";

type Props = {images:readonly ProductImage[];productName:string;initialIndex:number;onClose:()=>void};
type Point = {x:number;y:number};
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);

export default function CustomerPhotoZoom({images,productName,initialIndex,onClose}:Props) {
  const modal=useRef<HTMLDialogElement>(null);
  const stage=useRef<HTMLDivElement>(null);
  const imageRef=useRef<HTMLImageElement>(null);
  const live=useRef<ZoomView>(initialZoom);
  const pointers=useRef(new Map<number,Point>());
  const gesture=useRef<{start:Point; moved:boolean}|null>(null);
  const [view,setView]=useState(initialZoom);
  const [index,setIndex]=useState(Math.min(Math.max(0,initialIndex),Math.max(0,images.length-1)));
  const [failed,setFailed]=useState(false);
  const [ratio,setRatio]=useState(1);
  const [dragging,setDragging]=useState(false);
  const active=images[index];
  const update=(next:ZoomView)=>{
    const frame=stage.current,img=imageRef.current;
    const safe=boundZoom(next,img?.offsetWidth??0,img?.offsetHeight??0,frame?.clientWidth??0,frame?.clientHeight??0);
    live.current=safe;setView(safe);
  };
  const reset=()=>update(initialZoom);
  const canPan=()=>{const img=imageRef.current, frame=stage.current;return live.current.scale>1||Boolean(img&&frame&&(img.offsetWidth>frame.clientWidth+1||img.offsetHeight>frame.clientHeight+1));};
  const changePhoto=(step:number)=>{
    pointers.current.clear();gesture.current=null;setDragging(false);
    reset();setFailed(false);setIndex(i=>(i+step+images.length)%images.length);
  };
  const centred=(clientX:number,clientY:number)=>{
    const rect=stage.current?.getBoundingClientRect();
    return {x:clientX-(rect?rect.left+rect.width/2:clientX),y:clientY-(rect?rect.top+rect.height/2:clientY)};
  };
  const zoom=(factor:number)=>update(zoomAt(live.current,live.current.scale*factor,0,0));
  useEffect(()=>{
    const dialog=modal.current;if(!dialog)return;
    const focused=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";dialog.showModal();
    return()=>{dialog.close();document.body.style.overflow=previousOverflow;focused?.focus({preventScroll:true});};
  },[]);
  useEffect(()=>{
    const el=stage.current;if(!el)return;
    const wheel=(event:WheelEvent)=>{
      event.preventDefault();
      const p=centred(event.clientX,event.clientY);
      update(zoomAt(live.current,live.current.scale*Math.exp(-event.deltaY*.002),p.x,p.y));
    };
    const resize=()=>update(live.current);
    el.addEventListener("wheel",wheel,{passive:false});window.addEventListener("resize",resize);
    return()=>{el.removeEventListener("wheel",wheel);window.removeEventListener("resize",resize);};
  },[]);
  const start=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(event.button!==0||failed)return;
    const point={x:event.clientX,y:event.clientY};
    if(pointers.current.size===0)gesture.current={start:point,moved:false};
    pointers.current.set(event.pointerId,point);
    if(pointers.current.size>1&&gesture.current)gesture.current.moved=true;
    event.currentTarget.setPointerCapture(event.pointerId);
    if(canPan()||pointers.current.size>1)setDragging(true);
  };
  const move=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const previous=pointers.current.get(event.pointerId);if(!previous)return;
    const next={x:event.clientX,y:event.clientY};
    const other=[...pointers.current.entries()].find(([id])=>id!==event.pointerId)?.[1];
    pointers.current.set(event.pointerId,next);
    if(gesture.current&&distance(gesture.current.start,next)>5)gesture.current.moved=true;
    if(other){
      const before=distance(previous,other),after=distance(next,other);
      if(before>0){
        const midpoint=centred((previous.x+other.x)/2,(previous.y+other.y)/2);
        const scaled=zoomAt(live.current,live.current.scale*after/before,midpoint.x,midpoint.y);
        update({...scaled,x:scaled.x+(next.x-previous.x)/2,y:scaled.y+(next.y-previous.y)/2});
      }
    }else if(canPan()){
      update({...live.current,x:live.current.x+next.x-previous.x,y:live.current.y+next.y-previous.y});
    }
  };
  const end=(event:ReactPointerEvent<HTMLDivElement>,cancelled=false)=>{
    if(!pointers.current.has(event.pointerId))return;
    pointers.current.delete(event.pointerId);
    if(pointers.current.size)return;
    setDragging(false);
    if(!cancelled&&!gesture.current?.moved&&!failed){
      const p=centred(event.clientX,event.clientY);
      if(live.current.scale===1)update(zoomAt(live.current,2,p.x,p.y));else reset();
    }
    gesture.current=null;
  };
  return <dialog ref={modal} className="customer-photo-zoom" aria-label={productName+" photo viewer"}
    style={{width:`min(920px, calc(100vw - 32px), calc((100dvh - 64px) * ${ratio}))`}}
    onClick={event=>{if(event.target===event.currentTarget)onClose();}}
    onCancel={event=>{event.preventDefault();onClose();}}
    onKeyDown={event=>{
      if(event.key==="+"||event.key==="="){event.preventDefault();zoom(1.25);}
      if(event.key==="-"){event.preventDefault();zoom(.8);}
      if(event.key==="0"){event.preventDefault();reset();}
      if(event.key==="ArrowLeft"||event.key==="ArrowRight"){
        if(view.scale>1){event.preventDefault();update({...live.current,x:live.current.x+(event.key==="ArrowLeft"?60:-60)});}
        else if(images.length>1){event.preventDefault();changePhoto(event.key==="ArrowLeft"?-1:1);}
      }
      if(view.scale>1&&(event.key==="ArrowUp"||event.key==="ArrowDown")){event.preventDefault();update({...live.current,y:live.current.y+(event.key==="ArrowUp"?60:-60)});}
    }}>
    <button className="customer-photo-close" type="button" autoFocus aria-label="Close photo viewer" onClick={onClose}><X size={21}/></button>
    <div ref={stage} style={{aspectRatio:ratio,"--customer-photo-ratio":ratio} as CSSProperties} className={"customer-photo-zoom-stage"+(dragging?" is-dragging":view.scale>1?" is-zoomed":"")}
      onPointerDown={start} onPointerMove={move} onPointerUp={event=>end(event)}
      onPointerCancel={event=>end(event,true)} onLostPointerCapture={event=>end(event,true)}>
      {active&&!failed?<img key={active.id} ref={imageRef} src={publicAssetUrl(active.url)} alt={active.alt||productName}
        draggable={false} onLoad={event=>{const image=event.currentTarget;if(image.naturalHeight>0)setRatio(image.naturalWidth/image.naturalHeight);update(live.current);}} onError={()=>{setFailed(true);reset();}}
        style={{transform:`translate(${view.x}px,${view.y}px) scale(${view.scale})`}}/>:
        <p role="status">This photo is unavailable.</p>}
    </div>
    {images.length>1&&<>
      <button className="customer-photo-prev" type="button" aria-label="Previous photo" onClick={()=>changePhoto(-1)}><ChevronLeft size={21}/></button>
      <button className="customer-photo-next" type="button" aria-label="Next photo" onClick={()=>changePhoto(1)}><ChevronRight size={21}/></button>
    </>}
  </dialog>;
}
