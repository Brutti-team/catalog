import { parseMaterials } from "../lib/material-list";

/** Render plain text, bullet lists or numbered lines without raw HTML. */
export default function MaterialsContent({ value }: { value: string }) {
  const blocks = parseMaterials(value);
  return (
    <div className="catalog-materials-content">
      {blocks.map((block, index) => {
        if (block.style === "bullet") {
          return <ul key={index}>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
        }
        if (block.style === "numbered") {
          return <ol key={index}>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ol>;
        }
        return block.items.map((item, i) => <p key={`${index}-${i}`}>{item}</p>);
      })}
    </div>
  );
}
