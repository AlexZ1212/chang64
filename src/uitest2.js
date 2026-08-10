const fs = require("fs");
const { JSDOM } = require("jsdom");
const Engine = require("./engine.js");

const html = fs.readFileSync(require("path").join(__dirname,"site-index.html"), "utf8");
const PUZZLES = JSON.parse(fs.readFileSync(require("path").join(__dirname,"puzzles.json"), "utf8"));
const errors = [];
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true });
const w = dom.window;
w.addEventListener("error", e => errors.push(e.message));

const wait = ms => new Promise(r => setTimeout(r, ms));
const $ = id => w.document.getElementById(id);
const cells = () => $("board").children;
const click = el => { if (!el) { console.log("  (element absent, etape ignoree)"); return false; }
  el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); return true; };

const GLYPH = { "\u265F": "p", "\u265E": "n", "\u265D": "b", "\u265C": "r", "\u265B": "q", "\u265A": "k" };

function isFlipped() {
  const co = cells()[0].querySelector(".co.r");
  return co ? co.textContent.trim() === "1" : false;
}
function placementFromDom() {
  const flip = isFlipped();
  const grid = {};
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
function cellIndexFor(sqStr) {
  const f = "abcdefgh".indexOf(sqStr[0]);
  const r = 8 - parseInt(sqStr[1], 10);
  return isFlipped() ? (7 - r) * 8 + (7 - f) : r * 8 + f;
}
function currentPuzzle() {
  const pl = placementFromDom();
  return PUZZLES.find(p => p.fen.split(" ")[0] === pl);
}

(async () => {
  await wait(400);
  click($("tab-puzzles"));   /* l'onglet des exercices s'appelle tab-puzzles */
  await wait(900);

  let solved = 0, identified = 0, failed = 0;
  for (let round = 0; round < 20; round++) {
    const pz = currentPuzzle();
    if (!pz) { console.log("position non identifiée, on passe"); click($("btnNext")); await wait(400); continue; }
    identified++;
    const uci = pz.sol[0];
    const from = cellIndexFor(uci.slice(0, 2)), to = cellIndexFor(uci.slice(2, 4));
    click(cells()[from]);
    await wait(40);
    const marks = $("board").querySelectorAll(".dot,.ring").length;
    click(cells()[to]);
    await wait(1200);
    // promotion eventuelle
    if ($("promoModal").className.includes("on")) {
      click($("promoBtns").children[0]);
      await wait(900);
    }
    const st = $("exStatus");
    const win = st.className.includes("win");
    const stillPlaying = st.textContent.includes("mate en");
    if (pz.type === "mate" && pz.n === 2 && stillPlaying) {
      // deuxieme coup : on cherche le mat restant
      const side = pz.fen.split(" ")[1];
      const g2 = new Engine.Game(placementFromDom() + " " + side + " - - 0 1");
      const mm = Engine.allMatingMoves(g2, 1);
      if (mm.length) {
        const u2 = g2.uci(mm[0]);
        click(cells()[cellIndexFor(u2.slice(0, 2))]);
        await wait(60);
        click(cells()[cellIndexFor(u2.slice(2, 4))]);
        await wait(600);
        if ($("promoModal").className.includes("on")) {
          click($("promoBtns").children[0]);
          await wait(600);
        }
      } else {
        console.log("  (aucun mat en 1 trouvé après la défense, position:", placementFromDom(), ")");
      }
    }
    const ok = $("exStatus").className.includes("win");
    if (ok) solved++; else { failed++; console.log("non résolu:", pz.id, pz.type, pz.n, pz.fen, "|", $("exStatus").textContent); }
    click($("btnNext"));
    await wait(500);
  }
  console.log(`\nIdentifiés ${identified} | résolus ${solved} | échecs ${failed}`);
  console.log("Compteurs affichés — résolus:", $("stSolved").textContent, "série:", $("stStreak").textContent, "record:", $("stBest").textContent, "niveau:", $("lvlNum").textContent);
  console.log("Erreurs JS :", errors.length ? errors.join(" | ") : "aucune");
  process.exit(0);
})();
