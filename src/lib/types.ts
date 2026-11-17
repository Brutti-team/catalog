export type ProductStatus = "draft" | "published" | "archived";
export type Availability = "available" | "made-to-order" | "unavailable";
export interface ProductSpecification {
  id: string;
  name: string;
  value: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  storagePath?: string;
  /** Non-destructive focus and zoom for catalog presentation (0-100% position). */
  crop?: { x: number; y: number; zoom: number };
}
export interface ProductModel {
  path: string;
  name: string;
}
export interface Product {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  description: string;
  materials: string;
  /** Optional custom specification rows shown below standard product fields. */
  specifications?: ProductSpecification[];
  width: number;
  depth: number;
  height: number;
  price: number | null;
  /** Optional original (pre-discount) price, null when no sale. */
  originalPrice?: number | null;
  /** Optional until inspected/approved price_basis schema addition is installed. */
  priceBasis?: 'fixed' | 'starting-from';
  /** Optional until the workspace has enabled catalog ordering. */
  displayOrder?: number;
  status: ProductStatus;
  availability: Availability;
  featured: boolean;
  images: ProductImage[];
  model?: ProductModel | null;
  createdAt: string;
  updatedAt: string;
}
export interface Category {
  id: string;
  name: string;
  description: string;
}
export interface CatalogData {
  products: Product[];
  categories: Category[];
  capabilities?: CatalogCapabilities;
}
export interface CatalogCapabilities {
  ordering: boolean;
  imageCleanup: boolean;
  priceBasis: boolean;
  productModels?: boolean;
}
