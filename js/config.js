const API_CONFIG = {
  baseUrl: 'https://raaji-collections.onrender.com',
};
window.API_CONFIG = API_CONFIG;

const STORE_CONFIG = {
  whatsappNumber: '918125491097',
  currency: '₹',
  upiId: '8125491097@ybl',
  upiName: 'Raaji Collections'
};
window.STORE_CONFIG = STORE_CONFIG;

// Register the service worker so the installed Raaji PWA stays up to date
// (network-first; never caches stale product data/images).
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
