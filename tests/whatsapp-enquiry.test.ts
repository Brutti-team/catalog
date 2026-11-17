import { describe, expect, it } from "vitest";
import { BRUTTI_WHATSAPP_NUMBER, productWhatsAppMessage, productWhatsAppUrl } from "../src/lib/whatsapp-enquiry";

describe("catalog product-specific WhatsApp enquiry", () => {
  const product = {
    name: "White Base Cabinet With Timber Display Shelves",
    sku: "PNL-16",
  };

  it("uses the official Brutti WhatsApp destination", () => {
    expect(BRUTTI_WHATSAPP_NUMBER).toBe("601136043432");
    expect(productWhatsAppUrl(product)).toMatch(/^https:\/\/wa\.me\/601136043432\?text=/);
  });

  it("prefills the exact current product name and ID without auto-sending", () => {
    const link = new URL(productWhatsAppUrl(product));
    const message = link.searchParams.get("text");
    expect(message).toBe(productWhatsAppMessage(product));
    expect(message).toContain(product.name);
    expect(message).toContain(product.sku);
    expect(message).toContain("price, availability");
    expect(link.searchParams.has("send")).toBe(false);
  });

  it("does not link private or unpublished catalog drafts", () => {
    const message = productWhatsAppMessage(product);
    expect(message).not.toMatch(/https?:\/\//);
  });

  it("omits the Product ID line if the draft has no ID yet", () => {
    const message = productWhatsAppMessage({ name: "Custom Desk", sku: "" });
    expect(message).toContain("Custom Desk");
    expect(message).not.toContain("Product ID:");
  });
});
