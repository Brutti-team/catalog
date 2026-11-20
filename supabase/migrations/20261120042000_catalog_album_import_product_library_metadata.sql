-- Metadata for source-linked images imported from Brutti Product Library.
-- Only catalog staff may read the records (existing table RLS).
-- Image links are indexed, not copied into Supabase Storage.
ALTER TABLE public.catalog_media_assets
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'upload'
    CHECK (source_kind IN ('upload','external')),
  ADD COLUMN IF NOT EXISTS source_product_code text,
  ADD COLUMN IF NOT EXISTS source_details jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(source_details) = 'object');
CREATE UNIQUE INDEX IF NOT EXISTS catalog_media_source_product_code_uniq
  ON public.catalog_media_assets(source_product_code)
  WHERE source_product_code IS NOT NULL;
COMMENT ON COLUMN public.catalog_media_assets.source_kind IS
  'external = linked origin photo, not physically stored in Supabase product-images bucket';
NOTIFY pgrst, 'reload schema';