import { describe, expect, it } from "vitest";
import { recoverEnclosedPanels } from "../src/lib/ai-panel-repair";

const width = 120, height = 120;
function photo() {
  const source = new Uint8ClampedArray(width * height * 4);
  const cutout = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    // White furniture must not be confused with the clear background.
    source.set([246, 245, 242, 255], p * 4);
    cutout.set([246, 245, 242, 255], p * 4);
  }
  return { source, cutout };
}
function setAlpha(data: Uint8ClampedArray, x1: number, y1: number, x2: number, y2: number, alpha: number) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) data[(y * width + x) * 4 + 3] = alpha;
  }
}
const at = (data: Uint8ClampedArray, x: number, y: number) => data[(y * width + x) * 4 + 3];

describe("conservative cabinet-panel matte recovery", () => {
  it("restores a white enclosed lower door, preserving the original RGB", () => {
    const { source, cutout } = photo();
    setAlpha(cutout, 0, 0, width - 1, height - 1, 0);
    // Simulate cabinet body and the AI mistakenly removing a closed door.
    setAlpha(cutout, 25, 59, 90, 112, 255);
    setAlpha(cutout, 40, 75, 60, 94, 0);
    const result = recoverEnclosedPanels(source, cutout, width, height);
    expect(result.panelsRestored).toBe(1);
    expect(at(result.rgba, 50, 85)).toBe(255);
    expect(Array.from(result.rgba.slice((85 * width + 50) * 4, (85 * width + 50) * 4 + 3)))
      .toEqual([246, 245, 242]);
    expect(at(result.rgba, 4, 4)).toBe(0);
    expect(at(cutout, 50, 85)).toBe(0); // original mask remains editable.
  });

  it("does not fill see-through spaces in upper display shelves", () => {
    const { source, cutout } = photo();
    setAlpha(cutout, 35, 20, 70, 60, 255);
    setAlpha(cutout, 40, 25, 60, 45, 0);
    const result = recoverEnclosedPanels(source, cutout, width, height);
    expect(result.panelsRestored).toBe(0);
    expect(at(result.rgba, 50, 35)).toBe(0);
  });

  it("keeps edge-connected background transparent", () => {
    const { source, cutout } = photo();
    setAlpha(cutout, 110, 65, 119, 90, 0);
    const result = recoverEnclosedPanels(source, cutout, width, height);
    expect(result.panelsRestored).toBe(0);
    expect(at(result.rgba, 115, 80)).toBe(0);
  });

  it("does not fill large see-through openings", () => {
    const { source, cutout } = photo();
    setAlpha(cutout, 12, 50, 106, 90, 0);
    const result = recoverEnclosedPanels(source, cutout, width, height);
    expect(result.panelsRestored).toBe(0);
    expect(at(result.rgba, 50, 70)).toBe(0);
  });

  it("rejects dimensions that could corrupt original photo pixels", () => {
    const { source, cutout } = photo();
    expect(() => recoverEnclosedPanels(source, cutout, width + 1, height)).toThrow(/Invalid cutout/);
  });
});
