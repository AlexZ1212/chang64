/* Verification automatique de chang64.
   Lancement : node tests/check_contours_pieces.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ajustements d'Alexandre du 22/11/2026 :
   - les pieces des pictogrammes (cartes de Jouer, Resoudre, Explorer) et des
     medailles etaient des silhouettes d'un seul bloc ; chaque forme de la
     piece porte desormais un trait de la couleur des jours, peint sous son
     aplat, qui laisse voir le socle, le col et la tete comme sur l'echiquier ;
   - sur une medaille, les jours du dessin sont de vrais creux (le symbole sert
     de masque) et non plus une couleur unie posee sur le degrade : le badge
     « Tondu » montrait une tache claire autour de la tete du mouton ;
   - le triangle du picto « Pieges d'ouverture » touchait le bord droit de son
     cadre et y etait rogne. */
const path = require("path"), fs = require("fs");
const { ouvrir, SITE } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const compte = (s, re) => (s.match(re) || []).length;
const REPERE = /translate\(-24 -24\) scale\(1\.0667\)/g;

(async () => {
  console.log("--- Pictogrammes des cartes ---");
  const { PICTOS } = require("../pictos_build.js");
  const tous = Object.values(PICTOS).join("");
  const AVEC = ["ordinateur", "ami", "enligne", "exercices", "finales", "motif", "pieges", "biblio"];
  T("huit pictos portent une piece", AVEC.every(n => PICTOS[n].includes("scale(1.0667)")), AVEC.filter(n => !/scale\(1\.0667\)/.test(PICTOS[n])).join());
  const groupes = compte(tous, REPERE), traits = compte(tous, /<g fill="[^"]*" stroke="[^"]*" stroke-width="[\d.]+" stroke-linejoin="round" paint-order="stroke" transform="[^"]*translate\(-24 -24\) scale\(1\.0667\)">/g);
  T("chaque piece d'un picto a ses contours (" + groupes + " pieces)", groupes === 9 && traits === groupes, traits + " sur " + groupes);
  T("le trait a la couleur des jours, la piece celle du theme", /<g fill="currentColor" stroke="var\(--oeil\)"/.test(PICTOS.ordinateur) && !/#[0-9a-fA-F]{3,6}/.test(tous));
  T("l'oeil et le naseau du cavalier n'ont pas de trait", compte(PICTOS.ordinateur, /style="fill:var\(--oeil\);stroke:none"/g) === 2);
  T("piece en creux (Bibliotheque) : les deux couleurs s'echangent, l'oeil se voit", /<g fill="var\(--oeil\)" stroke="currentColor"/.test(PICTOS.biblio) && compte(PICTOS.biblio, /style="fill:currentColor;stroke:none"/g) === 2);
  const epais = [...new Set((tous.match(/stroke-width="([\d.]+)" stroke-linejoin="round" paint-order="stroke"/g) || []))];
  T("une seule epaisseur de contour partout", epais.length === 1, epais.join(" | "));

  console.log("--- Picto « Pieges d'ouverture » ---");
  {
    /* Le triangle : sommets arrondis, etendue ± 19,6 (largeur) et -18,9 (haut) dans sa boite. */
    const m = /^<g transform="scale\(([\d.]+)\)">[\s\S]*<g transform="translate\(([\d.]+) -([\d.]+)\) scale\(([\d.]+)\)"><path fill="currentColor" d="M-2\.900 -17\.200/.exec(PICTOS.pieges);
    const droite = m ? (+m[2] + 19.6 * +m[4]) * +m[1] : 99, haut = m ? (+m[3] + 18.9 * +m[4]) * +m[1] : 99;
    T("le triangle tient dans le cadre de 24 avec une marge", !!m && droite <= 23 && haut <= 23, "droite " + droite.toFixed(2) + ", haut " + haut.toFixed(2));
    T("il ne touche pas le fou", !!m && (+m[2] - 19.6 * +m[4]) * +m[1] > 2.5, m && ((+m[2] - 19.6 * +m[4]) * +m[1]).toFixed(2));
  }

  console.log("--- Medailles : les pieces ---");
  const M = JSON.parse(fs.readFileSync(path.join(SITE, "data", "badges-medailles.json"), "utf8"));
  const ids = Object.keys(M).filter(k => Array.isArray(M[k]));
  const C = require("../../design/badges/contours.js");
  const avecPiece = ids.filter(k => /scale\(1\.0667\)/.test(M[k][1]));
  const sansTrait = avecPiece.filter(k => compte(M[k][1], REPERE) !== compte(M[k][1], C.DEJA));
  T(avecPiece.length + " medailles portent une piece, toutes ont leurs contours", avecPiece.length >= 80 && sansTrait.length === 0, sansTrait.join(","));
  T("rien ne reste a traiter (contours.js)", ids.every(k => C.contours(M[k][1]) === M[k][1]));
  T("meme trait que dans les pictos", epais.length === 1 && C.TRAIT.includes(epais[0]) && tous.includes(C.TRAIT), C.TRAIT);
  const yeux = ids.filter(k => /<g fill="currentColor" stroke[^>]*>(?:<(?:path|circle)[^>]*\/>)*<path[^>]*style="fill:var\(--oeil\)"\/>/.test(M[k][1]));
  T("l'oeil du cavalier n'a de trait dans aucune medaille", yeux.length === 0 && /style="fill:var\(--oeil\);stroke:none"/.test(M.theme_knight_fork[1]), yeux.join(","));
  T("aucune medaille n'a de detail a demi transparent", ids.every(k => !/opacity/.test(M[k][1])));
  const source = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "design", "badges", "symboles.json"), "utf8"));
  const ecarts = ids.filter(k => source[k] && source[k].s !== M[k][1]);
  T("la source des dessins (symboles.json) dit la meme chose", ids.filter(k => source[k]).length > 250 && ecarts.length === 0, ecarts.slice(0, 6).join(","));
  const fabrique = fs.readFileSync(path.join(__dirname, "..", "..", "design", "badges", "symboles.js"), "utf8");
  T("la fabrique ecrit elle-meme les contours (P et MK)", compte(fabrique, /<g fill="currentColor"\$\{TRAIT\} transform=/g) === 2 && /style="fill:var\(--oeil\);stroke:none"/.test(fabrique));

  console.log("--- Medailles : de vrais creux ---");
  const w = await ouvrir("fr", { attente: 1500, fetch: true });
  await w.eval("bxCharger()"); await attendre(300);
  const d = w.document, boite = d.createElement("div");
  const dessin = (id, gagne) => { boite.innerHTML = w.eval("bxMedaille(" + JSON.stringify(id) + "," + gagne + ")"); return boite.firstChild; };
  let svg = dessin("lec_tondu", true), brut = boite.innerHTML;
  const masque = svg.querySelector("mask");
  T("la medaille porte un masque, le symbole est dedans", !!masque && masque.innerHTML.includes("M236.52,187.09") && /--oeil:\s*#000/.test(masque.innerHTML) && /color:\s*#fff/.test(masque.innerHTML));
  const graves = [...svg.querySelectorAll("rect.bx-grave,rect.bx-relief")];
  T("gravure et relief passent par ce masque", graves.length === 2 && graves.every(r => r.getAttribute("mask") === "url(#" + masque.id + ")"), graves.map(r => r.getAttribute("mask")).join());
  T("le symbole n'est dessine qu'une fois, dans le masque", compte(brut, /M236\.52,187\.09/g) === 1);
  T("plus aucun jour peint d'une couleur unie de la face", !/--oeil:\s*(#(?!000)|transparent)/.test(brut) && !brut.includes("--oeil:#C07A47"), (brut.match(/--oeil:[^;"]+/g) || []).join());
  T("la gravure garde la couleur du metal (bronze)", svg.querySelector("rect.bx-grave").getAttribute("fill") === "#4A2410");
  T("le relief clair est decale d'un demi-pixel", /translate\(0 \.9\)/.test(svg.querySelector("rect.bx-relief").getAttribute("transform")) && svg.querySelector("rect.bx-relief").getAttribute("fill") === "#fff");
  const autre = dessin("lec_tondu", true).querySelector("mask").id;
  T("deux medailles n'ont jamais le meme masque", autre !== masque.id && /^bxm\d+m$/.test(autre), masque.id + " / " + autre);
  svg = dessin("eg_kp", false);
  T("medaille pas encore gagnee : sombre, gravee par le meme masque, sans relief", svg.classList.contains("bx-ombre") && !svg.querySelector(".bx-relief") && svg.querySelector(".bx-grave").getAttribute("mask") === "url(#" + svg.querySelector("mask").id + ")");
  svg = dessin("inconnu_xyz", true);
  T("badge sans dessin : une medaille vide, sans erreur", !!svg && svg.querySelector("mask").textContent === "");
  T("le reflet de la medaille gagnee est toujours la", !!dessin("solved_1", true).querySelector(".bx-reflet"));
  w.close();

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
