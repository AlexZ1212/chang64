/* Verification automatique de chang64.
   Lancement : node tests/check_service_worker.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (ajoute le 2026-09-06, apres un defaut trouve en
   audit) : les shards d'exercices avaient ete exclus du service worker pour
   proteger la coquille de l'application du quota iOS. La protection marchait,
   mais elle coutait tout l'acces hors ligne aux exercices : sans reseau, le
   site affichait "Impossible de charger les exercices".
   Ils sont revenus dans un cache separe et plafonne. Ce test verifie le
   contrat qui rend les deux choses vraies en meme temps, parce qu'il est
   facile de casser l'une en touchant a l'autre :
     - un cache DISTINCT pour les donnees, jamais melange a la coquille ;
     - un plafond d'entrees, sinon on retombe sur les 17 Mo d'origine ;
     - des ecritures serialisees, sans quoi le plafond ne tient pas du tout
       (mesure : six entrees au lieu de trois avec des ecritures paralleles) ;
     - les deux caches epargnes par le menage de l'activation.
   Le comportement reel hors ligne demande un vrai navigateur et n'est pas
   verifiable ici ; ce test garde la forme, pas le vecu. */
const SITE = require("path").join(__dirname, "..", "site");
const fs=require("fs");
const sw=fs.readFileSync(SITE+"/sw.js","utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};

console.log("\n--- Deux caches distincts ---");
T("cache de la coquille", /const CACHE="chang64-\d+"/.test(sw));
/* Depuis le 2026-10-25, la version du cache de donnees est une empreinte
   du contenu de data/ (hexadecimale), plus l'heure du build. */
T("cache de donnees separe", /const DATA_CACHE="chang64-data-[0-9a-f]{12}"/.test(sw));
T("les deux versionnes par la construction",
  (sw.match(/chang64-\d+/)||[])[0]&&(sw.match(/chang64-data-[0-9a-f]+/)||[])[0]);
{
  /* L'empreinte suit les donnees : on la recalcule ici sur site/data. */
  const h=require("crypto").createHash("sha1"), path=require("path");
  const parcourir=d=>{for(const n of fs.readdirSync(d).sort()){const f=path.join(d,n);
    if(fs.statSync(f).isDirectory())parcourir(f);
    else h.update(path.relative(SITE,f).replace(/\\/g,"/")+"\n").update(fs.readFileSync(f));}};
  parcourir(path.join(SITE,"data"));
  const attendue=h.digest("hex").slice(0,12), lue=(sw.match(/chang64-data-([0-9a-f]+)/)||[])[1];
  T("version des donnees = empreinte de data/", lue===attendue, lue+" / "+attendue);
}
T("les shards ne vont pas dans le cache de la coquille",
  !/\/data\/[\s\S]{0,400}caches\.open\(CACHE\)/.test(sw));

console.log("\n--- Les shards sont bien servis, plus exclus ---");
T("plus de sortie seche sur /data/", !/startsWith\("\/data\/"\)\)return;/.test(sw), "l'ancienne exclusion est revenue");
T("/data/ passe par le cache de donnees", /startsWith\("\/data\/"\)[\s\S]{0,200}DATA_CACHE/.test(sw));

console.log("\n--- Le plafond ---");
/* Plafond en octets depuis le 2026-10-25 (trois entrees ne gardaient plus
   les fichiers du niveau, voir le scenario de seance plus bas). */
const plafond=(sw.match(/const DATA_PLAFOND=([\d*]+);/)||[])[1];
const octets=plafond?plafond.split("*").reduce((a,x)=>a*+x,1):0;
T("un plafond en octets est defini", !!plafond, plafond);
T("plafond raisonnable (2 a 6 Mo)", octets>=2*1048576&&octets<=6*1048576, octets);
T("les ecritures sont serialisees", /fileDeco=fileDeco\.then/.test(sw),
  "sans file d'attente le plafond ne tient pas");

console.log("\n--- Le menage de l'activation ---");
T("l'activation epargne les deux caches",
  /k!==CACHE&&k!==DATA_CACHE/.test(sw), "un des deux caches serait efface a chaque activation");

