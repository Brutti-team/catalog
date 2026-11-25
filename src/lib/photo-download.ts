import { catalogClient } from "./catalog";

export type PhotoDownloadFormat = "jpg" | "png" | "webp";
type DownloadablePhoto = { url: string; storagePath?: string; name?: string; alt?: string };

const formatMime: Record<PhotoDownloadFormat, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function identifyImage(bytes: Uint8Array): string | null {
  const ascii = (a: number, n: number) =>
    String.fromCharCode(...bytes.slice(a, a + n));
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (bytes.length > 8 && ascii(1, 3) === "PNG" && bytes[0] === 137)
    return "image/png";
  if (bytes.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP")
    return "image/webp";
  if (bytes.length > 6 && ["GIF87a", "GIF89a"].includes(ascii(0, 6)))
    return "image/gif";
  if (bytes.length > 2 && ascii(0, 2) === "BM")
    return "image/bmp";
  if (bytes.length > 16 && ascii(4, 4) === "ftyp" &&
      ["avif", "avis"].includes(ascii(8, 4)))
    return "image/avif";
  return null;
}

/** Get the actual image bytes, never the HTML served by a broken link.
 * Product photos in the Catalog Supabase bucket are downloaded through the
 * storage client. External historical photos use CORS fetch and fail safely.
 */
async function retrieveImage(photo: DownloadablePhoto): Promise<Blob> {
  if (!photo.url) throw new Error("This photo has no file URL.");
  const client = catalogClient();
  const configuredOrigin = new URL(import.meta.env.VITE_SUPABASE_URL).origin;
  const expectedPrefix = `${configuredOrigin}/storage/v1/object/public/product-images/`;
  const canonicalPath =
    photo.storagePath && photo.url === expectedPrefix + photo.storagePath
      ? photo.storagePath : null;

  let data: Blob;
  if (canonicalPath) {
    const { data: blob, error } = await client.storage
      .from("product-images").download(canonicalPath);
    if (error || !blob) throw new Error(
      error?.message || "Could not retrieve the image from storage."
    );
    data = blob;
  } else {
    const source = new URL(photo.url, window.location.href);
    if (!["https:", "http:"].includes(source.protocol))
      throw new Error("This photo does not have a downloadable image URL.");
    const response = await fetch(source.toString(), { mode: "cors", credentials: "omit" });
    if (!response.ok) throw new Error("Could not download the image (HTTP " + response.status + ").");
    data = await response.blob();
  }

  if (!data.size || data.size > 30 * 1024 * 1024)
    throw new Error("The image file is empty or too large to download.");
  const signature = new Uint8Array(await data.slice(0, 40).arrayBuffer());
  const actualMime = identifyImage(signature);
  if (!actualMime)
    throw new Error("The server did not return a supported image file. Download cancelled to avoid saving HTML.");
  return data.type === actualMime ? data : new Blob([data], { type: actualMime });
}

async function convertImage(blob: Blob, format: PhotoDownloadFormat): Promise<Blob> {
  if (blob.type === formatMime[format]) return blob;
  if (typeof createImageBitmap !== "function")
    throw new Error("Your browser cannot convert this image. Use the latest Chrome, Edge or Safari.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This image cannot be decoded in your browser.");
  }
  const canvas = document.createElement("canvas");
  try {
    if (bitmap.width < 1 || bitmap.height < 1 ||
        bitmap.width * bitmap.height > 40_000_000)
      throw new Error("This image is too large to convert.");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Cannot convert this photo on this device.");
    // JPEG does not support alpha. Use a neutral white background.
    if (format === "jpg") {
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(bitmap, 0, 0);
    const converted = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, formatMime[format], format === "png" ? undefined : 0.94)
    );
    if (!converted || converted.type !== formatMime[format])
      throw new Error("This browser cannot export " + format.toUpperCase() + " files.");
    return converted;
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function downloadCatalogPhoto(
  photo: DownloadablePhoto,
  format: PhotoDownloadFormat = "jpg",
): Promise<void> {
  const storedImage = await retrieveImage(photo);
  const image = await convertImage(storedImage, format);
  // File extension and MIME match the *image bytes*, never an HTML response.
  const baseName = (photo.name || photo.alt || "brutti-product")
    .replace(/\.(?:jpe?g|png|webp|gif|bmp|avif)$/i, "")
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "-")
    .trim()
    .slice(0, 110) || "brutti-product";
  const objectURL = URL.createObjectURL(image);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectURL;
    anchor.download = `${baseName}.${format}`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Safari can defer the save event until after click returns.
    window.setTimeout(() => URL.revokeObjectURL(objectURL), 10_000);
  }
}


/** Export the verified image bytes inside an offline, self-contained HTML page.
 * Original JPEG/PNG/WebP assets remain untouched in storage. */
export async function downloadCatalogPhotosHtml(title: string, photos: DownloadablePhoto[]): Promise<void> {
  if (!photos.length) throw new Error("No photos to export.");
  const escape = (value: string) => value.replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
  const figures: string[] = [];
  for (const photo of photos) {
    const blob = await retrieveImage(photo);
    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not embed photo in HTML."));
      reader.readAsDataURL(blob);
    });
    const name = escape(photo.name || photo.alt || "Product photo");
    figures.push(`<figure><img src="${src}" alt="${name}"><figcaption>${name}</figcaption></figure>`);
  }
  const heading = escape(title);
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${heading}</title><style>body{font:16px system-ui,sans-serif;background:#f5f7f4;color:#254535;max-width:1200px;margin:32px auto;padding:0 20px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:20px}figure{margin:0;background:white;padding:12px;border-radius:12px}img{width:100%;height:auto;display:block;border-radius:8px}figcaption{padding:10px 0 0}</style><h1>${heading}</h1><main>${figures.join("")}</main></html>`;
  const url = URL.createObjectURL(new Blob([html], {type:"text/html;charset=utf-8"}));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = (title.replace(/[\\/:*?"<>|\x00-\x1f]/g, "-").trim().slice(0,110) || "brutti-photos") + ".html";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  try { anchor.click(); } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
