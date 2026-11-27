import { PROJECT_URL } from './backend-config.mjs';

// The same PUBLIC browser configuration as the existing GitHub Pages workflow.
// This is intentionally public; never put a secret/service-role key here.
export const CLOUDFLARE_PROJECT = 'brutti-catalog';
export const PUBLIC_BROWSER_KEY = 'sb_publishable_E5-tPfhYUXJ4pLVIv-oKQQ_T4T2J-VR';

export function cloudflareBuildEnv(env = process.env) {
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_URL !== PROJECT_URL)
    throw new Error('Cloudflare must use the existing Brutti Catalog Supabase project.');
  return {
    ...env,
    GITHUB_PAGES: 'false',
    VITE_BASE_PATH: '/',
    VITE_SUPABASE_URL: PROJECT_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      (env.VITE_SUPABASE_ANON_KEY ? '' : PUBLIC_BROWSER_KEY),
  };
}
