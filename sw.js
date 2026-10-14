const CACHE = 'dny-v2';
const ASSETS = ['./', './index.html', './manifest.json', './icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// App files: try the network first so updates arrive fast.
// If the network is slow (3 seconds) or offline, serve the saved copy.
function networkFirst(req) {
  return new Promise(resolve => {
    let settled = false;
    const fallback = () => caches.match(req).then(r => r || caches.match('./index.html'));
    const timer = setTimeout(() => {
      fallback().then(r => {
        if (r && !settled) { settled = true; resolve(r); }
      });
    }, 3000);
    fetch(req).then(res => {
      clearTimeout(timer);
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      if (!settled) { settled = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      fallback().then(r => {
        if (!settled) { settled = true; resolve(r || Response.error()); }
      });
    });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(networkFirst(req));
    return;
  }

  // Google Fonts: cache first, they rarely change.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }))
    );
  }
});
