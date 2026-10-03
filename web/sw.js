/* Generated version and exact public-resource allowlist are substituted at build time. */
const REVISION = '__REVISION__';
const FILES = __PRECACHE__;
const BASE = self.registration.scope;
const PREFIX = `habitify-shell:${new URL(BASE).pathname}:`;
const CACHE = `${PREFIX}${REVISION}`;
const PUBLIC_URLS = new Set(FILES.map(file => new URL(file, BASE).href));
const INDEX = new URL('index.html', BASE).href;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try { await cache.addAll([...PUBLIC_URLS].map(url => new Request(url, { cache: 'reload' }))); }
    catch (error) { await caches.delete(CACHE); throw error; }
    // A replacement waits until the user accepts the update or closes old windows.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'APPLY_UPDATE') event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Never intercept auth, API, probes, write requests, or any private response.
  if (request.method !== 'GET' || url.origin !== new URL(BASE).origin || request.headers.has('authorization')) return;
  const home = request.mode === 'navigate' && !url.search && [new URL(BASE).pathname, new URL(INDEX).pathname].includes(url.pathname);
  if (!home && !PUBLIC_URLS.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(home ? INDEX : request.url);
    if (cached) return cached;
    // Do not opportunistically cache responses outside the atomic installation.
    return fetch(request);
  })());
});
