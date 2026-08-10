/* ============================================================
   Moteur d'échecs 0x88 — règles complètes
   ============================================================ */
const W = 0, B = 1;
const P = 1, N = 2, BI = 3, R = 4, Q = 5, K = 6;

const OFF_N = [-33, -31, -18, -14, 14, 18, 31, 33];
const OFF_B = [-17, -15, 15, 17];
const OFF_R = [-16, -1, 1, 16];
const OFF_K = [-17, -16, -15, -1, 1, 15, 16, 17];

const CASTLE_WK = 1, CASTLE_WQ = 2, CASTLE_BK = 4, CASTLE_BQ = 8;

function mk(type, color) { return type | (color << 3); }
function pType(p) { return p & 7; }
function pColor(p) { return p >> 3; }
function onBoard(sq) { return (sq & 0x88) === 0; }
function fileOf(sq) { return sq & 7; }
function rankOf(sq) { return sq >> 4; }
function sqName(sq) { return "abcdefgh"[fileOf(sq)] + (8 - rankOf(sq)); }
function nameSq(s) {
  const f = "abcdefgh".indexOf(s[0]);
  const r = 8 - parseInt(s[1], 10);
  return r * 16 + f;
}

const SYM = { 1: "p", 2: "n", 3: "b", 4: "r", 5: "q", 6: "k" };
const FROM_SYM = { p: P, n: N, b: BI, r: R, q: Q, k: K };

