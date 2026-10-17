/* Minage d'exercices tactiques depuis de VRAIES parties (PGN), plutot que
   depuis de l'auto-jeu moteur. C'est la difference structurelle avec
   Lichess/Chess.com identifiee en session : ils minent des parties
   humaines reelles et cherchent ou l'evaluation bascule apres une vraie
   gaffe, plutot que de generer des positions par auto-jeu. Ce fichier fait
   la meme chose, sur n'importe quel fichier PGN qu'on lui donne.

   Usage : node mine_puzzles.js parties.pgn sortie.json [maxGames]

   Limite assumee : ce script tourne sur la machine de l'utilisateur (les
   sandbox n'a pas acces a database.lichess.org ni aux gros jeux de donnees
   de parties, restreint a une liste de domaines). Le pipeline est le meme
   qu'il tourne sur 50 parties ou 500 000 : c'est justement pense pour etre
   lance en local contre une vraie base Lichess telechargee separement.

   Etapes :
   1. Parse le PGN (coups en SAN, apparies aux coups legaux du moteur via
      round-trip sur g.san() -- pas de reimplementation de la desambiguation
      SAN, on reutilise le generateur deja teste).
   2. Rejoue chaque partie coup par coup. A chaque demi-coup a partir d'un
      ply minimum (evite les positions de theorie d'ouverture, ou "le
      meilleur coup" du moteur n'a pas de sens pedagogique), compare
      l'evaluation du meilleur coup possible a celle du coup REELLEMENT
      joue : un ecart important signale une vraie gaffe humaine.
   3. A la position qui suit la gaffe (le camp qui vient de gagner de quoi
      a jouer), verifie l'exercice avec EXACTEMENT la meme rigueur que la
      generation par auto-jeu (unicite du meilleur coup, marge, sequence
      forcee) -- miner de vraies parties ne dispense d'aucun controle
      qualite, ca change seulement d'ou vient la position de depart.
   4. Classifie (classify() corrige) et note (distractorScore()) comme
      n'importe quel autre exercice -- meme pipeline aval que gen_puzzles.
   5. Pedagogie coup juste/coup fauté (nouveaute demandee) : conserve pour
      chaque exercice le meilleur distracteur (le coup qui semblait aussi
      bon) et sa refutation concrete, pour affichage cote a cote du bon
      coup -- pas une explication generique, la vraie ligne calculee. */

const fs = require("fs");
const path = require("path");
const { Game, search, sqName, nameSq, mateIn, VAL, pType, pColor } = require(path.join(__dirname, "engine.js"));
const { classifyBase, classifyQuiet, isQuiet, isClearlyBest } = require(path.join(__dirname, "gen_puzzles_v2.js"));
const { mateLength } = require(path.join(__dirname, "gen_puzzles.js"));
const { distractorScore, isTempting, trapDepth } = require(path.join(__dirname, "difficulty_v2.js"));

/* ------------------------------------------------------------------ */
/* 1. Parsing PGN minimal : suffisant pour l'export standard (parties
   telechargees depuis Lichess/chess.com), pas pour le format "import"
   permissif complet (commentaires imbriques exotiques etc.) -- si un
   fichier reel pose probleme, la partie concernee est juste ignoree
   (comptee dans "gamesSkipped"), le reste du fichier continue. */
/* ------------------------------------------------------------------ */
function splitGames(pgnText) {
  const games = [];
  const lines = pgnText.split(/\r?\n/);
  let headers = {}, moveLines = [], inGame = false;
  const flush = () => {
    if (moveLines.length) games.push({ headers, movetext: moveLines.join(" ") });
    headers = {}; moveLines = []; inGame = false;
  };
  for (const line of lines) {
    if (/^\s*$/.test(line)) { if (inGame && moveLines.length) { /* ligne vide = fin possible */ } continue; }
    const h = line.match(/^\[(\w+)\s+"(.*)"\]\s*$/);
    if (h) {
      if (moveLines.length) flush();
      headers[h[1]] = h[2];
      inGame = true;
    } else {
      moveLines.push(line);
      inGame = true;
    }
  }
  flush();
  return games;
}

