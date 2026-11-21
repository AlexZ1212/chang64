/* Verification automatique de chang64.
   Lancement : node tests/check_reglages_rapides.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Reglages rapides pendant une partie (2026-11-21, constat d'Alexandre) :
   une roue dentee sous l'echiquier ouvre un panneau par-dessus la partie
   (theme, couleurs de l'echiquier, animations, sons), appliques tout de
   suite ; croix, Echap ou appui a cote le referment ; la partie continue.
   Ce sont les blocs des Preferences eux-memes qui y sont deplaces, pas une
   copie : ils doivent revenir a leur place, dans l'ordre, a la fermeture. */
const { ouvrir } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const net = x => String(x).replace(/\s+/g, " ").trim();

(async () => {
  const w = await ouvrir("fr", { attente: 2200 });
  const d = w.document, $ = id => d.getElementById(id);
  const BLOCS = ["themeChoix", "boardThemes", "segAnim", "segSon"];
  /* L'ordre des blocs des Preferences, lu par l'identifiant de leur premier element connu. */
  const ordre = () => [...d.querySelectorAll("#pane-prefs .field")].map(f => (f.querySelector("[id]") || {}).id || "?").join(",");
  const dans = (id, conteneur) => !!$(id) && $(conteneur).contains($(id));
  w.eval("setMode('prefs')"); await attendre(150);
  const ordreAvant = ordre();
  w.eval("setMode('play')"); await attendre(200);
  $("btnNew").click(); await attendre(450);
  if (!$("readyBanner").classList.contains("hide")) { $("readyStart").click(); await attendre(350); }
  const fen = w.eval("game.fen()");
  const roue = $("btnReglages"), feuille = $("reglagesRapides");
  T("une roue dentee sous l'echiquier, nommee pour les lecteurs d'ecran", !!roue && roue.closest("#boardTools") !== null && net(roue.getAttribute("aria-label")) === "Réglages rapides", roue && roue.getAttribute("aria-label"));
  T("la feuille est fermee au depart", feuille.hidden === true && w.eval("rrOuvert()") === false);

  console.log("--- Ouverture pendant la partie ---");
  roue.focus(); roue.click(); await attendre(100);
  T("la feuille s'ouvre par-dessus la partie", !feuille.hidden && feuille.getAttribute("role") === "dialog" && feuille.getAttribute("aria-modal") === "true" && w.eval("mode") === "play");
  T("elle porte un titre et une croix", net($("rrTitre").textContent) === "Réglages rapides" && net($("rrFermer").getAttribute("aria-label")) === "Fermer");
  T("theme, couleurs de l'echiquier, animations et sons y sont", BLOCS.every(id => dans(id, "rrCorps")), BLOCS.filter(id => !dans(id, "rrCorps")).join());
  T("ce sont les blocs des Preferences, deplaces : il n'y en a pas deux", BLOCS.every(id => d.querySelectorAll("#" + id).length === 1) && BLOCS.every(id => !dans(id, "pane-prefs")));
  T("le focus est dans la feuille", feuille.contains(d.activeElement));
  T("la partie continue dessous : meme position, toujours en cours", w.eval("game.fen()") === fen && w.eval("gameStarted") === true && w.eval("resultInfo") === null);

  console.log("--- Reglages appliques tout de suite ---");
  d.querySelector('#segSon [data-v="off"]').click(); await attendre(50);
  T("couper les sons : c'est fait aussitot", w.eval("sonOn") === false && d.querySelector('#segSon [data-v="off"]').getAttribute("aria-checked") === "true");
  d.querySelector('#segSon [data-v="on"]').click(); await attendre(50);
  d.querySelector('#segAnim [data-v="off"]').click(); await attendre(50);
  T("couper les animations : c'est fait aussitot", w.eval("animOn") === false && d.documentElement.dataset.mouvement === "calme", d.documentElement.dataset.mouvement);
  d.querySelector('#segAnim [data-v="on"]').click(); await attendre(50);
  const avantDamier = w.eval("prefBoard");
  const autre = [...d.querySelectorAll("#boardThemes button")].find(b => b.getAttribute("aria-checked") !== "true");
  autre.click(); await attendre(80);
  T("changer les couleurs de l'echiquier : c'est fait aussitot", w.eval("prefBoard") !== avantDamier && dans("boardThemes", "rrCorps"), w.eval("prefBoard"));
  T("les blocs restent dans la feuille apres un changement", BLOCS.every(id => dans(id, "rrCorps")));

  /* Les raccourcis clavier de la partie ne passent pas sous la feuille. */
  w.eval("gotoPly&&0");
  const plyAvant = w.eval("reviewPly");
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "?", bubbles: true, cancelable: true }));
  await attendre(80);
  T("fleches et « ? » n'agissent pas derriere la feuille", w.eval("reviewPly") === plyAvant && w.eval("fenetreOuverte()") === true && !feuille.hidden && $("duel").hidden === true);

  console.log("--- Fermeture ---");
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  await attendre(80);
  T("Echap referme la feuille et rend le focus a la roue dentee", feuille.hidden && d.activeElement === roue);
  T("les blocs sont revenus dans les Preferences, dans le meme ordre", BLOCS.every(id => dans(id, "pane-prefs")) && $("rrCorps").children.length === 0 && ordre() === ordreAvant, ordre() + " / " + ordreAvant);
  T("la partie n'a pas bouge", w.eval("mode") === "play" && w.eval("game.fen()") === fen && w.eval("gameStarted") === true);
  roue.click(); await attendre(80);
  feuille.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await attendre(80);
  T("un appui a cote de la feuille la referme", feuille.hidden);
  roue.click(); await attendre(80);
  d.querySelector(".rr-feuille").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  T("un appui dans la feuille ne la referme pas", !feuille.hidden);
  $("rrFermer").click(); await attendre(80);
  T("la croix la referme", feuille.hidden);
  roue.click(); await attendre(80);
  w.eval("setMode('prefs')"); await attendre(150);
  T("aller aux Preferences la referme : les blocs y sont a leur place", feuille.hidden && BLOCS.every(id => dans(id, "pane-prefs")) && ordre() === ordreAvant);
  w.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
