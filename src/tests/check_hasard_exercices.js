/* Verifie que la sequence d'exercices d'une session vierge n'est pas figee.
   Signale : en partant de zero, c'etait toujours #WVFK3, puis #HX2YE, puis
   #KKFG7 (deux "Fourchette de cavalier" qui se ressemblaient en plus),
   identique a chaque nouvelle session car le tri par difficulte etait
   strict et deterministe. Chaque session ci-dessous utilise sa propre
   instance jsdom (donc sa propre progression vierge), pour reproduire
   fidelement "recommencer de zero". */
const path = require("path");
const SITE = path.join(__dirname, "..", "site");
const fs = require("fs"), jd = require("jsdom");
const html = fs.readFileSync(SITE + "/index.html", "utf8");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n) } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")) } };

/* fetchJSON (ui.js) appelle fetch("/data/level-N.json") en relatif, resolu
   par jsdom contre l'URL de base fictive "https://chang64.com/" -- ce qui
   tentait un VRAI appel reseau vers la production a chaque test. Deux
   problemes independants avec ca : ca echoue net dans un environnement
   sans acces reseau sortant vers chang64.com, et meme quand ca reussirait,
   ca testerait les donnees DEJA EN LIGNE plutot que celles du build local
   qu'on vient de generer -- un test qui passerait sans jamais toucher au
   code qu'il est cense verifier. On route donc "/data/..." vers les
   fichiers locaux de site/data/, ce que fetchJSON ne distingue pas d'un
   vrai fetch puisqu'il ne regarde que .ok et .json(). */
function stubFetch(w) {
  w.fetch = (url) => {
    const p = path.join(SITE, String(url).replace(/^https?:\/\/[^/]+/, ""));
    try {
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
    } catch (e) {
      return Promise.resolve({ ok: false, status: 404 });
    }
  };
}

function uneSession() {
  return new Promise(resolve => {
    const dom = new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/", virtualConsole: new jd.VirtualConsole() });
    const w = dom.window, d = w.document;
    stubFetch(w);
    setTimeout(() => {
      /* Depuis la reorganisation du 2026-09-03, tab-puzzles ouvre un menu a
         cinq cartes (Puzzles, Puzzle du jour, Chang Sprint, Coordonnees,
         Finales) au lieu de charger un exercice directement. Il faut
         ensuite choisir la carte Puzzles pour obtenir le meme etat qu'avant
         (puzzle non nul). Sans ce second clic, "puzzle" restait null et le
         test plantait au lieu d'echouer proprement. */
      d.getElementById("tab-puzzles").click();
      setTimeout(() => {
        d.getElementById("cardSolvePuzzles").click();
        setTimeout(() => {
          const seq = [];
          for (let i = 0; i < 5; i++) {
            seq.push({ code: w.eval("puzzle.code"), diff: w.eval("puzzle.diff") });
            w.eval("nextPuzzle()");
          }
          resolve(seq);
        }, 300);
      }, 300);
    }, 700);
  });
}

(async () => {
  console.log("\n--- Cinq sessions vierges, la sequence ne doit pas etre figee ---");
  const sessions = [];
  for (let i = 0; i < 5; i++) sessions.push(await uneSession());

  const premiers = sessions.map(s => s[0].code);
  T("le premier exercice varie d'une session a l'autre",
    new Set(premiers).size > 1, premiers.join(", "));

  const sequences = sessions.map(s => s.map(x => x.code).join(">"));
  T("la sequence complete varie d'une session a l'autre",
    new Set(sequences).size > 1, sequences.join(" | "));

  console.log("\n--- La progression generale n'est pas cassee ---");
  /* Les valeurs de diff sont tres regroupees (beaucoup d'egalites exactes,
     par exemple plusieurs exercices a 0.8 pile) : comparer des moyennes de
     cinquiemes mesurait surtout du bruit statistique d'un tirage a
     l'autre, pas un vrai defaut, et faisait echouer le test sur du code
     pourtant correct.
     Correction du 2026-09-05 : cette suite verifiait qu'AUCUN exercice ne
     se repete avant d'avoir vu tout le niveau -- une garantie que le code
     n'a jamais offerte. prog.seen (ui.js) plafonne volontairement a 200
     entrees ("if(prog.seen.length>200)prog.seen.shift()"), une fenetre de
     memoire recente et non un historique complet ; un niveau de 7214
     exercices ne peut mathematiquement pas se traverser sans repetition
     sous cette regle, et ce n'etait pas un bug a corriger. Le test verifie
     desormais la garantie REELLE : dans une fenetre glissante de la taille
     du plafond, pas de repetition avant d'avoir vu tout le reste de cette
     fenetre. */
  const PLAFOND = 200;
  const dom = new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/", virtualConsole: new jd.VirtualConsole() });
  const w = dom.window, d = w.document;
  stubFetch(w);
  await new Promise(r => setTimeout(r, 700));
  d.getElementById("tab-puzzles").click();
  await new Promise(r => setTimeout(r, 300));
  d.getElementById("cardSolvePuzzles").click();
  await new Promise(r => setTimeout(r, 300));
  const total = w.eval("levelPool(prog.level).length");
  const fenetre = Math.min(total, PLAFOND);
  const tires = 3 * fenetre;   /* assez de tirages pour observer plusieurs cycles de la fenetre */
  const historique = [];
  let doublonDansLaFenetre = false;
  for (let i = 0; i < tires; i++) {
    const id = w.eval("puzzle.id");
    const recents = historique.slice(-fenetre + 1);
    if (recents.includes(id)) doublonDansLaFenetre = true;
    historique.push(id);
    w.eval("nextPuzzle()");
  }
  T("aucun exercice ne se repete dans une fenetre de " + fenetre + " tirages",
    !doublonDansLaFenetre, historique.length + " tirages observes");

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
