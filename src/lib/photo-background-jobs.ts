import type { ProductImage } from "./types";
import type { AIProgressPhase } from "./ai-background-removal";
import { aiFurnitureCutoutIsolated } from "./ai-background-removal";
import type { CoverSource } from "./cover-studio-canvas";

/** One local processing job per browser tab. No cloud uploads, paid calls or
 * hidden server queue. The job survives Photo Studio/Product Editor unmounts,
 * but does not survive page reload, navigation away, or closing the tab. */
export type BackgroundJobStatus = "idle" | "running" | "done" | "error" | "cancelled";
export type BackgroundJobSnapshot = {
  status: BackgroundJobStatus;
  jobId: number;
  productId: string | null;
  image: ProductImage | null;
  percent: number;
  phase: AIProgressPhase;
  message: string;
  error: string;
  result: HTMLCanvasElement | null;
};
let snapshot: BackgroundJobSnapshot = {
  status: "idle", jobId: 0, productId: null, image: null,
  percent: 0, phase: "preparing", message: "", error: "", result: null,
};
const subscribers = new Set<() => void>();
let controller: AbortController | null = null;
let progressInterval: number | null = null;
let sequence = 0;

export function getBackgroundJobSnapshot(): BackgroundJobSnapshot { return snapshot; }
export function subscribeBackgroundJob(listener: () => void): () => void {
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
}
function update(partial: Partial<BackgroundJobSnapshot>): void {
  snapshot = { ...snapshot, ...partial };
  subscribers.forEach(listener => listener());
}
function stopProgressTimer(): void {
  if (progressInterval !== null) window.clearInterval(progressInterval);
  progressInterval = null;
}
function estimatedPercent(started: number): number {
  const elapsed = Math.max(0, Date.now() - started);
  return Math.min(95, Math.floor(1 + 94 * (1 - Math.exp(-elapsed / 55000))));
}

/** Get the editable transparent result, never a replacement for the Album original. */
export function backgroundResultFor(imageId: string, productId: string): HTMLCanvasElement | null {
  if (snapshot.status !== "done" || snapshot.image?.id !== imageId ||
    snapshot.productId !== productId) return null;
  return snapshot.result;
}

export function cancelBackgroundJob(): void {
  if (snapshot.status !== "running") return;
  sequence++;
  stopProgressTimer();
  controller?.abort();
  controller = null;
  update({ status: "cancelled", message: "Background removal cancelled.", error: "",
    percent: 0, result: null });
}

export function dismissBackgroundJob(): void {
  if (snapshot.status === "running") return;
  stopProgressTimer();
  controller = null;
  update({ status: "idle", image: null, productId: null, result: null,
    percent: 0, message: "", error: "" });
}

export function startBackgroundJob(
  image: ProductImage,
  source: HTMLImageElement,
  productId: string,
): boolean {
  if (snapshot.status === "running") return false;
  if (!source.complete || !source.naturalWidth || !source.naturalHeight) return false;
  const jobId = ++sequence;
  const started = Date.now();
  controller = new AbortController();
  const signal = controller.signal;
  update({
    status: "running", jobId, image: { ...image }, productId,
    percent: 1, phase: "preparing", message: "Preparing product photo…",
    error: "", result: null,
  });
  stopProgressTimer();
  progressInterval = window.setInterval(() => {
    if (sequence !== jobId || snapshot.status !== "running") return;
    const next = Math.max(snapshot.percent, estimatedPercent(started));
    if (next !== snapshot.percent) update({ percent: next });
  }, 280);

  void (async () => {
    const maxAIWidth = 1024;
    const factor = Math.min(1, maxAIWidth / Math.max(source.naturalWidth, source.naturalHeight));
    const width = Math.max(1, Math.round(source.naturalWidth * factor));
    const height = Math.max(1, Math.round(source.naturalHeight * factor));
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This browser cannot process the photo.");
    try {
      context.drawImage(source, 0, 0, width, height);
      context.getImageData(0, 0, 1, 1);
    } catch {
      throw new Error("The image host blocks editing. Re-upload this photo to the Brutti Album.");
    }
    const localSource: CoverSource = { canvas: sourceCanvas, width, height };
    const protectPanels = /cabinet|cupboard|wardrobe|door|drawer|dresser|counter|panel/i.test(image.alt || "");
    const cutout = await aiFurnitureCutoutIsolated(localSource, (message, _filePercent, phase) => {
      if (sequence !== jobId) return;
      update({ message, phase: phase ?? "processing" });
    }, signal, protectPanels);
    if (sequence !== jobId || signal.aborted) return;

    // A mask is not good if almost the entire photo stays opaque.
    const alpha = cutout.getContext("2d", { willReadFrequently: true })
      ?.getImageData(0, 0, width, height).data;
    if (!alpha) throw new Error("The AI mask could not be read.");
    let transparent = 0;
    for (let index = 3; index < alpha.length; index += 4) {
      if (alpha[index] < 32) transparent++;
    }
    if (transparent / (width * height) < .02) {
      throw new Error("AI could not remove this background reliably. The original was kept.");
    }
    update({ message: "Finishing product detail and transparency…", phase: "processing" });
    const scale = Math.min(1, 1800 / Math.max(source.naturalWidth, source.naturalHeight));
    const outputWidth = Math.max(1, Math.round(source.naturalWidth * scale));
    const outputHeight = Math.max(1, Math.round(source.naturalHeight * scale));
    const final = document.createElement("canvas");
    final.width = outputWidth; final.height = outputHeight;
    const finalCtx = final.getContext("2d", { willReadFrequently: true });
    const mask = document.createElement("canvas");
    mask.width = outputWidth; mask.height = outputHeight;
    const maskCtx = mask.getContext("2d", { willReadFrequently: true });
    if (!finalCtx || !maskCtx) throw new Error("Unable to render the detailed cutout.");
    finalCtx.drawImage(source, 0, 0, outputWidth, outputHeight);
    maskCtx.drawImage(cutout, 0, 0, outputWidth, outputHeight);
    const pixels = finalCtx.getImageData(0, 0, outputWidth, outputHeight);
    const matte = maskCtx.getImageData(0, 0, outputWidth, outputHeight);
    for (let i = 3; i < pixels.data.length; i += 4) {
      pixels.data[i] = Math.round(pixels.data[i] * matte.data[i] / 255);
    }
    finalCtx.putImageData(pixels, 0, 0);
    if (sequence !== jobId || signal.aborted) return;
    stopProgressTimer();
    controller = null;
    update({
      status: "done", percent: 100, phase: "processing",
      message: "Background removed. Open to review or apply edits.",
      result: final, error: "",
    });
  })().catch(reason => {
    if (sequence !== jobId || signal.aborted) return;
    stopProgressTimer();
    controller = null;
    update({
      status: "error", error: reason instanceof Error ? reason.message : "Background removal failed.",
      message: "Could not finish background removal.", result: null,
    });
  });
  return true;
}
