/* chang64 - pictogrammes des cartes (2026-11-19)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Une seule famille de dessins pour les cartes de Jouer, de Resoudre et
 * d'Explorer, et pour le menu. Regle voulue par Alexandre : un meme symbole a
 * la meme forme partout. Chaque picto reprend donc TEL QUEL le dessin d'une
 * medaille de badges-medailles.json (epees, chrono, boussole...), ou suit leur
 * grammaire : pieces de l'auteur (pieces_browser.js) en aplat, piece
 * principale en bas a gauche, accent en haut a droite. Cinq dessins sont
 * propres a ce fichier (calendrier, puce, lexique, attention, fiches), dans le
 * meme style : aplats, les jours dans la couleur du fond (--oeil).
 * Boite de 48 centree sur l'origine : viewBox="-24 -24 48 48".
 *
 * pictosSource() rend la ligne « const PICTOS={...}; » collee dans le script
 * de l'application par badges_build.js. */
const fs = require("fs"), path = require("path");
const M = require("./badges-medailles.json");
const src = fs.readFileSync(path.join(__dirname, "pieces_browser.js"), "utf8");
const PIECES = new Function(src.slice(src.indexOf("const PIECES="), src.indexOf("const PIECE_COLORS")) + ";return PIECES;")();
const piece = (t, x, y, s, creux) => '<g fill="' + (creux ? "var(--oeil)" : "currentColor") + '" transform="translate(' + x + " " + y + ") scale(" + s + ') translate(-24 -24) scale(1.0667)">' +
  PIECES[t].map(f => (f.t === "circle" ? '<circle cx="' + f.cx + '" cy="' + f.cy + '" r="' + f.r + '"' : '<path d="' + f.d + '"') + (f.fixe ? ' style="fill:var(--oeil)"' : "") + "/>").join("") + "</g>";
/* Le dessin nu d'une medaille, sans son calage propre a la medaille ronde. */
/* Meme poids visuel partout : un dessin seul occupe 80 % de la boite, un dessin compose (piece + accent) toute la boite. */
const nu = k => M[k][1].replace(/<g data-cale="1" transform="[^"]*">/, "<g>");
const POIDS = { solved_1: 1.08, duel_gagne: 1.02, sprint_10: .86, debut_fini: .86 };
const glyphe = k => '<g transform="scale(' + (POIDS[k] || (/data-accent|scale(.6)/.test(M[k][1]) ? 1.06 : .8)) + ')">' + nu(k) + "</g>";
const accent = (k, s) => '<g transform="translate(14.5 -14.5) scale(' + (s || .5) + ')">' + nu(k) + "</g>";
/* Dessins nouveaux (2026-11-19), dans le style des medailles : aplats, les
   jours se font dans la couleur du fond (--oeil). Boite de 48 centree. */
const O = 'style="fill:none;stroke:var(--oeil);stroke-linecap:round;stroke-linejoin:round;stroke-width:';
const DESSINS = {
  /* Calendrier : deux anneaux, un bandeau, six jours dont celui du jour, plein. */
  calendrier: '<g fill="currentColor"><rect x="-17" y="-14.500" width="34" height="33" rx="5"/><rect x="-10.800" y="-20" width="4.200" height="10" rx="2.100"/><rect x="6.600" y="-20" width="4.200" height="10" rx="2.100"/></g>' +
    '<path d="M-17 -4.500h34" ' + O + '2.400"/><path d="M-10.800 -14.500v3.400M6.600 -14.500v0M-6.600 -14.500v0" ' + O + '0"/>' +
    '<g fill="var(--oeil)"><rect x="-11.500" y="0" width="5.400" height="5.400" rx="1.300"/><rect x="-2.700" y="0" width="5.400" height="5.400" rx="1.300"/><rect x="6.100" y="0" width="5.400" height="5.400" rx="1.300"/><rect x="-11.500" y="8.300" width="5.400" height="5.400" rx="1.300"/><rect x="-2.700" y="8.300" width="5.400" height="5.400" rx="1.300"/></g>',
  /* Puce : un boitier, son coeur, trois pattes par cote. */
  puce: '<g fill="currentColor"><rect x="-13" y="-13" width="26" height="26" rx="4.500"/>' +
    [-7.500, 0, 7.500].map(v => '<rect x="' + (v - 1.900) + '" y="-21" width="3.800" height="7" rx="1.900"/><rect x="' + (v - 1.900) + '" y="14" width="3.800" height="7" rx="1.900"/><rect x="-21" y="' + (v - 1.900) + '" width="7" height="3.800" rx="1.900"/><rect x="14" y="' + (v - 1.900) + '" width="7" height="3.800" rx="1.900"/>').join("") + "</g>" +
    '<rect x="-6.500" y="-6.500" width="13" height="13" rx="2" ' + O + '2.600"/>',
  /* Lexique : un livre ferme, son dos, deux lettres. */
  lexique: '<g fill="currentColor"><path d="M-12 -19h24a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4h-24a4.500 4.500 0 0 1-4.500-4.500v-29a4.500 4.500 0 0 1 4.500-4.500z"/></g>' +
    '<path d="M-10 -19v38" ' + O + '2.200"/><text x="3.500" y="5.500" text-anchor="middle" style="fill:var(--oeil);font-family:&quot;Source Serif 4&quot;,Georgia,serif;font-weight:600;font-size:17px">Aa</text>',
  /* Attention : le triangle des pieges. */
  attention: '<path fill="currentColor" d="M-2.900 -17.200a3.300 3.300 0 0 1 5.800 0l16.300 28.600a3.300 3.300 0 0 1-2.900 5h-32.600a3.300 3.300 0 0 1-2.900-5z"/><path d="M0 -6.500v9.500" ' + O + '3.600"/><circle cx="0" cy="9.800" r="2.300" fill="var(--oeil)"/>',
  /* Fiches : deux cartes empilees, un cavalier sur celle du dessus. */
  fiches: '<rect x="-9" y="-19" width="27" height="25" rx="4" fill="currentColor" opacity=".5"/><rect x="-18" y="-10.500" width="29" height="29" rx="4.500" fill="currentColor" stroke="var(--oeil)" stroke-width="2.400"/>'
};
const accentDessin = (d, s) => '<g transform="translate(14.5 -14.5) scale(' + s + ')">' + d + "</g>";
const P = {
  ordinateur: '<g transform="scale(1.06)">' + piece("n", -5.5, 5.5, .82) + accentDessin(DESSINS.puce, .56) + "</g>",
  ami: piece("p", -10, 1.5, .92) + piece("p", 10, 1.5, .92),
  exercices: glyphe("solved_1"),
  jour: '<g transform="scale(.94)">' + DESSINS.calendrier + "</g>",
  defi: glyphe("duel_gagne"),
  erreurs: glyphe("lec_rancunier"),
  sprint: glyphe("sprint_10"),
  coord: glyphe("coord_10"),
  finales: glyphe("eg_kp"),
  motif: glyphe("theme_knight_fork"),
  ouvertures: glyphe("ouv_5"),
  regles: glyphe("debut_fini"),
  lexique: '<g transform="scale(.92)">' + DESSINS.lexique + "</g>",
  pieges: '<g transform="scale(1.06)">' + piece("b", -5.5, 5.5, .82) + accentDessin(DESSINS.attention, .46) + "</g>",
  biblio: '<g transform="scale(.96)">' + DESSINS.fiches + piece("n", -3.500, 4.200, .52, true) + "</g>"
};
function pictosSource() { return "const PICTOS=" + JSON.stringify(P) + ";"; }
module.exports = { pictosSource, PICTOS: P };
