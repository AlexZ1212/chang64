/* Verification automatique de chang64.
   Lancement : node tests/check_source_compacte.js
   Le site doit avoir ete construit au prealable : node build_site.js

   2026-10-24 : la source d'un exercice (en-tetes PGN de la partie
   d'origine) pesait 40 % de chaque exercice neuf et partait telle quelle
   vers le navigateur, pseudos des joueurs compris, alors que le site n'en
   affiche rien.
   Verifie : sourceCompacte() (identifiant Lichess sans pseudos ; pseudos
   gardes faute d'identifiant ; idempotente) ; toute la banque est compacte ;
   aucune donnee envoyee au site ne porte de source. */
const fs = require("fs");
const path = require("path");
const SRC = path.join(__dirname, "..");
const SITE = path.join(SRC, "site");
const BQ = require(path.join(SRC, "banque.js"));
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };

console.log("\n--- sourceCompacte ---");
const brute = { event: "Rated Bullet game", white: "alice", black: "bob", ply: 53, site: "https://lichess.org/95BsTOkH",
  eco: "A00", opening: "Mieses Opening", date: "2026.01.01", timeControl: "60+0", elo: 2165 };
const c = BQ.sourceCompacte(brute);
T("partie Lichess : identifiant, ply, eco, cadence, elo", JSON.stringify(c) === JSON.stringify({ g: "95BsTOkH", ply: 53, eco: "A00", tc: "60+0", elo: 2165 }), JSON.stringify(c));
T("partie Lichess : plus de pseudos", !("w" in c) && !("white" in c) && !JSON.stringify(c).includes("alice"));
const fics = BQ.sourceCompacte({ event: "FICS rated blitz game", white: "jukey", black: "oralegre", ply: 33 });
T("sans identifiant : pseudos et type de partie gardes", fics.w === "jukey" && fics.b === "oralegre" && fics.ev === "FICS rated blitz game" && fics.ply === 33, JSON.stringify(fics));
T("idempotente", JSON.stringify(BQ.sourceCompacte(c)) === JSON.stringify(c) && JSON.stringify(BQ.sourceCompacte(fics)) === JSON.stringify(fics));
T("sans source : rien", BQ.sourceCompacte(undefined) === undefined);

console.log("\n--- La banque ---");
const banque = BQ.charger();
const brutes = banque.filter(p => p.source && ("white" in p.source || "site" in p.source || "opening" in p.source || "date" in p.source));
T("toutes les sources sont compactes", !brutes.length, brutes.length + " brutes, ex. " + (brutes[0] && brutes[0].id));
const pseudosAvecId = banque.filter(p => p.source && p.source.g && (p.source.w || p.source.b));
T("aucun pseudo la ou l'identifiant Lichess suffit", !pseudosAvecId.length, pseudosAvecId.length);

console.log("\n--- Ce qui part vers le navigateur ---");
const data = path.join(SITE, "data");
let fichiers = 0, avecSource = [];
for (const f of fs.readdirSync(data).filter(f => /^level-\d+-\d+\.json$|^rush-pool\.json$/.test(f))) {
  fichiers++;
  const t = fs.readFileSync(path.join(data, f), "utf8");
  if (/"source":/.test(t)) avecSource.push(f);
}
T(fichiers + " fichiers d'exercices sans aucune source", fichiers > 0 && !avecSource.length, avecSource.slice(0, 3).join(" "));

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