console.log("\n--- Le moteur reste dehors ---");
T("les 7 Mo du moteur ne sont pas mis en cache", /startsWith\("\/engine\/"\)\)return;/.test(sw));

console.log("\n--- Les en-tetes des donnees sont explicites ---");
const h=fs.readFileSync(SITE+"/_headers","utf8");
T("/data/ a une regle de cache declaree", /\/data\/\*/.test(h)&&/Cache-Control/.test(h.split("/data/*")[1]||""));

/* Ajoute le 2026-10-24 (audit) : la coquille rangeait chaque page sous sa
   requete entiere, donc "/", "/?fbclid=..." et "/?utm_source=..." faisaient
   trois entrees, sans plafond. Cette partie-ci execute vraiment sw.js, dans
   un bac a sable avec un faux Cache API qui, comme le vrai, distingue les
   cles par adresse complete. On compte ce qui atterrit dans chaque cache. */
console.log("\n--- Les pages HTML ignorent la chaine de requete ---");
(async()=>{
  const vm=require("vm");
  const ORIGINE="https://chang64.com";
  const magasins=new Map();
  const cleDe=k=>typeof k==="string"?new URL(k,ORIGINE).href:k.url;
  const ouvrir=nom=>{
    if(!magasins.has(nom)){
      const m=new Map();
      magasins.set(nom,{
        m,
        match:k=>Promise.resolve(m.get(cleDe(k))),
        put:(k,v)=>{m.set(cleDe(k),v);return Promise.resolve();},
        keys:()=>Promise.resolve([...m.keys()].map(u=>({url:u}))),
        delete:k=>Promise.resolve(m.delete(cleDe(k))),
        addAll:()=>Promise.resolve()
      });
    }
    return Promise.resolve(magasins.get(nom));
  };
  const caches={
    open:ouvrir,
    keys:()=>Promise.resolve([...magasins.keys()]),
    delete:n=>Promise.resolve(magasins.delete(n)),
    match:async k=>{for(const c of magasins.values()){const v=c.m.get(cleDe(k));if(v)return v;}}
  };
  const ecouteurs={};
  /* Vraies Response de Node : sw.js lit blob() et les en-tetes pour peser
     les entrees. Le corps a la taille du fichier publie s'il existe. */
  let reseau=true;
  const taille=u=>{const f=SITE+new URL(u).pathname;return fs.existsSync(f)&&fs.statSync(f).isFile()?fs.statSync(f).size:10;};
  const bac={
    caches,URL,Promise,console,location:{origin:ORIGINE},Response,Headers,
    fetch:r=>reseau?Promise.resolve(new Response(new Uint8Array(taille(r.url)),{status:200})):Promise.reject(new TypeError("hors ligne")),
    self:{addEventListener:(t,f)=>{ecouteurs[t]=f;},skipWaiting(){},clients:{claim(){}}}
  };
  vm.runInNewContext(sw,bac);
  const requete=(chemin,html)=>({method:"GET",url:ORIGINE+chemin,mode:html?"navigate":"cors",
    headers:{get:n=>n==="accept"?(html?"text/html,application/xhtml+xml":"*/*"):null}});
  const servir=async(chemin,html)=>{
    let p=null;
    ecouteurs.fetch({request:requete(chemin,html),respondWith:x=>{p=x;}});
    if(p)await p;
    await new Promise(r=>setTimeout(r,20));   // les put() partent apres la reponse
    return !!p;
  };
  const coquille=()=>{const n=[...magasins.keys()].find(k=>/^chang64-\d+$/.test(k));return n?[...magasins.get(n).m.keys()]:[];};
  const donnees=()=>{const n=[...magasins.keys()].find(k=>/^chang64-data-/.test(k));return n?[...magasins.get(n).m.keys()]:[];};

  for(const q of ["/","/?fbclid=IwAR0abc","/?utm_source=twitter&utm_medium=social"])await servir(q,true);
  const accueil=coquille().filter(u=>new URL(u).pathname==="/");
  T("trois visites de l'accueil, une seule entree", accueil.length===1, accueil.join(" | "));
  T("l'entree est rangee sans chaine de requete", accueil[0]===ORIGINE+"/", accueil[0]);
  for(const q of ["/openings/?ref=a","/openings/?ref=b"])await servir(q,true);
  T("idem pour une autre page", coquille().filter(u=>u.includes("/openings/")).length===1,
    coquille().filter(u=>u.includes("/openings/")).join(" | "));

  /* Ce qui ne doit pas bouger : /data/ garde sa propre cle et son cache,
     /engine/ n'est jamais intercepte. */
  await servir("/data/level-3.json?v=1",false);
  T("/data/ va toujours dans le cache de donnees", donnees().some(u=>u.endsWith("/data/level-3.json?v=1")), donnees().join(" | "));
  T("/data/ ne passe pas par la coquille", !coquille().some(u=>u.includes("/data/")));
  T("/engine/ n'est toujours pas intercepte", (await servir("/engine/stockfish.wasm",false))===false);
  await servir("/manifest.webmanifest?v=2",false);
  T("un fichier non HTML garde sa requete pour cle", coquille().includes(ORIGINE+"/manifest.webmanifest?v=2"));

  /* Ajoute le 2026-10-25 : en mode avion sur iPhone, les exercices ne se
     chargeaient plus. Une seance ordinaire demande neuf fichiers (mesure
     dans jsdom : exercices, exercice du jour, motifs, Sprint) et les trois
     places du cache ne gardaient que les derniers. On rejoue cette seance
     avec les tailles reelles, puis on coupe le reseau. */
  console.log("\n--- Une seance, puis le mode avion ---");
  const nomDonnees=[...magasins.keys()].find(k=>/^chang64-data-/.test(k));
  magasins.get(nomDonnees).m.clear();
  const seance=["/data/level-1.json","/data/level-1-0.json","/data/jour.json","/data/ids/12.json",
    "/data/level-2.json","/data/level-2-2.json","/data/theme-counts.json","/data/rush-pool.json"];
  for(const f of seance)await servir(f,false);
  await new Promise(r=>setTimeout(r,50));
  T("toute la seance tient dans le cache", seance.every(f=>donnees().includes(ORIGINE+f)),
    seance.filter(f=>!donnees().includes(ORIGINE+f)).join(" "));
  reseau=false;
  const horsLigne=async chemin=>{let p=null;
    ecouteurs.fetch({request:requete(chemin,false),respondWith:x=>{p=x;}});
    try{const rep=await p;return !!(rep&&rep.ok!==false);}catch(e){return false;}};
  T("hors ligne : index du niveau servi", await horsLigne("/data/level-1.json"));
  T("hors ligne : morceau du niveau servi", await horsLigne("/data/level-1-0.json"));

  /* Plafond : on enchaine des morceaux jusqu'a depasser 5 Mo. Le total doit
     rester sous le plafond, et l'index du niveau, relu a chaque seance, doit
     survivre a l'eviction. */
  reseau=true;
  const morceaux=fs.readdirSync(SITE+"/data").filter(n=>/^level-[3-9]-\d+\.json$/.test(n)).slice(0,40);
  for(const n of morceaux){await servir("/data/"+n,false);await servir("/data/level-1.json",false);}
  await new Promise(r=>setTimeout(r,100));
  const magasin=magasins.get(nomDonnees).m;
  let total=0;for(const v of magasin.values())total+=+v.headers.get("x-chang64-octets")||0;
  T("le cache reste sous le plafond", total<=octets, total+" octets pour "+magasin.size+" entrees");
  T("des entrees ont bien ete evincees", !donnees().includes(ORIGINE+"/data/rush-pool.json"));
  T("l'index relu survit a l'eviction", donnees().includes(ORIGINE+"/data/level-1.json"));
})().catch(e=>{ko++;console.log("  FAIL execution de sw.js  -> "+e.message);}).then(()=>{
  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
});
