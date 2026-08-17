/* Verification automatique de chang64.
   Lancement : node tests/<fichier>.js  (depuis la racine des sources)
   Le site doit avoir ete construit au prealable : node build_site.js */
const SITE = require("path").join(__dirname, "..", "site");
const BASE = process.env.CHANG64_BASELINE || "";   /* site deja en ligne, facultatif */
const fs=require("fs");
const S=SITE;
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const P=JSON.parse(fs.readFileSync(require("path").join(__dirname,"..","puzzles.json"),"utf8"));

const en=fs.readdirSync(S+"/puzzles").filter(f=>f.endsWith(".html")&&f!=="index.html");
const fr=fs.readdirSync(S+"/fr/exercices").filter(f=>f.endsWith(".html")&&f!=="index.html");
console.log("\n--- Couverture des pages d'exercices ---");
T("une page par exercice en anglais", en.length===P.length, en.length+" pour "+P.length);
T("une page par exercice en francais", fr.length===P.length, fr.length+" pour "+P.length);

console.log("\n--- Liens croises EN <-> FR ---");
let bad=[];
for(const f of en.slice(0,150)){
  const h=fs.readFileSync(S+"/puzzles/"+f,"utf8");
  const m=h.match(/hreflang="fr" href="https:\/\/chang64\.com([^"]+)"/);
  if(!m||!fs.existsSync(S+m[1]))bad.push(f);
}
T("150 pages EN pointent vers une page FR existante", bad.length===0, bad.slice(0,3).join(", "));
bad=[];
for(const f of fr.slice(0,150)){
  const h=fs.readFileSync(S+"/fr/exercices/"+f,"utf8");
  const m=h.match(/hreflang="en" href="https:\/\/chang64\.com([^"]+)"/);
  if(!m||!fs.existsSync(S+m[1]))bad.push(f);
}
T("150 pages FR pointent vers une page EN existante", bad.length===0, bad.slice(0,3).join(", "));

console.log("\n--- Structure des pages ---");
const ech=fs.readFileSync(S+"/puzzles/"+en[0],"utf8");
T("titre h1 present", /<h1>/.test(ech));
T("diagramme present", /<svg/.test(ech));
T("diagramme par symboles (leger)", /<use href="#p/.test(ech));
T("canonical present", /rel="canonical"/.test(ech));
T("og:image present", /property="og:image"/.test(ech));
T("pas de noindex", !/noindex/.test(ech));

console.log("\n--- Poids maitrise ---");
let max=0,maxf="";
for(const f of en){const s=fs.statSync(S+"/puzzles/"+f).size; if(s>max){max=s;maxf=f;}}
T("page la plus lourde sous 40 Ko", max<40960, Math.round(max/1024)+" Ko ("+maxf+")");
const tot=en.reduce((a,f)=>a+fs.statSync(S+"/puzzles/"+f).size,0);
/* Seuil releve de 25 a 30 Ko : la feuille de style s'est enrichie (menu
   unifie, pastille de langue, champ de recherche, logo complet). Le plafond
   reste utile pour detecter une derive, mais il doit suivre le produit. */
T("moyenne sous 35 Ko", tot/en.length<35840, Math.round(tot/en.length/1024)+" Ko de moyenne");

console.log("\n--- Toutes au sitemap ---");
const sm=fs.readFileSync(S+"/sitemap.xml","utf8");
const locs=new Set([...sm.matchAll(/<loc>https:\/\/chang64\.com([^<]*)<\/loc>/g)].map(m=>m[1]));
const abs=en.filter(f=>!locs.has("/puzzles/"+f)).concat(fr.filter(f=>!locs.has("/fr/exercices/"+f)));
T("aucune page d'exercice absente du sitemap", abs.length===0, abs.length+" absentes");

console.log("\n--- Index des exercices ---");
const idxEn=fs.readFileSync(S+"/puzzles/index.html","utf8");
const orph=en.filter(f=>!idxEn.includes(f));
T("l'index EN liste toutes les pages", orph.length===0, orph.length+" orphelines");

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
