import { useEffect, useRef, useState } from "react";

const formatter = new Intl.NumberFormat("en-MY");
const screenReaderOnly = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

/** Animate only the presentation of a real count, never the underlying metric. */
export default function OverviewCount({ value }: { value: number | null }) {
  const [display, setDisplay] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    if (value === null || !Number.isFinite(value)) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const finish = () => {
      current.current = value;
      setDisplay(value);
    };
    const play = () => {
      window.cancelAnimationFrame(frame);
      if (motion.matches || current.current === value) {
        finish();
        return;
      }
      const from = current.current;
      const started = performance.now();
      const duration = 1550;
      const tick = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - started) / duration));
        const eased = 1 - Math.pow(1 - t, 2);
        const next = t === 1 ? value : Math.round(from + (value - from) * eased);
        current.current = next;
        setDisplay(next);
        if (t < 1) frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
    };
    play();
    motion.addEventListener("change", play);
    return () => {
      window.cancelAnimationFrame(frame);
      motion.removeEventListener("change", play);
    };
  }, [value]);

  if (value === null || !Number.isFinite(value)) return <>—</>;
  return <>
    <span aria-hidden="true" style={{ font: "inherit", color: "inherit", letterSpacing: "inherit", fontVariantNumeric: "tabular-nums", display: "inline" }}>{formatter.format(display)}</span>
    <span style={screenReaderOnly}>{formatter.format(value)}</span>
  </>;
}
