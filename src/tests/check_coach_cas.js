/* Verification automatique de chang64.
   Lancement : node tests/check_coach_cas.js

   Ce que ce test garde (2026-11-22) : les cas du coach de relecture
   (coach.js). Chaque cas a sa position temoin, ou il doit etre reconnu, et
   au moins une position voisine ou il ne doit PAS l'etre (faux positif).
   La regle : une phrase n'est dite que si son fait est vrai sur l'echiquier.
   Le 21/11, 28 761 phrases d'explication d'exercices etaient fausses, surtout
   « rien ne defend X » : c'est exactement ce qu'on verrouille ici. */
const path = require("path");
const { Game } = require(path.join(__dirname, "..", "engine.js"));
const COACH = require(path.join(__dirname, "..", "coach.js"));
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + JSON.stringify(d) : "")); } };
const E = d => COACH.expliquer(Game, d);
const cas = e => (e ? e.cas : null);

console.log("--- Pat ---");
{
  const fen = "5k2/5P2/4K3/8/8/8/8/8 w - - 0 1";
  const e = E({ fen, coup: "e6f6", meilleur: "e6d6" });
  T("Rf6 fait pat : reconnu", cas(e) === "pat" && e.mieux === "e6d6", e);
  T("un autre coup du roi ne fait pas pat", cas(E({ fen, coup: "e6d6", meilleur: "e6e5" })) !== "pat");
}

console.log("--- Mat en un manque ---");
{
  const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
  const e = E({ fen, coup: "h5g5", meilleur: "h5f7" });
  T("Dxf7 matait : reconnu, avec le coup qui mate", cas(e) === "mat1_manque" && e.coup === "h5f7" && e.de === "avant", e);
  T("le coup cite mate vraiment", (() => { const g = new Game(fen); g.makeMove(g.moveFromUci(e.coup)); return g.isCheckmate(); })());
  T("si le joueur a mate, rien a expliquer", E({ fen, coup: "h5f7", meilleur: "h5f7" }) === null);
  const sans = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
  T("sans mat en un sur l'echiquier, pas de phrase de mat", cas(E({ fen: sans, coup: "a2a3", meilleur: "d2d3" })) !== "mat1_manque");
}

console.log("--- Mat en un permis ---");
{
  const fen = "rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2";
  const e = E({ fen, coup: "g2g4", meilleur: "e2e4", reponse: "d8h4" });
  T("g4 permet Dh4 mat : reconnu", cas(e) === "mat1_permis" && e.coup === "d8h4" && e.mieux === "e2e4" && e.de === "apres", e);
  T("un coup qui ne permet pas le mat : rien", cas(E({ fen, coup: "e2e4", meilleur: "d2d4", reponse: "b8c6" })) !== "mat1_permis");
  /* Le mat etait inevitable : le meilleur coup le permet aussi, donc ce coup n'y est pour rien. */
  const perdu = "6k1/8/8/8/8/5q2/7r/7K w - - 0 1";
  const g = new Game(perdu), coups = g.moves().map(m => g.uci(m));
  T("mat inevitable quel que soit le coup : pas de phrase", coups.length >= 1 && cas(E({ fen: perdu, coup: coups[0], meilleur: coups[coups.length - 1] === coups[0] ? null : coups[coups.length - 1] })) !== "mat1_permis", coups);
}

console.log("--- Mat en deux manque ---");
{
  const fen = "r5k1/5ppp/8/8/8/8/3R4/3R2K1 w - - 0 1";
  const e = E({ fen, coup: "g1h1", meilleur: "d2d8" });
  T("Td8+ puis mat : reconnu", cas(e) === "mat2_manque" && e.coup === "d2d8", e);
  T("le mat en deux est force (controle par les regles)", (() => { const g = new Game(fen); return COACH.forceMat(g, 2) && !COACH.forceMat(g, 1); })());
  T("le moteur n'annonce pas de mat : le mat en deux n'est pas cherche", cas(E({ fen, coup: "g1h1", meilleur: "d2d8", mateAvant: null, mateApres: null })) !== "mat2_manque");
  T("le moteur annonce mat en 2 : reconnu", cas(E({ fen, coup: "g1h1", meilleur: "d2d8", mateAvant: 2, mateApres: null })) === "mat2_manque");
  const sans = "r5k1/5ppp/8/8/8/8/3R4/6K1 w - - 0 1";
  T("une seule tour : pas de mat en deux", cas(E({ fen: sans, coup: "g1h1", meilleur: "d2d7" })) !== "mat2_manque");
}

