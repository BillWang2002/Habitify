import { initKeyboardViewport } from './keyboard-viewport.js';
import { createWorkspace } from './workspace.js';
initKeyboardViewport();
const workspace = createWorkspace(document.getElementById('workspace'), { preview: true, onLogout: () => { location.href = './'; } });
workspace.enter({id: 'public-preview'});
