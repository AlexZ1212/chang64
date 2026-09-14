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
   arrivee.

   Deux profondeurs plutot qu'une (2026-09-13). L'ancienne version tranchait
   a profondeur 3 pour tout le monde, et se trompait : sur la fournee du 12,
   un exercice au moins etait bloque pour rien, profondeur 3 disant tour la
   ou profondeur 4 dit dame, a +8,60 contre +3,95. Un ecart de cette taille
   n'est pas un desaccord d'appreciation, c'est une recherche trop courte qui
   n'a pas vu la suite.

   Monter tout le monde a profondeur 5 coûterait une demi-heure sur la banque
   entiere pour ne changer presque aucun verdict : dans l'immense majorite des
   cas la dame gagne de plusieurs pieces et n'importe quelle profondeur le
   voit. On escalade donc seulement quand le verdict superficiel est SUSPECT,
   ce qui se reconnait a deux signes :
     - le gagnant n'est pas la dame. Une sous-promotion qui bat la dame est
       un evenement rare et reel (echec, fourchette, pat evite) ; a
       profondeur 3 c'est bien plus souvent une erreur de la recherche. Le
       cas du handoff est exactement celui-la.
     - les deux premiers se tiennent a moins de ECART centipions, donc rien
       ne les separe vraiment.
   Dans ces deux cas seulement, les deux meilleurs candidats sont rejoues a
   profondeur PROF avec un vrai budget, et c'est ce second verdict qui
   compte. Le surcout est nul sur les exercices ordinaires. */
const PROF = +((process.argv.find(a => a.startsWith("--profondeur=")) || "").split("=")[1] || 5);
const ECART = +((process.argv.find(a => a.startsWith("--ecart=")) || "").split("=")[1] || 200);
let escalades = 0;

function meilleurePromotion(fen, uci) {
  const g = new Game(fen);
  const cands = g.moves().filter(m => sqName(m.from) === uci.slice(0, 2) && sqName(m.to) === uci.slice(2, 4));
  if (cands.length < 2) return null;
  const noter = (m, prof, budget) => {
    const c = new Game(fen);
    const m2 = c.moves().find(x => x.from === m.from && x.to === m.to && x.promo === m.promo);
    const u = c.uci(m2);
    c.makeMove(m2);
    return { uci: u, score: -search(c, prof, budget).score };
  };
  const notes = cands.map(m => Object.assign(noter(m, 3, 600), { mv: m }))
                     .sort((a, b) => b.score - a.score);
  const suspect = notes[0].uci.slice(-1) !== "q"
    || (notes[1] && notes[0].score - notes[1].score < ECART);
  if (!suspect) return notes[0].uci;
  escalades++;
  const deux = notes.slice(0, 2).map(n => noter(n.mv, PROF, 3000)).sort((a, b) => b.score - a.score);
  return deux[0].uci;
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
  const refuses = [], casses = [], indecis = [], suspects = [];
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

    /* Un exercice qui tient DEJA n'est pas repare (2026-09-13). C'etait le
       vrai danger de ce script, plus grave que la profondeur trop courte
       signalee dans le handoff : pour un mat, verifyFull() ne demande que
       "la position finale mate". Or sur un mat, promouvoir en dame ou en
       cavalier mate souvent des deux facons. Les deux passaient, et la
       branche du bas echangeait quand meme -- mesure sur la banque du 13
       septembre : 23 mats corrects auraient vu leur dame remplacee par un
       cavalier, sans qu'aucun controle ne s'y oppose. `avantOk` etait
       calcule mais ne servait que dans la branche d'echec.
       Ce script repare des lettres INVERSEES, un defaut ou la lettre
       stockee ne tient pas. Quand elle tient, il n'y a rien a reparer, et
       reecrire une solution deja juste ne peut que degrader. */
    if (avantOk) {
      /* On regarde quand meme, pour le dire, si le moteur prefere nettement
         l'autre lettre sur un gain. C'est signale, jamais applique : la
         solution enregistree a une meilleure provenance que ce moteur-ci
         (Stockfish a profondeur 18 pour toute la banque des gains), et un
         echange ici la remplacerait sans appel. */
      if (p.type !== "mate" && p.sol[0].length === 5) {
        const best = meilleurePromotion(p.fen, p.sol[0]);
        if (best && best === neuf[0]) suspects.push(nom(p) + "  sol=" + p.sol[0] + "  moteur=" + best);
      }
      deja++; refuses.push(nom(p));
      continue;
    }

    /* A partir d'ici la lettre stockee ne tient pas et l'echangee tient :
       c'est exactement le defaut que ce script repare. Sur un gain dont le
       PREMIER coup est une promotion, on verifie tout de meme au moteur que
       la lettre echangee est bien la meilleure, verifyFull() ne disant rien
       de la qualite d'un gain. */
    if (p.type !== "mate" && p.sol[0].length === 5) {
      const best = meilleurePromotion(p.fen, p.sol[0]);
      if (best && best !== neuf[0]) { indecis.push(nom(p) + "  sol=" + p.sol[0] + "  moteur=" + best); continue; }
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
  if (suspects.length) console.log("Signales, non touches:", suspects.length, "(" + suspects.slice(0, 10).join(" ") + ")");
  console.log("Verdicts reexamines:", escalades, "a profondeur " + PROF + " (verdict superficiel suspect)");

  if (dry) { console.log("--dry : rien n'a ete ecrit."); continue; }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  fs.copyFileSync(f, f.replace(/\.json$/, "." + stamp + ".bak.json"));
  fs.writeFileSync(f, JSON.stringify(lot));
  console.log("Ecrit, sauvegarde horodatee a cote.");
}
