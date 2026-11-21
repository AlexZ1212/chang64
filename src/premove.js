/* chang64 - coups prepares a l'avance, piece saisie d'avance, fleches (2026-11-21)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Decisions d'Alexandre (QCM du 21/11) :
 * - coups prepares contre l'ordinateur et dans toutes les parties entre
 *   membres (direct, blitz, correspondance tant que l'ecran est ouvert) ; pas
 *   dans la partie par lien ni les exercices, ou l'on n'attend personne ;
 * - plusieurs coups a la suite : une file. L'echiquier montre la position
 *   comme si ces coups etaient joues, leurs cases teintees en bleu ;
 * - fleches et cercles au clic droit sur tous les echiquiers, parties
 *   comprises (c'est le joueur qui dessine, le site ne souffle rien), en vert.
 *
 * Coup prepare : pendant que l'adversaire reflechit, toucher sa piece puis la
 * case d'arrivee (ou la glisser). Le deplacement est accepte s'il suit la
 * marche de la piece, sans regarder ce qui la gene aujourd'hui : la position
 * aura change. Quand le coup adverse arrive, le premier de la file part s'il
 * est permis ; sinon toute la file est abandonnee, sans bruit. Une promotion
 * preparee donne une dame. Toucher ailleurs, ou un clic droit, annule tout.
 * Rien ne part au serveur avant que ce soit le tour du joueur : le serveur des
 * parties ne connait pas les coups prepares.
 *
 * Piece saisie d'avance : une piece selectionnee ou en cours de glissement
 * quand le coup adverse arrive reste en main ; le coup se finit normalement.
 *
 * Tout passe par des enveloppes (render, refreshGame, directRecu, setMode,
 * onSquare) et des ecouteurs poses sur l'echiquier : ui.js n'est pas modifie.
 */
const PRE_MAX = 10;          /* coups prepares a la suite, au plus */
let premoves = [];           /* la file : [{from, to}] */
let preCleVue = null;        /* la partie a laquelle la file appartient */
let preDrag = null;          /* glissement commence pendant le tour adverse */
let fleches = [], cercles = [];
let flecheDebut = -1;

/* Ma couleur dans la partie en cours, ou -1 hors d'une partie ou l'on attend un adversaire. */
function preMaCouleur() {
  try {
    if (reviewGame) return -1;
    if (mode === "play") return gameStarted && resigned === null && !resultInfo && !isFlagged() ? myColor : -1;
    if (mode === "friend" && typeof directActif === "function" && directActif() && directE && (directE.phase === "debut" || directE.phase === "jeu"))
      return directE.moi === "b" ? W : B;
  } catch (e) {}
  return -1;
}
/* J'attends le coup de l'adversaire : c'est le moment des coups prepares. */
function preContexte() {
  const c = preMaCouleur();
  if (c < 0) return false;
  return mode === "play" ? busy && game.turn !== c : game.turn !== c;
}
function preCle() { return mode === "play" ? game : mode === "friend" && directE ? directE.id + "/" + directE.n : null; }
const preNom = sq => "abcdefgh"[fOf(sq)] + (8 - rOf(sq));

/* Un coup prepare pose sur un plateau : la piece va a sa case, roque et
   promotion (en dame) compris. Pas de prise en passant : le coup sera de
   toute facon verifie au moment de partir. */