function tokenizeMovetext(movetext) {
  let s = movetext;
  s = s.replace(/\{[^}]*\}/g, " ");           // commentaires { ... }
  s = s.replace(/;[^\n]*/g, " ");              // commentaires ; jusqu'a fin de ligne
  let prevLen;
  do { prevLen = s.length; s = s.replace(/\([^()]*\)/g, " "); } while (s.length !== prevLen); // variations, y compris imbriquees
  s = s.replace(/\$\d+/g, " ");                // NAG
  s = s.replace(/\d+\.(\.\.)?/g, " ");         // numeros de coup "12." ou "12..."
  s = s.replace(/1-0|0-1|1\/2-1\/2|\*/g, " "); // resultat
  return s.split(/\s+/).filter(Boolean);
}

function moveFromSan(g, token) {
  let clean = token.replace(/[+#!?]+$/, "");
  if (clean === "0-0" || clean === "O-O") clean = "O-O";
  else if (clean === "0-0-0" || clean === "O-O-O") clean = "O-O-O";
  for (const m of g.moves()) {
    if (g.san(m).replace(/[+#]+$/, "") === clean) return m;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* 2-3. Detection de gaffe + extraction, avec la meme rigueur que
   makePuzzleV2 (gen_puzzles_v2.js) -- code volontairement duplique plutot
   que factorise a chaud : makePuzzleV2 part d'une position DEJA choisie
   pour son evaluation favorable, ici on part d'une partie qui vient de
   confirmer par le jeu reel que le camp au trait a une opportunite,
   suffisamment different pour ne pas forcer une factorisation fragile
   sous contrainte de temps. */
/* ------------------------------------------------------------------ */
function rankMovesLocal(g, depth, timeMs) {
  const legal = g.moves();
  const scored = legal.map(mv => {
    const c = new Game(g.fen());
    const full = c.moves().find(m => m.from === mv.from && m.to === mv.to && m.promo === mv.promo);
    c.makeMove(full);
    return { mv, score: -search(c, depth, timeMs).score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/* ------------------------------------------------------------------ */
/* Trivialite du premier coup (2026-09-14).

   Mesure a l'origine de ce filtre : sur toute la banque, 53,9 % des gains a
   un demi-coup avaient pour solution une prise qu'il n'y a rien a calculer
   pour trouver. C'est exactement ce qu'on reproche a la bibliotheque.

   Deux formes, toutes les deux purement geometriques, sans moteur :
     - la piece prise n'est defendue par personne. On regarde APRES le coup
       si la case d'arrivee est attaquee par l'adversaire : c'est la seule
       question qui decide, et elle tient compte des defenses qui se
       decouvrent ou disparaissent en jouant ;
     - la piece prise vaut strictement plus que celle qui prend. Meme
       reprise, le compte reste favorable : il n'y a pas de decision.

   Ce qui n'est PAS trivial et doit passer : un sacrifice, une prise d'egale
   valeur sur case defendue (il faut calculer la suite), tout coup qui ne
   prend rien. */
function trivialite(g, mv) {
  const pris = g.board[mv.to];
  if (!pris) return null;
  const qui = g.board[mv.from];
  if (!qui) return null;
  if ((VAL[pType(pris)] || 0) > (VAL[pType(qui)] || 0)) return "prend plus cher";
  const apres = new Game(g.fen());
  const complet = apres.moves().find(m => m.from === mv.from && m.to === mv.to && m.promo === mv.promo);
  if (!complet) return null;
  const nous = pColor(qui);
  apres.makeMove(complet);
  if (!apres.attacked(mv.to, nous ^ 1)) return "prise gratuite";
  return null;
}

/* ------------------------------------------------------------------ */
function extractPuzzleAt(g, opts) {
  const depth = opts.depth || 3;
  const MATE = 100000;

  const rough = rankMovesLocal(g, 2, 500);
  if (rough.length < 2) return null;
  const confirmed = rough.slice(0, 2).map(r => {
    const c = new Game(g.fen());
    const m2 = c.moves().find(m => m.from === r.mv.from && m.to === r.mv.to && m.promo === r.mv.promo);
    c.makeMove(m2);
    return { mv: r.mv, score: -search(c, depth - 1, 1500).score };
  }).sort((a, b) => b.score - a.score);
  const best = confirmed[0], second = confirmed[1];
  if (best.mv !== rough[0].mv) return null;

  const isMate = best.score > MATE - 100;
  if (!isMate) {
    if (best.score < 200) return null;
    if (best.score - second.score < 200) return null;
    /* Filtre de trivialite (2026-09-14). Pose ICI, avant les recherches
       couteuses qui suivent : une prise evidente est rejetee sans qu'on ait
       paye le controle robuste ni le prolongement. opts.garderPrisesSimples
       rend l'ancien comportement, pour comparer deux passes. */
    if (!opts.garderPrisesSimples && trivialite(g, best.mv)) return null;
  } else if (second.score > MATE - 100) return null;

  /* Controle final robuste, budget de recherche genereux et fixe (pas de
     court-circuit sur un simple classement rapide) : trouvaille de session
     -- des budgets courts (500-1500ms) evalues sous charge systeme
     soutenue (des heures de minage d'affilee) pouvaient rendre une
     recherche incomplete, laissant passer un coup qui perd en fait la
     piece qui vient de bouger (ex: Dxg5+ rejouable par un fou adjacent).
     Ce filtre rejoue explicitement le meilleur coup adverse ave un budget
     large et verifie que la position reste bien favorable -- plus lent
     (chaque exercice retenu coute une recherche de plus), mais c'est le
     prix de la fiabilite reelle plutot que suppose. */
  if (!isMate) {
    const cCheck = new Game(g.fen());
    const mvCheck = cCheck.moves().find(m => m.from === best.mv.from && m.to === best.mv.to && m.promo === best.mv.promo);
    cCheck.makeMove(mvCheck);
    if (cCheck.moves().length > 0) {
      const robust = -search(cCheck, 3, 3000).score;
      if (robust < 100) return null;
    }
  }

  const gBefore = g.inCheck && g.inCheck();
  if (gBefore && !isMate) return null; // deja en echec au depart : ambigu pour un "gain"

  /* Meme definition que gen_puzzles_v2 plutot qu'une seconde ecrite ici :
     isQuiet() ecarte en plus les coups qui donnent echec. Un echec n'est
     pas un coup silencieux, et l'ancien test local (case d'arrivee vide)
     les laissait passer (2026-09-13). */
  const quiet = !isMate && isQuiet(g, best.mv);

  /* Sequence complete pour les mats (meme correctif que celui applique a
     la banque existante : "Mate in two" a besoin de 3 demi-coups -- nous,
     adversaire, nous -- pas d'un seul). mateLength() verifie exhaustivement
     que TOUTE reponse adverse mene au mat, mateIn() renvoie le coup a
     chaque etape ; on rejoue avec le VRAI meilleur coup adverse a chaque
     pli intermediaire plutot que de supposer. */
  let solMoves = [best.mv];
  let mateLen = 0;
  if (isMate) {
    mateLen = mateLength(g);
    if (!mateLen) return null;
    const g2 = new Game(g.fen());
    solMoves = [];
    for (let i = 0; i < mateLen; i++) {
      const m = mateIn(g2, mateLen - i);
      if (!m) break;
      solMoves.push(m);
      g2.makeMove(m);
      if (g2.moves().length === 0) break;
      const r = search(g2, depth - 1, 800);
      if (!r.move) break;
      const oppFull = g2.moves().find(x => x.from === r.move.from && x.to === r.move.to && x.promo === r.move.promo);
      if (!oppFull) break;
      solMoves.push(oppFull);
      g2.makeMove(oppFull);
    }
    if (!solMoves.length) return null;
  }

  /* Prolongement de TOUS les gains (2026-09-14, etendu depuis les seuls
     coups silencieux du 2026-09-13).

     Le prolongement avait ete restreint aux coups silencieux pour deux
     raisons. La premiere ne tient plus : "prolonger tous les gains
     couterait deux fois plus cher". Mesure : 243 ms par position candidate,
     0,122 candidat par partie, sur 1 152 ms de minage par partie, soit
     2,6 % de temps en plus. L'estimation se trompait d'un facteur quarante,
     et elle a coute une banque ou 99,0 % des gains tiennent en un demi-coup.

     La seconde tient, mais n'est plus un conflit : un gain a plusieurs
     coups ne peut pas porter de coups equivalents (champ `alt`). Les
     positions ou plusieurs coups gagnaient egalement sont precisement les
     prises evidentes que le filtre de trivialite ecarte desormais, et ui.js
     ne consulte `alt` que si sol.length vaut 1.

     Chacun de NOS coups repasse isClearlyBest() : si l'unicite casse, la
     ligne est tronquee la. Mesure sur 400 positions non triviales : 69,8 %
     tiennent au moins 2 decisions, 19,1 % en tiennent 3 ou 4. Au-dela,
     plus rien ne passe isClearlyBest, d'ou la limite MAX_PROLONGE.

     ATTENTION : seul le premier coup est valide par filtre_stockfish.js.
     Les coups suivants ne le sont que par le moteur maison, a faible
     profondeur. A etendre avant toute mise en ligne. */
  const MAX_PROLONGE = 3;
  if (!isMate) {
    const g2 = new Game(g.fen());
    let courant = g2.moves().find(m => m.from === best.mv.from && m.to === best.mv.to && m.promo === best.mv.promo);
    for (let tour = 0; tour < MAX_PROLONGE && courant; tour++) {
      g2.makeMove(courant);
      courant = null;
      if (g2.moves().length === 0) break;
      const rOpp = search(g2, depth - 1, 3000);
      const oppFull = rOpp.move && g2.moves().find(m => m.from === rOpp.move.from && m.to === rOpp.move.to && m.promo === rOpp.move.promo);
      if (!oppFull) break;
      g2.makeMove(oppFull);
      if (g2.moves().length === 0) break;
      const rMine = search(g2, depth - 1, 3000);
      const mineFull = rMine.move && g2.moves().find(m => m.from === rMine.move.from && m.to === rMine.move.to && m.promo === rMine.move.promo);
      if (!mineFull || !isClearlyBest(g2, mineFull, depth - 1)) break;
      solMoves = solMoves.concat([oppFull, mineFull]);
      courant = mineFull;
    }
  }

  /* classifyQuiet a besoin de la ligne entiere, classifyBase du seul
     premier coup. Un coup silencieux dont la ligne n'a pas pu etre
     prolongee ressort en "Quiet move", ce qui reste vrai. */
  const theme = quiet
    ? classifyQuiet(g, solMoves.map(mv => ({ mv })))
    : classifyBase(g, best.mv, isMate, mateLen);

  const gSan = new Game(g.fen());
  const sanParts = [], uciParts = [];
  for (const mv of solMoves) {
    const full = gSan.moves().find(m => m.from === mv.from && m.to === mv.to && m.promo === mv.promo);
    if (!full) break;
    sanParts.push(gSan.san(full));
    /* Serialisation UCI de la promotion : passe par g.uci(), la seule
       source de verite du moteur (correctif 2026-09-09). La table locale
       "qrbn"[promo-2] etait ecrite a l'envers des constantes du moteur
       (N=2, BI=3, R=4, Q=5) : une promotion en dame ressortait en "n",
       une en cavalier en "q". Invisible pendant des mois parce que
       verifyFull() cherchait le coup sur from/to seuls et retrouvait donc
       toujours une promotion, n'importe laquelle. 1110 exercices de la
       banque en portent la trace, dont 893 gains qui refusent la dame et
       exigent le cavalier. */
    uciParts.push(gSan.uci(full));
    gSan.makeMove(full);
  }

  return {
    fen: g.fen(), type: isMate ? "mate" : "gain", n: isMate ? mateLen : 1,
    sol: uciParts, theme: theme.theme, explain: theme.detail, quiet, san: sanParts.join(" "),
    margin: isMate ? 9999 : best.score - second.score
  };
}

/* Pedagogie : le meilleur distracteur (coup qui semblait aussi bon) avec
   sa refutation reelle, pas une explication generique. Reutilise
   isTempting()/trapDepth() de difficulty_v2.js -- meme definition de
   "tentant" que celle qui sert a noter la difficulte, pas une deuxieme
   notion inventee en parallele qui risquerait de diverger. */
function bestDistractorExplanation(fen, solUci) {
  const g = new Game(fen);
  const from = nameSq(solUci.slice(0, 2)), to = nameSq(solUci.slice(2, 4));
  let worst = null;
  for (const mv of g.moves()) {
    if (mv.from === from && mv.to === to) continue;
    const { tempting, after } = isTempting(g, mv);
    if (!tempting) continue;
    const gSan = new Game(g.fen());
    const full = gSan.moves().find(m => m.from === mv.from && m.to === mv.to && m.promo === mv.promo);
    const candidateSan = gSan.san(full);
    /* refutation concrete : le meilleur coup adverse APRES ce distracteur,
       calcule reellement (pas suppose) -- c'est cette ligne, precise, qui
       rend l'explication vraie plutot que plausible. */
    const r = search(after, 3, 800);
    if (!r.move) continue;
    const afterSan = new Game(after.fen());
    const refFull = afterSan.moves().find(m => m.from === r.move.from && m.to === r.move.to && m.promo === r.move.promo);
    const refSan = refFull ? afterSan.san(refFull) : null;
    const depth = trapDepth(after, 60, 300);
    const entry = { candidateSan, refutationSan: refSan, evalAfterRefutation: -r.score, trapDepth: depth };
    if (!worst || depth > worst.trapDepth) worst = entry;
  }
  return worst;
}

/* ------------------------------------------------------------------ */
/* Boucle principale : rejoue chaque partie, detecte les gaffes. */
/* ------------------------------------------------------------------ */
/* Le motif d'un exercice depend du coup solution, qu'on ne connait qu'apres
   la recherche moteur : impossible de filtrer sur le motif lui-meme avant de
   payer. On teste donc une condition NECESSAIRE, purement geometrique : la
   position peut-elle seulement produire ce motif ? Si aucun coup legal ne
   peut le donner, inutile d'evaluer.
   Large a dessein. Un faux positif ne coute qu'une evaluation qu'on aurait
   faite de toute facon ; un faux negatif perdrait un exercice pour toujours,
   sans que rien ne le signale. En cas de doute on garde. */
function peutDonnerMotif(g, motifs) {
  const P = 1, N = 2, BI = 3, R = 4, Q = 5, K = 6;
  const pT = p => p & 7, pC = p => p >> 3, onB = s => !(s & 0x88);
  const glissantes = { [BI]: [15, 17, -15, -17], [R]: [1, -1, 16, -16], [Q]: [1, -1, 16, -16, 15, 17, -15, -17] };
  for (const mv of g.moves()) {
    const piece = g.board[mv.from];
    if (!piece) continue;
    const t = pT(piece), moi = pC(piece), eux = moi ^ 1;
    /* Deviation et coup tranquille : un coup qui ne prend rien. Ne filtre
       quasiment rien en pratique (mesure : 100 % retenus), n'utiliser une
       passe ciblee pour eux n'a donc aucun interet. */
    if ((motifs.has("Deflection") || motifs.has("Quiet move")) && !g.board[mv.to]) return true;
    /* Fourchettes : le coup doit attaquer au moins deux pieces adverses
       depuis sa case d'arrivee. On simule la case sans rejouer la partie. */
    const veutFourchette = (motifs.has("Pawn fork") && t === P)
      || (motifs.has("Knight fork") && t === N)
      || motifs.has("Double attack");
    const veutLigne = (motifs.has("Pin") || motifs.has("Skewer")) && glissantes[t];
    if (!veutFourchette && !veutLigne) continue;
    const apres = new Game(g.fen());
    const complet = apres.moves().find(m => m.from === mv.from && m.to === mv.to && m.promo === mv.promo);
    if (!complet) continue;
    apres.makeMove(complet);
    const cibles = [];
    /* On lit la piece REELLEMENT posee sur la case d'arrivee, pas celle qui
       est partie : une promotion transforme le pion en dame, et le
       classificateur calcule alors les cibles avec la geometrie de la dame
       tout en gardant l'etiquette "Pawn fork". Utiliser la geometrie du pion
       perdait ces cas -- un sur trois cents, mesure. */
    const arrivee = pT(apres.board[mv.to]) || t;
    const dirs = glissantes[arrivee];
    if (dirs) {
      for (const d of dirs) { let x = mv.to + d;
        while (onB(x)) { if (apres.board[x]) { cibles.push(x); break; } x += d; } }
    } else if (arrivee === N) {
      for (const d of [14, 18, 31, 33, -14, -18, -31, -33]) { const x = mv.to + d; if (onB(x) && apres.board[x]) cibles.push(x); }
    } else if (arrivee === P) {
      /* Attention au signe : l'index de case descend depuis la rangee 8
         (b7 vaut 17, a8 vaut 0), donc un pion BLANC avance en soustrayant
         16, pas en ajoutant. Le sens inverse faisait rejeter 96 % des
         positions qui donnaient reellement une fourchette de pion, sans
         qu'aucune erreur ne soit levee : le filtre regardait deux cases
         vides derriere le pion. */
      const av = moi === 0 ? -16 : 16;
      for (const d of [av - 1, av + 1]) { const x = mv.to + d; if (onB(x) && apres.board[x]) cibles.push(x); }
    }
    const adverses = cibles.filter(s => pC(apres.board[s]) === eux);
    /* Le roi COMPTE comme cible de fourchette : targets() (gen_puzzles_v2.js)
       le retient explicitement, et une fourchette de pion est tres souvent un
       echec double d'une attaque sur une piece. L'exclure faisait rejeter 96 %
       des positions qui avaient reellement donne une fourchette de pion -- un
       faux negatif massif et silencieux, mesure avant d'etre corrige. */
    if (veutFourchette && adverses.length >= 2) return true;
    if (veutLigne && adverses.length >= 1) return true;
  }
  return false;
}
/* Provenance d'un exercice (2026-09-14 : elargie). Le PGN est deja parse
   en entier, ces en-tetes sont gratuites : les jeter puis vouloir
   dedoublonner par partie ou par ouverture obligerait a tout re-miner.
   Site porte l'identifiant de partie Lichess. Les champs absents sont omis
   plutot qu'ecrits vides. */
function sourceDe(h, ply) {
  const s = { event: h.Event || "", white: h.White || "", black: h.Black || "", ply };
  if (h.Site) s.site = h.Site;
  if (h.ECO) s.eco = h.ECO;
  if (h.Opening) s.opening = h.Opening;
  if (h.UTCDate || h.Date) s.date = h.UTCDate || h.Date;
  if (h.TimeControl) s.timeControl = h.TimeControl;
  if (h.WhiteElo && h.BlackElo) s.elo = Math.round((+h.WhiteElo + +h.BlackElo) / 2);
  return s;
}

function mineFromPgn(pgnText, opts) {
  opts = opts || {};
  const minPly = opts.minPly || 12;
  const blunderThreshold = opts.blunderThreshold || 250; // centipawns perdus par le coup joue
  const maxPerGame = opts.maxPerGame || 2; // evite qu'une seule partie catastrophique inonde le lot
  const depth = opts.depth || 3;
  const maxGames = opts.maxGames || Infinity;
  const minElo = opts.minElo || 0;
  /* Ensemble de motifs recherches, ou null pour une passe ordinaire. */
  const motifsVoulus = opts.motifs && opts.motifs.length ? new Set(opts.motifs) : null;

  const games = splitGames(pgnText);
  const found = [];
  let gamesParsed = 0, gamesSkipped = 0, gamesFiltered = 0;

  for (let gi = 0; gi < games.length && (gamesParsed + gamesSkipped) < maxGames; gi++) {
    const game = games[gi];
    if (opts.onProgress && gi % 50 === 0) opts.onProgress(gi, Math.min(games.length, maxGames), found);

    /* Filtre de niveau : mine par ex. exclusivement des parties ou les
       deux joueurs depassent minElo. Trouvaille de session : a ~1100-1200
       Elo (echantillon FICS amateur), 0 exercice sur 1751 n'avait de vrai
       piege profond (un distracteur qui semble bon a vue mais s'effondre
       seulement en profondeur) -- les gaffes a ce niveau sont surtout des
       pieces qui trainent, pas des pieges subtils. Des joueurs plus forts
       distribuent des gaffes plus fines, exactement ce que "trapDepth>0"
       cherche a capter. */
    if (minElo > 0) {
      const we = +game.headers.WhiteElo || 0, be = +game.headers.BlackElo || 0;
      if (we < minElo || be < minElo) { gamesFiltered++; continue; }
    }

    const tokens = tokenizeMovetext(game.movetext);
    if (!tokens.length) { gamesSkipped++; continue; }
    let g;
    try { g = new Game(); } catch (e) { gamesSkipped++; continue; }
    let ply = 0, foundThisGame = 0, broke = false;

    for (const token of tokens) {
      const mv = moveFromSan(g, token);
      if (!mv) { broke = true; break; }

      if (ply >= minPly && foundThisGame < maxPerGame) {
        /* evalue AVANT le coup joue (point de vue du camp au trait).
           Budgets courts (comme le sourcing guide de gen_puzzles_v2.js) :
           ce n'est qu'un detecteur de gaffe grossier, la vraie rigueur
           (extractPuzzleAt, plus lente) n'intervient qu'une fois un ecart
           deja repere, pas a chaque demi-coup de chaque partie. */
        const c = new Game(g.fen());
        const full = c.moves().find(m => m.from === mv.from && m.to === mv.to && m.promo === mv.promo);
        c.makeMove(full);
        /* Passe ciblee (2026-09-07) : quand on ne cherche QU'UN motif precis,
           on ecarte d'abord geometriquement, sans moteur. Les deux recherches
           ci-dessous coutent jusqu'a 120 ms par demi-coup et representent
           l'essentiel du temps de minage ; le test geometrique coute quelques
           microsecondes.
           Mesure sur la banque : ce filtre ne retient que 2 % des positions
           pour la fourchette de pion, d'ou une passe ~50x plus rapide. Il ne
           sert a RIEN pour le clouage (96 % retenus) ni pour la deviation
           (100 %), ou il n'y a pas de raccourci a esperer : dans ces cas on
           lance une passe ordinaire, sans --motifs.
           Le critere est une condition NECESSAIRE et volontairement large :
           il ne doit jamais ecarter une position qui aurait pu donner le
           motif, seulement celles qui ne le peuvent pas. */
        if (motifsVoulus && !peutDonnerMotif(c, motifsVoulus)) { g.makeMove(mv); ply++; continue; }
        const before = search(g, 2, 60).score;
        const afterPlayed = -search(c, 2, 60).score;
        if (before - afterPlayed >= blunderThreshold) {
          const p = extractPuzzleAt(c, { depth });
          if (p) {
            const distractor = bestDistractorExplanation(p.fen, p.sol[0]);
            const scored = distractorScore(p.fen, p.sol[0], p.quiet, { timeMsShallow: 60, timeMsDeep: 250, maxCandidates: 10 });
            found.push({ ...p, diff: scored.score, pedagogy: distractor, source: sourceDe(game.headers, ply) });
            foundThisGame++;
          }
        }
      }
      g.makeMove(mv);
      ply++;
    }
    if (broke) gamesSkipped++; else gamesParsed++;
  }
  return { found, gamesParsed, gamesSkipped, gamesFiltered };
}

module.exports = { mineFromPgn, splitGames, tokenizeMovetext, moveFromSan, extractPuzzleAt, bestDistractorExplanation, peutDonnerMotif, extractGameChunk, trivialite, sourceDe };

/* Lecture en flux du fichier PGN source : un dump Lichess decompresse fait
   facilement plusieurs dizaines de Go, bien au-dela de ce qu'un simple
   fs.readFileSync() peut charger en memoire d'un coup. On lit ligne par
   ligne via un vrai flux (fs.createReadStream) et on FERME le flux des
   qu'on a accumule assez de PARTIES BRUTES (pas d'exercices) -- le reste
   du fichier, potentiellement des dizaines de Go, n'est jamais lu du
   disque. overreadFactor estime combien de parties brutes lire pour en
   garder maxGames apres le filtre minElo (defaut prudent : viser 30 fois
   plus de parties brutes que d'exercices desires, ajuster a la hausse si
   le filtre minElo est tres eleve et rate beaucoup de parties). */
/* sauter (2026-09-14) : nombre de parties BRUTES a passer avant d'accumuler.
   Sans lui la lecture repart toujours de la premiere partie, et comme le
   garde-fou plafonne a 500 000, deux passes sur le meme PGN lisent le meme
   demi-million de parties : la seconde ne produit que des doublons, que
   merge_puzzles.js rejette apres des heures de calcul. Compte AVANT le
   filtre minElo : c'est la seule position reproductible d'une passe a
   l'autre. */
function extractGameChunk(pgnPath, maxGames, overreadFactor, sauter) {
  const readline = require("readline");
  const target = Math.min(maxGames * overreadFactor, 500000); // garde-fou absolu
  const debut = Math.max(0, sauter || 0);
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(pgnPath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    const lines = [];
    let count = 0, closed = false;
    rl.on("line", (line) => {
      if (closed) return;
      if (line.startsWith('[Event "')) {
        count++;
        if (count > debut + target) {
          closed = true;
          rl.close();
          stream.destroy(); // arrete reellement la lecture disque, pas juste l'iteration
          return;
        }
      }
      /* Tout ce qui precede la (debut+1)-eme partie est jete, en-tetes
         comprises : on ne garde pas une moitie de partie sautee. */
      if (count <= debut) return;
      lines.push(line);
    });
    rl.on("close", () => resolve(lines.join("\n")));
    stream.on("error", reject);
  });
}

if (require.main === module) {
  const pgnPath = process.argv[2];
  const outPath = process.argv[3] || "mined_puzzles.json";
  const maxGames = +process.argv[4] || 5000;
  const minElo = +process.argv[5] || 1800;
  const overreadFactor = +process.argv[6] || 30;
  /* --motifs=Pawn fork,Knight fork : passe CIBLEE. N'a d'interet que pour les
     motifs que la geometrie sait ecarter, en pratique les fourchettes. Pour
     tout le reste, lancer sans cette option : le filtre ne retiendrait rien
     et on aurait paye un test pour rien. */
  const argMotifs = process.argv.find(a => a.startsWith("--motifs="));
  const motifs = argMotifs ? argMotifs.slice("--motifs=".length).split(",").map(x => x.trim()).filter(Boolean) : null;
  /* --sauter=N : reprend la lecture apres les N premieres parties brutes. */
  const argSauter = process.argv.find(a => a.startsWith("--sauter="));
  const sauter = argSauter ? +argSauter.slice("--sauter=".length) || 0 : 0;
  if (!pgnPath) {
    console.error("Usage: node mine_puzzles.js parties.pgn sortie.json [maxGames=5000] [minElo=1800] [overreadFactor=30] [--motifs=A,B] [--sauter=N]");
    process.exit(1);
  }
  (async () => {
    console.error("Lecture en flux du fichier (s'arrete des qu'assez de parties brutes sont accumulees, pas besoin de lire le fichier entier)...");
    if (sauter) console.error(`Saut des ${sauter} premieres parties brutes.`);
    const pgnText = await extractGameChunk(pgnPath, maxGames, overreadFactor, sauter);
    console.error(`Extrait charge : ${(pgnText.length / 1e6).toFixed(1)} Mo.`);
    const t0 = Date.now();
    const { found, gamesParsed, gamesSkipped, gamesFiltered } = mineFromPgn(pgnText, {
      maxGames: maxGames * overreadFactor, minElo, motifs,
      /* Sauvegarde intermediaire (nouveaute) : ecrit l'etat courant a
         chaque point de progression (tous les 50 parties), pas seulement
         a la toute fin. Sur un vrai dump Lichess la duree totale est
         imprevisible (des heures selon combien de parties passent le
         filtre minElo) -- sans ca, interrompre le script en cours de
         route (redemarrage force, coupure) perdait tout le travail deja
         fait. Cout : une ecriture disque de plus toutes les 50 parties,
         negligeable face au risque evite. */
      onProgress: (i, total, found) => {
        process.stderr.write(`\r${i}/${total} parties, ${found.length} exercices mines (${((Date.now()-t0)/1000).toFixed(0)}s)`);
        fs.writeFileSync(outPath, JSON.stringify(found, null, 1));
      }
    });
    process.stderr.write("\n");
    fs.writeFileSync(outPath, JSON.stringify(found, null, 1));
    console.log(JSON.stringify({
      gamesParsed, gamesSkipped, gamesFiltered, exercicesMines: found.length,
      tempsSeconds: Math.round((Date.now() - t0) / 100) / 10
    }, null, 1));
  })();
}
