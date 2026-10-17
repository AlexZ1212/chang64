/* Verification automatique de chang64.
   Lancement : node tests/check_filtre_sequences.js   (n'a pas besoin de site/ ni de Stockfish)

   Ce que ce test garde (2026-10-17) : filtre_stockfish.js valide TOUTE la
   sequence d'un gain, plus seulement son premier coup.

   Avant : seul sol[0] passait par Stockfish. Depuis que le mineur prolonge
   les gains jusqu'a quatre decisions, les coups suivants n'etaient garantis
   que par le moteur maison, celui qui laissait passer 1 % d'exercices faux.

   Le moteur est remplace par un faux qui rend des reponses ecrites a
   l'avance : on teste les decisions du filtre, pas Stockfish.
   Verifie : un premier coup faux rejette ; un coup suivant faux coupe la
   sequence, qui finit toujours sur un coup a nous ; une defense non forcee
   coupe ; une defense equivalente passe ; le moteur n'est plus consulte
   apres le coup fautif ; la ligne coupee a son san et son motif recalcules. */
const path = require("path");
const { verdictCoup, verdictDefense, examinerGain, couper } = require(path.join(__dirname, "..", "filtre_stockfish.js"));

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n) } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")) } };

const O = { seuil: 100, marge: 200, margeDefense: 50, stricte: true };
const DEPART = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const SOL = ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"];
const exo = (sol) => ({ fen: DEPART, type: "gain", n: 1, sol: sol || SOL.slice(), theme: "Winning move", quiet: false, san: "" });

/* Bon coup a nous, bonne defense : les reponses qu'un exercice sain recoit. */
const bon = (uci) => ({ meilleur: uci, scoreMeilleur: 400, scorePropose: 400, ecart: 300 });
const defOk = (uci) => ({ meilleur: uci, scoreMeilleur: -400, scorePropose: -400 });

/* Faux moteur : la reponse n du tableau sert au n-ieme demi-coup examine. */
function faux(reponses) {
  const appels = [];
  const rendre = (fen, uci) => { appels.push(uci); const r = reponses[appels.length - 1]; return Promise.resolve(typeof r === "function" ? r(uci) : r); };
  return { appels, coup: rendre, defense: rendre };
}
const sain = () => [bon, defOk, bon, defOk, bon];

