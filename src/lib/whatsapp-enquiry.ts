import type { Product } from "./types";

/** Official Benua Brutti WhatsApp destination, as linked by @brutti.my Linktree. */
export const BRUTTI_WHATSAPP_NUMBER = "601136043432";

/**
 * Opens a WhatsApp draft for the exact product the customer is viewing.
 * This never sends automatically; the customer reviews and taps Send in WhatsApp.
 * Do not include unpublished catalog URLs from the private editor preview.
 */
export function productWhatsAppMessage(product: Pick<Product, "name" | "sku">): string {
  const name = product.name.trim();
  const sku = product.sku.trim();
  const productLine = sku
    ? `Product: ${name}\nProduct ID: ${sku}`
    : `Product: ${name}`;

  return `Hi Brutti team!\n\nI came across this piece in your online catalogue and would love to know more.\n\n${productLine}\n\nCould you please confirm the price, availability and estimated lead time?\n\nThank you!`;
}

export function productWhatsAppUrl(product: Pick<Product, "name" | "sku">): string {
  const text = encodeURIComponent(productWhatsAppMessage(product));
  return `https://wa.me/${BRUTTI_WHATSAPP_NUMBER}?text=${text}`;
}
