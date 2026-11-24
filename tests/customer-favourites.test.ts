import {describe,expect,it} from "vitest";
import {parseFavouriteIds,nextFavouriteIds} from "../src/lib/customer-favourites";
describe("customer favourites without login",()=>{
  it("preserves legacy saved IDs and deduplicates",()=>expect(parseFavouriteIds('["a","a","b",null,4,""]')).toEqual(["a","b"]));
  it("handles invalid or missing storage",()=>{expect(parseFavouriteIds("broken")).toEqual([]);expect(parseFavouriteIds(null)).toEqual([]);});
  it("toggles a product without modifying existing selections",()=>{const ids=["a"];expect(nextFavouriteIds(ids,"b")).toEqual(["a","b"]);expect(nextFavouriteIds(ids,"a")).toEqual([]);expect(ids).toEqual(["a"]);});
});
