import {fingerprint, generateKeyPair, pkcePair, randomHex, signatureHeaders} from './ssh-signing.js';

// dev/null only hands sign-in codes back to its own app scheme or a loopback address. When the globe
// runs on 127.0.0.1 the code comes straight back here; anywhere else, it lands on a loopback page that
// doesn't load and the person pastes that address back in.
const AUTHORIZE_URL = 'https://dev-null.sh/mobile/authorize';
const PASTE_REDIRECT_URI = 'http://127.0.0.1:43517/devnull-globe';
const DB_NAME = 'dev-null-globe-auth';
const STORE = 'keys';
const CALLBACK_PARAMS = ['code', 'state', 'error'];
// Pending sign-ins older than this are treated as abandoned.
const PENDING_TTL_MS = 30 * 60 * 1000;

export class AuthError extends Error {
  constructor(message, code = '') {
    super(message);
    this.code = code;
  }
}

function withStore(mode, action) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => { db.close(); resolve(request?.result); };
      transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error); };
    };
  });
}

// CryptoKey objects are stored as-is: IndexedDB keeps them usable without ever exposing the private key.
const read = key => withStore('readonly', store => store.get(key));
const write = (key, value) => withStore('readwrite', store => store.put(value, key));
const remove = key => withStore('readwrite', store => store.delete(key));

// True when dev/null can send the sign-in code straight back to this page.
export const signInReturnsHere = () => location.protocol === 'http:' && location.hostname === '127.0.0.1';

function deviceName() {
  const agent = navigator.userAgent;
  const browser = /Edg\//.test(agent) ? 'Edge' : /Firefox\//.test(agent) ? 'Firefox' :
    /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : 'Browser';
  const platform = /iPhone|iPad/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android' :
    /Mac/.test(agent) ? 'macOS' : /Windows/.test(agent) ? 'Windows' : /Linux/.test(agent) ? 'Linux' : '';
  return platform ? `${browser} on ${platform}` : browser;
}

// The current address without any sign-in callback parameters.
function currentAddress() {
  const params = new URLSearchParams(location.search);
  CALLBACK_PARAMS.forEach(name => params.delete(name));
  const search = params.toString();
  return location.pathname + (search ? '?' + search : '');
}

let device;

// Returns the signed-in user, and whether a sign-in is waiting for its code to be pasted back.
export async function loadDevice() {
  const [stored, pending] = await Promise.all([read('device'), read('pending')]);
  device = stored || null;
  return {user: device?.user || null, pending: Boolean(pending && Date.now() - pending.createdAt < PENDING_TTL_MS)};
}

// Creates a key for this browser and returns the dev/null page that approves it.
export async function beginSignIn() {
  if (!globalThis.crypto?.subtle) throw new AuthError('Signing in needs a secure (https) connection.');
  let keys;
  try { keys = await generateKeyPair(); }
  catch { throw new AuthError('This browser cannot create Ed25519 keys. Try a recent Chrome, Firefox or Safari.'); }
  const {verifier, challenge} = await pkcePair();
  const state = randomHex(16);
  // dev/null appends the code to the redirect's query, so the user and mode survive the round trip.
  const redirectUri = signInReturnsHere() ? location.origin + currentAddress() : PASTE_REDIRECT_URI;
  await write('pending', {...keys, verifier, state, createdAt: Date.now()});
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    fingerprint: await fingerprint(keys.publicKey), device_name: deviceName(),
    app_name: 'dev/null Community Globe', app_id: `web:${location.hostname}`,
    code_challenge: challenge, code_challenge_method: 'S256', state, redirect_uri: redirectUri
  });
  return url.href;
}

// Reads ?code=…&state=… (or ?error=…) from a URL, or accepts a bare code.
export function parseCallback(input) {
  const text = String(input).trim();
  try {
    const params = new URL(text).searchParams;
    return {code: params.get('code') || '', state: params.get('state') || '', error: params.get('error') || ''};
  } catch {
    return {code: text, state: null, error: ''};
  }
}

// Takes an authorization callback off the current address, before anything else rewrites it.
export function takeCallbackFromLocation() {
  const params = new URLSearchParams(location.search);
  if (!params.has('state') || !(params.has('code') || params.has('error'))) return null;
  const callback = parseCallback(location.href);
  history.replaceState(null, '', currentAddress() + location.hash);
  return callback;
}

export async function finishSignIn({code, state, error}) {
  const pending = await read('pending');
  if (!pending) throw new AuthError('No sign-in is in progress. Select “Sign in” to start again.');
  if (error) {
    await remove('pending');
    throw new AuthError(error === 'access_denied' ? 'Sign-in was cancelled.' : `Sign-in failed (${error}).`);
  }
  if (!code) throw new AuthError('That address has no sign-in code in it.');
  if (state !== null && state !== pending.state) throw new AuthError('That sign-in link belongs to a different attempt. Start again.');
  const body = JSON.stringify({code, code_verifier: pending.verifier});
  const response = await fetch(`${location.origin}/api/v1/devices`, {
    method: 'POST', body,
    headers: {Accept: 'application/json', 'Content-Type': 'application/json',
      ...await signatureHeaders(pending, 'POST', '/api/v1/devices', body)}
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (json.code === 'invalid_grant') await remove('pending');
    throw new AuthError(json.message || `Sign-in failed (HTTP ${response.status}).`, json.code);
  }
  const user = json.data;
  if (!user?.handle) throw new AuthError('Unexpected sign-in response.');
  device = {privateKey: pending.privateKey, publicKey: pending.publicKey,
    user: {handle: user.handle, name: user.name || user.handle, avatar: user.avatar_url || ''}};
  await write('device', device);
  await remove('pending');
  return device.user;
}

export async function signOut() {
  device = null;
  await Promise.all([remove('device'), remove('pending')]);
}

// Fetches a same-origin API path, signed with this browser's approved key.
export async function signedFetch(pathAndQuery, {signal} = {}) {
  if (!device) throw new AuthError('Sign in to dev/null to see who follows whom.', 'signed_out');
  return fetch(location.origin + pathAndQuery, {
    signal, headers: {Accept: 'application/json', ...await signatureHeaders(device, 'GET', pathAndQuery)}
  });
}
