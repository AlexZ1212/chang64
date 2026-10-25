/* Verification automatique de chang64.
   Lancement : node tests/check_titre_et_nombres.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Deux defauts de l'application en francais, trouves en audit le
   2026-10-24 :
     - le titre de l'onglet restait "chang64 · play chess, solve tactics" ;
     - "108868 exercices" s'affichait sans separateur de milliers, deux fois
       sur l'accueil (texte de presentation et carte des exercices).
   Depuis le 2026-10-25, chaque langue a sa page (/, /fr/, /es/...) : on
   ouvre chacune et on relit le titre et les deux nombres, groupes selon la
   langue (108,868 / 108 868 / 108.868...). */
const path = require("path");
const fs = require("fs"), jd = require("jsdom");
const SITE = path.join(__dirname, "..", "site");
const { LANGUES } = require("../langues/registre.js");
const NP = require(path.join(__dirname, "..", "banque.js")).charger().length;
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const pageDe = l => fs.readFileSync(path.join(SITE, l.code === "en" ? "" : l.code, "index.html"), "utf8");

function ouvrir(l) {
  const dom = new jd.JSDOM(pageDe(l), { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com" + l.accueil,
    virtualConsole: new jd.VirtualConsole(),
    beforeParse(w) { w.fetch = () => Promise.resolve({ ok: false, status: 404 }); } });
  return dom.window;
}
const presentation = d => d.querySelector(".hero-lede p:last-child").textContent;
const compteur = d => d.getElementById("hCount").textContent;
/* Mots qui suivent le nombre dans le texte de presentation. */
const MOT = { en: " puzzles", fr: " exercices", es: " ejercicios", pt: " exercícios", de: " Zug für Zug", ru: " задач" };
const TITRE = { en: /play chess/, fr: /joue aux/, es: /juega al ajedrez/, pt: /jogue xadrez/, de: /Schach spielen/, ru: /играй в шахматы/ };

(async () => {
  console.log("\n--- Le nombre brut n'est plus affiche tel quel ---");
  const EN = NP.toLocaleString("en-US"), FR = NP.toLocaleString("fr-FR");
  const html = pageDe(LANGUES[0]), htmlFr = pageDe(LANGUES[1]);
  T("le HTML anglais groupe les milliers", html.includes(EN + " puzzles verified move by move"), EN);
  T("la traduction francaise groupe les milliers", htmlFr.includes(FR + " exercices v"), JSON.stringify(FR));
  T("hCount garde la valeur brute pour le script", new RegExp('id="hCount" data-nombre="' + NP + '"').test(html));

  for (const l of LANGUES) {
    console.log("\n--- Page " + l.accueil + " ---");
    const N = NP.toLocaleString(l.intl);
    const w = ouvrir(l); await attendre(1500);
    const d = w.document;
    T("langue du document " + l.html, d.documentElement.lang === l.html, d.documentElement.lang);
    T("titre de l'onglet dans la langue", TITRE[l.code].test(d.title) && (l.code === "en" || !/play chess/.test(d.title)), d.title);
    T("texte de presentation : " + JSON.stringify(N), presentation(d).includes(N + MOT[l.code]) ||
      (l.code === "de" && presentation(d).includes(N + " Zug")), presentation(d).slice(0, 90));
    T("carte des exercices : " + JSON.stringify(N), compteur(d) === N, JSON.stringify(compteur(d)));
    w.close();
  }

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + e.message); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
