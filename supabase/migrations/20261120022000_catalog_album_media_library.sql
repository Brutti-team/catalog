-- Brutti Catalog Album: staff-only media index. Applied to the Catalog project
-- on 20 Nov 2026. Reuses existing product-images bucket: zero image copies.
CREATE TABLE IF NOT EXISTS public.catalog_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL UNIQUE CHECK (length(storage_path) BETWEEN 2 AND 1024),
  url text NOT NULL CHECK (url ~ '^https://[^[:space:]]+$' AND length(url) <= 2048),
  name text NOT NULL DEFAULT 'Product photo' CHECK (char_length(name) BETWEEN 1 AND 240),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catalog_media_assets_created_idx ON public.catalog_media_assets(created_at DESC);
ALTER TABLE public.catalog_media_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalog_media_assets FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.catalog_media_assets TO authenticated;
DROP POLICY IF EXISTS "Catalog staff may view Album media" ON public.catalog_media_assets;
CREATE POLICY "Catalog staff may view Album media"
  ON public.catalog_media_assets FOR SELECT TO authenticated
  USING ((SELECT public.is_catalog_admin()));
DROP POLICY IF EXISTS "Catalog staff may register Album media" ON public.catalog_media_assets;
CREATE POLICY "Catalog staff may register Album media"
  ON public.catalog_media_assets FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_catalog_admin()) AND
    (uploaded_by IS NULL OR uploaded_by = (SELECT auth.uid())));
DROP POLICY IF EXISTS "Catalog staff may remove only unassigned Album media" ON public.catalog_media_assets;
CREATE POLICY "Catalog staff may remove only unassigned Album media"
  ON public.catalog_media_assets FOR DELETE TO authenticated
  USING (
    (SELECT public.is_catalog_admin())
    AND NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(p.images) img
        WHERE img->>'storagePath' = storage_path OR img->>'url' = catalog_media_assets.url
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.categories c WHERE c.cover_image_url = catalog_media_assets.url
    )
  );

-- Backfill 96 existing product photos by reference, not storage upload.
INSERT INTO public.catalog_media_assets(storage_path,url,name)
SELECT DISTINCT ON (photo->>'storagePath')
  photo->>'storagePath',photo->>'url',
  LEFT(coalesce(nullif(btrim(photo->>'alt'),''),'Product photo'),240)
FROM public.products p
CROSS JOIN LATERAL jsonb_array_elements(p.images) photo
WHERE (photo->>'storagePath') ~ '^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)+$'
 AND (photo->>'url') LIKE 'https://%.supabase.co/storage/v1/object/public/product-images/%'
ORDER BY photo->>'storagePath',p.created_at
ON CONFLICT(storage_path) DO NOTHING;

-- Automatically index product images on future product saves/imports.
CREATE OR REPLACE FUNCTION public.catalog_index_product_photos()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.catalog_media_assets(storage_path,url,name,uploaded_by)
  SELECT DISTINCT ON (photo->>'storagePath')
    photo->>'storagePath',photo->>'url',
    LEFT(coalesce(nullif(btrim(photo->>'alt'),''),'Product photo'),240),NULL
  FROM jsonb_array_elements(NEW.images) photo
  WHERE (photo->>'storagePath') ~ '^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)+$'
   AND (photo->>'url') LIKE 'https://%.supabase.co/storage/v1/object/public/product-images/%'
  ON CONFLICT(storage_path) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.catalog_index_product_photos() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS catalog_index_photos_after_save ON public.products;
CREATE TRIGGER catalog_index_photos_after_save
 AFTER INSERT OR UPDATE OF images ON public.products
 FOR EACH ROW EXECUTE FUNCTION public.catalog_index_product_photos();

-- Second safety check: even if browser state is stale, used photos cannot be
-- removed from storage by the authenticated front-end.
DROP POLICY IF EXISTS "Catalog administrators remove images" ON storage.objects;
CREATE POLICY "Catalog administrators remove images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (SELECT public.is_catalog_admin())
    AND NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(p.images) img
        WHERE img->>'storagePath' = storage.objects.name
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.cover_image_url LIKE '%/storage/v1/object/public/product-images/' || storage.objects.name
    )
  );
NOTIFY pgrst, 'reload schema';
