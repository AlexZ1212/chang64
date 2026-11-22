#!/usr/bin/env node
/* Controle du coach de relecture sur un lot de parties (2026-11-22).

   Usage :
     node coach_controle.js --jouer --part=1/4 --parties=150   joue, relit, verifie
                                                               (long : hors de Claude, une part par processus)
     node coach_controle.js --bilan                            les chiffres
     node coach_controle.js --bilan --exemples=8               avec des phrases tirees au sort, par cas
     node coach_controle.js --bilan --faux                     le detail de chaque phrase fausse

   Pourquoi. Le 21/11, 28 761 phrases d'explication d'exercices sur 161 675
   etaient fausses (verif_explications.js). Le coach ne doit dire que des
   faits vrais sur l'echiquier. Ce script le mesure avant toute publication :
   taux de phrases dites, de phrases fausses (objectif : zero) et de fautes
   restees sans explication.

   Ce qu'il fait.
   1. Il fait jouer des parties de debutants : un joueur simule (l'ordinateur
      du site a faible force, qui joue en plus une part de coups au hasard,
      pour laisser des pieces en prise et rater des mats comme un debutant)
      contre l'ordinateur du site a ses quatre forces (700, 1100, 1600, 1900).
   2. Il relit chaque partie comme le site : Stockfish 18, profondeur 12, une
      evaluation par position, puis COACH.plis et COACH.relire (coach.js),
      le code meme de la page.
   3. Il verifie chaque phrase avec un programme a part, la fonction
      verifier() ci-dessous. Elle ne partage RIEN avec coach.js ni avec le
      moteur de regles du site : les coups legaux viennent de Stockfish
      (go perft 1), la position apres un coup et l'echec aussi (d), et les
      attaques d'une piece sont recalculees ici sur un tableau de 64 cases.
      Deux programmes independants doivent donc tomber d'accord.
   4. Il mesure aussi, a part, si le conseil tient plus profond : a
      profondeur 16, le coup joue est-il vraiment moins bon que le coup
      conseille ? Et combien de fautes expliquees donnent un exercice avec
      l'exigence stricte (COACH.net). */
const fs = require("fs"), path = require("path"), os = require("os");
const COACH = require(path.join(__dirname, "coach.js"));
const ARGS = process.argv.slice(2);
const opt = (n, d) => { const a = ARGS.find(x => x.startsWith("--" + n + "=")); return a ? a.split("=")[1] : d; };
const journalDe = i => path.join(__dirname, "coach-controle-" + i + ".jsonl");
const PROF = +opt("profondeur", 12), PROF_CONSEIL = +opt("profondeur-conseil", 16);

