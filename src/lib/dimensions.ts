/** Dimension values are stored in centimetres; unit changes only affect the editor display. */
export const DIMENSION_UNIT_TO_CM = {
  mm: 0.1,
  cm: 1,
  m: 100,
  in: 2.54,
  ft: 30.48,
} as const;

export type DimensionUnit = keyof typeof DIMENSION_UNIT_TO_CM;

export const DIMENSION_UNIT_OPTIONS: ReadonlyArray<{ value: DimensionUnit; label: string }> = [
  { value: "mm", label: "mm" },
  { value: "cm", label: "cm" },
  { value: "m", label: "m" },
  { value: "in", label: "in" },
  { value: "ft", label: "ft" },
];

/** Display precision is sufficient for furniture measurements in every supported unit. */
export function cmToUnit(centimetres: number, unit: DimensionUnit): number {
  return Number((centimetres / DIMENSION_UNIT_TO_CM[unit]).toFixed(4));
}

/** Convert inputs back to canonical cm, without changing any existing database columns. */
export function unitToCm(value: number, unit: DimensionUnit): number {
  return Number((value * DIMENSION_UNIT_TO_CM[unit]).toFixed(4));
}

export function unitMax(unit: DimensionUnit): number {
  return Math.floor((100000 / DIMENSION_UNIT_TO_CM[unit]) * 10000) / 10000;
}
