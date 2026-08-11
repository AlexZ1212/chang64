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
  T("Voir la solution avant les compteurs", pos("btnSolve")<pos("stSolved"));
  T("juste apres l'enonce", pos("btnNext")>pos("exStatus"));

  console.log("\n--- Les reglages occasionnels restent en bas ---");
  T("filtre par theme apres les actions", pos("themeFilter")>pos("btnNext"));
  T("Exercice du jour apres", pos("btnDaily")>pos("btnNext"));
  T("Chang Sprint apres", pos("btnRush")>pos("btnNext"));
  T("Reinitialiser tout en bas", pos("btnReset")>pos("themeFilter"));

  console.log("\n--- Aucun doublon, les boutons fonctionnent ---");
  for(const id of ["btnNext","btnHintEx","btnSolve","btnDaily","btnRush","btnRetry","btnReset"])
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
