/* Chemin d'apprentissage (onglet Apprendre, 2026-11-22) : preparation par
   build_site.js. Le contenu est dans chemin/ : un fichier par chapitre, voir
   chemin/LISEZ-MOI.md. Aucun code a toucher pour ajouter un chapitre.

   - plan()   : le resume pose dans le script (jeton __CHEMIN_PLAN__ de
                apprendre.js) : l'ordre des chapitres et leur nombre de lecons,
                de quoi savoir sans rien charger si un chapitre est fini ;
   - ecrire() : data/chemin-<langue>.json, les textes et les positions dans la
                langue de la page (repli sur l'anglais, signale par le build).

   Chaque position est controlee ici par le moteur de regles (coup legal, mat
   reel, suite jouable) : une position fausse arrete la construction du site.
   tests/check_chemin_positions.js va plus loin (Stockfish). */
const fs = require("fs"), path = require("path");
const { Game } = require("./engine.js");
const { CODES } = require("./langues/registre.js");
const DOSSIER = path.join(__dirname, "chemin");

const lire = f => JSON.parse(fs.readFileSync(path.join(DOSSIER, f), "utf8"));
function charger() {
  const plan = lire("plan.json");
  const chapitres = plan.chapitres.map(id => {
    const c = lire(id + ".json");
    if (c.id !== id) throw new Error("chemin/" + id + ".json : id attendu « " + id + " », trouve « " + c.id + " »");
    return c;
  });
  return { plan, chapitres, placement: lire("placement.json") };
}

/* ---------- Controle par le moteur de regles ---------- */
const coup = (g, u) => g.moves().find(m => g.uci(m) === u);
function controlerExo(ex, ou) {
  const erreur = m => { throw new Error("Chemin, " + ou + " : " + m); };
  let g;
  try { g = new Game(ex.fen); } catch (e) { erreur("position illisible (" + ex.fen + ")"); }
  if (ex.avant) { const m = coup(g, ex.avant); if (!m) erreur("coup prealable illegal " + ex.avant); g.makeMove(m); }
  if (!Array.isArray(ex.sol) || !ex.sol.length) erreur("aucune solution");
  for (const u of ex.sol) if (!coup(g, u)) erreur("solution illegale " + u);
  if (ex.cible && ex.sol[0].slice(2, 4) !== ex.cible) erreur("la case marquee n'est pas l'arrivee");
  if (ex.mat) {
    const mats = [];
    for (const m of g.moves()) { g.makeMove(m); if (g.isCheckmate()) mats.push(g.uci(m)); g.undoMove(); }
    const tries = a => a.slice().sort().join(",");
    if (tries(mats) !== tries(ex.sol)) erreur("les mats possibles (" + mats.join(" ") + ") ne sont pas les solutions (" + ex.sol.join(" ") + ")");
  }
  /* « Joue un coup qui ne fait pas pat, n'importe lequel » (2026-11-22,
     demande d'Alexandre) : les solutions sont exactement les coups qui ne
     font pas pat, aucun ne donne de piece (sinon « n'importe lequel » serait
     faux), et chaque coup qui fait pat a sa raison. */
  if (ex.sansPat) {
    if (ex.mat || ex.reponse) erreur("un exercice sansPat n'a ni mat ni reponse");
    const pats = [], bons = [], donnes = [];
    for (const m of g.moves()) {
      const u = g.uci(m);
      g.makeMove(m);
      if (!g.isCheckmate() && !g.moves().length) pats.push(u);
      else { bons.push(u); if (g.moves().some(x => x.captured)) donnes.push(u); }
      g.undoMove();
    }
    const tries = a => a.slice().sort().join(",");
    if (!pats.length) erreur("aucun coup ne fait pat : l'exercice n'a pas d'objet");
    if (tries(bons) !== tries(ex.sol)) erreur("les coups qui ne font pas pat (" + bons.join(" ") + ") ne sont pas les solutions (" + ex.sol.join(" ") + ")");
    if (tries(pats) !== tries(ex.pat || [])) erreur("les coups qui font pat (" + pats.join(" ") + ") ne sont pas ceux du champ pat");
    if (donnes.length) erreur("ces coups acceptes donnent une piece : " + donnes.join(" "));
    for (const u of pats) if (!(ex.faux || {})[u]) erreur("le coup " + u + " fait pat et n'a pas sa raison dans faux");
  }
  for (const u of Object.keys(ex.faux || {})) if (u !== "*" && !coup(g, u)) erreur("coup faux illegal " + u);
  for (const u of Object.keys(ex.faux || {})) if (ex.sol.includes(u)) erreur("le coup " + u + " est a la fois juste et faux");
  /* Mat en deux (chapitre 9) : les solutions sont exactement les premiers
     coups qui forcent le mat au coup suivant contre toute defense ; il n'y a
     pas de mat en un ; la reponse noire prevue est legale apres chaque
     solution, et le joueur a bien un mat ensuite. */
  if (ex.reponse) {
    if (ex.mat || ex.suite) erreur("un mat en deux n'a ni mat ni suite");
    const matEnUn = () => g.moves().some(m => { g.makeMove(m); const k = g.isCheckmate(); g.undoMove(); return k; });
    if (matEnUn()) erreur("il y a un mat en un : ce n'est pas un mat en deux");
    const forcent = [];
    for (const m of g.moves()) {
      g.makeMove(m);
      const rep = g.moves();
      const ok = rep.length > 0 && rep.every(r => { g.makeMove(r); const k = matEnUn(); g.undoMove(); return k; });
      g.undoMove();
      if (ok) forcent.push(g.uci(m));
    }
    const tries = x => x.slice().sort().join(",");
    if (tries(forcent) !== tries(ex.sol)) erreur("les coups qui forcent le mat en deux (" + forcent.join(" ") + ") ne sont pas les solutions (" + ex.sol.join(" ") + ")");
    for (const u of ex.sol) {
      g.makeMove(coup(g, u));
      const r = coup(g, ex.reponse);
      if (!r) erreur("reponse " + ex.reponse + " illegale apres " + u);
      g.makeMove(r); if (!matEnUn()) erreur("pas de mat apres " + u + " " + ex.reponse); g.undoMove();
      g.undoMove();
    }
  }
  if (ex.suite) {
    const s = coup(g, ex.sol[0]); g.makeMove(s);
    for (const u of ex.suite) { const m = coup(g, u); if (!m) erreur("suite illegale " + u); g.makeMove(m); }
  }
}
function controler(D) {
  for (const c of D.chapitres) {
    if (c.integre) continue;
    if (!Array.isArray(c.etapes) || !c.etapes.length) throw new Error("Chemin, chapitre " + c.id + " : aucune lecon");
    c.etapes.forEach((et, i) => {
      if (!Array.isArray(et.exos) || !et.exos.length) throw new Error("Chemin, chapitre " + c.id + ", lecon " + (i + 1) + " : aucun exercice");
      et.exos.forEach((ex, j) => controlerExo(ex, "chapitre " + c.id + ", lecon " + (i + 1) + ", exercice " + (j + 1)));
    });
    if (c.boss) { try { new Game(c.boss.fen); } catch (e) { throw new Error("Chemin, chapitre " + c.id + " : position du boss illisible"); } }
  }
  const ids = D.chapitres.map(c => c.id);
  D.placement.positions.forEach((p, i) => {
    controlerExo(p, "test de placement, position " + (i + 1));
    if (p.chapitre && !ids.includes(p.chapitre)) throw new Error("Chemin, test de placement, position " + (i + 1) + " : chapitre inconnu " + p.chapitre);
  });
}

