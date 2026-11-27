import { PROJECT_URL } from '../scripts/backend-config.mjs';
import { PUBLIC_BROWSER_KEY } from '../scripts/cloudflare-config.mjs';

const origin = "https://catalog.brutti.my";
function sitemapXml(rows) {
  const ids=[...new Set(rows.filter(row=>typeof row.id==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id)).map(row=>row.id))];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+[`${origin}/`,...ids.map(id=>`${origin}/product/${encodeURIComponent(id)}`)].map(url=>`  <url><loc>${url}</loc></url>`).join('\n')+'\n</urlset>\n';
}
async function publishedRows(fetcher, project, key) {
  const rows=[];
  for(let offset=0;offset<49000;offset+=500){
    const response=await fetcher(`${project}/rest/v1/products?select=id&status=eq.published&order=id.asc&limit=500&offset=${offset}`,{headers:{apikey:key,Accept:"application/json"},signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error("Published catalog unavailable");
    const batch=await response.json();
    if(!Array.isArray(batch)||batch.length>500)throw new Error("Invalid catalog response");
    rows.push(...batch);
    if(batch.length<500)return rows;
  }
  throw new Error("Catalog exceeds sitemap pagination limit");
}

export async function onRequest({ request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, {status: 405, headers: {Allow: 'GET, HEAD'}});
  if (new URL(request.url).origin !== origin) return new Response(null, {status: 404, headers: {'X-Robots-Tag': 'noindex'}});
  try {
    const rows = await publishedRows(fetch, PROJECT_URL, PUBLIC_BROWSER_KEY);
    return new Response(request.method === 'HEAD' ? null : sitemapXml(rows), {headers: {'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300'}});
  } catch {
    return new Response('Sitemap temporarily unavailable', {status: 503, headers: {'Retry-After': '300', 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8'}});
  }
}
