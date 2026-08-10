/* Calibration Elo des niveaux du bot.

   Methode : tournoi toutes rondes entre les niveaux, chacun jouant les deux
   couleurs a partir d'ouvertures imposees pour eviter que toutes les parties
   se ressemblent. On en tire les ecarts Elo par maximum de vraisemblance
   (modele de Bradley-Terry, identique a celui d'Elo), puis on ancre l'echelle
   sur un joueur aleatoire legal.

   L'ancrage est une convention, pas une mesure : un joueur qui joue au hasard
   parmi les coups legaux est generalement situe autour de 400 Elo. Tout
   deplacement de cette ancre decale l'ensemble des niveaux d'autant, sans
   changer les ecarts, qui eux sont mesures.
*/
const { Game, search, pType, pColor, VAL, W } = require("./engine.js");

/* Bilan materiel vu des Blancs, en centiemes de pion. */
function material(g) {
  let m = 0;
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) { s += 7; continue; }
    const pc = g.board[s];
    if (!pc) continue;
    const v = VAL[pType(pc)] || 0;
    m += pColor(pc) === W ? v : -v;
  }
  return m;
}

const RANDOM_ANCHOR = 400;

/* Ouvertures imposees : 2 coups, varies, pour diversifier les parties. */
const BOOK = [
  "e4 e5", "e4 c5", "e4 e6", "e4 c6", "d4 d5", "d4 Nf6",
  "c4 e5", "Nf3 d5", "e4 d5", "d4 f5", "c4 c5", "Nf3 Nf6"
];

const PLAYERS = {
  rnd: { name: "aleatoire", pick: g => { const l = g.moves(); return l[(Math.random() * l.length) | 0]; } },
  L1:  { name: "Niveau 1", d: 1, t: 100,  rnd: 0.35 },
  L2:  { name: "Niveau 2", d: 2, t: 200,  rnd: 0.15 },
  L3:  { name: "Niveau 3", d: 3, t: 400,  rnd: 0 },
  L4:  { name: "Niveau 4", d: 4, t: 600, rnd: 0 }
};

function move(p, g) {
  if (p.pick) return p.pick(g);
  if (p.rnd && Math.random() < p.rnd) { const l = g.moves(); return l[(Math.random() * l.length) | 0]; }
  return search(g, p.d, p.t).move;
}

/* 1 = le premier gagne, 0 = le second, 0.5 = nulle */
function playGame(pw, pb, opening) {
  const g = new Game();
  for (const san of opening.split(" ")) {
    const mv = g.moves().find(m => g.san(m).replace(/[+#]/g, "") === san);
    if (mv) g.makeMove(mv);
  }
  /* Les parties entre niveaux forts trainent : a profondeur 4, une partie de
     300 coups prend plusieurs minutes. On borne a 140 demi-coups et on arbitre
     au materiel, ce qui est plus informatif qu'une nulle automatique et
     n'avantage aucun des deux joueurs. */
  for (let ply = 0; ply < 140; ply++) {
    const legal = g.moves();
    if (!legal.length) return g.inCheck() ? (g.turn === 0 ? 0 : 1) : 0.5;
    if (g.half >= 100) return 0.5;
    const mv = move(g.turn === 0 ? pw : pb, g);
    if (!mv) return 0.5;
    g.makeMove(mv);
  }
  const mat = material(g);
  if (mat > 150) return 1;
  if (mat < -150) return 0;
  return 0.5;
}

/* Elo par maximum de vraisemblance, descente de gradient simple. */
function fitElo(games, ids) {
  const R = {}; ids.forEach(i => R[i] = 1500);
  const exp = (a, b) => 1 / (1 + Math.pow(10, (R[b] - R[a]) / 400));
  for (let it = 0; it < 20000; it++) {
    const grad = {}; ids.forEach(i => grad[i] = 0);
    for (const { a, b, s } of games) {
      const e = exp(a, b);
      grad[a] += (s - e); grad[b] -= (s - e);
    }
    for (const i of ids) R[i] += 0.6 * grad[i] / games.length * 400;
  }
  return R;
}

(async () => {
  const ids = Object.keys(PLAYERS);
  const games = [];
  const score = {}, played = {};
  ids.forEach(i => { score[i] = 0; played[i] = 0; });

  const ROUNDS = +process.argv[2] || 4;   /* parties par couleur et par paire */
  let n = 0, total = 0;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) total += ROUNDS * 2;

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      for (let r = 0; r < ROUNDS; r++) {
        const op = BOOK[(r * 3 + i + j) % BOOK.length];
        for (const [w, b] of [[ids[i], ids[j]], [ids[j], ids[i]]]) {
          const s = playGame(PLAYERS[w], PLAYERS[b], op);
          games.push({ a: w, b: b, s });
          score[w] += s; score[b] += 1 - s;
          played[w]++; played[b]++;
          n++;
          if (n % 10 === 0) process.stderr.write(`\r  ${n}/${total} parties`);
        }
      }
    }
  }
  process.stderr.write(`\r  ${n}/${total} parties\n`);

  const R = fitElo(games, ids);
  const shift = RANDOM_ANCHOR - R.rnd;
  ids.forEach(i => R[i] = Math.round((R[i] + shift) / 25) * 25);

  console.log("\nRESULTATS (" + n + " parties)\n");
  console.log("  joueur        score      %     Elo estime");
  for (const i of ids.sort((a, b) => R[b] - R[a])) {
    const pct = (100 * score[i] / played[i]).toFixed(1);
    console.log("  " + PLAYERS[i].name.padEnd(12) +
      (score[i].toFixed(1) + "/" + played[i]).padStart(8) +
      pct.padStart(7) + "%" + String(R[i]).padStart(12));
  }
  console.log("\n  ancrage : joueur aleatoire = " + RANDOM_ANCHOR + " Elo (convention)");
  require("fs").writeFileSync("/tmp/elo.json", JSON.stringify(R, null, 1));
})();
