/* Verification automatique de chang64.
   Lancement : node tests/check_points_d_entree.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (ajoute le 2026-09-06) : cinq suites de tests se sont
   cassees en silence pendant des jours, et toutes pour la meme raison. Pas
   une regression fonctionnelle : un point d'entree d'interface renomme ou
   deplace. tab-train supprime le 03/09, btnAmiNew devenu une modale le 04/09,
   btnDaily remplace par une carte, btnCoord et btnGoRush court-circuites par
   le menu a 5 cartes. A chaque fois, $("...") rendait null et la suite
   plantait au premier clic, emportant tout ce qui suivait.
   Ce test ne verifie aucun comportement. Il verifie seulement que les
   identifiants par lesquels on entre dans chaque fonction existent encore, ce
   qui coute une seconde et signale la rupture le jour meme plutot que des
   jours plus tard, quand plus personne ne relie l'echec au changement.
   Quand un point d'entree change volontairement, c'est ici qu'on le met a
   jour EN MEME TEMPS que les suites concernees. */
const SITE = require("path").join(__dirname, "..", "site");
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(""+SITE+"/index.html","utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole()});
const d=dom.window.document;
const $=id=>d.getElementById(id);

setTimeout(()=>{

  console.log("\n--- Les onglets ---");
  for(const id of ["tab-play","tab-puzzles","tab-edit","tab-friend","tab-watch","tab-explore"])
    T(id, !!$(id));
  /* tab-train a ete supprime le 03/09. S'il reparaissait, ce serait un
     retour en arriere a expliquer, pas un detail. */
  T("tab-train reste supprime", !$("tab-train"));

  console.log("\n--- Les cartes du menu Resoudre ---");
  for(const id of ["cardSolvePuzzles","cardSolveDaily","cardSolveSprint","cardSolveCoord","cardSolveEndgames"])
    T(id, !!$(id));

  console.log("\n--- Les entrees de l'accueil ---");
  for(const id of ["homeStartBtn","heroPlay","heroPuzzle","cardPlay","cardPuzzles","cardFriend"])
    T(id, !!$(id));

  console.log("\n--- Entre amis : la creation passe par la modale de couleur ---");
  T("btnAmiNew", !!$("btnAmiNew"));
  T("amiColorModal", !!$("amiColorModal"));
  const btns=$("amiColorBtns");
  T("amiColorBtns", !!btns);
  T("un bouton par couleur", !!btns && ["w","b"].every(v=>[...btns.children].some(b=>b.dataset.v===v)),
    btns&&[...btns.children].map(b=>b.dataset.v).join(","));
  T("amiLink", !!$("amiLink"));

  console.log("\n--- Les ecrans de preparation ---");
  for(const id of ["readyBanner","readyStart"]) T(id, !!$(id));

  console.log("\n--- Les commandes des exercices ---");
  for(const id of ["exQuest","exTheme","exStatus","btnNext","stRating","stDays","hStreak"])
    T(id, !!$(id));

  console.log("\n--- Les reglages et le pied de page ---");
  for(const id of ["segAnnounce","langSwitch","footPrefs","footAccess","footLegal","footHome"])
    T(id, !!$(id));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
