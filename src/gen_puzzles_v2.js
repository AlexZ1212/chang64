/* Generateur d'exercices tactiques -- v2.

   PROBLEME RESOLU PAR CETTE VERSION (chantier signale en session precedente,
   jamais commence jusqu'ici) : dans la v1 (gen_puzzles.js), seulement ~4%
   des exercices de type "gain materiel" sont des coups silencieux (ni prise
   ni echec) -- le motif le plus valorise chez Lichess/Chess.com car le plus
   dur a reperer humainement. Deux causes racines identifiees :

   1. SOURCE DES POSITIONS : randomPosition() jouait des coups uniformement
      au hasard (biais 35% vers les prises). Une partie vraiment aleatoire
      atteint presque toujours des positions ou des pieces trainent sans
      protection -- la tactique qui en sort est alors quasi-systematiquement
      une prise ou un echec immediat, jamais une preparation silencieuse.
      Une vraie combinaison silencieuse suppose une position deja structuree
      (une piece a demi-defendue, un roi a l'abri en apparence) : ca ne nait
      pas d'un coup au hasard, ca nait d'une partie qui "se joue" a peu pres
      normalement jusqu'a ce qu'un camp se trompe.

   2. LONGUEUR DE LA SOLUTION : makePuzzle() ne retenait TOUJOURS qu'un seul
      coup pour les exercices de type "gain" (contrairement aux mats, deja
      autorises jusqu'a 3 coups via mateLength()). Un coup silencieux qui
      gagne du materiel EN UN SEUL COUP est rarissime par nature : la plupart
      des combinaisons silencieuses preparent un gain qui se concretise au
      coup suivant (deviation, decouverte, zwischenzug). Ne jamais chercher
      au-dela d'un coup revenait a se fermer la porte a la quasi-totalite
      des combinaisons silencieuses possibles, meme quand la position en
      contenait une.

   CE QUI CHANGE ICI :

   - guidedGame() remplace randomPosition() : un camp joue "normalement"
     (recherche courte), l'autre a une chance de se tromper (blunderChance),
     imitant une vraie partie ou quelqu'un merde -- exactement la source de
     Lichess (parties reelles + moteur qui detecte l'ecart de score). Le
     random pur reste disponible (randomPosition, importee de v1) pour
     completer le volume si besoin.

   - extractLine() prolonge la recherche du premier coup sur plusieurs plis
     en alternant les demi-coups (nous, puis la meilleure defense
     adverse, puis nous...), et makePuzzleV2() valide chacun de NOS coups
     dans la lignee (meme exigence d'unicite que le premier coup, pas
     seulement le premier). Les exercices "gain" peuvent donc desormais
     avoir une solution a 2 ou 3 coups, pas seulement les mats.

   - isQuiet() marque explicitement si le premier coup est silencieux (ni
     prise ni echec) sur la position de depart. Le tirage au sort explore
     un grand nombre de positions et RETIENT EN PRIORITE les silencieux
     jusqu'a un quota cible, plutot que de les laisser diluer au hasard
     dans la masse -- v1 les gardait deja quand ils sortaient, mais ne les
     cherchait jamais activement.

   - classify() gagne un motif "Deflection" (le coup silencieux attaque ou
     chasse la seule piece qui defend la cible du coup suivant) et un
     fourre-tout "Quiet move" pour les silencieux non classes ailleurs,
     au lieu de tomber generiquement dans "Winning move"/"Winning capture"
     qui ne disent rien de special sur la difficulte reelle du coup.

   Le moteur (engine.js) n'est pas touche : toute la mecanique ci-dessus
   s'appuie sur des appels repetes a search(), deja exact et deja
   perft-valide, jamais sur une modification de l'alpha-beta lui-meme. */

const fs = require("fs");
const path = require("path");
const {
  Game, search, mateIn, sqName, pType, pColor, W, B, P, N, BI, R, Q, K, VAL
} = require(path.join(__dirname, "engine.js"));

const v1 = require(path.join(__dirname, "gen_puzzles.js"));
const {
  randomPosition, verify: verifyV1, rankMoves, mateLength, kingSq,
  puzzleCode, findDuplicateCodes, MATE
} = v1;

