import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Ruler, Search } from "lucide-react";
import "./measurement-type-picker.css";

type Props = {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  label: string;
  customName?: string;
};

type Position = { top: number; left: number; width: number; maxHeight: number };

export default function MeasurementTypePicker({ value, options, onChange, label, customName }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<Position | null>(null);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Popover remains a descendant of the active modal but renders in the browser's
  // top layer, avoiding clipping by the dialog's scroll and sticky sections.
  const portalTarget = rootRef.current?.closest<HTMLDialogElement>("dialog")
    ?? rootRef.current?.closest<HTMLElement>("#product-editor-specs");

  const filtered = options.filter(option => option.toLowerCase().includes(query.trim().toLowerCase()));
  const showCustom = !query.trim() || "other measurement custom".includes(query.trim().toLowerCase()) ||
    Boolean(customName?.toLowerCase().includes(query.trim().toLowerCase()));
  const visible = [...filtered, ...(showCustom ? ["__custom__"] : [])];
  const selectedLabel = value === "__custom__" ? (customName ? `Other: ${customName}` : "Other measurement") : value || "Select measurement";

  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const dialog = trigger.closest<HTMLDialogElement>("dialog");
    const bounds = dialog?.getBoundingClientRect();
    const header = dialog?.querySelector<HTMLElement>(".catalog-editor-actionbar")?.getBoundingClientRect();
    const footer = dialog?.querySelector<HTMLElement>(".editor-footer")?.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const gap = 7;
    const leftBound = Math.max(10, (bounds?.left ?? 0) + 10);
    const rightBound = Math.min(vw - 10, (bounds?.right ?? vw) - 10);
    const topBound = Math.max(10, (bounds?.top ?? 0) + 10,
      header && header.bottom > 0 && header.bottom < rect.top ? header.bottom + gap : 10);
    const bottomBound = Math.max(topBound + 110, Math.min(vh - 10, (bounds?.bottom ?? vh) - 10,
      footer && footer.top >= rect.bottom ? footer.top - gap : vh - 10));

    const desired = 310;
    const below = bottomBound - rect.bottom - gap;
    const above = rect.top - gap - topBound;
    const placeBelow = below >= Math.min(235, desired) || below >= above;
    const available = Math.max(110, placeBelow ? below : above);
    const maxHeight = Math.min(desired, available);
    const width = Math.min(300, Math.max(rect.width, 215), rightBound - leftBound);
    const left = Math.max(leftBound, Math.min(rect.left, rightBound - width));
    const top = placeBelow ? Math.min(rect.bottom + gap, bottomBound - maxHeight)
      : Math.max(topBound, rect.top - gap - maxHeight);
    const next = { top: Math.round(top), left: Math.round(left), width: Math.round(width), maxHeight: Math.floor(maxHeight) };
    setPosition(prev => prev && Object.keys(next).every(key => prev[key as keyof Position] === next[key as keyof Position])
      ? prev : next);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    if (!menu) return;
    // Ordinary fixed portal content may be hidden by the fullscreen
    // editor dialog's scrolling box. A descendant manual popover is promoted
    // above the dialog in the top layer without dismissing the editor.
    if (typeof menu.showPopover === "function") {
      try {
        if (!menu.matches(":popover-open")) menu.showPopover();
      } catch {
        // Fall back to a visible fixed menu on browsers that reject popovers.
        menu.removeAttribute("popover");
      }
    } else {
      menu.removeAttribute("popover");
    }
    positionMenu();
    const frame = requestAnimationFrame(positionMenu);
    document.addEventListener("scroll", positionMenu, true);
    window.addEventListener("resize", positionMenu);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", positionMenu, true);
      window.removeEventListener("resize", positionMenu);
      if (menu.matches(":popover-open")) menu.hidePopover();
    };
  }, [open, positionMenu]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus({ preventScroll: true });
    const onOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setPosition(null);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const choose = (next: string) => {
    onChange(next);
    close();
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (event.key === "Enter" && document.activeElement === searchRef.current && visible.length) {
      event.preventDefault();
      choose(visible[0]);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !visible.length) return;
    event.preventDefault();
    const current = optionRefs.current.findIndex(node => node === document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? visible.length - 1
      : event.key === "ArrowDown" ? (current + 1) % visible.length
        : current < 0 ? visible.length - 1 : (current - 1 + visible.length) % visible.length;
    optionRefs.current[next]?.focus({ preventScroll: true });
    optionRefs.current[next]?.scrollIntoView({ block: "nearest" });
  };

  const menuStyle: CSSProperties = {
    position: "fixed",
    top: position?.top ?? 0,
    left: position?.left ?? 0,
    width: position?.width ?? 280,
    maxHeight: position?.maxHeight ?? 310,
    visibility: position ? "visible" : "hidden",
    zIndex: 150,
  };

  return (
    <div className={`catalog-measure-type${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`catalog-measure-type-trigger${value ? " has-value" : ""}`}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => { setPosition(null); setOpen(old => !old); setQuery(""); }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setPosition(null);
            setOpen(true);
          }
        }}
      >
        <Ruler size={15} strokeWidth={1.8} className="catalog-measure-type-ruler" aria-hidden="true" />
        <span className="catalog-measure-type-value">{selectedLabel}</span>
        <ChevronDown size={16} strokeWidth={1.8} className="catalog-measure-type-chevron" aria-hidden="true" />
      </button>
      {open && portalTarget && createPortal(
        <div popover="manual" className="catalog-measure-type-menu" ref={menuRef} style={menuStyle} onKeyDown={onMenuKeyDown}>
          <div className="catalog-measure-type-search">
            <Search size={15} strokeWidth={1.9} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              aria-label="Search measurement types"
              value={query}
              placeholder="Search measurements..."
              onChange={event => setQuery(event.target.value)}
            />
          </div>
          <div id={id} role="listbox" aria-label="Measurement types" className="catalog-measure-type-options">
            {visible.map((option, index) => {
              const isCustom = option === "__custom__";
              const selected = value === option;
              return <button
                key={option}
                ref={node => { optionRefs.current[index] = node; }}
                type="button"
                role="option"
                aria-selected={selected}
                className={`catalog-measure-type-option${selected ? " is-selected" : ""}${isCustom ? " is-custom" : ""}`}
                onClick={() => choose(option)}
              >
                <span>{isCustom ? (customName ? `Other: ${customName}` : "Other measurement...") : option}</span>
                {selected && <Check size={15} strokeWidth={2.25} aria-hidden="true" />}
              </button>;
            })}
            {!visible.length && <p className="catalog-measure-type-empty">No matching measurement</p>}
          </div>
          <div className="catalog-measure-type-hint">Choose a dimension or add a custom name.</div>
        </div>,
        portalTarget,
      )}
    </div>
  );
}
