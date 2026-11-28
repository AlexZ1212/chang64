/* chang64 - les liens vers les lecons (2026-11-28)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Choix d'Alexandre (QCM du 28/11) : aux endroits ou l'on se trompe, une ligne
 * « Pour comprendre : la fourchette de cavalier ». La lecon s'ouvre SUR PLACE,
 * dans un volet qui se deplie dessous (petit echiquier, premier paragraphe de
 * la lecon du site, « Lire la lecon en entier », « S'entrainer ») : on ne
 * quitte pas l'ecran, rien a faire pour revenir. Toutes les pistes retenues :
 *   P1 apres un exercice            P5 Erreurs a revoir
 *   P2 sous le coach                P7 fiche d'un badge
 *   P3 une partie nulle dit pourquoi P8 fin de chapitre d'Apprendre
 *   P4 une finale atteinte          P9 Gaffe, Erreur, Imprecision, Elo
 *   A  le nom de l'ouverture n'est plus un lien pendant une partie en cours
 * (P6, les pages du site entre elles, est faite a la construction, content.js.)
 *
 * Jamais pendant le jeu : un lien n'apparait qu'une fois l'exercice ou la
 * partie finie, jamais pendant un Sprint ni un duel d'exercices.
 *
 * FICHIER A PART. Le script principal est a 2 000 caracteres de son garde-fou
 * (600 000, check_poids_script.js). Ce fichier est appele en defer par la page
 * (template.html), donc execute apres le script principal : il enveloppe ses
 * fonctions globales, comme coach.js et navigation.js le font deja. S'il ne se
 * charge pas, aucun lien n'apparait et rien ne casse. Les textes viennent de
 * data/lecons-<langue>.json (content.js), charge des que la page est prete. */
