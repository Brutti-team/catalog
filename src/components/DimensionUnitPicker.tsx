import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { DIMENSION_UNIT_OPTIONS, type DimensionUnit } from "../lib/dimensions";

type Props = {
  value: DimensionUnit;
  onChange: (value: DimensionUnit) => void;
  disabled?: boolean;
};

const unitNames: Record<DimensionUnit, string> = {
  mm: "Millimetres",
  cm: "Centimetres",
  m: "Metres",
  in: "Inches",
  ft: "Feet",
};

type MenuPosition = { top: number; left: number; width: number; maxHeight: number };

/**
 * Accessible styled unit picker, rendered inside the existing native editor
 * dialog's top layer so it is not clipped by its sticky Save footer.
 * The actual values still convert to/from canonical centimetres in ProductEditor.
 */
export default function DimensionUnitPicker({ value, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const portalTarget = rootRef.current?.closest<HTMLElement>("#product-editor-specs");

  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const rect = trigger.getBoundingClientRect();
    const dialog = trigger.closest<HTMLDialogElement>("dialog");
    const box = dialog?.getBoundingClientRect();
    const footer = dialog?.querySelector<HTMLElement>(".editor-footer")?.getBoundingClientRect();
    const header = dialog?.querySelector<HTMLElement>(".catalog-editor-actionbar")?.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const gap = 7;
    const leftBound = Math.max(10, (box?.left ?? 0) + 10);
    const rightBound = Math.min(vw - 10, (box?.right ?? vw) - 10);
    const topBound = Math.max(10, (box?.top ?? 0) + 10,
      header && header.bottom > 0 && header.bottom < rect.top ? header.bottom + gap : 10);
    const bottomBound = Math.max(topBound + 85, Math.min(vh - 10, (box?.bottom ?? vh) - 10,
      footer && footer.top >= rect.bottom ? footer.top - gap : vh - 10));

    const availableHeight = Math.max(85, bottomBound - topBound);
    const desiredHeight = Math.min(menu.scrollHeight || 254, availableHeight);
    const width = Math.min(234, Math.max(165, rightBound - leftBound));
    const left = Math.max(leftBound, Math.min(rect.right - width, rightBound - width));
    const top = rect.bottom + gap + desiredHeight <= bottomBound
      ? rect.bottom + gap
      : rect.top - gap - desiredHeight >= topBound
        ? rect.top - gap - desiredHeight
        : Math.max(topBound, bottomBound - desiredHeight);
    const next = {
      top: Math.round(top), left: Math.round(left),
      width: Math.round(width), maxHeight: Math.floor(desiredHeight),
    };
    setPosition(prev => prev &&
      prev.top === next.top && prev.left === next.left &&
      prev.width === next.width && prev.maxHeight === next.maxHeight
        ? prev : next);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    positionMenu();
    document.addEventListener("scroll", positionMenu, true);
    window.addEventListener("resize", positionMenu);
    return () => {
      document.removeEventListener("scroll", positionMenu, true);
      window.removeEventListener("resize", positionMenu);
    };
  }, [open, positionMenu]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: PointerEvent) => {
      const node = event.target as Node;
      if (!rootRef.current?.contains(node) && !menuRef.current?.contains(node)) {
        setOpen(false);
        setPosition(null);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setOpen(false);
      setPosition(null);
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEscape, true);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onEscape, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !position) return;
    const index = DIMENSION_UNIT_OPTIONS.findIndex(option => option.value === value);
    optionRefs.current[Math.max(0, index)]?.focus({ preventScroll: true });
  }, [open, position, value]);

  function choose(next: DimensionUnit) {
    onChange(next);
    setOpen(false);
    setPosition(null);
    triggerRef.current?.focus({ preventScroll: true });
  }

  function onOptionKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = optionRefs.current.findIndex(node => node === document.activeElement);
    const length = DIMENSION_UNIT_OPTIONS.length;
    const next = event.key === "Home" ? 0
      : event.key === "End" ? length - 1
      : event.key === "ArrowDown" ? (current + 1) % length
      : (current - 1 + length) % length;
    optionRefs.current[next]?.focus({ preventScroll: true });
    optionRefs.current[next]?.scrollIntoView({ block: "nearest" });
  }

  const menuStyle: CSSProperties = {
    position: "fixed",
    top: position?.top ?? 0,
    left: position?.left ?? 0,
    width: position?.width ?? 220,
    maxHeight: position?.maxHeight ?? 254,
    visibility: position ? "visible" : "hidden",
    overflowY: "auto",
    zIndex: 99,
  };

  return (
    <div className={`catalog-dimension-unit${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="catalog-dimension-unit-trigger"
        aria-label={`Measurement unit: ${unitNames[value]}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => { setPosition(null); setOpen(old => !old); }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setPosition(null);
            setOpen(true);
          }
        }}
      >
        <span className="catalog-dimension-unit-label">Unit</span>
        <span className="catalog-dimension-unit-value">{value}</span>
        <ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" className="catalog-dimension-unit-chevron" />
      </button>
      {open && portalTarget && createPortal(
        <div
          id={id}
          role="listbox"
          aria-label="Measurement units"
          className="catalog-dimension-unit-menu"
          ref={menuRef}
          style={menuStyle}
          onKeyDown={onOptionKeyDown}
        >
          {DIMENSION_UNIT_OPTIONS.map((option, index) => (
            <button
              key={option.value}
              ref={node => { optionRefs.current[index] = node; }}
              type="button"
              role="option"
              aria-selected={value === option.value}
              className={`catalog-dimension-unit-option${value === option.value ? " is-selected" : ""}`}
              onClick={() => choose(option.value)}
            >
              <span className="catalog-dimension-option-code">{option.label}</span>
              <span className="catalog-dimension-option-name">{unitNames[option.value]}</span>
              {value === option.value && <Check size={15} strokeWidth={2.2} aria-hidden="true" />}
            </button>
          ))}
        </div>,
        portalTarget,
      )}
    </div>
  );
}
