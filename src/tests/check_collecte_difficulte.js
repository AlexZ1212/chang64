/* Verification automatique de chang64.
   Lancement : node tests/check_collecte_difficulte.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Mesure de la difficulte reelle (2026-10-25, accord d'Alexandre). Chaque
   exercice termine ou rate envoie {id, ok} a /api/resultat, une Pages
   Function qui incremente deux compteurs dans D1. Ce test garde :
     - le serveur : compteurs justes, envois mal formes refuses, /api/stats
       servi depuis le cache de Cloudflare apres la premiere lecture ;
     - le site : un seul envoi par exercice, l'echec envoye des la premiere
       erreur, rien pendant le Sprint, et rien d'autre que {id, ok} ;
     - le build : functions/ recopie, _routes.json limite a /api/*, le
       service worker laisse /api/ au reseau ;
     - la page Confidentialite qui le dit, en francais et en anglais. */
const path = require("path"), fs = require("fs"), jd = require("jsdom");
const SITE = path.join(__dirname, "..", "site");
const { Game } = require(path.join(__dirname, "..", "engine.js"));
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));

/* Les fonctions sont des modules ES ; le paquet de construction est en
   CommonJS. On les charge en retirant le mot-cle export. */
function charger(nom, globaux) {
  const src = fs.readFileSync(path.join(SITE, "functions", "api", nom), "utf8").replace(/^export /gm, "");
  const noms = Object.keys(globaux);
  return new Function(...noms, src + "\nreturn { onRequestPost: typeof onRequestPost === 'function' ? onRequestPost : null, onRequestGet: typeof onRequestGet === 'function' ? onRequestGet : null };")(...noms.map(n => globaux[n]));
}

/* Fausse base D1 : execute l'UPSERT et le SELECT des deux fonctions. */
function fausseBase() {
  const t = new Map(); let lectures = 0;
  return { t, lectures: () => lectures, prepare(sql) {
    return { bind(...a) { this.a = a; return this; },
      async run() {
        if (!/INSERT INTO resultats[\s\S]*ON CONFLICT\(id\) DO UPDATE SET essais = essais \+ 1, reussites = reussites \+ \?2/.test(sql)) throw new Error("SQL inattendu : " + sql);
        const [id, r] = this.a, l = t.get(id) || { essais: 0, reussites: 0 };
        l.essais++; l.reussites += r; t.set(id, l); return {};
      },
      async all() { lectures++; return { results: [...t].map(([id, l]) => ({ id, essais: l.essais, reussites: l.reussites })) }; } };
  } };
}

