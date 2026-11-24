import type { Product } from "../lib/types";
import InlineDimensionUnitMenu from "./InlineDimensionUnitMenu";
import {
  cmToUnit, unitToCm, unitMax, normalizeDimensionUnits, splitFeetInches, feetInchesToCm,
  OVERALL_DIMENSION_KEYS,
  type DimensionKey, type DimensionUnit,
} from "../lib/dimensions";

type Props = {
  product: Pick<Product, "width" | "depth" | "height" | "dimensionUnits">;
  onValueChange: (key: DimensionKey, valueInCm: number) => void;
  onUnitChange: (key: DimensionKey, unit: DimensionUnit) => void;
  disabled?: boolean;
};

/** Each measurement has an independently saved unit and a compact top-layer
 * menu. The numeric values still persist as canonical centimetres. */
export default function OverallDimensionFields({
  product, onValueChange, onUnitChange, disabled = false,
}: Props) {
  const units = normalizeDimensionUnits(product.dimensionUnits);
  return (
    <div
      className="catalog-reference-dimension-inputs catalog-unified-dimensions catalog-dimensions-by-field"
      role="group"
      aria-label="Product dimensions with individual units"
    >
      {OVERALL_DIMENSION_KEYS.map(key => {
        const unit = units[key];
        const label = key === "width" ? "Width" : key === "depth" ? "Depth" : "Height";
        const id = `catalog-overall-dimension-${key}`;
        const { feet, inches } = splitFeetInches(product[key]);
        const updateMixed = (part: "feet" | "inches", raw: string) => {
          const value = raw === "" ? 0 : Number(raw);
          if (!Number.isFinite(value) || value < 0 || (part === "feet" && !Number.isInteger(value)) || (part === "inches" && value >= 12)) return;
          const cm = feetInchesToCm(part === "feet" ? value : feet, part === "inches" ? value : inches);
          if (cm <= 99999.99) onValueChange(key, cm);
        };
        return (
          <div className="catalog-dimension-single" key={key}>
            <label htmlFor={id} className="catalog-dimension-single-label">{label}</label>
            <div className={"catalog-dimension-single-control" + (unit === "ft" ? " is-mixed" : "")}>
              {unit === "ft" ? (
                <div className="catalog-dimension-mixed-fields" role="group" aria-label={`${label} in feet and inches`}>
                  <div className="catalog-dimension-mixed-part">
                    <input id={id} aria-label={`${label} feet`} type="number" inputMode="numeric" min={0} max={Math.floor(unitMax("ft"))} step={1} placeholder="0" disabled={disabled}
                      value={feet || ""} onChange={event => updateMixed("feet", event.target.value)} />
                    <span aria-hidden="true">ft</span>
                  </div>
                  <div className="catalog-dimension-mixed-part">
                    <input id={`${id}-inches`} aria-label={`${label} inches`} type="number" inputMode="decimal" min={0} max={11.9999} step="any" placeholder="0" disabled={disabled}
                      value={inches || ""} onChange={event => updateMixed("inches", event.target.value)} />
                    <span aria-hidden="true">in</span>
                  </div>
                </div>
              ) : <input
                id={id}
                aria-label={`${label} in ${unit}`}
                type="number"
                min={0}
                max={unitMax(unit)}
                step="any"
                placeholder="Optional"
                disabled={disabled}
                value={product[key] === 0 ? "" : cmToUnit(product[key], unit)}
                onChange={event => onValueChange(
                  key, event.target.value === "" ? 0 : unitToCm(Number(event.target.value), unit),
                )}
              />}
              <InlineDimensionUnitMenu
                label={label}
                value={unit}
                disabled={disabled}
                onChange={next => onUnitChange(key, next)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
