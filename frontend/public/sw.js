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

// Helper to store PWA Web Share Target data into temporary IndexedDB
function savePwaSharedItem(data) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('syllabus_pwa_share_db', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('shared_items')) {
          db.createObjectStore('shared_items', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('shared_items', 'readwrite');
        tx.objectStore('shared_items').add(data);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// Fetch handler: Cache-First for static assets, Network-First with /index.html fallback for navigation
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 0. Phase 13 Cycle C: Handle PWA Web Share Target POST /share-target
  if (req.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(
      (async () => {
        try {
          const formData = await req.formData();
          const files = formData.getAll('documents');
          const sharedUrl = formData.get('url') || formData.get('text');

          let sharedFile = null;
          if (files && files.length > 0 && files[0] instanceof File) {
            sharedFile = files[0];
          }

          const rawUrl = typeof sharedUrl === 'string' ? sharedUrl.trim() : '';
          const validUrl = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) ? rawUrl : undefined;

          if (sharedFile || validUrl) {
            await savePwaSharedItem({
              file: sharedFile || undefined,
              url: validUrl,
              createdAt: Date.now(),
            });
          }
        } catch (err) {
          console.warn('[SW] Error processing share-target payload:', err);
        }
        return Response.redirect('/?pwa_shared=1', 303);
      })()
    );
    return;
  }

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
