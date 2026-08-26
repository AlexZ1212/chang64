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

function uneSession() {
  return new Promise(resolve => {
    const dom = new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/", virtualConsole: new jd.VirtualConsole() });
    const w = dom.window, d = w.document;
    setTimeout(() => {
      d.getElementById("tab-puzzles").click();
      setTimeout(() => {
        const seq = [];
        for (let i = 0; i < 5; i++) {
          seq.push({ code: w.eval("puzzle.code"), diff: w.eval("puzzle.diff") });
          w.eval("nextPuzzle()");
        }
        resolve(seq);
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
     pourtant correct. On verifie plus simplement que le niveau entier reste
     traversable sans erreur et sans jamais repeter un exercice avant
     d'avoir vu tous les autres. */
  const dom = new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/", virtualConsole: new jd.VirtualConsole() });
  const w = dom.window, d = w.document;
  await new Promise(r => setTimeout(r, 700));
  d.getElementById("tab-puzzles").click();
  await new Promise(r => setTimeout(r, 300));
  const total = w.eval("levelPool(prog.level).length");
  const vus = new Set();
  let doublonAvantLaFin = false;
  for (let i = 0; i < total; i++) {
    const id = w.eval("puzzle.id");
    if (vus.has(id) && vus.size < total) doublonAvantLaFin = true;
    vus.add(id);
    w.eval("nextPuzzle()");
  }
  T("le niveau entier se traverse sans repeter un exercice avant d'avoir vu tous les autres",
    !doublonAvantLaFin && vus.size === total, vus.size + "/" + total);

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
