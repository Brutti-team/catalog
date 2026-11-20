/** Browser-only cover rendering: never writes or overwrites the source photograph. */
export type CoverBackground = "transparent" | "white" | "cream" | "sage" | "forest" | "custom";
export const coverBackgrounds: Record<CoverBackground, string> = {
  transparent: "transparent",
  white: "#ffffff",
  cream: "#f5f0e8",
  sage: "#e2ebe1",
  forest: "#28543d",
  custom: "#e7eee7",
};
export type CoverSource = { canvas: HTMLCanvasElement; width: number; height: number };
export type CoverSettings = {
  background: CoverBackground;
  custom: string;
  cutout: boolean;
  tolerance: number;
  fit: "contain" | "cover";
  aspect: "4:3" | "1:1";
  zoom: number;
  x: number;
  y: number;
};

export async function loadCoverSource(url: string): Promise<CoverSource> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not load image. Check the photo URL."));
    img.src = url;
  });
  if (!img.naturalWidth || !img.naturalHeight) throw new Error("This image is empty.");
  const factor = Math.min(1, 1100 / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * factor));
  const height = Math.max(1, Math.round(img.naturalHeight * factor));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Image editing is unsupported in this browser.");
  ctx.drawImage(img, 0, 0, width, height);
  try { ctx.getImageData(0, 0, 1, 1); }
  catch { throw new Error("This image host blocks browser editing. Download and re-upload it to Brutti Album first."); }
  return { canvas, width, height };
}

/** Removes only edge-connected pixels similar to the background corners.
 * Best for the black/white plain backgrounds found in existing product renders.
 * Complex photos may need dedicated background removal software.
 */
export function flatBackgroundCutout(source: CoverSource, tolerance: number): HTMLCanvasElement {
  const { width: w, height: h } = source;
  const ctx = source.canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("The original image cannot be read.");
  const image = ctx.getImageData(0, 0, w, h);
  const pixels = image.data;
  const corner = (x: number, y: number) => {
    const n = (y * w + x) * 4;
    return [pixels[n], pixels[n + 1], pixels[n + 2]];
  };
  const corners = [corner(0, 0), corner(w - 1, 0), corner(0, h - 1), corner(w - 1, h - 1)];
  const distance = (a: number[], b: number[]) =>
    Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
  const reference = corners.reduce((best, next) =>
    corners.filter(x => distance(x, next) < 38).length >
    corners.filter(x => distance(x, best) < 38).length ? next : best);
  const similar = corners.filter(x => distance(x, reference) < 38);
  const bg = [0, 1, 2].map(channel =>
    similar.reduce((sum, sample) => sum + sample[channel], 0) / similar.length);
  const count = w * h;
  const seen = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0, tail = 0;
  const add = (n: number) => {
    if (seen[n]) return;
    const i = n * 4;
    if (pixels[i + 3] === 0 ||
      Math.max(Math.abs(pixels[i] - bg[0]), Math.abs(pixels[i + 1] - bg[1]),
        Math.abs(pixels[i + 2] - bg[2])) > tolerance) return;
    seen[n] = 1;
    queue[tail++] = n;
  };
  for (let x = 0; x < w; x++) { add(x); add((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { add(y * w); add(y * w + w - 1); }
  while (head < tail) {
    const n = queue[head++];
    if (n % w > 0) add(n - 1);
    if (n % w < w - 1) add(n + 1);
    if (n >= w) add(n - w);
    if (n < count - w) add(n + w);
  }
  for (let k = 0; k < tail; k++) pixels[queue[k] * 4 + 3] = 0;
  // Soft 1px edge without blurring the whole product.
  for (let n = w; n < count - w; n++) {
    if (!seen[n] && n % w !== 0 && n % w !== w - 1 &&
      (seen[n - 1] || seen[n + 1] || seen[n - w] || seen[n + w])) {
      pixels[n * 4 + 3] = Math.round(pixels[n * 4 + 3] * 0.85);
    }
  }
  const result = document.createElement("canvas");
  result.width = w; result.height = h;
  result.getContext("2d")?.putImageData(image, 0, 0);
  return result;
}

export function drawCover(
  output: HTMLCanvasElement, source: CoverSource, cutout: HTMLCanvasElement | null, settings: CoverSettings,
): void {
  const width = 960, height = settings.aspect === "1:1" ? 960 : 720;
  if (output.width !== width) output.width = width;
  if (output.height !== height) output.height = height;
  const context = output.getContext("2d");
  if (!context) throw new Error("Could not render this cover.");
  context.clearRect(0, 0, width, height);
  const color = settings.background === "custom" ? settings.custom : coverBackgrounds[settings.background];
  if (color !== "transparent") {
    context.fillStyle = color;
    context.fillRect(0, 0, width, height);
  }
  const baseScale = settings.fit === "cover"
    ? Math.max(width / source.width, height / source.height)
    : Math.min(width / source.width, height / source.height);
  const scale = baseScale * settings.zoom;
  const dw = source.width * scale, dh = source.height * scale;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(settings.cutout && cutout ? cutout : source.canvas,
    (width - dw) / 2 + settings.x / 100 * width,
    (height - dh) / 2 + settings.y / 100 * height,
    dw, dh);
}