function preAppliquer(v, m) {
  const p = v[m.from];
  if (!p) return;
  const type = pT(p), rang = rOf(m.to);
  v[m.from] = 0;
  if (type === K && Math.abs(fOf(m.to) - fOf(m.from)) === 2) {
    const base = rOf(m.from) * 16;
    if (fOf(m.to) === 6) { v[base + 5] = v[base + 7]; v[base + 7] = 0; }
    else { v[base + 3] = v[base]; v[base] = 0; }
  }
  v[m.to] = type === P && (rang === 0 || rang === 7) ? mk(Q, pC(p)) : p;
}
/* Le plateau tel qu'il serait apres les coups prepares ; null s'il n'y en a pas. */
function preVue() {
  if (!premoves.length) return null;
  const v = Array.from(game.board);
  for (const m of premoves) preAppliquer(v, m);
  return v;
}
/* La piece de « from » peut-elle aller en « to » par sa marche, sans tenir compte des pieces sur son chemin ? */
function preAtteint(v, from, to) {
  const p = v[from];
  if (!p || from === to) return false;
  const df = fOf(to) - fOf(from), dr = rOf(to) - rOf(from), af = Math.abs(df), ar = Math.abs(dr), type = pT(p);
  if (type === N) return af * ar === 2;
  if (type === BI) return af === ar;
  if (type === R) return !df || !dr;
  if (type === Q) return af === ar || !df || !dr;
  if (type === K) return (af <= 1 && ar <= 1) || (!dr && af === 2 && fOf(from) === 4 && (rOf(from) === 0 || rOf(from) === 7));
  const sens = pC(p) === W ? -1 : 1, depart = pC(p) === W ? 6 : 1;
  return (!df && (dr === sens || (dr === 2 * sens && rOf(from) === depart))) || (af === 1 && dr === sens);
}
function preAnnuler() {
  const avait = premoves.length > 0, choisi = selected >= 0;
  premoves = []; selected = -1;
  if (avait) { try { announce(t("Prepared moves cancelled.")); } catch (e) {} }
  if (avait || choisi) render();
}
/* Un appui sur une case pendant le tour de l'adversaire. */
function preClic(sq) {
  const c = preMaCouleur(), v = preVue() || game.board, p = v[sq];
  const mienne = x => !!x && pC(x) === c;
  if (selected >= 0 && selected !== sq && mienne(v[selected]) && !mienne(p) && preAtteint(v, selected, sq) && premoves.length < PRE_MAX) {
    premoves.push({ from: selected, to: sq });
    preCleVue = preCle();
    try { announce(t("Move prepared: {from} to {to}", { from: preNom(selected), to: preNom(sq) })); } catch (e) {}
    selected = -1;
    render();
    return;
  }
  /* Une de mes pieces : je la prends (ou la repose). Ailleurs : tout s'annule. */
  if (mienne(p)) { selected = selected === sq ? -1 : sq; render(); return; }
  preAnnuler();
}
/* C'est (peut-etre) mon tour : le premier coup de la file part s'il est permis. */
function preJouer() {
  if (!premoves.length) return;
  const c = preMaCouleur();
  if (c < 0 || preCle() !== preCleVue) { premoves = []; render(); return; }
  if (game.turn !== c || (mode === "play" && busy) || pendingPromo) return;
  if (mode === "friend" && (directAttenteCoup || !directF)) return;
  const m = premoves[0], cands = game.moves().filter(x => x.from === m.from && x.to === m.to);
  const coup = cands.find(x => x.promo === Q) || cands[0];
  if (!coup) { premoves = []; selected = -1; render(); return; }
  premoves.shift();
  selected = -1;
  if (mode === "play") playUser(coup); else directJouer(coup);
}

/* ---------- Affichage ---------- */
/* Apres le rendu ordinaire : les pieces des coups prepares sont montrees a
   leur case d'arrivee, et les cases de la file sont teintees. */
