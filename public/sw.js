// Lets Whiskers' River Journey open like an app and keep working with a weak connection.
// Pages: try the network first (so updates show up), fall back to the saved copy.
// Built files (their names change every release): use the saved copy first.
const CACHE = 'whiskers-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The page sends the files it just loaded: save them (so even the first visit works offline
// next time) and drop files from older versions of the game.
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'cache-these') return;
  const urls = event.data.urls.filter((u) => new URL(u).origin === self.location.origin);
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all(urls.map((u) => cache.add(u).catch(() => {})));
      const keep = new Set(urls);
      for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // sign-in and cloud save go straight through

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req, { ignoreVary: true }).then((r) => r || caches.match('./', { ignoreVary: true })))
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
