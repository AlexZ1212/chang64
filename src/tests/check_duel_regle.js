/* Verification automatique de chang64.
   Lancement : node tests/check_duel_regle.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Regle du Duel d'exercices (2026-11-22, decisions d'Alexandre du 21 et du
   22/11) : un exercice resolu en duel compte pour l'objectif du jour et pour
   les exercices resolus, mais ne fait bouger ni le niveau exercices (la note,
   prog.rating) ni le palier de l'echelle (prog.level). Les cinq exercices
   d'un duel recu sont choisis au niveau de l'autre joueur.
   Le test passe par le vrai chemin (duelCreer, finishPuzzle, registerWrong)
   et compare avec un exercice ordinaire, qui lui fait bouger les deux :
   sans ce temoin, un test qui ne ferait rien passerait au vert.
   Il verifie aussi les noms vus par le joueur en francais : « Duel
   d'exercices », « Niveau exercices », « Palier », « Duels entre membres ». */
const path = require("path"), fs = require("fs"), jd = require("jsdom");
const SITE = path.join(__dirname, "..", "site");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const propre = s => String(s || "").replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();

function ouvrir(page) {
  const html = fs.readFileSync(path.join(SITE, page), "utf8");
  return new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/" + page.replace(/index\.html$/, ""),
    virtualConsole: new jd.VirtualConsole(),
    beforeParse(w) {
      w.fetch = (u, o) => {
        const url = new URL(u, "https://chang64.com/");
        if (url.pathname.startsWith("/api/")) return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ erreur: "session" }) });
        if (o && o.method === "POST") return Promise.resolve({ ok: true, status: 204 });
        const f = path.join(SITE, url.pathname);
        if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return Promise.resolve({ ok: false, status: 404 });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(fs.readFileSync(f, "utf8"))) });
      };
      w.navigator.sendBeacon = () => true;
    } }).window;
}
async function charge(w, cond, max) { for (let i = 0; i < (max || 60); i++) { if (w.eval(cond)) return true; await attendre(100); } return false; }

