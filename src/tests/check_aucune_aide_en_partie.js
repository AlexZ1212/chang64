/* Verification automatique de chang64.
   Lancement : node tests/check_aucune_aide_en_partie.js

   Principe pose pour ce site : aucune aide exterieure pendant qu'on joue.

   "Reprendre" annulait le coup joue et celui du moteur. C'etait la seule
   vraie assistance en cours de partie : essayer un coup, voir la reponse,
   revenir en arriere si elle ne plait pas. Retire, y compris en cadence
   libre. C'est en se trompant qu'on apprend.

   "Voir le meilleur coup" et Stockfish appartiennent a la revue
   d'apres-partie. Ils etaient deja sans effet pendant une partie, mais
   apparaissaient parmi les commandes de jeu, ce qui laissait croire qu'ils
   pouvaient aider a jouer. Ils sont desormais dans le panneau Revue et
   explicitement grises tant que la partie n'est pas finie.
*/
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "site", "index.html"), "utf8");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };

const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true,
  url: "https://chang64.com/", virtualConsole: new VirtualConsole() });
const w = dom.window, d = w.document;
const wait = ms => new Promise(r => setTimeout(r, ms));
const cells = () => d.querySelectorAll(".sq");

setTimeout(async () => {
  console.log("\n--- Aucune annulation de coup possible ---");
  T("le bouton Reprendre n'existe plus", !d.getElementById("btnUndo"));
  T("aucun libelle 'Take back'", !/>Take back</.test(html));
  T("aucun libelle 'Reprendre' sur un bouton", !/id="btnUndo"/.test(html));

  console.log("\n--- Les outils d'analyse sont dans le panneau Revue ---");
  const posHint = html.indexOf('id="btnHint"');
  const posRevue = html.indexOf('id="btnAnalyse"');
  const posResign = html.indexOf('id="btnResign"');
  T("'Voir le meilleur coup' avec l'analyse", posHint > posRevue, "hint " + posHint + " vs analyse " + posRevue);
  T("et non parmi les commandes de jeu", posHint > posResign);
  T("libelle explicite", /Show the best move/.test(html));

  console.log("\n--- En cours de partie, tout est grise ---");
  d.getElementById("heroPlay").click(); await wait(600);
  const rb = d.getElementById("readyBanner");
  if (rb && !rb.classList.contains("hide")) { d.getElementById("readyStart").click(); await wait(400); }
  cells()[52].click(); await wait(120); cells()[36].click(); await wait(1700);
  T("Voir le meilleur coup grise", d.getElementById("btnHint").disabled);
  T("Stockfish grise", d.getElementById("btnStockfish").disabled);
  T("Abandonner reste le seul actif", !d.getElementById("btnResign").disabled);
  T("Nouvelle partie grisee", d.getElementById("btnNew").disabled);

  console.log("\n--- Une fois la partie finie, l'analyse s'ouvre ---");
  d.getElementById("btnResign").click(); await wait(250);
  d.getElementById("btnResign").click(); await wait(700);
  T("Voir le meilleur coup actif", !d.getElementById("btnHint").disabled);
  T("Stockfish actif", !d.getElementById("btnStockfish").disabled);

  console.log("\n--- En francais ---");
  [...d.getElementById("langSwitch").children].find(b => b.dataset.lang === "fr").click();
  await wait(500);
  T("libelle traduit", /meilleur coup/i.test(d.getElementById("btnHint").textContent),
    d.getElementById("btnHint").textContent);

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
}, 1400);
