// Shared, best-effort edge cache for public dev/null profiles, plus a pass-through for signed requests.
// No KV/D1 or paid Cloudflare services required.
const ORIGIN = 'https://dev-null.sh';
const PATH = /^\/api\/v1\/users\/([a-zA-Z0-9_-]{1,64})(?:\/(following|followers))?\/?$/;
const DEVICES_PATH = '/api/v1/devices';
const SIGNATURE_HEADERS = ['X-Devnull-Timestamp', 'X-Devnull-Nonce', 'X-SSH-Signature'];
const pending = new Map();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === DEVICES_PATH) {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      return passThrough(request, new URL(DEVICES_PATH, ORIGIN));
    }
    if (!url.pathname.startsWith('/api/v1/users/')) return env.ASSETS.fetch(request);
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    if (!PATH.test(url.pathname)) return new Response('Not found', { status: 404 });
    // Reject unbounded queries, but preserve cursor and pagination parameters.
    if (url.search.length > 2048) return new Response('Query too long', { status: 414 });
    const upstream = new URL(url.pathname + url.search, ORIGIN);
    // Signed requests see members-only data, and each signature can be used only once, so they skip the cache.
    if (SIGNATURE_HEADERS.some(name => request.headers.has(name))) return passThrough(request, upstream);
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
        redirect: 'follow'
      });
      if (!response.ok || !(response.headers.get('content-type') || '').includes('json')) return uncached(response, true);
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
      // Clone before caching: reusing result.body directly can lock its stream,
      // causing the response returned to the browser to fail with HTTP 502.
      const stored = result.clone();
      stored.headers.set('Cache-Control', `public, max-age=${ttl}`);
      ctx.waitUntil(cache.put(key, stored).catch(error => {
        console.warn('Globe cache write failed:', error);
      }));
      return result;
    })();
    pending.set(cacheKey, task);
    try { return (await task).clone(); }
    catch (error) { return proxyError(error); }
    finally { pending.delete(cacheKey); }
  }
};

// Forwards a signed request untouched: the signature covers the method, path, query and body.
async function passThrough(request, upstream) {
  const headers = { Accept: 'application/json' };
  for (const name of [...SIGNATURE_HEADERS, 'Content-Type']) {
    if (request.headers.has(name)) headers[name] = request.headers.get(name);
  }
  try {
    const response = await fetch(upstream, {
      method: request.method, headers, redirect: 'manual',
      body: request.method === 'GET' ? undefined : await request.text()
    });
    return uncached(response, !response.ok);
  } catch (error) { return proxyError(error); }
}

function uncached(response, isError) {
  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') || 'text/plain',
      ...(response.headers.get('retry-after') ? { 'Retry-After': response.headers.get('retry-after') } : {}),
      'Cache-Control': 'no-store',
      'X-Globe-Cache': 'BYPASS',
      ...(isError ? { 'X-Globe-Error-Source': 'origin' } : {})
    }
  });
}

function proxyError(error) {
  console.error('Globe proxy error:', error);
  const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return Response.json({ error: 'Cloudflare proxy request failed', detail: reason }, {
    status: 502,
    headers: { 'Cache-Control': 'no-store', 'X-Globe-Error-Source': 'worker' }
  });
}
