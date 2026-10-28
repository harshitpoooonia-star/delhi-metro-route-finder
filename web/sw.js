// Cache everything on first visit so routing works underground with no signal.
// Bump VERSION whenever any file below changes.
const VERSION = 'v1';
const FILES = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'metro.js', 'metro.wasm', 'metro.data',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // the page itself carries ?from=&to=, so match it to the cached shell
  const req = url.origin === location.origin && url.pathname.endsWith('/') ? './' : e.request;
  e.respondWith(caches.match(req).then((hit) => hit || fetch(e.request)));
});
