/* Corrige les 9 exercices trouves par scan_missed_mates.js, suite au bug
   moteur corrige dans engine.js (search() notait un mat comme un pat sur
   une position deja terminee, voir le commentaire dans search()).

   Groupe A (7 exercices) : un mat existait et n'etait pas la solution
   enregistree. On les reclasse en mat avec le vrai meilleur coup, theme et
   explication recalcules via classify(), difficulte recalculee avec la
   meme formule que le reste de la banque puis replacee dans les bornes de
   niveau existantes.

   Groupe B (2 exercices) : le mat etait deja la solution, mais uniquement
   par promotion dame. Promouvoir en cavalier mate tout autant : ajoute
   comme deuxieme reponse acceptee, rien d'autre ne change.

   Le nombre total d'exercices ne bouge pas : on modifie 9 entrees
   existantes, on n'en ajoute ni n'en retire aucune. */
const fs = require("fs");
const path = require("path");
const { Game, nameSq } = require("./engine.js");
const { classify, puzzleCode } = require("./gen_puzzles.js");

const GROUP_A = {
  p305: ["g4g8"],
  p346: ["c4e2"],
  p551: ["f4e6", "f4g6"],
  p570: ["d1h5"],
  p632: ["e2g2", "h2g2"],
  p671: ["b4d2"],
  p798: ["d8h4"]
};
const GROUP_B = {
  p38: "g7g8n",
  p649: "e7e8n"
};

function pieceCount(g) {
  let n = 0;
  for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } if (g.board[s]) n++; }
  return n;
}
function scoreOf(p) {
  const g = new Game(p.fen);
  const legal = g.moves();
  const uci = p.sol[0];
  const from = nameSq(uci.slice(0, 2)), to = nameSq(uci.slice(2, 4));
  const mv = legal.find(m => m.from === from && m.to === to);
  const wasCapture = !!g.board[to];
  const after = new Game(p.fen);
  after.makeMove(mv);
  const quiet = !wasCapture && !after.inCheck();
  return (legal.length - 7) * 0.6 + (quiet ? 30 : 0) + (pieceCount(g) - 3) * 0.8 +
    (p.type === "mate" ? (p.n || 0) * 12 : 0);
}

const BOUNDS = [
  [0.8, 28.2], [28.2, 31.8], [31.8, 33.8], [34, 35.4], [35.4, 37],
  [37, 38.6], [38.6, 41.2], [41.2, 48.6], [48.6, 63.2], [63.2, 100.2]
];
function levelFor(score) {
  for (let i = 0; i < BOUNDS.length; i++) if (score <= BOUNDS[i][1]) return i + 1;
  return 10;
}

const puzzles = JSON.parse(fs.readFileSync(path.join(__dirname, "puzzles.json"), "utf8"));
const byId = {}; for (const p of puzzles) byId[p.id] = p;
const log = [];

for (const [id, moves] of Object.entries(GROUP_A)) {
  const p = byId[id];
  const before = { theme: p.theme, sol: p.sol.slice(), level: p.level, code: p.code };
  const g = new Game(p.fen);
  const from = nameSq(moves[0].slice(0, 2)), to = nameSq(moves[0].slice(2, 4));
  const mv = g.moves().find(m => m.from === from && m.to === to);
  const { theme, detail } = classify(g, mv, true, 1);
  p.sol = moves;
  p.type = "mate";
  p.n = 1;
  p.theme = theme;
  p.explain = detail;
  const newScore = Math.round(scoreOf(p) * 10) / 10;
  p.diff = newScore;
  p.level = levelFor(newScore);
  p.code = puzzleCode(p.fen, p.sol);
  log.push({ id, before, after: { theme: p.theme, sol: p.sol, level: p.level, code: p.code } });
}

for (const [id, extraMove] of Object.entries(GROUP_B)) {
  const p = byId[id];
  const before = { sol: p.sol.slice(), code: p.code };
  p.sol = [...p.sol, extraMove];
  p.code = puzzleCode(p.fen, p.sol);
  log.push({ id, before, after: { sol: p.sol, code: p.code } });
}

fs.writeFileSync(path.join(__dirname, "puzzles.json"), JSON.stringify(puzzles, null, 1));
console.log("total apres correction :", puzzles.length);
console.log(JSON.stringify(log, null, 1));
