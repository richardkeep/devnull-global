// Shared, best-effort edge cache for public dev/null relationship pages.
// No KV/D1 or paid Cloudflare services required.
const ORIGIN = 'https://dev-null.sh';
const PATH = /^\/api\/v1\/users\/([a-zA-Z0-9_-]{1,64})\/(following|followers)\/?$/;
const pending = new Map();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
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
