/* Verification automatique de chang64.
   Lancement : node tests/check_lien_code.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Audit du 2026-10-24 : le badge d'un exercice montre son code (#50C7L),
   mais #puzzle= n'acceptait que l'identifiant interne (p76452). Un code
   partage ouvrait un autre exercice, sans message. Les codes passent
   desormais par data/codes/<initiale>.json.
   Verifie : les tables couvrent toute la banque, sans erreur ; un lien par
   code ouvre le bon exercice, en majuscules comme en minuscules ; le lien
   par identifiant marche toujours ; un code inconnu retombe sur un
   exercice ordinaire sans planter. */
const path = require("path");
const fs = require("fs"), jd = require("jsdom");
const SITE = path.join(__dirname, "..", "site");
const html = fs.readFileSync(SITE + "/index.html", "utf8");
const banque = require(path.join(__dirname, "..", "banque.js")).charger();
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));

function ouvrir(hash) {
  const dom = new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/" + hash,
    virtualConsole: new jd.VirtualConsole(),
    beforeParse(w) {
      Object.defineProperty(w.navigator, "language", { value: "fr-FR", configurable: true });
      w.fetch = url => {
        const p = path.join(SITE, String(url).replace(/^https?:\/\/[^/]+/, "").split("?")[0]);
        try { const data = JSON.parse(fs.readFileSync(p, "utf8")); return Promise.resolve({ ok: true, json: () => Promise.resolve(data) }); }
        catch (e) { return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(e) }); }
      };
    } });
  return dom.window;
}
async function codeAffiche(hash) {
  const w = ouvrir(hash); await attendre(2500);
  const c = ((w.document.getElementById("exCode") || {}).textContent || "").replace(/^#/, "");
  w.close();
  return c;
}

(async () => {
  console.log("\n--- Tables code -> identifiant ---");
  const dir = path.join(SITE, "data", "codes");
  const table = {};
  for (const f of fs.readdirSync(dir)) Object.assign(table, JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  T("une entree par exercice (" + banque.length + ")", Object.keys(table).length === banque.length, Object.keys(table).length);
  const faux = banque.filter(p => table[p.code] !== p.id);
  T("chaque code mene a son exercice", !faux.length, faux.slice(0, 3).map(p => p.code).join(" "));
  const tailles = fs.readdirSync(dir).map(f => fs.statSync(path.join(dir, f)).size);
  /* 53 Ko par table a 108 868 exercices ; la banque doit passer vers
     500 000 apres la fusion de fin de minage, soit environ 245 Ko. Le
     seuil garde l'ordre de grandeur, loin du 1,7 Mo de puzzle-index.json. */
  T("aucune table au-dela de 400 Ko", Math.max(...tailles) < 400000, Math.max(...tailles) + " octets");

  console.log("\n--- Liens directs ---");
  const p = banque.find(x => x.code === "50C7L") || banque[0];
  T("#puzzle=" + p.code + " ouvre " + p.code, await codeAffiche("#puzzle=" + p.code) === p.code);
  T("#puzzle=" + p.code.toLowerCase() + " (minuscules) ouvre " + p.code, await codeAffiche("#puzzle=" + p.code.toLowerCase()) === p.code);
  T("#puzzle=" + p.id + " (identifiant) ouvre toujours " + p.code, await codeAffiche("#puzzle=" + p.id) === p.code);
  let inconnu = "ZZZZZ"; while (table[inconnu]) inconnu = inconnu.slice(0, 4) + "Y";
  const c = await codeAffiche("#puzzle=" + inconnu);
  T("code inconnu : un exercice ordinaire s'affiche", /^[0-9A-Z]{5}$/.test(c) && c !== inconnu, c);

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + e.stack); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
