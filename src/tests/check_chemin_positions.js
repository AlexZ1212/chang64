/* Verification du contenu du chemin d'apprentissage (2026-11-22).
   Lancement : node tests/check_chemin_positions.js (apres node build_site.js)

   Tout fait d'echecs ecrit dans une lecon doit etre exact. Ce test relit
   chaque position de chemin/*.json (chapitres et test de placement) :
   - par le moteur de regles : coups legaux, mats et pats annonces, roque
     interdit, suite jouable, pieces dites defendues ou non, comptes
     d'attaquants et de defenseurs ;
   - par Stockfish, selon le champ "controle" de l'exercice :
       "meilleur" : les solutions sont les meilleurs coups, et tout autre coup
                    est nettement moins bon (au moins un pion d'ecart) ;
       "premier"  : la solution est le premier choix de Stockfish ;
       "bon"      : la solution n'est pas une faute (a moins de 0,8 pion du
                    meilleur coup) ; pour un geste qu'on apprend (roquer) ;
     et tout coup range dans "faux" avec sa raison propre perd vraiment au
     moins un pion et demi par rapport a la solution, sauf promotion mineure ;
   - puis les textes : les 10 langues partout, aucun tic d'ecriture, la
     ponctuation francaise du fichier construit. */
const fs = require("fs"), path = require("path");
const SRC = path.join(__dirname, "..");
const { Game } = require(path.join(SRC, "engine.js"));
const CHEMIN = require(path.join(SRC, "chemin_build.js"));
const { CODES } = require(path.join(SRC, "langues", "registre.js"));
const { ouvrir } = require("./outils/stockfish_node.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const PROF = 12;
const coup = (g, u) => g.moves().find(m => g.uci(m) === u);
function partie(ex) {
  const g = new Game(ex.fen);
  if (ex.avant) g.makeMove(coup(g, ex.avant));
  return g;
}
/* Apres une prise blanche sur la case, les Noirs peuvent-ils reprendre ? */
function reprises(ex, caseNom) {
  const g = partie(ex), out = [];
  for (const m of g.moves()) {
    if (g.uci(m).slice(2, 4) !== caseNom) continue;
    g.makeMove(m);
    out.push({ par: g.history[g.history.length - 1] ? caseDe(m) : "", n: new Set(g.moves().filter(x => g.uci(x).slice(2, 4) === caseNom).map(x => g.uci(x).slice(0, 2))).size });
    g.undoMove();
  }
  return out;
  function caseDe(m) { return g.uci(m).slice(0, 2); }
}

async function controlerExo(sf, ex, nom) {
  const g = partie(ex);
  T(nom + " : les Blancs jouent", g.turn === 0);
  const legaux = g.moves().map(m => g.uci(m));
  T(nom + " : solutions legales", ex.sol.every(u => legaux.includes(u)), ex.sol.join(" "));
  if (ex.cible) T(nom + " : la case marquee est l'arrivee de la solution", ex.sol[0].slice(2, 4) === ex.cible);
  const mats = [], pats = [];
  for (const m of g.moves()) { g.makeMove(m); if (g.isCheckmate()) mats.push(g.uci(m)); else if (g.isStalemate()) pats.push(g.uci(m)); g.undoMove(); }
  const tri = a => a.slice().sort().join(" ");
  if (ex.mat) T(nom + " : les solutions sont exactement les mats en un coup", tri(mats) === tri(ex.sol), tri(mats));
  if (ex.pat) T(nom + " : les coups annonces font bien pat, et eux seuls", tri(pats) === tri(ex.pat), tri(pats));
  for (const u of ex.interdit || []) T(nom + " : le coup " + u + " est bien interdit", !legaux.includes(u));
  if (ex.suite) {
    const h = partie(ex); h.makeMove(coup(h, ex.sol[0]));
    let jouable = true;
    for (const u of ex.suite) { const m = coup(h, u); if (!m) { jouable = false; break; } h.makeMove(m); }
    T(nom + " : la suite est jouable", jouable, ex.suite.join(" "));
    if (jouable && ex.suiteMat) T(nom + " : la suite finit par un mat", h.isCheckmate());
    if (jouable && !ex.suiteMat) T(nom + " : la suite finit par une prise", h.history[h.history.length - 1].m.captured > 0);
  }
  for (const c of ex.nonDefendues || []) { const r = reprises(ex, c); T(nom + " : " + c + " n'est pas defendue", r.length > 0 && r.every(x => x.n === 0), JSON.stringify(r)); }
  for (const c of ex.defendues || []) { const r = reprises(ex, c); T(nom + " : " + c + " est defendue", r.length > 0 && r.every(x => x.n > 0), JSON.stringify(r)); }
  if (ex.compte) {
    const att = new Set(g.moves().filter(m => g.uci(m).slice(2, 4) === ex.compte.case).map(m => g.uci(m).slice(0, 2))).size;
    const r = reprises(ex, ex.compte.case), def = r.length ? Math.max(...r.map(x => x.n)) : 0;
    T(nom + " : " + ex.compte.attaquants + " attaquants et " + ex.compte.defenseurs + " defenseurs sur " + ex.compte.case, att === ex.compte.attaquants && def === ex.compte.defenseurs, att + " / " + def);
  }
  if (!ex.controle && !Object.keys(ex.faux || {}).some(u => u !== "*")) return;
  if (ex.mat && !ex.controle) return;
  /* Stockfish : chaque coup legal, du meilleur au pire. */
  const L = await sf.coups(Game, ex.fen, PROF, ex.avant ? [ex.avant] : []);
  const cp = u => L.find(x => x.uci === u).cp;
  const sols = ex.sol.map(cp), minSol = Math.min(...sols), maxSol = Math.max(...sols);
  const autres = L.filter(x => !ex.sol.includes(x.uci));
  const resume = L.slice(0, 5).map(x => x.uci + ":" + x.cp).join(" ");
  if (ex.controle === "meilleur") {
    T(nom + " : Stockfish, la solution est le meilleur coup", ex.sol.includes(L[0].uci), resume);
    T(nom + " : Stockfish, les solutions se valent", maxSol - minSol <= 150, sols.join(" "));
    T(nom + " : Stockfish, tout autre coup est nettement moins bon", !autres.length || autres[0].cp <= minSol - 100, resume);
  } else if (ex.controle === "premier") {
    T(nom + " : Stockfish, la solution est son premier choix", ex.sol.includes(L[0].uci), resume);
  } else if (ex.controle === "bon") {
    T(nom + " : Stockfish, la solution n'est pas une faute", minSol >= L[0].cp - 80, resume);
  }
  for (const u of Object.keys(ex.faux || {})) {
    if (u === "*" || (ex.pat || []).includes(u)) continue;
    T(nom + " : Stockfish, le coup " + u + " est bien moins bon que la solution", cp(u) <= minSol - 150, u + ":" + cp(u) + " contre " + minSol);
  }
}

(async () => {
  const D = CHEMIN.charger();
  T("le chemin se charge et passe le controle du moteur de regles", (() => { try { CHEMIN.controler(D); return true; } catch (e) { return e.message; } })() === true);
  T("trois chapitres : Je debute, Toutes les regles, Ne rien donner", D.chapitres.map(c => c.id).join() === "debut,regles,securite", D.chapitres.map(c => c.id).join());
  T("le chapitre 1 est celui de l'application (integre)", D.chapitres[0].integre === true && !D.chapitres[0].etapes);

  const sf = await ouvrir("check-chemin");
  for (const c of D.chapitres) {
    if (c.integre) continue;
    console.log("\n--- Chapitre " + c.id + " ---");
    T(c.id + " : entre 3 et 6 lecons", c.etapes.length >= 3 && c.etapes.length <= 6, String(c.etapes.length));
    for (let i = 0; i < c.etapes.length; i++) {
      T(c.id + " lecon " + (i + 1) + " : 2 a 4 exercices", c.etapes[i].exos.length >= 2 && c.etapes[i].exos.length <= 4, String(c.etapes[i].exos.length));
      for (let j = 0; j < c.etapes[i].exos.length; j++) await controlerExo(sf, c.etapes[i].exos[j], c.id + " " + (i + 1) + "." + (j + 1));
    }
    /* Le boss : une position de depart ou il manque une piece aux Noirs. */
    const g = new Game(c.boss.fen), depart = new Game();
    const compte = (x, coul) => x.fen().split(" ")[0].replace(/[^a-zA-Z]/g, "").split("").filter(p => (p === p.toUpperCase()) === (coul === "w")).sort().join("");
    T(c.id + " boss : les Blancs ont toutes leurs pieces et commencent", g.turn === 0 && compte(g, "w") === compte(depart, "w"));
    T(c.id + " boss : il manque exactement une piece aux Noirs", compte(g, "b").length === compte(depart, "b").length - 1, compte(g, "b"));
    T(c.id + " boss : la partie est jouable (20 coups au depart)", g.moves().length === 20);
    T(c.id + " boss : niveau le plus facile", c.boss.niveau === 1);
  }

  console.log("\n--- Test de placement ---");
  const P = D.placement.positions;
  T("dix positions", P.length === 10, String(P.length));
  const rang = p => p.chapitre ? D.chapitres.findIndex(c => c.id === p.chapitre) : D.chapitres.length;
  T("les positions suivent l'ordre des chapitres", P.every((p, i) => i === 0 || rang(p) >= rang(P[i - 1])), P.map(rang).join(""));
  T("chaque chapitre sorti a au moins deux positions", D.chapitres.every(c => P.filter(p => p.chapitre === c.id).length >= 2));
  T("chaque position est controlee par Stockfish ou par un mat", P.every(p => p.mat || p.controle === "meilleur"));
  for (let i = 0; i < P.length; i++) await controlerExo(sf, P[i], "placement " + (i + 1));
  sf.fermer();

  console.log("\n--- Textes ---");
  const textes = [];
  const voir = (o, ou) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) { o.forEach((x, i) => voir(x, ou + "[" + i + "]")); return; }
    if (typeof o.en === "string") { textes.push([ou, o]); return; }
    for (const k in o) voir(o[k], ou + "." + k);
  };
  voir(D.plan, "plan"); D.chapitres.forEach(c => voir(c, c.id)); voir(D.placement, "placement");
  T("chaque position du test a son explication", D.placement.positions.every(p => p.explication && typeof p.explication.en === "string"));
  T("des textes a controler", textes.length > 100, String(textes.length));
  const incomplets = textes.filter(([, o]) => CODES.some(c => typeof o[c] !== "string" || !o[c].trim()));
  T("chaque texte existe dans les 10 langues", incomplets.length === 0, incomplets.slice(0, 3).map(x => x[0]).join(" ; "));
  const copies = textes.filter(([, o]) => o.en.length > 25 && CODES.some(c => c !== "en" && o[c] === o.en));
  T("aucune langue n'a garde la phrase anglaise", copies.length === 0, copies.slice(0, 3).map(x => x[0]).join(" ; "));
  const tics = textes.filter(([, o]) => CODES.some(c => /[·•●○]|\p{Extended_Pictographic}/u.test(o[c]) || (c !== "ru" && /—/.test(o[c]))));
  T("ni point median, ni emoji, ni tiret cadratin", tics.length === 0, tics.slice(0, 3).map(x => x[0]).join(" ; "));
  const vous = textes.filter(([, o]) => /\b(vous|votre|vos)\b/i.test(o.fr));
  T("le francais tutoie", vous.length === 0, vous.slice(0, 3).map(x => x[0]).join(" ; "));
  const longs = [];
  D.chapitres.forEach(c => (c.etapes || []).forEach((et, i) => { for (const l of CODES) { if (et.intro[l].length > 420) longs.push(c.id + " " + (i + 1) + " " + l + " intro"); et.exos.forEach((ex, j) => { if (ex.consigne[l].length > 190) longs.push(c.id + " " + (i + 1) + "." + (j + 1) + " " + l); }); } }));
  T("textes courts : une lecon tient sur un ecran de telephone", longs.length === 0, longs.slice(0, 5).join(" ; "));

  /* Le fichier construit : ponctuation francaise, et rien d'anglais ailleurs. */
  const site = path.join(SRC, "site", "data");
  if (fs.existsSync(path.join(site, "chemin-fr.json"))) {
    const brut = fs.readFileSync(path.join(site, "chemin-fr.json"), "utf8");
    T("site : pas de « : ; ! ? » precede d'une espace ordinaire en francais", !/[a-zà-ÿ0-9)] [:;!?]/i.test(brut), (brut.match(/.{12}[a-zà-ÿ0-9)] [:;!?].{6}/i) || [""])[0]);
    for (const l of CODES) {
      const j = JSON.parse(fs.readFileSync(path.join(site, "chemin-" + l + ".json"), "utf8"));
      T("site " + l + " : chaque position du test porte son explication", j.placement.every(p => typeof p.ex === "string" && p.ex.length > 20 && p.ex.length < 200));
      T("site " + l + " : 3 chapitres, 10 positions, boss en derniere etape", j.chapitres.length === 3 && j.placement.length === 10 &&
        j.chapitres.slice(1).every(c => c.etapes[c.etapes.length - 1].boss && c.etapes[c.etapes.length - 1].exos.length === 0));
    }
    const plan = /const CHEMIN_PLAN=(\[[^\]]*\])/.exec(fs.readFileSync(path.join(SRC, "site", "index.html"), "utf8"));
    /* Le motif propose apres le boss doit exister dans Resoudre. */
    const motifs = JSON.parse(fs.readFileSync(path.join(site, "theme-levels.json"), "utf8"));
    for (const c of D.chapitres) if (c.theme) T("site : le motif du chapitre " + c.id + " existe dans Resoudre (" + c.theme + ")", Object.prototype.hasOwnProperty.call(motifs, c.theme));
    /* Le script est compacte : les cles n'y ont plus de guillemets. */
    let pose = null;
    try { pose = plan ? JSON.stringify(new Function("return " + plan[1])()) : null; } catch (e) {}
    T("site : le plan pose dans le script est celui des fichiers", pose === CHEMIN.plan(), plan ? plan[1] : "absent");
  } else T("site construit (node build_site.js)", false);

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
