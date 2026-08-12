const CACHE="sakura-pos-mobile-v18";
const ASSETS=["./","index.html","admin.css?v=pos10","admin.js?v=pos13","menu-config.js?v=pos10","manifest.json","icon-192.png","icon-512.png","../js/config/brand-config.js","../js/data/menu-data.js?v=menu2x150-1","../js/services/menu-options-service.js?v=2","../logo.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET"||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match("./"))))});
