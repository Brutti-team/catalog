import { useEffect, useRef, useState } from "react";
import { observeOverviewOnce } from "./overview-visibility";

const formatter = new Intl.NumberFormat("en-MY");
const screenReaderOnly = {
  position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
  overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap", border: 0,
} as const;

/** Count up once when visible; later data changes render the actual new value. */
export default function OverviewCount({ value }: { value: number | null }) {
  const [display, setDisplay] = useState(0);
  const node = useRef<HTMLSpanElement>(null);
  const startedOnce = useRef(false);

  useEffect(() => {
    if (value === null || !Number.isFinite(value) || !node.current) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const finish = () => {
      window.cancelAnimationFrame(frame);
      startedOnce.current = true;
      setDisplay(value);
    };
    if (startedOnce.current || motion.matches || value === 0) {
      finish();
      return;
    }
    const start = () => {
      if (motion.matches || startedOnce.current) { finish(); return; }
      startedOnce.current = true;
      const startTime = performance.now();
      let previous = 0;
      const tick = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - startTime) / 1200));
        const next = t === 1 ? value : Math.round(value * (1 - (1 - t) ** 2));
        if (next !== previous) {
          previous = next;
          setDisplay(next);
        }
        if (t < 1) frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
    };
    const stop = observeOverviewOnce(node.current, start);
    const onMotion = () => { if (motion.matches) { stop(); finish(); } };
    motion.addEventListener("change", onMotion);
    return () => {
      stop();
      window.cancelAnimationFrame(frame);
      motion.removeEventListener("change", onMotion);
    };
  }, [value]);

  if (value === null || !Number.isFinite(value)) return <>—</>;
  return <>
    <span ref={node} aria-hidden="true" style={{ font: "inherit", color: "inherit", letterSpacing: "inherit", fontVariantNumeric: "tabular-nums", display: "inline" }}>{formatter.format(display)}</span>
    <span style={screenReaderOnly}>{formatter.format(value)}</span>
  </>;
}
