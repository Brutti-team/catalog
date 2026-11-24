/** Approximate photograph palette. It is not object segmentation or a list
 * of orderable finishes. Sampling is local to the browser, with no upload. */
export type PhotoColour = { label: string; hex: string };
type RGB = [number, number, number];
function colourName([r,g,b]: RGB): string {
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  const chroma = max-min, light = (max+min)/2;
  if (max < 48) return "Black";
  if (min > 232) return "White";
  if (chroma < 22) return light > 194 ? "Light grey" : light < 90 ? "Dark grey" : "Grey";
  let hue = max === r ? (g-b)/chroma : max === g ? 2+(b-r)/chroma : 4+(r-g)/chroma;
  hue = (hue*60+360)%360;
  if (hue >= 15 && hue < 65 && r > b) {
    if (light > 194 && chroma < 70) return "Cream";
    if (light > 150 && chroma < 85) return "Beige";
    if (light < 150) return "Brown";
    if (hue < 43 && chroma < 135) return "Tan";
  }
  const name = hue < 15 || hue >= 345 ? "red" : hue < 45 ? "orange" : hue < 70 ? "yellow" : hue < 165 ? "green" : hue < 195 ? "teal" : hue < 255 ? "blue" : hue < 295 ? "purple" : "pink";
  if (chroma < 55) return name.charAt(0).toUpperCase()+name.slice(1)+"-grey";
  const prefix = light > 185 ? "Light " : light < 85 ? "Dark " : "";
  return prefix ? prefix+name : name.charAt(0).toUpperCase()+name.slice(1);
}
function hex(rgb: RGB): string {
  return "#"+rgb.map(n => Math.round(n).toString(16).padStart(2,"0")).join("");
}
function distance(a: RGB,b: RGB): number {
  return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
}
/** Quantize the visible pixels, prioritising the centre over the edges. */
export function paletteFromPixels(pixels: Uint8ClampedArray, width: number, height: number): PhotoColour[] {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width<1 || height<1 || pixels.length<width*height*4) return [];
  const bins = new Map<string,{ weight:number; sum:RGB }>();
  let total = 0;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const i=(y*width+x)*4;
    if(pixels[i+3]<200) continue;
    const rgb:RGB=[pixels[i],pixels[i+1],pixels[i+2]];
    const central = x>=width*.18 && x<width*.82 && y>=height*.18 && y<height*.88;
    const weight=central ? 3 : 1;
    const key=rgb.map(v=>Math.floor(v/32)).join(",");
    const bin=bins.get(key) ?? {weight:0,sum:[0,0,0] as RGB};
    bin.weight+=weight;
    for(let c=0;c<3;c++) bin.sum[c]+=rgb[c]*weight;
    bins.set(key,bin);
    total+=weight;
  }
  if(!total) return [];
  const ranked=[...bins.values()].sort((a,b)=>b.weight-a.weight);
  const chosen:RGB[]=[];
  for(const bin of ranked) {
    if(chosen.length && bin.weight<total*.025) break;
    const rgb=bin.sum.map(v=>Math.round(v/bin.weight)) as RGB;
    if(chosen.some(other=>distance(other,rgb)<60 || colourName(other)===colourName(rgb))) continue;
    chosen.push(rgb);
    if(chosen.length===3) break;
  }
  return chosen.map(rgb=>({label:colourName(rgb),hex:hex(rgb)}));
}
const cache=new Map<string,Promise<PhotoColour[]>>();
/** CORS-enabled image sources only. On errors, don't invent a palette. */
export function readPhotoColours(url:string):Promise<PhotoColour[]> {
  if(!url || typeof Image==="undefined" || /\/images\/placeholder\.svg(?:[?#]|$)/.test(url)) return Promise.resolve([]);
  const existing=cache.get(url);
  if(existing) return existing;
  const promise=new Promise<PhotoColour[]>(resolve=>{
    const img=new Image();
    let finished=false;
    const finish=(colours:PhotoColour[])=>{
      if(finished) return;
      finished=true;
      clearTimeout(timeout);
      img.onload=null;
      img.onerror=null;
      resolve(colours);
    };
    const timeout=setTimeout(()=>finish([]),8000);
    img.crossOrigin="anonymous";
    img.onerror=()=>finish([]);
    img.onload=()=>{
      try {
        if(!img.naturalWidth || !img.naturalHeight) {finish([]);return;}
        const scale=Math.min(1,64/Math.max(img.naturalWidth,img.naturalHeight));
        const canvas=document.createElement("canvas");
        canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
        canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        const ctx=canvas.getContext("2d",{willReadFrequently:true});
        if(!ctx){finish([]);return;}
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        finish(paletteFromPixels(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height));
      } catch {finish([]);}
    };
    img.src=url;
  });
  if(cache.size>=128){const first=cache.keys().next().value;if(first!==undefined)cache.delete(first);}
  cache.set(url,promise);
  void promise.then(colours=>{if(!colours.length && cache.get(url)===promise)cache.delete(url);});
  return promise;
}
