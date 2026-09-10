/* Pour une liste de codes : evaluation Stockfish du coup STOCKE (via
   searchmoves, qui force le moteur a n'examiner que celui-la) et du coup
   qu'il prefere. Sans ca, "le moteur prefere un autre coup" ne dit pas si le
   coup stocke gagne encore. */
const path = require("path"), fs = require("fs"), os = require("os");
const BANQUE = process.argv[2];
const CODES = process.argv[3].split(/[ ,]+/).filter(Boolean);
const PROF = +(process.argv[4] || 16);
const banque = JSON.parse(fs.readFileSync(BANQUE, "utf8"));

const vraiWrite = process.stdout.write.bind(process.stdout);
let lignes = [], capture = false;
process.stdout.write = (c, ...r) => { if (capture) { String(c).split("\n").forEach(l => l && lignes.push(l)); return true; } return vraiWrite(c, ...r); };
const dire = s => vraiWrite(s + "\n");
const dodo = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(os.tmpdir(), "sf-audit");
  fs.mkdirSync(dir, { recursive: true });
  const src = path.join(__dirname, "sf", "package", "bin");
  fs.copyFileSync(path.join(src, "stockfish-18-lite-single.wasm"), path.join(dir, "stockfish.wasm"));
  fs.copyFileSync(path.join(src, "stockfish-18-lite-single.js"), path.join(dir, "stockfish-18-lite-single.js"));
  capture = true;
  const sf = await require(path.join(dir, "stockfish-18-lite-single.js"))()();
  const cmd = c => sf.ccall("command", null, ["string"], [c], { async: true });
  const attendre = async (m, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const l = lignes.find(x => m.test(x)); if (l) return l; await dodo(5); } return null; };
  await cmd("uci"); await attendre(/uciok/, 20000);
  await cmd("setoption name Hash value 64");
  capture = false;

  const note = l => { const m = /score (cp|mate) (-?\d+)/.exec(l); if (!m) return null; return m[1] === "mate" ? "mat en " + Math.abs(+m[2]) : (+m[2] > 0 ? "+" : "") + (+m[2] / 100).toFixed(2); };

  dire("code   | motif            | coup stocke        | coup du moteur");
  for (const code of CODES) {
    const p = banque.find(x => x.code === code);
    if (!p) { dire(code + " introuvable"); continue; }
    /* Table de hachage videe entre les deux recherches. Sans ca la premiere,
       restreinte au coup stocke, remplit le cache et oriente la seconde :
       le premier essai de ce script rendait le coup stocke meilleur qu'il
       n'est, sur des positions ou une recherche neuve dit le contraire. */
    capture = true;
    await cmd("ucinewgame"); await cmd("isready"); await attendre(/readyok/, 20000);
    lignes = [];
    await cmd("position fen " + p.fen);
    await cmd("go depth " + PROF + " searchmoves " + p.sol[0]);
    await attendre(/^bestmove/, 60000);
    const nStocke = note(lignes.filter(l => /^info depth \d+ .*score/.test(l)).pop() || "");
    await cmd("ucinewgame"); await cmd("isready"); await attendre(/readyok/, 20000);
    lignes = [];
    await cmd("position fen " + p.fen);
    await cmd("go depth " + PROF);
    const bm = await attendre(/^bestmove/, 60000);
    const nMeilleur = note(lignes.filter(l => /^info depth \d+ .*score/.test(l)).pop() || "");
    capture = false;
    dire(code + " | " + (p.theme || "").padEnd(16) + " | " +
      (p.sol[0] + " " + nStocke).padEnd(18) + " | " + bm.split(" ")[1] + " " + nMeilleur);
  }
  process.stdout.write = vraiWrite;
  process.exit(0);
})().catch(e => { process.stdout.write = vraiWrite; console.error(e); process.exit(1); });
