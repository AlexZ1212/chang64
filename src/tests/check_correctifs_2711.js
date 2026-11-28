/* Verification automatique de chang64.
   Lancement : node tests/check_correctifs_2711.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Le lot de 21 correctifs note par Alexandre le 27/11/2026 (captures de son
   iPhone, design/correctifs-2811/liste.md), chacun avec sa garde. Les
   mesures de mise en page (360 px, police elargie) sont faites dans un vrai
   navigateur par mesure_correctifs_2711.js, pas ici. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const net = s => String(s).replace(/\s+/g, " ").trim();
const SRC = path.join(__dirname, "..");
const lire = f => fs.readFileSync(path.join(SRC, f), "utf8");
const LANGUES = ["fr", "en", "es", "pt", "de", "ru", "it", "tr", "pl", "id"];

(async () => {
  const w = await ouvrir("fr", { attente: 2200, fetch: true });
  const d = w.document, $ = id => d.getElementById(id), ev = x => w.eval(x);

  console.log("--- 16. Plus d'espace avant « % » ---");
  T("francais : « 62% » colle", ev("pourcentTexte(.62)") === "62%", JSON.stringify(ev("pourcentTexte(.62)")));
  T("aucune espace (pleine, fine, normale) avant « % »", !/[\s  ]%/.test(ev("pourcentTexte(.05)")));
  for (const l of ["de", "ru", "es", "tr"]) {
    const wl = await ouvrir(l, { attente: 900 });
    const p = wl.eval("pourcentTexte(.62)");
    T(l + " : " + p, l === "tr" ? p === "%62" : p === "62%", JSON.stringify(p));
    wl.close();
  }
  for (const l of LANGUES) {
    const f = l === "fr" ? "badges-catalogue.js" : "badges-textes/" + l + ".json";
    T("textes des badges (" + l + ") : pas de « 64 % »", !/\d[\s  ]%/.test(lire(f)));
  }

  console.log("--- 14. « Signaler cet exercice » sous les boutons de partage ---");
  {
    const s = $("exSignaler"), b = $("dailyChallengeBlock");
    T("le lien vient apres le bloc de partage du jour", s && b && (b.compareDocumentPosition(s) & w.Node.DOCUMENT_POSITION_FOLLOWING) && !b.contains(s));
    T("un seul lien « Signaler » sur la page", d.querySelectorAll("#btnSignaler").length === 1);
  }

  console.log("--- 13. Chiffres des Statistiques qui debordaient ---");
  T("le chiffre d'une tuile dit sa longueur au CSS (« 114/286 » : --n:7)", /--n:7/.test(ev("tuileChiffre('114/286')")), ev("tuileChiffre('114/286')"));
  T("le CSS reduit la police selon la largeur de la case", /\.menu-tuile b\{[^}]*font-size:min\(22px,calc\(100cqi/.test(lire("template.html")) && /\.menu-tuile\{container-type:inline-size/.test(lire("template.html")));
  ev("ensureProgFields();prog.badges=[];menuOuvrir();menuVue('stats')");
  T("Activite : la tuile des badges passe par tuileChiffre", [...d.querySelectorAll("#menuStats .menu-tuiles.trois b")].every(b => /--n:/.test(b.getAttribute("style") || "")));
  T("graphe Elo vide : le message est du HTML qui va a la ligne, pas un <text> SVG", d.querySelector("#menuEloGraph .courbe-vide p") && !d.querySelector("#menuEloGraph svg text"));

  console.log("--- 21. Plus de chiffre sous la coche de l'etape en cours ---");
  {
    const css = lire("template.html");
    const i = css.indexOf('.debut-pas button[aria-current="step"]{'), j = css.indexOf('.debut-pas button.fait[aria-current="step"]{color:transparent}');
    T("l'etape en cours et faite cache son chiffre, apres la regle de l'etape en cours", i > 0 && j > i);
  }

  console.log("--- 20. Coche de l'annonce « Objectif atteint ! » ---");
  {
    const css = lire("template.html");
    T("la pastille de l'annonce prend la coche commune (meme masque que les etapes d'Apprendre)", /\.ap-chap\.fait \.ap-num::after,\.obj-objectif \.obj-pastille::after,\.coche-ok::after/.test(css));
    T("disque jade plat, sans la coche fine", /\.obj-objectif \.obj-pastille\{position:relative;background:var\(--jade\);box-shadow:none\}/.test(css) && /\.obj-objectif \.obj-pastille svg\{display:none\}/.test(css));
  }

  console.log("--- 19. Rien ne se lit sous le degrade des rangees qui defilent ---");
  {
    const css = lire("template.html");
    T("rangee des pastilles d'erreurs : degrade colle au bord, sur toute la hauteur, sans arrondi", /\.erreurs-defile::before,\.erreurs-defile::after\{top:0;bottom:0;width:44px;border-radius:0\}/.test(css) && /\.erreurs-defile::before\{left:0;/.test(css) && /\.erreurs-defile::after\{right:0;/.test(css));
    T("toutes les rangees : partie opaque plus large (40 px, opaque a 55 %)", /\.defile::before,\.defile::after\{[^}]*width:40px/.test(css) && !/var\(--ink\) 45%,transparent/.test(css));
  }

  console.log("--- 1. Ma progression : ni cesure ni grand interligne ---");
  {
    const css = lire("template.html");
    T("plus de coupure de mot automatique dans les trois cases", !/\.strip\.trois \.stat span,\.strip\.trois \.stat em\{overflow-wrap:anywhere;hyphens:auto\}/.test(css) && /\.strip\.trois \.stat span,\.strip\.trois \.stat em\{overflow-wrap:normal;hyphens:manual;line-height:1\.25\}/.test(css));
    T("un mot trop long reduit la police de son libelle (homeStripAjuster)", typeof w.homeStripAjuster === "function");
  }

  w.close();
  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
