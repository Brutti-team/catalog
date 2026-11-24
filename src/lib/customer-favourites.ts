import { useSyncExternalStore } from "react";

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
  if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent(FAVOURITE_NOTICE,{detail:{added,name}}));
}
