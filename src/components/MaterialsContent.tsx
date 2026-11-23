import { parseMaterials } from "../lib/material-list";
import MaterialInline from "./MaterialInline";


/** Optional short labels such as "Tier:", "Structure:" and "Facade:"
 * from older Brutti catalogues stand out without storing rich HTML. */
function MaterialItem({ text }: { text: string }) {
  const labelled = text.match(/^([^:\n]{2,28}):\s+(.+)$/);
  if (!labelled) return <MaterialInline text={text} />;
  return <><strong>{labelled[1]}:</strong> <MaterialInline text={labelled[2]} /></>;
}

/** Render plain text, bullet lists or numbered lines without raw HTML. */
export default function MaterialsContent({ value }: { value: string }) {
  const blocks = parseMaterials(value);
  return (
    <div className="catalog-materials-content">
      {blocks.map((block, index) => {
        if (block.style === "bullet") {
          return <ul key={index}>{block.items.map((item, i) => <li key={i}><MaterialItem text={item} /></li>)}</ul>;
        }
        if (block.style === "numbered") {
          return <ol key={index}>{block.items.map((item, i) => <li key={i}><MaterialItem text={item} /></li>)}</ol>;
        }
        if (block.style === "heading") {
          return block.items.map((item, i) => <h4 key={`${index}-${i}`}><MaterialItem text={item} /></h4>);
        }
        return block.items.map((item, i) => <p key={`${index}-${i}`}><MaterialItem text={item} /></p>);
      })}
    </div>
  );
}
