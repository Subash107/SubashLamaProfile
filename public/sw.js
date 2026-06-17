const CACHE = 'portfolio-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/projects.html',
  '/favicon.svg',
  '/manifest.json',
  '/assets/css/index.css',
  '/assets/css/motion.css',
  '/assets/css/projects.css',
  '/assets/js/site.js',
  '/assets/js/index.js',
  '/assets/js/parrot-fx.js',
  '/assets/images/bg-poster.jpg',
  '/assets/vendor/bootstrap/bootstrap.min.css',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname === 'api.github.com' || url.hostname.endsWith('goatcounter.com')) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      });
      return cached || network;
    })
  );
});
