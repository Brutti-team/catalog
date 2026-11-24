import { describe, expect, it } from "vitest";
import { cmToUnit, unitMax, unitToCm, normalizeDimensionUnits, formatProductDimensions, splitFeetInches, feetInchesToCm, type DimensionUnit } from "../src/lib/dimensions";

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

  it("normalizes old products to centimetres independently", () => {
    expect(normalizeDimensionUnits(undefined)).toEqual({ width: "cm", depth: "cm", height: "cm" });
    expect(normalizeDimensionUnits({ width: "ft", depth: "cm", height: "banana" }))
      .toEqual({ width: "ft", depth: "cm", height: "cm" });
  });

  it("formats different display units for width depth and height", () => {
    expect(formatProductDimensions({
      width: 167.64,
      depth: 1.5,
      height: 182.88,
      dimensionUnits: { width: "ft", depth: "cm", height: "ft" },
    })).toBe("5 ft 6 in W × 1.5 cm D × 6 ft H");
  });

  it("does not display unspecified sizes as zero measurements", () => {
    expect(formatProductDimensions({
      width: 0, depth: 45.72, height: 0,
      dimensionUnits: { width: "cm", depth: "ft", height: "in" },
    })).toBe("1 ft 6 in D");
  });

  it("round-trips separate feet and inches without changing storage units", () => {
    expect(feetInchesToCm(1,6)).toBe(45.72);
    expect(splitFeetInches(45.72)).toEqual({ feet:1, inches:6 });
    expect(splitFeetInches(30.48)).toEqual({ feet:1, inches:0 });
    expect(splitFeetInches(15.24)).toEqual({ feet:0, inches:6 });
    expect(splitFeetInches(feetInchesToCm(2,3.5))).toEqual({ feet:2, inches:3.5 });
    expect(formatProductDimensions({width:91.44,depth:45.72,height:213.36,dimensionUnits:{width:"ft",depth:"ft",height:"ft"}})).toBe("3 ft W × 1 ft 6 in D × 7 ft H");
  });

  it("keeps the existing maximum limit in centimetres", () => {
    expect(unitMax("cm")).toBeLessThan(100000);
  });
});
