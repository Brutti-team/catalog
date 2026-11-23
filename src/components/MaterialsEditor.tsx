import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  AlignLeft, List, ListOrdered, Bold, Italic, Underline, Strikethrough,
  Highlighter, Heading2, Eye, Pencil, RemoveFormatting, type LucideIcon,
} from "lucide-react";
import MaterialsContent from "./MaterialsContent";
import { materialListStyle, type MaterialListStyle } from "../lib/material-list";
import {
  toggleMaterialInline, toggleMaterialHeading, clearMaterialFormatting,
  setMaterialList, type InlineMaterialFormat, type MaterialEdit,
} from "../lib/material-editor-format";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

const MAX_LENGTH = 2000;
const options: { value: MaterialListStyle; label: string; Icon: LucideIcon }[] = [
  { value: "plain", label: "Plain", Icon: AlignLeft },
  { value: "bullet", label: "Bullets", Icon: List },
  { value: "numbered", label: "Numbering", Icon: ListOrdered },
];
const inlineOptions: { value: InlineMaterialFormat; label: string; shortcut: string; Icon: LucideIcon }[] = [
  { value: "bold", label: "Bold", shortcut: "Ctrl+B", Icon: Bold },
  { value: "italic", label: "Italic", shortcut: "Ctrl+I", Icon: Italic },
  { value: "underline", label: "Underline", shortcut: "Ctrl+U", Icon: Underline },
  { value: "strike", label: "Strikethrough", shortcut: "Ctrl+Shift+X", Icon: Strikethrough },
  { value: "highlight", label: "Highlight", shortcut: "", Icon: Highlighter },
];

/** Rich text-style controls with a safe plain-text storage format.
 * Selection formatting uses compact markers and the Preview uses exactly
 * the same React renderer used by the public Brutti Catalog.
 */
