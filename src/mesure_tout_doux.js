/* Mesure du niveau « Tout doux » (2026-11-24, decision d'Alexandre : « Mesurer le 400 »).

   Le point le plus bas deja mesure de l'echelle de l'ordinateur (engine_browser.js,
   ECHELLE_ORDI) est le point 600, mesure a 585 le 21/11 (contre les points
   au-dessus, eux-memes cales sur Stockfish bride). On fait jouer le reglage
   « Tout doux » contre ce point 600, couleurs alternees, deux premiers coups
   tires au hasard pour varier les parties. Une partie sans fin au bout de 160
   demi-coups est jugee au materiel (3 pions d'avance au moins), sinon nulle.

   Usage :  node mesure_tout_doux.js [parties=200] [elo du reglage mesure=400]
   Ecrit le resultat dans la console et dans %TEMP%\chang64-tout-doux.log.

   Elo estime = 585 + 400 * log10(s / (1 - s)), s = score du reglage mesure.
   Ecart type d'une mesure a N parties : environ 400 / ln(10) / sqrt(N * s * (1 - s)) points. */
const vm = require("vm"), fs = require("fs"), path = require("path"), os = require("os");
const N = +process.argv[2] || 200, CIBLE = +process.argv[3] || 400, REF = 600, REF_MESURE = 585;
const ctx = { console, Date, Math };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8") + ";this.Game=Game;this.coupOrdinateur=coupOrdinateur;", ctx);
const VAL = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9, 6: 0 };
function materiel(g, c) {
  let s = 0;
  for (const p of g.board) if (p) s += ((p & 8 ? 1 : 0) === c ? 1 : -1) * (VAL[p & 7] || 0);
  return s;
}
const journal = path.join(os.tmpdir(), "chang64-tout-doux.log");
const ecrire = l => { console.log(l); fs.appendFileSync(journal, l + "\n"); };
ecrire("Debut " + new Date().toLocaleString("fr-FR") + " : " + N + " parties, reglage " + CIBLE + " contre le point " + REF + " (mesure " + REF_MESURE + ")");
let pts = 0, v = 0, n = 0, d = 0;
for (let k = 0; k < N; k++) {
  const g = new ctx.Game(), blanc = k % 2 === 0 ? CIBLE : REF;
  for (let i = 0; i < 2; i++) { const ms = g.moves(); g.makeMove(ms[Math.floor(Math.random() * ms.length)]); }
  let res = null;
  for (let ply = 0; ply < 160 && res === null; ply++) {
    const ms = g.moves();
    if (!ms.length) { res = g.inCheck() ? (g.turn === 0 ? 0 : 1) : 0.5; break; }
    if (typeof g.isDraw === "function" && g.isDraw()) { res = 0.5; break; }
    const elo = g.turn === 0 ? blanc : (blanc === CIBLE ? REF : CIBLE);
    const m = ctx.coupOrdinateur(g, elo) || ms[0];
    g.makeMove(m);
  }
  if (res === null) { const m = materiel(g, 0); res = m >= 3 ? 1 : m <= -3 ? 0 : 0.5; }
  const pourCible = blanc === CIBLE ? res : 1 - res;
  pts += pourCible; if (pourCible === 1) v++; else if (pourCible === 0) d++; else n++;
  if ((k + 1) % 20 === 0) ecrire("  " + (k + 1) + " parties : " + v + " gagnees, " + n + " nulles, " + d + " perdues");
}
const s = Math.min(.99, Math.max(.01, pts / N));
const elo = Math.round(REF_MESURE + 400 * Math.log10(s / (1 - s)));
const et = Math.round(400 / Math.LN10 / Math.sqrt(N * s * (1 - s)));
ecrire("Fin " + new Date().toLocaleString("fr-FR") + " : score " + (100 * s).toFixed(1) + " % -> Elo estime " + elo + " (ecart type environ " + et + ")");
