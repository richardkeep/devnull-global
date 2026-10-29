export function createProfileMarkers(getGlobe) {
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
      getGlobe().controls().autoRotate = false;
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
        getGlobe().controls().autoRotate = true;
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

    return {createMarker};
}
