const CACHE_NAME = 'nexus-v2';
const STATIC_ASSETS = [
  './smart-dashboard.html',
  './manifest.json',
  './nexus-icon.svg'
];

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - API/external calls: network first, fallback to cache
// - Static assets: cache first, fallback to network
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Always network-first for live data APIs
  const isLiveData =
    url.includes('api.rss2json.com') ||
    url.includes('wttr.in') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com');

  if (isLiveData) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // Cache a copy of API responses for offline fallback
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache first for static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone)).catch(() => {});
        return res;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./smart-dashboard.html');
        }
      });
    })
  );
});
