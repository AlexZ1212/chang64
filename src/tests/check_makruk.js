/* Verification automatique de chang64.
   Lancement : node tests/check_makruk.js

   Le Makruk (easter egg du 2026-11-01, demande d'Alexandre) : regles,
   comptage et moteur de src/makruk.js, sans navigateur.
   - Nombre de coups depuis la position de depart : 23, 529, 12 012 a
     profondeur 1, 2 et 3, les valeurs de reference du makruk.
   - Les pieces propres au makruk : Khon (diagonales et droit devant), Met,
     Bia sans double pas, promotion obligatoire en Bia ngai sur la 6e rangee.
   - Le comptage : plateau (64 coups des qu'il n'y a plus de Bia), pieces
     (limite selon le camp fort, moins le nombre de pieces), nulle a la fin.
   - Le moteur trouve un mat en un et ne joue jamais un coup illegal. */
const path = require("path");
const M = require(path.join(__dirname, "..", "makruk.js"));
const { Partie, chercher, NIVEAUX, uci } = M;
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };

function perft(P, prof) {
  if (prof === 0) return 1;
  let n = 0;
  for (const m of P.coups()) { P.jouer(m); n += perft(P, prof - 1); P.annuler(); }
  return n;
}
const coupsDe = (P, depuis) => P.coups().filter(m => uci(m).startsWith(depuis)).map(m => uci(m).slice(2)).sort().join(" ");

console.log("\n--- Position de depart ---");
{
  const P = new Partie();
  T("Khun blanc en d1, Khun noir en e8", P.fen().startsWith("rnsmksnr/8/pppppppp/8/8/PPPPPPPP/8/RNSKMSNR"), P.fen());
  T("23 coups a profondeur 1", perft(P, 1) === 23, String(perft(P, 1)));
  T("529 a profondeur 2", perft(P, 2) === 529, String(perft(P, 2)));
  const p3 = perft(P, 3);
  T("12 012 a profondeur 3", p3 === 12012, String(p3));
  T("la position est intacte apres les annulations", P.fen() === new Partie().fen() && P.pile.length === 0);
  T("pas de comptage tant qu'il reste des Bia", P.compte === null);
}

console.log("\n--- Les pieces du makruk ---");
{
  const P = new Partie("4k3/8/8/8/3S4/8/8/4K3 w");
  T("le Khon blanc : quatre diagonales et droit devant", coupsDe(P, "d4") === "c3 c5 d5 e3 e5", coupsDe(P, "d4"));
  const N = new Partie("4k3/8/8/3s4/8/8/8/4K3 b");
  T("le Khon noir avance vers le bas", coupsDe(N, "d5") === "c4 c6 d4 e4 e6", coupsDe(N, "d5"));
  const Q = new Partie("4k3/8/8/8/3M4/8/8/4K3 w");
  T("le Met : une case en diagonale", coupsDe(Q, "d4") === "c3 c5 e3 e5", coupsDe(Q, "d4"));
  const B = new Partie("4k3/8/8/8/8/3P4/8/4K3 w");
  T("le Bia n'avance que d'une case, meme au depart", coupsDe(B, "d3") === "d4", coupsDe(B, "d3"));
  const Pr = new Partie("4k3/8/8/3P4/8/8/8/4K3 w");
  const m = Pr.depuisUci("d5d6");
  Pr.jouer(m);
  T("sur la 6e rangee, il devient Bia ngai", Pr.fen().startsWith("4k3/8/3F4/"), Pr.fen());
  Pr.annuler();
  T("et redevient Bia quand on annule", Pr.fen().startsWith("4k3/8/8/3P4/"), Pr.fen());
  const Ng = new Partie("4k3/8/3F4/8/8/8/8/4K3 w");
  T("le Bia ngai joue comme le Met", coupsDe(Ng, "d6") === "c5 c7 e5 e7", coupsDe(Ng, "d6"));
  const E = new Partie("4k3/8/8/8/8/8/3s4/4K3 w");
  T("le Khon noir donne echec en diagonale", E.enEchec(1));
  const E2 = new Partie("4k3/8/8/8/8/4s3/4K3/8 w");
  T("et droit devant lui, vers le bas pour les Noirs", E2.enEchec(1));
  const E3 = new Partie("4k3/8/8/8/8/8/4K3/4s3 w");
  T("mais jamais droit en arriere", !E3.enEchec(1));
}

