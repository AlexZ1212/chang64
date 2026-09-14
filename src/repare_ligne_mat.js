#!/usr/bin/env node
/* Reconstruit la ligne des exercices de mat dont la sequence enregistree
   ne fait pas la longueur annoncee.

   Usage :
     node repare_ligne_mat.js --dry
     node repare_ligne_mat.js

   POURQUOI.
   audit_banque.js exige qu'un mat en n porte exactement 2n-1 demi-coups :
   nous, l'adversaire, nous, et ainsi de suite. Un exercice qui n'en a que 3
   pour n=3 s'arrete apres une defense qui n'est pas la meilleure : la
   position finale mate bien, mais seulement parce que l'adversaire a mal
   joue. Le joueur qui trouve le bon premier coup voit alors l'adversaire
   repondre autre chose que ce qui est enregistre, et la suite ne colle plus.

   COMMENT LA LIGNE EST RECONSTRUITE.
   Nos coups viennent de mateIn(), qui rend un coup matant en n. La replique
   adverse, elle, n'est PAS tiree d'une recherche : on essaie toutes les
   reponses legales et on garde celle qui resiste le plus longtemps, c'est-a-
   dire celle dont le mat le plus court reste le plus lointain. C'est exact et
   deterministe, la ou une recherche a budget limite peut preferer un coup qui
   se fait mater plus vite et raccourcir artificiellement la ligne. La
   difference compte precisement dans les positions comme celle-ci, ou une
   defense faible fait tomber le mat un coup plus tot.

   La longueur annoncee elle-meme est recalculee plutot que crue : si un
   exercice dit "mat en 3" alors qu'il mate en 2, c'est n qui a tort, pas la
   ligne. Le motif suit, et le niveau avec lui, lu dans la banque pour ne pas
   pouvoir diverger.

   Rien n'est ecrit sans que la ligne reconstruite ait ete rejouee et
   verifiee : chaque coup legal, position finale matee, longueur exacte. Un
   exercice qui ne passe pas ce controle est laisse tel quel et signale, pas
   repare de travers.
*/
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Game, mateIn } = require(path.join(__dirname, "engine.js"));
const { puzzleCode } = require(path.join(__dirname, "gen_puzzles.js"));

/* Meme derivation que merge_puzzles.js : le code SORT du contenu. Reparer la
   ligne change donc le code, et c'est inevitable -- garder l'ancien
   reviendrait a laisser dans la banque un code qui ne derive plus de rien, ce
   que check_banque_exercices.js refuse a juste titre. Le changement est
   annonce a l'ecran pour qu'un signalement recu sous l'ancien code reste
   retrouvable. */
function codeDerive(p, pris) {
  for (let n = 0; n <= 20; n++) {
    const c = n === 0 ? puzzleCode(p.fen, p.sol)
      : (crypto.createHash("sha256").update(p.fen + "|" + p.sol.join(" ") + "|" + n)
        .digest().readUInt32BE(0) % Math.pow(36, 5)).toString(36).toUpperCase().padStart(5, "0");
    if (!pris.has(c)) return c;
  }
  return null;
}

const DRY = process.argv.includes("--dry");
const BANQUE = path.join(__dirname, "puzzles.json");
const MAX_N = 6;

const NOM_MOTIF = { 1: "Mate in one", 2: "Mate in two", 3: "Mate in three" };

/* Plus court mat trouvable depuis cette position, ou 0. */
function longueurDeMat(g) {
  for (let n = 1; n <= MAX_N; n++) if (mateIn(new Game(g.fen()), n)) return n;
  return 0;
}
/* Reponse adverse qui resiste le plus longtemps. */
function meilleureDefense(g) {
  let best = null, mieux = -1;
  for (const mv of g.moves()) {
    const c = new Game(g.fen());
    const full = c.moves().find(m => m.from === mv.from && m.to === mv.to && m.promo === mv.promo);
    if (!full) continue;
    c.makeMove(full);
    if (c.moves().length === 0) continue;          /* mat ou pat immediat : pas une defense */
    const l = longueurDeMat(c) || MAX_N + 1;       /* pas de mat trouve : resistance maximale */
    if (l > mieux) { mieux = l; best = mv; }
  }
  return best;
}