function preRendre() {
  if (!premoves.length) return;
  const c = preMaCouleur();
  if (c < 0 || preCle() !== preCleVue) { premoves = []; return; }
  const v = preVue(), cells = boardEl.children, teinte = {};
  for (const m of premoves) { teinte[m.from] = 1; teinte[m.to] = 1; }
  for (let i = 0; i < 64; i++) {
    const sq = idxToSq(i), cell = cells[i], p = v[sq];
    if (teinte[sq]) cell.classList.add("pre");
    if (p === game.board[sq]) continue;
    const ancienne = cell.querySelector(".piece");
    if (ancienne) ancienne.remove();
    if (p) {
      const cc = pC(p) === W ? "w" : "b";
      cell.insertAdjacentHTML("beforeend", '<span class="piece" data-sq="' + sq + '" data-p="' + cc + SYM[pT(p)] + '">' + pieceSVG(SYM[pT(p)], cc) + "</span>");
    }
    cell.setAttribute("aria-label", sqLabel(sq, p));
  }
}
/* Fleches et cercles traces par le joueur : un calque au-dessus des cases, qui ne prend aucun clic. */
function flechesPermises() {
  try {
    if (mode === "edit" || coord) return false;
    const bw = boardEl.closest(".board-wrap");
    return !(bw && bw.classList.contains("hide"));
  } catch (e) { return false; }
}
function flechesRendre() {
  let svg = document.getElementById("fleches");
  if (!fleches.length && !cercles.length) { if (svg) svg.textContent = ""; return; }
  if (!svg) {
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "fleches";
    svg.setAttribute("class", "fleches");
    svg.setAttribute("viewBox", "0 0 8 8");
    svg.setAttribute("aria-hidden", "true");
    boardEl.insertAdjacentElement("afterend", svg);
  }
  svg.style.left = boardEl.offsetLeft + "px"; svg.style.top = boardEl.offsetTop + "px";
  svg.style.width = boardEl.offsetWidth + "px"; svg.style.height = boardEl.offsetHeight + "px";
  const centre = sq => [(flipped ? 7 - fOf(sq) : fOf(sq)) + 0.5, (flipped ? 7 - rOf(sq) : rOf(sq)) + 0.5];
  const n = x => x.toFixed(3);
  let h = "";
  for (const sq of cercles) { const [x, y] = centre(sq); h += '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="0.44"/>'; }
  for (const f of fleches) {
    const [x1, y1] = centre(f.from), [x2, y2] = centre(f.to), d = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / d, uy = (y2 - y1) / d;
    const bx = x2 - ux * 0.36, by = y2 - uy * 0.36, l = 0.24;
    h += '<line x1="' + n(x1 + ux * 0.3) + '" y1="' + n(y1 + uy * 0.3) + '" x2="' + n(bx) + '" y2="' + n(by) + '"/>' +
      '<polygon points="' + n(x2) + "," + n(y2) + " " + n(bx - uy * l) + "," + n(by + ux * l) + " " + n(bx + uy * l) + "," + n(by - ux * l) + '"/>';
  }
  svg.innerHTML = h;
}
function flechesEffacer() {
  if (!fleches.length && !cercles.length) return;
  fleches = []; cercles = [];
  flechesRendre();
}

