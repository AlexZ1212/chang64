/* Verification automatique de chang64.
   Lancement : node tests/check_elo_ordi.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Elo du joueur contre l'ordinateur (2026-11-21, decision d'Alexandre) :
   - la formule (depart 800, K 40 puis 20) et les parties qui comptent ;
   - la carte de fin de partie ("+12 Elo"), Ma progression, la courbe limitee
     a 10 parties sans compte ;
   - les trois rappels vers le compte, une fois par session, jamais pour un
     membre ;
   - la fusion du compte (jamais le plus haut : le plus de parties) ;
   - la borne du serveur et la ligne de la fiche d'un joueur. */
const path = require("path"), fs = require("fs"), { pathToFileURL } = require("url");
const { ouvrir, SITE } = require("./outils/page_langue.js");
const { fausseD1 } = require("../serveur_local.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const dit = x => JSON.stringify(x);
/* Huit demi-coups legaux : quatre coups de chaque camp. */
const COUPS = ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "d2d3", "d7d6"];
/* Suites legales apres ces huit demi-coups, pour des parties toutes differentes. */
const SUITES = ["a2a3", "a2a4", "b2b3", "b2b4", "c2c3", "h2h3", "h2h4", "g2g3", "g2g4", "c1e3", "c1g5", "c1d2", "b1c3", "b1d2", "b1a3", "e1g1", "d1e2", "d1d2", "c4b3", "c4b5", "c4d5", "f3g5", "f3h4", "f3d2", "d3d4"];
let numero = 0;
const partie = () => COUPS.concat([SUITES[numero++ % SUITES.length]]);

/* Termine une partie contre l'ordinateur comme le fait l'application : les
   variables de la partie sont posees, puis la carte de fin est demandee. */
function finir(w, o) {
  o = Object.assign({ coups: COUPS, couleur: "w", resultat: "win", elo: 1100, fen: null }, o || {});
  w.__p = o;
  w.eval("(function(){" +
    "const o=window.__p;" +
    "mode=\"play\";isReviewGame=false;gameSaved=false;resultDismissed=false;" +
    "gameUci=o.coups.slice();gameStartFen=o.fen;myColor=o.couleur===\"w\"?W:B;" +
    "eloPartieFixe=o.elo;resigned=null;" +
    "const g=new Game();for(const u of o.coups){const m=g.moves().find(x=>g.uci(x)===u);if(m)g.makeMove(m);}game=g;" +
    "if(o.resultat===\"loss\")resigned=myColor;" +
    "if(o.resultat===\"win\")resigned=myColor===W?B:W;" +
    "resultInfo={kind:o.resultat===\"win\"?\"win\":o.resultat===\"loss\"?\"lose\":\"draw\",title:\"x\",sub:\"y\"};" +
    "renderResult(true);" +
    "})()");
}