console.log("--- Mat en deux permis ---");
{
  const fen = "3r2k1/3r4/8/8/8/8/P4PPP/R5K1 w - - 0 1";
  const e = E({ fen, coup: "a2a3", meilleur: "g2g3", reponse: "d7d1" });
  T("a3 laisse Td1+ puis mat : reconnu", cas(e) === "mat2_permis" && e.coup === "d7d1" && e.mieux === "g2g3", e);
  T("g3 donne une case au roi : pas de mat en deux", cas(E({ fen, coup: "g2g3", meilleur: "h2h3", reponse: "d7d1" })) !== "mat2_permis");
}

console.log("--- Prise perdante ---");
{
  const fen = "r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3";
  const e = E({ fen, coup: "h5e5", meilleur: "g1f3", reponse: "c6e5" });
  T("Dxe5 sur un pion defendu : reconnu", cas(e) === "prise_perdante" && e.piece.p === "p" && e.piece.sq === "e5" && e.preneur.p === "q" && e.coup === "c6e5", e);
  T("si la reponse du moteur ne reprend pas, pas de phrase", cas(E({ fen, coup: "h5e5", meilleur: "g1f3", reponse: "d8e7" })) !== "prise_perdante");
  /* Un echange a valeur egale (cavalier contre cavalier) n'est pas une prise perdante. */
  const egal = "r1bqkbnr/pppp1ppp/2n5/4p3/3NP3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 1";
  T("cavalier prend cavalier, repris : pas de phrase", E({ fen: egal, coup: "d4c6", meilleur: "d4f3", reponse: "d7c6" }) === null);
}

console.log("--- Piece en prise ---");
{
  /* Le fou g5 est attaque par h6, les Blancs jouent ailleurs : hxg5, et rien ne reprend. */
  const fen = "r1bqkb1r/pppp1pp1/2n2n1p/4p1B1/2B1P3/3P4/PPP2PPP/RN1QK1NR w KQkq - 0 5";
  const e = E({ fen, coup: "b1c3", meilleur: "g5h4", reponse: "h6g5" });
  T("fou laisse en prise : libre, deja attaque", cas(e) === "en_prise" && e.variante === "libre" && e.deja === true && e.piece.p === "b" && e.piece.sq === "g5" && e.attaquant.p === "p" && e.attaquant.sq === "h6" && e.mieux === "g5h4", e);
  /* Meme faute, mais le cavalier f3 defend g5 : le fou vaut plus que le pion qui le prend. */
  const defendu = "r1bqkb1r/pppp1pp1/2n2n1p/4p1B1/2B1P3/3P1N2/PPP2PPP/RN1QK2R w KQkq - 0 5";
  const e2 = E({ fen: defendu, coup: "b1c3", meilleur: "g5h4", reponse: "h6g5" });
  T("fou defendu mais pris par un pion : moindre, pas « rien ne defend »", cas(e2) === "en_prise" && e2.variante === "moindre" && e2.deja === true, e2);
  /* Fou pose sur une case attaquee et non defendue. */
  const pose = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
  const e3 = E({ fen: pose, coup: "f1a6", meilleur: "e4d5", reponse: "b7a6" });
  T("fou pose en prise : libre, pas « deja »", cas(e3) === "en_prise" && e3.variante === "libre" && e3.deja === false && e3.piece.sq === "a6", e3);
  /* Cavalier pose sur une case attaquee par un pion, mais defendue par le fou c1. */
  const cav = "rnbqkbnr/ppppppp1/7p/8/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq - 0 3";
  const e4 = E({ fen: cav, coup: "f3g5", meilleur: "e2e4", reponse: "h6g5" });
  T("cavalier pose devant un pion, defendu : moindre", cas(e4) === "en_prise" && e4.variante === "moindre" && e4.deja === false, e4);
  /* Echange egal : cavalier pris par un cavalier, repris par la dame. */
  const egal = "r1bqkbnr/pppppppp/2n5/8/8/5N2/PPP1PPPP/RNBQKB1R w KQkq - 2 2";
  T("cavalier contre cavalier, defendu par la dame : aucune phrase", E({ fen: egal, coup: "f3d4", meilleur: "e2e4", reponse: "c6d4" }) === null);
  /* Le meme coup avec le pion d2 devant la dame : plus rien ne defend d4. */
  const seul = "r1bqkbnr/pppppppp/2n5/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 2 2";
  const e6 = E({ fen: seul, coup: "f3d4", meilleur: "d2d4", reponse: "c6d4" });
  T("cavalier pose sans defense : libre", cas(e6) === "en_prise" && e6.variante === "libre", e6);
  /* Un pion perdu n'est pas une « piece en prise ». */
  const pion = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
  T("pion laisse en prise : aucune phrase", E({ fen: pion, coup: "a2a3", meilleur: "e4d5", reponse: "d5e4" }) === null);
  /* La piece est attaquee mais la reponse du moteur est un autre coup : rien n'est dit. */
  T("la reponse du moteur ne prend pas la piece : aucune phrase", E({ fen, coup: "b1c3", meilleur: "g5h4", reponse: "f8e7" }) === null);
  /* Sacrifice : le fou prend un pion (f7) et est repris par le roi : perte nette de 2, piece non defendue. */
  const sacr = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3";
  const e5 = E({ fen: sacr, coup: "c4f7", meilleur: "g1f3", reponse: "e8f7" });
  T("fou donne contre un pion : dit comme prise perdante", cas(e5) === "prise_perdante" && e5.preneur.p === "b" && e5.piece.p === "p", e5);
}

