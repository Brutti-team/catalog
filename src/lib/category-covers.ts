import type { Product } from "./types";

/**
 * Category cover choices for the admin workspace.
 * Prioritise real Brutti product photography rather than the first item returned
 * by the database (which can be a cutout on black or a small printed plaque).
 * If no product photo exists, use the original catalog illustration rather than
 * leaving a large empty area or inserting an unrelated stock photograph.
 */
type CoverChoice = {
  preferred: string[];
  position: string;
};
const covers: Record<string, CoverChoice> = {
  "beds & bunkbeds": {
    preferred: ["B&B-06", "B&B-07", "B&B-05"],

    position: "center 53%",
  },
  "beds & bunk beds": {
    preferred: ["B&B-06", "B&B-07", "B&B-05"],

    position: "center 53%",
  },
  "built in cabinet": {
    preferred: [],

    position: "center 51%",
  },
  "built-in cabinet": {
    preferred: [],

    position: "center 51%",
  },
  "displays & mementos": {
    preferred: ["D&M-03", "D&M-13", "D&M-11"],

    position: "center 52%",
  },
  "kiosks": {
    preferred: [],

    position: "center 49%",
  },
  "panels": {
    preferred: ["PNL-17", "PNL-06", "PNL-16"],

    position: "center 49%",
  },
  "racks & shelves": {
    preferred: ["R&S-12", "R&S-13", "R&S-15"],

    position: "center 48%",
  },
  "reception counters": {
    preferred: ["RC-04", "RC-02", "RC-10"],

    position: "center 53%",
  },
  "rentals": {
    preferred: [],

    position: "center 55%",
  },
  "tables & kitchen counters": {
    preferred: ["T&KC-15", "T&KC-02", "T&KC-13"],

    position: "center 54%",
  },
};

export type CategoryCover = { src: string; position: string };

export function categoryCover(
  categoryName: string,
  items: ReadonlyArray<Pick<Product, "sku" | "images">>,
): CategoryCover {
  const choice = covers[categoryName.trim().toLowerCase()] ?? {
    preferred: [], position: "center",
  };
  // Prefer real product photos, including the only photo in a category.
  // For empty/photo-less categories, restore the original illustrated placeholder.
  const preferred = choice.preferred
    .map(sku => items.find(item => item.sku.toUpperCase() === sku.toUpperCase()))
    .find(item => item?.images?.[0]?.url);
  const src = preferred?.images?.[0]?.url
    || items.find(item => item.images?.[0]?.url)?.images?.[0]?.url
    || "/images/placeholder.svg";
  return { src, position: choice.position };
}
