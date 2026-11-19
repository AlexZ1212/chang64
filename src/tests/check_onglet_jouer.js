/* Verification automatique de chang64.
   Lancement : node tests/check_onglet_jouer.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-11-19) : l'onglet « Jouer » unique (jouer.js) et
   la famille de pictogrammes des cartes (pictos_build.js). Quatre onglets
   visibles ; « Jouer » ouvre sur deux cartes, ordinateur et ami, qui menent
   chacune a son ecran ; l'onglet reste allume dans les trois cas ; une partie
   en cours contre l'ordinateur est retrouvee sans repasser par le choix ; les
   anciens points d'entree marchent toujours ; un picto sur chaque carte de
   Resoudre et chaque rubrique d'Explorer ; les epees du menu sont celles des
   fenetres de defi. */
const { ouvrir } = require("./outils/page_langue.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const w = await ouvrir("fr");
  const $ = id => w.document.getElementById(id), cache = id => $(id).classList.contains("hide");
  const allume = id => $(id).getAttribute("aria-current") === "page";

  console.log("La barre");
  const visibles = [...w.document.querySelectorAll("#tabsNav button")].filter(b => !b.hidden).map(b => b.id);
  T("quatre onglets visibles : Jouer, Resoudre, Analyser, Explorer", visibles.join() === "tab-jouer,tab-puzzles,tab-edit,tab-explore", visibles.join());
  T("les deux anciens onglets restent dans la page, masques", $("tab-play").hidden && $("tab-friend").hidden);

  console.log("Le choix");
  $("tab-jouer").click(); await pause(200);
  T("Jouer ouvre le choix, sans echiquier", w.eval("mode") === "jouer" && !cache("pane-jouer") && cache("appLayout"));
  T("l'onglet Jouer est allume, Explorer ne l'est pas", allume("tab-jouer") && !allume("tab-explore") && cache("pane-explore"));
  const titres = [...w.document.querySelectorAll("#pane-jouer .jouer-carte b")].map(b => b.textContent.replace(/[  ]/g, " "));
  T("deux cartes : contre l'ordinateur, contre un ami", titres.join("|") === "Contre l'ordinateur|Contre un ami", titres.join("|"));
  T("chaque carte porte son grand picto", w.document.querySelectorAll("#pane-jouer .picto.grand svg").length === 2 && $("jouerOrdiPicto").innerHTML.length > 200);
  T("le texte de la carte « ami » decrit ce qui est ouvert au public", /lien/.test($("jouerAmiTexte").textContent) && !/pendule/.test($("jouerAmiTexte").textContent));

  console.log("Les deux ecrans");
  $("jouerOrdi").click(); await pause(300);
  T("carte ordinateur : ecran de la partie contre l'ordinateur", w.eval("mode") === "play" && !cache("pane-play") && cache("pane-jouer") && allume("tab-jouer"));
  $("tab-jouer").click(); await pause(200);
  T("sans partie en cours, Jouer revient au choix", w.eval("mode") === "jouer");
  $("jouerAmi").click(); await pause(300);
  T("carte ami : ecran des parties entre amis, onglet Jouer allume", w.eval("mode") === "friend" && !cache("pane-friend") && cache("pane-jouer") && allume("tab-jouer"));
  $("tab-puzzles").click(); await pause(200);
  T("en quittant, l'onglet Jouer s'eteint", !allume("tab-jouer") && allume("tab-puzzles") && cache("pane-jouer"));

  console.log("Partie en cours");
  w.eval("setMode('play',{fresh:true})"); await pause(300);
  w.eval("gameStarted=true;resultInfo=null");
  $("tab-explore").click(); await pause(200);
  $("tab-jouer").click(); await pause(300);
  T("une partie en cours contre l'ordinateur est retrouvee directement", w.eval("mode") === "play" && cache("pane-jouer"));

  console.log("Anciens points d'entree");
  $("tab-friend").click(); await pause(200);
  T("l'ancien onglet des amis marche toujours et allume Jouer", w.eval("mode") === "friend" && allume("tab-jouer"));
  $("brand").click(); await pause(200);
  $("cardFriend").click(); await pause(200);
  T("la carte de l'accueil mene toujours aux parties entre amis", w.eval("mode") === "friend");

  console.log("Pictogrammes");
  $("tab-puzzles").click(); await pause(300);
  const cartes = ["cardSolvePuzzles", "cardSolveDaily", "cardSolveDuel", "cardSolveMistakes", "cardSolveSprint", "cardSolveCoord", "cardSolveEndgames", "cardSolveMotifs"];
  T("un picto sur chacune des huit cartes de Resoudre", cartes.every(id => $(id).querySelectorAll(".picto svg").length === 1), cartes.filter(id => !$(id).querySelector(".picto svg")).join());
  T("le texte des cartes est intact (titre, description, ligne d'etat)", cartes.every(id => $(id).querySelector(".solveCard-texte b") && $(id).querySelector(".solveCard-texte .solveCard-desc") && $(id).querySelector(".solveCard-texte .solveCard-sub")) && !!$("subSolvePuzzles").textContent);
  T("une carte masquee le reste", w.getComputedStyle($("cardSolveMistakes")).display === ($("cardSolveMistakes").classList.contains("hide") ? "none" : "flex"));
  $("tab-explore").click(); await pause(300);
  const liens = [...w.document.querySelectorAll("#exploreLinks a")];
  T("un picto sur chacune des six rubriques d'Explorer", liens.length === 6 && liens.every(a => a.querySelectorAll(".picto.petit svg").length === 1), liens.filter(a => !a.querySelector(".picto svg")).map(a => a.getAttribute("href")).join());
  T("les finales ont le meme dessin dans Resoudre et dans Explorer", $("cardSolveEndgames").querySelector(".picto svg").innerHTML === liens.find(a => /finales/.test(a.getAttribute("href"))).querySelector(".picto svg").innerHTML);
  const menu = w.document.querySelector("[data-vue-defis-membres] svg.tiroir-ico");
  T("menu : les epees croisees des fenetres de defi", !!menu && menu.getAttribute("viewBox") === "-24 -24 48 48" && menu.innerHTML === $("cardSolveDuel").querySelector(".picto svg").innerHTML);
  T("les dessins prennent la couleur du theme, aucune couleur en dur", !/#[0-9a-fA-F]{6}/.test(w.eval("JSON.stringify(PICTOS)")) && /currentColor/.test(w.eval("PICTOS.ami")));

  const dessin = e => e.querySelector(".picto svg").innerHTML;
  T("accueil : les trois cartes portent les pictos de la meme famille", ["icoPlay", "icoPuzzles", "icoFriend"].every(id => $(id).querySelectorAll(".picto svg").length === 1) &&
    dessin($("icoPlay")) === dessin($("jouerOrdiPicto")) && dessin($("icoFriend")) === dessin($("jouerAmiPicto")) && dessin($("icoPuzzles")) === dessin($("cardSolvePuzzles")));

  w.close();
  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception : " + (e && e.stack || e)); process.exit(1); });
