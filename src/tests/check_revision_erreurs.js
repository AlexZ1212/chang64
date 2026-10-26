/* Verification automatique de chang64.
   Lancement : node tests/check_revision_erreurs.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Erreurs a revoir (2026-10-26). La file de repetition espacee
   (prog.mistakeQueue) existait, mais seulement sous forme de croix dans la
   colonne de l'ecran Exercices, et Suivant y tirait un exercice au hasard.
   Verifie :
     - la carte du menu Resoudre : cachee si la file est vide, nombre
       d'erreurs echues, desactivee si aucune n'est echue ;
     - la session : elle ouvre la premiere erreur echue (marquee "Review"),
       Suivant passe a la suivante, puis ramene au menu ;
     - une erreur rejouee n'est pas envoyee a la mesure de la difficulte ;
     - les phrases traduites. */
const path = require("path"), fs = require("fs"), jd = require("jsdom");
const SITE = path.join(__dirname, "..", "site");
const { Game, allMatingMoves } = require(path.join(__dirname, "..", "engine.js"));
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));

function ouvrir(page, envois) {
  const html = fs.readFileSync(path.join(SITE, page), "utf8");
  return new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/",
    virtualConsole: new jd.VirtualConsole(),
    beforeParse(w) {
      w.fetch = (u, o) => {
        if (o && o.method === "POST") { envois && envois.push(o.body); return Promise.resolve({ ok: true, status: 204 }); }
        const f = path.join(SITE, new URL(u, "https://chang64.com/").pathname);
        if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return Promise.resolve({ ok: false, status: 404 });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(fs.readFileSync(f, "utf8"))) });
      };
      w.navigator.sendBeacon = (u, b) => { envois && envois.push(b); return true; };
    } }).window;
}

(async () => {
  const envois = [];
  const w = ouvrir("index.html", envois), d = w.document;
  const $ = id => d.getElementById(id);
  const clic = el => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  const cases = () => $("board").children;
  const retourne = () => { const c = cases()[0].querySelector(".co.r"); return c ? c.textContent.trim() === "1" : false; };
  const caseDe = sq => { const f = "abcdefgh".indexOf(sq[0]), r = 8 - +sq[1]; return retourne() ? (7 - r) * 8 + (7 - f) : r * 8 + f; };
  const jouer = async uci => { clic(cases()[caseDe(uci.slice(0, 2))]); await attendre(50); clic(cases()[caseDe(uci.slice(2, 4))]); await attendre(900); };
  const placement = () => {
    const flip = retourne(), grille = {};
    for (let i = 0; i < 64; i++) { const p = cases()[i].querySelector(".piece"); if (!p) continue;
      const r0 = Math.floor(i / 8), f0 = i % 8, r = flip ? 7 - r0 : r0, f = flip ? 7 - f0 : f0, dp = p.dataset.p;
      grille[r * 8 + f] = dp[0] === "w" ? dp[1].toUpperCase() : dp[1]; }
    let out = "";
    for (let r = 0; r < 8; r++) { let e = 0;
      for (let f = 0; f < 8; f++) { const p = grille[r * 8 + f]; if (!p) { e++; continue; } if (e) { out += e; e = 0; } out += p; }
      if (e) out += e; if (r < 7) out += "/"; }
    return out;
  };
  const gagne = () => $("exStatus").className.includes("win");
  const resoudre = async () => {
    const pz = w.eval("puzzle");
    for (let k = 0; k < pz.sol.length && !gagne(); k += 2) {
      await jouer(pz.sol[k]);
      if ($("promoModal").className.includes("on")) { clic($("promoBtns").children[0]); await attendre(400); }
    }
    if (!gagne() && pz.type === "mate") {
      const g = new Game(placement() + " " + pz.fen.split(" ")[1] + " - - 0 1"), mm = allMatingMoves(g, 1);
      if (mm.length) await jouer(g.uci(mm[0]));
    }
    await attendre(300);
    return gagne();
  };
  await attendre(1200);
  const menu = async () => { clic($("tab-puzzles")); await attendre(500); w.eval("showSolveScreen('menu')"); await attendre(200); };
  const carte = () => $("cardSolveMistakes");

  console.log("\n--- La carte du menu ---");
  await menu();
  T("cachee tant que la file est vide", carte().classList.contains("hide"));
  const lot = JSON.parse(fs.readFileSync(path.join(SITE, "data", "level-1-0.json"), "utf8"));
  const [a, b, c] = lot;
  w.eval(`ensureProgFields();prog.mistakeQueue=[
    {id:${JSON.stringify(a.id)},theme:"x",code:"",ts:0,box:1,due:0},
    {id:${JSON.stringify(b.id)},theme:"x",code:"",ts:0,box:2,due:0},
    {id:${JSON.stringify(c.id)},theme:"x",code:"",ts:0,box:3,due:Date.now()+864e5}];saveProg();`);
  await menu();
  T("affichee quand la file a des erreurs", !carte().classList.contains("hide"));
  T("annonce deux erreurs echues", $("subSolveMistakes").textContent === "2 to review now", $("subSolveMistakes").textContent);
  T("cliquable", !carte().disabled);

  console.log("\n--- La session ---");
  clic(carte()); await attendre(1500);
  T("ouvre la premiere erreur echue", w.eval("puzzle.id") === a.id, w.eval("puzzle.id"));
  T("marquee comme revision", $("exTheme").textContent.startsWith("Review · "), $("exTheme").textContent);
  T("erreur rejouee resolue", await resoudre());
  T("pas envoyee a la mesure de la difficulte", envois.length === 0, envois.length);
  T("palier suivant apres la reussite", w.eval(`prog.mistakeQueue.find(m=>m.id===${JSON.stringify(a.id)}).box`) === 2);
  clic($("btnNext")); await attendre(1500);
  T("Suivant ouvre l'erreur echue suivante", w.eval("puzzle.id") === b.id, w.eval("puzzle.id"));
  T("pas l'erreur pas encore echue", w.eval("puzzle.id") !== c.id);
  clic($("btnNext")); await attendre(800);
  T("la file epuisee, retour au menu", w.eval("solveScreen") === "menu", w.eval("solveScreen"));
  T("session terminee", w.eval("revisionEnCours") === false);
  clic($("cardSolvePuzzles")); await attendre(2000);
  T("ensuite, Exercices reprend la file normale", !$("exTheme").textContent.startsWith("Review"), $("exTheme").textContent);
  w.close();

  console.log("\n--- Traductions ---");
  const attendu = { fr: "Erreurs à revoir", es: null, pt: null, de: null, ru: null };
  for (const l of ["fr", "es", "pt", "de", "ru"]) {
    const wl = ouvrir(l + "/index.html"); await attendre(800);
    const s = wl.eval("t(\"{n} to review now\",{n:3})"), r = wl.eval("t(\"Review · \")");
    T(l + " : phrases traduites", !/to review|Review/.test(s + r) && /3/.test(s), s + " | " + r);
    if (attendu[l]) T(l + " : titre de la carte", wl.document.getElementById("cardSolveMistakes").textContent.replace(/ /g, " ").includes(attendu[l]));
    wl.close();
  }

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + e.stack); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
