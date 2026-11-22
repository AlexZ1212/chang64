/* Verifie qu'aucun picto ne touche son voisin dans une meme medaille (regle
   d'Alexandre, 15/11). Chaque symbole est decoupe en parties (ses elements de
   premier niveau ; les dessins faits main d'un seul tenant forment une seule
   partie), chaque partie est rendue seule par sharp, puis on mesure l'ecart
   minimal entre parties. Ecart exige : 1,5 unite du repere -24..24.
   Usage : node design/badges/verif-contacts.js */
const fs = require("fs"), path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "src", "node_modules", "sharp"));
const S = JSON.parse(fs.readFileSync(path.join(__dirname, "symboles.json"), "utf8"));
const PX = 4, TAILLE = 48 * PX, ECART = 1.5 * PX;

/* Decoupe le balisage en elements de premier niveau. */
function niveau1(m) {
  const out = []; let prof = 0, debut = -1;
  const re = /<\/?([a-zA-Z]+)[^>]*?(\/?)>/g; let t;
  while ((t = re.exec(m))) {
    const ferme = t[0][1] === "/", auto = t[2] === "/";
    if (prof === 0 && !ferme) debut = t.index;
    if (!ferme && !auto) prof++;
    if (ferme) prof--;
    if (prof === 0 && debut >= 0) { out.push(m.slice(debut, re.lastIndex)); debut = -1; }
  }
  /* Les elements nus consecutifs (paths, cercles d'un dessin fait main) forment une seule partie. */
  const parties = [];
  for (const e of out) {
    const groupe = /^<g[\s>]/.test(e) || /^<text/.test(e);
    if (!groupe && parties.length && !parties[parties.length - 1].groupe) parties[parties.length - 1].m += e;
    else parties.push({ m: e, groupe });
  }
  return parties.map(p => p.m);
}
async function masque(m) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TAILLE}" height="${TAILLE}" viewBox="-24 -24 48 48" style="color:#000;--oeil:#000">${require("./contours.js").sansContours(m).replace(/var\(--oeil\)/g, "#000")}</svg>`;
  const { data } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const a = new Uint8Array(TAILLE * TAILLE);
  for (let i = 0; i < a.length; i++) a[i] = data[i * 4 + 3] > 60 ? 1 : 0;
  return a;
}
function dilate(a, r) {
  const b = new Uint8Array(a.length), r2 = r * r;
  for (let y = 0; y < TAILLE; y++) for (let x = 0; x < TAILLE; x++) if (a[y * TAILLE + x])
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < TAILLE && Y < TAILLE) b[Y * TAILLE + X] = 1;
    }
  return b;
}
(async () => {
  const fautifs = [];
  for (const [id, { s }] of Object.entries(S)) {
    const parties = niveau1(s);
    if (parties.length < 2) continue;
    const m = await Promise.all(parties.map(masque));
    const d = m.map(x => dilate(x, ECART));
    for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) {
      let n = 0; for (let k = 0; k < m[j].length; k++) if (d[i][k] && m[j][k]) n++;
      if (n) fautifs.push(`${id} (parties ${i + 1} et ${j + 1}, ${n} px)`);
    }
  }
  console.log(fautifs.length ? "CONTACTS :\n  " + fautifs.join("\n  ") : "aucun contact");
})();
