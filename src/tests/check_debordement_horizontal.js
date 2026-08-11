/* Verification automatique de chang64.
   Lancement : node tests/check_debordement_horizontal.js

   Un debordement horizontal rendait l'echiquier et les pendules coupes a
   droite sur telephone, mais uniquement en francais. La cause n'etait pas
   l'echiquier : les boutons d'onglets sont en white-space:nowrap, donc la
   largeur minimale de la rangee vaut la somme de leurs textes. Comme .tabs
   est un element flexible de l'entete, son min-width:auto par defaut imposait
   cette largeur a toute la page. Et en CSS min-width l'emporte sur max-width,
   donc le max-width:100% pose sur .tabs ne servait a rien.

   En anglais la rangee depassait d'une dizaine de pixels, en francais de plus
   de cent : d'ou un defaut spectaculaire dans une langue et invisible dans
   l'autre.
*/
const fs = require("fs");
const path = require("path");
const SITE = path.join(__dirname, "..", "site");
const SRC = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(SITE, "index.html"), "utf8");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };

console.log("\n--- Les contraintes qui empechent le debordement ---");
T("min-width:0 sur la rangee d'onglets", /\.tabs\{[^}]*min-width:0/.test(html));
T("entete non elargissable par ses enfants", /header\{min-width:0\}/.test(html));
T("enfants de l'entete contraints", /header>\*\{min-width:0\}/.test(html));
T("conteneur principal contraint", /\.wrap\{[^}]*min-width:0/.test(html));
T("filet au niveau de la page", /html\{overflow-x:hidden\}/.test(html));

console.log("\n--- Les elements larges sont plafonnes ---");
for (const [sel, rx] of [
  ["board-frame", /\.board-frame\{[^}]*max-width:100%/],
  ["board", /\.board\{[^}]*max-width:100%/],
  ["clock", /\.clock\{[^}]*max-width:100%/]
]) T(sel + " plafonne", rx.test(html));
T("box-sizing sur le cadre de l'echiquier", /\.board-frame\{[^}]*box-sizing:border-box/.test(html));

console.log("\n--- La rangee d'onglets peut defiler d'elle-meme ---");
T("defilement horizontal autorise", /\.tabs\{[^}]*overflow-x:auto/.test(html));
T("barre de defilement masquee", /scrollbar-width:none/.test(html));

/* Largeur minimale reelle de la rangee, dans les deux langues. C'est ce
   calcul qui explique pourquoi seul le francais etait touche. */
const i18n = fs.readFileSync(path.join(SRC, "i18n.js"), "utf8");
const tr = k => { const m = i18n.match(new RegExp('"' + k + '":"([^"]*)"')); return m ? m[1] : k; };
const EN = ["Home", "Play", "Puzzles", "Train", "Friends", "Watch"];
const FR = EN.map(tr);
const largeur = l => Math.round(l.reduce((s, m) => s + m.length * 6.8 + 22, 0) + (l.length - 1) * 3 + 8);
const dispo = 390 - 28;

console.log("\n--- Largeur imposee par les onglets a 390 px ---");
console.log("  anglais  : " + largeur(EN) + " px   (" + EN.join(", ") + ")");
console.log("  francais : " + largeur(FR) + " px   (" + FR.join(", ") + ")");
console.log("  place disponible : " + dispo + " px");
T("le francais depasse bien la place disponible", largeur(FR) > dispo,
  "c'est pourquoi min-width:0 est indispensable, pas cosmetique");
T("les libelles francais sont plus longs", largeur(FR) > largeur(EN),
  largeur(FR) + " vs " + largeur(EN));

console.log("\n--- Aucune largeur fixe ne peut forcer la page ---");
const fixes = [...html.matchAll(/([.#][\w-]+)\{[^}]*(?<!max-)(?<!min-)width:\s*(\d{3,})px/g)]
  .map(m => ({ sel: m[1], px: +m[2] })).filter(x => x.px > 360);
T("aucune largeur fixe superieure a 360 px", fixes.length === 0,
  fixes.map(x => x.sel + " " + x.px + "px").join(", "));

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
