import type { CoverSource } from "./cover-studio-canvas";

/** Local MIT BEN2 (detail) or Apache-2.0 ORMBG (fast). No paid API or photo upload:
 * computation runs in a dedicated browser Worker (WASM). Model files are
 * fetched only on first use, then cached by the browser.
 *
 * Worker and model: src/workers/ai-cutout.worker.ts
 * Detailed model: https://huggingface.co/onnx-community/BEN2-ONNX
 * Fast model: https://huggingface.co/onnx-community/ormbg-ONNX
 */
export type AIProgressPhase = "preparing" | "download" | "processing";
export type AICutoutProgress = (message: string, percent?: number, phase?: AIProgressPhase) => void;
type WorkerMessage =
  | { type: "progress"; message: string; percent?: number; phase: AIProgressPhase }
  | { type: "done"; rgba: ArrayBuffer; width: number; height: number }
  | { type: "error"; message: string };

let activeWorker: Worker | undefined;
let nextRequestId = 0;
let cancelPending: ((reason?: unknown) => void) | undefined;
let detailedWarmRequested = false;

function activeCutoutWorker(): Worker {
  if (!activeWorker) {
    activeWorker = new Worker(new URL("../workers/ai-cutout.worker.ts", import.meta.url), { type: "module" });
  }
  return activeWorker;
}

/** Start downloading/caching BEN2 after opening Background, before the user
 * clicks Remove. This never transmits or processes a user photo. */
export function preloadDetailedCutout(): void {
  if (typeof Worker === "undefined" || detailedWarmRequested || cancelPending) return;
  try {
    activeCutoutWorker().postMessage({ type: "warm", quality: "detail" });
    detailedWarmRequested = true;
  } catch {
    detailedWarmRequested = false;
  }
}


export function stopAICutout(): void {
  // Closing an idle editor must NOT destroy a fully loaded model. Keeping
  // the idle worker warm makes subsequent photos much faster. A running
  // request is still terminated immediately when staff clicks Cancel.
  const reject = cancelPending;
  if (!reject) return;
  nextRequestId++;
  if (activeWorker) { activeWorker.terminate(); activeWorker = undefined; detailedWarmRequested = false; }
  cancelPending = undefined;
  reject(new Error("AI processing cancelled. Original image retained."));
}

export async function aiFurnitureCutout(
  source: CoverSource,
  onProgress?: AICutoutProgress,
  quality: "detail" | "fast" = "detail",
  protectPanels = false,
): Promise<HTMLCanvasElement> {
  // Reuse an idle worker so the ONNX model remains warm between edits.
  // A second request cancels only an actually pending inference.
  if (cancelPending) stopAICutout();
  const requestId = ++nextRequestId;
  if (typeof Worker === "undefined") {
    throw new Error("This browser does not support local AI editing. Try Chrome or Edge on desktop.");
  }
  const worker = activeCutoutWorker();
  // Feed pixels directly to the local model, not a URL or a remote API.
  const sourcePixels = source.canvas.getContext("2d")?.getImageData(0, 0, source.width, source.height);
  if (!sourcePixels) throw new Error("The source photo cannot be read for local AI editing.");
  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    cancelPending = reject;
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (requestId !== nextRequestId) return;
      const data = event.data;
      if (data.type === "progress") {
        onProgress?.(data.message, data.percent, data.phase);
        return;
      }
      // Keep worker alive while this Cover Studio is open; retain model in RAM.
      cancelPending = undefined;
      worker.onmessage = null;
      if (data.type === "error") {
        reject(new Error(data.message));
        return;
      }
      if (data.width !== source.width || data.height !== source.height ||
        data.rgba.byteLength !== source.width * source.height * 4) {
        reject(new Error("The AI mask was incomplete. The original image was not changed."));
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = data.width; canvas.height = data.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("This browser cannot render the AI cutout.")); return; }
      const pixels = new ImageData(new Uint8ClampedArray(data.rgba), data.width, data.height);
      ctx.putImageData(pixels, 0, 0);
      resolve(canvas);
    };
    worker.onerror = event => {
      if (requestId !== nextRequestId) return;
      worker.terminate();
      if (activeWorker === worker) {
        activeWorker = undefined;
        detailedWarmRequested = false;
      }
      cancelPending = undefined;
      reject(new Error("AI worker could not start. Check browser console, network access to Hugging Face and memory."));
      event.preventDefault();
    };
    const rgba = sourcePixels.data.buffer as ArrayBuffer;
    worker.postMessage({ width: source.width, height: source.height, rgba, quality, protectPanels }, [rgba]);
  });
}
