/* Verification automatique de chang64.
   Lancement : node tests/check_motif_multi_niveaux.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-09-13) : "Travailler un motif" sert TOUS les
   exercices du motif, meme quand celui-ci vit dans plusieurs niveaux.

   Douze motifs sur treize tiennent entierement dans un niveau. Winning
   capture non : ses exercices ne rentrent pas dans un seul et occupent les
   niveaux 1 a 4. theme-levels.json ne publiait que le niveau le PLUS FOURNI,
   et le mode ne chargeait des morceaux que de celui-la. La tuile annoncait
   28 499 exercices, le mode en servait 7 125, tous parmi les plus faciles :
   les trois quarts restants etaient hors d'atteinte par ce chemin, sans
   qu'aucune erreur ne soit levee. L'ecart entre ce qui est annonce et ce qui
   est livre ne se voyait qu'en comparant deux fichiers de donnees.

   Le test verifie les trois maillons :
     1. la table publie bien une liste de niveaux, et elle est complete ;
     2. startMotif() la charge en entier, pas seulement son premier element ;
     3. une fois le niveau courant epuise, nextPuzzle() passe au suivant de
        la liste et sert reellement des exercices venus de la.
   Le troisieme est le seul qui compte vraiment : les deux premiers peuvent
   etre justes pendant que le mode tourne en rond sur un seul niveau. */
const SITE = require("path").join(__dirname, "..", "site");
const fs = require("fs"), jd = require("jsdom");
const html = fs.readFileSync(SITE + "/index.html", "utf8");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n) } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")) } };
const wait = ms => new Promise(r => setTimeout(r, ms));

/* Verite de reference : lue dans les morceaux reellement servis, jamais dans
   puzzles.json. Le champ level de la banque est perime, build_site.js
   recalcule les niveaux par famille a la construction, et mesurer sur la
   banque donne un tableau entierement faux. */
function niveauxReels() {
  const parMotif = {};
  for (let lvl = 1; lvl <= 10; lvl++) {
    const meta = JSON.parse(fs.readFileSync(SITE + "/data/level-" + lvl + ".json", "utf8"));
    for (let k = 0; k < meta.morceaux; k++)
      for (const p of JSON.parse(fs.readFileSync(SITE + "/data/level-" + lvl + "-" + k + ".json", "utf8")))
        (parMotif[p.theme] = parMotif[p.theme] || {})[lvl] = (parMotif[p.theme][lvl] || 0) + 1;
  }
  return parMotif;
}

(async () => {
  const reel = niveauxReels();
  const table = JSON.parse(fs.readFileSync(SITE + "/data/theme-levels.json", "utf8"));

  console.log("\n--- La table publie tous les niveaux de chaque motif ---");
  let completes = 0;
  for (const th in reel) {
    const attendus = Object.keys(reel[th]).map(Number).sort((a, b) => a - b);
    const publies = (Array.isArray(table[th]) ? table[th] : [table[th]]).slice().sort((a, b) => a - b);
    if (JSON.stringify(attendus) === JSON.stringify(publies)) completes++;
    else T(th, false, "publies " + publies.join(",") + " pour " + attendus.join(","));
  }
  T("les " + Object.keys(reel).length + " motifs ont leur liste complete", completes === Object.keys(reel).length);
  T("la liste commence par le niveau le plus fourni",
    Object.keys(reel).every(th => {
      const l = Array.isArray(table[th]) ? table[th] : [table[th]];
      return l[0] === +Object.keys(reel[th]).sort((a, b) => reel[th][b] - reel[th][a])[0];
    }));

  /* Le motif etale : celui qui a plus d'un niveau. S'il n'y en a plus aucun,
     le test n'a plus d'objet mais ne doit pas echouer pour autant. */
  const etale = Object.keys(reel).find(th => Object.keys(reel[th]).length > 1);
  if (!etale) {
    T("aucun motif etale sur plusieurs niveaux, rien a verifier", true);
    console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
    process.exit(ko ? 1 : 0);
  }
  const niveaux = (Array.isArray(table[etale]) ? table[etale] : [table[etale]]);
  console.log("\n--- " + etale + " s'etale sur les niveaux " + niveaux.join(", ") + " ---");

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
  const w = dom.window;
  await wait(3400);

  w.eval("startMotif(" + JSON.stringify(etale) + ")");
  await wait(1500);
  T("le motif est lance", w.eval("motifEnCours") === etale, w.eval("motifEnCours"));
  T("la liste des niveaux est chargee en entier",
    JSON.stringify(w.eval("motifNiveaux")) === JSON.stringify(niveaux),
    JSON.stringify(w.eval("motifNiveaux")));
  T("on puise d'abord dans le premier", w.eval("motifNiveau") === niveaux[0], w.eval("motifNiveau"));
  const avant = w.eval("(puzzle&&puzzle.theme)||null");
  T("l'exercice servi porte le motif", avant === etale, avant);

  /* On simule l'epuisement du niveau courant plutot que de resoudre des
     milliers d'exercices : tous les morceaux deja demandes, et tout ce qui
     est charge marque comme vu. C'est exactement l'etat dans lequel se
     trouve quelqu'un qui a fait le tour du niveau. */
  w.eval("LEVEL_META[motifNiveau].morceaux=1;"
       + "prog.seen=allLoadedPuzzles().map(function(p){return p.id});");
  const niveauAvant = w.eval("motifNiveau");
  w.eval("nextPuzzle()");
  await wait(2500);

  console.log("\n--- Niveau epuise : le mode passe au suivant ---");
  const niveauApres = w.eval("motifNiveau");
  T("le niveau courant a avance", niveauApres === niveaux[niveaux.indexOf(niveauAvant) + 1],
    niveauAvant + " -> " + niveauApres);
  T("l'exercice servi porte toujours le motif",
    w.eval("(puzzle&&puzzle.theme)||null") === etale, w.eval("(puzzle&&puzzle.theme)||null"));
  const ids = new Set(JSON.parse(fs.readFileSync(SITE + "/data/level-" + niveauApres + "-0.json", "utf8")).map(p => p.id));
  T("des exercices du niveau suivant sont bien charges",
    w.eval("allLoadedPuzzles().map(function(p){return p.id})").some(id => ids.has(id)));

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
