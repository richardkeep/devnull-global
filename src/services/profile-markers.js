// Globe.gl requires a DOM element for each HTML marker.
export function createProfileMarker(user, {showProfile, hideProfileSoon}) {
  const element = document.createElement('div');
  element.className = 'person';
  element.dataset.handle = user.handle;
  element.tabIndex = 0;
  element.setAttribute('aria-label', user.name + (user.location ? ', ' + user.location : ''));
  const image = document.createElement('img');
  const fallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name);
  image.alt = '';
  image.referrerPolicy = 'no-referrer';
  image.src = user.avatar || fallback;
  image.onerror = () => { image.onerror = null; image.src = fallback; };
  element.appendChild(image);
  element.addEventListener('pointerenter', event => showProfile(user, event.clientX, event.clientY));
  element.addEventListener('pointerleave', hideProfileSoon);
  element.addEventListener('focusin', () => {
    const rect = element.getBoundingClientRect();
    showProfile(user, rect.right, rect.top);
  });
  element.addEventListener('focusout', hideProfileSoon);
  return element;
}
