import { describe, expect, it } from "vitest";
import { discountPercent, hasProductDiscount } from "../src/lib/discount-price";
import { validateProduct } from "../src/lib/catalog";
import type { Product } from "../src/lib/types";

const fixture: Product = {
  id: "a0a0a0a0-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  name: "White Base Cabinet With Timber Display Shelves",
  sku: "PNL-16",
  categoryId: "b0b0b0b0-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
  description: "",
  materials: "",
  width: 0,
  depth: 0,
  height: 0,
  price: 305,
  originalPrice: 609,
  status: "draft",
  availability: "available",
  featured: false,
  images: [],
  createdAt: "2026-11-17T00:00:00Z",
  updatedAt: "2026-11-17T00:00:00Z",
};

describe("Brutti Catalog original price discounts", () => {
  it("shows rounded percent off for the requested reference", () => {
    expect(hasProductDiscount({ price: 305, originalPrice: 609 })).toBe(true);
    expect(discountPercent({ price: 305, originalPrice: 609 })).toBe(50);
  });

  it("has no sale for products without original prices", () => {
    expect(hasProductDiscount({ price: 4500, originalPrice: null })).toBe(false);
    expect(discountPercent({ price: 4500, originalPrice: null })).toBe(0);
    expect(hasProductDiscount({ price: null, originalPrice: null })).toBe(false);
  });

  it("validates a legitimate discount but prevents inverted prices", () => {
    expect(() => validateProduct(fixture)).not.toThrow();
    expect(() => validateProduct({ ...fixture, originalPrice: 300 })).toThrow(/Original price/);
    expect(() => validateProduct({ ...fixture, originalPrice: 305 })).toThrow(/Original price/);
    expect(() => validateProduct({ ...fixture, price: null })).toThrow(/Original price/);
  });

  it("keeps existing draft products without discounts valid", () => {
    expect(() => validateProduct({ ...fixture, price: 4500, originalPrice: null })).not.toThrow();
    expect(() => validateProduct({ ...fixture, price: null, originalPrice: undefined })).not.toThrow();
  });
});
