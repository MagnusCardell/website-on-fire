const CACHE_NAME = 'solitaire-v2';
const SHELL_ASSETS = [
  '/solitaire/',
  '/solitaire/manifest.webmanifest',
  '/solitaire/icon-192.png',
  '/solitaire/icon-512.png',
];

// Install event - cache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('solitaire-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Check if URL should be cached (only /solitaire/** routes)
function shouldCache(url) {
  const pathname = new URL(url).pathname;
  return pathname.startsWith('/solitaire/') || pathname === '/solitaire';
}

// Fetch event - network first for solitaire routes only
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only handle same-origin solitaire requests
  if (url.origin !== self.location.origin || !shouldCache(url.href)) {
    return;
  }

  // For navigation requests, use network-first with cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => caches.match('/solitaire/'))
    );
    return;
  }

  // For assets (js, css, images), use cache-first for hashed bundles
  const isHashedAsset = /\/assets\/.*\.[a-f0-9]{8,}\.(js|css)$/.test(url.pathname);
  
  if (isHashedAsset) {
    // Cache-first for immutable hashed assets
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for other solitaire assets
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
