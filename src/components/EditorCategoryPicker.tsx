import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  Armchair, BedDouble, BookOpen, CalendarDays, Check, ChevronDown,
  Grid2X2, Images, Layers, LayoutGrid, Package, PanelsTopLeft,
  Search, Store, Warehouse,
} from "lucide-react";
import type { Category } from "../lib/types";

type Props = {
  categories: Category[];
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  allowUncategorised?: boolean;
};

function categoryIcon(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("bed") || normalized.includes("bunk")) return BedDouble;
  if (normalized.includes("cabinet") || normalized.includes("wardrobe")) return Warehouse;
  if (normalized.includes("display") || normalized.includes("memento")) return Images;
  if (normalized.includes("kiosk")) return Store;
  if (normalized.includes("panel")) return PanelsTopLeft;
  if (normalized.includes("rack") || normalized.includes("shelve")) return BookOpen;
  if (normalized.includes("reception")) return Armchair;
  if (normalized.includes("rental")) return CalendarDays;
  if (normalized.includes("table") || normalized.includes("counter")) return LayoutGrid;
  if (normalized.includes("furniture")) return Package;
  return Layers;
}

/**
 * Edit-product category selector. Keeps the existing category UUID and
 * required-product validation intact. Popover is rendered in the native
 * editor dialog so it isn't clipped by its scrolling form or sticky footer.
 */
export default function EditorCategoryPicker({ categories, value, onChange, disabled = false, allowUncategorised = false }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  // Product Editor stays required-by-default; Album also supports no folder.
  const choices = useMemo(() => allowUncategorised
    ? [{ id: "none", name: "Automatic / Uncategorised" }, ...categories]
    : categories, [allowUncategorised, categories]);
  const selected = choices.find(category => category.id === value);
  const Icon = selected ? categoryIcon(selected.name) : Grid2X2;
  const filtered = useMemo(() => choices.filter(category =>
    category.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  ), [choices, search]);
  const dialog = rootRef.current?.closest<HTMLDialogElement>("dialog");

  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const anchor = triggerRef.current?.getBoundingClientRect();
      const box = dialog?.getBoundingClientRect();
      if (!anchor) return;
      const gap = 8;
      const leftLimit = Math.max(12, (box?.left ?? 0) + 12);
      const rightLimit = Math.min(window.innerWidth - 12, (box?.right ?? window.innerWidth) - 12);
      const width = Math.min(420, anchor.width, rightLimit - leftLimit);
      const left = Math.min(Math.max(anchor.left, leftLimit), rightLimit - width);
      const footer = dialog?.querySelector<HTMLElement>(".editor-footer")?.getBoundingClientRect();
      const header = dialog?.querySelector<HTMLElement>(".catalog-editor-actionbar")?.getBoundingClientRect();
      const low = Math.max(12, (box?.top ?? 0) + 12, header?.bottom && header.bottom < anchor.top ? header.bottom + gap : 12);
      const high = Math.min(window.innerHeight - 12, (box?.bottom ?? window.innerHeight) - 12, footer?.top && footer.top > low ? footer.top - gap : window.innerHeight - 12);
      const wishedHeight = Math.min(360, 118 + Math.max(filtered.length, 1) * 45);
      const below = high - anchor.bottom - gap;
      const above = anchor.top - low - gap;
      const placeBelow = below >= Math.min(wishedHeight, 180) || below >= above;
      const free = Math.max(100, placeBelow ? below : above);
      const maxHeight = Math.min(wishedHeight, free);
      const top = placeBelow ? Math.max(low, anchor.bottom + gap) : Math.max(low, anchor.top - gap - maxHeight);
      setLayout({ position: "fixed", top: Math.round(top), left: Math.round(left),
        width: Math.max(140, Math.round(width)), maxHeight: Math.floor(maxHeight), zIndex: 120 });
    };
    position();
    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      document.removeEventListener("scroll", position, true);
    };
  }, [open, dialog, filtered.length]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus({ preventScroll: true });
    const handleOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [open]);

  function choose(id: string) {
    onChange(id);
    setOpen(false);
    setSearch("");
    triggerRef.current?.focus({ preventScroll: true });
  }

  function handleKeys(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" && event.target === searchRef.current && filtered.length) {
      event.preventDefault();
      choose(filtered[0].id);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (!filtered.length) return;
    event.preventDefault();
    const active = optionRefs.current.findIndex(node => node === document.activeElement);
    const next = event.key === "ArrowDown"
      ? (active + 1) % filtered.length
      : (active < 0 ? filtered.length - 1 : (active - 1 + filtered.length) % filtered.length);
    optionRefs.current[next]?.focus({ preventScroll: true });
    optionRefs.current[next]?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className={"catalog-editor-category" + (open ? " is-open" : "")} ref={rootRef}>
      <button type="button" ref={triggerRef} disabled={disabled}
        className="catalog-editor-category-trigger"
        aria-label={selected ? `Category: ${selected.name}` : "Select a category"}
        aria-required={!allowUncategorised} aria-haspopup="dialog" aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => { setSearch(""); setLayout(null); setOpen(previous => !previous); }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setSearch(""); setLayout(null); setOpen(true);
          }
        }}>
        <span className="catalog-editor-category-trigger-icon" aria-hidden="true"><Icon size={17} strokeWidth={1.8}/></span>
        <span className={"catalog-editor-category-value" + (selected ? "" : " is-placeholder")}>
          {selected?.name ?? "Select a category"}
        </span>
        <ChevronDown className="catalog-editor-category-chevron" size={17} strokeWidth={1.7} aria-hidden="true" />
      </button>
      {open && dialog && createPortal(
        <div id={menuId} className="catalog-editor-category-popover" ref={menuRef}
          role="dialog" aria-label="Choose product category" style={{ ...layout, visibility: layout ? "visible" : "hidden" }}
          onKeyDown={handleKeys}>
          <div className="catalog-editor-category-menu-head">
            <span>SELECT CATEGORY</span>
            <span>{choices.length} categories</span>
          </div>
          <div className="catalog-editor-category-search">
            <Search size={16} strokeWidth={1.8} aria-hidden="true" />
            <input ref={searchRef} value={search} onChange={event => setSearch(event.target.value)}
              placeholder="Search categories..." aria-label="Search categories" autoComplete="off" />
          </div>
          <div className="catalog-editor-category-options" role="listbox" aria-label="Product categories">
            {filtered.length ? filtered.map((category, index) => {
              const OptionIcon = categoryIcon(category.name);
              return (
                <button type="button" key={category.id} role="option"
                  aria-selected={category.id === value}
                  className={"catalog-editor-category-option" + (category.id === value ? " is-selected" : "")}
                  ref={node => { optionRefs.current[index] = node; }}
                  onClick={() => choose(category.id)}>
                  <span className="catalog-editor-category-option-icon" aria-hidden="true"><OptionIcon size={17} strokeWidth={1.7} /></span>
                  <span className="catalog-editor-category-option-name">{category.name}</span>
                  {category.id === value && <Check size={17} strokeWidth={2} className="catalog-editor-category-option-check" aria-hidden="true"/>}
                </button>
              );
            }) : <div className="catalog-editor-category-empty">No matching categories</div>}
          </div>
        </div>, dialog
      )}
    </div>
  );
}
