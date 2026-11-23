import { stripMaterialFormatting, formatMaterialsList, type MaterialListStyle } from "./material-list";

export type InlineMaterialFormat = "bold" | "italic" | "underline" | "strike" | "highlight";
export type MaterialEdit = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

const MARKERS: Record<InlineMaterialFormat, string> = {
  bold: "**", italic: "*", underline: "++", strike: "~~", highlight: "==",
};

/** Apply or remove inline markers, preserving selection and avoiding raw HTML. */
export function toggleMaterialInline(
  value: string, start: number, end: number, style: InlineMaterialFormat,
): MaterialEdit {
  const mark = MARKERS[style];
  const len = mark.length;
  let from = Math.max(0, Math.min(start, value.length));
  let to = Math.max(from, Math.min(end, value.length));
  if (from === to) {
    // A formatting click with a caret (no selection) uses the current word.
    // At an empty line, insert replaceable sample text instead of a dead action.
    const isWord = (char: string) => Boolean(char && /[^\s,.;:!?()\[\]{}]/.test(char));
    while (from > 0 && isWord(value[from - 1])) from--;
    while (to < value.length && isWord(value[to])) to++;
    if (from === to) {
      const sample = "text";
      const next = value.slice(0, start) + mark + sample + mark + value.slice(start);
      return { value: next, selectionStart: start + len, selectionEnd: start + len + sample.length };
    }
  }
  const selected = value.slice(from, to);
  // If selection includes existing matching markers, toggle them off.
  if (selected.startsWith(mark) && selected.endsWith(mark) && selected.length > len * 2) {
    const inner = selected.slice(len, -len);
    return {
      value: value.slice(0, from) + inner + value.slice(to),
      selectionStart: from, selectionEnd: from + inner.length,
    };
  }
  // If selection is inside existing matching markers, toggle them off.
  if (value.slice(from - len, from) === mark && value.slice(to, to + len) === mark) {
    return {
      value: value.slice(0, from - len) + selected + value.slice(to + len),
      selectionStart: from - len, selectionEnd: to - len,
    };
  }
  return {
    value: value.slice(0, from) + mark + selected + mark + value.slice(to),
    selectionStart: from + len, selectionEnd: to + len,
  };
}

/** Turn the active line into a material section heading or back into text. */
export function toggleMaterialHeading(value: string, caret: number): MaterialEdit {
  const at = Math.max(0, Math.min(value.length, caret));
  const lineStart = value.lastIndexOf("\n", Math.max(0, at - 1)) + 1;
  const nextLine = value.indexOf("\n", at);
  const lineEnd = nextLine < 0 ? value.length : nextLine;
  const line = value.slice(lineStart, lineEnd);
  const isHeading = /^##\s+/.test(line);
  const normalized = line.replace(/^##\s+/, "")
    .replace(/^(?:•|[-*]|\d{1,3}[.)])\s+/, "");
  const replacement = isHeading ? normalized : `## ${normalized || "Heading"}`;
  const caretOffset = isHeading ? 0 : 3;
  return {
    value: value.slice(0, lineStart) + replacement + value.slice(lineEnd),
    selectionStart: lineStart + caretOffset,
    selectionEnd: lineStart + replacement.length,
  };
}

export function clearMaterialFormatting(value: string, start: number, end: number): MaterialEdit {
  const noSelection = start === end;
  // Clear the entire materials field when nothing is selected.
  const from = noSelection ? 0 : start;
  const to = noSelection ? value.length : end;
  const segment = value.slice(from, to).split("\n").map(line =>
    stripMaterialFormatting(line).replace(/^##\s+/, ""),
  ).join("\n");
  return {
    value: value.slice(0, from) + segment + value.slice(to),
    selectionStart: from,
    selectionEnd: from + segment.length,
  };
}

/** List tools operate on the selected lines, or all lines if none selected. */
export function setMaterialList(
  value: string, start: number, end: number, style: MaterialListStyle,
): MaterialEdit {
  const hasSelection = start !== end;
  const from = hasSelection ? value.lastIndexOf("\n", Math.max(0, start - 1)) + 1 : 0;
  const endLine = value.indexOf("\n", end);
  const to = hasSelection ? (endLine < 0 ? value.length : endLine) : value.length;
  const source = value.slice(from, to);
  const result = formatMaterialsList(source, style);
  const next = result || (style === "bullet" ? "• " : style === "numbered" ? "1. " : "");
  return {
    value: value.slice(0, from) + next + value.slice(to),
    selectionStart: from + next.length,
    selectionEnd: from + next.length,
  };
}
