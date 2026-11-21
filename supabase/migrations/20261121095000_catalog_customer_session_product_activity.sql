-- Add per-session product-click/view detail without exposing raw session IDs or visitor identities.
-- RLS and catalog administrator check remain in force.
CREATE OR REPLACE FUNCTION public.catalog_customer_session_details(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_start timestamptz;
  v_total bigint;
  v_sessions jsonb;
begin
  if auth.uid() is null or not public.is_catalog_admin() then
    raise exception 'Catalog administrator access required' using errcode='42501';
  end if;
  if p_days not in (7, 30, 90) then
    raise exception 'Unsupported date range' using errcode='22023';
  end if;
  v_start := (((now() at time zone 'Asia/Kuala_Lumpur')::date - (p_days - 1))::timestamp at time zone 'Asia/Kuala_Lumpur');
  select count(distinct e.session_id) into v_total
    from public.catalog_customer_events e where e.occurred_at >= v_start;

  select coalesce(jsonb_agg(jsonb_build_object(
    'number',s.session_number,
    'firstSeen',s.first_seen,
    'lastSeen',s.last_seen,
    'catalogOpens',s.catalog_opens,
    'productViews',s.product_views,
    'productClicks',s.product_clicks,
    'productActions',events.product_actions
  ) order by s.last_seen desc,s.session_number),'[]'::jsonb)
  into v_sessions
  from (
    select
      row_number() over(order by max(e.occurred_at) desc,e.session_id) as session_number,
      e.session_id,
      min(e.occurred_at) as first_seen,
      max(e.occurred_at) as last_seen,
      count(*) filter(where e.event_type='catalog_open') as catalog_opens,
      count(*) filter(where e.event_type='product_view') as product_views,
      count(*) filter(where e.event_type='product_click') as product_clicks
    from public.catalog_customer_events e
    where e.occurred_at>=v_start
    group by e.session_id
    order by last_seen desc,e.session_id
    limit 100
  ) s
  cross join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
       'kind', a.event_type,
       'at', a.occurred_at,
       'productId', a.product_id,
       'productName', p.name,
       'productSku', p.sku
     ) order by a.occurred_at desc,a.id desc),'[]'::jsonb) as product_actions
    from (
       select e.id,e.occurred_at,e.event_type,e.product_id
       from public.catalog_customer_events e
       where e.session_id=s.session_id
         and e.occurred_at>=v_start
         and e.event_type in ('product_click','product_view')
       order by e.occurred_at desc,e.id desc
       limit 30
    ) a
    left join public.products p on p.id=a.product_id
  ) events;
  return jsonb_build_object('totalSessions',coalesce(v_total,0),'sessions',v_sessions);
end;
$function$;

revoke all on function public.catalog_customer_session_details(integer) from public, anon, authenticated;
grant execute on function public.catalog_customer_session_details(integer) to authenticated;
