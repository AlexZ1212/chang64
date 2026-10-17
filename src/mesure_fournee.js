#!/usr/bin/env node
/* Mesure d'une ou plusieurs fournees sorties de boucle_minage.js.

   Usage :
     node mesure_fournee.js <fournee.json | dossier> [...] [--pgn=<parties.pgn> --sauter=N --fenetre=N --minelo=1800]

   Repond aux questions de la fournee d'essai (handoff 10, etape 3) :
   - combien d'exercices a plusieurs decisions ;
   - aucune prise triviale en premier coup (trivialite() de mine_puzzles.js) ;
   - chaque sequence se rejoue coup par coup, legalement ;
   - doublons : par position, par partie d'origine, et contre la banque.
   Avec --pgn, compte aussi les parties de la fenetre qui passent le filtre
   Elo, pour un rendement en exercices pour 1 000 parties minees.

   Rien n'est ecrit ni modifie. */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { Game } = require(path.join(__dirname, "engine.js"));
const { trivialite } = require(path.join(__dirname, "mine_puzzles.js"));

const opt = (n) => { const a = process.argv.find(x => x.startsWith("--" + n + "=")); return a ? a.slice(n.length + 3) : null; };
const cibles = process.argv.slice(2).filter(a => !a.startsWith("--"));
if (!cibles.length) { console.error("Usage : node mesure_fournee.js <fournee.json | dossier> [...] [--pgn=... --sauter=N --fenetre=N --minelo=1800]"); process.exit(1); }

const fichiers = [];
for (const c of cibles) {
  if (fs.statSync(c).isDirectory()) {
    for (const f of fs.readdirSync(c)) if (/^fournee-\d+\.json$/.test(f)) fichiers.push(path.join(c, f));
  } else fichiers.push(c);
}
const ex = [];
for (const f of fichiers) ex.push(...JSON.parse(fs.readFileSync(f, "utf8")));
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + " %" : "-";

console.log(fichiers.length + " fichier(s), " + ex.length + " exercices\n");

/* Decisions = nos coups dans la sequence (demi-coups pairs). */
const decisions = p => Math.ceil(p.sol.length / 2);
const parType = { gain: [], mate: [] };
for (const p of ex) (parType[p.type] || (parType[p.type] = [])).push(p);

console.log("--- Decisions par exercice ---");
for (const [t, l] of Object.entries(parType)) {
  if (!l.length) continue;
  const hist = new Map();
  for (const p of l) hist.set(decisions(p), (hist.get(decisions(p)) || 0) + 1);
  const multi = l.filter(p => decisions(p) > 1).length;
  console.log(`  ${t.padEnd(5)} ${String(l.length).padStart(6)}   plusieurs decisions : ${multi} (${pct(multi, l.length)})`);
  for (const k of [...hist.keys()].sort((a, b) => a - b)) console.log(`        ${k} decision(s) : ${String(hist.get(k)).padStart(6)}  ${pct(hist.get(k), l.length)}`);
}
const unDemi = ex.filter(p => p.sol.length === 1).length;
console.log(`  en un seul demi-coup, tous types : ${unDemi} (${pct(unDemi, ex.length)})  [banque : 86,9 %]`);

console.log("\n--- Premier coup trivial (gains) ---");
let triviaux = 0;
const exemplesTriv = [];
for (const p of parType.gain) {
  const g = new Game(p.fen);
  const mv = g.moves().find(m => g.uci(m) === p.sol[0]);
  const r = mv && trivialite(g, mv);
  if (r) { triviaux++; if (exemplesTriv.length < 5) exemplesTriv.push(p.fen + "  " + p.sol[0] + "  " + r); }
}
console.log(`  ${triviaux} sur ${parType.gain.length}` + (triviaux ? "  <-- devrait valoir 0" : ""));
for (const e of exemplesTriv) console.log("    " + e);

console.log("\n--- Sequences rejouables ---");
let cassees = 0;
const exemplesCass = [];
for (const p of ex) {
  const g = new Game(p.fen);
  for (let i = 0; i < p.sol.length; i++) {
    const mv = g.moves().find(m => g.uci(m) === p.sol[i]);
    if (!mv) { cassees++; if (exemplesCass.length < 5) exemplesCass.push(p.fen + "  coup " + (i + 1) + " " + p.sol[i]); break; }
    g.makeMove(mv);
  }
}
console.log(`  ${ex.length - cassees} sur ${ex.length} se rejouent` + (cassees ? "  <-- " + cassees + " cassees" : ""));
for (const e of exemplesCass) console.log("    " + e);

console.log("\n--- Doublons ---");
const cleFen = f => f.split(" ").slice(0, 4).join(" ");
const fens = new Map();
for (const p of ex) fens.set(cleFen(p.fen), (fens.get(cleFen(p.fen)) || 0) + 1);
console.log(`  positions en double dans la fournee : ${ex.length - fens.size}`);
const sites = new Map();
let sansSite = 0;
for (const p of ex) { const s = p.source && p.source.site; if (!s) { sansSite++; continue; } sites.set(s, (sites.get(s) || 0) + 1); }
console.log(`  parties d'origine distinctes : ${sites.size}` + (sansSite ? `, ${sansSite} exercices sans site <-- sourceDe` : ""));
const banque = JSON.parse(fs.readFileSync(path.join(__dirname, "puzzles.json"), "utf8"));
const fensBanque = new Set(banque.map(p => cleFen(p.fen)));
const dejaEnBanque = [...fens.keys()].filter(f => fensBanque.has(f)).length;
console.log(`  positions deja en banque : ${dejaEnBanque}`);

console.log("\n--- Motifs ---");
const themes = new Map();
for (const p of ex) themes.set(p.theme, (themes.get(p.theme) || 0) + 1);
for (const [t, n] of [...themes].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}  ${pct(n, ex.length).padStart(7)}  ${t}`);

const pgn = opt("pgn");
if (pgn) {
  const sauter = +opt("sauter") || 0, fenetre = +opt("fenetre") || 0, minElo = +opt("minelo") || 1800;
  if (!fenetre) { console.error("--fenetre requis avec --pgn"); process.exit(1); }
  let rang = 0, passent = 0, we = 0, be = 0, fini = false;
  const cloture = () => { if (rang > sauter && rang <= sauter + fenetre && we >= minElo && be >= minElo) passent++; };
  const stream = fs.createReadStream(pgn, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  rl.on("line", (l) => {
    if (fini) return;
    if (l.startsWith('[Event "')) {
      cloture(); rang++; we = be = 0;
      if (rang > sauter + fenetre) { fini = true; rl.close(); stream.destroy(); }
    } else if (l.startsWith('[WhiteElo "')) we = +l.slice(11, -2) || 0;
    else if (l.startsWith('[BlackElo "')) be = +l.slice(11, -2) || 0;
  });
  rl.on("close", () => {
    if (!fini) cloture();
    console.log(`\n--- Rendement ---`);
    console.log(`  parties brutes de la fenetre : ${fenetre}, passant minElo ${minElo} : ${passent} (${pct(passent, fenetre)})`);
    console.log(`  exercices pour 1 000 parties minees : ${(1000 * ex.length / passent).toFixed(1)}  [projection : ~63]`);
  });
}