/* ============ 1. Les parties ============ */
/* L'ordinateur du site (engine_browser.js n'est pas un module : on l'evalue). */
function chargerSite() {
  const src = fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8");
  return new Function(src + ";return {Game:Game,coupOrdinateur:coupOrdinateur};")();
}
/* Hasard reproductible : la meme part rejoue les memes tirages. */
function hasard(graine) {
  let a = graine >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/* Quatre debutants simules : part de coups tires au hasard, et force de
   l'ordinateur du site pour les autres coups. */
const PROFILS = [
  { nom: "hasard30", hasard: 0.30, elo: 600 },
  { nom: "hasard15", hasard: 0.15, elo: 850 },
  { nom: "hasard5", hasard: 0.05, elo: 1100 },
  { nom: "site700", hasard: 0, elo: 700 }
];
const FORCES = [700, 1100, 1600, 1900];
function jouerPartie(SITE, rnd, profil, eloAdv, joueurBlanc) {
  const g = new SITE.Game(), ucis = [], BUDGET = 60;
  const uci = m => g.uci(m);
  while (ucis.length < 140) {
    const coups = g.moves();
    if (!coups.length || g.isRepetition() || g.half >= 100 || g.isInsufficient()) break;
    let m = null;
    if ((g.turn === 0) === joueurBlanc) m = rnd() < profil.hasard ? coups[Math.floor(rnd() * coups.length)] : SITE.coupOrdinateur(g, profil.elo, BUDGET, rnd);
    else m = SITE.coupOrdinateur(g, eloAdv, BUDGET, rnd);
    if (!m) m = coups[0];
    ucis.push(uci(m)); g.makeMove(m);
  }
  return ucis;
}

/* ============ 2. Stockfish ============ */
let lignes = [], capture = false;
const vraiWrite = process.stdout.write.bind(process.stdout);
const dire = s => vraiWrite(s + "\n");
const dodo = ms => new Promise(r => setTimeout(r, ms));
async function ouvrirStockfish(nom) {
  process.stdout.write = (c, ...r) => { if (capture) { String(c).split("\n").forEach(l => l && lignes.push(l)); return true; } return vraiWrite(c, ...r); };
  const dir = path.join(os.tmpdir(), "sf-coach-" + nom);
  fs.mkdirSync(dir, { recursive: true });
  const bin = path.join(__dirname, "sf", "package", "bin");
  fs.copyFileSync(path.join(bin, "stockfish-18-lite-single.wasm"), path.join(dir, "stockfish.wasm"));
  fs.copyFileSync(path.join(bin, "stockfish-18-lite-single.js"), path.join(dir, "stockfish-18-lite-single.js"));
  capture = true;
  const sf = await require(path.join(dir, "stockfish-18-lite-single.js"))()();
  const cmd = c => sf.ccall("command", null, ["string"], [c], { async: true });
  const attendre = async (m, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const l = lignes.find(x => m.test(x)); if (l) return l; await dodo(1); } return null; };
  await cmd("uci"); await attendre(/uciok/, 30000);
  await cmd("setoption name Hash value 32");
  capture = false;
  const pos = (fen, coups) => "position fen " + fen + (coups && coups.length ? " moves " + coups.join(" ") : "");
  const S = {
    async nouvelle() { capture = true; await cmd("ucinewgame"); lignes = []; await cmd("isready"); await attendre(/readyok/, 30000); capture = false; },
    /* Evaluation comme dans la page : { cp, mate, best, pv }, vue du camp au trait. */
    async evaluer(fen, prof, coups) {
      capture = true; lignes = [];
      await cmd(pos(fen, coups)); await cmd("go depth " + prof);
      const bm = await attendre(/^bestmove/, 300000);
      let cp = null, mate = null, pv = null;
      for (const l of lignes) {
        if (!/^info .*score/.test(l)) continue;
        const sc = /score (cp|mate) (-?\d+)/.exec(l); if (!sc) continue;
        if (sc[1] === "mate") { mate = +sc[2]; cp = (mate > 0 ? 1 : -1) * (20000 - Math.abs(mate) * 100); } else { mate = null; cp = +sc[2]; }
        const v = / pv (.+)$/.exec(l); if (v) pv = v[1].trim().split(/\s+/);
      }
      capture = false;
      const best = bm ? bm.split(/\s+/)[1] : null;
      return { cp, mate, best: best && best !== "(none)" ? best : null, pv };
    },
    /* Les deux meilleures lignes : [{ cp, mate, coup }, ...]. */
    async deuxLignes(fen, prof) {
      capture = true; lignes = [];
      await cmd("setoption name MultiPV value 2");
      await cmd(pos(fen)); await cmd("go depth " + prof);
      await attendre(/^bestmove/, 300000);
      const out = [null, null];
      for (const l of lignes) {
        const k = / multipv (\d) /.exec(l), sc = /score (cp|mate) (-?\d+)/.exec(l), v = / pv (\S+)/.exec(l);
        if (!k || !sc || +k[1] > 2) continue;
        out[+k[1] - 1] = sc[1] === "mate" ? { cp: null, mate: +sc[2], coup: v && v[1] } : { cp: +sc[2], mate: null, coup: v && v[1] };
      }
      await cmd("setoption name MultiPV value 1");
      capture = false;
      return out;
    },
    /* Coups legaux, par Stockfish. */
    async legaux(fen, coups) {
      capture = true; lignes = [];
      await cmd(pos(fen, coups)); await cmd("go perft 1");
      await attendre(/^Nodes searched/, 60000);
      const out = lignes.map(l => /^([a-h][1-8][a-h][1-8][qrbn]?): 1$/.exec(l)).filter(Boolean).map(x => x[1]);
      capture = false;
      return out;
    },
    /* Position apres des coups, et pieces qui donnent echec, par Stockfish. */
    async voir(fen, coups) {
      capture = true; lignes = [];
      await cmd(pos(fen, coups)); await cmd("d");
      await attendre(/^Checkers:/, 60000);
      const f = lignes.find(l => /^Fen: /.test(l)), c = lignes.find(l => /^Checkers:/.test(l));
      capture = false;
      return { fen: f ? f.slice(5).trim() : null, echec: !!(c && c.replace("Checkers:", "").trim()) };
    }
  };
  return S;
}

