import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  Check, CheckCircle2, Crop, FlipHorizontal2, Image as ImageIcon,
  LoaderCircle, Palette, RotateCcw, RotateCw, Scan,
  SlidersHorizontal, Sparkles, X,
} from "lucide-react";
import type { ProductImage } from "../lib/types";
import Modal from "./Modal";
import { publicAssetUrl } from "../lib/assets";
import { aiFurnitureCutout, stopAICutout } from "../lib/ai-background-removal";
import type { CoverSource } from "../lib/cover-studio-canvas";

type Props = {
  image: ProductImage;
  onApply: (file: File) => Promise<void>;
  onClose: () => void;
};

type Ratio = "4:3" | "1:1" | "3:4" | "9:16";
type Tool = "crop" | "background";
type Backdrop = "original" | "transparent" | "white" | "cream" | "sage" | "forest" | "charcoal" | "custom";
type Pan = { x: number; y: number };
type CropRect = { x: number; y: number; w: number; h: number };
type CropHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
const initialCrop = (): CropRect => ({ x: 0, y: 0, w: 1, h: 1 });
const cropHandles: CropHandle[] = ["nw","n","ne","e","se","s","sw","w"];

// The user can refine soft matte edges without altering the source image.
// The threshold is adjustable because furniture can be white or dark.
function refineCutout(source: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  if (strength <= 0) return source;
  const output = document.createElement("canvas");
  output.width = source.width;
  output.height = source.height;
  const ctx = output.getContext("2d", { willReadFrequently: true });
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, output.width, output.height);
  const t = strength / 100;
  const lower = t * 175;
  const upper = 255 - t * 11;
  for (let i = 3; i < pixels.data.length; i += 4) {
    const alpha = pixels.data[i];
    const fraction = clamp((alpha - lower) / Math.max(1, upper - lower), 0, 1);
    pixels.data[i] = Math.round(255 * fraction * fraction * (3 - 2 * fraction));
  }
  ctx.putImageData(pixels, 0, 0);
  return output;
}

