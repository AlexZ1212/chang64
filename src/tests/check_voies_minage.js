/* Verification automatique de chang64.
   Lancement : node tests/check_voies_minage.js   (n'a pas besoin de site/)

   Ce que ce test garde (2026-09-14) : plusieurs minages en parallele se
   repartissent le PGN sans traiter deux fois la meme fenetre et sans en
   oublier. Un recouvrement ferait miner les memes parties pendant des
   semaines ; un trou laisserait des parties jamais minees, sans signal. */
const path = require("path");
const { sauterDe } = require(path.join(__dirname, "..", "boucle_minage.js"));

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n) } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")) } };

console.log("\n--- Pavage : ni trou ni recouvrement ---");
for (const [voies, fenetre, nb] of [[6, 100000, 28], [6, 250000, 12], [4, 500000, 8], [3, 250000, 20], [2, 100000, 5]]) {
  const f = [];
  for (let v = 0; v < voies; v++) for (let k = 0; k < nb; k++) f.push(sauterDe(500000, v, voies, fenetre, k));
  const nom = voies + " voies x " + nb + " fenetres de " + fenetre;
  T(nom + " : aucun doublon", new Set(f).size === f.length);
  const tri = f.slice().sort((a, b) => a - b);
  T(nom + " : sans trou", tri.every((x, i) => i === 0 || x - tri[i - 1] === fenetre));
  T(nom + " : couverture exacte", tri[tri.length - 1] + fenetre - tri[0] === f.length * fenetre);
}

console.log("\n--- Cas limites ---");
T("une seule voie avance de fenetre en fenetre",
  JSON.stringify([0, 1, 2].map(k => sauterDe(500000, 0, 1, 500000, k))) === "[500000,1000000,1500000]");
T("la voie 0 part du depart", sauterDe(750000, 0, 6, 250000, 0) === 750000);
T("la voie i commence i fenetres apres", sauterDe(0, 3, 6, 250000, 0) === 750000);
const v0 = [0, 1, 2, 3, 4].map(k => sauterDe(0, 0, 6, 250000, k)), v1 = [0, 1, 2, 3, 4].map(k => sauterDe(0, 1, 6, 250000, k));
T("deux voies voisines ne se croisent jamais", v0.every(x => !v1.includes(x)));

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
