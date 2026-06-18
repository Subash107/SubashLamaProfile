const CACHE = 'portfolio-20260618';
const PRECACHE = [
  '/',
  '/index.html',
  '/projects.html',
  '/security.html',
  '/favicon.svg',
  '/manifest.json',
  '/assets/css/index.css',
  '/assets/css/motion.css',
  '/assets/css/parrot-fx.css',
  '/assets/js/site.js',
  '/assets/js/index.js',
  '/assets/js/parrot-fx.js',
  '/assets/images/bg-poster.jpg',
  '/assets/vendor/bootstrap/bootstrap.min.css',
  '/assets/vendor/bootstrap/bootstrap.bundle.min.js',
  '/assets/docs/cv/resume-manifest.json',
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
  if (
    url.hostname === 'api.github.com' ||
    url.hostname.endsWith('goatcounter.com') ||
    url.hostname === 'urlhaus-api.abuse.ch' ||
    url.hostname === 'ipapi.co'
  ) return;
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