const aspectRatios: Record<Ratio, number> = {
  "4:3": 4 / 3, "1:1": 1, "3:4": 3 / 4, "9:16": 9 / 16,
};
const backdropColors: Record<Exclude<Backdrop, "original" | "transparent" | "custom">, string> = {
  white: "#ffffff", cream: "#f3eee6", sage: "#e4ebe2",
  forest: "#28543d", charcoal: "#2c3331",
};
const backdropOptions: { id: Backdrop; label: string; color?: string }[] = [
  { id: "transparent", label: "Transparent" },
  { id: "white", label: "White", color: "#ffffff" },
  { id: "cream", label: "Warm ivory", color: "#f3eee6" },
  { id: "sage", label: "Soft sage", color: "#e4ebe2" },
  { id: "forest", label: "Brutti green", color: "#28543d" },
  { id: "charcoal", label: "Charcoal", color: "#2c3331" },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function placement(sw: number, sh: number, width: number, height: number, angle: number, zoom: number, pan: Pan) {
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const absCos = Math.abs(cos), absSin = Math.abs(sin);
  const base = Math.max(
    (width * absCos + height * absSin) / sw,
    (width * absSin + height * absCos) / sh,
  );
  const scale = base * zoom;
  const limitX = Math.max(0, (sw * scale - width * absCos - height * absSin) / 2);
  const limitY = Math.max(0, (sh * scale - width * absSin - height * absCos) / 2);
  const proposedX = pan.x * width, proposedY = pan.y * height;
  const localX = clamp(proposedX * cos + proposedY * sin, -limitX, limitX);
  const localY = clamp(-proposedX * sin + proposedY * cos, -limitY, limitY);
  return {
    scale, radians,
    dx: localX * cos - localY * sin,
    dy: localX * sin + localY * cos,
  };
}

function drawPhoto(
  output: HTMLCanvasElement,
  original: HTMLImageElement,
  cutout: HTMLCanvasElement | null,
  background: Backdrop,
  custom: string,
  angle: number, zoom: number, pan: Pan, mirror: boolean,
  previewOriginal = false,
) {
  const ctx = output.getContext("2d");
  if (!ctx) throw new Error("Could not open the photo canvas.");
  const { width, height } = output;
  const showCutout = !!cutout && background !== "original" && !previewOriginal;
  const graphic = showCutout && cutout ? cutout : original;
  const sw = showCutout ? cutout.width : original.naturalWidth;
  const sh = showCutout ? cutout.height : original.naturalHeight;
  ctx.clearRect(0, 0, width, height);
  if (showCutout && background !== "transparent") {
    ctx.fillStyle = background === "custom" ? custom :
      backdropColors[background as keyof typeof backdropColors];
    ctx.fillRect(0, 0, width, height);
  }
  const transform = placement(sw, sh, width, height, angle, zoom, pan);
  ctx.save();
  ctx.translate(width / 2 + transform.dx, height / 2 + transform.dy);
  ctx.rotate(transform.radians);
  ctx.scale(mirror ? -transform.scale : transform.scale, transform.scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(graphic, -sw / 2, -sh / 2);
  ctx.restore();
}

export default function PhotoCropEditor({ image, onApply, onClose }: Props) {
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>("crop");
  const [ratio, setRatio] = useState<Ratio>("4:3");
  const [quarterTurn, setQuarterTurn] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [mirror, setMirror] = useState(false);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [crop, setCrop] = useState<CropRect>(initialCrop);
  const [edgeStrength, setEdgeStrength] = useState(26);
  const [eraserEnabled, setEraserEnabled] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [maskRevision, setMaskRevision] = useState(0);
  const [cutout, setCutout] = useState<HTMLCanvasElement | null>(null);
  const [background, setBackground] = useState<Backdrop>("original");
  const [customColor, setCustomColor] = useState("#e5dfd3");
  const [previewOriginal, setPreviewOriginal] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState("");
  const [aiPercent, setAiPercent] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const aiRun = useRef(0);
  const workingCutout = useRef<HTMLCanvasElement | null>(null);
  const gesture = useRef<{
    id: number; x: number; y: number; px: number; py: number;
    mode: "pan" | "crop" | "erase"; handle?: CropHandle; startCrop: CropRect;
  } | null>(null);
  const totalAngle = quarterTurn + tilt;
  const width = 900, height = Math.round(width / aspectRatios[ratio]);
  const hasCutout = !!cutout;
  // Apply alpha correction once when the slider changes, not for every drag frame.
  const refinedCutout = useMemo(
    () => workingCutout.current ? refineCutout(workingCutout.current, edgeStrength) : null,
    // maskRevision increments whenever the editable alpha mask changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cutout, edgeStrength, maskRevision],
  );

  useEffect(() => {
    let active = true;
    const next = new Image();
    next.crossOrigin = "anonymous";
    next.onload = () => {
      if (!active) return;
      setSource(next);
      setRatio(next.naturalHeight > next.naturalWidth ? "3:4" : "4:3");
      setError("");
    };
    next.onerror = () => {
      if (active) setError("Unable to open this image. Try downloading it and uploading it to Album again.");
    };
    next.src = publicAssetUrl(image.url);
    return () => { active = false; next.onload = null; next.onerror = null; };
  }, [image.url]);

  useEffect(() => () => { aiRun.current++; stopAICutout(); }, []);

  useEffect(() => {
    if (!source || !canvasRef.current) return;
    try {
      const canvas = canvasRef.current;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      drawPhoto(canvas, source, refinedCutout, background, customColor,
        totalAngle, zoom, pan, mirror, previewOriginal);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to preview this photo.");
    }
  }, [source, refinedCutout, background, customColor, totalAngle, zoom, pan, mirror, previewOriginal, width, height]);

  function cancelAI() {
    aiRun.current++;
    stopAICutout();
    setAiBusy(false);
    setAiProgress("");
    setAiPercent(0);
  }

  function reset() {
    if (aiBusy) cancelAI();
    setPan({ x: 0, y: 0 }); setCrop(initialCrop()); setEdgeStrength(26);
    setZoom(1); setTilt(0); setQuarterTurn(0);
    setMirror(false); setCutout(null); workingCutout.current = null;
    setMaskRevision(0); setEraserEnabled(false); setBackground("original");
    setCustomColor("#e5dfd3"); setPreviewOriginal(false);
    setRatio(source && source.naturalHeight > source.naturalWidth ? "3:4" : "4:3");
    setError("");
  }

  async function removeBackground() {
    if (!source || aiBusy || saving) return;
    const run = ++aiRun.current;
    setAiBusy(true);
    setAiProgress("Preparing local AI model…");
    setAiPercent(3);
    setError("");
    try {
      // Keep inference within the worker's existing 1100-pixel limit.
      const factor = Math.min(1, 768 / Math.max(source.naturalWidth, source.naturalHeight));
      const w = Math.max(1, Math.round(source.naturalWidth * factor));
      const h = Math.max(1, Math.round(source.naturalHeight * factor));
      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = w; sourceCanvas.height = h;
      const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("The browser cannot process this photo.");
      context.drawImage(source, 0, 0, w, h);
      // A cross-origin photo can display but may forbid pixel extraction.
      try { context.getImageData(0, 0, 1, 1); }
      catch { throw new Error("This photo host blocks background removal. Re-upload the image to Brutti Album."); }
      const localSource: CoverSource = { canvas: sourceCanvas, width: w, height: h };
      const result = await aiFurnitureCutout(localSource, (message, percent) => {
        if (run !== aiRun.current) return;
        setAiProgress(message);
        if (typeof percent === "number") setAiPercent(current => Math.max(current, Math.min(95, percent)));
      });
      if (run !== aiRun.current) return;
      const editable = document.createElement("canvas");
      editable.width = result.width; editable.height = result.height;
      editable.getContext("2d")?.drawImage(result, 0, 0);
      workingCutout.current = editable;
      setMaskRevision(v => v + 1);
      setEraserEnabled(false);
      setCutout(result);
      // First show true transparency with a checkerboard. Pale cream is an
      // intentional optional colour, never an automatic background replacement.
      setBackground("transparent");
      setPreviewOriginal(false);
      setAiProgress("AI cutout ready. Inspect the checkerboard and refine any remaining edges.");
      setAiPercent(100);
    } catch (reason) {
      if (run !== aiRun.current) return;
      setAiProgress("");
      setAiPercent(0);
      setError(reason instanceof Error ? reason.message : "Could not remove this background.");
    } finally {
      if (run === aiRun.current) setAiBusy(false);
    }
  }

  function eraseAt(event: PointerEvent<HTMLDivElement>) {
    const editable = workingCutout.current;
    if (!editable || !source || !canvasRef.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const transform = placement(editable.width, editable.height, width, height, totalAngle, zoom, pan);
    const px = (event.clientX - bounds.left) / bounds.width * width - width / 2 - transform.dx;
    const py = (event.clientY - bounds.top) / bounds.height * height - height / 2 - transform.dy;
    const cos = Math.cos(transform.radians), sin = Math.sin(transform.radians);
    const ux = px * cos + py * sin;
    const uy = -px * sin + py * cos;
    const sourceX = editable.width / 2 + ux / (mirror ? -transform.scale : transform.scale);
    const sourceY = editable.height / 2 + uy / transform.scale;
    const context = editable.getContext("2d");
    if (!context) return;
    context.save();
    context.globalCompositeOperation = "destination-out";
    context.beginPath();
    context.arc(sourceX, sourceY, brushSize, 0, Math.PI * 2);
    context.fill();
    context.restore();
    setMaskRevision(v => v + 1);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || saving || aiBusy || !source) return;
    event.preventDefault();
    const el = event.target as HTMLElement;
    const requested = el.closest<HTMLElement>("[data-crop-handle]")?.dataset.cropHandle as CropHandle | undefined;
    const handle = requested && cropHandles.includes(requested) && tool === "crop" ? requested : undefined;
    const erase = tool === "background" && eraserEnabled && !!workingCutout.current;
    gesture.current = {
      id: event.pointerId, x: event.clientX, y: event.clientY,
      px: pan.x, py: pan.y, mode: erase ? "erase" : handle ? "crop" : "pan",
      handle, startCrop: crop,
    };
    if (erase) eraseAt(event);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    if (start.mode === "erase") { eraseAt(event); return; }
    const dx = (event.clientX - start.x) / bounds.width;
    const dy = (event.clientY - start.y) / bounds.height;
    if (start.mode === "crop" && start.handle) {
      const current = start.startCrop;
      const minSize = 0.12;
      let left = current.x, right = current.x + current.w;
      let top = current.y, bottom = current.y + current.h;
      if (start.handle.includes("w")) left = clamp(current.x + dx, 0, right - minSize);
      if (start.handle.includes("e")) right = clamp(current.x + current.w + dx, left + minSize, 1);
      if (start.handle.includes("n")) top = clamp(current.y + dy, 0, bottom - minSize);
      if (start.handle.includes("s")) bottom = clamp(current.y + current.h + dy, top + minSize, 1);
      setCrop({ x: left, y: top, w: right - left, h: bottom - top });
      return;
    }
    setPan({ x: start.px + dx, y: start.py + dy });
  }
  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (gesture.current?.id !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function apply() {
    if (!source || saving || aiBusy) return;
    setSaving(true);
    setError("");
    try {
      const full = document.createElement("canvas");
      full.width = ratio === "3:4" || ratio === "9:16" ? 1050 : 1440;
      full.height = Math.round(full.width / aspectRatios[ratio]);
      // Export EXACTLY what the draggable crop handles enclose. "Before"
      // remains preview-only; edits never change the original Album file.
      drawPhoto(full, source, refinedCutout, background, customColor,
        totalAngle, zoom, pan, mirror, false);
      const output = document.createElement("canvas");
      output.width = Math.max(64, Math.round(full.width * crop.w));
      output.height = Math.max(64, Math.round(full.height * crop.h));
      const outputCtx = output.getContext("2d");
      if (!outputCtx) throw new Error("The browser cannot crop this image.");
      outputCtx.drawImage(
        full, full.width * crop.x, full.height * crop.y,
        full.width * crop.w, full.height * crop.h,
        0, 0, output.width, output.height,
      );
      const blob = await new Promise<Blob>((resolve, reject) => {
        try {
          output.toBlob(value => value ? resolve(value) :
            reject(new Error("Unable to export this photo.")), "image/webp", .92);
        } catch {
          reject(new Error("Image export is blocked. Try re-uploading the photo to Album."));
        }
      });
      const basename = (image.alt || "brutti-photo").replace(/\.[^.]+$/, "")
        .replace(/[^a-z0-9-]+/gi, "-").slice(0, 65) || "brutti-photo";
      await onApply(new File([blob], basename + "-edited.webp", { type: "image/webp" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the edited image.");
    } finally {
      setSaving(false);
    }
  }

  const locked = saving || aiBusy;
  return (
    <Modal title="Photo Studio" eyebrow="BRUTTI CATALOG / PHOTO EDITOR"
      className="catalog-photo-crop-dialog catalog-photo-crop-dialog--dark brutti-photo-studio-v2"
      onClose={() => { if (!saving) { cancelAI(); onClose(); } }}>
      <div className="brutti-photo-crop-fullscreen">
        <header className="brutti-photo-crop-topbar">
          <div className="brutti-photo-studio-brand">
            <span className="brutti-photo-studio-symbol"><ImageIcon size={18} aria-hidden="true" /></span>
            <div>
              <strong>Photo Studio</strong>
              <small title={image.alt}>{image.alt || "Product photography"}</small>
            </div>
          </div>
          <button type="button" className="brutti-photo-crop-reset" onClick={reset} disabled={saving}>
            <RotateCcw size={17} aria-hidden="true" /> Reset
          </button>
          <button type="button" className="brutti-photo-studio-close" onClick={() => { cancelAI(); onClose(); }}
            disabled={saving} aria-label="Close photo editor"><X size={20}/></button>
        </header>

        <div className="brutti-photo-studio-tabs" role="tablist" aria-label="Editing tools">
          <button type="button" role="tab" aria-selected={tool === "crop"} aria-controls="brutti-editor-control-panel"
            className={tool === "crop" ? "is-active" : ""} onClick={() => setTool("crop")}>
            <Crop size={17} aria-hidden="true" /> Crop & rotate
          </button>
          <button type="button" role="tab" aria-selected={tool === "background"} aria-controls="brutti-editor-control-panel"
            className={tool === "background" ? "is-active" : ""} onClick={() => setTool("background")}>
            <Palette size={17} aria-hidden="true"/> Background
            {hasCutout && <CheckCircle2 size={14} className="brutti-photo-studio-ready" aria-label="Background removed"/>}
          </button>
          <span>Changes are previewed live</span>
        </div>

        <div className="brutti-photo-studio-layout">
          <div className="brutti-photo-studio-preview">
            <div className="brutti-photo-studio-stage"
              aria-label="Photo canvas; drag the product to reposition">
              <div className={`brutti-photo-crop-image-frame${hasCutout && background === "transparent" && !previewOriginal ? " is-transparent" : ""}${eraserEnabled && tool === "background" ? " is-erasing" : ""}`}
                style={{ aspectRatio: aspectRatios[ratio] }}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove}
                onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
                <canvas ref={canvasRef} width={width} height={height}
                  style={{ aspectRatio: aspectRatios[ratio] }}
                  aria-label="Live crop and background preview" />
                {tool === "crop" && (
                  <div className="brutti-photo-crop-selection"
                    style={{
                      left: `${crop.x * 100}%`, top: `${crop.y * 100}%`,
                      width: `${crop.w * 100}%`, height: `${crop.h * 100}%`,
                    }} aria-label="Resize the crop by dragging corners or edges">
                    <span className="brutti-photo-crop-grid-guide" aria-hidden="true"/>
                    {cropHandles.map(handle => (
                      <span key={handle}
                        className={`brutti-photo-crop-handle handle-${handle}`}
                        data-crop-handle={handle}
                        aria-hidden="true"/>
                    ))}
                  </div>
                )}
                {!source && <span className="brutti-photo-crop-loading">{error || "Loading photo…"}</span>}
              </div>
            </div>
            <div className="brutti-photo-studio-preview-caption">
              <Scan size={14} aria-hidden="true"/> Drag to reposition · Your original stays unchanged
              {hasCutout && <button type="button" onClick={() => setPreviewOriginal(v => !v)}
                disabled={locked} aria-pressed={previewOriginal}>
                {previewOriginal ? "Show edited" : "Before / After"}
              </button>}
            </div>
          </div>

          <aside className="brutti-photo-studio-sidebar" id="brutti-editor-control-panel">
            {tool === "crop" ? (
              <div className="brutti-photo-studio-controls" role="tabpanel" aria-label="Crop and rotate controls">
                <div className="brutti-photo-studio-panel-title">
                  <span><Crop size={17}/> Crop & rotate</span>
                  <small>Frame your product precisely</small>
                </div>
                <div className="brutti-photo-studio-control-group">
                  <label>Aspect ratio</label>
                  <div className="brutti-photo-studio-ratios">
                    {(["4:3", "1:1", "3:4", "9:16"] as Ratio[]).map(item => (
                      <button type="button" key={item} className={ratio === item ? "is-active" : ""}
                        aria-pressed={ratio === item} disabled={locked}
                        onClick={() => { setRatio(item); setCrop(initialCrop()); setPan({ x: 0, y: 0 }); }}>{item}</button>
                    ))}
                  </div>
                </div>
                <div className="brutti-photo-studio-control-group">
                  <label>Orientation</label>
                  <div className="brutti-photo-studio-transform">
                    <button type="button" onClick={() => setQuarterTurn(v => v - 90)} disabled={locked}>
                      <RotateCcw size={17}/> Rotate left
                    </button>
                    <button type="button" onClick={() => setQuarterTurn(v => v + 90)} disabled={locked}>
                      <RotateCw size={17}/> Rotate right
                    </button>
                    <button type="button" className={mirror ? "is-active" : ""}
                      aria-pressed={mirror} onClick={() => setMirror(v => !v)} disabled={locked}>
                      <FlipHorizontal2 size={17}/> Flip
                    </button>
                  </div>
                </div>
                <div className="brutti-photo-studio-control-group">
                  <label htmlFor="brutti-straighten"><SlidersHorizontal size={15}/> Straighten <output>{tilt > 0 ? "+" : ""}{tilt}°</output></label>
                  <input id="brutti-straighten" type="range" min="-30" max="30" step="1"
                    value={tilt} disabled={locked} onChange={event => setTilt(Number(event.target.value))}/>
                  <div className="brutti-photo-crop-ticks" aria-hidden="true"><span>−30°</span><span>0°</span><span>30°</span></div>
                </div>
                <div className="brutti-photo-studio-control-group">
                  <label htmlFor="brutti-zoom">Zoom <output>{Math.round(zoom * 100)}%</output></label>
                  <input id="brutti-zoom" type="range" min="1" max="3" step=".05"
                    value={zoom} disabled={locked} onChange={event => setZoom(Number(event.target.value))}/>
                </div>
                <p className="brutti-photo-studio-tip">Tip: use Background to remove the original backdrop and choose a studio colour.</p>
              </div>
            ) : (
              <div className="brutti-photo-studio-controls" role="tabpanel" aria-label="Background controls">
                <div className="brutti-photo-studio-panel-title">
                  <span><Palette size={17}/> Background</span>
                  <small>Give product photos a consistent look</small>
                </div>
                <div className="brutti-photo-studio-background-intro">
                  <span className="brutti-photo-studio-wand"><Sparkles size={19}/></span>
                  <div><strong>Remove background with AI</strong>
                    <small>Runs on your device. No paid credits or external photo upload.</small></div>
                </div>
                <button type="button" className="brutti-photo-studio-ai-button"
                  disabled={!source || locked} onClick={() => void removeBackground()}>
                  {aiBusy ? <LoaderCircle size={17} className="spin"/> : <Sparkles size={17}/>}
                  {aiBusy ? "Removing background…" : hasCutout ? "Remove again" : "Remove background"}
                </button>
                {aiBusy && <button type="button" className="brutti-photo-studio-cancel-ai"
                  onClick={cancelAI}>Cancel processing</button>}
                {(aiBusy || (hasCutout && aiPercent === 100)) && (
                  <div className="brutti-photo-studio-progress" aria-label="AI progress estimate">
                    <div className="brutti-photo-studio-progress-head">
                      <strong>{aiBusy ? "Processing AI cutout" : "Cutout completed"}</strong>
                      <output>{aiPercent}%</output>
                    </div>
                    <progress max={100} value={aiPercent} aria-label="AI processing estimated percent"/>
                    <small>{aiBusy
                      ? "Estimated by processing stage; inference speed depends on your device."
                      : "You can now refine edges, erase leftovers or choose a background colour."}</small>
                  </div>
                )}
                {aiProgress && <p role="status" className="brutti-photo-studio-ai-status">{aiProgress}</p>}
                <div className="brutti-photo-studio-control-group">
                  <label>Background colour</label>
                  <p className="brutti-photo-studio-muted">
                    {hasCutout ? "Choose a colour or keep the background transparent." :
                      "Remove the background first to change its colour."}
                  </p>
                  <div className="brutti-photo-studio-swatches">
                    {backdropOptions.map(item => (
                      <button type="button" key={item.id} title={item.label} aria-label={item.label}
                        aria-pressed={hasCutout && background === item.id}
                        disabled={!hasCutout || locked}
                        className={`brutti-photo-studio-swatch${hasCutout && background === item.id ? " is-active" : ""}${item.id === "transparent" ? " is-clear" : ""}`}
                        style={item.color ? { backgroundColor: item.color } : undefined}
                        onClick={() => { setBackground(item.id); setPreviewOriginal(false); }}>
                        {hasCutout && background === item.id && <Check size={18}/>}
                      </button>
                    ))}
                    <label className={`brutti-photo-studio-custom-color${!hasCutout ? " is-disabled" : ""}`}
                      title="Custom background colour">
                      <input type="color" value={customColor} disabled={!hasCutout || locked}
                        aria-label="Choose custom background colour"
                        onChange={event => {
                          setCustomColor(event.target.value);
                          setBackground("custom");
                          setPreviewOriginal(false);
                        }}/>
                      <span>Custom</span>
                    </label>
                  </div>
                </div>
                {hasCutout && (
                  <div className="brutti-photo-studio-control-group">
                    <label htmlFor="brutti-edge-cleanup">Edge cleanup <output>{edgeStrength}%</output></label>
                    <input id="brutti-edge-cleanup" type="range" min="0" max="100" step="1"
                      disabled={locked} value={edgeStrength}
                      onChange={event => setEdgeStrength(Number(event.target.value))}/>
                    <p className="brutti-photo-studio-muted">
                      Increase to clear pale leftover backgrounds. Reduce it if thin furniture edges disappear.
                    </p>
                  </div>
                )}
                {hasCutout && (
                  <div className="brutti-photo-studio-control-group">
                    <label>Manual cleanup</label>
                    <button type="button" className={`brutti-photo-studio-original${eraserEnabled ? " is-active" : ""}`}
                      disabled={locked} aria-pressed={eraserEnabled}
                      onClick={() => { setEraserEnabled(v => !v); setPreviewOriginal(false); }}>
                      <Crop size={15}/> {eraserEnabled ? "Finish erasing" : "Erase leftover background"}
                    </button>
                    {eraserEnabled && (
                      <>
                        <label htmlFor="brutti-brush-size">Brush size <output>{brushSize}px</output></label>
                        <input id="brutti-brush-size" type="range" min="6" max="110" step="2"
                          value={brushSize} disabled={locked}
                          onChange={event => setBrushSize(Number(event.target.value))}/>
                        <p className="brutti-photo-studio-muted">Brush over leftover background on the image. Only the editable cutout is changed.</p>
                        <button type="button" className="brutti-photo-studio-original"
                          onClick={() => {
                            if (!cutout) return;
                            const copy = document.createElement("canvas");
                            copy.width = cutout.width; copy.height = cutout.height;
                            copy.getContext("2d")?.drawImage(cutout, 0, 0);
                            workingCutout.current = copy;
                            setMaskRevision(v => v + 1);
                          }}>Restore AI mask</button>
                      </>
                    )}
                  </div>
                )}
                <div className="brutti-photo-studio-control-group">
                  <button type="button" className="brutti-photo-studio-original"
                    disabled={!hasCutout || locked}
                    onClick={() => {
                      setBackground("original"); setCutout(null);
                      workingCutout.current = null; setMaskRevision(v => v + 1);
                      setEraserEnabled(false); setPreviewOriginal(false); setAiProgress(""); setAiPercent(0);
                    }}>
                    <RotateCcw size={15}/> Restore original background
                  </button>
                </div>
                <p className="brutti-photo-studio-tip">
                  AI may miss small gaps or complex edges. Inspect the result at full size before saving.
                </p>
              </div>
            )}
            {error && <p role="alert" className="brutti-photo-crop-error">{error}</p>}
          </aside>
        </div>
        <footer className="brutti-photo-studio-footer">
          <div><strong>Brutti Photo Studio</strong><span>Edited photo is saved separately · Original retained in Album</span></div>
          <div className="brutti-photo-studio-footer-actions">
            <button type="button" className="brutti-photo-studio-cancel" disabled={saving}
              onClick={() => { cancelAI(); onClose(); }}>Cancel</button>
            <button type="button" className="brutti-photo-studio-save"
              onClick={() => void apply()} disabled={!source || locked}>
              {saving ? <LoaderCircle size={17} className="spin"/> : <Check size={17}/>}
              {saving ? "Saving…" : "Apply edits"}
            </button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}