/* ---------- Ce que le script sait sans rien charger ---------- */
function plan() {
  const D = charger();
  controler(D);
  return JSON.stringify(D.chapitres.map(c => c.integre ? { id: c.id } : { id: c.id, n: c.etapes.length, boss: c.boss ? 1 : 0 }));
}

/* ---------- Les textes, langue par langue ---------- */
function ecrire(OUT, ponct) {
  const D = charger();
  controler(D);
  fs.mkdirSync(OUT + "/data", { recursive: true });
  const manques = [];
  for (const code of CODES) {
    let absents = 0;
    const tx = o => {
      if (o === undefined || o === null) return undefined;
      if (typeof o === "string") return o;
      if (typeof o[code] === "string") return o[code];
      absents++;
      return o.en;
    };
    const exo = ex => {
      const o = { fen: ex.fen, sol: ex.sol, consigne: tx(ex.consigne) };
      for (const k of ["cible", "avant", "mat", "suite", "reponse"]) if (ex[k] !== undefined) o[k] = ex[k];
      if (ex.ensuite) o.ensuite = tx(ex.ensuite);
      if (ex.apres) o.apres = tx(ex.apres);
      if (ex.faux) o.faux = Object.fromEntries(Object.entries(ex.faux).map(([u, v]) => [u, tx(v)]));
      return o;
    };
    const sortie = {
      chapitres: D.chapitres.map(c => {
        const o = { id: c.id, titre: tx(c.titre), desc: tx(c.desc) };
        if (c.integre) return o;
        if (c.theme) o.theme = c.theme;
        o.etapes = c.etapes.map(et => ({ titre: tx(et.titre), intro: tx(et.intro), exos: et.exos.map(exo) }));
        if (c.boss) o.etapes.push({ titre: tx(c.boss.titre), intro: tx(c.boss.intro), fen: c.boss.fen,
          boss: { fen: c.boss.fen, niveau: c.boss.niveau || 1, gagne: tx(c.boss.gagne) }, exos: [] });
        return o;
      }),
      aVenir: tx(D.plan.aVenir) || "",
      placement: D.placement.positions.map(p => {
        const o = { fen: p.fen, sol: p.sol, ch: p.chapitre || "", ex: tx(p.explication) || "" };
        for (const k of ["avant", "mat"]) if (p[k] !== undefined) o[k] = p[k];
        return o;
      })
    };
    if (absents) manques.push(code + " (" + absents + ")");
    fs.writeFileSync(OUT + "/data/chemin-" + code + ".json", JSON.stringify(ponct ? ponct(code, sortie) : sortie));
  }
  console.log("Chemin            : " + D.chapitres.length + " chapitres, " + D.placement.positions.length + " positions de placement, " +
    CODES.length + " langues" + (manques.length ? " ; textes manquants : " + manques.join(", ") : ", textes complets"));
  return manques;
}
module.exports = { charger, controler, controlerExo, plan, ecrire };
