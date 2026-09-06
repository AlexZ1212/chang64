/* Verification automatique de chang64.
   Lancement : node tests/check_csp.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (ajoute le 2026-09-06, apres un audit) : la politique
   de securite du contenu est un en-tete que personne ne regarde tant que rien
   ne casse, et une directive perdue ne se voit pas. On fige donc ici ce qui
   est acquis, pour qu'un retrait soit un echec de test et pas une decouverte
   au prochain audit.
   Le point le plus fragile est la liste de hachages qui a remplace
   'unsafe-inline' dans script-src. Sans filet, un script en ligne modifie
   sans regeneration de _headers coupe TOUT le JavaScript de la page
   concernee, en silence a la construction et brutalement en production. Le
   dernier bloc de ce test recalcule les empreintes sur le site construit et
   les confronte a l'en-tete : c'est la seule chose qui rattrape cet oubli.
   Ce qui reste ouvert : Trusted Types. La directive
   require-trusted-types-for casserait les 54 affectations innerHTML de
   l'application ; il faut d'abord les sortir. Ne pas l'ajouter avant, un
   en-tete qui casse le site n'est pas une securite.
   style-src garde 'unsafe-inline' volontairement : un attribut style="..."
   ne peut pas etre couvert par un hachage, et une feuille injectee ne
   s'execute pas. Ce n'est pas le meme risque que pour un script. */
const SITE = require("path").join(__dirname, "..", "site");
const fs=require("fs");
const h=fs.readFileSync(SITE+"/_headers","utf8");
const csp=(h.match(/Content-Security-Policy: ([^\n]+)/)||[])[1]||"";
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const a=(d,v)=>{const m=csp.match(new RegExp(d+" ([^;]+)"));return m?m[1].trim():null;};

console.log("\n--- La politique est bien emise ---");
T("un en-tete CSP existe", !!csp, csp.slice(0,40));
T("un repli par defaut restrictif", a("default-src")==="'self'", a("default-src"));

console.log("\n--- Les directives sans lesquelles le repli ne suffit pas ---");
/* Ces quatre-la ne retombent PAS sur default-src : sans elles, la politique
   a des trous qu'on ne voit pas en la lisant. */
T("object-src ferme (plugins)", a("object-src")==="'none'", a("object-src"));
T("base-uri limite au site", a("base-uri")==="'self'", a("base-uri"));
T("form-action ferme", a("form-action")==="'none'", a("form-action"));
T("frame-ancestors limite", /frame-ancestors/.test(csp), a("frame-ancestors"));

console.log("\n--- Ce que le site a vraiment besoin d'autoriser ---");
T("le moteur WebAssembly reste autorise", /wasm-unsafe-eval/.test(a("script-src")||""), a("script-src"));
T("les workers, pour Stockfish", /blob:/.test(a("worker-src")||""), a("worker-src"));
T("les images encodees en ligne", /data:/.test(a("img-src")||""), a("img-src"));
T("YouTube sans cookies, et lui seul", (a("frame-src")||"")==="https://www.youtube-nocookie.com", a("frame-src"));

console.log("\n--- Aucune ouverture vers l'exterieur ---");
T("connect-src reste au site", a("connect-src")==="'self'", a("connect-src"));
T("font-src reste au site", a("font-src")==="'self'", a("font-src"));
T("aucun domaine tiers en script-src", !/https?:\/\//.test(a("script-src")||""), a("script-src"));

console.log("\n--- Plus d'unsafe-inline pour les scripts ---");
T("script-src ne porte plus 'unsafe-inline'", !/'unsafe-inline'/.test(a("script-src")||""), a("script-src"));
const hachages=[...(a("script-src")||"").matchAll(/'sha256-[A-Za-z0-9+/=]+'/g)].map(m=>m[0]);
T("des hachages ont pris sa place", hachages.length>0, hachages.length+" hachage(s)");
T("style-src garde 'unsafe-inline', c'est voulu", /'unsafe-inline'/.test(a("style-src")||""), a("style-src"));

console.log("\n--- Les hachages correspondent au site reellement construit ---");
/* Le piege : modifier un script en ligne sans regenerer _headers. La page
   se construit sans bruit et perd tout son JavaScript en production. */
const crypto=require("crypto"),path2=require("path");
const attendus=new Set(), pagesSansCouverture=[];
(function walk(d){for(const f of fs.readdirSync(d)){const p=d+"/"+f;
  if(fs.statSync(p).isDirectory()){walk(p);continue;}
  if(!f.endsWith(".html"))continue;
  const src=fs.readFileSync(p,"utf8");
  for(const m of src.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
    const at=m[1]||"";
    if(/\ssrc=/.test(at))continue;
    if(/type\s*=\s*"application\/ld\+json"/.test(at))continue;   /* bloc de donnees, hors script-src */
    const s="'sha256-"+crypto.createHash("sha256").update(m[2],"utf8").digest("base64")+"'";
    attendus.add(s);
    if(!hachages.includes(s))pagesSansCouverture.push("/"+path2.relative(SITE,p));
  }}})(SITE);
T("chaque script en ligne du site est autorise", pagesSansCouverture.length===0,
  pagesSansCouverture.length+" page(s) dont le script serait bloque : "+pagesSansCouverture.slice(0,3).join(", "));
const inutiles=hachages.filter(x=>!attendus.has(x));
T("aucun hachage perime dans l'en-tete", inutiles.length===0, inutiles.join(" "));

console.log("\n--- Les autres en-tetes de securite ---");
for(const [nom,motif] of [["X-Content-Type-Options",/nosniff/],["Strict-Transport-Security",/max-age=\d+/],
  ["Referrer-Policy",/strict-origin/],["Permissions-Policy",/geolocation=\(\)/]])
  T(nom+" pose", motif.test((h.match(new RegExp(nom+": ([^\\n]+)"))||[])[1]||""),
    (h.match(new RegExp(nom+": ([^\\n]+)"))||[])[1]);

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
