/* Verification automatique de chang64.
   Lancement : node tests/check_statistiques.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Statistiques (2026-11-22, demandes d'Alexandre) :
   - les chiffres et les graphes sont ranges par categorie, chacune avec son
     titre : Exercices, Parties contre l'ordinateur, Parties entre membres,
     Activite ;
   - un meme aspect pour un meme type : des tuiles pour les chiffres, un cadre
     et un petit titre pour chaque graphe, un depliant pour chaque explication ;
   - gagnees / nulles / perdues en une barre, pour les membres ;
   - l'accueil ne garde que trois chiffres et un lien vers les statistiques. */
const { ouvrir } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const net = s => String(s).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
const MEMBRE = w => w.localStorage.setItem("chang64:compte", JSON.stringify({ pseudo: "Moi", cle: "moi", version: 1, dev: "abc123", n: 0, sync: 0 }));
/* Parties gardees : 4 gagnees, 1 nulle, 2 perdues contre l'ordinateur ; plus
   une partie d'entrainement, une partie d'une position preparee et une partie
   en direct, qui ne doivent pas compter. */
const PARTIES = [
  ...["win", "win", "loss", "win", "draw", "loss", "win"].map((r, i) => ({ t: 1000 + i, k: "o", c: "w", r, lvl: 1, elo: 700, m: "e2e4 e7e5 g1f3 b8c6" })),
  { t: 2000, k: "o", c: "w", r: "win", lvl: 1, elo: 700, m: "e2e4 e7e5 g1f3 b8c6", ent: 1 },
  { t: 2001, k: "o", c: "w", r: "loss", lvl: 1, elo: 700, m: "e2e4 e7e5 g1f3 b8c6", fen: "4k3/8/8/8/8/8/8/3QK3 w - - 0 1" },
  { t: 2002, k: "d", c: "w", r: "loss", adv: "Lea", m: "e2e4 e7e5 g1f3 b8c6" }
];

