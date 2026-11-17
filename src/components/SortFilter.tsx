import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowDownAZ, ArrowDownWideNarrow, CalendarClock, Check, ChevronDown, ListOrdered, SlidersHorizontal } from "lucide-react";

type SortValue = "recent" | "name" | "price" | "display-order";
type Props = { value: string; onChange: (value: SortValue) => void };

const options = [
  { id: "recent", label: "Latest updated", Icon: CalendarClock },
  { id: "name", label: "Name A–Z", Icon: ArrowDownAZ },
  { id: "price", label: "Price low–high", Icon: ArrowDownWideNarrow },
  { id: "display-order", label: "Display order", Icon: ListOrdered },
] as const;

export default function SortFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = options.find(option => option.id === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const index = Math.max(0, options.findIndex(option => option.id === value));
      optionRefs.current[index]?.focus();
    }
  }, [open, value]);

  function selectSort(id: SortValue) {
    onChange(id);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function navigateOptions(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = optionRefs.current.findIndex(node => node === document.activeElement);
    const last = options.length - 1;
    const next = event.key === "Home" ? 0
      : event.key === "End" ? last
      : event.key === "ArrowDown" ? (currentIndex + 1) % options.length
      : (currentIndex - 1 + options.length) % options.length;
    optionRefs.current[next]?.focus();
  }

  return (
    <div ref={rootRef} className={`catalog-sort-picker${open ? " is-open" : ""}`}>
      <button
        type="button"
        ref={triggerRef}
        className="catalog-sort-trigger"
        aria-label={`Sort products: ${current.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? "catalog-sort-options" : undefined}
        onClick={() => setOpen(previous => !previous)}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <SlidersHorizontal size={17} strokeWidth={1.7} aria-hidden="true" />
        <span className="catalog-sort-value">{current.label}</span>
        <ChevronDown size={16} className="catalog-sort-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="catalog-sort-menu" role="listbox" id="catalog-sort-options" aria-label="Product sort order"
          onKeyDown={navigateOptions}>
          <div className="catalog-sort-heading">Sort products by</div>
          {options.map((option, index) => (
            <button
              key={option.id}
              ref={node => { optionRefs.current[index] = node; }}
              type="button"
              role="option"
              aria-selected={value === option.id}
              className={`catalog-sort-option${value === option.id ? " is-selected" : ""}`}
              onClick={() => selectSort(option.id)}
            >
              <span className="catalog-sort-option-icon"><option.Icon size={17} strokeWidth={1.7} aria-hidden="true" /></span>
              <span className="catalog-sort-option-name">{option.label}</span>
              {value === option.id && <Check size={16} strokeWidth={2} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
