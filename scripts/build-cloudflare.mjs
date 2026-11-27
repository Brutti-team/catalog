import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { cloudflareBuildEnv } from './cloudflare-config.mjs';

const result = spawnSync('npm', ['run', 'build'], {
  env: cloudflareBuildEnv(), stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

if (result.status === 0) {
  // Only the Cloudflare root artifact gets network hints; the legacy
  // site-assembly contract requires all href attributes to be local assets.
  const html = await readFile('dist/index.html', 'utf8');
  await writeFile('dist/index.html', html.replace('<head>', '<head><link rel="dns-prefetch" href="//lgdjoxafleqnbomtfzqt.supabase.co"/><link rel="preconnect" href="https://lgdjoxafleqnbomtfzqt.supabase.co" crossorigin/>'));
  // Static fallback remains valid even if Functions are unavailable.
  await Promise.all([
    writeFile('dist/sitemap.xml', "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n  <url><loc>https://catalog.brutti.my/</loc></url>\n</urlset>\n"),
    writeFile('dist/robots.txt', 'User-agent: *\nAllow: /\nSitemap: https://catalog.brutti.my/sitemap.xml\n'),
    writeFile('dist/_routes.json', JSON.stringify({version: 1, include: ['/sitemap.xml', '/robots.txt'], exclude: []})),
    writeFile('dist/_headers', 'https://admincatalog.brutti.my/*\n  X-Robots-Tag: noindex, nofollow\nhttps://catalog.brutti.my/admin\n  X-Robots-Tag: noindex, nofollow\nhttps://catalog.brutti.my/admin/*\n  X-Robots-Tag: noindex, nofollow\nhttps://:project.pages.dev/*\n  X-Robots-Tag: noindex, nofollow\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n'),
  ]);
}
