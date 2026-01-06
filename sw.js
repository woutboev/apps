const CACHE_NAME = 'overleg-app-v1';
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Install event - cache bestanden
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache geopend');
                return cache.addAll(urlsToCache);
            })
            .catch(err => {
                console.log('Cache fout:', err);
                // Installatie doorgaat ook als cache faalt
                return Promise.resolve();
            })
    );
});

// Fetch event - serveer vanuit cache
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                
                // Clone request omdat het één keer gebruikt kan worden
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest).then(response => {
                    // Check of we een valide response hebben
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Clone response omdat het één keer gebruikt kan worden
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                });
            })
    );
});

// Activate event - verwijder oude caches
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
