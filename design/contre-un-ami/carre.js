/* Dessins possibles pour le carre de notification (2026-11-22).
   Usage : node design/contre-un-ami/carre.js <dossier assets de @phosphor-icons/core> */
const fs = require("fs"), path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "src", "node_modules", "sharp"));
const { PICTOS } = require(path.join(__dirname, "..", "..", "src", "pictos_build.js"));
const PH = process.argv[2];
const ph = (nom, g) => fs.readFileSync(path.join(PH, g || "regular", nom + (g && g !== "regular" ? "-" + g : "") + ".svg"), "utf8").replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const C = { fond: "#171E1F", raise: "#212A2B", chalk: "#EAECEA", sage: "#96A5A5", brass: "#DDAE95", rule: "rgba(234,236,234,.16)", encre: "#1c130e" };
const src = fs.readFileSync(path.join(__dirname, "..", "..", "src", "pieces_browser.js"), "utf8");
const PIECES = new Function(src.slice(src.indexOf("const PIECES="), src.indexOf("const PIECE_COLORS")) + ";return PIECES;")();
const piece = t => `<g fill="${C.chalk}" transform="translate(-24 -24) scale(1.0667)">` + PIECES[t].map(f => (f.t === "circle" ? `<circle cx="${f.cx}" cy="${f.cy}" r="${f.r}"` : `<path d="${f.d}"`) + (f.fixe ? ` fill="${C.raise}"` : "") + "/>").join("") + "</g>";
const phos = (nom, g) => `<g transform="scale(${48 / 256}) translate(-128 -128)" fill="${C.chalk}">${ph(nom, g)}</g>`;
const OPTIONS = [
  ["A", "Enveloppe", phos("envelope-simple")],
  ["B", "Deux pions", PICTOS.ami.replace(/currentColor/g, C.chalk).replace(/var\(--oeil\)/g, C.raise)],
  ["C", "Cavalier", piece("n")],
  ["D", "Sablier", phos("hourglass-medium")],
  ["E", "Cloche", phos("bell")]
];
let s = "";
OPTIONS.forEach(([l, nom, d], i) => {
  const x = 30 + i * 132;
  s += `<rect x="${x}" y="30" width="72" height="72" rx="18" fill="${C.raise}" stroke="${C.rule}" stroke-width="1.3"/>` +
    `<g transform="translate(${x + 36} 66) scale(.72)">${d}</g>` +
    `<rect x="${x + 52}" y="20" width="28" height="28" rx="14" fill="${C.brass}"/><text x="${x + 66}" y="40" text-anchor="middle" font-family="Consolas,monospace" font-weight="700" font-size="16" fill="${C.encre}">2</text>` +
    `<text x="${x}" y="130" font-family="Segoe UI,Arial" font-size="17" font-weight="700" fill="${C.brass}">${l}</text><text x="${x + 20}" y="130" font-family="Segoe UI,Arial" font-size="14" fill="${C.sage}">${nom}</text>`;
});
const W = 30 + OPTIONS.length * 132;
sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="150"><rect width="100%" height="100%" fill="${C.fond}"/>${s}</svg>`), { density: 192 }).png().toFile(path.join(__dirname, "carre-dessins.png")).then(() => console.log("ecrit"));
