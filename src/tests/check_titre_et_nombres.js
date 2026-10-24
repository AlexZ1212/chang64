/* Verification automatique de chang64.
   Lancement : node tests/check_titre_et_nombres.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Deux defauts de l'application en francais, trouves en audit le
   2026-10-24 :
     - le titre de l'onglet restait "chang64 · play chess, solve tactics" ;
     - "108868 exercices" s'affichait sans separateur de milliers, deux fois
       sur l'accueil (texte de presentation et carte des exercices).
   On charge l'application dans les deux langues de navigateur, puis on
   bascule de l'une a l'autre, et on relit le titre et les deux nombres. */
const path = require("path");
const fs = require("fs"), jd = require("jsdom");
const SITE = path.join(__dirname, "..", "site");
const html = fs.readFileSync(SITE + "/index.html", "utf8");
const NP = require(path.join(__dirname, "..", "banque.js")).charger().length;
const FR = NP.toLocaleString("fr-FR"), EN = NP.toLocaleString("en-US");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));

function ouvrir(langue) {
  const dom = new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/",
    virtualConsole: new jd.VirtualConsole(),
    beforeParse(w) {
      Object.defineProperty(w.navigator, "language", { value: langue, configurable: true });
      w.fetch = () => Promise.resolve({ ok: false, status: 404 });
    } });
  return dom.window;
}
const presentation = d => d.querySelector(".hero-lede p:last-child").textContent;
const compteur = d => d.getElementById("hCount").textContent;
const basculer = async (w, l) => {
  const b = [...w.document.getElementById("langSwitch").children].find(x => x.dataset.lang === l);
  b.click(); await attendre(300);
};

(async () => {
  console.log("\n--- Le nombre brut n'est plus affiche tel quel ---");
  T("le HTML anglais groupe les milliers", html.includes(EN + " puzzles verified move by move"), EN);
  T("la traduction francaise groupe les milliers", html.includes(FR + " exercices v"), JSON.stringify(FR));
  T("hCount garde la valeur brute pour le script", new RegExp('id="hCount" data-nombre="' + NP + '"').test(html));

  console.log("\n--- Navigateur en francais ---");
  const wf = ouvrir("fr-FR"); await attendre(1500);
  const df = wf.document;
  T("page en francais", df.documentElement.lang === "fr", df.documentElement.lang);
  T("titre de l'onglet traduit", /joue aux/.test(df.title) && !/play chess/.test(df.title), df.title);
  T("texte de presentation : " + JSON.stringify(FR), presentation(df).includes(FR + " exercices"), presentation(df).slice(0, 90));
  T("carte des exercices : " + JSON.stringify(FR), compteur(df) === FR, JSON.stringify(compteur(df)));
  await basculer(wf, "en");
  T("retour a l'anglais : titre d'origine", df.title === "chang64 · play chess, solve tactics", df.title);
  T("retour a l'anglais : compteur " + EN, compteur(df) === EN, compteur(df));
  T("retour a l'anglais : presentation", presentation(df).includes(EN + " puzzles"), presentation(df).slice(0, 90));

  console.log("\n--- Navigateur en anglais ---");
  const we = ouvrir("en-US"); await attendre(1500);
  const de = we.document;
  T("titre anglais", de.title === "chang64 · play chess, solve tactics", de.title);
  T("compteur " + EN, compteur(de) === EN, compteur(de));
  await basculer(we, "fr");
  T("bascule en francais : titre traduit", /joue aux/.test(de.title), de.title);
  T("bascule en francais : compteur " + JSON.stringify(FR), compteur(de) === FR, JSON.stringify(compteur(de)));
  T("bascule en francais : presentation", presentation(de).includes(FR + " exercices"), presentation(de).slice(0, 90));

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + e.message); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
