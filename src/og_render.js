#!/usr/bin/env node
/* og_render.js - convertit les images de partage (Open Graph) de SVG en PNG.

   Remplace og_render.py, appele par build_site.js juste apres la generation
   du site. Meme role, memes fichiers, meme ligne de compte-rendu.

   Pourquoi ne plus passer par Python. Le script Python demandait cairosvg,
   qui demande lui-meme la bibliotheque systeme Cairo. Sur Linux c'est une
   ligne d'apt ; sur Windows c'est une installation de Python, puis de
   cairosvg, puis des DLL de GTK, et build_site.js appelait de surcroit
   "python3", un nom qui n'existe pas sur une installation Windows standard.
   sharp arrive avec son moteur de rendu compile pour la plateforme :
   npm install sharp, et c'est fini.

   Fidelite verifiee avant bascule, en comparant pixel a pixel les rendus des
   deux outils sur les memes SVG : ecart moyen de 1 sur 255, 1,4 % des octets
   au-dela de 8, uniquement sur les bords de lettres. Les aplats, les couleurs
   et la geometrie sont identiques.

   build_site.js ecrit un .svg par page dans site/og/<nom>.svg, mais le HTML
   pointe vers <nom>.png : les plateformes sociales n'acceptent pas le SVG en
   image de partage. Ce script comble ce trou et laisse le .svg en place.

   Rien de destructif : un .png plus recent que son .svg est saute.
   --force reconvertit tout.
*/
const fs = require("fs");
const path = require("path");

const OG_DIR = path.join(__dirname, "site", "og");
const force = process.argv.includes("--force");

let sharp;
try {
  sharp = require("sharp");
} catch (e) {
  console.log("og_render.js : le module 'sharp' est absent.");
  console.log("  Installer avec : npm install sharp --no-save");
  process.exit(1);
}

if (!fs.existsSync(OG_DIR)) {
  console.log("og_render.js : dossier introuvable (" + OG_DIR + "), rien a faire.");
  process.exit(0);
}

const svgs = fs.readdirSync(OG_DIR).filter(f => f.endsWith(".svg")).sort();
if (!svgs.length) {
  console.log("og_render.js : aucun .svg trouve dans site/og/.");
  process.exit(0);
}

(async () => {
  let converties = 0, sautees = 0, echecs = 0;

  for (const nom of svgs) {
    const svg = path.join(OG_DIR, nom);
    const png = path.join(OG_DIR, nom.slice(0, -4) + ".png");

    if (!force && fs.existsSync(png) &&
        fs.statSync(png).mtimeMs >= fs.statSync(svg).mtimeMs) { sautees++; continue; }

    try {
      /* La taille est imposee, pas deduite du SVG : les plateformes sociales
         attendent 1200x630 et redimensionnent mal ce qui s'en ecarte. */
      await sharp(svg, { density: 96 })
        .resize(1200, 630)
        .png()
        .toFile(png);
      converties++;
    } catch (err) {
      console.log("  echec sur " + nom + " : " + err.message);
      echecs++;
    }
  }

  console.log("og_render.js : " + converties + " converties, " + sautees +
    " deja a jour, " + echecs + " echecs (sur " + svgs.length + " .svg).");
  process.exit(echecs ? 1 : 0);
})();
