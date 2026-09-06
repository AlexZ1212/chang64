/* Verification automatique de chang64.
   Lancement : node tests/check_index_motifs.js  (site deja construit)

   Remplace check_recherche_exercices.js, retire de la suite (2026-09-05) :
   ce fichier testait une recherche en direct sur la grille complete des
   exercices (data-cle, filtreBloc, filtreEtat), une architecture qu'
   Alexandre a lui-meme abandonnee courant aout pour cause de mise a
   l'echelle intenable (51 619+ puzzles ; commentaire du code source,
   content.js, section 5 : "remplace 1 page/exercice"). Ce n'est pas un
   point d'entree qui a change, la fonctionnalite testee n'existe plus du
   tout : forcer l'ancien test a "passer" contre l'index actuel (10 tuiles
   de categorie, pas de recherche) aurait verifie autre chose que ce pour
   quoi il avait ete ecrit. Ce fichier verifie a la place l'index reel tel
   qu'il existe aujourd'hui, qui n'avait jusqu'ici aucune couverture. */
const fs = require("fs"), path = require("path");
const SITE = path.join(__dirname, "..", "site");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n) } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")) } };

for (const [dir, lang] of [["puzzles", "en"], ["fr/exercices", "fr"]]) {
  console.log(`\n--- Index Motifs (${lang}) ---`);
  const idxPath = path.join(SITE, dir, "index.html");
  if (!fs.existsSync(idxPath)) { T(dir + "/index.html existe", false); continue; }
  const idx = fs.readFileSync(idxPath, "utf8");
  T("un H1 est present", /<h1[^>]*>[^<]+<\/h1>/.test(idx));
  const tiles = [...idx.matchAll(/<a class="tile" href="([^"]+)"><b>([^<]+)<\/b><\/a>/g)];
  T("au moins 8 tuiles de motifs", tiles.length >= 8, tiles.length + " tuiles");
  T("aucune tuile ne repete '3 exemples' (redondant avec le chapeau d'intro)",
    tiles.every(([, , label]) => !/3 exemples|3 examples/.test(label)));

  console.log(`\n--- Chaque tuile mene a une page qui tient sa promesse (${lang}) ---`);
  let manquantes = 0, sansTroisExemples = 0, sansRetour = 0;
  for (const [, href] of tiles) {
    const p = path.join(SITE, href.replace(/^\//, ""));
    if (!fs.existsSync(p)) { manquantes++; continue; }
    const page = fs.readFileSync(p, "utf8");
    const exemples = (page.match(/<h2>(?:Exemple|Example) \d/g) || []).length;
    if (exemples !== 3) sansTroisExemples++;
    if (!new RegExp(`class="cta ghost" href="/${dir.replace(/\//g, "\\/")}/"`).test(page)) sansRetour++;
  }
  T("toutes les tuiles pointent vers une page qui existe", manquantes === 0, manquantes + " manquante(s)");
  T("chaque page de categorie a exactement 3 exemples", sansTroisExemples === 0, sansTroisExemples + " page(s) en ecart");
  T("chaque page de categorie revient a l'index", sansRetour === 0, sansRetour + " page(s) sans retour");
}

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
