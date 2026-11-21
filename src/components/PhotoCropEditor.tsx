import { useEffect, useRef, useState, type PointerEvent } from "react";
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
  const graphic = showCutout ? cutout : original;
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
  const [cutout, setCutout] = useState<HTMLCanvasElement | null>(null);
  const [background, setBackground] = useState<Backdrop>("original");
  const [customColor, setCustomColor] = useState("#e5dfd3");
  const [previewOriginal, setPreviewOriginal] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const aiRun = useRef(0);
  const gesture = useRef<{ id: number; x: number; y: number; px: number; py: number } | null>(null);
  const totalAngle = quarterTurn + tilt;
  const width = 900, height = Math.round(width / aspectRatios[ratio]);
  const hasCutout = !!cutout;

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
      drawPhoto(canvas, source, cutout, background, customColor,
        totalAngle, zoom, pan, mirror, previewOriginal);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to preview this photo.");
    }
  }, [source, cutout, background, customColor, totalAngle, zoom, pan, mirror, previewOriginal, width, height]);

  function cancelAI() {
    aiRun.current++;
    stopAICutout();
    setAiBusy(false);
    setAiProgress("");
  }

  function reset() {
    if (aiBusy) cancelAI();
    setPan({ x: 0, y: 0 }); setZoom(1); setTilt(0); setQuarterTurn(0);
    setMirror(false); setCutout(null); setBackground("original");
    setCustomColor("#e5dfd3"); setPreviewOriginal(false);
    setRatio(source && source.naturalHeight > source.naturalWidth ? "3:4" : "4:3");
    setError("");
  }

  async function removeBackground() {
    if (!source || aiBusy || saving) return;
    const run = ++aiRun.current;
    setAiBusy(true);
    setAiProgress("Preparing local AI model…");
    setError("");
    try {
      // Keep inference within the worker's existing 1100-pixel limit.
      const factor = Math.min(1, 1100 / Math.max(source.naturalWidth, source.naturalHeight));
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
      const result = await aiFurnitureCutout(localSource, message => {
        if (run === aiRun.current) setAiProgress(message);
      });
      if (run !== aiRun.current) return;
      setCutout(result);
      setBackground("cream");
      setPreviewOriginal(false);
      setAiProgress("Background removed. Review the edges before saving.");
    } catch (reason) {
      if (run !== aiRun.current) return;
      setAiProgress("");
      setError(reason instanceof Error ? reason.message : "Could not remove this background.");
    } finally {
      if (run === aiRun.current) setAiBusy(false);
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || saving || aiBusy || !source) return;
    event.preventDefault();
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, px: pan.x, py: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    setPan({
      x: start.px + (event.clientX - start.x) / bounds.width,
      y: start.py + (event.clientY - start.y) / bounds.height,
    });
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
      const output = document.createElement("canvas");
      output.width = ratio === "3:4" || ratio === "9:16" ? 1050 : 1440;
      output.height = Math.round(output.width / aspectRatios[ratio]);
      // Saving is always the selected edit, never the temporary "Before" preview.
      drawPhoto(output, source, cutout, background, customColor,
        totalAngle, zoom, pan, mirror, false);
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
              <div className={`brutti-photo-crop-image-frame${hasCutout && background === "transparent" && !previewOriginal ? " is-transparent" : ""}`}
                style={{ aspectRatio: aspectRatios[ratio] }}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove}
                onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
                <canvas ref={canvasRef} width={width} height={height}
                  style={{ aspectRatio: aspectRatios[ratio] }}
                  aria-label="Live crop and background preview" />
                <span className="brutti-photo-crop-grid-guide" aria-hidden="true" />
                <span className="brutti-photo-crop-corner tl" aria-hidden="true" />
                <span className="brutti-photo-crop-corner tr" aria-hidden="true" />
                <span className="brutti-photo-crop-corner bl" aria-hidden="true" />
                <span className="brutti-photo-crop-corner br" aria-hidden="true" />
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
                        onClick={() => setRatio(item)}>{item}</button>
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
                <div className="brutti-photo-studio-control-group">
                  <button type="button" className="brutti-photo-studio-original"
                    disabled={!hasCutout || locked}
                    onClick={() => {
                      setBackground("original"); setCutout(null);
                      setPreviewOriginal(false); setAiProgress("");
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
