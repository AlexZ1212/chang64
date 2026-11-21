/* Verification automatique de chang64.
   Lancement : node tests/check_clavier_direct.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-11-21, decision d'Alexandre) : le clavier dans
   une partie EN DIRECT entre deux membres, avec un faux serveur que le test
   pilote (meme montage que check_partie_ecran.js).
   - ← → Origine Fin ↑ ↓ Echap parcourent les coups pendant la partie ;
   - regarder un coup passe n'arrete JAMAIS la pendule ;
   - le bandeau « Retour à la partie » s'affiche, l'echiquier ne joue pas
     tant qu'on n'est pas revenu, rien ne part au serveur ;
   - un message sans nouveau coup (nulle proposee) laisse la vue ou elle est ;
   - le coup de l'adversaire ramene a la position actuelle, avec son son ;
   - la partie qui finit pendant qu'on regarde un coup passe montre la
     position finale, et se rouvre en revue avec l'analyse. */
const { presser, espionSons, ouvrirDirect, etat } = require("./outils/touches.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));
/* Attend qu'une condition soit vraie, sans depasser max millisecondes. */
const jusqua = async (cond, max) => { const fin = Date.now() + max; while (Date.now() < fin) { if (cond()) return true; await pause(100); } return cond(); };
const propre = s => String(s).replace(/[  ]/g, " ");

(async () => {
  const p = await ouvrirDirect(() => ({ s: 200, j: { id: "abcdefghjkmn" } }));
  const w = p.w, d = w.document, $ = id => d.getElementById(id), cache = id => $(id).classList.contains("hide");
  const vu = () => w.eval("reviewPly");
  const courante = () => { const c = d.querySelector('#navScroll [aria-current="true"]'); return c ? c.dataset.ply : ""; };
  w.eval("prefAnnounce='moves';setMode('friend');cp={pseudo:'Anna',cle:'anna',version:1,dev:'x',n:0,sync:0};directPanneau()");
  $("btnDirectCreer").click();
  await pause(50);
  const fil = p.fils[0], recevoir = e => fil.onmessage({ data: JSON.stringify(e) });
  fil.onopen();
  const C4 = ["e2e4", "e7e5", "g1f3", "b8c6"];
  recevoir(etat());
  recevoir(etat({ phase: "jeu", coups: C4, maj: Date.now() - 5000, h: Date.now() }));
  await pause(250);
  const sons = espionSons(w);

  console.log("Partie en direct en cours");
  T("quatre coups, a moi de jouer, la partie continue", w.eval("game.history.length") === 4 && w.eval("partieEnCours()") === true && propre($("directStatus").textContent) === "À toi de jouer.");
  T("le bandeau de coups se parcourt, dernier coup en avant", d.querySelectorAll("#navScroll [data-ply]").length === 5 && courante() === "4");
  let e = presser(w, "ArrowLeft");
  T("← montre le coup precedent", vu() === 3 && e.defaultPrevented && courante() === "3", vu());
  T("le coup regarde est lu : « Coup 2, Cavalier f3 »", propre($("srAnnounce").textContent).trim() === "Coup 2, Cavalier f3", $("srAnnounce").textContent);
  T("la feuille de partie suit", /f3/.test(propre(($("amiSheet").querySelector(".cur") || {}).textContent || "")));
  T("le bandeau « Retour à la partie » s'affiche", !cache("retourPartie"));
  T("aucune aide : ni jauge ni marque d'analyse", cache("evalwrap") && !d.querySelector("#navScroll [class*='tag-']") && cache("plyInfo"));

  console.log("La pendule continue");
  const avant = propre($("clockBottomTime").textContent);
  await pause(1300);
  const apres = propre($("clockBottomTime").textContent);
  T("ma pendule tourne pendant que je regarde un coup passe", vu() === 3 && apres !== avant && $("clockBottom").classList.contains("active"), avant + " -> " + apres);

  console.log("Un message sans nouveau coup");
  const s0 = sons();
  recevoir(etat({ phase: "jeu", coups: C4, nulle: "n", maj: Date.now() - 6500, h: Date.now() }));
  T("nulle proposee : c'est dit, et la vue reste ou elle est", /propose la nulle/.test(propre($("directStatus").textContent)) && vu() === 3 && courante() === "3" && !cache("retourPartie"));
  T("le coup regarde n'est pas rejoue", sons() === s0, sons() + " / " + s0);
  recevoir(etat({ phase: "jeu", coups: C4, maj: Date.now() - 6500, h: Date.now() }));

  console.log("Les autres touches");
  presser(w, "Home");
  T("Origine va au debut de la partie", vu() === 0 && courante() === "0");
  presser(w, "End");
  T("Fin revient a la position actuelle", vu() === null && cache("retourPartie") && courante() === "4");
  presser(w, "ArrowUp");
  T("↑ va au debut de la partie", vu() === 0);
  presser(w, "ArrowRight");
  T("→ avance d'un coup", vu() === 1);
  presser(w, "ArrowDown");
  T("↓ revient a la position actuelle", vu() === null);
  presser(w, "ArrowLeft"); presser(w, "Escape");
  T("Echap ramene a la partie", vu() === null && cache("retourPartie"));
  const sens = w.eval("flipped");
  presser(w, "f");
  T("« F » ne fait rien en direct, ou le bouton de retournement est masque", $("btnFlip").hidden && w.eval("flipped") === sens);
  presser(w, "ArrowLeft", $("directPseudo"));
  T("aucune touche dans un champ de texte", vu() === null);

  console.log("L'echiquier ne joue pas tant qu'on n'est pas revenu");
  presser(w, "ArrowLeft"); presser(w, "ArrowLeft");
  const cases = d.querySelectorAll("#board .sq");
  const envois = fil.envois.length;
  cases[61].click();
  T("un appui sur l'echiquier ramene a la partie sans rien jouer", vu() === null && w.eval("selected") === -1 && fil.envois.length === envois);
  cases[61].click(); cases[34].click();
  T("puis mon coup part normalement au serveur", fil.envois.includes('{"t":"coup","c":"f1c4"}'), JSON.stringify(fil.envois));
  const C5 = C4.concat(["f1c4"]);
  recevoir(etat({ phase: "jeu", coups: C5, maj: Date.now(), h: Date.now() }));

  console.log("Le coup de l'adversaire ramene a la position actuelle");
  presser(w, "ArrowLeft"); presser(w, "ArrowLeft");
  T("je regarde un coup passe pendant que l'adversaire reflechit", vu() === 3 && !cache("retourPartie"));
  const s1 = sons();
  const C6 = C5.concat(["g8f6"]);
  recevoir(etat({ phase: "jeu", coups: C6, maj: Date.now(), h: Date.now() }));
  T("son coup ramene a la position actuelle", vu() === null && w.eval("game.history.length") === 6 && cache("retourPartie") && courante() === "6", vu());
  T("avec son deplacement et son son", w.eval("lastAnimated===lastMove") && sons() > s1, sons() + " > " + s1);

  console.log("La partie finit pendant qu'on regarde un coup passe");
  presser(w, "Home");
  recevoir(etat({ phase: "fin", coups: C6, fin: { r: "1-0", m: "abandon" } }));
  T("la carte de fin se pose sur la position finale", vu() === null && !$("resultBanner").classList.contains("hide") && propre($("resultSub").textContent) === "Bob a abandonné.");
  T("la partie est gardee avec sa sorte", w.eval("history[0].k") === "d" && w.eval("history[0].adv") === "Bob");
  T("« Revoir » est propose en direct aussi", !cache("resultAnalyse") && propre($("resultNew").textContent) === "Revanche");
  $("resultClose").click();
  presser(w, "ArrowLeft");
  T("partie finie : les fleches parcourent les coups, sans bandeau « Retour à la partie »", vu() === 5 && cache("retourPartie"));
  presser(w, "End");

  console.log("La partie en direct se rouvre en revue, avec l'analyse");
  w.eval("resultDismissed=false;directMontrer()");
  $("resultAnalyse").click();
  T("elle s'ouvre dans la revue de Jouer", w.eval("mode") === "play" && w.eval("isReviewGame") === true && w.eval("game.history.length") === 6 && vu() === 0);
  T("l'adversaire y est nomme", propre($("clockTopName").textContent) === "Bob", $("clockTopName").textContent);
  T("le panneau Revue et « Analyser la partie » sont la", !cache("reviewPanel") && !$("btnAnalyse").disabled);
  w.eval("sf.ready=false;sfEnable=()=>Promise.resolve(false)");
  $("btnAnalyse").click();
  await jusqua(() => w.eval("!!analysis"), 15000);
  T("l'analyse tourne sur la partie entre humains", w.eval("!!analysis&&analysis.plies.length") === 6 && !cache("analysisOut"), String(w.eval("analysis&&analysis.plies.length")));
  presser(w, "ArrowRight");
  T("→ y parcourt les coups", vu() === 1);
  w.close();

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception : " + (e && e.stack || e)); process.exit(1); });
