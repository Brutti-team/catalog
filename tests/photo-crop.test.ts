import { describe, expect, it } from "vitest";
import { clampCrop, DEFAULT_PHOTO_CROP, normalisePhotoCrop, photoCropStyle } from "../src/lib/photo-crop";

describe("Brutti Catalog non-destructive photo composition", () => {
  it("does not change any legacy image without crop settings", () => {
    expect(photoCropStyle({})).toBeUndefined();
    expect(photoCropStyle()).toBeUndefined();
  });

  it("starts with a centred, unzoomed image", () => {
    expect(normalisePhotoCrop(undefined)).toEqual(DEFAULT_PHOTO_CROP);
  });

  it("clamps unsafe or out-of-range focus and zoom", () => {
    expect(normalisePhotoCrop({ x: -42, y: 150, zoom: 99 })).toEqual({
      x: 0, y: 100, zoom: 2.5,
    });
    expect(clampCrop(Number.NaN, 0, 100)).toBe(0);
  });

  it("produces a consistent public crop without changing the image URL", () => {
    const image = { id: "photo-1", url: "https://images.example.com/photo.jpg", alt: "",
      crop: { x: 20, y: 70, zoom: 1.5 } };
    const composed = photoCropStyle(image);
    expect(composed?.objectFit).toBe("cover");
    expect(composed?.objectPosition).toBe("20% 70%");
    expect(composed?.transform).toBe("scale(1.5)");
    expect(image.url).toBe("https://images.example.com/photo.jpg");
  });
});

import { catalogCardPhotoStyle, publicPhotoCropStyle } from "../src/lib/photo-crop";

describe("shared catalogue card framing", () => {
  const photo = { id: "one", url: "/photo.webp", alt: "Desk", preservedOriginalPaths: ["original.webp"] };
  it("uses the same cover framing for edited and unedited card photos", () => {
    expect(catalogCardPhotoStyle(photo)).toEqual(catalogCardPhotoStyle({ ...photo, preservedOriginalPaths: undefined }));
    expect(catalogCardPhotoStyle(photo)).toMatchObject({ objectFit: "cover", objectPosition: "center 67%", transform: "none" });
    expect(publicPhotoCropStyle(photo)).toMatchObject({ objectFit: "contain" });
  });
  it("preserves explicitly chosen cover position and zoom", () => {
    expect(catalogCardPhotoStyle({ ...photo, crop: { x: 22, y: 75, zoom: 1.4 } })).toMatchObject({ objectPosition: "22% 75%", transform: "scale(1.4)" });
  });
});

import { effectivePhotoCrop } from "../src/lib/photo-crop";
it("uses a reversible default for the known bordered legacy photo and prefers saved framing", () => {
 const photo = {id:"53a4e2d4-0faa-4964-9529-839c20de1c56",url:"/pico.webp",alt:"Pico"};
 expect(effectivePhotoCrop(photo)).toEqual({x:50,y:58,zoom:1.15});
 expect(catalogCardPhotoStyle(photo)).toMatchObject({transform:"scale(1.15)"});
 expect(publicPhotoCropStyle(photo)).toMatchObject({transform:"scale(1.15)"});
 expect(effectivePhotoCrop({...photo,crop:{x:20,y:30,zoom:1.3}})).toEqual({x:20,y:30,zoom:1.3});
 expect(effectivePhotoCrop({...photo,id:"other"})).toBeUndefined();
});
