import type { Product } from "./types";

/**
 * Category cover choices for the admin workspace.
 * Prioritise real Brutti product photography rather than the first item returned
 * by the database (which can be a cutout on black or a small printed plaque).
 * Local references provide relevant interiors while a category has no products.
 */
type CoverChoice = {
  preferred: string[];
  fallback: string;
  position: string;
};
const covers: Record<string, CoverChoice> = {
  "beds & bunkbeds": {
    preferred: ["B&B-06", "B&B-07", "B&B-05"],
    fallback: "/reference/sofa.jpg",
    position: "center 53%",
  },
  "beds & bunk beds": {
    preferred: ["B&B-06", "B&B-07", "B&B-05"],
    fallback: "/reference/sofa.jpg",
    position: "center 53%",
  },
  "built in cabinet": {
    preferred: [],
    fallback: "/reference/cabinetry.jpg",
    position: "center 51%",
  },
  "built-in cabinet": {
    preferred: [],
    fallback: "/reference/cabinetry.jpg",
    position: "center 51%",
  },
  "displays & mementos": {
    preferred: ["D&M-03", "D&M-13", "D&M-11"],
    fallback: "/reference/workstation.jpg",
    position: "center 52%",
  },
  "kiosks": {
    preferred: [],
    fallback: "/reference/kiosk.jpg",
    position: "center 49%",
  },
  "panels": {
    preferred: ["PNL-17", "PNL-06", "PNL-16"],
    fallback: "/reference/counter.jpg",
    position: "center 49%",
  },
  "racks & shelves": {
    preferred: ["R&S-12", "R&S-13", "R&S-15"],
    fallback: "/reference/cabinetry.jpg",
    position: "center 48%",
  },
  "reception counters": {
    preferred: ["RC-04", "RC-02", "RC-10"],
    fallback: "/reference/counter.jpg",
    position: "center 53%",
  },
  "rentals": {
    preferred: [],
    fallback: "/reference/chair.jpg",
    position: "center 55%",
  },
  "tables & kitchen counters": {
    preferred: ["T&KC-15", "T&KC-02", "T&KC-13"],
    fallback: "/reference/table.jpg",
    position: "center 54%",
  },
};

export type CategoryCover = { src: string; position: string };

export function categoryCover(
  categoryName: string,
  items: ReadonlyArray<Pick<Product, "sku" | "images">>,
): CategoryCover {
  const choice = covers[categoryName.trim().toLowerCase()] ?? {
    preferred: [], fallback: "/reference/hero.jpg", position: "center",
  };
  // Always use an actual uploaded product photo when one exists, including
  // categories containing just one product. Use local category imagery only
  // while that category has no usable product photo.
  const preferred = choice.preferred
    .map(sku => items.find(item => item.sku.toUpperCase() === sku.toUpperCase()))
    .find(item => item?.images?.[0]?.url);
  const src = preferred?.images?.[0]?.url
    || items.find(item => item.images?.[0]?.url)?.images?.[0]?.url
    || choice.fallback;
  return { src, position: choice.position };
}
