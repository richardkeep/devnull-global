import React, {useLayoutEffect, useRef, useState} from 'react';
const h = React.createElement;

function ProfileLink({label, url}) {
  let href;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    href = parsed.href;
  } catch { return null; }
  return h('a', {href, target: '_blank', rel: 'noopener noreferrer'}, label);
}

export function ProfileCard({profile, keepProfile, hideProfileSoon}) {
  const cardRef = useRef(null);
  const [position, setPosition] = useState({left: 12, top: 12});
  useLayoutEffect(() => {
    if (!profile) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({
      left: Math.max(12, Math.min(profile.x + 16, innerWidth - rect.width - 12)),
      top: Math.max(12, Math.min(profile.y + 16, innerHeight - rect.height - 12))
    });
  }, [profile]);
  const user = profile?.user;
  return h('div', {
    id: 'profile-card', ref: cardRef, className: 'profile-card' + (user ? ' visible' : ''),
    role: 'dialog', 'aria-label': 'User details', style: position,
    onPointerEnter: keepProfile, onPointerLeave: hideProfileSoon,
    onFocus: keepProfile, onBlur: event => {
      if (!event.currentTarget.contains(event.relatedTarget)) hideProfileSoon();
    }
  }, user && h(React.Fragment, null,
    h('div', {className: 'profile-head'},
      h('img', {alt: '', referrerPolicy: 'no-referrer', src: user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name)}),
      h('div', null, h('strong', null, user.name), h('span', {className: 'profile-handle'}, '@' + user.handle))),
    user.location && h('div', {className: 'profile-location'}, '📍 ' + user.location),
    user.bio && h('div', {className: 'profile-bio'}, user.bio),
    user.company && h('div', {className: 'profile-company'}, '🏢 ' + user.company),
    h('div', {className: 'profile-links'},
      h(ProfileLink, {label: '↗ /dev/null profile', url: user.html_url || `https://dev-null.sh/@${encodeURIComponent(user.handle)}`}),
      user.github_url && h(ProfileLink, {label: '↗ GitHub', url: user.github_url}),
      user.website && h(ProfileLink, {label: '↗ Website', url: user.website}))));
}
