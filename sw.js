/* BEAUTY SALON MANAGER — service worker : fonctionnement hors connexion.
   - Fichiers de l'application (même origine) : réseau d'abord, copie locale si hors ligne.
   - Bibliothèques CDN (Chart.js, jsPDF, polices) : copie locale d'abord.
   Pour publier une mise à jour, changez le numéro de version CACHE. */
const CACHE = 'bsm-v1';
const SHELL = [
  './', './index.html', './manifest.json', './css/styles.css',
  './js/db.js', './js/core.js', './js/pages-a.js', './js/pages-b.js',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;

  if (sameOrigin) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) caches.open(CACHE).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => new Response('', { status: 504 })))
  );
});
