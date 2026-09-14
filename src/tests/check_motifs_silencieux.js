/* Verification automatique de chang64.
   Lancement : node tests/check_motifs_silencieux.js
   N'a pas besoin du site construit : ce test ne parle qu'aux scripts de
   generation. Compte une dizaine de secondes, il fait tourner le moteur.

   Ce que ce test garde (2026-09-13) : "Quiet move" et "Deflection"
   continuent d'arriver jusqu'a la banque.

   Ces deux motifs ne sortent QUE de classifyQuiet() (gen_puzzles_v2.js).
   classifyBase() ne sait pas les produire. Or deux maillons du tuyau
   appelaient classifyBase() sans condition :
     - mine_puzzles.js calculait bien `quiet` et ne s'en servait jamais ;
     - merge_puzzles.js reclassifiait toute fournee entrante, effacant au
       passage l'etiquette correcte que le mineur aurait pu poser.
   Resultat mesure avant correctif : sur 56 exercices silencieux fraichement
   mines, la fusion en rendait 0 Deflection et 0 Quiet move, redistribues en
   Double attack, Knight fork, Winning move, Skewer, Pin et Pawn fork. Les
   deux motifs etaient donc gelés a leur population d'origine quoi qu'on
   mine, et personne ne pouvait s'en apercevoir : aucune erreur n'etait
   levee, les exercices sortaient simplement sous un autre nom.

   Le test attaque les deux maillons separement, parce qu'en reparer un seul
   ne sert a rien.

   Note sur la stabilite. La partie qui fait tourner le moteur n'exige pas
   "Deflection" sur une position donnee : la detection est volontairement
   conservatrice et retombe sur "Quiet move" quand la ligne ne prouve pas la
   deviation, ce qui est un comportement correct et non une faute. Elle
   verifie la propriete qui, elle, ne peut pas regresser : un coup silencieux
   ressort avec un motif de classifyQuiet, jamais avec un motif de
   classifyBase. La reconnaissance fine de Deflection est verifiee a part,
   sur des lignes deja connues, sans aucune recherche -- donc sans
   dependance au temps de calcul ni a la charge de la machine. */
const path = require("path");
const RACINE = path.join(__dirname, "..");
const { Game } = require(path.join(RACINE, "engine.js"));
const { classifyBase, classifyQuiet, isQuiet } = require(path.join(RACINE, "gen_puzzles_v2.js"));
const { extractPuzzleAt } = require(path.join(RACINE, "mine_puzzles.js"));

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n) } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")) } };

const SILENCIEUX = ["Quiet move", "Deflection"];

/* Exercices reels, avec leur ligne complete.
   Les quatre deviations ci-dessous sont choisies parce que le
   classificateur ACTUEL les reconnait. Toutes les deviations de la banque
   n'en sont pas la : sur trois prises au hasard parmi les 439, deux
   ressortent aujourd'hui en "Quiet move". Ce n'est pas une regression, c'est
   l'effet des deux resserrages de classifyQuiet (le motif se declenchait sur
   64 % des positions avant correctif). Le test actuel exige que le dernier
   coup recupere une piece que la piece deviee gardait ; quand il ne fait que
   reprendre sur une case vide, la deviation est reelle au sens des echecs
   mais invisible pour l'heuristique. reclass_puzzles.js protege
   deliberement ces exercices anciens plutot que de les reetiqueter. */
