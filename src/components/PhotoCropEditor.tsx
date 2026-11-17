import { useRef, useState, type PointerEvent } from "react";
import { ArrowLeftRight, Minus, Plus, RotateCcw, Scan, ZoomIn } from "lucide-react";
import type { ProductImage } from "../lib/types";
import Modal from "./Modal";
import SafeImage from "./SafeImage";
import {
  clampCrop, DEFAULT_PHOTO_CROP, normalisePhotoCrop, photoCropStyle, type PhotoCrop,
} from "../lib/photo-crop";

type Props = {
  image: ProductImage;
  onApply: (crop: PhotoCrop | undefined) => void;
  onClose: () => void;
};

export default function PhotoCropEditor({ image, onApply, onClose }: Props) {
  const [crop, setCrop] = useState<PhotoCrop>(() => normalisePhotoCrop(image.crop));
  const frameRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{
    pointerId: number; x: number; y: number; startX: number; startY: number;
  } | null>(null);

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !frameRef.current) return;
    event.preventDefault();
    draggingRef.current = {
      pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      startX: crop.x, startY: crop.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = draggingRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const bounds = frameRef.current?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return;
    // Dragging right shifts the photograph right, so its focal position moves left.
    // The same normalized coordinates survive different desktop/mobile image sizes.
    const factor = 100 / Math.max(1, crop.zoom);
    setCrop(current => ({
      ...current,
      x: clampCrop(start.startX - (event.clientX - start.x) / bounds.width * factor, 0, 100),
      y: clampCrop(start.startY - (event.clientY - start.y) / bounds.height * factor, 0, 100),
    }));
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    if (draggingRef.current?.pointerId !== event.pointerId) return;
    draggingRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function adjustZoom(change: number) {
    setCrop(prev => ({ ...prev, zoom: clampCrop(Math.round((prev.zoom + change) * 100) / 100, 1, 2.5) }));
  }

  return (
    <Modal
      title="Adjust photo"
      description="Drag to reposition and zoom to frame the product. The original photo stays unchanged."
      eyebrow="PHOTO COMPOSITION"
      className="catalog-photo-crop-dialog"
      onClose={onClose}
    >
      <div className="catalog-photo-crop-body">
        <div className="catalog-photo-crop-viewport-wrap">
          <div
            ref={frameRef}
            className="catalog-photo-crop-viewport"
            aria-label="Drag the photo to choose the visible area"
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
          >
            <SafeImage
              src={image.url}
              alt={image.alt || "Product photo to adjust"}
              draggable={false}
              style={photoCropStyle({ crop })} 
            />
            <span className="catalog-photo-crop-guide" aria-hidden="true" />
            <span className="catalog-photo-crop-hint"><ArrowLeftRight size={14} aria-hidden="true" /> Drag to reposition</span>
          </div>
          <p>Preview of the catalog image crop (4:3). Other screen sizes may frame it slightly differently.</p>
        </div>
        <div className="catalog-photo-crop-settings">
          <label htmlFor="catalog-photo-crop-zoom"><ZoomIn size={16} aria-hidden="true" /> Zoom</label>
          <div className="catalog-photo-crop-zoom">
            <button type="button" aria-label="Zoom out" onClick={() => adjustZoom(-.1)} disabled={crop.zoom <= 1}><Minus size={17} /></button>
            <input
              type="range"
              id="catalog-photo-crop-zoom"
              min="1"
              max="2.5"
              step="0.05"
              value={crop.zoom}
              onChange={event => setCrop(prev => ({ ...prev, zoom: Number(event.target.value) }))}
              aria-valuetext={`${Math.round(crop.zoom * 100)} percent zoom`}
            />
            <button type="button" aria-label="Zoom in" onClick={() => adjustZoom(.1)} disabled={crop.zoom >= 2.5}><Plus size={17} /></button>
            <output htmlFor="catalog-photo-crop-zoom">{Math.round(crop.zoom * 100)}%</output>
          </div>
          <p>These adjustments change how customers see the photo in the catalog. Your original upload is preserved.</p>
        </div>
        <div className="catalog-photo-crop-footer">
          <button type="button" className="catalog-photo-crop-reset" onClick={() => setCrop({ ...DEFAULT_PHOTO_CROP })}>
            <RotateCcw size={15} /> Centre
          </button>
          <button type="button" className="catalog-photo-crop-reset" onClick={() => onApply(undefined)}>
            Original fit
          </button>
          <span className="catalog-photo-crop-spacer" />
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="button primary" onClick={() => onApply(crop)}><Scan size={16} /> Apply crop</button>
        </div>
      </div>
    </Modal>
  );
}
