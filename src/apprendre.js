/* chang64 - l'onglet « Apprendre » : le chemin de chapitres, le test de
 * placement, les boss, « Reprendre un coup » (2026-11-22)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Decisions d'Alexandre (21 et 22/11/2026) :
 * - un cinquieme onglet, en deuxieme position ; Jouer reste l'accueil ;
 * - « Je debute » est le chapitre 1 du chemin : sa progression (chang64:debut),
 *   son badge et l'adresse #start ne changent pas ;
 * - le chapitre suivant s'ouvre quand les lecons du precedent sont finies ; le
 *   boss est facultatif ; seul le test de placement fait sauter des chapitres ;
 * - le test se propose par une carte dans l'onglet, jamais par une fenetre ; il
 *   s'arrete apres deux erreurs de suite ;
 * - le boss des chapitres 2 et 3 est l'ordinateur debutant avec un handicap ;
 * - « Reprendre un coup » n'existe que dans les parties du chemin (premiere
 *   partie, boss) ; une partie a handicap, ou dans laquelle on a repris un
 *   coup, est un entrainement : ni Elo ni badges ;
 * - le bouton « Je debute » de l'accueil suit la progression, puis disparait.
 *
 * Le contenu des chapitres est dans chemin/ (un fichier par chapitre, voir
 * chemin/LISEZ-MOI.md) ; chemin_build.js en tire data/chemin-<langue>.json et
 * le resume CHEMIN_PLAN pose ici. Le moteur des lecons est celui de « Je
 * debute » (ui3.js), qui joue le chapitre designe par lecon / leconCh.
 *
 * Colle apres jouer.js et avant navigation.js (badges_build.js). */
const CHEMIN_PLAN = __CHEMIN_PLAN__;   /* [{id:"debut"},{id,n,boss}] dans l'ordre du chemin */
const CHEMIN_CLE = "chang64:chemin";

/* Progression du chemin, hors chapitre 1 :
   c : par chapitre, { e, x, f } (etape et exercice ou l'on est, etapes
       reussies ; l'indice n, celui du boss, y entre quand il est battu) ;
   o : chapitres ouverts par le test de placement ;
   p : le test, { t: date, n: bonnes reponses, e: chapitre d'entree ou "fin",
       f: force de l'ordinateur retenue } ou { x: 1 } s'il a ete ecarte. */
let chemin = { v: 1, c: {}, o: [], p: null };
let cheminD = null;            /* data/chemin-<langue>.json */
let cheminFiches = null;       /* data/fiches-<langue>.json */
let cheminLu = false;
let cheminOrigine = "home";    /* l'ecran ou la croix d'une lecon ramene */
const leconsEtat = {};         /* etat a l'ecran des chapitres deja ouverts */

function cheminIndex(id) { return CHEMIN_PLAN.findIndex(c => c.id === id); }
function cheminCh(id) { return cheminD ? cheminD.chapitres.find(c => c.id === id) || null : null; }
function cheminEtapes(id) { const c = cheminCh(id); return c && c.etapes ? c.etapes : null; }

function cheminNormaliser(d) {
  const o = { v: 1, c: {}, o: [], p: null };
  if (!d || typeof d !== "object") return o;
  if (d.c && typeof d.c === "object") for (const id in d.c) {
    const i = cheminIndex(id), s = d.c[id];
    if (i < 1 || !s || typeof s !== "object") continue;
    const n = CHEMIN_PLAN[i].n;
    o.c[id] = { e: Number.isInteger(s.e) && s.e >= 0 && s.e <= n ? s.e : 0, x: Number.isInteger(s.x) && s.x >= 0 ? s.x : 0,
      f: Array.isArray(s.f) ? Array.from(new Set(s.f.filter(k => Number.isInteger(k) && k >= 0 && k <= n))).sort((a, b) => a - b) : [] };
  }
  if (Array.isArray(d.o)) o.o = d.o.filter(id => cheminIndex(id) >= 0);
  if (d.p && typeof d.p === "object") o.p = d.p;
  return o;
}
async function cheminLire() {
  if (cheminLu) return;
  cheminLu = true;
  try { const r = await window.storage.get(CHEMIN_CLE); if (r && r.value) chemin = cheminNormaliser(JSON.parse(r.value)); } catch (e) {}
}
function cheminEcrire() {
  try { window.storage.set(CHEMIN_CLE, JSON.stringify(chemin)); } catch (e) {}
  cheminMaj();
}
/* Appele par debutSauver (ui3.js) quand la lecon a l'ecran n'est pas « Je debute ». */
function cheminSauver() {
  if (lecon === debut || !leconCh) return;
  chemin.c[leconCh] = { e: lecon.e, x: lecon.x, f: lecon.faites.slice().sort((a, b) => a - b) };
  cheminEcrire();
}
/* Une progression venue du compte (compte.js) : on l'adopte sans l'ecrire. */
function cheminAdopter(v) {
  chemin = cheminNormaliser(v); cheminLu = true;
  for (const id in leconsEtat) if (chemin.c[id] && lecon !== leconsEtat[id]) delete leconsEtat[id];
  if (chemin.p && chemin.p.f && typeof botLevel !== "undefined" && mode !== "play") { botLevel = chemin.p.f; if (typeof syncForce === "function") syncForce(); }
  cheminMaj();
}
function debutAdopter(v) {
  if (!v || typeof v !== "object") return;
  const E = debutEtapes();
  if (Array.isArray(v.f)) debut.faites = Array.from(new Set(debut.faites.concat(v.f.filter(i => Number.isInteger(i) && i >= 0 && i < E.length))));
  if (!(mode === "debut" && lecon === debut) && Number.isInteger(v.e) && v.e >= 0 && v.e < E.length) {
    debut.e = v.e; debut.x = Number.isInteger(v.x) && v.x >= 0 && v.x < E[v.e].exos.length ? v.x : 0;
  }
  debut.charge = true;
  cheminMaj();
}

