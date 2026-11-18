-- Applied to Brutti Catalog Supabase on 2026-11-18.
-- The OS and Catalog Auth projects are separate: do not copy passwords or OS roles here.
-- Account Permission role management is enforced server side.

create table if not exists public.catalog_staff_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'admin', 'editor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.catalog_staff_roles enable row level security;
revoke all on table public.catalog_staff_roles from anon, authenticated;
grant select on public.catalog_staff_roles to authenticated;
drop policy if exists "Read own catalog staff role" on public.catalog_staff_roles;
create policy "Read own catalog staff role"
on public.catalog_staff_roles for select to authenticated
using (user_id = (select auth.uid()));

-- The existing Catalog administrator is the only account that can bootstrap Super Admin.
insert into public.catalog_staff_roles(user_id,role)
select u.id, 'super_admin' from auth.users u
join public.catalog_admins ca on ca.user_id=u.id
where lower(u.email)='integrator.brutti@gmail.com'
on conflict(user_id) do update set role='super_admin',updated_at=now();

create or replace function public.catalog_my_role()
returns text language sql stable security invoker set search_path=''
as $$
  select r.role from public.catalog_staff_roles r
  where r.user_id=(select auth.uid()) limit 1;
$$;

-- SECURITY DEFINER is needed only for a role-checked, limited account directory.
-- Without the explicit EXISTS test, NULL roles might accidentally pass an IF NOT IN.
create or replace function public.catalog_list_staff()
returns table(user_id uuid,email text,display_name text,role text,last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
begin
  if not exists (
    select 1 from public.catalog_staff_roles r
    where r.user_id=(select auth.uid())
      and r.role in ('admin','super_admin')
  ) then
    raise exception 'Account Permission is available to Catalog Admin and Super Admin only.' using errcode='42501';
  end if;
  return query
  select u.id,u.email::text,
    coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'),''),split_part(u.email,'@',1))::text,
    r.role,u.last_sign_in_at
  from auth.users u
  left join public.catalog_staff_roles r on r.user_id=u.id
  where r.user_id is not null
     or exists (select 1 from public.catalog_admins ca where ca.user_id=u.id)
  order by lower(coalesce(u.raw_user_meta_data->>'full_name',u.email));
end;
$$;

-- Only a verified Catalog Super Admin may change role assignments.
create or replace function public.catalog_set_staff_role(p_user_id uuid,p_role text)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if not exists (
    select 1 from public.catalog_staff_roles r
    where r.user_id=(select auth.uid()) and r.role='super_admin'
  ) then
    raise exception 'Only a Catalog Super Admin may change roles.' using errcode='42501';
  end if;
  if p_user_id is null or p_user_id=(select auth.uid()) then
    raise exception 'Cannot change your own role or an empty user.' using errcode='22023';
  end if;
  if p_role is not null and p_role not in ('super_admin','admin','editor') then
    raise exception 'Invalid catalog role.' using errcode='22023';
  end if;
  if not exists (select 1 from auth.users u where u.id=p_user_id) then
    raise exception 'Catalog authentication account not found.' using errcode='22023';
  end if;

  if p_role is null then
    delete from public.catalog_staff_roles where user_id=p_user_id;
    delete from public.catalog_admins where user_id=p_user_id;
  else
    insert into public.catalog_staff_roles(user_id,role) values (p_user_id,p_role)
    on conflict(user_id) do update set role=excluded.role,updated_at=now();
    insert into public.catalog_admins(user_id) values (p_user_id)
    on conflict(user_id) do nothing;
  end if;
end;
$$;

revoke all on function public.catalog_my_role() from public,anon;
revoke all on function public.catalog_list_staff() from public,anon;
revoke all on function public.catalog_set_staff_role(uuid,text) from public,anon;
grant execute on function public.catalog_my_role() to authenticated;
grant execute on function public.catalog_list_staff() to authenticated;
grant execute on function public.catalog_set_staff_role(uuid,text) to authenticated;
notify pgrst, 'reload schema';
