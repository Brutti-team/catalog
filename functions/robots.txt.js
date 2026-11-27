export function onRequest({ request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, {status: 405, headers: {Allow: 'GET, HEAD'}});
  const isPublic = new URL(request.url).origin === 'https://catalog.brutti.my';
  // Allow crawling so search engines can see the staff site's noindex header.
  const body = 'User-agent: *\nAllow: /\n' + (isPublic ? 'Sitemap: https://catalog.brutti.my/sitemap.xml\n' : '');
  return new Response(request.method === 'HEAD' ? null : body, {headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300', ...(!isPublic ? {'X-Robots-Tag': 'noindex'} : {})}});
}
