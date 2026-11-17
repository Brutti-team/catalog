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
