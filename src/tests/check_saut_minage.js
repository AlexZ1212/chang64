/* Verification automatique de chang64.
   Lancement : node tests/check_saut_minage.js   (n'a pas besoin de site/)

   Ce que ce test garde (2026-09-14) : une deuxieme passe de minage sur le
   MEME fichier PGN lit reellement des parties nouvelles.

   extractGameChunk() repartait toujours de la premiere partie, et le
   garde-fou plafonne a 500 000 parties brutes. Relancer produisait donc
   exactement la meme fournee, que merge_puzzles.js rejetait en "deja dans
   la banque" apres des heures de calcul, sans erreur.

   Verifie : fenetres consecutives sans trou ni recouvrement, saut compte
   en parties et non en lignes, comportement d'origine inchange sans saut. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { extractGameChunk, splitGames } = require(path.join(__dirname, "..", "mine_puzzles.js"));

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n) } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")) } };

const NB = 30;
const lignes = [];
for (let i = 1; i <= NB; i++) lignes.push(`[Event "G${i}"]`, `[White "Blanc${i}"]`, `[Black "Noir${i}"]`,
  `[WhiteElo "2000"]`, `[BlackElo "2000"]`, `[Result "1-0"]`, "", "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0", "");
const fichier = path.join(os.tmpdir(), "chang64-saut-" + process.pid + ".pgn");
fs.writeFileSync(fichier, lignes.join("\n"), "utf8");
const numeros = t => splitGames(t).map(g => +String(g.headers.Event || "").replace(/^G/, ""));

(async () => {
  try {
    console.log("\n--- Sans saut : comportement d'origine ---");
    const debut = await extractGameChunk(fichier, 5, 1, 0);
    T("une fenetre de 5 ramene 5 parties", numeros(debut).length === 5, numeros(debut).length);
    T("elle commence a la premiere partie", JSON.stringify(numeros(debut)) === "[1,2,3,4,5]", numeros(debut).join(","));
    T("omettre l'argument equivaut a ne rien sauter", (await extractGameChunk(fichier, 5, 1)) === debut);

    console.log("\n--- Avec saut ---");
    const suite = await extractGameChunk(fichier, 5, 1, 5);
    T("sauter 5 commence a la sixieme partie", JSON.stringify(numeros(suite)) === "[6,7,8,9,10]", numeros(suite).join(","));

    console.log("\n--- Continuite ---");
    const e = [].concat(numeros(await extractGameChunk(fichier, 7, 1, 0)),
      numeros(await extractGameChunk(fichier, 7, 1, 7)), numeros(await extractGameChunk(fichier, 7, 1, 14)));
    T("trois passes de 7 donnent 21 parties distinctes", new Set(e).size === 21, new Set(e).size);
    T("elles se suivent sans trou", e.every((n, i) => n === i + 1), e.join(","));

    console.log("\n--- Le saut se compte en parties ---");
    T("la fenetre commence par une en-tete [Event", suite.trimStart().startsWith('[Event "G6"'));
    T("aucune en-tete d'une partie sautee ne traine", !/Blanc[1-5]"/.test(suite));

    console.log("\n--- Bords ---");
    T("sauter tout le fichier ne ramene rien", numeros(await extractGameChunk(fichier, 5, 1, NB)).length === 0);
    const fin = numeros(await extractGameChunk(fichier, 10, 1, NB - 3));
    T("une fenetre qui depasse la fin s'arrete a la derniere partie", JSON.stringify(fin) === "[28,29,30]", fin.join(","));
    T("un saut negatif est traite comme zero", (await extractGameChunk(fichier, 5, 1, -10)) === debut);
  } catch (e) { ko++; console.log("  FAIL exception -> " + e.message); }
  finally { try { fs.unlinkSync(fichier); } catch (e) {} }
  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
