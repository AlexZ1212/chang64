/* Verification automatique de chang64.
   Lancement : node tests/check_sante_du_site.js

   Controles d ensemble que les suites ciblees ne couvrent pas : volumetrie,
   pages tronquees ou vides, restes de gabarit, metadonnees, fichiers de
   service. Ne regarde que le contenu visible pour les jetons et les valeurs
   indefinies : les gabarits et les comparaisons a undefined sont legitimes
   dans le code JavaScript embarque. */
const fs=require("fs"),path=require("path");
const S=require("path").join(__dirname,"..","site");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const all=[];(function w(p){for(const f of fs.readdirSync(p)){const q=path.join(p,f);
  fs.statSync(q).isDirectory()?w(q):all.push(q);}})(S);
const html=all.filter(f=>f.endsWith(".html"));

console.log("\n--- Volumetrie ---");
console.log("  "+all.length+" fichiers, dont "+html.length+" pages HTML");
T("plus de 1900 pages", html.length>=1900, html.length);
T("147 images de partage", fs.readdirSync(S+"/og").filter(f=>f.endsWith(".png")).length===147);

console.log("\n--- Aucune page vide ou tronquee ---");
const petites=html.filter(f=>fs.statSync(f).size<1500).map(f=>f.replace(S,""));
T("aucune page anormalement petite", petites.length===0, petites.slice(0,4).join(", "));
const malFermees=html.filter(f=>!fs.readFileSync(f,"utf8").trimEnd().endsWith("</html>")).map(f=>f.replace(S,""));
T("toutes les pages sont bien fermees", malFermees.length===0, malFermees.slice(0,4).join(", "));

console.log("\n--- Aucun reste de gabarit ---");
/* On ne regarde que le contenu visible : les gabarits ${...} et les
   comparaisons a undefined sont legitimes dans le code JavaScript embarque,
   les chercher partout produisait des faux positifs. */
const visible=f=>fs.readFileSync(f,"utf8")
  .replace(/<script[\s\S]*?<\/script>/g,"")
  .replace(/<style[\s\S]*?<\/style>/g,"")
  .replace(/<!--[\s\S]*?-->/g,"");
const jetons=html.filter(f=>/__[A-Z_]+__/.test(visible(f))).map(f=>f.replace(S,""));
T("aucun jeton non substitue dans le contenu", jetons.length===0, jetons.slice(0,4).join(", "));
const undef=html.filter(f=>/>undefined<|>NaN<|>null</.test(visible(f))).map(f=>f.replace(S,""));
T("aucun undefined, NaN ou null affiche", undef.length===0, undef.slice(0,4).join(", "));

console.log("\n--- Metadonnees completes ---");
const ech=html.filter(f=>!f.endsWith("404.html")).slice(0,300);
const sansTitre=ech.filter(f=>!/<title>[^<]{3,}<\/title>/.test(fs.readFileSync(f,"utf8")));
T("300 pages verifiees, toutes avec un titre", sansTitre.length===0, sansTitre.slice(0,3).map(f=>f.replace(S,"")).join(", "));
const sansDesc=ech.filter(f=>!/name="description" content="[^"]{20,}"/.test(fs.readFileSync(f,"utf8")));
T("toutes avec une description", sansDesc.length===0, sansDesc.slice(0,3).map(f=>f.replace(S,"")).join(", "));
const sansCanon=ech.filter(f=>!/rel="canonical"/.test(fs.readFileSync(f,"utf8")));
T("toutes avec une canonique", sansCanon.length===0, sansCanon.slice(0,3).map(f=>f.replace(S,"")).join(", "));

console.log("\n--- Le JavaScript principal s'execute ---");
const idx=fs.readFileSync(S+"/index.html","utf8");
const m=idx.match(/<script>([\s\S]*)<\/script>/);
let err=null; try{new (require("vm").Script)(m[1]);}catch(e){err=e.message;}
T("le script se parse", err===null, err);
T("taille raisonnable", m[1].length<600000, Math.round(m[1].length/1024)+" Ko");

console.log("\n--- Fichiers de service ---");
for(const f of ["/sitemap.xml","/robots.txt","/_headers","/_redirects","/manifest.webmanifest",
  "/sw.js","/LICENSE","/COPYING.CONTENT","/README.md","/openings-book.json","/404.html"])
  T(f, fs.existsSync(S+f));
T("service worker versionne", /chang64-\d{10,}/.test(fs.readFileSync(S+"/sw.js","utf8")));
let jerr=null; try{JSON.parse(fs.readFileSync(S+"/openings-book.json","utf8"));}catch(e){jerr=e.message;}
T("livre d'ouvertures lisible", jerr===null, jerr);
let merr=null; try{JSON.parse(fs.readFileSync(S+"/manifest.webmanifest","utf8"));}catch(e){merr=e.message;}
T("manifeste lisible", merr===null, merr);

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
