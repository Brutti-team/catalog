import { expect, it } from 'vitest';
// @ts-expect-error Native build module intentionally has no browser declaration.
import { cloudflareBuildEnv } from '../scripts/cloudflare-config.mjs';
import { catalogInvitationHeaders, catalogInvitationRedirect, catalogStaffOriginAllowed } from '../supabase/functions/_shared/catalog-origins';

it('isolates the Cloudflare root build from existing GitHub Pages settings', () => {
  const env = cloudflareBuildEnv({ GITHUB_PAGES: 'true', VITE_BASE_PATH: '/catalog/' });
  expect(env.VITE_BASE_PATH).toBe('/');
  expect(env.GITHUB_PAGES).toBe('false');
  expect(env.VITE_SUPABASE_URL).toBe('https://lgdjoxafleqnbomtfzqt.supabase.co');
  expect(env.VITE_SUPABASE_PUBLISHABLE_KEY).toMatch(/^sb_publishable_/);
});

it('refuses a database change during domain deployment', () => {
  expect(() => cloudflareBuildEnv({ VITE_SUPABASE_URL: 'https://other.supabase.co' })).toThrow('existing Brutti Catalog');
});

it.each(['https://brutti-team.github.io', 'https://admincatalog.brutti.my'])(
  'keeps invitation CORS and redirect tied to the authorised origin %s', origin => {
    expect(catalogStaffOriginAllowed(origin)).toBe(true);
    expect(catalogInvitationHeaders(origin)['Access-Control-Allow-Origin']).toBe(origin);
    expect(catalogInvitationRedirect(origin)).toBe(origin === 'https://brutti-team.github.io' ? `${origin}/catalog/` : `${origin}/`);
  },
);

it.each(['https://evil.test', 'https://admincatalog.brutti.my.evil.test', 'https://unverified.pages.dev', 'null'])(
  'rejects unapproved invitation origins: %s', origin => {
    expect(catalogStaffOriginAllowed(origin)).toBe(false);
    expect(catalogInvitationHeaders(origin)['Access-Control-Allow-Origin']).not.toBe(origin);
  },
);
