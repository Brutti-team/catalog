-- Atomic administrator-confirmed deletion of a category and all of its products.
-- Deploying this function does not delete any products. It runs only when
-- the signed-in catalog admin confirms the exact category and product count.
create or replace function public.catalog_delete_category_with_products(
  p_category_id uuid, p_expected_name text, p_expected_count integer
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  category_row public.categories%rowtype;
  products_count integer;
  deleted_products jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or coalesce(public.is_catalog_admin(), false) is not true then
    raise exception 'Only catalog administrators can delete categories' using errcode='42501';
  end if;
  if p_category_id is null or p_expected_name is null or p_expected_count is null or p_expected_count < 0 then
    raise exception 'Invalid category confirmation' using errcode='22023';
  end if;

  select * into category_row from public.categories
  where id=p_category_id for update;
  if not found then
    raise exception 'Category no longer exists. Refresh the page.' using errcode='P0002';
  end if;
  if category_row.name is distinct from p_expected_name then
    raise exception 'Category name changed. Refresh and confirm again.' using errcode='P0001';
  end if;

  select count(*) into products_count from public.products where category_id=p_category_id;
  if products_count <> p_expected_count then
    raise exception 'Product count changed from % to %. Refresh and confirm again.',
      p_expected_count, products_count using errcode='P0001';
  end if;

  with removed as (
    delete from public.products where category_id=p_category_id
    returning id, images, model_path
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'images', images, 'model_path', model_path
  )), '[]'::jsonb)
  into deleted_products from removed;

  if jsonb_array_length(deleted_products) <> products_count then
    raise exception 'Product delete count does not match. No changes committed.' using errcode='P0001';
  end if;

  delete from public.categories where id=p_category_id;
  if not found then
    raise exception 'Category could not be removed; no changes committed.' using errcode='P0001';
  end if;

  return jsonb_build_object(
    'deleted_category_id', p_category_id,
    'deleted_count', products_count,
    'products', deleted_products
  );
end;
$$;

revoke all on function public.catalog_delete_category_with_products(uuid,text,integer) from public, anon;
grant execute on function public.catalog_delete_category_with_products(uuid,text,integer) to authenticated;
comment on function public.catalog_delete_category_with_products(uuid,text,integer)
is 'Admin-only atomic category+products delete; validates category name and product count before deletion.';
