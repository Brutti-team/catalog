export type ZoomView = { scale: number; x: number; y: number };
export const initialZoom: ZoomView = {scale:1,x:0,y:0};
export function clampZoom(scale:number) { return Math.max(1,Math.min(4,Number.isFinite(scale)?scale:1)); }
export function boundZoom(view:ZoomView, imageWidth:number,imageHeight:number,stageWidth:number,stageHeight:number):ZoomView {
  const scale=clampZoom(view.scale);
  const maxX=Math.max(0,(imageWidth*scale-stageWidth)/2);
  const maxY=Math.max(0,(imageHeight*scale-stageHeight)/2);
  return {scale,x:Math.max(-maxX,Math.min(maxX,view.x)),y:Math.max(-maxY,Math.min(maxY,view.y))};
}
/** Anchor scaling to the selected material detail, not just the centre. */
export function zoomAt(view:ZoomView,scale:number,x:number,y:number):ZoomView {
  const next=clampZoom(scale),ratio=next/view.scale;
  return {scale:next,x:x-(x-view.x)*ratio,y:y-(y-view.y)*ratio};
}
