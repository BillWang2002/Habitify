// History holds only opaque entry IDs; view snapshots stay in memory and clear at sign-out.
export function createNavigation({ host = window, normalize, readView, onChange }) {
  const session = `${Date.now()}-${Math.random()}`, entries = new Map();
  let active = false, sequence = 0, currentId, delivered;
  const path = () => host.location.hash.slice(2);
  const ownEntry = () => { const value = host.history.state?.habitifyNavigation; return value?.session === session && entries.has(value.id) ? value.id : null; };
  function remember() { if (active && entries.has(currentId)) entries.get(currentId).view = readView(); }
  function write(next, parent, replace) {
    const id = ++sequence;
    entries.set(id, { path: next, parent, view: null });
    const state = { ...host.history.state, habitifyNavigation: { session, id } };
    host.history[replace ? 'replaceState' : 'pushState'](state, '', `#/${next}`);
    return id;
  }
  function sync(source, force = false) {
    if (!active) return;
    remember();
    const next = normalize(path());
    let id = ownEntry();
    if (!id || entries.get(id).path !== next || path() !== next) id = write(next, null, true);
    currentId = id;
    if (!force && delivered === id) return;
    delivered = id;
    onChange(next, { source, view: entries.get(id).view });
    remember();
  }
  host.addEventListener('popstate', () => sync('history'));
  host.addEventListener('hashchange', () => sync('history'));
  host.addEventListener('pageshow', () => sync('restore', true));
  host.addEventListener('pagehide', remember);
  return {
    start(next) {
      if ('scrollRestoration' in host.history) host.history.scrollRestoration = 'manual';
      if (!active) { active = true; currentId = null; }
      if (normalize(path()) !== next || path() !== next) currentId = write(next, null, true);
      sync('refresh', true);
    },
    navigate(next, { replace = false } = {}) {
      if (!active) return;
      next = normalize(next);
      if (next === path()) return;
      remember(); const parent = replace ? entries.get(currentId)?.parent : currentId;
      currentId = write(next, parent, replace); delivered = currentId;
      onChange(next, { source: 'navigate', view: null }); remember();
    },
    back(fallback = 'habits') {
      if (!active) return;
      remember();
      const parent = entries.get(currentId)?.parent;
      if (parent && entries.has(parent)) host.history.back();
      else this.navigate(fallback, { replace: true });
    },
    remember,
    stop({ reset = false } = {}) { remember(); active = false; currentId = null; delivered = null; if (reset) entries.clear(); }
  };
}
