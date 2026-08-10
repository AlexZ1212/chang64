/* Perft : compte les feuilles de l'arbre des coups legaux a une profondeur
   donnee. C'est le test de reference d'un generateur de coups : un seul coup
   mal genere, un roque ou une prise en passant de travers, et le compte
   diverge immediatement.

   Les valeurs attendues ci-dessous sont les valeurs publiees, verifiees par
   toute la communaute des programmeurs d'echecs depuis des decennies. Elles
   ne dependent pas de cette implementation.

   Usage : node perft.js [profondeur_max]
*/
const path = require("path");
const { Game } = require(path.join(__dirname, "engine.js"));

const SUITE = [
  { name: "position initiale",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    n: [1, 20, 400, 8902, 197281, 4865609] },
  { name: "Kiwipete (roques et clouages)",
    fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    n: [1, 48, 2039, 97862, 4085603] },
  { name: "finale de pions (prise en passant)",
    fen: "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
    n: [1, 14, 191, 2812, 43238, 674624] },
  { name: "promotions",
    fen: "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
    n: [1, 6, 264, 9467, 422333] },
  { name: "position asymetrique",
    fen: "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
    n: [1, 44, 1486, 62379, 2103487] },
  { name: "position dense",
    fen: "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
    n: [1, 46, 2079, 89890, 3894594] }
];

function perft(g, d) {
  if (d === 0) return 1;
  const moves = g.moves();
  if (d === 1) return moves.length;
  let n = 0;
  for (const m of moves) {
    g.makeMove(m);
    n += perft(g, d - 1);
    g.undoMove();
  }
  return n;
}

const MAX = +process.argv[2] || 4;
let ok = 0, ko = 0;
for (const c of SUITE) {
  console.log("\n" + c.name);
  for (let d = 1; d < c.n.length && d <= MAX; d++) {
    const g = new Game(c.fen);
    const t0 = Date.now();
    let got;
    try { got = perft(g, d); } catch (e) { got = "erreur : " + e.message; }
    const want = c.n[d];
    const good = got === want;
    good ? ok++ : ko++;
    console.log("  " + (good ? "OK  " : "FAIL") +
      "  profondeur " + d + " : " + String(got).padStart(9) +
      (good ? "" : "   attendu " + want) +
      "   (" + (Date.now() - t0) + " ms)");
  }
}
console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