/* ---------- Ou en est chaque chapitre ---------- */
function cheminEtat(i) {
  const c = CHEMIN_PLAN[i];
  if (c.id === "debut") {
    const E = debutEtapes(), avec = E.map((et, k) => et.exos.length ? k : -1).filter(k => k >= 0);
    const faits = avec.filter(k => debut.faites.includes(k)).length;
    return { total: avec.length, faits: faits, fini: faits >= avec.length, boss: debut.faites.includes(E.length - 1),
      etape: Math.min(debut.e, E.length - 1) + 1, etapes: E.length, commence: debut.faites.length > 0 || debut.e > 0 || debut.x > 0 };
  }
  const s = chemin.c[c.id] || { e: 0, x: 0, f: [] }, faits = s.f.filter(k => k < c.n).length;
  return { total: c.n, faits: faits, fini: faits >= c.n, boss: s.f.includes(c.n),
    etape: Math.min(s.e, c.n) + 1, etapes: c.n + (c.boss ? 1 : 0), commence: s.f.length > 0 || s.e > 0 || s.x > 0 };
}
function cheminOuvert(i) {
  if (i <= 0) return true;
  return chemin.o.includes(CHEMIN_PLAN[i].id) || cheminEtat(i - 1).fini;
}
/* Le chapitre a continuer : le premier non fini a partir de l'entree donnee
   par le test ; -1 quand il n'en reste pas. */
function cheminCourant() {
  let d = 0;
  if (chemin.p && chemin.p.e) d = chemin.p.e === "fin" ? CHEMIN_PLAN.length : Math.max(0, cheminIndex(chemin.p.e));
  for (let i = d; i < CHEMIN_PLAN.length; i++) if (!cheminEtat(i).fini) return i;
  return -1;
}
function cheminCommence() {
  if (chemin.p && chemin.p.t) return true;
  for (let i = 0; i < CHEMIN_PLAN.length; i++) if (cheminEtat(i).commence) return true;
  return false;
}

/* ---------- Chargement ---------- */
let cheminAttente = null;
function cheminCharger() {
  if (cheminD) return Promise.resolve(cheminD);
  if (!cheminAttente) {
    const lire = l => fetch("/data/chemin-" + l + ".json").then(r => { if (!r.ok) throw new Error("chemin"); return r.json(); });
    cheminAttente = lire(LANG).catch(() => lire("en")).then(d => { cheminD = d; return d; })
      .catch(() => { cheminAttente = null; return null; });
  }
  return cheminAttente;
}
function fichesCharger() {
  if (cheminFiches) return Promise.resolve(cheminFiches);
  const lire = l => fetch("/data/fiches-" + l + ".json").then(r => { if (!r.ok) throw new Error("fiches"); return r.json(); });
  return lire(LANG).catch(() => lire("en")).then(d => { cheminFiches = d; return d; }).catch(() => null);
}
async function cheminPret(avecDonnees) {
  await Promise.all([typeof debutLire === "function" ? debutLire() : null, cheminLire()]);
  if (avecDonnees) await cheminCharger();
}

/* ---------- Ouvrir un chapitre ---------- */
function cheminActiver(id) {
  leconCh = id;
  if (id === "debut") { lecon = debut; return; }
  if (!leconsEtat[id]) {
    const s = chemin.c[id] || {};
    leconsEtat[id] = { e: s.e | 0, x: s.x | 0, faites: Array.isArray(s.f) ? s.f.slice() : [], ok: false, occupe: false, gen: 0 };
  }
  lecon = leconsEtat[id];
}
async function cheminOuvrirChapitre(i, origine) {
  const c = CHEMIN_PLAN[i]; if (!c) return;
  await cheminPret(c.id !== "debut");
  if (!cheminOuvert(i)) return;
  if (c.id !== "debut" && !cheminEtapes(c.id)) {
    /* Hors ligne et jamais charge : on le dit, sans ouvrir un ecran vide. */
    if (typeof objAnnoncer === "function") objAnnoncer("defi", t("Lesson not loaded"), t("Check your connection and try again."));
    return;
  }
  testArreter();
  cheminActiver(c.id);
  cheminOrigine = origine || (mode === "home" ? "home" : "apprendre");
  if (mode === "debut") debutCharger(); else setMode("debut");
  goTop();
}
function cheminRetour() { return cheminOrigine === "home" ? "home" : "apprendre"; }