(async () => {
  const w = ouvrir("fr/index.html");
  await attendre(3500);
  const d = w.document;

  console.log("\n--- Les noms en francais ---");
  T("la carte de Resoudre s'appelle « Duel d'exercices »", propre(d.querySelector("#cardSolveDuel b").textContent) === "Duel d'exercices", propre(d.querySelector("#cardSolveDuel b").textContent));
  T("la fenetre du duel porte ce nom pour un lecteur d'ecran", propre(d.getElementById("duel").getAttribute("aria-label")) === "Duel d'exercices");
  const stats = [...d.querySelectorAll(".stat span")].map(e => propre(e.textContent));
  T("la note s'appelle « Niveau exercices »", stats.includes("Niveau exercices"), stats.join(" / "));
  /* 2026-11-22 : la tuile « Palier » a quitte l'accueil (trois chiffres seulement) ;
     le mot reste celui de l'echelle des Exercices, lu ici dans le dictionnaire. */
  T("le palier de l'echelle s'appelle « Palier »", propre(w.eval("t('Level')")) === "Palier" && !stats.includes("Niveau"), propre(w.eval("t('Level')")));
  T("la carte des exercices dit palier et niveau exercices", /^Palier \d+ \| niveau exercices \d+$/.test(propre(w.eval('t("Level {n} | puzzle rating {r}",{n:3,r:850})'))));
  T("le menu dit « Duels entre membres »", propre(d.querySelector('#menuTiroir [data-t="Member duels"]').textContent) === "Duels entre membres");
  T("le partage de l'exercice du jour ne parle plus de defi", propre(d.getElementById("btnChallengeDaily").textContent) === "Envoyer à un ami");
  T("la carte Contre un ami invite, elle ne defie plus", [...d.querySelectorAll(".jouer-go")].some(e => propre(e.textContent) === "Inviter un ami →"));
  T("plus aucun « défi » dans la fenetre d'un duel recu", !/d[ée]fi/i.test(propre(w.eval('t("{name} invites you to a puzzle duel",{name:"Alice"})+t("Play the duel")+t("New duel")'))));
  T("le Makruk garde « Difficulté » (et non « Palier »)", w.eval('t("Difficulty")') === "Difficulté");

  console.log("\n--- Temoin : un exercice ordinaire fait bouger note et palier ---");
  w.eval("ensureProgFields();prog.level=3;prog.rating=1000;prog.correctRun=0;prog.wrongRun=0;saveProg()");
  w.eval("setMode('puzzles');showSolveScreen('puzzles')");
  T("un exercice ordinaire est charge", await charge(w, "!!puzzle&&!puzzle.daily&&!duel"));
  const noteAvant = w.eval("prog.rating");
  for (let i = 0; i < 3; i++) {
    w.eval("puzzleTries=0;finishPuzzle(true,'ok')");
    if (i < 2) { const id = w.eval("puzzle.id"); w.eval("nextPuzzle()"); await charge(w, "puzzle&&puzzle.id!=='" + id + "'&&!puzzleDone"); }
  }
  T("hors duel, trois reussites font monter d'un palier", w.eval("prog.level") === 4, "palier " + w.eval("prog.level"));
  T("hors duel, la note bouge", w.eval("prog.rating") !== noteAvant, noteAvant + " -> " + w.eval("prog.rating"));

  console.log("\n--- Pendant un duel ---");
  w.eval("prog.level=3;prog.rating=1000;prog.correctRun=1;prog.wrongRun=2;saveProg()");
  const resolusAvant = w.eval("prog.solved"), objAvant = w.eval("objFaits()");
  w.eval("duelCreer()");
  T("le duel commence", await charge(w, "!!duel&&duelIci()", 80));
  for (let i = 0; i < 3; i++) {
    T("exercice " + (i + 1) + " du duel charge", await charge(w, "duelIci()&&duel.i===" + i, 80));
    w.eval("puzzleTries=0;finishPuzzle(true,'ok')");
    w.eval("duelSuivant()");
  }
  T("trois reussites en duel ne font pas monter de palier", w.eval("prog.level") === 3, "palier " + w.eval("prog.level"));
  T("la note ne bouge pas", w.eval("prog.rating") === 1000, "note " + w.eval("prog.rating"));
  T("les exercices resolus comptent", w.eval("prog.solved") === resolusAvant + 3, resolusAvant + " -> " + w.eval("prog.solved"));
  T("l'objectif du jour compte", w.eval("objFaits()") === objAvant + 3, objAvant + " -> " + w.eval("objFaits()"));
  T("la suite de reussites d'avant le duel est intacte", w.eval("prog.correctRun") === 1, "correctRun " + w.eval("prog.correctRun"));

  T("exercice 4 du duel charge", await charge(w, "duelIci()&&duel.i===3", 80));
  const id4 = w.eval("puzzle.id");
  w.eval("registerWrong();registerWrong();registerWrong();registerWrong();eloEchec()");
  T("quatre erreurs en duel ne font pas descendre", w.eval("prog.level") === 3, "palier " + w.eval("prog.level"));
  T("une erreur en duel ne coute rien a la note", w.eval("prog.rating") === 1000, "note " + w.eval("prog.rating"));
  T("l'exercice rate va quand meme dans « a revoir »", w.eval("prog.mistakeQueue.some(m=>m.id==='" + id4 + "')"));
  T("la suite d'erreurs d'avant le duel est intacte", w.eval("prog.wrongRun") === 2, "wrongRun " + w.eval("prog.wrongRun"));
  w.eval("finishPuzzle(false,'rate');duelSuivant()");
  T("exercice 5 du duel charge", await charge(w, "duelIci()&&duel.i===4", 80));
  w.eval("puzzleTries=0;finishPuzzle(true,'ok')");
  /* La fenetre de fin attend qu'une fenetre Bravo (badge gagne) se ferme :
     un duel fini, cinq resultats notes, suffit ici. */
  T("le duel se termine (cinq resultats)", await charge(w, "!duel||(duel.fin&&duel.res.length===5)", 80), w.eval("duel&&duel.res.join('')"));
  T("apres le duel, palier et note sont ceux d'avant", w.eval("prog.level") === 3 && w.eval("prog.rating") === 1000, w.eval("prog.level") + " / " + w.eval("prog.rating"));
  T("le gel de l'echelle est leve apres le duel", w.eval("echelleGelee") === false);

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception " + (e && e.stack || e)); process.exit(1); });