/* ---------- Branchements ---------- */
if (typeof boardEl !== "undefined" && boardEl) {
  { const avant = render; render = function () { const r = avant.apply(this, arguments); preRendre(); flechesRendre(); return r; }; }
  /* Contre l'ordinateur : son coup vient d'etre joue, le mien peut partir. */
  { const avant = refreshGame; refreshGame = function () { const r = avant.apply(this, arguments); if (premoves.length) setTimeout(preJouer, 0); return r; }; }
  /* Entre membres : l'etat recu du serveur donne (ou non) le trait. */
  if (typeof directRecu === "function") { const avant = directRecu; directRecu = function () { const r = avant.apply(this, arguments); if (premoves.length) preJouer(); return r; }; }
  /* Changer d'ecran : la file et les dessins ne suivent pas. */
  { const avant = setMode; setMode = function () { premoves = []; preDrag = null; fleches = []; cercles = []; const r = avant.apply(this, arguments); flechesRendre(); return r; }; }
  /* Clavier : Entree ou Espace sur une case passe par onSquare. */
  { const avant = onSquare; onSquare = function (e) {
    if (e && e.type === "keydown" && !pendingPromo && preContexte()) { preClic(idxToSq(Array.prototype.indexOf.call(boardEl.children, e.currentTarget))); return; }
    return avant.apply(this, arguments);
  }; }
  /* Souris et doigt : avant les cases elles-memes, pour que le tour adverse ne soit plus un temps mort. */
  boardEl.addEventListener("click", e => {
    flechesEffacer();
    if (pendingPromo || !preContexte()) return;
    const cell = e.target && e.target.closest ? e.target.closest(".sq") : null;
    if (!cell) return;
    e.stopPropagation();
    if (suppressClick) return;
    preClic(idxToSq(Array.prototype.indexOf.call(boardEl.children, cell)));
  }, true);
  /* Glisser une de mes pieces pendant le tour adverse. */
  boardEl.addEventListener("pointerdown", e => {
    if (e.button === 2) {
      if (!flechesPermises()) return;
      /* Le clic droit annule d'abord ce qui est prepare ; sinon il dessine. */
      if (premoves.length || (preContexte() && selected >= 0)) { preAnnuler(); flecheDebut = -1; return; }
      flecheDebut = squareFromPoint(e.clientX, e.clientY);
      return;
    }
    if (e.button > 0 || pendingPromo || !preContexte()) return;
    const sq = squareFromPoint(e.clientX, e.clientY);
    if (sq < 0) return;
    const p = (preVue() || game.board)[sq];
    if (!p || pC(p) !== preMaCouleur()) return;
    preDrag = { from: sq, x: e.clientX, y: e.clientY, moved: false, ghost: null, p };
  });
  boardEl.addEventListener("pointermove", e => {
    const d = preDrag;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) < 6) return;
    if (!d.moved) {
      d.moved = true;
      try { boardEl.setPointerCapture(e.pointerId); } catch (x) {}
      const el = document.createElement("div"), r = boardEl.getBoundingClientRect();
      el.className = "dragghost";
      el.style.cssText = "position:fixed;pointer-events:none;z-index:60;width:" + (r.width / 8 * 0.86) + "px;height:" + (r.height / 8 * 0.86) + "px;transform:translate(-50%,-50%)";
      poserHtml(el, pieceSVG(SYM[pT(d.p)], pC(d.p) === W ? "w" : "b"));
      document.body.appendChild(el);
      d.ghost = el;
      if (selected !== d.from) { selected = d.from; render(); }
    }
    d.ghost.style.left = e.clientX + "px"; d.ghost.style.top = e.clientY + "px";
  });
  const preLacher = e => {
    const d = preDrag;
    if (!d) return;
    preDrag = null;
    if (d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
    if (!d.moved || e.type === "pointercancel") return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 60);
    const to = squareFromPoint(e.clientX, e.clientY);
    if (to < 0 || to === d.from) { selected = -1; render(); return; }
    selected = d.from;
    /* Le coup adverse est arrive pendant le geste : c'est un coup ordinaire. */
    if (preContexte()) preClic(to); else modeClick(to);
  };
  boardEl.addEventListener("pointerup", preLacher);
  boardEl.addEventListener("pointercancel", preLacher);
  /* Clic droit : pas de menu du navigateur sur l'echiquier ; relache sur la
     meme case = un cercle, sur une autre = une fleche ; refait = efface. */
  boardEl.addEventListener("contextmenu", e => { if (flechesPermises()) e.preventDefault(); });
  window.addEventListener("pointerup", e => {
    if (e.button !== 2 || flecheDebut < 0) return;
    const a = flecheDebut, z = squareFromPoint(e.clientX, e.clientY);
    flecheDebut = -1;
    if (z < 0 || !flechesPermises()) return;
    if (a === z) { const i = cercles.indexOf(a); if (i >= 0) cercles.splice(i, 1); else cercles.push(a); }
    else { const i = fleches.findIndex(f => f.from === a && f.to === z); if (i >= 0) fleches.splice(i, 1); else fleches.push({ from: a, to: z }); }
    flechesRendre();
  });
  window.addEventListener("resize", flechesRendre);
}