/* ============ 3. Le verificateur independant ============ */
/* Rien d'ici ne vient de coach.js ni de engine.js : un tableau de 64 cases
   lu dans le FEN, et la geometrie des pieces recalculee. */
const V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
function plateau(fen) {
  const t = {}, rangs = fen.split(" ")[0].split("/");
  for (let r = 0; r < 8; r++) { let c = 0; for (const ch of rangs[r]) { if (/\d/.test(ch)) { c += +ch; continue; } t["abcdefgh"[c] + (8 - r)] = ch; c++; } }
  return t;
}
const blanc = ch => ch === ch.toUpperCase();
const xy = s => [s.charCodeAt(0) - 97, +s[1] - 1];
const nomXY = (x, y) => (x < 0 || x > 7 || y < 0 || y > 7) ? null : "abcdefgh"[x] + (y + 1);
/* La piece posee en « de » attaque-t-elle la case « vers » ? */
function attaque(t, de, vers) {
  const p = t[de]; if (!p || de === vers) return false;
  const [x1, y1] = xy(de), [x2, y2] = xy(vers), dx = x2 - x1, dy = y2 - y1, k = p.toLowerCase();
  if (k === "p") return Math.abs(dx) === 1 && dy === (blanc(p) ? 1 : -1);
  if (k === "n") return (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1);
  if (k === "k") return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  const diag = Math.abs(dx) === Math.abs(dy), droit = dx === 0 || dy === 0;
  if (k === "b" && !diag) return false;
  if (k === "r" && !droit) return false;
  if (k === "q" && !diag && !droit) return false;
  const sx = Math.sign(dx), sy = Math.sign(dy);
  for (let x = x1 + sx, y = y1 + sy; x !== x2 || y !== y2; x += sx, y += sy) if (t[nomXY(x, y)]) return false;
  return true;
}
/* Cases des pieces d'une couleur qui attaquent une case. */
const attaquantsDe = (t, vers, parBlancs) => Object.keys(t).filter(s => blanc(t[s]) === parBlancs && attaque(t, s, vers));
async function estMat(S, fen, coups) { return (await S.legaux(fen, coups)).length === 0 && (await S.voir(fen, coups)).echec; }
async function estPat(S, fen, coups) { return (await S.legaux(fen, coups)).length === 0 && !(await S.voir(fen, coups)).echec; }
/* Mat force en deux par ce premier coup : apres lui, il reste des reponses,
   et a chacune repond un coup qui mate. */
async function matEnDeuxPar(S, fen, coups, premier) {
  const base = coups.concat([premier]), reps = await S.legaux(fen, base);
  if (!reps.length) return false;
  for (const r of reps) {
    let trouve = false;
    for (const x of await S.legaux(fen, base.concat([r]))) if (await estMat(S, fen, base.concat([r, x]))) { trouve = true; break; }
    if (!trouve) return false;
  }
  return true;
}
/* Rend null si tout ce que la phrase affirme est vrai, sinon la raison.
   fen : position avant le coup du joueur ; coup : son coup ; e : le cas. */
