// Offline support: fetch fresh files when there is a signal, fall back to the saved copy when there
// isn't (underground). Network-first means a bad deploy or stale cache can never trap a device.
const VERSION = 'nextstop-v3';
const FILES = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icon.svg',
  'fonts/mukta-400.woff2', 'fonts/mukta-500.woff2', 'fonts/mukta-600.woff2', 'fonts/mukta-700.woff2',
  'metro.js', 'metro.wasm', 'metro.data',
];

// A static host may answer a missing file with its HTML page and a 200. Never save that as an asset.
const usable = (url, res) => {
  if (!res || !res.ok) return false;
  const type = res.headers.get('content-type') || '';
  const isPage = /\/($|\?)|\.html($|\?)/.test(url) || url.endsWith('/');
  return isPage || !type.includes('text/html');
};

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(VERSION).then((cache) =>
      Promise.all(
        FILES.map(async (f) => {
          const res = await fetch(f, { cache: 'reload' });
          if (!usable(new URL(f, self.registration.scope).href, res)) throw new Error('bad asset ' + f);
          await cache.put(f, res);
        })
      )
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // the page itself carries ?from=&to=, so match it to the cached shell
  const key = url.pathname.endsWith('/') ? './' : e.request;

  e.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const saved = () => cache.match(key);
      try {
        const res = await Promise.race([
          fetch(e.request),
          new Promise((_, no) => setTimeout(no, 4000, new Error('slow'))),
        ]);
        if (usable(url.href, res)) cache.put(key, res.clone());
        else return (await saved()) || res;
        return res;
      } catch {
        return (await saved()) || Response.error();
      }
    })()
  );
});
