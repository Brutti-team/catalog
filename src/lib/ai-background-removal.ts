import type { CoverSource } from "./cover-studio-canvas";

/** ORMBG/IS-Net, Apache-2.0. No paid API or product upload to a remote server:
 * computation runs in a dedicated browser Worker (WASM). Model files are
 * fetched only on first use, then cached by the browser.
 *
 * Worker and model: src/workers/ai-cutout.worker.ts
 * Model: https://huggingface.co/onnx-community/ormbg-ONNX
 */
export type AICutoutProgress = (message: string) => void;
type WorkerMessage =
  | { type: "progress"; message: string }
  | { type: "done"; rgba: ArrayBuffer; width: number; height: number }
  | { type: "error"; message: string };

let activeWorker: Worker | undefined;
let nextRequestId = 0;
let cancelPending: ((reason?: unknown) => void) | undefined;

export function stopAICutout(): void {
  nextRequestId++;
  if (activeWorker) { activeWorker.terminate(); activeWorker = undefined; }
  const reject = cancelPending;
  cancelPending = undefined;
  if (reject) reject(new Error("AI processing cancelled. Original image retained."));
}

export async function aiFurnitureCutout(
  source: CoverSource,
  onProgress?: AICutoutProgress,
): Promise<HTMLCanvasElement> {
  // A new click supersedes any previous run and keeps the original image safe.
  stopAICutout();
  const requestId = ++nextRequestId;
  if (typeof Worker === "undefined") {
    throw new Error("This browser does not support local AI editing. Try Chrome or Edge on desktop.");
  }
  const worker = new Worker(new URL("../workers/ai-cutout.worker.ts", import.meta.url), { type: "module" });
  activeWorker = worker;
  // Feed pixels directly to the local model, not a URL or a remote API.
  const sourcePixels = source.canvas.getContext("2d")?.getImageData(0, 0, source.width, source.height);
  if (!sourcePixels) throw new Error("The source photo cannot be read for local AI editing.");
  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    cancelPending = reject;
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (requestId !== nextRequestId) return;
      const data = event.data;
      if (data.type === "progress") { onProgress?.(data.message); return; }
      worker.terminate();
      if (activeWorker === worker) activeWorker = undefined;
      cancelPending = undefined;
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
      if (activeWorker === worker) activeWorker = undefined;
      cancelPending = undefined;
      reject(new Error("AI worker could not start. Check browser console, network access to Hugging Face and memory."));
      event.preventDefault();
    };
    const rgba = sourcePixels.data.buffer as ArrayBuffer;
    worker.postMessage({ width: source.width, height: source.height, rgba }, [rgba]);
  });
}
