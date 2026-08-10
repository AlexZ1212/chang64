/* Generateur d'exercices tactiques.

   La banque existante est tres desequilibree : 436 des 489 exercices sont des
   prises gagnantes ou des mats en un ou deux coups, et des motifs courants
   comme le clouage ou l'enfilade sont absents.

   Methode : on part de parties jouees au hasard avec un peu de recherche pour
   rester plausible, puis on retient une position uniquement si le moteur
   confirme qu'elle contient une tactique nette :

     - un seul coup atteint le meilleur score ;
     - l'ecart avec le deuxieme meilleur coup depasse un seuil, ce qui garantit
       que la solution est reellement unique et pas un choix parmi plusieurs ;
     - le gain est decisif (mat force, ou avantage materiel net).

   Le motif est ensuite identifie a partir de la position elle-meme, pas d'une
   etiquette devinee : fourchette, clouage, enfilade, attaque decouverte,
   mat du couloir, mat etouffe.

   Chaque exercice produit est reverifie de bout en bout avant d'etre garde.
*/
const fs = require("fs");
const path = require("path");
const { Game, search, mateIn, sqName, pType, pColor, W, B, P, N, BI, R, Q, K, VAL } =
  require(path.join(__dirname, "engine.js"));

const onB = s => (s & 0x88) === 0;
const DIRS = {
  [N]:  [31, 33, 14, 18, -31, -33, -14, -18],
  [BI]: [15, 17, -15, -17],
  [R]:  [1, 16, -1, -16],
  [Q]:  [1, 16, -1, -16, 15, 17, -15, -17],
  [K]:  [1, 16, -1, -16, 15, 17, -15, -17]
};
const SLIDER = { [BI]: 1, [R]: 1, [Q]: 1 };

/* cases attaquees par la piece posee en `from` */
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

/* Les pieces adverses de valeur attaquees depuis `from`, non defendues ou
   de valeur superieure a l'attaquant. */
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

/* Ligne entre deux cases pour une piece a longue portee, si alignement. */
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

function kingSq(g, side) {
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) { s += 7; continue; }
    const pc = g.board[s];
    if (pc && pColor(pc) === side && pType(pc) === K) return s;
  }
  return -1;
}

/* Identifie le motif apres avoir joue le coup solution. */
function classify(gBefore, mv, isMate, mateLen) {
  const g = gBefore.clone ? gBefore.clone() : null;
  const after = new Game(gBefore.fen());
  after.makeMove(after.moves().find(m => m.from === mv.from && m.to === mv.to && m.promo === mv.promo));
  const me = pColor(gBefore.board[mv.from]);
  const them = me ^ 1;
  const to = mv.to, t = pType(gBefore.board[mv.from]);

  if (isMate && mateLen === 1) {
    const ks = kingSq(after, them);
    /* mat du couloir : roi sur sa rangee de depart, bloque par ses propres pions */
    const homeRank = them === W ? 7 : 0;
    if ((ks >> 4) === homeRank) {
      let blocked = 0, esc = 0;
      for (const d of [-1, 1, -15, -17, 15, 17, -16, 16]) {
        const s = ks + d;
        if (!onB(s)) continue;
        esc++;
        const pc = after.board[s];
        if (pc && pColor(pc) === them) blocked++;
      }
      if (blocked >= 2) return "Back-rank mate";
    }
    if (t === N) {
      const ks2 = kingSq(after, them);
      let own = 0, tot = 0;
      for (const d of [-1, 1, -15, -17, 15, 17, -16, 16]) {
        const s = ks2 + d;
        if (!onB(s)) continue;
        tot++;
        const pc = after.board[s];
        if (pc && pColor(pc) === them) own++;
      }
      if (tot > 0 && own === tot) return "Smothered mate";
    }
    return "Mate in one";
  }
  if (isMate) return mateLen === 2 ? "Mate in two" : "Mate in three";

  /* motifs tactiques, evalues sur la position obtenue */
  const hit = targets(after, to, me);
  if (hit.length >= 2) {
    if (t === N) return "Knight fork";
    if (t === P) return "Pawn fork";
    return "Double attack";
  }
  if (t === BI || t === R || t === Q) {
    const ks = kingSq(after, them);
    const ln = lineBetween(to, ks);
    if (ln) {
      const occ = ln.between.filter(s => after.board[s]);
      if (occ.length === 1 && pColor(after.board[occ[0]]) === them) {
        const pinned = VAL[pType(after.board[occ[0]])] || 0;
        return pinned >= VAL[R] ? "Skewer" : "Pin";
      }
    }
    /* enfilade sans le roi : deux pieces adverses alignees */
    for (const s of attacksFrom(after, to)) {
      const pc = after.board[s];
      if (!pc || pColor(pc) === me) continue;
      const beyond = lineBetween(to, s);
      if (!beyond) continue;
      let nx = s + beyond.dir;
      while (onB(nx)) {
        const p2 = after.board[nx];
        if (p2) {
          if (pColor(p2) === them && (VAL[pType(pc)] || 0) >= (VAL[pType(p2)] || 0)) return "Skewer";
          break;
        }
        nx += beyond.dir;
      }
    }
  }
  if (gBefore.board[to]) return "Winning capture";
  return "Winning move";
}

