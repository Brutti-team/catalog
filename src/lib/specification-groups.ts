import type { ProductSpecification } from "./types";

export type SpecificationSection = {
  id: string;
  title: string;
  rows: ProductSpecification[];
};

/**
 * Existing flat specification rows stay in the default section.
 * A "section" marker starts a distinct group; the following rows belong to it
 * until the next marker. All content remains in the existing specifications JSONB.
 */
export function splitSpecifications(specifications: ProductSpecification[] = []): {
  primary: ProductSpecification[];
  sections: SpecificationSection[];
} {
  const primary: ProductSpecification[] = [];
  const sections: SpecificationSection[] = [];
  let current: SpecificationSection | null = null;
  for (const item of specifications) {
    if (item.kind === "section") {
      current = { id: item.id, title: item.name, rows: [] };
      sections.push(current);
    } else if (current) {
      current.rows.push(item);
    } else {
      primary.push(item);
    }
  }
  return { primary, sections };
}
