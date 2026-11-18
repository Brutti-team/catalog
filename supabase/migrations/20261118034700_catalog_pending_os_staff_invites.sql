-- Stages minimal OS staff contact data for optional Catalog Auth invitations.
-- IMPORTANT: OS and Catalog Auth are not SSO-linked. Never copy passwords.
-- Do not commit employees' private email addresses into a public repository.
create table if not exists public.catalog_staff_candidates (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(trim(display_name)) between 2 and 100),
  email text unique,
  proposed_role text not null check (proposed_role in ('admin','editor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.catalog_staff_candidates enable row level security;
revoke all on table public.catalog_staff_candidates from public, anon, authenticated;

create or replace function public.catalog_list_pending_staff()
returns table(candidate_id uuid,display_name text,email text,proposed_role text)
language plpgsql stable security definer set search_path=''
as $fn$
begin
  if not exists (
    select 1 from public.catalog_staff_roles r
    where r.user_id=(select auth.uid()) and r.role in ('super_admin','admin')
  ) then
    raise exception 'Catalog admin permission required.' using errcode='42501';
  end if;
  return query
    select c.id,c.display_name,c.email,c.proposed_role
    from public.catalog_staff_candidates c
    where c.email is null or not exists (
      select 1 from auth.users u where lower(u.email) = lower(c.email)
    )
    order by case c.proposed_role when 'admin' then 0 else 1 end, c.display_name;
end;
$fn$;
revoke all on function public.catalog_list_pending_staff() from public, anon;
grant execute on function public.catalog_list_pending_staff() to authenticated;
notify pgrst, 'reload schema';
