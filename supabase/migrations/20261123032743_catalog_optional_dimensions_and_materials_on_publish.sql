-- Overall product dimensions and materials are optional for publication.
-- Keep numeric range constraints on individual dimensions, and still require
-- a description and product image when a product becomes public.
-- The numeric 0 means an unspecified overall dimension in the editor.

alter table public.products
  drop constraint published_product_is_complete;

alter table public.products
  add constraint published_product_is_complete
  check (
    status <> 'published'::public.product_status
    or (
      char_length(btrim(description)) > 0
      and jsonb_array_length(images) > 0
    )
  );
