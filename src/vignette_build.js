/* Vignette de l'exercice du jour (2026-11-14), appelee par build_site.js.

   Une petite page autonome, /vignette/?lang=fr, que les clubs, ecoles et
   blogs integrent dans un <iframe> : l'echiquier de l'exercice du jour, le
   camp au trait et un bouton qui ouvre l'exercice sur chang64 (#daily). Le
   code a copier, sur la page enseignants et clubs (content.js), ajoute un
   vrai lien texte sous le cadre : c'est lui qui compte comme lien entrant
   pour les moteurs, pas le contenu du cadre.

   - Meme dessin d'echiquier que les images de partage (plateau_svg.js),
     recopie dans le script plutot que charge : aucune dependance.
   - Meme choix de l'exercice que le site (data/jour.json, index data/ids/,
     morceau de niveau), a la date locale du visiteur, comme le bouton
     "Exercice du jour" de l'accueil.
   - Textes repris des traductions de l'application (langues/<code>/app.js),
     sans nouvelle cle a traduire.
   - Ni mesure d'audience ni cookie : la vignette s'affiche chez d'autres,
     elle ne doit rien leur apporter d'autre que l'exercice.
   Ses en-tetes (cadre autorise partout, pas d'indexation) sont dans
   _headers, voir build_site.js. */
const fs = require("fs");
const path = require("path");
const { PIECE_FILL, PIECE_STROKE, PIECE_SHAPES, pieceShapes, boardSvg } = require("./plateau_svg.js");
const { LANGUES } = require("./langues/registre.js");

const CLES = [
  "Puzzle of the day", "Solve",
  "White to play and mate in {n} move.", "White to play and mate in {n} moves.",
  "Black to play and mate in {n} move.", "Black to play and mate in {n} moves.",
  "White to play and win.", "Black to play and win."
];

