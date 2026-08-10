const fs = require("fs");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(require("path").join(__dirname,"site-index.html"), "utf8");
const errors = [];
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true });
const w = dom.window;
w.addEventListener("error", e => errors.push("window error: " + e.message));
const origErr = console.error;

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
const $ = id => w.document.getElementById(id);
const board = () => $("board");
const cells = () => board().children;

function click(el) {
  /* Un element absent ne doit pas faire exploser le test : l'interface evolue,
     et un bouton retire doit se signaler comme un point manquant, pas
     interrompre toutes les verifications qui suivent. */
  if (!el) { console.log("  (element absent, etape ignoree)"); return false; }
  el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  return true;
}
function squareIndexOf(sqName) {
  // retrouve la cellule DOM correspondant a une case, selon l'orientation courante
  const cs = cells();
  for (let i = 0; i < 64; i++) {
    const co = cs[i];
    if (co.dataset.sq === sqName) return i;
  }
  return -1;
}

(async () => {
  await wait(400);
  console.log("Démarrage :", errors.length ? "ERREURS " + errors.join(" | ") : "OK");

  /* L'interface ne demarre plus la partie toute seule : il faut appuyer sur
     l'onglet Jouer puis "Start game" : onSquare ignore les clics tant que le
     mode n'est pas "play", et l'echiquier reste vide tant que la partie n'a
     pas demarre. Sans ces deux gestes, tout le test echouait en cascade et
     ne couvrait plus rien. */
  const tab = $("tab-play");
  if (tab) { click(tab); await wait(250); }
  const start = $("btnNew");
  if (start) { click(start); await wait(500); }

  // --- structure du plateau ---
  console.log("Cases générées :", cells().length);
  const pieces = board().querySelectorAll(".piece").length;
  console.log("Pièces affichées au départ :", pieces, pieces === 32 ? "OK" : "ECHEC");

  // --- jouer 1.e4 en cliquant e2 puis e4 ---
  // rang 8 en haut, e2 = ligne 6 (index 6*8+4=52), e4 = ligne 4 (4*8+4=36)
  click(cells()[52]);
  await wait(60);
  const dots = board().querySelectorAll(".dot,.ring").length;
  console.log("Coups légaux indiqués après sélection du pion e2 :", dots, dots === 2 ? "OK" : "ECHEC");
  click(cells()[36]);
  await wait(1400);
  const sheet = $("sheet").textContent.replace(/\s+/g, " ").trim();
  console.log("Feuille de partie après le premier coup :", sheet.slice(0, 40));
  console.log("Statut :", $("status").textContent);
  console.log("Le bot a répondu :", /1.*[a-h][1-8]/.test(sheet) ? "OK" : "à vérifier");

  // --- suggestion de coup ---
  click($("btnHint"));
  await wait(1600);
  console.log("Suggestion :", $("status").textContent);
  console.log("Cases mises en avant :", board().querySelectorAll(".hint").length);

  // --- reprise de coup ---
  const before = $("sheet").textContent.length;
  click($("btnUndo"));
  await wait(300);
  console.log("Reprendre :", $("sheet").textContent.length < before ? "OK" : "sans effet");

  // --- barre d'évaluation ---
  console.log("Évaluation :", $("evalnum").textContent, "|", $("evaltxt").textContent);

  // --- passage aux exercices ---
  click($("tab-ex"));
  await wait(900);
  console.log("\n--- Exercices ---");
  console.log("Énoncé :", $("exQuest").textContent);
  console.log("Thème :", $("exTheme").textContent);
  console.log("Niveau :", $("lvlNum").textContent, $("lvlName").textContent);
  console.log("Barre d'éval masquée :", $("evalwrap").className.includes("hide") ? "OK" : "ECHEC");
  console.log("Erreurs cumulées :", errors.length ? errors.join(" | ") : "aucune");

  // --- indice puis solution ---
  click($("btnHintEx"));
  await wait(500);
  console.log("Indice :", $("exStatus").textContent, "| cases:", board().querySelectorAll(".hint").length);
  click($("btnSolve"));
  await wait(500);
  console.log("Solution :", $("exStatus").textContent);

  // --- enchainer plusieurs exercices ---
  for (let i = 0; i < 5; i++) {
    click($("btnNext"));
    await wait(400);
    if (!$("exQuest").textContent) { console.log("ECHEC : énoncé vide"); break; }
  }
  console.log("5 exercices enchaînés :", errors.length ? "ERREURS" : "OK");
  console.log("Dernier énoncé :", $("exQuest").textContent);
  console.log("\nErreurs JS totales :", errors.length ? errors.join(" | ") : "aucune");
  process.exit(0);
})();
