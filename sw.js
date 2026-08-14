const CACHE = 'raaji-cache-v10';
const ASSETS = [
  '/raajicollections/',
  '/raajicollections/index.html',
  '/raajicollections/sarees.html',
  '/raajicollections/videos/saree-1.mp4',
  '/raajicollections/videos/saree-2.mp4',
  '/raajicollections/blouses.html',
  '/raajicollections/jewellery.html',
  '/raajicollections/nightdresses.html',
  '/raajicollections/kidswear.html',
  '/raajicollections/boys.html',
  '/raajicollections/girls.html',
  '/raajicollections/css/style.css',
  '/raajicollections/js/config.js',
  '/raajicollections/js/cart.js',
  '/raajicollections/js/prices.js',
  '/raajicollections/js/script.js',
  '/raajicollections/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then(m => m || caches.match('/raajicollections/index.html')))
  );
});
