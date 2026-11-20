import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Check, Crop, Image as ImageIcon, LoaderCircle, Minus, Move, Plus, RotateCcw, Scissors } from "lucide-react";
import Modal from "./Modal";
import { publicAssetUrl } from "../lib/assets";
import {
  coverBackgrounds, drawCover, flatBackgroundCutout, loadCoverSource,
  type CoverBackground, type CoverSettings, type CoverSource,
} from "../lib/cover-studio-canvas";
import "./photo-cover-studio.css";

type Props = {
  imageUrl: string;
  imageName: string;
  saveLabel?: string;
  onSave: (file: File) => Promise<void>;
  onClose: () => void;
};
const backgrounds: { id: CoverBackground; title: string }[] = [
  { id: "transparent", title: "Transparent" },
  { id: "white", title: "White" },
  { id: "cream", title: "Warm cream" },
  { id: "sage", title: "Soft sage" },
  { id: "forest", title: "Brutti green" },
];
const initial: CoverSettings = {
  background: "cream", custom: "#e6eee6",
  cutout: false, tolerance: 44, fit: "contain", aspect: "4:3",
  zoom: 1, x: 0, y: 0,
};
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

export default function PhotoCoverStudio({
  imageUrl, imageName, saveLabel = "Save edited cover", onSave, onClose,
}: Props) {
  const [source, setSource] = useState<CoverSource | null>(null);
  const [mask, setMask] = useState<HTMLCanvasElement | null>(null);
  const [settings, setSettings] = useState<CoverSettings>({ ...initial });
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef<{ id: number; x: number; y: number; startX: number; startY: number } | null>(null);
  const patch = (next: Partial<CoverSettings>) => setSettings(old => ({ ...old, ...next }));

  useEffect(() => {
    let mounted = true;
    setError("");
    void loadCoverSource(publicAssetUrl(imageUrl))
      .then(result => { if (mounted) setSource(result); })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : "Could not open this image."); });
    return () => { mounted = false; };
  }, [imageUrl]);

  useEffect(() => {
    if (!source || !settings.cutout) { setMask(null); setProcessing(false); return; }
    let active = true;
    setProcessing(true);
    setMask(null);
    const timer = window.setTimeout(() => {
      try {
        const result = flatBackgroundCutout(source, settings.tolerance);
        if (active) { setMask(result); setProcessing(false); }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Cutout failed.");
          setProcessing(false);
          patch({ cutout: false });
        }
      }
    }, 90);
    return () => { active = false; clearTimeout(timer); };
  }, [source, settings.cutout, settings.tolerance]);

  const renderCover = useCallback(() => {
    if (!canvasRef.current || !source) return;
    drawCover(canvasRef.current, source, mask, settings);
  }, [source, mask, settings]);
  useEffect(() => { renderCover(); }, [renderCover]);

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !source) return;
    dragging.current = {
      id: event.pointerId, x: event.clientX, y: event.clientY,
      startX: settings.x, startY: settings.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const item = dragging.current;
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!item || item.id !== event.pointerId || !bounds) return;
    patch({
      x: clamp(item.startX + (event.clientX - item.x) / bounds.width * 100, -90, 90),
      y: clamp(item.startY + (event.clientY - item.y) / bounds.height * 100, -90, 90),
    });
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || dragging.current.id !== event.pointerId) return;
    dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const save = async () => {
    if (saving || !source || (settings.cutout && (!mask || processing))) return;
    setSaving(true); setError("");
    try {
      renderCover();
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Photo canvas is unavailable.");
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(value => value ? resolve(value) : reject(new Error("Image export failed.")), "image/webp", .92);
      });
      const baseName = imageName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-]+/gi, "-").slice(0, 80) || "brutti";
      const file = new File([blob], baseName + "-cover.webp", { type: "image/webp" });
      await onSave(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save edited image.");
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Cover Studio" eyebrow="BRUTTI CATALOG / PRODUCT PHOTOS"
      description="Cut out backgrounds, choose a cover colour and frame your furniture. The original photo stays unchanged."
      className="brutti-cover-studio" onClose={() => { if (!saving) onClose(); }}>
      <div className="brutti-cover-studio-layout">
        <div className="brutti-cover-studio-visual">
          <div
            ref={stageRef}
            className={"brutti-cover-studio-stage" + (settings.background === "transparent" ? " is-transparent" : "") + (settings.aspect === "1:1" ? " is-square" : "")}
            onPointerDown={pointerDown} onPointerMove={pointerMove}
            onPointerUp={pointerUp} onPointerCancel={pointerUp}
            aria-label="Drag photo to position the furniture">
            <canvas ref={canvasRef} width={960} height={720}
              style={{ aspectRatio: settings.aspect === "1:1" ? "1 / 1" : "4 / 3" }} />
            {!source && <p className="brutti-cover-studio-loading" role="status">{error || "Loading photo…"}</p>}
            {processing && <span className="brutti-cover-studio-working"><LoaderCircle size={16}/> Removing background…</span>}
          </div>
          <p className="brutti-cover-studio-drag-hint"><Move size={15}/> Drag to reposition · Preview updates live</p>
          <p className="brutti-cover-studio-help">
            Cutout works best on plain backgrounds, including black studio backgrounds.
            Adjust the tolerance carefully around timber edges.
          </p>
        </div>
        <div className="brutti-cover-studio-tools">
          <section>
            <h3><Scissors size={16}/> Cutout</h3>
            <button type="button" className={"brutti-cover-studio-toggle" + (settings.cutout ? " is-active" : "")}
              disabled={!source || saving} aria-pressed={settings.cutout}
              onClick={() => patch({ cutout: !settings.cutout })}>
              {settings.cutout ? <Check size={16}/> : <Scissors size={16}/>}
              {settings.cutout ? "Cutout enabled" : "Remove solid background"}
            </button>
            {settings.cutout && <label className="brutti-cover-studio-range">
              Background tolerance <strong>{settings.tolerance}</strong>
              <input type="range" min="12" max="115" step="3" value={settings.tolerance} disabled={saving}
                onChange={event => patch({ tolerance: Number(event.target.value) })}/>
              <small>Increase to remove more background; decrease to protect details.</small>
            </label>}
          </section>
          <section>
            <h3><ImageIcon size={16}/> Background</h3>
            <div className="brutti-cover-studio-swatches">
              {backgrounds.map(item => (
                <button type="button" key={item.id} title={item.title} aria-label={item.title}
                  aria-pressed={settings.background === item.id}
                  className={"brutti-cover-studio-swatch" + (settings.background === item.id ? " is-active" : "")}
                  disabled={saving} onClick={() => patch({ background: item.id })}
                  style={item.id === "transparent" ? undefined : { backgroundColor: coverBackgrounds[item.id] }}>
                  {settings.background === item.id && <Check size={16}/>}
                </button>
              ))}
              <label className="brutti-cover-studio-custom">
                <input type="color" value={settings.custom} disabled={saving}
                  aria-label="Choose a custom background colour"
                  onChange={event => patch({ background: "custom", custom: event.target.value })} />
                <span>Custom</span>
              </label>
            </div>
          </section>
          <section>
            <h3><Crop size={16}/> Crop & size</h3>
            <div className="brutti-cover-studio-segment">
              <button type="button" className={settings.fit === "contain" ? "is-active" : ""} onClick={() => patch({ fit: "contain" })}>Full product</button>
              <button type="button" className={settings.fit === "cover" ? "is-active" : ""} onClick={() => patch({ fit: "cover" })}>Fill & crop</button>
            </div>
            <div className="brutti-cover-studio-segment">
              <button type="button" className={settings.aspect === "4:3" ? "is-active" : ""} onClick={() => patch({ aspect: "4:3" })}>4:3 cover</button>
              <button type="button" className={settings.aspect === "1:1" ? "is-active" : ""} onClick={() => patch({ aspect: "1:1" })}>Square</button>
            </div>
            <label className="brutti-cover-studio-range">
              Image size <strong>{Math.round(settings.zoom * 100)}%</strong>
              <span className="brutti-cover-studio-zoom">
                <button type="button" aria-label="Zoom out" onClick={() => patch({ zoom: clamp(settings.zoom - .1, .5, 3) })}><Minus size={15}/></button>
                <input type="range" min=".5" max="3" step=".05" value={settings.zoom}
                  onChange={event => patch({ zoom: Number(event.target.value) })}/>
                <button type="button" aria-label="Zoom in" onClick={() => patch({ zoom: clamp(settings.zoom + .1, .5, 3) })}><Plus size={15}/></button>
              </span>
            </label>
          </section>
          {error && <p className="brutti-cover-studio-error" role="alert">{error}</p>}
        </div>
      </div>
      <div className="brutti-cover-studio-footer">
        <button type="button" className="brutti-cover-studio-reset" onClick={() => { setSettings({ ...initial }); setError(""); }}
          disabled={saving}><RotateCcw size={16}/> Reset</button>
        <span>Saved as a new image · Original retained</span>
        <button type="button" className="brutti-cover-studio-cancel" disabled={saving} onClick={onClose}>Cancel</button>
        <button type="button" className="brutti-cover-studio-save" onClick={() => void save()}
          disabled={!source || saving || (settings.cutout && (!mask || processing))}>
          {saving ? <LoaderCircle size={16}/> : <Check size={16}/>}
          {saving ? "Saving…" : saveLabel}
        </button>
      </div>
    </Modal>
  );
}
