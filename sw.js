// Сначала сеть, при её отсутствии — кэш: онлайн всегда свежая версия, офлайн — последняя загруженная.
const CACHE = 'kartuli-v2';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'words.js',
  'app.js',
  'manifest.webmanifest',
  'fonts/golos-text-cyrillic.woff2',
  'fonts/golos-text-latin.woff2',
  'img/greetings.webp',
  'img/numbers.webp',
  'img/food.webp',
  'img/people.webp',
  'img/basics.webp',
  'img/tab-learn.svg',
  'img/tab-search.svg',
  'img/chevron-left.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }))
  );
});
