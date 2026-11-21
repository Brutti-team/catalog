import { describe, expect, it } from "vitest";
import { applyAIAlpha } from "../src/lib/ai-alpha-matte";

describe("AI Cutout alpha handling", () => {
  it("keeps real dark wood and steel when the RGBA image has a black RGB channel", () => {
    // Two dark product pixels followed by a bright empty-background pixel.
    const original = new Uint8ClampedArray([
      10, 8, 5, 255,
      16, 17, 18, 255,
      255, 255, 255, 255,
    ]);
    const aiCutout = new Uint8ClampedArray([
      1, 0, 0, 255,
      0, 0, 0, 230,
      255, 255, 255, 0,
    ]);
    const out = applyAIAlpha(original, { data: aiCutout, channels: 4 }, 3, 1);
    expect([...out]).toEqual([
      10, 8, 5, 255,
      16, 17, 18, 230,
      255, 255, 255, 0,
    ]);
  });

  it("uses a one-channel segmentation mask when provided", () => {
    const input = new Uint8ClampedArray([30, 30, 30, 255, 40, 40, 40, 255]);
    const out = applyAIAlpha(input, { data: new Uint8Array([255, 0]), channels: 1 }, 2, 1);
    expect(out[3]).toBe(255);
    expect(out[7]).toBe(0);
  });

  it("retains existing transparency instead of making masked pixels opaque", () => {
    const input = new Uint8ClampedArray([
      10, 25, 12, 128, 5, 3, 2, 255,
    ]);
    const out = applyAIAlpha(input, { data: new Uint8Array([255, 0]), channels: 1 }, 2, 1);
    expect(out[3]).toBe(128);
    expect(out[7]).toBe(0);
  });

  it("rejects RGB-only outputs that would leave a white background", () => {
    const original = new Uint8ClampedArray([255, 255, 255, 255]);
    const rgbOnly = new Uint8Array([255, 255, 255]);
    expect(() => applyAIAlpha(original, { data: rgbOnly, channels: 3 }, 1, 1))
      .toThrow(/mask dimensions/);
  });

  it("rejects masks that erase the whole product", () => {
    const input = new Uint8ClampedArray([10, 20, 30, 255]);
    expect(() => applyAIAlpha(input, { data: new Uint8Array([0]), channels: 1 }, 1, 1))
      .toThrow(/reliably separate/);
  });

  it("rejects mismatched RGBA output rather than corrupting the saved photo", () => {
    const input = new Uint8ClampedArray([10, 20, 30, 255]);
    expect(() => applyAIAlpha(input, { data: new Uint8Array([0, 0]), channels: 4 }, 1, 1))
      .toThrow(/mask dimensions/);
  });
});
