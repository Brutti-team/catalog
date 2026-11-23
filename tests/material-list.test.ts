import { describe, expect, it } from "vitest";
import {
  formatMaterialsList, materialListStyle, parseMaterials, materialCardSummary,
} from "../src/lib/material-list";

describe("catalog product materials formatting", () => {
  it("preserves existing unformatted materials", () => {
    const original = "Solid pine wood, steel frame and white finished plywood";
    expect(formatMaterialsList(original, "plain")).toBe(original);
    expect(parseMaterials(original)).toEqual([{ style: "plain", items: [original] }]);
    expect(materialCardSummary(original)).toBe(original);
  });

  it("creates consistent bullet and number lists without losing descriptions", () => {
    const original = "Tier: Solid pine wood with clear satin finishing\nStructure: Steel hollow with anti-rust white finishing\nFacade: White finished plywood";
    const bullets = formatMaterialsList(original, "bullet");
    expect(bullets).toContain("• Tier: Solid pine wood with clear satin finishing");
    expect(parseMaterials(bullets)).toEqual([{
      style: "bullet",
      items: [
        "Tier: Solid pine wood with clear satin finishing",
        "Structure: Steel hollow with anti-rust white finishing",
        "Facade: White finished plywood",
      ],
    }]);
    expect(formatMaterialsList(bullets, "numbered")).toContain("3. Facade: White finished plywood");
    expect(formatMaterialsList(formatMaterialsList(bullets, "numbered"), "plain")).toBe(original);
  });

  it("renders mixed freeform, bullet and numbered paragraphs without HTML", () => {
    const value = "Finish details\n• Wooden shelves\n• Steel frame\n1. White facade\n2. Clear lacquer";
    expect(parseMaterials(value)).toEqual([
      { style: "plain", items: ["Finish details"] },
      { style: "bullet", items: ["Wooden shelves", "Steel frame"] },
      { style: "numbered", items: ["White facade", "Clear lacquer"] },
    ]);
    expect(materialCardSummary(value)).toBe("Finish details · +4 more");
  });

  it("ignores empty lines and keeps old product search summaries short", () => {
    const value = "• Tier: Pine wood\n\n• Frame: Steel\n";
    expect(materialListStyle(value)).toBe("bullet");
    expect(parseMaterials(value)[0].items).toEqual(["Tier: Pine wood", "Frame: Steel"]);
    expect(materialCardSummary(value)).toBe("Tier: Pine wood · +1 more");
  });
});
