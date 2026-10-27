// Keeps the app shell on the phone so it opens instantly and still loads with no signal.
// Fresh copy first, saved copy when offline. Audio previews always come straight from the network.
// CACHE is restamped by tools/deploy.mjs on every deploy; that change is what tells phones to update.
const CACHE = 'ssar-20261027125028'
const SHELL = ['./', 'partner/songchainn.png', 'fonts/jakarta.woff2', 'styles.css', 'app.js', 'art.js', 'data/beats.js', 'data/peaks.js', 'data/env.js',
  'fonts/outfit.woff2', 'icon.svg', 'icons/icon-192.png', 'manifest.webmanifest']

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())))
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())))

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/audio/') || req.headers.has('range')) return
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) }
      return res
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('./') : Response.error())))
  )
})
