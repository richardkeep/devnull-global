export function initializeGlobe() {
    const API_BASE = `${location.origin}/api/v1/users/`;
    const storageKey = (handle, mode) => `dev-null-${mode}-globe-v2:${handle.toLowerCase()}`;
    let currentHandle = 'tom';
    let currentMode = 'following';
    let STORAGE_KEY = storageKey(currentHandle, currentMode);
    let API_URL = `${API_BASE}${encodeURIComponent(currentHandle)}/${currentMode}`;
    let sessionId = 0;
    const statusEl = document.getElementById('status');
    const errorEl = document.getElementById('error');
    const globe = Globe()(document.getElementById('globe'))
      .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
      .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
      .htmlLat(d => d.lat)
      .htmlLng(d => d.lng)
      .htmlAltitude(0.035)
      .htmlElement(createMarker);

    globe.pointOfView({ lat: 10, lng: 15, altitude: 2.3 });
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.25;
    window.addEventListener('resize', () => globe.width(innerWidth).height(innerHeight));

    const profileCard = document.getElementById('profile-card');
    let hoverHideTimer;
    let activeUser = null;
    const safeUrl = value => {
      try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; }
      catch { return null; }
    };
    function addProfileLink(container, label, url) {
      const href = safeUrl(url);
      if (!href) return;
      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = label;
      container.appendChild(a);
    }
    function showProfile(user, x, y) {
      clearTimeout(hoverHideTimer);
      if (activeUser !== user) {
        activeUser = user;
        profileCard.replaceChildren();
        const head = document.createElement('div'); head.className = 'profile-head';
        const avatar = document.createElement('img');
        avatar.alt = ''; avatar.referrerPolicy = 'no-referrer';
        avatar.src = user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name);
        const identity = document.createElement('div');
        const name = document.createElement('strong'); name.textContent = user.name;
        const handle = document.createElement('span'); handle.className = 'profile-handle'; handle.textContent = '@' + user.handle;
        identity.append(name, handle); head.append(avatar, identity); profileCard.appendChild(head);
        if (user.location) {
          const location = document.createElement('div'); location.className = 'profile-location';
          location.textContent = '📍 ' + user.location; profileCard.appendChild(location);
        }
        if (user.bio) {
          const bio = document.createElement('div'); bio.className = 'profile-bio';
          bio.textContent = user.bio; profileCard.appendChild(bio);
        }
        if (user.company) {
          const company = document.createElement('div'); company.className = 'profile-company';
          company.textContent = '🏢 ' + user.company; profileCard.appendChild(company);
        }
        const links = document.createElement('div'); links.className = 'profile-links';
        addProfileLink(links, '↗ /dev/null profile', user.html_url || `https://dev-null.sh/@${encodeURIComponent(user.handle)}`);
        if (user.github_url) addProfileLink(links, '↗ GitHub', user.github_url);
        if (user.website) addProfileLink(links, '↗ Website', user.website);
        profileCard.appendChild(links);
      }
      profileCard.classList.add('visible');
      document.body.classList.add('profile-active');
      document.querySelectorAll('.person.profile-selected').forEach(el => el.classList.remove('profile-selected'));
      document.querySelectorAll('.person').forEach(el => {
        if (el.dataset.handle === user.handle) el.classList.add('profile-selected');
      });
      globe.controls().autoRotate = false;
      const rect = profileCard.getBoundingClientRect();
      const left = Math.max(12, Math.min(x + 16, innerWidth - rect.width - 12));
      const top = Math.max(12, Math.min(y + 16, innerHeight - rect.height - 12));
      profileCard.style.left = left + 'px'; profileCard.style.top = top + 'px';
    }
    function hideProfileSoon() {
      clearTimeout(hoverHideTimer);
      hoverHideTimer = setTimeout(() => {
        profileCard.classList.remove('visible');
        document.body.classList.remove('profile-active');
        document.querySelectorAll('.person.profile-selected').forEach(el => el.classList.remove('profile-selected'));
        activeUser = null;
        globe.controls().autoRotate = true;
      }, 260);
    }
    profileCard.addEventListener('pointerenter', () => clearTimeout(hoverHideTimer));
    profileCard.addEventListener('pointerleave', hideProfileSoon);

    function createMarker(user) {
      const el = document.createElement('div');
      el.className = 'person';
      el.dataset.handle = user.handle;
      if (activeUser?.handle === user.handle) el.classList.add('profile-selected');
      const img = document.createElement('img');
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.src = user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name);
      img.onerror = () => { img.onerror = null; img.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name); };
      el.setAttribute('aria-label', user.name + (user.location ? ', ' + user.location : ''));
      el.appendChild(img);
      el.addEventListener('pointerenter', e => showProfile(user, e.clientX, e.clientY));
      el.addEventListener('pointerleave', hideProfileSoon);
      el.addEventListener('focusin', () => { const r = el.getBoundingClientRect(); showProfile(user, r.right, r.top); });
      el.addEventListener('focusout', hideProfileSoon);
      el.tabIndex = 0;
      // Marker clicks do not navigate; profile links live inside the hover card.
      return el;
    }

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    const geoCache = new Map();
    function saveState() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          plotted, seenHandles: [...seenHandles], visitedPages: [...visitedPages],
          nextUrl, skipped, loaded, geo: [...geoCache], autoPaused
        }));
      } catch (e) { console.warn('Unable to save globe cache:', e); }
    }
    function restoreState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const state = JSON.parse(raw);
        if (!Array.isArray(state.plotted) || !Array.isArray(state.seenHandles)) return false;
        plotted.push(...state.plotted.filter(u => Number.isFinite(u.lat) && Number.isFinite(u.lng)));
        state.seenHandles.forEach(h => seenHandles.add(h));
        (state.visitedPages || []).forEach(url => visitedPages.add(url));
        (state.geo || []).forEach(([key, point]) => geoCache.set(key, point));
        nextUrl = typeof state.nextUrl === 'string' ? state.nextUrl : null;
        skipped = Number(state.skipped) || 0;
        loaded = Number(state.loaded) || 0;
        autoPaused = state.autoPaused === true;
        updateAutoButton();
        globe.htmlElementsData([...plotted]);
        statusEl.textContent = `${plotted.length} on globe · ${skipped} not plotted · ${loaded} fetched (restored)`;
        moreButton.disabled = !nextUrl;
        moreButton.textContent = nextUrl ? 'Load 30 more' : 'All pages loaded';
        scheduleAutoLoad();
        return true;
      } catch (e) { console.warn('Unable to restore globe cache:', e); return false; }
    }

    async function geocode(location) {
      const key = location.trim().toLowerCase();
      if (geoCache.has(key)) return geoCache.get(key);
      // Nominatim is suitable only for small, low-volume demonstrations.
      // Production apps should geocode server-side and cache coordinates.
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`);
      if (!response.ok) throw new Error(`Geocoding failed (${response.status})`);
      const results = await response.json();
      const point = results.length ? { lat: Number(results[0].lat), lng: Number(results[0].lon) } : null;
      geoCache.set(key, point);
      return point;
    }

    function normalizeUser(u) {
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

    const moreButton = document.getElementById('more');
    const autoButton = document.getElementById('auto');
    const countdownEl = document.getElementById('countdown');
    const AUTO_DELAY_MS = 3000;
    let autoPaused = false;
    let autoTimer = null;
    let countdownTimer = null;
    let nextAutoAt = 0;

    function clearAutoTimers() {
      clearTimeout(autoTimer);
      clearInterval(countdownTimer);
      autoTimer = null;
      countdownTimer = null;
      countdownEl.textContent = '';
    }
    function updateAutoButton() {
      autoButton.textContent = autoPaused ? '▶ Resume auto-load' : '⏸ Pause auto-load';
      autoButton.setAttribute('aria-pressed', String(!autoPaused));
      autoButton.disabled = !nextUrl;
    }
    function scheduleAutoLoad() {
      clearAutoTimers();
      updateAutoButton();
      if (autoPaused || loading || !nextUrl) {
        if (autoPaused && nextUrl) countdownEl.textContent = 'Automatic loading paused';
        return;
      }
      const scheduledSession = sessionId;
      nextAutoAt = Date.now() + AUTO_DELAY_MS;
      const tick = () => {
        if (scheduledSession !== sessionId || autoPaused) return;
        countdownEl.textContent = `Loading 30 more devs in ${Math.max(0, Math.ceil((nextAutoAt - Date.now()) / 1000))}s`;
      };
      tick();
      countdownTimer = setInterval(tick, 1000);
      autoTimer = setTimeout(() => {
        clearAutoTimers();
        if (scheduledSession === sessionId && !autoPaused) loadNextPage();
      }, AUTO_DELAY_MS);
    }
    autoButton.addEventListener('click', () => {
      autoPaused = !autoPaused;
      saveState();
      scheduleAutoLoad();
    });
    const plotted = [];
    const seenHandles = new Set();
    const visitedPages = new Set();
    let nextUrl = API_URL;
    let loading = false;
    let skipped = 0;
    let loaded = 0;

    async function loadNextPage() {
      if (loading || !nextUrl) return;
      clearAutoTimers();
      const session = sessionId;
      loading = true;
      moreButton.disabled = true;
      errorEl.textContent = '';
      const url = nextUrl;
      statusEl.textContent = `Loading next page… ${plotted.length} plotted so far`;

      let succeeded = false;
      try {
        // Normalize upstream pagination links through our same-origin shared cache.
        const pageUrl = new URL(url, location.origin);
        if (pageUrl.origin !== location.origin && pageUrl.origin !== 'https://dev-null.sh') throw new Error('Unexpected pagination URL');
        const response = await fetch(`${location.origin}${pageUrl.pathname}${pageUrl.search}`, { headers: { Accept: 'application/json' } });
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            throw new Error(`Rate limited (429). Wait ${retryAfter ? retryAfter + ' seconds' : 'a while'} before clicking again.`);
          }
          const source = response.headers.get('X-Globe-Error-Source');
          const reason = source === 'origin' ? 'dev-null.sh API' : source === 'worker' ? 'Cloudflare Worker' : 'API or proxy';
          let detail = '';
          if (source === 'worker') {
            try { detail = (await response.json()).detail || ''; } catch (_) {}
          }
          throw new Error(`${reason} returned HTTP ${response.status}${detail ? ': ' + detail : ''}`);
        }
        const json = await response.json();
        if (session !== sessionId) return;
        const items = Array.isArray(json) ? json :
          (Array.isArray(json.data) ? json.data :
          (Array.isArray(json.data?.users) ? json.data.users : json.users));
        if (!Array.isArray(items)) throw new Error('Unexpected API response structure');

        visitedPages.add(url);
        const next = json.links?.next || json.next_page_url || json.meta?.next_page_url;
        const candidate = next ? new URL(next, url).href : null;
        nextUrl = candidate && !visitedPages.has(candidate) ? candidate : null;
        loaded += items.length;

        for (const item of items) {
          if (session !== sessionId) return;
          const user = normalizeUser(item);
          if (!user.handle || seenHandles.has(user.handle)) continue;
          seenHandles.add(user.handle);
          // Skip developers with no profile location, even when coordinates exist.
          if (!user.location || !String(user.location).trim()) { skipped++; continue; }
          if (user.lat == null || user.lng == null) {
            if (!user.location) { skipped++; continue; }
            try {
              const point = await geocode(user.location);
              if (session !== sessionId) return;
              if (!point) { skipped++; continue; }
              Object.assign(user, point);
              // Nominatim public API: at most 1 request per second.
              await sleep(1100);
            } catch (err) {
              console.warn('Geocoding unavailable:', user.location, err);
              skipped++;
              continue;
            }
          }
          plotted.push(user);
          globe.htmlElementsData([...plotted]);
          statusEl.textContent = `${plotted.length} on globe · ${skipped} without locations · ${loaded} fetched`;
        }
        statusEl.textContent = `${plotted.length} on globe · ${skipped} not plotted · ${loaded} fetched`;
        succeeded = true;
        saveState();
      } catch (err) {
        console.error(err);
        if (session !== sessionId) return;
        errorEl.textContent = err.message;
        // Never retry failed pages automatically (especially HTTP 429).
        autoPaused = true;
        saveState();
        statusEl.textContent = `${plotted.length} users on globe. Could not load next page.`;
      } finally {
        if (session !== sessionId) return;
        loading = false;
        moreButton.disabled = !nextUrl;
        moreButton.textContent = nextUrl ? 'Load 30 more' : 'All pages loaded';
        if (succeeded) scheduleAutoLoad();
        else updateAutoButton();
      }
    }

    function switchUser(handle, mode = currentMode) {
      const clean = handle.trim().replace(/^@/, '').toLowerCase();
      if (!/^[a-z0-9_-]+$/.test(clean)) {
        errorEl.textContent = 'Enter a valid username (letters, numbers, underscores or hyphens).';
        return;
      }
      if (!['following', 'followers'].includes(mode)) mode = 'following';
      if (clean === currentHandle && mode === currentMode && (loaded || loading)) return;
      clearAutoTimers();
      sessionId++;
      currentHandle = clean;
      currentMode = mode;
      STORAGE_KEY = storageKey(clean, mode);
      API_URL = `${API_BASE}${encodeURIComponent(clean)}/${mode}`;
      document.getElementById('heading').textContent = `🌍 ${clean}'s ${mode === 'followers' ? 'Followers' : 'Following'}`;
      document.querySelectorAll('[data-mode]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
      });
      document.getElementById('handle').value = clean;
      history.replaceState(null, '', `${location.pathname}?user=${encodeURIComponent(clean)}&mode=${mode}${location.hash}`);
      plotted.length = 0;
      seenHandles.clear();
      visitedPages.clear();
      geoCache.clear();
      nextUrl = API_URL;
      skipped = 0;
      loaded = 0;
      loading = false;
      autoPaused = false;
      updateAutoButton();
      globe.htmlElementsData([]);
      errorEl.textContent = '';
      statusEl.textContent = 'Loading users…';
      moreButton.disabled = true;
      if (!restoreState()) loadNextPage();
    }
    document.getElementById('lookup').addEventListener('submit', event => {
      event.preventDefault();
      switchUser(document.getElementById('handle').value);
    });
    moreButton.addEventListener('click', loadNextPage);
    document.querySelectorAll('[data-mode]').forEach(button => {
      button.addEventListener('click', () => switchUser(currentHandle, button.dataset.mode));
    });
    const params = new URLSearchParams(location.search);
    const initial = params.get('user') || 'tom';
    switchUser(initial, params.get('mode') === 'followers' ? 'followers' : 'following');

}
