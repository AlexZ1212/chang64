/* Verification automatique de chang64.
   Lancement : node tests/check_clavier_ordinateur.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-11-21, decision d'Alexandre) : le clavier dans
   l'ecran de partie CONTRE L'ORDINATEUR, pendant la partie puis en revue.
   - ← coup precedent, → coup suivant, ↑ ou Origine debut de la partie, ↓ ou
     Fin position actuelle, Echap retour a la partie ;
   - regarder un coup passe n'arrete JAMAIS la pendule, un bandeau « Retour
     à la partie » s'affiche, l'echiquier ne joue pas tant qu'on n'est pas
     revenu, et le coup de l'ordinateur qui arrive ramene a la position
     actuelle, avec son son ;
   - le coup affiche porte aria-current et il est lu (« Coup 2, Cavalier f3 ») ;
   - aucune touche n'agit dans un champ de texte, ni derriere une fenetre, ni
     avec Alt ; le focus sur l'echiquier garde les fleches pour les cases ;
   - « ? » ouvre l'aide « Raccourcis clavier » et « F » retourne l'echiquier,
     seulement dans l'ecran de partie, et les deux se coupent. */
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
  const coup = uci => w.eval("playUser(game.moves().find(m=>game.uci(m)==='" + uci + "'))");
  const courante = () => { const c = d.querySelector('#navScroll [aria-current="true"]'); return c ? c.dataset.ply : ""; };

  console.log("Hors de l'ecran de partie");
  w.eval("setMode('puzzles')");
  presser(w, "?");
  T("« ? » n'ouvre rien ailleurs que dans une partie", $("duel").hidden);

  console.log("Partie en cours, pendule 10+0");
  w.eval("prefAnnounce='moves';colorMode='w';myColor=W;tcCat='rapid';tcIdx=0;setMode('play',{fresh:true})");
  await pause(200);
  if (!cache("readyBanner")) { $("readyStart").click(); await pause(200); }
  const sons = espionSons(w);
  coup("e2e4"); await pause(500);
  coup("g1f3"); await pause(500);
  T("quatre coups joues, la partie continue", w.eval("game.history.length") === 4 && w.eval("partieEnCours()") === true, w.eval("game.history.length"));
  T("le dernier coup porte aria-current", courante() === "4" && d.querySelectorAll('#navScroll [aria-current]').length === 1, courante());
  T("pas de bandeau « Retour à la partie » en position actuelle", cache("retourPartie"));
  T("le lien « Clavier » est sous l'echiquier", !cache("clavierLigne") && propre($("btnClavier").textContent) === "Clavier");

  let e = presser(w, "ArrowLeft");
  T("← montre le coup precedent", vu() === 3 && e.defaultPrevented && courante() === "3", vu());
  T("le coup regarde est lu : « Coup 2, Cavalier f3 »", propre($("srAnnounce").textContent).trim() === "Coup 2, Cavalier f3", $("srAnnounce").textContent);
  T("le bandeau « Retour à la partie » s'affiche", !cache("retourPartie") && propre($("btnRetourPartie").textContent) === "Retour à la partie" && /coup passé/.test(propre($("retourPartie").textContent)));
  T("aucune aide : ni marque d'analyse ni commentaire de coup", !d.querySelector("#navScroll [class*='tag-']") && cache("plyInfo") && $("btnAnalyse").disabled);

  console.log("La pendule continue");
  const avant = propre($("clockBottomTime").textContent), msAvant = w.eval("clock.w");
  await pause(1300);
  const apres = propre($("clockBottomTime").textContent);
  T("ma pendule tourne pendant que je regarde un coup passe", vu() === 3 && w.eval("clock.active===W") && w.eval("clock.w") < msAvant - 1000 && apres !== avant, avant + " -> " + apres);
  T("elle montre le temps qui court, pas celui du coup regarde", (w.eval("renderClocks()"), propre($("clockBottomTime").textContent)) === w.eval("fmtTime(clock.w)") && w.eval("clockHist[3].w") > w.eval("clock.w") + 1000);

  console.log("Les autres touches");
  presser(w, "ArrowLeft");
  T("← encore : un coup de plus en arriere", vu() === 2);
  presser(w, "ArrowRight");
  T("→ avance d'un coup", vu() === 3);
  presser(w, "Home");
  T("Origine va au debut de la partie", vu() === 0 && courante() === "0" && /Début/.test(propre($("srAnnounce").textContent)), $("srAnnounce").textContent);
  presser(w, "End");
  T("Fin revient a la position actuelle", vu() === null && cache("retourPartie") && courante() === "4");
  presser(w, "ArrowUp");
  T("↑ va au debut de la partie", vu() === 0);
  presser(w, "ArrowDown");
  T("↓ revient a la position actuelle", vu() === null);
  e = presser(w, "ArrowRight");
  T("→ sur la position actuelle ne fait rien", vu() === null && w.eval("game.history.length") === 4);
  presser(w, "ArrowLeft"); presser(w, "Escape");
  T("Echap ramene a la partie", vu() === null && cache("retourPartie"));
  presser(w, "ArrowLeft");
  $("btnRetourPartie").click();
  T("le bouton « Retour à la partie » aussi", vu() === null && cache("retourPartie"));

  console.log("Ce qui n'agit pas");
  presser(w, "ArrowLeft", $("lichessIn"));
  T("aucune touche dans un champ de texte", vu() === null);
  presser(w, "ArrowLeft", $("pgnIn"));
  T("ni dans une zone de texte", vu() === null);
  e = presser(w, "ArrowLeft", null, { altKey: true });
  T("Alt+← reste au navigateur", vu() === null && !e.defaultPrevented);
  const cases = d.querySelectorAll("#board .sq");
  cases[60].focus();
  presser(w, "ArrowLeft", cases[60]);
  T("focus sur l'echiquier : la fleche deplace la case, pas la partie", vu() === null && d.activeElement === cases[59]);
  d.activeElement.blur();

  console.log("L'echiquier ne joue pas tant qu'on n'est pas revenu");
  presser(w, "ArrowLeft"); presser(w, "ArrowLeft");
  const n0 = w.eval("game.history.length");
  cases[51].click();
  T("un appui sur l'echiquier ramene a la partie sans rien jouer", vu() === null && w.eval("game.history.length") === n0 && w.eval("selected") === -1);

  console.log("Le coup de l'ordinateur ramene a la position actuelle");
  const s0 = sons();
  coup("d2d4");
  w.eval("gotoPly(1)");
  T("je regarde un coup passe pendant que l'ordinateur reflechit", vu() === 1 && !cache("retourPartie"));
  await pause(600);
  T("sa reponse ramene a la position actuelle", vu() === null && w.eval("game.history.length") === 6 && cache("retourPartie") && courante() === "6", vu() + "/" + w.eval("game.history.length"));
  T("avec son deplacement et son son", w.eval("lastAnimated===lastMove") && sons() > s0, sons() + " > " + s0);

  console.log("Aide « Raccourcis clavier »");
  presser(w, "?", null, { shiftKey: true });
  const txt = () => propre($("duelContenu").textContent);
  T("« ? » ouvre la fenetre", !$("duel").hidden && /Raccourcis clavier/.test(txt()));
  T("fenetre qui informe : une medaille et un filet, ni arc ni elephant", !!d.querySelector("#duelContenu .popin-medaille[data-medaille='_clavier']") && !!d.querySelector("#duelContenu .popin-filet") && !d.querySelector("#duelContenu .bravo-arc"));
  const lignes = [...d.querySelectorAll("#duelContenu .clavier-liste > div")].map(x => propre(x.textContent));
  T("elle liste les six touches", lignes.length === 6 && /Coup précédent, coup suivant/.test(lignes[0]) && /Origine.*Début de la partie/.test(lignes[1]) && /Fin.*Position actuelle/.test(lignes[2]) && /Échap.*Retour à la partie/.test(lignes[3]) && /F.*Retourner l'échiquier/.test(lignes[4]) && /\?.*Afficher cette liste/.test(lignes[5]), lignes.join(" / "));
  T("la fenetre porte son nom pour un lecteur d'ecran", propre($("duel").getAttribute("aria-label")) === "Raccourcis clavier");
  presser(w, "ArrowLeft");
  T("derriere la fenetre, les fleches n'agissent pas", vu() === null);
  presser(w, "Escape");
  await pause(50);
  T("Echap la ferme, sans piege au clavier, et elle reprend son nom", $("duel").hidden && propre($("duel").getAttribute("aria-label")) !== "Raccourcis clavier");
  $("btnClavier").click();
  T("le lien « Clavier » ouvre la meme fenetre", !$("duel").hidden && /Raccourcis clavier/.test(txt()));
  d.querySelector("#duelContenu [data-duel-fermer]").click();
  const sens = w.eval("flipped");
  presser(w, "f");
  T("« F » retourne l'echiquier", w.eval("flipped") === !sens);
  presser(w, "F", null, { shiftKey: true });
  T("et le remet", w.eval("flipped") === sens);
  w.eval("prefTouches=false");
  presser(w, "?"); presser(w, "f");
  T("raccourcis a une touche coupes : ni « ? » ni « F »", $("duel").hidden && w.eval("flipped") === sens);
  presser(w, "ArrowLeft");
  T("les fleches, elles, marchent toujours", vu() === 5);
  presser(w, "End");
  w.eval("prefTouches=true");

  console.log("Partie finie : la revue");
  $("btnResign").click(); $("btnResign").click();
  await pause(300);
  T("la partie est finie", w.eval("partieEnCours()") === false && !$("resultBanner").classList.contains("hide"));
  $("resultClose").click();
  presser(w, "ArrowLeft");
  T("← marche aussi en revue, sans bandeau « Retour à la partie »", vu() === 5 && cache("retourPartie") && courante() === "5");
  presser(w, "ArrowUp"); presser(w, "ArrowRight");
  T("↑ puis → : premier coup", vu() === 1 && propre($("srAnnounce").textContent).trim() === "Coup 1, e4", $("srAnnounce").textContent);
  presser(w, "Escape");
  T("Echap revient a la position finale", vu() === null);

  console.log("Partie importee en PGN");
  /* Garde par uitest7 aussi : une partie importee se parcourt aux fleches,
     meme chargee depuis l'ecran des reglages. */
  w.eval("setupGame()");
  presser(w, "?");
  T("ecran des reglages, sans partie : « ? » n'ouvre rien", $("duel").hidden && cache("clavierLigne"));
  $("pgnIn").value = "1. e4 c5 2. Nf3 d6 3. d4 cxd4";
  $("btnPgnLoad").click();
  w.eval("gotoPly(2)");
  presser(w, "ArrowRight", d);
  T("→ avance dans la partie importee, touche recue par le document", vu() === 3, vu());
  presser(w, "End", d);
  T("Fin revient a sa derniere position", vu() === null);

  console.log("Accessibilite");
  w.eval("setMode('prefs')");
  const aide = propre($("kbdHelp").textContent);
  T("la section Accessibilite reprend la meme liste", $("kbdHelp").querySelectorAll(".clavier-liste > div").length === 6 && /Coup précédent, coup suivant/.test(aide));
  T("avec l'usage au lecteur d'ecran", /lecteur d'écran/.test(aide) && /lu à voix haute/.test(aide));
  T("et le reglage des raccourcis a une seule touche", propre($("prefsTouchesLabel").textContent) === "Raccourcis à une seule touche" && $("segTouches").querySelectorAll("[role=radio]").length === 2 && $("segTouches").querySelector('[data-v="on"]').getAttribute("aria-checked") === "true");
  $("segTouches").querySelector('[data-v="off"]').click();
  T("le couper retire « ? » et « F » de la liste", w.eval("prefTouches") === false && $("kbdHelp").querySelectorAll(".clavier-liste > div").length === 4 && /"touches":false/.test(w.localStorage.getItem("chang64:prefs") || ""), w.localStorage.getItem("chang64:prefs"));
  w.close();

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception : " + (e && e.stack || e)); process.exit(1); });
