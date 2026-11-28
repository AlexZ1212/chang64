/* Verification automatique de chang64.
   Lancement : node tests/check_liens_pages.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Piste 6 des liens pedagogiques (28/11, choix d'Alexandre) : les pages du
   site se renvoient entre elles. Lexique et exemples tactiques -> la lecon
   du meme motif (« Pour comprendre : ») ; lecon d'un motif -> ses exemples
   et son mot du lexique (« Voir aussi : »). Dans les 10 langues, et chaque
   lien mene a une page qui existe. Les adresses traduites sont lues dans
   les balises hreflang des pages anglaises : rien n'est code en dur. */
const fs = require("fs"), path = require("path");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const SITE = path.join(__dirname, "..", "site");
const LANGUES = ["en", "fr", "es", "pt", "de", "ru", "it", "tr", "pl", "id"];
const lire = p => fs.readFileSync(path.join(SITE, p + ".html"), "utf8");
const existe = href => fs.existsSync(path.join(SITE, href + ".html")) || fs.existsSync(path.join(SITE, href, "index.html"));
/* Adresse d'une page anglaise dans chaque langue, d'apres ses hreflang. */
function adresses(pEn) {
  const h = lire(pEn), a = {};
  for (const m of h.matchAll(/<link rel="alternate" hreflang="([a-z]{2})" href="https:\/\/chang64\.com([^"]+)">/g)) a[m[1]] = m[2];
  return a;
}
const bloc = h => { const m = h.match(/<p class="voir-aussi">([\s\S]*?)<\/p>/); return m ? m[1] : ""; };
const liens = h => [...bloc(h).matchAll(/href="([^"]+)"/g)].map(m => m[1]);

const VERS_LECON = [
  ["glossary/fork", "learn/knight-fork"], ["glossary/pin", "learn/the-pin"], ["glossary/skewer", "learn/the-skewer"],
  ["glossary/deflection", "learn/deflection"], ["glossary/back-rank-mate", "learn/back-rank-mate"],
  ["glossary/double-attack", "learn/double-attack"], ["glossary/hanging-piece", "learn/spotting-a-hanging-piece"],
  ["glossary/promotion", "learn/pawn-promotion"], ["glossary/stalemate", "learn/check-checkmate-stalemate"],
  ["glossary/threefold-repetition", "learn/how-games-are-drawn"], ["glossary/fifty-move-rule", "learn/how-games-are-drawn"],
  ["glossary/development", "learn/opening-principles"], ["glossary/opposition", "endgames/king-and-pawn-vs-king"],
  ["puzzles/winning-capture", "learn/spotting-a-hanging-piece"], ["puzzles/knight-fork", "learn/knight-fork"],
  ["puzzles/pawn-fork", "learn/pawn-fork"], ["puzzles/double-attack", "learn/double-attack"], ["puzzles/pin", "learn/the-pin"],
  ["puzzles/skewer", "learn/the-skewer"], ["puzzles/back-rank-mate", "learn/back-rank-mate"],
  ["puzzles/deflection", "learn/deflection"], ["puzzles/quiet-move", "learn/the-quiet-move"]
];
const LABEL_COMPRENDRE = { en: "To understand:", fr: "Pour comprendre :", de: "Zum Verstehen:", ru: "Чтобы разобраться:" };
const LABEL_VOIR = { en: "See also:", fr: "Voir aussi :", de: "Siehe auch:", ru: "См. также:" };

console.log("--- Lexique et exemples -> lecon (« Pour comprendre : ») ---");
for (const [de, vers] of VERS_LECON) {
  const A = adresses(de), B = adresses(vers);
  const manque = LANGUES.filter(l => !A[l] || !B[l] || !liens(lire(A[l])).includes(B[l]));
  T(de + " -> " + vers + " (10 langues)", !manque.length, manque.join(","));
}
for (const l of Object.keys(LABEL_COMPRENDRE)) {
  const h = lire(adresses("glossary/fork")[l]);
  T(l + " : « " + LABEL_COMPRENDRE[l] + " » en tete du lien", bloc(h).startsWith(LABEL_COMPRENDRE[l] + " "), bloc(h).slice(0, 60));
}
T("un mot sans lecon (zugzwang) n'a pas de ligne", !/class="voir-aussi"/.test(lire("glossary/zugzwang")));
T("un motif sans lecon (mat en deux) n'a pas de ligne", !/class="voir-aussi"/.test(lire("puzzles/mate-in-two")));

