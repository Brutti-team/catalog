/** Stable, hand-curated showcase from verified Brutti Catalog assets and Brutti Product Library.
 *
 * These are deliberate editorial choices, NOT Featured / Best Selling auto-selection.
 * They remain unchanged when products are added or their status changes.
 * A staff-selected categories.cover_image_url can override the pinned default.
 * Some photos are served from Brutti's Product Library, and selected product-only covers from the Brutti Catalog public Storage bucket.
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
    productCode: "RC-06",
    productName: "Small Canopy Frame Stall",
    imageUrl: "https://lgdjoxafleqnbomtfzqt.supabase.co/storage/v1/object/public/product-images/b38404cc-fb0a-4877-af13-8b63a765f2cf/brutti2025/BRT25-P067/650044c6087d7fbdfa8d41c4fdd6f5136f0e5c9b2637b549708dc6ec3094dadd.webp",
  },
  // Panels
  "30000000-0000-4000-8000-000000000003": {
    productCode: "PNL-16",
    productName: "White Base Cabinet With Timber Display Shelves",
    imageUrl: "https://lgdjoxafleqnbomtfzqt.supabase.co/storage/v1/object/public/product-images/b38404cc-fb0a-4877-af13-8b63a765f2cf/brutti2025/BRT25-P086/aa6fe1fc6d3903da93b27601725cbb64014207a9dbb29d33dae47cfac07e0352.webp",
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
    productCode: "RNT-01",
    productName: "Stackable Event Chair Rental Selection",
    imageUrl: "https://lgdjoxafleqnbomtfzqt.supabase.co/storage/v1/object/public/product-images/b38404cc-fb0a-4877-af13-8b63a765f2cf/brutti2025/BRT25-P088/bbbd79ac5fc193c3c1ac65337e3a9d173254da166ca9261e35402034007599be.webp",
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
