-- One Album folder per existing Admin category, without duplicating photos.
-- Null preserves the existing categorisation derived from Product records.
ALTER TABLE public.catalog_media_assets
  ADD COLUMN IF NOT EXISTS category_id uuid
  REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS catalog_media_assets_category_idx
  ON public.catalog_media_assets(category_id)
  WHERE category_id IS NOT NULL;

-- Staff may update the folder only, not modify the storage path or asset URL.
GRANT UPDATE(category_id) ON public.catalog_media_assets TO authenticated;

DROP POLICY IF EXISTS "Catalog staff may organise Album categories"
  ON public.catalog_media_assets;

CREATE POLICY "Catalog staff may organise Album categories"
  ON public.catalog_media_assets FOR UPDATE TO authenticated
  USING ((SELECT public.is_catalog_admin()))
  WITH CHECK ((SELECT public.is_catalog_admin()));

NOTIFY pgrst, 'reload schema';
