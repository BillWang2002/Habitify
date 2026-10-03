import { createWorkspace } from './workspace.js';
const workspace = createWorkspace(document.getElementById('workspace'), { preview: true, onLogout: () => { location.href = './'; } });
workspace.enter({id: 'public-preview'});
