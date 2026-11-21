#!/usr/bin/env node
/* Lance toutes les verifications de chang64 et affiche un bilan.

   Usage :
     node build_site.js        (obligatoire : les tests lisent site/)
     node run_tests.js

   Plus vite, plusieurs fichiers de tests a la fois (2026-11-21) :
     node run_tests.js --ensemble=6        (ou le lanceur suite_complete.cmd)
   Les fichiers sont independants (aucun fichier ni port partage), on peut donc
   en lancer plusieurs en meme temps. Mesure sur la machine d'Alexandre (4
   coeurs, 8 fils), meme site construit, meme bilan de 4 563 verifications :
   un par un 46 min, a 4 19 min, a 6 10 min. Au-dela de 6 on ne gagne plus
   rien : check_banque_exercices dure a lui seul 10 min quand la machine est
   chargee. Le journal garde le meme ordre et le meme bilan. Quelques tests lisent l'ecran
   apres une courte attente et peuvent echouer quand la machine est chargee :
   tout fichier en echec est donc RELANCE SEUL a la fin, et c'est ce second
   passage qui compte. Un vrai defaut echoue les deux fois.

   Facultatif, pour la suite de non-regression :
     CHANG64_BASELINE=/chemin/vers/le/site/en/ligne node run_tests.js
   Elle compare alors le site genere a celui deja publie et signale toute page
   qui disparaitrait sans redirection. Sans cette variable, elle est ignoree.
*/
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const HERE = __dirname;
if (!fs.existsSync(path.join(HERE, "site", "index.html"))) {
  console.error("Le site n'est pas construit. Lance d'abord : node build_site.js");
  process.exit(1);
}

/* Combien de fichiers a la fois : 1 par defaut (l'un apres l'autre). */
const demande = (process.argv.find(a => /^--ensemble=/.test(a)) || "").split("=")[1] || process.env.CHANG64_ENSEMBLE || "1";
const ENSEMBLE = Math.max(1, Math.min(8, parseInt(demande, 10) || 1));

/* Les suites d'origine du projet, au format "  ok  " / " FAIL ". */
const SUITES = fs.readdirSync(HERE)
  .filter(f => /^(uitest|sitetest|i18ntest|banniertest).*\.js$/.test(f))
  .sort();

/* Les suites de verification, au format "N OK, N FAIL". */
const CHECKS = fs.existsSync(path.join(HERE, "tests"))
  ? fs.readdirSync(path.join(HERE, "tests")).filter(f => f.endsWith(".js")).sort()
  : [];

/* 15 minutes par suite : depuis la fusion du 2026-10-22 (108 868 exercices),
   check_banque_exercices.js prend a lui seul 7 min 30. A 5 minutes, il etait
   coupe et compte comme plantage alors qu'il passait. */
function run(file) {
  return new Promise(fini => {
    execFile("node", [file], { cwd: HERE, encoding: "utf8", timeout: 900000, maxBuffer: 64 * 1024 * 1024, windowsHide: true },
      (e, stdout, stderr) => fini((stdout || "") + (stderr || "")));
  });
}

/* Le verdict d'un fichier de tests/ : ses lignes du journal et son decompte. */
function jugeCheck(f, out) {
  const nom = f.replace(/^check_|\.js$/g, "");
  const m = out.match(/(\d+) OK, (\d+) FAIL/);
  if (!m) return { ok: 0, ko: 0, plantage: "tests/" + f, mauvais: true, lignes: ["  " + f.padEnd(42) + "AUCUN RESULTAT"] };
  /* Une suite peut se sauter faute de point de comparaison, et le dire. Ce
     n'est ni un succes ni un plantage : on l'affiche a part pour qu'elle
     reste visible sans polluer le decompte. */
  if (/\(ignore\)/.test(out)) return { ok: 0, ko: 0, mauvais: false, lignes: ["  " + nom.padEnd(42) + "  ignore"] };
  const lignes = ["  " + nom.padEnd(42) + String(m[1]).padStart(4) + " ok" + (+m[2] ? "   " + m[2] + " FAIL" : "")];
  if (+m[2]) for (const l of out.split("\n").filter(l => /FAIL/.test(l))) lignes.push("      " + l.trim());
  return { ok: +m[1], ko: +m[2], mauvais: +m[2] > 0, lignes };
}