console.log("--- Piece gratuite non prise ---");
{
  const fen = "rnb1kbnr/pppp1ppp/8/4p1q1/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
  const e = E({ fen, coup: "b1c3", meilleur: "f3g5", reponse: "g5g2" });
  T("dame non defendue, non prise : libre", cas(e) === "prise_manquee" && e.variante === "libre" && e.piece.p === "q" && e.piece.sq === "g5" && e.preneur.p === "n" && e.preneur.sq === "f3" && e.coup === "f3g5", e);
  const defendue = "rnb1kbnr/pppp1pp1/7p/4p1q1/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 4";
  const e2 = E({ fen: defendue, coup: "b1c3", meilleur: "f3g5", reponse: "g5g2" });
  T("dame defendue, prenable par un cavalier : moindre, pas « rien ne defendait »", cas(e2) === "prise_manquee" && e2.variante === "moindre", e2);
  /* Le meilleur coup prend un pion defendu avec un cavalier : ce n'est pas une piece gratuite. */
  const pion = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 2";
  const g = new Game("rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3");
  T("prendre un pion : aucune phrase", E({ fen: g.fen(), coup: "b1c3", meilleur: "f3e5", reponse: "f6e4" }) === null && pion.length > 0);
  /* Le joueur a pris la meme piece avec une autre piece : on ne dit pas « tu pouvais la prendre ». */
  const deux = "rnb1kbnr/pppp1ppp/8/4p1q1/4P3/3P1N2/PPP2PPP/RNBQKB1R w KQkq - 0 4";
  const e3 = E({ fen: deux, coup: "c1g5", meilleur: "f3g5", reponse: "f8e7" });
  T("piece prise autrement : pas de « non prise »", cas(e3) !== "prise_manquee", e3);
}

console.log("--- Promotion manquee ---");
{
  const fen = "8/4P1k1/8/8/8/8/8/4K3 w - - 0 1";
  const e = E({ fen, coup: "e1d2", meilleur: "e7e8q", reponse: "g7f7" });
  T("dame que rien ne peut prendre : reconnue", cas(e) === "promo_manquee" && e.coup === "e7e8q", e);
  const prise = "8/4Pk2/8/8/8/8/8/4K3 w - - 0 1";
  T("le roi adverse prendrait la dame : aucune phrase", E({ fen: prise, coup: "e1d2", meilleur: "e7e8q", reponse: "f7e7" }) === null);
  T("le joueur a fait la dame : rien", E({ fen, coup: "e7e8q", meilleur: "e7e8q" }) === null);
}

