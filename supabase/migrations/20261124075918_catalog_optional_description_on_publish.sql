-- Description is optional; a published product still needs at least one image.
alter table public.products drop constraint published_product_is_complete;
alter table public.products add constraint published_product_is_complete check (status <> 'published'::public.product_status or jsonb_array_length(images) > 0);
