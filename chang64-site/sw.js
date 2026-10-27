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
const CACHE="chang64-202610271918";
const DATA_CACHE="chang64-data-993b2252311c";
/* Plafond du cache de donnees en OCTETS (2026-10-25), et non plus en nombre
   d'entrees. Les trois entrees du 2026-09-06 visaient des shards de 1 a 2 Mo,
   soit environ 5 Mo, loin des 17 Mo qui avaient fait sauter le quota iOS et
   evince le cache ENTIER, coquille de l'application comprise. Depuis le
   decoupage de la banque, les fichiers pesent 3 Ko a 1,2 Mo et une seance
   ordinaire en demande neuf (index et morceau du niveau, jour.json, ids/,
   theme-counts, rush-pool...) : les trois derniers chassaient ceux du niveau
   et, en mode avion, les exercices ne se chargeaient plus. On garde donc
   l'enveloppe de 5 Mo, mesuree fichier par fichier. */
const DATA_PLAFOND=5*1024*1024;
/* Les ecritures du cache de donnees sont mises a la queue leu leu. Mesure
   avant serialisation : cinq shards demandes en meme temps laissaient six
   entrees au lieu de trois, chaque requete lisant keys() avant qu'aucune
   ecriture n'ait atterri, donc aucune ne voyait de raison d'evincer. Le
   plafond ne tenait pas du tout. Ne pas remplacer cette chaine par des
   appels paralleles. */
let fileDeco=Promise.resolve();
/* Range une reponse en fin de file, puis evince par le debut tant que le
   total depasse le plafond. keys() rend les entrees dans leur ordre
   d'insertion : la premiere est la moins recemment utilisee, parce qu'une
   lecture dans le cache repasse aussi par ici (sinon l'index d'un niveau,
   charge une fois puis toujours lu depuis le cache, restait en tete et
   partait le premier). La taille est notee dans un en-tete a l'ecriture,
   pour ne pas relire chaque corps a chaque eviction. L'entree qu'on vient
   de ranger n'est jamais evincee. */
function ranger(c,r,resp){
  fileDeco=fileDeco.then(()=>resp.blob()).then(b=>{
    const h=new Headers(resp.headers);
    h.set("x-chang64-octets",String(b.size));
    return c.delete(r).then(()=>c.put(r,new Response(b,{status:resp.status,statusText:resp.statusText,headers:h})));
  }).then(()=>c.keys()).then(ks=>Promise.all(ks.map(k=>c.match(k).then(x=>x&&+x.headers.get("x-chang64-octets")||0))).then(tailles=>{
    let total=tailles.reduce((a,t)=>a+t,0);
    const vieux=[];
    for(let i=0;i<ks.length-1&&total>DATA_PLAFOND;i++){total-=tailles[i];vieux.push(c.delete(ks[i]));}
    return Promise.all(vieux);
  })).catch(()=>{});
}
/* "/index.html" retire de CORE et du repli hors ligne (2026-10-24) : Pages le
   redirige en 308 vers "/", et une reponse redirigee servie a une navigation
   est refusee par le navigateur. Le repli tombait donc en erreur. */
const CORE=["/","/manifest.webmanifest","/favicon.svg","/favicon.ico","/icon-192.png","/icon-512.png","/openings/"];
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
  if(url.pathname.startsWith("/api/"))return;      // compteurs du serveur : jamais en cache
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
     Depuis le 2026-09-06 ils reviennent dans un cache A PART, plafonne
     (DATA_PLAFOND). Le cache separe et le plafond traitent la vraie cause
     du probleme iOS, qui etait le volume, pas la mise en cache elle-meme.
     Ne pas remettre ces fichiers dans CACHE : c'est ce melange qui faisait
     tomber la coquille avec les donnees. */
  if(url.pathname.startsWith("/data/")){
    e.respondWith(
      caches.open(DATA_CACHE).then(c=>c.match(r).then(hit=>{
        if(hit){ranger(c,r,hit.clone());return hit;}
        return fetch(r).then(resp=>{
          if(resp&&resp.ok)ranger(c,r,resp.clone());
          return resp;
        });
      }))
      /* Hors ligne et jamais mis en cache : on laisse l'echec remonter tel
         quel, fetchJSON le traduit en message lisible (puzzleDataError). */
    );
    return;
  }
  /* Pages HTML rangees sous leur seul chemin (2026-10-24). La cle etait la
     requete entiere, chaine de requete comprise : "/", "/?fbclid=..." et
     "/?utm_source=..." faisaient chacune une entree de la coquille, sans
     plafond, a chaque lien partage sur un reseau social. C'est exactement le
     gonflement qui fait sauter le quota iOS (voir DATA_PLAFOND plus haut). Aucune
     page ne lit sa chaine de requete cote serveur : le HTML est le meme, une
     seule entree suffit. Le reseau recoit toujours l'adresse complete. Les
     autres fichiers gardent leur requete pour cle. */
  const page=r.mode==="navigate"||(r.headers.get("accept")||"").includes("text/html");
  const cle=page?url.origin+url.pathname:r;
  /* Repli hors ligne dans la langue de la page demandee (2026-10-25) :
     l'accueil de cette langue s'il a deja ete visite, sinon "/". */
  const langue=/^\/(fr|es|pt|de|ru)\//.exec(url.pathname);
  e.respondWith(
    caches.match(cle).then(hit=>hit||fetch(r).then(resp=>{
      const copy=resp.clone();
      caches.open(CACHE).then(c=>c.put(cle,copy)).catch(()=>{});
      return resp;
    }).catch(()=>(langue?caches.match("/"+langue[1]+"/"):Promise.resolve()).then(h=>h||caches.match("/"))))
  );
});
