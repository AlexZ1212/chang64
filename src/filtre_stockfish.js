#!/usr/bin/env node
/* Garde-barriere Stockfish : filtre une fournee AVANT merge_puzzles.js.

   Usage :
     node filtre_stockfish.js fournee.json
     node filtre_stockfish.js fournee.json --profondeur=18
     node filtre_stockfish.js fournee.json --reprendre
     node filtre_stockfish.js fournee.json --exigence=souple
     node filtre_stockfish.js fournee.json --marge-defense=50

   Pourquoi ce script existe. isClearlyBest(), qui decide a la generation si
   un coup est LE bon, tranche avec le moteur maison, peu profond. Il ne voit
   pas un mat en quatre. L'audit du 2026-09-09 a mesure ce que ca laisse
   passer : sur 40 164 exercices de gain deja en ligne, 430 etaient faux.
   275 posaient une question impossible -- la position n'est pas gagnante,
   meme au meilleur coup -- et 155 avaient une solution qui gache une
   position gagnante, dont 30 qui font mater le joueur qui la suit.
   Un pour cent, reparti uniformement sur tous les motifs. Ce n'est pas un
   accident ancien : le meme critere tourne encore, donc chaque nouvelle
   fournee en contient autant. Ce filtre est ce qui empeche de refaire
   l'audit de quatre heures apres chaque minage.

   Ce qu'il verifie, pour un GAIN, a CHAQUE coup a nous de la sequence :
     1. la position est reellement gagnante au meilleur coup ;
     2. le coup propose gagne encore ;
     3. en exigence stricte (defaut), le coup propose est LE meilleur, et il
        devance le deuxieme choix d'au moins la marge demandee.
   Et a chaque replique adverse :
     4. c'est la meilleure defense, ou elle n'en est qu'a --marge-defense
        centipions (defaut 50) : sinon la ligne n'est pas forcee, le joueur
        apprendrait a battre une defense que personne ne jouerait.

   Sequences (2026-10-17). Depuis le 2026-09-14 le mineur prolonge tous les
   gains jusqu'a quatre decisions, mais ce filtre ne validait que sol[0] :
   les coups suivants n'etaient garantis que par le moteur maison, celui-la
   meme qui laissait passer 1 % d'exercices faux. Un echec APRES le premier
   coup ne rejette pas l'exercice : le premier coup a ete valide, la
   question reste juste. La sequence est coupee juste avant le coup fautif,
   et finit toujours sur un coup a nous. Le motif d'un coup silencieux est
   recalcule sur la ligne coupee, parce que classifyQuiet() le tire de la
   ligne entiere (une Deflection a besoin de son troisieme demi-coup).

   Trois recherches par coup a nous, table de hachage videe entre chacune.
   Ce n'est pas de la prudence excessive : la recherche restreinte au coup
   propose remplit le cache et oriente la suivante, verifie le 2026-09-09 sur
   #C1970 ou ca suffisait a inverser le verdict.
   Et l'identite du meilleur coup est etablie en MultiPV 1, jamais en
   MultiPV 2 : MultiPV desactive une partie des elagages et change le coup
   annonce a profondeur egale. Mesure sur quinze exercices signales, trois
   changeaient de verdict entre les deux reglages. MultiPV 2 ne sert donc
   qu'a mesurer l'ecart, pas a designer le vainqueur.

   Les MATS ne passent pas par le moteur. "Mate-t-il en n, et pas en moins"
   se tranche exactement avec mateIn() du moteur maison, sans profondeur a
   choisir ni verdict a nuancer. On le fait ici aussi, parce que la fournee
   n'a encore ete verifiee par personne.
*/
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Game, mateIn } = require(path.join(__dirname, "engine.js"));
const { verifyFull, classifyQuiet } = require(path.join(__dirname, "gen_puzzles_v2.js"));

/* --- Controles exacts, sans moteur externe --- */
function verdictMat(p) {
  if (!verifyFull(p)) return "sequence illegale ou ne mate pas";
  if (p.sol.length !== 2 * p.n - 1) return "longueur de solution incoherente avec n";
  /* Un mat annonce en n qui se fait en moins est un exercice qui refusera la
     solution la plus courte, celle que le joueur trouvera. */
  if (p.n > 1 && mateIn(new Game(p.fen), p.n - 1)) return "mat plus court que celui annonce";
  return null;
}

/* --- Verdicts sur les reponses du moteur. Purs, donc testables sans lui.
   Les scores sont du point de vue du camp au trait, comme les donne UCI. --- */

