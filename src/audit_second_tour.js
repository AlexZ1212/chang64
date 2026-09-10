#!/usr/bin/env node
/* Second tour sur les seuls exercices classes "autre coup" par
   audit_moteur.js.

   Usage :
     node audit_second_tour.js audit_gains.jsonl
     node audit_second_tour.js audit_gains.jsonl --profondeur=16 --reprendre

   Pourquoi il faut un second tour. audit_moteur.js interroge le moteur en
   MultiPV 2, indispensable pour mesurer l'ecart avec le deuxieme choix. Mais
   MultiPV desactive une partie des elagages : a profondeur egale, le coup
   annonce comme meilleur n'est pas toujours le meme qu'en MultiPV 1.
   Mesure du 2026-09-09 sur quinze exercices signales : trois changent de
   verdict entre MultiPV 1 et 2, et le meme reglage repete donne zero
   difference. Le desaccord ne vient donc pas du moteur mais du reglage.

   Et surtout, la bonne question n'est pas "le moteur est-il d'accord". Un
   exercice promet "trouvez le coup qui gagne", pas "trouvez le coup que
   Stockfish classe premier a profondeur 16". La question qui compte est donc
   : LE COUP STOCKE GAGNE-T-IL ENCORE ? On l'evalue directement, avec
   searchmoves, et c'est ce chiffre qui trie.

   La table de hachage est videe entre chaque recherche. Sans ca, la
   recherche restreinte au coup stocke remplit le cache et oriente celle qui
   suit : verifie, ca suffisait a inverser un verdict.
*/
const path = require("path"), fs = require("fs"), os = require("os");

const arg = n => { const a = process.argv.find(x => x.startsWith("--" + n + "=")); return a ? a.split("=")[1] : null; };
const JSONL = process.argv[2];
if (!JSONL || JSONL.startsWith("--")) { console.error("Usage : node audit_second_tour.js <fichier.jsonl> [--profondeur=16] [--reprendre]"); process.exit(1); }
const PROF = +(arg("profondeur") || 16);
const SORTIE = arg("sortie") || JSONL.replace(/\.jsonl$/, "") + "_second_tour.jsonl";
const REPRENDRE = process.argv.includes("--reprendre");
const BANQUE = arg("banque") || path.join(__dirname, "puzzles.json");
/* En dessous de ce seuil, le coup stocke ne gagne plus assez pour qu'un
   exercice le promette. Reglable. */
const SEUIL = +(arg("seuil") || 100);

const banque = JSON.parse(fs.readFileSync(BANQUE, "utf8"));
const parCode = new Map(banque.map(p => [p.code, p]));

const aRevoir = [];
for (const l of fs.readFileSync(JSONL, "utf8").split("\n")) {
  if (!l.trim()) continue;
  let o; try { o = JSON.parse(l); } catch (e) { continue; }
  if (o.verdict === "autre coup") aRevoir.push(o);
}
const dejaVus = new Set();
if (REPRENDRE && fs.existsSync(SORTIE))
  for (const l of fs.readFileSync(SORTIE, "utf8").split("\n"))
    if (l.trim()) { try { dejaVus.add(JSON.parse(l).code); } catch (e) {} }

console.log("Signales 'autre coup' :", aRevoir.length);
if (dejaVus.size) console.log("Deja repasses         :", dejaVus.size);
console.log("Profondeur", PROF, "| seuil de gain", SEUIL, "cp\n");

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
  await cmd("setoption name MultiPV value 1");
  capture = false;
  dire("moteur pret, MultiPV 1\n");

  const score = () => {
    const l = lignes.filter(x => /^info depth \d+ .*score/.test(x)).pop();
    if (!l) return null;
    const m = /score (cp|mate) (-?\d+)/.exec(l);
    if (!m) return null;
    return m[1] === "mate" ? (+m[2] > 0 ? 100000 : -100000) : +m[2];
  };
  const neuf = async fen => {
    await cmd("ucinewgame"); await cmd("isready"); await attendre(/readyok/, 20000);
    lignes = []; await cmd("position fen " + fen);
  };

  const res = { confirme: 0, faussAlerte: 0, perdLAvantage: [], sansReponse: 0 };
  const flux = fs.createWriteStream(SORTIE, { flags: REPRENDRE ? "a" : "w" });
  const t0 = Date.now(); let faits = 0;

  for (let i = 0; i < aRevoir.length; i++) {
    const o = aRevoir[i];
    if (dejaVus.has(o.code)) continue;
    const p = parCode.get(o.code);
    if (!p) continue;
    faits++;
    capture = true;

    await neuf(p.fen);
    await cmd("go depth " + PROF);
    const bm = await attendre(/^bestmove/, 90000);
    const scoreMeilleur = score();

    await neuf(p.fen);
    await cmd("go depth " + PROF + " searchmoves " + p.sol[0]);
    await attendre(/^bestmove/, 90000);
    const scoreStocke = score();
    capture = false;

    if (!bm || scoreStocke === null) { res.sansReponse++; continue; }
    const meilleur = bm.split(" ")[1];

    let verdict;
    if (meilleur === p.sol[0]) { verdict = "fausse alerte"; res.faussAlerte++; }
    else if (scoreStocke < SEUIL) { verdict = "perd l avantage"; res.perdLAvantage.push(o.code + " (" + (scoreStocke / 100).toFixed(2) + " contre " + (scoreMeilleur / 100).toFixed(2) + ")"); }
    else { verdict = "gagne quand meme"; res.confirme++; }

    flux.write(JSON.stringify({
      code: o.code, verdict: verdict, theme: p.theme, niveau: p.level,
      stocke: p.sol[0], moteur: meilleur,
      scoreStocke: scoreStocke, scoreMeilleur: scoreMeilleur, fen: p.fen
    }) + "\n");

    if (faits % 25 === 0) {
      const ms = (Date.now() - t0) / faits;
      dire("  " + faits + "/" + (aRevoir.length - dejaVus.size) + "   " + Math.round(ms) + " ms   " +
        "fausses alertes " + res.faussAlerte + ", gagnent quand meme " + res.confirme +
        ", perdent l avantage " + res.perdLAvantage.length +
        "   reste ~" + ((aRevoir.length - dejaVus.size - faits) * ms / 60000).toFixed(0) + " min");
    }
  }
  await new Promise(r => flux.end(r));
  process.stdout.write = vraiWrite;

  console.log("\n--- Second tour ---");
  console.log("  fausses alertes de MultiPV     :", res.faussAlerte);
  console.log("  le moteur prefere autre chose,");
  console.log("  mais le coup stocke gagne      :", res.confirme);
  console.log("  le coup stocke PERD l avantage :", res.perdLAvantage.length, " <- les vrais defauts");
  if (res.perdLAvantage.length) console.log("     " + res.perdLAvantage.slice(0, 40).join("\n     "));
  if (res.sansReponse) console.log("  sans reponse                   :", res.sansReponse);
  console.log("\n  Detail dans :", path.basename(SORTIE));
  process.exit(0);
})().catch(e => { process.stdout.write = vraiWrite; console.error("echec :", e); process.exit(1); });
