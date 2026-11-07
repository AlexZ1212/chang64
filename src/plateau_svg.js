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
function boardSvg(fen, size, flipped) {
  const S = size / 8;
  let rows = fen.split(" ")[0].split("/");
  if (flipped) rows = rows.slice().reverse().map(row => row.split("").reverse().join(""));
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Chess position">`;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    svg += `<rect x="${f * S}" y="${r * S}" width="${S}" height="${S}" fill="${(f + r) % 2 ? "#4B6B63" : "#EDE4D2"}"/>`;
  }
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

module.exports = { PIECE_FILL, PIECE_STROKE, PIECE_SHAPES, pieceShapes, boardSvg };