console.log("\n--- Comptage ---");
{
  /* Plus aucun Bia, materiel inegal : comptage du plateau, 64 coups. */
  const P = new Partie("4k3/8/8/8/8/8/2R5/4K2r w");
  T("sans Bia, le comptage du plateau commence", P.compte && P.compte.genre === "plateau" && P.compte.reste === 64, JSON.stringify(P.compte));
  /* Deux Rua contre un Khun seul, 4 pieces : 8 - 4 = 4 coups. */
  const D = new Partie("4k3/8/8/8/8/8/R7/R3K3 w");
  T("deux Rua contre le Khun seul : 8 - 4 = 4 coups", D.compte && D.compte.genre === "pieces" && D.compte.reste === 4, JSON.stringify(D.compte));
  T("limite 16 avec une Rua", M.limitePieces(new Partie("4k3/8/8/8/8/8/8/R3K3 w").b, 1) === 16);
  T("limite 44 avec un Khon", M.limitePieces(new Partie("4k3/8/8/8/8/8/8/S3K3 w").b, 1) === 44);
  T("limite 32 avec deux Ma", M.limitePieces(new Partie("4k3/8/8/8/8/8/8/NN2K3 w").b, 1) === 32);
  T("limite 64 avec le Met seul", M.limitePieces(new Partie("4k3/8/8/8/8/8/8/M3K3 w").b, 1) === 64);
  /* Le camp fort joue sans mater : le compte baisse a chacun de ses coups,
     pas a ceux du camp faible, et la partie finit nulle a zero. */
  const C = new Partie("7k/8/8/8/8/8/R7/R3K3 w");
  const avant = C.compte.reste;
  C.jouer(C.depuisUci("e1d1"));
  T("un coup du camp fort fait baisser le compte", C.compte.reste === avant - 1, JSON.stringify(C.compte));
  const k = C.coups()[0];
  C.jouer(k);
  T("un coup du camp faible ne le change pas", C.compte.reste === avant - 1, JSON.stringify(C.compte));
  let garde = 0;
  while (!C.fin() && garde++ < 20) {
    const legal = C.coups();
    /* Les Blancs ne jouent que leur Khun, qui ne peut pas mater : on laisse
       filer le compte. */
    C.jouer(C.trait > 0 ? legal.find(x => (x & 63) === C.rois[0]) : legal[0]);
  }
  const f = C.fin();
  T("sans mat dans la limite, la partie est nulle par comptage", f && f.gagnant === 0 && f.raison === "comptage", JSON.stringify(f));
  const R = new Partie("4k3/8/8/8/8/8/8/4K3 w");
  T("deux Khun seuls : nulle", (R.fin() || {}).raison === "rois");
}

console.log("\n--- Fin de partie et moteur ---");
{
  /* Mat du couloir : Rua en a8. */
  const P = new Partie("6k1/5ppp/8/8/8/8/8/R5K1 w");
  const m = chercher(P, NIVEAUX[2]);
  T("le moteur trouve le mat en un", uci(m) === "a1a8", uci(m));
  P.jouer(m);
  const f = P.fin();
  T("et la partie est gagnee par les Blancs", f && f.gagnant === 1 && f.raison === "mat", JSON.stringify(f));
  const pat = new Partie("k7/8/1K6/8/8/8/8/1R6 b");
  T("le pat est nul", (pat.fin() || {}).raison === "pat", JSON.stringify(pat.fin()));
  /* Quelques coups du moteur depuis le depart : tous legaux. */
  const G = new Partie();
  let legaux = true;
  for (let i = 0; i < 6; i++) {
    const c = chercher(G, NIVEAUX[i % 3]);
    if (!G.coups().includes(c)) { legaux = false; break; }
    G.jouer(c);
  }
  T("les coups du moteur sont legaux, a chaque niveau", legaux, G.fen());
}

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
