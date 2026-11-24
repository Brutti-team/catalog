import { describe, expect, it } from "vitest";
import { paletteFromPixels } from "../src/lib/photo-colours";

describe("photo palette", () => {
  it("returns actual sampled colour and never invents other colours", () => {
    const pixels = new Uint8ClampedArray([120,80,40,255,120,80,40,255]);
    expect(paletteFromPixels(pixels,2,1)).toEqual([{ label:"Brown",hex:"#785028" }]);
  });
  it("ignores transparent pixels and invalid data", () => {
    expect(paletteFromPixels(new Uint8ClampedArray([255,0,0,0]),1,1)).toEqual([]);
    expect(paletteFromPixels(new Uint8ClampedArray(),1,1)).toEqual([]);
  });
  it("finds distinct colours from different parts of a photograph", () => {
    const pixels = new Uint8ClampedArray([250,250,250,255,100,150,190,255,250,250,250,255,100,150,190,255]);
    const colours = paletteFromPixels(pixels,2,2);
    expect(colours.map(c=>c.hex)).toEqual(expect.arrayContaining(["#fafafa","#6496be"]));
  });
});
