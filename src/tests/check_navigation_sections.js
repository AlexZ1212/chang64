/* Les six sections vivaient dans le pied de page. Elles sont desormais dans
   l'entete, en un seul menu : deux menus divergents sur la meme page (quatre
   entrees en haut, six en bas) donnaient l'impression d'un site incoherent.
   Le pied de page est revenu a son role classique, les liens legaux.
*/
/* Verification automatique de chang64.
   Lancement : node tests/check_navigation_sections.js

   Le menu du haut ne porte que quatre entrees, faute de place sur telephone.
   Finales, Lexique et Pieges d ouverture n etaient donc atteignables depuis
   aucune page de contenu, ni pour le visiteur ni pour les moteurs de
   recherche. Le pied de page les liste toutes. */
const fs=require("fs"),path=require("path");
const S=require("path").join(__dirname,"..","site");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};

console.log("\n--- Toutes les sections sont accessibles depuis chaque page ---");
const attendu={
  en:["/openings/","/puzzles/","/learn/","/endgames/","/traps/","/glossary/"],
  fr:["/fr/ouvertures/","/fr/exercices/","/fr/apprendre/","/fr/finales/","/fr/pieges/","/fr/lexique/"]
};
for(const [lang,liste] of Object.entries(attendu)){
  const p=lang==="fr"?"/fr/ouvertures/defense-sicilienne.html":"/openings/sicilian-defense.html";
  const h=fs.readFileSync(S+p,"utf8");
  const nav=(h.match(/<nav class="sitenav">[\s\S]*?<\/nav>/)||[""])[0];
  const manquants=liste.filter(u=>!nav.includes('href="'+u+'"')&&!nav.includes('aria-current'));
  T(lang+" : les 6 sections presentes", manquants.length===0, manquants.join(", "));
}

console.log("\n--- Chaque lien mene a une page reelle ---");
const casses=[];
for(const liste of Object.values(attendu))
  for(const u of liste) if(!fs.existsSync(S+u+"index.html")) casses.push(u);
T("aucun lien mort", casses.length===0, casses.join(", "));

console.log("\n--- La page en cours n'est pas un lien vers elle-meme ---");
const idxOp=fs.readFileSync(S+"/openings/index.html","utf8");
const navOp=(idxOp.match(/<nav class="sitenav">[\s\S]*?<\/nav>/)||[""])[0];
T("Openings signale comme page courante", /aria-current="page"[^>]*>Openings|<span aria-current="page">Openings/.test(navOp), navOp.slice(0,150));
T("et n'est plus cliquable", !navOp.includes('href="/openings/"'));

console.log("\n--- Presence sur l'ensemble du site ---");
let sans=[],vus=0;
(function walk(p){for(const f of fs.readdirSync(p)){const q=path.join(p,f);
  if(fs.statSync(q).isDirectory())walk(q);
  else if(f.endsWith(".html")&&f!=="404.html"){
    vus++;
    const c=fs.readFileSync(q,"utf8");
    if(c.includes("<footer>")&&!c.includes('class="sitenav"'))sans.push(q.replace(S,""));
  }}})(S+"/openings");
T(vus+" pages d'ouvertures, toutes avec le pied de page", sans.length===0, sans.slice(0,3).join(", "));

console.log("\n--- Le menu du haut ne deborde plus ---");
const h=fs.readFileSync(S+"/openings/sicilian-defense.html","utf8");
T("menu en disposition souple", /header nav\{[^}]*display:flex/.test(h));
T("retour a la ligne autorise", /header nav\{[^}]*flex-wrap:wrap/.test(h));
T("plus de marge a gauche sur les liens", !/nav a\{[^}]*margin-left/.test(h));
T("entete non elargissable", /header nav\{[^}]*min-width:0/.test(h));

console.log("\n--- Cout maitrise ---");
const nav=(h.match(/<nav class="sitenav">[\s\S]*?<\/nav>/)||[""])[0];
T("moins de 700 octets par page : "+nav.length, nav.length<700, nav.length+" octets");

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
