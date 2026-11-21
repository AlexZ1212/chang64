/* Diagrammes d'echiquier en SVG, partages par build_site.js (pages et images
   de partage) et bluesky_jour.js (image de l'exercice du jour), sortis de
   build_site.js le 2026-11-07 pour que les deux dessinent le meme plateau. */
const fs = require("fs");
const path = require("path");

/* Rendu d'une piece du set officiel. Les formes viennent des SVG de l'auteur
   et sont reprises telles quelles : ni geometrie, ni proportions, ni
   epaisseurs de contour ne changent. Les formes marquees "fixe" (l'oeil et
   le naseau du cavalier) n'ont pas de fill dans le source et s'affichent en
   noir : les recolorer les ferait disparaitre dans une piece noire. */
const PIECE_FILL = { w: "#eceae3", b: "#232b28" };
const PIECE_STROKE = "#101413";
function pieceShapes(type, white) {
  const remplissage = white ? PIECE_FILL.w : PIECE_FILL.b;
  return (PIECE_SHAPES[type] || []).map(f => {
    const a = [];
    if (f.t === "circle") a.push(`cx="${f.cx}" cy="${f.cy}" r="${f.r}"`);
    else a.push(`d="${f.d}"`);
    if (!f.fixe) {
      a.push(`fill="${remplissage}"`, `stroke="${f.st || PIECE_STROKE}"`,
             'stroke-linecap="round" stroke-linejoin="round"');
    } else {
      /* Oeil et naseau du cavalier : remplissage a la couleur du contour,
         sans contour propre. */
      a.push(`fill="${PIECE_STROKE}"`);
    }
    if (f.sw) a.push(`stroke-width="${f.sw}"`);
    return `<${f.t} ${a.join(" ")}/>`;
  }).join("");
}

const PIECE_SHAPES = (() => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, "ds/pieces.json"), "utf8"));
  return { p: j.pawn, n: j.knight, b: j.bishop, r: j.rook, q: j.queen, k: j.king };
})();

/* flipped : oriente le diagramme du point de vue du camp au trait plutot que
   toujours depuis les Blancs (2026-09-04, demande d'Alexandre sur les pages
   Motifs) -- range 0 devient la 1ere rangee et les colonnes se lisent h->a
   au lieu de a->h, l'inverse exact d'un retournement d'echiquier normal. */
/* Coordonnees (2026-11-21, demande d'Alexandre sur les echiquiers des pages
   Explorer) : comme sur l'echiquier de l'appli, le chiffre de la rangee en
   haut a gauche des cases de la colonne de gauche, la lettre de la colonne en
   bas a droite des cases de la rangee du bas, dans la couleur de la case
   opposee. flipped suit la meme orientation que boardSvg (vue des Noirs). */
const CASE_CLAIRE = "#EDE3D5", CASE_FONCEE = "#4A6A68";
function coordsSvg(size, flipped) {
  const S = size / 8, m = S * 0.06;
  const encre = (f, r) => (f + r) % 2 ? CASE_CLAIRE : CASE_FONCEE;
  /* Quatre <text> en tout (un par couleur, pour les chiffres et pour les
     lettres), chaque signe place par les listes x et y : seize balises
     alourdissaient de 4 Ko les pages a plusieurs diagrammes. */
  const n = v => String(Math.round(v * 10) / 10);
  let t = `<g font-family="'JetBrains Mono',monospace" font-weight="600" font-size="${n(S * 0.22)}" aria-hidden="true">`;
  for (const couleur of [CASE_FONCEE, CASE_CLAIRE]) {
    const rangs = [0, 1, 2, 3, 4, 5, 6, 7].filter(r => encre(0, r) === couleur);
    t += `<text x="${rangs.map(() => n(m)).join(" ")}" y="${rangs.map(r => n(r * S + S * 0.25)).join(" ")}" fill="${couleur}">${rangs.map(r => flipped ? r + 1 : 8 - r).join("")}</text>`;
    const cols = [0, 1, 2, 3, 4, 5, 6, 7].filter(f => encre(f, 7) === couleur);
    t += `<text x="${cols.map(f => n((f + 1) * S - m)).join(" ")}" y="${n(8 * S - m)}" text-anchor="end" fill="${couleur}">${cols.map(f => (flipped ? "hgfedcba" : "abcdefgh")[f]).join("")}</text>`;
  }
  return t + "</g>";
}

function boardSvg(fen, size, flipped, coords) {
  const S = size / 8;
  let rows = fen.split(" ")[0].split("/");
  if (flipped) rows = rows.slice().reverse().map(row => row.split("").reverse().join(""));
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Chess position">`;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    svg += `<rect x="${f * S}" y="${r * S}" width="${S}" height="${S}" fill="${(f + r) % 2 ? CASE_FONCEE : CASE_CLAIRE}"/>`;
  }
  if (coords) svg += coordsSvg(size, flipped);
  /* Les formes de pieces sont declarees une fois en <defs> et posees par
     <use>. Auparavant chaque piece repetait ses chemins complets, ce qui
     faisait 19 Ko par diagramme, soit 40 Mo pour les seules pages
     d'exercices. On ne declare que les pieces reellement presentes. */
  const need = new Set();
  rows.forEach(row => { for (const ch of row) if (!(ch >= "1" && ch <= "8")) need.add(ch); });
  let defs = "";
  for (const ch of need) {
    const white = ch === ch.toUpperCase();
    defs += `<symbol id="p${white ? "w" : "b"}${ch.toLowerCase()}" viewBox="0 0 45 45">` +
      pieceShapes(ch.toLowerCase(), white) + `</symbol>`;
  }
  svg += `<defs>${defs}</defs>`;
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (ch >= "1" && ch <= "8") { f += +ch; continue; }
      const white = ch === ch.toUpperCase();
      svg += `<use href="#p${white ? "w" : "b"}${ch.toLowerCase()}" x="${(f * S).toFixed(1)}" y="${(r * S).toFixed(1)}" width="${S}" height="${S}"/>`;
      f++;
    }
  });
  return svg + "</svg>";
}

module.exports = { PIECE_FILL, PIECE_STROKE, PIECE_SHAPES, pieceShapes, boardSvg, coordsSvg, CASE_CLAIRE, CASE_FONCEE };
