const PREFIX='four-cells:'+new URL(self.registration.scope).pathname+':';
const CACHE=PREFIX+'v1';
const ASSETS=['./','./index.html','./style.css','./app.js','./game.js','./manifest.webmanifest','./icon.svg','./icons/icon-192.png','./icons/icon-512.png'];
const urls=ASSETS.map(path=>new URL(path,self.registration.scope).href);
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(urls.map(url=>new Request(url,{cache:'reload'})));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
  if(request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const response=await cache.match(request,{ignoreSearch:true});
    if(response)return response;
    if(request.mode==='navigate')return(await cache.match(new URL('index.html',self.registration.scope).href))||Response.error();
    return new Response('Not found',{status:404});
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type!=='CHECK_OFFLINE')return;
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE),ready=(await Promise.all(urls.map(url=>cache.match(url)))).every(Boolean);
    event.ports[0]?.postMessage({ready});
  })());
});
