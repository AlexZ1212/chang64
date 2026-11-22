/* Verification automatique de chang64.
   Lancement : node tests/check_carre_parties.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Carre de notification (2026-11-22, demande d'Alexandre) : la pastille posee
   sur l'onglet Jouer etait mal placee. A sa place, un carre opaque a coins
   arrondis, en bas a droite de tous les ecrans, qui porte le nombre de
   parties qui attendent le membre (son tour, une invitation, une fin a voir)
   et mene a « Tes parties en cours ». Decisions d'Alexandre : visible
   partout sauf pendant une partie ; dessin = les deux pions de la carte
   « Contre un ami », repris par la ligne « Parties en cours » du menu. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./outils/page_langue.js");
const { PICTOS } = require("../pictos_build.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const net = s => String(s).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
const MEMBRE = w => w.localStorage.setItem("chang64:compte", JSON.stringify({ pseudo: "Moi", cle: "moi", version: 1, dev: "abc123", n: 0, sync: 0 }));
const J = 86400000;
const LISTE = [
  { id: "aaaaaaaaaaaa", s: "jeu", atoi: true, adv: "Lea", cad: 7, ech: Date.now() + 2 * J, h: Date.now() },
  { id: "bbbbbbbbbbbb", s: "invite", adv: "Tom", cad: 8, coul: "n", ech: Date.now() + 6 * J, h: Date.now() },
  { id: "cccccccccccc", s: "jeu", atoi: false, adv: "Zoe", cad: 6, ech: Date.now() + J, h: Date.now() }
];

(async () => {
  const page = fs.readFileSync(path.join(__dirname, "..", "site", "fr", "index.html"), "utf8");
  const regle = sel => { const i = page.indexOf(sel + "{"); return i < 0 ? "" : page.slice(i, page.indexOf("}", i) + 1); };

  console.log("--- La forme ---");
  T("un carre opaque a coins arrondis, fixe en bas a droite", /position:fixed/.test(regle(".carre-parties")) && /right:14px/.test(regle(".carre-parties")) && /bottom:calc\(14px/.test(regle(".carre-parties")) && /width:56px;height:56px/.test(regle(".carre-parties")) && /border-radius:14px/.test(regle(".carre-parties")) && /background-color:var\(--raise\)/.test(regle(".carre-parties")), regle(".carre-parties"));
  T("il passe sous le menu et les fenetres", /z-index:90/.test(regle(".carre-parties")));
  T("la pastille de l'onglet Jouer n'a plus de style", !/\.tab-pastille\{/.test(page));

  const w = await ouvrir("fr", { attente: 2400, avant: MEMBRE });
  const d = w.document, $ = id => d.getElementById(id);
  const carre = $("carreParties");
  T("le carre est un bouton, cache tant que rien n'attend", !!carre && carre.tagName === "BUTTON" && carre.hidden === true);
  T("son dessin : les deux pions de la carte « Contre un ami »", $("carreDessin").innerHTML.includes(PICTOS.ami.slice(0, 60)) && $("carreDessin").getAttribute("aria-hidden") === "true");
  T("la ligne « Parties en cours » du menu porte le meme dessin, plus l'enveloppe", d.querySelector("#menuCorrLigne svg").innerHTML.includes(PICTOS.ami.slice(0, 60)) && !/M224,48H32a8,8,0,0,0-8,8V192/.test(d.querySelector("#menuCorrLigne svg").innerHTML));

  console.log("--- Des parties attendent ---");
  w.eval("setMode('puzzles')"); await attendre(150);
  w.__l = LISTE; w.eval("corrRecu(window.__l)"); await attendre(100);
  T("deux parties attendent (mon tour, une invitation) : le carre se montre avec « 2 »", carre.hidden === false && $("carreNombre").textContent === "2", $("carreNombre").textContent);
  T("il est nomme pour les lecteurs d'ecran", net(carre.getAttribute("aria-label")) === "2 parties t'attendent", carre.getAttribute("aria-label"));
  T("plus de pastille sur l'onglet Jouer", !$("corrPastille") && !d.querySelector("#tab-jouer .tab-pastille") && !$("tab-jouer").classList.contains("a-toi"));
  for (const m of ["home", "apprendre", "edit", "explore"]) {
    w.eval("setMode('" + m + "')"); await attendre(120);
    if (carre.hidden) { T("visible sur l'ecran " + m, false); }
  }
  T("visible sur tous les ecrans (accueil, Apprendre, Analyser, Explorer)", carre.hidden === false);
  w.__l = LISTE.slice(0, 1); w.eval("corrRecu(window.__l)"); await attendre(60);
  T("une seule partie : « 1 partie t'attend »", $("carreNombre").textContent === "1" && net(carre.getAttribute("aria-label")) === "1 partie t'attend", carre.getAttribute("aria-label"));
  w.__l = LISTE.slice(2); w.eval("corrRecu(window.__l)"); await attendre(60);
  T("au tour de l'autre seulement : rien n'attend, le carre s'efface", carre.hidden === true);
  w.__l = LISTE; w.eval("corrRecu(window.__l)"); await attendre(60);

  console.log("--- Un appui ---");
  carre.click(); await attendre(250);
  T("il mene a « Tes parties en cours », dans Jouer", w.eval("mode") === "jouer" && !$("corrPanel").classList.contains("hide") && d.querySelectorAll("#corrListe .corr-item").length === 3);
  T("sur cet ecran la liste est deja la : le carre s'efface", carre.hidden === true);

  console.log("--- Jamais pendant une partie ---");
  w.eval("setMode('play');setupGame();corrCarre()"); await attendre(200);
  T("reglages de la partie, avant qu'elle commence : le carre est la", w.eval("gameStarted") === false && carre.hidden === false);
  w.eval("colorMode='w';myColor=W;tcCat='rapid';tcIdx=0;setMode('play',{fresh:true})"); await attendre(250);
  if (!$("readyBanner").classList.contains("hide")) { $("readyStart").click(); await attendre(250); }
  w.eval("playUser(game.moves().find(m=>game.uci(m)==='e2e4'))"); await attendre(600);
  w.eval("corrCarre()");
  T("partie contre l'ordinateur en cours : le carre est cache", w.eval("gameStarted") === true && w.eval("corrEnPartie()") === true && carre.hidden === true);
  $("btnResign").click(); $("btnResign").click(); await attendre(400);
  w.eval("corrCarre()");
  T("partie finie : il revient", w.eval("corrEnPartie()") === false && carre.hidden === false);
  w.eval("setMode('friend');directId='aaaaaaaaaaaa';directE={phase:'jeu',moi:'b',cad:[600,0],coups:[],id:'aaaaaaaaaaaa',n:1,la:{b:true,n:true},rev:{b:false,n:false},b:'Moi',nr:'Lea'};corrCarre()");
  T("partie en direct a la pendule : cache", carre.hidden === true);
  w.eval("directE.cad=[259200,0];corrCarre()");
  T("partie par correspondance ouverte a l'ecran : visible (pas de pendule a surveiller)", carre.hidden === false);
  w.eval("directE=null;directId=''");
  w.close();

  console.log("--- Sans compte ---");
  const v = await ouvrir("fr", { attente: 2400 });
  v.eval("setMode('puzzles')"); await attendre(200);
  T("un visiteur ne voit jamais le carre", v.document.getElementById("carreParties").hidden === true);
  v.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
