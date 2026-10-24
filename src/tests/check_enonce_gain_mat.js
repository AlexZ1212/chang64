/* Verification automatique de chang64.
   Lancement : node tests/check_enonce_gain_mat.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Audit du 2026-10-24 : depuis que le mineur prolonge les gains, une
   solution peut finir sur un mat. L'enonce disait pourtant "Les Blancs
   jouent et gagnent du materiel" (544 exercices de la banque, dont #50C7L,
   qui se termine par Dg7#). Ces gains s'annoncent desormais "jouent et
   gagnent" ; les autres gains et les mats ne changent pas.
   Verifie : la detection sur toute la banque (meme compte que le rejeu par
   engine.js) ; l'enonce affiche, en francais et en anglais, sur un gain qui
   finit par un mat, un gain prolonge sans mat, et un gain en un coup. */
const path = require("path");
const fs = require("fs"), jd = require("jsdom");
const SITE = path.join(__dirname, "..", "site");
const html = fs.readFileSync(SITE + "/index.html", "utf8");
const { Game } = require(path.join(__dirname, "..", "engine.js"));
const banque = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "puzzles.json"), "utf8"));
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));

/* Reference calculee ici, independamment de ui.js. */
function finitParMat(p) {
  const g = new Game(p.fen);
  for (const u of p.sol) { const m = g.moves().find(x => g.uci(x) === u); if (!m) return false; g.makeMove(m); }
  return g.moves().length === 0 && g.inCheck();
}
const gainsMulti = banque.filter(p => p.type === "gain" && p.sol.length >= 3);
const avecMat = gainsMulti.filter(finitParMat);
const sansMat = gainsMulti.find(p => !finitParMat(p));
const unCoup = banque.find(p => p.type === "gain" && p.sol.length === 1);
const blancs = avecMat.find(p => p.fen.split(" ")[1] === "w");

function ouvrir(langue, id) {
  const dom = new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/#puzzle=" + id,
    virtualConsole: new jd.VirtualConsole(),
    beforeParse(w) {
      Object.defineProperty(w.navigator, "language", { value: langue, configurable: true });
      w.fetch = url => {
        const p = path.join(SITE, String(url).replace(/^https?:\/\/[^/]+/, "").split("?")[0]);
        try { const data = JSON.parse(fs.readFileSync(p, "utf8")); return Promise.resolve({ ok: true, json: () => Promise.resolve(data) }); }
        catch (e) { return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(e) }); }
      };
    } });
  return dom.window;
}
async function enonce(langue, p) {
  const w = ouvrir(langue, p.id); await attendre(2500);
  const d = w.document;
  /* Le francais met une espace insecable apres les mots courts ("Les", "et") : on la ramene a une espace ordinaire pour comparer. */
  const r = { quete: ((d.getElementById("exQuest") || {}).textContent || "").replace(/\u00a0/g, " "), code: (d.getElementById("exCode") || {}).textContent || "" };
  r.detecte = typeof w.gainFinitParMat === "function" ? w.gainFinitParMat(p) : "absente";
  w.close();
  return r;
}

(async () => {
  console.log("\n--- Detection sur la banque ---");
  T("des gains prolonges finissent par un mat", avecMat.length > 0, avecMat.length);
  const w = ouvrir("fr-FR", unCoup.id); await attendre(1500);
  T("gainFinitParMat existe dans la page", typeof w.gainFinitParMat === "function");
  const vus = banque.filter(p => w.gainFinitParMat(p)).length;
  T("meme compte que le rejeu par engine.js (" + avecMat.length + ")", vus === avecMat.length, vus);
  T("aucun exercice de type mat n'est compte", !banque.some(p => p.type === "mate" && w.gainFinitParMat(p)));
  T("solution illegale : pas de plantage, faux", w.gainFinitParMat({ type: "gain", fen: unCoup.fen, sol: ["a1a1", "a1a1", "a1a1"] }) === false);
  w.close();

  console.log("\n--- Enonce affiche ---");
  for (const [langue, materiel, gagnent] of [
    ["fr-FR", /jouent et gagnent du matériel\.$/, /^Les (Blancs|Noirs) jouent et gagnent\.$/],
    ["en-US", /to play and win material\.$/, /^(White|Black) to play and win\.$/]]) {
    let r = await enonce(langue, blancs);
    T(langue + " gain qui finit par un mat (" + blancs.code + ")", gagnent.test(r.quete) && /Blancs|White/.test(r.quete), r.quete);
    r = await enonce(langue, sansMat);
    T(langue + " gain prolonge sans mat (" + sansMat.code + ")", materiel.test(r.quete), r.quete);
    r = await enonce(langue, unCoup);
    T(langue + " gain en un coup (" + unCoup.code + ")", materiel.test(r.quete), r.quete);
  }

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + e.message); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