function dictionnaire(code) {
  if (code === "en") return {};
  const d = require(path.join(__dirname, "langues", code, "app.js"));
  const out = {};
  for (const k of CLES) if (d[k] != null) out[k] = d[k];
  return out;
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta name="description" content="Puzzle of the day from chang64, free chess for beginners, to show on a club or school website.">
<link rel="canonical" href="https://chang64.com/vignette/">
<title>chang64</title>
<style>
@font-face{font-family:"Archivo";src:url(/fonts/archivo-v25-latin-ext-variable.woff2) format("woff2");font-weight:100 900;font-display:swap}
@font-face{font-family:"Golos Text";src:url(/fonts/golos-text-v7-cyrillic-variable.woff2) format("woff2");font-weight:400 900;font-display:swap;unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}
@font-face{font-family:"Source Serif 4";src:url(/fonts/source-serif-4-v14-latin-600.woff2) format("woff2");font-weight:600;font-display:swap}
@font-face{font-family:"JetBrains Mono";src:url(/fonts/jetbrains-mono-v24-latin-700.woff2) format("woff2");font-weight:700;font-display:swap}
*{box-sizing:border-box;margin:0}
html,body{background:transparent;color:#EAECEA;font-family:"Archivo","Golos Text",system-ui,sans-serif}
.carte{display:flex;flex-direction:column;gap:10px;max-width:360px;margin:0 auto;padding:12px;background-color:#171E1F;border:1px solid rgba(234,236,234,.12);border-radius:12px;color:inherit;text-decoration:none}
.tete{display:flex;align-items:center;justify-content:space-between;gap:8px}
.marque{display:flex;align-items:baseline;gap:5px;font-family:"Source Serif 4",Georgia,serif;font-weight:600;font-size:19px;letter-spacing:-.015em;color:#EAECEA}
.marque svg{width:20px;height:17px;fill:#DDAE95;align-self:center}
.marque b{font-family:"JetBrains Mono",monospace;font-weight:700;font-size:.86em;letter-spacing:-.03em;color:#DDAE95}
#titre{font-size:13px;font-weight:600;color:#96A5A5;text-align:right}
#plateau{border-radius:6px;overflow:hidden;line-height:0;aspect-ratio:1}
#plateau svg{width:100%;height:auto;display:block}
#consigne{font-size:15px;font-weight:600;line-height:1.35;min-height:20px}
.bouton{display:block;text-align:center;padding:11px 14px;border-radius:8px;background-color:#DDAE95;color:#1c130e;font-weight:600;font-size:15px}
.carte:hover .bouton,.carte:focus-visible .bouton{background-color:#ECBB57}
.carte:focus-visible{outline:2px solid #DDAE95;outline-offset:2px}
</style>
</head>
<body>
<a class="carte" id="lien" href="/#daily" target="_blank" rel="noopener">
  <span class="tete">
    <span class="marque"><svg viewBox="0 0 64 54" aria-hidden="true"><path fill-rule="evenodd" d="M51.5 22A12 12 0 1 0 45.5 32.39V38A12 12 0 0 0 57.5 50A3 3 0 0 0 57.5 44A6 6 0 0 1 51.5 38ZM46.5 19A2.25 2.25 0 0 1 42 19A2.25 2.25 0 0 1 46.5 19ZM25.6 14.08A24 24 0 0 0 3.5 38V54H11.5V46A8 8 0 0 1 27.5 46V54H35.5V37.49A16 16 0 0 1 25.6 14.08Z"/></svg><span>chang<b>64</b></span></span>
    <span id="titre">Puzzle of the day</span>
  </span>
  <span id="plateau"></span>
  <span id="consigne"></span>
  <span class="bouton" id="bouton">Solve</span>
</a>
<script src="vignette.js"></script>
</body>
</html>
`;

function script() {
  const dicts = {}, accueils = {};
  for (const l of LANGUES) { dicts[l.code] = dictionnaire(l.code); accueils[l.code] = l.accueil; }
  return `/* Vignette de l'exercice du jour : genere par vignette_build.js, ne pas modifier. */
(function () {
"use strict";
var PIECE_FILL = ${JSON.stringify(PIECE_FILL)};
var PIECE_STROKE = ${JSON.stringify(PIECE_STROKE)};
var PIECE_SHAPES = ${JSON.stringify(PIECE_SHAPES)};
${pieceShapes.toString()}
${boardSvg.toString()}
var DICTS = ${JSON.stringify(dicts)};
var ACCUEILS = ${JSON.stringify(accueils)};
var lang = new URLSearchParams(location.search).get("lang");
if (!ACCUEILS[lang]) lang = "en";
var dict = DICTS[lang] || {};
function t(k, v) {
  var s = dict[k];
  if (s && typeof s === "object") {
    var f = "other";
    try { f = new Intl.PluralRules(lang).select(v && v.n || 0); } catch (e) {}
    s = s[f] || s.other;
  }
  if (typeof s !== "string") s = k;
  return s.replace(/\\{(\\w+)\\}/g, function (x, c) { return v && c in v ? v[c] : x; });
}
function $(id) { return document.getElementById(id); }
document.documentElement.lang = lang;
$("lien").href = location.origin + ACCUEILS[lang] + "#daily";
$("titre").textContent = t("Puzzle of the day");
$("bouton").textContent = t("Solve");
function lire(chemin) {
  return fetch(chemin).then(function (r) { if (!r.ok) throw new Error(chemin + " " + r.status); return r.json(); });
}
var d = new Date();
var n = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
lire("/data/jour.json").then(function (jour) {
  var l = jour.ids, i = n - jour.debut, id = l[((i % l.length) + l.length) % l.length];
  return lire("/data/ids/" + Math.floor(+id.slice(1) / 10000) + ".json").then(function (index) {
    var e = index[id];
    return lire("/data/level-" + e[0] + "-" + e[1] + ".json").then(function (lot) {
      for (var k = 0; k < lot.length; k++) if (lot[k].id === id) return lot[k];
      throw new Error(id);
    });
  });
}).then(function (p) {
  var noirs = p.fen.split(" ")[1] === "b";
  var camp = noirs ? "Black" : "White";
  $("plateau").innerHTML = boardSvg(p.fen, 360, noirs);
  $("plateau").firstChild.setAttribute("aria-label", t("Puzzle of the day"));
  $("consigne").textContent = p.type === "mate"
    ? t(camp + " to play and mate in {n} " + (p.n > 1 ? "moves." : "move."), { n: p.n })
    : t(camp + " to play and win.");
}).catch(function () { $("plateau").style.display = "none"; });
})();
`;
}

function ecrireVignette(OUT) {
  const dossier = path.join(OUT, "vignette");
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(path.join(dossier, "index.html"), PAGE);
  fs.writeFileSync(path.join(dossier, "vignette.js"), script());
  console.log("Vignette du jour   : /vignette/ (" + LANGUES.length + " langues)");
}

module.exports = { ecrireVignette };