console.log("--- Fourchette manquee ---");
{
  const fen = "r3k3/pp6/8/1N6/8/8/8/4K3 w - - 0 1";
  const e = E({ fen, coup: "e1e2", meilleur: "b5c7", reponse: "e8d7", pv: ["b5c7", "e8d7", "c7a8", "d7c6"] });
  T("Cc7+ sur le roi et la tour : reconnue", cas(e) === "fourchette_manquee" && e.coup === "b5c7" && e.cibles.length === 2 && e.cibles[0].p === "k" && e.cibles[0].sq === "e8" && e.cibles[1].p === "r" && e.cibles[1].sq === "a8", e);
  T("meme position, suite du moteur courte (trois coups) : reconnue", cas(E({ fen, coup: "e1e2", meilleur: "b5c7", pv: ["b5c7", "e8d7", "c7a8"] })) === "fourchette_manquee");
  T("sans la suite du moteur : aucune phrase", E({ fen, coup: "e1e2", meilleur: "b5c7" }) === null);
  T("la suite ne prend aucune cible : aucune phrase", E({ fen, coup: "e1e2", meilleur: "b5c7", pv: ["b5c7", "e8d7", "c7b5", "d7c6"] }) === null);
  /* Le cavalier attaque deux pions defendus : ce ne sont pas des cibles. */
  const pions = "4k3/8/1p1p4/8/2N5/8/8/4K3 w - - 0 1";
  T("deux pions attaques : pas une fourchette", E({ fen: pions, coup: "e1e2", meilleur: "c4b6", pv: ["c4b6", "e8d8", "b6d5", "d8d7"] }) === null);
  /* La tour prise est reprise aussitot : cavalier contre tour, le gain reste net. */
  const reprise = "rb2k3/pp6/8/1N6/8/8/8/4K3 w - - 0 1";
  const e2 = E({ fen: reprise, coup: "e1e2", meilleur: "b5c7", pv: ["b5c7", "b8c7"] });
  T("le cavalier qui fourchette est pris : aucune phrase", e2 === null, e2);
}

console.log("--- Fourchette permise ---");
{
  const fen = "6k1/8/8/8/1n6/8/7P/R3K3 w - - 0 1";
  const e = E({ fen, coup: "h2h3", meilleur: "e1d2", reponse: "b4c2", pvr: ["b4c2", "e1d2", "c2a1", "d2c1"] });
  T("h3 laisse Cc2+ sur le roi et la tour : reconnue", cas(e) === "fourchette_permise" && e.coup === "b4c2" && e.cibles[0].p === "k" && e.cibles[1].p === "r" && e.mieux === "e1d2", e);
  T("sans la suite du moteur : aucune phrase", E({ fen, coup: "h2h3", meilleur: "e1d2", reponse: "b4c2" }) === null);
  /* Fourchette de pion, avec des prises intercalees : e5 attaque le fou d6 et
     le cavalier f6 ; les Noirs prennent d4 puis f3 au passage, les Blancs
     reprennent. Le bilan se lit une fois les echanges finis. */
  const pion = "r1bqkb1r/ppp2ppp/2n1pn2/3p4/3PP3/2NB1N2/PPP2PPP/R1BQK2R b KQkq - 1 5";
  const e2 = E({ fen: pion, coup: "f8d6", meilleur: "f8b4", reponse: "e4e5", pvr: ["e4e5", "c6d4", "e5d6", "d4f3", "d1f3", "d8d6"] });
  T("fourchette de pion avec prises intercalees : reconnue", cas(e2) === "fourchette_permise" && e2.cibles.map(c => c.p + c.sq).sort().join() === "bd6,nf6", e2);
  const e3 = E({ fen: pion, coup: "f8d6", meilleur: "f8b4", reponse: "e4e5", pvr: ["e4e5", "c6d4", "e5d6", "d4f3"] });
  T("la suite s'arrete sur une prise adverse, bilan negatif : aucune phrase", e3 === null, e3);
}

