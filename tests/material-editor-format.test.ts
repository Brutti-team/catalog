import { describe, expect, it } from "vitest";
import {
  toggleMaterialInline, toggleMaterialHeading,
  setMaterialList, clearMaterialFormatting,
} from "../src/lib/material-editor-format";
import { materialCardSummary, parseMaterials } from "../src/lib/material-list";

describe("Materials rich formatting controls", () => {
  it("bolds and unbolds a selected phrase without altering other materials", () => {
    const original = "Tier: Solid pine wood\nStructure: Steel frame";
    const start = original.indexOf("Solid");
    const end = start + "Solid pine wood".length;
    const result = toggleMaterialInline(original, start, end, "bold");
    expect(result.value).toBe("Tier: **Solid pine wood**\nStructure: Steel frame");
    const back = toggleMaterialInline(result.value, result.selectionStart, result.selectionEnd, "bold");
    expect(back.value).toBe(original);
  });

  it("supports italic, underline, strike and highlight formats", () => {
    const markers = ["*pine*", "++pine++", "~~pine~~", "==pine=="];
    const kinds = ["italic", "underline", "strike", "highlight"] as const;
    kinds.forEach((style, i) => {
      expect(toggleMaterialInline("pine", 0, 4, style).value).toBe(markers[i]);
    });
  });

  it("formats the word under the caret or inserts editable text", () => {
    expect(toggleMaterialInline("Steel frame", 3, 3, "bold").value).toBe("**Steel** frame");
    const empty = toggleMaterialInline("", 0, 0, "italic");
    expect(empty.value).toBe("*text*");
    expect(empty.selectionStart).toBe(1);
    expect(empty.selectionEnd).toBe(5);
  });

  it("marks a selected line as a heading and can remove that heading", () => {
    const text = "Tier\nStructure: steel";
    const result = toggleMaterialHeading(text, 2);
    expect(result.value).toBe("## Tier\nStructure: steel");
    expect(toggleMaterialHeading(result.value, 5).value).toBe(text);
    expect(parseMaterials(result.value)[0]).toEqual({ style: "heading", items: ["Tier"] });
  });

  it("changes selected lines to bullet or numbering while leaving others alone", () => {
    const original = "Tier: Pine\nStructure: Steel";
    const result = setMaterialList(original, 12, original.length, "bullet");
    expect(result.value).toBe("Tier: Pine\n• Structure: Steel");
    const numbered = setMaterialList(original, 0, 0, "numbered");
    expect(numbered.value).toBe("1. Tier: Pine\n2. Structure: Steel");
  });

  it("clears selected or all inline formats without deleting the text", () => {
    const input = "## Materials\n• **Tier:** *Pine* with ++clear++ satin";
    const cleared = clearMaterialFormatting(input, 0, 0);
    expect(cleared.value).toBe("Materials\n• Tier: Pine with clear satin");
  });

  it("shows clean card summaries with bold headings and inline formatting", () => {
    const value = "## Materials\n• **Tier:** *Pine*\n• ~~Metal~~ frame";
    expect(materialCardSummary(value)).toBe("Materials · +2 more");
  });
});
