import {useCallback, useEffect, useRef, useState} from 'react';
import {fetchUserPage, geocode, normalizeUser, restoreSession, saveSession, userUrl} from '../services/globe-users.js';

const AUTO_DELAY_MS = 3000;
const summary = session => `${session.plotted.length} on globe · ${session.skipped} not plotted · ${session.loaded} fetched`;

function createSession(handle, mode) {
  return {
    handle, mode, plotted: [], seenHandles: new Set(), visitedPages: new Set(), geo: new Map(),
    nextUrl: userUrl(handle, mode), skipped: 0, loaded: 0, loading: false,
    autoPaused: false, status: 'Loading users…', error: '', controller: new AbortController()
  };
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, {once: true});
  });
}

export function useGlobeUsers() {
  const sessionRef = useRef(null);
  const [state, setState] = useState({
    handle: 'tom', mode: 'following', plotted: [], loading: true, nextUrl: null,
    autoPaused: false, status: 'Loading users…', error: ''
  });
  const [countdown, setCountdown] = useState('');
  const publish = useCallback(session => {
    if (sessionRef.current !== session || session.controller.signal.aborted) return;
    setState({
      handle: session.handle, mode: session.mode, plotted: [...session.plotted],
      loading: session.loading, nextUrl: session.nextUrl, autoPaused: session.autoPaused,
      status: session.status, error: session.error
    });
  }, []);

  const loadNextPage = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || session.loading || !session.nextUrl) return;
    const {signal} = session.controller;
    session.loading = true;
    session.error = '';
    session.status = `Loading next page… ${session.plotted.length} plotted so far`;
    publish(session);
    try {
      const url = session.nextUrl;
      const {items, nextUrl} = await fetchUserPage(url, signal);
      if (signal.aborted) return;
      session.visitedPages.add(url);
      session.nextUrl = nextUrl && !session.visitedPages.has(nextUrl) ? nextUrl : null;
      session.loaded += items.length;
      for (const item of items) {
        if (signal.aborted) return;
        const user = normalizeUser(item);
        if (!user.handle || session.seenHandles.has(user.handle)) continue;
        session.seenHandles.add(user.handle);
        // A profile location is required even when coordinates exist.
        if (!user.location || !String(user.location).trim()) { session.skipped++; continue; }
        if (user.lat == null || user.lng == null) {
          try {
            const point = await geocode(user.location, session.geo, signal);
            if (signal.aborted) return;
            if (!point) { session.skipped++; continue; }
            Object.assign(user, point);
            // Nominatim public API: at most 1 request per second.
            await delay(1100, signal);
          } catch (error) {
            if (signal.aborted) return;
            console.warn('Geocoding unavailable:', user.location, error);
            session.skipped++;
            continue;
          }
        }
        session.plotted.push(user);
        session.status = summary(session);
        publish(session);
      }
      session.status = summary(session);
      saveSession(session);
    } catch (error) {
      if (signal.aborted) return;
      console.error(error);
      session.error = error.message;
      // Failed pages must be retried explicitly, especially HTTP 429.
      session.autoPaused = true;
      session.status = `${session.plotted.length} users on globe. Could not load next page.`;
      saveSession(session);
    } finally {
      if (!signal.aborted) {
        session.loading = false;
        publish(session);
      }
    }
  }, [publish]);

  const switchUser = useCallback((handle, mode = sessionRef.current?.mode || 'following') => {
    const clean = handle.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(clean)) {
      const error = 'Enter a valid username (letters, numbers, underscores or hyphens).';
      if (sessionRef.current) sessionRef.current.error = error;
      setState(previous => ({...previous, error}));
      return;
    }
    if (!['following', 'followers'].includes(mode)) mode = 'following';
    const previous = sessionRef.current;
    if (previous?.handle === clean && previous.mode === mode && (previous.loaded || previous.loading)) return;
    previous?.controller.abort();
    const session = createSession(clean, mode);
    sessionRef.current = session;
    history.replaceState(null, '', `${location.pathname}?user=${encodeURIComponent(clean)}&mode=${mode}${location.hash}`);
    if (restoreSession(session)) {
      session.status = `${summary(session)} (restored)`;
      publish(session);
    } else {
      publish(session);
      loadNextPage();
    }
  }, [loadNextPage, publish]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    switchUser(params.get('user') || 'tom', params.get('mode') === 'followers' ? 'followers' : 'following');
    return () => {
      sessionRef.current?.controller.abort();
      sessionRef.current = null;
    };
  }, [switchUser]);

  useEffect(() => {
    setCountdown(state.autoPaused && state.nextUrl ? 'Automatic loading paused' : '');
    if (state.autoPaused || state.loading || !state.nextUrl) return;
    const nextAutoAt = Date.now() + AUTO_DELAY_MS;
    const tick = () => setCountdown(`Loading 30 more devs in ${Math.max(0, Math.ceil((nextAutoAt - Date.now()) / 1000))}s`);
    tick();
    const interval = setInterval(tick, 1000);
    const timer = setTimeout(loadNextPage, AUTO_DELAY_MS);
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [state.handle, state.mode, state.autoPaused, state.loading, state.nextUrl, loadNextPage]);

  const toggleAutoLoad = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.autoPaused = !session.autoPaused;
    saveSession(session);
    publish(session);
  }, [publish]);

  return {...state, countdown, switchUser, loadNextPage, toggleAutoLoad};
}
