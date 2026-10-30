import {useCallback, useEffect, useRef, useState} from 'react';

export function useProfile() {
  const [profile, setProfile] = useState(null);
  const hideTimer = useRef(null);
  const keepProfile = useCallback(() => clearTimeout(hideTimer.current), []);
  const showProfile = useCallback((user, x, y) => {
    keepProfile();
    setProfile({user, x, y});
  }, [keepProfile]);
  const hideProfileSoon = useCallback(() => {
    keepProfile();
    hideTimer.current = setTimeout(() => setProfile(null), 260);
  }, [keepProfile]);
  useEffect(() => keepProfile, [keepProfile]);
  useEffect(() => {
    document.body.classList.toggle('profile-active', Boolean(profile));
    return () => document.body.classList.remove('profile-active');
  }, [profile]);
  return {profile, showProfile, hideProfileSoon, keepProfile};
}
