/**
 * Remove only tiny, fully detached foreground islands left by a local AI matte.
 * Connected furniture and all enclosed/open interior areas remain untouched.
 * The 4-connected threshold is deliberately tiny to protect cabinet hardware.
 */
export function cleanDetachedAIMatte(rgba: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const count = width * height;
  if (width < 1 || height < 1 || rgba.length !== count * 4) {
    throw new Error("Invalid dimensions for matte cleanup.");
  }
  const data = new Uint8ClampedArray(rgba);
  // Keep furniture edges even if only partially opaque. Suppress speckles only
  // when their ENTIRE component is smaller than a tiny, bounded area.
  const minOpaque = 48;
  const maxSpeckle = Math.min(100, Math.max(8, Math.floor(count * .00006)));
  const visited = new Uint8Array(count);
  const queue = new Int32Array(count);
  for (let start = 0; start < count; start++) {
    if (visited[start] || data[start * 4 + 3] < minOpaque) continue;
    let head = 0, tail = 1;
    visited[start] = 1;
    while (head < tail) {
      const p = queue[head++];
      const x = p % width;
      const y = (p / width) | 0;
      if (x > 0) {
        const n = p - 1;
        if (!visited[n] && data[n * 4 + 3] >= minOpaque) {
          visited[n] = 1; queue[tail++] = n;
        }
      }
      if (x + 1 < width) {
        const n = p + 1;
        if (!visited[n] && data[n * 4 + 3] >= minOpaque) {
          visited[n] = 1; queue[tail++] = n;
        }
      }
      if (y > 0) {
        const n = p - width;
        if (!visited[n] && data[n * 4 + 3] >= minOpaque) {
          visited[n] = 1; queue[tail++] = n;
        }
      }
      if (y + 1 < height) {
        const n = p + width;
        if (!visited[n] && data[n * 4 + 3] >= minOpaque) {
          visited[n] = 1; queue[tail++] = n;
        }
      }
    }
    // Do not remove fragments directly touching the photo border. A real
    // object can extend beyond the image and must not be cut off.
    let touchesEdge = false;
    if (tail <= maxSpeckle) {
      for (let j = 0; j < tail; j++) {
        const p = queue[j], x = p % width, y = (p / width) | 0;
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
          touchesEdge = true; break;
        }
      }
      if (!touchesEdge) {
        for (let j = 0; j < tail; j++) data[queue[j] * 4 + 3] = 0;
      }
    }
  }
  return data;
}
