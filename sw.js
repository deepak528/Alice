// Keeps the game playable offline (say, from the Home Screen with no wifi). Everything it needs is saved on the first
// visit. Each request still tries the network first, so a new version arrives whenever there's a connection, and
// falls back to the saved copy when there isn't.
const CACHE = 'mazeland-v1';
const FILES = ['./', 'index.html', 'vendor/three.min.js', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request)
    .then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(e.request, copy));
      }
      return res;
    })
    .catch(() => caches.match(e.request, { ignoreSearch: true })
      .then((hit) => hit || (e.request.mode === 'navigate' ? caches.match('./') : Response.error()))));
});
