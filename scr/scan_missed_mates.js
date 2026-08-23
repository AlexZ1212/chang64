/* Recherche, pour chacun des 1000 exercices, un coup de mat immediat qui
   n'est pas la solution enregistree. C'est exactement le defaut trouve sur
   #MFLCX (p346) : le moteur notait un mat comme un pat (score 0 au lieu de
   la valeur de mat), et pouvait donc laisser passer un mat au profit d'un
   coup seulement bon. Recherche directe, sans passer par search() : on
   simule chaque coup legal et on regarde si l'adversaire se retrouve sans
   coup et en echec, ce qui ne depend pas du bug corrige. */
const fs = require("fs");
const path = require("path");
const { Game, nameSq } = require("./engine.js");

const puzzles = JSON.parse(fs.readFileSync(path.join(__dirname, "puzzles.json"), "utf8"));
const suspects = [];

for (const p of puzzles) {
  const g = new Game(p.fen);
  const legal = g.moves();
  const labelled = new Set(p.sol);
  for (const mv of legal) {
    const from = mv.from, to = mv.to;
    const c = new Game(p.fen);
    const m2 = c.moves().find(m => m.from === from && m.to === to && m.promo === mv.promo);
    c.makeMove(m2);
    const rep = c.moves();
    if (rep.length === 0 && c.inCheck()) {
      /* game.uci() est la conversion faisant autorite (utilisee partout
         ailleurs dans le site pour comparer un coup a une solution) : la
         construction manuelle "qrbn"[promo-2] employee dans une version
         precedente de ce script ne correspond pas a SYM et etiquetait mal
         les coups de promotion, laissant croire a un second mat inexistant
         sur #AO0BA et #GLXP6 (promotion cavalier mal reconnue comme telle,
         alors que seule la dame mate reellement a cet endroit). */
      const uciStr = c.uci ? c.uci(m2) : (require("./engine.js").sqName(from) + require("./engine.js").sqName(to));
      if (!labelled.has(uciStr)) {
        suspects.push({ id: p.id, code: p.code, theme: p.theme, sol: p.sol, mateMove: uciStr });
      }
    }
  }
}

console.log(suspects.length + " exercice(s) avec un mat non retenu comme solution :");
console.log(JSON.stringify(suspects, null, 1));