async function verifier(S, fen, coup, e) {
  const joueurBlanc = fen.split(" ")[1] === "w";
  const avant = plateau(fen);
  const apresFen = (await S.voir(fen, [coup])).fen;
  if (!apresFen) return "position apres le coup introuvable";
  const apres = plateau(apresFen);
  const base = e.de === "avant" ? [] : [coup], t0 = e.de === "avant" ? avant : apres;
  const est = (t, f, couleurBlanche) => t[f.sq] && t[f.sq].toLowerCase() === f.p && blanc(t[f.sq]) === couleurBlanche;
  if (e.coup && (await S.legaux(fen, base)).indexOf(e.coup) < 0) return "le coup cite n'est pas legal";
  if (e.mieux && (await S.legaux(fen, [])).indexOf(e.mieux) < 0) return "le coup conseille n'est pas legal";
  const de = e.coup ? e.coup.slice(0, 2) : null, vers = e.coup ? e.coup.slice(2, 4) : null;
  switch (e.cas) {
    case "pat":
      return (await estPat(S, fen, [coup])) ? null : "ce n'est pas pat";
    case "mat1_manque":
      if (!(await estMat(S, fen, [e.coup]))) return "le coup cite ne mate pas";
      return (await estMat(S, fen, [coup])) ? "le joueur a mate" : null;
    case "mat1_permis":
      return (await estMat(S, fen, [coup, e.coup])) ? null : "le coup cite ne mate pas";
    case "bien_mat":
      return (await estMat(S, fen, [coup])) && e.coup === coup ? null : "le coup du joueur ne mate pas";
    case "mat2_manque":
      if (await estMat(S, fen, [e.coup])) return "c'est un mat en un";
      return (await matEnDeuxPar(S, fen, [], e.coup)) ? null : "pas de mat force en deux";
    case "mat2_permis":
      return (await matEnDeuxPar(S, fen, [coup], e.coup)) ? null : "pas de mat force en deux";
    case "promo_manquee": {
      if (!/q$/.test(e.coup) || !est(avant, { p: "p", sq: de }, joueurBlanc)) return "pas une promotion en dame";
      if (/[qrbn]$/.test(coup)) return "le joueur a promu";
      const t = plateau((await S.voir(fen, [e.coup])).fen);
      if (attaquantsDe(t, vers, !joueurBlanc).length) return "la dame peut etre prise";
      return (await S.legaux(fen, [e.coup])).some(x => x.slice(2, 4) === vers) ? "un coup legal prend la dame" : null;
    }
    case "prise_perdante": {
      if (!est(avant, e.piece, !joueurBlanc)) return "la piece prise n'est pas la";
      if (!est(avant, { p: e.preneur.p, sq: coup.slice(0, 2) }, joueurBlanc) || coup.slice(2, 4) !== e.piece.sq) return "le joueur n'a pas pris avec cette piece";
      if (V[e.preneur.p] - V[e.piece.p] < 2) return "la piece qui prend ne vaut pas plus";
      return vers === e.piece.sq ? null : "la reponse ne reprend pas sur la case";
    }
    case "en_prise": {
      if (!est(apres, e.piece, joueurBlanc)) return "la piece dite en prise n'est pas la";
      if (!est(apres, e.attaquant, !joueurBlanc) || de !== e.attaquant.sq || vers !== e.piece.sq) return "l'attaquant cite ne prend pas cette piece";
      if (V[e.piece.p] < 3) return "ce n'est pas une piece";
      if (e.variante === "libre") {
        const t = plateau((await S.voir(fen, [coup, e.coup])).fen);
        const def = attaquantsDe(t, e.piece.sq, joueurBlanc);
        if (def.length) return "une piece defend la case : " + def.join(",");
        if ((await S.legaux(fen, [coup, e.coup])).some(x => x.slice(2, 4) === e.piece.sq)) return "un coup legal reprend";
      } else if (!(V[e.attaquant.p] < V[e.piece.p]) || e.attaquant.p === "k") return "l'attaquant ne vaut pas moins";
      if (e.deja) {
        if (!est(avant, e.piece, joueurBlanc)) return "deja : la piece n'etait pas sur cette case";
        if (!est(avant, e.attaquant, !joueurBlanc) || !attaque(avant, e.attaquant.sq, e.piece.sq)) return "deja : l'attaquant ne la visait pas";
        if (coup.slice(0, 2) === e.piece.sq) return "deja : la piece a bouge";
      }
      return null;
    }
    case "bien_prise": {
      if (e.coup !== coup) return "ce n'est pas le coup du joueur";
      if (!est(avant, e.piece, !joueurBlanc) || coup.slice(2, 4) !== e.piece.sq) return "le joueur ne prend pas cette piece";
      const def = attaquantsDe(apres, e.piece.sq, !joueurBlanc);
      if (def.length) return "la piece etait defendue : " + def.join(",");
      return (await S.legaux(fen, [coup])).some(x => x.slice(2, 4) === e.piece.sq) ? "un coup legal reprend" : null;
    }
    case "prise_manquee": {
      if (!est(avant, e.piece, !joueurBlanc)) return "la piece a prendre n'est pas la";
      if (!est(avant, e.preneur, joueurBlanc) || de !== e.preneur.sq || vers !== e.piece.sq) return "le coup cite ne prend pas avec cette piece";
      if (coup.slice(2, 4) === e.piece.sq) return "le joueur a pris cette piece";
      if (e.variante === "libre") {
        if (V[e.piece.p] < 3) return "ce n'est pas une piece";
        const t = plateau((await S.voir(fen, [e.coup])).fen);
        const def = attaquantsDe(t, e.piece.sq, !joueurBlanc);
        if (def.length) return "une piece defend la case : " + def.join(",");
        if ((await S.legaux(fen, [e.coup])).some(x => x.slice(2, 4) === e.piece.sq)) return "un coup legal reprend";
      } else if (!(V[e.preneur.p] < V[e.piece.p]) || e.preneur.p === "k") return "la piece qui prend ne vaut pas moins";
      return null;
    }
    case "fourchette_manquee":
    case "fourchette_permise": {
      const campBlanc = e.cas === "fourchette_manquee" ? joueurBlanc : !joueurBlanc;
      const t = plateau((await S.voir(fen, base.concat([e.coup]))).fen);
      if (!t[vers] || blanc(t[vers]) !== campBlanc) return "la piece qui fourchette n'est pas sur sa case";
      const f = t[vers].toLowerCase();
      if (!e.cibles || e.cibles.length !== 2 || e.cibles[0].sq === e.cibles[1].sq) return "il faut deux cibles";
      for (const c of e.cibles) {
        if (!est(t, c, !campBlanc)) return "la cible " + c.sq + " n'est pas la";
        if (!attaque(t, vers, c.sq)) return "la cible " + c.sq + " n'est pas attaquee";
        const compte = c.p === "k" || V[c.p] > V[f] || (V[c.p] >= 3 && attaquantsDe(t, c.sq, !campBlanc).length === 0);
        if (!compte) return "la cible " + c.sq + " ne compte pas (defendue et moins chere)";
      }
      return null;
    }
  }
  return "cas inconnu : " + e.cas;
}

