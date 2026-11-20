import type { Category, Product, ProductImage } from "./types";
import { catalogClient, uploadImage } from "./catalog";

export type AlbumRecord = {
  id: string;
  storage_path: string;
  url: string;
  name: string;
  category_id: string | null;
  created_at: string;
};

export type AlbumPhoto = {
  key: string;
  id?: string;
  url: string;
  storagePath?: string;
  name: string;
  createdAt: string;
  /** Explicit Album folder, separate from the linked Product category. */
  manualCategoryId: string | null;
  categoryCoverIds: string[];
  usedBy: { id: string; name: string; categoryId: string }[];
  categoryCovers: string[];
  isIndexed: boolean;
};

const keyFor = (image: Pick<ProductImage,"url"|"storagePath">) => image.storagePath || image.url;

/** Keep Product Editor photos and independently uploaded Album photos in one list.
 * This also shows legacy product photos if their indexing is temporarily delayed.
 */
export function combineAlbumPhotos(records: AlbumRecord[], products: Product[], categories: Category[]): AlbumPhoto[] {
  const photos = new Map<string, AlbumPhoto>();
  for (const record of records) photos.set(record.storage_path, {
    key: record.storage_path, id: record.id, url: record.url,
    storagePath: record.storage_path, name: record.name, createdAt: record.created_at,
    manualCategoryId: record.category_id, categoryCoverIds: [],
    usedBy: [], categoryCovers: [], isIndexed: true,
  });
  for (const product of products) for (const image of product.images) {
    const key = keyFor(image);
    if (!key || !image.url) continue;
    const photo = photos.get(key) || {
      key, url: image.url, storagePath: image.storagePath,
      name: image.alt || product.name, createdAt: product.createdAt,
      manualCategoryId: null, categoryCoverIds: [],
      usedBy: [], categoryCovers: [], isIndexed: false,
    };
    if (!photo.usedBy.some(item=>item.id===product.id)) {
      photo.usedBy.push({ id: product.id, name: product.name, categoryId: product.categoryId });
    }
    photos.set(key,photo);
  }
  for (const category of categories) {
    if (!category.cover_image_url) continue;
    const photo = [...photos.values()].find(item=>item.url===category.cover_image_url);
    if (photo && !photo.categoryCovers.includes(category.name)) photo.categoryCovers.push(category.name);
    if (photo && !photo.categoryCoverIds.includes(category.id)) photo.categoryCoverIds.push(category.id);
  }
  return [...photos.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}

/** A photo can show in its manually selected folder and in linked Product
 * categories; All Photos still lists it just once.
 */
export function albumPhotoCategoryIds(photo: AlbumPhoto): string[] {
  return [...new Set([
    ...(photo.manualCategoryId ? [photo.manualCategoryId] : []),
    ...photo.categoryCoverIds,
    ...photo.usedBy.map(product => product.categoryId).filter(Boolean),
  ])];
}

export async function listAlbumRecords(): Promise<AlbumRecord[]> {
  const db = catalogClient();
  const all: AlbumRecord[] = [];
  for (let offset=0; offset < 10000; offset += 500) {
    const { data,error } = await db.from("catalog_media_assets")
      .select("id,storage_path,url,name,category_id,created_at")
      .order("created_at",{ascending:false})
      .range(offset,offset+499);
    if (error) throw new Error("Could not load Album: "+error.message);
    const batch = (data||[]) as AlbumRecord[];
    all.push(...batch);
    if (batch.length<500) break;
  }
  return all;
}

export async function uploadAlbumPhotos(files: File[], categoryId: string | null = null, onProgress?: (completed:number,total:number)=>void): Promise<{ uploaded: AlbumRecord[]; failures: string[] }> {
  const db=catalogClient();
  const {data:{user},error:authError}=await db.auth.getUser();
  if (authError || !user) throw new Error("Sign in to Brutti Catalog before uploading.");
  const uploaded: AlbumRecord[] = [],failures: string[]=[];
  for (const [index,file] of files.entries()) {
    try {
      const image=await uploadImage(file); // Existing validation + WebP optimization + user namespace.
      if (!image.storagePath) throw new Error("Storage path missing.");
      const {data,error}=await db.from("catalog_media_assets").insert({
        storage_path:image.storagePath,url:image.url,
        name:(image.alt||"Product photo").slice(0,240),uploaded_by:user.id,
        category_id:categoryId,
      }).select("id,storage_path,url,name,category_id,created_at").single();
      if (error || !data) throw new Error(error?.message||"Album registration failed.");
      uploaded.push(data as AlbumRecord);
    } catch (error) {
      failures.push(file.name+": "+(error instanceof Error ? error.message : "Upload failed."));
    }
    onProgress?.(index+1,files.length);
  }
  return {uploaded,failures};
}

/** Update an Album folder without changing the product's category.
 * RLS and the foreign key validate the staff account/category.
 */
export async function setAlbumPhotoCategory(id: string, categoryId: string | null): Promise<string | null> {
  const db = catalogClient();
  const { data, error } = await db.from("catalog_media_assets")
    .update({ category_id: categoryId })
    .eq("id", id)
    .select("category_id")
    .maybeSingle();
  if (error) throw new Error("Could not update photo category: " + error.message);
  if (!data) throw new Error("This photo could not be updated. Refresh the Album and check your access.");
  return data.category_id as string | null;
}

/** Delete is supported only for unassigned Album uploads. The database's
 * RLS and Storage DELETE policy independently guard product and category links.
 */
export async function removeUnassignedAlbumPhoto(photo: AlbumPhoto): Promise<void> {
  if (!photo.id || !photo.storagePath || photo.usedBy.length || photo.categoryCovers.length)
    throw new Error("This photo is still linked to a product or category. Unlink it first.");
  const db=catalogClient();
  const {data,error}=await db.from("catalog_media_assets").delete().eq("id",photo.id).select("id").maybeSingle();
  if (error) throw new Error("Could not remove Album entry: "+error.message);
  if (!data) throw new Error("Photo is in use, or your Album changed. Refresh before deleting.");
  const {error:storageError}=await db.storage.from("product-images").remove([photo.storagePath]);
  if (storageError) throw new Error("Album entry removed, but storage cleanup failed: "+storageError.message);
}

export function albumPhotoToProductImage(photo: AlbumPhoto): ProductImage {
  return {id:crypto.randomUUID(),url:photo.url,storagePath:photo.storagePath,alt:photo.name};
}
