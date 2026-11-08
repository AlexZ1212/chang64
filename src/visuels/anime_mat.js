#!/usr/bin/env node
/* anime_mat.js - GIF anime d'un exercice de chang64 joue sur le plateau du
   site (2026-11-07, campagne visuelle d'Alexandre : "le mat en mouvement").

   Les positions sont calculees par le moteur du site (engine.js) et les
   pieces viennent du jeu officiel (plateau_svg.js) : jamais d'echiquier
   approximatif, contrairement aux generateurs d'images. Charte : ardoise
   #101413, laiton #E0A93B, craie #ECEAE3, sauge #97A49D, cases #EDE4D2 /
   #4B6B63, l'elephant du logo.

   Lancement :
     node visuels/anime_mat.js --id p93256 --sortie mat.gif [--taille 800]
   L'exercice est lu dans site/data (construire le site d'abord). */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { Game } = require("../engine.js");
const { pieceShapes } = require("../plateau_svg.js");

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : null; };
const ID = opt("id"), SORTIE = opt("sortie") || "mat.gif", TAILLE = +(opt("taille") || 800);
if (!ID) { console.log("Usage : node visuels/anime_mat.js --id pNNN --sortie mat.gif [--taille 800]"); process.exit(1); }

const C = { ardoise: "#101413", ardoise2: "#171d1b", ligne: "#2a3330", laiton: "#E0A93B", craie: "#ECEAE3",
  sauge: "#97A49D", clair: "#EDE4D2", fonce: "#4B6B63", rouge: "#C8553D" };
/* Le signe officiel (ds/signe.svg), avec son oeil : un trou dans la tete,
   d'ou fill-rule evenodd. Le favicon, lui, n'a pas d'oeil (trop petit). */
const ELEPHANT = (fs.readFileSync(path.join(__dirname, "..", "ds", "signe.svg"), "utf8").match(/\sd="([^"]+)"/) || [])[1];
const SERIF = "Georgia, 'Source Serif 4', serif", MONO = "Consolas, 'JetBrains Mono', monospace", SANS = "'Segoe UI', Arial, sans-serif";

/* ---------- l'exercice ---------- */
function lireExercice(id) {
  const D = path.join(__dirname, "..", "site", "data");
  const index = JSON.parse(fs.readFileSync(path.join(D, "ids", Math.floor(+id.slice(1) / 10000) + ".json"), "utf8"));
  if (!index[id]) throw new Error(id + " absent de l'index");
  const [n, m] = index[id];
  return JSON.parse(fs.readFileSync(path.join(D, "level-" + n + "-" + m + ".json"), "utf8")).find(x => x.id === id);
}
const p = lireExercice(ID);
const noirs = p.fen.split(" ")[1] === "b";
const camp = noirs ? "Black" : "White";

/* Plateau en tableau 8x8 (rangee 0 = 8e rangee, comme le FEN). */
const versGrille = fen => fen.split(" ")[0].split("/").map(r => { const l = []; for (const ch of r) { if (ch >= "1" && ch <= "8") for (let k = 0; k < +ch; k++) l.push(null); else l.push(ch); } return l; });
const caseXY = nom => ({ f: "abcdefgh".indexOf(nom[0]), r: 8 - +nom[1] });

const g = new Game(p.fen);
const etapes = [];   /* { avant, de, vers, san, echec, mat, roiEnEchec } */
for (const u of p.sol) {
  const avant = versGrille(g.fen());
  const m = g.moveFromUci(u);
  const san = g.san(m);
  g.makeMove(m);
  const apres = versGrille(g.fen());
  let roi = null;
  if (g.inCheck()) {
    const k = noirs === (etapes.length % 2 === 0) ? "K" : "k";   /* roi du camp qui vient de subir le coup */
    apres.forEach((l, r) => l.forEach((c, f) => { if (c === k) roi = { f, r }; }));
  }
  etapes.push({ avant, apres, de: caseXY(u.slice(0, 2)), vers: caseXY(u.slice(2, 4)), san, echec: g.inCheck(), mat: g.isCheckmate(), roi });
}

/* ---------- dessin ---------- */
const W = 1080, H = 1080;
const B = 648, BX = (W - B) / 2, BY = 262, S = B / 8;
/* Vue du camp au trait, comme sur le site. */
const vue = (f, r) => noirs ? { x: (7 - f) * S, y: (7 - r) * S } : { x: f * S, y: r * S };