console.log("--- Compliment ---");
{
  const avant = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";
  const adv = E({ fen: avant, coup: "d8g5", meilleur: "b8c6", reponse: "f3g5" });
  T("la faute adverse est reconnue (dame mise en prise)", cas(adv) === "en_prise" && adv.variante === "libre" && adv.deja === false, adv);
  const apres = "rnb1kbnr/pppp1ppp/8/4p1q1/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
  const c = COACH.compliment(Game, { fen: apres, coup: "f3g5", adv });
  T("le joueur la prend : compliment", c && c.cas === "bien_prise" && c.piece.p === "q" && c.piece.sq === "g5", c);
  T("le joueur joue autre chose : pas de compliment", COACH.compliment(Game, { fen: apres, coup: "b1c3", adv }) === null);
  T("pas de faute adverse : pas de compliment", COACH.compliment(Game, { fen: apres, coup: "f3g5", adv: null }) === null);
  const fou = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2";
  const advMat = E({ fen: "rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2", coup: "g2g4", meilleur: "e2e4", reponse: "d8h4" });
  const cm = COACH.compliment(Game, { fen: fou, coup: "d8h4", adv: advMat });
  T("le joueur donne le mat offert : compliment", cm && cm.cas === "bien_mat", cm);
  T("il ne le donne pas : pas de compliment", COACH.compliment(Game, { fen: fou, coup: "b8c6", adv: advMat }) === null);
}

console.log("--- Exercice tire d'une faute ---");
{
  const x1 = COACH.exercice({ coup: "h5g5", meilleur: "h5f7" }, { cas: "mat1_manque", coup: "h5f7" });
  T("mat en un manque : exercice de mat, net sans autre controle", x1 && x1.type === "mate" && x1.n === 1 && x1.net === true && x1.theme === "Mate in one", x1);
  const x2 = COACH.exercice({ coup: "g1h1", meilleur: "d2d8" }, { cas: "mat2_manque", coup: "d2d8" });
  T("mat en deux manque : exercice de mat en deux", x2 && x2.type === "mate" && x2.n === 2 && x2.net === true, x2);
  const x3 = COACH.exercice({ coup: "b1c3", meilleur: "f3g5" }, { cas: "prise_manquee", coup: "f3g5" });
  T("piece gratuite : exercice a controler par le moteur", x3 && x3.type === "gain" && x3.sol[0] === "f3g5" && x3.net === false, x3);
  T("sans explication : pas d'exercice", COACH.exercice({ coup: "a2a3", meilleur: "d2d4" }, null) === null);
  T("exigence stricte : 250 d'ecart, position tenable", COACH.net({ cp: 150, mate: null }, { cp: -100, mate: null }) === true);
  T("exigence stricte : 150 d'ecart, refuse", COACH.net({ cp: 150, mate: null }, { cp: 0, mate: null }) === false);
  T("exigence stricte : meilleur coup deja perdant (-600), refuse", COACH.net({ cp: -600, mate: null }, { cp: -1200, mate: null }) === false);
  T("exigence stricte : en retard mais jouable (-300), accepte", COACH.net({ cp: -300, mate: null }, { cp: -900, mate: null }) === true);
  T("exigence stricte : mat force contre soi apres le meilleur coup, refuse", COACH.net({ cp: null, mate: -5 }, { cp: null, mate: -1 }) === false);
  T("exigence stricte : le deuxieme coup mate aussi, refuse", COACH.net({ cp: null, mate: 1 }, { cp: null, mate: 4 }) === false);
  T("exigence stricte : un seul coup legal, accepte", COACH.net({ cp: 0, mate: null }, null) === true);
  T("exigence stricte : mat contre simple avantage, accepte", COACH.net({ cp: null, mate: 3 }, { cp: 500, mate: null }) === true);
  T("exigence stricte : deux mats, refuse", COACH.net({ cp: null, mate: 2 }, { cp: null, mate: 3 }) === false);
}

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