/* ---------- Fin d'etape : le boss, puis la suite (appele par debutCharger) ---------- */
function leconFinRendre(et, ex) {
  const L = $("appLayout");
  if (L) delete L.dataset.test;
  const titre = leconCh === "debut" ? t("I'm a beginner") : (cheminCh(leconCh) || {}).titre || "";
  if ($("debutTeteTitre")) $("debutTeteTitre").textContent = titre;
  if ($("leconChap")) $("leconChap").textContent = titre;
  for (const id of ["testPastilles", "testActions", "testResultat"]) if ($(id)) $(id).classList.add("hide");
  for (const id of ["debutActions", "debutTitre", "debutIntro"]) if ($(id)) $(id).classList.remove("hide");
  const zone = $("leconBoss"); if (!zone) return;
  const boss = !ex && et && et.boss;
  zone.classList.toggle("hide", !boss);
  if (!boss) return;
  const i = cheminIndex(leconCh), battu = lecon.faites.includes(lecon.e), suivant = i + 1 < CHEMIN_PLAN.length && cheminOuvert(i + 1);
  const fait = $("leconBossFait");
  fait.classList.toggle("hide", !battu);
  fait.textContent = battu ? (et.boss.gagne || t("Boss beaten")) : "";
  $("btnLeconBoss").textContent = battu ? t("Play the boss again") : t("Face the boss");
  $("btnLeconBoss").classList.toggle("primary", !battu);
  $("btnLeconSuite").textContent = suivant ? t("Next chapter") : t("Back to the path");
  $("btnLeconSuite").classList.toggle("primary", battu);
  const th = (cheminCh(leconCh) || {}).theme;
  $("leconTheme").classList.toggle("hide", !th);
}
if ($("btnLeconSuite")) $("btnLeconSuite").onclick = () => {
  const i = cheminIndex(leconCh);
  if (i + 1 < CHEMIN_PLAN.length && cheminOuvert(i + 1)) cheminOuvrirChapitre(i + 1, cheminOrigine);
  else { setMode("apprendre"); goTop(); }
};
if ($("btnLeconTheme")) $("btnLeconTheme").onclick = () => {
  const th = (cheminCh(leconCh) || {}).theme;
  if (th && typeof applyDeepLink === "function") { applyDeepLink({ kind: "theme", name: th }); goTop(); }
};

/* ---------- Parties du chemin : le boss, et « Reprendre un coup » ---------- */
/* La partie lancee par le chemin : { ch, fen, r } (r : un coup a ete repris).
   Gardee hors du compte : elle ne vaut que pour la partie en cours ici. */
let cheminPartie = null, cheminDepart = false;
try { cheminPartie = JSON.parse(localStorage.getItem("chang64:cheminPartie") || "null"); } catch (e) { cheminPartie = null; }
function cheminPartieGarder() {
  try { if (cheminPartie) localStorage.setItem("chang64:cheminPartie", JSON.stringify(cheminPartie)); else localStorage.removeItem("chang64:cheminPartie"); } catch (e) {}
}
function cheminPartieActive() {
  try {
    return !!cheminPartie && mode === "play" && !!gameStarted && !isReviewGame && (cheminPartie.fen || null) === (gameStartFen || null);
  } catch (e) { return false; }
}
/* Entrainement : un handicap, ou un coup repris. Ni Elo (elo.js) ni badges
   de partie (badges.js) ; la partie reste dans « Tes parties ». */
function partieEntrainement() { return cheminPartieActive() && !!(cheminPartie.fen || cheminPartie.r); }
function cheminLancerPartie(ch, fen, niveau) {
  cheminPartie = { ch: ch, fen: fen || null, r: 0 }; cheminPartieGarder();
  colorMode = "w"; myColor = W;
  if (typeof syncColorSeg === "function") syncColorSeg();
  botLevel = niveau || 1;
  if (typeof syncForce === "function") syncForce();
  pendingNoClock = true;
  if (fen) pendingStartFen = fen;
  cheminDepart = true;
  try { setMode("play", { fresh: true }); } finally { cheminDepart = false; }
  goTop();
}
if ($("btnLeconBoss")) $("btnLeconBoss").onclick = () => {
  const et = leconEtapes()[lecon.e];
  if (et && et.boss) cheminLancerPartie(leconCh, et.boss.fen, et.boss.niveau);
};
/* La premiere partie de « Je debute » est une partie du chemin : on peut y
   reprendre un coup. Sans reprise, elle compte comme avant. */
if (typeof debutPremierePartie === "function") {
  const av = debutPremierePartie;
  debutPremierePartie = function () {
    cheminPartie = { ch: "debut", fen: null, r: 0 }; cheminPartieGarder();
    cheminDepart = true;
    try { return av.apply(this, arguments); } finally { cheminDepart = false; }
  };
  if ($("btnDebutPartie")) $("btnDebutPartie").onclick = debutPremierePartie;
}
/* Toute autre partie neuve n'est plus une partie du chemin. */
if (typeof newGame === "function") {
  const av = newGame;
  newGame = function () {
    if (!cheminDepart && cheminPartie) { cheminPartie = null; cheminPartieGarder(); }
    return av.apply(this, arguments);
  };
}
function repriseMaj() {
  const b = $("btnReprendre"), n = $("entrainementNote"); if (!b || !n) return;
  const active = cheminPartieActive();
  let finie = false;
  try { finie = !!resultInfo || resigned !== null || isFlagged() || !game.moves().length || game.isDraw(); } catch (e) {}
  b.classList.toggle("hide", !active || finie);
  let bloque = true;
  try { bloque = busy || game.turn !== myColor || game.history.length < 2; } catch (e) {}
  b.disabled = bloque;
  n.classList.toggle("hide", !(active && partieEntrainement()));
}
if (typeof refreshGame === "function") {
  const av = refreshGame;
  refreshGame = function () { const r = av.apply(this, arguments); repriseMaj(); return r; };
}
if ($("btnReprendre")) $("btnReprendre").onclick = () => {
  if (!cheminPartieActive() || busy || game.turn !== myColor || game.history.length < 2) return;
  if (reviewGame && typeof vueActuelle === "function") vueActuelle();
  undoGame();
  cheminPartie.r = 1; cheminPartieGarder();
  repriseMaj();
  if (typeof focusBoard === "function") focusBoard();
};
/* Le boss est battu : la marque entre dans la progression, une fois la
   partie enregistree (jamais pendant qu'elle se joue). */