function reconstruire(p) {
  const g0 = new Game(p.fen);
  const n = longueurDeMat(g0);
  if (!n) return { erreur: "aucun mat trouve jusqu'a " + MAX_N };
  const g = new Game(p.fen);
  const uci = [];
  for (let i = 0; i < n; i++) {
    const m = mateIn(new Game(g.fen()), n - i);
    if (!m) return { erreur: "mateIn muet au demi-coup " + (2 * i + 1) };
    const full = g.moves().find(x => x.from === m.from && x.to === m.to && x.promo === m.promo);
    if (!full) return { erreur: "coup de mateIn introuvable" };
    uci.push(g.uci(full));
    g.makeMove(full);
    if (g.moves().length === 0) break;
    const d = meilleureDefense(g);
    if (!d) return { erreur: "aucune defense legale" };
    const dFull = g.moves().find(x => x.from === d.from && x.to === d.to && x.promo === d.promo);
    uci.push(g.uci(dFull));
    g.makeMove(dFull);
  }
  if (!(g.moves().length === 0 && g.inCheck())) return { erreur: "la ligne reconstruite ne mate pas" };
  if (uci.length !== 2 * n - 1) return { erreur: "longueur " + uci.length + " pour n=" + n };
  return { n: n, sol: uci };
}

const banque = JSON.parse(fs.readFileSync(BANQUE, "utf8"));
/* Le niveau d'un motif est lu dans la banque, jamais ecrit ici. */
const niveauDuMotif = {};
for (const p of banque) if (p.theme && p.level) niveauDuMotif[p.theme] = p.level;
const codes = new Set(banque.map(p => p.code).filter(Boolean));

const casses = banque.filter(p => p.type === "mate" && p.sol.length !== 2 * (p.n || 0) - 1);
console.log("Banque              :", banque.length, "exercices");
console.log("Mats incoherents    :", casses.length);

let repares = 0, echecs = 0;
for (const p of casses) {
  const r = reconstruire(p);
  if (r.erreur) {
    echecs++;
    console.log("  ECHEC #" + p.code + " : " + r.erreur + "  (laisse tel quel)");
    continue;
  }
  const motif = NOM_MOTIF[r.n] || p.theme;
  const avant = p.sol.length + " demi-coups pour n=" + p.n + " (" + p.theme + ")";
  const apres = r.sol.length + " pour n=" + r.n + " (" + motif + ")";
  console.log("  #" + p.code + " : " + avant + "  ->  " + apres);
  console.log("      " + p.sol.join(" ") + "  ->  " + r.sol.join(" "));
  if (!DRY) {
    p.sol = r.sol;
    p.n = r.n;
    if (motif !== p.theme) {
      p.theme = motif;
      if (niveauDuMotif[motif]) p.level = niveauDuMotif[motif];
    }
    const ancien = p.code;
    codes.delete(ancien);
    const neuf = codeDerive(p, codes);
    if (neuf) {
      p.code = neuf;
      codes.add(neuf);
      if (neuf !== ancien) console.log("      code : #" + ancien + "  ->  #" + neuf);
    } else {
      codes.add(ancien);
      console.log("      code : #" + ancien + " conserve (aucune derivation libre)");
    }
  }
  repares++;
}

console.log("\nReparables          :", repares);
console.log("Laisses tels quels  :", echecs);
if (DRY) { console.log("\n--dry : puzzles.json n'a pas ete touche."); process.exit(0); }
if (repares) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  fs.copyFileSync(BANQUE, BANQUE.replace(/\.json$/, "." + stamp + ".bak.json"));
  fs.writeFileSync(BANQUE, JSON.stringify(banque));
  console.log("puzzles.json reecrit, sauvegarde horodatee a cote.");
  console.log("Ensuite : node audit_banque.js && node build_site.js && node run_tests.js");
} else console.log("Rien a ecrire.");
