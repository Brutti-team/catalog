# Invitation backend permission repair — 27 November 2026

Applied to Catalog database only after verifying the existing service_role lacked SELECT, INSERT and UPDATE privileges on the role/membership tables and SELECT/UPDATE on candidates. The Edge Function verifies the caller's JWT and Super Admin membership before granting access. Restore only the privileges required by that server function:

```sql
grant select, insert, update on table public.catalog_staff_roles, public.catalog_admins to service_role;
grant select, update on table public.catalog_staff_candidates to service_role;
```

Post-change checks confirmed RLS remains enabled on all three tables and neither anon nor authenticated received UPDATE privileges. No account or role records were changed. Do not grant these writes to browser roles. Verify an actual invitation with a designated recipient before bulk inviting. Rollback of the added server grants (only if necessary) restores the prior broken state:

```sql
revoke select, insert, update on table public.catalog_staff_roles, public.catalog_admins from service_role;
revoke select, update on table public.catalog_staff_candidates from service_role;
```
