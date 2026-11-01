import React, {useState} from 'react';
const h = React.createElement;

function PasteForm({submitPaste, signOut, busy}) {
  const [address, setAddress] = useState('');
  return h(React.Fragment, null,
    h('ol', {className: 'account-steps'},
      h('li', null, 'Approve the Community Globe on dev/null, in the tab that just opened.'),
      h('li', null, 'You then land on a 127.0.0.1 page that doesn’t load. That’s expected.'),
      h('li', null, 'Copy that page’s address and paste it here.')),
    h('form', {className: 'lookup account-paste', onSubmit: event => { event.preventDefault(); submitPaste(address); }},
      h('div', {className: 'handle-field'},
        h('input', {'aria-label': 'Sign-in address', placeholder: 'http://127.0.0.1:…', autoComplete: 'off', spellCheck: false,
          value: address, onChange: event => setAddress(event.target.value), required: true, readOnly: busy})),
      h('button', {type: 'submit', disabled: busy}, busy ? 'Signing in…' : 'Finish')),
    h('button', {type: 'button', className: 'account-link', onClick: () => signOut()}, 'Cancel sign-in'));
}

export function AccountBar({auth, switchUser}) {
  const {status, user, error, busy, signIn, submitPaste, signOut} = auth;
  if (status === 'loading') return null;
  if (status === 'signed-in') {
    return h('div', {className: 'account account-signed-in'},
      h('span', null, 'Signed in as ',
        h('button', {type: 'button', className: 'account-link', title: 'Show your network',
          onClick: () => switchUser(user.handle)}, '@' + user.handle)),
      h('button', {type: 'button', className: 'account-link', onClick: () => signOut()}, 'Sign out'));
  }
  return h('div', {className: 'account'},
    status === 'completing' ? h('p', {className: 'account-note', role: 'status'}, 'Signing in…') :
    status === 'awaiting-paste' ? h(PasteForm, {submitPaste, signOut, busy}) :
    h(React.Fragment, null,
      h('p', {className: 'account-note'}, 'dev/null now only shows who follows whom to signed-in members.'),
      h('button', {type: 'button', className: 'account-sign-in', onClick: signIn}, 'Sign in with dev/null')),
    error && h('div', {className: 'account-error', role: 'alert'}, error));
}
