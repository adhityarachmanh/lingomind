const CACHE_NAME = 'lingomind-pwa-cache-v2';
const URLS_TO_CACHE = [
  '/',
  '/assets/tailwind.css',
  '/assets/favicon.ico',
  '/assets/icon.svg',
  '/assets/logo.png',
  '/assets/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(URLS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Hanya intercept GET request HTTP/HTTPS
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Pengecualian untuk URL API/Server Functions yang mungkin butuh ditangani berbeda
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Network First, Cache Fallback strategy untuk aset statis dan routing
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          // Cache response sukses
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // Jika offline, cari di cache
        return caches.match(event.request).then(cachedResponse => {
           if (cachedResponse) {
               return cachedResponse;
           }
           // Jika halaman rute tidak ditemukan di cache, kembalikan ke / (karena ini SPA)
           if (event.request.mode === 'navigate') {
               return caches.match('/');
           }
        });
      })
  );
});
