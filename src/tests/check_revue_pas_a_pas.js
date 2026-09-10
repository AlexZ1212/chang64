/* Verification automatique de chang64.
   Lancement : node tests/check_revue_pas_a_pas.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-09-09, signale par Alexandre sur #UCYR0) :
   revoir un exercice resolu jouait sa solution AU CHARGEMENT. Le rendu
   partait donc de la position finale, la piece prise avait deja disparu, et
   la seule animation visible faisait glisser une piece vers une case dont on
   ne saurait jamais ce qu'elle contenait. Sur une prise, c'est-a-dire sur
   40 % de la banque, la revue ne montrait pas ce qu'il y avait a comprendre.

   Le point de ce test, et la raison pour laquelle aucune suite existante ne
   l'attrapait : les autres verifient l'etat FINAL de la revue (bandeau,
   explication, boutons masques), jamais la position de DEPART ni le fait
   qu'on puisse s'y arreter. Un test sur le texte du bandeau passe au vert
   sur le code casse.

   On verifie donc trois choses distinctes :
     1. la revue s'ouvre sur la position de l'exercice, pas sur la finale ;
     2. la piece prise est encore sur l'echiquier a ce moment-la ;
     3. on peut avancer, puis revenir, et retrouver exactement ce plateau.
*/
const path = require("path");
const SITE = path.join(__dirname, "..", "site");
const fs = require("fs"), jd = require("jsdom");
const html = fs.readFileSync(SITE + "/index.html", "utf8");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const wait = ms => new Promise(r => setTimeout(r, ms));

const dom = new jd.JSDOM(html, {
  runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/",
  virtualConsole: new jd.VirtualConsole(),
  beforeParse(w) {
    w.fetch = u => {
      const p = SITE + String(u).replace(/^https?:\/\/[^/]+/, "");
      return fs.existsSync(p)
        ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(fs.readFileSync(p, "utf8"))) })
        : Promise.resolve({ ok: false, status: 404 });
    };
  }
});
const w = dom.window, d = w.document, $ = id => d.getElementById(id);

/* Exercice temoin construit ici plutot que pioche dans la banque : le test
   ne doit pas dependre d'un code qui pourrait etre reclassifie ou retire.
   C'est #UCYR0, la position qui a revele le defaut. Cxe2 prend une TOUR :
   c'est elle qu'on doit pouvoir voir avant d'avancer. */
const TEMOIN = {
  id: "test-revue", code: "TEST1",
  fen: "5rk1/p1q3bp/bp1Np1p1/4P3/3B4/1Pnn1NP1/P2QRPB1/6K1 b - - 3 23",
  type: "gain", n: 1, sol: ["c3e2"], theme: "Winning capture", diff: 24, level: 1,
  explain: { sq: "e2", piece: "r" }
};

/* Y a-t-il une piece sur cette case du plateau affiche ? On interroge le DOM
   rendu, pas l'objet Game : c'est ce que voit l'utilisateur qui est en
   cause, pas l'etat interne. */
function pieceSur(caseNom) {
  /* Index 0x88, calcule ici : la rangee 8 est en haut, donc a8 vaut 0 et un
     pion blanc avance en SOUSTRAYANT 16 (piege 16 du handoff 7). */
  const sq = "abcdefgh".indexOf(caseNom[0]) + (8 - Number(caseNom[1])) * 16;
  const el = d.querySelector('#board .piece[data-sq="' + sq + '"]');
  return el ? el.getAttribute("data-p") : null;
}

setTimeout(async () => {
  console.log("\n--- La revue s'ouvre sur la position de depart ---");

  T("loadAndRevealSolution existe", w.eval("typeof loadAndRevealSolution") === "function");
  T("la navigation dans la solution est dans le document", !!$("solutionNav"));
  if (!$("solutionNav")) { console.log("\n=== " + ok + " OK, " + ko + " FAIL ==="); process.exit(1); }

  w.eval("setMode('puzzles',{screen:'puzzles'})"); await wait(200);
  w.eval("loadAndRevealSolution(" + JSON.stringify(TEMOIN) + ")"); await wait(300);

  T("le curseur est sur la position de depart", w.eval("solPly") === 0, "solPly=" + w.eval("solPly"));
  T("la tour prise est encore visible en e2", pieceSur("e2") === "wr", "e2 = " + pieceSur("e2"));
  T("le cavalier est encore en c3", pieceSur("c3") === "bn", "c3 = " + pieceSur("c3"));
  T("la barre de navigation est visible", !$("solutionNav").classList.contains("hide"));
  T("on ne peut pas reculer depuis le depart", $("solPrev").disabled === true);
  T("on peut avancer", $("solNext").disabled === false);
  T("le bandeau annonce quand meme la solution complete",
    /Cxe2|Nxe2/.test($("exStatus").textContent), $("exStatus").textContent);

  console.log("\n--- On avance dans la solution ---");
  $("solNext").click(); await wait(300);
  T("le curseur a avance", w.eval("solPly") === 1, "solPly=" + w.eval("solPly"));
  T("le cavalier occupe maintenant e2", pieceSur("e2") === "bn", "e2 = " + pieceSur("e2"));
  T("il a quitte c3", pieceSur("c3") === null, "c3 = " + pieceSur("c3"));
  T("on est au bout de la solution", $("solNext").disabled === true);
  T("le libelle situe le coup", /1/.test($("solPos").textContent) && $("solPos").textContent.length > 1,
    $("solPos").textContent);

  console.log("\n--- Et on peut revenir en arriere ---");
  $("solPrev").click(); await wait(300);
  T("le curseur est revenu au depart", w.eval("solPly") === 0, "solPly=" + w.eval("solPly"));
  T("la tour est de nouveau en e2", pieceSur("e2") === "wr", "e2 = " + pieceSur("e2"));
  T("le cavalier est de nouveau en c3", pieceSur("c3") === "bn", "c3 = " + pieceSur("c3"));

  console.log("\n--- Un chargement normal referme la navigation ---");
  /* Sans ca, la barre survivrait a la sortie de revue et proposerait
     d'avancer dans la solution d'un exercice qu'on est en train de chercher. */
  w.eval("loadPuzzleById('" + TEMOIN.id + "',function(){})");
  w.eval("puzzle=" + JSON.stringify(TEMOIN) + ";loadPuzzle();"); await wait(300);
  T("la barre est masquee hors revue", $("solutionNav").classList.contains("hide"));

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
}, 1400);
setTimeout(() => { console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL === (delai depasse)"); process.exit(1); }, 60000);