/* ============ 4. Une partie : relire, verifier, mesurer ============ */
const enCp = l => l.mate != null ? (l.mate > 0 ? 1 : -1) * (20000 - Math.abs(l.mate) * 100) : l.cp;
async function traiter(SITE, S, ucis, joueurBlanc) {
  const g = new SITE.Game(), fens = [g.fen()];
  for (const u of ucis) { g.makeMove(g.moves().find(m => g.uci(m) === u)); fens.push(g.fen()); }
  await S.nouvelle();
  const t0 = Date.now(), evals = [];
  for (const f of fens) {
    const gg = new SITE.Game(f);
    if (!gg.moves().length) evals.push(gg.inCheck() ? { cp: -20000, mate: 0, best: null, pv: null } : { cp: 0, mate: null, best: null, pv: null });
    else evals.push(await S.evaluer(f, PROF));
  }
  const tAnalyse = Date.now() - t0;
  const plies = COACH.plis(SITE.Game, null, ucis, evals);
  const t1 = Date.now();
  const coach = COACH.relire(SITE.Game, null, ucis, plies, joueurBlanc ? 0 : 1);
  const tCoach = Date.now() - t1;
  const res = { fautes: [], compliments: [], tAnalyse, tCoach, positions: fens.length };
  for (let i = 0; i < coach.length; i++) {
    const p = plies[i], x = coach[i], moi = p.mover === (joueurBlanc ? 0 : 1);
    if (x.c) res.compliments.push({ pli: i, fen: fens[i], coup: ucis[i], e: x.c, faux: await verifier(S, fens[i], ucis[i], x.c) });
    if (!moi || (p.tag !== "blunder" && p.tag !== "mistake")) continue;
    const f = { pli: i, fen: fens[i], coup: ucis[i], tag: p.tag, perte: p.loss, meilleur: p.best, e: x.e || null };
    if (x.e) {
      f.faux = await verifier(S, fens[i], ucis[i], x.e);
      /* Le conseil tient-il plus profond ? Coup joue contre coup conseille. */
      if (p.best && p.best !== ucis[i]) {
        const a = await S.evaluer(fens[i], PROF_CONSEIL, [p.best]), b = await S.evaluer(fens[i], PROF_CONSEIL, [ucis[i]]);
        f.ecartProfond = (a.cp == null || b.cp == null) ? null : -a.cp - (-b.cp);
      }
      /* L'exercice, avec l'exigence stricte. */
      const ex = COACH.exercice({ coup: ucis[i], meilleur: p.best }, x.e);
      if (ex) {
        if (ex.net) f.exo = { type: ex.type, n: ex.n, net: true };
        else {
          const l = await S.deuxLignes(fens[i], PROF);
          const net = !!l[0] && l[0].coup === p.best && COACH.net(l[0], l[1]);
          f.exo = { type: ex.type, net, ecart: l[0] && l[1] ? enCp(l[0]) - enCp(l[1]) : null };
          if (net) {
            const L = await S.deuxLignes(fens[i], PROF_CONSEIL);
            f.exo.profond = !!L[0] && L[0].coup === p.best && (!L[1] || enCp(L[0]) - enCp(L[1]) >= 100);
          }
        }
      }
    }
    res.fautes.push(f);
  }
  return res;
}

