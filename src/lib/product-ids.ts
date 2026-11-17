import type { Category, Product } from "./types";

/** Brutti's category abbreviations. New categories get a deterministic fallback. */
const knownPrefixes: Record<string, string> = {
  "beds & bunkbeds": "B&B",
  "beds & bunk beds": "B&B",
  "built in cabinet": "BIC",
  "built-in cabinet": "BIC",
  "displays & mementos": "D&M",
  "displays & panels": "D&P",
  "kiosks": "KSK",
  "panels": "PNL",
  "racks & shelves": "R&S",
  "reception counters": "RC",
  "rentals": "RNT",
  "tables & kitchen counters": "T&KC",
};

const normalize = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Category prefixes are intentionally human readable and unique.
 * Unknown categories use their initials (or three letters for one word).
 * A deterministic category-ID suffix resolves any abbreviation collision.
 */
export function categoryProductPrefix(categoryId: string, categories: Category[]): string {
  const category = categories.find(item => item.id === categoryId);
  if (!category) return "";
  const prefixFor = (name: string): string => {
    const normalized = normalize(name);
    const known = knownPrefixes[normalized];
    if (known) return known;
    const words = normalized.match(/[a-z0-9]+/g) ?? [];
    const meaningful = words.filter(word => !["and", "the", "of", "in", "for"].includes(word));
    if (meaningful.length === 1) return meaningful[0].slice(0, 3).toUpperCase();
    return meaningful.slice(0, 4).map(word => word[0].toUpperCase()).join("") || "PRD";
  };
  const candidate = prefixFor(category.name);
  const otherCategories = categories.filter(item => item.id !== categoryId);
  if (otherCategories.every(item => prefixFor(item.name) !== candidate)) return candidate;
  // Collision fallback is stable for a given category UUID.
  const stableSuffix = categoryId.replace(/[^a-z0-9]/gi, "").slice(-5).toUpperCase();
  return `${candidate}${stableSuffix}`;
}

/** Next code based on the largest extant numeric suffix, never array length. */
export function nextProductId(
  categoryId: string,
  categories: Category[],
  products: Array<Pick<Product, "sku">>,
): string {
  const prefix = categoryProductPrefix(categoryId, categories);
  if (!prefix) return "";
  const start = `${prefix.toUpperCase()}-`;
  let highest = 0;
  for (const product of products) {
    const sku = product.sku.trim().toUpperCase();
    if (!sku.startsWith(start)) continue;
    const suffix = sku.slice(start.length);
    if (!/^\d+$/.test(suffix)) continue;
    const n = Number(suffix);
    if (Number.isSafeInteger(n)) highest = Math.max(highest, n);
  }
  return `${prefix}-${String(highest + 1).padStart(2, "0")}`;
}