class Game {
  constructor(fen) {
    this.load(fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  }

  load(fen) {
    this.board = new Int8Array(128);
    this.kingSq = [-1, -1];
    this.history = [];
    this.posCounts = new Map();
    const parts = fen.trim().split(/\s+/);
    let sq = 0;
    for (const ch of parts[0]) {
      if (ch === "/") { sq = (sq + 16) & ~15; continue; }
      if (ch >= "1" && ch <= "8") { sq += parseInt(ch, 10); continue; }
      const color = ch === ch.toUpperCase() ? W : B;
      const t = FROM_SYM[ch.toLowerCase()];
      this.board[sq] = mk(t, color);
      if (t === K) this.kingSq[color] = sq;
      sq++;
    }
    this.turn = parts[1] === "b" ? B : W;
    this.castling = 0;
    if (parts[2] && parts[2] !== "-") {
      if (parts[2].includes("K")) this.castling |= CASTLE_WK;
      if (parts[2].includes("Q")) this.castling |= CASTLE_WQ;
      if (parts[2].includes("k")) this.castling |= CASTLE_BK;
      if (parts[2].includes("q")) this.castling |= CASTLE_BQ;
    }
    this.ep = parts[3] && parts[3] !== "-" ? nameSq(parts[3]) : -1;
    this.half = parts[4] ? parseInt(parts[4], 10) : 0;
    this.full = parts[5] ? parseInt(parts[5], 10) : 1;
    this.bump(1);
  }

  fen() {
    let s = "";
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[r * 16 + f];
        if (!p) { empty++; continue; }
        if (empty) { s += empty; empty = 0; }
        const sym = SYM[pType(p)];
        s += pColor(p) === W ? sym.toUpperCase() : sym;
      }
      if (empty) s += empty;
      if (r < 7) s += "/";
    }
    let c = "";
    if (this.castling & CASTLE_WK) c += "K";
    if (this.castling & CASTLE_WQ) c += "Q";
    if (this.castling & CASTLE_BK) c += "k";
    if (this.castling & CASTLE_BQ) c += "q";
    return `${s} ${this.turn === W ? "w" : "b"} ${c || "-"} ${this.ep >= 0 ? sqName(this.ep) : "-"} ${this.half} ${this.full}`;
  }

  posKey() { return this.fen().split(" ").slice(0, 4).join(" "); }
  bump(d) {
    const k = this.posKey();
    const v = (this.posCounts.get(k) || 0) + d;
    if (v <= 0) this.posCounts.delete(k); else this.posCounts.set(k, v);
  }

  attacked(sq, by) {
    // pions
    const dir = by === W ? 16 : -16; // case d'où vient le pion attaquant
    for (const d of [dir - 1, dir + 1]) {
      const s = sq + d;
      if (onBoard(s)) {
        const p = this.board[s];
        if (p && pColor(p) === by && pType(p) === P) return true;
      }
    }
    for (const d of OFF_N) {
      const s = sq + d;
      if (onBoard(s)) {
        const p = this.board[s];
        if (p && pColor(p) === by && pType(p) === N) return true;
      }
    }
    for (const d of OFF_K) {
      const s = sq + d;
      if (onBoard(s)) {
        const p = this.board[s];
        if (p && pColor(p) === by && pType(p) === K) return true;
      }
    }
    for (const d of OFF_B) {
      let s = sq + d;
      while (onBoard(s)) {
        const p = this.board[s];
        if (p) {
          if (pColor(p) === by && (pType(p) === BI || pType(p) === Q)) return true;
          break;
        }
        s += d;
      }
    }
    for (const d of OFF_R) {
      let s = sq + d;
      while (onBoard(s)) {
        const p = this.board[s];
        if (p) {
          if (pColor(p) === by && (pType(p) === R || pType(p) === Q)) return true;
          break;
        }
        s += d;
      }
    }
    return false;
  }

  inCheck(color) {
    const c = color === undefined ? this.turn : color;
    return this.attacked(this.kingSq[c], c ^ 1);
  }

  pseudoMoves(capturesOnly) {
    const us = this.turn, them = us ^ 1, out = [];
    const add = (from, to, flags, promo, captured) => {
      out.push({ from, to, flags: flags || 0, promo: promo || 0, captured: captured || 0, piece: this.board[from] });
    };
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = this.board[sq];
      if (!p || pColor(p) !== us) continue;
      const t = pType(p);
      if (t === P) {
        const fwd = us === W ? -16 : 16;
        const startRank = us === W ? 6 : 1;
        const promoRank = us === W ? 0 : 7;
        const one = sq + fwd;
        if (!capturesOnly && onBoard(one) && !this.board[one]) {
          if (rankOf(one) === promoRank) { for (const pr of [Q, R, BI, N]) add(sq, one, 8, pr, 0); }
          else {
            add(sq, one, 0, 0, 0);
            const two = sq + fwd * 2;
            if (rankOf(sq) === startRank && !this.board[two]) add(sq, two, 2, 0, 0);
          }
        }
        for (const d of [fwd - 1, fwd + 1]) {
          const to = sq + d;
          if (!onBoard(to)) continue;
          const cap = this.board[to];
          if (cap && pColor(cap) === them) {
            if (rankOf(to) === promoRank) { for (const pr of [Q, R, BI, N]) add(sq, to, 8 | 4, pr, cap); }
            else add(sq, to, 4, 0, cap);
          } else if (!cap && to === this.ep) {
            add(sq, to, 4 | 16, 0, mk(P, them));
          }
        }
      } else if (t === N || t === K) {
        const offs = t === N ? OFF_N : OFF_K;
        for (const d of offs) {
          const to = sq + d;
          if (!onBoard(to)) continue;
          const cap = this.board[to];
          if (cap) {
            if (pColor(cap) === them) add(sq, to, 4, 0, cap);
          } else if (!capturesOnly) add(sq, to, 0, 0, 0);
        }
      } else {
        const offs = t === BI ? OFF_B : t === R ? OFF_R : OFF_K;
        for (const d of offs) {
          let to = sq + d;
          while (onBoard(to)) {
            const cap = this.board[to];
            if (cap) {
              if (pColor(cap) === them) add(sq, to, 4, 0, cap);
              break;
            }
            if (!capturesOnly) add(sq, to, 0, 0, 0);
            to += d;
          }
        }
      }
    }
    if (!capturesOnly) {
      const kSq = this.kingSq[us];
      const them2 = them;
      if (us === W) {
        if ((this.castling & CASTLE_WK) && !this.board[117] && !this.board[118] &&
            !this.attacked(116, them2) && !this.attacked(117, them2) && !this.attacked(118, them2))
          add(116, 118, 32, 0, 0);
        if ((this.castling & CASTLE_WQ) && !this.board[115] && !this.board[114] && !this.board[113] &&
            !this.attacked(116, them2) && !this.attacked(115, them2) && !this.attacked(114, them2))
          add(116, 114, 64, 0, 0);
      } else {
        if ((this.castling & CASTLE_BK) && !this.board[5] && !this.board[6] &&
            !this.attacked(4, them2) && !this.attacked(5, them2) && !this.attacked(6, them2))
          add(4, 6, 32, 0, 0);
        if ((this.castling & CASTLE_BQ) && !this.board[3] && !this.board[2] && !this.board[1] &&
            !this.attacked(4, them2) && !this.attacked(3, them2) && !this.attacked(2, them2))
          add(4, 2, 64, 0, 0);
      }
    }
    return out;
  }

  moves(capturesOnly) {
    const res = [];
    for (const m of this.pseudoMoves(capturesOnly)) {
      this.makeMove(m);
      if (!this.attacked(this.kingSq[this.turn ^ 1], this.turn)) res.push(m);
      this.undoMove();
    }
    return res;
  }

  makeMove(m) {
    const us = this.turn, them = us ^ 1;
    this.history.push({
      m, castling: this.castling, ep: this.ep, half: this.half, full: this.full,
      kw: this.kingSq[0], kb: this.kingSq[1], key: this.posKey()
    });
    this.bump(-1);
    const piece = this.board[m.from];
    this.board[m.from] = 0;
    this.board[m.to] = m.promo ? mk(m.promo, us) : piece;
    if (m.flags & 16) this.board[m.to + (us === W ? 16 : -16)] = 0;
    if (m.flags & 32) { // petit roque
      const rf = us === W ? 119 : 7, rt = us === W ? 117 : 5;
      this.board[rt] = this.board[rf]; this.board[rf] = 0;
    }
    if (m.flags & 64) { // grand roque
      const rf = us === W ? 112 : 0, rt = us === W ? 115 : 3;
      this.board[rt] = this.board[rf]; this.board[rf] = 0;
    }
    if (pType(piece) === K) {
      this.kingSq[us] = m.to;
      this.castling &= us === W ? ~(CASTLE_WK | CASTLE_WQ) : ~(CASTLE_BK | CASTLE_BQ);
    }
    if (m.from === 119 || m.to === 119) this.castling &= ~CASTLE_WK;
    if (m.from === 112 || m.to === 112) this.castling &= ~CASTLE_WQ;
    if (m.from === 7 || m.to === 7) this.castling &= ~CASTLE_BK;
    if (m.from === 0 || m.to === 0) this.castling &= ~CASTLE_BQ;
    this.ep = (m.flags & 2) ? m.from + (us === W ? -16 : 16) : -1;
    this.half = (m.captured || pType(piece) === P) ? 0 : this.half + 1;
    if (us === B) this.full++;
    this.turn = them;
    this.bump(1);
  }

  undoMove() {
    const h = this.history.pop();
    if (!h) return;
    this.bump(-1);
    const m = h.m;
    const us = this.turn ^ 1;
    this.board[m.from] = m.promo ? mk(P, us) : this.board[m.to];
    this.board[m.to] = 0;
    if (m.flags & 16) {
      this.board[m.to + (us === W ? 16 : -16)] = m.captured;
    } else if (m.captured) {
      this.board[m.to] = m.captured;
    }
    if (m.flags & 32) {
      const rf = us === W ? 119 : 7, rt = us === W ? 117 : 5;
      this.board[rf] = this.board[rt]; this.board[rt] = 0;
    }
    if (m.flags & 64) {
      const rf = us === W ? 112 : 0, rt = us === W ? 115 : 3;
      this.board[rf] = this.board[rt]; this.board[rt] = 0;
    }
    this.castling = h.castling; this.ep = h.ep; this.half = h.half; this.full = h.full;
    this.kingSq[0] = h.kw; this.kingSq[1] = h.kb;
    this.turn = us;
    this.bump(1);
  }

  san(m) {
    const legal = this.moves();
    let s;
    if (m.flags & 32) s = "O-O";
    else if (m.flags & 64) s = "O-O-O";
    else {
      const t = pType(m.piece);
      if (t === P) {
        s = (m.flags & 4) ? "abcdefgh"[fileOf(m.from)] + "x" + sqName(m.to) : sqName(m.to);
        if (m.promo) s += "=" + SYM[m.promo].toUpperCase();
      } else {
        let dis = "";
        const same = legal.filter(x => x.to === m.to && x.from !== m.from && pType(x.piece) === t);
        if (same.length) {
          const sameFile = same.some(x => fileOf(x.from) === fileOf(m.from));
          const sameRank = same.some(x => rankOf(x.from) === rankOf(m.from));
          if (!sameFile) dis = "abcdefgh"[fileOf(m.from)];
          else if (!sameRank) dis = String(8 - rankOf(m.from));
          else dis = sqName(m.from);
        }
        s = SYM[t].toUpperCase() + dis + ((m.flags & 4) ? "x" : "") + sqName(m.to);
      }
    }
    this.makeMove(m);
    if (this.inCheck()) s += this.moves().length === 0 ? "#" : "+";
    this.undoMove();
    return s;
  }

  isCheckmate() { return this.inCheck() && this.moves().length === 0; }
  isStalemate() { return !this.inCheck() && this.moves().length === 0; }
  isInsufficient() {
    const pieces = [];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = this.board[sq];
      if (p && pType(p) !== K) pieces.push([pType(p), pColor(p), (fileOf(sq) + rankOf(sq)) & 1]);
    }
    if (pieces.length === 0) return true;
    if (pieces.length === 1 && (pieces[0][0] === N || pieces[0][0] === BI)) return true;
    if (pieces.length === 2 && pieces.every(x => x[0] === BI) && pieces[0][2] === pieces[1][2]) return true;
    return false;
  }
  isRepetition() { return (this.posCounts.get(this.posKey()) || 0) >= 3; }
  isDraw() { return this.isStalemate() || this.isInsufficient() || this.half >= 100 || this.isRepetition(); }
  isOver() { return this.moves().length === 0 || this.isDraw(); }

  moveFromUci(uci) {
    for (const m of this.moves()) {
      if (sqName(m.from) + sqName(m.to) + (m.promo ? SYM[m.promo] : "") === uci) return m;
    }
    return null;
  }
  uci(m) { return sqName(m.from) + sqName(m.to) + (m.promo ? SYM[m.promo] : ""); }
}

