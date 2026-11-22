/* chang64 - pictogrammes des cartes (2026-11-19)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Une seule famille de dessins pour les cartes de Jouer, de Resoudre et
 * d'Explorer, et pour le menu. Regle voulue par Alexandre : un meme symbole a
 * la meme forme partout. Chaque picto reprend donc TEL QUEL le dessin d'une
 * medaille de badges-medailles.json (epees, chrono, boussole...), ou suit leur
 * grammaire : pieces de l'auteur (pieces_browser.js) en aplat, piece
 * principale en bas a gauche, accent en haut a droite. Quatre dessins sont
 * propres a ce fichier (calendrier, lexique, attention, fiches), dans le
 * meme style : aplats, les jours dans la couleur du fond (--oeil). Le globe
 * et la puce viennent de Phosphor (voir plus bas).
 * Boite de 48 centree sur l'origine : viewBox="-24 -24 48 48".
 *
 * pictosSource() rend la ligne « const PICTOS={...}; » collee dans le script
 * de l'application par badges_build.js. */
const fs = require("fs"), path = require("path");
const M = require("./badges-medailles.json");
const src = fs.readFileSync(path.join(__dirname, "pieces_browser.js"), "utf8");
const PIECES = new Function(src.slice(src.indexOf("const PIECES="), src.indexOf("const PIECE_COLORS")) + ";return PIECES;")();
/* Contours (2026-11-22, remarque d'Alexandre : en aplat, la piece n'etait plus
   qu'une silhouette, sans le socle, le col ni la tete qu'on voit sur
   l'echiquier). Chaque forme de la piece porte un trait de la couleur des
   jours, peint SOUS son aplat (paint-order) : seule la moitie exterieure du
   trait se voit, la ou la forme recouvre la precedente, et la silhouette garde
   sa taille. Meme regle et meme epaisseur que les pieces des medailles
   (design/badges/contours.js ; tests/check_contours_pieces.js les compare).
   Piece « en creux » (creux) : les deux couleurs s'echangent. */
const CONTOUR = 1.4;   /* epaisseur visible, dans le repere de la piece (boite de 45) */
const trait = c => ' stroke="' + c + '" stroke-width="' + (2 * CONTOUR) + '" stroke-linejoin="round" paint-order="stroke"';
const piece = (t, x, y, s, creux) => {
  const plein = creux ? "var(--oeil)" : "currentColor", jour = creux ? "currentColor" : "var(--oeil)";
  return '<g fill="' + plein + '"' + trait(jour) + ' transform="translate(' + x + " " + y + ") scale(" + s + ') translate(-24 -24) scale(1.0667)">' +
    PIECES[t].map(f => (f.t === "circle" ? '<circle cx="' + f.cx + '" cy="' + f.cy + '" r="' + f.r + '"' : '<path d="' + f.d + '"') + (f.fixe ? ' style="fill:' + jour + ';stroke:none"' : "") + "/>").join("") + "</g>";
};
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
  /* Lexique : un livre ferme, son dos, deux lettres. */
  lexique: '<g fill="currentColor"><path d="M-12 -19h24a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4h-24a4.500 4.500 0 0 1-4.500-4.500v-29a4.500 4.500 0 0 1 4.500-4.500z"/></g>' +
    '<path d="M-10 -19v38" ' + O + '2.200"/><text x="3.500" y="5.500" text-anchor="middle" style="fill:var(--oeil);font-family:&quot;Source Serif 4&quot;,Georgia,serif;font-weight:600;font-size:17px">Aa</text>',
  /* Attention : le triangle des pieges. */
  attention: '<path fill="currentColor" d="M-2.900 -17.200a3.300 3.300 0 0 1 5.800 0l16.300 28.600a3.300 3.300 0 0 1-2.900 5h-32.600a3.300 3.300 0 0 1-2.900-5z"/><path d="M0 -6.500v9.500" ' + O + '3.600"/><circle cx="0" cy="9.800" r="2.300" fill="var(--oeil)"/>',
  /* Fiches : deux cartes empilees, un cavalier sur celle du dessus. */
  fiches: '<rect x="-9" y="-19" width="27" height="25" rx="4" fill="currentColor" opacity=".5"/><rect x="-18" y="-10.500" width="29" height="29" rx="4.500" fill="currentColor" stroke="var(--oeil)" stroke-width="2.400"/>'
};
/* Pictogrammes Phosphor (licence MIT, phosphoricons.com), boite de 256 ramenee
   a la boite de 48 centree. Choisis par Alexandre sur planche le 2026-11-22
   (design/pictos/planche-pictos.png). */
