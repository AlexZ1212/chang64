/* Verification automatique de chang64.
   Lancement : node tests/check_contraste_texte.js

   Les pages de contenu sont sur fond clair. Des couleurs venues du theme
   sombre y avaient ete posees en dur, notamment un vert pale #93A99A qui
   donnait 1,98:1 sur le fond de page, pour un minimum de 4,5:1. C'etait le
   cas des legendes de diagramme, du nom anglais des ouvertures et des
   compteurs par theme dans la liste des exercices.

   Regle : sur ces pages, une couleur de texte doit venir des jetons du theme
   clair, jamais d'une valeur ecrite dans le HTML. Les jetons sont mesures ici
   pour verifier qu'ils passent effectivement.
*/
const fs = require("fs");
const path = require("path");
const SITE = path.join(__dirname, "..", "site");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };

const lum = h => {
  const c = h.replace("#", "").match(/../g).map(x => {
    let v = parseInt(x, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/* Jetons lus dans la page, pas recopies de memoire. */
const page = fs.readFileSync(SITE + "/fr/ouvertures/defense-sicilienne.html", "utf8");
const tok = n => { const m = page.match(new RegExp("--" + n + ":\\s*(#[0-9A-Fa-f]{6})")); return m ? m[1] : null; };
const INK = tok("ink"), SLATE = tok("slate"), SAGE = tok("sage"), CHALK = tok("chalk"), BRASS = tok("brass");

console.log("\n--- Le vert pale du theme sombre a disparu ---");
let restants = [];
for (const dir of ["/fr/ouvertures", "/openings", "/fr/exercices", "/puzzles", "/fr/lexique", "/glossary"]) {
  if (!fs.existsSync(SITE + dir)) continue;
  for (const f of fs.readdirSync(SITE + dir).filter(x => x.endsWith(".html")).slice(0, 40))
    if (fs.readFileSync(SITE + dir + "/" + f, "utf8").includes("93A99A")) restants.push(dir + "/" + f);
}
T("aucune page ne porte #93A99A", restants.length === 0, restants.slice(0, 3).join(", "));

console.log("\n--- Aucune couleur de texte ecrite en dur ---");
/* Une couleur posee dans un attribut style echappe au theme : si le fond
   change, elle ne suit pas. */
let enDur = [];
for (const f of ["/fr/ouvertures/defense-sicilienne.html", "/openings/sicilian-defense.html",
                 "/fr/exercices/index.html", "/fr/lexique/clouage.html"]) {
  if (!fs.existsSync(SITE + f)) continue;
  const h = fs.readFileSync(SITE + f, "utf8");
  const m = [...h.matchAll(/style="[^"]*color:\s*(#[0-9A-Fa-f]{3,6})/g)].map(x => x[1]);
  if (m.length) enDur.push(f + " (" + [...new Set(m)].join(",") + ")");
}
T("aucune couleur en dur dans les styles", enDur.length === 0, enDur.slice(0, 3).join(" | "));

console.log("\n--- Les jetons du theme clair passent le seuil ---");
for (const [nom, couleur, fond, seuil] of [
  ["texte secondaire sur fond de page", SAGE, INK, 4.5],
  ["texte secondaire sur panneau", SAGE, SLATE, 4.5],
  ["texte principal sur fond de page", CHALK, INK, 4.5],
  ["texte principal sur panneau", CHALK, SLATE, 4.5],
  ["laiton sur fond de page", BRASS, INK, 4.5]
]) {
  const r = ratio(couleur, fond);
  T(nom + " : " + r.toFixed(2) + ":1", r >= seuil, couleur + " sur " + fond);
}

console.log("\n--- Le bouton d'action reste lisible ---");
const rCta = ratio("#ffffff", BRASS);
T("texte blanc sur laiton : " + rCta.toFixed(2) + ":1", rCta >= 4.5);

console.log("\n--- Les legendes de diagramme suivent le theme ---");
T("legende en jeton, pas en dur", /Position après[^<]*<\/p>/.test(page) === false || /color:var\(--sage\)[^>]*>Position après/.test(page),
  (page.match(/<p[^>]*>Position après[^<]*/) || [""])[0].slice(0, 60));

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
