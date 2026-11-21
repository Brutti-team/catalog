import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, CheckCircle2, ChevronDown, CircleOff, Hammer } from "lucide-react";
import type { Product } from "../lib/types";

type Availability = Product["availability"];
type Props = { value: Availability; onChange: (next: Availability) => void; disabled?: boolean };
type MenuLayout = { top: number; left: number; width: number; maxHeight: number };

const choices = [
  { id: "available", name: "Available", description: "Available for enquiries", Icon: CheckCircle2 },
  { id: "made-to-order", name: "Made to order", description: "Produced on request", Icon: Hammer },
  { id: "unavailable", name: "Unavailable", description: "Not currently available", Icon: CircleOff },
] as const;

export default function AvailabilityPicker({ value, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<MenuLayout | null>(null);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = choices.find(item => item.id === value) ?? choices[2];

  // Portal directly to the native modal, NOT its scrolling Specifications card.
  // The card clips descendants and can cut off the availability options.
  const portalTarget = rootRef.current?.closest<HTMLDialogElement>("dialog") ?? null;

  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu || !portalTarget) return;

    const anchor = trigger.getBoundingClientRect();
    const dialog = portalTarget;
    const dialogBox = dialog?.getBoundingClientRect();
    const footer = dialog?.querySelector<HTMLElement>(".editor-footer");
    const footerBox = footer?.getBoundingClientRect();
    const header = dialog?.querySelector<HTMLElement>(".catalog-editor-actionbar");
    const headerBox = header?.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const gap = 9;

    // Keep the popover fully in the scrollable viewport above the Save/Cancel bar.
    const usableTop = Math.max(8, (dialogBox?.top ?? 0) + 9,
      headerBox && headerBox.bottom > 0 && headerBox.bottom < anchor.top
        ? headerBox.bottom + gap : 8);
    const footerTop = footerBox && footerBox.top >= usableTop && footerBox.top < viewportHeight
      ? footerBox.top - gap : viewportHeight - gap;
    const usableBottom = Math.min(viewportHeight - 8, (dialogBox?.bottom ?? viewportHeight) - 8, footerTop);
    const availableHeight = Math.max(64, usableBottom - usableTop);
    const desiredHeight = menu.scrollHeight || 220;
    const shownHeight = Math.min(desiredHeight, availableHeight);
    const maxHeight = Math.max(64, Math.floor(shownHeight));

    let top: number;
    if (anchor.bottom + gap + shownHeight <= usableBottom) {
      top = anchor.bottom + gap;
    } else if (anchor.top - gap - shownHeight >= usableTop) {
      top = anchor.top - gap - shownHeight;
    } else {
      // Small windows: keep every choice accessible in a viewport-bounded popover,
      // instead of letting the sticky footer cover the final option.
      top = Math.max(usableTop, Math.min(anchor.top - shownHeight + 14, usableBottom - shownHeight));
    }

    const usableLeft = Math.max(8, (dialogBox?.left ?? 0) + 8);
    const usableRight = Math.min(viewportWidth - 8, (dialogBox?.right ?? viewportWidth) - 8);
    // Prefer left alignment with the availability field, and flip inward at
    // either dialog edge. Never allow the menu's right side to overflow.
    const freeWidth = Math.max(1, usableRight - usableLeft);
    const width = Math.min(340, Math.max(260, anchor.width), freeWidth);
    const left = Math.min(Math.max(anchor.left, usableLeft), usableRight - width);
    // Absolute coordinates are relative to the dialog: fixed coordinates here
    // can be trapped by a transformed/scroll-clipped editor ancestor.
    const next = {
      top: Math.round(top - (dialogBox?.top ?? 0)),
      left: Math.round(left - (dialogBox?.left ?? 0)),
      width: Math.round(width),
      maxHeight,
    };
    setLayout(previous => previous && Object.keys(next).every(key =>
      previous[key as keyof MenuLayout] === next[key as keyof MenuLayout]) ? previous : next);
  }, [portalTarget]);

  useLayoutEffect(() => {
    if (!open) return;
    positionMenu();
    // Reposition when the editor dialog scrolls, viewport resizes or device rotates.
    document.addEventListener("scroll", positionMenu, true);
    window.addEventListener("resize", positionMenu);
    return () => {
      document.removeEventListener("scroll", positionMenu, true);
      window.removeEventListener("resize", positionMenu);
    };
  }, [open, positionMenu]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: PointerEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
      }
    }
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !layout) return;
    const index = Math.max(0, choices.findIndex(item => item.id === value));
    optionRefs.current[index]?.focus({ preventScroll: true });
  }, [open, value, layout]);

  function selectOption(next: Availability) {
    onChange(next);
    setOpen(false);
    setLayout(null);
    triggerRef.current?.focus({ preventScroll: true });
  }

  function handleArrowKeys(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const active = optionRefs.current.findIndex(node => node === document.activeElement);
    const last = choices.length - 1;
    const next = event.key === "Home" ? 0
      : event.key === "End" ? last
      : event.key === "ArrowDown" ? (active + 1) % choices.length
      : (active - 1 + choices.length) % choices.length;
    optionRefs.current[next]?.focus({ preventScroll: true });
    optionRefs.current[next]?.scrollIntoView({ block: "nearest" });
  }

  const menuStyle: CSSProperties = {
    position: "absolute",
    top: layout?.top ?? 0,
    left: layout?.left ?? 0,
    right: "auto",
    width: layout?.width ?? 280,
    maxHeight: layout?.maxHeight,
    overflowY: "auto",
    visibility: layout ? "visible" : "hidden",
    zIndex: 90,
  };

  return (
    <div className={`catalog-spec-availability${open ? " is-open" : ""}`} ref={rootRef} data-status={value}>
      <button
        ref={triggerRef}
        type="button"
        className="catalog-spec-availability-trigger"
        aria-label={`Availability: ${current.name}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => { setLayout(null); setOpen(previous => !previous); }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setLayout(null);
            setOpen(true);
          }
        }}
      >
        <span className="catalog-spec-availability-status"><span className="catalog-spec-availability-dot" />{current.name}</span>
        <ChevronDown size={17} strokeWidth={1.8} className="catalog-spec-availability-chevron" aria-hidden="true" />
      </button>
      {open && portalTarget && createPortal(
        <div id={menuId} role="listbox" aria-label="Availability options"
          ref={menuRef} className="catalog-spec-availability-menu catalog-spec-availability-floating"
          style={menuStyle} onKeyDown={handleArrowKeys}>
          <span className="catalog-spec-availability-menu-title">Product availability</span>
          {choices.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === value}
              data-option-status={item.id}
              className={`catalog-spec-availability-option${item.id === value ? " is-selected" : ""}`}
              ref={node => { optionRefs.current[index] = node; }}
              onClick={() => selectOption(item.id)}
            >
              <span className="catalog-spec-availability-option-icon"><item.Icon size={17} strokeWidth={1.7} aria-hidden="true" /></span>
              <span className="catalog-spec-availability-option-copy">
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </span>
              {item.id === value && <Check size={16} className="catalog-spec-availability-check" aria-hidden="true" />}
            </button>
          ))}
        </div>, portalTarget
      )}
    </div>
  );
}
