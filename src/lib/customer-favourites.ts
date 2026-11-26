import { useSyncExternalStore } from "react";
import { catalogClient, catalogFavouritePublicClient } from "./catalog";

export type FavouriteSummary={visitors:number;total:number;products:{productId:string;favourites:number}[]};
export async function loadFavouriteSummary():Promise<FavouriteSummary>{
  const {data,error}=await catalogClient().rpc("catalog_customer_favourites_summary");
  if(error)throw new Error(error.message);
  if(!data||typeof data.visitors!=="number"||typeof data.total!=="number"||!Array.isArray(data.products))throw new Error("Invalid favourites response");
  return data as FavouriteSummary;
}
let browserId:string|undefined;
const browserKey="brutti-catalog-favourite-browser-v1";
const pendingKey="brutti-catalog-favourite-pending-v2";
const uuidPattern=/^[a-f\d]{8}-([a-f\d]{4}-){3}[a-f\d]{12}$/i;
const pendingWrites=new Map<string,Promise<void>>();
const memoryPending:Record<string,boolean>={};
function getBrowserId(){
  if(!browserId){
    let stored:string|null=null;
    try{stored=window.localStorage.getItem(browserKey);}catch{/* browser storage unavailable */}
    browserId=stored&&uuidPattern.test(stored)?stored:crypto.randomUUID();
    try{window.localStorage.setItem(browserKey,browserId);}catch{/* memory-only fallback */}
  }
  return browserId;
}
function pendingState():Record<string,boolean>{
  try{
    const raw=JSON.parse(window.localStorage.getItem(pendingKey)||"{}");
    if(raw&&typeof raw==="object"&&!Array.isArray(raw))return Object.fromEntries(Object.entries(raw).filter(([id,value])=>uuidPattern.test(id)&&typeof value==="boolean")) as Record<string,boolean>;
  }catch{/* memory-only fallback */}
  return {...memoryPending};
}
function persistPending(values:Record<string,boolean>){
  for(const id of Object.keys(memoryPending))delete memoryPending[id];
  Object.assign(memoryPending,values);
  try{window.localStorage.setItem(pendingKey,JSON.stringify(values));}catch{/* memory-only fallback */}
}
export const FAVOURITES_SYNCED="brutti-catalog-favourites-synced";
function recordFavourite(id:string,added:boolean){
  if(!uuidPattern.test(id))return;
  try{
    const token=getBrowserId();
    persistPending({...pendingState(),[id]:added});
    const previous=pendingWrites.get(id)??Promise.resolve();
    const next=previous.catch(()=>{}).then(async()=>{
      const {error}=await catalogFavouritePublicClient().rpc("catalog_set_customer_favourite",{p_browser_id:token,p_product_id:id,p_saved:added});
      if(error)throw new Error(error.message);
      const pending=pendingState();
      if(pending[id]===added){delete pending[id];persistPending(pending);}
      window.dispatchEvent(new Event(FAVOURITES_SYNCED));
    }).catch(error=>{console.warn("Favourite sync will retry",error);});
    pendingWrites.set(id,next);
    void next.finally(()=>{if(pendingWrites.get(id)===next)pendingWrites.delete(id);});
  }catch(error){console.warn("Favourite analytics unavailable",error);}
}

/** Backfill current public saves and retry offline removals when the public catalog opens. */
export function syncPublicFavourites(){
  refresh();
  const ids=new Set(getSnapshot());
  const pending=pendingState();
  for(const id of ids)pending[id]=true;
  for(const id of Object.keys(pending)){
    if(!pendingWrites.has(id))recordFavourite(id,ids.has(id));
  }
}

export const FAVOURITES_KEY="brutti-catalog-favourites";
export const FAVOURITE_NOTICE="brutti-favourite-notice";
const empty:readonly string[]=[];
let snapshot:readonly string[]=empty;
let initialized=false;
const listeners=new Set<()=>void>();
export function parseFavouriteIds(raw:string|null):string[]{
  try{
    const value:unknown=JSON.parse(raw||"[]");
    return Array.isArray(value)?[...new Set(value.filter((id):id is string=>typeof id==="string"&&id.length>0))]:[];
  }catch{return [];}
}
export function nextFavouriteIds(ids:readonly string[],id:string):string[]{
  return ids.includes(id)?ids.filter(item=>item!==id):[...ids,id];
}
function refresh(){
  try{
    const next=parseFavouriteIds(window.localStorage.getItem(FAVOURITES_KEY));
    if(next.length!==snapshot.length||next.some((id,i)=>id!==snapshot[i]))snapshot=next;
  }catch{/* keep in-memory selection when storage is unavailable */}
}
function getSnapshot(){
  if(typeof window!=="undefined"&&!initialized){initialized=true;refresh();}
  return snapshot;
}
function storageChanged(event:StorageEvent){
  if(event.key!==FAVOURITES_KEY&&event.key!==null)return;
  refresh();listeners.forEach(listener=>listener());
}
function subscribe(listener:()=>void){
  if(listeners.size===0){window.addEventListener("storage",storageChanged);refresh();}
  listeners.add(listener);
  return()=>{listeners.delete(listener);if(!listeners.size)window.removeEventListener("storage",storageChanged);};
}
export function useFavouriteIds(){return useSyncExternalStore(subscribe,getSnapshot,()=>empty);}
export function toggleFavouriteId(id:string,name?:string){
  const current=getSnapshot();
  const added=!current.includes(id);
  snapshot=nextFavouriteIds(current,id);
  try{window.localStorage.setItem(FAVOURITES_KEY,JSON.stringify(snapshot));}catch{/* session-only fallback */}
  listeners.forEach(listener=>listener());
  recordFavourite(id,added);
  if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent(FAVOURITE_NOTICE,{detail:{added,name}}));
}
