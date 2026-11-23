import type { Product } from "../lib/types";
import InlineDimensionUnitMenu from "./InlineDimensionUnitMenu";
import {
  cmToUnit, unitToCm, unitMax, normalizeDimensionUnits,
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
        return (
          <div className="catalog-dimension-single" key={key}>
            <label htmlFor={id} className="catalog-dimension-single-label">{label}</label>
            <div className="catalog-dimension-single-control">
              <input
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
              />
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
