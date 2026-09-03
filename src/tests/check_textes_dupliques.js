/* Verification automatique de chang64.
   Lancement : node tests/check_textes_dupliques.js

   Le chapo ("lede") et le corps de page repetaient le meme texte mot pour
   mot sur 52 pages : les 40 du lexique, ou la definition apparaissait deux
   fois, et les 12 pieges, ou le chapo reprenait les 280 premiers caracteres
   du texte affiche juste en dessous.

   Un lecteur qui lit deux fois la meme phrase croit s'etre trompe de page.
   C'est aussi mauvais pour le referencement : Google considere qu'une page
   dont le contenu se repete apporte peu.
*/
const fs = require("fs");
const path = require("path");
const SITE = path.join(__dirname, "..", "site");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };

const pages = [];
(function walk(p) {
  for (const f of fs.readdirSync(p)) {
    const q = path.join(p, f);
    if (fs.statSync(q).isDirectory()) walk(q);
    else if (f.endsWith(".html") && f !== "404.html") pages.push(q);
  }
})(SITE);

const norm = x => x.replace(/\s+/g, " ").trim();
const sansScript = h => h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");

console.log("\n--- Le chapo n'est jamais repete dans le corps ---");
let dup = [], avecChapo = 0;
for (const q of pages) {
  const h = sansScript(fs.readFileSync(q, "utf8"));
  const lede = (h.match(/<p class="lede">([^<]{40,})<\/p>/) || [])[1];
  if (!lede) continue;
  avecChapo++;
  if (norm(h).includes("<p>" + norm(lede) + "</p>")) dup.push(q.replace(SITE, ""));
}
T(avecChapo + " pages avec un chapo, aucun repete a l'identique", dup.length === 0,
  dup.slice(0, 5).join(", "));

console.log("\n--- Ni repete partiellement ---");
/* Cas des pieges : le chapo etait le debut exact du texte suivant. On
   compare les 120 premiers caracteres, assez pour attraper ce motif sans
   signaler deux phrases qui commencent simplement par le meme mot. */
let partiels = [];
for (const q of pages) {
  const h = sansScript(fs.readFileSync(q, "utf8"));
  const lede = (h.match(/<p class="lede">([^<]{80,})<\/p>/) || [])[1];
  if (!lede) continue;
  const debut = norm(lede).slice(0, 120);
  const corps = [...h.matchAll(/<p>([^<]{80,})<\/p>/g)].map(m => norm(m[1]));
  if (corps.some(c => c.slice(0, 120) === debut)) partiels.push(q.replace(SITE, ""));
}
T("aucun chapo qui reprend le debut du corps", partiels.length === 0,
  partiels.slice(0, 5).join(", "));

console.log("\n--- Les pages concernees ont bien du contenu distinct ---");
for (const [p, quoi] of [
  ["/fr/lexique/clouage.html", "lexique FR"],
  ["/glossary/pin.html", "lexique EN"],
  ["/fr/pieges/mat-du-berger.html", "pieges FR"]
]) {
  if (!fs.existsSync(SITE + p)) { T(quoi + " : page absente", false, p); continue; }
  const h = sansScript(fs.readFileSync(SITE + p, "utf8"));
  const lede = (h.match(/<p class="lede">([^<]*)<\/p>/) || [])[1] || "";
  const premier = ([...h.matchAll(/<p>([^<]{40,})<\/p>/g)][0] || [])[1] || "";
  T(quoi + " : chapo et corps different", norm(lede) !== norm(premier) && lede.length > 20 && premier.length > 20,
    norm(lede).slice(0, 45) + " | " + norm(premier).slice(0, 45));
}

console.log("\n--- Aucun paragraphe repete deux fois dans une meme page ---");
let interne = [];
for (const q of pages.slice(0, 400)) {
  const h = sansScript(fs.readFileSync(q, "utf8"));
  const ps = [...h.matchAll(/<p>([^<]{60,})<\/p>/g)].map(m => norm(m[1]));
  if (new Set(ps).size !== ps.length) interne.push(q.replace(SITE, ""));
}
T("400 pages verifiees, aucun paragraphe en double", interne.length === 0,
  interne.slice(0, 4).join(", "));

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
