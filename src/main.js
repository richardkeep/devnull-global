import React from 'https://esm.sh/react@18.3.1';
import {createRoot} from 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1';
import {App} from './App.js';
// The existing globe controller runs after React mounts the static UI.
createRoot(document.getElementById('root')).render(React.createElement(App));
await new Promise(resolve => requestAnimationFrame(resolve));
await import('./globe-controller.js');
