import type { Category, Product } from "./types";
import { formatProductPrice } from "./price";
import { formatProductDimensions } from "./dimensions";
import { publicAssetUrl } from "./assets";
import { IMPACT_FRONT, IMPACT_BACK, planPdfSections, type PdfSelection } from "./catalog-pdf-plan";
import { makeCatalogPdf, type PdfRasterPage, type PdfLink } from "./catalog-pdf-file";

const PW=620, PH=877, SCALE=2;
const GREEN="#1f5a43", INK="#243b31", MUTED="#64746b", PAPER="#faf9f6", BRONZE="#896a4d", RULE="#dce3d9";
const font=(size:number, weight=400)=> `${weight} ${size}px Inter, "Segoe UI", Arial, sans-serif`;
const clean=(value:string)=>String(value??"").replace(/\r/g,"").trim();
function lines(ctx:CanvasRenderingContext2D, value:string, width:number, size:number, weight=400):string[] {
  ctx.font=font(size,weight);
  const result:string[]=[];
  for(const paragraph of clean(value).split("\n")) {
    let line="";
    for(const word of paragraph.split(/\s+/).filter(Boolean)) {
      if(ctx.measureText(word).width>width) {
        if(line) {result.push(line);line="";}
        let chunk="";
        for(const character of word) {
          if(chunk && ctx.measureText(chunk+character).width>width) {result.push(chunk);chunk="";}
          chunk+=character;
        }
        line=chunk;continue;
      }
      const next=line ? line+" "+word : word;
      if(line && ctx.measureText(next).width>width) {result.push(line);line=word;} else line=next;
    }
    if(line) result.push(line);
  }
  return result;
}
function text(ctx:CanvasRenderingContext2D, value:string, x:number,y:number,size:number,color=INK,weight=400) {
  ctx.font=font(size,weight);ctx.fillStyle=color;ctx.fillText(value,x,y);
}
function sheet() {
  const canvas=document.createElement("canvas");canvas.width=PW*SCALE;canvas.height=PH*SCALE;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("PDF rendering is unavailable in this browser.");
  ctx.scale(SCALE,SCALE);ctx.fillStyle=PAPER;ctx.fillRect(0,0,PW,PH);
  return {canvas,ctx};
}
async function jpeg(canvas:HTMLCanvasElement,links?:PdfLink[]):Promise<PdfRasterPage> {
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Unable to encode PDF page.")),"image/jpeg",.89));
  const page={jpeg:await blob.arrayBuffer(),width:canvas.width,height:canvas.height,
    links:links?.map(l=>({...l,x:l.x*SCALE,y:l.y*SCALE,w:l.w*SCALE,h:l.h*SCALE}))};
  canvas.width=1;canvas.height=1;return page;
}
async function photo(url:string):Promise<HTMLImageElement> {
  const controller=new AbortController();const timeout=window.setTimeout(()=>controller.abort(),20000);
  try {
    const response=await fetch(publicAssetUrl(url),{signal:controller.signal,mode:"cors",credentials:"omit"});
    if(!response.ok)throw new Error(`Image unavailable (HTTP ${response.status}): ${url}`);
    const blob=await response.blob();
    if (!blob.size || /text\/html/i.test(blob.type)) throw new Error("Image response is empty or HTML: "+url);
    const objectUrl=URL.createObjectURL(blob);
    try {
      const image=new Image();
      await new Promise<void>((resolve,reject)=>{
        image.onload=()=>resolve();image.onerror=()=>reject(new Error("Image decoding failed: "+url));image.src=objectUrl;
      });
      if (!image.naturalWidth || !image.naturalHeight) throw new Error("Invalid image dimensions: "+url);
      return image;
    } finally {URL.revokeObjectURL(objectUrl);}
  } finally {window.clearTimeout(timeout);}
}
function fit(ctx:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number) {
  const ratio=Math.min(w/img.naturalWidth,h/img.naturalHeight);
  const iw=img.naturalWidth*ratio,ih=img.naturalHeight*ratio;
  ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
}
function footer(ctx:CanvasRenderingContext2D,page:number) {
  ctx.fillStyle=RULE;ctx.fillRect(40,830,540,1);
  text(ctx,"BRUTTI  /  PRODUCT CATALOGUE",40,850,10,MUTED,500);
  ctx.textAlign="right";text(ctx,String(page).padStart(2,"0"),580,850,11,GREEN,600);ctx.textAlign="left";
}
function header(ctx:CanvasRenderingContext2D,label:string) {
  text(ctx,"BRUTTI’S CATALOG",40,43,13,GREEN,700);
  ctx.textAlign="right";ctx.font=font(10,600);ctx.fillStyle=MUTED;ctx.fillText(label,580,43,370);ctx.textAlign="left";
}
function plainMaterials(value:string) {
  const doc=new DOMParser().parseFromString(value,"text/html");
  doc.querySelectorAll("br").forEach(el=>el.replaceWith("\n"));
  doc.querySelectorAll("li").forEach(el=>{if(!/^\s*[•\-]/.test(el.textContent||""))el.prepend("• ");el.append("\n");});
  doc.querySelectorAll("p,div").forEach(el=>el.append("\n"));
  return (doc.body.textContent||"").replace(/\*\*|__|==/g,"").replace(/\*([^*\n]+)\*/g,"$1").trim();
}
type DetailRow={value:string;size:number;weight:number;color:string;height:number;heading?:boolean};
function productLines(ctx:CanvasRenderingContext2D,p:Product):DetailRow[] {
  const result:DetailRow[]=[];
  const add=(label:string,value:string)=>{
    if(!clean(value))return;
    if(label) result.push({value:label.toUpperCase(),size:11,weight:600,color:BRONZE,height:18,heading:true});
    const wrapped=lines(ctx,value,540,15,400);
    wrapped.forEach((line,i)=>result.push({value:line,size:15,weight:400,color:INK,height:20+(i===wrapped.length-1?8:0)}));
  };
  add("",plainMaterials(p.description||""));
  if([p.width,p.depth,p.height].some(v=>Number.isFinite(v)&&v>0)) add("Dimensions",formatProductDimensions(p));
  add("Materials & finishing",plainMaterials(p.materials||"").replace(/^(?:[•\s]*)(?:materials?|material)\s*:\s*/i,""));
  for(const row of p.specifications??[]) {
    if(row.kind==="section") {
      if(clean(row.name)) {
        for(const line of lines(ctx,row.name.toUpperCase(),540,11,600))result.push({value:line,size:11,weight:600,color:BRONZE,height:19,heading:true});
      }
      continue;
    }
    const details=[row.value,row.quantity&&row.quantity>0?row.quantity+" pcs":"",row.description].filter(Boolean).join(" · ");
    if(clean(row.name)&&details)add(row.name,plainMaterials(details));
  }
  return result;
}
function takeRows(rows:DetailRow[],start:number,capacity:number) {
  let end=start,used=0;
  while(end<rows.length && used+rows[end].height<=capacity) {used+=rows[end].height;end++;}
  // Keep a heading with its following line instead of orphaning it.
  if(end<rows.length)while(end>start&&rows[end-1].heading)end--;
  return end===start&&start<rows.length?start+1:end;
}
function drawRows(ctx:CanvasRenderingContext2D,rows:DetailRow[],top:number) {
  let y=top;
  for(const row of rows){text(ctx,row.value,40,y+row.size,row.size,row.color,row.weight);y+=row.height;}
}
type ProductPlan={product:Product;title:string[];price:string[];basis:string;photoHeight:number;detailTop:number;continuationTop:number;detail:DetailRow[][]};
export async function generateCatalogPdf(products:Product[],categories:Category[],mode:PdfSelection,categoryId:string,favourites:string[],onProgress:(done:number,total:number)=>void) {
  const sections=planPdfSections(products,categories,mode,categoryId,favourites);
  if(!sections.length)throw new Error("No published products match this selection.");
  // Wait for the same font used by the public catalogue before measuring text.
  // A system sans-serif remains available if the external font cannot load.
  if(document.fonts && typeof document.fonts.load==="function")await Promise.race([
    Promise.all([400,500,600,700].map(weight=>document.fonts.load(font(16,weight),"Brutti Catalogue"))).catch(()=>[]),
    new Promise<void>(resolve=>window.setTimeout(resolve,4500))
  ]);
  const measure=sheet();
  const plan=sections.map(section=>({...section,entries:section.products.map(product=>{
    const title=lines(measure.ctx,product.name,335,29,700);
    const formatted=formatProductPrice(product,"public");
    const basis=formatted.startsWith("Starting from ")?"Starting from":"";
    const price=lines(measure.ctx,basis?formatted.slice(14):formatted,182,22,600);
    const detail=productLines(measure.ctx,product);
    const titleHeight=Math.max(title.length*34,price.length*27+(basis?18:0));
    // Use a generous image by default; reclaim space only for longer specifications.
    const detailHeight=detail.reduce((n,row)=>n+row.height,0);
    const photoHeight=Math.max(250,Math.min(408,Math.floor(810-65-58-titleHeight-detailHeight)));
    const detailTop=65+photoHeight+58+titleHeight;
    const continuationTop=105+lines(measure.ctx,product.name,540,26,700).length*31+20;
    const first=takeRows(detail,0,810-detailTop);
    const chunks=[detail.slice(0,first)];
    for(let i=first;i<detail.length;){const end=takeRows(detail,i,810-continuationTop);chunks.push(detail.slice(i,end));i=end;}
    return {product,title,price,basis,photoHeight,detailTop,continuationTop,detail:chunks} as ProductPlan;
  })}));
  measure.canvas.width=1;measure.canvas.height=1;
  const contentsCount=Math.max(1,Math.ceil(plan.length/15));
  let pageNumber=2+contentsCount;
  const sectionPages=plan.map(s=>{const page=pageNumber;pageNumber+=1+s.entries.reduce((n,e)=>n+e.detail.length,0);return page;});
  const total=pageNumber;
  const pages:PdfRasterPage[]=[];
  let missing=0;
  const push=async(canvas:HTMLCanvasElement,links?:PdfLink[])=>{
    try { pages.push(await jpeg(canvas,links)); }
    catch(error) { console.error("[Catalogue PDF] Page encoding failed",{page:pages.length+1},error);throw new Error("PDF page rendering failed at page "+(pages.length+1)+". Refresh the page and retry."); }
    finally {canvas.width=1;canvas.height=1;}
    onProgress(pages.length,total);
    await new Promise<void>(resolve=>window.setTimeout(resolve,0));
  };
  const originalCover=async(url:string)=>{
    const {canvas,ctx}=sheet();
    try {
      let img:HTMLImageElement;
      try { img=await photo(url); } catch(firstError) {
        console.warn("[Catalogue PDF] Retrying original cover",url,firstError);
        try { img=await photo(url); } catch(error) {
          console.error("[Catalogue PDF] Original cover unavailable",url,error);
          throw new Error("The original catalogue cover could not be loaded. Refresh the page and try again.");
        }
      }
      ctx.fillStyle="#fff";ctx.fillRect(0,0,PW,PH);fit(ctx,img,0,0,PW,PH);await push(canvas);
    } finally {canvas.width=1;canvas.height=1;}
  };
  // Mandatory originals; never silently substitute a generic front/back cover.
  await originalCover(IMPACT_FRONT);
  for(let i=0;i<contentsCount;i++) {
    const {canvas,ctx}=sheet();header(ctx,"COLLECTION INDEX");
    text(ctx,"Product Catalogue",40,105,36,GREEN,700);
    text(ctx,"Explore our physical & creative works",40,138,15,MUTED);
    ctx.fillStyle=GREEN;ctx.fillRect(40,155,44,3);
    const links:PdfLink[]=[];
    plan.slice(i*15,(i+1)*15).forEach((s,j)=>{
      const idx=i*15+j,y=194+j*40;
      text(ctx,String(idx+1).padStart(2,"0"),40,y,12,BRONZE,600);
      const title=lines(ctx,s.name,430,17,600);text(ctx,title[0]||s.name,78,y,17,INK,600);
      if(title.length>1)text(ctx,title.slice(1).join(" "),78,y+17,12,MUTED);
      ctx.textAlign="right";text(ctx,String(sectionPages[idx]),580,y,17,GREEN,700);ctx.textAlign="left";
      ctx.fillStyle=RULE;ctx.fillRect(40,y+23,540,1);
      links.push({x:40,y:y-18,w:540,h:39,page:sectionPages[idx]-1});
    });
    footer(ctx,pages.length+1);await push(canvas,links);
  }
  for(const [index,section] of plan.entries()) {
    const {canvas,ctx}=sheet();
    let referenceLoaded=false;
    if(section.cover && section.reference) {
      try {
        const img=await photo(section.cover);ctx.fillStyle="#fff";ctx.fillRect(0,0,PW,PH);fit(ctx,img,0,0,PW,PH);
        referenceLoaded=true;
      } catch(error) {
        missing++;
        console.warn("[Catalogue PDF] Category cover unavailable",section.name,error);
      }
    }
    if(!referenceLoaded) {
      header(ctx,"SECTION "+String(index+1).padStart(2,"0"));
      text(ctx,section.name,40,112,30,GREEN,700);
      if(section.cover && !section.reference)try {fit(ctx,await photo(section.cover),40,145,540,630);}catch(error) {missing++;console.warn("[Catalogue PDF] Category image unavailable",section.name,error);}
      footer(ctx,pages.length+1);
    }
    await push(canvas);
    for(const entry of section.entries) {
      const p=entry.product;
      for(const [part,detail] of entry.detail.entries()) {
        const {canvas:pc,ctx:cx}=sheet();header(cx,section.name.toUpperCase());
        if(part===0) {
          const imageBottom=65+entry.photoHeight;
          cx.fillStyle="#eeeee8";cx.fillRect(40,65,540,entry.photoHeight);
          const image=p.images.find(img=>Boolean(img.url?.trim()));
          if(image)try {fit(cx,await photo(image.url),40,65,540,entry.photoHeight);}catch{missing++;text(cx,"Photo unavailable",55,65+entry.photoHeight/2,15,MUTED);}
          else text(cx,"Photo not provided",55,65+entry.photoHeight/2,15,MUTED);
          text(cx,p.sku,40,imageBottom+23,11,BRONZE,600);
          if(p.bestSelling) {
            cx.fillStyle="#a13732";cx.fillRect(474,imageBottom+8,106,23);
            cx.textAlign="center";text(cx,"BEST SELLER",527,imageBottom+24,10,"#ffffff",600);cx.textAlign="left";
          }
          const titleY=imageBottom+52;
          entry.title.forEach((line,i)=>text(cx,line,40,titleY+i*34,29,GREEN,700));
          cx.textAlign="right";
          if(entry.basis)text(cx,entry.basis,580,titleY-15,11,MUTED,500);
          entry.price.forEach((line,i)=>text(cx,line,580,titleY+i*27+(entry.basis?7:0),22,GREEN,600));
          cx.textAlign="left";
          cx.fillStyle=RULE;cx.fillRect(40,entry.detailTop-8,540,1);
          drawRows(cx,detail,entry.detailTop);
        } else {
          const title=lines(cx,p.name,540,26,700);
          text(cx,p.sku+"  /  CONTINUED",40,75,11,BRONZE,600);
          title.forEach((line,i)=>text(cx,line,40,105+i*31,26,GREEN,700));
          cx.fillStyle=RULE;cx.fillRect(40,entry.continuationTop-8,540,1);
          drawRows(cx,detail,entry.continuationTop);
        }
        footer(cx,pages.length+1);await push(pc);
      }
    }
  }
  await originalCover(IMPACT_BACK);
  return {blob:makeCatalogPdf(pages),missing};
}
