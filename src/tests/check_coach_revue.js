/* Verification automatique de chang64.
   Lancement : node tests/check_coach_revue.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-11-22, decisions d'Alexandre par QCM) : le
   coach de relecture a l'ecran.
   - une phrase pour chaque gaffe et chaque erreur DU JOUEUR, sous
     l'echiquier quand on arrive sur le coup, puis le coup conseille ;
   - sans cas verifiable : seulement « Le coach preferait … » ;
   - rien sur les coups de l'adversaire, sauf un compliment quand le joueur
     punit sa faute ;
   - un bloc « Le coach » dans le panneau Revue : les moments les plus
     couteux, trois au plus, chaque ligne mene au coup ;
   - la phrase est lue par les lecteurs d'ecran avec le coup, pieces en
     toutes lettres ;
   - AUCUNE aide pendant une partie : ni bloc, ni phrase ;
   - les phrases existent dans les dix langues, avec leurs accords.
   Les conditions de chaque cas sont dans check_coach_cas.js ; ici l'analyse
   est posee a la main, pour ne pas dependre de la force du moteur. */
const { ouvrir } = require("./outils/page_langue.js");
const { CODES } = require("../langues/registre.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));
const propre = s => String(s).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
/* Le texte tel que le lit un lecteur d'ecran : chaque figurine par son nom. */
function lu(el) {
  let s = "";
  (function va(n) {
    if (n.nodeType === 3) { s += n.nodeValue; return; }
    if (n.nodeType !== 1) return;
    if (n.getAttribute("aria-hidden") === "true") return;
    if (n.getAttribute("role") === "img") { s += n.getAttribute("aria-label") || ""; return; }
    n.childNodes.forEach(va);
  })(el);
  return propre(s);
}
/* Une analyse posee a la main : fautes[i] = { tag, best, rep, loss, pv, pvr }. */
const poser = (w, n, fautes) => w.eval("(function(){const F=" + JSON.stringify(fautes) + ",P=[];for(let i=0;i<" + n + ";i++){const f=F[i]||{};" +
  "P.push({cp:0,cpTrue:0,mate:null,loss:f.loss||0,tag:f.tag||null,best:f.best||gameUci[i],mover:i%2,rep:f.rep||null,pv:f.pv||null,pvr:f.pvr||null});}" +
  "finishAnalysis(P,coachPreparerSansMoteur(P));})()");

(async () => {
  const w = await ouvrir("fr");
  const d = w.document, $ = id => d.getElementById(id), cache = id => $(id).classList.contains("hide");

  console.log("Une partie relue : un fou laisse en prise, puis une erreur sans raison nette");
  w.eval("prefAnnounce='moves';ouvrirPartieGardee({m:'e2e4 e7e5 f1c4 b8c6 d2d3 g8f6 c1g5 h7h6 b1c3 h6g5 d1d2 f8e7',c:'w',t:Date.UTC(2026,10,21,12),k:'o'},'jeu')");
  T("avant l'analyse : pas de bloc du coach", cache("coachBloc"));
  poser(w, 12, { 8: { tag: "blunder", loss: 310, best: "g5h4", rep: "h6g5" }, 10: { tag: "mistake", loss: 150, best: "g1f3", rep: "f8e7" } });
  await pause(150);
  T("apres l'analyse : le bloc « Le coach » est la", !cache("coachBloc") && propre($("coachBloc").querySelector(".eyebrow").textContent) === "Le coach", $("coachBloc").className);
  T("il compte les moments a revoir", propre($("coachIntro").textContent) === "2 moments à revoir. Touche une ligne pour voir la position.", $("coachIntro").textContent);
  const lignes = () => [...d.querySelectorAll("#coachListe .coach-ligne")];
  T("deux lignes, dans l'ordre de la partie", lignes().length === 2 && lignes()[0].dataset.ply === "9" && lignes()[1].dataset.ply === "11", lignes().map(l => l.dataset.ply).join(","));
  T("la ligne nomme le coup : 5. Cavalier c3", lu(lignes()[0].querySelector("b")) === "5. Cavalierc3", lu(lignes()[0].querySelector("b")));
  T("et dit pourquoi", lu(lignes()[0].querySelector("span")) === "Le fou en g5 était déjà attaqué et rien ne le défend : hxg5 le prend.", lu(lignes()[0].querySelector("span")));
  T("sans cas verifiable : seulement le coup prefere", lu(lignes()[1].querySelector("span")) === "Le coach préférait Cavalierf3." && lignes()[1].classList.contains("sans"), lu(lignes()[1].querySelector("span")));
  T("chaque ligne est un bouton", lignes().every(l => l.tagName === "BUTTON" && l.type === "button"));
  T("la phrase « le plus couteux » en notation brute a disparu", !/g5h4/.test($("analysisNote").textContent), $("analysisNote").textContent);
  T("aucune position a rejouer : ni note ni bouton", cache("coachExoNote") && cache("btnCoachRejouer"));

  console.log("Sous l'echiquier");
  lignes()[0].click();
  await pause(100);
  T("la ligne mene au coup", w.eval("reviewPly") === 9);
  T("le commentaire du coup est affiche, en rouge", !cache("plyInfo") && $("plyInfo").classList.contains("blunder"), $("plyInfo").className);
  T("coup joue, etiquette, raison, conseil", lu($("plyInfo")) === "Joué Cavalierc3 GaffeLe fou en g5 était déjà attaqué et rien ne le défend : hxg5 le prend.Mieux : Fouh4", lu($("plyInfo")));
  T("la raison et le conseil ont chacun leur ligne", !!$("plyInfo").querySelector(".coach-phrase") && !!$("plyInfo").querySelector(".coach-mieux") && !!$("plyInfo").querySelector(".coach-verdict"));
  T("le lecteur d'ecran lit le coup puis la phrase", propre($("srAnnounce").textContent) === "Coup 5, Cavalier c3. Gaffe. Le fou en g5 était déjà attaqué et rien ne le défend : hxg5 le prend. Mieux : Fou h4", $("srAnnounce").textContent);
  w.eval("gotoPly(11)");
  await pause(100);
  T("erreur sans raison : « Le coach preferait », sans ligne de conseil", lu($("plyInfo")) === "Joué Damed2 ErreurLe coach préférait Cavalierf3." && !$("plyInfo").querySelector(".coach-mieux"), lu($("plyInfo")));
  w.eval("gotoPly(10)");
  await pause(100);
  T("coup de l'adversaire : aucune phrase du coach", !cache("plyInfo") && !$("plyInfo").querySelector(".coach-phrase"), lu($("plyInfo")));
  w.eval("gotoPly(3)");
  await pause(100);
  T("bon coup du joueur : l'affichage d'avant", !$("plyInfo").querySelector(".coach-phrase") && /meilleur coup/.test(propre($("plyInfo").textContent)), $("plyInfo").textContent);
  w.eval("exitReview()");
  await pause(100);
  T("sur la position finale d'une partie analysee, le commentaire du dernier coup reste", !cache("plyInfo"));

  console.log("Le coup qui finit la partie (pat)");
  w.eval("ouvrirPartieGardee({m:'e6f6',c:'w',t:Date.UTC(2026,10,21,12),k:'o',fen:'5k2/5P2/4K3/8/8/8/8/8 w - - 0 1'},'jeu')");
  poser(w, 1, { 0: { tag: "blunder", loss: 400, best: "e6d6" } });
  await pause(150);
  T("le pat est explique dans le bloc", lignes().length === 1 && /^Ce coup fait pat : ton adversaire n'est pas en échec/.test(lu(lignes()[0].querySelector("span"))), lignes().length ? lu(lignes()[0]) : "aucune ligne");
  T("un seul moment : le singulier", propre($("coachIntro").textContent) === "1 moment à revoir. Touche la ligne pour voir la position.", $("coachIntro").textContent);
  lignes()[0].click();
  await pause(100);
  T("et sous l'echiquier, sur la position finale", !cache("plyInfo") && /Ce coup fait pat/.test(lu($("plyInfo"))) && /Mieux : Roid6/.test(lu($("plyInfo"))), lu($("plyInfo")));

  console.log("Compliment : le joueur prend la dame laissee en prise");
  w.eval("ouvrirPartieGardee({m:'e2e4 e7e5 g1f3 d8g5 f3g5 b8c6',c:'w',t:Date.UTC(2026,10,21,12),k:'o'},'jeu')");
  poser(w, 6, { 3: { tag: "blunder", loss: 800, best: "b8c6", rep: "f3g5" } });
  await pause(150);
  T("aucune faute du joueur : le bloc le dit", propre($("coachIntro").textContent) === "Aucune gaffe ni erreur de ton côté. Bien joué !", $("coachIntro").textContent);
  T("le compliment est dans le bloc", lignes().length === 1 && lignes()[0].classList.contains("bien") && lu(lignes()[0].querySelector("span")) === "Bien vu : rien ne défendait la dame en g5, et Cavalierxg5 la prend.", lignes().length ? lu(lignes()[0]) : "aucune ligne");
  w.eval("gotoPly(5)");
  await pause(100);
  T("et sous l'echiquier, en vert, sans etiquette de faute", $("plyInfo").classList.contains("best") && !$("plyInfo").querySelector(".coach-verdict") && /^Joué Cavalierxg5Bien vu/.test(lu($("plyInfo"))), lu($("plyInfo")));
  w.eval("gotoPly(4)");
  await pause(100);
  T("la faute de l'adversaire n'est pas expliquee", !$("plyInfo").querySelector(".coach-phrase"), lu($("plyInfo")));

  console.log("Du cote des Noirs");
  w.eval("ouvrirPartieGardee({m:'f2f3 e7e5 g2g4 b8c6 e2e4 d8h4',c:'b',t:Date.UTC(2026,10,21,12),k:'o'},'jeu')");
  poser(w, 6, { 3: { tag: "blunder", loss: 1200, best: "d8h4" } });
  await pause(150);
  T("mat en un manque par les Noirs", lignes().length === 1 && lu(lignes()[0].querySelector("b")) === "2… Cavalierc6" && lu(lignes()[0].querySelector("span")) === "Il y avait mat en un coup : Dameh4#.", lignes().length ? lu(lignes()[0]) : "aucune ligne");

  console.log("Une autre partie efface le coach");
  w.eval("ouvrirPartieGardee({m:'e2e4 e7e5 g1f3 b8c6',c:'w',t:Date.UTC(2026,10,21,12),k:'o'},'jeu')");
  await pause(100);
  T("bloc masque, commentaire masque", cache("coachBloc") && cache("plyInfo") && w.eval("coachPli(0)") === null);

  console.log("Aucune aide pendant une partie");
  const g = await ouvrir("fr");
  const gd = g.document, G = id => gd.getElementById(id);
  G("heroPlay").click(); await pause(600);
  if (G("readyBanner") && !G("readyBanner").classList.contains("hide")) { G("readyStart").click(); await pause(400); }
  const cases = () => gd.querySelectorAll("#board .sq");
  cases()[52].click(); await pause(120); cases()[36].click(); await pause(1800);
  T("une partie est en cours", g.eval("gameUci.length") >= 1 && g.eval("partieEnCours()") === true, g.eval("gameUci.length"));
  g.eval("analyseGame()");
  await pause(300);
  T("l'analyse est refusee : pas d'analyse, donc pas de coach", g.eval("analysis") === null && g.eval("coachPli(0)") === null);
  T("ni bloc ni phrase a l'ecran", G("coachBloc").classList.contains("hide") && G("plyInfo").classList.contains("hide") && !gd.querySelector(".coach-phrase"));
  g.eval("gotoPly(1)");
  await pause(100);
  T("meme en regardant un coup passe", G("plyInfo").classList.contains("hide") && !gd.querySelector(".coach-phrase"));
  g.close();

  console.log("Sans Stockfish : le moteur de secours fait aussi parler le coach");
  /* jsdom n'a pas de Worker : « Analyser cette partie » retombe sur le moteur
     integre, exactement comme dans un navigateur ou Stockfish ne demarre pas. */
  w.eval("ouvrirPartieGardee({m:'e2e4 e7e5 f1c4 b8c6 d1h5 g8f6 h5f3 c6d4',c:'w',t:Date.UTC(2026,10,21,12),k:'o'},'jeu');analyseGame()");
  for (let k = 0; k < 150 && !w.eval("!!analysis"); k++) await pause(100);
  T("l'analyse de secours aboutit", w.eval("!!analysis&&analysis.plies.length") === 8, w.eval("analysis&&analysis.plies.length"));
  T("le mat en un manque est explique", w.eval("analysis.coach&&analysis.coach[6].e&&analysis.coach[6].e.cas") === "mat1_manque" && lignes().some(l => /Il y avait mat en un coup/.test(lu(l))), w.eval("JSON.stringify(analysis.coach&&analysis.coach[6])"));
  /* Sans cette indication, le coach chercherait un mat en deux sur chaque
     faute : 0,4 s par faute sur un PC, un gel de plusieurs secondes sur un
     telephone (mesure du 22/11). */
  T("chaque pli dit si le moteur annonce un mat (le mat en deux n'est cherche que la)", w.eval("analysis.plies.every(p=>'mateAvant' in p&&'mateApres' in p)") === true && w.eval("analysis.plies[6].mateAvant") === 1, w.eval("JSON.stringify(analysis.plies.map(p=>[p.mateAvant,p.mateApres]))"));

  console.log("Partie importee : pas d'exercice tire des fautes d'un autre");
  w.eval("ouvrirPartieGardee({m:'e2e4 e7e5 f1c4 b8c6 d1h5 g8f6 h5f3 c6d4',c:'w',t:Date.UTC(2026,10,21,12),k:'o'},'jeu');revueMoi='Anna'");
  T("aucun candidat", w.eval("(function(){const P=[];for(let i=0;i<8;i++)P.push({cp:0,cpTrue:0,mate:null,loss:i===6?1200:0,tag:i===6?'blunder':null,best:i===6?'h5f7':gameUci[i],mover:i%2,rep:null});const r=coachPreparerSansMoteur(P);return r.coach[6].e.cas+'/'+r.exos.length;})()") === "mat1_manque/0");
  w.eval("revueMoi=''");
  w.close();

  console.log("Les dix langues : chaque phrase se compose, avec ses accords");
  /* Chaque cas rendu avec une piece masculine et une piece feminine (la tour
     l'est en francais, en espagnol, en italien, en polonais et en russe ; la
     dame en allemand). Aucune accolade ne doit rester, et hors de l'anglais
     la phrase ne doit pas etre restee en anglais. */
  const CAS = [
    { cas: "pat", de: "apres", mieux: "e6d6" },
    { cas: "mat1_manque", de: "avant", coup: "e6d6" },
    { cas: "mat2_manque", de: "avant", coup: "e6d6" },
    { cas: "mat1_permis", de: "avant", coup: "e6d6" },
    { cas: "mat2_permis", de: "avant", coup: "e6d6" },
    { cas: "promo_manquee", de: "avant", coup: "e6d6" },
    { cas: "prise_perdante", de: "avant", coup: "e6d6", piece: { p: "p", sq: "e5" }, preneur: { p: "q", sq: "e5" } },
    { cas: "prise_perdante", de: "avant", coup: "e6d6", piece: { p: "r", sq: "e5" }, preneur: { p: "r", sq: "e5" } },
    { cas: "en_prise", variante: "libre", deja: true, de: "avant", coup: "e6d6", piece: { p: "b", sq: "g5" }, attaquant: { p: "p", sq: "h6" } },
    { cas: "en_prise", variante: "libre", deja: true, de: "avant", coup: "e6d6", piece: { p: "r", sq: "a1" }, attaquant: { p: "q", sq: "h8" } },
    { cas: "en_prise", variante: "libre", deja: false, de: "avant", coup: "e6d6", piece: { p: "q", sq: "d5" }, attaquant: { p: "n", sq: "c3" } },
    { cas: "en_prise", variante: "libre", deja: false, de: "avant", coup: "e6d6", piece: { p: "n", sq: "d5" }, attaquant: { p: "r", sq: "d8" } },
    { cas: "en_prise", variante: "moindre", deja: true, de: "avant", coup: "e6d6", piece: { p: "r", sq: "a1" }, attaquant: { p: "b", sq: "g7" } },
    { cas: "en_prise", variante: "moindre", deja: true, de: "avant", coup: "e6d6", piece: { p: "n", sq: "f3" }, attaquant: { p: "p", sq: "g4" } },
    { cas: "en_prise", variante: "moindre", deja: false, de: "avant", coup: "e6d6", piece: { p: "q", sq: "d5" }, attaquant: { p: "r", sq: "d8" } },
    { cas: "prise_manquee", variante: "libre", de: "avant", coup: "e6d6", piece: { p: "r", sq: "h8" }, preneur: { p: "b", sq: "b2" } },
    { cas: "prise_manquee", variante: "libre", de: "avant", coup: "e6d6", piece: { p: "n", sq: "h8" }, preneur: { p: "b", sq: "b2" } },
    { cas: "prise_manquee", variante: "moindre", de: "avant", coup: "e6d6", piece: { p: "q", sq: "d4" }, preneur: { p: "r", sq: "d1" } },
    { cas: "prise_manquee", variante: "moindre", de: "avant", coup: "e6d6", piece: { p: "q", sq: "d4" }, preneur: { p: "n", sq: "f3" } },
    { cas: "fourchette_manquee", de: "avant", coup: "e6d6", cibles: [{ p: "k", sq: "g8" }, { p: "r", sq: "a8" }] },
    { cas: "fourchette_permise", de: "avant", coup: "e6d6", cibles: [{ p: "q", sq: "d1" }, { p: "p", sq: "b2" }] },
    { cas: "bien_prise", de: "avant", coup: "e6d6", piece: { p: "r", sq: "a8" } },
    { cas: "bien_prise", de: "avant", coup: "e6d6", piece: { p: "b", sq: "c8" } },
    { cas: "bien_mat", de: "avant", coup: "e6d6" }
  ];
  const FEN = "5k2/5P2/4K3/8/8/8/8/8 w - - 0 1";
  const AUTRES = ["The coach", "Replay now", "No blunder and no mistake on your side. Well played!", "From your game", "Your move. White to play.", "Your move. Black to play.",
    "A position from one of your own games. It does not change your puzzle rating."];
  const anglais = {};
  for (const lang of CODES) {
    const p = await ouvrir(lang, { attente: 900 });
    const phrases = CAS.map(c => propre(p.eval("coachPhrase(" + JSON.stringify(c) + "," + JSON.stringify(FEN) + ",'e6f6',false)")));
    const divers = AUTRES.map(k => propre(p.eval("t(" + JSON.stringify(k) + ")")))
      .concat([1, 2, 3].map(n => propre(p.eval("t(" + JSON.stringify(n === 1 ? "{n} moment to review. Tap the line to see the position." : "{n} moments to review. Tap a line to see the position.") + ",{n:" + n + "})"))))
      .concat([1, 2, 5].map(n => propre(p.eval("t(" + JSON.stringify(n === 1 ? "{n} position from this game is in your Mistakes to review." : "{n} positions from this game are in your Mistakes to review.") + ",{n:" + n + "})"))))
      .concat([propre(p.eval("t('The coach preferred {move}.',{move:'Nf3'})")), propre(p.eval("t('Better: {move}',{move:'Nf3'})")), propre(p.eval("t('You played {move}. Find better!',{move:'Nf3'})")),
        propre(p.eval("t('Game of {date}, move {n}.',{date:coachDate(Date.UTC(2026,10,21,12)),n:4})")), propre(p.eval("t('{move}: that was the move. Well found!',{move:'Nf3'})"))]);
    const tout = phrases.concat(divers);
    const troue = tout.filter(s => !s || /[{}]|undefined|\[object/.test(s));
    T(lang + " : " + tout.length + " phrases composees, aucune accolade", troue.length === 0, troue.join(" // "));
    if (lang === "en") tout.forEach((s, i) => { anglais[i] = s; });
    else { const restees = tout.filter((s, i) => s === anglais[i]); T(lang + " : aucune phrase restee en anglais", restees.length === 0, restees.join(" // ")); }
    const P = i => phrases[i];
    if (lang === "fr") {
      T("fr : accord au feminin (la tour attaquee, « la prend »)", P(9) === "La tour en a1 était déjà attaquée et rien ne la défend : Kd6 la prend.", P(9));
      T("fr : accord au masculin", P(8) === "Le fou en g5 était déjà attaqué et rien ne le défend : Kd6 le prend.", P(8));
      T("fr : prise perdante", P(6) === "Le pion en e5 était défendu : Kd6 reprend la dame en e5." && P(7) === "La tour en e5 était défendue : Kd6 reprend la tour en e5.", P(6) + " // " + P(7));
      T("fr : fourchette", P(19) === "Il y avait une fourchette : Kd6 attaque à la fois le roi en g8 et la tour en a8.", P(19));
      T("fr : jamais de « : » ni de « ! » seul en debut de ligne (espace insecable)", / :/.test(p.eval("t('Better: {move}',{move:'Nf3'})")) && / !/.test(p.eval("t('You played {move}. Find better!',{move:'Nf3'})")));
    }
    if (lang === "en") T("en : la piece en tete de phrase prend la majuscule", P(8) === "The bishop on g5 was already attacked and nothing defends it: Kd6 takes it." && P(10) === "After this move, nothing defends the queen on d5: Kd6 takes it.", P(8) + " // " + P(10));
    if (lang === "ru") {
      T("ru : feminin (ладья была), accusatif (её)", P(9) === "Ладья на a1 уже была под ударом, и её ничто не защищает: Kd6 её забирает.", P(9));
      T("ru : masculin (слон был), genitif de l'attaquant", P(13) === "Конь на f3 уже был под ударом пешки на g4: Kd6 его забирает.", P(13));
      T("ru : accusatif en tete de phrase", P(16) === "Коня на h8 ничто не защищало: Kd6 забирал его даром.", P(16));
      T("ru : trois formes du pluriel", divers[8] === "2 момента для разбора. Нажми на строку, чтобы увидеть позицию." && divers[12] === "5 позиций из этой партии теперь в твоих Ошибках для повторения.", divers[8] + " // " + divers[12]);
    }
    if (lang === "pl") {
      T("pl : feminin (wieża była atakowana, ją)", P(9) === "Wieża na a1 była już atakowana i nic jej nie broni: Kd6 ją zbija.", P(9));
      T("pl : genitif apres la negation", P(10) === "Po tym ruchu nic nie broni hetmana na d5: Kd6 go zbija.", P(10));
      T("pl : la tour qui pouvait prendre (mogła)", P(17) === "Wieża na d1 mogła zbić hetmana na d4: Kd6.", P(17));
    }
    if (lang === "de") {
      T("de : accusatif et pronom (den Läufer, ihn / die Dame, sie)", P(8) === "Der Läufer auf g5 war schon angegriffen und nichts deckt ihn: Kd6 schlägt ihn." && P(10) === "Nach diesem Zug deckt nichts die Dame auf d5: Kd6 schlägt sie.", P(8) + " // " + P(10));
      T("de : datif apres « von »", P(13) === "Der Springer auf f3 war schon von dem Bauern auf g4 angegriffen: Kd6 schlägt ihn.", P(13));
    }
    if (lang === "tr") T("tr : la case avant le nom, suffixes de cas", P(10) === "Bu hamleden sonra d5'teki veziri hiçbir taş korumuyor: Kd6 hamlesi onu alıyor." && P(13) === "f3'teki at zaten g4'teki piyonun saldırısı altındaydı: Kd6 hamlesi onu alıyor.", P(10) + " // " + P(13));
    if (lang === "es") T("es : accord (atacada, la captura)", P(9) === "La torre en a1 ya estaba atacada y nada la defiende: Kd6 la captura.", P(9));
    if (lang === "it") T("it : pas de « da il » (voix active)", P(13) === "Il pedone in g4 attaccava già il cavallo in f3: Kd6 lo cattura.", P(13));
    if (lang === "pt") T("pt : contraction « pelo »", P(13) === "O cavalo em f3 já estava atacado pelo peão em g4: Kd6 o captura.", P(13));
    p.close();
  }

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception " + (e && e.stack || e)); process.exit(1); });
