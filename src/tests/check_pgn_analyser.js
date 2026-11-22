/* Verification automatique de chang64.
   Lancement : node tests/check_pgn_analyser.js
   Le site doit avoir ete construit au prealable : node build_site.js

   « Charger un PGN » et l'import Lichess etaient en bas de l'ecran Jouer
   contre l'ordinateur. Decision d'Alexandre du 2026-11-22 : charger une
   partie sert a la relire, c'est de l'analyse. Les deux champs sont dans
   Analyser ; Jouer ne garde que l'export de la partie qu'on vient de jouer.
   Une partie chargee depuis Analyser s'ouvre dans l'ecran de revue. */
const { ouvrir } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const net = x => String(x).replace(/\s+/g, " ").trim();

(async () => {
  const w = await ouvrir("fr", { attente: 2200 });
  const d = w.document, $ = id => d.getElementById(id), cache = id => $(id).classList.contains("hide");
  const dans = (id, conteneur) => !!$(id) && $(conteneur).contains($(id));

  console.log("--- Ou sont les champs ---");
  T("le champ du PGN, son bouton et son message sont dans Analyser", ["pgnIn", "btnPgnLoad", "pgnMsg"].every(id => dans(id, "pane-edit") && dans(id, "pgnImportPanel")));
  T("l'import Lichess aussi", ["lichessIn", "btnLichess", "lichessMsg", "lichessGames"].every(id => dans(id, "pgnImportPanel")));
  T("ils ne sont plus dans l'ecran Jouer", ["pgnIn", "btnPgnLoad", "lichessIn", "btnLichess"].every(id => !dans(id, "pane-play")));
  T("un seul exemplaire de chaque", ["pgnIn", "btnPgnLoad", "lichessIn", "btnLichess", "pgnMsg"].every(id => d.querySelectorAll("#" + id).length === 1));
  T("le bloc a son titre et son explication du PGN", net($("pgnImportPanel").querySelector(".eyebrow").firstChild.textContent) === "Charger une partie" && /format standard de notation/.test(net($("tipPgnImport").textContent)), net($("pgnImportPanel").querySelector(".eyebrow").textContent));
  T("Jouer garde l'export : copier, telecharger, et leur message", ["btnPgnCopy", "btnPgnDownload", "pgnExportMsg"].every(id => dans(id, "pgnPanel")) && dans("pgnPanel", "pane-play"));

  console.log("--- Ecran des reglages de Jouer, avant toute partie ---");
  w.eval("setMode('play')"); await attendre(200);
  T("sans coup a exporter, le bloc PGN de Jouer ne se montre pas", cache("pgnPanel"));

  console.log("--- Charger une partie depuis Analyser ---");
  w.eval("setMode('edit')"); await attendre(200);
  T("dans Analyser, le bloc est a l'ecran", w.eval("mode") === "edit" && !cache("pane-edit"));
  $("pgnIn").value = "";
  $("btnPgnLoad").click(); await attendre(80);
  T("champ vide : un message, on reste dans Analyser", w.eval("mode") === "edit" && /Aucun coup/.test(net($("pgnMsg").textContent)), $("pgnMsg").textContent);
  $("pgnIn").value = "1. Zz9 e5";
  $("btnPgnLoad").click(); await attendre(80);
  T("PGN illisible : un message, on reste dans Analyser", w.eval("mode") === "edit" && /illisible/.test(net($("pgnMsg").textContent)), $("pgnMsg").textContent);
  $("pgnIn").value = "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6";
  $("btnPgnLoad").click(); await attendre(300);
  T("PGN valide : la partie s'ouvre dans l'ecran de revue", w.eval("mode") === "play" && w.eval("isReviewGame") === true && w.eval("game.history.length") === 6 && w.eval("sanList.join(' ')") === "e4 e5 Nf3 Nc6 Bb5 a6", w.eval("mode") + " " + w.eval("game.history.length"));
  T("l'echiquier et le bandeau de coups sont a l'ecran", !d.querySelector(".board-wrap").classList.contains("hide") && !cache("boardTools") && !cache("navRow") && !cache("pane-play") && cache("pane-edit"));
  T("l'onglet Analyser reste allume", $("tab-edit").getAttribute("aria-selected") === "true" || $("tab-edit").classList.contains("on") || $("tab-edit").getAttribute("aria-current") === "page" || $("tab-edit").getAttribute("aria-pressed") === "true", $("tab-edit").outerHTML.slice(0, 160));
  T("la revue est proposee, les reglages de partie sont masques", !cache("reviewPanel") && cache("settingsPanel"));
  T("la partie chargee peut etre exportee depuis Jouer", !cache("pgnPanel") && !cache("pgnExportRow"));
  $("btnPgnCopy").click(); await attendre(50);
  T("« Copier le PGN » repond sous ses boutons", /PGN copié/.test(net($("pgnExportMsg").textContent)), $("pgnExportMsg").textContent);
  w.eval("gotoPly(2)");
  T("on peut parcourir la partie chargee", w.eval("reviewPly") === 2);

  console.log("--- Retour dans Analyser ---");
  w.eval("setMode('edit')"); await attendre(200);
  T("Analyser se rouvre, avec son editeur et le bloc de chargement", w.eval("mode") === "edit" && !cache("pane-edit") && dans("pgnIn", "pane-edit"));
  w.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