/* Un coup a nous. r = { meilleur, scoreMeilleur, scorePropose, ecart }. */
function verdictCoup(r, coup, o) {
  if (!r || r.meilleur == null || r.scorePropose == null) return "pas de reponse du moteur";
  if (r.scoreMeilleur < o.seuil) return "position non gagnante (" + (r.scoreMeilleur / 100).toFixed(2) + ")";
  if (r.scorePropose < o.seuil) return "le coup propose ne gagne pas (" + (r.scorePropose / 100).toFixed(2) + ")";
  if (o.stricte && r.meilleur !== coup) return "le moteur prefere " + r.meilleur;
  if (o.stricte && r.ecart != null && r.ecart < o.marge) return "deuxieme coup trop proche (" + r.ecart + "cp)";
  return null;
}

/* Une replique adverse. r = { meilleur, scoreMeilleur, scorePropose }, du
   point de vue du defenseur : la replique proposee ne doit pas lui couter
   plus de margeDefense par rapport a sa meilleure defense. */
function verdictDefense(r, coup, o) {
  if (!r || r.meilleur == null || r.scorePropose == null) return "pas de reponse du moteur";
  if (r.meilleur === coup) return null;
  const perte = r.scoreMeilleur - r.scorePropose;
  if (perte > o.margeDefense) return "defense non forcee, le moteur prefere " + r.meilleur + " (" + perte + "cp)";
  return null;
}

/* Parcourt la sequence d'un gain. moteur = { coup(fen, uci), defense(fen, uci) },
   asynchrones. Rend { motif } si l'exercice est rejete, sinon { sol, tronque }
   ou sol est la sequence retenue (eventuellement coupee). */
async function examinerGain(p, moteur, o) {
  const g = new Game(p.fen);
  const traces = [];
  for (let i = 0; i < p.sol.length; i++) {
    const fen = g.fen();
    const nous = i % 2 === 0;
    const r = nous ? await moteur.coup(fen, p.sol[i]) : await moteur.defense(fen, p.sol[i]);
    traces.push(Object.assign({ i }, r));
    const m = nous ? verdictCoup(r, p.sol[i], o) : verdictDefense(r, p.sol[i], o);
    if (m) {
      if (i === 0) return { motif: m, traces };
      /* Coupe avant le coup fautif, et jamais apres une replique adverse :
         un exercice finit sur un coup a nous. */
      const garde = nous ? i - 1 : i;
      return { sol: p.sol.slice(0, garde), tronque: "demi-coup " + (i + 1) + " : " + m, traces };
    }
    g.makeMove(g.moves().find(x => g.uci(x) === p.sol[i]));
  }
  return { sol: p.sol.slice(), tronque: null, traces };
}

/* Applique une sequence coupee a l'exercice : san, et motif d'un coup
   silencieux, qui dependent de la ligne entiere. */
function couper(p, sol) {
  const q = Object.assign({}, p, { sol });
  const g = new Game(p.fen), coups = [], san = [];
  for (const u of sol) {
    const mv = g.moves().find(x => g.uci(x) === u);
    san.push(g.san(mv)); coups.push({ mv }); g.makeMove(mv);
  }
  q.san = san.join(" ");
  if (p.quiet) {
    const t = classifyQuiet(new Game(p.fen), coups);
    q.theme = t.theme; q.explain = t.detail;
  }
  return q;
}

module.exports = { verdictMat, verdictCoup, verdictDefense, examinerGain, couper };

