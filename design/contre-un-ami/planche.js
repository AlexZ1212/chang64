/* Reunit les quatre maquettes en une planche (2026-11-22).
   Usage : node design/contre-un-ami/planche.js */
const path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "src", "node_modules", "sharp"));
const VUES = [
  ["1-membre-rapide.png", "1. Membre : un seul bloc, la cadence choisit tout"],
  ["2-membre-correspondance.png", "2. Membre : cadence « Correspondance »"],
  ["3-sans-compte.png", "3. Sans compte : « Partie par lien »"],
  ["4-carre-notification.png", "4. Le carré de notification (ici dans Résoudre)"]
];
(async () => {
  const H = 1500, L = 360, MARGE = 24, TITRE = 46;
  const pieces = [];
  let x = MARGE;
  for (const [f, titre] of VUES) {
    const img = await sharp(path.join(__dirname, f)).resize({ width: L }).extract({ left: 0, top: 0, width: L, height: Math.min(H, (await sharp(path.join(__dirname, f)).resize({ width: L }).metadata()).height * 1 || H) }).png().toBuffer().catch(async () => sharp(path.join(__dirname, f)).resize({ width: L }).png().toBuffer());
    const meta = await sharp(img).metadata();
    const haut = Math.min(H, meta.height);
    const coupe = await sharp(img).extract({ left: 0, top: 0, width: L, height: haut }).png().toBuffer();
    const etiquette = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${TITRE}"><text x="0" y="28" font-family="Segoe UI,Arial,sans-serif" font-size="15" font-weight="600" fill="#EAECEA">${titre.replace(/&/g, "&amp;")}</text></svg>`);
    pieces.push({ input: etiquette, left: x, top: 8 }, { input: coupe, left: x, top: TITRE + 8 });
    x += L + MARGE;
  }
  await sharp({ create: { width: x, height: H + TITRE + 32, channels: 4, background: "#0b0f0f" } }).composite(pieces).png().toFile(path.join(__dirname, "planche-contre-un-ami.png"));
  console.log("planche ecrite");
})().catch(e => { console.error(e); process.exit(1); });
