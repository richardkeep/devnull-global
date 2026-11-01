import {useCallback, useEffect, useState} from 'react';
import {beginSignIn, finishSignIn, loadDevice, parseCallback, signInReturnsHere, signOut as forgetDevice} from '../services/auth.js';

// status: loading | signed-out | awaiting-paste | completing | signed-in
// busy is set while a pasted sign-in address is being redeemed.
export function useAuth(callback) {
  const [auth, setAuth] = useState({status: 'loading', user: null, error: ''});

  useEffect(() => {
    let active = true;
    const update = next => { if (active) setAuth(next); };
    (async () => {
      try {
        if (callback) {
          update({status: 'completing', user: null, error: ''});
          update({status: 'signed-in', user: await finishSignIn(callback), error: ''});
          return;
        }
        const {user, pending} = await loadDevice();
        update({status: user ? 'signed-in' : pending ? 'awaiting-paste' : 'signed-out', user, error: ''});
      } catch (error) {
        console.error(error);
        update({status: 'signed-out', user: null, error: error.message});
      }
    })();
    return () => { active = false; };
  }, [callback]);

  const signIn = useCallback(async () => {
    // On 127.0.0.1 dev/null redirects straight back to this tab. Elsewhere it opens in a new tab, opened
    // during the click so popup blockers allow it, and this page stays put to take the pasted address.
    const tab = signInReturnsHere() ? null : window.open('', '_blank');
    try {
      const url = await beginSignIn();
      if (!tab) {
        location.assign(url);
        return;
      }
      tab.opener = null;
      tab.location.href = url;
      setAuth({status: 'awaiting-paste', user: null, error: ''});
    } catch (error) {
      tab?.close();
      setAuth(current => ({...current, error: error.message}));
    }
  }, []);

  const submitPaste = useCallback(async text => {
    setAuth(current => ({...current, busy: true, error: ''}));
    try {
      setAuth({status: 'signed-in', user: await finishSignIn(parseCallback(text)), error: ''});
    } catch (error) {
      const {pending} = await loadDevice().catch(() => ({pending: false}));
      setAuth({status: pending ? 'awaiting-paste' : 'signed-out', user: null, error: error.message});
    }
  }, []);

  const signOut = useCallback(async (error = '') => {
    try { await forgetDevice(); }
    catch (cause) { console.warn('Unable to remove the device key:', cause); }
    setAuth({status: 'signed-out', user: null, error: typeof error === 'string' ? error : ''});
  }, []);

  return {...auth, signIn, submitPaste, signOut};
}
