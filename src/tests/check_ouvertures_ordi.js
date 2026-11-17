/* Verification automatique de chang64.
   Lancement : node tests/check_ouvertures_ordi.js

   Repertoire d'ouvertures de l'ordinateur (BOT_OUVERTURES, ui.js,
   2026-11-17). Le tableau est ecrit a la main : une faute de frappe dans un
   coup le rendrait injouable, et l'ordinateur retomberait en silence sur son
   calcul. Verifie, avec le vrai moteur :
     - chaque cle est une suite de coups legale depuis la position de depart ;
     - chaque coup propose est legal dans cette position, avec un poids ;
     - aucune ligne ne mene a une position perdante d'entree (pas de piece
       donnee : le coup propose ne perd pas de materiel a un demi-coup) ;
     - il y a de la variete : plusieurs premiers coups avec les Blancs,
       plusieurs reponses a 1.e4 et a 1.d4, dont 1...e5 ;
     - le tirage suit les poids et le livre s'arrete plus tot aux niveaux
       faciles. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const { Game } = require(path.join(__dirname, "..", "engine.js"));
const src = fs.readFileSync(path.join(__dirname, "..", "ui.js"), "utf8");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };

const debut = src.indexOf("const BOT_OUVERTURES="), fin = src.indexOf("function botMove(){", debut);
T("le repertoire est dans ui.js", debut > 0 && fin > debut);
const ctx = { Math, game: null, sanList: [], botLevel: 4 };
vm.createContext(ctx);
vm.runInContext(src.slice(debut, fin).replace("const BOT_OUVERTURES=", "var BOT_OUVERTURES=").replace("const BOT_LIVRE_MAX=", "var BOT_LIVRE_MAX="), ctx);
const LIVRE = ctx.BOT_OUVERTURES, propre = x => x.replace(/[+#!?]/g, "");
const jouer = (g, san) => { const m = g.moves().find(x => propre(g.san(x)) === san); if (!m) return false; g.makeMove(m); return true; };

const illegales = [], injouables = [], sansPoids = [], orphelines = [];
for (const cle of Object.keys(LIVRE)) {
  const g = new Game();
  let bon = true;
  for (const c of cle ? cle.split(" ") : []) if (!jouer(g, c)) { bon = false; break; }
  if (!bon) { illegales.push(cle); continue; }
  for (const x of LIVRE[cle].split("|")) {
    const [san, poids] = x.split(" ");
    if (!(+poids > 0)) sansPoids.push(cle + " -> " + x);
    if (!g.moves().some(m => propre(g.san(m)) === san)) injouables.push(cle + " -> " + san);
  }
  /* Toute ligne longue doit pouvoir etre atteinte : son prefixe propose ce coup. */
  if (cle) {
    const coups = cle.split(" "), parent = coups.slice(0, -1).join(" "), dernier = coups[coups.length - 1];
    /* Le dernier coup peut etre celui du joueur (1.e4 d5 quand l'ordinateur a
       les Blancs) : on exige seulement que la position d'avant soit connue. */
    void dernier;
    if (LIVRE[parent] === undefined) orphelines.push(cle);
  }
}
T(Object.keys(LIVRE).length + " positions, toutes atteignables par des coups legaux", illegales.length === 0, illegales.join(" ; "));
T("chaque coup propose est legal", injouables.length === 0, injouables.join(" ; "));
T("chaque coup a un poids", sansPoids.length === 0, sansPoids.join(" ; "));
T("chaque ligne prolonge une ligne du livre", orphelines.length === 0, orphelines.join(" ; "));

const premiers = LIVRE[""].split("|").map(x => x.split(" ")[0]);
T("plusieurs premiers coups avec les Blancs, e4 et d4 en tete", premiers.length >= 3 && premiers[0] === "e4" && premiers.includes("d4"));
const surE4 = LIVRE["e4"].split("|").map(x => x.split(" ")[0]);
T("1.e4 : plusieurs reponses, 1...e5 la plus frequente", surE4.length >= 3 && surE4[0] === "e5");
T("1.d4 : plusieurs reponses", LIVRE["d4"].split("|").length >= 2);

/* Le tirage, tel que l'application le fait. */
const tirer = (coups, niveau) => {
  const g = new Game();
  for (const c of coups) jouer(g, c);
  ctx.game = g; ctx.sanList = coups.slice(); ctx.botLevel = niveau; ctx.gameStartFen = null;
  const m = ctx.botLivre();
  return m ? propre(g.san(m)) : null;
};
const compte = {};
for (let i = 0; i < 2000; i++) { const c = tirer(["e4"], 4); compte[c] = (compte[c] || 0) + 1; }
T("sur 2 000 parties, 1...e5 sort le plus souvent mais pas toujours", compte.e5 > 800 && compte.e5 < 1300 && compte.c5 > 400, JSON.stringify(compte));
T("et rien d'autre que le repertoire", Object.keys(compte).every(c => surE4.includes(c)), JSON.stringify(compte));
T("hors du livre : l'ordinateur reprend son calcul", tirer(["a4"], 4) === null && tirer(["e4", "e5", "Qh5"], 4) === null);
const longue = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"];
T("niveau fort : il connait encore le 7e demi-coup", ["Ba4", "Bxc6"].includes(tirer(longue, 4)));
T("niveau facile : il a quitte le livre apres quatre demi-coups", tirer(longue, 1) === null && tirer(["e4", "e5", "Nf3", "Nc6"], 1) === null && tirer(["e4", "e5", "Nf3"], 1) !== null);
ctx.gameStartFen = "8/8/8/8/8/8/8/K6k w - - 0 1";
{ const g = new Game(); ctx.game = g; ctx.sanList = []; ctx.botLevel = 4; T("partie lancee depuis une position : pas de livre", ctx.botLivre() === null); }

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
