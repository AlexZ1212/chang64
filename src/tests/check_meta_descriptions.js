/* Verification automatique de chang64.
   Lancement : node tests/check_meta_descriptions.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Google tronque les meta descriptions au-dela d'environ 155-160 caracteres,
   sans prevenir ni chercher une coupure propre. Plusieurs generateurs de
   pages (ouvertures, exercices, regles, glossaire, finales, pieges)
   construisaient longtemps leur description en prenant les 280 ou 300
   premiers caracteres d'un texte plus long : 1289 des 2375 pages du site en
   sont ressorties avec une description tronquee en plein milieu d'une
   phrase, parfois d'un mot. check_seo_entete.js ne verifiait cette limite
   que sur la page d'accueil ; personne ne l'a remarque ailleurs pendant des
   mois.

   Cette suite parcourt TOUTES les pages produites (pas seulement quelques
   echantillons) et signale toute description absente ou trop longue, pour
   que ce type de regression ne puisse plus passer inapercu.
*/
const fs = require("fs");
const path = require("path");
const SITE = path.join(__dirname, "..", "site");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };

const dec = s => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

let total = 0, sansDesc = [], trop = [];
(function walk(p) {
  for (const f of fs.readdirSync(p)) {
    const q = path.join(p, f);
    if (fs.statSync(q).isDirectory()) walk(q);
    else if (f.endsWith(".html")) {
      total++;
      const h = fs.readFileSync(q, "utf8");
      const m = h.match(/name="description" content="([^"]*)"/);
      const rel = q.replace(SITE, "");
      if (!m || !m[1]) { sansDesc.push(rel); return; }
      const d = dec(m[1]);
      if (d.length > 160) trop.push([rel, d.length, d]);
    }
  }
})(SITE);

console.log("\n--- Meta description sur toutes les pages du site (" + total + " pages) ---");
T("aucune page sans meta description", sansDesc.length === 0, sansDesc.slice(0, 5).join(", "));
T("aucune description au-dela de 160 caracteres", trop.length === 0,
  trop.length + " page(s), ex : " + trop.slice(0, 5).map(([p, l]) => p + " (" + l + ")").join(", "));

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
