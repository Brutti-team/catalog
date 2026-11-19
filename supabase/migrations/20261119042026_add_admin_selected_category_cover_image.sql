-- Applied to Brutti Catalog on 2026-11-19.
-- Staff Admin intentionally chooses one existing public Storage product photo
-- as the cover for a public category, without publishing the product itself.
alter table public.categories
  add column if not exists cover_image_url text;

alter table public.categories
  add constraint categories_cover_image_public_storage_check
  check (
    cover_image_url is null
    or (
      char_length(cover_image_url) <= 2048
      and cover_image_url like 'https://lgdjoxafleqnbomtfzqt.supabase.co/storage/v1/object/public/product-images/%'
    )
  );

comment on column public.categories.cover_image_url is
  'Admin-selected public showcase image, chosen from existing Brutti product photos. Selecting a Draft photo publishes the photo as category cover only, not the product.';
