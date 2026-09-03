#!/usr/bin/env node
/* Lance toutes les verifications de chang64 et affiche un bilan.

   Usage :
     node build_site.js        (obligatoire : les tests lisent site/)
     node run_tests.js

   Facultatif, pour la suite de non-regression :
     CHANG64_BASELINE=/chemin/vers/le/site/en/ligne node run_tests.js
   Elle compare alors le site genere a celui deja publie et signale toute page
   qui disparaitrait sans redirection. Sans cette variable, elle est ignoree.
*/
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
if (!fs.existsSync(path.join(HERE, "site", "index.html"))) {
  console.error("Le site n'est pas construit. Lance d'abord : node build_site.js");
  process.exit(1);
}

/* Les suites d'origine du projet, au format "  ok  " / " FAIL ". */
const SUITES = fs.readdirSync(HERE)
  .filter(f => /^(uitest|sitetest|i18ntest|banniertest).*\.js$/.test(f))
  .sort();

/* Les suites de verification, au format "N OK, N FAIL". */
const CHECKS = fs.existsSync(path.join(HERE, "tests"))
  ? fs.readdirSync(path.join(HERE, "tests")).filter(f => f.endsWith(".js")).sort()
  : [];

let totalOk = 0, totalKo = 0, plantages = [];

function run(file, cwd) {
  try {
    return execFileSync("node", [file], { cwd, encoding: "utf8", timeout: 300000, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    return (e.stdout || "") + (e.stderr || "");
  }
}

console.log("\nVERIFICATIONS\n");
for (const f of CHECKS) {
  const out = run(path.join("tests", f), HERE);
  const m = out.match(/(\d+) OK, (\d+) FAIL/);
  if (!m) { plantages.push("tests/" + f); console.log("  " + f.padEnd(42) + "AUCUN RESULTAT"); continue; }
  totalOk += +m[1]; totalKo += +m[2];
  console.log("  " + f.replace(/^check_|\.js$/g, "").padEnd(42) +
    String(m[1]).padStart(4) + " ok" + (+m[2] ? "   " + m[2] + " FAIL" : ""));
  if (+m[2]) for (const l of out.split("\n").filter(l => /FAIL/.test(l))) console.log("      " + l.trim());
}

console.log("\nSUITES D'ORIGINE\n");
for (const f of SUITES) {
  const out = run(f, HERE);
  const ok = (out.match(/ {2}ok /g) || []).length;
  const ko = (out.match(/^ *FAIL/gm) || []).length;
  const ech = (out.match(/ECHEC|ECART|DESYNC/g) || []).length;
  const crash = /TypeError|ReferenceError|SyntaxError|^Error:/m.test(out);
  /* Cinq suites ecrivent en clair plutot qu'en "ok"/"FAIL". Pour elles, la
     preuve qu'elles ont reellement tourne est la ligne finale sur les erreurs
     JS. Sans ce garde-fou, une suite muette passerait pour un succes, ce qui
     est exactement ce qui s'est produit pendant des mois. */
  const narratif = ok === 0 && !crash;
  const aTourne = /Erreurs JS[^\n]*aucune|Erreurs cumulées *: *aucune/.test(out);
  if (crash || (narratif && !aTourne)) plantages.push(f);
  totalOk += ok; totalKo += ko + ech;
  console.log("  " + f.replace(/\.js$/, "").padEnd(42) +
    (ok ? String(ok).padStart(4) + " ok" : (narratif && aTourne ? "  narratif, JS propre" : "       ")) +
    (ko + ech ? "   " + (ko + ech) + " FAIL" : "") +
    (crash ? "   PLANTAGE" : (narratif && !aTourne ? "   MUETTE, a verifier" : "")));
}

console.log("\n" + "-".repeat(58));
console.log("  " + totalOk + " verifications passees, " + totalKo + " en echec" +
  (plantages.length ? ", " + plantages.length + " plantage(s) : " + plantages.join(", ") : ""));
console.log("-".repeat(58) + "\n");
process.exit(totalKo || plantages.length ? 1 : 0);
