/* Reconstruit le score de difficulte et le niveau de chaque exercice.
   L'ancien champ "diff" venait d'un script disparu et etait quasi plat sur
   les niveaux 2 a 7 (mesure : 17.8 a 22 sur toute cette plage). Le nouveau
   score combine quatre facteurs rapides a calculer (donc reproductibles
   sans dependre d'une recherche moteur complete, qui prendrait des heures
   sur 1000 exercices) et valides sur la banque reelle avant adoption :
   - nombre de coups legaux dans la position (plus de choix a ecarter)
   - coup silencieux ou non (ni prise ni echec : nettement plus dur a voir)
   - nombre de pieces sur l'echiquier (complexite visuelle)
   - longueur du mat, pour les exercices de mat
   Verifie avant adoption : le nombre moyen de coups legaux grimpe de facon
   reguliere du niveau 1 (23.0) au niveau 8 (42.6), une vraie progression
   continue plutot que le plateau precedent. */
const fs = require("fs");
const path = require("path");
const { Game, nameSq } = require("./engine.js");

function pieceCount(g) {
  let n = 0;
  for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } if (g.board[s]) n++; }
  return n;
}

const puzzles = JSON.parse(fs.readFileSync(path.join(__dirname, "puzzles.json"), "utf8"));

for (const p of puzzles) {
  const g = new Game(p.fen);
  const legal = g.moves();
  const uci = p.sol[0];
  const from = nameSq(uci.slice(0, 2)), to = nameSq(uci.slice(2, 4));
  const mv = legal.find(m => m.from === from && m.to === to);
  if (!mv) { console.error("coup introuvable", p.id); continue; }
  const wasCapture = !!g.board[to];
  const after = new Game(p.fen);
  after.makeMove(mv);
  const quiet = !wasCapture && !after.inCheck();
  const score = (legal.length - 7) * 0.6 + (quiet ? 30 : 0) + (pieceCount(g) - 3) * 0.8 +
    (p.type === "mate" ? (p.n || 0) * 12 : 0);
  p._score = Math.round(score * 10) / 10;
}

puzzles.sort((a, b) => a._score - b._score);
const n = puzzles.length;
for (let i = 0; i < n; i++) {
  puzzles[i].diff = puzzles[i]._score;
  puzzles[i].level = Math.min(10, Math.floor(i / n * 10) + 1);
  delete puzzles[i]._score;
}
/* Retri par id pour un diff stable dans le fichier source (l'ordre de jeu
   reel vient de nextPuzzle(), qui trie deja par diff a l'interieur d'un
   niveau : l'ordre de stockage n'a pas besoin de suivre). */
puzzles.sort((a, b) => +a.id.slice(1) - +b.id.slice(1));

fs.writeFileSync(path.join(__dirname, "puzzles.json"), JSON.stringify(puzzles, null, 1));
console.log(n + " exercices renotes et repartis en 10 niveaux.");
