import { describe, expect, it } from "vitest";
import type { Category } from "../src/lib/types";
import { categoryProductPrefix, nextProductId } from "../src/lib/product-ids";

const categories: Category[] = [
  ["b", "Beds & Bunkbeds"], ["c", "Built in Cabinet"],
  ["d", "Displays & Mementos"], ["k", "Kiosks"],
  ["p", "Panels"], ["r", "Racks & Shelves"],
  ["rc", "Reception Counters"], ["rn", "Rentals"],
  ["t", "Tables & Kitchen Counters"],
].map(([id, name]) => ({ id, name, description: "" }));

describe("automatic category Product IDs", () => {
  it("uses readable and distinct Brutti category prefixes", () => {
    expect(categories.map(c => categoryProductPrefix(c.id, categories)))
      .toEqual(["B&B", "BIC", "D&M", "KSK", "PNL", "R&S", "RC", "RNT", "T&KC"]);
  });
  it("increases within a group, ignoring unrelated and legacy IDs", () => {
    const existing = [{ sku: "BRT25-P086" }, { sku: "B&B-01" }, { sku: "b&b-04" }, { sku: "B&B-04-COPY" }, { sku: "R&S-02" }];
    expect(nextProductId("b", categories, existing)).toBe("B&B-05");
    expect(nextProductId("c", categories, existing)).toBe("BIC-01");
    expect(nextProductId("r", categories, existing)).toBe("R&S-03");
    expect(nextProductId("missing", categories, existing)).toBe("");
  });
  it("works after 99 products", () => {
    expect(nextProductId("b", categories, [{ sku: "B&B-100" }])).toBe("B&B-101");
  });
  it("disambiguates unknown group abbreviations", () => {
    const two: Category[] = [
      { id: "000abc001", name: "Bedroom Benches", description: "" },
      { id: "000abc002", name: "Bathroom Basins", description: "" },
    ];
    expect(categoryProductPrefix(two[0].id, two)).toBe("BBBC001");
    expect(categoryProductPrefix(two[1].id, two)).toBe("BBBC002");
  });
});