let defs = "";
for (const t of "pnbrqk") for (const w of [true, false])
  defs += `<symbol id="p${w ? "w" : "b"}${t}" viewBox="0 0 45 45">${pieceShapes(t, w)}</symbol>`;
const piece = (ch, x, y) => `<use href="#p${ch === ch.toUpperCase() ? "w" : "b"}${ch.toLowerCase()}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${S}" height="${S}"/>`;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

function cadre() {
  return `<rect x="${BX - 18}" y="${BY - 18}" width="${B + 36}" height="${B + 36}" rx="14" fill="${C.ardoise2}" stroke="${C.ligne}" stroke-width="2"/>`;
}

function coordonnees() {
  let s = "";
  for (let k = 0; k < 8; k++) {
    const col = noirs ? "hgfedcba"[k] : "abcdefgh"[k], ran = noirs ? String(k + 1) : String(8 - k);
    const surFonce = (k + 7) % 2 === 1;   /* case de la rangee du bas */
    s += `<text x="${BX + k * S + S - 7}" y="${BY + B - 7}" text-anchor="end" font-family="${SANS}" font-size="15" font-weight="600" fill="${surFonce ? C.clair : C.fonce}">${col}</text>`;
    s += `<text x="${BX + 6}" y="${BY + k * S + 18}" font-family="${SANS}" font-size="15" font-weight="600" fill="${k % 2 ? C.clair : C.fonce}">${ran}</text>`;
  }
  return s;
}

/* Une image : grille, piece en mouvement (ou non), cases surlignees,
   textes. */
function image({ grille, mobile, surligne, roi, mat, titre, coups, pied }) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}` +
    `<filter id="ombre" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur in="SourceAlpha" stdDeviation="5"/>` +
    `<feOffset dx="3" dy="10" result="o"/><feComponentTransfer><feFuncA type="linear" slope="0.45"/></feComponentTransfer>` +
    `<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<radialGradient id="vignette" cx="50%" cy="48%" r="72%"><stop offset="55%" stop-color="#000" stop-opacity="0"/>` +
    `<stop offset="100%" stop-color="#000" stop-opacity="0.62"/></radialGradient></defs>`;
  /* Fond : un grand damier a peine visible sur toute l'image, assombri vers
     les bords par une vignette (demande d'Alexandre du 2026-11-07). Pas de
     damier d'angle ni de pastille : ces decors de gabarit font "image
     generee". */
  s += `<rect width="${W}" height="${H}" fill="${C.ardoise}"/>`;
  for (let r = 0; r < 12; r++) for (let f = 0; f < 12; f++)
    if ((r + f) % 2) s += `<rect x="${f * 90}" y="${r * 90}" width="90" height="90" fill="#18201d"/>`;
  s += `<rect width="${W}" height="${H}" fill="url(#vignette)"/>`;
  /* En-tete : elephant et nom a gauche, numero de l'exercice a droite, comme
     la puce "#CODE" du site. */
  s += `<g transform="translate(64,56) scale(0.95)"><path fill="${C.laiton}" fill-rule="evenodd" d="${ELEPHANT}"/></g>`;
  s += `<text x="140" y="104" font-family="${SERIF}" font-size="46" font-weight="700" fill="${C.craie}">chang<tspan fill="${C.laiton}" font-family="${MONO}" font-size="40">64</tspan></text>`;
  s += `<text x="${W - 70}" y="100" text-anchor="end" font-family="${MONO}" font-size="24" fill="${C.sauge}">#${esc(p.code)}</text>`;
  /* Titre au-dessus du plateau. */
  s += `<text x="${W / 2}" y="196" text-anchor="middle" font-family="${SERIF}" font-size="46" font-weight="700" fill="${mat ? C.laiton : C.craie}">${esc(titre)}</text>`;
  /* Plateau. */
  s += cadre();
  s += `<g transform="translate(${BX},${BY})">`;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const { x, y } = vue(f, r);
    s += `<rect x="${x}" y="${y}" width="${S}" height="${S}" fill="${(f + r) % 2 ? C.fonce : C.clair}"/>`;
  }
  for (const c of surligne || []) { const { x, y } = vue(c.f, c.r); s += `<rect x="${x}" y="${y}" width="${S}" height="${S}" fill="${C.laiton}" opacity="0.42"/>`; }
  if (roi) {
    const { x, y } = vue(roi.f, roi.r);
    s += `<rect x="${x}" y="${y}" width="${S}" height="${S}" fill="${C.rouge}" opacity="${mat ? 0.75 : 0.5}"/>`;
    s += `<rect x="${x + 3}" y="${y + 3}" width="${S - 6}" height="${S - 6}" fill="none" stroke="${C.laiton}" stroke-width="5" opacity="${mat ? 1 : 0}"/>`;
  }
  grille.forEach((l, r) => l.forEach((ch, f) => { if (ch) { const { x, y } = vue(f, r); s += piece(ch, x, y); } }));
  /* Piece en mouvement, soulevee : ombre portee floue sous elle. */
  if (mobile) s += `<g filter="url(#ombre)">${piece(mobile.ch, mobile.x, mobile.y - 6)}</g>`;
  s += `</g>` + coordonnees();
  /* Notation et pied de page. */
  s += `<text x="${W / 2}" y="${BY + B + 72}" text-anchor="middle" font-family="${MONO}" font-size="32" fill="${C.craie}">${esc(coups || " ")}</text>`;
  s += `<text x="${W / 2}" y="${H - 49}" text-anchor="middle" font-family="${SANS}" font-size="24" fill="${C.sauge}">${esc(pied)}</text>`;
  return s + "</svg>";
}

