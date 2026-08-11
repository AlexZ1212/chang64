/* Verification automatique de chang64.
   Lancement : node tests/check_largeur_page.js

   Toute la page debordait horizontalement en francais, pas en anglais : les
   libelles francais sont plus longs (Accueil, S'entrainer, Entre amis contre
   Home, Train, Friends). L'echiquier et les pendules se retrouvaient coupes
   a droite.

   La cause n'etait pas l'echiquier mais une propriete du modele de boite :
   un element flexible ou de grille a min-width:auto par defaut, donc il
   refuse de devenir plus etroit que son contenu et impose sa largeur a tous
   ses parents, jusqu'a la page entiere. Trente-huit conteneurs etaient dans
   ce cas.

   Consequence collaterale : les overflow-x:auto poses ici et la ne se
   declenchaient jamais, puisque min-width l'emporte sur max-width en CSS.
*/
const fs = require("fs");
const path = require("path");
const SITE = path.join(__dirname, "..", "site");
const SRC = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(SITE, "index.html"), "utf8");
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || "";

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };

console.log("\n--- Le garde-fou est en place ---");
/* La regle exclut les elements interactifs : appliquee aux boutons, elle les
   laissait devenir plus etroits que leur libelle, et le texte debordait de la
   pastille d'onglet. Un bouton garde la largeur de son contenu, c'est son
   parent qui cede. */
T("les conteneurs peuvent se retrecir", /\.wrap \*:not\(button\)[^{]*\{min-width:0\}/.test(css));
T("les boutons gardent leur largeur", /:not\(button\)/.test(css));
T("les champs aussi", /:not\(input\)/.test(css));
T("les rangees a defilement peuvent se retrecir", /\.tabs,\.tc-cats\{flex:1 1 100%;min-width:0\}/.test(css));
T("images et tableaux plafonnes", /\.wrap img,\.wrap svg,\.wrap table,\.wrap pre\{max-width:100%\}/.test(css));
T("filet au niveau de la page", /html\{overflow-x:hidden\}/.test(css));

console.log("\n--- Les elements larges restent plafonnes ---");
for (const [nom, rx] of [
  ["cadre de l'echiquier", /\.board-frame\{[^}]*max-width:100%/],
  ["echiquier", /\.board\{[^}]*max-width:100%/],
  ["pendule", /\.clock\{[^}]*max-width:100%/]
]) T(nom, rx.test(css));

console.log("\n--- Aucune largeur fixe superieure a l'ecran ---");
const fixes = [...css.matchAll(/([.#][\w-]+)[^{]*\{[^}]*(?<!max-)(?<!min-)width:\s*(\d{3,})px/g)]
  .map(m => ({ sel: m[1], px: +m[2] })).filter(x => x.px > 360);
T("aucune largeur fixe au-dessus de 360 px", fixes.length === 0,
  fixes.map(x => x.sel + " " + x.px + "px").join(", "));

console.log("\n--- Le francais est bien le cas le plus contraignant ---");
/* C'est ce qui explique que le defaut soit apparu dans une seule langue :
   les onglets francais reclament plus de place que la largeur d'un
   telephone, les anglais tiennent de justesse. */
const i18n = fs.readFileSync(path.join(SRC, "i18n.js"), "utf8");
const tr = k => { const m = i18n.match(new RegExp('"' + k + '":"([^"]*)"')); return m ? m[1] : k; };
const EN = ["Home", "Play", "Puzzles", "Train", "Friends", "Watch"];
const FR = EN.map(tr);
const largeur = l => Math.round(l.reduce((s, m) => s + m.length * 6.8 + 22, 0) + (l.length - 1) * 3 + 8);
const dispo = 390 - 28;
console.log("  anglais  : " + largeur(EN) + " px");
console.log("  francais : " + largeur(FR) + " px");
console.log("  disponible a 390 px : " + dispo + " px");
T("le francais depasse la place disponible", largeur(FR) > dispo,
  "c'est pourquoi le garde-fou est indispensable, pas cosmetique");

console.log("\n--- Les conteneurs a defilement sont operants ---");
/* Un overflow-x:auto sur un element qui ne peut pas se retrecir ne se
   declenche jamais : il lui faut min-width:0, apporte ici par .wrap *. */
const scrollables = [...css.matchAll(/([.#][\w -]+)\{[^}]*overflow-x:\s*auto[^}]*\}/g)].map(m => m[1].trim());
console.log("  conteneurs a defilement : " + scrollables.join(", "));
T("au moins un conteneur a defilement", scrollables.length > 0);
T("les rangees a defilement sont contraintes en propre", /\.tabs\{[^}]*min-width:0/.test(css));

console.log("\n--- Rien n'a ete casse ---");
for (const id of ["board", "clockTop", "clockBottom", "appLayout", "tcCats", "tcCats2"])
  T(id + " toujours present", html.includes('id="' + id + '"'));

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
