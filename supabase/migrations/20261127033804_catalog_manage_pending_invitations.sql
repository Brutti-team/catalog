create or replace function public.catalog_edit_pending_staff(p_candidate_id uuid,p_display_name text,p_email text,p_role text)
returns void language plpgsql security definer set search_path='' as $fn$
declare normalized_email text := nullif(lower(trim(p_email)), '');
begin
  if not exists(select 1 from public.catalog_staff_roles r where r.user_id=(select auth.uid()) and r.role='super_admin') then
    raise exception 'Super Admin permission required.' using errcode='42501';
  end if;
  if p_display_name is null or length(trim(p_display_name)) not between 2 and 100 or p_role is null or p_role not in ('admin','editor') then
    raise exception 'Enter a valid name and access role.' using errcode='22023';
  end if;
  if normalized_email is not null and (length(normalized_email)>254 or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then
    raise exception 'Enter a valid email address.' using errcode='22023';
  end if;
  if normalized_email is not null and exists(select 1 from auth.users u where lower(u.email)=normalized_email) then
    raise exception 'This email already belongs to a Catalog account.' using errcode='23505';
  end if;
  if normalized_email is not null and exists(select 1 from public.catalog_staff_candidates c where lower(c.email)=normalized_email and c.id<>p_candidate_id) then
    raise exception 'This email is already in pending invitations.' using errcode='23505';
  end if;
  update public.catalog_staff_candidates c set display_name=trim(p_display_name),email=normalized_email,proposed_role=p_role,updated_at=now()
  where c.id=p_candidate_id and (c.email is null or not exists(select 1 from auth.users u where lower(u.email)=lower(c.email)));
  if not found then raise exception 'Pending invitation no longer exists or has already been invited.' using errcode='P0002'; end if;
end;
$fn$;
create or replace function public.catalog_delete_pending_staff(p_candidate_id uuid)
returns void language plpgsql security definer set search_path='' as $fn$
begin
  if not exists(select 1 from public.catalog_staff_roles r where r.user_id=(select auth.uid()) and r.role='super_admin') then
    raise exception 'Super Admin permission required.' using errcode='42501';
  end if;
  delete from public.catalog_staff_candidates c where c.id=p_candidate_id and (c.email is null or not exists(select 1 from auth.users u where lower(u.email)=lower(c.email)));
  if not found then raise exception 'Pending invitation no longer exists or has already been invited.' using errcode='P0002'; end if;
end;
$fn$;
revoke all on function public.catalog_edit_pending_staff(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.catalog_delete_pending_staff(uuid) from public,anon,authenticated;
grant execute on function public.catalog_edit_pending_staff(uuid,text,text,text) to authenticated;
grant execute on function public.catalog_delete_pending_staff(uuid) to authenticated;
notify pgrst,'reload schema';
