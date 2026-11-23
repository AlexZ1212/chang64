/* Verification automatique de chang64.
   Lancement : node tests/check_touche_pas_clique.js
   Le site doit avoir ete construit au prealable : node build_site.js

   « Touche », pas « Clique » (2026-11-23, choix d'Alexandre par QCM). Sur
   telephone on ne clique pas : trois textes disaient « Clique sur une
   piece… », « cliquer un maximum de cases nommees », « clique la case
   nommee ». Ils reprennent le mot que le site emploie deja partout ailleurs
   (« Touche un jour en surbrillance », anglais « Tap »), dans les 10 langues.
   Un seul texte garde « Clique » : l'installation sur ordinateur (« Clique sur
   l'icone d'installation, a droite de la barre d'adresse »), qui ne s'affiche
   que sous le titre « Sur ordinateur ». */
const fs = require("fs"), path = require("path");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const SRC = path.join(__dirname, ".."), SITE = path.join(SRC, "site");
const { CODES } = require("../langues/registre.js");

const CLES = [
  "Each piece moves in its own way. Tap a piece to see where it can go.",
  "Thirty seconds to tap as many named squares as you can. Knowing the board by name makes everything else faster.",
  "Thirty seconds | tap the square that is named"
];
const ANCIENNES = [
  "Each piece moves in its own way. Click a piece to see where it can go.",
  "Thirty seconds to click as many named squares as you can. Knowing the board by name makes everything else faster.",
  "Thirty seconds | click the square that is named"
];
const ORDINATEUR = "Click the install icon at the right of the address bar.";
/* Le mot du clic dans chaque langue, et celui du toucher attendu a sa place. */
const CLIC = { fr: /cliqu/i, es: /\bclic\b/i, pt: /cliqu|clicar/i, de: /klick/i, ru: /щ[её]лк|клик/i, it: /\bclic/i, tr: /\btıkla/i, pl: /klikn/i, id: /\bklik|mengklik/i };
const TOUCHER = { fr: /touche/i, es: /\btoca/i, pt: /\btoqu|\btocar/i, de: /tipp/i, ru: /наж/i, it: /\btocc/i, tr: /dokun/i, pl: /dotkn/i, id: /ketuk|mengetuk/i };

console.log("--- Le code et le gabarit ---");
const sources = ["ui.js", "ui2.js", "ui3.js", "template.html"].map(f => fs.readFileSync(path.join(SRC, f), "utf8")).join("\n");
T("les trois phrases anglaises disent « tap »", CLES.every(k => sources.includes(k)), CLES.filter(k => !sources.includes(k)).join(" | "));
T("plus aucune des trois anciennes phrases", ANCIENNES.every(k => !sources.includes(k)));

console.log("--- Les 9 traductions ---");
for (const l of CODES.filter(c => c !== "en")) {
  const d = require(path.join(SRC, "langues", l, "app.js"));
  T(l + " : les trois phrases sont traduites, les anciennes cles ont disparu", CLES.every(k => typeof d[k] === "string" && d[k] !== k) && ANCIENNES.every(k => !(k in d)));
  T(l + " : chacune emploie le mot du toucher", CLES.every(k => TOUCHER[l].test(d[k] || "")), CLES.map(k => d[k]).filter(v => !TOUCHER[l].test(v || "")).join(" | "));
  const restes = Object.entries(d).filter(([k, v]) => k !== ORDINATEUR && typeof v === "string" && k.charAt(0) !== "@" && CLIC[l].test(v)).map(([, v]) => v.slice(0, 60));
  /* Le russe dit « Нажми » (appuie) meme pour l'installation sur ordinateur. */
  T(l + " : le mot du clic ne reste, au plus, que pour l'installation sur ordinateur", restes.length === 0 && typeof d[ORDINATEUR] === "string", restes.join(" | "));
}

console.log("--- Le site construit ---");
for (const l of ["en", "fr", "de"]) {
  const h = fs.readFileSync(path.join(SITE, l === "en" ? "" : l, "index.html"), "utf8");
  T(l + " : la page ne porte plus les anciennes phrases", ANCIENNES.every(k => !h.includes(k)));
  T(l + " : elle porte les nouvelles", CLES.every(k => h.includes(k) || h.includes(JSON.stringify(k).slice(1, -1))));
}

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
