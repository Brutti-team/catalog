import { applyAIAlpha } from "../lib/ai-alpha-matte";

/**
 * Apache-2.0 ORMBG local inference: no external cutout API, photo stays in
 * the browser. Downloads the model from Hugging Face on first staff click.
 * Images are never saved or uploaded by this worker.
 */
type CutoutQuality = "detail" | "fast";
type Job = { width: number; height: number; rgba: ArrayBuffer; quality?: CutoutQuality };
type Result =
  | { type: "progress"; message: string; percent: number }
  | { type: "done"; rgba: ArrayBuffer; width: number; height: number }
  | { type: "error"; message: string };
type Mask = {
  data: Uint8Array | Uint8ClampedArray | Float32Array;
  width: number;
  height: number;
  channels: number;
  resize: (w: number, h: number) => Mask | Promise<Mask>;
};
type Segmenter = (inputs: unknown[]) => Promise<Mask[]>;
type TransformPackage = {
  env: { allowLocalModels: boolean; useBrowserCache: boolean };
  pipeline: (task: string, model: string, options: Record<string, unknown>) => Promise<Segmenter>;
  RawImage: new (pixels: Uint8ClampedArray, width: number, height: number, channels: 4) => unknown;
};
const scope = self as unknown as {
  postMessage: (message: Result, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent<Job>) => void) | null;
};
let latestProgress = 0;
const notify = (message: string, percent: number) => {
  // Stage-based estimate, not a timer. Never claim completion until the
  // alpha image is actually returned; submodel downloads may report 0-100.
  latestProgress = Math.min(95, Math.max(latestProgress, Math.round(percent)));
  scope.postMessage({ type: "progress", message, percent: latestProgress });
};
type ModelState = { segmenter: Segmenter; RawImage: TransformPackage["RawImage"] };
const modelPromises = new Map<CutoutQuality, Promise<ModelState>>();

/**
 * BEN2 (MIT) prioritizes complete products, including pale cabinetry and
 * thin metal edges. ORMBG (Apache-2.0) remains optional for slower devices.
 * Both run in the existing in-browser WASM Worker. No photo upload occurs.
 */
async function model(quality: CutoutQuality): Promise<ModelState> {
  const cached = modelPromises.get(quality);
  if (cached) {
    notify(quality === "detail" ? "Using detailed furniture model…" : "Using fast AI model…", 56);
    return cached;
  }
  const modelName = quality === "detail" ? "onnx-community/BEN2-ONNX" : "onnx-community/ormbg-ONNX";
  const dtype = quality === "detail" ? "fp16" : "uint8";
  const loading = (async () => {
    notify(quality === "detail" ? "Preparing detailed furniture model…" : "Preparing fast AI model…", 5);
    const moduleUrl: string = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
    const mod = await import(/* @vite-ignore */ moduleUrl) as TransformPackage;
    mod.env.allowLocalModels = false;
    mod.env.useBrowserCache = true;
    notify("Loading AI model (first use downloads model files)…", 10);
    const segmenter = await mod.pipeline("background-removal", modelName, {
      device: "wasm",
      dtype,
      progress_callback: (progress: { status?: string; loaded?: number; total?: number }) => {
        if (progress.status === "progress" && progress.total && progress.loaded !== undefined) {
          const downloadPercent = Math.min(100, Math.round(100 * progress.loaded / progress.total));
          notify("Downloading " + (quality === "detail" ? "detailed" : "fast") +
            " AI model… " + downloadPercent + "%", 10 + downloadPercent * .43);
        } else if (progress.status === "initiate") {
          notify("Preparing local model files…", 10);
        } else if (progress.status === "done") {
          notify("AI model ready. Detecting furniture…", 56);
        }
      },
    });
    return { segmenter, RawImage: mod.RawImage };
  })();
  modelPromises.set(quality, loading);
  try {
    return await loading;
  } catch (error) {
    modelPromises.delete(quality);
    throw new Error(
      quality === "detail"
        ? "Detailed AI model could not load. Try Fast model on a lower-memory device; check browser Network / Console for model downloads."
        : error instanceof Error ? error.message : "Fast AI model could not load.",
    );
  }
}
async function process(job: Job) {
  const { width, height, rgba } = job;
  const quality: CutoutQuality = job.quality === "fast" ? "fast" : "detail";
  if (width < 1 || height < 1 || width * height > 1400 * 1400 ||
    rgba.byteLength !== width * height * 4) {
    throw new Error("Invalid photo data. Close and reopen Cover Studio.");
  }
  latestProgress = 0;
  notify("Preparing image for local AI…", 4);
  const { segmenter, RawImage } = await model(quality);
  notify("AI model loaded. Segmenting furniture…", 63);
  notify(quality === "detail"
    ? "Tracing fine furniture details and cabinet panels on this device…"
    : "Identifying the furniture silhouette on this device…", 68);
  // RawImage is passed in memory; the original pixels stay on the device.
  const picture = new RawImage(new Uint8ClampedArray(rgba.slice(0)), width, height, 4);
  const result = await segmenter([picture]);
  if (!result?.length) throw new Error("No mask returned by the AI model.");
  let mask = result[0];
  if (mask.width !== width || mask.height !== height) mask = await mask.resize(width, height);
  if (mask.width !== width || mask.height !== height) {
    throw new Error("AI mask size does not match original photograph.");
  }
  notify("Refining transparent edges…", 89);
  // Keep original RGB and use the predicted alpha instead of RGB brightness.
  const output = applyAIAlpha(new Uint8ClampedArray(rgba), mask, width, height);
  const outputBuffer = output.buffer as ArrayBuffer;
  scope.postMessage({ type: "done", rgba: outputBuffer, width, height }, [outputBuffer]);
}
scope.onmessage = (event: MessageEvent<Job>) => {
  void process(event.data).catch(error => scope.postMessage({
    type: "error", message: error instanceof Error ? error.message : "AI cutout failed.",
  }));
};
