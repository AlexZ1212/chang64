/* Calage des symboles (15/11, remarque d'Alexandre : les compositions a
   plusieurs elements paraissaient vides). Chaque symbole est rendu, on mesure
   ses pixels pleins, puis on le recentre et on l'agrandit pour que son point
   le plus eloigne du centre atteigne RAYON : tous remplissent la face pareil.
   Un symbole n'est jamais reduit (les pictos simples restent tels quels).
   Usage : node design/badges/ajuster.js  (apres symboles.js, avant verif et planche) */
const fs = require("fs"), path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "src", "node_modules", "sharp"));
const { sansContours } = require("./contours.js");
const F = path.join(__dirname, "symboles.json");
const S = JSON.parse(fs.readFileSync(F, "utf8"));
const PX = 4, T = 48 * PX, RAYON = 23.5, MAXI = 1.5;
async function masque(m) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}" viewBox="-24 -24 48 48" style="color:#000">${sansContours(m).replace(/var\(--oeil\)/g, "#000")}</svg>`;
  const { data } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pts = [];
  for (let i = 0; i < T * T; i++) if (data[i * 4 + 3] > 60) pts.push([i % T, (i / T) | 0]);
  return pts;
}
/* Ecart minimal (en unites) entre deux nuages de points, l'un decale de (dx, dy). */
function ecart(a, b, dx, dy) {
  const g = new Map(), C = 8;
  for (const [x, y] of a) { const k = ((x / C) | 0) + "," + ((y / C) | 0); (g.get(k) || g.set(k, []).get(k)).push([x, y]); }
  let min = Infinity;
  for (const [x0, y0] of b) {
    const x = x0 + dx * PX, y = y0 + dy * PX, cx = (x / C) | 0, cy = (y / C) | 0;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const l = g.get((cx + i) + "," + (cy + j)); if (!l) continue;
      for (const [u, v] of l) { const d = Math.hypot(u - x, v - y); if (d < min) min = d; }
    }
  }
  return min / PX;
}
/* L'accent (en haut a droite) glisse vers le sujet le long de la diagonale
   tant que l'ecart reste au-dessus de 1,8 unite (la regle en exige 1,5). */
async function rapprocher(s) {
  const m = s.match(/<g data-accent="1">([\s\S]*?<\/g>)<\/g>/);
  if (!m) return s;
  const reste = s.replace(m[0], ""), A = await masque(m[1]), B = await masque(reste);
  let lo = 0, hi = 12;
  for (let k = 0; k < 9; k++) { const t = (lo + hi) / 2; if (ecart(B, A, -t, t) >= 1.8) lo = t; else hi = t; }
  return reste + `<g data-accent="1" transform="translate(${(-lo).toFixed(2)} ${lo.toFixed(2)})">${m[1]}</g>`;
}
(async () => {
  let n = 0;
  for (const [id, v] of Object.entries(S)) {
    let s = v.s.replace(/^<g data-cale="1"[^>]*>([\s\S]*)<\/g>$/, "$1");   // idempotent
    s = await rapprocher(s);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}" viewBox="-24 -24 48 48" style="color:#000">${sansContours(s).replace(/var\(--oeil\)/g, "#000")}</svg>`;
    const { data } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let x0 = T, y0 = T, x1 = -1, y1 = -1;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (data[(y * T + x) * 4 + 3] > 60) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const cx = (x0 + x1 + 1) / 2 / PX - 24, cy = (y0 + y1 + 1) / 2 / PX - 24;
    let r = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (data[(y * T + x) * 4 + 3] > 60) {
      const dx = (x + .5) / PX - 24 - cx, dy = (y + .5) / PX - 24 - cy, d = Math.hypot(dx, dy);
      if (d > r) r = d;
    }
    /* Les compositions a plusieurs elements vont un peu plus pres du bord : elles
       paraissaient vides (remarque d'Alexandre). */
    const multi = (s.match(/<g fill="currentColor" transform=/g) || []).length + (s.match(/<text/g) || []).length >= 2;
    const k = Math.min(1.7, Math.max(1, (multi ? 26.5 : RAYON) / r));
    if (k > 1.02 || Math.hypot(cx, cy) > .6) {
      v.s = `<g data-cale="1" transform="scale(${k.toFixed(3)}) translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})">${s}</g>`;
      n++;
    } else v.s = s;
  }
  fs.writeFileSync(F, JSON.stringify(S));
  console.log("symboles recales :", n, "sur", Object.keys(S).length);
})();
