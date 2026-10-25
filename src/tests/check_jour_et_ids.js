/* Verification automatique de chang64.
   Lancement : node tests/check_jour_et_ids.js
   Le site doit avoir ete construit au prealable : node build_site.js

   2026-10-24 : puzzle-index.json (tout l'index en un fichier, 1,7 Mo, bientot
   3,6) est remplace par data/ids/<k>.json (une tranche par 10 000
   identifiants) et data/jour.json (exercices du jour deja tires). La
   formule du jour dependait du nombre d'exercices : chaque fusion changeait
   les exercices des jours passes. Ils sont figes dans exercices-du-jour.json.
   Verifie : les tranches couvrent la banque ; jour.json couvre du premier
   jour du site a 60 jours apres la construction, avec des exercices qui
   existent ; le registre fige tous les jours ecoules, en accord avec
   jour.json ; dans la page, l'exercice du jour et le calendrier lisent
   jour.json, et un lien direct ne charge que sa tranche. */
const path = require("path");
const fs = require("fs"), jd = require("jsdom");
const SRC = path.join(__dirname, "..");
const SITE = path.join(SRC, "site");
const html = fs.readFileSync(SITE + "/index.html", "utf8");
const banque = require(path.join(SRC, "banque.js")).charger();
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const jourDe = iso => Math.floor(Date.parse(iso + "T00:00:00Z") / 86400000);

console.log("\n--- Les fichiers ---");
/* puzzle-index.json reste publie pendant la transition, pour les anciens
   clients encore en cache (voir build_site.js) ; il doit au moins couvrir
   la banque courante. Que le NOUVEAU code ne le charge plus est verifie
   plus bas, dans la page. */
const transition = path.join(SITE, "data", "puzzle-index.json");
T("puzzle-index.json de transition coherent avec la banque", !fs.existsSync(transition) ||
  Object.keys(JSON.parse(fs.readFileSync(transition, "utf8"))).length === banque.length);
const idx = {};
const tranches = fs.readdirSync(path.join(SITE, "data", "ids"));
let rangees = true;
for (const f of tranches) {
  const t = JSON.parse(fs.readFileSync(path.join(SITE, "data", "ids", f), "utf8"));
  for (const id in t) if (Math.floor(+id.slice(1) / 10000) !== +f.replace(".json", "")) rangees = false;
  Object.assign(idx, t);
}
T("les tranches couvrent toute la banque (" + banque.length + ")", Object.keys(idx).length === banque.length, Object.keys(idx).length);
T("chaque identifiant dans la tranche de son numero", rangees);
const J = JSON.parse(fs.readFileSync(path.join(SITE, "data", "jour.json"), "utf8"));
const dates = JSON.parse(fs.readFileSync(path.join(SRC, "content-dates.json"), "utf8"));
const auj = Math.floor(Date.now() / 86400000);
T("jour.json commence au premier jour du site", J.debut <= jourDe(dates["/"].publiee), new Date(J.debut * 864e5).toISOString().slice(0, 10));
T("jour.json va jusqu'a 60 jours apres la construction", J.debut + J.ids.length - 1 >= auj + 59, J.ids.length + " jours");
T("chaque exercice du jour existe", J.ids.every(id => idx[id]), J.ids.filter(id => !idx[id]).slice(0, 3).join(" "));

console.log("\n--- Le registre fige les jours ecoules ---");
const R = JSON.parse(fs.readFileSync(path.join(SRC, "exercices-du-jour.json"), "utf8"));
let manquants = 0, desaccords = 0;
for (let n = J.debut; n <= auj - 1; n++) {
  if (!R[n]) manquants++;
  else if (R[n] !== J.ids[n - J.debut]) desaccords++;
}
T("chaque jour ecoule est fige", manquants === 0, manquants + " manquant(s)");
T("jour.json reprend le registre pour ces jours", desaccords === 0, desaccords + " desaccord(s)");

(async () => {
  console.log("\n--- Dans la page ---");
  const demandes = [];
  const dom = new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/",
    virtualConsole: new jd.VirtualConsole(),
    beforeParse(w) {
      w.fetch = url => {
        const u = String(url).replace(/^https?:\/\/[^/]+/, "").split("?")[0];
        demandes.push(u);
        try { const data = JSON.parse(fs.readFileSync(path.join(SITE, u), "utf8")); return Promise.resolve({ ok: true, json: () => Promise.resolve(data) }); }
        catch (e) { return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(e) }); }
      };
    } });
  const w = dom.window, d = w.document;
  await attendre(1200);
  d.getElementById("tab-puzzles").click(); await attendre(200);
  d.getElementById("cardSolveDaily").click(); await attendre(2500);
  const attendu = banque.find(p => p.id === J.ids[auj - J.debut]);
  const code = ((d.getElementById("exCode") || {}).textContent || "").replace(/^#/, "");
  T("l'exercice du jour est celui de jour.json (" + (attendu && attendu.code) + ")", !!attendu && code === attendu.code, code);
  T("sans charger d'index complet", !demandes.some(u => /puzzle-index/.test(u)), demandes.filter(u => /index/.test(u)).join(" "));
  const hier = new Date((auj - 1) * 864e5).toISOString().slice(0, 10);
  T("le calendrier lit le jour passe dans jour.json", w.eval('dateToDailyId("' + hier + '")') === R[auj - 1], w.eval('dateToDailyId("' + hier + '")'));
  demandes.length = 0;
  const lointain = banque[banque.length - 1];
  w.eval('loadPuzzleById("' + lointain.id + '", function(){})'); await attendre(800);
  const tranche = "/data/ids/" + Math.floor(+lointain.id.slice(1) / 10000) + ".json";
  T("un lien direct ne charge que sa tranche (" + tranche + ")", demandes.filter(u => u.startsWith("/data/ids/")).join(" ") === tranche, demandes.join(" "));
  T("et trouve l'exercice", !!w.eval('PUZZLE_CACHE["' + lointain.id + '"]'));
  w.eval('loadPuzzleById("p999999999", function(p){ window.__introuvable = p; })'); await attendre(600);
  T("un identifiant hors banque rend null sans planter", w.eval("window.__introuvable") === null);
  w.close();
  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + e.stack); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
