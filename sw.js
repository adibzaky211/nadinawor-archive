// Nadin PWA Service Worker - Fresh Cache Purge v12
const CACHE_NAME = 'nadin-clean-v12';

self.addEventListener('install', e => {
  // Force new service worker to activate immediately without waiting
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    // Wipe all existing browser caches completely
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => {
        // Automatically reload any open browser tabs to apply the clean update
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(c => {
            if (c.url && 'navigate' in c) {
              c.navigate(c.url);
            }
          });
        });
      })
  );
});

self.addEventListener('fetch', e => {
  // 1. NEVER intercept non-GET requests (POST /api/upload, POST /api/sync)
  if (e.request.method !== 'GET') {
    return;
  }

  // 2. NEVER cache /api/ endpoints
  if (e.request.url.includes('/api/')) {
    return;
  }

  // 3. For navigation (HTML page), ALWAYS bypass cache and fetch directly from network
  if (e.request.mode === 'navigate' || e.request.url.endsWith('index.html') || e.request.url.endsWith('/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 4. Default: pass through directly to network
  e.respondWith(fetch(e.request));
});
