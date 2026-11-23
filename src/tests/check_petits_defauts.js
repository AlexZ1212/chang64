/* Verification automatique de chang64.
   Lancement : node tests/check_petits_defauts.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Petits defauts releves par Alexandre le 21/11/2026 :
   - badges : trois dessins (mouton du Coup du berger, cornet de frites du
     1er aout, hibou) avaient des details a demi transparents ; plus aucun
     dessin de medaille ne porte d'opacite ;
   - parties en direct : la phrase « 2 gagnees, 0 nulles, 1 perdues » devient
     trois cases chiffrees sous un titre, chaque libelle accorde a son nombre,
     dans les Statistiques et sur la fiche d'un joueur ;
   - revue d'une partie contre l'ordinateur : le bloc Reglages ne reste plus
     affiche sans servir ; « Nouvelle partie » le ramene, « Revanche » relance
     avec les memes reglages. */
const path = require("path"), fs = require("fs");
const { ouvrir, SITE } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const net = x => String(x).replace(/\s+/g, " ").replace(/’/g, "'").trim();
const MEMBRE = w => w.localStorage.setItem("chang64:compte", JSON.stringify({ pseudo: "Moi", cle: "moi", version: 1, dev: "abc123", n: 0, sync: 0 }));
/* Faux serveur : la fiche du membre, et les fichiers du site. */
function serveur(dir) {
  return win => {
    MEMBRE(win);
    win.fetch = u => {
      const url = new URL(u, "https://chang64.com/");
      const rep = (statut, corps) => Promise.resolve({ ok: statut === 200, status: statut, json: () => Promise.resolve(corps), text: () => Promise.resolve(JSON.stringify(corps)) });
      if (url.pathname === "/api/compte/profil") return rep(200, { p: url.searchParams.get("p"), depuis: "2026-03", s: 1, n: 900, r: 5, j: 1, b: 1, k: 0, d: dir.v, dir, rangs: {}, bl: [], pays: null, eo: null, em: null });
      if (url.pathname.startsWith("/api/")) return Promise.reject(new Error("hors ligne"));
      const f = path.join(SITE, url.pathname);
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return Promise.resolve({ ok: false, status: 404 });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(fs.readFileSync(f, "utf8"))) });
    };
  };
}