(function () {
  "use strict";
  if (typeof document === "undefined" || typeof t !== "function") return;
  const $i = id => document.getElementById(id);
  const ech = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- Les donnees ---------- */
  let D = null, attente = null;
  const apresChargement = [];
  function charger() {
    if (D) return Promise.resolve(D);
    if (!attente && typeof fetch === "function") {
      const lire = l => fetch("/data/lecons-" + l + ".json").then(r => { if (!r.ok) throw new Error("lecons"); return r.json(); });
      attente = lire(typeof LANG === "string" ? LANG : "en").catch(() => lire("en"))
        .then(d => { D = d; while (apresChargement.length) { try { apresChargement.shift()(); } catch (e) {} } return d; })
        .catch(() => { attente = null; return null; });
    }
    return attente || Promise.resolve(null);
  }
  /* Rappelle f une fois les donnees la (tout de suite si elles y sont). */
  function quandPret(f) { if (D) f(); else { apresChargement.push(f); charger(); } }

  /* Motif de Resoudre -> lecon du site (meme table que THEME_DE_LA_PAGE,
     content.js, dans l'autre sens). Mat en un, deux, trois : pas de page, le
     chapitre d'Apprendre s'il est ouvert. Coup gagnant : rien. */
  const MOTIF_LECON = {
    "Winning capture": "spotting-a-hanging-piece", "Knight fork": "knight-fork", "Pawn fork": "pawn-fork",
    "Double attack": "double-attack", "Pin": "the-pin", "Skewer": "the-skewer", "Back-rank mate": "back-rank-mate",
    "Deflection": "deflection", "Quiet move": "the-quiet-move"
  };
  const MOTIF_CHAPITRE = { "Mate in one": "mats", "Mate in two": "mat2", "Mate in three": "mat2" };
  /* Cas du coach (coach.js) -> lecon. Les fourchettes dependent de la piece. */
  const CAS_LECON = {
    en_prise: "spotting-a-hanging-piece", prise_manquee: "spotting-a-hanging-piece", prise_perdante: "spotting-a-hanging-piece",
    mat1_manque: "check-checkmate-stalemate", mat1_permis: "check-checkmate-stalemate",
    promo_manquee: "pawn-promotion", pat: "how-games-are-drawn"
  };
  const VERDICT_MOT = { blunder: "blunder", mistake: "mistake", inacc: "inaccuracy" };

  /* ---------- Le volet ---------- */
  /* cle : slug anglais d'une lecon, ou « g:<slug> » pour un mot du lexique. */
  function entree(cle) {
    if (!D || !cle) return null;
    return cle.slice(0, 2) === "g:" ? (D.g || {})[cle.slice(2)] || null : (D.l || {})[cle] || null;
  }
  let numero = 0;
  /* Le HTML d'un volet replie : la ligne, et le corps vide (rempli au
     depliage). Rien si la lecon n'existe pas ou si les donnees manquent. */
  function voletHtml(cle, libelle) {
    const e = entree(cle);
    if (!e) return "";
    const id = "leconCorps" + (++numero);
    const ligne = libelle || t("To understand: {lesson}", { lesson: e.t });
    return '<div class="lecon-volet hors-sprint" data-lecon="' + ech(cle) + '">' +
      '<button type="button" class="lecon-ligne" aria-expanded="false" aria-controls="' + id + '"><span>' + ech(ligne) + '</span><i class="lecon-chev" aria-hidden="true"></i></button>' +
      '<div class="lecon-corps" id="' + id + '" hidden></div></div>';
  }
  /* Une ligne qui mene ailleurs dans l'application (chapitre, finale). */
  function lienHtml(libelle, attrs) {
    return '<div class="lecon-volet hors-sprint"><button type="button" class="lecon-ligne lecon-aller" ' + attrs + '><span>' + ech(libelle) + '</span><i class="lecon-chev" aria-hidden="true"></i></button></div>';
  }
  /* Petit echiquier dessine dans la page, aux couleurs du damier choisi. */
  function plateau(fenPlace) {
    if (!fenPlace || typeof pieceSVG !== "function") return "";
    const T = { p: "p", n: "n", b: "b", r: "r", q: "q", k: "k" };
    let h = "", r = 0;
    for (const rang of fenPlace.split("/")) {
      let f = 0;
      for (const c of rang) {
        if (/\d/.test(c)) { for (let k = 0; k < +c; k++) { h += '<i class="' + ((r + f) % 2 ? "d" : "l") + '"></i>'; f++; } continue; }
        const lo = c.toLowerCase();
        h += '<i class="' + ((r + f) % 2 ? "d" : "l") + '">' + (T[lo] ? pieceSVG(lo, c === lo ? "b" : "w") : "") + "</i>";
        f++;
      }
      r++;
    }
    return '<span class="lecon-plateau" aria-hidden="true">' + h + "</span>";
  }
  function corpsHtml(cle) {
    const e = entree(cle);
    if (!e) return "";
    const mot = cle.slice(0, 2) === "g:";
    return '<div class="lecon-fond">' + plateau(e.f) + "<p>" + e.p + "</p></div>" +
      '<p class="lecon-actions"><a href="' + ech(e.u) + '">' + ech(mot ? t("Glossary") + " →" : t("Read the whole lesson")) + "</a>" +
      (e.m && typeof applyDeepLink === "function" && !(typeof motifPropose === "function" && !motifPropose(e.m))
        ? '<button type="button" class="linkbtn lecon-motif" data-motif="' + ech(e.m) + '">' + ech(t("Practise this theme in Solve →")) + "</button>" : "") + "</p>";
  }
  function basculer(b) {
    const corps = $i(b.getAttribute("aria-controls"));
    const v = corps && corps.closest(".lecon-volet");
    if (!corps || !v) return;
    const ouvrir = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", ouvrir ? "true" : "false");
    if (ouvrir && !corps.firstChild) poserHtml(corps, corpsHtml(v.getAttribute("data-lecon")));
    corps.hidden = !ouvrir;
  }
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest(".lecon-ligne[aria-controls]");
    if (b) { basculer(b); return; }
    const m = e.target.closest && e.target.closest(".lecon-motif");
    if (m) { applyDeepLink({ kind: "theme", name: m.getAttribute("data-motif") }); if (typeof goTop === "function") goTop(); return; }
    const a = e.target.closest && e.target.closest(".lecon-aller");
    if (!a) return;
    if (typeof bravoFermer === "function" && $i("bravo") && !$i("bravo").hidden && $i("bravo").contains(a)) bravoFermer();
    if (a.dataset.finale) applyDeepLink({ kind: "train", id: a.dataset.finale });
    else if (a.dataset.finales) setMode("puzzles", { screen: "endgames" });
    else if (a.dataset.chap && typeof cheminOuvrirChapitre === "function") cheminOuvrirChapitre(+a.dataset.chap);
    if (typeof goTop === "function") goTop();
  });
  /* Remplit un hote (cree au besoin apres « apres ») ; vide si html est vide. */
  function hote(id, apres, classe) {
    let h = $i(id);
    if (!h && apres && apres.parentNode) {
      h = document.createElement("div");
      h.id = id; h.className = "lecons-hote" + (classe ? " " + classe : "");
      apres.parentNode.insertBefore(h, apres.nextSibling);
    }
    return h;
  }
  function poser(h, html) { if (!h) return; poserHtml(h, html || ""); h.hidden = !html; }

  /* Chapitre d'Apprendre d'un id, s'il est ouvert : { i, titre }. */
  function chapitre(id) {
    try {
      const i = cheminIndex(id), c = cheminCh(id);
      if (i < 0 || !c || !cheminOuvert(i)) return null;
      return { i: i, titre: c.titre };
    } catch (e) { return null; }
  }
  /* La ligne d'un motif de Resoudre : lecon du site, ou chapitre ouvert. */
  function motifHtml(theme) {
    if (MOTIF_LECON[theme]) return voletHtml(MOTIF_LECON[theme]);
    const c = MOTIF_CHAPITRE[theme] && chapitre(MOTIF_CHAPITRE[theme]);
    return c ? lienHtml(t("To understand: {lesson}", { lesson: c.titre }), 'data-chap="' + c.i + '"') : "";
  }

  /* ---------- P1. Apres un exercice ---------- */
  function exoHors() {
    try { return !!(typeof rush !== "undefined" && rush) || (typeof duelIci === "function" && duelIci()); } catch (e) { return true; }
  }
  function exoLecon() {
    const h = hote("exLecon", $i("exPedagogy"), "hors-sprint");
    if (!h) return;
    const pz = typeof puzzle !== "undefined" ? puzzle : null;
    if (!pz || !pz.theme || exoHors() || typeof puzzleDone === "undefined" || !puzzleDone) { poser(h, ""); return; }
    const id = pz.id;
    quandPret(() => { if (typeof puzzle !== "undefined" && puzzle && puzzle.id === id && puzzleDone && !exoHors()) poser(h, motifHtml(pz.theme)); });
  }
  if (typeof finishPuzzle === "function") {
    const av = finishPuzzle;
    finishPuzzle = function () { const r = av.apply(this, arguments); try { exoLecon(); } catch (e) {} return r; };
  }
  if (typeof loadPuzzle === "function") {
    const av = loadPuzzle;
    loadPuzzle = function () { poser($i("exLecon"), ""); return av.apply(this, arguments); };
  }

  /* ---------- P2. Sous le coach ---------- */
  function casLecon(i, e) {
    if (CAS_LECON[e.cas]) return CAS_LECON[e.cas];
    if (e.cas === "fourchette_permise" || e.cas === "fourchette_manquee") {
      try {
        const g = rebuildTo(i).game;
        if (e.de === "apres") { const m = g.moves().find(x => g.uci(x) === gameUci[i]); if (m) g.makeMove(m); }
        const p = g.board[nSq(e.coup.slice(0, 2))];
        return pT(p) === N ? "knight-fork" : pT(p) === P ? "pawn-fork" : "double-attack";
      } catch (x) { return "double-attack"; }
    }
    return "";
  }
  function coachLecons() {
    const bloc = $i("coachBloc");
    if (!bloc) return;
    const h = hote("coachLecons", $i("coachListe"));
    if (typeof analysis === "undefined" || !analysis || !analysis.coach || bloc.classList.contains("hide")) { poser(h, ""); return; }
    quandPret(() => {
      if (typeof analysis === "undefined" || !analysis || !analysis.coach) return;
      const vues = [];
      analysis.plies.forEach((p, i) => {
        if (p.mover !== myColor || (p.tag !== "blunder" && p.tag !== "mistake")) return;
        const x = analysis.coach[i];
        const cle = x && x.e ? casLecon(i, x.e) : "";
        if (cle && !vues.includes(cle) && vues.length < 3) vues.push(cle);
      });
      const v = vues.map(c => voletHtml(c, entree(c) ? entree(c).t : "")).join("");
      poser(h, v ? '<p class="tiroir-section lecons-titre">' + ech(t("To understand")) + "</p>" + v : "");
    });
  }
  if (typeof coachAfficher === "function") {
    const av = coachAfficher;
    coachAfficher = function () { const r = av.apply(this, arguments); try { coachLecons(); } catch (e) {} return r; };
  }

  /* ---------- P3 et P4. Fin de partie ---------- */
  function raisonNulle(g) {
    try {
      if (g.isStalemate()) return "";
      if (g.isInsufficient()) return t("Draw: not enough pieces left to checkmate.");
      if (g.half >= 100) return t("Draw: fifty moves without a capture or a pawn move.");
      if (g.isRepetition()) return t("Draw by repetition: the same position came up three times.");
    } catch (e) {}
    return "";
  }
  /* Finale de l'entraineur (ENDGAMES, ui3.js) sur l'echiquier final, avec le
     camp « moi » du cote fort : son id, sinon "". */
  function finaleAtteinte(g, moi) {
    try {
      const a = [], b = [];
      for (let sq = 0; sq < 128; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        const p = g.board[sq];
        if (!p || pT(p) === K) continue;
        (pC(p) === moi ? a : b).push("?PNBRQ"[pT(p)]);
      }
      if (b.length) return "";
      const sig = a.sort().join("");
      const s = (typeof ENDGAMES !== "undefined" ? ENDGAMES : []).find(x => x.white.slice().sort().join("") === sig);
      return s ? s.id : "";
    } catch (e) { return ""; }
  }
  function finLecons(statusId, moi) {
    const h = hote(statusId === "amiStatus" ? "amiFinLecon" : "finLecon", $i(statusId));
    if (!h) return;
    if (!resultInfo || typeof game === "undefined" || !game) { poser(h, ""); return; }
    const nulle = resultInfo.kind === "draw";
    const fin = finaleAtteinte(game, moi);
    quandPret(() => {
      let html = "";
      if (fin && typeof ENDGAMES !== "undefined") {
        const s = ENDGAMES.find(x => x.id === fin);
        const phrase = nulle && fin !== "kp" ? t("This endgame is always a win: practise the mate.")
          : t("You reached the {endgame} endgame: practise it until you mate every time.", { endgame: t(s.name) });
        html += lienHtml(phrase, 'data-finale="' + fin + '"');
      }
      if (nulle) {
        let pat = false;
        try { pat = game.isStalemate(); } catch (e) {}
        html += voletHtml(pat ? "check-checkmate-stalemate" : "how-games-are-drawn");
      }
      if (resultInfo) poser(h, html);
    });
  }
  /* Contre l'ordinateur : la raison de la nulle remplace « La partie est
     nulle. » des que gameOver la constate (avant la carte de fin). */
  if (typeof gameOver === "function") {
    const av = gameOver;
    gameOver = function () {
      const r = av.apply(this, arguments);
      try {
        if (r && resultInfo && resultInfo.kind === "draw" && resultInfo.sub === t("The game is drawn.")) {
          const x = raisonNulle(game);
          if (x) { resultInfo.sub = x; const s = $i("status"); if (s) s.textContent = x; }
        }
      } catch (e) {}
      return r;
    };
  }
  if (typeof renderResult === "function") {
    const av = renderResult;
    renderResult = function (show) {
      try {
        /* Entre amis : meme phrase, posee avant la carte. */
        if (show && mode === "friend" && resultInfo && resultInfo.kind === "draw" && resultInfo.sub === t("The game is drawn.")) {
          const x = raisonNulle(game);
          if (x) { resultInfo.sub = x; const s = $i("amiStatus"); if (s) s.textContent = x; }
        }
      } catch (e) {}
      const r = av.apply(this, arguments);
      try {
        const enDirect = typeof directActif === "function" && directActif();
        if (mode === "play") finLecons("status", typeof myColor !== "undefined" ? myColor : W);
        else if (mode === "friend" && !enDirect) finLecons("amiStatus", typeof amiColor !== "undefined" ? amiColor : W);
        if (!show || !resultInfo) { poser($i("finLecon"), ""); poser($i("amiFinLecon"), ""); }
      } catch (e) {}
      return r;
    };
  }

  /* ---------- P5. Erreurs a revoir ---------- */
  function erreursLecon() {
    const box = $i("mistakeGrid");
    if (!box || !box.firstChild || typeof prog === "undefined" || !prog || !Array.isArray(prog.mistakeQueue)) return;
    quandPret(() => {
      if (!box.firstChild || box.querySelector(".lecons-revient")) return;
      const now = Date.now(), par = {};
      prog.mistakeQueue.filter(m => (m.due || 0) <= now && m.theme && MOTIF_LECON[m.theme]).forEach(m => { par[m.theme] = (par[m.theme] || 0) + 1; });
      const th = Object.keys(par).sort((a, b) => par[b] - par[a] || t(a).localeCompare(t(b)))[0];
      if (!th) return;
      const v = voletHtml(MOTIF_LECON[th], t("To understand: {lesson}", { lesson: entree(MOTIF_LECON[th]).t }));
      if (!v) return;
      const d = document.createElement("div");
      d.className = "lecons-revient";
      poserHtml(d, '<p class="lecons-phrase">' + ech(t("What comes back most: {pattern}.", { pattern: t(th) })) + "</p>" + v);
      const avant = box.querySelector(".erreurs-maitrise");
      box.insertBefore(d, avant || null);
    });
  }
  if (typeof renderMistakeQueue === "function") {
    const av = renderMistakeQueue;
    renderMistakeQueue = function () { const r = av.apply(this, arguments); try { erreursLecon(); } catch (e) {} return r; };
  }

  /* ---------- P7. La fiche d'un badge ---------- */
  const MOTIF_BADGE = { winning_capture: "Winning capture", double_attack: "Double attack", skewer: "Skewer",
    knight_fork: "Knight fork", back_rank_mate: "Back-rank mate", pin: "Pin", pawn_fork: "Pawn fork",
    deflection: "Deflection", quiet_move: "Quiet move", mate_in_one: "Mate in one", mate_in_two: "Mate in two",
    mate_in_three: "Mate in three" };
  if (typeof BX_LIENS !== "undefined" && !BX_LIENS.lec_berger) BX_LIENS.lec_berger = ["p", "scholars-mate"];
  function badgeHtml(id) {
    let m = /^theme_([a-z_]+?)(?:_10|_100)?$/.exec(id);
    if (m && MOTIF_BADGE[m[1]]) return motifHtml(MOTIF_BADGE[m[1]]);
    m = /^eg_(kq|kr|krr|kbn|kp)$/.exec(id);
    if (m) return lienHtml(t("Practise this endgame"), 'data-finale="' + m[1] + '"');
    if (id === "eg_toutes" || id === "eg_pat") return lienHtml(t("Endgames"), 'data-finales="1"');
    m = /^ch_([a-z0-9]+)$/.exec(id);
    if (m) { const c = chapitre(m[1]); return c ? lienHtml(t("Open the chapter"), 'data-chap="' + c.i + '"') : ""; }
    if (/^rating_\d+$/.test(id)) return voletHtml("g:elo-rating");
    return "";
  }
  if (typeof bxPoserLien === "function") {
    const av = bxPoserLien;
    bxPoserLien = function (id) {
      const r = av.apply(this, arguments);
      try {
        const h = hote("bravoLecon", $i("bravoLien"));
        poser(h, "");
        quandPret(() => { if ($i("bravo") && !$i("bravo").hidden) poser(h, badgeHtml(id)); });
      } catch (e) {}
      return r;
    };
  }

  /* ---------- P8. Fin de chapitre d'Apprendre ---------- */
  function chapitrePlus() {
    const h = hote("leconPlus", $i("leconTheme"));
    if (!h) return;
    const id = typeof leconCh !== "undefined" ? leconCh : "";
    quandPret(() => {
      let v = "";
      const dirs = (typeof PAGE_LANGUE !== "undefined" && PAGE_LANGUE.dirs) || {};
      if (id === "regles" && dirs.learn) v = '<p class="lecons-lien"><a href="/' + ech(dirs.learn) + '/">' + ech(t("All the rule sheets →")) + "</a></p>";
      else if (id === "ouverture") v = voletHtml("opening-principles") + (dirs.traps ? '<p class="lecons-lien"><a href="/' + ech(dirs.traps) + '/">' + ech(t("Opening traps")) + " →</a></p>" : "");
      else if (id === "finales") v = lienHtml(t("Endgames"), 'data-finales="1"');
      poser(h, v ? '<p class="tiroir-section lecons-titre">' + ech(t("To go further")) + "</p>" + v : "");
    });
  }
  if (typeof leconFinRendre === "function") {
    const av = leconFinRendre;
    leconFinRendre = function () { const r = av.apply(this, arguments); try { chapitrePlus(); } catch (e) {} return r; };
  }
  /* L'ecran de fin de chapitre partage sa place avec les lecons : on retire
     la ligne des que l'ecran repart sur une lecon. */
  if (typeof debutCharger === "function") {
    const av = debutCharger;
    debutCharger = function () { poser($i("leconPlus"), ""); return av.apply(this, arguments); };
  }

  /* ---------- P9. Gaffe, Erreur, Imprecision ; Elo ---------- */
  function plyMot() {
    const box = $i("plyInfo");
    if (!box || box.classList.contains("hide") || typeof analysis === "undefined" || !analysis) return;
    if (typeof partieEnCours === "function" && partieEnCours()) return;
    const plyVu = reviewPly !== null ? reviewPly : analysis.plies.length;
    const a = analysis.plies[plyVu - 1];
    const cle = a && VERDICT_MOT[a.tag];
    const span = box.querySelector(".coach-verdict, .verdict");
    if (!cle || !span || box.querySelector(".lecon-mot")) return;
    quandPret(() => {
      const e = entree("g:" + cle);
      if (!e || !box.contains(span) || box.querySelector(".lecon-mot")) return;
      const id = "leconCorps" + (++numero);
      const mot = t(VERDICT[a.tag]);
      const b = document.createElement("button");
      b.type = "button"; b.className = "lecon-ligne lecon-mot";
      b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-controls", id);
      b.setAttribute("aria-label", t("What does “{word}” mean?", { word: mot }));
      b.textContent = "?";
      span.insertAdjacentElement("afterend", b);
      const v = document.createElement("div");
      v.className = "lecon-volet lecon-volet-mot"; v.setAttribute("data-lecon", "g:" + cle);
      const c = document.createElement("div");
      c.className = "lecon-corps"; c.id = id; c.hidden = true;
      v.appendChild(c); box.appendChild(v);
    });
  }
  if (typeof renderPlyInfo === "function") {
    const av = renderPlyInfo;
    renderPlyInfo = function () { const r = av.apply(this, arguments); try { plyMot(); } catch (e) {} return r; };
  }
  if (typeof eloBloc === "function") {
    const av = eloBloc;
    eloBloc = function () {
      const r = av.apply(this, arguments);
      try {
        const v = voletHtml("g:elo-rating");
        const i = r.lastIndexOf("</details>");
        if (v && i > 0) return r.slice(0, i) + v + r.slice(i);
      } catch (e) {}
      return r;
    };
  }

  /* ---------- A. Le nom de l'ouverture pendant une partie ---------- */
  /* Pendant une partie en cours, le nom reste mais n'est plus un lien : la
     page de l'ouverture montre la suite des coups (une aide), et la suivre
     faisait quitter la partie, pendule en marche. Partie finie et relecture :
     le lien revient. */
  if (typeof renderOpening === "function") {
    const av = renderOpening;
    renderOpening = function () {
      const r = av.apply(this, arguments);
      try {
        const el = $i("opening"), a = el && el.querySelector("a");
        if (a && mode === "play" && gameStarted && !resultInfo && !(typeof isReviewGame !== "undefined" && isReviewGame)) el.textContent = a.textContent;
      } catch (e) {}
      return r;
    };
    try { renderOpening(); } catch (e) {}
  }

  /* Les donnees arrivent tot : les lignes se posent sans attente au premier
     besoin. Puis on repasse sur ce qui est deja a l'ecran. */
  const demarrer = () => charger().then(() => {
    try { exoLecon(); } catch (e) {}
    try { coachLecons(); } catch (e) {}
    try { erreursLecon(); } catch (e) {}
  });
  if (typeof requestIdleCallback === "function") requestIdleCallback(demarrer, { timeout: 3000 }); else setTimeout(demarrer, 800);

  /* Pour les tests (node, jsdom) : les tables et les fonctions de calcul. */
  window.LECONS = { charger, entree, voletHtml, motifHtml, casLecon, raisonNulle, finaleAtteinte, badgeHtml,
    MOTIF_LECON, MOTIF_CHAPITRE, CAS_LECON };
})();
