import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App.js';
import {takeCallbackFromLocation} from './services/auth.js';
// Read a dev/null sign-in callback before the globe rewrites the address bar.
const authCallback = takeCallbackFromLocation();
createRoot(document.getElementById('root')).render(React.createElement(App, {authCallback}));
