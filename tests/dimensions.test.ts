import { describe, expect, it } from "vitest";
import { cmToUnit, unitMax, unitToCm, type DimensionUnit } from "../src/lib/dimensions";

describe("Brutti catalog dimension display units", () => {
  it("converts each selectable unit to canonical centimetres", () => {
    expect(unitToCm(10, "mm")).toBe(1);
    expect(unitToCm(1, "cm")).toBe(1);
    expect(unitToCm(1, "m")).toBe(100);
    expect(unitToCm(1, "in")).toBe(2.54);
    expect(unitToCm(1, "ft")).toBe(30.48);
  });

  it("shows the same physical size in different units", () => {
    expect(cmToUnit(254, "in")).toBe(100);
    expect(cmToUnit(100, "m")).toBe(1);
    expect(cmToUnit(30.48, "ft")).toBe(1);
    expect(cmToUnit(10, "mm")).toBe(100);
  });

  it("round-trips without material changes to stored dimensions", () => {
    const units: DimensionUnit[] = ["mm", "cm", "m", "in", "ft"];
    for (const unit of units) {
      expect(unitToCm(cmToUnit(245.75, unit), unit)).toBeCloseTo(245.75, 2);
    }
  });

  it("keeps the existing maximum limit in centimetres", () => {
    expect(unitMax("cm")).toBeLessThan(100000);
  });
});
