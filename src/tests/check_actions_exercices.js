/* Verification automatique de chang64.
   Lancement : node tests/check_actions_exercices.js

   "Exercice suivant" sert a chaque exercice, le filtre par theme et la
   reinitialisation presque jamais. Les laisser au meme endroit obligeait a
   faire defiler apres chaque exercice sur telephone. Les trois actions
   frequentes sont donc remontees sous l enonce. */
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(require("path").join(__dirname,"..","site","index.html"),"utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole()});
const w=dom.window,d=w.document;
setTimeout(async()=>{
  d.getElementById("tab-puzzles").click();
  await new Promise(r=>setTimeout(r,500));
  const pane=d.getElementById("pane-puzzles");
  const pos=id=>{const e=d.getElementById(id);let n=0;const wk=d.createTreeWalker(pane,1);
    while(wk.nextNode()){n++;if(wk.currentNode===e)return n;}return 1e9;};

  console.log("\n--- L'action principale est haute dans la page ---");
  T("Exercice suivant avant les compteurs", pos("btnNext")<pos("stSolved"),
     "btnNext "+pos("btnNext")+" vs stats "+pos("stSolved"));
  T("Indice avant les compteurs", pos("btnHintEx")<pos("stSolved"));
  /* btnSolve a fusionne avec btnHintEx : le meme bouton donne l'indice puis
     la solution. */
  T("le bouton d'aide avant les compteurs", pos("btnHintEx")<pos("stSolved"));
  T("juste apres l'enonce", pos("btnNext")>pos("exStatus"));

  console.log("\n--- Les reglages occasionnels restent en bas ---");
  T("filtre par theme apres les actions", pos("themeFilter")>pos("btnNext"));
  /* Reecrit le 2026-09-05. Deux elements ont change de nature avec le menu
     a 5 cartes (2026-09-03), pas seulement de place :
     - btnDaily n'existe plus : "Puzzle du jour" est devenu une carte du
       menu (cardSolveDaily), pas un bouton de la rangee d'actions. Le test
       cherchait donc un element absent -- et pos() renvoyant 1e9 pour un
       introuvable, l'ancienne assertion "Exercice du jour apres" PASSAIT a
       tort, ce qui est pire qu'un echec.
     - btnReset a quitte l'ecran d'exercice pour l'ecran menu, dans un
       <details> replie. "Tout en bas du panneau" n'a plus de sens : il est
       sur un autre ecran. L'intention d'origine (les reglages rares ne
       polluent pas les actions frequentes) est mieux servie qu'avant, et
       c'est elle qu'on verifie maintenant. */
  T("Puzzle du jour est une carte du menu, plus un bouton d'action",
    !d.getElementById("btnDaily") && !!d.getElementById("cardSolveDaily"));
  T("Reinitialiser vit sur l'ecran menu, hors de la carte d'exercice",
    d.getElementById("solveMenu").contains(d.getElementById("btnReset")) &&
    !d.getElementById("exPanel").contains(d.getElementById("btnReset")));
  T("et reste replie derriere un <details>",
    !!d.getElementById("btnReset").closest("details"));

  console.log("\n--- Aucun doublon, les boutons fonctionnent ---");
  for(const id of ["btnNext","btnHintEx","btnRetry","btnReset"])
    T(id+" unique dans le document", d.querySelectorAll("#"+id).length===1,
       d.querySelectorAll("#"+id).length+" occurrences");

  console.log("\n--- L'enchainement marche toujours ---");
  const avant=d.getElementById("exQuest").textContent;
  d.getElementById("btnNext").click();
  await new Promise(r=>setTimeout(r,500));
  T("un nouvel exercice se charge", d.getElementById("board").children.length===64);
  T("l'enonce est renseigne", (d.getElementById("exQuest").textContent||"").length>5,
     d.getElementById("exQuest").textContent);

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
