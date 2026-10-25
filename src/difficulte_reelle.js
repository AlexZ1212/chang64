#!/usr/bin/env node
/* Rapport de difficulte reelle (2026-10-25).

   Usage :
     node difficulte_reelle.js                 compteurs lus sur le site
     node difficulte_reelle.js stats.json      compteurs deja telecharges
     node difficulte_reelle.js --min=20        seuil d'essais par exercice

   Lit /api/stats (compteurs anonymes : essais et reussites du premier coup
   par exercice, voir functions/api/resultat.js) et les rapproche de la
   difficulte estimee a la generation (level, diff). Affiche le taux de
   reussite par niveau, puis les exercices dont le taux s'ecarte le plus de
   celui de leur niveau, avec assez d'essais pour que l'ecart ait un sens.
   Ne modifie rien : le recalibrage se decidera sur ce rapport. */
const fs = require("fs");
const path = require("path");
const https = require("https");
const banque = require(path.join(__dirname, "banque.js"));

const ARGS = process.argv.slice(2);
const MIN = +((ARGS.find(a => a.startsWith("--min=")) || "--min=20").split("=")[1]);
const fichier = ARGS.find(a => !a.startsWith("--"));

const lire = () => new Promise((ok, ko) => {
  if (fichier) return ok(JSON.parse(fs.readFileSync(fichier, "utf8")));
  https.get("https://chang64.com/api/stats", r => {
    let s = ""; r.on("data", c => s += c);
    r.on("end", () => { try { ok(JSON.parse(s)); } catch (e) { ko(new Error("reponse illisible (" + r.statusCode + ")")); } });
  }).on("error", ko);
});

(async () => {
  const stats = await lire();
  const parId = new Map(banque.charger().map(p => [p.id, p]));
  const niveaux = {};
  let essais = 0, exercices = 0;
  for (const id in stats) {
    const p = parId.get(id), [e, r] = stats[id];
    if (!p) continue;
    essais += e; exercices++;
    const n = niveaux[p.level] = niveaux[p.level] || { essais: 0, reussites: 0, exercices: 0 };
    n.essais += e; n.reussites += r; n.exercices++;
  }
  console.log(exercices + " exercices joues, " + essais + " essais\n");
  console.log("niveau  exercices  essais  reussite du premier coup");
  for (const l of Object.keys(niveaux).sort((a, b) => a - b)) {
    const n = niveaux[l];
    console.log(String(l).padStart(6) + String(n.exercices).padStart(11) + String(n.essais).padStart(8) + "  " + (100 * n.reussites / n.essais).toFixed(1) + " %");
  }
  const ecarts = [];
  for (const id in stats) {
    const p = parId.get(id), [e, r] = stats[id];
    if (!p || e < MIN) continue;
    const n = niveaux[p.level], attendu = n.reussites / n.essais, vu = r / e;
    ecarts.push({ id, code: p.code, level: p.level, e, vu, ecart: vu - attendu });
  }
  ecarts.sort((a, b) => a.ecart - b.ecart);
  const ligne = x => "  #" + (x.code || x.id) + "  niveau " + x.level + "  " + (100 * x.vu).toFixed(0) + " % sur " + x.e + " essais (" + (x.ecart > 0 ? "+" : "") + (100 * x.ecart).toFixed(0) + " points)";
  console.log("\nAu moins " + MIN + " essais : " + ecarts.length + " exercices");
  if (ecarts.length) {
    console.log("\nPlus durs que leur niveau :"); ecarts.slice(0, 15).forEach(x => console.log(ligne(x)));
    console.log("\nPlus faciles que leur niveau :"); ecarts.slice(-15).reverse().forEach(x => console.log(ligne(x)));
  }
})().catch(e => { console.error("Echec : " + e.message); process.exit(1); });
