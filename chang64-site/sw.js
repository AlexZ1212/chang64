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
const CACHE="chang64-202609121505";
const DATA_CACHE="chang64-data-202609121505";
/* Trois entrees au maximum dans le cache de donnees (2026-09-06). Un shard
   de niveau pese 1 a 2 Mo : trois plafonnent l'occupation autour de 5 Mo,
   loin des 17 Mo qui avaient fait sauter le quota iOS et evince le cache
   ENTIER, coquille de l'application comprise. En pratique un joueur reste
   sur son niveau et le suivant, donc trois suffisent presque toujours. */
const DATA_MAX=3;
/* Les ecritures du cache de donnees sont mises a la queue leu leu. Mesure
   avant serialisation : cinq shards demandes en meme temps laissaient six
   entrees au lieu de trois, chaque requete lisant keys() avant qu'aucune
   ecriture n'ait atterri, donc aucune ne voyait de raison d'evincer. Le
   plafond ne tenait pas du tout. Ne pas remplacer cette chaine par des
   appels paralleles. */
let fileDeco=Promise.resolve();
const CORE=["/","/index.html","/manifest.webmanifest","/icon-192.svg","/icon-512.svg","/openings/"];
self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()).catch(()=>{}));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==DATA_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",e=>{
  const r=e.request;
  if(r.method!=="GET")return;
  const url=new URL(r.url);
  if(url.origin!==location.origin)return;
  if(url.pathname.startsWith("/engine/"))return;   // 7 MB engine stays out of the cache
  /* Les shards d'exercices (17 Mo au total : level-1..10, rush-pool,
     puzzle-index) etaient mis en cache sans plafond. Sur iOS le quota par
     origine est etroit et son depassement evince le cache ENTIER, coquille
     de l'application comprise : le site tombait alors hors ligne d'un coup.
     Les exclure a mis la coquille a l'abri, mais au prix d'une perte seche :
     sans reseau, /data/ ne repondait plus du tout, exQuest restait sur
     "Loading…" et le site affichait "Impossible de charger les exercices".
     Un utilisateur en avion perdait donc les exercices, c'est-a-dire la
     moitie du site. Mesure faite en bloquant /data/ : l'echiquier restait
     affiche, vide, sous un message d'erreur.
     Depuis le 2026-09-06 ils reviennent dans un cache A PART, plafonne a
     DATA_MAX entrees. Le cache separe et le plafond traitent la vraie cause
     du probleme iOS, qui etait le volume, pas la mise en cache elle-meme :
     trois shards pesent environ 5 Mo la ou la banque entiere en pesait 17.
     Ne pas remettre ces fichiers dans CACHE : c'est ce melange qui faisait
     tomber la coquille avec les donnees. */
  if(url.pathname.startsWith("/data/")){
    e.respondWith(
      caches.open(DATA_CACHE).then(c=>c.match(r).then(hit=>hit||fetch(r).then(resp=>{
        if(resp&&resp.ok){
          const copy=resp.clone();
          /* Plafond applique a l'ecriture, une ecriture a la fois : on evince
             la plus ancienne entree plutot que de laisser le cache grossir.
             keys() rend les entrees dans leur ordre d'insertion, la premiere
             est donc la plus vieille. */
          fileDeco=fileDeco.then(()=>c.keys().then(ks=>{
            const trop=ks.length-(DATA_MAX-1);
            return trop>0?Promise.all(ks.slice(0,trop).map(k=>c.delete(k))):null;
          }).then(()=>c.put(r,copy))).catch(()=>{});
        }
        return resp;
      })))
      /* Hors ligne et jamais mis en cache : on laisse l'echec remonter tel
         quel, fetchJSON le traduit en message lisible (puzzleDataError). */
    );
    return;
  }
  e.respondWith(
    caches.match(r).then(hit=>hit||fetch(r).then(resp=>{
      const copy=resp.clone();
      caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{});
      return resp;
    }).catch(()=>caches.match("/index.html")))
  );
});
