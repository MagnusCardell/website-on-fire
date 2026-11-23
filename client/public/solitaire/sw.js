// Service worker for the solitaire app shell.
//
// The build stamps BUILD_ID and PRECACHE (scripts/inject-sw-assets.ts) with every
// file the page needs. The whole set is cached at install, and the app is then
// served from that cache alone: a launch never waits on the network, so it works
// in flight mode and behind a wifi portal. A new build has a new BUILD_ID, is
// cached as a whole next to the old one, and replaces it on activate.
//
// Unstamped (the dev server), the worker installs and stays out of the way.
const BUILD_ID = 'dev'; // __BUILD_ID__
const PRECACHE = [
  // __PRECACHE__
];

const SHELL = '/solitaire/';
const CACHE_PREFIX = 'solitaire-';
const CACHE_NAME = CACHE_PREFIX + BUILD_ID;
const ENABLED = BUILD_ID !== 'dev';
const PRECACHED_PATHS = new Set(PRECACHE);

self.addEventListener('install', (event) => {
  if (!ENABLED) {
    self.skipWaiting();
    return;
  }

  event.waitUntil(
    caches.open(CACHE_NAME)
      // 'reload' skips the browser's own cache, so the set is exactly this build
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

function fromCache(path) {
  return caches.open(CACHE_NAME).then((cache) => cache.match(path, { ignoreSearch: true }));
}

self.addEventListener('fetch', (event) => {
  if (!ENABLED) return;

  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The page itself is always the cached shell
  if (request.mode === 'navigate') {
    if (url.pathname === '/solitaire' || url.pathname.startsWith(SHELL)) {
      event.respondWith(fromCache(SHELL).then((cached) => cached || fetch(request)));
    }
    return;
  }

  // Everything the shell loads, wherever on the origin it is served from
  if (PRECACHED_PATHS.has(url.pathname)) {
    event.respondWith(fromCache(url.pathname).then((cached) => cached || fetch(request)));
  }
});