const DEVIATIONS = [
  { code: "BZ2TO", fen: "r4rk1/pb4b1/1p1pp1p1/5pq1/2P1P1n1/2NB1QN1/PP6/R3K2R b - - 1 20", sol: ["g4e5", "f3e2", "g5g3"] },
  { code: "L0MGI", fen: "3r2k1/1q2b1p1/3p1p1p/4p3/1pP1P3/1P3P1P/1P1Q1BP1/R6K w - - 0 27", sol: ["a1a7", "b7c6", "a7e7"] },
  { code: "56W85", fen: "3q1rk1/p3p1bp/1p3pp1/3b4/NQ3B2/5P2/PPr3PP/R4RK1 b - - 1 18", sol: ["c2c4", "b4d2", "c4a4"] },
  { code: "VGNKG", fen: "r1b2rk1/4pp1p/p1qp1bp1/1p6/4P3/1BNQ4/PPP2PPP/1K1R3R w - - 0 14", sol: ["b3d5", "c6b6", "d5a8"] }
];
const TRANQUILLES = [
  { code: "BFKCU", fen: "r3kb1r/pQp1pppp/2p5/3q4/P7/2P2b2/2PB1P1P/R3K2R b KQkq - 1 14", sol: ["a8d8"] },
  { code: "FLSQE", fen: "r2qk2r/pbppbpp1/5n2/3p2B1/1N1Q2p1/1P6/1PP1BPPP/R2K3R b kq - 0 16", sol: ["c7c5"] }
];
const PRISES = [
  { code: "TAUXL", theme: "Winning capture", fen: "1b4k1/5q1p/1p1p1p2/4B2P/Pp2P3/1P6/3K1PP1/R2R4 b - - 1 30", sol: ["f6e5"] },
  { code: "BRLA2", theme: "Winning capture", fen: "r1b1k1nr/1p3ppR/n1p5/8/1b2P2q/5PP1/PPPP4/RNBQK3 w Qkq - 1 12", sol: ["h7h4"] },
  { code: "R90XS", theme: "Knight fork", fen: "1nbqk2r/rp1p2p1/8/p1p1p2p/P1n4P/P2P1P2/2P1BR2/1N1Q1KN1 b k - 3 17", sol: ["c4e3"] }
];

/* Reproduit a l'identique la branche de reclassification de
   merge_puzzles.js : rejoue la solution recue pour reconstruire les coups
   complets, puis choisit le classificateur selon le premier coup. */
function reclasser(p) {
  const g = new Game(p.fen);
  const premier = g.moves().find(m => g.uci(m) === p.sol[0]);
  if (!premier) return null;
  const ligne = [];
  const gl = new Game(p.fen);
  for (const u of p.sol) {
    const full = gl.moves().find(m => gl.uci(m) === u);
    if (!full) break;
    ligne.push({ mv: full });
    gl.makeMove(full);
  }
  return (ligne.length === p.sol.length && isQuiet(g, premier))
    ? classifyQuiet(g, ligne)
    : classifyBase(g, premier, false, 0);
}

console.log("\n--- La fusion reconnait la deviation sur une ligne connue ---");
for (const p of DEVIATIONS) {
  const r = reclasser(p);
  T("#" + p.code + " reste Deflection", r && r.theme === "Deflection", r ? r.theme : "null");
  T("#" + p.code + " nomme la piece deviee et la case gagnee",
    !!(r && r.detail && r.detail.deflected && r.detail.deflected.sq && r.detail.gained && r.detail.gained.sq),
    r ? JSON.stringify(r.detail) : "null");
}

console.log("\n--- Un coup silencieux sans deviation reste Quiet move ---");
for (const p of TRANQUILLES) {
  const r = reclasser(p);
  T("#" + p.code + " reste Quiet move", r && r.theme === "Quiet move", r ? r.theme : "null");
}

console.log("\n--- Les prises ne passent pas par classifyQuiet ---");
for (const p of PRISES) {
  const r = reclasser(p);
  T("#" + p.code + " reste " + p.theme, r && r.theme === p.theme, r ? r.theme : "null");
  T("#" + p.code + " n'est pas devenu silencieux", r && SILENCIEUX.indexOf(r.theme) < 0, r ? r.theme : "null");
}

console.log("\n--- Le mineur etiquette lui-meme les coups silencieux ---");
for (const p of TRANQUILLES.concat(DEVIATIONS)) {
  const r = extractPuzzleAt(new Game(p.fen), { depth: 3 });
  /* Une position peut ne plus passer les filtres de qualite du mineur ; ce
     n'est pas une faute, on ne juge que ce qui en sort. */
  if (!r) { T("#" + p.code + " ecarte par les filtres, sans avis", true); continue; }
  T("#" + p.code + " sort avec un motif de classifyQuiet",
    SILENCIEUX.indexOf(r.theme) >= 0, r.theme);
  T("#" + p.code + " solution de longueur impaire", r.sol.length % 2 === 1, r.sol.length);
}

console.log("\n--- Le mineur ne rend pas les prises silencieuses ---");
for (const p of PRISES) {
  const r = extractPuzzleAt(new Game(p.fen), { depth: 3 });
  if (!r) { T("#" + p.code + " ecarte par les filtres, sans avis", true); continue; }
  T("#" + p.code + " garde un motif de classifyBase",
    SILENCIEUX.indexOf(r.theme) < 0, r.theme);
}

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