/* ============================================================
   Évaluation + recherche
   ============================================================ */
const VAL = { 1: 100, 2: 320, 3: 330, 4: 500, 5: 900, 6: 20000 };

const PST = {
  1: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10,
      5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5,
      5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  2: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30,
      -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30,
      -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  3: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10,
      -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10,
      -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  4: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5,
      -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
      -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  5: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10,
      -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10,
      -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  6: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
      20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
  61: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30,
      -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30,
      -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50]
};

function evaluate(g) {
  let score = 0, phase = 0;
  const list = [];
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) { sq += 7; continue; }
    const p = g.board[sq];
    if (!p) continue;
    const t = pType(p), c = pColor(p);
    if (t !== P && t !== K) phase += VAL[t];
    list.push([sq, t, c]);
  }
  const endgame = phase < 1800;
  for (const [sq, t, c] of list) {
    const idx = c === W ? rankOf(sq) * 8 + fileOf(sq) : (7 - rankOf(sq)) * 8 + fileOf(sq);
    let v = VAL[t] + (t === K && endgame ? PST[61][idx] : PST[t][idx]);
    score += c === W ? v : -v;
  }
  return g.turn === W ? score : -score;
}

const MATE = 100000;

function search(g, maxDepth, timeMs) {
  const t0 = Date.now();
  let best = null, bestScore = 0, stop = false;
  const killers = [];

  function order(moves, pvMove) {
    for (const m of moves) {
      let s = 0;
      if (pvMove && m.from === pvMove.from && m.to === pvMove.to && m.promo === pvMove.promo) s = 1e7;
      else if (m.captured) s = 1e6 + VAL[pType(m.captured)] * 10 - VAL[pType(m.piece)];
      if (m.promo) s += VAL[m.promo];
      m._s = s;
    }
    moves.sort((a, b) => b._s - a._s);
    return moves;
  }

  function quiesce(alpha, beta, ply) {
    const stand = evaluate(g);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    const caps = order(g.moves(true), null);
    for (const m of caps) {
      g.makeMove(m);
      const sc = -quiesce(-beta, -alpha, ply + 1);
      g.undoMove();
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }

  function alphabeta(depth, alpha, beta, ply, pvMove) {
    if ((Date.now() - t0) > timeMs) { stop = true; return alpha; }
    if (ply > 0 && (g.isRepetition() || g.half >= 100 || g.isInsufficient())) return 0;
    const moves = g.moves();
    if (moves.length === 0) return g.inCheck() ? -MATE + ply : 0;
    if (depth <= 0) return quiesce(alpha, beta, ply);
    order(moves, pvMove);
    let localBest = null;
    for (const m of moves) {
      g.makeMove(m);
      const ext = g.inCheck() ? 1 : 0;
      const sc = -alphabeta(depth - 1 + ext, -beta, -alpha, ply + 1, null);
      g.undoMove();
      if (stop) return alpha;
      if (sc > alpha) { alpha = sc; localBest = m; if (ply === 0) { best = m; bestScore = sc; } }
      if (alpha >= beta) break;
    }
    if (ply === 0 && !best && moves.length) best = moves[0];
    return alpha;
  }

  let pv = null;
  for (let d = 1; d <= maxDepth; d++) {
    const prevBest = best, prevScore = bestScore;
    alphabeta(d, -Infinity, Infinity, 0, pv);
    if (stop) { if (prevBest) { best = prevBest; bestScore = prevScore; } break; }
    pv = best;
    if (Math.abs(bestScore) > MATE - 100) break;
  }
  return { move: best, score: bestScore };
}

/* Recherche de mat forcé exhaustive (pour valider les exercices) */
function mateIn(g, n) {
  // renvoie la liste des coups qui matent en <= n coups du trait actuel
  function solve(depth) { // le camp au trait doit mater en <= depth
    if (depth <= 0) return false;
    const moves = g.moves();
    if (!moves.length) return false;
    for (const m of moves) {
      g.makeMove(m);
      let ok;
      const rep = g.moves();
      if (rep.length === 0) ok = g.inCheck();
      else if (depth === 1) ok = false;
      else {
        ok = true;
        for (const r of rep) {
          g.makeMove(r);
          const sub = solve(depth - 1);
          g.undoMove();
          if (!sub) { ok = false; break; }
        }
      }
      g.undoMove();
      if (ok) return m;
    }
    return false;
  }
  return solve(n);
}

function allMatingMoves(g, n) {
  const res = [];
  for (const m of g.moves()) {
    g.makeMove(m);
    const rep = g.moves();
    let ok;
    if (rep.length === 0) ok = g.inCheck();
    else if (n === 1) ok = false;
    else {
      ok = true;
      for (const r of rep) {
        g.makeMove(r);
        const sub = mateIn(g, n - 1);
        g.undoMove();
        if (!sub) { ok = false; break; }
      }
    }
    g.undoMove();
    if (ok) res.push(m);
  }
  return res;
}

module.exports = { Game, search, evaluate, mateIn, allMatingMoves, sqName, nameSq, pType, pColor, W, B, P, N, BI, R, Q, K, VAL };