(async () => {
  console.log("\n--- Serveur : /api/resultat ---");
  const { onRequestPost } = charger("resultat.js", {});
  const db = fausseBase();
  const poster = (corps, env) => onRequestPost({ request: new Request("https://chang64.com/api/resultat", { method: "POST", body: corps }), env: env || { DB: db } });
  T("reussite comptee", (await poster('{"id":"p12","ok":1}')).status === 204);
  await poster('{"id":"p12","ok":0}'); await poster('{"id":"p12","ok":1}'); await poster('{"id":"p7","ok":0}');
  const p12 = db.t.get("p12") || {};
  T("trois essais, deux reussites pour p12", p12.essais === 3 && p12.reussites === 2, JSON.stringify(p12));
  T("un echec pour p7", JSON.stringify(db.t.get("p7")) === '{"essais":1,"reussites":0}', JSON.stringify(db.t.get("p7")));
  for (const [nom, corps, statut] of [
    ["JSON casse", "{id:", 400], ["identifiant hors format", '{"id":"x1","ok":1}', 400],
    ["identifiant injecte", '{"id":"p1\'; DROP TABLE resultats;--","ok":1}', 400],
    ["ok hors 0/1", '{"id":"p1","ok":2}', 400], ["ok en texte", '{"id":"p1","ok":"1"}', 400],
    ["corps trop long", JSON.stringify({ id: "p1", ok: 1, x: "a".repeat(300) }), 413]]) {
    const r = await poster(corps);
    T("refuse : " + nom, r.status === statut, r.status);
  }
  T("rien d'ecrit par les refus", db.t.size === 2, [...db.t.keys()].join(" "));
  T("sans base liee : 503, pas de plantage", (await poster('{"id":"p1","ok":1}', {})).status === 503);

  console.log("\n--- Serveur : /api/stats ---");
  const magasin = new Map();
  const caches = { default: { match: async r => { const v = magasin.get(r.url); return v ? v.clone() : undefined; }, put: async (r, v) => { magasin.set(r.url, v); } } };
  const { onRequestGet } = charger("stats.js", { caches });
  const promesses = [];
  const lire = () => onRequestGet({ request: new Request("https://chang64.com/api/stats?x=1"), env: { DB: db }, waitUntil: p => promesses.push(p) });
  const r1 = await lire(); await Promise.all(promesses);
  const j1 = await r1.json();
  T("compteurs rendus", JSON.stringify(j1) === '{"p12":[3,2],"p7":[1,0]}', JSON.stringify(j1));
  T("gardes un jour au cache de Cloudflare", /s-maxage=86400/.test(r1.headers.get("Cache-Control") || ""));
  await lire(); await lire();
  T("deuxieme et troisieme lecture servies du cache, une seule lecture de la table", db.lectures() === 1, db.lectures());

  console.log("\n--- Build ---");
  T("functions/ recopiees dans le site", ["resultat.js", "stats.js"].every(f => fs.existsSync(path.join(SITE, "functions", "api", f))));
  const routes = JSON.parse(fs.readFileSync(path.join(SITE, "_routes.json"), "utf8"));
  T("_routes.json limite les fonctions a /api/*", JSON.stringify(routes.include) === '["/api/*"]' && routes.version === 1, JSON.stringify(routes));
  const sw = fs.readFileSync(path.join(SITE, "sw.js"), "utf8");
  T("le service worker laisse /api/ au reseau", /startsWith\("\/api\/"\)\)return;/.test(sw));

  console.log("\n--- Site : ce qui part ---");
  const html = fs.readFileSync(path.join(SITE, "index.html"), "utf8");
  const envois = [];
  const dom = new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/",
    virtualConsole: new jd.VirtualConsole(),
    beforeParse(w) {
      w.fetch = (u, o) => {
        const p = new URL(u, "https://chang64.com/").pathname;
        if (o && o.method === "POST") { envois.push({ url: p, corps: o.body }); return Promise.resolve({ ok: true, status: 204 }); }
        const f = path.join(SITE, p);
        if (!fs.existsSync(f)) return Promise.resolve({ ok: false, status: 404 });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(fs.readFileSync(f, "utf8"))) });
      };
      w.navigator.sendBeacon = (u, b) => { envois.push({ url: u, blob: b }); return true; };
    } });
  const w = dom.window, d = w.document;
  const corps = async e => e.corps != null ? e.corps : await e.blob.text();
  const $ = id => d.getElementById(id);
  const clic = el => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  const cases = () => $("board").children;
  const retourne = () => { const c = cases()[0].querySelector(".co.r"); return c ? c.textContent.trim() === "1" : false; };
  const caseDe = sq => { const f = "abcdefgh".indexOf(sq[0]), r = 8 - +sq[1]; return retourne() ? (7 - r) * 8 + (7 - f) : r * 8 + f; };
  const jouer = async uci => { clic(cases()[caseDe(uci.slice(0, 2))]); await attendre(50); clic(cases()[caseDe(uci.slice(2, 4))]); await attendre(900); };
  await attendre(1200);
  clic($("tab-puzzles")); await attendre(500);
  clic($("cardSolvePuzzles")); await attendre(2000);
  const pz = w.eval("puzzle");
  T("un exercice est charge", pz && /^p\d+$/.test(pz.id), pz && pz.id);
  /* Un coup legal qui n'est ni la solution ni une alternative acceptee. */
  const g = new Game(pz.fen), bons = new Set([pz.sol[0]].concat(pz.alt || []));
  const faux = g.moves().map(m => g.uci(m)).find(u => !bons.has(u) && u.length === 4);
  await jouer(faux);
  T("une erreur : un envoi", envois.length === 1, envois.length);
  const e1 = envois[0] ? JSON.parse(await corps(envois[0])) : {};
  T("vers /api/resultat", envois[0] && envois[0].url === "/api/resultat", envois[0] && envois[0].url);
  T("rien d'autre que l'exercice et l'issue", JSON.stringify(e1) === JSON.stringify({ id: pz.id, ok: 0 }), JSON.stringify(e1));
  if (g.moves().map(m => g.uci(m)).filter(u => !bons.has(u) && u.length === 4).length > 1) {
    const faux2 = g.moves().map(m => g.uci(m)).filter(u => !bons.has(u) && u.length === 4)[1];
    await jouer(faux2);
  }
  w.eval("solvePuzzle()"); await attendre(100);
  T("deuxieme erreur et solution : pas de nouvel envoi", envois.length === 1, envois.length);

  /* Exercice suivant, resolu du premier coup. */
  clic($("btnNext")); await attendre(1500);
  const pz2 = w.eval("puzzle");
  for (let k = 0; k < pz2.sol.length; k += 2) { await jouer(pz2.sol[k]); if ($("promoModal").className.includes("on")) { clic($("promoBtns").children[0]); await attendre(400); } }
  await attendre(300);
  const e2 = envois[1] ? JSON.parse(await corps(envois[1])) : {};
  T("reussite du premier coup envoyee", envois.length === 2 && e2.id === pz2.id && e2.ok === 1, envois.length + " " + JSON.stringify(e2));

  console.log("\n--- Site : le Sprint n'envoie rien ---");
  const avant = envois.length;
  clic($("tab-puzzles")); await attendre(500);
  clic($("cardSolveSprint")); await attendre(800);
  if ($("readyBanner") && !$("readyBanner").className.includes("hide")) { clic($("readyStart")); await attendre(800); }
  const pz3 = w.eval("puzzle");
  if (pz3) {
    const g3 = new Game(pz3.fen), bons3 = new Set([pz3.sol[0]].concat(pz3.alt || []));
    const f3 = g3.moves().map(m => g3.uci(m)).find(u => !bons3.has(u) && u.length === 4);
    await jouer(f3);
  }
  T("une erreur en Sprint : aucun envoi", pz3 && envois.length === avant, envois.length - avant);
  w.close();

  console.log("\n--- Page Confidentialite ---");
  for (const [langue, motif] of [["fr-FR", /Mesure de la difficulté des exercices[\s\S]*réussi du premier coup[\s\S]*sans adresse IP/],
    ["en-US", /Measuring puzzle difficulty[\s\S]*solved on the first try[\s\S]*no IP address/]]) {
    const dom2 = new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/",
      virtualConsole: new jd.VirtualConsole(),
      beforeParse(w2) { Object.defineProperty(w2.navigator, "language", { value: langue, configurable: true }); w2.fetch = () => new Promise(() => {}); } });
    await attendre(800);
    dom2.window.document.getElementById("footPrivacy").dispatchEvent(new dom2.window.MouseEvent("click", { bubbles: true }));
    await attendre(300);
    const texte = dom2.window.document.getElementById("privacyBody").textContent;
    T(langue + " : la collecte est decrite", motif.test(texte));
    T(langue + " : plus de \"rien n'est envoye\" pour la progression", !/Rien n'est envoyé ailleurs|never sent anywhere/.test(texte));
    dom2.window.close();
  }

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + e.stack); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
