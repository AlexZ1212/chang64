/* Stockfish dans node, pour les controles de positions (2026-11-22).
   Meme moteur que le site (sf/package, version lite a un fil), lance comme
   dans coach_controle.js. Usage :
     const sf = await ouvrir("nom");
     const e = await sf.evaluer(fen, 12, ["e2e4"]);   // { cp, mate, best }, vu du camp au trait
     const l = await sf.coups(Game, fen, 10);          // [{ uci, cp, mate }] du meilleur au pire, vu du camp au trait
*/
const fs = require("fs"), path = require("path"), os = require("os");
const dodo = ms => new Promise(r => setTimeout(r, ms));
async function ouvrir(nom) {
  let lignes = [], capture = false;
  const vraiWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (c, ...r) => { if (capture) { String(c).split("\n").forEach(l => l && lignes.push(l)); return true; } return vraiWrite(c, ...r); };
  const dir = path.join(os.tmpdir(), "sf-chemin-" + nom);
  fs.mkdirSync(dir, { recursive: true });
  const bin = path.join(__dirname, "..", "..", "sf", "package", "bin");
  fs.copyFileSync(path.join(bin, "stockfish-18-lite-single.wasm"), path.join(dir, "stockfish.wasm"));
  fs.copyFileSync(path.join(bin, "stockfish-18-lite-single.js"), path.join(dir, "stockfish-18-lite-single.js"));
  capture = true;
  const sf = await require(path.join(dir, "stockfish-18-lite-single.js"))()();
  const cmd = c => sf.ccall("command", null, ["string"], [c], { async: true });
  const attendre = async (m, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const l = lignes.find(x => m.test(x)); if (l) return l; await dodo(1); } return null; };
  await cmd("uci"); await attendre(/uciok/, 30000);
  await cmd("setoption name Hash value 32");
  capture = false;
  const S = {
    async evaluer(fen, prof, coups) {
      capture = true; lignes = [];
      await cmd("position fen " + fen + (coups && coups.length ? " moves " + coups.join(" ") : ""));
      await cmd("go depth " + prof);
      const bm = await attendre(/^bestmove/, 300000);
      let cp = null, mate = null;
      for (const l of lignes) {
        const sc = /^info .*score (cp|mate) (-?\d+)/.exec(l); if (!sc) continue;
        if (sc[1] === "mate") { mate = +sc[2]; cp = (mate > 0 ? 1 : -1) * (20000 - Math.abs(mate) * 100); } else { mate = null; cp = +sc[2]; }
      }
      capture = false;
      const best = bm ? bm.split(/\s+/)[1] : null;
      return { cp, mate, best: best && best !== "(none)" ? best : null };
    },
    /* Chaque coup legal, evalue en le jouant puis en demandant la reponse :
       plus sur que MultiPV pour comparer TOUS les coups d'une position. */
    async coups(Game, fen, prof, avant) {
      const g = new Game(fen), joues = [];
      for (const u of avant || []) { const m = g.moves().find(x => g.uci(x) === u); g.makeMove(m); joues.push(u); }
      const out = [];
      for (const m of g.moves()) {
        const u = g.uci(m);
        g.makeMove(m);
        let cp, mate = null;
        if (g.isCheckmate()) { cp = 20000; mate = 1; }
        else if (!g.moves().length || g.isDraw()) cp = 0;
        else { const e = await S.evaluer(fen, prof, joues.concat([u])); cp = -e.cp; mate = e.mate === null ? null : -e.mate; }
        g.undoMove();
        out.push({ uci: u, cp, mate });
      }
      return out.sort((a, b) => b.cp - a.cp);
    },
    fermer() { process.stdout.write = vraiWrite; try { sf.terminate && sf.terminate(); } catch (e) {} }
  };
  return S;
}
module.exports = { ouvrir };
