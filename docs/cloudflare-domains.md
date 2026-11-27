# Brutti Catalog custom domains

This repository supports one Cloudflare Pages static deployment serving both
`https://catalog.brutti.my/` (customers) and
`https://admincatalog.brutti.my/` (staff). Product links use `/product/<id>`.
The existing `https://brutti-team.github.io/catalog/#/catalog` and `#/admin`
links retain their existing fragment routing and GitHub Pages deployment.

## Deployment settings

Create a **Pages** project with Git integration, on the **Free plan**:

| Setting | Value |
| --- | --- |
| Repository | `Brutti-team/catalog` |
| Production branch | `main` |
| Requested project name | `brutti-catalog` |
| Framework preset | None |
| Root directory | Repository root |
| Build command | `npm run build:cloudflare` |
| Build output directory | `dist` |
| Node.js | `24` (also declared in `.node-version`) |

Select **Pages**, not a Worker. No Pages Functions, paid plan, new database,
Lovable service, storage binding, or new Supabase project is needed.
Limit the Cloudflare GitHub integration to this repository when selecting access.

The build wrapper embeds the same existing **public** Supabase URL and
publishable browser key as the GitHub Pages workflow. No secret is needed in
Cloudflare. An override pointing to another database is rejected. The wrapper
forces a root asset base; `build:pages` and the existing workflow still use
`/catalog/`. Do not set service-role keys or private tokens as `VITE_*` values.

Keep preview branch builds disabled unless needed to conserve the Free plan's
build quota. The current artifact has 77 static files; its largest file is
7.6 MB, within the Free plan's 20,000-file/25 MiB per-file limits.

## Activate domains and ClouDNS records

1. Wait for the first Pages production deployment to succeed. Record the
   **actual production `*.pages.dev` hostname returned by Cloudflare**.
   `brutti-catalog.pages.dev` is the requested name, not a reserved or verified
   deployment. If Cloudflare assigns a different project name, update the name
   in `wrangler.toml` to match that project.
2. In that project's **Custom domains**, add `catalog.brutti.my` and
   `admincatalog.brutti.my` before adding their DNS records.
3. Export/record the current ClouDNS zone before editing. In the `brutti.my`
   zone, add exactly these two CNAME records using the hostname from step 1:

| Type | ClouDNS Host | Target | TTL |
| --- | --- | --- | --- |
| CNAME | `catalog` | Actual production Pages hostname, with a final `.` | 300 |
| CNAME | `admincatalog` | The same actual production Pages hostname, with a final `.` | 300 |

For example, **only if Cloudflare actually returns `brutti-catalog.pages.dev`**,
both targets are `brutti-catalog.pages.dev.`. Never enter a scheme, path, or hash
in a CNAME target. A hostname assigned to another account must not be used.

4. Wait for **both custom domains to show Active**, including certificate
   issuance. Check HTTPS in a browser and the HTTP-to-HTTPS redirect before
   sharing the new links.

ClouDNS remains authoritative. Do not change nameservers, the apex `brutti.my`,
mail records, or any Brutti OS records. Do not set a custom domain on GitHub
Pages or add a GitHub `CNAME` file: the old GitHub URLs must keep working.

Cloudflare's native SPA fallback serves direct product paths and refreshes;
the artifact deliberately has no root `404.html`. Section anchors still work.

## Supabase authentication URLs

