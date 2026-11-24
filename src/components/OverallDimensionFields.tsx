import { useState } from "react";
import { Plus, Minus } from "lucide-react";
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
  // Each field can be expanded independently. Existing compound feet values
  // open automatically; an explicitly collapsed field retains its total size.
  const [expanded, setExpanded] = useState<Partial<Record<DimensionKey, boolean>>>({});
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
        const mixed = unit === "ft" && (expanded[key] ?? inches > 0);
        const toggleMixed = () => {
          if (mixed) {
            setExpanded(current => ({ ...current, [key]: false }));
          } else {
            setExpanded(current => ({ ...current, [key]: true }));
            if (unit !== "ft") onUnitChange(key, "ft");
          }
        };
        const updateMixed = (part: "feet" | "inches", raw: string) => {
          const value = raw === "" ? 0 : Number(raw);
          if (!Number.isFinite(value) || value < 0 || (part === "feet" && !Number.isInteger(value)) || (part === "inches" && value >= 12)) return;
          const cm = feetInchesToCm(part === "feet" ? value : feet, part === "inches" ? value : inches);
          if (cm <= 99999.99) onValueChange(key, cm);
        };
        return (
          <div className="catalog-dimension-single" key={key}>
            <label htmlFor={id} className="catalog-dimension-single-label">{label}</label>
            <div className={"catalog-dimension-single-control" + (mixed ? " is-mixed" : "")}>
              {mixed ? (
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
                onChange={event => {
                  const raw = event.target.value;
                  const cm = raw === "" ? 0 : unitToCm(Number(raw), unit);
                  if (!Number.isFinite(cm) || cm < 0 || cm > 99999.99) return;
                  setExpanded(current => ({ ...current, [key]: false }));
                  onValueChange(key, cm);
                }}
              />}
              <InlineDimensionUnitMenu
                label={label}
                value={unit}
                disabled={disabled}
                onChange={next => {
                  if (next !== unit) setExpanded(current => ({ ...current, [key]: false }));
                  onUnitChange(key, next);
                }}
              />
              <button type="button" className="catalog-dimension-add-part"
                aria-label={mixed ? `${label}: use a single value (keep total size)` : unit === "ft" ? `${label}: add inches` : `${label}: use feet and inches (convert current value)`}
                title={mixed ? "Use single value; keep total size" : unit === "ft" ? "Add inches" : "Use feet + inches; convert current value"}
                aria-expanded={mixed} disabled={disabled} onClick={toggleMixed}>
                {mixed ? <Minus size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
