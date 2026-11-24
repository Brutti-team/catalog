import { Plus, Minus } from "lucide-react";
import { useState } from "react";
import type { Product } from "../lib/types";
import InlineDimensionUnitMenu from "./InlineDimensionUnitMenu";
import {
  parseDimensionInput, dimensionInputText, normalizeDimensionUnits, dimensionParts,
  OVERALL_DIMENSION_KEYS,
  type DimensionKey, type DimensionUnits, type DimensionUnit, type DimensionPart,
} from "../lib/dimensions";

type Props = {
  product: Pick<Product, "width" | "depth" | "height" | "dimensionUnits">;
  onDimensionChange: (key: DimensionKey, totalCm: number, units: DimensionUnits) => void;
  disabled?: boolean;
};

/** Retain the draft while typing so intermediate input such as 6' is not
 * normalized away before the inch digit can be entered. */
function DimensionValueInput({id,label,cm,unit,disabled,onValue}:{
  id:string; label:string; cm:number; unit:DimensionUnit|null; disabled:boolean;
  onValue:(cm:number)=>void;
}) {
  const [draft,setDraft]=useState<string|null>(null);
  const value=draft ?? (unit ? dimensionInputText(cm,unit) : "");
  const valid=unit ? parseDimensionInput(value,unit)!==null : true;
  return <input id={id} aria-label={label} type="text"
    inputMode={unit==="ft"?"text":"decimal"} autoComplete="off" spellCheck={false}
    placeholder="Optional" disabled={disabled||!unit}
    title={unit==="ft"?"Enter feet or feet and inches, e.g. 6'5":"Enter a non-negative measurement"}
    aria-invalid={!valid} value={value}
    onFocus={()=>setDraft(value)}
    onChange={event=>{
      if(!unit)return;
      const raw=event.target.value;
      setDraft(raw);
      const parsed=parseDimensionInput(raw,unit);
      event.currentTarget.setCustomValidity(parsed===null?"Enter a valid measurement. For feet and inches, use 6'5 with inches from 0 to 11.":"");
      if(parsed!==null)onValue(parsed);
    }}
    onBlur={event=>{
      if(!valid)event.currentTarget.reportValidity();
      event.currentTarget.setCustomValidity("");
      setDraft(null);
    }} />;
}

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
        return (
          <div className={"catalog-dimension-single" + (additional ? " has-additional" : "")} key={key}>
            <label htmlFor={id} className="catalog-dimension-single-label">{label}</label>
            <div className="catalog-dimension-single-control">
              <DimensionValueInput key={id+unit} id={id} label={`${label} in ${unit}`} cm={primaryCm} unit={unit} disabled={disabled}
                onValue={cm => save(cm,unit,additional)} />
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
              <DimensionValueInput key={id+"-additional-"+additional.unit} id={`${id}-additional`} label={`${label} additional measurement`} cm={additional.cm} unit={additional.unit} disabled={disabled}
                onValue={cm => save(primaryCm,unit,{...additional,cm})} />
              <InlineDimensionUnitMenu label={label+" additional"} value={additional.unit} disabled={disabled}
                onChange={next => save(primaryCm,unit,{...additional,unit:next})} />
            </div>}
          </div>
        );
      })}
    </div>
  );
}
