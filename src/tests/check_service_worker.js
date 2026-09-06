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
T("cache de donnees separe", /const DATA_CACHE="chang64-data-\d+"/.test(sw));
T("les deux versionnes par la construction",
  (sw.match(/chang64-\d+/)||[])[0]&&(sw.match(/chang64-data-\d+/)||[])[0]);
T("les shards ne vont pas dans le cache de la coquille",
  !/\/data\/[\s\S]{0,400}caches\.open\(CACHE\)/.test(sw));

console.log("\n--- Les shards sont bien servis, plus exclus ---");
T("plus de sortie seche sur /data/", !/startsWith\("\/data\/"\)\)return;/.test(sw), "l'ancienne exclusion est revenue");
T("/data/ passe par le cache de donnees", /startsWith\("\/data\/"\)[\s\S]{0,200}DATA_CACHE/.test(sw));

console.log("\n--- Le plafond ---");
const max=(sw.match(/const DATA_MAX=(\d+)/)||[])[1];
T("un plafond est defini", !!max, max);
T("plafond raisonnable (1 a 5 shards)", max&&+max>=1&&+max<=5, max);
T("l'eviction retire les plus anciennes", /ks\.slice\(0,trop\)/.test(sw));
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

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