(async () => {
  try {
    console.log("\n--- Verdicts sur un coup a nous ---");
    T("un coup juste passe", verdictCoup(bon("e2e4"), "e2e4", O) === null);
    T("position non gagnante", /non gagnante/.test(verdictCoup({ meilleur: "e2e4", scoreMeilleur: 50, scorePropose: 50, ecart: 300 }, "e2e4", O)));
    T("le coup propose ne gagne pas", /ne gagne pas/.test(verdictCoup({ meilleur: "d2d4", scoreMeilleur: 400, scorePropose: 20, ecart: 300 }, "e2e4", O)));
    T("le moteur prefere un autre coup", /prefere d2d4/.test(verdictCoup({ meilleur: "d2d4", scoreMeilleur: 400, scorePropose: 380, ecart: 300 }, "e2e4", O)));
    T("deuxieme coup trop proche", /trop proche/.test(verdictCoup({ meilleur: "e2e4", scoreMeilleur: 400, scorePropose: 400, ecart: 150 }, "e2e4", O)));
    T("en souple, un autre coup gagnant passe", verdictCoup({ meilleur: "d2d4", scoreMeilleur: 400, scorePropose: 380, ecart: 10 }, "e2e4", Object.assign({}, O, { stricte: false })) === null);
    T("pas de reponse du moteur", /pas de reponse/.test(verdictCoup(null, "e2e4", O)));

    console.log("\n--- Verdicts sur une replique adverse ---");
    T("la meilleure defense passe", verdictDefense(defOk("e7e5"), "e7e5", O) === null);
    T("une defense equivalente (30 cp) passe", verdictDefense({ meilleur: "c7c5", scoreMeilleur: -400, scorePropose: -430 }, "e7e5", O) === null);
    T("une defense qui coute 120 cp ne passe pas", /non forcee/.test(verdictDefense({ meilleur: "c7c5", scoreMeilleur: -400, scorePropose: -520 }, "e7e5", O)));
    T("mate de toute facon : n'importe quelle defense passe", verdictDefense({ meilleur: "c7c5", scoreMeilleur: -100000, scorePropose: -100000 }, "e7e5", O) === null);

    console.log("\n--- Parcours d'une sequence ---");
    let m = faux(sain()), r = await examinerGain(exo(), m, O);
    T("sequence saine : gardee entiere", !r.motif && !r.tronque && r.sol.join() === SOL.join(), JSON.stringify(r.sol));
    T("sequence saine : chaque demi-coup examine", m.appels.join() === SOL.join(), m.appels.join());

    m = faux([{ meilleur: "d2d4", scoreMeilleur: 400, scorePropose: 380, ecart: 300 }]); r = await examinerGain(exo(), m, O);
    T("premier coup faux : exercice rejete", /prefere d2d4/.test(r.motif || ""), JSON.stringify(r));
    T("premier coup faux : le moteur n'est plus consulte", m.appels.length === 1, m.appels.join());

    m = faux([bon, { meilleur: "c7c5", scoreMeilleur: -400, scorePropose: -520 }]); r = await examinerGain(exo(), m, O);
    T("defense non forcee : coupe apres le premier coup", !r.motif && r.sol.join() === "e2e4", JSON.stringify(r.sol));
    T("defense non forcee : la raison est notee", /demi-coup 2 : defense non forcee/.test(r.tronque || ""), r.tronque);

    m = faux([bon, { meilleur: "c7c5", scoreMeilleur: -400, scorePropose: -430 }, bon, defOk, bon]); r = await examinerGain(exo(), m, O);
    T("defense equivalente : sequence gardee entiere", !r.tronque && r.sol.length === 5, JSON.stringify(r.sol));

    m = faux([bon, defOk, { meilleur: "g1f3", scoreMeilleur: 400, scorePropose: 400, ecart: 50 }]); r = await examinerGain(exo(), m, O);
    T("deuxieme decision ambigue : coupe avant la replique qui la precede", !r.motif && r.sol.join() === "e2e4", JSON.stringify(r.sol));
    T("deuxieme decision ambigue : le moteur s'arrete la", m.appels.length === 3, m.appels.join());

    m = faux([bon, defOk, bon, defOk, { meilleur: "f1c4", scoreMeilleur: 400, scorePropose: 350, ecart: 300 }]); r = await examinerGain(exo(), m, O);
    T("troisieme decision fausse : deux decisions gardees", !r.motif && r.sol.join() === "e2e4,e7e5,g1f3", JSON.stringify(r.sol));
    T("une sequence coupee finit sur un coup a nous", r.sol.length % 2 === 1);

    m = faux([bon]); r = await examinerGain(exo(["e2e4"]), m, O);
    T("un exercice en un coup : un seul appel au moteur", !r.tronque && m.appels.length === 1);

    console.log("\n--- La ligne coupee est recalculee ---");
    const q = couper(exo(), ["e2e4", "e7e5", "g1f3"]);
    T("san recalcule", q.san === "e4 e5 Nf3", q.san);
    T("l'original n'est pas modifie", exo().sol.length === 5);
    const qs = couper(Object.assign(exo(), { quiet: true, theme: "Deflection" }), ["e2e4"]);
    T("motif d'un coup silencieux recalcule sur la ligne coupee", typeof qs.theme === "string" && qs.theme !== "Deflection", qs.theme);
    const qn = couper(Object.assign(exo(), { theme: "Knight fork" }), ["e2e4"]);
    T("motif d'un coup non silencieux conserve", qn.theme === "Knight fork", qn.theme);
  } catch (e) { ko++; console.log("  FAIL exception -> " + e.stack); }
  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
