/* Verification automatique de chang64.
   Lancement : node tests/check_correctifs_2711.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Le lot de 21 correctifs note par Alexandre le 27/11/2026 (captures de son
   iPhone, design/correctifs-2811/liste.md), chacun avec sa garde. Les
   mesures de mise en page (360 px, police elargie) sont faites dans un vrai
   navigateur par mesure_correctifs_2711.js, pas ici. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const net = s => String(s).replace(/\s+/g, " ").trim();
const SRC = path.join(__dirname, "..");
const lire = f => fs.readFileSync(path.join(SRC, f), "utf8");
const LANGUES = ["fr", "en", "es", "pt", "de", "ru", "it", "tr", "pl", "id"];

(async () => {
  const w = await ouvrir("fr", { attente: 2200, fetch: true });
  const d = w.document, $ = id => d.getElementById(id), ev = x => w.eval(x);

  console.log("--- 16. Plus d'espace avant « % » ---");
  T("francais : « 62% » colle", ev("pourcentTexte(.62)") === "62%", JSON.stringify(ev("pourcentTexte(.62)")));
  T("aucune espace (pleine, fine, normale) avant « % »", !/[\s  ]%/.test(ev("pourcentTexte(.05)")));
  for (const l of ["de", "ru", "es", "tr"]) {
    const wl = await ouvrir(l, { attente: 900 });
    const p = wl.eval("pourcentTexte(.62)");
    T(l + " : " + p, l === "tr" ? p === "%62" : p === "62%", JSON.stringify(p));
    wl.close();
  }
  for (const l of LANGUES) {
    const f = l === "fr" ? "badges-catalogue.js" : "badges-textes/" + l + ".json";
    T("textes des badges (" + l + ") : pas de « 64 % »", !/\d[\s  ]%/.test(lire(f)));
  }

  w.close();
  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
