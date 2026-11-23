import { useRef, useState, type KeyboardEvent } from "react";
import { AlignLeft, List, ListOrdered } from "lucide-react";
import {
  formatMaterialsList,
  materialListStyle,
  type MaterialListStyle,
} from "../lib/material-list";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

const MAX_LENGTH = 2000;
const options: { value: MaterialListStyle; label: string; Icon: typeof List }[] = [
  { value: "plain", label: "Plain text", Icon: AlignLeft },
  { value: "bullet", label: "Bullets", Icon: List },
  { value: "numbered", label: "Numbering", Icon: ListOrdered },
];

/** Keeps the existing plain-text materials column; formats lines in place. */
export default function MaterialsEditor({
  value, onChange, disabled = false, placeholder,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [warning, setWarning] = useState("");
  const mode = materialListStyle(value);

  const chooseStyle = (style: MaterialListStyle) => {
    const next = formatMaterialsList(value, style);
    if (next.length > MAX_LENGTH) {
      setWarning("Materials cannot exceed 2,000 characters.");
      textareaRef.current?.focus();
      return;
    }
    setWarning("");
    // Provide a ready-to-type prefix on an empty field.
    const starter = !next && style !== "plain" ? (style === "bullet" ? "• " : "1. ") : next;
    onChange(starter);
    requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
      if (!value.trim()) textareaRef.current?.setSelectionRange(starter.length, starter.length);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey) return;
    const el = event.currentTarget;
    if (el.selectionStart !== el.selectionEnd) return;
    const start = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const previous = value.slice(lineStart, start);
    const match = previous.match(/^(\s*)(•\s+|[-*]\s+|(\d{1,3})[.)]\s+)(.*)$/);
    if (!match) return;
    const prefix = match[2];
    if (!match[4].trim()) {
      // Enter on an empty list item ends the list instead of creating
      // unlimited empty bullets.
      event.preventDefault();
      const next = value.slice(0, lineStart) + value.slice(start);
      onChange(next);
      requestAnimationFrame(() => el.setSelectionRange(lineStart, lineStart));
      return;
    }
    const nextPrefix = /^\d/.test(prefix)
      ? `${Number(match[3]) + 1}. `
      : prefix.trimStart().startsWith("•") ? "• " : prefix.trimStart().startsWith("*") ? "* " : "- ";
    const insertion = "\n" + match[1] + nextPrefix;
    if (value.length + insertion.length > MAX_LENGTH) return;
    event.preventDefault();
    onChange(value.slice(0, start) + insertion + value.slice(start));
    const cursor = start + insertion.length;
    requestAnimationFrame(() => el.setSelectionRange(cursor, cursor));
  };

  return (
    <div className="catalog-materials-editor">
      <div className="catalog-materials-toolbar" role="group" aria-label="Materials formatting">
        {options.map(({ value: style, label, Icon }) => (
          <button
            key={style}
            type="button"
            aria-label={label}
            aria-pressed={mode === style}
            title={label}
            disabled={disabled}
            className={mode === style ? "is-active" : ""}
            onClick={() => chooseStyle(style)}
          >
            <Icon size={15} strokeWidth={1.85} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        aria-label="Materials"
        rows={3}
        maxLength={MAX_LENGTH}
        disabled={disabled}
        value={value}
        onKeyDown={onKeyDown}
        onChange={event => { setWarning(""); onChange(event.target.value); }}
        placeholder={placeholder ?? "Tier: Solid pine wood with clear satin finishing\nStructure: Steel hollow with anti-rust white finishing\nFacade: White finished plywood"}
      />
      <div className="catalog-materials-helper">
        <span>{warning || "Use one line per item. Enter continues the list."}</span>
        <span>{value.length.toLocaleString("en-MY")} / {MAX_LENGTH.toLocaleString("en-MY")}</span>
      </div>
    </div>
  );
}