if (typeof saveFinishedGame === "function") {
  const av = saveFinishedGame;
  saveFinishedGame = function () {
    const avant = gameSaved, r = av.apply(this, arguments);
    if (!avant && gameSaved && resultInfo) { try { bossFin(); } catch (e) {} }
    repriseMaj();
    return r;
  };
}
function bossFin() {
  if (!cheminPartie || !cheminPartie.fen || !cheminPartieActive() || resultInfo.kind !== "win") return;
  const i = cheminIndex(cheminPartie.ch); if (i < 1) return;
  const id = CHEMIN_PLAN[i].id, n = CHEMIN_PLAN[i].n;
  const s = chemin.c[id] || (chemin.c[id] = { e: n, x: 0, f: [] });
  if (s.f.includes(n)) return;
  s.f.push(n); s.f.sort((a, b) => a - b);
  if (leconsEtat[id] && !leconsEtat[id].faites.includes(n)) leconsEtat[id].faites.push(n);
  cheminEcrire();
  if (typeof objAnnoncer === "function") objAnnoncer("parfait", t("Boss beaten"), t("Chapter {n} is yours. Tap to go back to the path.", { n: i + 1 }),
    () => { setMode("apprendre"); goTop(); });
}

/* ---------- Test de placement ---------- */
let test = { actif: false, i: 0, rep: [], fin: false, occupe: false, gen: 0, res: null };
function testEnCours() { return test.actif && !test.fin; }
function testArreter() { test.actif = false; test.gen++; }
/* Le glisser-deposer de l'echiquier (ui3.js) demande si la lecon accepte un coup. */
function leconBloquee() { return test.actif ? (test.fin || test.occupe) : (lecon.ok || lecon.occupe); }
async function testLancer() {
  await cheminPret(true);
  if (!cheminD || !cheminD.placement || !cheminD.placement.length) {
    if (typeof objAnnoncer === "function") objAnnoncer("defi", t("Lesson not loaded"), t("Check your connection and try again."));
    return;
  }
  test = { actif: true, i: 0, rep: [], fin: false, occupe: false, gen: test.gen + 1, res: null };
  cheminOrigine = "apprendre";
  if (mode === "debut") debutCharger(); else setMode("debut");
  goTop();
}
/* Les pastilles du test : une par position, trouvee, manquee, en cours ou a
   venir. La coche et la croix doublent la couleur. */
const TEST_COCHE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TEST_CROIX = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
function testPastilles() {
  const P = cheminD.placement, box = $("testPastilles");
  let bons = 0, h = "";
  for (let k = 0; k < P.length; k++) {
    const r = test.rep[k];
    if (r) bons++;
    h += '<i class="' + (r === 1 ? "bon" : r === 0 ? "rate" : !test.fin && k === test.i ? "ici" : "") + '">' + (r === 1 ? TEST_COCHE : r === 0 ? TEST_CROIX : "") + "</i>";
  }
  poserHtml(box, h);
  box.setAttribute("aria-label", t("Correct answers: {n} out of {total}", { n: bons, total: P.length }));
  box.classList.remove("hide");
}
/* Deux positions manquees de suite, ou la derniere : le test est fini. */
function testFini() {
  const P = cheminD.placement, r = test.rep, n = r.length;
  return n >= P.length || (n >= 2 && !r[n - 1] && !r[n - 2]);
}
function testRendre() {
  const P = cheminD.placement, L = $("appLayout");
  $("debutTeteTitre").textContent = t("Placement test");
  $("leconChap").textContent = t("Placement test");
  for (const id of ["debutPas", "debutFin", "leconBoss", "debutActions", "debutTitre", "debutIntro"]) $(id).classList.add("hide");
  if (test.fin) { testResultat(); return; }
  delete L.dataset.test;
  $("testResultat").classList.add("hide");
  const p = P[test.i];
  test.gen++; test.occupe = false;
  game = new Game(p.fen);
  /* L'echiquier se place du cote de celui qui REPOND : avec un coup prealable
     de l'adversaire, ce n'est pas le camp au trait dans la position de depart
     (defaut vu par Alexandre le 22/11 : la position 4 s'affichait a l'envers). */
  const joueur = p.avant ? (game.turn === W ? B : W) : game.turn;
  flipped = joueur === B; selected = -1; lastMove = null; marks = {};
  legalCache = game.moves();
  $("debutEtape").textContent = t("Position {n} of {total}", { n: test.i + 1, total: P.length });
  testPastilles();
  $("debutStatus").classList.remove("hide");
  $("testActions").classList.remove("hide");
  $("btnTestPasse").classList.remove("hide");
  $("btnTestPasse").disabled = false;
  $("btnTestSuite").classList.add("hide");
  const consigne = () => debutStatut("", t(game.turn === W ? "White to play. Find the best move." : "Black to play. Find the best move."));
  if (p.avant) {
    const g = test.gen;
    legalCache = []; test.occupe = true;
    $("btnTestPasse").disabled = true;
    debutStatut("", t("Watch the move that has just been played…"));
    setTimeout(() => {
      if (g !== test.gen || !test.actif || mode !== "debut") return;
      const m = game.moves().find(x => game.uci(x) === p.avant);
      if (m) { game.makeMove(m); lastMove = m; }
      legalCache = game.moves(); test.occupe = false;
      $("btnTestPasse").disabled = false;
      consigne(); render();
    }, 650);
  } else consigne();
  render();
}
function testClic(sq) {
  if (test.occupe || !legalCache.length) return;
  if (selected >= 0) {
    const r = pickMove(selected, sq);
    if (r && r.promo) { askPromo(r.promo, m => testReponse(m)); selected = -1; render(); return; }
    if (r && r.move) { testReponse(r.move); return; }
  }
  const p = game.board[sq];
  selected = p && pC(p) === game.turn ? sq : -1;
  marks = {};
  render();
}
/* Un seul essai par position ; m absent : « Je ne sais pas ». Le resultat est
   dit nettement, avec une phrase qui explique l'idee (demandes d'Alexandre,
   22/11). On passe a la suite quand on le decide. */
