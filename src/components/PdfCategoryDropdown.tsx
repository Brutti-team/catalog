import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Layers3 } from "lucide-react";
import type { Category, Product } from "../lib/types";

type Props = { categories: Category[]; products: Product[]; value: string; disabled: boolean; onChange: (id: string) => void };

export default function PdfCategoryDropdown({categories,products,value,disabled,onChange}:Props) {
  const [open,setOpen]=useState(false);
  const id=useId();
  const root=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const options=useRef<(HTMLButtonElement|null)[]>([]);
  const selected=categories.find(c=>c.id===value);
  const items=[{id:"",name:"Select category"},...categories];
  const counts=new Map<string,number>();
  for(const product of products) if(product.status==="published") counts.set(product.categoryId,(counts.get(product.categoryId)??0)+1);

  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener("pointerdown",outside);
    return()=>document.removeEventListener("pointerdown",outside);
  },[open]);
  useEffect(()=>{
    if(open&&!disabled) options.current[Math.max(0,categories.findIndex(c=>c.id===value)+1)]?.focus({preventScroll:true});
  },[open,disabled,categories,value]);

  const choose=(next:string)=>{onChange(next);setOpen(false);trigger.current?.focus({preventScroll:true});};
  const handleKeys=(event:KeyboardEvent<HTMLDivElement>)=>{
    if(event.key==="Escape"&&open){event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus();return;}
    if(event.key==="Tab"&&open){setOpen(false);trigger.current?.focus({preventScroll:true});return;}
    if(!open||!["ArrowDown","ArrowUp","Home","End"].includes(event.key))return;
    event.preventDefault();
    const index=options.current.findIndex(el=>el===document.activeElement);
    const next=event.key==="Home"?0:event.key==="End"?items.length-1:event.key==="ArrowDown"?(index+1)%items.length:(index-1+items.length)%items.length;
    options.current[next]?.focus();
  };
  return <div ref={root} className="pub-pdf-category" onKeyDown={handleKeys}
    onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false);}}>
    <span className="pub-pdf-category-label" id={id+"-label"}>Product category</span>
    <button ref={trigger} type="button" className={"pub-pdf-category-trigger"+(open&&!disabled?" is-open":"")}
      aria-label={"Choose a category: "+(selected?.name||"Select category")} aria-haspopup="listbox"
      aria-expanded={open&&!disabled} aria-controls={open&&!disabled?id+"-options":undefined} disabled={disabled}
      onClick={()=>setOpen(v=>!v)} onKeyDown={event=>{if(!open&&["ArrowDown","ArrowUp"].includes(event.key)){event.preventDefault();setOpen(true);}}}>
      <Layers3 size={17} strokeWidth={1.7} aria-hidden="true"/>
      <span className={selected?"":"is-placeholder"}>{selected?.name||"Select category"}</span>
      <ChevronDown className="pub-pdf-category-chevron" size={17} aria-hidden="true"/>
    </button>
    {open&&!disabled&&<div className="pub-pdf-category-menu" id={id+"-options"} role="listbox" aria-labelledby={id+"-label"}>
      {items.map((item,index)=><button key={item.id} ref={el=>{options.current[index]=el;}} type="button" role="option"
        tabIndex={-1} aria-selected={value===item.id} className={"pub-pdf-category-item"+(value===item.id?" is-selected":"")}
        onClick={()=>choose(item.id)}>
        <span>{item.name}</span>
        {item.id&&<small>{counts.get(item.id)??0}</small>}
        <span className="pub-pdf-category-check">{value===item.id&&<Check size={15} strokeWidth={2.5} aria-hidden="true"/>}</span>
      </button>)}
    </div>}
  </div>;
}
