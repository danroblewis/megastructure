// Megastructure service worker: the whole game is a handful of files, so they are all cached on install
// and served from the cache when the network is gone. Online, the network wins and refreshes the cache,
// so there is no version to bump when a script changes.
const CACHE='megastructure-1';
const CORE=['./','./index.html','./shaders.js','./gen.js','./sim.js','./schemes.js','./lab.js','./check.js','./main.js','./manifest.json','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-180.png','./schemes.html'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{ const req=e.request; if(req.method!=='GET'||new URL(req.url).origin!==location.origin) return;
  e.respondWith(fetch(req).then(res=>{ if(res&&res.ok){ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy)); } return res; })
    .catch(()=>caches.match(req,{ignoreSearch:true}).then(hit=>hit||(req.mode==='navigate'?caches.match('./index.html'):undefined)))); });
