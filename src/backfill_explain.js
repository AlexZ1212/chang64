/* Reanalyse les 1000 exercices existants pour leur ajouter le champ
   `explain` (cases/pieces precises derriere le theme), sans toucher au
   reste : meme fen, meme solution, meme theme, meme code. classify() est
   une fonction pure (position + coup -> theme + detail), la rejouer sur des
   exercices deja verifies ne prend et ne change aucun risque. */
const fs = require("fs");
const path = require("path");
const { Game, nameSq } = require("./engine.js");
const { classify } = require("./gen_puzzles.js");

const puzzles = JSON.parse(fs.readFileSync(path.join(__dirname, "puzzles.json"), "utf8"));
let changed = 0;
for (const p of puzzles) {
  const g = new Game(p.fen);
  const uci = p.sol[0];
  const from = nameSq(uci.slice(0, 2)), to = nameSq(uci.slice(2, 4));
  const promoLetter = uci.length > 4 ? uci[4] : null;
  const mv = g.moves().find(m => m.from === from && m.to === to &&
    (promoLetter ? "qrbn"[m.promo - 2] === promoLetter : !m.promo));
  if (!mv) { console.error("coup introuvable pour", p.id, uci); continue; }
  const isMate = p.type === "mate";
  const { theme, detail } = classify(g, mv, isMate, p.n || 0);
  if (theme !== p.theme) {
    console.error("theme corrige pour", p.id, ":", p.theme, "->", theme);
    p.theme = theme;
  }
  p.explain = detail;
  changed++;
}
fs.writeFileSync(path.join(__dirname, "puzzles.json"), JSON.stringify(puzzles, null, 1));
console.log(changed + "/" + puzzles.length + " exercices enrichis d'un champ explain.");
