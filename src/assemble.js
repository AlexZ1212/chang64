const fs = require("fs");

const THEMES = {
  "Mat en un coup": "Mate in one",
  "Mat en deux coups": "Mate in two",
  "Prise gagnante": "Winning capture",
  "Fourchette de cavalier": "Knight fork",
  "Fourchette de pion": "Pawn fork",
  "Attaque double": "Double attack",
  "Sacrifice": "Sacrifice",
  "Attaque à distance": "Long-range attack",
  "Coup gagnant": "Winning move",
  "Mat du couloir": "Back-rank mate",
  "Mat de l'escalier": "Ladder mate",
  "Mat étouffé": "Smothered mate",
  "Mat arabe": "Arabian mate",
  "Mat tour et roi": "Rook and king mate",
  "Mat dame et roi": "Queen and king mate",
  "Mat de la dame": "Queen mate",
  "Clouage": "Pin",
  "Déviation": "Deflection",
  "Enfilade": "Skewer",
  "Attaque sur le roi": "King attack",
  "Septième rangée": "Seventh rank",
  "Colonne ouverte": "Open file",
  "Diagonale": "Diagonal",
  "Grande diagonale": "Long diagonal",
  "Pièce en prise": "Hanging piece",
  "Promotion": "Promotion",
  "Cavalier central": "Central knight",
  "Cavalier avancé": "Advanced knight",
  "Défense du mat": "Mate defence",
  "Opposition": "Opposition",
  "Roque": "Castling",
  "Doublement des tours": "Doubled rooks",
  "Finale de l'Opéra": "Opera Game finish",
  "Mat du berger": "Scholar's mate",
  "Trait aux noirs": "Black to move"
};

const puzzles = JSON.parse(fs.readFileSync("/home/claude/chess/puzzles.json", "utf8"));
const missing = new Set();
for (const p of puzzles) {
  if (THEMES[p.theme]) p.theme = THEMES[p.theme];
  else if (/[éèàçôûêÀ-ÿ]/.test(p.theme) || /^(Mat|Coup|Prise|Attaque|Fourchette)/.test(p.theme)) missing.add(p.theme);
}
if (missing.size) console.log("THEMES NON TRADUITS :", [...missing]);

const engine = fs.readFileSync("/home/claude/chess/engine_browser.js", "utf8");
const pieces = fs.readFileSync("/home/claude/chess/pieces_browser.js", "utf8");
let ui = fs.readFileSync("/home/claude/chess/ui.js", "utf8");
ui = ui.replace("__PUZZLES__", JSON.stringify(puzzles));
let ui2 = fs.readFileSync("/home/claude/chess/ui2.js", "utf8");
ui2 = ui2.replace("__OPENINGS__", fs.readFileSync("/home/claude/chess/openings.json", "utf8"));

let html = fs.readFileSync("/home/claude/chess/template.html", "utf8");
html = html.replace("/*__ENGINE__*/", engine)
           .replace("/*__PIECES__*/", pieces)
           .replace("/*__UI__*/", ui)
           .replace("/*__UI2__*/", ui2);

// controle : plus aucun texte francais visible
const body = html.split("<body>")[1];
const frWords = ["Blancs", "Noirs", "coup ", "Exercice", "Partie", "Envoie", "ton ami", "Réinitialiser", "Progression", "Niveau", "Résolus"];
const found = frWords.filter(w => body.includes(w));
if (found.length) console.log("RESTES EN FRANCAIS :", found);

fs.writeFileSync("/mnt/user-data/outputs/chang64.html", html);
console.log("chang64.html :", Math.round(html.length / 1024), "Ko |", puzzles.length, "puzzles");
