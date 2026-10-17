/* Verification automatique de chang64.
   Lancement : node tests/check_minage_non_trivial.js   (n'a pas besoin de site/)

   Ce que ce test garde (2026-09-14) : le mineur produit des exercices a
   plusieurs decisions et refuse les prises evidentes.

   Avant : 86,9 % de la banque en un seul demi-coup, 99,0 % des gains. Deux
   causes dans extractPuzzleAt : aucun filtre sur la trivialite du premier
   coup, et `solMoves = [best.mv]` pour tout gain. Mesure sur 400 gains
   mines : la moitie etaient des prises evidentes, et 34,8 % supportaient
   une sequence forcee de 2 a 4 decisions qui etait jetee.

   Verifie, par ordre d'importance : aucun exercice retenu n'a une prise
   evidente pour solution ; des gains a plusieurs demi-coups sortent ; le
   sacrifice n'est pas confondu avec la prise gratuite ; les sequences se
   rejouent ; les en-tetes du PGN sont conservees. */
const path = require("path");
const fs = require("fs");
const { Game } = require(path.join(__dirname, "..", "engine.js"));
const { trivialite, sourceDe, extractPuzzleAt } = require(path.join(__dirname, "..", "mine_puzzles.js"));

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n) } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")) } };
const coupDe = (fen, uci) => { const g = new Game(fen); return { g, mv: g.moves().find(m => g.uci(m) === uci) }; };

console.log("\n--- Le test de trivialite ---");
for (const [fen, uci, attendu, quoi] of [
  ["4k3/8/8/8/8/8/3r4/3QK3 w - - 0 1", "d1d2", "prise gratuite", "dame prend une tour que personne ne defend"],
  ["4k3/8/8/8/8/3r4/8/3RK3 w - - 0 1", "d1d3", "prise gratuite", "tour prend une tour que personne ne defend"],
  ["4k3/8/8/8/8/3q4/2P5/4K3 w - - 0 1", "c2d3", "prend plus cher", "un pion prend une dame, meme defendue"],
  ["4k3/8/8/8/8/3r4/3r4/3RK3 w - - 0 1", "d1d2", null, "prise d'egale valeur sur case defendue"],
  ["4k3/8/8/8/8/8/8/3RK3 w - - 0 1", "d1d5", null, "un coup qui ne prend rien"],
  ["4k3/8/4p3/3p4/8/8/8/3QK3 w - - 0 1", "d1d5", null, "un sacrifice (dame prend un pion defendu)"],
]) {
  const { g, mv } = coupDe(fen, uci);
  if (!mv) { T(quoi, false, "coup introuvable"); continue; }
  T(quoi, trivialite(g, mv) === attendu, String(trivialite(g, mv)));
}

console.log("\n--- Les en-tetes du PGN sont conservees ---");
const s = sourceDe({ Event: "Rated Blitz game", White: "a", Black: "b", Site: "https://lichess.org/abcd1234",
  ECO: "B20", Opening: "Sicilian Defense", UTCDate: "2024.03.01", TimeControl: "180+2", WhiteElo: "2010", BlackElo: "1990" }, 33);
T("identifiant de partie", s.site === "https://lichess.org/abcd1234");
T("code et nom d'ouverture", s.eco === "B20" && s.opening === "Sicilian Defense");
T("date et cadence", s.date === "2024.03.01" && s.timeControl === "180+2");
T("elo moyen", s.elo === 2000);
T("champs absents omis", !("site" in sourceDe({ Event: "x", White: "a", Black: "b" }, 1)));

console.log("\n--- Sur de vraies positions minees ---");
const banque = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "puzzles.json"), "utf8"));
const gains = banque.filter(p => p.source && p.type !== "mate" && (p.sol || []).length === 1);
const pas = Math.max(1, Math.floor(gains.length / 24)), ech = [];
for (let i = 0; i < gains.length && ech.length < 24; i += pas) ech.push(gains[i]);

let triviales = 0, retenus = 0, multi = 0, trivialRetenu = 0, cassees = 0, unTrivial = null;
for (const p of ech) {
  const { g, mv } = coupDe(p.fen, p.sol[0]);
  if (mv && trivialite(g, mv)) { triviales++; unTrivial = unTrivial || p; }
  const r = extractPuzzleAt(new Game(p.fen), { depth: 3 });
  if (!r) continue;
  retenus++;
  if (r.sol.length > 1) multi++;
  const { g: g2, mv: mv2 } = coupDe(r.fen, r.sol[0]);
  if (mv2 && trivialite(g2, mv2)) trivialRetenu++;
  const rejeu = new Game(r.fen);
  for (const u of r.sol) { const f = rejeu.moves().find(m => rejeu.uci(m) === u); if (!f) { cassees++; break; } rejeu.makeMove(f); }
}
console.log("  (" + ech.length + " positions, " + triviales + " triviales, " + retenus + " retenues, " + multi + " a plusieurs demi-coups)");
T("aucun exercice retenu n'a une prise evidente pour solution", trivialRetenu === 0, trivialRetenu);
T("toutes les sequences produites se rejouent", cassees === 0, cassees);
T("l'echantillon contient des positions triviales", triviales > 0);
T("elles sont toutes rejetees", retenus <= ech.length - triviales);
T("des gains a plusieurs demi-coups sortent du mineur", multi > 0, multi);

console.log("\n--- L'ancien comportement reste accessible ---");
if (unTrivial) {
  T("rejetee par defaut", extractPuzzleAt(new Game(unTrivial.fen), { depth: 3 }) === null);
  T("retenue avec garderPrisesSimples", extractPuzzleAt(new Game(unTrivial.fen), { depth: 3, garderPrisesSimples: true }) !== null);
}

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
