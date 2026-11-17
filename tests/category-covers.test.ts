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
  it("does not show stock photos or placeholder images for empty groups", () => {
    expect(categoryCover("Built in Cabinet", []).src).toBeUndefined();
    expect(categoryCover("Kiosks", []).src).toBeUndefined();
    expect(categoryCover("Panels", []).src).toBeUndefined();
  });
  it("uses an existing product photo if none of the preferred ones exist", () => {
    expect(categoryCover("Reception Counters", [photo("RC-08", "counter-in-store.webp")]).src)
      .toBe("counter-in-store.webp");
    expect(categoryCover("Panels", [photo("PNL-02", "panel-in-room.webp")]).src)
      .toBe("panel-in-room.webp");
  });
  it("uses the only product photograph when a category has one item", () => {
    expect(categoryCover("Rentals", [photo("RNT-01", "event-chair.webp")]).src)
      .toBe("event-chair.webp");
    expect(categoryCover("Kiosks", [photo("KSK-01", "real-kiosk.webp")]).src)
      .toBe("real-kiosk.webp");
  });
  it("shows no photo when the category has products without photographs", () => {
    expect(categoryCover("Beds & Bunkbeds", [{ sku: "B&B-01", images: [] }]).src)
      .toBeUndefined();
  });
});
