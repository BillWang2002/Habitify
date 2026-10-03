// Bundled, trusted SVG assets only. Future inventory supplies owned IDs, never arbitrary markup.
const paths = {
  book: '<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z"/><path d="M12 6v14"/>',
  water: '<path d="M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
  walk: '<path d="M5 20c-2-10 3-16 15-16 0 12-6 17-15 16Z"/><path d="m4 21 11-11M9 16v-5m0 5h5"/>',
  leaf: '<path d="M12 21v-9M12 15C4 15 3 10 3 6c7 0 9 3 9 9Zm0-3c0-7 4-9 9-9 0 6-3 9-9 9Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  habits: '<rect x="4" y="4" width="16" height="17" rx="4"/><path d="M8 2v4m8-4v4M8 13l3 3 5-6"/>',
  rewards: '<path d="M4 10h16v11H4Zm-1-4h18v4H3Zm9 0v15M12 6C5 7 5 1 8 2c3 0 4 4 4 4Zm0 0c7 1 7-5 4-4-3 0-4 4-4 4Z"/>',
  stats: '<path d="M4 20h17M7 16v-5m5 5V5m5 11V8"/>',
  me: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>'
};
export const defaultTheme = Object.freeze({ id: 'growth', navigation: { habits: 'habits', rewards: 'rewards', stats: 'stats', me: 'me' }, habitIcons: ['leaf', 'book', 'water', 'walk', 'target', 'sun'] });
export const iconChoices = [{id:'leaf',name:'成长'},{id:'book',name:'阅读'},{id:'water',name:'喝水'},{id:'walk',name:'自然'},{id:'target',name:'目标'},{id:'sun',name:'阳光'}];
export function iconSvg(id) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id] || paths.leaf}</svg>`; }
export function resolveHabitIcon(id, ownedIds = defaultTheme.habitIcons) { return defaultTheme.habitIcons.includes(id) && ownedIds.includes(id) ? id : 'leaf'; }
