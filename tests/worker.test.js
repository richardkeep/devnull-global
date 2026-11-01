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

test('forwards signed follow-list requests without caching them', async t => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  t.after(() => { globalThis.fetch = originalFetch; globalThis.caches = originalCaches; });
  globalThis.caches = {default: {
    match: async () => assert.fail('signed requests must not read the cache'),
    put: async () => assert.fail('signed requests must not be cached')
  }};
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({url: url.href, headers: init.headers});
    return Response.json({data: []});
  };
  const signature = {'X-Devnull-Timestamp': '1793558244', 'X-Devnull-Nonce': 'a'.repeat(32), 'X-SSH-Signature': 'U1NIU0lH'};
  for (let i = 0; i < 2; i++) {
    const response = await worker.fetch(new Request('https://globe.example/api/v1/users/tom/following?cursor=abc%3D', {
      headers: {...signature, Cookie: 'secret=1'}
    }), {}, {waitUntil: () => {}});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Globe-Cache'), 'BYPASS');
  }
  assert.equal(seen.length, 2);
  assert.equal(seen[0].url, 'https://dev-null.sh/api/v1/users/tom/following?cursor=abc%3D');
  assert.deepEqual(seen[0].headers, {Accept: 'application/json', ...signature});
});

test('forwards device sign-in with its signed body', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const body = JSON.stringify({code: 'abc', code_verifier: 'v'.repeat(43)});
  globalThis.fetch = async (url, init) => {
    assert.equal(url.href, 'https://dev-null.sh/api/v1/devices');
    assert.equal(init.method, 'POST');
    assert.equal(init.body, body);
    assert.equal(init.headers['Content-Type'], 'application/json');
    assert.equal(init.headers['X-SSH-Signature'], 'sig');
    return Response.json({message: 'expired', code: 'invalid_grant'}, {status: 400});
  };
  const response = await worker.fetch(new Request('https://globe.example/api/v1/devices', {
    method: 'POST', body, headers: {'Content-Type': 'application/json', 'X-SSH-Signature': 'sig'}
  }), {}, {});
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'invalid_grant');
  const get = await worker.fetch(new Request('https://globe.example/api/v1/devices'), {}, {});
  assert.equal(get.status, 405);
});
