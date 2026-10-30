import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

for (const path of ['/api/v1/users/tom', '/api/v1/users/tom/followers', '/api/v1/users/tom/following?page=2']) {
  test(`proxies and caches ${path}`, async t => {
    const originalFetch = globalThis.fetch;
    const originalCaches = globalThis.caches;
    t.after(() => { globalThis.fetch = originalFetch; globalThis.caches = originalCaches; });
    const entries = new Map();
    globalThis.caches = {default: {
      match: async request => entries.get(request.url)?.clone(),
      put: async (request, response) => { entries.set(request.url, response); }
    }};
    let requests = 0;
    globalThis.fetch = async url => {
      requests++;
      assert.equal(url.href, 'https://dev-null.sh' + path);
      return Response.json({data: {handle: 'tom', commits_count: 1594}});
    };
    const pending = [];
    const request = new Request('https://globe.example' + path);
    const ctx = {waitUntil: promise => pending.push(promise)};
    const first = await worker.fetch(request, {}, ctx);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('X-Globe-Cache'), 'MISS');
    assert.equal((await first.json()).data.commits_count, 1594);
    await Promise.all(pending);
    const second = await worker.fetch(request, {}, ctx);
    assert.equal(second.headers.get('X-Globe-Cache'), 'HIT');
    assert.equal((await second.json()).data.commits_count, 1594);
    assert.equal(requests, 1);
  });
}

test('rejects unexpected profile routes and methods', async () => {
  for (const path of ['/api/v1/users/tom/settings', '/api/v1/users/tom/followers/settings']) {
    const response = await worker.fetch(new Request('https://globe.example' + path), {}, {});
    assert.equal(response.status, 404);
  }
  const response = await worker.fetch(new Request('https://globe.example/api/v1/users/tom', {method: 'POST'}), {}, {});
  assert.equal(response.status, 405);
});
