/**
 * A small plain-text list format stored in the existing products.materials field.
 * Optional inline markers are saved as plain text. No HTML is interpreted.
 */
export type MaterialListStyle = "plain" | "bullet" | "numbered";
export type MaterialBlock = { style: MaterialListStyle | "heading"; items: string[] };
const BULLET = /^(?:•|[-*])\s+(.*)$/;
const NUMBERED = /^\d{1,3}[.)]\s+(.*)$/;

function readLine(raw: string): { style: MaterialBlock["style"]; text: string } {
  const line = raw.trim();
  const heading = line.match(/^##\s+(.+)$/);
  if (heading) return { style: "heading" as const, text: heading[1].trim() };
  const bullet = line.match(BULLET);
  if (bullet) return { style: "bullet", text: bullet[1].trim() };
  const numbered = line.match(NUMBERED);
  if (numbered) return { style: "numbered", text: numbered[1].trim() };
  return { style: "plain", text: line };
}

export function materialListStyle(value: string): MaterialListStyle {
  const first = value.split(/\r?\n/).find(line => line.trim());
  if (!first) return "plain";
  const style = readLine(first).style;
  return style === "heading" ? "plain" : style;
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
    if (!line.text) continue;
    const last = blocks[blocks.length - 1];
    if (last?.style === line.style) last.items.push(line.text);
    else blocks.push({ style: line.style, items: [line.text] });
  }
  return blocks;
}

/** Strip supported inline markers when displaying short product card snippets. */
export function stripMaterialFormatting(value: string): string {
  let text = value;
  for (const pattern of [/\*\*\*([^*]+)\*\*\*/g, /\*\*([^*]+)\*\*/g, /~~([^~]+)~~/g, /\+\+([^+]+)\+\+/g,
    /==([^=]+)==/g, /\*([^*]+)\*/g]) {
    text = text.replace(pattern, "$1");
  }
  return text;
}

export function materialCardSummary(value: string): string {
  const items = parseMaterials(value)
    .filter(block => block.style !== "heading")
    .flatMap(block => block.items)
    .map(stripMaterialFormatting);
  if (!items.length) return "";
  return items.length === 1 ? items[0] : `${items[0]} · +${items.length - 1} more`;
}
