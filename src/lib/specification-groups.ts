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


/** Ignore untouched placeholder rows when saving. An incomplete row with any
 * user-entered information is deliberately kept so validation can explain it. */
export function compactSpecifications(specifications: ProductSpecification[] = []): ProductSpecification[] {
  const isFilled = (row: ProductSpecification): boolean => {
    if (row.kind === "section") return Boolean(row.name.trim());
    const hasNumber = row.kind === "measurement"
      ? /^[0-9]/.test(row.value.trim())
      : Boolean(row.value.trim());
    return Boolean(row.name.trim() || row.description?.trim() || row.quantity || hasNumber);
  };
  return specifications.filter((row, index) => {
    if (row.kind !== "section") return isFilled(row);
    if (isFilled(row)) return true;
    const after = specifications.slice(index + 1);
    const nextSection = after.findIndex(item => item.kind === "section");
    const children = nextSection < 0 ? after : after.slice(0, nextSection);
    // Keep an untitled section if it contains entered details, so the
    // title requirement still produces a useful validation error.
    return children.some(isFilled);
  });
}
