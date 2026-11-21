import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check, CheckCircle2, ChevronDown, CircleOff, Hammer } from "lucide-react";
import type { Product } from "../lib/types";

type Availability = Product["availability"];
type Props = { value: Availability; onChange: (next: Availability) => void; disabled?: boolean };

const choices = [
  { id: "available", name: "Available", description: "Available for enquiries", Icon: CheckCircle2 },
  { id: "made-to-order", name: "Made to order", description: "Produced on request", Icon: Hammer },
  { id: "unavailable", name: "Unavailable", description: "Not currently available", Icon: CircleOff },
] as const;

/** Keep Availability within the normal editor layout. Unlike a portal or
 * absolutely-positioned overlay, the menu expands its row so the dialog's
 * clipping, scrolling, and stacking contexts cannot hide the options. */
export default function AvailabilityPicker({ value, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = choices.find(item => item.id === value) ?? choices[2];

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: PointerEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    }
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [open]);

  useEffect(() => {
    if (!disabled || !open) return;
    setOpen(false);
  }, [disabled, open]);

  useEffect(() => {
    if (!open) return;
    // The editor uses a dedicated scroll pane. Bring all options into view
    // instead of opening them off-screen under the sticky Save footer.
    const frame = requestAnimationFrame(() => {
      menuRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function selectOption(next: Availability) {
    onChange(next);
    setOpen(false);
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
        onClick={() => setOpen(previous => !previous)}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="catalog-spec-availability-status"><span className="catalog-spec-availability-dot" />{current.name}</span>
        <ChevronDown size={17} strokeWidth={1.8} className="catalog-spec-availability-chevron" aria-hidden="true" />
      </button>
      {open && !disabled && (
        <div id={menuId} role="listbox" aria-label="Availability options"
          ref={menuRef} className="catalog-spec-availability-menu catalog-spec-availability-inline"
          onKeyDown={handleArrowKeys}>
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
        </div>
      )}
    </div>
  );
}
