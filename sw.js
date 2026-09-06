const CACHE = 'raaji-cache-v28';
const ASSETS = [
  '/raajicollections/',
  '/raajicollections/index.html',
  '/raajicollections/sarees.html',
  '/raajicollections/dresses.html',
  '/raajicollections/blouses.html',
  '/raajicollections/jewellery.html',
  '/raajicollections/nightdresses.html',
  '/raajicollections/kidswear.html',
  '/raajicollections/boys.html',
  '/raajicollections/girls.html',
  '/raajicollections/css/style.css',
  '/raajicollections/images/jewellery-category.jpg',
  '/raajicollections/images/dresses-category.jpg',
  '/raajicollections/js/config.js',
  '/raajicollections/js/cart.js',
  '/raajicollections/js/prices.js',
  '/raajicollections/js/products.js',
  '/raajicollections/js/static-products.js',
  '/raajicollections/js/data.js',
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
  const url = e.request.url;
  // Never serve a stale cached price/catalog from the API - always hit the
  // network so admin edits are reflected in the installed (PWA) app.
  if (url.includes('/api/') || url.includes('onrender.com')) {
    e.respondWith(fetch(e.request));
    return;
  }
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
