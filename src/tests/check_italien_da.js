/* Verification automatique de chang64.
   Lancement : node tests/check_italien_da.js

   Deux petits defauts corriges le 2026-11-22, releves par la session du coach.

   1. Italien : « difesa solo da il cavallo » au lieu de « dal cavallo ». La
      preposition « da » se soude a l'article (dal, dalla, dall'). La grammaire
      a desormais la forme {x:da} ; plus aucune phrase italienne ne colle « da »
      devant un nom de piece.
   2. Barre d'actions d'un exercice a 360 px : « Recommencer » passait sur deux
      ou trois lignes dans plusieurs langues (russe, turc, polonais surtout).
      Le libelle est court partout, comme en francais. jsdom ne met pas en
      page : on garde un plafond de caracteres, mesure dans le navigateur le
      22/11 (la rangee Indice | Recommencer | Exercice suivant tient a 360 px). */
const path = require("path"), fs = require("fs"), vm = require("vm");
const G = require("../grammaire.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };

/* Le dictionnaire d'une langue. */
const dico = l => require(path.join(__dirname, "..", "langues", l, "app.js"));

console.log("--- Italien : da + article ---");
const gr = (p, sq) => G.groupe("it", p, sq);
T("dal cavallo, dal pedone, dal re", gr("n", "f3").da === "dal cavallo in f3" && gr("p", "e4").da === "dal pedone in e4" && gr("k", "g1").da === "dal re in g1", [gr("n", "f3").da, gr("p", "e4").da, gr("k", "g1").da].join(" | "));
T("dalla donna, dalla torre", gr("q", "d1").da === "dalla donna in d1" && gr("r", "a1").da === "dalla torre in a1", [gr("q", "d1").da, gr("r", "a1").da].join(" | "));
T("dall'alfiere (voyelle)", gr("b", "c4").da === "dall'alfiere in c4", gr("b", "c4").da);
const it = dico("it");
const cle = "{captured} was only defended by {pinned}, which is pinned and can't recapture.";
const phrase = G.gabarit(it[cle], { captured: gr("q", "d5"), pinned: gr("n", "f3") });
T("la phrase de la piece clouee se lit « difesa solo dal cavallo »", phrase === "La donna in d5 era difesa solo dal cavallo in f3, che è inchiodato e non può ricatturare.", phrase);
const PIECES = ["pinned", "attacker", "piece", "taker", "captured", "p1", "p2"];
const fautives = Object.entries(it).filter(([k, v]) => typeof v === "string" && PIECES.some(x => v.includes(" da {" + x + "}") || v.includes(" di {" + x + "}") || v.includes(" a {" + x + "}")));
T("aucune phrase italienne ne colle da, di ou a devant un nom de piece", fautives.length === 0, fautives.map(x => x[1]).join(" || ").slice(0, 200));
T("les autres langues n'ont pas de forme « da » : le gabarit garde leur nominatif", G.gabarit("{x:da}", { x: G.groupe("fr", "n", "f3") }) === "Le cavalier en f3", G.gabarit("{x:da}", { x: G.groupe("fr", "n", "f3") }));

console.log("--- Bouton Recommencer : court dans toutes les langues ---");
const LANGUES = ["fr", "es", "pt", "de", "ru", "it", "tr", "pl", "id"];
const libelles = LANGUES.map(l => l + ":" + dico(l)["Restart puzzle"]);
T("chaque langue traduit « Restart puzzle »", LANGUES.every(l => typeof dico(l)["Restart puzzle"] === "string" && dico(l)["Restart puzzle"].length > 2), libelles.join(" "));
T("14 caracteres au plus, un ou deux mots", LANGUES.every(l => dico(l)["Restart puzzle"].length <= 14 && dico(l)["Restart puzzle"].split(" ").length <= 2), libelles.join(" "));

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
