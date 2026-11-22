/* Contours des pieces dans les medailles (2026-11-22, remarque d'Alexandre :
   « on n'y retrouve pas les contours qui font que l'on voit les differentes
   parties qui composent la piece, comme sur l'echiquier »).

   Une piece (P et MK de symboles.js) est un groupe de plusieurs formes posees
   l'une sur l'autre : socle, corps, col, tete. En aplat d'une seule couleur
   elles se fondaient en une silhouette. Chaque forme recoit donc un trait de
   la couleur des jours (--oeil), peint SOUS son propre remplissage
   (paint-order) : seule la moitie exterieure du trait se voit, la ou la forme
   recouvre la precedente. La silhouette ne change pas de taille. L'oeil et le
   naseau du cavalier (formes « fixes ») n'ont pas de trait.

   Sur la medaille, --oeil n'est plus une couleur posee mais un vrai creux
   (masque de bxMedaille, src/badges.js) : le trait qui deborde de la
   silhouette ne se voit pas, celui qui passe sur la piece laisse voir le metal.

   symboles.js ecrit desormais ces attributs lui-meme (P, MK). Ce script les
   pose dans les fichiers deja produits, symboles.json et
   src/badges-medailles.json, sans refaire tourner la fabrique (elle demande
   les icones Phosphor et fontkit, absents du depot). Il peut etre relance
   sans risque : un groupe deja traite n'est pas retouche.

   Usage : node design/badges/contours.js            (ecrit les deux fichiers)
           node design/badges/contours.js --verifier (dit seulement ce qui manque) */
const fs = require("fs"), path = require("path");
/* Epaisseur visible du trait, dans le repere de la piece (boite de 45) :
   le trait pose en fait le double, sa moitie interieure est sous l'aplat. */
const VISIBLE = 1.4;
const TRAIT = ' stroke="var(--oeil)" stroke-width="' + (2 * VISIBLE) + '" stroke-linejoin="round" paint-order="stroke"';
/* Un groupe de piece tel que P() et MK() l'ecrivent : le repere 45 -> 48. */
const GROUPE = /<g fill="currentColor"( transform="[^"]*translate\(-24 -24\) scale\(1\.0667\)">)((?:<(?:path|circle)[^>]*\/>)+)<\/g>/g;
const DEJA = /<g fill="currentColor" stroke="var\(--oeil\)"[^>]*translate\(-24 -24\) scale\(1\.0667\)">/g;
function contours(svg) {
  return svg.replace(GROUPE, (m, repere, formes) =>
    '<g fill="currentColor"' + TRAIT + repere + formes.replace(/style="fill:var\(--oeil\)"/g, 'style="fill:var(--oeil);stroke:none"') + "</g>");
}
/* Pour mesurer un symbole (ajuster.js, verif-contacts.js) : la silhouette seule,
   sans la moitie de trait qui deborde et que le masque de la medaille efface. */
const sansContours = svg => svg.split(TRAIT).join("");
const compte = (svg, re) => (svg.match(re) || []).length;
module.exports = { contours, sansContours, TRAIT, VISIBLE, GROUPE, DEJA };

if (require.main === module) {
  const verifier = process.argv.includes("--verifier");
  const SYM = path.join(__dirname, "symboles.json"), MED = path.join(__dirname, "..", "..", "src", "badges-medailles.json");
  const S = JSON.parse(fs.readFileSync(SYM, "utf8")), M = JSON.parse(fs.readFileSync(MED, "utf8"));
  let a = 0, b = 0, groupes = 0;
  for (const k in S) { const n = contours(S[k].s); if (n !== S[k].s) { a++; S[k].s = n; } }
  for (const k in M) {
    if (!Array.isArray(M[k])) continue;
    const n = contours(M[k][1]); if (n !== M[k][1]) { b++; M[k][1] = n; }
    groupes += compte(M[k][1], DEJA);
  }
  console.log((verifier ? "a traiter" : "traites") + " : " + a + " symboles, " + b + " medailles ; " + groupes + " pieces a contours dans les medailles");
  if (verifier) process.exit(a || b ? 1 : 0);
  fs.writeFileSync(SYM, JSON.stringify(S));
  fs.writeFileSync(MED, JSON.stringify(M));
}
