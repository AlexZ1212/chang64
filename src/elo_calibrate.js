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
  L1:  { name: "Niveau 1", d: 1, t: 120,  rnd: 0.35 },
  L2:  { name: "Niveau 2", d: 2, t: 280,  rnd: 0.15 },
  L3:  { name: "Niveau 3", d: 3, t: 700,  rnd: 0 },
  L4:  { name: "Niveau 4", d: 4, t: 1500, rnd: 0 }
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

/* Elo par maximum de vraisemblance, avec regularisation.

   Sans elle, le resultat n'a aucun sens : quand un joueur ne perd jamais,
   la vraisemblance n'a pas de maximum fini et l'estimation part vers
   l'infini. C'est exactement ce qui arrive ici, ou chaque niveau bat le
   precedent sur toutes les parties. Une premiere version annoncait 4325 Elo
   pour une recherche a profondeur 3, ce qui depasserait tout ce qui existe.

   On ajoute donc a chaque joueur deux parties fictives, une gagnee et une
   perdue, contre un adversaire moyen. Cela suffit a rendre l'estimation
   finie, au prix d'un leger tassement des ecarts : les valeurs obtenues sont
   des minorants, pas des mesures exactes. */
function fitElo(games, ids) {
  const R = {}; ids.forEach(i => R[i] = 1500);
  const MOYEN = 1500, PRIOR = 1;
  const att = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));
  for (let it = 0; it < 30000; it++) {
    const grad = {}; ids.forEach(i => grad[i] = 0);
    for (const { a, b, s } of games) {
      const e = att(R[a], R[b]);
      grad[a] += (s - e); grad[b] -= (s - e);
    }
    /* parties fictives : une victoire et une defaite contre un joueur moyen */
    for (const i of ids) {
      grad[i] += PRIOR * (1 - att(R[i], MOYEN));
      grad[i] += PRIOR * (0 - att(R[i], MOYEN));
    }
    for (const i of ids) R[i] += 0.35 * grad[i] / (games.length + 2 * PRIOR) * 400;
  }
  return R;
}

/* Production par lots : le tournoi est relance plusieurs fois et accumule ses
   parties dans un fichier. Chaque lot est borne en temps pour tenir dans une
   execution, et repart de la ou le precedent s'est arrete. */
const STORE = "/tmp/elo_games.json";
const BUDGET = (+process.argv[3] || 240) * 1000;

(async () => {
  const ids = Object.keys(PLAYERS);
  const games = require("fs").existsSync(STORE)
    ? JSON.parse(require("fs").readFileSync(STORE, "utf8")) : [];
  const score = {}, played = {};
  ids.forEach(i => { score[i] = 0; played[i] = 0; });

  const ROUNDS = +process.argv[2] || 4;   /* parties par couleur et par paire */
  let n = 0, total = 0;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) total += ROUNDS * 2;

  /* Chaque appariement porte une cle stable : on saute ceux deja joues. */
  const t0 = Date.now();
  let joues = 0;
  outer:
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      for (let r = 0; r < ROUNDS; r++) {
        const op = BOOK[(r * 3 + i + j) % BOOK.length];
        for (const [w, b] of [[ids[i], ids[j]], [ids[j], ids[i]]]) {
          const cle = w + ">" + b + "#" + r;
          if (games.some(g => g.cle === cle)) continue;
          if (Date.now() - t0 > BUDGET) break outer;
          const s = playGame(PLAYERS[w], PLAYERS[b], op);
          games.push({ a: w, b: b, s, cle });
          joues++;
          process.stderr.write(`\r  ${games.length}/${total} parties (${joues} ce lot)`);
        }
      }
    }
  }
  require("fs").writeFileSync(STORE, JSON.stringify(games));
  process.stderr.write(`\r  ${games.length}/${total} parties (${joues} ce lot)\n`);

  /* Le classement se recalcule sur l'ensemble des parties accumulees. */
  for (const g of games) {
    score[g.a] += g.s; score[g.b] += 1 - g.s;
    played[g.a]++; played[g.b]++;
  }
  n = games.length;
  if (n < total) { console.log("\nLot termine. Relancer pour continuer : " + n + "/" + total); }

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
