import {
  useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
  type CSSProperties, type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { DIMENSION_UNIT_OPTIONS, type DimensionUnit } from "../lib/dimensions";

type Props = {
  value: DimensionUnit | null;
  label: string;
  onChange: (unit: DimensionUnit) => void;
  disabled?: boolean;
};

type Position = { top: number; left: number; width: number; maxHeight: number };

const unitNames: Record<DimensionUnit, string> = {
  mm: "Millimetres",
  cm: "Centimetres",
  m: "Metres",
  in: "Inches",
  ft: "Feet",
};

/** A single compact measurement-unit selector.
 * The menu is portaled inside the active dialog and promoted into the
 * browser's top layer via manual popover, so editor scrolling cannot clip it.
 */
export default function InlineDimensionUnitMenu({
  value, label, onChange, disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const portalTarget = rootRef.current?.closest<HTMLDialogElement>("dialog");

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const dialog = trigger.closest<HTMLDialogElement>("dialog");
    const dialogRect = dialog?.getBoundingClientRect();
    const header = dialog?.querySelector<HTMLElement>(".catalog-editor-actionbar")?.getBoundingClientRect();
    const footer = dialog?.querySelector<HTMLElement>(".editor-footer")?.getBoundingClientRect();

    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const leftEdge = Math.max(10, (dialogRect?.left ?? 0) + 10);
    const rightEdge = Math.min(viewportWidth - 10, (dialogRect?.right ?? viewportWidth) - 10);
    const topEdge = Math.max(
      10, (dialogRect?.top ?? 0) + 10,
      header && header.bottom < rect.top ? header.bottom + 8 : 10,
    );
    const bottomEdge = Math.min(
      viewportHeight - 10,
      (dialogRect?.bottom ?? viewportHeight) - 10,
      footer && footer.top > rect.bottom ? footer.top - 8 : viewportHeight - 10,
    );
    const gap = 8;
    const below = Math.max(0, bottomEdge - rect.bottom - gap);
    const above = Math.max(0, rect.top - topEdge - gap);
    const onBottom = below >= 230 || below >= above;
    const space = onBottom ? below : above;
    const maxHeight = Math.max(96, Math.min(274, space));
    const top = onBottom
      ? Math.min(rect.bottom + gap, bottomEdge - maxHeight)
      : Math.max(topEdge, rect.top - gap - maxHeight);
    const width = Math.max(170, Math.min(224, rightEdge - leftEdge));
    const left = Math.max(leftEdge, Math.min(rect.right - width, rightEdge - width));

    const next = {
      top: Math.round(top),
      left: Math.round(left),
      width: Math.round(width),
      maxHeight: Math.floor(maxHeight),
    };
    setPosition(prev => prev && prev.top === next.top && prev.left === next.left &&
      prev.width === next.width && prev.maxHeight === next.maxHeight ? prev : next);
  }, []);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    if (!menu) return;
    if (typeof menu.showPopover === "function") {
      try {
        if (!menu.matches(":popover-open")) menu.showPopover();
      } catch {
        menu.removeAttribute("popover");
      }
    } else {
      menu.removeAttribute("popover");
    }
    reposition();
    const frame = requestAnimationFrame(reposition);
    document.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      if (menu.matches(":popover-open")) menu.hidePopover();
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    // Keep Escape from closing the whole Product Editor dialog.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, close]);

  function pick(next: DimensionUnit) {
    onChange(next);
    close(true);
  }

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Tab") {
      close();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = optionRefs.current.findIndex(el => el === document.activeElement);
    const length = DIMENSION_UNIT_OPTIONS.length;
    const next = event.key === "Home" ? 0 :
      event.key === "End" ? length - 1 :
      event.key === "ArrowDown" ? (current + 1) % length :
      current < 0 ? length - 1 : (current - 1 + length) % length;
    optionRefs.current[next]?.focus({ preventScroll: true });
    optionRefs.current[next]?.scrollIntoView({ block: "nearest" });
  }

  const menuStyle: CSSProperties = {
    position: "fixed",
    top: position?.top ?? 0,
    left: position?.left ?? 0,
    width: position?.width ?? 220,
    maxHeight: position?.maxHeight ?? 274,
    visibility: position ? "visible" : "hidden",
    zIndex: 240,
  };

  return (
    <div ref={rootRef} className={`catalog-dimension-inline-unit${open ? " is-open" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="catalog-dimension-inline-trigger"
        aria-label={`Choose ${label} unit, currently ${value ? unitNames[value] : "Select unit"}`}
        title={`${label} unit: ${value ? unitNames[value] : "Select unit"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => { setPosition(null); setOpen(prev => !prev); }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setPosition(null);
            setOpen(true);
          }
        }}
      >
        <span>{value ?? "Unit"}</span>
        <ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open && portalTarget && createPortal(
        <div
          ref={menuRef}
          id={id}
          popover="manual"
          role="listbox"
          aria-label={`${label} measurement units`}
          className="catalog-dimension-inline-menu"
          style={menuStyle}
          onKeyDown={onMenuKeyDown}
        >
          <div className="catalog-dimension-inline-menu-title">SELECT UNIT</div>
          <div className="catalog-dimension-inline-menu-options">
            {DIMENSION_UNIT_OPTIONS.map((option, index) => (
              <button
                type="button"
                key={option.value}
                ref={node => { optionRefs.current[index] = node; }}
                role="option"
                aria-selected={value === option.value}
                className={value === option.value ? "is-selected" : ""}
                onClick={() => pick(option.value)}
              >
                <span className="catalog-dimension-inline-unit-code">{option.label}</span>
                <span className="catalog-dimension-inline-unit-description">{unitNames[option.value]}</span>
                {value === option.value && <Check size={15} strokeWidth={2.1} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>,
        portalTarget,
      )}
    </div>
  );
}