/* ============ 5. Bilan ============ */
function lireJournaux() {
  const out = [];
  for (const f of fs.readdirSync(__dirname).filter(x => /^coach-controle-\d+\.jsonl$/.test(x)))
    for (const l of fs.readFileSync(path.join(__dirname, f), "utf8").split("\n")) { if (!l) continue; try { out.push(JSON.parse(l)); } catch (e) {} }
  return out;
}
function bilan() {
  const P = lireJournaux(), pc = (a, b) => b ? (100 * a / b).toFixed(1) + " %" : "-";
  let fautes = 0, dites = 0, fausses = 0, gaffes = 0, gaffesDites = 0, comp = 0, compFaux = 0, exoCand = 0, exos = 0, exosProfondOk = 0, exosProfond = 0, conseilMesure = 0, conseilFaible = 0, tA = 0, tC = 0, pos = 0;
  const parCas = {}, parProfil = {}, exemples = {}, faux = [];
  for (const p of P) {
    tA += p.tAnalyse; tC += p.tCoach; pos += p.positions;
    const pr = parProfil[p.profil] = parProfil[p.profil] || { parties: 0, fautes: 0, dites: 0 };
    pr.parties++;
    for (const c of p.compliments) { comp++; if (c.faux) { compFaux++; faux.push(Object.assign({ partie: p.id }, c)); } const k = c.e.cas; parCas[k] = parCas[k] || { n: 0, faux: 0, exo: 0 }; parCas[k].n++; if (c.faux) parCas[k].faux++; (exemples[k] = exemples[k] || []).push({ fen: c.fen, coup: c.coup, e: c.e }); }
    for (const f of p.fautes) {
      fautes++; pr.fautes++; if (f.tag === "blunder") gaffes++;
      if (!f.e) continue;
      dites++; pr.dites++; if (f.tag === "blunder") gaffesDites++;
      const k = f.e.cas + (f.e.variante ? "/" + f.e.variante : "") + (f.e.deja ? "/deja" : "");
      parCas[k] = parCas[k] || { n: 0, faux: 0, exo: 0 }; parCas[k].n++;
      if (f.faux) { fausses++; parCas[k].faux++; faux.push(Object.assign({ partie: p.id }, f)); }
      if (f.ecartProfond != null) { conseilMesure++; if (f.ecartProfond < 50) conseilFaible++; }
      if (f.exo) { exoCand++; if (f.exo.net) { exos++; parCas[k].exo++; if (f.exo.profond !== undefined) { exosProfond++; if (f.exo.profond) exosProfondOk++; } } }
      (exemples[k] = exemples[k] || []).push({ fen: f.fen, coup: f.coup, e: f.e });
    }
  }
  dire(P.length + " parties relues, " + pos + " positions ; analyse " + Math.round(tA / Math.max(1, P.length)) + " ms par partie, coach " + (tC / Math.max(1, P.length)).toFixed(1) + " ms par partie");
  for (const [k, v] of Object.entries(parProfil)) dire("  joueur " + k.padEnd(10) + v.parties + " parties, " + v.fautes + " fautes, " + pc(v.dites, v.fautes) + " expliquees");
  dire("\nFautes du joueur (gaffes et erreurs) : " + fautes + ", dont " + gaffes + " gaffes");
  dire("  avec une phrase         : " + dites + " (" + pc(dites, fautes) + ") ; pour les seules gaffes : " + pc(gaffesDites, gaffes));
  dire("  sans explication        : " + (fautes - dites) + " (" + pc(fautes - dites, fautes) + ")");
  dire("  PHRASES FAUSSES         : " + fausses + " sur " + dites + " (" + pc(fausses, dites) + ")");
  dire("Compliments               : " + comp + ", faux : " + compFaux);
  dire("Conseil confirme plus profond (profondeur " + PROF_CONSEIL + ", au moins 50 centipions d'ecart) : " + (conseilMesure - conseilFaible) + " sur " + conseilMesure + " (" + pc(conseilMesure - conseilFaible, conseilMesure) + ")");
  dire("Exercices : " + exos + " pour " + dites + " fautes expliquees (" + pc(exos, dites) + "), soit " + (exos / Math.max(1, P.length)).toFixed(2) + " par partie ; solution encore unique plus profond : " + exosProfondOk + " sur " + exosProfond);
  dire("\nPar cas :");
  for (const [k, v] of Object.entries(parCas).sort((a, b) => b[1].n - a[1].n)) dire("  " + k.padEnd(28) + String(v.n).padStart(6) + "  fausses " + String(v.faux).padStart(4) + "  exercices " + String(v.exo).padStart(5));
  if (ARGS.includes("--faux")) { dire("\nPhrases fausses :"); for (const f of faux) dire("  " + f.partie + " pli " + f.pli + " | " + f.fen + " | " + f.coup + " | " + JSON.stringify(f.e) + "\n      -> " + f.faux); }
  const nEx = +opt("exemples", 0);
  if (nEx) for (const [k, l] of Object.entries(exemples)) { dire("\n== " + k); for (let i = 0; i < nEx && l.length; i++) { const x = l.splice(Math.floor(Math.random() * l.length), 1)[0]; dire("  " + x.fen + " | " + x.coup + " | " + JSON.stringify(x.e)); } }
  return fausses + compFaux;
}

