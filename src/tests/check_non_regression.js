/* Verification automatique de chang64.
   Lancement : node tests/<fichier>.js  (depuis la racine des sources)
   Le site doit avoir ete construit au prealable : node build_site.js */
const SITE = require("path").join(__dirname, "..", "site");
const BASE = process.env.CHANG64_BASELINE || "";   /* site deja en ligne, facultatif */
const fs=require("fs"),path=require("path");
const G=SITE, L=BASE;
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const all=d=>{const o=[];(function w(p){for(const f of fs.readdirSync(p)){const q=path.join(p,f);
  fs.statSync(q).isDirectory()?w(q):o.push(q.replace(d,""));}})(d);return o;};

console.log("\n--- Aucune regression par rapport au site en ligne ---");
const gen=new Set(all(G)), live=all(L);
const redir=new Map();
for(const l of fs.readFileSync(G+"/_redirects","utf8").trim().split("\n")){
  const p=l.trim().split(/\s+/); if(p.length>=2)redir.set(p[0],p[1]);
}
/* Un fichier peut legitimement disparaitre s'il a ete renomme, a condition
   qu'une redirection mene vers sa nouvelle adresse. C'est le cas des 94 pages
   d'ouvertures traduites en francais. Ce qui serait grave, c'est une page qui
   disparait sans redirection. */
const perdus=live.filter(f=>{
  if(gen.has(f)||f==="/.htaccess")return false;
  const c=redir.get(f); if(!c)return true;
  return !gen.has(c.endsWith("/")?c+"index.html":c);
});
const renommes=live.filter(f=>!gen.has(f)&&f!=="/.htaccess").length;
T("aucun fichier perdu sans redirection", perdus.length===0, perdus.slice(0,5).join(", "));
T(renommes+" fichiers renommes, tous rediriges", renommes>0);
T(".htaccess bien retire", !gen.has("/.htaccess"));

console.log("\n--- Toutes les URL indexees restent joignables ---");
const smLive=fs.readFileSync(L+"/sitemap.xml","utf8");
const oldLocs=[...new Set([...smLive.matchAll(/<loc>https:\/\/chang64\.com([^<]*)<\/loc>/g)].map(m=>m[1]))];
const red=new Map();
for(const l of fs.readFileSync(G+"/_redirects","utf8").trim().split("\n")){
  const p=l.trim().split(/\s+/); if(p.length>=2)red.set(p[0],p[1]);
}
const casse=oldLocs.filter(u=>{
  const f=u.endsWith("/")?u+"index.html":u;
  if(gen.has(f))return false;
  const c=red.get(u); if(!c)return true;
  return !gen.has(c.endsWith("/")?c+"index.html":c);
});
T(oldLocs.length+" URL indexees, aucune perdue", casse.length===0, casse.slice(0,5).join(", "));

console.log("\n--- Fichiers critiques presents ---");
for(const f of ["/index.html","/sitemap.xml","/robots.txt","/_headers","/_redirects","/manifest.webmanifest",
  "/sw.js","/LICENSE","/COPYING.CONTENT","/README.md","/openings-book.json","/404.html",
  "/engine/stockfish-18-lite-single.wasm","/engine/LICENSE-GPLv3.txt","/og/home.png"])
  T(f, gen.has(f));

console.log("\n--- Coherence globale ---");
const html=[...gen].filter(f=>f.endsWith(".html"));
const sm=fs.readFileSync(G+"/sitemap.xml","utf8");
const locs=new Set([...sm.matchAll(/<loc>https:\/\/chang64\.com([^<]*)<\/loc>/g)].map(m=>m[1]));
const publiables=html.filter(u=>!u.startsWith("/players/")&&u!=="/404.html");
const abs=publiables.filter(u=>!locs.has(u)&&!locs.has(u.replace(/index\.html$/,"")));
T(publiables.length+" pages publiables, toutes au sitemap", abs.length===0, abs.slice(0,4).join(", "));
T("profil exclu du sitemap", ![...locs].some(u=>u.startsWith("/players/")));
T("404 exclue du sitemap", !locs.has("/404.html"));
T("robots autorise l'exploration", /Allow: \//.test(fs.readFileSync(G+"/robots.txt","utf8")));
T("engine bloque au robots", /Disallow: \/engine\//.test(fs.readFileSync(G+"/robots.txt","utf8")));

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
