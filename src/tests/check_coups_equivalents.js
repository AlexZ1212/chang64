/* Verification automatique de chang64.
   Lancement : node tests/check_coups_equivalents.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-09-12) : un gain a un seul coup accepte aussi
   les coups que Stockfish ne sait pas separer de la solution enregistree.

   Pourquoi c'est necessaire. La banque vit en deux regimes. Les exercices
   mines le 12 septembre sont passes par filtre_stockfish.js en exigence
   stricte : le coup propose devance le deuxieme choix d'au moins 200 cp.
   Les 51 189 plus anciens n'ont jamais vu Stockfish, et il en reste environ
   12 116 ou un AUTRE coup gagne presque autant. Sur ceux-la, le joueur qui
   trouve un coup aussi gagnant s'entendait repondre "Pas tout a fait".

   releve_alternatives.js pose donc un champ `alt` sur ces exercices, et
   currentSolutions() (ui.js) l'accepte. Ce test garde les quatre promesses
   qui vont avec, parce qu'aucune n'est evidente en relisant le code :
     1. le coup equivalent est accepte et compte comme une reussite ;
     2. il est ANNONCE comme equivalent, la ligne enregistree etant nommee ;
     3. l'indice et le bouton Solution montrent toujours la ligne
        enregistree, pas une equivalence ;
     4. un gain a PLUSIEURS coups n'accepte rien d'autre que sa ligne, meme
        si un champ alt trainait : la suite enregistree ne s'appliquerait
        plus apres un premier coup different.
   Et un coup qui n'est pas dans la liste reste refuse : un test qui ne
   verifierait que l'acceptation passerait au vert sur un code qui accepte
   tout. */
const SITE = require("path").join(__dirname, "..", "site");
const fs = require("fs"), jd = require("jsdom");
const html = fs.readFileSync(SITE + "/index.html", "utf8");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n) } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")) } };
const wait = ms => new Promise(r => setTimeout(r, ms));

/* Position reelle de la banque (#TAUXL, p23). Les Noirs jouent : f6e5 est la
   solution enregistree, d6e5 a ete mesure equivalent a profondeur 18
   (212 cp contre 212 cp, meme prise du fou par l'autre pion). */
const FEN = "1b4k1/5q1p/1p1p1p2/4B2P/Pp2P3/1P6/3K1PP1/R2R4 b - - 1 30";
const EXO = { id: "p23", fen: FEN, type: "gain", n: 0, sol: ["f6e5"], alt: ["d6e5"],
              theme: "Winning capture", level: 4, diff: 16, code: "TAUXL",
              explain: { sq: "e5", piece: "b" } };

function ouvrir() {
  return new Promise(res => {
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
    setTimeout(() => res(dom.window), 3400);
  });
}
/* Charge l'exercice donne dans l'ecran Exercices, sans passer par le tirage
   normal (qui servirait n'importe quoi d'autre). */
async function poser(w, exo) {
  w.eval("solveScreenSuppressAutoload=true;setMode('puzzles',{screen:'puzzles'});solveScreenSuppressAutoload=false;"
    + "puzzle=" + JSON.stringify(exo) + ";loadPuzzle();");
  await wait(400);
}
const jouer = (w, uci) => w.eval(
  "(function(){var m=game.moves().find(function(x){return game.uci(x)===" + JSON.stringify(uci) + "});"
  + "if(!m)return 'coup illegal';tryPuzzleMove(m);return 'joue';})()");

(async () => {
  {
    const w = await ouvrir(), d = w.document;
    console.log("\n--- Le coup equivalent est accepte ---");
    await poser(w, EXO);
    T("la position est bien celle de l'exercice", w.eval("game.fen()") === FEN, w.eval("game.fen()"));
    const sols = w.eval("currentSolutions().map(function(m){return game.uci(m)})");
    T("les deux coups sont acceptables", sols.length === 2, sols.join(" "));
    T("la solution enregistree reste en tete", sols[0] === "f6e5", sols.join(" "));
    T("l'indice montre la ligne enregistree", w.eval("game.uci(currentSolutions()[0])") === "f6e5");

    T("d6e5 est joue", jouer(w, "d6e5") === "joue");
    await wait(500);
    T("l'exercice est termine", w.eval("puzzleDone") === true);
    T("il compte comme une reussite", /win/.test(d.getElementById("exStatus").className),
      d.getElementById("exStatus").className);
    T("aucune tentative ratee comptee", w.eval("puzzleTries") === 0, w.eval("puzzleTries"));
    const msg = d.getElementById("exStatus").textContent;
    T("le message annonce l'equivalence", /wins too/i.test(msg), msg);
    T("le message nomme la ligne enregistree", /fxe5|f6e5/.test(msg), msg);
  }
  {
    const w = await ouvrir(), d = w.document;
    console.log("\n--- Un coup hors liste reste refuse ---");
    await poser(w, EXO);
    T("g8h8 est joue", jouer(w, "g8h8") === "joue");
    await wait(300);
    T("l'exercice n'est pas termine", w.eval("puzzleDone") !== true);
    T("une tentative ratee est comptee", w.eval("puzzleTries") === 1, w.eval("puzzleTries"));
    T("le message dit que c'est faux", /lose/.test(d.getElementById("exStatus").className),
      d.getElementById("exStatus").className);
  }
  {
    const w = await ouvrir();
    console.log("\n--- Sans champ alt, rien ne change ---");
    const sans = Object.assign({}, EXO); delete sans.alt;
    await poser(w, sans);
    const sols = w.eval("currentSolutions().map(function(m){return game.uci(m)})");
    T("un seul coup acceptable", sols.length === 1 && sols[0] === "f6e5", sols.join(" "));
    T("d6e5 est refuse", jouer(w, "d6e5") === "joue" && w.eval("puzzleTries") === 1);
  }
  {
    const w = await ouvrir();
    console.log("\n--- Un gain a plusieurs coups n'accepte que sa ligne ---");
    /* Meme position, mais declaree a trois demi-coups avec un alt qui
       trainerait : la suite enregistree ne vaudrait plus rien apres un
       premier coup different, donc le garde-fou doit l'ignorer. */
    const longue = Object.assign({}, EXO, { sol: ["f6e5", "d1e1", "e5b2"], alt: ["d6e5"] });
    await poser(w, longue);
    const sols = w.eval("currentSolutions().map(function(m){return game.uci(m)})");
    T("l'alternative est ignoree", sols.length === 1 && sols[0] === "f6e5", sols.join(" "));
  }

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
