/* chang64 - icones du site aux couleurs de la palette (2026-11-19)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Lancement : node icones_build.js
 *
 * Repeint les sources SVG de design/identite/svg aux couleurs de la palette
 * du site, puis regenere tout ce que build_site.js copie depuis ds/icones :
 * favicon.svg, favicon.ico (16, 32, 48), apple-touch-icon.png, icon-192/512
 * et maskable-192/512. A relancer quand la palette de base change : il suffit
 * d'ajouter l'ancienne couleur dans PEINTURE. Les dessins ne sont pas touches.
 */
const fs = require("fs"), path = require("path"), sharp = require("sharp");
const SRC = path.join(__dirname, "..", "design", "identite"), OUT = path.join(__dirname, "ds", "icones");

/* Anciennes couleurs -> palette Cuivre doux (accent, encre, nuit, ardoise). */
const PEINTURE = { "#E0A93B": "#DDAE95", "#101413": "#0F1414", "#191F1D": "#171E1F", "#232B28": "#212A2B" };
const repeindre = s => Object.entries(PEINTURE).reduce((t, [a, b]) => t.split(a).join(b), s);

const png = (svg, taille) => sharp(Buffer.from(svg), { density: 72 * taille / 64 * 4 }).resize(taille, taille).png({ compressionLevel: 9 }).toBuffer();

/* Un .ico n'est qu'une enveloppe : un en-tete, une ligne par image, puis les
   PNG tels quels (acceptes par tous les navigateurs actuels et par Windows). */
function ico(images) {
  const tete = Buffer.alloc(6 + 16 * images.length);
  tete.writeUInt16LE(0, 0); tete.writeUInt16LE(1, 2); tete.writeUInt16LE(images.length, 4);
  let pos = tete.length;
  images.forEach(({ taille, donnees }, i) => {
    const o = 6 + 16 * i;
    tete.writeUInt8(taille, o); tete.writeUInt8(taille, o + 1); tete.writeUInt8(0, o + 2); tete.writeUInt8(0, o + 3);
    tete.writeUInt16LE(1, o + 4); tete.writeUInt16LE(32, o + 6);
    tete.writeUInt32LE(donnees.length, o + 8); tete.writeUInt32LE(pos, o + 12);
    pos += donnees.length;
  });
  return Buffer.concat([tete, ...images.map(i => i.donnees)]);
}

(async () => {
  const svg = {};
  for (const f of ["favicon.svg", "icon-any.svg", "icon-maskable.svg", "apple-touch-icon.svg"]) {
    const p = path.join(SRC, "svg", f);
    svg[f] = repeindre(fs.readFileSync(p, "utf8"));
    fs.writeFileSync(p, svg[f]);
  }
  const ecrire = (nom, donnees) => { fs.writeFileSync(path.join(SRC, "png", nom), donnees); if (fs.existsSync(path.join(OUT, nom))) fs.writeFileSync(path.join(OUT, nom), donnees); };
  fs.writeFileSync(path.join(OUT, "favicon.svg"), svg["favicon.svg"]);
  const petits = [];
  for (const t of [16, 32, 48]) { const d = await png(svg["favicon.svg"], t); petits.push({ taille: t, donnees: d }); ecrire("favicon-" + t + ".png", d); }
  const i = ico(petits);
  fs.writeFileSync(path.join(SRC, "favicon.ico"), i); fs.writeFileSync(path.join(OUT, "favicon.ico"), i);
  ecrire("apple-touch-icon.png", await sharp(await png(svg["apple-touch-icon.svg"], 180)).flatten({ background: PEINTURE["#191F1D"] }).png().toBuffer());
  for (const t of [192, 512]) {
    ecrire("icon-" + t + ".png", await png(svg["icon-any.svg"], t));
    ecrire("maskable-" + t + ".png", await png(svg["icon-maskable.svg"], t));
  }
  console.log("icones regenerees : " + fs.readdirSync(OUT).join(", "));
})();