(async () => {
  console.log("--- Badges ---");
  const med = JSON.parse(fs.readFileSync(path.join(SITE, "data", "badges-medailles.json"), "utf8"));
  const dessins = Object.keys(med).filter(k => Array.isArray(med[k]));
  const voiles = dessins.filter(k => /opacity/.test(med[k][1]));
  T(dessins.length + " dessins de medaille, aucun n'a de detail a demi transparent", dessins.length > 200 && voiles.length === 0, voiles.join(", "));
  T("le mouton garde ses boucles, le cornet ses rainures, le hibou ses plumes", /M-6 -4a2\.4/.test(med.ouv_berger[1]) && /M-9 2l4\.5 17/.test(med.fete_0801[1]) && /M-6 12l2 1\.6/.test(med.ex_hibou[1]));
  const source = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "design", "badges", "symboles.json"), "utf8"));
  T("la source des dessins dit la meme chose", ["ouv_berger", "fete_0801", "ex_hibou"].every(k => source[k].s === med[k][1]) && !/opacity/.test(fs.readFileSync(path.join(__dirname, "..", "..", "design", "badges", "symboles.js"), "utf8")));

  console.log("--- Parties entre membres : trois cases, sous « Resultats » ---");
  let w = await ouvrir("fr", { attente: 2400, avant: serveur({ v: 2, n: 0, d: 1 }) });
  let d = w.document, $ = id => d.getElementById(id);
  const cases = (v, n, p) => { w.__d = { v, n, d: p }; const h = w.eval("cppDirect(window.__d)"); const x = d.createElement("div"); x.innerHTML = h; return [...x.querySelectorAll(".menu-tuile")].map(t => t.querySelector("b").textContent + " " + net(t.querySelector("span").textContent)).join(" | "); };
  T("aucune partie comptee : rien n'est affiche", w.eval("cppDirect({v:0,n:0,d:0})") === "" && w.eval("cppDirect(null)") === "");
  T("francais : 2 gagnees, 0 nulle, 1 perdue", cases(2, 0, 1) === "2 Gagnées | 0 Nulle | 1 Perdue", cases(2, 0, 1));
  T("francais : 1 gagnee, 2 nulles, 0 perdue", cases(1, 2, 0) === "1 Gagnée | 2 Nulles | 0 Perdue", cases(1, 2, 0));
  T("le titre « Résultats » precede les cases (plus « Parties en direct » : la correspondance y compte aussi)", /Résultats/.test(net(w.eval("cppDirect({v:1,n:0,d:0})"))) && !/en direct/i.test(net(w.eval("cppDirect({v:1,n:0,d:0})"))) && /class="tiroir-section cpp-direct-titre"/.test(w.eval("cppDirect({v:1,n:0,d:0})")));
  w.eval("menuOuvrir();menuVue('stats')");
  await attendre(900);
  const menu = $("menuDirect");
  /* 2026-11-22 : dans les statistiques, les trois nombres sont une barre
     gagnees / nulles / perdues avec sa legende (statsBilan, menu.js). */
  T("Statistiques : une barre et ses trois nombres, sous « Résultats »", !menu.hidden && !!menu.querySelector(".stats-barre") && [...menu.querySelectorAll(".stats-legende li")].map(x => net(x.textContent)).join(" | ") === "2 Gagnées | 0 Nulle | 1 Perdue" && /Résultats/.test(net(menu.textContent)) && !/en direct/i.test(net(menu.textContent)), net(menu.textContent));
  w.eval("menuFermer();cppOuvrir('Alice')");
  await attendre(600);
  const fiche = $("cpProfilContenu");
  T("fiche d'un joueur : les memes trois cases", fiche.querySelectorAll(".cpp-direct .menu-tuile").length === 3 && [...fiche.querySelectorAll(".cpp-direct .menu-tuile b")].map(b => b.textContent).join() === "2,0,1" && !fiche.querySelector("p.cpp-direct"));
  w.close();
  w = await ouvrir("ru", { attente: 2400, avant: serveur({ v: 1, n: 1, d: 1 }) });
  d = w.document;
  T("russe : 1 победа, 2 ничьи, 5 поражений", cases(1, 2, 5) === "1 Победа | 2 Ничьи | 5 Поражений", cases(1, 2, 5));
  T("russe : 0 побед, 1 ничья, 2 поражения", cases(0, 1, 2) === "0 Побед | 1 Ничья | 2 Поражения", cases(0, 1, 2));
  T("russe : 21 победа, 11 ничьих, 22 поражения", cases(21, 11, 22) === "21 Победа | 11 Ничьих | 22 Поражения", cases(21, 11, 22));
  w.close();
  w = await ouvrir("en", { attente: 2000, avant: serveur({ v: 1, n: 1, d: 1 }) });
  d = w.document;
  T("anglais : Won, Drawn, Lost", cases(1, 0, 2) === "1 Won | 0 Drawn | 2 Lost", cases(1, 0, 2));
  w.close();

  console.log("--- Revue d'une partie contre l'ordinateur ---");
  w = await ouvrir("fr", { attente: 2200 });
  d = w.document; $ = id => d.getElementById(id);
  w.eval("setMode('play')");
  await attendre(300);
  const cache = id => $(id).classList.contains("hide");
  T("avant la partie : les reglages sont la, la revue non", !cache("settingsPanel") && cache("reviewPanel"));
  d.querySelector('#segLevel [data-v="3"]').click();
  $("btnNew").click(); await attendre(450);
  if (!$("readyBanner").classList.contains("hide")) { $("readyStart").click(); await attendre(350); }
  T("pendant la partie : reglages masques", cache("settingsPanel"));
  $("btnResign").click(); await attendre(160); $("btnResign").click(); await attendre(450);
  T("partie finie : la revue s'affiche, les reglages restent masques", !cache("reviewPanel") && cache("settingsPanel"));
  T("la revue propose « Nouvelle partie » et « Revanche »", net($("btnRevueNouvelle").textContent) === "Nouvelle partie" && net($("btnRevanche").textContent) === "Revanche" && !cache("btnRevanche"));
  $("resultClose").click(); await attendre(150);
  $("btnRevanche").click(); await attendre(500);
  if (!$("readyBanner").classList.contains("hide")) { $("readyStart").click(); await attendre(350); }
  T("« Revanche » : une nouvelle partie, memes reglages (force 3)", w.eval("gameStarted") === true && w.eval("botLevel") === 3 && w.eval("resultInfo") === null && w.eval("eloPartie()") === w.eval("NIVEAU_ELO[3]") && cache("settingsPanel") && cache("reviewPanel"));
  $("btnResign").click(); await attendre(160); $("btnResign").click(); await attendre(450);
  $("resultClose").click(); await attendre(150);
  $("btnRevueNouvelle").click(); await attendre(300);
  T("« Nouvelle partie » : les reglages reviennent, actifs, la revue s'efface", !cache("settingsPanel") && cache("reviewPanel") && [...$("segLevel").children].every(b => !b.disabled) && w.eval("gameStarted") === false);
  /* Une partie rouverte depuis « Tes parties » : pas de revanche. */
  w.eval("history=[{t:Date.now(),c:'w',r:'loss',tc:'10+0',lvl:2,elo:1100,m:'e2e4 e7e5 g1f3 b8c6',fen:null}];renderHistory();openHistoryGame(0)");
  await attendre(300);
  T("partie rouverte depuis l'historique : reglages masques, « Nouvelle partie » sans « Revanche »", cache("settingsPanel") && !cache("reviewPanel") && cache("btnRevanche") && !cache("btnRevueNouvelle"));
  w.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