function testReponse(m) {
  if (!testEnCours() || test.occupe) return;
  const p = cheminD.placement[test.i];
  let bon = false;
  if (m) {
    bon = p.sol.includes(game.uci(m));
    game.makeMove(m);
    if (p.mat) bon = game.isCheckmate();
    lastMove = m;
  }
  test.rep[test.i] = bon ? 1 : 0;
  test.occupe = true; legalCache = []; selected = -1; marks = {};
  if (!bon) {
    /* Pourquoi ce n'etait pas le bon coup (demande d'Alexandre, 22/11) : le
       coup joue est repris, sa case reste marquee, et le meilleur coup est
       montre sur l'echiquier comme un indice. La phrase dit l'idee. */
    if (m) { game.undoMove(); lastMove = game.history.length ? game.history[game.history.length - 1].m : null; marks[m.to] = "bad"; }
    const u = p.sol[0];
    selected = debutCase(u.slice(0, 2));
    marks[debutCase(u.slice(2, 4))] = "hint";
  }
  if (bon) { try { SON.reussite(); } catch (e) {} }
  debutStatut(bon ? "win" : m ? "lose" : "", (bon ? t("Correct.") : m ? t("That was not the best move.") : t("Position skipped.")) + (p.ex ? " " + p.ex : ""));
  testPastilles();
  $("btnTestPasse").classList.add("hide");
  const suite = $("btnTestSuite");
  suite.textContent = testFini() ? t("See the result") : t("Next");
  suite.classList.remove("hide");
  render();
  try { suite.focus({ preventScroll: true }); } catch (e) {}
}
function testSuivant() {
  if (!test.actif || test.fin || !test.occupe || test.rep.length <= test.i) return;
  if (testFini()) { test.fin = true; testCalculer(); }
  else test.i = test.rep.length;
  if (mode === "debut") { testRendre(); leconAjuster(true); if (!test.fin && typeof focusBoard === "function") focusBoard(); }
}
/* Ce que le test regle. Une position jamais vue compte comme manquee. */
const TEST_NIVEAUX = [[1, 700], [1, 700], [1, 700], [1, 700], [1, 800], [1, 800], [2, 900], [3, 1000], [4, 1150], [5, 1300], [6, 1450]];
function testCalculer() {
  const P = cheminD.placement, r = test.rep;
  let score = 0;
  for (let k = 0; k < P.length; k++) if (r[k]) score++;
  /* Chapitre d'entree : le premier dont une position n'a pas ete trouvee. Les
     positions sans chapitre (au-dela des chapitres sortis) ne retiennent personne. */
  let entree = CHEMIN_PLAN.length;
  for (let i = 0; i < CHEMIN_PLAN.length && entree === CHEMIN_PLAN.length; i++)
    if (P.some((p, k) => p.ch === CHEMIN_PLAN[i].id && !r[k])) entree = i;
  const palier = TEST_NIVEAUX[Math.round(score * 10 / P.length)] || TEST_NIVEAUX[0];
  const force = score * 10 / P.length >= 10 ? 3 : score * 10 / P.length >= 7 ? 2 : 1;
  /* Ce qui a deja ete gagne en jouant n'est jamais ecrase par le test. */
  const dejaExercices = (prog.solved || 0) >= 5, dejaParties = !!(prog.eloOrdi && prog.eloOrdi.n >= 1);
  test.res = { score: score, total: P.length, arret: r.length < P.length, entree: entree, niveau: dejaExercices ? null : { palier: palier[0], note: palier[1] }, force: dejaParties ? null : force };
  /* Le chemin s'ouvre tout de suite, quoi que le joueur decide des reglages. */
  const ouverts = CHEMIN_PLAN.slice(0, Math.min(entree + 1, CHEMIN_PLAN.length)).map(c => c.id);
  chemin.o = Array.from(new Set(chemin.o.concat(ouverts)));
  chemin.p = { t: Date.now(), n: score, e: entree >= CHEMIN_PLAN.length ? "fin" : CHEMIN_PLAN[entree].id };
  cheminEcrire();
  try { if (typeof bxActivite === "function") bxActivite(); } catch (e) {}
}
function testResultat() {
  const R = test.res, L = $("appLayout"), fin = R.entree >= CHEMIN_PLAN.length;
  L.dataset.test = "resultat";
  $("testActions").classList.add("hide");
  $("debutStatus").classList.add("hide");
  testPastilles();
  /* L'arret avant la dixieme position est explique : sans cela, on croit
     avoir manque une partie du test. */
  $("testArret").textContent = R.arret ? t("The test stopped after two missed positions in a row: we already know where to start you.") : "";
  $("testArret").classList.toggle("hide", !R.arret);
  $("debutEtape").textContent = t("Correct answers: {n} out of {total}", { n: R.score, total: R.total });
  $("debutTitre").classList.remove("hide"); $("debutIntro").classList.remove("hide");
  $("debutTitre").textContent = t("Here is your starting point");
  $("debutIntro").textContent = fin ? t("You already know everything the chapters released so far cover.")
    : R.entree === 0 ? t("We start at the beginning: the right place to build good habits.")
    : t("You already know part of the path. Here is what we suggest.");
  const ch = fin ? null : cheminCh(CHEMIN_PLAN[R.entree].id);
  const lignes = [[t("Path"), fin
    ? t("The chapters already out stay open if you want to go over them. More are on the way; until then, the Solve tab is the place to practise.")
    : t("You start at chapter {n}: {titre}.", { n: R.entree + 1, titre: ch ? ch.titre : "" }) + (R.entree > 0 ? " " + t("The earlier chapters stay open.") : "")]];
  lignes.push([t("Puzzle rating"), R.niveau ? t("Level {n} | puzzle rating {r}", { n: R.niveau.palier, r: R.niveau.note })
    : t("Unchanged: it comes from the puzzles you have already solved.")]);
  lignes.push([t("Computer"), R.force ? t("{force} strength, about {elo} Elo.", { force: t(["", "Beginner", "Casual", "Solid", "Tough"][R.force]), elo: (typeof NIVEAU_ELO !== "undefined" && NIVEAU_ELO[R.force]) || "" })
    : t("Unchanged: your games against the computer have already set it.")]);
  poserHtml($("testLignes"), lignes.map(l => '<div class="test-ligne"><b>' + echapper(l[0]) + "</b>" + echapper(l[1]) + "</div>").join(""));
  $("testNote").textContent = t("You can change all of this later, and take the test again whenever you like from the Learn tab.");
  $("btnTestAppliquer").textContent = fin ? t("Back to the path") : t("Start chapter {n}", { n: R.entree + 1 });
  $("btnTestGarder").parentNode.classList.toggle("hide", !R.niveau && !R.force);
  $("testResultat").classList.remove("hide");
  if (typeof announce === "function") announce($("debutTitre").textContent + ". " + lignes.map(l => l[0] + " : " + l[1]).join(" "), "status");
  render();
}
function testSortir(appliquer) {
  const R = test.res; if (!R) return;
  if (appliquer) {
    if (R.niveau) {
      prog.level = R.niveau.palier; prog.rating = R.niveau.note; prog.correctRun = 0; prog.wrongRun = 0;
      if (Array.isArray(prog.ratingHistory)) prog.ratingHistory.push({ t: Date.now(), r: R.niveau.note });
      if (typeof saveProg === "function") saveProg();
      if (typeof renderProgress === "function") renderProgress();
    }
    if (R.force) {
      chemin.p.f = R.force; cheminEcrire();
      botLevel = R.force; if (typeof syncForce === "function") syncForce();
    }
  }
  testArreter();
  if (R.entree < CHEMIN_PLAN.length) cheminOuvrirChapitre(R.entree, "apprendre");
  else { setMode("apprendre"); goTop(); }
}
if ($("btnTestPasse")) $("btnTestPasse").onclick = () => testReponse(null);
if ($("btnTestSuite")) $("btnTestSuite").onclick = () => testSuivant();
if ($("btnTestAppliquer")) $("btnTestAppliquer").onclick = () => testSortir(true);
if ($("btnTestGarder")) $("btnTestGarder").onclick = () => testSortir(false);
/* Un seul ecran sur telephone : les lecons du chemin ont des textes plus longs
   que « Je debute ». Quand le tout depasse la hauteur de l'ecran, l'echiquier
   cede la place qui manque (jamais sous 240 px). Pendant un exercice il ne
   fait que retrecir : il ne bouge pas sous le doigt a chaque message. */
