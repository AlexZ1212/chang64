/* Badges illustres (2026-11-15) : preparation par build_site.js.
   - code()   : badges.js avec la liste des identifiants et familles injectee ;
   - ecrire() : data/badges-medailles.json (metal + symbole SVG) et
                data/badges-<langue>.json ({id: [nom, condition, anecdote]},
                plus _ui : libelles de la collection et noms des familles).
   Le francais vient de badges-catalogue.js (source unique) ; les autres
   langues de badges-textes/<code>.json. Une langue incomplete retombe, badge
   par badge, sur l'anglais : le build le signale sans s'arreter. */
const fs = require("fs"), path = require("path");
const CATALOGUE = require("./badges-catalogue.js");
const { CODES, PAR_CODE } = require("./langues/registre.js");
const DOSSIER = path.join(__dirname, "badges-textes");

function lireLangue(code) {
  const f = path.join(DOSSIER, code + ".json");
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
}
/* Le menu (menu.js, 2026-11-15) suit les badges dans le meme script : il
   s'en sert pour sa grille et ses statistiques. */
const NOUVEAUTES = JSON.parse(fs.readFileSync(path.join(__dirname, "nouveautes.json"), "utf8"))
  .sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
function code() {
  const liste = CATALOGUE.map(b => [b[0], b[1]]);
  return fs.readFileSync(path.join(__dirname, "badges.js"), "utf8").replace("__BADGES_LISTE__", JSON.stringify(liste)) + "\n" +
    fs.readFileSync(path.join(__dirname, "menu.js"), "utf8").replace("__NOUVEAUTES_NOMBRE__", String(NOUVEAUTES.length)) + "\n" +
    fs.readFileSync(path.join(__dirname, "objectif.js"), "utf8") + "\n" +
    fs.readFileSync(path.join(__dirname, "defis.js"), "utf8");
}
/* Conditions qui citent un nom deja traduit ailleurs dans le site (motif,
   niveau, finale, etape de Je debute) : elles sont recomposees ici a partir
   du dictionnaire de la langue, pour reprendre exactement les memes mots que
   le reste de l'interface. Gabarits dans _ui (cond:*), anglais par defaut. */
const MOTIFS = { winning_capture: "Winning capture", double_attack: "Double attack", skewer: "Skewer",
  mate_in_two: "Mate in two", winning_move: "Winning move", knight_fork: "Knight fork", mate_in_one: "Mate in one",
  back_rank_mate: "Back-rank mate", pin: "Pin", pawn_fork: "Pawn fork", deflection: "Deflection",
  quiet_move: "Quiet move", mate_in_three: "Mate in three" };
const NIVEAUX = ["Beginner", "Casual", "Solid", "Tough"], NIVEAUX_MK = { mk_facile: "Easy", mk_moyen: "Medium", mk_difficile: "Hard" };
const FINALES = { eg_kq: "Queen vs King", eg_kr: "Rook vs King", eg_krr: "Two rooks vs King", eg_kbn: "Bishop and knight", eg_kp: "King and pawn" };
const ETAPES = ["How the pieces move", "Taking a piece", "Checkmate", "Back-rank mate", "The fork", "The pin", "Your first game"];
const GABARITS = { "cond:theme": "{theme}: {n}", "cond:niveau": "Win at {niveau} level", "cond:mk": "Makruk win, {niveau} level",
  "cond:eg": "{finale} endgame won", "cond:etape": "Step {n}: {titre}", "cond:fete": "Play on {date}" };
function dictionnaire(code) {
  if (code === "en") return {};
  try { return require("./langues/" + code + "/app.js"); } catch (e) { return {}; }
}
function conditions(code, t) {
  const D = dictionnaire(code), tr = k => (typeof D[k] === "string" ? D[k] : k);
  const g = k => (t._ui && t._ui[k]) || GABARITS[k];
  const f = (gab, v) => Object.keys(v).reduce((s, k) => s.split("{" + k + "}").join(v[k]), gab);
  for (const b of CATALOGUE) {
    const id = b[0], e = t[id]; if (!e) continue;
    let r;
    if ((r = id.match(/^theme_([a-z_]+?)(?:_(10|100))?$/))) e[1] = f(g("cond:theme"), { theme: tr(MOTIFS[r[1]]), n: r[2] || "25" });
    else if ((r = id.match(/^jeu_niv(\d)$/))) e[1] = f(g("cond:niveau"), { niveau: tr(NIVEAUX[r[1] - 1]) });
    else if (NIVEAUX_MK[id]) e[1] = f(g("cond:mk"), { niveau: tr(NIVEAUX_MK[id]) });
    else if (FINALES[id]) e[1] = f(g("cond:eg"), { finale: tr(FINALES[id]) });
    else if ((r = id.match(/^debut_(\d)$/))) e[1] = f(g("cond:etape"), { n: r[1], titre: tr(ETAPES[r[1] - 1]) });
    /* Jour special sans condition ecrite : la date, au format de la langue
       ("6 janvier", "6. Januar", "6 января"). */
    else if ((r = id.match(/^fete_(\d\d)(\d\d)$/)) && !e[1]) {
      const loc = code === "en" ? "en-GB" : (PAR_CODE[code] && PAR_CODE[code].intl) || "en-GB";
      const date = new Intl.DateTimeFormat(loc, { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, +r[1] - 1, +r[2])));
      e[1] = f(g("cond:fete"), { date });
    }
  }
  return t;
}
function textes(code) {
  const propre = lireLangue(code);
  if (code === "fr") for (const b of CATALOGUE) propre[b[0]] = [b[3], b[2], b[5]];
  return conditions(code, propre);
}
function ecrire(OUT) {
  fs.mkdirSync(OUT + "/data", { recursive: true });
  fs.copyFileSync(path.join(__dirname, "badges-medailles.json"), OUT + "/data/badges-medailles.json");
  const en = textes("en"), manques = [];
  for (const c of CODES) {
    const t = c === "en" ? en : textes(c), sortie = { _ui: Object.assign({}, en._ui || {}, t._ui || {}) };
    let absents = 0;
    for (const b of CATALOGUE) {
      const v = t[b[0]] || en[b[0]];
      if (!t[b[0]]) absents++;
      sortie[b[0]] = v || [b[3], b[2], b[5]];
    }
    if (absents) manques.push(c + " (" + absents + ")");
    fs.writeFileSync(OUT + "/data/badges-" + c + ".json", JSON.stringify(sortie));
  }
  /* Nouveautes du menu, de la plus recente a la plus ancienne, par langue
     (repli sur l'anglais). */
  for (const c of CODES) fs.writeFileSync(OUT + "/data/nouveautes-" + c + ".json",
    JSON.stringify(NOUVEAUTES.map(n => { const v = n[c] || n.en; return { d: n.d, t: v[0], x: v[1] }; })));
  console.log("Badges illustres  : " + CATALOGUE.length + " badges, " + CODES.length + " langues" +
    (manques.length ? " ; textes manquants : " + manques.join(", ") : ", textes complets"));
}
module.exports = { code, ecrire };
