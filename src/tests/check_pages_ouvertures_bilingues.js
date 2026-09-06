/* Verification automatique de chang64.
   Lancement : node tests/<fichier>.js  (depuis la racine des sources)
   Le site doit avoir ete construit au prealable : node build_site.js */
const SITE = require("path").join(__dirname, "..", "site");
const BASE = process.env.CHANG64_BASELINE || "";   /* site deja en ligne, facultatif */
const fs=require("fs"),path=require("path");
const S=SITE;
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};

console.log("\n--- Couverture ---");
const en=fs.readdirSync(S+"/openings").filter(f=>f.endsWith(".html")&&f!=="index.html");
const fr=fs.readdirSync(S+"/fr/ouvertures").filter(f=>f.endsWith(".html")&&f!=="index.html");
T("141 pages anglaises", en.length===141, en.length);
T("141 pages francaises", fr.length===141, fr.length);
T("aucune page FR restee en anglais", fr.filter(f=>en.includes(f)).length===0,
   fr.filter(f=>en.includes(f)).join(", ").slice(0,120));

console.log("\n--- Liens croises EN <-> FR ---");
let bad=[],badFr=[];
for(const f of en){
  const h=fs.readFileSync(S+"/openings/"+f,"utf8");
  const m=h.match(/hreflang="fr" href="https:\/\/chang64\.com(\/fr\/ouvertures\/[^"]+)"/);
  if(!m||!fs.existsSync(S+m[1]))bad.push(f);
}
for(const f of fr){
  const h=fs.readFileSync(S+"/fr/ouvertures/"+f,"utf8");
  const m=h.match(/hreflang="en" href="https:\/\/chang64\.com(\/openings\/[^"]+)"/);
  if(!m||!fs.existsSync(S+m[1]))badFr.push(f);
}
T("chaque page EN pointe vers une page FR existante", bad.length===0, bad.slice(0,5).join(", "));
T("chaque page FR pointe vers une page EN existante", badFr.length===0, badFr.slice(0,5).join(", "));

console.log("\n--- Sitemap ---");
/* Depuis le 2026-09-05, seules les familles pourvues d'une note redigee
   (FAMILY_NOTES/NOTES_FR, build_site.js) entrent au sitemap ; les autres
   portent un meta robots noindex,follow (voir SESSION_HANDOFF : similarite
   Jaccard de 0,67 a 0,88 entre elles, rien qu'un moteur voudrait citer).
   "Toutes les pages FR sont au sitemap" a cesse d'etre l'attente : seules
   celles qui ne sont PAS en noindex doivent s'y trouver. */
const sm=fs.readFileSync(S+"/sitemap.xml","utf8");
const locs=new Set([...sm.matchAll(/<loc>https:\/\/chang64\.com([^<]*)<\/loc>/g)].map(m=>m[1]));
const indexable=fr.filter(f=>!/name="robots" content="noindex/.test(fs.readFileSync(S+"/fr/ouvertures/"+f,"utf8")));
const nonIndexable=fr.filter(f=>!indexable.includes(f));
const missing=indexable.filter(f=>!locs.has("/fr/ouvertures/"+f));
const enTrop=nonIndexable.filter(f=>locs.has("/fr/ouvertures/"+f));
T("chaque page FR indexable est au sitemap", missing.length===0, missing.slice(0,5).join(", "));
T("aucune page FR en noindex n'est au sitemap", enTrop.length===0, enTrop.slice(0,5).join(", "));

console.log("\n--- Index des ouvertures ---");
const idxFr=fs.readFileSync(S+"/fr/ouvertures/index.html","utf8");
const orph=fr.filter(f=>!idxFr.includes(f));
T("l'index FR liste toutes les pages", orph.length===0, orph.slice(0,5).join(", "));

console.log("\n--- Qualite des noms ---");
const ech=[["gambit-de-lelephant.html","Gambit de l'éléphant"],["defense-hippopotame.html","Défense hippopotame"],
  ["defense-semi-slave.html","Défense semi-slave"],["gambit-du-roi-accepte.html","Gambit du roi accepté"],
  ["partie-des-trois-cavaliers.html","Partie des trois cavaliers"],["defense-indienne-orientale.html","Défense indienne orientale"]];
for(const [f,titre] of ech){
  const p=S+"/fr/ouvertures/"+f;
  T(titre, fs.existsSync(p)&&fs.readFileSync(p,"utf8").includes(titre), fs.existsSync(p)?"titre absent":"page absente");
}
console.log("\n--- Le nom anglais reste indique en reference ---");
const h=fs.readFileSync(S+"/fr/ouvertures/gambit-de-lelephant.html","utf8");
T("mention du nom anglais", h.includes("Elephant Gambit"));

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
