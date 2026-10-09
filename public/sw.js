// Offline support. Network first, so an update is never hidden behind a stale
// cache; the cached copy is used only when the network is unavailable.
const CACHE = 'swarm-doctrine-dev-v5';
const SHELL = ['./', 'index.html', 'connect.html', 'manifest.webmanifest', 'icons/icon.svg', 'models/offline-policy.json'];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('swarm-doctrine-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
    event.respondWith(fetch(event.request).then(response => {
        if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
        }
        return response;
    }).catch(async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
            const index = await cache.match(new URL('index.html', self.registration.scope));
            if (index) return index;
        }
        return new Response('Unavailable offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }));
});
