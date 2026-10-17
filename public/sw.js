/* Service worker — makes the portal usable on weak and intermittent
   connections (e.g. learners in remote border districts):
   • app shell and hashed assets are cached after the first visit
   • department content (snapshot) is network-first with a short timeout,
     falling back to the last saved copy when the signal drops
   • PDFs, portraits and video thumbnails are kept after first use
   It never touches the admin console, logins, or any POST request. */

const VERSION = '2026-10-17.2';
const SHELL = `shell-${VERSION}`;
const ASSETS = 'assets-v1';
const DATA = 'data-v1';
const FILES = 'files-v1';
const KEEP = [SHELL, ASSETS, DATA, FILES];
const PRECACHE = ['/', '/offline.html', '/offline.css', '/favicon.svg', '/boot.js'];
const NET_TIMEOUT = 4500;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function timeoutFetch(request, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then((r) => { clearTimeout(t); resolve(r); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

async function networkFirst(request, cacheName, cacheKey = request) {
  const cache = await caches.open(cacheName);
  try {
    const res = await timeoutFetch(request, NET_TIMEOUT);
    if (res.ok) cache.put(cacheKey, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(cacheKey, { ignoreSearch: true });
    if (hit) return hit;
    throw e;
  }
}

async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') {
    await cache.put(request, res.clone());
    if (max) trim(cacheName, max);
  }
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const fresh = fetch(request).then((res) => { if (res.ok) cache.put(request, res.clone()); return res; }).catch(() => hit);
  return hit || fresh;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/admin')) return; // never cache the console
    if (req.mode === 'navigate') {
      event.respondWith(
        networkFirst(req, SHELL, '/').catch(async () => (await caches.match('/offline.html')) || Response.error()),
      );
      return;
    }
    if (url.pathname.startsWith('/assets/')) return event.respondWith(cacheFirst(req, ASSETS, 120));
    if (url.pathname.startsWith('/data/') || PRECACHE.includes(url.pathname)) return event.respondWith(staleWhileRevalidate(req, SHELL));
    return;
  }

  if (url.hostname.endsWith('.supabase.co')) {
    const p = url.pathname;
    if (p.includes('/storage/v1/object/public/snapshot/')) return event.respondWith(networkFirst(req, DATA, url.origin + url.pathname));
    if (p.includes('/storage/v1/object/public/documents/')) return event.respondWith(cacheFirst(req, FILES, 40));
    if (p.includes('/storage/v1/object/public/media/')) return event.respondWith(cacheFirst(req, FILES, 80));
    return; // REST, auth and functions always go to the network
  }

  if (url.hostname === 'i.ytimg.com') event.respondWith(cacheFirst(req, FILES, 120));
});
