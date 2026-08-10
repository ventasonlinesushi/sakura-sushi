const CACHE = "sakura-admin-pos7";
const ASSETS = [
  "/admin/",
  "/admin/index.html",
  "/admin/admin.css?v=pos7",
  "/admin/admin.js?v=pos7",
  "/admin/cocina.html",
  "/admin/cocina.css",
  "/admin/cocina.js",
  "/admin/manifest.json",
  "../js/config/brand-config.js",
  "../js/data/menu-data.js",
  "../logo.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request))
  );
});
