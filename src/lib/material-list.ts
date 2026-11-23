/**
 * A small plain-text list format stored in the existing products.materials field.
 * No HTML or markdown is persisted, so older materials remain compatible.
 */
export type MaterialListStyle = "plain" | "bullet" | "numbered";
export type MaterialBlock = { style: MaterialListStyle; items: string[] };
const BULLET = /^(?:•|[-*])\s+(.+)$/;
const NUMBERED = /^\d{1,3}[.)]\s+(.+)$/;

function readLine(raw: string): { style: MaterialListStyle; text: string } {
  const line = raw.trim();
  const bullet = line.match(BULLET);
  if (bullet) return { style: "bullet", text: bullet[1].trim() };
  const numbered = line.match(NUMBERED);
  if (numbered) return { style: "numbered", text: numbered[1].trim() };
  return { style: "plain", text: line };
}

export function materialListStyle(value: string): MaterialListStyle {
  const first = value.split(/\r?\n/).find(line => line.trim());
  return first ? readLine(first).style : "plain";
}

export function formatMaterialsList(value: string, style: MaterialListStyle): string {
  let number = 0;
  return value.split(/\r?\n/).map(line => {
    if (!line.trim()) return "";
    const text = readLine(line).text;
    if (style === "plain") return text;
    if (style === "bullet") return `• ${text}`;
    return `${++number}. ${text}`;
  }).join("\n");
}

export function parseMaterials(value: string): MaterialBlock[] {
  const blocks: MaterialBlock[] = [];
  for (const raw of value.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const line = readLine(raw);
    const last = blocks[blocks.length - 1];
    if (last?.style === line.style) last.items.push(line.text);
    else blocks.push({ style: line.style, items: [line.text] });
  }
  return blocks;
}

export function materialCardSummary(value: string): string {
  const items = parseMaterials(value).flatMap(block => block.items);
  if (!items.length) return "";
  return items.length === 1 ? items[0] : `${items[0]} · +${items.length - 1} more`;
}
