-- Customer engagement analytics for the public catalog.
-- Does not collect IP addresses, emails, names or user-agent data.
-- Records future actions only; does not invent historical views.
create table if not exists public.catalog_customer_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  event_type text not null check (event_type in ('catalog_open', 'product_view', 'product_click')),
  product_id uuid references public.products(id) on delete set null,
  session_id uuid not null
);
create index if not exists catalog_customer_events_period_idx
  on public.catalog_customer_events (occurred_at desc, event_type);
create index if not exists catalog_customer_events_product_idx
  on public.catalog_customer_events (product_id, occurred_at desc);
alter table public.catalog_customer_events enable row level security;
revoke all on public.catalog_customer_events from public, anon, authenticated;
grant select on public.catalog_customer_events to authenticated;
drop policy if exists "Catalog administrators read customer insights" on public.catalog_customer_events;
create policy "Catalog administrators read customer insights" on public.catalog_customer_events
  for select to authenticated using ((select public.is_catalog_admin()));

create or replace function public.catalog_record_customer_event(
  p_event_type text, p_product_id uuid, p_session_id uuid
) returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_session_id is null or p_event_type not in ('catalog_open','product_view','product_click') then return; end if;
  if auth.uid() is not null and public.is_catalog_admin() then return; end if;
  if p_event_type = 'catalog_open' then
    if p_product_id is not null then return; end if;
  else
    if p_product_id is null or not exists (
      select 1 from public.products where id = p_product_id and status = 'published'
    ) then return; end if;
  end if;
  if exists (
    select 1 from public.catalog_customer_events
    where session_id = p_session_id and event_type = p_event_type
      and product_id is not distinct from p_product_id
      and occurred_at >= now() - interval '15 seconds'
  ) then return; end if;
  if (select count(*) from public.catalog_customer_events
      where session_id = p_session_id and occurred_at >= now() - interval '1 minute') >= 40 then return; end if;
  insert into public.catalog_customer_events(event_type, product_id, session_id)
  values (p_event_type,p_product_id,p_session_id);
end;
$$;
revoke all on function public.catalog_record_customer_event(text,uuid,uuid) from public;
grant execute on function public.catalog_record_customer_event(text,uuid,uuid) to anon, authenticated;

create or replace function public.catalog_customer_insights(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_start timestamptz;
  v_total bigint;
  v_sessions bigint;
  v_clicks bigint;
  v_products bigint;
  v_trend jsonb;
  v_categories jsonb;
  v_top_product uuid;
  v_top_views bigint := 0;
  v_top_clicks bigint := 0;
begin
  if auth.uid() is null or not public.is_catalog_admin() then
    raise exception 'Catalog administrator access required' using errcode='42501';
  end if;
  if p_days not in (7,30,90) then
    raise exception 'Unsupported date range' using errcode='22023';
  end if;
  v_start := (((now() at time zone 'Asia/Kuala_Lumpur')::date - (p_days-1))::timestamp at time zone 'Asia/Kuala_Lumpur');
  select
    count(*) filter (where event_type='product_view'),
    count(distinct session_id),
    count(*) filter (where event_type='product_click'),
    count(distinct product_id) filter (where event_type='product_view')
  into v_total,v_sessions,v_clicks,v_products
  from public.catalog_customer_events where occurred_at>=v_start;

  select coalesce(jsonb_agg(jsonb_build_object('date',day,'views',views) order by day),'[]'::jsonb)
  into v_trend from (
    select d::date as day, count(e.id) as views
    from generate_series((now() at time zone 'Asia/Kuala_Lumpur')::date - (p_days-1),
       (now() at time zone 'Asia/Kuala_Lumpur')::date, interval '1 day') as d
    left join public.catalog_customer_events e
      on (e.occurred_at at time zone 'Asia/Kuala_Lumpur')::date=d::date
      and e.occurred_at>=v_start and e.event_type='product_view'
    group by d::date
  ) daily;

  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'views',views)
    order by views desc,name asc),'[]'::jsonb) into v_categories
  from (
    select c.id,c.name,count(e.id)::bigint as views
    from public.catalog_customer_events e
    join public.products p on p.id=e.product_id
    join public.categories c on c.id=p.category_id
    where e.occurred_at>=v_start and e.event_type='product_view'
    group by c.id,c.name order by views desc,c.name asc limit 5
  ) ranked;

  select e.product_id,count(*) into v_top_product,v_top_views
  from public.catalog_customer_events e
  where e.occurred_at>=v_start and e.event_type='product_view' and e.product_id is not null
  group by e.product_id order by count(*) desc,e.product_id limit 1;
  if v_top_product is not null then
    select count(*) into v_top_clicks from public.catalog_customer_events
    where occurred_at>=v_start and event_type='product_click' and product_id=v_top_product;
  end if;
  return jsonb_build_object(
    'totalViews',coalesce(v_total,0),'visitorSessions',coalesce(v_sessions,0),
    'productClicks',coalesce(v_clicks,0),'productsViewed',coalesce(v_products,0),
    'trend',v_trend,'categories',v_categories,'topProductId',v_top_product,
    'topProductViews',coalesce(v_top_views,0),'topProductClicks',coalesce(v_top_clicks,0)
  );
end;
$$;
revoke all on function public.catalog_customer_insights(integer) from public, anon;
grant execute on function public.catalog_customer_insights(integer) to authenticated;
