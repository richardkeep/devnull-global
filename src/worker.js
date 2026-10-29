// Shared, best-effort edge cache for public dev/null relationship pages.
// No KV/D1 or paid Cloudflare services required.
const ORIGIN = 'https://dev-null.sh';
const PATH = /^\/api\/v1\/users\/([a-zA-Z0-9_-]{1,64})\/(following|followers)\/?$/;
const pending = new Map();
// Common coordinates shared across all visitors without external geocoding calls.
const COORDINATES = {
  'nairobi':[-1.2864,36.8172], 'nairobi, kenya':[-1.2864,36.8172],
  'kenya':[-0.0236,37.9062], 'mombasa':[-4.0435,39.6682],
  'london':[51.5074,-0.1278], 'london, uk':[51.5074,-0.1278],
  'new york':[40.7128,-74.006], 'new york, ny':[40.7128,-74.006],
  'san francisco':[37.7749,-122.4194], 'san francisco, ca':[37.7749,-122.4194],
  'lagos':[6.5244,3.3792], 'lagos, nigeria':[6.5244,3.3792],
  'kampala':[0.3476,32.5825], 'kampala, uganda':[0.3476,32.5825],
  'dar es salaam':[-6.7924,39.2083], 'dar es salaam, tanzania':[-6.7924,39.2083],
  'berlin':[52.52,13.405], 'paris':[48.8566,2.3522],
  'toronto':[43.6532,-79.3832], 'sydney':[-33.8688,151.2093],
  'tokyo':[35.6762,139.6503], 'bengaluru':[12.9716,77.5946],
  'bangalore':[12.9716,77.5946], 'mumbai':[19.076,72.8777],
  'delhi':[28.6139,77.209], 'new delhi':[28.6139,77.209],
  'india':[20.5937,78.9629], 'united states':[39.8283,-98.5795],
  'usa':[39.8283,-98.5795], 'united kingdom':[55.3781,-3.436],
  'uk':[55.3781,-3.436], 'germany':[51.1657,10.4515],
  'france':[46.6034,1.8883], 'canada':[56.1304,-106.3468],
  'south africa':[-30.5595,22.9375], 'johannesburg':[-26.2041,28.0473],
  'cape town':[-33.9249,18.4241], 'accra':[5.6037,-0.187],
  'ghana':[7.9465,-1.0232], 'nigeria':[9.082,8.6753],
  'uganda':[1.3733,32.2903], 'tanzania':[-6.369,34.8888],
  'kigali':[-1.9441,30.0619], 'rwanda':[-1.9403,29.8739],
  'singapore':[1.3521,103.8198], 'dubai':[25.2048,55.2708],
  'seattle':[47.6062,-122.3321], 'austin':[30.2672,-97.7431],
  'chicago':[41.8781,-87.6298], 'los angeles':[34.0522,-118.2437],
  'amsterdam':[52.3676,4.9041], 'lisbon':[38.7223,-9.1393],
  'madrid':[40.4168,-3.7038], 'rome':[41.9028,12.4964]
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/geocode') {
      if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      const location = (url.searchParams.get('q') || '').trim().toLowerCase().replace(/\\s+/g, ' ');
      const point = COORDINATES[location];
      return Response.json(point ? { lat: point[0], lng: point[1] } : null, {
        headers: { 'Cache-Control': 'public, max-age=86400', 'X-Globe-Geocode': point ? 'DICTIONARY' : 'UNKNOWN' }
      });
    }
    if (!url.pathname.startsWith('/api/v1/users/')) return env.ASSETS.fetch(request);
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    if (!PATH.test(url.pathname)) return new Response('Not found', { status: 404 });
    // Reject unbounded queries, but preserve cursor and pagination parameters.
    if (url.search.length > 2048) return new Response('Query too long', { status: 414 });
    const upstream = new URL(url.pathname + url.search, ORIGIN);
    const key = new Request(upstream.toString(), { method: 'GET' });
    const cache = caches.default;
    const cached = await cache.match(key);
    if (cached) {
      const response = new Response(cached.body, cached);
      response.headers.set('X-Globe-Cache', 'HIT');
      return response;
    }
    const cacheKey = upstream.toString();
    if (pending.has(cacheKey)) return (await pending.get(cacheKey)).clone();
    const task = (async () => {
      const response = await fetch(upstream, {
        headers: { Accept: 'application/json' },
        redirect: 'error'
      });
      if (!response.ok || !(response.headers.get('content-type') || '').includes('json')) {
        return new Response(response.body, {
          status: response.status,
          headers: {
            'Content-Type': response.headers.get('content-type') || 'text/plain',
            ...(response.headers.get('retry-after') ? { 'Retry-After': response.headers.get('retry-after') } : {}),
            'Cache-Control': 'no-store',
            'X-Globe-Cache': 'BYPASS'
          }
        });
      }
      // Per-key jitter avoids simultaneous expiry after a deploy or cold cache.
      const ttl = 1500 + Math.floor(Math.random() * 601); // 25–35 minutes
      const result = new Response(response.body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=0, must-revalidate',
          'X-Globe-Cache': 'MISS'
        }
      });
      const stored = new Response(result.body, result);
      stored.headers.set('Cache-Control', `public, max-age=${ttl}`);
      ctx.waitUntil(cache.put(key, stored));
      return result;
    })();
    pending.set(cacheKey, task);
    try { return (await task).clone(); }
    finally { pending.delete(cacheKey); }
  }
};