console.log("--- Lecon -> exemples et lexique (« Voir aussi : ») ---");
for (const [pEn, ex, mot] of [["learn/knight-fork", "puzzles/knight-fork", "glossary/fork"], ["learn/the-pin", "puzzles/pin", "glossary/pin"],
  ["learn/how-games-are-drawn", null, "glossary/threefold-repetition"], ["learn/the-quiet-move", "puzzles/quiet-move", null]]) {
  const A = adresses(pEn), E = ex && adresses(ex), M = mot && adresses(mot);
  const manque = LANGUES.filter(l => { const ls = liens(lire(A[l])); return (E && !ls.includes(E[l])) || (M && !ls.includes(M[l])); });
  T(pEn + " -> " + [ex, mot].filter(Boolean).join(" + ") + " (10 langues)", !manque.length, manque.join(","));
}
for (const l of Object.keys(LABEL_VOIR)) {
  const h = lire(adresses("learn/knight-fork")[l]);
  T(l + " : « " + LABEL_VOIR[l] + " »", bloc(h).startsWith(LABEL_VOIR[l] + " "), bloc(h).slice(0, 60));
}
T("une lecon sans motif ni mot (le roque) n'a pas de ligne", !/class="voir-aussi"/.test(lire("learn/castling")));

console.log("--- Pages Apprendre : deux boutons au plus, le reste en liens (accord d'Alexandre, 28/11) ---");
{
  const idx = adresses("learn/index"), trop = [], sansLiens = [];
  for (const l of LANGUES) {
    const dir = path.join(SITE, path.dirname(idx[l] + "x"));
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".html") && x !== "index.html")) {
      const h = fs.readFileSync(path.join(dir, f), "utf8"), main = h.slice(h.indexOf("<main"), h.indexOf("</main>"));
      const ctas = (main.match(/class="cta( ghost)?"/g) || []).length;
      if (ctas > 2) trop.push(l + ":" + f + " (" + ctas + ")");
      if (!/<p class="liens-bas">(<a href="[^"]+">[^<]+<\/a>){1,2}<\/p>/.test(main)) sansLiens.push(l + ":" + f);
    }
  }
  T("aucune page n'a plus de deux boutons (10 langues)", !trop.length, trop.slice(0, 5).join(" | "));
  T("chaque page a sa ligne de liens discrets", !sansLiens.length, sansLiens.slice(0, 5).join(" | "));
  for (const l of LANGUES) {
    const A = adresses("learn/knight-fork"), m = lire(A[l]).match(/<p class="liens-bas">([\s\S]*?)<\/p>/);
    const hrefs = m ? [...m[1].matchAll(/href="([^"]+)"/g)].map(x => x[1]) : [];
    const accueil = l === "en" ? "/" : "/" + l + "/", index = adresses("learn/index")[l];
    if (l === "fr" || l === "de") T(l + " : fourchette de cavalier, deux boutons puis « Jouer une partie » et « Retour a l'index » en liens",
      (lire(A[l]).match(/class="cta( ghost)?"/g) || []).length === 2 && hrefs.join(" ") === accueil + " " + index, hrefs.join(" "));
  }
  const cad = lire(adresses("learn/time-controls").fr);
  T("une page sans motif ni position (les cadences) garde « Jouer une partie » en bouton, l'index en lien",
    /<a class="cta" href="\/fr\/">Jouer une partie<\/a><p class="liens-bas"><a href="\/fr\/apprendre\/">Retour à l'index<\/a><\/p>/.test(cad));
}

console.log("--- Aucun lien casse ---");
{
  const casses = [];
  for (const rub of ["learn", "glossary", "puzzles"]) {
    const A = adresses(rub + "/index");
    for (const l of LANGUES) {
      const dir = path.join(SITE, A[l] ? path.dirname(A[l] + "x") : rub);
      for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".html"))) {
        for (const h of liens(fs.readFileSync(path.join(dir, f), "utf8"))) if (!existe(h)) casses.push(l + ":" + f + " -> " + h);
      }
    }
  }
  T("tous les liens ajoutes, dans les 10 langues, menent a une page", !casses.length, casses.slice(0, 5).join(" | "));
}

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
