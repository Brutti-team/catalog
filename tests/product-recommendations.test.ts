import { describe, expect, it } from "vitest";
import { recentProductIds, recommendProducts, searchMatches } from "../src/lib/product-recommendations";
import type { Product } from "../src/lib/types";

const make = (id: string, categoryId: string, status: Product["status"] = "published") => ({
  id, categoryId, status, name: id, sku: id, description: "", materials: "oak",
});
const products = [make("Chair A", "chairs"), make("Chair B", "chairs"), make("Table A", "tables"), make("Draft Chair", "chairs", "draft")];
describe("catalog recommendations", () => {
  it("excludes current and unpublished products", () => {
    expect(recommendProducts(products, ["Chair A"], [], "Chair A").map(p => p.id)).toEqual(["Chair B"]);
  });
  it("uses search matches without showing unrelated products", () => {
    expect(recommendProducts(products, [], ["Table A"]).map(p => p.id)).toEqual(["Table A"]);
  });
  it("shows no personalized results without signals", () => {
    expect(recommendProducts(products, [], [])).toEqual([]);
  });
  it("matches searches and deduplicates recent IDs", () => {
    expect(searchMatches(products[0], " OAK ")).toBe(true);
    expect(recentProductIds(["a", "b"], ["b", "c"])).toEqual(["b", "c", "a"]);
  });
});