const phosphor = d => '<g transform="scale(.1875) translate(-128 -128)"><path fill="currentColor" d="' + d + '"/></g>';
/* Globe du joueur en ligne : le meme dessin que la ligne « Langue » du menu
   (template.html) ; tests/check_pictos_jouer.js verifie qu'ils ne divergent pas. */
const GLOBE_LANGUE = "M128,24h0A104,104,0,1,0,232,128,104.12,104.12,0,0,0,128,24Zm87.62,96H175.79C174,83.49,159.94,57.67,148.41,42.4A88.19,88.19,0,0,1,215.63,120ZM96.23,136h63.54c-2.31,41.61-22.23,67.11-31.77,77C118.45,203.1,98.54,177.6,96.23,136Zm0-16C98.54,78.39,118.46,52.89,128,43c9.55,9.93,29.46,35.43,31.77,77Zm11.36-77.6C96.06,57.67,82,83.49,80.21,120H40.37A88.19,88.19,0,0,1,107.59,42.4ZM40.37,136H80.21c1.82,36.51,15.85,62.33,27.38,77.6A88.19,88.19,0,0,1,40.37,136Zm108,77.6c11.53-15.27,25.56-41.09,27.38-77.6h39.84A88.19,88.19,0,0,1,148.41,213.6Z";
DESSINS.globe = phosphor(GLOBE_LANGUE);
/* Puce de l'ordinateur : « cpu », graisse pleine. Elle remplace la puce
   dessinee a la main (boitier, coeur et douze pattes), jugee peu jolie. */
DESSINS.puce = phosphor("M104,104h48v48H104Zm136,48a8,8,0,0,1-8,8H216v40a16,16,0,0,1-16,16H160v16a8,8,0,0,1-16,0V216H112v16a8,8,0,0,1-16,0V216H56a16,16,0,0,1-16-16V160H24a8,8,0,0,1,0-16H40V112H24a8,8,0,0,1,0-16H40V56A16,16,0,0,1,56,40H96V24a8,8,0,0,1,16,0V40h32V24a8,8,0,0,1,16,0V40h40a16,16,0,0,1,16,16V96h16a8,8,0,0,1,0,16H216v32h16A8,8,0,0,1,240,152ZM168,96a8,8,0,0,0-8-8H96a8,8,0,0,0-8,8v64a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8Z");
/* c : le centre de l'accent (14.5 par defaut). Un dessin Phosphor occupe presque
   toute sa boite : il se pose un peu plus pres du centre, sinon ses bords
   sortent de la boite de 48 et sont rognes (constate le 2026-11-22). */
const accentDessin = (d, s, c) => '<g transform="translate(' + (c || 14.5) + " -" + (c || 14.5) + ") scale(" + s + ')">' + d + "</g>";
const P = {
  ordinateur: '<g transform="scale(1.06)">' + piece("n", -5.5, 5.5, .82) + accentDessin(DESSINS.puce, .48, 12) + "</g>",
  ami: piece("p", -10, 1.5, .92) + piece("p", 10, 1.5, .92),
  enligne: '<g transform="scale(1.06)">' + piece("p", -5.5, 5.5, .82) + accentDessin(DESSINS.globe, .48, 12) + "</g>",
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
  /* Le triangle arrive au bord de sa propre boite (± 19,6 sur 24) : centre a
     13,4 il touchait le bord droit du cadre et y etait rogne (remarque
     d'Alexandre, 2026-11-22). A 12, comme le globe et la puce, il garde une
     marge. */
  pieges: '<g transform="scale(1.06)">' + piece("b", -5.5, 5.5, .82) + accentDessin(DESSINS.attention, .46, 12) + "</g>",
  biblio: '<g transform="scale(.96)">' + DESSINS.fiches + piece("n", -3.500, 4.200, .52, true) + "</g>"
};
function pictosSource() { return "const PICTOS=" + JSON.stringify(P) + ";"; }
module.exports = { pictosSource, PICTOS: P, GLOBE_LANGUE };
