import type { Category, Product } from "./types";
import { formatProductPrice } from "./price";
import { formatProductDimensions, OVERALL_DIMENSION_KEYS, formatSpecificationMeasurement } from "./dimensions";
import { publicAssetUrl } from "./assets";
import { IMPACT_FRONT, IMPACT_BACK, planPdfSections, type PdfSelection } from "./catalog-pdf-plan";
import { makeCatalogPdf, type PdfRasterPage, type PdfLink } from "./catalog-pdf-file";

const PW=620, PH=877, SCALE=2;
const GREEN="#174635", INK="#243b31", MUTED="#64746b", PAPER="#faf7f1", BRONZE="#896a4d", RULE="#d4ded3";
const font=(size:number, weight=400)=> `${weight} ${size}px Inter, "Segoe UI", Arial, sans-serif`;
const editorialFont=(size:number,weight=700)=> `${weight} ${size}px Georgia, "Times New Roman", serif`;
const detailFont=font;
const clean=(value:string)=>String(value??"").replace(/\r/g,"").trim();
function lines(ctx:CanvasRenderingContext2D, value:string, width:number, size:number, weight=400,serif=false,detail=false):string[] {
  ctx.font=serif?editorialFont(size,weight):detail?detailFont(size,weight):font(size,weight);
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
function detailText(ctx:CanvasRenderingContext2D,value:string,x:number,y:number,size:number,color=INK,weight=400){
  ctx.font=detailFont(size,weight);ctx.fillStyle=color;ctx.fillText(value,x,y);
}
function editorialText(ctx:CanvasRenderingContext2D,value:string,x:number,y:number,size:number,color=GREEN,weight=700){
  ctx.font=editorialFont(size,weight);ctx.fillStyle=color;ctx.fillText(value,x,y);
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
function abortCheck(signal?:AbortSignal) {
  if(signal?.aborted)throw new DOMException("Catalogue creation cancelled.","AbortError");
}
async function photo(url:string,timeoutMs=20000,signal?:AbortSignal,cache?:Map<string,Blob>,saveBlob?:(url:string,blob:Blob)=>void):Promise<HTMLImageElement> {
  abortCheck(signal);
  const controller=new AbortController();
  const cancel=()=>controller.abort();
  signal?.addEventListener("abort",cancel,{once:true});
  const timeout=window.setTimeout(cancel,timeoutMs);
  let objectUrl="";
  try {
    let blob=cache?.get(url);
    if(!blob) {
      const response=await fetch(publicAssetUrl(url),{signal:controller.signal,mode:"cors",credentials:"omit"});
      if(!response.ok)throw new Error(`Image unavailable (HTTP ${response.status}): ${url}`);
      blob=await response.blob();
      if(!blob.size || /text\/html/i.test(blob.type))throw new Error("Image response is empty or HTML: "+url);
      saveBlob?.(url,blob);
    }
    if(controller.signal.aborted)throw new DOMException("Image loading cancelled or timed out.","AbortError");
    objectUrl=URL.createObjectURL(blob);
    const image=new Image();
    await new Promise<void>((resolve,reject)=>{
      const cleanup=()=>{controller.signal.removeEventListener("abort",stop);image.onload=null;image.onerror=null;};
      const stop=()=>{cleanup();image.src="";reject(new DOMException("Image loading cancelled or timed out.","AbortError"));};
      image.onload=()=>{cleanup();resolve();};
      image.onerror=()=>{cleanup();reject(new Error("Image decoding failed: "+url));};
      controller.signal.addEventListener("abort",stop,{once:true});
      if(controller.signal.aborted)stop();else image.src=objectUrl;
    });
    abortCheck(signal);
    if(!image.naturalWidth || !image.naturalHeight)throw new Error("Invalid image dimensions: "+url);
    return image;
  } finally {
    if(objectUrl)URL.revokeObjectURL(objectUrl);
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort",cancel);
  }
}
function fit(ctx:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number) {
  const ratio=Math.min(w/img.naturalWidth,h/img.naturalHeight);
  const iw=img.naturalWidth*ratio,ih=img.naturalHeight*ratio;
  ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
}
function footer(ctx:CanvasRenderingContext2D,page:number) {
  ctx.fillStyle="#e9ece0";ctx.beginPath();ctx.moveTo(0,848);ctx.bezierCurveTo(180,800,370,875,620,813);ctx.lineTo(620,877);ctx.lineTo(0,877);ctx.closePath();ctx.fill();
  ctx.fillStyle=GREEN;ctx.beginPath();ctx.moveTo(0,844);ctx.bezierCurveTo(165,812,390,871,620,834);ctx.lineTo(620,877);ctx.lineTo(0,877);ctx.closePath();ctx.fill();
  text(ctx,"BRUTTI  /  PRODUCT CATALOGUE",40,861,10,"#ffffff",600);
  panel(ctx,535,845,50,24,"#f1d9b7",12);
  ctx.textAlign="center";text(ctx,String(page).padStart(2,"0"),560,862,12,GREEN,700);ctx.textAlign="left";
}
function header(ctx:CanvasRenderingContext2D,label:string,logo?:HTMLImageElement) {
  ctx.fillStyle=GREEN;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(350,0);ctx.bezierCurveTo(320,15,316,55,270,57);ctx.bezierCurveTo(155,64,50,49,0,78);ctx.closePath();ctx.fill();
  if(logo){
    ctx.save();ctx.filter="brightness(0) invert(1)";fit(ctx,logo,33,10,56,38);ctx.restore();
    ctx.fillStyle="#b5c8b8";ctx.fillRect(100,16,1,27);
    text(ctx,"BRUTTI’S CATALOG",112,35,12,"#ffffff",700);
  }else text(ctx,"BRUTTI’S CATALOG",40,35,13,"#ffffff",700);
  ctx.textAlign="right";ctx.font=font(10,600);ctx.fillStyle=GREEN;ctx.fillText(label,580,34,228);ctx.textAlign="left";
  ctx.fillStyle="#caa577";ctx.fillRect(548,46,32,1.4);
}
function plainMaterials(value:string) {
  const doc=new DOMParser().parseFromString(value,"text/html");
  doc.querySelectorAll("br").forEach(el=>el.replaceWith("\n"));
  doc.querySelectorAll("li").forEach(el=>{if(!/^\s*[•\-]/.test(el.textContent||""))el.prepend("• ");el.append("\n");});
  doc.querySelectorAll("p,div").forEach(el=>el.append("\n"));
  return (doc.body.textContent||"").replace(/\*\*|__|==/g,"").replace(/\*([^*\n]+)\*/g,"$1").trim();
}
type DetailRow={value:string;size:number;weight:number;color:string;height:number;heading?:boolean;indent?:number;bullet?:boolean;gapBefore?:number;columns?:{left:DetailRow[];right:DetailRow[]};dimensionTable?:{name:string;values:string[];height:number}[]};
function productLines(ctx:CanvasRenderingContext2D,p:Product,width:number,remainingDescription:string[]):DetailRow[] {
  const result:DetailRow[]=[];
  const add=(label:string,value:string,columnWidth=width)=>{
    if(!clean(value))return;
    if(label) {
      const heading=label==="Materials & finishing"?"Materials & Finishing":label;
      const headings=lines(ctx,heading,columnWidth,15,700,false,true);
      headings.forEach(line=>result.push({value:line,size:15,weight:700,color:GREEN,height:24,heading:true}));
    }
    const paragraphs=clean(value).split("\n").map(line=>line.trim()).filter(Boolean);
    paragraphs.forEach((paragraph,paragraphIndex)=>{
      const bullet=paragraph.match(/^(?:[•–-])\s+(.+)$/);
      const isBullet=Boolean(bullet)||label==="Materials & finishing";
      const wrapped=lines(ctx,bullet?bullet[1]:paragraph,isBullet?columnWidth-16:columnWidth,12,400,false,true);
      wrapped.forEach((line,i)=>result.push({
        value:line,size:12,weight:400,color:INK,
        bullet:isBullet&&i===0,indent:isBullet?16:0,
        height:17+(i===wrapped.length-1?(paragraphIndex===paragraphs.length-1?9:5):0)
      }));
    });
  };
  if(remainingDescription.length) add("Description",remainingDescription.join("\n"));
  const materials=plainMaterials(p.materials||"").replace(/^(?:[•\s]*)(?:materials?|material)\s*:\s*/i,"");
  const materialsStart=result.length;
  add("Materials & finishing",materials);
  const dimensionsStart=result.length;
  // Keep the stacked arrangement as the default for long materials or narrow pages.
  const keys=OVERALL_DIMENSION_KEYS.filter(key=>Number.isFinite(p[key])&&p[key]>0);
  if(keys.length){
    const gapBefore=result.length?12:0;
    result.push({value:"Dimensions",size:15,weight:700,color:GREEN,height:25+gapBefore,heading:true,gapBefore});
    const dimensionTable=keys.map(key=>{
      const name=key==="width"?"Width":key==="depth"?"Depth":"Height";
      const value=formatProductDimensions({width:0,depth:0,height:0,dimensionUnits:p.dimensionUnits,[key]:p[key]}).replace(/ [WDH]$/,"");
      const values=lines(ctx,value,118,12,600,false,true);
      return {name,values,height:Math.max(30,values.length*16+14)};
    });
    result.push({value:"",size:12,weight:700,color:GREEN,height:28+dimensionTable.reduce((sum,row)=>sum+row.height,0)+6,dimensionTable});
  }
  // Use the available horizontal space only when the measured text is short
  // enough. A two-column group is paginated atomically, preventing overlap or
  // a detached heading. Longer materials retain the full-width stacked layout.
  if(keys.length&&materials&&width>=540){
    const stacked=result.slice(materialsStart);
    const right=result.slice(dimensionsStart).map(row=>row.heading?{...row,gapBefore:0,height:row.height-(row.gapBefore??0)}:row);
    result.splice(materialsStart);
    add("Materials & finishing",materials,270);
    const left=result.splice(materialsStart);
    const leftHeight=left.reduce((sum,row)=>sum+row.height,0);
    const rightHeight=right.reduce((sum,row)=>sum+row.height,0);
    const bodyLines=left.filter(row=>!row.heading).length;
    const bulletCount=left.filter(row=>row.bullet).length;
    // Side by side only for one or two genuinely short, single-line material items.
    // Any wrapped bullet or longer list needs the full width above Dimensions.
    if(bulletCount>0&&bulletCount<=2&&bodyLines===bulletCount&&leftHeight<=Math.min(125,rightHeight+12)){
      const gapBefore=materialsStart?10:0;
      result.push({value:"",size:12,weight:400,color:INK,height:Math.max(leftHeight,rightHeight)+gapBefore+8,gapBefore,columns:{left,right}});
    }else result.push(...stacked);
  }
  for(const row of p.specifications??[]) {
    if(row.kind==="section") {
      if(clean(row.name)) {
        for(const line of lines(ctx,row.name,width,15,700,false,true))result.push({value:line,size:15,weight:700,color:GREEN,height:24,heading:true});
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
  for(const row of rows){
    const start=y+(row.gapBefore??0);
    if(row.columns){
      drawRows(ctx,row.columns.left,start,x);
      drawRows(ctx,row.columns.right,start,x+290);
    }else if(row.dimensionTable){
      const w=250, divider=x+112, valueCenter=(divider+x+w)/2, headerHeight=28;
      const tableHeight=headerHeight+row.dimensionTable.reduce((sum,item)=>sum+item.height,0);
      ctx.fillStyle="#e7ece1";ctx.fillRect(x,y,w,headerHeight);
      ctx.textAlign="left";detailText(ctx,"Label",x+12,y+18,12,GREEN,600);
      ctx.textAlign="center";detailText(ctx,"Value",valueCenter,y+18,12,GREEN,600);
      let rowY=y+headerHeight;
      for(const [index,item] of row.dimensionTable.entries()){
        ctx.fillStyle=index%2===0?"#fafbf7":"#f1f4ec";
        ctx.fillRect(x,rowY,w,item.height);
        ctx.textAlign="left";detailText(ctx,item.name,x+12,rowY+item.height/2+4,12,INK,400);
        ctx.textAlign="center";
        const valueY=rowY+item.height/2+4-(item.values.length-1)*8;
        item.values.forEach((value,j)=>detailText(ctx,value,valueCenter,valueY+j*16,12,GREEN,600));
        ctx.fillStyle=RULE;ctx.fillRect(x,rowY,w,.65);
        rowY+=item.height;
      }
      ctx.fillStyle=RULE;ctx.fillRect(divider,y,.65,tableHeight);
      ctx.strokeStyle=RULE;ctx.lineWidth=.65;ctx.strokeRect(x,y,w,tableHeight);
      ctx.textAlign="left";
    }else if(row.heading){
      detailText(ctx,row.value,x,start+row.size,row.size,row.color,row.weight);
    }else{
      if(row.bullet){ctx.fillStyle=GREEN;ctx.beginPath();ctx.arc(x+3,start+row.size-4,1.8,0,Math.PI*2);ctx.fill();}
      detailText(ctx,row.value,x+(row.indent??0),start+row.size,row.size,row.color,row.weight);
    }
    y+=row.height;
  }
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
// Single-photo pages use a consistent landscape frame, with proportional fill.
function singlePhotoFill(ctx:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number){
  const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight);
  const iw=img.naturalWidth*scale,ih=img.naturalHeight*scale;
  ctx.save();rounded(ctx,x,y,w,h,10);ctx.clip();
  ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
  ctx.restore();
}
const BOTTOM=806, SINGLE_PHOTO_WIDTH=480, SINGLE_PHOTO_HEIGHT=372;
type ProductPlan={product:Product;title:string[];price:string[];basis:string;priceSize:number;titleSize:number;
  photos:string[];photoTop:number;heroHeight:number;extrasHeight:number;identityTop:number;
  description:string[];
  detailTop:number;continuationTop:number;detail:DetailRow[][]};
export async function generateCatalogPdf(products:Product[],categories:Category[],mode:PdfSelection,categoryId:string,favourites:string[],onProgress:(done:number,total:number)=>void,signal?:AbortSignal) {
  abortCheck(signal);
  const sections=planPdfSections(products,categories,mode,categoryId,favourites);
  if(!sections.length)throw new Error("No published products match this selection.");
  // Wait for the same font used by the public catalogue before measuring text.
  // A system sans-serif remains available if the external font cannot load.
  if(document.fonts && typeof document.fonts.load==="function")await Promise.race([
    Promise.all([400,500,600,700].map(weight=>document.fonts.load(font(16,weight),"Brutti Catalogue"))).catch(()=>[]),
    new Promise<void>(resolve=>window.setTimeout(resolve,4500))
  ]);
  abortCheck(signal);
  // Reuse compressed primary photos from the orientation pass. Cap the cache
  // to avoid retaining an unbounded number of full-size decoded images.
  const primaryCache=new Map<string,Blob>();
  let cacheBytes=0;
  const savePrimary=(url:string,blob:Blob)=>{
    if(!primaryCache.has(url)&&cacheBytes+blob.size<=48*1024*1024){
      primaryCache.set(url,blob);cacheBytes+=blob.size;
    }
  };
  const loadPhoto=(url:string,timeout=20000)=>photo(url,timeout,signal,primaryCache);
  // The first 25% represents image inspection, the rest page rendering.
  const primaryUrls=[...new Set(sections.flatMap(section=>section.products.map(p=>p.images.find(im=>Boolean(im.url?.trim()))?.url?.trim()).filter((url):url is string=>Boolean(url))))];
  let inspected=0,nextPrimary=0;
  const inspect=async()=>{
    while(nextPrimary<primaryUrls.length){
      abortCheck(signal);
      const url=primaryUrls[nextPrimary++];
      try {await photo(url,6000,signal,primaryCache,savePrimary);}
      catch {abortCheck(signal);}
      inspected++;
      onProgress(Math.round(inspected/Math.max(1,primaryUrls.length)*25),100);
    }
  };
  await Promise.all(Array.from({length:Math.min(6,primaryUrls.length)},()=>inspect()));
  abortCheck(signal);
  onProgress(25,100);
  const measure=sheet();
  const plan=sections.map(section=>({...section,entries:section.products.map(product=>{
    const ctx=measure.ctx;
    const photos=[...new Set(product.images.map(image=>image.url?.trim()).filter((url):url is string=>Boolean(url)))].slice(0,4);
    const descPlain=plainMaterials(product.description||"");
    // Unified full-width editorial layout: fit every source image without cropping.
    // Two photos share the row; three have a hero plus a pair; four use a 2x2 grid.
    const titleSize=product.name.length>70?29:37;
    const title=lines(ctx,product.name,350,titleSize,700,true);
    const formatted=formatProductPrice(product,"public");
    const basis=formatted.startsWith("Starting from ")?"Starting from":"";
    const priceSize=formatted==="On enquiry"?20:34;
    const price=lines(ctx,basis?formatted.slice(14):formatted,175,priceSize,700,true);
    const desc=lines(ctx,descPlain,540,14,400);
    const description=desc.slice(0,2);
    const detail=productLines(ctx,product,540,desc.slice(description.length));
    const detailHeight=detail.reduce((n,row)=>n+row.height,0);
    const titleLine=titleSize+5;
    const priceHeight=titleSize+Math.max(0,price.length-1)*(priceSize+6)+6;
    const identityTop=82;
    const titleBlock=Math.max(title.length*titleLine,priceHeight);
    const photoTop=identityTop+29+titleBlock+(product.bestSelling?25:0)+description.length*20+(description.length?8:0)+28;
    // Preserve readable photo sizes, moving excess specifications onto continuation pages.
    const minimumPhoto=photos.length>=3?260:170;
    const reserve=Math.min(detailHeight,240);
    const available=Math.max(50,BOTTOM-photoTop-22);
    const photoSpace=Math.min(available,Math.max(minimumPhoto,available-reserve));
    let heroHeight=photoSpace,extrasHeight=0;
    if(photos.length===3){
      extrasHeight=Math.max(1,Math.floor((photoSpace-10)*.36));
      heroHeight=photoSpace-extrasHeight-10;
    }else if(photos.length>=4){
      heroHeight=Math.floor((photoSpace-10)/2);
      extrasHeight=photoSpace-heroHeight-10;
    }else if(!photos.length){
      heroHeight=Math.min(photoSpace,70);
    }else if(photos.length===1){
      // Reserve a consistent single-image frame independently of the text length.
      // Only reduce it if an unusually tall product heading would exceed the page.
      heroHeight=Math.min(SINGLE_PHOTO_HEIGHT,available);
    }
    const detailTop=photoTop+heroHeight+(extrasHeight?extrasHeight+10:0)+22;
    const continuationTop=110+lines(ctx,product.name,540,27,700,true).length*32+20;
    const first=detail.length&&detail[0].height+(detail[0].heading?(detail[1]?.height??0):0)<=BOTTOM-detailTop?takeRows(detail,0,BOTTOM-detailTop):0;
    const chunks=[detail.slice(0,first)];
    for(let i=first;i<detail.length;){const end=takeRows(detail,i,BOTTOM-continuationTop);chunks.push(detail.slice(i,end));i=end;}
    return {product,title,price,basis,priceSize,titleSize,photos,photoTop,heroHeight,extrasHeight,identityTop,description,detailTop,continuationTop,detail:chunks} as ProductPlan;
  })}));
  measure.canvas.width=1;measure.canvas.height=1;
  const contentsCount=Math.max(1,Math.ceil(plan.length/15));
  let pageNumber=2+contentsCount;
  const sectionPages=plan.map(s=>{const page=pageNumber;pageNumber+=1+s.entries.reduce((n,e)=>n+e.detail.length,0);return page;});
  const total=pageNumber;
  const pages:PdfRasterPage[]=[];
  let missing=0;
  const push=async(canvas:HTMLCanvasElement,links?:PdfLink[])=>{
    try { abortCheck(signal);const page=await jpeg(canvas,links);abortCheck(signal);pages.push(page); }
    catch(error) { abortCheck(signal);console.error("[Catalogue PDF] Page encoding failed",{page:pages.length+1},error);throw new Error("PDF page rendering failed at page "+(pages.length+1)+". Refresh the page and retry."); }
    finally {canvas.width=1;canvas.height=1;}
    onProgress(25+Math.floor(pages.length/total*74),100);
    await new Promise<void>(resolve=>window.setTimeout(resolve,0));
    abortCheck(signal);
  };
  const originalCover=async(url:string)=>{
    const {canvas,ctx}=sheet();
    try {
      let img:HTMLImageElement;
      try { img=await loadPhoto(url); } catch(firstError) {
        abortCheck(signal);
        console.warn("[Catalogue PDF] Retrying original cover",url,firstError);
        try { img=await loadPhoto(url); } catch(error) {
          abortCheck(signal);
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
  try {brandLogo=await loadPhoto("/images/brutti-wordmark.svg");} catch { abortCheck(signal); /* Text header is the fallback. */ }
  for(let i=0;i<contentsCount;i++) {
    abortCheck(signal);
    const {canvas,ctx}=sheet();header(ctx,"COLLECTION INDEX",brandLogo);
    // Editorial contents: measured columns, vertically centred rows and consistent rules.
    editorialText(ctx,"Product Catalogue",40,115,36);
    text(ctx,"Explore our physical & creative works",40,139,13,MUTED,400);
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
    abortCheck(signal);
    const {canvas,ctx}=sheet();
    let referenceLoaded=false;
    if(section.cover && section.reference) {
      try {
        const img=await loadPhoto(section.cover);ctx.fillStyle="#fff";ctx.fillRect(0,0,PW,PH);fit(ctx,img,0,0,PW,PH);
        referenceLoaded=true;
      } catch(error) {
        abortCheck(signal);missing++;
        console.warn("[Catalogue PDF] Category cover unavailable",section.name,error);
      }
    }
    if(!referenceLoaded) {
      header(ctx,"SECTION "+String(index+1).padStart(2,"0"),brandLogo);
      editorialText(ctx,section.name,40,112,30);
      if(section.cover && !section.reference)try {fit(ctx,await loadPhoto(section.cover),40,145,540,630);}catch(error) {abortCheck(signal);missing++;console.warn("[Catalogue PDF] Category image unavailable",section.name,error);}
      footer(ctx,pages.length+1);
    }
    await push(canvas);
    for(const entry of section.entries) {
      const p=entry.product;
      for(const [part,detail] of entry.detail.entries()) {
        abortCheck(signal);
        const {canvas:pc,ctx:cx}=sheet();
        header(cx,section.name.toUpperCase(),brandLogo);
        if(part===0) {
          const x=40;
          const identityY=entry.identityTop;
          cx.font=font(11,700);
          const idWidth=Math.min(350,Math.max(62,cx.measureText(p.sku).width+22));
          panel(cx,x,identityY-3,idWidth,22,"#f1d9b7",11);
          cx.fillStyle=GREEN;cx.fillText(p.sku,x+11,identityY+12,idWidth-22);
          const lineHeight=entry.titleSize+5;
          const titleTop=identityY+29;
          entry.title.forEach((line,i)=>editorialText(cx,line,x,titleTop+entry.titleSize+i*lineHeight,entry.titleSize));
          const priceHeight=entry.titleSize+Math.max(0,entry.price.length-1)*(entry.priceSize+6)+6;
          const priceX=580,priceBaseline=titleTop+entry.titleSize;
          // Align the first price line to the first product-title baseline, with its label above.
          cx.textAlign="right";
          text(cx,entry.basis||"Price",priceX,priceBaseline-entry.priceSize-6,11,MUTED,500);
          let py=priceBaseline;
          for(const line of entry.price){editorialText(cx,line,priceX,py,entry.priceSize,GREEN,700);py+=entry.priceSize+6;}
          cx.textAlign="left";
          let y=titleTop+Math.max(entry.title.length*lineHeight,priceHeight);
          if(p.bestSelling){text(cx,"★  BEST SELLER",x,y+12,10,BRONZE,700);y+=25;}
          for(const line of entry.description){text(cx,line,x,y+14,14,MUTED,400);y+=20;}
          const loaded=await Promise.all(entry.photos.map(async url=>{
            try{return await loadPhoto(url);}
            catch(error){abortCheck(signal);missing++;console.warn("[Catalogue PDF] Product photo unavailable",p.sku,error);return null;}
          }));
          abortCheck(signal);
          const drawPhoto=(index:number,px:number,py:number,w:number,h:number)=>{
            const img=loaded[index];
            if(img)photoFitRounded(cx,img,px,py,w,h);
            else text(cx,entry.photos.length?"Photo unavailable":"Photo not provided",px+10,py+25,12,MUTED);
          };
          const top=entry.photoTop, gap=10, left=40, width=540;
          const aspect=(i:number)=>{
            const img=loaded[i];
            return img&&img.naturalWidth&&img.naturalHeight?img.naturalWidth/img.naturalHeight:1;
          };
          // Pack a row by the real image aspect ratios, not by equally spaced
          // oversized slots. Keep the original image intact and the gutter fixed.
          const drawRow=(indices:number[],y:number,maxHeight:number)=>{
            const sum=indices.reduce((total,i)=>total+aspect(i),0);
            const h=Math.min(maxHeight,(width-gap*(indices.length-1))/sum);
            const rowWidth=h*sum+gap*(indices.length-1);
            let x=left+(width-rowWidth)/2;
            const rowY=y+(maxHeight-h)/2;
            for(const i of indices){
              const w=h*aspect(i);
              drawPhoto(i,x,rowY,w,h);
              x+=w+gap;
            }
          };
          const totalHeight=entry.heroHeight+(entry.extrasHeight?entry.extrasHeight+gap:0);
          if(loaded.length===1){
            // Match the approved landscape image size; never stretch the source.
            const frameX=left+(width-SINGLE_PHOTO_WIDTH)/2;
            const img=loaded[0];
            if(img)singlePhotoFill(cx,img,frameX,top,SINGLE_PHOTO_WIDTH,entry.heroHeight);
            else drawPhoto(0,frameX,top,SINGLE_PHOTO_WIDTH,entry.heroHeight);
          }else if(loaded.length===3&&aspect(0)<1&&totalHeight>gap+2){
            // Tall hero at left and two larger detail views stacked at right.
            const a=aspect(0), b=aspect(1), c=aspect(2);
            const stackRatio=1/(1/b+1/c);
            const h=Math.min(totalHeight,(width-gap+gap*stackRatio)/(a+stackRatio));
            if(h>gap+2){
              const heroW=h*a, sideW=(h-gap)*stackRatio;
              const x=left+(width-heroW-gap-sideW)/2;
              const y=top+(totalHeight-h)/2;
              drawPhoto(0,x,y,heroW,h);
              drawPhoto(1,x+heroW+gap,y,sideW,sideW/b);
              drawPhoto(2,x+heroW+gap,y+sideW/b+gap,sideW,sideW/c);
            }else drawRow([0,1,2],top,totalHeight);
          }else if(loaded.length===2){
            drawRow([0,1],top,entry.heroHeight);
          }else if(loaded.length>=4){
            drawRow([0,1],top,entry.heroHeight);
            drawRow([2,3],top+entry.heroHeight+gap,entry.extrasHeight);
          }else{
            drawPhoto(0,left,top,width,entry.heroHeight);
            if(loaded.length===3){
              drawRow([1,2],top+entry.heroHeight+gap,entry.extrasHeight);
            }
          }
          drawRows(cx,detail,entry.detailTop);
        } else {
          const title=lines(cx,p.name,540,27,700,true);
          text(cx,p.sku+"  /  CONTINUED",40,82,11,BRONZE,600);
          title.forEach((line,i)=>editorialText(cx,line,40,110+i*32,27));
          cx.fillStyle=RULE;cx.fillRect(40,entry.continuationTop-8,540,1);
          drawRows(cx,detail,entry.continuationTop);
        }
        footer(cx,pages.length+1);await push(pc);
      }
    }
  }
  await originalCover(IMPACT_BACK);
  abortCheck(signal);
  const blob=makeCatalogPdf(pages);
  abortCheck(signal);
  onProgress(100,100);
  return {blob,missing};
}