function leconAjuster(depuisZero) {
  const L = $("appLayout"), cadre = L && L.querySelector(".board-frame"); if (!cadre) return;
  if (depuisZero || mode !== "debut") cadre.style.maxWidth = "";
  if (mode !== "debut" || window.innerWidth >= 600) return;
  const trop = document.documentElement.scrollHeight - window.innerHeight;
  if (trop <= 0) return;
  const l = cadre.getBoundingClientRect().width;
  if (l > 240) cadre.style.maxWidth = Math.max(240, Math.floor(l - trop)) + "px";
}
if (typeof debutStatut === "function") {
  const av = debutStatut;
  debutStatut = function () { const r = av.apply(this, arguments); leconAjuster(false); return r; };
}
window.addEventListener("resize", () => { if (mode === "debut") leconAjuster(true); });
/* Le moteur des lecons cede l'ecran au test tant qu'il est ouvert. */
if (typeof debutCharger === "function") {
  const av = debutCharger;
  debutCharger = function () {
    if (test.actif && cheminD) { testRendre(); leconAjuster(true); return; }
    const r = av.apply(this, arguments);
    leconAjuster(true);
    return r;
  };
}
if (typeof handleDebutClick === "function") {
  const av = handleDebutClick;
  handleDebutClick = function (sq) { if (test.actif) { if (testEnCours()) testClic(sq); return; } return av.apply(this, arguments); };
}

