#!/usr/bin/env node
/* Retire de la banque les exercices dont le code figure dans un fichier
   texte, un code par ligne.

   Usage :
     node purge_puzzles.js a_retirer.txt --dry
     node purge_puzzles.js a_retirer.txt

   Pourquoi retirer plutot que reparer. Sur les 430 exercices sortis de
   l'audit Stockfish du 2026-09-09, 275 posaient une question impossible --
   la position n'est pas gagnante, meme au meilleur coup -- et 155 avaient
   une solution qui gache une position gagnante, dont 30 qui font mater le
   joueur qui la suit. Les 155 pourraient theoriquement etre reparees en
   substituant le coup du moteur, mais il faudrait recalculer motif et
   explication, et rien ne garantit que le nouveau coup fasse un exercice
   interessant. Pour 155 sur 51 000, avec 89 millions de parties en reserve,
   ca ne vaut pas le risque d'introduire 155 exercices ternes.

   Ce que le script ne fait pas : renumeroter, recalculer les niveaux,
   toucher aux codes restants. Un code affiche a quelqu'un doit continuer de
   designer le meme exercice. build_site.js recalcule le reste.
*/
const fs = require("fs");
const path = require("path");

const dry = process.argv.includes("--dry");
const LISTE = process.argv[2];
if (!LISTE || LISTE.startsWith("--")) {
  console.error("Usage : node purge_puzzles.js <liste_de_codes.txt> [--dry] [--banque=chemin]");
  process.exit(1);
}
const argB = process.argv.find(a => a.startsWith("--banque="));
const BANQUE = argB ? argB.split("=")[1] : path.join(__dirname, "puzzles.json");

const codes = fs.readFileSync(LISTE, "utf8").split("\n").map(s => s.trim()).filter(Boolean);
const aRetirer = new Set(codes);
console.log("Codes lus          :", codes.length, "| uniques :", aRetirer.size);
if (codes.length !== aRetirer.size) console.log("  (des doublons dans la liste, sans consequence)");

const banque = JSON.parse(fs.readFileSync(BANQUE, "utf8"));
console.log("Banque             :", banque.length, "exercices");

const presents = new Set(banque.map(p => p.code));
const introuvables = [...aRetirer].filter(c => !presents.has(c));
/* Un code de la liste absent de la banque veut dire que la liste ne
   correspond pas a ce fichier-ci. On le dit fort, plutot que de retirer
   silencieusement ce qu'on trouve. */
if (introuvables.length) {
  console.log("\nATTENTION :", introuvables.length, "code(s) de la liste sont absents de la banque.");
  console.log("  " + introuvables.slice(0, 20).join(" "));
  console.log("  La liste ne vient peut-etre pas de cette banque. Rien n'a ete ecrit.");
  process.exit(1);
}

const garde = banque.filter(p => !aRetirer.has(p.code));
const retires = banque.filter(p => aRetirer.has(p.code));

const parMotif = {}, parNiveau = {};
for (const p of retires) {
  parMotif[p.theme] = (parMotif[p.theme] || 0) + 1;
  parNiveau[p.level] = (parNiveau[p.level] || 0) + 1;
}
console.log("\nRetires            :", retires.length);
console.log("Restants           :", garde.length);
console.log("\nPar motif :");
for (const [t, n] of Object.entries(parMotif).sort((a, b) => b[1] - a[1]))
  console.log("  " + t.padEnd(18) + String(n).padStart(5));
console.log("Par niveau :");
console.log("  " + Object.keys(parNiveau).sort((a, b) => a - b).map(k => k + ":" + parNiveau[k]).join("  "));

/* Un niveau vide casserait le decoupage de build_site.js. On verifie avant
   d'ecrire, pas apres avoir constate que le site est bancal. */
const resteParNiveau = {};
for (const p of garde) resteParNiveau[p.level] = (resteParNiveau[p.level] || 0) + 1;
const vides = Object.keys(parNiveau).filter(k => !resteParNiveau[k]);
if (vides.length) console.log("\nATTENTION : niveau(x) vides apres retrait :", vides.join(", "));

if (dry) { console.log("\n--dry : rien n'a ete ecrit."); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
fs.copyFileSync(BANQUE, BANQUE.replace(/\.json$/, "." + stamp + ".bak.json"));
/* Les retires sont conserves a part : si on decouvre plus tard qu'un motif
   etait bon, on le retrouve sans rejouer tout l'audit. */
fs.writeFileSync(BANQUE.replace(/\.json$/, ".retires." + stamp + ".json"), JSON.stringify(retires, null, 1));
fs.writeFileSync(BANQUE, JSON.stringify(garde));
console.log("\nEcrit. Sauvegarde et fichier des retires horodates a cote.");
console.log("Enchaine avec : node audit_banque.js && node build_site.js && node run_tests.js");
