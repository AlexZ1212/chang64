/* Verification automatique de chang64.
   Lancement : node tests/check_partage_du_jour.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Partage du resultat de l'exercice du jour (2026-11-07, demande
   d'Alexandre : les carres verts et jaunes etaient "pas beaux"). Verifie :
     - la note en etoiles : 3 sans aide, 2 avec une aide, 1 au-dela ;
     - le detail en symboles (❌ erreurs, 💡 indices), la phrase "sans aide" ;
     - la difficulte sur 7 points, selon le jour de la semaine ;
     - un indice redemande sur le meme coup ne compte qu'une fois ;
     - plus aucun carre de couleur ;
     - les deux nouvelles phrases dans chaque langue. */
const PATH = require("path");
const { ouvrir } = require("./outils/page_langue.js");
const { LANGUES } = require("../langues/registre.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log("\n--- Texte partage (anglais) ---");
  const w = await ouvrir("en", { fetch: true, attente: 2400 });
  /* Le bouton de partage n'existe qu'une fois l'exercice du jour charge
     (registre des jours compris) : on l'ouvre d'abord. */
  w.eval("setMode('puzzles');showSolveScreen('daily')"); await attendre(2500);
  T("exercice du jour charge", w.eval("!!(puzzle&&puzzle.daily)"));
  const texte = (f, i) => w.eval("fautesExo=" + f + ";indicesExo=" + i + ";texteResultatDuJour()");
  const lignes = texte(0, 0).split("\n");
  T("titre avec l'elephant", lignes[0].startsWith("\u{1F418} chang64 · Puzzle of the day · "), lignes[0]);
  T("sans aide : trois etoiles et la phrase", lignes[1] === "⭐⭐⭐  solved without help", lignes[1]);
  T("une erreur : deux etoiles", texte(1, 0).split("\n")[1] === "⭐⭐☆  ❌ 1", texte(1, 0).split("\n")[1]);
  T("un indice : deux etoiles", texte(0, 1).split("\n")[1] === "⭐⭐☆  \u{1F4A1} 1", texte(0, 1).split("\n")[1]);
  T("une erreur et deux indices : une etoile", texte(1, 2).split("\n")[1] === "⭐☆☆  ❌ 1  \u{1F4A1} 2", texte(1, 2).split("\n")[1]);
  const jour = new Date().getDay() || 7;
  T("difficulte du jour sur 7 points (" + jour + "/7)", lignes[2] === "Difficulty " + "●".repeat(jour) + "○".repeat(7 - jour), lignes[2]);
  T("le lien mene a l'exercice du jour", /^https:\/\/chang64\.com\/#puzzle=p\d+$/.test(lignes[3]), lignes[3]);
  T("plus de carres de couleur", !/[\u{1F7E9}\u{1F7E8}]/u.test(texte(1, 1)));

  console.log("\n--- Indices comptes une fois par coup ---");
  w.eval("showSolveScreen('menu');showSolveScreen('daily')"); await attendre(2500);
  T("rien de compte au depart", w.eval("fautesExo+indicesExo") === 0, w.eval("fautesExo+','+indicesExo"));
  w.eval("hintPuzzle()"); w.eval("hintPuzzle()");
  T("deux demandes sur le meme coup : un seul indice", w.eval("indicesExo") === 1, w.eval("indicesExo"));
  w.close();

  console.log("\n--- Phrases traduites ---");
  for (const l of LANGUES.filter(x => x.code !== "en")) {
    const D = require(PATH.join(__dirname, "..", "langues", l.code, "app.js"));
    T(l.code + " : sans aide, difficulte", typeof D["solved without help"] === "string" && typeof D["Difficulty"] === "string"
      && D["solved without help"] !== "solved without help" && D["Difficulty"] !== "Difficulty");
  }
  const wf = await ouvrir("fr", { fetch: true, attente: 2400 });
  wf.eval("setMode('puzzles');showSolveScreen('daily')"); await attendre(2500);
  const fr = wf.eval("fautesExo=0;indicesExo=0;texteResultatDuJour()").replace(/ /g, " ").split("\n");
  T("fr : resolu sans aide", fr[1] === "⭐⭐⭐  résolu sans aide", fr[1]);
  T("fr : Difficulte", fr[2].startsWith("Difficulté ●"), fr[2]);
  wf.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + e.stack); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