/* ---------- l'animation ---------- */
const doux = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const notation = k => {
  let out = "", num = 1;
  for (let i = 0; i < k; i++) {
    if (i % 2 === 0) out += (out ? " " : "") + num + ". " + etapes[i].san;
    else { out += " " + etapes[i].san; num++; }
  }
  return out;
};
const PIED = "More beginner puzzles on chang64.com";
const TITRE = camp + " to play and mate in " + p.n;
const images = [], delais = [];
const ajoute = (svg, ms) => { images.push(svg); delais.push(ms); };

ajoute(image({ grille: etapes[0].avant, titre: TITRE, coups: "", pied: PIED }), 2600);
etapes.forEach((e, i) => {
  const ch = e.avant[e.de.r][e.de.f];
  const fixe = e.avant.map(l => l.slice()); fixe[e.de.r][e.de.f] = null;
  const a = vue(e.de.f, e.de.r), b = vue(e.vers.f, e.vers.r);
  const N = 9;
  for (let k = 1; k <= N; k++) {
    const t = doux(k / N);
    ajoute(image({ grille: fixe, mobile: { ch, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, surligne: [e.de],
      titre: TITRE, coups: notation(i), pied: PIED }), 40);
  }
  const fin = i === etapes.length - 1;
  ajoute(image({ grille: e.apres, surligne: [e.de, e.vers], roi: e.echec ? e.roi : null, mat: e.mat,
    titre: e.mat ? "Checkmate" : TITRE, coups: notation(i + 1), pied: PIED }), fin ? 3600 : 1100);
});

(async () => {
  const cadres = [];
  for (const svg of images) cadres.push(await sharp(Buffer.from(svg), { density: 72 }).resize(TAILLE, TAILLE).png().toBuffer());
  await sharp(cadres, { join: { animated: true } }).gif({ delay: delais, loop: 0, effort: 8 }).toFile(SORTIE);
  /* Image fixe de la fin, utile en apercu ou en vignette. */
  await sharp(Buffer.from(images[images.length - 1]), { density: 72 }).resize(TAILLE, TAILLE).png().toFile(SORTIE.replace(/\.gif$/, "") + "-fin.png");
  await sharp(Buffer.from(images[0]), { density: 72 }).resize(TAILLE, TAILLE).png().toFile(SORTIE.replace(/\.gif$/, "") + "-debut.png");
  const ko = fs.statSync(SORTIE).size / 1024;
  console.log(SORTIE + " : " + images.length + " images, " + (delais.reduce((x, y) => x + y, 0) / 1000).toFixed(1) + " s, " + ko.toFixed(0) + " Ko");
  console.log("Coups : " + notation(etapes.length));
})().catch(e => { console.log("Echec : " + e.message); process.exit(1); });
