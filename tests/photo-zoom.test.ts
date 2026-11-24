import { describe, expect, it } from "vitest";
import { boundZoom, clampZoom, initialZoom, zoomAt } from "../src/lib/photo-zoom";
describe("customer image inspection",()=>{
 it("limits zoom to 100–400 percent",()=>{expect(clampZoom(9)).toBe(4);expect(clampZoom(0)).toBe(1);});
 it("keeps the clicked image point under the pointer",()=>{expect(zoomAt(initialZoom,2,50,-30)).toEqual({scale:2,x:-50,y:30});});
 it("prevents dragging beyond the available enlarged image",()=>{expect(boundZoom({scale:2,x:900,y:-900},400,600,800,600)).toEqual({scale:2,x:0,y:-300});});
 it("centres the original on reset",()=>{expect(boundZoom({scale:1,x:40,y:20},400,600,800,600)).toEqual(initialZoom);});
});
