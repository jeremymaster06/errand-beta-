self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const c=r.clone();caches.open('v1').then(k=>k.put(e.request,c));return r}).catch(()=>caches.match(e.request)))});