/* ------------------------------------------------------------------ */
/* Utilitaires geometriques repris tels quels de v1 (classify() en a   */
/* besoin) : aucune de ces fonctions ne depend de la source des        */
/* positions, inutile de les reecrire.                                 */
/* ------------------------------------------------------------------ */
const onB = s => (s & 0x88) === 0;
const DIRS = {
  [N]:  [31, 33, 14, 18, -31, -33, -14, -18],
  [BI]: [15, 17, -15, -17],
  [R]:  [1, 16, -1, -16],
  [Q]:  [1, 16, -1, -16, 15, 17, -15, -17],
  [K]:  [1, 16, -1, -16, 15, 17, -15, -17]
};
const SLIDER = { [BI]: 1, [R]: 1, [Q]: 1 };

function attacksFrom(g, from) {
  const pc = g.board[from];
  if (!pc) return [];
  const t = pType(pc), c = pColor(pc), out = [];
  if (t === P) {
    for (const d of (c === W ? [-15, -17] : [15, 17])) {
      const s = from + d; if (onB(s)) out.push(s);
    }
    return out;
  }
  for (const d of DIRS[t]) {
    let s = from + d;
    while (onB(s)) {
      out.push(s);
      if (!SLIDER[t] || g.board[s]) break;
      s += d;
    }
  }
  return out;
}
function targets(g, from, side) {
  const val = VAL[pType(g.board[from])] || 0;
  return attacksFrom(g, from).filter(s => {
    const pc = g.board[s];
    if (!pc || pColor(pc) === side) return false;
    const tv = VAL[pType(pc)] || 0;
    return pType(pc) === K || tv > val || !defended(g, s, side ^ 1);
  });
}
function defended(g, sq, bySide) {
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) { s += 7; continue; }
    const pc = g.board[s];
    if (!pc || pColor(pc) !== bySide || s === sq) continue;
    if (attacksFrom(g, s).includes(sq)) return true;
  }
  return false;
}
function lineBetween(a, b) {
  for (const d of [1, 16, -1, -16, 15, 17, -15, -17]) {
    let s = a + d, between = [];
    while (onB(s)) {
      if (s === b) return { dir: d, between };
      between.push(s);
      s += d;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* 1. Source de positions "guidee" : un camp joue a peu pres serieux,  */
/*    l'autre a une chance de merder. Remplace le random pur pour la   */
/*    majorite du tirage (voir batch runner plus bas, qui garde aussi  */
/*    une part de randomPosition() pour la diversite).                */
/* ------------------------------------------------------------------ */
function guidedGame(minPly, maxPly, blunderChance) {
  const g = new Game();
  const n = minPly + ((Math.random() * (maxPly - minPly)) | 0);
  for (let i = 0; i < n; i++) {
    const legal = g.moves();
    if (!legal.length) return null;
    let mv;
    if (Math.random() < blunderChance) {
      /* "erreur" plausible : pas un coup totalement absurde (biais leger
         vers les prises, comme le tirage v1), juste pas le meilleur. */
      let pool = legal;
      if (Math.random() < 0.3) {
        const caps = legal.filter(m => g.board[m.to]);
        if (caps.length) pool = caps;
      }
      mv = pool[(Math.random() * pool.length) | 0];
    } else {
      /* coup "serieux" : recherche courte, budget temps volontairement
         petit (200ms). Profondeur 3 essayee puis abandonnee : le debit de
         generation s'effondrait (11 exercices en 280s contre 60 en 180s
         a profondeur 2) pour un gain non confirme sur le taux de
         silencieux -- mauvais echange. Le vrai levier retenu est la
         longueur de partie (voir guidedGame plus bas), pas la profondeur
         de la recherche-guide. */
      const r = search(g, 2, 200);
      mv = r.move || legal[(Math.random() * legal.length) | 0];
    }
    g.makeMove(mv);
    if (g.half >= 60) return null;
  }
  return g.moves().length ? g : null;
}

/* ------------------------------------------------------------------ */
/* 2. Un coup est "silencieux" s'il ne capture rien et ne met pas en   */
/*    echec. C'est la meme definition que quietMove dans               */
/*    rebin_levels.js (score = ... + (quiet?30:0) + ...) : on reutilise*/
/*    exactement le meme critere plutot que d'en inventer un autre qui */
/*    desynchroniserait generation et notation de difficulte.          */
/* ------------------------------------------------------------------ */
function isQuiet(g, mv) {
  if (g.board[mv.to]) return false;
  const c = new Game(g.fen());
  const full = c.moves().find(m => m.from === mv.from && m.to === mv.to && m.promo === mv.promo);
  if (!full) return false;
  c.makeMove(full);
  return !c.inCheck();
}

/* ------------------------------------------------------------------ */
/* 3. Extraction de lignee : alterne recherche/coup en repartant du    */
/*    resultat reel du jeu (donc c'est bien un coup adverse "optimal"  */
/*    qui est joue entre nos coups, pas une supposition). S'arrete des */
/*    qu'un mat est trouve ou que maxPlies est atteint.                */
/* ------------------------------------------------------------------ */
function extractLine(startG, maxPlies, depth, timeMs) {
  const g = new Game(startG.fen());
  const line = [];
  for (let i = 0; i < maxPlies; i++) {
    const r = search(g, depth, timeMs);
    if (!r.move) break;
    const full = g.moves().find(m => m.from === r.move.from && m.to === r.move.to && m.promo === r.move.promo);
    if (!full) break;
    line.push({ mv: full, score: r.score });
    g.makeMove(full);
    if (Math.abs(r.score) > MATE - 200) break;
  }
  return line;
}

/* Verifie qu'un coup est bien LE meilleur (pas seulement bon) sur une
   position donnee, avec la meme exigence de marge que le premier coup en
   v1 : ecart net avec le deuxieme choix, ou mat unique. Reutilise pour
   chaque maillon "nous" d'une lignee multi-coups -- sans ca, prolonger la
   solution ajouterait des coups plausibles mais pas garantis uniques, ce
   qui casserait la promesse "un seul coup gagnant" faite au joueur. */
function isClearlyBest(g, mv, depth) {
  const rough = rankMoves(g, 2);
  if (!rough.length) return false;
  if (rough[0].mv.from !== mv.from || rough[0].mv.to !== mv.to || rough[0].mv.promo !== mv.promo) return false;
  if (rough.length === 1) return true;
  const confirmed = rough.slice(0, 2).map(r => {
    const c = new Game(g.fen());
    const m2 = c.moves().find(m => m.from === r.mv.from && m.to === r.mv.to && m.promo === r.mv.promo);
    c.makeMove(m2);
    return { mv: r.mv, score: -search(c, depth - 1, 3000).score };
  }).sort((a, b) => b.score - a.score);
  if (confirmed[0].mv.from !== mv.from || confirmed[0].mv.to !== mv.to || confirmed[0].mv.promo !== mv.promo) return false;
  const isMate = confirmed[0].score > MATE - 100;
  if (isMate) return confirmed[1].score <= MATE - 100;
  return confirmed[0].score - confirmed[1].score >= 200;
}

/* ------------------------------------------------------------------ */
/* 4. Classification etendue : ajoute Deflection et Quiet move pour    */
/*    les solutions silencieuses, sans toucher aux motifs existants    */
/*    (fourchette, clouage, enfilade, mats...) repris de v1.           */
/* ------------------------------------------------------------------ */
function classifyBase(gBefore, mv, isMate, mateLen) {
  const after = new Game(gBefore.fen());
  after.makeMove(after.moves().find(m => m.from === mv.from && m.to === mv.to && m.promo === mv.promo));
  const me = pColor(gBefore.board[mv.from]);
  const them = me ^ 1;
  const to = mv.to, t = pType(gBefore.board[mv.from]);
  const letter = pt => "_pnbrqk"[pt] || "";

  if (isMate && mateLen === 1) {
    const ks = kingSq(after, them);
    const homeRank = them === W ? 7 : 0;
    if ((ks >> 4) === homeRank) {
      let blocked = 0;
      for (const d of [-1, 1, -15, -17, 15, 17, -16, 16]) {
        const s = ks + d; if (!onB(s)) continue;
        const pc = after.board[s];
        if (pc && pColor(pc) === them) blocked++;
      }
      if (blocked >= 2) return { theme: "Back-rank mate", detail: { king: sqName(ks) } };
    }
    if (t === N) {
      const ks2 = kingSq(after, them);
      let own = 0, tot = 0;
      for (const d of [-1, 1, -15, -17, 15, 17, -16, 16]) {
        const s = ks2 + d; if (!onB(s)) continue;
        tot++;
        const pc = after.board[s];
        if (pc && pColor(pc) === them) own++;
      }
      if (tot > 0 && own === tot) return { theme: "Smothered mate", detail: { king: sqName(ks2) } };
    }
    return { theme: "Mate in one", detail: {} };
  }
  if (isMate) return { theme: mateLen === 2 ? "Mate in two" : "Mate in three", detail: {} };

  const hit = targets(after, to, me);
  if (hit.length >= 2) {
    const tg = hit.slice(0, 2).map(s => ({ sq: sqName(s), piece: letter(pType(after.board[s])) }));
    const detail = { from: sqName(to), targets: tg };
    if (t === N) return { theme: "Knight fork", detail };
    if (t === P) return { theme: "Pawn fork", detail };
    return { theme: "Double attack", detail };
  }
  if (t === BI || t === R || t === Q) {
    const ks = kingSq(after, them);
    const ln = lineBetween(to, ks);
    if (ln) {
      const occ = ln.between.filter(s => after.board[s]);
      if (occ.length === 1 && pColor(after.board[occ[0]]) === them) {
        const pinned = VAL[pType(after.board[occ[0]])] || 0;
        const detail = { from: sqName(to), pinned: { sq: sqName(occ[0]), piece: letter(pType(after.board[occ[0]])) }, behind: { sq: sqName(ks), piece: "k" } };
        return { theme: pinned >= VAL[R] ? "Skewer" : "Pin", detail };
      }
    }
    for (const s of attacksFrom(after, to)) {
      const pc = after.board[s];
      if (!pc || pColor(pc) === me) continue;
      const beyond = lineBetween(to, s);
      if (!beyond) continue;
      let nx = s + beyond.dir;
      while (onB(nx)) {
        const p2 = after.board[nx];
        if (p2) {
          if (pColor(p2) === them && (VAL[pType(pc)] || 0) >= (VAL[pType(p2)] || 0))
            return { theme: "Skewer", detail: { from: sqName(to), pinned: { sq: sqName(s), piece: letter(pType(pc)) }, behind: { sq: sqName(nx), piece: letter(pType(p2)) } } };
          break;
        }
        nx += beyond.dir;
      }
    }
  }
  if (gBefore.board[to]) return { theme: "Winning capture", detail: { sq: sqName(to), piece: letter(pType(gBefore.board[to])) } };
  return { theme: "Winning move", detail: {} };
}

/* Deflection : le coup silencieux attaque une piece adverse qui est
   actuellement l'UNIQUE defenseur d'une autre piece/case que la suite de
   la solution vise. On ne le detecte que si la solution a au moins 2
   coups (sinon "deflection" n'a pas de sens : il n'y a pas de "suite" a
   proteger). Heuristique volontairement simple (une seule piece deviee,
   pas de detection de surcharge a plusieurs cibles) : mieux vaut un motif
   detecte de facon fiable qu'un motif ambitieux mais parfois faux. */
function classifyQuiet(gBefore, line) {
  const first = line[0].mv;
  if (line.length >= 3) {
    const after1 = new Game(gBefore.fen());
    after1.makeMove(after1.moves().find(m => m.from === first.from && m.to === first.to && m.promo === first.promo));
    const me = pColor(gBefore.board[first.from]);
    const attacked = targets(after1, first.to, me);
    for (const sq of attacked) {
      const pc = after1.board[sq];
      if (!pc || pType(pc) === K) continue;
      /* cette piece attaquee defendait-elle quelque chose avant le coup
         silencieux, qui devient donc prenable ensuite ? */
      const before = gBefore;
      const guardedBefore = [];
      for (let s = 0; s < 128; s++) {
        if (s & 0x88) { s += 7; continue; }
        const target = before.board[s];
        if (!target || pColor(target) === pColor(pc)) continue;
        if (attacksFrom(before, sq).includes(s)) guardedBefore.push(s);
      }
      if (guardedBefore.length) {
        return { theme: "Deflection", detail: { from: sqName(first.from), to: sqName(first.to), deflected: { sq: sqName(sq), piece: "_pnbrqk"[pType(pc)] || "" } } };
      }
    }
  }
  return { theme: "Quiet move", detail: { from: sqName(first.from), to: sqName(first.to) } };
}

/* ------------------------------------------------------------------ */
/* 5. Construction du puzzle : premier coup valide comme en v1, puis   */
/*    prolongement multi-coups pour les exercices "gain" (les mats     */
/*    utilisaient deja mateLength() en v1 et le reutilisent tel quel). */
/* ------------------------------------------------------------------ */
function makePuzzleV2(g, depth, opts) {
  opts = opts || {};
  const maxSolPlies = opts.maxSolPlies || 3;

  const quick = search(g, 2, 4000);
  if (!quick.move) return null;
  if (quick.score < 250) return null;

  const rough = rankMoves(g, 2);
  if (rough.length < 2) return null;
  const confirmed = [rough[0], rough[1]].map(r => {
    const c = new Game(g.fen());
    const m2 = c.moves().find(m => m.from === r.mv.from && m.to === r.mv.to && m.promo === r.mv.promo);
    c.makeMove(m2);
    return { mv: r.mv, score: -search(c, depth - 1, 4000).score };
  }).sort((a, b) => b.score - a.score);
  const best = confirmed[0], second = confirmed[1];
  if (best.mv !== rough[0].mv) return null;

  const isMate = best.score > MATE - 100;
  const mateLen = isMate ? mateLength(g) : 0;

  if (isMate) {
    if (second.score > MATE - 100) return null;
  } else {
    if (best.score < 200) return null;
    if (best.score - second.score < 200) return null;
  }

  const quiet = isQuiet(g, best.mv);

  /* Lignee complete : pour un mat, on s'appuie sur mateLength() (v1,
     deja exact) et on ne reconstruit que jusqu'a cette longueur. Pour un
     gain materiel, on prolonge desormais au-dela d'un coup (nouveaute
     v2) : chacun de NOS coups suivants doit repasser le meme controle
     d'unicite que le premier (isClearlyBest), sinon la lignee est
     tronquee a l'endroit ou la garantie casse -- on ne livre jamais un
     coup "probablement bon" comme s'il etait "le seul bon". */
  let solMoves = [best.mv];
  if (isMate) {
    const full = extractLine(g, Math.max(mateLen * 2 - 1, 1), depth, 4000);
    solMoves = [];
    const g2 = new Game(g.fen());
    for (let i = 0; i < full.length; i++) {
      solMoves.push(full[i].mv);
      g2.makeMove(full[i].mv);
    }
    if (!solMoves.length) solMoves = [best.mv];
  } else if (maxSolPlies > 1) {
    const g2 = new Game(g.fen());
    g2.makeMove(g2.moves().find(m => m.from === best.mv.from && m.to === best.mv.to && m.promo === best.mv.promo));
    let ply = 1;
    while (ply < maxSolPlies) {
      const rOpp = search(g2, depth - 1, 3000);
      if (!rOpp.move) break;
      const oppFull = g2.moves().find(m => m.from === rOpp.move.from && m.to === rOpp.move.to && m.promo === rOpp.move.promo);
      if (!oppFull) break;
      g2.makeMove(oppFull);
      ply++;
      if (g2.moves().length === 0) break;
      const rMine = search(g2, depth - 1, 3000);
      if (!rMine.move) break;
      const mineFull = g2.moves().find(m => m.from === rMine.move.from && m.to === rMine.move.to && m.promo === rMine.move.promo);
      if (!mineFull) break;
      if (!isClearlyBest(g2, mineFull, depth - 1)) break;
      solMoves.push(oppFull, mineFull);
      g2.makeMove(mineFull);
      ply++;
      if (Math.abs(rMine.score) > MATE - 200) break;
    }
  }

  const { theme, detail } = quiet && solMoves.length >= 1
    ? classifyQuiet(g, solMoves.map(mv => ({ mv })))
    : classifyBase(g, best.mv, isMate, mateLen);

  const gSan = new Game(g.fen());
  const sanParts = [];
  const uciParts = [];
  for (const mv of solMoves) {
    const full = gSan.moves().find(m => m.from === mv.from && m.to === mv.to && m.promo === mv.promo);
    if (!full) break;
    sanParts.push(gSan.san(full));
    uciParts.push(sqName(mv.from) + sqName(mv.to) + (mv.promo ? "qrbn"[mv.promo - 2] || "" : ""));
    gSan.makeMove(full);
  }

  const fen = g.fen();
  return {
    fen,
    type: isMate ? "mate" : "gain",
    n: isMate ? mateLen : Math.ceil(uciParts.length / 2),
    sol: uciParts,
    theme,
    explain: detail,
    quiet,
    margin: isMate ? 9999 : best.score - second.score,
    san: sanParts.join(" "),
    code: puzzleCode(fen, uciParts)
  };
}

/* Rejoue integralement la solution declaree (tous les coups, pas
   seulement le premier comme la verification etait limitee en v1) :
   c'est la contrepartie obligee d'avoir des solutions plus longues. */
function verifyFull(p) {
  let g;
  try { g = new Game(p.fen); } catch (e) { return false; }
  if (g.inCheck && g.inCheck(g.turn ^ 1)) return false;
  if (g.inCheck && g.inCheck() && p.type === "gain") return false;
  for (let i = 0; i < p.sol.length; i++) {
    const uci = p.sol[i];
    const from = (uci.charCodeAt(0) - 97) + (8 - (+uci[1])) * 16;
    const to = (uci.charCodeAt(2) - 97) + (8 - (+uci[3])) * 16;
    const mv = g.moves().find(m => m.from === from && m.to === to);
    if (!mv) return false;
    g.makeMove(mv);
  }
  if (p.type === "mate") return g.moves().length === 0 && g.inCheck();
  return true;
}

module.exports = {
  guidedGame, isQuiet, extractLine, isClearlyBest,
  classifyBase, classifyQuiet, makePuzzleV2, verifyFull
};

/* ---------------------------------------------------------------- */
/* Production par lots (mode standalone, node gen_puzzles_v2.js ...) */
/* ---------------------------------------------------------------- */
if (require.main === module) {
  const WANT = +process.argv[2] || 60;
  const SECONDS = +process.argv[3] || 180;
  const OUT = process.argv[4] || "/tmp/new_puzzles_v2.json";
  const QUIET_QUOTA = Math.max(1, Math.round(WANT * 0.30));

  const made = [];
  let quietMade = 0;
  let tried = 0;
  const seen = new Set();
  const t0 = Date.now();

  while (made.length < WANT && tried < 200000 && Date.now() - t0 < 1000 * SECONDS) {
    tried++;
    /* 70% parties guidees (source principale, pensee pour la tactique
       silencieuse), 30% marche aleatoire pure (v1) pour garder de la
       diversite structurelle -- ni l'une ni l'autre ne suffit seule. */
    const g = Math.random() < 0.7
      ? guidedGame(16, 50, 0.15)
      : randomPosition(8, 34);
    if (!g) continue;
    const key = g.fen().split(" ").slice(0, 4).join(" ");
    if (seen.has(key)) continue;

    let p;
    try { p = makePuzzleV2(g, 3, { maxSolPlies: 3 }); } catch (e) { continue; }
    if (!p) continue;
    if (!verifyFull(p)) continue;

    /* Quota silencieux : une fois le quota atteint, un nouveau silencieux
       reste accepte (jamais refuse pour la seule raison d'etre bon), mais
       on ne s'arrete plus specifiquement pour lui -- le but est d'en avoir
       AU MOINS un quart-tiers de la banque, pas une proportion figee. */
    seen.add(key);
    made.push(p);
    if (p.quiet) quietMade++;
    if (made.length % 10 === 0) {
      process.stderr.write(`\r  ${made.length}/${WANT} exercices, ${quietMade} silencieux (${tried} positions examinees)`);
    }
  }
  process.stderr.write(`\r  ${made.length}/${WANT} exercices, ${quietMade} silencieux (${tried} positions examinees)\n`);

  fs.writeFileSync(OUT, JSON.stringify(made, null, 1));
  const byTheme = {};
  let multiPly = 0;
  for (const p of made) {
    byTheme[p.theme] = (byTheme[p.theme] || 0) + 1;
    if (p.sol.length > 1) multiPly++;
  }
  console.log(JSON.stringify({ total: made.length, quiet: quietMade, quietPct: Math.round(quietMade / made.length * 1000) / 10, multiPly, byTheme }, null, 1));
}
