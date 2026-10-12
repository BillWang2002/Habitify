import {readLoadingAppearance} from './appearance-loading.js';
import {themeChromeColor} from './appearance-model.js';
// Runs before the stylesheet and auth bundle; this never authorizes a session.
const a=readLoadingAppearance(),html=document.documentElement;
Object.assign(html.dataset,{theme:a.theme,themeMode:a.mode,themeBackground:a.background,themeSurface:a.surface});
html.classList.toggle('is-standalone',matchMedia('(display-mode: standalone)').matches||navigator.standalone===true);
const dark=a.mode==='dark'||(a.mode==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
document.querySelector('meta[name="theme-color"]')?.setAttribute('content',themeChromeColor(a.theme,dark,a.background));
