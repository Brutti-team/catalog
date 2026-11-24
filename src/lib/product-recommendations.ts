import type { Product } from "./types";

type RecommendationProduct = Pick<Product, "id" | "categoryId" | "name" | "sku" | "description" | "materials" | "status">;

/** Store only bounded, deduplicated IDs, newest first. */
export function recentProductIds(previous: string[], added: string[]): string[] {
  return [...new Set([...added, ...previous])].slice(0, 32);
}

export function searchMatches(product: RecommendationProduct, query: string): boolean {
  const term = query.trim().toLowerCase();
  return term.length > 0 && `${product.name} ${product.sku} ${product.description} ${product.materials}`.toLowerCase().includes(term);
}

/** Deterministic recommendations; never show drafts or the current product. */
export function recommendProducts<T extends RecommendationProduct>(
  products: T[], viewedIds: string[], searchedIds: string[], currentId?: string,
): T[] {
  const published = products.filter(item => item.status === "published");
  const byId = new Map(published.map(item => [item.id, item]));
  const current = currentId ? byId.get(currentId) : undefined;
  const viewed = viewedIds.map(id => byId.get(id)).filter((item): item is T => Boolean(item));
  const searched = searchedIds.map(id => byId.get(id)).filter((item): item is T => Boolean(item));
  return published.filter(item => item.id !== currentId)
    .map(item => {
      let score = current?.categoryId === item.categoryId ? 12 : 0;
      if (searchedIds.includes(item.id)) score += 8;
      if (searched.some(match => match.categoryId === item.categoryId)) score += 4;
      if (viewed.some(match => match.categoryId === item.categoryId)) score += 5;
      if (viewedIds.includes(item.id)) score = Math.max(0, score - 2);
      return { item, score };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, 4)
    .map(entry => entry.item);
}
