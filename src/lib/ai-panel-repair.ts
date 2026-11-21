/**
 * Conservative matte repair for solid-faced furniture (cabinets, drawers,
 * doors). A segmentation model sometimes mistakes light door faces for the
 * background. We restore ONLY enclosed, panel-sized transparent cavities,
 * never regions connected to the outer image boundary.
 *
 * Opt in only for products with solid panels. Open shelves, glass cases and
 * other see-through objects should keep this disabled.
 * Operates on alpha only; the original photograph supplies RGB unchanged.
 */
export type PanelRepairResult = { rgba: Uint8ClampedArray; panelsRestored: number };

export function recoverEnclosedPanels(
  original: Uint8ClampedArray,
  cutout: Uint8ClampedArray,
  width: number,
  height: number,
): PanelRepairResult {
  const total = width * height;
  if (width < 8 || height < 8 || original.length !== total * 4 ||
      cutout.length !== total * 4) {
    throw new Error("Invalid cutout for solid-panel recovery.");
  }
  const updated = new Uint8ClampedArray(cutout);
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  const threshold = 32;
  const minArea = Math.max(20, Math.round(total * 0.0007));
  const maxArea = Math.round(total * 0.08);
  let restored = 0;
  for (let start = 0; start < total; start++) {
    if (visited[start] || updated[start * 4 + 3] >= threshold) continue;
    let head = 0, tail = 1;
    queue[0] = start;
    visited[start] = 1;
    let left = start % width, right = left;
    let top = Math.floor(start / width), bottom = top;
    let touchesBorder = false;
    while (head < tail) {
      const i = queue[head++];
      const x = i % width, y = Math.floor(i / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;
      if (x < left) left = x; if (x > right) right = x;
      if (y < top) top = y; if (y > bottom) bottom = y;
      // Four-connected cavities: diagonal edge gaps do not destroy an
      // otherwise intact, square cabinet face.
      if (x > 0) {
        const n = i - 1;
        if (!visited[n] && updated[n * 4 + 3] < threshold) {
          visited[n] = 1; queue[tail++] = n;
        }
      }
      if (x + 1 < width) {
        const n = i + 1;
        if (!visited[n] && updated[n * 4 + 3] < threshold) {
          visited[n] = 1; queue[tail++] = n;
        }
      }
      if (y > 0) {
        const n = i - width;
        if (!visited[n] && updated[n * 4 + 3] < threshold) {
          visited[n] = 1; queue[tail++] = n;
        }
      }
      if (y + 1 < height) {
        const n = i + width;
        if (!visited[n] && updated[n * 4 + 3] < threshold) {
          visited[n] = 1; queue[tail++] = n;
        }
      }
    }
    const boxWidth = right - left + 1, boxHeight = bottom - top + 1;
    const boxArea = boxWidth * boxHeight;
    const ratio = boxWidth / boxHeight;
    const centerY = (top + bottom) / (2 * height);
    const rectangular = tail / boxArea >= 0.68;
    const panelSized = tail >= minArea && tail <= maxArea &&
      boxWidth / width >= .045 && boxWidth / width <= .38 &&
      boxHeight / height >= .045 && boxHeight / height <= .38 &&
      ratio >= .38 && ratio <= 2.0;
    // Door/drawer faces sit in the lower body of a cabinet. Open gaps
    // around top display shelves are deliberately left transparent.
    if (touchesBorder || centerY < .52 || !rectangular || !panelSized) continue;
    for (let p = 0; p < tail; p++) {
      const index = queue[p] * 4 + 3;
      updated[index] = original[index];
    }
    restored++;
  }
  return { rgba: updated, panelsRestored: restored };
}
