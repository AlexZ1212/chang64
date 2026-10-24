/* Verification automatique de chang64.
   Lancement : node tests/check_banque_decoupee.js   (n'a pas besoin de site/)

   2026-10-24 : la banque est decoupee en tranches de 25 000 identifiants
   (banque/, via banque.js). Un seul puzzles.json aurait depasse 100 Mo apres
   la fusion de fin de minage, et GitHub refuse les fichiers de cette
   taille.
   Verifie : chaque tranche reste loin de la limite ; chaque exercice est
   dans la bonne tranche, sans doublon ; un exercice par ligne ; l'ecriture
   ne touche que les tranches qui changent ; plus aucun script ne lit
   l'ancien puzzles.json. */
const fs = require("fs");
const path = require("path");
const os = require("os");
const SRC = path.join(__dirname, "..");
const BQ = require(path.join(SRC, "banque.js"));
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };

console.log("\n--- Les tranches ---");
const fichiers = fs.readdirSync(BQ.DOSSIER).filter(f => /^tranche-\d{3}\.json$/.test(f)).sort();
T("au moins une tranche", fichiers.length > 0, fichiers.length);
/* GitHub avertit a 50 Mo et refuse a 100 Mo. */
const tailles = fichiers.map(f => fs.statSync(path.join(BQ.DOSSIER, f)).size);
T("chaque tranche sous 50 Mo (plus grosse : " + (Math.max(...tailles) / 1e6).toFixed(1) + " Mo)", Math.max(...tailles) < 50e6);
let malRanges = [], lignesKo = [];
for (const f of fichiers) {
  const texte = fs.readFileSync(path.join(BQ.DOSSIER, f), "utf8");
  const lot = JSON.parse(texte);
  const k = +f.slice(8, 11);
  for (const p of lot) if (BQ.trancheDe(p) !== k) malRanges.push(p.id + " dans " + f);
  if (texte.split("\n").length !== lot.length + 3) lignesKo.push(f);
}
T("chaque exercice dans la tranche de son identifiant", !malRanges.length, malRanges.slice(0, 3).join(" "));
T("un exercice par ligne", !lignesKo.length, lignesKo.join(" "));
const tout = BQ.charger();
T("aucun identifiant en double", new Set(tout.map(p => p.id)).size === tout.length);
T("ordre croissant des identifiants", tout.every((p, i) => !i || +p.id.slice(1) > +tout[i - 1].id.slice(1)));

console.log("\n--- Ecriture ---");
/* Sur une copie : reecrire la banque telle quelle ne touche aucune tranche,
   et modifier un exercice ne touche que la sienne. */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "chang64-banque-"));
const copieBQ = path.join(tmp, "banque.js");
fs.copyFileSync(path.join(SRC, "banque.js"), copieBQ);
fs.mkdirSync(path.join(tmp, "banque"));
for (const f of fichiers) fs.copyFileSync(path.join(BQ.DOSSIER, f), path.join(tmp, "banque", f));
const BQ2 = require(copieBQ);
T("reecrire la banque inchangee ne touche aucune tranche", BQ2.ecrire(BQ2.charger()).length === 0);
const l = BQ2.charger(); l[0] = Object.assign({}, l[0], { diff: (l[0].diff || 0) + 1 });
const ecrits = BQ2.ecrire(l);
T("modifier un exercice ne reecrit que sa tranche", ecrits.length === 1 && ecrits[0].endsWith(fichiers[0]), ecrits.join(" "));
fs.rmSync(tmp, { recursive: true, force: true });

console.log("\n--- Plus de puzzles.json ---");
T("src/puzzles.json n'existe plus", !fs.existsSync(path.join(SRC, "puzzles.json")));
const lecteurs = [];
const scripts = fs.readdirSync(SRC).filter(f => f.endsWith(".js") && f !== "mine_puzzles.avant-2026-10-17.js").map(f => path.join(SRC, f))
  .concat(fs.readdirSync(__dirname).filter(f => f.endsWith(".js")).map(f => path.join(__dirname, f)));
for (const f of scripts) {
  /* Le code seul, sans les commentaires qui racontent l'histoire. */
  const code = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  if (/["'`]puzzles\.json["'`]/.test(code) && path.basename(f) !== "check_banque_decoupee.js") lecteurs.push(path.basename(f));
}
T("aucun script ne lit l'ancien puzzles.json", !lecteurs.length, lecteurs.join(" "));

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
