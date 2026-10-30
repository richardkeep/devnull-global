import {useCallback, useEffect, useRef, useState} from 'react';
import {fetchUserProfile} from '../services/user-profile.js';

export function useProfile() {
  const [profile, setProfile] = useState(null);
  const hideTimer = useRef(null);
  const detailsCache = useRef(new Map());
  const keepProfile = useCallback(() => clearTimeout(hideTimer.current), []);
  const showProfile = useCallback((user, x, y) => {
    keepProfile();
    const details = detailsCache.current.get(user.handle);
    setProfile(current => current?.user.handle === user.handle ? {...current, x, y} : {
      user: {...user, ...details}, x, y, loading: !details, error: ''
    });
  }, [keepProfile]);
  const hideProfileSoon = useCallback(() => {
    keepProfile();
    hideTimer.current = setTimeout(() => setProfile(null), 260);
  }, [keepProfile]);
  const handle = profile?.user.handle;
  useEffect(() => {
    if (!handle || detailsCache.current.has(handle)) return;
    const controller = new AbortController();
    fetchUserProfile(handle, controller.signal).then(details => {
      if (controller.signal.aborted) return;
      detailsCache.current.set(handle, details);
      setProfile(current => current?.user.handle === handle ? {
        ...current, user: {...current.user, ...details}, loading: false, error: ''
      } : current);
    }).catch(error => {
      if (controller.signal.aborted) return;
      setProfile(current => current?.user.handle === handle ? {
        ...current, loading: false, error: error.message
      } : current);
    });
    return () => controller.abort();
  }, [handle]);

  useEffect(() => keepProfile, [keepProfile]);
  useEffect(() => {
    document.body.classList.toggle('profile-active', Boolean(profile));
    return () => document.body.classList.remove('profile-active');
  }, [profile]);
  return {profile, showProfile, hideProfileSoon, keepProfile};
}
