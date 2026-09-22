// Raaji store PWA service worker (network-first, no stale data/images).
const VERSION = 'raaji-cache-v29';

self.addEventListener('install', (e) => self.skipWaiting());

self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;

  // Never serve a stale cached product catalog, price data, or product image.
  // Always hit the network so admin edits and updated prices/images show up in
  // the installed (PWA) app.
  if (url.includes('/api/') || url.includes('onrender.com') ||
      url.includes('/js/data.js') || url.includes('images/products/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Network-first for the app shell (html/css/js); fall back to cache offline.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});