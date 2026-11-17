import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  Armchair,
  BedDouble,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  Images,
  Layers,
  LayoutGrid,
  PanelsTopLeft,
  Shapes,
  Store,
  Table2,
} from "lucide-react";
import type { Category } from "../lib/types";

type Props = {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
};

function categoryIcon(name: string) {
  const label = name.toLowerCase();
  if (label === "all categories") return LayoutGrid;
  if (label.includes("bed") || label.includes("bunk")) return BedDouble;
  if (label.includes("cabinet")) return PanelsTopLeft;
  if (label.includes("display") || label.includes("memento")) return Images;
  if (label.includes("kiosk")) return Store;
  if (label.includes("panel")) return Layers;
  if (label.includes("rack") || label.includes("shel")) return BookOpen;
  if (label.includes("reception") || label.includes("counter")) return Armchair;
  if (label.includes("rental")) return CalendarDays;
  if (label.includes("table") || label.includes("kitchen")) return Table2;
  return Shapes;
}

export default function CategoryFilter({ categories, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const items = useMemo(
    () => [{ id: "all", name: "All categories" }, ...categories],
    [categories],
  );
  const current = items.find(item => item.id === value) ?? items[0];
  const CurrentIcon = categoryIcon(current.name);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const index = Math.max(0, items.findIndex(item => item.id === value));
      optionRefs.current[index]?.focus();
    }
  }, [open, items, value]);

  function choose(id: string) {
    onChange(id);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleOptionKeys(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = optionRefs.current.findIndex(node => node === document.activeElement);
    const last = items.length - 1;
    const next = event.key === "Home" ? 0
      : event.key === "End" ? last
      : event.key === "ArrowDown" ? (currentIndex + 1) % items.length
      : (currentIndex - 1 + items.length) % items.length;
    optionRefs.current[next]?.focus();
  }

  return (
    <div className={`catalog-category-filter${open ? " is-open" : ""}`} ref={containerRef}>
      <button
        ref={triggerRef}
        id="category-filter"
        className="catalog-category-filter-trigger"
        type="button"
        aria-label={`Filter by category: ${current.name}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? "catalog-category-filter-options" : undefined}
        onClick={() => setOpen(previous => !previous)}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <CurrentIcon size={17} strokeWidth={1.7} aria-hidden="true" />
        <span className="catalog-category-filter-value">{current.name}</span>
        <ChevronDown className="catalog-category-filter-chevron" size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="catalog-category-filter-menu" id="catalog-category-filter-options"
          role="listbox" aria-label="Product categories" onKeyDown={handleOptionKeys}>
          <div className="catalog-category-filter-heading">Browse categories</div>
          <div className="catalog-category-filter-options">
            {items.map((item, index) => {
              const Icon = categoryIcon(item.name);
              const selected = value === item.id;
              return (
                <button
                  ref={element => { optionRefs.current[index] = element; }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`catalog-category-filter-option${selected ? " is-selected" : ""}`}
                  key={item.id}
                  onClick={() => choose(item.id)}
                >
                  <span className="catalog-category-filter-option-icon">
                    <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <span className="catalog-category-filter-option-name">{item.name}</span>
                  {selected && <Check size={16} strokeWidth={2} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
