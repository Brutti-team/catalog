/** Stable, hand-curated showcase selection from Brutti Product Library (13 Nov 2026).
 *
 * These are deliberate editorial choices, NOT Featured / Best Selling auto-selection.
 * They remain unchanged when products are added or their status changes.
 * A staff-selected categories.cover_image_url can override the pinned default.
 * Photos are served by the Brutti-owned AI Marketing Hub product-photo library.
 */
export type CuratedCategoryCover = { productCode: string; productName: string; imageUrl: string };

export const CURATED_CATEGORY_COVERS: Readonly<Record<string, CuratedCategoryCover>> = {
  // Beds & Bunkbeds
  "30000000-0000-4000-8000-000000000004": {
    productCode: "BR-175",
    productName: "Princess Loft Bed",
    imageUrl: "https://brutti-team.github.io/brutti-ai-marketing-hub/product-photos/BR-175-photo.jpg",
  },
  // Built in Cabinet
  "98751016-02fc-4d10-8402-39bfe9b079bc": {
    productCode: "BR-141",
    productName: "Floor-To-Ceiling Built-In Cabinet",
    imageUrl: "https://brutti-team.github.io/brutti-ai-marketing-hub/product-photos/fb-floor-to-ceiling-built-in-cabinet.jpg",
  },
  // Displays & Mementos
  "30000000-0000-4000-8000-000000000006": {
    productCode: "BR-154",
    productName: "Nantuapan Momento",
    imageUrl: "https://brutti-team.github.io/brutti-ai-marketing-hub/product-photos/fb-nantuapan-momento.jpg",
  },
  // Kiosks
  "9f5e62fb-d336-4fd0-a291-17ead43f9687": {
    productCode: "BR-170",
    productName: "Dumowongi Kiosk With Wavy Roof",
    imageUrl: "https://brutti-team.github.io/brutti-ai-marketing-hub/product-photos/BR-170-photo.jpg",
  },
  // Panels
  "30000000-0000-4000-8000-000000000003": {
    productCode: "BR-130",
    productName: "Pocket-Style Wall Panel",
    imageUrl: "https://brutti-team.github.io/brutti-ai-marketing-hub/product-photos/fb-pocket-style-wall-panel.jpg",
  },
  // Racks & Shelves
  "30000000-0000-4000-8000-000000000001": {
    productCode: "BR-172",
    productName: "Ahtam Kayu Shelving Rack",
    imageUrl: "https://brutti-team.github.io/brutti-ai-marketing-hub/product-photos/BR-172-photo.jpg",
  },
  // Reception Counters
  "30000000-0000-4000-8000-000000000005": {
    productCode: "BR-083",
    productName: "Counter (Fluted Wall Panel - Brown Oak)",
    imageUrl: "https://brutti-team.github.io/brutti-ai-marketing-hub/product-photos/BR-083-photo.jpg",
  },
  // Rentals — representative single chair; no automatic product switching
  "30000000-0000-4000-8000-000000000007": {
    productCode: "BR-148",
    productName: "Classic Chair",
    imageUrl: "https://brutti-team.github.io/brutti-ai-marketing-hub/product-photos/fb-classic-chair.jpg",
  },
  // Tables & Kitchen Counters
  "30000000-0000-4000-8000-000000000002": {
    productCode: "BR-203",
    productName: "Puloudopuan Premium Kitchen Island",
    imageUrl: "https://brutti-team.github.io/brutti-ai-marketing-hub/product-photos/BR-203-photo.jpg",
  },
};

export const curatedCategoryCover = (id: string): CuratedCategoryCover | undefined =>
  CURATED_CATEGORY_COVERS[id];
