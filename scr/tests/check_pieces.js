/* Verification automatique de chang64.
   Lancement : node tests/check_pieces.js

   L'oeil et le naseau du cavalier portent un simple remplissage a la couleur
   du contour des pieces (#101413), sans contour propre. Leur donner le
   remplissage de la piece les ferait disparaitre dans le corps.

   Le set de pieces est dessine par l'auteur et doit etre repris tel quel :
   ni geometrie, ni proportions, ni epaisseurs de contour ne doivent changer.

   Deux formes du cavalier, l'oeil et le naseau, n'ont pas de fill declare
   dans les SVG d'origine : elles s'affichent donc en noir par defaut. Les
   recolorer les ferait disparaitre dans le corps d'une piece noire. Elles
   sont marquees "fixe" dans les donnees et ne doivent jamais recevoir de
   remplissage.

   Piege rencontre a l'extraction : chercher l'attribut d=" sans limite de mot
   attrapait le "d" final de id=", et les traces se retrouvaient remplaces par
   les identifiants ("Tower-Base" au lieu du chemin). Les images de partage
   ont alors toutes echoue a la conversion. D'ou le controle que chaque trace
   commence bien par une commande de deplacement.
*/
const fs = require("fs");
const path = require("path");
const SITE = path.join(__dirname, "..", "site");
const SRC = path.join(__dirname, "..");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };

const data = JSON.parse(fs.readFileSync(path.join(SRC, "ds", "pieces.json"), "utf8"));
const PIECES = { p: data.pawn, n: data.knight, b: data.bishop, r: data.rook, q: data.queen, k: data.king };

console.log("\n--- Les six pieces sont presentes ---");
for (const [k, nom] of [["p", "pion"], ["n", "cavalier"], ["b", "fou"], ["r", "tour"], ["q", "dame"], ["k", "roi"]])
  T(nom + " : " + (PIECES[k] || []).length + " formes", (PIECES[k] || []).length > 0);

console.log("\n--- Les traces sont intacts ---");
let mauvais = [];
for (const [k, formes] of Object.entries(PIECES))
  for (const f of formes) {
    if (f.t === "circle") { if (!f.cx || !f.cy || !f.r) mauvais.push(k + " cercle incomplet"); continue; }
    if (!f.d || !/^[Mm]/.test(f.d)) mauvais.push(k + " : " + String(f.d).slice(0, 20));
  }
T("tous les traces commencent par une commande de deplacement", mauvais.length === 0,
  mauvais.slice(0, 3).join(", "));

console.log("\n--- L'oeil et le naseau du cavalier restent noirs ---");
const fixes = PIECES.n.filter(f => f.fixe);
T("deux formes marquees intouchables", fixes.length === 2, fixes.length + " trouvees");
T("aucune autre piece n'en a", Object.entries(PIECES).filter(([k, v]) => k !== "n" && v.some(f => f.fixe)).length === 0);

console.log("\n--- Rendu dans les pages de contenu ---");
const page = fs.readFileSync(SITE + "/openings/sicilian-defense.html", "utf8");
const sym = (id) => {
  const m = page.match(new RegExp('<symbol id="' + id + '"[^>]*>([\\s\\S]*?)</symbol>'));
  return m ? m[1] : "";
};
for (const [id, attendu, nom] of [["wp", "#eceae3", "pion blanc"], ["bp", "#232b28", "pion noir"]]) {
  const c = sym(id);
  const fills = [...new Set([...c.matchAll(/fill="([^"]*)"/g)].map(m => m[1]))];
  T(nom + " en " + attendu, fills.length === 1 && fills[0] === attendu, fills.join(", "));
}
for (const [id, nom] of [["wn", "cavalier blanc"], ["bn", "cavalier noir"]]) {
  const c = sym(id);
  /* Oeil et naseau : remplis a la couleur du contour, et sans contour propre. */
  const pleins = (c.match(/fill="#101413"/g) || []).length;
  const sansContour = [...c.matchAll(/<path[^>]*\/>/g)]
    .filter(m => /fill="#101413"/.test(m[0]) && !/stroke=/.test(m[0])).length;
  T(nom + " : oeil et naseau a la couleur du contour", pleins === 2, pleins + " formes");
  T(nom + " : et sans contour propre", sansContour === 2, sansContour + " formes");
}

console.log("\n--- Les images de partage se convertissent ---");
const png = fs.readdirSync(SITE + "/og").filter(f => f.endsWith(".png")).length;
const svg = fs.readdirSync(SITE + "/og").filter(f => f.endsWith(".svg")).length;
T(png + " images generees", png >= 140, String(png));
T("aucun SVG residuel", svg === 0, svg + " restants");

console.log("\n--- Poids maitrise ---");
const taille = fs.statSync(path.join(SRC, "pieces_browser.js")).size;
T("module des pieces sous 10 Ko", taille < 10240, Math.round(taille / 1024 * 10) / 10 + " Ko");

console.log("\n--- L'application utilise le meme set ---");
const app = fs.readFileSync(SITE + "/index.html", "utf8");
T("remplissage blanc", /"#eceae3"/.test(app));
T("remplissage noir", /"#232b28"/.test(app));
T("ancien jeu retire", !/#F7F4EC/.test(app));

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
