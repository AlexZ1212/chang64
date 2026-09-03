const fs = require("fs");
const { JSDOM } = require("jsdom");
const Engine = require("./engine.js");

const html = fs.readFileSync(require("path").join(__dirname,"site-index.html"), "utf8");
const wait = ms => new Promise(r => setTimeout(r, ms));
const PUZZLES = JSON.parse(fs.readFileSync(require("path").join(__dirname,"puzzles.json"), "utf8"));

function open_(url) {
  const errors = [];
  const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url });
  dom.window.addEventListener("error", e => errors.push(e.message));
  return { dom, w: dom.window, errors };
}
const helpers = w => {
  const $ = id => w.document.getElementById(id);
  const cells = () => $("board").children;
  const click = el => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  const isFlipped = () => {
    const co = cells()[0].querySelector(".co.r");
    return co ? co.textContent.trim() === "1" : false;
  };
  const cellFor = sq => {
    const f = "abcdefgh".indexOf(sq[0]), r = 8 - parseInt(sq[1], 10);
    return isFlipped() ? (7 - r) * 8 + (7 - f) : r * 8 + f;
  };
  const placement = () => {
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
  };
  const currentPuzzle = () => PUZZLES.find(p => p.fen.split(" ")[0] === placement());
  return { $, cells, click, isFlipped, cellFor, placement, currentPuzzle };
};

(async () => {
  // ---------- appareil 1 : on resout des exercices ----------
  const A = open_("https://chang64.com/");
  await wait(400);
  const a = helpers(A.w);
  a.click(a.$("tab-puzzles"));
  await wait(700);

  let solved = 0;
  for (let i = 0; i < 7; i++) {
    const pz = a.currentPuzzle();
    if (!pz) { a.click(a.$("btnNext")); await wait(400); continue; }
    const u = pz.sol[0];
    a.click(a.cells()[a.cellFor(u.slice(0, 2))]);
    await wait(40);
    a.click(a.cells()[a.cellFor(u.slice(2, 4))]);
    await wait(700);
    if (a.$("promoModal").className.includes("on")) { a.click(a.$("promoBtns").children[0]); await wait(500); }
    if (pz.type === "mate" && pz.n === 2 && a.$("exStatus").textContent.includes("mate en")) {
      const side = pz.fen.split(" ")[1];
      const g2 = new Engine.Game(a.placement() + " " + side + " - - 0 1");
      const mm = Engine.allMatingMoves(g2, 1);
      if (mm.length) {
        const u2 = g2.uci(mm[0]);
        a.click(a.cells()[a.cellFor(u2.slice(0, 2))]);
        await wait(40);
        a.click(a.cells()[a.cellFor(u2.slice(2, 4))]);
        await wait(600);
        if (a.$("promoModal").className.includes("on")) { a.click(a.$("promoBtns").children[0]); await wait(500); }
      }
    }
    if (a.$("exStatus").className.includes("win")) solved++;
    a.click(a.$("btnNext"));
    await wait(400);
  }
  const etat1 = { solved: a.$("stSolved").textContent, best: a.$("stBest").textContent, lvl: a.$("lvlNum").textContent };
  console.log("Appareil 1 — résolus:", etat1.solved, "record:", etat1.best, "niveau:", etat1.lvl);

  a.click(a.$("btnCodeGen"));
  await wait(200);
  const code = a.$("codeOut").value;
  console.log("Code généré :", code);
  console.log("Longueur :", code.length, "caractères");
  console.log("Message :", a.$("codeMsg").textContent);

  // ---------- appareil 2 : vierge, on restaure ----------
  const B = open_("https://chang64.com/");
  await wait(400);
  const b = helpers(B.w);
  b.click(b.$("tab-puzzles"));
  await wait(600);
  console.log("\nAppareil 2 avant restauration — résolus:", b.$("stSolved").textContent, "niveau:", b.$("lvlNum").textContent);

  b.$("codeIn").value = code;
  b.click(b.$("btnCodeLoad"));
  await wait(600);
  const etat2 = { solved: b.$("stSolved").textContent, best: b.$("stBest").textContent, lvl: b.$("lvlNum").textContent };
  console.log("Après restauration — résolus:", etat2.solved, "record:", etat2.best, "niveau:", etat2.lvl);
  console.log("Message :", b.$("codeMsg").textContent);
  console.log("Transfert fidèle :", JSON.stringify(etat1) === JSON.stringify(etat2) ? "OK" : "ECART");
  console.log("Un exercice est bien chargé :", b.$("exQuest").textContent ? "OK" : "ECHEC");

  // ---------- codes invalides ----------
  const cas = [
    ["vide", ""],
    ["texte quelconque", "bonjour"],
    ["préfixe seul", "CH64-"],
    ["altéré au milieu", code.slice(0, 12) + "X" + code.slice(13)],
    ["tronqué", code.slice(0, code.length - 6)]
  ];
  console.log("");
  for (const [nom, val] of cas) {
    b.$("codeIn").value = val;
    b.click(b.$("btnCodeLoad"));
    await wait(250);
    const refuse = b.$("codeMsg").textContent.includes("not valid");
    console.log("Code " + nom + " :", refuse ? "refusé (OK)" : "ACCEPTÉ — PROBLÈME");
  }
  console.log("Progression intacte après ces essais — résolus:", b.$("stSolved").textContent, "niveau:", b.$("lvlNum").textContent);

  // ---------- espaces et retours a la ligne ----------
  b.$("codeIn").value = "  " + code + "\n";
  b.click(b.$("btnCodeLoad"));
  await wait(400);
  console.log("Code avec espaces autour :", b.$("codeMsg").textContent.includes("restored") ? "accepté (OK)" : "refusé");

  console.log("\nErreurs JS :", [...A.errors, ...B.errors].join(" | ") || "aucune");
  process.exit(0);
})();
