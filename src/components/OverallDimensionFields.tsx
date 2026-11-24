import { Plus, Minus } from "lucide-react";
import type { Product } from "../lib/types";
import InlineDimensionUnitMenu from "./InlineDimensionUnitMenu";
import {
  cmToUnit, unitToCm, unitMax, normalizeDimensionUnits, dimensionParts,
  OVERALL_DIMENSION_KEYS,
  type DimensionKey, type DimensionUnits, type DimensionUnit, type DimensionPart,
} from "../lib/dimensions";

type Props = {
  product: Pick<Product, "width" | "depth" | "height" | "dimensionUnits">;
  onDimensionChange: (key: DimensionKey, totalCm: number, units: DimensionUnits) => void;
  disabled?: boolean;
};

/** Each additional row has its own unit; retain the combined physical size in cm. */
export default function OverallDimensionFields({product,onDimensionChange,disabled=false}:Props) {
  const units = normalizeDimensionUnits(product.dimensionUnits);
  return (
    <div className="catalog-reference-dimension-inputs catalog-unified-dimensions catalog-dimensions-by-field"
      role="group" aria-label="Product dimensions with individual units">
      {OVERALL_DIMENSION_KEYS.map(key => {
        const label = key === "width" ? "Width" : key === "depth" ? "Depth" : "Height";
        const id = `catalog-overall-dimension-${key}`;
        const unit = units[key];
        const {primaryCm,additional} = dimensionParts(product[key], units, key);
        const save = (primary:number, primaryUnit:DimensionUnit, part?:DimensionPart) => {
          const total = Number((primary+(part?.cm ?? 0)).toFixed(4));
          if (!Number.isFinite(total) || primary < 0 || total > 99999.99) return;
          const next:DimensionUnits = {...units,[key]:primaryUnit};
          const extras = {...units.additional};
          if (part) extras[key]=part; else delete extras[key];
          if (Object.keys(extras).length) next.additional=extras; else delete next.additional;
          onDimensionChange(key,total,next);
        };
        const read = (raw:string, selected:DimensionUnit) => raw === "" ? 0 : unitToCm(Number(raw),selected);
        return (
          <div className={"catalog-dimension-single" + (additional ? " has-additional" : "")} key={key}>
            <label htmlFor={id} className="catalog-dimension-single-label">{label}</label>
            <div className="catalog-dimension-single-control">
              <input id={id} aria-label={`${label} in ${unit}`} type="number" inputMode="decimal"
                min={0} max={unitMax(unit)} step="any" placeholder="Optional" disabled={disabled}
                value={primaryCm === 0 ? "" : cmToUnit(primaryCm,unit)}
                onChange={event => save(read(event.target.value,unit),unit,additional)} />
              <InlineDimensionUnitMenu label={label} value={unit} disabled={disabled}
                onChange={next => save(primaryCm,next,additional)} />
              <button type="button" className="catalog-dimension-add-part"
                aria-label={additional ? `${label}: combine values` : `${label}: add another measurement`}
                title={additional ? "Combine into one value; keep total size" : "Add another measurement"}
                aria-expanded={Boolean(additional)} disabled={disabled}
                onClick={() => additional ? save(product[key],unit) : save(primaryCm,unit,{unit:null,cm:0})}>
                {additional ? <Minus size={19} aria-hidden="true"/> : <Plus size={19} aria-hidden="true"/>}
              </button>
            </div>
            {additional && <div className="catalog-dimension-single-control catalog-dimension-additional-control">
              <label htmlFor={`${id}-additional`} className="catalog-dimension-single-label">Additional value</label>
              <input id={`${id}-additional`} aria-label={`${label} additional measurement`} type="number" inputMode="decimal"
                min={0} max={additional.unit ? unitMax(additional.unit) : undefined} step="any"
                placeholder="Optional" disabled={disabled || !additional.unit}
                value={additional.unit && additional.cm !== 0 ? cmToUnit(additional.cm,additional.unit) : ""}
                onChange={event => {
                  if (!additional.unit) return;
                  const cm = read(event.target.value,additional.unit);
                  if (cm >= 0) save(primaryCm,unit,{...additional,cm});
                }} />
              <InlineDimensionUnitMenu label={label+" additional"} value={additional.unit} disabled={disabled}
                onChange={next => save(primaryCm,unit,{...additional,unit:next})} />
            </div>}
          </div>
        );
      })}
    </div>
  );
}
