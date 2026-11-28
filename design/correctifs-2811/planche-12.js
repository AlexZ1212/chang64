/* Planche du point 12 (27/11) : des pictos plus parlants pour les motifs de
   « Travailler un motif ». Pour chaque motif : le dessin d'aujourd'hui puis
   trois propositions, dans la grammaire des medailles (aplats, piece de
   l'auteur en bas a gauche et accent en haut a droite, ou un seul dessin
   Phosphor « fill »), rendus comme une tuile du site a 360 px.
   Usage : node design/correctifs-2811/planche-12.js <dossier phosphor assets/fill> http://localhost:<port>
   Ecrit design/correctifs-2811/apres/planche-12-pictos.png et planche-12-pictos.json
   (le dessin de chaque proposition, pour l'appliquer ensuite). */
const fs = require("fs"), path = require("path"), vm = require("vm");
const RACINE = path.join(__dirname, "..", "..");
const SRC = path.join(RACINE, "src");
const { ouvrir } = require(path.join(SRC, "tests", "outils", "chrome_sans_fenetre.js"));
const PH = process.argv[2], BASE = (process.argv[3] || "http://localhost:8096").replace(/\/$/, "");
const M = require(path.join(SRC, "badges-medailles.json"));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(SRC, "pieces_browser.js"), "utf8").replace(/^const PIECES=/m, "PIECES="), ctx);
const { TRAIT } = require(path.join(RACINE, "design", "badges", "contours.js"));
const formes = l => l.map(f => {
  const a = Object.entries(f).filter(([k]) => !["t", "fixe", "sw"].includes(k)).map(([k, v]) => `${k}="${v}"`).join(" ");
  return f.fixe ? `<${f.t || "path"} ${a} style="fill:var(--oeil);stroke:none"/>` : `<${f.t || "path"} ${a}/>`;
}).join("");
const P = (l, tr = "") => `<g fill="currentColor"${TRAIT} transform="${tr} translate(-24 -24) scale(1.0667)">${formes(ctx.PIECES[l])}</g>`;
function F(nom, tr = "") {
  const f = path.join(PH, nom + "-fill.svg");
  if (!fs.existsSync(f)) throw new Error("Phosphor : " + nom);
  const corps = fs.readFileSync(f, "utf8").replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return `<g fill="currentColor" transform="${tr} translate(-24 -24) scale(.1875)">${corps}</g>`;
}
const G = "translate(-5.5 5.5) scale(.82)";
const A = nom => `<g data-accent="1">${F(nom, "translate(14.5 -14.5) scale(.5)")}</g>`;
const nu = k => M[k][1].replace(/<g data-cale="1" transform="[^"]*">/, "<g>");
/* Meme poids que pictos_build.js : un dessin seul a 80 %, une composition a 106 %. */
const poids = s => '<g transform="scale(' + (/data-accent|scale\(\.[0-9]+\)" *>.*translate\(-24 -24\) scale\(1\.0667\)/.test(s) || /data-accent/.test(s) ? 1.06 : .8) + ')">' + s + "</g>";

const MOTIFS = [
  ["Déviation", "deflection", [["Flèche qui dévie", F("arrow-bend-up-right")], ["Dame détournée", P("q", G) + A("arrow-bend-up-right")], ["Tour détournée", P("r", G) + A("arrow-u-up-right")]]],
  ["Attaque double", "double_attack", [["Flèches en deux", F("arrows-split")], ["Dame et deux flèches", P("q", G) + A("arrows-split")], ["Dame et éclair", P("q", G) + A("lightning")]]],
  ["Coup silencieux", "quiet_move", [["Haut-parleur coupé", F("speaker-slash")], ["Pion silencieux", P("p", G) + A("speaker-slash")], ["Pas feutrés", F("footprints")]]],
  ["Mat du couloir", "back_rank_mate", [["Roi derrière ses pions", nu("theme_back_rank_mate_10")], ["Roi et cadenas", P("k", G) + A("lock")], ["Roi et mur", P("k", G) + A("wall")]]],
  ["Mat en un coup", "mate_in_one", [["Chiffre 1", F("number-circle-one")], ["Roi et 1", P("k", G) + A("number-circle-one")], ["Roi et éclair", P("k", G) + A("lightning")]]],
  ["Mat en deux coups", "mate_in_two", [["Chiffre 2", F("number-circle-two")], ["Roi et 2", P("k", G) + A("number-circle-two")], ["Deux flèches", P("k", G) + A("arrows-split")]]],
  ["Mat en trois coups", "mate_in_three", [["Chiffre 3", F("number-circle-three")], ["Roi et 3", P("k", G) + A("number-circle-three")], ["Roi et sablier", P("k", G) + A("hourglass")]]],
  ["Gain de matériel", "winning_capture", [["Main qui prend", F("hand-grabbing")], ["Pion qui prend", P("p", G) + A("hand-grabbing")], ["Cible", F("target")]]]
];

(async () => {
  const lignes = [], json = {};
  for (const [nom, k, props] of MOTIFS) {
    const actuel = M["theme_" + k] ? nu("theme_" + k) : "";
    const cases = [["Aujourd'hui", actuel]].concat(props).map(([t, s], i) => {
      if (i) json[k + "_" + "ABC"[i - 1]] = s;
      return `<figure style="margin:0;display:flex;flex-direction:column;align-items:center;gap:4px;width:76px">` +
        `<span style="display:grid;place-items:center;width:44px;height:44px;border-radius:12px;border:1px solid var(--rule);background-color:var(--raise);color:var(--brass);--oeil:var(--raise)${i ? "" : ";opacity:.75"}">` +
        `<svg viewBox="-24 -24 48 48" width="30" height="30" aria-hidden="true">${poids(s)}</svg></span>` +
        `<figcaption style="font-size:10px;line-height:1.2;text-align:center;color:var(--sage)">${i ? "ABC"[i - 1] + ". " : ""}${t}</figcaption></figure>`;
    }).join("");
    lignes.push(`<div style="margin:0 0 10px"><p style="margin:0 0 4px;font-size:13px;font-weight:600;color:var(--chalk)">${nom}</p><div style="display:flex;gap:4px">${cases}</div></div>`);
  }
  fs.writeFileSync(path.join(__dirname, "apres", "planche-12-pictos.json"), JSON.stringify(json));
  const c = await ouvrir({ largeur: 360, hauteur: 1100 });
  await c.aller(BASE + "/fr/"); await c.attendre(800);
  const html = lignes.join("");
  await c.js(`(function(){document.body.innerHTML=${JSON.stringify('<div style="padding:12px 14px">' + html + "</div>")};return 1})()`);
  await c.attendre(300);
  await c.capture(path.join(__dirname, "apres", "planche-12-pictos.png"));
  await c.fermer();
  console.log("planche ecrite");
})();
