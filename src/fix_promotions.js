#!/usr/bin/env node
/* Repare les lettres de promotion ecrites a l'envers.

   Usage :
     node fix_promotions.js --dry                       (sur puzzles.json)
     node fix_promotions.js /tmp/fournee.json --dry      (sur une fournee)
     node fix_promotions.js /tmp/fournee.json

   Le defaut. gen_puzzles.js, gen_puzzles_v2.js et mine_puzzles.js
   serialisaient la promotion avec une table locale, "qrbn"[promo - 2], ecrite
   a l'envers des constantes du moteur (N=2, BI=3, R=4, Q=5) :

       promo 2 cavalier -> ecrit "q"      devrait etre "n"
       promo 3 fou      -> ecrit "r"      devrait etre "b"
       promo 4 tour     -> ecrit "b"      devrait etre "r"
       promo 5 dame     -> ecrit "n"      devrait etre "q"

   La correspondance est donc un simple echange, q<->n et r<->b, et elle est
   sa propre inverse. Les trois sources sont corrigees et passent desormais
   par g.uci(). Ce script rattrape ce qui a deja ete ecrit.

   Pourquoi personne ne l'a vu. verifyFull() cherchait le coup sur from/to
   seuls : il retrouvait donc toujours UNE promotion, n'importe laquelle, et
   validait l'exercice. En jeu, currentSolutions() compare en revanche l'UCI
   complet pour un gain : sur 893 exercices, promouvoir en dame etait compte
   comme une erreur et le cavalier exige. Les mats echappaient au probleme,
   matingMoves() acceptant tout coup qui mate.

   Le controle, et pourquoi il y en a DEUX. La premiere version de ce script
   se contentait de verifyFull(). C'etait vide de sens sur les gains :
   verifyFull() n'y verifie que la legalite de la sequence, donc n'importe
   quelle promotion legale passe, la bonne comme la mauvaise. Il ne
   controlait reellement que les mats, ou la position finale doit mater.
   Pour un gain, on compare donc les quatre promotions possibles au moteur et
   on n'accepte l'echange que si la lettre echangee est le MEILLEUR coup.
   C'est la partie lente, quelques minutes sur la banque entiere.
   Un exercice ou ni la lettre stockee ni la lettre echangee ne ressort en
   tete n'est pas repare : il est nomme, et c'est a regarder a la main.
*/
const fs = require("fs");
const path = require("path");
const { verifyFull } = require(path.join(__dirname, "gen_puzzles_v2.js"));
const { Game, search, sqName } = require(path.join(__dirname, "engine.js"));

/* Le meilleur coup parmi les promotions possibles sur ce depart et cette
   arrivee. Profondeur modeste : on ne cherche pas a evaluer la position,
   seulement a departager quatre coups dont les valeurs materielles sont tres
   ecartees. */
function meilleurePromotion(fen, uci) {
  const g = new Game(fen);
  const cands = g.moves().filter(m => sqName(m.from) === uci.slice(0, 2) && sqName(m.to) === uci.slice(2, 4));
  if (cands.length < 2) return null;
  let best = null, bestScore = -Infinity;
  for (const m of cands) {
    const c = new Game(fen);
    const m2 = c.moves().find(x => x.from === m.from && x.to === m.to && x.promo === m.promo);
    const u = c.uci(m2);
    c.makeMove(m2);
    const s = -search(c, 3, 600).score;
    if (s > bestScore) { bestScore = s; best = u; }
  }
  return best;
}

const dry = process.argv.includes("--dry");
const fichiers = process.argv.slice(2).filter(a => !a.startsWith("--"));
if (!fichiers.length) fichiers.push(path.join(__dirname, "puzzles.json"));

const ECHANGE = { q: "n", n: "q", r: "b", b: "r" };

for (const f of fichiers) {
  const lot = JSON.parse(fs.readFileSync(f, "utf8"));
  console.log("\nFichier            :", path.basename(f), "-", lot.length, "exercices");

  const avecPromo = lot.filter(p => (p.sol || []).some(s => s.length === 5));
  console.log("Avec promotion     :", avecPromo.length);
  if (!avecPromo.length) continue;

  const avantLettres = {}, apresLettres = {};
  for (const p of avecPromo) for (const s of p.sol) if (s.length === 5) avantLettres[s[4]] = (avantLettres[s[4]] || 0) + 1;

  let repares = 0, deja = 0;
  const refuses = [], casses = [], indecis = [];
  /* Une fournee fraiche n'a pas encore de code : ils sont attribues a la
     fusion. On se rabat sur la position, qui identifie l'exercice aussi
     surement et permet de le retrouver dans le fichier. */
  const nom = p => p.code || p.fen;

  let vus = 0;
  for (const p of avecPromo) {
    if (++vus % 50 === 0) process.stderr.write("\r  " + vus + "/" + avecPromo.length);
    const avantOk = verifyFull(p);
    const neuf = p.sol.map(s => s.length === 5 ? s.slice(0, 4) + (ECHANGE[s[4]] || s[4]) : s);
    const essai = Object.assign({}, p, { sol: neuf });
    if (!verifyFull(essai)) { (avantOk ? (deja++, refuses) : casses).push(nom(p)); continue; }

    /* Gain dont le PREMIER coup est une promotion : c'est celui que le joueur
       doit trouver, et verifyFull() ne dit rien de sa qualite. On tranche au
       moteur. Les coups suivants et les mats restent couverts par
       verifyFull(), dont le controle est reel dans ces cas. */
    if (p.type !== "mate" && p.sol[0].length === 5) {
      const best = meilleurePromotion(p.fen, p.sol[0]);
      if (best && best !== neuf[0]) {
        if (best === p.sol[0]) { deja++; refuses.push(nom(p)); }
        else indecis.push(nom(p) + "  sol=" + p.sol[0] + "  moteur=" + best);
        continue;
      }
    }
    p.sol = neuf; repares++;
  }
  process.stderr.write("\r");

  for (const p of avecPromo) for (const s of p.sol) if (s.length === 5) apresLettres[s[4]] = (apresLettres[s[4]] || 0) + 1;

  console.log("Lettres avant      :", JSON.stringify(avantLettres));
  console.log("Lettres apres      :", JSON.stringify(apresLettres));
  console.log("Echanges retenus   :", repares);
  /* Un exercice qui passait AVANT et pas apres : l'echange l'aurait casse.
     On le laisse tel quel plutot que de forcer une regle generale sur un cas
     qu'elle ne decrit pas. */
  if (deja) console.log("Laisses intacts    :", deja, "(" + refuses.slice(0, 10).join(" ") + ")");
  /* Casse avant ET apres : le probleme n'est pas la lettre de promotion.
     A regarder un par un, ce script n'a rien a en dire. */
  if (casses.length) console.log("Casses des le depart:", casses.length, "(" + casses.slice(0, 10).join(" ") + ")");
  /* Ni la lettre stockee ni l'echangee ne sort en tete : l'echange n'est pas
     la reponse pour cet exercice-la. Non repare, nomme. */
  if (indecis.length) console.log("A regarder a la main:", indecis.length, "(" + indecis.slice(0, 10).join(" ") + ")");

  if (dry) { console.log("--dry : rien n'a ete ecrit."); continue; }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  fs.copyFileSync(f, f.replace(/\.json$/, "." + stamp + ".bak.json"));
  fs.writeFileSync(f, JSON.stringify(lot));
  console.log("Ecrit, sauvegarde horodatee a cote.");
}
