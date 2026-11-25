import type { ReactNode } from "react";

/** Only text-based markers are supported. Never interpret stored HTML. */
const FORMAT = [
  { mark: "***", kind: "boldItalic" },
  { mark: "**", kind: "bold" },
  { mark: "~~", kind: "strike" },
  { mark: "++", kind: "underline" },
  { mark: "==", kind: "highlight" },
  { mark: "*", kind: "italic" },
] as const;

export default function MaterialInline({ text }: { text: string }) {
  return <>{renderMaterialInline(text)}</>;
}

export function renderMaterialInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let buffer = "";
  let i = 0;

  const pushBuffer = () => {
    if (!buffer) return;
    nodes.push(buffer);
    buffer = "";
  };

  while (i < text.length) {
    const found = FORMAT.find(({ mark }) => {
      if (!text.startsWith(mark, i)) return false;
      const innerStart = i + mark.length;
      if (innerStart >= text.length || /\s/.test(text[innerStart])) return false;
      const close = text.indexOf(mark, innerStart);
      return close > innerStart && !/\s/.test(text[close - 1]);
    });
    if (!found) {
      buffer += text[i++];
      continue;
    }
    const from = i + found.mark.length;
    const end = text.indexOf(found.mark, from);
    const children = renderMaterialInline(text.slice(from, end));
    pushBuffer();
    const key = `${found.kind}-${i}`;
    switch (found.kind) {
      case "boldItalic": nodes.push(<strong key={key}><em>{children}</em></strong>); break;
      case "bold": nodes.push(<strong key={key}>{children}</strong>); break;
      case "italic": nodes.push(<em key={key}>{children}</em>); break;
      case "underline": nodes.push(<u key={key}>{children}</u>); break;
      case "strike": nodes.push(<s key={key}>{children}</s>); break;
      case "highlight": nodes.push(...children); break; // Display saved highlights as plain text everywhere.
    }
    i = end + found.mark.length;
  }
  pushBuffer();
  return nodes;
}