export default function MaterialsEditor({
  value, onChange, disabled = false, placeholder,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [warning, setWarning] = useState("");
  const [preview, setPreview] = useState(false);
  const mode = materialListStyle(value);
  const help = "Select text, then choose a format. Enter continues your list.";

  const currentSelection = (): [number, number] => {
    const el = textareaRef.current;
    return [el?.selectionStart ?? value.length, el?.selectionEnd ?? value.length];
  };

  const apply = (edit: MaterialEdit) => {
    if (disabled) return;
    if (edit.value.length > MAX_LENGTH) {
      setWarning("Materials cannot exceed 2,000 characters.");
      textareaRef.current?.focus({ preventScroll: true });
      return;
    }
    setWarning("");
    onChange(edit.value);
    setPreview(false);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  };

  const chooseStyle = (style: MaterialListStyle) => {
    const [from, to] = currentSelection();
    apply(setMaterialList(value, from, to, style));
  };

  const formatInline = (style: InlineMaterialFormat) => {
    const [from, to] = currentSelection();
    apply(toggleMaterialInline(value, from, to, style));
  };

  const formatHeading = () => {
    const [from] = currentSelection();
    apply(toggleMaterialHeading(value, from));
  };

  const clearFormat = () => {
    const [from, to] = currentSelection();
    apply(clearMaterialFormatting(value, from, to));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = event.ctrlKey || event.metaKey;
    if (mod && !event.altKey) {
      const key = event.key.toLowerCase();
      const type: InlineMaterialFormat | null = key === "b" ? "bold" :
        key === "i" ? "italic" : key === "u" ? "underline" :
          key === "x" && event.shiftKey ? "strike" : null;
      if (type) {
        event.preventDefault();
        formatInline(type);
        return;
      }
    }
    if (event.key !== "Enter" || event.shiftKey || mod) return;
    const el = event.currentTarget;
    if (el.selectionStart !== el.selectionEnd) return;
    const start = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const previous = value.slice(lineStart, start);
    const match = previous.match(/^(\s*)(•\s+|[-*]\s+|(\d{1,3})[.)]\s+)(.*)$/);
    if (!match) return;
    const prefix = match[2];
    if (!match[4].trim()) {
      // Empty bullet + Enter finishes the list.
      event.preventDefault();
      apply({ value: value.slice(0, lineStart) + value.slice(start),
        selectionStart: lineStart, selectionEnd: lineStart });
      return;
    }
    const nextPrefix = /^\d/.test(prefix)
      ? `${Number(match[3]) + 1}. `
      : prefix.trimStart().startsWith("•") ? "• " : prefix.trimStart().startsWith("*") ? "* " : "- ";
    const insertion = "\n" + match[1] + nextPrefix;
    if (value.length + insertion.length > MAX_LENGTH) return;
    event.preventDefault();
    const cursor = start + insertion.length;
    apply({
      value: value.slice(0, start) + insertion + value.slice(start),
      selectionStart: cursor, selectionEnd: cursor,
    });
  };

  // Mouse clicks should not steal the textarea's selected text. Keyboard
  // access to formatting buttons is still fully supported.
  const preserveSelection = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest("button:not(.catalog-materials-preview-toggle)")) {
      event.preventDefault();
    }
  };

  return (
    <div className="catalog-materials-editor">
      <div className="catalog-materials-toolbar" role="toolbar" aria-label="Materials formatting tools"
        onMouseDown={preserveSelection}>
        <div className="catalog-materials-tool-group catalog-materials-list-tools" role="group" aria-label="List formatting">
          {options.map(({ value: style, label, Icon }) => (
            <button
              key={style}
              type="button"
              aria-label={label === "Plain" ? "Plain text" : label}
              aria-pressed={!preview && mode === style}
              title={label === "Plain" ? "Plain text" : label}
              disabled={disabled || preview}
              className={!preview && mode === style ? "is-active" : ""}
              onClick={() => chooseStyle(style)}
            >
              <Icon size={15} strokeWidth={1.85} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <span className="catalog-materials-toolbar-divider" aria-hidden="true" />
        <div className="catalog-materials-tool-group catalog-materials-inline-tools" role="group" aria-label="Text formatting">
          {inlineOptions.map(({ value: format, label, shortcut, Icon }) => (
            <button
              key={format}
              type="button"
              aria-label={label}
              title={shortcut ? `${label} (${shortcut})` : label}
              disabled={disabled || preview}
              onClick={() => formatInline(format)}
            >
              <Icon size={16} strokeWidth={1.85} aria-hidden="true" />
            </button>
          ))}
          <button type="button" title="Section heading" aria-label="Heading"
            disabled={disabled || preview} onClick={formatHeading}>
            <Heading2 size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button type="button" title="Clear text formatting" aria-label="Clear formatting"
            disabled={disabled || preview} onClick={clearFormat}>
            <RemoveFormatting size={16} strokeWidth={1.85} aria-hidden="true" />
          </button>
        </div>
        <div className="catalog-materials-toolbar-end">
          <button
            type="button"
            className={`catalog-materials-preview-toggle${preview ? " is-active" : ""}`}
            aria-label={preview ? "Edit materials" : "Preview materials formatting"}
            aria-pressed={preview}
            title={preview ? "Back to editing" : "Preview how materials will appear in the catalog"}
            onClick={() => setPreview(current => !current)}
          >
            {preview ? <Pencil size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
            <span>{preview ? "Edit" : "Preview"}</span>
          </button>
        </div>
      </div>
      {preview ? (
        <div className="catalog-materials-preview" aria-label="Materials formatted preview" aria-live="polite">
          {value.trim()
            ? <MaterialsContent value={value} />
            : <p className="catalog-materials-preview-empty">Your formatted materials will appear here.</p>}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          aria-label="Materials"
          rows={4}
          maxLength={MAX_LENGTH}
          disabled={disabled}
          value={value}
          onKeyDown={onKeyDown}
          onChange={event => { setWarning(""); onChange(event.target.value); }}
          placeholder={placeholder ?? "Tier: Solid pine wood with clear satin finishing\nStructure: Steel hollow with anti-rust white finishing\nFacade: White finished plywood"}
        />
      )}
      <div className="catalog-materials-helper">
        <span>{warning || (preview ? "Preview matches the public catalog. Select Edit to change." : help)}</span>
        <span>{value.length.toLocaleString("en-MY")} / {MAX_LENGTH.toLocaleString("en-MY")}</span>
      </div>
    </div>
  );
}
