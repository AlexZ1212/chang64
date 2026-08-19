/* chang64 offline cache
 *
 * chang64 - a free chess website
 * Copyright (C) 2026 AlexZ1212
 * https://github.com/AlexZ1212/chang64
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version. See https://chang64.com/LICENSE
 *
 * La version du cache est calculee a la construction : chaque build invalide
 * automatiquement le cache des visiteurs. Ne pas figer cette valeur.
 */
const CACHE="chang64-202608192023";
const CORE=["/","/index.html","/manifest.webmanifest","/icon-192.svg","/icon-512.svg","/openings/"];
self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()).catch(()=>{}));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",e=>{
  const r=e.request;
  if(r.method!=="GET")return;
  const url=new URL(r.url);
  if(url.origin!==location.origin)return;
  if(url.pathname.startsWith("/engine/"))return;   // 7 MB engine stays out of the cache
  e.respondWith(
    caches.match(r).then(hit=>hit||fetch(r).then(resp=>{
      const copy=resp.clone();
      caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{});
      return resp;
    }).catch(()=>caches.match("/index.html")))
  );
});
