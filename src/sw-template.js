/* NITROVOLT service worker (generated at build time from src/sw-template.js). */
const CACHE = '__CACHE__';
const FILES = __FILES__;

self.addEventListener('install', (event) => {
  // precache everything; a failure leaves the old version in charge
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('nitrovolt-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // pages: the cached app shell (share links carry their data in the #hash, so any URL works offline)
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('./', { ignoreSearch: true })));
    return;
  }
  // hashed assets: cache first, then network (and keep what we fetched)
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});
