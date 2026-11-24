import type { Category, Product } from "./types";

export type PdfSelection = "all" | "best" | "category" | "favourites";
const assets = "https://raw.githubusercontent.com/Brutti-team/benua-brutti-website/ad24b1dba287369fee0acbf7e2998d5b3d4cdaee/public/assets/";
export const IMPACT_FRONT = assets + "impact-report/page-01.webp";
export const IMPACT_BACK = assets + "impact-report/page-40.webp";

const references = [
  { name: "Bed & Bunkbed", file: "bed & bunkbed.webp", matches: /\b(bed|beds|bunkbed|bunkbeds)\b/i },
  { name: "Built-in Cabinet", file: "built in cabinet.webp", matches: /built[ -]in cabinet/i },
  { name: "Camper Builds", file: "our camper.webp", matches: /camper/i },
  { name: "Kiosk", file: "kiosk.webp", matches: /kiosk/i },
  { name: "Mementos", file: "memento.webp", matches: /memento|momento/i },
  { name: "Racks & Shelves", file: "racks & shelves.webp", matches: /racks?\b|shelv/i },
  { name: "Signages", file: "Signages.webp", matches: /signage/i },
  { name: "Tables & Counters", file: "table & counters.webp", matches: /tables?\b|counters?\b/i },
  { name: "Other Custom Builds", file: "others.webp", matches: /other custom|^others$/i },
  { name: "Designs", file: "Designs.webp", matches: /^designs?$/i },
  { name: "Builders & Partner Event", file: "builders & partner event.webp", matches: /builders.*partner/i },
];
export type PdfSection = { name: string; cover?: string; products: Product[]; reference: boolean };

export function selectPdfProducts(products: Product[], mode: PdfSelection, categoryId: string, favourites: string[]): Product[] {
  return products.filter(p => p.status === "published" &&
    (mode === "all" || (mode === "best" && p.bestSelling === true) ||
      (mode === "category" && p.categoryId === categoryId) ||
      (mode === "favourites" && favourites.includes(p.id))));
}
export function planPdfSections(products: Product[], categories: Category[], mode: PdfSelection, categoryId: string, favourites: string[]): PdfSection[] {
  const selected = selectPdfProducts(products, mode, categoryId, favourites);
  const sections: PdfSection[] = [];
  const used = new Set<string>();
  const sort = (items: Product[]) => [...items].sort((a,b) =>
    (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name));
  for (const ref of references) {
    const ids = new Set(categories.filter(c => ref.matches.test(c.name)).map(c => c.id));
    const items = sort(selected.filter(p => ids.has(p.categoryId) && !used.has(p.id)));
    if (mode !== "all" && !items.length) continue;
    items.forEach(p => used.add(p.id));
    sections.push({ name: ref.name, cover: assets + "what-we-build/" + encodeURIComponent(ref.file), products: items, reference: true });
  }
  for (const category of categories) {
    const items = sort(selected.filter(p => p.categoryId === category.id && !used.has(p.id)));
    if (!items.length) continue;
    items.forEach(p => used.add(p.id));
    sections.push({ name: category.name, cover: category.cover_image_url || items[0].images[0]?.url, products: items, reference: false });
  }
  const remaining = sort(selected.filter(p => !used.has(p.id)));
  if (remaining.length) sections.push({ name: "Other Products", products: remaining, reference: false });
  return sections;
}
