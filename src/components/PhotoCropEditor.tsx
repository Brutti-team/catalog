import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Check, FlipHorizontal2, LoaderCircle, RotateCcw, RotateCw, Scan, SlidersHorizontal, X } from "lucide-react";
import type { ProductImage } from "../lib/types";
import Modal from "./Modal";
import { publicAssetUrl } from "../lib/assets";

type Props = {
  image: ProductImage;
  onApply: (file: File) => Promise<void>;
  onClose: () => void;
};

type Ratio = "4:3" | "1:1" | "3:4";
const aspectRatios: Record<Ratio, number> = { "4:3": 4 / 3, "1:1": 1, "3:4": 3 / 4 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function imagePlacement(
  source: HTMLImageElement, width: number, height: number,
  angle: number, zoom: number, pan: {x:number;y:number},
) {
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const absCos = Math.abs(cos), absSin = Math.abs(sin);
  // Minimum scale that covers ALL four crop corners, including after rotation.
  const base = Math.max(
    (width * absCos + height * absSin) / source.naturalWidth,
    (width * absSin + height * absCos) / source.naturalHeight,
  );
  const scale = base * zoom;
  const localLimitX = Math.max(0, (source.naturalWidth * scale - width * absCos - height * absSin) / 2);
  const localLimitY = Math.max(0, (source.naturalHeight * scale - width * absSin - height * absCos) / 2);
  const proposedX = pan.x * width, proposedY = pan.y * height;
  const localX = clamp(proposedX * cos + proposedY * sin, -localLimitX, localLimitX);
  const localY = clamp(-proposedX * sin + proposedY * cos, -localLimitY, localLimitY);
  return {
    scale,
    dx: localX * cos - localY * sin,
    dy: localX * sin + localY * cos,
    radians,
  };
}

function drawImage(
  canvas: HTMLCanvasElement, source: HTMLImageElement, angle: number,
  zoom: number, pan: {x:number;y:number}, mirror: boolean,
) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not open the image editor.");
  const { width, height } = canvas;
  const placement = imagePlacement(source, width, height, angle, zoom, pan);
  context.clearRect(0, 0, width, height);
  context.save();
  context.translate(width / 2 + placement.dx, height / 2 + placement.dy);
  context.rotate(placement.radians);
  context.scale(mirror ? -placement.scale : placement.scale, placement.scale);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, -source.naturalWidth / 2, -source.naturalHeight / 2);
  context.restore();
}

