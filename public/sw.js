const STATIC_CACHE = 'verbalibera-static-v4';
const STATIC_ASSETS = [
  '/offline.html',
  '/icons/verbalibera-192.png',
  '/icons/verbalibera-512.png',
  '/icons/verbalibera-maskable-512.png',
  '/illustrations/daily-practice.png',
  '/audio/french-ordering/fr-ordering-politely-prompt.wav',
  '/audio/french-ordering/fr-ordering-politely-answer.wav',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => (key.startsWith('verbalibera-static-') || key.startsWith('voxlibre-static-')) && key !== STATIC_CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

async function installedAsset(path) {
  for (const key of (await caches.keys()).reverse()) {
    if (!key.startsWith('verbalibera-pack-')) continue;
    const cache = await caches.open(key);
    if (!await cache.match('/__course_pack_ready__')) continue;
    const response = await cache.match(path);
    if (response) return response;
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Account data and authentication are always network-only (Cache-Control: no-store).
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  // Explicit public offline entry only; no personalized Next navigation is cached.
  if (['/study.html', '/study.js', '/study.css'].includes(url.pathname) || url.pathname.startsWith('/packs/')) {
    event.respondWith(fetch(request).catch(async () => (await installedAsset(url.pathname)) ?? Response.error()));
    return;
  }
  // Lesson HTML and RSC payloads can contain personal progress. Never cache them.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html').then(response => response ?? Response.error())));
    return;
  }
  if (url.pathname.startsWith('/audio/') || url.pathname.startsWith('/images/') || url.pathname.startsWith('/_next/static/')) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && !/private|no-store/.test(response.headers.get('cache-control') ?? '')) {
        const clone = response.clone();
        event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.put(request, clone)));
      }
      return response;
    }).catch(async () => (await installedAsset(url.pathname)) ?? (await caches.match(request)) ?? Response.error()));
  }
});
