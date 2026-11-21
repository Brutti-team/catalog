/** Convert the output of a local AI background-removal model to a transparent
 * copy of the original product photo.
 *
 * Transformers.js background-removal outputs a four-channel RGBA cutout.
 * The FOURTH channel is the matte: never treat red/brightness as transparency
 * or legitimate dark wood/metal will disappear.
 */
export function applyAIAlpha(
  original: Uint8ClampedArray,
  output: { data: Uint8Array | Uint8ClampedArray | Float32Array; channels: number },
  width: number,
  height: number,
): Uint8ClampedArray {
  const { data, channels } = output;
  // RGB-only output has no matte. Using its red channel can leave a white
  // backdrop opaque, so reject it instead of pretending removal succeeded.
  if (![1, 4].includes(channels) ||
      original.length !== width * height * 4 ||
      data.length < width * height * channels) {
    throw new Error("AI mask dimensions are invalid; the original photo was not changed.");
  }
  const composed = new Uint8ClampedArray(original);
  const floatMask = data instanceof Float32Array;
  let changed = 0;
  let kept = 0;
  for (let i = 0; i < width * height; i++) {
    const mask = Number(data[i * channels + (channels === 4 ? 3 : 0)]);
    const alpha = floatMask
      ? Math.max(0, Math.min(255, Math.round(mask * 255)))
      : Math.max(0, Math.min(255, mask));
    if (alpha < 245) changed++;
    if (alpha > 5) kept++;
    composed[i * 4 + 3] = Math.round(composed[i * 4 + 3] * alpha / 255);
  }
  // Reject nonsense masks rather than silently erasing a product.
  if (kept < width * height * .009 || changed < width * height * .005) {
    throw new Error("AI could not reliably separate this furniture. Try a clearer photo or Solid-colour Cutout.");
  }
  return composed;
}
