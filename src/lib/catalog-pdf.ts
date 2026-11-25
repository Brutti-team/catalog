import type { Category, Product } from "./types";
import { formatProductPrice } from "./price";
import { formatProductDimensions, OVERALL_DIMENSION_KEYS, formatSpecificationMeasurement } from "./dimensions";
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
type DetailRow={value:string;size:number;weight:number;color:string;height:number;heading?:boolean;indent?:number};
function productLines(ctx:CanvasRenderingContext2D,p:Product,width:number,remainingDescription:string[]):DetailRow[] {
  const result:DetailRow[]=[];
  const add=(label:string,value:string)=>{
    if(!clean(value))return;
    if(label) {
      const headings=lines(ctx,label.toUpperCase(),width,11,600);
      headings.forEach(line=>result.push({value:line,size:11,weight:600,color:GREEN,height:18,heading:true}));
    }
    const paragraphs=clean(value).split("\n").map(line=>line.trim()).filter(Boolean);
    paragraphs.forEach((paragraph,paragraphIndex)=>{
      const bullet=paragraph.match(/^(?:[•–-])\s+(.+)$/);
      const wrapped=lines(ctx,bullet?bullet[1]:paragraph,bullet?width-18:width,14,400);
      wrapped.forEach((line,i)=>result.push({
        value:bullet&&i===0?"•  "+line:line,size:14,weight:400,color:INK,
        indent:bullet&&i>0?18:0,
        height:20+(i===wrapped.length-1?(paragraphIndex===paragraphs.length-1?12:3):0)
      }));
    });
  };
  if(remainingDescription.length) add("Description",remainingDescription.join("\n"));
  add("Materials & finishing",plainMaterials(p.materials||"").replace(/^(?:[•\s]*)(?:materials?|material)\s*:\s*/i,""));
  for(const row of p.specifications??[]) {
    if(row.kind==="section") {
      if(clean(row.name)) {
        for(const line of lines(ctx,row.name.toUpperCase(),width,12,600))result.push({value:line,size:12,weight:600,color:GREEN,height:22,heading:true});
      }
      continue;
    }
    const details=[row.kind==="measurement"?formatSpecificationMeasurement(row.value||""):row.value,row.quantity&&row.quantity>0?row.quantity+" pcs":"",row.description].filter(Boolean).join(" · ");
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
function drawRows(ctx:CanvasRenderingContext2D,rows:DetailRow[],top:number,x=40) {
  let y=top;
  for(const row of rows){text(ctx,row.value,x+(row.indent??0),y+row.size,row.size,row.color,row.weight);y+=row.height;}
}
function rounded(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number) {
  const a=Math.min(r,w/2,h/2);
  ctx.beginPath();ctx.moveTo(x+a,y);ctx.arcTo(x+w,y,x+w,y+h,a);ctx.arcTo(x+w,y+h,x,y+h,a);
  ctx.arcTo(x,y+h,x,y,a);ctx.arcTo(x,y,x+w,y,a);ctx.closePath();
}
function panel(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string,r=9) {
  rounded(ctx,x,y,w,h,r);ctx.fillStyle=color;ctx.fill();
}
function photoFitRounded(ctx:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number) {
  const ratio=Math.min(w/img.naturalWidth,h/img.naturalHeight);
  const iw=img.naturalWidth*ratio,ih=img.naturalHeight*ratio;
  const ix=x+(w-iw)/2,iy=y+(h-ih)/2;
  ctx.save();rounded(ctx,ix,iy,iw,ih,10);ctx.clip();
  ctx.drawImage(img,ix,iy,iw,ih);ctx.restore();
}
const HERO_TOP=66, SIDE_X=366, SIDE_W=214, HERO_W=310, BOTTOM=810;
type DimensionCard={label:string;value:string[]};
type ProductPlan={product:Product;title:string[];price:string[];basis:string;priceSize:number;titleSize:number;
  photos:string[];heroHeight:number;description:string[];dimensions:DimensionCard[];dimensionHeight:number;
  detailTop:number;detailX:number;continuationTop:number;detail:DetailRow[][]};
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
    const ctx=measure.ctx;
    const photos=[...new Set(product.images.map(image=>image.url?.trim()).filter((url):url is string=>Boolean(url)))].slice(0,4);
    const extras=Math.max(0,photos.length-1);
    let titleSize=31;
    let title=lines(ctx,product.name,SIDE_W,titleSize,700);
    while(title.length>4&&titleSize>20){titleSize--;title=lines(ctx,product.name,SIDE_W,titleSize,700);}
    const formatted=formatProductPrice(product,"public");
    const basis=formatted.startsWith("Starting from ")?"Starting from":"";
    const priceSize=formatted==="On enquiry"?19:25;
    const price=lines(ctx,basis?formatted.slice(14):formatted,SIDE_W-24,priceSize,700);
    const titleLine=titleSize+5;
    const identityHeight=56+title.length*titleLine+17+Math.max(48,price.length*(priceSize+4)+(basis?19:0)+20)+14+(product.bestSelling?30:0);
    const desc=lines(ctx,plainMaterials(product.description||""),SIDE_W,14,400);
    // Keep the description with the product identity when possible. Overflow
    // continues in the specifications; no text or measurements are discarded.
    const targetHero=Math.min(extras?408:500,BOTTOM-HERO_TOP-(extras?132:0)-32-185);
    const descriptionCount=Math.min(desc.length,Math.max(0,Math.floor((targetHero-identityHeight-14)/20)));
    const description=desc.slice(0,descriptionCount);
    const dimensions=OVERALL_DIMENSION_KEYS.filter(key=>Number.isFinite(product[key])&&product[key]>0).map(key=>{
      const value=formatProductDimensions({width:0,depth:0,height:0,dimensionUnits:product.dimensionUnits,[key]:product[key]}).replace(/ [WDH]$/,"");
      return {label:key.toUpperCase(),value:lines(ctx,value,188,15,600)};
    });
    const dimensionHeight=dimensions.length?25+dimensions.reduce((n,d)=>n+Math.max(43,23+d.value.length*18)+7,0):0;
    const detailX=dimensions.length?270:40;
    const detail=productLines(ctx,product,580-detailX,desc.slice(descriptionCount));
    const detailHeight=detail.reduce((n,row)=>n+row.height,0);
    const stripHeight=extras?132:0;
    const neededBottom=Math.max(dimensionHeight,detailHeight);
    const heroHeight=Math.max(280,identityHeight+description.length*20+14,
      Math.min(extras?430:545,BOTTOM-HERO_TOP-stripHeight-32-neededBottom));
    const detailTop=HERO_TOP+heroHeight+stripHeight+24;
    const continuationTop=105+lines(ctx,product.name,540,25,600).length*31+20;
    // If an unusually long title pushes the first-page budget down, retain
    // the full product name on continuation pages instead of clipping details.
    const first=detail.length&&detail[0].height<=BOTTOM-detailTop?takeRows(detail,0,BOTTOM-detailTop):0;
    const chunks=[detail.slice(0,first)];
    for(let i=first;i<detail.length;){const end=takeRows(detail,i,BOTTOM-continuationTop);chunks.push(detail.slice(i,end));i=end;}
    return {product,title,price,basis,priceSize,titleSize,photos,heroHeight,description,dimensions,dimensionHeight,detailTop,detailX,continuationTop,detail:chunks} as ProductPlan;
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
  let brandLogo:HTMLImageElement|undefined;
  try {brandLogo=await photo("/images/brutti-wordmark.svg");} catch { /* Text header is the fallback. */ }
  for(let i=0;i<contentsCount;i++) {
    const {canvas,ctx}=sheet();header(ctx,"COLLECTION INDEX");
    // Editorial contents: measured columns, vertically centred rows and consistent rules.
    text(ctx,"Product Catalogue",40,101,34,GREEN,600);
    text(ctx,"Explore our physical & creative works",40,129,13,MUTED,400);
    ctx.fillStyle=GREEN;ctx.fillRect(40,148,32,2);
    const links:PdfLink[]=[];
    const rowStart=207,rowHeight=40;
    ctx.fillStyle="#eaf0e9";ctx.fillRect(40,173,540,29);
    text(ctx,"NO.",52,191,10,MUTED,600);
    text(ctx,"COLLECTION",92,191,10,MUTED,600);
    ctx.textAlign="right";text(ctx,"PAGE",568,191,10,MUTED,600);ctx.textAlign="left";
    plan.slice(i*15,(i+1)*15).forEach((s,j)=>{
      const idx=i*15+j,top=rowStart+j*rowHeight,baseline=top+24;
      text(ctx,String(idx+1).padStart(2,"0"),52,baseline,11,BRONZE,500);
      const title=lines(ctx,s.name,420,15,600);
      ctx.font=font(15,600);ctx.fillStyle=INK;
      if(title.length<=1)ctx.fillText(title[0]||s.name,92,baseline,420);
      else {
        ctx.fillText(title[0],92,top+17,420);
        ctx.font=font(13,500);ctx.fillText(title.slice(1).join(" "),92,top+32,420);
      }
      ctx.textAlign="right";text(ctx,String(sectionPages[idx]),568,baseline,15,GREEN,600);ctx.textAlign="left";
      ctx.fillStyle=RULE;ctx.fillRect(40,top+rowHeight-1,540,0.7);
      links.push({x:40,y:top,w:540,h:rowHeight,page:sectionPages[idx]-1});
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
        const {canvas:pc,ctx:cx}=sheet();
        if(brandLogo){
          fit(cx,brandLogo,40,18,44,32);
          cx.fillStyle=RULE;cx.fillRect(92,24,1,20);
          text(cx,"BRUTTI’S CATALOG",103,41,12,GREEN,700);
          cx.textAlign="right";cx.font=font(10,600);cx.fillStyle=MUTED;
          cx.fillText(section.name.toUpperCase(),580,41,290);cx.textAlign="left";
        }else header(cx,section.name.toUpperCase());
        if(part===0) {
          if(entry.photos[0])try{
            photoFitRounded(cx,await photo(entry.photos[0]),40,HERO_TOP,HERO_W,entry.heroHeight);
          }catch(error){missing++;console.warn("[Catalogue PDF] Product photo unavailable",p.sku,error);text(cx,"Photo unavailable",54,HERO_TOP+entry.heroHeight/2,13,MUTED);}
          else text(cx,"Photo not provided",54,HERO_TOP+entry.heroHeight/2,13,MUTED);
          let y=HERO_TOP+12;
          cx.font=font(11,600);
          const skuW=Math.min(SIDE_W,Math.max(58,cx.measureText(p.sku).width+22));
          panel(cx,SIDE_X,y,skuW,25,"#e5ede1",12);
          cx.textAlign="center";cx.font=font(11,600);cx.fillStyle=GREEN;cx.fillText(p.sku,SIDE_X+skuW/2,y+16,skuW-14);cx.textAlign="left";
          y+=44;
          for(const line of entry.title){text(cx,line,SIDE_X,y+entry.titleSize,entry.titleSize,GREEN,700);y+=entry.titleSize+5;}
          cx.fillStyle=GREEN;cx.fillRect(SIDE_X,y+2,42,2);y+=17;
          const priceHeight=Math.max(48,entry.price.length*(entry.priceSize+4)+(entry.basis?19:0)+20);
          panel(cx,SIDE_X,y,SIDE_W,priceHeight,"#e5ede1",10);
          let priceY=y+12;
          if(entry.basis){text(cx,entry.basis,SIDE_X+12,priceY+10,10,MUTED,500);priceY+=19;}
          for(const line of entry.price){text(cx,line,SIDE_X+12,priceY+entry.priceSize,entry.priceSize,GREEN,700);priceY+=entry.priceSize+4;}
          y+=priceHeight+14;
          if(p.bestSelling){
            panel(cx,SIDE_X,y,95,22,"#a13732",6);
            text(cx,"BEST SELLER",SIDE_X+10,y+15,10,"#ffffff",600);y+=30;
          }
          for(const line of entry.description){text(cx,line,SIDE_X,y+14,14,MUTED,400);y+=20;}
          const extras=entry.photos.slice(1);
          if(extras.length){
            const w=(540-(extras.length-1)*10)/extras.length;
            for(const [i,url] of extras.entries())try {
              photoFitRounded(cx,await photo(url),40+i*(w+10),HERO_TOP+entry.heroHeight+12,w,110);
            }catch(error){missing++;console.warn("[Catalogue PDF] Additional product photo unavailable",p.sku,error);}
          }
          cx.fillStyle=RULE;cx.fillRect(40,entry.detailTop-12,540,1);
          if(entry.dimensions.length){
            text(cx,"DIMENSIONS",40,entry.detailTop+12,11,GREEN,700);
            let dy=entry.detailTop+25;
            for(const dimension of entry.dimensions){
              const h=Math.max(43,23+dimension.value.length*18);
              panel(cx,40,dy,210,h,"#edf0e7",8);
              text(cx,dimension.label,50,dy+13,10,MUTED,600);
              dimension.value.forEach((line,i)=>text(cx,line,50,dy+31+i*18,15,GREEN,600));
              dy+=h+7;
            }
            if(detail.length){cx.fillStyle=RULE;cx.fillRect(259,entry.detailTop,1,Math.max(entry.dimensionHeight,detail.reduce((n,r)=>n+r.height,0)));}
          }
          drawRows(cx,detail,entry.detailTop,entry.detailX);
        } else {
          const title=lines(cx,p.name,540,25,600);
          text(cx,p.sku+"  /  CONTINUED",40,75,11,BRONZE,600);
          title.forEach((line,i)=>text(cx,line,40,105+i*31,25,GREEN,600));
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