export default function PhotoCropEditor({ image, onApply, onClose }: Props) {
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [ratio, setRatio] = useState<Ratio>("4:3");
  const [quarterTurn, setQuarterTurn] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [mirror, setMirror] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gesture = useRef<{pointerId:number; x:number; y:number; px:number; py:number} | null>(null);
  const totalAngle = quarterTurn + tilt;
  const width = 900, height = Math.round(width / aspectRatios[ratio]);

  useEffect(() => {
    let active = true;
    const next = new Image();
    // Cross-origin images must grant canvas access for an actual edited file.
    next.crossOrigin = "anonymous";
    next.onload = () => { if (active) setSource(next); };
    next.onerror = () => { if (active) setError("Could not open this photo for editing. Download and upload the original photo to Brutti Catalog, then try again."); };
    next.src = publicAssetUrl(image.url);
    return () => { active = false; next.onload = null; next.onerror = null; };
  }, [image.url]);

  useEffect(() => {
    if (!source || !canvasRef.current) return;
    try {
      const canvas = canvasRef.current;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      drawImage(canvas, source, totalAngle, zoom, pan, mirror);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to display this photo.");
    }
  }, [source, width, height, totalAngle, zoom, pan, mirror]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || saving || !source) return;
    event.preventDefault();
    gesture.current = {pointerId:event.pointerId,x:event.clientX,y:event.clientY,px:pan.x,py:pan.y};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    setPan({x:start.px+(event.clientX-start.x)/bounds.width,
      y:start.py+(event.clientY-start.y)/bounds.height});
  }
  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  async function apply() {
    if (!source || saving) return;
    setSaving(true);
    setError("");
    try {
      const output = document.createElement("canvas");
      output.width = ratio === "3:4" ? 1050 : 1440;
      output.height = Math.round(output.width / aspectRatios[ratio]);
      drawImage(output, source, totalAngle, zoom, pan, mirror);
      const blob = await new Promise<Blob>((resolve, reject) => {
        try {
          output.toBlob(value => value ? resolve(value) : reject(new Error("Unable to export this photo. The image source may block editing; try downloading and uploading it first.")), "image/webp", .92);
        } catch {
          reject(new Error("This external photo does not allow canvas editing. Download it, upload it to Album, and try again."));
        }
      });
      const basename = (image.alt || "brutti-photo").replace(/\.[^.]+$/, "").replace(/[^a-z0-9-]+/gi,"-").slice(0,65) || "brutti-photo";
      await onApply(new File([blob], basename + "-edited.webp", {type:"image/webp"}));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the edited image.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Crop and rotate photo" eyebrow="BRUTTI / PHOTO EDITOR"
      className="catalog-photo-crop-dialog catalog-photo-crop-dialog--dark"
      onClose={() => { if (!saving) onClose(); }}>
      <div className="brutti-photo-crop-fullscreen">
        <div className="brutti-photo-crop-topbar">
          <button type="button" onClick={onClose} disabled={saving} aria-label="Cancel photo editing"><X size={23}/></button>
          <span><Scan size={16} aria-hidden="true"/> Crop & rotate <small>{image.alt || "Product photo"}</small></span>
          <button type="button" className="brutti-photo-crop-reset" onClick={() => {
            setPan({x:0,y:0});setZoom(1);setTilt(0);setQuarterTurn(0);setMirror(false);setRatio("4:3");
          }} disabled={saving}><RotateCcw size={17} aria-hidden="true"/> Reset</button>
        </div>

        <div className="brutti-photo-crop-workarea">
          <div className="brutti-photo-crop-stage" onPointerDown={onPointerDown}
            onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            aria-label="Drag photo to reposition inside the crop frame">
            <div className="brutti-photo-crop-image-frame" style={{aspectRatio:aspectRatios[ratio]}}>
              <canvas ref={canvasRef} width={width} height={height}
                style={{aspectRatio:aspectRatios[ratio]}} aria-label="Live crop and rotation preview"/>
              <span className="brutti-photo-crop-grid-guide" aria-hidden="true" />
              <span className="brutti-photo-crop-corner tl" aria-hidden="true" />
              <span className="brutti-photo-crop-corner tr" aria-hidden="true" />
              <span className="brutti-photo-crop-corner bl" aria-hidden="true" />
              <span className="brutti-photo-crop-corner br" aria-hidden="true" />
              {!source && <span className="brutti-photo-crop-loading">{error || "Loading photo…"}</span>}
            </div>
          </div>
          <p className="brutti-photo-crop-instructions">Drag to reposition · Rotate and zoom to frame your product</p>
        </div>

        <div className="brutti-photo-crop-panel">
          <div className="brutti-photo-crop-tools" role="group" aria-label="Photo crop tools">
            <button type="button" title="Rotate 90° counterclockwise" aria-label="Rotate 90 degrees counterclockwise"
              onClick={() => setQuarterTurn(v=>v-90)} disabled={saving}><RotateCcw size={19}/></button>
            <button type="button" title="Rotate 90° clockwise" aria-label="Rotate 90 degrees clockwise"
              onClick={() => setQuarterTurn(v=>v+90)} disabled={saving}><RotateCw size={19}/></button>
            <button type="button" title="Flip horizontally" aria-label="Flip horizontally"
              aria-pressed={mirror} className={mirror?"is-active":""} onClick={()=>setMirror(v=>!v)} disabled={saving}><FlipHorizontal2 size={19}/></button>
            <span className="brutti-photo-crop-tool-divider" />
            {(["4:3","1:1","3:4"] as Ratio[]).map(item=>(
              <button key={item} type="button" className={ratio===item?"is-active":""}
                aria-pressed={ratio===item} onClick={()=>setRatio(item)} disabled={saving}>{item}</button>
            ))}
          </div>
          <div className="brutti-photo-crop-angle">
            <div className="brutti-photo-crop-angle-label"><SlidersHorizontal size={15} aria-hidden="true"/> Straighten
              <output>{tilt>0?"+":""}{tilt}°</output></div>
            <input aria-label="Straighten angle" type="range" min="-30" max="30" step="1"
              value={tilt} onChange={event=>setTilt(Number(event.target.value))} disabled={saving}/>
            <div className="brutti-photo-crop-ticks" aria-hidden="true"><span>−30°</span><span>−15°</span><span>0°</span><span>15°</span><span>30°</span></div>
          </div>
          <div className="brutti-photo-crop-zoom">
            <label htmlFor="brutti-photo-editor-zoom">Zoom <output>{Math.round(zoom*100)}%</output></label>
            <input type="range" id="brutti-photo-editor-zoom" min="1" max="3" step=".05"
              value={zoom} onChange={event=>setZoom(Number(event.target.value))} disabled={saving}/>
          </div>
          {error && <p className="brutti-photo-crop-error" role="alert">{error}</p>}
          <div className="brutti-photo-crop-actions">
            <button type="button" className="brutti-photo-crop-cancel" disabled={saving} onClick={onClose} aria-label="Cancel editing"><X size={23}/></button>
            <span>Edits are saved with your product. Original photo is preserved.</span>
            <button type="button" className="brutti-photo-crop-apply" onClick={()=>void apply()} disabled={saving || !source}
              aria-label="Apply photo edits">{saving?<LoaderCircle size={23} className="spin"/>:<Check size={27}/>}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
