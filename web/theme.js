// Bundled, trusted SVG assets only. Future inventory supplies owned IDs, never arbitrary markup.
let activeTheme = 'growth';
const paths = {
  inbox: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 13h5l2 3h4l2-3h5M7 8h10"/>',
  feedback: '<path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z"/><path d="M8 9h8M8 13h5"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  book: '<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z"/><path d="M12 6v14"/>',
  water: '<path d="M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
  walk: '<path d="M5 20c-2-10 3-16 15-16 0 12-6 17-15 16Z"/><path d="m4 21 11-11M9 16v-5m0 5h5"/>',
  leaf: '<path d="M12 21v-9M12 15C4 15 3 10 3 6c7 0 9 3 9 9Zm0-3c0-7 4-9 9-9 0 6-3 9-9 9Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  checkin: '<path d="M12 20v-9M12 14C5 14 4 10 4 6c6 0 8 3 8 8Zm0-3c0-6 3-8 8-8 0 5-3 8-8 8Z"/><path d="m14 18 2 2 5-5"/>',
  habits: '<rect x="4" y="4" width="16" height="17" rx="4"/><path d="M8 2v4m8-4v4M8 13l3 3 5-6"/>',
  rewards: '<path d="M4 10h16v11H4Zm-1-4h18v4H3Zm9 0v15M12 6C5 7 5 1 8 2c3 0 4 4 4 4Zm0 0c7 1 7-5 4-4-3 0-4 4-4 4Z"/>',
  stats: '<path d="M4 20h17M7 16v-5m5 5V5m5 11V8"/>',
  me: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  archive: '<rect x="3" y="3" width="18" height="5" rx="2"/><path d="M5 8v13h14V8M10 12h4"/>',
  coins: '<circle cx="12" cy="12" r="9"/><path d="m9 7 3 4 3-4M8 12h8m-8 3h8m-4-4v7"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4c-1-1 0-3 2-3h2c4 0 3-11-6-11Z"/><path d="M7 9h.01M10 6h.01M15 7h.01M6 14h.01"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16"/>',
  refresh: '<path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>',
  diagnostics: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M6 12h3l2-5 3 10 2-5h2"/>',
  logout: '<path d="M10 3H4v18h6m4-15 6 6-6 6m-7-6h13"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>'
};
export const defaultTheme = Object.freeze({ id: 'growth', navigation: { habits: 'checkin', rewards: 'rewards', stats: 'stats', me: 'me' }, habitIcons: ['leaf', 'book', 'water', 'walk', 'target', 'sun'] });
export const iconChoices = [{id:'leaf',name:'成长'},{id:'book',name:'阅读'},{id:'water',name:'喝水'},{id:'walk',name:'自然'},{id:'target',name:'目标'},{id:'sun',name:'阳光'}];
const lumiPaths={
 checkin:'<path d="M7 3h11v16H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm0 0v13H4m3 3h13v-3h-2"/><path d="m10 10 2 2 4-4"/>',
 rewards:'<path d="M3 11V8a9 9 0 0 1 18 0v3H3Zm0 0v10h18V11M3 15h7m4 0h7"/><rect x="10" y="13" width="4" height="5" rx="1"/>',
 stats:'<path d="M3 3v18h18M6 16l5-5 4 2 5-8m-5 0h5v5"/><circle cx="11" cy="11" r="1"/>',
 me:'<path d="M5 14V9a7 7 0 0 1 14 0v5M5 14l-3 7h20l-3-7"/><circle cx="12" cy="10" r="3"/><path d="m8 15 4 3 4-3M12 18v3"/>',
 leaf:'<path d="M7 15h10l-1 6H8l-1-6Zm5 0V8m0 3C7 11 5 8 5 5c5 0 7 2 7 6Zm0-3c0-4 3-6 7-6 0 4-3 6-7 6Z"/>',
 book:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M7 3v18M12 3v9l3-2 3 2V3M11 16h6"/>',
 water:'<path d="M4 5h12v11a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V5Zm12 2h2a3 3 0 0 1 0 6h-2M3 22h15"/><path d="M10 8s-2 3-2 4a2 2 0 0 0 4 0c0-1-2-4-2-4Z"/>',
 walk:'<path d="m8 3-5 7h3l-4 6h5v5h2v-5h5l-4-6h3L8 3Zm7 4 4 5h-2l4 5h-6m3 0v4M3 22h18"/>',
 target:'<circle cx="10" cy="14" r="7"/><circle cx="10" cy="14" r="3"/><path d="m10 14 8-8m0 0V2l-4 4v4h4l4-4h-4"/>',
 sun:'<path d="M2 16h20M5 16a7 7 0 0 1 14 0M12 3v3M3 7l2 2m14 0 2-2M5 20h14"/><path d="m9 12 3-3 3 3m-3-3v5"/>',
 back:'<path d="m14 5-7 7 7 7M7 12h13"/>',
 archive:'<path d="M3 6h18v5H3V6Zm2 5v10h14V11M9 15h6M6 3h12v3"/>',
 palette:'<path d="M4 18 17 5l2 2L6 20l-2-2ZM14 2v3m6 5h3M3 8l1 2 2 1-2 1-1 2-1-2-2-1 2-1Z"/>',
 coins:'<circle cx="12" cy="12" r="9"/><path d="m12 5 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/>'
};
export function currentIconChoices(){return iconChoices;}
export function setIconTheme(id){activeTheme=id==='lumi'?'lumi':'growth';}
export function iconSvg(id) { return `<svg data-theme-icon="${Object.hasOwn(paths,id)?id:'leaf'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(activeTheme==='lumi' && lumiPaths[id]) || paths[id] || paths.leaf}</svg>`; }
export function refreshThemeIcons(root){for(const svg of root.querySelectorAll('svg[data-theme-icon]'))svg.outerHTML=iconSvg(svg.dataset.themeIcon);}
export function resolveHabitIcon(id, ownedIds = defaultTheme.habitIcons) { return defaultTheme.habitIcons.includes(id) && ownedIds.includes(id) ? id : 'leaf'; }
