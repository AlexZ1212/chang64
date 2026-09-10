#!/usr/bin/env node
/* Repasse classifyBase() sur la banque DEJA en place et aligne motif et
   explication.

   Usage :
     node reclass_puzzles.js --dry
     node reclass_puzzles.js --dry --seulement=Knight fork,Pawn fork,Double attack
     node reclass_puzzles.js

   Pourquoi ce script existe. merge_puzzles.js reclassifie ce qui ENTRE,
   jamais ce qui est deja la. Le classificateur evolue, donc la banque se
   stratifie en silence : des exercices produits en aout portent une
   etiquette que le code d'aujourd'hui ne leur donnerait plus. Rien ne le
   signale, et la section "Par motif" affiche des volumes qui melangent les
   deux epoques.

   Ce que ce script ne fait PAS, volontairement :

   - il ne touche ni aux identifiants ni aux codes. Les codes sont affiches
     aux gens ("#TAUXL", pour signaler un probleme) et quelqu'un a pu en
     noter un ;
   - il ne touche pas a `level`. build_site.js le recalcule depuis BANDES a
     chaque construction, l'ecrire ici serait un doublon qui pourrait
     diverger ;
   - il ne retire aucun exercice. Un exercice mal etiquete reste un exercice
     valable : la position, la solution et sa verification ne changent pas.
     Il COMPTE ceux qui ne passent plus verifyFull() et les nomme, sans
     decider a ta place ;
   - il ne touche pas aux motifs que classifyBase() ne sait pas produire.
     Deflection et Quiet move sortent de classifyQuiet(), qui a besoin d'une
     lignee de plusieurs coups. Les passer a classifyBase les ferait tous
     retomber en "Winning move" : 489 exercices effaces d'un motif, sans une
     erreur. C'est le garde-fou le plus important du fichier.

   Le motif et l'explication sont toujours ecrits ENSEMBLE, depuis le meme
   appel. Les separer est precisement le defaut corrige dans merge_puzzles.js
   le 2026-09-09 : un motif neuf avec une explication d'avant produit une
   phrase vide, en silence.
*/
const fs = require("fs");
const path = require("path");
const { Game } = require(path.join(__dirname, "engine.js"));
const { classifyBase, verifyFull } = require(path.join(__dirname, "gen_puzzles_v2.js"));

const BANQUE = path.join(__dirname, "puzzles.json");
const dry = process.argv.includes("--dry");

/* Motifs produits par classifyQuiet() et non par classifyBase(). Cette liste
   est la seule chose qui empeche le script de les detruire. */
const HORS_PORTEE = new Set(["Deflection", "Quiet move"]);

const argSeul = process.argv.find(a => a.startsWith("--seulement="));
const seulement = argSeul
  ? new Set(argSeul.slice("--seulement=".length).split(",").map(s => s.trim()).filter(Boolean))
  : null;

const banque = JSON.parse(fs.readFileSync(BANQUE, "utf8"));
console.log("Banque             :", banque.length, "exercices");
if (seulement) console.log("Portee limitee a   :", [...seulement].join(", "));

if (!dry) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const copie = BANQUE.replace(/\.json$/, "." + stamp + ".bak.json");
  fs.copyFileSync(BANQUE, copie);
  console.log("Sauvegarde         :", path.basename(copie));
}

const avant = {};
for (const p of banque) avant[p.theme] = (avant[p.theme] || 0) + 1;

const compte = {
  intacts: 0, motifChange: 0, explicationSeule: 0,
  protege: 0, horsPortee: 0, illisible: 0
};
const flux = {};
const illisibles = [], verifKo = [];

for (const p of banque) {
  if (HORS_PORTEE.has(p.theme)) { compte.protege++; continue; }
  if (seulement && !seulement.has(p.theme)) { compte.horsPortee++; continue; }

  let r = null;
  try {
    const g = new Game(p.fen);
    const mv = g.moves().find(m => g.uci(m) === p.sol[0]);
    if (mv) r = classifyBase(g, mv, p.type === "mate", p.n || 0);
  } catch (e) { /* signale juste apres */ }

  /* Position ou coup illisible : on laisse l'exercice STRICTEMENT tel quel.
     Ecraser son motif par un defaut serait remplacer une etiquette peut-etre
     juste par une etiquette surement fausse. */
  if (!r || !r.theme) { compte.illisible++; if (illisibles.length < 20) illisibles.push(p.code); continue; }

  if (!verifyFull(p) && verifKo.length < 20) verifKo.push(p.code);

  const memeMotif = r.theme === p.theme;
  const memeDetail = JSON.stringify(p.explain || {}) === JSON.stringify(r.detail || {});
  if (memeMotif && memeDetail) { compte.intacts++; continue; }

  if (!memeMotif) {
    compte.motifChange++;
    const k = p.theme + " -> " + r.theme;
    flux[k] = (flux[k] || 0) + 1;
  } else {
    compte.explicationSeule++;
  }
  p.theme = r.theme;
  p.explain = r.detail || {};
}

const apres = {};
for (const p of banque) apres[p.theme] = (apres[p.theme] || 0) + 1;

console.log("\n--- Ce qui a ete fait ---");
console.log("  inchanges                  :", compte.intacts);
console.log("  motif ET explication revus :", compte.motifChange);
console.log("  explication seule revue    :", compte.explicationSeule);
console.log("  proteges (classifyQuiet)   :", compte.protege);
if (seulement) console.log("  hors de la portee demandee :", compte.horsPortee);
console.log("  position ou coup illisible :", compte.illisible,
  illisibles.length ? "(" + illisibles.join(" ") + ")" : "");

if (compte.motifChange) {
  console.log("\n--- Deplacements ---");
  for (const [k, v] of Object.entries(flux).sort((a, b) => b[1] - a[1]))
    console.log("  " + String(v).padStart(6) + "  " + k);
}

console.log("\n--- Motifs, avant et apres ---");
const motifs = [...new Set([...Object.keys(avant), ...Object.keys(apres)])].sort();
for (const th of motifs) {
  const a = avant[th] || 0, b = apres[th] || 0, d = b - a;
  console.log("  " + th.padEnd(18) + String(a).padStart(6) + " -> " + String(b).padStart(6) +
    (d ? "   " + (d > 0 ? "+" : "") + d : ""));
}

/* Signale sans agir : un exercice qui ne passe plus la verification est une
   decision a prendre, pas une reparation a faire en passant. */
if (verifKo.length) {
  console.log("\nATTENTION verifyFull() en echec sur au moins " + verifKo.length +
    " exercice(s) : " + verifKo.join(" "));
  console.log("  Ils ne sont ni modifies ni retires. A regarder a part.");
}

/* Un motif que build_site.js ne connait pas atterrit au niveau 10 sans rien
   dire. On le dit ici, avant que ca arrive. */
const CONNUS = new Set(["Winning capture", "Mate in one", "Knight fork", "Pawn fork",
  "Pin", "Skewer", "Deflection", "Double attack", "Winning move", "Quiet move",
  "Mate in two", "Mate in three", "Back-rank mate", "Smothered mate"]);
const inconnus = motifs.filter(t => (apres[t] || 0) > 0 && !CONNUS.has(t));
if (inconnus.length) console.log("\nATTENTION motifs non declares dans BANDES :", inconnus.join(", "));

if (dry) {
  console.log("\n--dry : rien n'a ete ecrit.");
} else {
  fs.writeFileSync(BANQUE, JSON.stringify(banque));
  console.log("\nEcrit :", path.basename(BANQUE));
  console.log("Enchaine avec : node build_site.js && node run_tests.js");
}