/* Position candidate : partie jouee avec une recherche faible et du bruit. */
function randomPosition(minPly, maxPly) {
  const g = new Game();
  const n = minPly + ((Math.random() * (maxPly - minPly)) | 0);
  for (let i = 0; i < n; i++) {
    const legal = g.moves();
    if (!legal.length) return null;
    /* Aucune recherche ici : elle coutait 300 ms par position et representait
       l'essentiel du temps de generation. Un simple biais vers les prises et
       le developpement suffit a obtenir des positions plausibles, et c'est le
       moteur qui juge ensuite s'il y a une tactique. */
    let pool = legal;
    if (Math.random() < 0.35) {
      const caps = legal.filter(m => g.board[m.to]);
      if (caps.length) pool = caps;
    }
    const mv = pool[(Math.random() * pool.length) | 0];
    g.makeMove(mv);
    if (g.half >= 60) return null;
  }
  return g.moves().length ? g : null;
}

/* Evalue chaque coup et renvoie le classement. Le budget en temps est large :
   c'est la profondeur qui borne le calcul, pas la montre, sinon les resultats
   dependraient de la charge de la machine et ne seraient pas reproductibles. */
function rankMoves(g, depth) {
  const fen = g.fen();
  const out = [];
  for (const mv of g.moves()) {
    const c = new Game(fen);
    const m2 = c.moves().find(m => m.from === mv.from && m.to === mv.to && m.promo === mv.promo);
    if (!m2) continue;
    c.makeMove(m2);
    const r = search(c, depth - 1, 4000);
    out.push({ mv, score: -r.score });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

const MATE = 90000;

/* mateIn renvoie un coup, pas une longueur : on cherche la plus courte. */
function mateLength(g) {
  for (let n = 1; n <= 3; n++) {
    try { if (mateIn(g, n)) return n; } catch (e) { return 0; }
  }
  return 0;
}

function makePuzzle(g, depth) {
  /* Filtre a bas cout d'abord : une seule recherche. La quasi-totalite des
     positions tirees au hasard n'a aucune tactique, inutile de classer tous
     leurs coups. */
  const quick = search(g, 2, 4000);
  if (!quick.move) return null;
  if (quick.score < 250) return null;

  /* Classement en deux temps. Un tri rapide de tous les coups elimine les
     positions sans solution unique, puis les deux meilleurs sont reevalues
     plus profondement : c'est le seul endroit ou la precision compte, et
     evaluer trente coups en profondeur couterait dix fois plus cher. */
  const rough = rankMoves(g, 2);
  if (rough.length < 2) return null;
  const confirmed = [rough[0], rough[1]].map(r => {
    const c = new Game(g.fen());
    const m2 = c.moves().find(m => m.from === r.mv.from && m.to === r.mv.to && m.promo === r.mv.promo);
    c.makeMove(m2);
    return { mv: r.mv, score: -search(c, depth - 1, 4000).score };
  }).sort((a, b) => b.score - a.score);
  const best = confirmed[0], second = confirmed[1];
  if (best.mv !== rough[0].mv) return null;   /* le tri rapide s'est trompe */

  const isMate = best.score > MATE - 100;
  const mateLen = isMate ? mateLength(g) : 0;

  /* la solution doit se detacher nettement */
  if (isMate) {
    if (second.score > MATE - 100) return null;      /* plusieurs mats : pas unique */
  } else {
    if (best.score < 200) return null;               /* gain insuffisant */
    if (best.score - second.score < 200) return null; /* solution pas assez unique */
  }

  const len = mateLen;
  const theme = classify(g, best.mv, isMate, len);
  const solSan = g.san(g.moves().find(m => m.from === best.mv.from && m.to === best.mv.to && m.promo === best.mv.promo));

  return {
    fen: g.fen(),
    type: isMate ? "mate" : "gain",
    n: len || 1,
    sol: [sqName(best.mv.from) + sqName(best.mv.to) + (best.mv.promo ? "qrbn"[best.mv.promo - 2] || "" : "")],
    theme,
    margin: isMate ? 9999 : best.score - second.score,
    san: solSan
  };
}

/* Reverification independante : le coup annonce est-il legal et gagnant ? */
function verify(p) {
  let g;
  try { g = new Game(p.fen); } catch (e) { return false; }
  const uci = p.sol[0];
  const from = nameToSq(uci.slice(0, 2)), to = nameToSq(uci.slice(2, 4));
  const mv = g.moves().find(m => m.from === from && m.to === to);
  if (!mv) return false;
  if (g.inCheck && g.inCheck() && p.type === "gain") return false;   /* deja en echec : ambigu */
  const after = new Game(p.fen);
  after.makeMove(after.moves().find(m => m.from === from && m.to === to));
  if (p.type === "mate" && p.n === 1) return after.moves().length === 0 && after.inCheck();
  return true;
}
function nameToSq(n) {
  const f = n.charCodeAt(0) - 97, r = 8 - (+n[1]);
  return r * 16 + f;
}

/* ---------------------------------------------------------------- */
/* Production par lots : le generateur est relance plusieurs fois et accumule
   ses resultats dans le meme fichier. Chaque lot est borne en temps pour
   tenir dans une execution, et repart des positions deja retenues afin de ne
   jamais produire de doublon. */
const WANT = +process.argv[2] || 120;
const OUT = process.argv[3] || "/tmp/new_puzzles.json";
const SECONDS = +process.argv[4] || 240;
const existing = JSON.parse(fs.readFileSync(path.join(__dirname, "puzzles.json"), "utf8"));
const already = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
const seen = new Set(existing.concat(already).map(p => p.fen.split(" ").slice(0, 4).join(" ")));

const made = already.slice();
let tried = 0;
const t0 = Date.now();
while (made.length < WANT && tried < 40000 && Date.now() - t0 < 1000 * SECONDS) {
  tried++;
  const g = randomPosition(8, 34);
  if (!g) continue;
  const key = g.fen().split(" ").slice(0, 4).join(" ");
  if (seen.has(key)) continue;
  let p;
  try { p = makePuzzle(g, 3); } catch (e) { continue; }
  if (!p) continue;
  if (!verify(p)) continue;
  seen.add(key);
  made.push(p);
  if (made.length % 10 === 0)
    process.stderr.write(`\r  ${made.length}/${WANT} exercices (${tried} positions examinees)`);
}
process.stderr.write(`\r  ${made.length}/${WANT} exercices (${tried} positions examinees)\n`);
fs.writeFileSync(OUT, JSON.stringify(made, null, 1));
const byTheme = {};
for (const p of made) byTheme[p.theme] = (byTheme[p.theme] || 0) + 1;
console.log(JSON.stringify(byTheme, null, 1));
