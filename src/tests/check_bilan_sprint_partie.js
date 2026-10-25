/* Verification automatique de chang64.
   Lancement : node tests/check_bilan_sprint_partie.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Bug signale le 2026-10-25 (capture d'Alexandre) : apres un Chang Sprint,
   une partie perdue au temps en blitz affichait, dans son bandeau de fin,
   les pastilles du sprint et "Touche un ✓ ou un ✗ pour revoir comment le
   resoudre". Le bandeau #resultBanner est partage : renderResult() (fin de
   partie) ne retirait pas ce que le bilan du sprint y avait laisse.
   Scenario rejoue : bilan de sprint avec pastilles, fermeture, partie,
   defaite. Verifie aussi qu'un bilan de Coordonnees (showFin seul) ne
   montre plus la consigne, et qu'une fin de partie n'herite pas de
   l'action du sprint. */
const path = require("path");
const fs = require("fs"), jd = require("jsdom");
const html = fs.readFileSync(path.join(__dirname, "..", "site", "index.html"), "utf8");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dom = new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/",
    virtualConsole: new jd.VirtualConsole(), beforeParse(w) { w.fetch = () => new Promise(() => {}); } });
  const w = dom.window, d = w.document;
  await attendre(800);
  const cache = id => d.getElementById(id).classList.contains("hide");
  const pastilles = () => d.getElementById("rushHistory").children.length;

  console.log("\n--- Le bilan du sprint s'affiche ---");
  w.eval('showFin("Sprint termine","Score : 2","Relancer",function(){window.__relance=true});' +
    'finWasRushSprint=true;renderRushHistory([{id:"p1",correct:true},{id:"p2",correct:false},{id:"p3",correct:true}]);');
  T("trois pastilles", pastilles() === 3, pastilles());
  T("consigne visible", !cache("rushHistoryNote"));
  d.getElementById("resultClose").click(); await attendre(100);
  T("bilan ferme", d.getElementById("resultBanner").classList.contains("hide"));

  console.log("\n--- Puis une partie perdue ---");
  d.getElementById("tab-play").click(); await attendre(400);
  /* Le bilan n'est pas ferme cette fois : le cas le plus defavorable, ou
     finAction est encore pose quand la partie se termine. */
  w.eval('showFin("Sprint termine","Score : 2","Relancer",function(){window.__relance=true});' +
    'renderRushHistory([{id:"p1",correct:true},{id:"p2",correct:false}]);');
  w.eval('resultInfo={kind:"lose",title:"Tu perds",sub:"Ton drapeau est tombe."};resultDismissed=false;renderResult(true);');
  await attendre(100);
  T("bandeau de fin de partie affiche", !d.getElementById("resultBanner").classList.contains("hide"));
  T("titre de la partie", d.getElementById("resultTitle").textContent === "Tu perds", d.getElementById("resultTitle").textContent);
  T("plus aucune pastille du sprint", pastilles() === 0 && cache("rushHistory"), pastilles());
  T("plus de consigne du sprint", cache("rushHistoryNote"));
  T("\"Nouvelle partie\" ne relance pas le sprint", w.eval("finAction") === null);
  d.getElementById("resultNew").click(); await attendre(200);
  T("aucun sprint relance au clic", !w.__relance);

  console.log("\n--- Bilan des Coordonnees (showFin seul) ---");
  w.eval('showFin("Sprint termine","x","Relancer",null);renderRushHistory([{id:"p1",correct:true}]);');
  w.eval('showFin("Temps ecoule","Score : 12","Rejouer",function(){});');
  T("ni pastilles ni consigne", pastilles() === 0 && cache("rushHistory") && cache("rushHistoryNote"));

  w.close();
  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + e.stack); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
