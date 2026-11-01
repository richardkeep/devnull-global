import React from 'react';
import {ControlPanel} from './components/ControlPanel.js';
import {GlobeView} from './components/GlobeView.js';
import {ProfileCard} from './components/ProfileCard.js';
import {PastrySprinkles} from './components/PastrySprinkles.js';
import {useAuth} from './hooks/useAuth.js';
import {useGlobeUsers} from './hooks/useGlobeUsers.js';
import {useProfile} from './hooks/useProfile.js';

export function App({authCallback = null}) {
  const auth = useAuth(authCallback);
  const users = useGlobeUsers(
    ['loading', 'completing'].includes(auth.status) ? null : auth.status === 'signed-in', auth.signOut);
  const profile = useProfile();
  return React.createElement(React.Fragment, null,
    React.createElement(ControlPanel, {...users, auth}),
    React.createElement(GlobeView, {
      users: users.plotted, activeHandle: profile.profile?.user.handle,
      showProfile: profile.showProfile, hideProfileSoon: profile.hideProfileSoon
    }),
    React.createElement(PastrySprinkles),
    React.createElement(ProfileCard, profile));
}
