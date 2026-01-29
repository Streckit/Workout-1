// Service Worker for Fitness Tracker PWA
const CACHE_NAME = 'fitness-tracker-v1';

// Cache core files - using relative paths for GitHub Pages compatibility
const urlsToCache = [
    './',
    './index.html',
    './app.js',
    './manifest.json'
];

// Install service worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                // Try to cache files, but don't fail if icons are missing
                return cache.addAll(urlsToCache).catch(err => {
                    console.log('Some files failed to cache, but that\'s okay');
                    return Promise.resolve();
                });
            })
            .then(() => self.skipWaiting())
    );
});

// Activate service worker
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
        }).then(() => self.clients.claim())
    );
});

// Fetch with cache-first strategy
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version or fetch from network
                return response || fetch(event.request)
                    .then(response => {
                        // Don't cache if not a successful response
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }

                        // Cache new requests
                        if (event.request.method === 'GET') {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => cache.put(event.request, responseClone))
                                .catch(err => console.log('Cache put failed:', err));
                        }
                        return response;
                    });
            })
            .catch(() => {
                // Return offline page if available
                if (event.request.destination === 'document') {
                    return caches.match('./index.html');
                }
            })
    );
});
