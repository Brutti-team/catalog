import type { Category, Product } from "./types";
import { formatProductPrice } from "./price";
import { formatProductDimensions } from "./dimensions";
import { publicAssetUrl } from "./assets";
import { IMPACT_FRONT, IMPACT_BACK, planPdfSections, type PdfSelection } from "./catalog-pdf-plan";
import { makeCatalogPdf, type PdfRasterPage, type PdfLink } from "./catalog-pdf-file";

const PW=620, PH=877, SCALE=2;
const GREEN="#164638", INK="#26362e", MUTED="#64756c", PAPER="#faf9f5";
const font=(size:number, weight=400)=> weight + " " + size + "px Arial, sans-serif";
const clean=(value:string)=>value.replace(/\r/g,"").trim();
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
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Unable to encode PDF page.")),"image/jpeg",.88));
  const page={jpeg:await blob.arrayBuffer(),width:canvas.width,height:canvas.height,
    links:links?.map(l=>({...l,x:l.x*SCALE,y:l.y*SCALE,w:l.w*SCALE,h:l.h*SCALE}))};
  canvas.width=1;canvas.height=1;return page;
}
async function photo(url:string):Promise<HTMLImageElement> {
  const controller=new AbortController();const timeout=window.setTimeout(()=>controller.abort(),15000);
  try {
    const response=await fetch(publicAssetUrl(url),{signal:controller.signal,mode:"cors",credentials:"omit"});
    if(!response.ok)throw new Error("Image unavailable");
    const objectUrl=URL.createObjectURL(await response.blob());
    try {
      const image=new Image();image.src=objectUrl;await image.decode();return image;
    } finally {URL.revokeObjectURL(objectUrl);}
  } finally {window.clearTimeout(timeout);}
}
function fit(ctx:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number) {
  const ratio=Math.min(w/img.naturalWidth,h/img.naturalHeight);
  const iw=img.naturalWidth*ratio,ih=img.naturalHeight*ratio;
  ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
}
function footer(ctx:CanvasRenderingContext2D,page:number) {
  ctx.fillStyle="#d7dfd7";ctx.fillRect(40,830,540,1);
  text(ctx,"BENUA BRUTTI  /  PRODUCT CATALOGUE",40,850,10,MUTED,600);
  ctx.textAlign="right";text(ctx,String(page).padStart(2,"0"),580,850,11,GREEN,700);ctx.textAlign="left";
}
function header(ctx:CanvasRenderingContext2D,label:string) {
  text(ctx,"BENUA BRUTTI",40,45,12,GREEN,700);
  ctx.textAlign="right";text(ctx,label,580,45,10,MUTED,600);ctx.textAlign="left";
}
function plainMaterials(value:string) {
  const doc=new DOMParser().parseFromString(value,"text/html");
  doc.querySelectorAll("br").forEach(el=>el.replaceWith("\n"));
  doc.querySelectorAll("li,p,div").forEach(el=>el.append("\n"));
  return (doc.body.textContent||"").trim().replace(/\*\*|__/g,"");
}
function productLines(ctx:CanvasRenderingContext2D,p:Product) {
  const result:string[]=[];
  const add=(label:string,value:string)=>{if(value.trim())result.push(...lines(ctx,label+value,540,14), "");};
  add("",p.description);
  if([p.width,p.depth,p.height].some(v=>Number.isFinite(v)&&v>0)) add("Dimensions: ",formatProductDimensions(p));
  add("Materials: ",plainMaterials(p.materials));
  for(const row of p.specifications??[]) {
    if(row.kind==="section") {add("",row.name);continue;}
    const details=[row.value,row.quantity&&row.quantity>0?row.quantity+" pcs":"",row.description].filter(Boolean).join(" · ");
    if(row.name.trim()&&details) add(row.name+": ",details);
  }
  return result;
}
type ProductPlan={product:Product; title:string[]; detail:string[][]};
export async function generateCatalogPdf(products:Product[],categories:Category[],mode:PdfSelection,categoryId:string,favourites:string[],onProgress:(done:number,total:number)=>void) {
  const sections=planPdfSections(products,categories,mode,categoryId,favourites);
  if(!sections.length)throw new Error("No published products match this selection.");
  const measure=sheet();
  const plan=sections.map(section=>({...section,entries:section.products.map(product=>{
    const title=lines(measure.ctx,product.name,540,30,700);
    const detail=productLines(measure.ctx,product);
    // The first page has a large photograph, subsequent pages retain all details.
    const first=Math.max(2,Math.floor((797-(510+title.length*34))/19));
    const chunks=[detail.slice(0,first)];
    for(let i=first;i<detail.length;i+=33)chunks.push(detail.slice(i,i+33));
    return {product,title,detail:chunks} as ProductPlan;
  })}));
  measure.canvas.width=1;measure.canvas.height=1;
  const contentsCount=Math.max(1,Math.ceil(plan.length/15));
  let pageNumber=2+contentsCount;
  const sectionPages=plan.map(s=>{const page=pageNumber;pageNumber+=1+s.entries.reduce((n,e)=>n+e.detail.length,0);return page;});
  const total=pageNumber;
  const pages:PdfRasterPage[]=[];
  let missing=0;
  const push=async(canvas:HTMLCanvasElement,links?:PdfLink[])=>{pages.push(await jpeg(canvas,links));onProgress(pages.length,total);};
  const originalCover=async(url:string)=>{
    const {canvas,ctx}=sheet();const img=await photo(url);
    ctx.fillStyle="#fff";ctx.fillRect(0,0,PW,PH);fit(ctx,img,0,0,PW,PH);await push(canvas);
  };
  // Mandatory originals; never silently substitute a generic front/back cover.
  await originalCover(IMPACT_FRONT);
  for(let i=0;i<contentsCount;i++) {
    const {canvas,ctx}=sheet();header(ctx,"COLLECTION INDEX");
    text(ctx,"Product Catalogue",40,105,38,GREEN,700);
    text(ctx,"Explore our physical & creative works",40,138,15,MUTED);
    const links:PdfLink[]=[];
    plan.slice(i*15,(i+1)*15).forEach((s,j)=>{
      const idx=i*15+j,y=194+j*40;
      text(ctx,String(idx+1).padStart(2,"0"),40,y,12,MUTED,700);
      const title=lines(ctx,s.name,430,17,600);text(ctx,title[0]||s.name,78,y,17,INK,600);
      if(title.length>1)text(ctx,title.slice(1).join(" "),78,y+17,12,MUTED);
      ctx.textAlign="right";text(ctx,String(sectionPages[idx]),580,y,17,GREEN,700);ctx.textAlign="left";
      ctx.fillStyle="#d9e0d8";ctx.fillRect(40,y+23,540,1);
      links.push({x:40,y:y-18,w:540,h:39,page:sectionPages[idx]-1});
    });
    footer(ctx,pages.length+1);await push(canvas,links);
  }
  for(const [index,section] of plan.entries()) {
    const {canvas,ctx}=sheet();
    if(section.cover && section.reference) {
      const img=await photo(section.cover);ctx.fillStyle="#fff";ctx.fillRect(0,0,PW,PH);fit(ctx,img,0,0,PW,PH);
      // Preserve the original art in full; page number sits in the white margin if possible.
    } else {
      header(ctx,"SECTION "+String(index+1).padStart(2,"0"));
      text(ctx,section.name,40,112,30,GREEN,700);
      if(section.cover)try {fit(ctx,await photo(section.cover),40,145,540,630);}catch {missing++;}
      footer(ctx,pages.length+1);
    }
    await push(canvas);
    for(const entry of section.entries) {
      const p=entry.product;
      for(const [part,detail] of entry.detail.entries()) {
        const {canvas:pc,ctx:cx}=sheet();header(cx,section.name.toUpperCase());
        if(part===0) {
          cx.fillStyle="#efeee8";cx.fillRect(40,70,540,365);
          const image=p.images.find(img=>Boolean(img.url?.trim()));
          if(image)try {fit(cx,await photo(image.url),40,70,540,365);}catch{missing++;text(cx,"Photo unavailable",55,255,15,MUTED);}
          else text(cx,"Photo not provided",55,255,15,MUTED);
          text(cx,p.sku,40,462,12,MUTED,700);
          if(p.bestSelling) {cx.textAlign="right";text(cx,"BEST SELLER",580,462,12,"#96621d",700);cx.textAlign="left";}
          const title=entry.title.slice(0,5);
          title.forEach((line,i)=>text(cx,line,40,498+i*34,30,GREEN,700));
          const priceY=498+title.length*34;
          text(cx,formatProductPrice(p,"public"),40,priceY,20,GREEN,700);
          detail.forEach((line,i)=>text(cx,line,40,priceY+30+i*19,14));
        } else {
          entry.title.slice(0,3).forEach((line,i)=>text(cx,line,40,95+i*34,27,GREEN,700));
          text(cx,p.sku+"  /  CONTINUED",40,215,12,MUTED,700);
          detail.forEach((line,i)=>text(cx,line,40,246+i*17,14));
        }
        footer(cx,pages.length+1);await push(pc);
      }
    }
  }
  await originalCover(IMPACT_BACK);
  return {blob:makeCatalogPdf(pages),missing};
}
