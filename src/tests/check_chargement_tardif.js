/* Verification automatique de chang64.
   Lancement : node tests/check_chargement_tardif.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Les exercices arrivent par le reseau, et leur rappel (nextPuzzle,
   dailyPuzzle, loadRushPool...) finit par loadPuzzle(), qui remplace game.
   Partie en cours, ouvrir Exercices ou Defis puis revenir dans Jouer avant
   la fin du premier chargement : la reponse tardive posait l'exercice sur
   l'echiquier de Jouer, et la partie etait perdue au changement d'onglet
   suivant (setMode range game dans mainGame). Trouve le 2026-10-24 en
   cherchant pourquoi check_overlay_et_verrouillage.js echouait sous charge.
   On retient ici toutes les reponses de /data/ et on ne les relache
   qu'apres le retour dans Jouer. */
const path = require("path");
const fs = require("fs"), jd = require("jsdom");
const SITE = path.join(__dirname, "..", "site");
const html = fs.readFileSync(SITE + "/index.html", "utf8");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));

/* Reponses en attente : servies depuis le build local, mais seulement
   quand le test le decide. Une fenetre neuve par scenario, pour que chacun
   parte sans aucune donnee en cache. */
let enAttente = [];
function ouvrir() {
  enAttente = [];
  const dom = new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/",
    virtualConsole: new jd.VirtualConsole(),
    beforeParse(w) {
      w.fetch = url => new Promise(res => enAttente.push(() => {
        const p = path.join(SITE, String(url).replace(/^https?:\/\/[^/]+/, "").split("?")[0]);
        try { const data = JSON.parse(fs.readFileSync(p, "utf8")); res({ ok: true, json: () => Promise.resolve(data) }); }
        catch (e) { res({ ok: false, status: 404, json: () => Promise.reject(e) }); }
      }));
    } });
  return dom.window;
}
/* Un rappel peut en declencher un autre (le niveau, puis son premier
   morceau) : on relache jusqu'a ce que plus rien n'attende. */
async function relacher() {
  for (let i = 0; i < 20; i++) {
    const l = enAttente.splice(0);
    if (!l.length) { await attendre(100); if (!enAttente.length) return; continue; }
    l.forEach(f => f());
    await attendre(150);
  }
}
/* Une partie en cours, au joueur de jouer (le moteur a deja ouvert s'il
   a les Blancs). */
async function partieEnCours() {
  const w = ouvrir(); await attendre(1500);
  const d = w.document, ev = s => w.eval(s);
  const clic = id => d.getElementById(id).click();
  clic("heroPlay"); await attendre(600);
  clic("readyStart"); await attendre(500);
  for (let i = 0; i < 100 && !ev("game.turn===myColor"); i++) await attendre(100);
  T("partie en cours, au joueur de jouer", ev("mode==='play'&&gameStarted&&game.turn===myColor"));
  ev("window.__partie=game");
  return { ev, clic, partieIntacte: () => ev("game===window.__partie") };
}

(async () => {
  for (const [nom, ouvrirEcran] of [
    ["Exercices", async clic => { clic("tab-puzzles"); await attendre(250); clic("cardSolvePuzzles"); await attendre(250); }],
    ["Exercice du jour", async clic => { clic("tab-puzzles"); await attendre(250); clic("cardSolveDaily"); await attendre(250); }],
    ["Defis", async clic => { clic("tab-puzzles"); await attendre(250); clic("cardSolveSprint"); await attendre(250); }],
    /* Demarrer le Sprint avant l'arrivee du pool : startRush se rappelle
       lui-meme une fois le pool charge. */
    ["Sprint lance", async clic => { clic("tab-puzzles"); await attendre(250); clic("cardSolveSprint"); await attendre(250); clic("readyStart"); await attendre(250); }]
  ]) {
    console.log("\n--- " + nom + ", puis retour dans Jouer avant les donnees ---");
    const { ev, clic, partieIntacte } = await partieEnCours();
    await ouvrirEcran(clic);
    T("une requete attend bien", enAttente.length > 0, String(enAttente.length));
    clic("tab-play"); await attendre(300);
    T("la partie est revenue", partieIntacte() && ev("mode") === "play");
    await relacher();
    T("la partie n'est pas remplacee par l'exercice", partieIntacte(), ev("game.fen()"));
    T("aucun sprint ne demarre dans Jouer", !ev("rush"));
    T("toujours dans Jouer", ev("mode") === "play", ev("mode"));
    /* Le changement d'onglet suivant rangeait l'exercice a la place de la
       partie : on va et on revient pour s'en assurer. */
    clic("brand"); await attendre(250);
    clic("tab-play"); await attendre(300);
    T("la partie survit a un aller-retour", partieIntacte());
    /* L'exercice ignore ne doit pas rester designe : l'apercu de Defis ne
       recharge qu'en l'absence d'exercice, et montrait sinon la partie. */
    await ouvrirEcran(clic); await relacher(); await attendre(200);
    T("de retour sur l'ecran, un exercice y est bien pose",
      !partieIntacte() && ev("game.fen()") === ev("puzzle&&puzzle.fen"), ev("mode") + " " + ev("game.fen()"));
  }

  /* La garde ne doit pas empecher le chargement normal : rester dans
     Exercices pendant le chargement pose bien l'exercice. */
  console.log("\n--- Rester dans Exercices pendant le chargement ---");
  {
    const { ev, clic, partieIntacte } = await partieEnCours();
    clic("tab-puzzles"); await attendre(250);
    clic("cardSolvePuzzles"); await attendre(250);
    await relacher(); await attendre(200);
    T("l'exercice est pose sur l'echiquier", !partieIntacte() && ev("mode") === "puzzles" && ev("game.fen()") === ev("puzzle.fen"),
      ev("game.fen()") + " / " + ev("puzzle&&puzzle.fen"));
    clic("tab-play"); await attendre(300);
    T("et la partie attend dans Jouer", partieIntacte());
  }

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
