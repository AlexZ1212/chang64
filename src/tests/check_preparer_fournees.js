/* Verification automatique de chang64.
   Lancement : node tests/check_preparer_fournees.js   (n'a pas besoin de site/)

   preparer_fournees.js applique deux regles avant toute fusion : aucune
   Winning capture en un coup, et des plafonds sur les mats (Mate in one
   15 000, Mate in two 30 000, Back-rank mate 15 000, banque comprise ; les
   autres motifs entrent en entier). Decision d'Alexandre du 2026-10-24.
   Verifie sur des lots fabriques : la regle des captures, les plafonds
   (banque comprise, jamais negatifs), la repartition sur l'echelle de
   difficulte, la preference pour les parties les mieux classees. */
const path = require("path");
const { preparer, choisir, QUOTAS } = require(path.join(__dirname, "..", "preparer_fournees.js"));
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };

let id = 0;
const exo = (theme, solLen, diff, elo) => ({ id: "x" + (++id), theme, sol: new Array(solLen).fill("e2e4"), diff, source: { elo } });
const lot = (theme, n, solLen) => Array.from({ length: n }, (_, i) => exo(theme, solLen || 1, i % 100, 1800 + (i % 7) * 50));

console.log("\n--- Les regles ---");
T("plafonds annonces", QUOTAS["Mate in one"] === 15000 && QUOTAS["Mate in two"] === 30000 && QUOTAS["Back-rank mate"] === 15000);
let r = preparer(lot("Winning capture", 10, 1).concat(lot("Winning capture", 4, 3)), []);
T("captures en un coup retirees, captures longues gardees", r.capturesRetirees === 10 && r.retenus.length === 4);
r = preparer(lot("Pin", 500), []);
T("motif sans plafond : tout entre", r.retenus.length === 500);
const banque = lot("Mate in one", 14990);
r = preparer(lot("Mate in one", 100), banque);
T("plafond atteint par la banque : seule la place restante (10)", r.retenus.length === 10, r.retenus.length);
r = preparer(lot("Mate in one", 100), lot("Mate in one", 16000));
T("banque au-dela du plafond : rien n'entre, rien n'est retire", r.retenus.length === 0);
r = preparer(lot("Back-rank mate", 20000), []);
T("plafond applique sans banque (15 000)", r.retenus.length === 15000, r.retenus.length);

console.log("\n--- Le choix ---");
const l = Array.from({ length: 1000 }, (_, i) => exo("Mate in two", 3, i, i % 2 ? 2400 : 1800));
const c = choisir(l, 100);
T("le nombre demande", c.length === 100);
const parPalier = Array(10).fill(0);
for (const p of c) parPalier[Math.min(9, Math.floor(p.diff / 100))]++;
T("toute l'echelle de difficulte est representee, 10 par palier", parPalier.every(n => n === 10), parPalier.join(","));
T("les parties les mieux classees d'abord", c.every(p => p.source.elo === 2400));
T("liste plus courte que la demande : tout", choisir(l.slice(0, 5), 100).length === 5);
T("demande nulle : rien", choisir(l, 0).length === 0);

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