(async () => {
  console.log("--- La formule ---");
  let w = await ouvrir("en", { attente: 2600 });
  const d = w.document, $ = id => d.getElementById(id);
  const v = (j, a, s, n) => w.eval("eloVariation(" + [j, a, s, n].join(",") + ")");
  T("a force egale, une victoire donne +20 en debut de parcours (K = 40)", v(800, 800, 1, 0) === 20, v(800, 800, 1, 0));
  T("a force egale, apres 20 parties, +10 (K = 20)", v(800, 800, 1, 20) === 10);
  T("une nulle a force egale ne change rien", v(800, 800, 0.5, 0) === 0);
  T("battre plus fort rapporte plus que battre plus faible", v(800, 1200, 1, 0) > v(800, 800, 1, 0) && v(800, 800, 1, 0) > v(800, 500, 1, 0), [v(800, 1200, 1, 0), v(800, 500, 1, 0)].join(" / "));
  T("perdre contre plus faible coute plus", v(1200, 700, 0, 30) < v(1200, 1600, 0, 30));
  T("jamais plus de 40 points en une partie", [[800, 3000, 1, 0], [3000, 100, 0, 0], [100, 3000, 1, 5]].every(a => Math.abs(v.apply(null, a)) <= 40));

  console.log("--- Ce qui compte ---");
  T("avant toute partie : pas de classement", w.eval("prog.eloOrdi") === undefined && w.eval("eloEtat()") === null);
  finir(w, { resultat: "win", elo: 1100 });
  let e = w.eval("JSON.parse(JSON.stringify(prog.eloOrdi))");
  T("premiere victoire contre 1100 : depart 800, +34", e.r === 834 && e.n === 1 && e.pic === 834, dit(e));
  T("la courbe garde le depart puis la partie", e.h.length === 2 && e.h[0][1] === 800 && e.h[1][1] === 834, dit(e.h));
  T("la partie est aussi dans l'historique", w.eval("history.length") === 1 && w.eval("history[0].elo") === 1100);
  T("carte de fin : +34 Elo et le nouveau classement", !$("resultElo").classList.contains("hide") && /^\+34 Elo/.test($("resultElo").textContent) && /834/.test($("resultElo").textContent), $("resultElo").textContent);
  T("pas de rappel a la premiere partie", $("resultEloNote").classList.contains("hide"));
  w.eval("renderResult(true)");
  T("redessiner la carte ne recompte pas la partie", w.eval("prog.eloOrdi.n") === 1 && w.eval("history.length") === 1);

  finir(w, { resultat: "loss", elo: 700, coups: partie() });
  e = w.eval("JSON.parse(JSON.stringify(prog.eloOrdi))");
  T("defaite contre 700 : le classement baisse, le record reste", e.r < 834 && e.n === 2 && e.pic === 834, dit(e));
  T("carte de fin : variation negative", /^−\d+ Elo/.test($("resultElo").textContent), $("resultElo").textContent);
  const apres2 = e.r;

  finir(w, { resultat: "win", coups: COUPS.slice(0, 6) });
  T("moins de 4 coups : partie non classee", w.eval("prog.eloOrdi.n") === 2 && w.eval("prog.eloOrdi.r") === apres2);
  T("et la carte ne montre pas d'Elo", $("resultElo").classList.contains("hide"));
  finir(w, { resultat: "win", coups: COUPS.slice(0, 7), couleur: "b" });
  T("avec les Noirs, 3 coups joues sur 7 demi-coups : non classee", w.eval("prog.eloOrdi.n") === 2);
  finir(w, { resultat: "win", fen: "4k3/8/8/8/8/8/8/4K2Q w - - 0 1", coups: [] });
  T("position preparee : non classee", w.eval("prog.eloOrdi.n") === 2);
  finir(w, { resultat: "draw", elo: 1100, coups: partie() });
  e = w.eval("JSON.parse(JSON.stringify(prog.eloOrdi))");
  T("nulle contre plus fort : le classement monte un peu", e.n === 3 && e.r > apres2, dit(e));

  console.log("--- Rappels vers le compte (sans compte) ---");
  T("3e partie classee : la ligne propose de creer un compte", !$("resultEloNote").classList.contains("hide") && /lives in this browser/.test($("resultEloNote").textContent) && !!$("resultEloNote").querySelector("[data-vue-compte]"), $("resultEloNote").textContent);
  T("ce n'est pas une fenetre : le menu reste ferme", $("menuTiroir").hidden === true);
  for (let i = 0; i < 17; i++) finir(w, { resultat: i % 2 ? "loss" : "win", elo: 900, coups: partie() });
  e = w.eval("JSON.parse(JSON.stringify(prog.eloOrdi))");
  T("20 parties classees", e.n === 20, dit({ n: e.n, r: e.r }));
  T("une seule ligne par session : pas de second rappel a la 20e", $("resultEloNote").classList.contains("hide"), $("resultEloNote").textContent);
  w.eval("eloRappelFait=false;prog.eloOrdi.n=19");
  finir(w, { resultat: "win", elo: 900, coups: partie() });
  T("nouvelle session, 20e partie : classement etabli", /settled at ≈ \d+/.test($("resultEloNote").textContent), $("resultEloNote").textContent);
  w.eval("eloRappelFait=false;prog.eloOrdi.pic=prog.eloOrdi.r");
  finir(w, { resultat: "win", elo: 1600, coups: partie() });
  T("nouvelle session, record apres la 20e : la ligne le dit", /New record: \d+/.test($("resultEloNote").textContent), $("resultEloNote").textContent);
  T("apres 20 parties le pas est de 20 au plus", Math.abs(w.eval("eloDernier.d")) <= 20, w.eval("eloDernier.d"));

  console.log("--- Ma progression ---");
  w.eval("prog.eloOrdi.h=Array.from({length:30},(x,i)=>[1000+i,800+i*5]);prog.eloOrdi.r=945;prog.eloOrdi.pic=960;prog.eloOrdi.n=29");
  w.eval("menuOuvrir();menuVue(\"stats\")");
  /* Les chiffres s'animent a l'ouverture : on lit leur valeur finale. */
  await attendre(1900);
  const tuiles = () => [...d.querySelectorAll("#menuEloTuiles .menu-tuile")].map(x => x.querySelector("span").textContent + "=" + x.querySelector("b").textContent);
  T("quatre chiffres : Elo, record, parties classees, derniere partie", tuiles().length === 4 && /945/.test(tuiles()[0]) && /960/.test(tuiles()[1]) && /29/.test(tuiles()[2]) && /\+5/.test(tuiles()[3]), dit(tuiles()));
  const points = () => { const p = d.querySelector("#menuEloGraph svg path"); return p ? (p.getAttribute("d").match(/[ML]/g) || []).length : 0; };
  T("sans compte : la courbe ne porte que 11 points (10 parties)", points() === 11, points());
  T("sans compte : la ligne des 10 dernieres parties", !!$("menuEloSansCompte") && /last 10 games/.test($("menuEloSansCompte").textContent));
  T("l'explication est la", /How does this Elo work/.test($("menuStats").textContent) && /You start at 800/.test($("menuStats").textContent));
  w.eval("localStorage.setItem(\"chang64:compte\",JSON.stringify({pseudo:\"Moi\",cle:\"moi\",version:1,dev:\"abc123\",n:0,sync:0}));menuVue(\"stats\")");
  await attendre(400);
  T("avec un compte : toute la courbe (30 points), plus de ligne", points() === 30 && !$("menuEloSansCompte"), points());
  w.eval("menuFermer();eloRappelFait=false;prog.eloOrdi.n=2");
  finir(w, { resultat: "win", elo: 900, coups: partie() });
  T("membre : la carte montre l'Elo, jamais de rappel", !$("resultElo").classList.contains("hide") && $("resultEloNote").classList.contains("hide"));
  w.eval("localStorage.removeItem(\"chang64:compte\")");
  T("a ma mesure : l'ordinateur lit ce classement", w.eval("eloJoueurOrdi()") === Math.max(600, Math.round(w.eval("prog.eloOrdi.r") / 50) * 50), w.eval("eloJoueurOrdi()"));

  console.log("--- Fusion du compte ---");
  const F = (l, dd, b, rec) => { w.__f = [l, dd, b, rec]; return w.eval("JSON.parse(JSON.stringify(cpFusionProg(window.__f[0],window.__f[1],window.__f[2],window.__f[3]).eloOrdi||null))"); };
  const E = (r, n, pic, h) => ({ eloOrdi: { r, n, pic: pic || r, h: h || [[n, r]] } });
  let f = F(E(1500, 3), E(1000, 40), null, false);
  T("sans base : le classement aux 40 parties, pas le plus haut", f.r === 1000 && f.n === 40, dit(f));
  f = F(E(1000, 40), E(1500, 3), null, true);
  T("sans base, dans l'autre sens : toujours les 40 parties", f.r === 1000 && f.n === 40, dit(f));
  T("les courbes sont reunies, dans l'ordre du temps", f.h.length === 2 && f.h[0][0] === 3 && f.h[1][0] === 40, dit(f.h));
  f = F(E(900, 5), {}, null, false);
  T("un seul cote a un Elo : il est garde", f && f.r === 900 && f.n === 5, dit(f));
  f = F({}, {}, null, false);
  T("aucun Elo : aucun champ invente", f === null);
  f = F(E(1030, 12), E(980, 11), E(1000, 10), false);
  T("avec base : les variations et les parties s'additionnent (1010, 13)", f.r === 1010 && f.n === 13, dit(f));
  f = F(E(1000, 10), E(1000, 10), E(1000, 10), true);
  T("avec base, rien de neuf : rien ne bouge", f.r === 1000 && f.n === 10);
  f = F({ eloOrdi: { r: "x", n: 4 } }, E(950, 2), null, false);
  T("un Elo illisible ne l'emporte pas", f.r === 950 && f.n === 2, dit(f));
  w.close();

  console.log("--- Serveur : la borne ---");
  const mod = await import(pathToFileURL(path.join(__dirname, "..", "functions", "api", "compte", "[[route]].js")).href);
  const P = mod._essai.eloOrdiPropre;
  T("un Elo ordinaire passe tel quel", dit(P({ r: 1012, n: 30, pic: 1050, h: [[5, 1000], [6, 1012]] })) === dit({ r: 1012, n: 30, pic: 1050, h: [[5, 1000], [6, 1012]] }));
  T("2 parties : jamais plus de 880", P({ r: 2600, n: 2, pic: 2900, h: [] }).r === 880 && P({ r: 2600, n: 2, pic: 2900, h: [] }).pic === 880);
  T("plancher a 100, plafond a 3000", P({ r: -50, n: 500 }).r === 100 && P({ r: 99999, n: 500 }).r === 3000);
  T("aucune partie, ou champ illisible : rien n'est garde", P({ r: 900, n: 0 }) === null && P({ r: "900", n: 3 }) === null && P([1, 2]) === null && P(null) === null);
  T("courbe : 50 points au plus, points mal formes retires", P({ r: 900, n: 80, h: Array.from({ length: 70 }, (x, i) => [i, 900]).concat([["a", 1], [1]]) }).h.length === 50);
  const env = { DB: fausseD1() };
  const code = n => Buffer.from(String(n).padStart(32, "x")).toString("base64url");
  async function appel(methode, route, corps, cookie) {
    const h = { Origin: "https://chang64.com" };
    if (corps !== undefined) h["Content-Type"] = "application/json";
    if (cookie) h.Cookie = cookie;
    const rep = await mod.onRequest({ request: new Request("https://chang64.com/api/compte/" + route, { method: methode, headers: h, body: corps === undefined ? undefined : JSON.stringify(corps) }), env, params: { route: route.split("?")[0].split("/") } });
    const texte = await rep.text(); let j = null; try { j = JSON.parse(texte); } catch (err) {}
    return { s: rep.status, j, cookie: (rep.headers.get("Set-Cookie") || "").split(";")[0] };
  }
  let r = await appel("POST", "creer", { pseudo: "Tricheur", code: code(1), donnees: { progress: { solved: 3, eloOrdi: { r: 2900, n: 1, pic: 2900, h: [[1, 2900]] } } } });
  T("creation avec un Elo gonfle : acceptee", r.s === 201, dit(r.j));
  const cookie = r.cookie;
  let g = await appel("GET", "synchro", undefined, cookie);
  T("mais garde borne (840 pour une partie)", g.j.donnees.progress.eloOrdi.r === 840 && g.j.donnees.progress.eloOrdi.h[0][1] === 840, dit(g.j.donnees.progress.eloOrdi));
  r = await appel("PUT", "synchro", { version: g.j.version, donnees: { progress: { solved: 4, eloOrdi: { r: 1012, n: 30, pic: 1050, h: [[5, 1000], [6, 1012]] } } } }, cookie);
  T("synchro avec un Elo plausible : acceptee", r.s === 200, dit(r.j));
  g = await appel("GET", "synchro", undefined, cookie);
  T("et garde tel quel", g.j.donnees.progress.eloOrdi.r === 1012 && g.j.donnees.progress.eloOrdi.n === 30 && g.j.donnees.progress.solved === 4);
  let p = await appel("GET", "profil?p=Tricheur");
  T("fiche du joueur : l'Elo contre l'ordinateur y figure", p.s === 200 && p.j.eo && p.j.eo.r === 1012 && p.j.eo.n === 30, dit(p.j && p.j.eo));
  r = await appel("PUT", "synchro", { version: g.j.version, donnees: { progress: { solved: 4, eloOrdi: "n'importe quoi" } } }, cookie);
  g = await appel("GET", "synchro", undefined, cookie);
  T("Elo illisible : retire, le reste de la progression est garde", r.s === 200 && g.j.donnees.progress.eloOrdi === undefined && g.j.donnees.progress.solved === 4);
  r = await appel("POST", "creer", { pseudo: "SansElo", code: code(2), donnees: { progress: { solved: 1 } } });
  p = await appel("GET", "profil?p=SansElo");
  T("fiche d'un joueur sans partie classee : pas d'Elo", p.s === 200 && p.j.eo === null, dit(p.j && p.j.eo));

  console.log("--- Fiche d'un joueur et carte de fin, en francais ---");
  w = await ouvrir("fr", { attente: 2600, avant(win) {
    win.fetch = u => {
      const url = new URL(u, "https://chang64.com/");
      const rep = (statut, corps) => Promise.resolve({ ok: statut === 200, status: statut, json: () => Promise.resolve(corps), text: () => Promise.resolve(JSON.stringify(corps)) });
      if (url.pathname === "/api/compte/profil") return rep(200, { p: url.searchParams.get("p"), depuis: "2026-03", s: 1, n: 900, r: 5, j: 1, b: 1, k: 0, d: 0, dir: { v: 0, n: 0, d: 0 }, rangs: {}, bl: [], pays: null, eo: url.searchParams.get("p") === "Alice" ? { r: 1150, n: 25 } : null });
      if (url.pathname.startsWith("/api/")) return rep(401, { erreur: "session" });
      const f = path.join(SITE, url.pathname);
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return Promise.resolve({ ok: false, status: 404 });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(fs.readFileSync(f, "utf8"))) });
    };
  } });
  w.eval("cppOuvrir(\"Alice\")");
  await attendre(500);
  const ligne = w.document.querySelector("#cpProfilContenu .cpp-elo");
  T("fiche : la ligne « ≈ 1150 contre l'ordinateur »", !!ligne && ligne.textContent === "≈ 1150 contre l'ordinateur", ligne && ligne.textContent);
  w.eval("cppFermer();cppOuvrir(\"Bob\")");
  await attendre(500);
  T("fiche sans Elo : pas de ligne", !w.document.querySelector("#cpProfilContenu .cpp-elo") && !!w.document.querySelector("#cpProfilContenu .cpp-liste") && /Bob/.test(w.document.getElementById("cpProfil").textContent));
  w.eval("cppFermer()");
  finir(w, { resultat: "win", elo: 1100 });
  const carte = w.document.getElementById("resultElo").textContent.replace(/\s+/g, " ");
  T("carte de fin en francais", carte === "+34 Elo ≈ 834 contre l'ordinateur", carte);
  w.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
