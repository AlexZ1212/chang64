/* Verification automatique de chang64.
   Lancement : node tests/check_jour_suivant.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Exercice du jour suivant (2026-10-25, demande d'Alexandre) : apres un
   rattrapage reussi d'un jour passe, un bouton enchaine sur le lendemain.
   Verifie :
     - rattrapage d'il y a trois jours reussi : le bouton apparait et ouvre
       le rattrapage du lendemain, sur le bon exercice ;
     - rattrapage d'hier reussi : le bouton ouvre le VRAI exercice du jour ;
     - exercice du jour reussi : pas de bouton (pas de lendemain jouable) ;
     - exercice ordinaire : pas de bouton ;
     - le libelle est traduit dans les six langues. */
const path = require("path"), fs = require("fs"), jd = require("jsdom");
const SITE = path.join(__dirname, "..", "site");
const { Game, allMatingMoves } = require(path.join(__dirname, "..", "engine.js"));
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));

function ouvrir(page) {
  const html = fs.readFileSync(path.join(SITE, page), "utf8");
  return new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/",
    virtualConsole: new jd.VirtualConsole(),
    beforeParse(w) {
      w.fetch = (u, o) => {
        if (o && o.method === "POST") return Promise.resolve({ ok: true, status: 204 });
        const f = path.join(SITE, new URL(u, "https://chang64.com/").pathname);
        if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return Promise.resolve({ ok: false, status: 404 });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(fs.readFileSync(f, "utf8"))) });
      };
      w.navigator.sendBeacon = () => true;
    } }).window;
}

(async () => {
  const w = ouvrir("index.html"), d = w.document;
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
  /* Joue la solution ; un mat annonce accepte n'importe quel mat. */
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
  const cle = decalage => { const t = new Date(); t.setDate(t.getDate() + decalage);
    return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); };
  const visible = () => !$("btnDailyNext").classList.contains("hide");
  await attendre(1200);

  console.log("\n--- Rattrapage d'il y a trois jours ---");
  w.eval("attemptDailyArchive(" + JSON.stringify(cle(-3)) + ")"); await attendre(1500);
  T("pas de bouton avant de resoudre", !visible());
  T("rattrapage resolu", await resoudre());
  T("bouton affiche", visible());
  T("libelle court", $("btnDailyNext").textContent === "Next day", $("btnDailyNext").textContent);
  T("libelle complet pour les lecteurs d'ecran", $("btnDailyNext").getAttribute("aria-label") === "Next day's puzzle");
  /* Demande du 2026-10-27 : dans la barre d'actions collante, a la place
     d'"Exercice suivant" (cache sur l'ecran du jour), pas sous l'echiquier. */
  T("dans la barre d'actions, a cote d'Indice et Recommencer", $("exActions").contains($("btnDailyNext")));
  T("\"Exercice suivant\" reste cache sur l'ecran du jour", $("btnNext").classList.contains("hide"));
  clic($("btnDailyNext")); await attendre(1500);
  const p2 = w.eval("({id:puzzle.id,cle:puzzle.dailyCatchupKey,daily:puzzle.daily})");
  T("ouvre le rattrapage du lendemain", p2.daily && p2.cle === cle(-2), JSON.stringify(p2));
  T("sur le bon exercice", p2.id === w.eval("dateToDailyId(" + JSON.stringify(cle(-2)) + ")"), p2.id);
  T("le bouton se cache sur le nouvel exercice", !visible());

  console.log("\n--- Rattrapage d'hier : le lendemain est aujourd'hui ---");
  w.eval("attemptDailyArchive(" + JSON.stringify(cle(-1)) + ")"); await attendre(1500);
  T("rattrapage d'hier resolu", await resoudre());
  T("bouton affiche", visible());
  clic($("btnDailyNext")); await attendre(1800);
  const p3 = w.eval("({id:puzzle.id,cle:puzzle.dailyCatchupKey,daily:puzzle.daily})");
  T("ouvre le vrai exercice du jour", p3.daily && !p3.cle && p3.id === w.eval("dateToDailyId(todayKey())"), JSON.stringify(p3));

  console.log("\n--- Exercice du jour, puis exercice ordinaire ---");
  T("exercice du jour resolu", await resoudre());
  T("pas de bouton apres l'exercice du jour", !visible());
  clic($("tab-puzzles")); await attendre(500);
  clic($("cardSolvePuzzles")); await attendre(2000);
  T("exercice ordinaire resolu", await resoudre());
  T("pas de bouton apres un exercice ordinaire", !visible());
  w.close();

  console.log("\n--- Libelle dans les six langues ---");
  /* Libelle court (barre d'actions) et libelle complet (aria-label). */
  const court = { en: "Next day", fr: "Jour suivant", es: "Día siguiente", pt: "Dia seguinte", de: "Nächster Tag", ru: "Следующая" };
  const attendu = { en: "Next day's puzzle", fr: "Exercice du jour suivant", es: "Ejercicio del día siguiente",
    pt: "Exercício do dia seguinte", de: "Aufgabe des nächsten Tages", ru: "Задача следующего дня" };
  for (const l in attendu) {
    const page = l === "en" ? "index.html" : l + "/index.html";
    if (!fs.existsSync(path.join(SITE, page))) { T(l + " : page presente", false, page); continue; }
    const wl = ouvrir(page); await attendre(800);
    /* Le francais pose des espaces insecables apres les mots courts : on
       compare le texte, pas la typographie. */
    const s = wl.eval("t(\"Next day's puzzle\")").replace(/ /g, " ");
    T(l + " : " + attendu[l], s === attendu[l], s);
    const c = wl.eval("t(\"Next day\")").replace(/ /g, " ");
    T(l + " : court, " + court[l], c === court[l] && c.length <= 14, c);
    wl.close();
  }

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + e.stack); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
