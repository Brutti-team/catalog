-- Brutti Catalog — anonymous customer Sessions drill-down.
-- SECURITY INVOKER, with existing authenticated-admin event table RLS.
-- Session UUIDs and visitor identities must not be returned.
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
    raise exception 'Catalog administrator access required' using errcode = '42501';
  end if;
  if p_days not in (7,30,90) then
    raise exception 'Unsupported date range' using errcode = '22023';
  end if;

  v_start := (((now() at time zone 'Asia/Kuala_Lumpur')::date - (p_days - 1))::timestamp at time zone 'Asia/Kuala_Lumpur');

  select count(*), coalesce(
    jsonb_agg(
      jsonb_build_object(
        'number', s.session_number,
        'firstSeen', s.first_seen,
        'lastSeen', s.last_seen,
        'catalogOpens', s.catalog_opens,
        'productViews', s.product_views,
        'productClicks', s.product_clicks
      )
      order by s.last_seen desc, s.session_number
    ) filter (where s.session_number <= 100),
    '[]'::jsonb
  )
  into v_total, v_sessions
  from (
    select
      row_number() over (order by max(e.occurred_at) desc, e.session_id) as session_number,
      min(e.occurred_at) as first_seen,
      max(e.occurred_at) as last_seen,
      count(*) filter (where e.event_type = 'catalog_open') as catalog_opens,
      count(*) filter (where e.event_type = 'product_view') as product_views,
      count(*) filter (where e.event_type = 'product_click') as product_clicks
    from public.catalog_customer_events e
    where e.occurred_at >= v_start
    group by e.session_id
  ) s;

  return jsonb_build_object('totalSessions', coalesce(v_total,0), 'sessions', v_sessions);
end;
$function$;

revoke all on function public.catalog_customer_session_details(integer) from public, anon, authenticated;
grant execute on function public.catalog_customer_session_details(integer) to authenticated;