/* ---------- L'onglet ---------- */
function apRendre() {
  const pane = $("pane-apprendre"); if (!pane) return;
  /* Carte du test : tant qu'il n'a ete ni fait ni ecarte. */
  $("apTest").classList.toggle("hide", !!chemin.p);
  $("apRefaire").classList.toggle("hide", !chemin.p);
  $("apTestRefaire").textContent = chemin.p && chemin.p.t ? t("Take the placement test again") : t("Take the placement test");
  const courant = cheminCourant(), liste = $("apChemin");
  poserHtml(liste, "");
  CHEMIN_PLAN.forEach((c, i) => {
    const e = cheminEtat(i), ouvert = cheminOuvert(i), d = cheminCh(c.id);
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button";
    b.className = "ap-chap" + (e.fini ? " fait" : "") + (i === courant ? " encours" : "") + (ouvert ? "" : " verrou");
    b.dataset.ch = c.id;
    if (!ouvert) b.setAttribute("aria-disabled", "true");
    const titre = d ? d.titre : c.id === "debut" ? t("I'm a beginner") : "…";
    const sous = !ouvert ? t("Opens once chapter {n} is finished", { n: i })
      /* « Je debute » finit par une premiere partie a jouer, pas par un boss a battre. */
      : e.fini ? (c.id === "debut" || !c.boss ? t("Chapter completed") : e.boss ? t("Chapter completed, boss beaten") : t("Chapter completed. The boss is waiting →"))
      : e.commence ? t("Step {n} of {total}", { n: e.etape, total: e.etapes }) + " | " + t("Continue →")
      : t("Start →");
    poserHtml(b, '<span class="ap-num" aria-hidden="true">' + (i + 1) + '</span><span class="ap-txt"><b>' + echapper(titre) + "</b>" +
      '<span class="ap-desc">' + echapper(d ? d.desc : "") + "</span>" +
      (ouvert && e.commence && !e.fini ? '<span class="ap-barre" aria-hidden="true"><i style="width:' + Math.round(100 * e.faits / Math.max(1, e.total)) + '%"></i></span>' : "") +
      '<span class="ap-sub">' + echapper(sous) + "</span></span>");
    b.setAttribute("aria-label", t("Chapter {n}", { n: i + 1 }) + " : " + titre + ". " + sous);
    b.onclick = () => { if (cheminOuvert(i)) cheminOuvrirChapitre(i, "apprendre"); };
    li.appendChild(b); liste.appendChild(li);
  });
  const av = $("apVenir");
  av.textContent = cheminD ? cheminD.aVenir || "" : "";
  av.classList.toggle("hide", !av.textContent);
  /* « Revoir tes parties » : la liste existante, posee sous la carte. */
  if (!$("apPartiesPicto").firstChild && typeof pictoHtml === "function") poserHtml($("apPartiesPicto"), pictoHtml("erreurs"));
  let n = 0;
  try { n = toutesParties().length; } catch (e) {}
  const attente = apPartieEnAttente();
  $("apPartiesSub").textContent = attente ? t("Game in progress") + " →" : n ? t("Games to review: {n} →", { n: n }) : t("Play a game first: it will be waiting for you here.");
  /* Fiches de regles : memes pages, memes adresses. */
  const f = cheminFiches, boite = $("apFiches");
  if (f && !boite.firstChild) {
    poserHtml(boite, f.fiches.slice(0, 8).map(x => '<a href="' + echapper(x.u) + '">' + echapper(x.t) + "</a>").join(""));
    $("apFichesToutes").href = f.index;
    $("apFichesToutes").textContent = t("All the rule sheets →");
  }
}
function apPartieEnAttente() {
  try { return (typeof partieOrdiEnAttente === "function" && partieOrdiEnAttente()) || (typeof jouerPartieAmi === "function" && jouerPartieAmi()); } catch (e) { return false; }
}
/* Le bloc unique #historyPanel vient sous la carte, puis retourne a sa place
   quand on quitte l'onglet (placerHistorique, ui2.js, le reprend ensuite). */
