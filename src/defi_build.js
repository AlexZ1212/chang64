/* Pages d'apercu du defi par lien (2026-11-18), appelees par build_site.js.

   Le lien d'un defi porte tout dans son fragment (#duel=...), que ni le
   serveur ni les reseaux sociaux ne voient : l'apercu du lien montrait donc
   l'image generale du site. Pour y mettre le score a battre sans rien confier
   au serveur, le lien passe par une petite page fixe, /d/<langue><score>/
   (score = exercices trouves du premier coup, de 0 a 5) : son image de
   partage annonce le score, et son script renvoie aussitot vers l'accueil en
   gardant le fragment. Seuls la langue et le score apparaissent dans
   l'adresse ; les exercices, le temps et le prenom restent dans le fragment.

   - Une page et une image par langue et par score : 6 x le nombre de langues.
   - Textes repris des traductions de l'application, sauf la phrase sous le
     titre de l'image, propre a ces pages (SOUS ci-dessous).
   - Pages hors index (balise et en-tete X-Robots-Tag de _headers). */
const fs = require("fs");
const path = require("path");
const { LANGUES } = require("./langues/registre.js");

const N = 5;
const CLE_SCORE = "Score to beat: {n}/{total}";
const CLE_PHRASE = "I challenge you on chang64: five puzzles, can you beat my score?";
const SOUS = {
  en: "Five puzzles. Can you do better?",
  fr: "Cinq exercices. Feras-tu mieux ?",
  es: "Cinco ejercicios. ¿Lo harás mejor?",
  pt: "Cinco exercícios. Você faz melhor?",
  de: "Fünf Aufgaben. Schaffst du mehr?",
  ru: "Пять задач. Сможешь лучше?",
  it: "Cinque esercizi. Farai di meglio?",
  tr: "Beş bulmaca. Daha iyisini yapar mısın?",
  pl: "Pięć zadań. Dasz radę lepiej?",
  id: "Lima teka-teki. Bisa lebih baik?"
};
/* Une position de milieu de partie, pour que l'image dise "exercice". */
const FEN = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR";
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function textes(code) {
  const d = code === "en" ? {} : require("./langues/" + code + "/app.js");
  const t = k => d[k] || k;
  if (!SOUS[code]) throw new Error("defi_build.js : phrase manquante pour la langue " + code);
  return { score: n => t(CLE_SCORE).replace("{n}", n).replace("{total}", N), phrase: t(CLE_PHRASE), sous: SOUS[code] };
}

function ecrireDefi(OUT, SITE, queueOg) {
  fs.mkdirSync(path.join(OUT, "d"), { recursive: true });
  /* Vers l'accueil de la langue de la page, fragment conserve ; sans
     fragment, on arrive simplement sur l'accueil. */
  fs.writeFileSync(path.join(OUT, "d", "aller.js"), 'location.replace((document.documentElement.getAttribute("data-vers")||"/")+location.hash);\n');
  let pages = 0;
  for (const l of LANGUES) {
    const tx = textes(l.code);
    for (let n = 0; n <= N; n++) {
      const nom = "defi-" + l.code + "-" + n, titre = tx.score(n);
      queueOg(nom, titre, tx.sous, FEN);
      const dir = path.join(OUT, "d", l.code + n);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "index.html"), `<!doctype html>
<html lang="${esc(l.html || l.code)}" data-vers="${esc(l.accueil)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titre)} | chang64</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${SITE}/d/${l.code}${n}/">
<meta name="description" content="${esc(tx.phrase)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="chang64">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(tx.phrase)}">
<meta property="og:image" content="${SITE}/og/${nom}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
</head>
<body>
<p><a href="${esc(l.accueil)}">chang64</a></p>
<script src="/d/aller.js"></script>
</body>
</html>
`);
      pages++;
    }
  }
  return pages;
}
module.exports = { ecrireDefi, N, SOUS };
