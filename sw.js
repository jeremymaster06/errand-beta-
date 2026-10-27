/* Network-first service worker for static app assets only (Shield F7).
   Caches only same-origin GET requests for an allowlisted static path/extension, with a 200 "basic"
   response and no Cache-Control: no-store/private. Never caches Google APIs (cross-origin, so ignored),
   /api/*, /auth/*, or any request carrying credentials/Authorization. */
// One registration per app scope (/customer/, /runner/, /owner/), each with its own cache.
const TAG = new URL(self.registration.scope).pathname.split('/').filter(Boolean).pop() || 'root';
const CACHE = 'errandco-v13-' + TAG;
const STATIC = /\.(?:html|js|css|svg|png|jpg|jpeg|webp|ico|woff2?|webmanifest)$/i;
const NEVER = /\/(?:api|auth|login|logout|session|oauth)(?:\/|$)/i;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && (k.endsWith('-' + TAG) || k.startsWith('errandco-redesign-'))).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('message', e => { if (e.data === 'logout') e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))))); });
function cacheable(req, url) {
  if (req.method !== 'GET' || url.origin !== location.origin) return false;
  if (NEVER.test(url.pathname) || url.search.includes('key=') || req.headers.has('Authorization')) return false;
  if (req.mode === 'navigate') return true;
  return STATIC.test(url.pathname) && !url.pathname.endsWith('/config.js');
}
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (!cacheable(e.request, url)) return; // browser handles it directly; nothing stored
  e.respondWith(fetch(e.request, { cache: 'no-store' }).then(r => {
    const cc = r.headers.get('Cache-Control') || '';
    if (r.ok && r.type === 'basic' && !/no-store|private/i.test(cc)) { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
