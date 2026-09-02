/* Nouvelle formule de difficulte, construite autour des DISTRACTEURS plutot
   que de la complexite du plateau (nb de pieces, nb de coups legaux :
   l'ancienne formule dans rebin_levels.js). Preuve que l'ancienne ne
   mesurait pas la bonne chose : p305, niveau 9/10 sous l'ancien systeme,
   diff 45.6 -- la dame descend, croque une tour qui trainait, mat
   immediat. Un coup, aucune alternative tentante a ecarter, aucun calcul.

   Principe : un coup est dur a trouver quand d'AUTRES coups semblent
   AUSSI bons a vue (d'autres prises, d'autres echecs) et se revelent
   perdants -- et d'autant plus dur que ces alternatives ne s'ecroulent
   qu'a un examen plus profond (piege reel, pas juste refute au premier
   coup d'oeil).

   Pour chaque exercice :
   1. Enumere les coups "tentants" a la position de depart (autre que la
      solution) : toute prise, tout echec. Les coups qui ne font ni l'un
      ni l'autre sont ignores -- un humain ne les considere pas serieusement
      comme candidats face a un coup qui gagne du materiel ou mate.
   2. Pour chacun, compare une evaluation courte (depth 1, l'impression a
      vue) a une evaluation plus longue (depth 3, apres reflexion) DU POINT
      DE VUE DE CELUI QUI A JOUE CE COUP-LA (score inverse pour l'adversaire
      qui repond au mieux). Si le coup semblait bon a vue (score court > 0)
      mais s'effondre a l'examen (score long trs inferieur), c'est un vrai
      piege : ecart compte comme profondeur de piege.
   3. Score final = nb de distracteurs (poids modere, un piege qui ne trompe
      personne longtemps compte peu) + somme des profondeurs de piege (poids
      fort, c'est la vraie mesure de "il faut calculer pour ne pas se faire
      avoir") + bonus coup silencieux (repris tel quel, toujours pertinent :
      un coup qui ne capture rien et ne fait pas echec est intrinsequement
      plus dur a envisager en premier lieu).

   Volontairement PAS de bonus lie au nombre de pieces ou de coups legaux :
   mesurer la difficulte du PLATEAU au lieu de la difficulte du COUP est
   precisement le defaut qu'on corrige. */

const path = require("path");
const { Game, search, nameSq } = require(path.join(__dirname, "engine.js"));

function isTempting(g, mv) {
  const isCapture = !!g.board[mv.to];
  const c = new Game(g.fen());
  const full = c.moves().find(m => m.from === mv.from && m.to === mv.to && m.promo === mv.promo);
  if (!full) return { tempting: false };
  c.makeMove(full);
  const givesCheck = c.inCheck();
  return { tempting: isCapture || givesCheck, after: c };
}

/* trapDepth : a quel point ce distracteur s'effondre-t-il seulement a un
   examen plus profond ? 0 si le probleme est deja visible a depth 1 (pas
   un vrai piege, juste un mauvais coup evident), positif si l'ecart entre
   depth-1 et depth-3 est significatif (le coup "a l'air bon" en surface). */
function trapDepth(afterMv, timeMsShallow, timeMsDeep) {
  const shallow = -search(afterMv, 1, timeMsShallow).score;
  const deep = -search(new Game(afterMv.fen()), 3, timeMsDeep).score;
  if (shallow > -50 && deep < shallow - 150) {
    return Math.min(3, Math.round((shallow - deep) / 150));
  }
  return 0;
}

/* Calcule le score de difficulte "distracteurs" pour un exercice. Ne
   regarde QUE le premier coup de la solution (le coup que le joueur doit
   trouver en premier, celui ou se joue la reconnaissance du motif) : les
   coups suivants d'une sequence multi-coups sont, une fois le bon premier
   coup trouve, contraints par la reponse adverse -- pas un choix ouvert
   avec de vrais distracteurs au meme sens. */
function distractorScore(fen, solFirstUci, quiet, opts) {
  opts = opts || {};
  const timeMsShallow = opts.timeMsShallow || 60;
  const timeMsDeep = opts.timeMsDeep || 200;
  const maxCandidates = opts.maxCandidates || 8;

  const g = new Game(fen);
  const from = nameSq(solFirstUci.slice(0, 2)), to = nameSq(solFirstUci.slice(2, 4));
  const legal = g.moves();
  let distractors = 0, trapSum = 0, examined = 0;
  for (const mv of legal) {
    if (mv.from === from && mv.to === to) continue;
    const { tempting, after } = isTempting(g, mv);
    if (!tempting) continue;
    distractors++;
    if (examined >= maxCandidates) continue; // plafond pour le temps de calcul, pas pour le compte
    examined++;
    trapSum += trapDepth(after, timeMsShallow, timeMsDeep);
  }
  const score = distractors * 4 + trapSum * 18 + (quiet ? 30 : 0);
  return { score: Math.round(score * 10) / 10, distractors, trapSum };
}

module.exports = { distractorScore, isTempting, trapDepth };
