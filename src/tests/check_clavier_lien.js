/* Verification automatique de chang64.
   Lancement : node tests/check_clavier_lien.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-11-21, decision d'Alexandre) : le clavier dans
   une partie ENTRE AMIS PAR LIEN, pendant la partie. Jusque-la le bandeau de
   coups y etait en lecture seule.
   - ← → Origine Fin ↑ ↓ Echap parcourent les coups ;
   - le bandeau « Retour à la partie » s'affiche, l'echiquier ne joue pas
     tant qu'on n'est pas revenu ;
   - le coup de l'ami, qui arrive par un lien, ramene a la position actuelle,
     avec son son ;
   - le coup affiche porte aria-current, la feuille de partie le suit ;
   - aucune touche n'agit dans le champ du lien a envoyer.
   Une partie par lien n'a pas de pendule : celle du direct et celle de
   l'ordinateur sont gardees par check_clavier_direct et
   check_clavier_ordinateur. */
const { ouvrir } = require("./outils/page_langue.js");
const { presser, espionSons } = require("./outils/touches.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));
const propre = s => String(s).replace(/[  ]/g, " ");

(async () => {
  const w = await ouvrir("fr");
  const d = w.document, $ = id => d.getElementById(id), cache = id => $(id).classList.contains("hide");
  const vu = () => w.eval("reviewPly");
  const coup = uci => w.eval("playAmi(game.moves().find(m=>game.uci(m)==='" + uci + "'))");
  const courante = () => { const c = d.querySelector('#navScroll [aria-current="true"]'); return c ? c.dataset.ply : ""; };

  console.log("Partie par lien en cours");
  w.eval("prefAnnounce='moves';setMode('friend');amiColor=W;newAmiGame()");
  presser(w, "ArrowLeft");
  T("aucun coup joue : les fleches ne font rien", vu() === null);
  coup("e2e4"); coup("e7e5"); coup("g1f3");
  T("trois coups, la partie continue", w.eval("amiMoves.length") === 3 && w.eval("partieEnCours()") === true);
  T("le bandeau de coups se parcourt, dernier coup en avant", d.querySelectorAll("#navScroll [data-ply]").length === 4 && courante() === "3" && d.querySelectorAll("#navScroll [aria-current]").length === 1, courante());
  T("aucune aide : ni jauge ni marque d'analyse", cache("evalwrap") && !d.querySelector("#navScroll [class*='tag-']") && cache("plyInfo"));

  let e = presser(w, "ArrowLeft");
  T("← montre le coup precedent", vu() === 2 && e.defaultPrevented && courante() === "2", vu());
  T("le coup regarde est lu : « Coup 1, e5 »", propre($("srAnnounce").textContent).trim() === "Coup 1, e5", $("srAnnounce").textContent);
  T("la feuille de partie suit le coup regarde", propre(($("amiSheet").querySelector(".cur") || {}).textContent || "") === "e5", ($("amiSheet").querySelector(".cur") || {}).textContent);
  T("l'echiquier montre la position d'alors", w.eval("viewGame().history.length") === 2 && w.eval("game.history.length") === 3);
  T("le bandeau « Retour à la partie » s'affiche", !cache("retourPartie"));
  presser(w, "ArrowRight");
  T("→ avance : retour a la position actuelle au dernier coup", vu() === null && cache("retourPartie") && courante() === "3");
  presser(w, "Home");
  T("Origine va au debut de la partie", vu() === 0 && courante() === "0");
  presser(w, "ArrowRight");
  T("→ depuis le debut : premier coup", vu() === 1 && propre($("srAnnounce").textContent).trim() === "Coup 1, e4");
  presser(w, "End");
  T("Fin revient a la position actuelle", vu() === null);
  presser(w, "ArrowUp");
  T("↑ va au debut de la partie", vu() === 0);
  presser(w, "ArrowDown");
  T("↓ revient a la position actuelle", vu() === null);
  presser(w, "ArrowLeft"); presser(w, "Escape");
  T("Echap ramene a la partie", vu() === null && cache("retourPartie"));
  d.querySelector('#navScroll [data-ply="1"]').click();
  T("toucher une puce montre ce coup", vu() === 1 && !cache("retourPartie"));
  $("btnRetourPartie").click();
  T("le bouton « Retour à la partie » ramene", vu() === null);

  console.log("Ce qui n'agit pas");
  presser(w, "ArrowLeft", $("amiLink"));
  T("aucune touche dans le champ du lien", vu() === null);
  e = presser(w, "ArrowLeft", null, { ctrlKey: true });
  T("ni avec Ctrl", vu() === null && !e.defaultPrevented);

  console.log("L'echiquier ne joue pas tant qu'on n'est pas revenu");
  /* Je joue les Noirs ici, pour que ce soit a moi de jouer. */
  w.eval("amiColor=B;showAmi()");
  presser(w, "ArrowLeft");
  const cases = d.querySelectorAll("#board .sq");
  const n0 = w.eval("amiMoves.length");
  cases[1].click();
  T("un appui sur l'echiquier ramene a la partie sans rien jouer", vu() === null && w.eval("amiMoves.length") === n0 && w.eval("selected") === -1);
  cases[1].click();
  T("l'appui suivant choisit bien une piece", w.eval("selected") >= 0);
  w.eval("selected=-1;amiColor=W;showAmi()");

  console.log("Le coup de l'ami arrive par un lien");
  const sons = espionSons(w);
  const code = w.eval("amiMoves.map(encMove).join('')+encMove({from64:sq64(nSq('b8')),to64:sq64(nSq('c6')),promo:0})");
  presser(w, "Home");
  T("je regarde le debut de la partie", vu() === 0 && !cache("retourPartie"));
  const s0 = sons();
  w.location.hash = "#p=" + code;
  await pause(300);
  T("son coup ramene a la position actuelle", vu() === null && w.eval("amiSan.length") === 4 && cache("retourPartie") && courante() === "4", vu() + "/" + w.eval("amiSan.length"));
  T("avec son deplacement et son son", w.eval("lastAnimated===lastMove") && sons() > s0, sons() + " > " + s0);

  console.log("« F » et « ? »");
  const sens = w.eval("flipped");
  presser(w, "f");
  T("« F » retourne l'echiquier", w.eval("flipped") === !sens);
  presser(w, "f");
  presser(w, "?");
  T("« ? » ouvre l'aide", !$("duel").hidden && /Raccourcis clavier/.test(propre($("duelContenu").textContent)));
  presser(w, "Escape");
  await pause(50);

  console.log("Partie finie");
  w.eval("amiResigned=B;showAmi()");
  T("la partie est finie", w.eval("partieEnCours()") === false);
  $("resultClose").click();
  presser(w, "ArrowLeft");
  T("les fleches parcourent encore les coups, sans bandeau « Retour à la partie »", vu() === 3 && cache("retourPartie"));
  presser(w, "End");
  w.close();

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception : " + (e && e.stack || e)); process.exit(1); });
