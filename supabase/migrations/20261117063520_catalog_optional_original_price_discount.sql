-- Brutti Catalog: optional original price to display genuine product discounts.
-- Already applied to the dedicated Brutti Catalog Supabase project.
-- Existing product prices and discount-free listings remain unchanged.
alter table public.products
  add column if not exists original_price numeric(14,2) null;

alter table public.products
  add constraint products_original_price_valid
  check (
    original_price is null
    or (
      price is not null
      and price >= 0
      and original_price > price
      and original_price <= 9999999999.99
    )
  );

comment on column public.products.original_price is
  'Optional pre-discount regular price in MYR. Compare with products.price (current price) to calculate percent off. NULL means no discount.';

notify pgrst, 'reload schema';