/* ============ 6. Lancement ============ */
module.exports = { verifier, plateau, attaque, attaquantsDe, ouvrirStockfish, chargerSite, traiter };
if (require.main === module) {
  if (ARGS.includes("--bilan")) process.exit(bilan() ? 1 : 0);
  if (!ARGS.includes("--jouer")) { dire("voir l'en-tete du fichier pour l'usage"); process.exit(0); }
  (async () => {
    const [part, parts] = opt("part", "1/1").split("/").map(Number), N = +opt("parties", 100);
    const SITE = chargerSite(), S = await ouvrirStockfish("part" + part);
    const journal = journalDe(part), deja = new Set();
    if (fs.existsSync(journal)) for (const l of fs.readFileSync(journal, "utf8").split("\n")) if (l) try { deja.add(JSON.parse(l).id); } catch (e) {}
    dire("part " + part + "/" + parts + " : " + N + " parties (" + deja.size + " deja faites), profondeur " + PROF);
    const t0 = Date.now(); let faites = 0;
    for (let k = 0; k < N; k++) {
      const id = part + "-" + k;
      if (deja.has(id)) continue;
      const rnd = hasard(part * 1000003 + k * 7919), profil = PROFILS[k % 4], eloAdv = FORCES[Math.floor(k / 4) % 4], blanc = (Math.floor(k / 16) % 2) === 0;
      const ucis = jouerPartie(SITE, rnd, profil, eloAdv, blanc);
      const r = await traiter(SITE, S, ucis, blanc);
      fs.appendFileSync(journal, JSON.stringify(Object.assign({ id, profil: profil.nom, adv: eloAdv, blanc, coups: ucis.join(" ") }, r)) + "\n");
      faites++;
      if (faites % 5 === 0) dire(faites + " parties, reste ~" + Math.round((N - k - 1) * (Date.now() - t0) / faites / 60000) + " min");
    }
    dire("termine : " + faites + " parties");
    process.exit(0);
  })().catch(e => { dire("ERREUR " + (e && e.stack || e)); process.exit(1); });
}
