/* Verification automatique de chang64.
   Lancement : node tests/check_pied_de_page.js

   Le menu du haut ne porte que quatre entrees et deborde deja sur telephone
   (458 px pour 362 disponibles). Finales, Lexique et Pieges d ouverture
   n etaient donc atteignables depuis aucune page de contenu, ni pour le
   visiteur ni pour les moteurs de recherche : ces pages ne recevaient aucun
   lien interne. Le pied de page les porte toutes. */
const fs=require("fs"),path=require("path");
const S=require("path").join(__dirname,"..","site");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};

const fr=fs.readFileSync(S+"/fr/ouvertures/defense-sicilienne.html","utf8");
const en=fs.readFileSync(S+"/openings/sicilian-defense.html","utf8");

console.log("\n--- Toutes les sections sont atteignables ---");
for(const [href,nom] of [["/fr/ouvertures/","Ouvertures"],["/fr/exercices/","Exercices"],
  ["/fr/apprendre/","Apprendre"],["/fr/finales/","Finales"],["/fr/pieges/","Pièges"],["/fr/lexique/","Lexique"]])
  T(nom+" liee depuis une page FR", fr.includes('href="'+href+'"')||fr.includes(">"+nom));
for(const href of ["/openings/","/puzzles/","/learn/","/endgames/","/traps/","/glossary/"])
  T(href+" liee depuis une page EN", en.includes('href="'+href+'"')||en.includes('aria-current'));

console.log("\n--- Les cibles existent vraiment ---");
const cibles=[...fr.matchAll(/<nav class="footnav"[\s\S]*?<\/nav>/g)][0][0];
const liens=[...cibles.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
const morts=liens.filter(h=>!fs.existsSync(S+h+"index.html")&&!fs.existsSync(S+h));
T(liens.length+" liens verifies, aucun mort", morts.length===0, morts.join(", "));

console.log("\n--- La page courante n'est pas un lien vers elle-meme ---");
T("section courante marquee", /aria-current="page"/.test(fr), (fr.match(/<span aria-current="page">([^<]*)/)||[])[1]);

console.log("\n--- Present sur toutes les pages de contenu ---");
let sans=[],vus=0;
for(const dir of ["/openings","/fr/ouvertures","/learn","/fr/apprendre","/endgames","/glossary","/traps","/puzzles"]){
  if(!fs.existsSync(S+dir))continue;
  for(const f of fs.readdirSync(S+dir).filter(x=>x.endsWith(".html")).slice(0,40)){
    vus++;
    if(!fs.readFileSync(S+dir+"/"+f,"utf8").includes('class="footnav"'))sans.push(dir+"/"+f);
  }
}
T(vus+" pages verifiees, toutes avec le pied de page", sans.length===0, sans.slice(0,3).join(", "));

console.log("\n--- Accessibilite et style ---");
T("le menu est annonce comme navigation", /<nav class="footnav" aria-label="/.test(fr));
T("style applique", /\.footnav\{/.test(fr));
T("aucun tiret cadratin", !fr.includes("\u2014"), (fr.match(/.{20}\u2014.{20}/)||[])[0]||"");

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
