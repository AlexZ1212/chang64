/* Verification automatique de chang64.
   Lancement : node tests/<fichier>.js  (depuis la racine des sources)
   Le site doit avoir ete construit au prealable : node build_site.js */
const SITE = require("path").join(__dirname, "..", "site");
const BASE = process.env.CHANG64_BASELINE || "";   /* site deja en ligne, facultatif */
const fs=require("fs");
const S=SITE, L=BASE;
if(!L){
  /* Pas de convention "IGNORE" dans ce harnais (juste OK/FAIL) : on ne fait
     donc pas semblant d'avoir verifie quoi que ce soit en affichant un faux
     "0 OK, 0 FAIL" qui se fondrait dans les verifications reussies. On sort
     proprement, sans pile d'appels, mais run_tests.js continue de compter ce
     fichier comme "sans resultat" puisqu'il n'y en a reellement aucun. */
  console.log("\n--- Aucune URL indexee ne tombe en 404 ---");
  console.log("  IGNORE  CHANG64_BASELINE n'est pas defini (chemin vers une copie du site deja en ligne, avec son sitemap.xml) : verification sautee, aucun resultat a comparer.");
  process.exit(0);
}
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};

const red=fs.readFileSync(S+"/_redirects","utf8").trim().split("\n").filter(Boolean);
const map=new Map();
for(const l of red){const p=l.trim().split(/\s+/); if(p.length>=2)map.set(p[0],p[1]);}

console.log("\n--- Aucune URL indexee ne tombe en 404 ---");
const oldLocs=[...new Set([...fs.readFileSync(L+"/sitemap.xml","utf8")
  .matchAll(/<loc>https:\/\/chang64\.com([^<]*)<\/loc>/g)].map(m=>m[1]))];
const casse=[];
for(const u of oldLocs){
  const f=u.endsWith("/")?u+"index.html":u;
  if(fs.existsSync(S+f))continue;
  const cible=map.get(u);
  if(cible&&fs.existsSync(S+cible))continue;
  casse.push(u);
}
T(oldLocs.length+" URL indexees verifiees, aucune perdue", casse.length===0, casse.slice(0,5).join(", "));

console.log("\n--- Les redirections sont saines ---");
let boucle=[],morte=[];
for(const [from,to] of map){
  if(from===to)boucle.push(from);
  const f=to.endsWith("/")?to+"index.html":to;
  if(!fs.existsSync(S+f)&&!map.has(to))morte.push(from+" -> "+to);
}
T("aucune boucle", boucle.length===0, boucle.slice(0,3).join(", "));
T("aucune cible inexistante", morte.length===0, morte.slice(0,3).join(", "));
T("sous la limite Cloudflare (2100)", map.size<2100, map.size+" redirections");
const src=[...map.keys()].filter(u=>u.startsWith("/fr/ouvertures/"));
T("aucune redirection ne masque une page reelle",
  src.filter(u=>fs.existsSync(S+u)).length===0,
  src.filter(u=>fs.existsSync(S+u)).slice(0,3).join(", "));

console.log("\n--- Le site reste complet ---");
const cnt=d=>{let n=0;(function w(p){for(const f of fs.readdirSync(p)){const q=p+"/"+f;fs.statSync(q).isDirectory()?w(q):f.endsWith(".html")&&n++}})(d);return n};
T("plus de 1350 pages HTML", cnt(S)>=1350, cnt(S));
{const n=(fs.readFileSync(S+"/sitemap.xml","utf8").match(/<loc>/g)||[]).length; T("sitemap peuple", n>=1350, n+" URL");}
T("LICENSE toujours ecrit", fs.existsSync(S+"/LICENSE"));
T("livre d'ouvertures separe", fs.existsSync(S+"/openings-book.json"));

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
