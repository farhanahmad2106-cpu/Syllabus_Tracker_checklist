/**
 * Service Worker: Syllabus Tracker Offline PWA Shell
 * Version: syllabus-static-v1
 */

const CACHE_NAME = 'syllabus-static-v1';

// Core static assets for the offline application shell
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

// Install: precache application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache asset failure (will be fetched on demand):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up outdated versioned caches and claim active clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Pruning outdated cache:', name);
            return caches.delete(name);
          }
          return Promise.resolve(false);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch handler: Cache-First for static assets, Network-First with /index.html fallback for navigation
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. NEVER intercept or cache mutations or SSE progress streams
  if (
    req.method !== 'GET' ||
    url.pathname.includes('/api/upload/progress') ||
    url.pathname.startsWith('/api/')
  ) {
    // Let API calls pass directly through to network (our IndexedDB layer handles data persistence)
    return;
  }

  // 2. Navigation requests: Network-first with offline /index.html shell fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match('/index.html').then((cached) => {
          return cached || new Response('Offline: Syllabus Tracker app shell not cached yet.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        });
      })
    );
    return;
  }

  // 3. Static assets: Cache-First, falling back to network and updating cache
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to revalidate cache if possible
        fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse));
            }
          })
          .catch(() => {
            // Quietly ignore background network failure while offline
          });
        return cachedResponse;
      }

      return fetch(req).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Only cache same-origin static assets
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});
