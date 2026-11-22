/* Apercu des pictogrammes des cartes tels que le site les dessine (2026-11-22).
   Usage : node design/pictos/apercu.js [nom,nom,...]
   Ecrit design/pictos/apercu-cartes.png, aux deux tailles des cartes (84 et 48 px). */
const path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "src", "node_modules", "sharp"));
const { PICTOS } = require(path.join(__dirname, "..", "..", "src", "pictos_build.js"));
const noms = (process.argv[2] || "ordinateur,ami,enligne").split(",");
const BRASS = "#DDAE95", OEIL = "#292625", FOND = "#171E1F", CARRE = "#262423";
const dessin = n => PICTOS[n].replace(/currentColor/g, BRASS).replace(/var\(--oeil\)/g, OEIL);
let s = "", x = 20;
for (const n of noms) {
  s += `<rect x="${x}" y="20" width="84" height="84" rx="12" fill="${CARRE}"/><svg x="${x + 11}" y="31" width="62" height="62" viewBox="-24 -24 48 48">${dessin(n)}</svg>`;
  s += `<rect x="${x + 100}" y="38" width="48" height="48" rx="8" fill="${CARRE}"/><svg x="${x + 107}" y="45" width="34" height="34" viewBox="-24 -24 48 48">${dessin(n)}</svg>`;
  s += `<text x="${x}" y="126" font-family="Segoe UI,Arial" font-size="13" fill="#96A5A5">${n}</text>`;
  x += 180;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="140"><rect width="100%" height="100%" fill="${FOND}"/>${s}</svg>`;
sharp(Buffer.from(svg), { density: 216 }).png().toFile(path.join(__dirname, "apercu-cartes.png")).then(() => console.log("ecrit"));
