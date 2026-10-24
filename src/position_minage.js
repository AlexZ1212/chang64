#!/usr/bin/env node
/* Ou en est le minage dans le fichier PGN source ?

   Usage :
     node position_minage.js <parties.pgn> [limite=1500000]

   mine_puzzles.js lisait toujours depuis la PREMIERE partie du fichier.
   --sauter=N permet de reprendre plus loin, mais N se compte en parties
   BRUTES, avant le filtre minElo : ce n'est pas le nombre de parties
   minees. Le choisir de tete revient a parier : trop petit, on remine des
   positions deja en banque ; trop grand, on saute des parties jamais vues.

   Ce script relit le PGN en flux, ne lit QUE les en-tetes, et repere le
   rang de la derniere partie brute dont les deux joueurs correspondent a
   la source d'un exercice en banque. C'est la frontiere du minage, mesuree.

   Une paire de joueurs peut se retrouver plus loin (deux habitues qui
   rejouent). Le tableau par tranche le montre : une frontiere fiable est
   une zone dense suivie d'une traine vide. Rien n'est ecrit ni modifie. */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const PGN = process.argv[2];
const LIMITE = +process.argv[3] || 1500000;
const TRANCHE = +process.env.CHANG64_TRANCHE || 50000;
if (!PGN) { console.error("Usage : node position_minage.js <parties.pgn> [limite=1500000]"); process.exit(1); }
if (!fs.existsSync(PGN)) { console.error("Fichier introuvable : " + PGN); process.exit(1); }

const banque = require(path.join(__dirname, "banque.js")).charger();
const empreintes = new Set();
for (const p of banque) if (p.source && p.source.white && p.source.black) empreintes.add(p.source.white + "|" + p.source.black);
console.log("Parties d'origine connues en banque : " + empreintes.size
  + " (pour " + banque.filter(p => p.source).length + " exercices mines)\n");

const parTranche = new Map();
let rang = 0, dernier = 0, touches = 0, blanc = null, noir = null, vu = false;

function cloture() {
  if (!rang || vu || !blanc || !noir) return;
  if (empreintes.has(blanc + "|" + noir)) {
    touches++; dernier = rang;
    const t = Math.floor((rang - 1) / TRANCHE);
    parTranche.set(t, (parTranche.get(t) || 0) + 1);
  }
  vu = true;
}

const stream = fs.createReadStream(PGN, { encoding: "utf8" });
const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
let arrete = false;

rl.on("line", (line) => {
  if (arrete) return;
  if (line.startsWith('[Event "')) {
    cloture();
    rang++; blanc = noir = null; vu = false;
    if (rang % 100000 === 0) process.stderr.write("\r  " + rang + " parties lues, " + touches + " correspondances");
    if (rang > LIMITE) { arrete = true; rl.close(); stream.destroy(); }
    return;
  }
  if (!blanc && line.startsWith('[White "')) blanc = line.slice(8, -2);
  else if (!noir && line.startsWith('[Black "')) noir = line.slice(8, -2);
});

rl.on("close", () => {
  cloture();
  process.stderr.write("\r" + " ".repeat(60) + "\r");
  console.log("Parties brutes parcourues : " + Math.min(rang, LIMITE));
  console.log("Correspondances trouvees  : " + touches);
  if (!touches) {
    console.log("\nAucune partie de la banque retrouvee dans ce fichier.");
    console.log("Soit ce n'est pas le PGN qui a servi au minage, soit la limite est trop basse.");
    return;
  }
  console.log("\nRepartition par tranche de " + TRANCHE + " parties :");
  const tMax = Math.max(...parTranche.keys());
  for (let t = 0; t <= tMax; t++) {
    const n = parTranche.get(t) || 0;
    const barre = "#".repeat(Math.min(50, Math.round(n / Math.max(1, touches / 200))));
    console.log("  " + String(t * TRANCHE).padStart(9) + " - " + String((t + 1) * TRANCHE).padStart(9)
      + "  " + String(n).padStart(6) + "  " + barre);
  }
  /* Jamais moins que le plafond de lecture d'une passe : le lecteur a
     forcement avale jusque-la, meme si les dernieres parties n'ont rien
     donne. Une marge coute quelques dizaines de milliers de parties sur 89
     millions ; se tromper dans l'autre sens coute des jours de doublons. */
  const arrondi = Math.ceil(dernier / TRANCHE) * TRANCHE;
  const conseil = Math.max(arrondi, 500000);
  console.log("\nDerniere partie ayant produit un exercice : rang " + dernier);
  console.log("Arrondi a la tranche superieure           : " + arrondi);
  console.log("Plafond de lecture d'une passe            : 500000");
  console.log("\n  Depart conseille : " + conseil + "\n");
  console.log("Verifie le tableau : la zone dense doit etre suivie d'une traine vide.");
});

stream.on("error", (e) => { console.error("Erreur de lecture : " + e.message); process.exit(1); });
