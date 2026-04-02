// ═══════════════════════════════════════════════════
// SERVICE WORKER — Athletic Body Plan V3
// Cache-first strategy pour fonctionnement hors ligne
// ═══════════════════════════════════════════════════

const CACHE_NAME = 'atp-v3-cache-v1';
const FONTS_CACHE = 'atp-fonts-v1';

// Ressources à mettre en cache au premier chargement
const STATIC_ASSETS = [
  '/',
  '/index.html'
];

// Domaines autorisés pour le cache polices
const FONT_DOMAINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// ─── INSTALLATION ──────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(function() {
        // Activer immédiatement sans attendre
        return self.skipWaiting();
      })
      .catch(function(err) {
        console.log('[SW] Install error:', err);
      })
  );
});

// ─── ACTIVATION ────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    Promise.all([
      // Supprimer les anciens caches
      caches.keys().then(function(cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function(name) {
              return name !== CACHE_NAME && name !== FONTS_CACHE;
            })
            .map(function(name) {
              return caches.delete(name);
            })
        );
      }),
      // Prendre le contrôle immédiatement
      self.clients.claim()
    ])
  );
});

// ─── STRATÉGIE DE CACHE ────────────────────────────
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);

  // Polices Google — cache long
  if (FONT_DOMAINS.some(function(d) { return url.hostname.includes(d); })) {
    event.respondWith(
      caches.open(FONTS_CACHE).then(function(cache) {
        return cache.match(event.request).then(function(response) {
          if (response) return response;
          return fetch(event.request).then(function(networkResponse) {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }).catch(function() {
            return new Response('', {status: 503});
          });
        });
      })
    );
    return;
  }

  // HTML principal — Network first, fallback cache
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(function() {
          // Hors ligne → servir depuis le cache
          return caches.match(event.request).then(function(cached) {
            return cached || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Tout le reste — Cache first
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request).catch(function() {
        return new Response('Hors ligne', {status: 503, statusText: 'Service Unavailable'});
      });
    })
  );
});

// ─── MESSAGE — Force update ─────────────────────────
self.addEventListener('message', function(event) {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
