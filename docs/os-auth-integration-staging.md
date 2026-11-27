# Brutti OS authentication integration — staging only

Status: design and preflight, not enabled in production. Existing Catalog password sign-in remains available. No production database/authentication changes authorized by this branch.

## Architecture
Keep the two Supabase projects and both application deployments independent. Evaluate OS Supabase Auth as an OAuth 2.1/OIDC identity provider and Catalog Supabase Auth as a custom OIDC client/provider integration, so Catalog issues its own sessions and retains its own staff roles and RLS. Do not accept OS tokens directly against Catalog data, copy passwords/password hashes, or use email alone as authorization. Existing Catalog super admin login remains an independent recovery path.

## Blocking preflight
OS GitHub Supabase config project ID differs from the OS project visible in the connected Supabase organization. Confirm the actual deployed OS project's URL from production deployment configuration, and verify ownership and auth settings before any provider changes. Do not infer identity from a project name. Check current signing key, OAuth server support, plan requirements, verified email and existing account linking behavior. Confirm whether enabling the provider can affect existing OS sessions and audit all OS policies for OAuth client restrictions before enabling.

## Security and rollout
1. Record production versions, auth settings and rollback steps; back up relevant configuration and membership records without exposing secrets.
2. In isolated test projects/environment, register a confidential OAuth client and custom OIDC provider with exact HTTPS callback allowlists and PKCE. Keep credentials server-side.
3. Use an explicit approved mapping between immutable OS user identifiers and Catalog identities. Do not automatically grant staff privileges after sign-in. Require Super Admin approval and enforce Catalog roles in server-owned membership tables and RLS. Review email matching/account linking and account recovery, staff departure and role revocation.
4. Test existing OS login/password reset, existing Catalog login/password reset, new OS-based sign-in, approved staff versus unapproved users, Editor/Admin/Super Admin permissions, public catalog, existing audit attribution, and expired/revoked sessions. Test outage of each site and each authentication provider independently. No production user password required for staging tests.
5. Gate the new login behind an opt-in feature flag, default off. Pilot with a designated test account only after approval and validated backups. Preserve the existing independent Catalog super admin credentials and a rollback by disabling new login/provider without modifying current accounts. Never silently fall back to a weaker authentication path.

## Documentation
- https://supabase.com/docs/guides/auth/oauth-server
- https://supabase.com/docs/guides/auth/custom-oauth-providers

A shared identity provider is a shared availability dependency for new OS-based sign-ins. Independent hosting and data stores limit the impact of failures but cannot guarantee zero downtime. Public catalog reads and local recovery login should remain independent of OS auth.