(async () => {
  console.log("--- Sans compte ---");
  let w = await ouvrir("fr", { attente: 2200, avant(x) { x.localStorage.setItem("chang64:games", JSON.stringify(PARTIES)); } });
  let d = w.document, $ = id => d.getElementById(id);
  w.eval("menuOuvrir();menuVue('stats')"); await attendre(1900);
  const cats = () => [...d.querySelectorAll("#menuStats .stats-cat")].filter(h => !h.closest("[hidden]")).map(h => net(h.textContent));
  T("trois categories visibles, chacune avec son titre", cats().join(" | ") === "Exercices | Parties contre l'ordinateur | Activité", cats().join(" | "));
  T("les titres de categorie sont de vrais titres (h3)", [...d.querySelectorAll("#menuStats .stats-cat")].every(h => h.tagName === "H3"));
  /* Ce qui suit chaque titre, jusqu'au titre suivant. */
  const bloc = nom => {
    const h = [...d.querySelectorAll("#menuStats .stats-cat")].find(x => net(x.textContent) === nom), out = [];
    for (let e = h && h.nextElementSibling; e && !e.classList.contains("stats-cat") && e.id !== "menuMembres"; e = e.nextElementSibling) out.push(e);
    return out;
  };
  const libelles = l => l.filter(e => e.classList.contains("menu-tuiles")).flatMap(e => [...e.querySelectorAll(".menu-tuile > span")].map(s => net(s.textContent)));
  T("Exercices : six chiffres d'exercices, rien d'autre", libelles(bloc("Exercices")).join(" | ") === "Niveau exercices | Exercices résolus | Meilleure série | Record au Sprint | Record aux Coordonnées | Finales réussies", libelles(bloc("Exercices")).join(" | "));
  T("Exercices : la courbe du niveau est dans cette categorie, avec son explication", bloc("Exercices").some(e => e.id === "menuRatingGraph") && bloc("Exercices").some(e => e.matches("details.menu-explication") && /niveau exercices/i.test(net(e.textContent))));
  T("Parties contre l'ordinateur : quatre chiffres d'Elo", libelles(bloc("Parties contre l'ordinateur")).length === 4 && bloc("Parties contre l'ordinateur").some(e => e.id === "menuEloTuiles"), libelles(bloc("Parties contre l'ordinateur")).join(" | "));
  T("Parties contre l'ordinateur : la courbe de l'Elo, sous son petit titre, et son explication", bloc("Parties contre l'ordinateur").some(e => e.id === "menuEloGraph") && bloc("Parties contre l'ordinateur").some(e => e.classList.contains("tiroir-section") && net(e.textContent) === "Elo dans le temps") && bloc("Parties contre l'ordinateur").some(e => e.matches("details.menu-explication")));
  T("Activite : jours d'affilee, jours joues, badges", libelles(bloc("Activité")).join(" | ") === "Jours d'affilée | Jours joués | Badges", libelles(bloc("Activité")).join(" | "));
  T("aucun chiffre hors d'une categorie", d.querySelector("#menuStats").firstElementChild.classList.contains("stats-cat"));
  T("meme aspect : toutes les courbes dans le meme cadre", [...d.querySelectorAll("#menuStats .graph")].every(g => g.classList.contains("menu-graphe")) && d.querySelectorAll("#menuStats .graph").length === 2);
  T("meme aspect : chaque courbe est precedee d'un petit titre", [...d.querySelectorAll("#menuStats .graph")].every(g => g.previousElementSibling && g.previousElementSibling.classList.contains("tiroir-section")));
  T("sans compte : pas de barre gagnees / nulles / perdues, pas de categorie « Parties entre membres »", !d.querySelector("#menuStats .stats-bilan") && $("menuMembres").hidden);
  w.close();

  console.log("--- Avec un compte ---");
  w = await ouvrir("fr", { attente: 2200, avant(x) { MEMBRE(x); x.localStorage.setItem("chang64:games", JSON.stringify(PARTIES)); } });
  d = w.document; $ = id => d.getElementById(id);
  w.eval("menuOuvrir();menuVue('stats')"); await attendre(1900);
  const bilan = $("menuOrdiBilan");
  T("une barre gagnees / nulles / perdues pour les parties contre l'ordinateur", !!bilan && !!bilan.querySelector(".stats-barre") && net(bilan.previousElementSibling.textContent) === "Tes dernières parties");
  const legende = r => [...r.querySelectorAll(".stats-legende li")].map(x => net(x.textContent)).join(" | ");
  T("elle compte les vraies parties : 4 gagnees, 1 nulle, 2 perdues (ni entrainement, ni position preparee, ni direct)", legende(bilan) === "4 Gagnées | 1 Nulle | 2 Perdues", legende(bilan));
  T("la part des victoires est dite en clair : 57 %", /^57 % de parties gagnées$/.test(net(bilan.querySelector(".stats-bilan-tete").textContent)), net(bilan.querySelector(".stats-bilan-tete").textContent));
  const parts = [...bilan.querySelectorAll(".stats-barre i")].map(i => i.className + ":" + i.style.flexGrow);
  T("la barre est a l'echelle : 4, 1, 2", parts.join(" ") === "g:4 n:1 p:2", parts.join(" "));
  T("elle est decrite aux lecteurs d'ecran", bilan.querySelector(".stats-barre").getAttribute("role") === "img" && net(bilan.querySelector(".stats-barre").getAttribute("aria-label")) === "4 Gagnées, 1 Nulle, 2 Perdues", bilan.querySelector(".stats-barre").getAttribute("aria-label"));
  T("la barre est entre les chiffres et la courbe de l'Elo", !!(bilan.compareDocumentPosition($("menuEloTuiles")) & 2) && !!(bilan.compareDocumentPosition($("menuEloGraph")) & 4));
  T("membre : le graphe des 30 jours est dans Exercices", !!$("menuJoursGraph") && !!($("menuJoursGraph").compareDocumentPosition($("menuEloTuiles")) & 4));
  T("aucune partie perdue seulement : pas de segment vide", w.eval("statsBilan(3,0,0)").match(/<i class/g).length === 1 && w.eval("statsBilan(0,0,0)") === "");
  w.close();

  console.log("--- L'accueil ---");
  w = await ouvrir("fr", { attente: 2200, avant(x) { x.localStorage.setItem("chang64:progress", JSON.stringify({ level: 3, solved: 12, best: 5, rating: 912, days: 4, eloOrdi: { r: 845, n: 6, pic: 860, h: [[1, 800], [2, 845]] } })); } });
  d = w.document; $ = id => d.getElementById(id);
  await attendre(400);
  const tuiles = [...d.querySelectorAll("#homeStrip .stat")].map(s => net(s.querySelector("b").textContent) + " " + net(s.querySelector("span").textContent));
  T("trois chiffres : Elo, niveau exercices, jours d'affilee", tuiles.length === 3 && /^845 Elo$/.test(tuiles[0]) && /^912 Niveau exercices$/.test(tuiles[1]) && /^4 Jours d'affilée$/.test(tuiles[2]), tuiles.join(" | "));
  T("palier, resolus et meilleure serie n'y sont plus", !$("hLevel") && !$("hSolved") && !$("hBest"));
  T("un lien « Toutes mes statistiques » sous les chiffres", !!$("homeStatsBtn") && net($("homeStatsBtn").textContent) === "Toutes mes statistiques →" && !$("homeStatsBtn").parentNode.classList.contains("hide"));
  $("homeStatsBtn").click(); await attendre(300);
  T("il ouvre le menu sur les statistiques", !$("menuTiroir").hidden && !$("menuStats").hidden && net($("menuTitre").textContent) === "Statistiques");
  T("l'explication de l'accueil parle des trois chiffres", /L'Elo mesure tes parties contre l'ordinateur/.test(net($("tipHomeProgress").textContent)) && /Statistiques/.test(net($("tipHomeProgress").textContent)));
  w.close();

  w = await ouvrir("fr", { attente: 2200 });
  d = w.document; $ = id => d.getElementById(id);
  await attendre(300);
  T("premiere visite : ni chiffres ni lien, l'invitation a commencer", $("homeStrip").classList.contains("hide") && $("homeStatsBtn").parentNode.classList.contains("hide") && !$("homeStart").classList.contains("hide"));
  w.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
