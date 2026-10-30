export function normalizeUser(u) {
  const location = typeof u.location === 'string' ? u.location : (u.location?.name || u.city || u.country || '');
  const lat = Number(u.latitude ?? u.lat ?? u.location?.latitude);
  const lng = Number(u.longitude ?? u.lng ?? u.lon ?? u.location?.longitude);
  return {
    handle: u.handle || u.username || '',
    name: u.name || u.display_name || u.handle || u.username || 'Unknown user',
    avatar: u.avatar_url || u.avatar || u.profile_image_url || '',
    bio: u.bio || '',
    company: u.company || '',
    github_url: u.github_url || '',
    html_url: u.html_url || '',
    website: u.website || '',
    location,
    lat: Number.isFinite(lat) && (u.latitude != null || u.lat != null || u.location?.latitude != null) ? lat : null,
    lng: Number.isFinite(lng) && (u.longitude != null || u.lng != null || u.lon != null || u.location?.longitude != null) ? lng : null
  };
}

export const storageKey = (handle, mode) => `dev-null-${mode}-globe-v2:${handle.toLowerCase()}`;
export const userUrl = (handle, mode) => `${location.origin}/api/v1/users/${encodeURIComponent(handle)}/${mode}`;

export async function fetchUserPage(url, signal) {
  // Normalize upstream pagination links through our same-origin shared cache.
  const pageUrl = new URL(url, location.origin);
  if (pageUrl.origin !== location.origin && pageUrl.origin !== 'https://dev-null.sh') {
    throw new Error('Unexpected pagination URL');
  }
  const response = await fetch(`${location.origin}${pageUrl.pathname}${pageUrl.search}`, {
    signal, headers: {Accept: 'application/json'}
  });
  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new Error(`Rate limited (429). Wait ${retryAfter ? retryAfter + ' seconds' : 'a while'} before clicking again.`);
    }
    const source = response.headers.get('X-Globe-Error-Source');
    const reason = source === 'origin' ? 'dev-null.sh API' : source === 'worker' ? 'Cloudflare Worker' : 'API or proxy';
    let detail = '';
    if (source === 'worker') {
      try { detail = (await response.json()).detail || ''; } catch {}
    }
    throw new Error(`${reason} returned HTTP ${response.status}${detail ? ': ' + detail : ''}`);
  }
  const json = await response.json();
  const items = Array.isArray(json) ? json :
    (Array.isArray(json.data) ? json.data :
      (Array.isArray(json.data?.users) ? json.data.users : json.users));
  if (!Array.isArray(items)) throw new Error('Unexpected API response structure');
  const next = json.links?.next || json.next_page_url || json.meta?.next_page_url;
  return {items, nextUrl: next ? new URL(next, url).href : null};
}

export async function geocode(location, cache, signal) {
  const key = location.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);
  // Nominatim is suitable only for small, low-volume demonstrations.
  // Production apps should geocode server-side and cache coordinates.
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`, {signal});
  if (!response.ok) throw new Error(`Geocoding failed (${response.status})`);
  const results = await response.json();
  const point = results.length ? {lat: Number(results[0].lat), lng: Number(results[0].lon)} : null;
  cache.set(key, point);
  return point;
}

export function saveSession(session) {
  try {
    localStorage.setItem(storageKey(session.handle, session.mode), JSON.stringify({
      plotted: session.plotted, seenHandles: [...session.seenHandles],
      visitedPages: [...session.visitedPages], nextUrl: session.nextUrl,
      skipped: session.skipped, loaded: session.loaded, geo: [...session.geo],
      autoPaused: session.autoPaused
    }));
  } catch (error) { console.warn('Unable to save globe cache:', error); }
}

export function restoreSession(session) {
  try {
    const raw = localStorage.getItem(storageKey(session.handle, session.mode));
    if (!raw) return false;
    const state = JSON.parse(raw);
    if (!Array.isArray(state.plotted) || !Array.isArray(state.seenHandles)) return false;
    const restored = {
      plotted: state.plotted.filter(user => Number.isFinite(user.lat) && Number.isFinite(user.lng)),
      seenHandles: new Set(state.seenHandles), visitedPages: new Set(state.visitedPages || []),
      geo: new Map(state.geo || []), nextUrl: typeof state.nextUrl === 'string' ? state.nextUrl : null,
      skipped: Number(state.skipped) || 0, loaded: Number(state.loaded) || 0,
      autoPaused: state.autoPaused === true
    };
    Object.assign(session, restored);
    return true;
  } catch (error) { console.warn('Unable to restore globe cache:', error); return false; }
}