/* Le verdict d'une suite d'origine. */
function jugeSuite(f, out) {
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
  const plantage = crash || (narratif && !aTourne) ? f : "";
  const ligne = "  " + f.replace(/\.js$/, "").padEnd(42) +
    (ok ? String(ok).padStart(4) + " ok" : (narratif && aTourne ? "  narratif, JS propre" : "       ")) +
    (ko + ech ? "   " + (ko + ech) + " FAIL" : "") +
    (crash ? "   PLANTAGE" : (narratif && !aTourne ? "   MUETTE, a verifier" : ""));
  return { ok, ko: ko + ech, plantage, mauvais: ko + ech > 0 || !!plantage, lignes: [ligne] };
}

const TACHES = [
  ...CHECKS.map(f => ({ f, fichier: path.join("tests", f), juge: jugeCheck, titre: "VERIFICATIONS" })),
  ...SUITES.map(f => ({ f, fichier: f, juge: jugeSuite, titre: "SUITES D'ORIGINE" }))
];

/* Les durees du passage precedent, pour lancer les fichiers les plus longs en
   premier quand on en lance plusieurs a la fois (sinon le plus long, lance en
   dernier, ferait attendre tout le monde). Simple aide : sans ce fichier,
   l'ordre est celui de l'alphabet, check_banque_exercices en tete. */
const DUREES = path.join(os.tmpdir(), "chang64-durees-tests.json");
let durees = {};
try { durees = JSON.parse(fs.readFileSync(DUREES, "utf8")); } catch (e) {}
if (!Object.keys(durees).length) durees = { "check_banque_exercices.js": 450000 };

(async () => {
  let titre = "", suivant = 0;
  /* Le journal garde l'ordre habituel : une ligne ne sort que lorsque toutes
     celles d'avant sont sorties. */
  function afficher() {
    while (suivant < TACHES.length && TACHES[suivant].verdict) {
      const t = TACHES[suivant++];
      if (t.titre !== titre) { titre = t.titre; console.log("\n" + titre + "\n"); }
      if (ENSEMBLE > 1 && t.verdict.mauvais) console.log("  " + t.f.replace(/^check_|\.js$/g, "").padEnd(42) + "  a relancer seul");
      else for (const l of t.verdict.lignes) console.log(l);
    }
  }
  if (ENSEMBLE > 1) console.log("\n(" + ENSEMBLE + " fichiers de tests a la fois ; tout echec est relance seul a la fin)");

  const file = ENSEMBLE > 1
    ? TACHES.slice().sort((a, b) => (durees[b.f] || 0) - (durees[a.f] || 0))
    : TACHES.slice();
  async function ouvrier() {
    for (let t = file.shift(); t; t = file.shift()) {
      const debut = Date.now();
      t.verdict = t.juge(t.f, await run(t.fichier));
      durees[t.f] = Date.now() - debut;
      afficher();
    }
  }
  await Promise.all(Array.from({ length: ENSEMBLE }, ouvrier));
  try { fs.writeFileSync(DUREES, JSON.stringify(durees)); } catch (e) {}

  /* Second passage, un fichier a la fois, pour ce qui a echoue pendant que la
     machine etait chargee. C'est lui qui compte. */
  const relances = ENSEMBLE > 1 ? TACHES.filter(t => t.verdict.mauvais) : [];
  if (relances.length) {
    console.log("\nRELANCES SEULS\n");
    for (const t of relances) {
      t.verdict = t.juge(t.f, await run(t.fichier));
      for (const l of t.verdict.lignes) console.log(l);
    }
  }

  let totalOk = 0, totalKo = 0;
  const plantages = [];
  for (const t of TACHES) {
    totalOk += t.verdict.ok; totalKo += t.verdict.ko;
    if (t.verdict.plantage) plantages.push(t.verdict.plantage);
  }
  console.log("\n" + "-".repeat(58));
  console.log("  " + totalOk + " verifications passees, " + totalKo + " en echec" +
    (plantages.length ? ", " + plantages.length + " plantage(s) : " + plantages.join(", ") : ""));
  if (relances.length) console.log("  " + relances.length + " fichier(s) relance(s) seul(s) : " + relances.map(t => t.f).join(", "));
  console.log("-".repeat(58) + "\n");
  process.exit(totalKo || plantages.length ? 1 : 0);
})();
