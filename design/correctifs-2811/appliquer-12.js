/* Point 12 (27/11, choix d'Alexandre : « Toutes les B », medailles comprises) :
   les propositions B de la planche deviennent le dessin des medailles des
   motifs, donc aussi celui des tuiles de « Travailler un motif »
   (pictos_build.js reprend la medaille). Chaque dessin passe par le calage
   des medailles (design/badges/ajuster.js : accent rapproche, recentrage).
   Usage : node design/correctifs-2811/appliquer-12.js */
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const RACINE = path.join(__dirname, "..", "..");
const B = JSON.parse(fs.readFileSync(path.join(__dirname, "apres", "planche-12-pictos.json"), "utf8"));
const MED = path.join(RACINE, "src", "badges-medailles.json");
const M = JSON.parse(fs.readFileSync(MED, "utf8"));
const MOTIFS = ["deflection", "double_attack", "quiet_move", "back_rank_mate", "mate_in_one", "mate_in_two", "mate_in_three", "winning_capture"];
/* ajuster.js travaille sur design/badges/symboles.json : on lui passe une copie
   qui ne contient que nos huit dessins, puis on remet l'original. */
const SYM = path.join(RACINE, "design", "badges", "symboles.json");
const garde = fs.existsSync(SYM) ? fs.readFileSync(SYM) : null;
try {
  const S = {};
  for (const k of MOTIFS) S["theme_" + k] = { s: B[k + "_B"], m: M["theme_" + k][0] };
  fs.writeFileSync(SYM, JSON.stringify(S));
  execFileSync(process.execPath, [path.join(RACINE, "design", "badges", "ajuster.js")], { stdio: "inherit" });
  const R = JSON.parse(fs.readFileSync(SYM, "utf8"));
  for (const k of MOTIFS) M["theme_" + k] = [M["theme_" + k][0], R["theme_" + k].s];
  fs.writeFileSync(MED, JSON.stringify(M));
  console.log("medailles des motifs remplacees :", MOTIFS.length);
} finally {
  if (garde) fs.writeFileSync(SYM, garde); else fs.unlinkSync(SYM);
}
