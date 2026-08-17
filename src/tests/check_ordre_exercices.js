/* Verification automatique de chang64.
   Lancement : node tests/check_ordre_exercices.js
   Le site doit avoir ete construit au prealable : node build_site.js

   L'enonce d'un exercice doit venir avant les compteurs : c'est lui qui dit
   quoi faire. Les six tuiles de statistiques en tete repoussaient la consigne
   sous la ligne de flottaison sur telephone. */
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(require("path").join(__dirname,"..","site","index.html"),"utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole()});
const w=dom.window,d=w.document;
setTimeout(async()=>{
  d.getElementById("tab-puzzles").click();
  await new Promise(r=>setTimeout(r,500));

  console.log("\n--- L'enonce vient avant les statistiques ---");
  const pane=d.getElementById("pane-puzzles");
  const pos=id=>{const e=d.getElementById(id);let n=0,w2=d.createTreeWalker(pane,1);
    while(w2.nextNode()){n++; if(w2.currentNode===e)return n;} return 1e9;};
  T("le theme precede les compteurs", pos("exTheme")<pos("stSolved"), "theme "+pos("exTheme")+" vs stats "+pos("stSolved"));
  T("l'enonce precede les compteurs", pos("exQuest")<pos("stSolved"));
  T("le statut precede les compteurs", pos("exStatus")<pos("stSolved"));
  /* Le chronometre du sprint a quitte le panneau : il est desormais au-dessus
     de l'echiquier, comme celui des coordonnees, pour rester sous les yeux
     pendant qu'on joue plutot qu'en dessous ou il fallait le chercher. */
  /* pos() ne parcourt que le panneau : le bandeau et l'echiquier n'y sont
     plus, il faut donc comparer sur le document entier. */
  const posDoc=id=>{const e=d.getElementById(id);let n=0,wk=d.createTreeWalker(d.body,1);
    while(wk.nextNode()){n++; if(wk.currentNode===e)return n;} return 1e9;};
  T("le chronometre Sprint est au-dessus de l'echiquier",
    posDoc("rushBar")<posDoc("board"),
    "rushBar "+posDoc("rushBar")+" vs echiquier "+posDoc("board"));
  T("et hors du panneau de l'exercice",
    !d.getElementById("exPanel").contains(d.getElementById("rushBar")));
  T("la barre de niveau est passee apres", pos("ladder")>pos("exStatus"));
  T("les deux rangees de compteurs sont apres", pos("stRating")>pos("exStatus"));

  console.log("\n--- Les libelles en anglais ---");
  T("Sprint best remplace Rush best", /Sprint best/.test(html)&&!/Rush best/.test(html));
  T("le mot of est bien pose", d.getElementById("lvlOf") && d.getElementById("lvlOf").textContent==="of",
     d.getElementById("lvlOf")&&d.getElementById("lvlOf").textContent);

  console.log("\n--- En francais ---");
  [...d.getElementById("langSwitch").children].find(b=>b.dataset.lang==="fr").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("tab-puzzles").click();
  await new Promise(r=>setTimeout(r,400));
  const of_=d.getElementById("lvlOf");
  T("Niveau 1 sur 5, plus 'of'", of_ && of_.textContent==="sur", of_&&of_.textContent);
  const lab=[...d.querySelectorAll("#pane-puzzles .stat span")].map(s=>s.textContent);
  T("Record Sprint remplace Record Rush", lab.includes("Record Sprint")&&!lab.includes("Record Rush"), lab.join(", "));

  console.log("\n--- Rien n'a disparu ---");
  for(const id of ["exTheme","exQuest","exStatus","rushBar","ladder","lvlNum","lvlName",
                   "stSolved","stStreak","stBest","stRating","stDays","stRush","themeFilter","btnRush"])
    T(id+" present", !!d.getElementById(id));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