function apPartiesOuvrir() {
  const hp = $("historyPanel"), bloc = $("apPartiesBloc"), carte = $("apParties"); if (!hp || !bloc) return;
  if (apPartieEnAttente()) { setMode(typeof navPartie === "function" && navPartie() || "play"); goTop(); return; }
  if (bloc.hidden) {
    if (hp.parentNode !== bloc) { hp.dataset.cacheJeu = hp.classList.contains("hide") ? "1" : ""; bloc.appendChild(hp); }
    hp.classList.remove("hide");
    if (typeof renderHistory === "function") renderHistory();
    bloc.hidden = false; carte.setAttribute("aria-expanded", "true");
    try { bloc.scrollIntoView({ behavior: mouvementCalme() ? "auto" : "smooth", block: "nearest" }); } catch (e) {}
  } else { apPartiesRanger(); }
}
function apPartiesRanger() {
  const hp = $("historyPanel"), bloc = $("apPartiesBloc"), pp = $("pane-play"); if (!hp || !bloc) return;
  if (hp.parentNode === bloc && pp) {
    const ref = $("pgnPanel");
    pp.insertBefore(hp, ref && ref.parentNode === pp ? ref : null);
    hp.classList.toggle("hide", hp.dataset.cacheJeu === "1");
  }
  bloc.hidden = true;
  if ($("apParties")) $("apParties").setAttribute("aria-expanded", "false");
}

/* ---------- Le bouton de l'accueil, et tout ce qui suit la progression ---------- */
function cheminMaj() {
  const h = $("heroDebut");
  if (h) {
    const c = cheminCourant();
    h.classList.toggle("hide", c < 0);
    if (c >= 0) h.textContent = cheminCommence() ? t("Continue: chapter {n}", { n: c + 1 }) : t("I'm a beginner");
  }
  if (mode === "apprendre") apRendre();
}
if ($("heroDebut")) $("heroDebut").onclick = () => {
  const c = cheminCourant();
  if (c >= 0) cheminOuvrirChapitre(c, "home"); else { setMode("apprendre"); goTop(); }
};

/* ---------- Ecran ---------- */
if (typeof ORDRE_ONGLETS !== "undefined") { ORDRE_ONGLETS.apprendre = 1.5; ORDRE_ONGLETS.debut = 1.5; ORDRE_ONGLETS.play = 1; ORDRE_ONGLETS.jouer = 1; }
{
  const avant = setMode;
  setMode = function (m, opts) {
    const pa = $("pane-apprendre"), d = mode;
    if (mode === "debut" && m !== "debut" && test.actif) testArreter();
    if (mode === "apprendre" && m !== "apprendre") apPartiesRanger();
    if (m === "apprendre" && pa) {
      /* Par l'ecran Explorer, qui sait deja tout masquer (comme jouer.js). */
      avant.call(this, "explore");
      const pe = $("pane-explore"); if (pe) { pe.classList.add("hide"); pe.classList.remove("arrivee", "arrivee-d", "arrivee-g"); }
      mode = "apprendre";
      document.body.dataset.mode = "apprendre";
      pa.classList.remove("hide");
      markTab($("tab-explore"), false);
      markTab($("tab-apprendre"), true);
      apRendre();
      cheminPret(true).then(() => { fichesCharger().then(() => { if (mode === "apprendre") apRendre(); }); if (mode === "apprendre") apRendre(); });
      if (d !== "apprendre" && typeof arriveePrete !== "undefined" && arriveePrete && !mouvementCalme() && pa.animate) {
        const a = ORDRE_ONGLETS[d], sens = a === undefined || a === 1.5 ? 0 : a < 1.5 ? 1 : -1;
        pa.animate([{ opacity: 0, transform: "translateX(" + (24 * sens) + "px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(.22,.7,.3,1)" });
      }
      return;
    }
    const r = avant.apply(this, arguments);
    if (pa) pa.classList.add("hide");
    markTab($("tab-apprendre"), mode === "debut");
    if (d === "debut" && mode !== "debut") leconAjuster(true);
    return r;
  };
}
if ($("tab-apprendre")) {
  $("tab-apprendre").onclick = () => { setMode("apprendre"); goTop(); };
  $("apTestGo").onclick = () => testLancer();
  $("apTestRefaire").onclick = () => testLancer();
  $("apTestPlusTard").onclick = () => { if (!chemin.p) { chemin.p = { x: 1 }; cheminEcrire(); } apRendre(); $("apTestRefaire").focus(); };
  $("apParties").onclick = apPartiesOuvrir;
}
/* L'adresse directe #start mene toujours au chapitre 1. */
if (typeof applyDeepLink === "function") {
  const av = applyDeepLink;
  applyDeepLink = function (d) {
    if (d && d.kind === "start") { testArreter(); cheminActiver("debut"); cheminOrigine = "home"; }
    return av.apply(this, arguments);
  };
}
/* Au chargement : la progression gardee, la force retenue par le test, puis
   le bouton de l'accueil. */
cheminPret(false).then(() => {
  try {
    if (chemin.p && chemin.p.f && NIVEAU_ELO[chemin.p.f] && !(typeof gameStarted !== "undefined" && gameStarted)) { botLevel = chemin.p.f; if (typeof syncForce === "function") syncForce(); }
  } catch (e) {}
  cheminMaj();
  repriseMaj();
});
