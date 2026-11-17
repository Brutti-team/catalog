import { describe, expect, it } from "vitest";
import { categoryCover } from "../src/lib/category-covers";
import type { Product } from "../src/lib/types";

type ImageProduct = Pick<Product, "sku" | "images">;
const photo = (sku: string, url: string): ImageProduct => ({
  sku,
  images: [{ id: sku, url, alt: sku }],
});

describe("curated admin category covers", () => {
  it("picks the preferred original product photo even if not first", () => {
    expect(categoryCover("Beds & Bunkbeds", [
      photo("B&B-01", "black-background.webp"),
      photo("B&B-06", "room-bed.webp"),
    ]).src).toBe("room-bed.webp");
  });
  it("uses the local category-themed interior for empty groups", () => {
    expect(categoryCover("Built in Cabinet", []).src).toBe("/reference/cabinetry.jpg");
    expect(categoryCover("Kiosks", []).src).toBe("/reference/kiosk.jpg");
  });
  it("uses context-specific fallback photos when preferred product is missing", () => {
    expect(categoryCover("Reception Counters", [photo("RC-08", "counter-in-store.webp")]).src)
      .toBe("counter-in-store.webp");
    expect(categoryCover("Panels", []).src).toBe("/reference/counter.jpg");
  });
  it("uses curated rentals reference rather than misleading small thumbnails", () => {
    expect(categoryCover("Rentals", [photo("RNT-01", "small-event-chair.webp")]).src)
      .toBe("/reference/chair.jpg");
  });
});
