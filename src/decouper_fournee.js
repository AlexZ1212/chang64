#!/usr/bin/env node
/* Decoupe une fournee en N fichiers, pour lancer autant de filtres en
   parallele.

   Usage :
     node decouper_fournee.js fournee.json 6

   Le Stockfish embarque est la version "single", mono-cœur : une passe
   n'occupe qu'un cœur sur huit. Decouper et lancer plusieurs instances ne
   change NI la profondeur NI l'exigence, c'est exactement le meme travail
   reparti. Le seul effet est la duree.

   La repartition est en tourniquet (1er exercice au fichier 1, 2e au 2, et
   ainsi de suite) plutot qu'en blocs : les exercices voisins dans une
   fournee viennent souvent des memes parties, donc se ressemblent en
   difficulte. En blocs, une part pourrait recevoir tous les cas lourds et
   finir bien apres les autres.

   Les fichiers produits se passent tels quels a filtre_stockfish.js, et
   merge_puzzles.js accepte plusieurs fichiers d'un coup : il n'y a rien a
   recoller a la fin.
*/
const fs = require("fs");
const path = require("path");

const ENTREE = process.argv[2];
const PARTS = +(process.argv[3] || 6);
if (!ENTREE || !PARTS || PARTS < 2) {
  console.error("Usage : node decouper_fournee.js <fournee.json> <nombre de parts>");
  process.exit(1);
}

const fournee = JSON.parse(fs.readFileSync(ENTREE, "utf8"));
const base = ENTREE.replace(/\.json$/, "");
const lots = Array.from({ length: PARTS }, () => []);
fournee.forEach((p, i) => lots[i % PARTS].push(p));

console.log("Fournee :", fournee.length, "exercices ->", PARTS, "parts\n");
const noms = [];
lots.forEach((lot, i) => {
  const nom = base + "-" + (i + 1) + ".json";
  fs.writeFileSync(nom, JSON.stringify(lot));
  noms.push(path.basename(nom));
  console.log("  " + path.basename(nom).padEnd(24) + lot.length + " exercices");
});

/* Controle : rien ne doit avoir ete perdu ni duplique en chemin. */
const total = lots.reduce((s, l) => s + l.length, 0);
console.log("\nTotal reparti :", total, total === fournee.length ? "(complet)" : "!!! ECART !!!");

console.log("\nUne fenetre de terminal par commande, toutes en meme temps :\n");
for (const n of noms) console.log("  node filtre_stockfish.js " + n + " --profondeur=18");
console.log("\nPuis, quand toutes ont fini :\n");
console.log("  node merge_puzzles.js " + noms.map(n => n.replace(/\.json$/, ".retenus.json")).join(" ") + " --dry");
