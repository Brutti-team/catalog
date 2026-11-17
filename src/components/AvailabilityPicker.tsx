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

export default function AvailabilityPicker({ value, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = choices.find(item => item.id === value) ?? choices[2];

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const index = Math.max(0, choices.findIndex(item => item.id === value));
    optionRefs.current[index]?.focus();
  }, [open, value]);

  function selectOption(next: Availability) {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
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
    optionRefs.current[next]?.focus();
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
      {open && (
        <div id={menuId} role="listbox" aria-label="Availability options"
          className="catalog-spec-availability-menu" onKeyDown={handleArrowKeys}>
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
