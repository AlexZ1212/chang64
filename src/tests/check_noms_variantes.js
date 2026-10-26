/* Verification automatique de chang64.
   Lancement : node tests/check_noms_variantes.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Noms de variantes traduits (2026-10-26). Les tableaux des pages
   d'ouvertures listaient ~1 057 noms de variantes Lichess restes en anglais
   en espagnol, portugais, allemand et russe ; le francais passait par une
   substitution mot a mot qui donnait "Czerniak Attaque". Chaque langue a
   maintenant un dictionnaire des morceaux de nom (langues/<code>/variantes.js).
   Verifie : tout morceau affiche est traduit dans chaque langue, sans terme
   anglais restant, en cyrillique pour le russe ; les pages construites
   montrent les noms traduits ; le build ne releve aucun manque. */
const path = require("path"), fs = require("fs");
const SRC = path.join(__dirname, ".."), SITE = path.join(SRC, "site");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };

/* Les morceaux affiches : 40 lignes au plus par famille, les plus courtes,
   comme build_site.js. */
const OP = require(path.join(SRC, "openings.json"));
const familles = new Map();
for (const l of OP.o.split("\n").filter(Boolean)) {
  const p = l.split("\t"), f = OP.f[+p[1]];
  (familles.get(f) || familles.set(f, []).get(f)).push({ moves: p[0], variation: p[2] });
}
const morceaux = new Set();
for (const list of familles.values())
  for (const v of list.slice().sort((a, b) => a.moves.length - b.moves.length).slice(0, 40))
    if (v.variation) for (const m of v.variation.split(", ")) morceaux.add(m);
T("des morceaux a traduire (" + morceaux.size + ")", morceaux.size > 900);

/* "System" n'y figure pas : c'est aussi le mot allemand. */
const ANGLAIS = /\b(Variation|Variations|Attack|Defense|Countergambit|Counterattack|Accepted|Declined|Deferred|Opening|Trap)\b/;
for (const lang of ["fr", "es", "pt", "de", "ru"]) {
  console.log("\n--- " + lang + " ---");
  const d = require(path.join(SRC, "langues", lang, "variantes.js"));
  const absents = [...morceaux].filter(m => typeof d[m] !== "string" || !d[m]);
  T("chaque morceau affiche est traduit", !absents.length, absents.length + " : " + absents.slice(0, 4).join(" | "));
  const anglais = Object.entries(d).filter(([k, v]) => ANGLAIS.test(v) && !/French Connection/.test(v));
  T("aucun terme anglais restant", !anglais.length, anglais.slice(0, 4).map(e => e.join(" => ")).join(" | "));
  if (lang === "ru") {
    const latin = Object.values(d).filter(v => !/[а-яё]/i.test(v));
    T("tout en cyrillique (sauf les coups des \"с Nf3\")", !latin.length, latin.slice(0, 4).join(" | "));
  }
}

console.log("\n--- Pages construites ---");
const lire = f => fs.existsSync(path.join(SITE, f)) ? fs.readFileSync(path.join(SITE, f), "utf8") : "";
const fr = lire("fr/ouvertures/defense-sicilienne.html");
T("francais : \"Attaque Czerniak\"", fr.includes("<td>Attaque Czerniak</td>"));
T("francais : plus de \"Czerniak Attaque\"", fr && !fr.includes("Czerniak Attaque"));
T("espagnol : \"Ataque Czerniak\"", lire("es/aperturas/defensa-siciliana.html").includes("<td>Ataque Czerniak</td>"));
T("allemand : \"Czerniak-Angriff\"", lire("de/eroeffnungen/sizilianische-verteidigung.html").includes("<td>Czerniak-Angriff</td>"));
T("russe : \"Атака Черняка\"", lire("ru/openings/sicilian-defense.html").includes("<td>Атака Черняка</td>"));
let manq = {};
try { manq = JSON.parse(fs.readFileSync(path.join(SRC, "langues", "manquants.json"), "utf8")); } catch (e) {}
const manquantes = Object.values(manq).flat().filter(x => String(x).startsWith("variantes:"));
T("le build ne releve aucun morceau manquant", !manquantes.length, manquantes.slice(0, 4).join(" | "));

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
