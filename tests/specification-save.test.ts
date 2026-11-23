import { describe, expect, it } from "vitest";
import type { ProductSpecification } from "../src/lib/types";
import { compactSpecifications } from "../src/lib/specification-groups";

const detail = (id: string, name = "", value = ""): ProductSpecification => ({ id, name, value });

describe("product editor specification save preparation", () => {
  it("discards untouched detail, quantity, measurement and section placeholders", () => {
    const rows: ProductSpecification[] = [
      detail("empty-detail"),
      { id: "empty-measure", name: "", value: " cm", kind: "measurement" },
      { id: "empty-quantity", name: "", value: "", kind: "quantity" },
      { id: "empty-section", name: "", value: "", kind: "section" },
      detail("empty-section-detail"),
    ];
    expect(compactSpecifications(rows)).toEqual([]);
  });

  it("keeps completed rows and their named section", () => {
    const section: ProductSpecification = { id: "section", name: "Drawer", value: "", kind: "section" };
    const measurement: ProductSpecification = { id: "width", name: "Width", value: "25 cm", kind: "measurement" };
    expect(compactSpecifications([section, detail("empty"), measurement]))
      .toEqual([section, measurement]);
  });

  it("retains partially completed values so validation can surface an error", () => {
    const partial: ProductSpecification = { id: "width", name: "Width", value: " cm", kind: "measurement" };
    const custom: ProductSpecification = { id: "custom", name: "", value: "", description: "custom pipe", kind: "measurement" };
    const untitledSection: ProductSpecification = { id: "section", name: "", value: "", kind: "section" };
    expect(compactSpecifications([partial, untitledSection, custom]))
      .toEqual([partial, untitledSection, custom]);
  });

  it("does not mutate the user's unsaved editor draft", () => {
    const rows = [detail("unused"), detail("saved", "Finish", "Satin")];
    expect(compactSpecifications(rows)).toEqual([rows[1]]);
    expect(rows).toHaveLength(2);
  });
});
