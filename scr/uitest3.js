const fs = require("fs");
const { JSDOM } = require("jsdom");
const Engine = require("./engine.js");

const html = fs.readFileSync(require("path").join(__dirname,"site-index.html"), "utf8");
const errors = [];
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true });
const w = dom.window;
w.addEventListener("error", e => errors.push(e.message));
const wait = ms => new Promise(r => setTimeout(r, ms));
const $ = id => w.document.getElementById(id);
const cells = () => $("board").children;
const click = el => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
const GLYPH = { "\u265F": "p", "\u265E": "n", "\u265D": "b", "\u265C": "r", "\u265B": "q", "\u265A": "k" };

function isFlipped() {
  const co = cells()[0].querySelector(".co.r");
  return co ? co.textContent.trim() === "1" : false;
}
function placement() {
  const flip = isFlipped(), grid = {};
  for (let i = 0; i < 64; i++) {
    const p = cells()[i].querySelector(".piece");
    if (!p) continue;
    const r0 = Math.floor(i / 8), f0 = i % 8;
    const r = flip ? 7 - r0 : r0, f = flip ? 7 - f0 : f0;
    const d = p.dataset.p;
    grid[r * 8 + f] = d[0] === "w" ? d[1].toUpperCase() : d[1];
  }
  let out = "";
  for (let r = 0; r < 8; r++) {
    let e = 0;
    for (let f = 0; f < 8; f++) {
      const p = grid[r * 8 + f];
      if (!p) { e++; continue; }
      if (e) { out += e; e = 0; }
      out += p;
    }
    if (e) out += e;
    if (r < 7) out += "/";
  }
  return out;
}
function cellFor(s) {
  const f = "abcdefgh".indexOf(s[0]), r = 8 - parseInt(s[1], 10);
  return isFlipped() ? (7 - r) * 8 + (7 - f) : r * 8 + f;
}

(async () => {
  await wait(400);
  /* onSquare ignore les clics tant que le mode n'est pas "play" : sans ouvrir
     l'onglet, aucun coup n'etait joue et le test signalait une
     desynchronisation qui n'existait pas. */
  click($("tab-play"));
  await wait(250);
  // bot au niveau 1 pour aller vite
  click($("segLevel").children[0]);
  click($("btnNew"));
  await wait(500);

  // partie suivie en parallele avec le moteur de reference
  const ref = new Engine.Game();
  let plies = 0, ended = "";
  for (let i = 0; i < 60; i++) {
    if (ref.moves().length === 0 || ref.isDraw()) { ended = "terminee"; break; }
    const r = Engine.search(ref, 2, 120);
    const mv = r.move || ref.moves()[0];
    const u = ref.uci(mv);
    click(cells()[cellFor(u.slice(0, 2))]);
    await wait(30);
    click(cells()[cellFor(u.slice(2, 4))]);
    await wait(60);
    if ($("promoModal").className.includes("on")) { click($("promoBtns").children[0]); await wait(60); }
    ref.makeMove(mv);
    plies++;
    // attendre la reponse du bot
    let guard = 0;
    while (guard++ < 60) {
      await wait(70);
      const pl = placement();
      if (pl !== ref.fen().split(" ")[0]) break;
      if ($("status").textContent.includes("mat") || $("status").textContent.includes("nulle") || $("status").textContent.includes("Pat")) break;
    }
    // rejouer la reponse du bot dans le moteur de reference
    const domPl = placement();
    if (domPl === ref.fen().split(" ")[0]) { ended = "fin de partie"; break; }
    let matched = null;
    for (const cand of ref.moves()) {
      ref.makeMove(cand);
      if (ref.fen().split(" ")[0] === domPl) matched = cand;
      ref.undoMove();
      if (matched) break;
    }
    if (!matched) { ended = "DESYNCHRONISATION"; break; }
    ref.makeMove(matched);
    plies++;
  }
  console.log("Demi-coups joués :", plies, "| issue :", ended || "60 coups atteints");
  console.log("Position finale identique moteur/interface :", placement() === ref.fen().split(" ")[0] ? "OK" : "ECART");
  console.log("Statut :", $("status").textContent);
  const rows = $("sheet").querySelectorAll(".sheet-row").length;
  console.log("Lignes sur la feuille de partie :", rows);

  /* Le bouton Reprendre a ete retire : aucune annulation de coup en cours de
     partie, c'est une aide au jeu. On verifie donc son absence. */
  console.log("Reprendre :", $("btnUndo") ? "ECHEC (le bouton devrait avoir disparu)" : "OK (retire)");

  // jouer en noirs
  click($("segColor").children[1]);
  await wait(1200);
  console.log("Je joue Noirs, plateau retourné :", isFlipped() ? "OK" : "ECHEC");
  console.log("Le bot a ouvert :", $("sheet").textContent.replace(/\s+/g, " ").trim().slice(0, 20));
  console.log("Erreurs JS :", errors.length ? errors.join(" | ") : "aucune");
  process.exit(0);
})();
