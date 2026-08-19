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
/* Le menu ne passe plus a la ligne : il defile horizontalement, comme les
   onglets de l'application. La regle generique "header nav" l'en empechait,
   son flex-wrap annulant le defilement ; elle exclut donc desormais le menu
   principal. */
T("menu en disposition souple", /\.sitenav\{[^}]*display:flex/.test(h));
T("defilement horizontal plutot que retour a la ligne", /\.sitenav\{[^}]*overflow-x:auto/.test(h));
T("regle generique neutralisee sur le menu", /header nav:not\(\.sitenav\)/.test(h));
T("plus de marge a gauche sur les liens", !/nav a\{[^}]*margin-left/.test(h));
T("entete non elargissable", /\.sitenav\{[^}]*min-width:0/.test(h));

console.log("\n--- Cout maitrise ---");
const nav=(h.match(/<nav class="sitenav">[\s\S]*?<\/nav>/)||[""])[0];
T("moins de 700 octets par page : "+nav.length, nav.length<700, nav.length+" octets");

console.log("\n--- Le menu signale la section sur les pages de detail ---");
/* La comparaison etait exacte : /fr/finales/dame-contre-roi.html ne
   correspondait pas a /fr/finales/, donc le menu ne marquait rien et on
   perdait le repere des qu'on ouvrait une fiche. Teste dans les six sections
   et dans les deux langues. */
{
  const fsx=require("fs");
  let ko2=[], vus=0;
  for(const dir of ["/fr/finales","/fr/ouvertures","/fr/exercices","/fr/lexique",
                    "/fr/pieges","/fr/apprendre","/endgames","/openings","/glossary"]){
    if(!fsx.existsSync(S+dir))continue;
    const pages=fsx.readdirSync(S+dir).filter(f=>f.endsWith(".html")&&f!=="index.html");
    if(!pages.length)continue;
    vus++;
    const h=fsx.readFileSync(S+dir+"/"+pages[0],"utf8");
    const nav=(h.match(/<nav class="sitenav">[\s\S]*?<\/nav>/)||[""])[0];
    if(!/aria-current="page"/.test(nav))ko2.push(dir);
  }
  T(vus+" sections, toutes marquees sur les pages de detail", ko2.length===0, ko2.join(", "));

  /* une seule entree marquee : deux reperes simultanes seraient trompeurs */
  let multi=[];
  const walk=(p)=>{for(const f of fsx.readdirSync(p)){
    const q=p+"/"+f;
    if(fsx.statSync(q).isDirectory())walk(q);
    else if(f.endsWith(".html")){
      const nav=(fsx.readFileSync(q,"utf8").match(/<nav class="sitenav">[\s\S]*?<\/nav>/)||[""])[0];
      if((nav.match(/aria-current="page"/g)||[]).length>1)multi.push(q.replace(S,""));
    }}};
  walk(S);
  T("aucune page ne marque deux entrees", multi.length===0, multi.slice(0,3).join(", "));

  /* le lien reste cliquable sur une fiche : il ramene a l'index */
  const fiche=fsx.readFileSync(S+"/fr/finales/"+
    fsx.readdirSync(S+"/fr/finales").find(f=>f.endsWith(".html")&&f!=="index.html"),"utf8");
  const nav=(fiche.match(/<nav class="sitenav">[\s\S]*?<\/nav>/)||[""])[0];
  T("sur une fiche, le lien reste cliquable",
    /<a href="\/fr\/finales\/" aria-current="page"/.test(nav));
  const idx=fsx.readFileSync(S+"/fr/finales/index.html","utf8");
  const navIdx=(idx.match(/<nav class="sitenav">[\s\S]*?<\/nav>/)||[""])[0];
  T("sur l'index, c'est un simple texte", /<span aria-current="page">/.test(navIdx));
}

console.log("\n--- Le menu ne bouge plus quand la police arrive ---");
/* display=swap peint d'abord avec la police de secours (system-ui) puis la
   remplace par Archivo des qu'elle arrive. Sur ces pages sans etat persistant,
   chaque clic recharge tout le document : ce remplacement rejouait donc a
   chaque navigation. Sur le menu du haut, une rangee de courtes pastilles
   cote a cote, l'ecart de largeur entre les deux polices (mesure avec la
   vraie police Archivo : jusqu'a 40 px sur les six entrees) se voyait comme
   un reflow du menu, comme si la page revenait a son etat initial.
   display=optional laisse un tres court delai (la police arrive bien avant
   depuis le cache sur une navigation suivante) puis, s'il n'est pas tenu,
   garde la police de secours pour toute la vue sans jamais la remplacer plus
   tard : plus de bascule visible apres le premier affichage. */
T("Google Fonts en display=optional sur les pages claires",
  /fonts\.googleapis\.com\/css2\?[^"]*display=optional/.test(h), h.match(/fonts\.googleapis[^"]*/)?.[0]);
T("plus de display=swap sur ces pages (reflow du menu a chaque clic)",
  !/fonts\.googleapis\.com\/css2\?[^"]*display=swap/.test(h));

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
