/* Verification automatique de chang64.
   Lancement : node tests/check_import_pgn.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-11-21) : une partie importee en PGN depuis
   l'ecran des reglages de Jouer, AVANT toute partie, s'affiche. Le message
   disait « N demi-coups charges. Parcours-les avec les fleches » alors que
   l'echiquier restait masque : l'import ne declarait pas de partie a l'ecran.
   - l'echiquier, le bandeau de coups et la feuille de partie sont la ;
   - les deux camps sont nommes par leur couleur, pas « Toi » ni l'ordinateur ;
   - rien de la partie precedente ne s'y mele (abandon, carte de fin) ;
   - une partie finie par un mat ne rejoue pas sa carte de fin en relecture ;
   - elle se parcourt aux fleches et s'analyse ;
   - elle n'entre pas dans « Tes parties ». */
const { ouvrir } = require("./outils/page_langue.js");
const { presser } = require("./outils/touches.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));
const jusqua = async (cond, max) => { const fin = Date.now() + max; while (Date.now() < fin) { if (cond()) return true; await pause(100); } return cond(); };
const propre = s => String(s).replace(/[  ]/g, " ");

(async () => {
  const w = await ouvrir("fr");
  const d = w.document, $ = id => d.getElementById(id), cache = id => $(id).classList.contains("hide");
  const plateau = () => d.querySelector(".board-wrap");
  const jouerDeux = async () => {
    w.eval("colorMode='w';myColor=W;tcCat='none';setMode('play',{fresh:true})");
    await pause(200);
    if (!cache("readyBanner")) { $("readyStart").click(); await pause(200); }
    for (const u of ["e2e4", "d2d4"]) { w.eval("playUser(game.moves().find(m=>game.uci(m)==='" + u + "'))"); await pause(500); }
    $("btnResign").click(); $("btnResign").click();
    await pause(300);
  };

  console.log("Import depuis les reglages, avant toute partie");
  w.eval("setMode('play')");
  T("au depart : pas de partie, echiquier masque", w.eval("gameStarted") === false && plateau().classList.contains("hide"));
  $("pgnIn").value = '[Event "x"]\n1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 *';
  $("btnPgnLoad").click();
  T("le message annonce les coups charges", /^8 demi-coups chargés/.test(propre($("pgnMsg").textContent)), $("pgnMsg").textContent);
  T("l'echiquier s'affiche", !plateau().classList.contains("hide") && !cache("boardTools") && !$("appLayout").classList.contains("solo"));
  T("avec le bandeau de coups et la feuille de partie", !cache("navRow") && d.querySelectorAll("#navScroll [data-ply]").length === 9 && !cache("scoresheetPanel") && $("sheet").querySelectorAll(".sheet-row").length === 4);
  T("c'est une partie relue, a sa derniere position", w.eval("isReviewGame") === true && w.eval("gameStarted") === true && w.eval("reviewPly") === null && w.eval("game.history.length") === 8);
  T("les deux camps sont nommes par leur couleur", !cache("clockTop") && propre($("clockTopName").textContent) === "Noirs" && propre($("clockBottomName").textContent) === "Blancs", $("clockTopName").textContent + " / " + $("clockBottomName").textContent);
  T("le statut dit qu'on relit une partie", /^Relecture/.test(propre($("status").textContent)) && !cache("statusPanel"), $("status").textContent);
  T("ni abandon ni partie en cours : reglages et « Nouvelle partie » disponibles", cache("btnResign") && !cache("settingsPanel") && !$("btnNew").disabled && w.eval("partieEnCours()") === false);
  T("le panneau Revue et « Analyser la partie » sont la", !cache("reviewPanel") && !$("btnAnalyse").disabled);

  console.log("Elle se parcourt et s'analyse");
  presser(w, "ArrowLeft");
  T("← recule d'un coup, sans bandeau « Retour à la partie »", w.eval("reviewPly") === 7 && cache("retourPartie"));
  presser(w, "Home"); presser(w, "ArrowRight");
  T("Origine puis → : premier coup", w.eval("reviewPly") === 1);
  w.eval("sf.ready=false;sfEnable=()=>Promise.resolve(false)");
  $("btnAnalyse").click();
  await jusqua(() => w.eval("!!analysis"), 15000);
  T("l'analyse couvre la partie importee", w.eval("!!analysis&&analysis.plies.length") === 8, String(w.eval("analysis&&analysis.plies.length")));
  T("elle n'entre pas dans « Tes parties »", w.eval("history.length") === 0 && w.eval("amiHistory.length") === 0);

  console.log("Apres une partie abandonnee");
  await jouerDeux();
  T("la partie abandonnee montre sa carte de fin", !$("resultBanner").classList.contains("hide") && w.eval("resigned") !== null);
  $("pgnIn").value = "1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#";
  $("btnPgnLoad").click();
  T("l'import ne garde rien de l'abandon", w.eval("resigned") === null && w.eval("game.history.length") === 7 && w.eval("isReviewGame") === true);
  T("un mat importe ne rejoue pas de carte de fin", $("resultBanner").classList.contains("hide"), $("resultBanner").className);
  T("le statut reste celui d'une relecture, pas « Tu gagnes »", /^Relecture/.test(propre($("status").textContent)), $("status").textContent);
  T("les camps sont de nouveau nommes par leur couleur", propre($("clockTopName").textContent) === "Noirs" && propre($("clockBottomName").textContent) === "Blancs");

  console.log("Une partie gardee finie par un mat");
  w.eval("history=[{t:Date.now(),k:'d',c:'w',r:'win',tc:'5+3',adv:'Bob',m:'e2e4 e7e5 d1h5 b8c6 f1c4 g8f6 h5f7',fen:null}];renderHistory();resultDismissed=false;openHistoryGame(0)");
  T("rouverte : pas de carte de fin par-dessus l'echiquier", $("resultBanner").classList.contains("hide") && w.eval("reviewPly") === 0);
  T("son adversaire est nomme, et moi je suis « Toi »", propre($("clockTopName").textContent) === "Bob" && propre($("clockBottomName").textContent) === "Toi");

  console.log("Une vraie partie montre toujours sa carte de fin");
  await jouerDeux();
  T("partie jouee puis abandonnee : la carte de fin s'affiche", !$("resultBanner").classList.contains("hide") && w.eval("isReviewGame") === false && propre($("clockBottomName").textContent) === "Toi");
  w.close();

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception : " + (e && e.stack || e)); process.exit(1); });