Use **Brutti Catalog**, project `lgdjoxafleqnbomtfzqt`, and its
[Authentication → URL Configuration](https://supabase.com/dashboard/project/lgdjoxafleqnbomtfzqt/auth/url-configuration).

Record the current Site URL and Redirect URLs before editing. Append these
exact redirect entries while retaining every existing entry:

```text
https://admincatalog.brutti.my/
https://admincatalog.brutti.my/?auth=recovery
https://brutti-team.github.io/catalog/
https://brutti-team.github.io/catalog/?auth=recovery
```

After the admin domain's HTTPS is active, set **Site URL** to:

```text
https://admincatalog.brutti.my/
```

Keep any existing direct `/catalog/admin/` callback entries as well. Do not
allow arbitrary preview origins or wildcard `*.pages.dev` auth callbacks.
If a trusted Pages preview needs password-reset testing, add only that
project's exact `/admin?auth=recovery` URL, then remove it when finished.

Password login continues using the existing Supabase Auth accounts and
`catalog_admins`/staff-role checks. Staff sign in once on the new domain;
browser sessions, themes and device-local favourites are scoped to an origin
and do not automatically transfer from the old host. Their features remain
available. Supabase callback fragments are preserved for the SDK to process.

The existing staff-invitation and optional 3D edge functions additionally allow
the exact new staff origin, retaining all previous authentication/role checks.
Invitations from GitHub Pages retain their old callback; invitations from the
new staff domain return there. Do not open CORS to arbitrary origins. The
existing optional 3D service is not invoked or purchased by this migration.

## Backups and rollback

- Source and deployed edge-function source before changes:
  `backup/pre-cloudflare-domains-2026-11-27-21e3a40`, commit
  `21e3a406afcadcfd3ae2207efa17879749506e84`.
- A Git bundle was also created before editing.
- `Brutti-Catalog-Backup-2026-11-27.json` contains all 96 products, 9 categories,
  existing public/storage RLS policies, and a manifest of 221 storage objects.
  This is a catalog data snapshot, not a full Postgres/Auth backup or a copy of
  storage-object bytes. The underlying data, accounts and image/model objects
  are not moved or modified by this migration.
- Record/export DNS and Auth URL settings before applying their manual steps.

If the new deployment fails, continue using GitHub Pages. Revert the migration
commit if code rollback is needed; restore the saved Auth URL settings and
only the two new CNAME records if necessary. Do not restore the old data
snapshot over products that staff have edited since the snapshot.

## Verification

Automated domain browser tests simulate the two hostnames against a production
build with a mocked backend and font-network requests. They cover desktop/phone layouts, clean links,
product images, product refresh/back navigation, staff sign-in/session reload,
invalid-login rejection, preview paths and legacy links. They do not establish
that the real custom domains, certificates or production user login are live.

Validated locally: 86 focused unit checks and all 7 domain browser scenarios
passed, with no uncaught application exceptions or unexpected application/API
network errors in those scenarios. Google Fonts requests are stubbed in this
isolated test runner; the production styles and font declarations are unchanged.
Run `npm run build:cloudflare`, then `npm run test:domains` (install the
Playwright Chromium browser first if needed).

Before declaring the migration complete, verify the following on the real
custom domains after activation:

1. Open both HTTPS roots on desktop and phone. Confirm layout/design matches
   the existing catalog and there is no horizontal overflow.
2. Open a product; confirm the URL is `/product/<id>` without `#/catalog`,
   images load, refresh/back work, and search, favourites, enquiry and PDF
   download still work. Confirm normal section anchors still scroll.
3. Sign in with an existing authorised staff account on the admin root, reload,
   open Products/Categories/Album/Account Permission, then sign out. Confirm
   anonymous/unauthorised users cannot open the dashboard or read drafts.
4. Inspect DevTools **Console** for uncaught exceptions and **Network** for
   failed assets, CORS failures, and Supabase `401`/`403`/`5xx` responses.
   A rejected invalid-password test should return the expected `400`.
5. Test a password-reset email and an authorised staff invitation after the
   redirect allowlist is saved. Do not grant roles or change passwords merely
   to test the migration without the account owner's participation.
6. Check Catalog-only Supabase logs for `42501`, permission-denied and RLS
   failures. RLS stays enabled; do not broaden policies to address routing.
   Public API reads should expose published products only.
7. Confirm the old GitHub Pages public/admin links, all product images, and
   existing staff login continue working.

Observed before activation: the live public API returned 45 published products
and 9 categories, with no drafts visible. All 58 distinct published-product
image URLs returned HTTP 200. Existing RLS rules restrict writes to catalog
admins. No recent RLS/permission-denied errors were found in the checked logs.
The full unit suite has 3 pre-existing failures (old WhatsApp/3D label
expectations), reproduced against the unchanged backup commit; do not change
the approved product design/copy to satisfy these stale expectations.

References: [Cloudflare custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/),
[SPA fallback](https://developers.cloudflare.com/pages/configuration/serving-pages/),
[Pages limits](https://developers.cloudflare.com/pages/platform/limits/),
[Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
