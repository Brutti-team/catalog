-- Additive: editable key/value rows for Brutti Catalog product specifications.
-- Existing products remain unchanged; existing RLS policies on public.products still apply.
alter table public.products
  add column if not exists specifications jsonb not null default '[]'::jsonb;

alter table public.products
  add constraint products_specifications_shape_check
  check (
    jsonb_typeof(specifications) = 'array'
    and jsonb_array_length(specifications) <= 24
    and octet_length(specifications::text) <= 16000
  );

comment on column public.products.specifications is
  'Optional administrator-maintained product specifications; array of {id,name,value} records.';