if (require.main === module) {
const arg = n => { const a = process.argv.find(x => x.startsWith("--" + n + "=")); return a ? a.split("=")[1] : null; };
const ENTREE = process.argv[2];
if (!ENTREE || ENTREE.startsWith("--")) {
  console.error("Usage : node filtre_stockfish.js <fournee.json> [--profondeur=16] [--marge=200] [--seuil=100] [--marge-defense=50] [--exigence=stricte|souple] [--reprendre]");
  process.exit(1);
}
const PROF = +(arg("profondeur") || 16);
const O = {
  marge: +(arg("marge") || 200),
  /* En dessous de ce seuil, on ne peut pas promettre "trouvez le coup qui
     gagne du materiel". 100 centipions, c'est un pion. */
  seuil: +(arg("seuil") || 100),
  margeDefense: +(arg("marge-defense") || 50),
  stricte: (arg("exigence") || "stricte") === "stricte"
};
const REPRENDRE = process.argv.includes("--reprendre");

const base = ENTREE.replace(/\.json$/, "");
const F_RETENUS = base + ".retenus.json";
const F_REJETES = base + ".rejetes.json";
const F_JOURNAL = base + ".filtre.jsonl";

const fournee = JSON.parse(fs.readFileSync(ENTREE, "utf8"));
console.log("Fournee            :", fournee.length, "exercices");
console.log("Profondeur", PROF, "| seuil de gain", O.seuil, "cp | marge", O.marge,
  "cp | marge de defense", O.margeDefense, "cp | exigence", O.stricte ? "stricte" : "souple");

/* Chaque exercice examine est ecrit au fil de l'eau. Une passe sur 50 000
   exercices dure des heures : une coupure ne doit pas tout effacer. */
const deja = new Map();
if (REPRENDRE && fs.existsSync(F_JOURNAL)) {
  for (const l of fs.readFileSync(F_JOURNAL, "utf8").split("\n")) {
    if (!l.trim()) continue;
    try { const o = JSON.parse(l); deja.set(o.cle, o); } catch (e) { /* ligne tronquee */ }
  }
  console.log("Deja examines      :", deja.size, "(reprise)");
}
/* La fournee n'a pas encore de code : on identifie par position + solution,
   ce qui est unique et stable d'une reprise a l'autre. */
const cleDe = p => p.fen + "|" + (p.sol || []).join(" ");

const vraiWrite = process.stdout.write.bind(process.stdout);
let lignes = [], capture = false;
process.stdout.write = (c, ...r) => { if (capture) { String(c).split("\n").forEach(l => l && lignes.push(l)); return true; } return vraiWrite(c, ...r); };
const dire = s => vraiWrite(s + "\n");
const dodo = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(os.tmpdir(), "sf-filtre");
  fs.mkdirSync(dir, { recursive: true });
  const src = path.join(__dirname, "sf", "package", "bin");
  fs.copyFileSync(path.join(src, "stockfish-18-lite-single.wasm"), path.join(dir, "stockfish.wasm"));
  fs.copyFileSync(path.join(src, "stockfish-18-lite-single.js"), path.join(dir, "stockfish-18-lite-single.js"));
  capture = true;
  const sf = await require(path.join(dir, "stockfish-18-lite-single.js"))()();
  const cmd = c => sf.ccall("command", null, ["string"], [c], { async: true });
  const attendre = async (m, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const l = lignes.find(x => m.test(x)); if (l) return l; await dodo(5); } return null; };
  await cmd("uci"); await attendre(/uciok/, 30000);
  await cmd("setoption name Hash value 64");
  capture = false;
  dire("moteur pret\n");

  const notes = () => {
    const out = {};
    for (const l of lignes.filter(x => /^info depth \d+ .*score/.test(x))) {
      const mp = /multipv (\d+)/.exec(l), sc = /score (cp|mate) (-?\d+)/.exec(l), pv = / pv (\S+)/.exec(l);
      if (!sc) continue;
      const val = sc[1] === "mate" ? (+sc[2] > 0 ? 100000 : -100000) : +sc[2];
      out[mp ? mp[1] : "1"] = { score: val, coup: pv ? pv[1] : null };
    }
    return out;
  };
  const neuf = async fen => {
    await cmd("ucinewgame"); await cmd("isready"); await attendre(/readyok/, 30000);
    lignes = []; await cmd("position fen " + fen);
  };
  /* Le meilleur coup en MultiPV 1, puis le coup propose evalue seul. */
  const meilleurEtPropose = async (fen, uci) => {
    await cmd("setoption name MultiPV value 1");
    await neuf(fen);
    await cmd("go depth " + PROF);
    const bm = await attendre(/^bestmove/, 120000);
    const nMeilleur = notes()["1"];
    await neuf(fen);
    await cmd("go depth " + PROF + " searchmoves " + uci);
    await attendre(/^bestmove/, 120000);
    const nPropose = notes()["1"];
    return {
      meilleur: bm ? bm.split(" ")[1] : null,
      scoreMeilleur: nMeilleur ? nMeilleur.score : null,
      scorePropose: nPropose ? nPropose.score : null
    };
  };
  const moteur = {
    coup: async (fen, uci) => {
      capture = true;
      const r = await meilleurEtPropose(fen, uci);
      /* L'ecart avec le deuxieme choix. MultiPV 2 seulement ici. */
      r.ecart = null;
      if (O.stricte) {
        await cmd("setoption name MultiPV value 2");
        await neuf(fen);
        await cmd("go depth " + PROF);
        await attendre(/^bestmove/, 120000);
        const d = notes();
        if (d["1"] && d["2"]) r.ecart = d["1"].score - d["2"].score;
      }
      capture = false;
      return r;
    },
    defense: async (fen, uci) => {
      capture = true;
      const r = await meilleurEtPropose(fen, uci);
      capture = false;
      return r;
    }
  };

  const retenus = [], rejetes = [];
  const journal = fs.createWriteStream(F_JOURNAL, { flags: REPRENDRE ? "a" : "w" });
  const causes = {}, coupes = {};
  let nCoupes = 0, decisionsAvant = 0, decisionsApres = 0;
  const t0 = Date.now(); let faits = 0;

  for (let i = 0; i < fournee.length; i++) {
    const p = fournee[i];
    const cle = cleDe(p);

    let motif = null, sol = p.sol, tronque = null;
    const vu = deja.get(cle);
    /* Un journal d'avant le 2026-10-17 n'a juge que le premier coup : on ne
       reprend son verdict que s'il rejetait, ou si la sequence tient en un
       coup. */
    if (vu && (vu.solRetenue || vu.motif || p.sol.length === 1)) {
      motif = vu.motif; sol = vu.solRetenue || p.sol; tronque = vu.tronque || null;
    }
    else if (p.type === "mate") { motif = verdictMat(p); }
    else if (!verifyFull(p)) { motif = "sequence illegale"; }
    else {
      faits++;
      const r = await examinerGain(p, moteur, O);
      motif = r.motif || null;
      if (!motif) { sol = r.sol; tronque = r.tronque; }
      const t = r.traces[0] || {};
      journal.write(JSON.stringify({
        cle, motif, sol: p.sol[0], moteur: t.meilleur,
        scorePropose: t.scorePropose, scoreMeilleur: t.scoreMeilleur, ecart: t.ecart,
        solRetenue: motif ? null : sol, tronque, traces: r.traces
      }) + "\n");
    }

    if (motif) {
      rejetes.push(Object.assign({ motifRejet: motif }, p));
      /* Regroupe par cause : sans le score ni le coup prefere par le moteur. */
      const c = motif.replace(/\s*\([^)]*\)/, "").replace(/ [a-h][1-8][a-h][1-8][qrbn]?$/, "");
      causes[c] = (causes[c] || 0) + 1;
    }
    else if (tronque) {
      nCoupes++;
      const c = tronque.replace(/^demi-coup \d+ : /, "").replace(/\s*\([^)]*\)/, "").replace(/ [a-h][1-8][a-h][1-8][qrbn]?$/, "");
      coupes[c] = (coupes[c] || 0) + 1;
      decisionsAvant += Math.ceil(p.sol.length / 2); decisionsApres += Math.ceil(sol.length / 2);
      retenus.push(couper(p, sol));
    }
    else {
      if (p.type === "gain") { decisionsAvant += Math.ceil(p.sol.length / 2); decisionsApres += Math.ceil(p.sol.length / 2); }
      retenus.push(p);
    }

    if ((i + 1) % 25 === 0) {
      const ms = (Date.now() - t0) / Math.max(1, faits);
      dire("  " + (i + 1) + "/" + fournee.length + "   retenus " + retenus.length +
        " (dont " + nCoupes + " coupes), rejetes " + rejetes.length + "   " + Math.round(ms) + " ms/exercice" +
        "   reste ~" + ((fournee.length - i - 1) * ms / 3600000).toFixed(1) + " h");
    }
  }
  await new Promise(r => journal.end(r));
  process.stdout.write = vraiWrite;

  fs.writeFileSync(F_RETENUS, JSON.stringify(retenus));
  fs.writeFileSync(F_REJETES, JSON.stringify(rejetes, null, 1));

  console.log("\n--- Resultat ---");
  console.log("  retenus  :", retenus.length, "/", fournee.length,
    "(" + (100 * retenus.length / Math.max(1, fournee.length)).toFixed(1) + " %)");
  console.log("  rejetes  :", rejetes.length);
  for (const [c, n] of Object.entries(causes).sort((a, b) => b[1] - a[1]))
    console.log("     " + String(n).padStart(6) + "  " + c);
  console.log("  sequences coupees :", nCoupes, "  (decisions des gains retenus :", decisionsAvant, "->", decisionsApres + ")");
  for (const [c, n] of Object.entries(coupes).sort((a, b) => b[1] - a[1]))
    console.log("     " + String(n).padStart(6) + "  " + c);
  console.log("\n  " + path.basename(F_RETENUS), "-> a passer a merge_puzzles.js");
  console.log("  " + path.basename(F_REJETES), "-> a regarder si le taux de rejet depasse quelques pour cent");
  /* Seuil d'alerte different selon l'exigence, sinon il crie a tort.
     En souple on ne rejette que les exercices faux, mesures a 1 % sur la
     banque : au-dela de 15 %, c'est le minage qui deraille.
     En stricte s'ajoute le rejet des positions a deux coups gagnants, mesure
     a 30 % sur la banque en ligne. Un lot sain tourne donc autour de 30 % de
     rejet, et l'alerte ne se declenche qu'au-dela de 45 %.
     Les sequences coupees ne comptent pas : l'exercice reste juste. */
  const taux = 100 * rejetes.length / Math.max(1, fournee.length);
  const alerte = O.stricte ? 45 : 15;
  if (taux > alerte) console.log("\n  ATTENTION : " + taux.toFixed(1) + " % de rejet, au-dela des " + alerte +
    " % attendus en exigence " + (O.stricte ? "stricte" : "souple") + ".\n  A ce niveau c'est le minage qu'il faut regarder, pas le filtre.");
  process.exit(0);
})().catch(e => { process.stdout.write = vraiWrite; console.error("echec :", e); process.exit(1); });
}
