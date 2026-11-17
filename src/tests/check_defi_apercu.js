/* Pages d'apercu du defi par lien et regle du classement (2026-11-18).
   Lancement : node tests/check_defi_apercu.js (apres node build_site.js)

   1. Chaque langue a ses six pages /d/<langue><score>/ : image de partage au
      score, hors index, aucun script en ligne, renvoi vers l'accueil de la
      langue avec le fragment.
   2. Le lien d'un defi lance passe par ces pages ; la liste de langues de
      duel.js suit le registre.
   3. Un exercice joue dans un defi ne touche pas le classement (decision
      d'Alexandre du 17/11) : ni a la premiere erreur, ni a la fin. */
const fs = require("fs");
const path = require("path");
const { LANGUES } = require("../langues/registre.js");
const SITE = path.join(__dirname, "..", "site");
let ok = 0, ko = 0;
function T(nom, cond, detail) {
  if (cond) ok++; else { ko++; console.log("FAIL " + nom + (detail ? " : " + detail : "")); }
}
const lire = f => fs.readFileSync(path.join(SITE, f), "utf8");

/* ---------- 1. pages et images ---------- */
const aller = lire("d/aller.js");
T("le renvoi garde le fragment", /location\.replace\(.*location\.hash\)/.test(aller));
for (const l of LANGUES) {
  const dict = l.code === "en" ? {} : require("../langues/" + l.code + "/app.js");
  const modele = dict["Score to beat: {n}/{total}"] || "Score to beat: {n}/{total}";
  for (let n = 0; n <= 5; n++) {
    const nom = l.code + n, f = "d/" + nom + "/index.html";
    if (!fs.existsSync(path.join(SITE, f))) { T(nom + " : page presente", false); continue; }
    const h = lire(f), titre = modele.replace("{n}", n).replace("{total}", 5);
    T(nom + " : titre au score", h.includes("<title>" + titre.replace(/&/g, "&amp;") + " | chang64</title>"), titre);
    T(nom + " : hors index", /<meta name="robots" content="noindex">/.test(h));
    T(nom + " : image du score", h.includes('property="og:image" content="https://chang64.com/og/defi-' + l.code + "-" + n + '.png"'));
    T(nom + " : image generee", fs.existsSync(path.join(SITE, "og", "defi-" + l.code + "-" + n + ".png")));
    T(nom + " : aucun script en ligne", !/<script>(?!\s*<\/script>)/.test(h) && h.includes('<script src="/d/aller.js"></script>'));
    T(nom + " : renvoi vers l'accueil de la langue", h.includes('data-vers="' + l.accueil + '"') && fs.existsSync(path.join(SITE, l.accueil, "index.html")));
    T(nom + " : langue de la page", h.includes('<html lang="' + l.html + '"'));
  }
}
const entetes = lire("_headers");
const bloc = entetes.split(/\n(?=\/)/).find(b => b.startsWith("/d/*")) || "";
T("en-tete hors index pour /d/*", /X-Robots-Tag: noindex/.test(bloc));
T("pages d'apercu absentes du sitemap", !/chang64\.com\/d\//.test(lire("sitemap.xml")));

/* ---------- 2. le lien ---------- */
const src = fs.readFileSync(path.join(__dirname, "..", "duel.js"), "utf8");
const m = src.match(/DUEL_LANGUES=(\[[^\]]*\])/);
T("liste de langues de duel.js = registre", !!m && JSON.stringify(JSON.parse(m[1])) === JSON.stringify(LANGUES.map(l => l.code)));
{
  /* duelLien, isole du reste du script. */
  const corps = src.slice(src.indexOf("function duelEnc"), src.indexOf("function duelPremiers"));
  const outils = src.slice(src.indexOf("function duelPremiers"), src.indexOf("function duelTrouves"));
  const fab = (LANG, protocole) => new Function("LANG", "location", "DUEL_LANGUES", "DUEL_N", "DUEL_TEMPS_MAX", "baseUrl", "duelPropre",
    corps + outils + "return duelLien;")(LANG, { protocol: protocole, origin: "https://chang64.com" }, JSON.parse(m[1]), 5, 35999, () => "https://chang64.com/", s => s);
  const ids = ["p1", "p2", "p3", "p4", "p5"], a = { r: "22100", t: 50, n: "Al" }, b = { r: "22222", t: 40, n: "Bo" };
  const fr = fab("fr", "https:")(ids, a, null);
  T("defi lance : page d'apercu du score", fr.startsWith("https://chang64.com/d/fr2/#duel="), fr);
  T("defi lance : le fragment porte tout le reste", /#duel=[0-9a-z]{20}&r=22100&t=50&n=Al$/.test(fr), fr);
  T("score parfait", fab("en", "https:")(ids, { r: "22222", t: 9, n: "" }, null).startsWith("https://chang64.com/d/en5/#duel="));
  T("reponse : lien direct", fab("fr", "https:")(ids, a, b).startsWith("https://chang64.com/#duel="));
  T("langue inconnue : lien direct", fab("xx", "https:")(ids, a, null).startsWith("https://chang64.com/#duel="));
  T("fichier local : lien direct", fab("fr", "file:")(ids, a, null).startsWith("https://chang64.com/#duel="));
}

/* ---------- 3. le classement ---------- */
T("fin d'exercice : la note est neutralisee avant le calcul",
  /if\(ici\)puzzle\.eloNote=true;\s*const r=av\.apply\(this,arguments\);/.test(src));
T("premiere erreur : eloEchec saute pendant un defi",
  /eloEchec=function\(\)\{if\(duelIci\(\)\)return;return av\.apply\(this,arguments\);\}/.test(src));
{
  const ui2 = fs.readFileSync(path.join(__dirname, "..", "ui2.js"), "utf8");
  T("finishPuzzle respecte puzzle.eloNote", /if\(!puzzle\.daily&&!puzzle\.eloNote\)\{puzzle\.eloNote=true;updateRating\(/.test(ui2));
  T("eloEchec respecte puzzle.eloNote", /function eloEchec\(\)\{\s*if\(rush\|\|!puzzle\|\|puzzle\.daily\|\|puzzle\.eloNote\|\|puzzleDone\)return;/.test(ui2));
}

console.log(ok + " OK, " + ko + " FAIL");
process.exit(ko ? 1 : 0);
