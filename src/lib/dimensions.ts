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
  return Math.floor((99999.99 / DIMENSION_UNIT_TO_CM[unit]) * 10000) / 10000;
}


export const OVERALL_DIMENSION_KEYS = ["width", "depth", "height"] as const;
export type DimensionKey = typeof OVERALL_DIMENSION_KEYS[number];
export type DimensionPart = { unit: DimensionUnit | null; cm: number };
export type DimensionUnits = Record<DimensionKey, DimensionUnit> & { additional?: Partial<Record<DimensionKey, DimensionPart>> };
export const DEFAULT_DIMENSION_UNITS: Readonly<DimensionUnits> = Object.freeze({
  width: "cm", depth: "cm", height: "cm",
});

export function normalizeDimensionUnits(value: unknown): DimensionUnits {
  if (!value || typeof value !== "object") return { ...DEFAULT_DIMENSION_UNITS };
  const saved = value as Record<string, unknown>;
  const allowed: ReadonlyArray<string> = DIMENSION_UNIT_OPTIONS.map(option => option.value);
  const valid = (raw: unknown): DimensionUnit =>
    typeof raw === "string" && allowed.includes(raw) ? raw as DimensionUnit : "cm";
  const result: DimensionUnits = { width: valid(saved.width), depth: valid(saved.depth), height: valid(saved.height) };
  if (saved.additional && typeof saved.additional === "object") {
    const raw = saved.additional as Record<string, unknown>;
    const additional: NonNullable<DimensionUnits["additional"]> = {};
    for (const key of OVERALL_DIMENSION_KEYS) {
      const part = raw[key];
      if (!part || typeof part !== "object") continue;
      const {unit, cm} = part as Record<string, unknown>;
      if (unit === null && cm === 0) additional[key] = {unit:null,cm:0};
      else if (typeof unit === "string" && allowed.includes(unit) && typeof cm === "number" && Number.isFinite(cm) && cm >= 0 && cm <= 99999.99) additional[key] = {unit:unit as DimensionUnit,cm};
    }
    if (Object.keys(additional).length) result.additional = additional;
  }
  return result;
}

/** Feet/inches are an editor/display representation of the existing ft unit.
 * Keep storage and database unit constraints unchanged. Round to the precision
 * of the existing canonical centimetre values and handle inch carry. */
export function splitFeetInches(centimetres: number): { feet: number; inches: number } {
  const total = Math.round(Math.max(0, centimetres) / 2.54 * 10000);
  const feet = Math.floor(total / 120000);
  return { feet, inches: (total - feet * 120000) / 10000 };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return Number((feet * 30.48 + inches * 2.54).toFixed(4));
}

export function formatDimension(centimetres: number, unit: DimensionUnit): string {
  if (unit !== "ft") return `${cmToUnit(centimetres, unit)} ${unit}`;
  const { feet, inches } = splitFeetInches(centimetres);
  return feet ? `${feet} ft${inches ? ` ${inches} in` : ""}` : `${inches} in`;
}

/** Preserve the total in cm while recovering independently editable components. */
export function dimensionParts(total: number, units: DimensionUnits, key: DimensionKey): {primaryCm:number; additional?:DimensionPart} {
  const part = units.additional?.[key];
  if (!part || part.cm > total + .0001) return {primaryCm:total};
  return {primaryCm:Number(Math.max(0,total-part.cm).toFixed(4)),additional:part};
}

/** Readable mixed-unit dimensions; missing overall sizes stay hidden. */
export function formatProductDimensions(product: Pick<Record<DimensionKey, number>, DimensionKey> & { dimensionUnits?: DimensionUnits }): string {
  const units = normalizeDimensionUnits(product.dimensionUnits);
  const suffix: Record<DimensionKey, string> = { width: "W", depth: "D", height: "H" };
  return OVERALL_DIMENSION_KEYS
    .filter(key => Number.isFinite(product[key]) && product[key] > 0)
    .map(key => {
      const {primaryCm, additional} = dimensionParts(product[key], units, key);
      if (!additional?.unit || !additional.cm) return `${formatDimension(product[key], units[key])} ${suffix[key]}`;
      const parts = [primaryCm > 0 ? `${cmToUnit(primaryCm, units[key])} ${units[key]}` : "", `${cmToUnit(additional.cm, additional.unit)} ${additional.unit}`].filter(Boolean);
      return `${parts.join(" ")} ${suffix[key]}`;
    })
    .join(" × ");
}
