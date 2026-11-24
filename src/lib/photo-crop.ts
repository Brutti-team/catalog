import type { CSSProperties } from "react";
import type { ProductImage } from "./types";

/** Non-destructive composition metadata. Source photographs are never replaced. */
export type PhotoCrop = NonNullable<ProductImage["crop"]>;

export const DEFAULT_PHOTO_CROP: PhotoCrop = { x: 50, y: 50, zoom: 1 };

export function clampCrop(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : minimum;
}

export function normalisePhotoCrop(value: PhotoCrop | undefined): PhotoCrop {
  if (!value) return { ...DEFAULT_PHOTO_CROP };
  return {
    x: clampCrop(value.x, 0, 100),
    y: clampCrop(value.y, 0, 100),
    zoom: clampCrop(value.zoom, 1, 2.5),
  };
}

/** Opt-in: legacy product photos retain their existing fit if no crop is stored. */
export function photoCropStyle(image?: Pick<ProductImage, "crop">): CSSProperties | undefined {
  if (!image?.crop) return undefined;
  const { x, y, zoom } = normalisePhotoCrop(image.crop);
  return {
    objectFit: "cover",
    objectPosition: `${x}% ${y}%`,
    transformOrigin: `${x}% ${y}%`,
    transform: `scale(${zoom})`,
    mixBlendMode: "normal",
  };
}

/** Photo Studio exports a finished bitmap; never crop its edges again. */
export function isStudioEditedPhoto(image?: ProductImage): boolean {
  return Boolean(image?.preservedOriginalPaths?.length || (image?.url && /-edited(?:[.-]|%2e)/i.test(image.url)));
}
/** Reversible default for the known bordered legacy Pico source.
 * Explicit user crops always win. The original image remains unchanged. */
export function effectivePhotoCrop(image?: ProductImage): PhotoCrop | undefined {
  if (image?.crop) return normalisePhotoCrop(image.crop);
  if (image?.id === "53a4e2d4-0faa-4964-9529-839c20de1c56") return { x: 50, y: 58, zoom: 1.15 };
  return undefined;
}
export function publicPhotoCropStyle(image?: ProductImage): CSSProperties | undefined {
  const crop = effectivePhotoCrop(image);
  if (crop) return photoCropStyle({ crop });
  return isStudioEditedPhoto(image) && !image?.crop
    ? { objectFit: "contain", objectPosition: "center", transform: "none", mixBlendMode: "normal" }
    : photoCropStyle(image);
}

/** The gallery and customer tiles must use the same composition. Cover is
 * intentional for thumbnail frames; the detail viewer can show the full file. */
export function catalogCardPhotoStyle(image?: ProductImage, sku?: string): CSSProperties {
  return photoCropStyle({ crop: effectivePhotoCrop(image) }) ?? {
    objectFit: "cover",
    objectPosition: sku === "PNL-15" ? "center bottom" : "center 67%",
    transform: "none",
    mixBlendMode: "normal",
  };
}
