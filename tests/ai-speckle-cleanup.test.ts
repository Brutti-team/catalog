import { describe, expect, it } from "vitest";
import { cleanDetachedAIMatte } from "../src/lib/ai-speckle-cleanup";

function image(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    data[p] = 247; data[p + 1] = 245; data[p + 2] = 240;
  }
  return data;
}
function fill(data: Uint8ClampedArray, width: number, x1: number, y1: number, x2: number, y2: number) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) data[(y * width + x) * 4 + 3] = 255;
  }
}
const alpha = (data: Uint8ClampedArray, width: number, x: number, y: number) =>
  data[(y * width + x) * 4 + 3];

describe("automatic matte speckle cleanup", () => {
  it("removes tiny background islands while keeping a connected furniture frame", () => {
    const width = 200, height = 120;
    const input = image(width, height);
    fill(input, width, 20, 20, 170, 22); // thin white horizontal shelf/frame
    fill(input, width, 20, 20, 22, 110); // connected slim upright
    fill(input, width, 100, 90, 101, 91); // isolated 2x2 model artifact
    const out = cleanDetachedAIMatte(input, width, height);
    expect(alpha(out, width, 101, 91)).toBe(0);
    expect(alpha(out, width, 140, 21)).toBe(255);
    expect(alpha(out, width, 21, 100)).toBe(255);
    expect(alpha(input, width, 101, 91)).toBe(255); // input unchanged
  });

  it("never deletes fragments that touch an image boundary", () => {
    const input = image(120, 100);
    fill(input, 120, 0, 35, 1, 36);
    const out = cleanDetachedAIMatte(input, 120, 100);
    expect(alpha(out, 120, 0, 35)).toBe(255);
  });

  it("preserves separate furniture pieces larger than tiny artifact threshold", () => {
    const input = image(200, 150);
    fill(input, 200, 30, 30, 45, 42);
    const out = cleanDetachedAIMatte(input, 200, 150);
    expect(alpha(out, 200, 35, 35)).toBe(255);
  });

  it("refuses an incomplete source mask", () => {
    expect(() => cleanDetachedAIMatte(new Uint8ClampedArray(4), 10, 10)).toThrow(/Invalid dimensions/);
  });
});
