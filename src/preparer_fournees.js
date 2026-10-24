#!/usr/bin/env node
/* Prepare des fournees filtrees pour merge_puzzles.js.

   Usage :
     node preparer_fournees.js <sortie.json> <fournee.retenus.json> [...] [--dry]

   Deux regles d'Alexandre, appliquees avant toute fusion :

   1. Aucune "Winning capture" en un seul coup (regle du 2026-10-18) : une
      prise en un coup n'a pas d'interet pedagogique. Celles a plusieurs
      coups restent.

   2. Quotas sur les mats (decision du 2026-10-24). Les mats faisaient 55 %
      de la banque et des fournees reunies (73 881 mats en deux, 52 322 mats
      en un, 23 234 mats du couloir), et la banque entiere aurait depasse ce
      que GitHub accepte. Plafonds, banque comprise :
        Mate in one 15 000, Mate in two 30 000, Back-rank mate 15 000.
      Un plafond deja atteint par la banque n'ajoute rien, mais ne retire
      aucun exercice deja en ligne (liens partages, progression des joueurs).
      Les autres motifs, plus rares et plus formateurs, entrent en entier.

   Choix des mats retenus : repartis sur toute l'echelle de difficulte
   (dix paliers de "diff", chacun recoit sa part), et dans chaque palier
   ceux des parties les mieux classees d'abord (Elo moyen de la source).

   Rien n'est ecrit avec --dry. Les fournees d'entree ne sont pas modifiees. */
const fs = require("fs");
const path = require("path");
const BQ = require(path.join(__dirname, "banque.js"));

const QUOTAS = { "Mate in one": 15000, "Mate in two": 30000, "Back-rank mate": 15000 };
const PALIERS = 10;

/* Les n meilleurs d'une liste, repartis sur PALIERS paliers de difficulte. */
function choisir(liste, n) {
  if (n <= 0) return [];
  if (liste.length <= n) return liste.slice();
  const tri = liste.slice().sort((a, b) => (a.diff || 0) - (b.diff || 0));
  const paliers = [];
  for (let i = 0; i < PALIERS; i++) paliers.push(tri.slice(Math.floor(i * tri.length / PALIERS), Math.floor((i + 1) * tri.length / PALIERS)));
  const eloDe = p => (p.source && p.source.elo) || 0;
  for (const pal of paliers) pal.sort((a, b) => eloDe(b) - eloDe(a));
  /* Part de chaque palier proportionnelle a sa taille ; le reste des
     arrondis va aux premiers paliers qui ont encore de quoi donner. */
  const parts = paliers.map(pal => Math.floor(n * pal.length / tri.length));
  let reste = n - parts.reduce((s, x) => s + x, 0);
  for (let i = 0; reste > 0; i = (i + 1) % PALIERS) if (parts[i] < paliers[i].length) { parts[i]++; reste--; }
  return paliers.flatMap((pal, i) => pal.slice(0, parts[i]));
}

function preparer(candidats, banque) {
  const sansCapture = candidats.filter(p => !(p.theme === "Winning capture" && p.sol.length === 1));
  const enBanque = {};
  for (const p of banque) enBanque[p.theme] = (enBanque[p.theme] || 0) + 1;
  const parMotif = {};
  for (const p of sansCapture) (parMotif[p.theme] = parMotif[p.theme] || []).push(p);
  const retenus = [], bilan = [];
  for (const [motif, liste] of Object.entries(parMotif)) {
    const q = QUOTAS[motif];
    const place = q == null ? liste.length : Math.max(0, q - (enBanque[motif] || 0));
    const pris = choisir(liste, place);
    retenus.push(...pris);
    bilan.push({ motif, candidats: liste.length, enBanque: enBanque[motif] || 0, quota: q, retenus: pris.length });
  }
  return { retenus, bilan, capturesRetirees: candidats.length - sansCapture.length };
}

module.exports = { preparer, choisir, QUOTAS };

if (require.main === module) {
  const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const DRY = process.argv.includes("--dry");
  const [sortie, ...entrees] = args;
  if (!sortie || !entrees.length) {
    console.error("Usage : node preparer_fournees.js <sortie.json> <fournee.retenus.json> [...] [--dry]");
    process.exit(1);
  }
  let candidats = [];
  for (const f of entrees) candidats = candidats.concat(JSON.parse(fs.readFileSync(f, "utf8")));
  const banque = BQ.charger();
  const { retenus, bilan, capturesRetirees } = preparer(candidats, banque);
  console.log("Fournees            : " + entrees.length + ", " + candidats.length + " exercices");
  console.log("Captures en un coup : " + capturesRetirees + " retirees");
  console.log("\n" + "motif".padEnd(18) + "candidats  en banque   quota  retenus");
  for (const b of bilan.sort((a, b) => b.candidats - a.candidats))
    console.log(b.motif.padEnd(18) + String(b.candidats).padStart(9) + String(b.enBanque).padStart(11) +
      String(b.quota == null ? "-" : b.quota).padStart(8) + String(b.retenus).padStart(9));
  console.log("\nRetenus pour la fusion : " + retenus.length + " (banque actuelle : " + banque.length + ")");
  if (DRY) { console.log("--dry : rien n'est ecrit."); process.exit(0); }
  fs.writeFileSync(sortie, JSON.stringify(retenus));
  console.log("Ecrit : " + sortie + "  ->  node merge_puzzles.js " + sortie);
}
