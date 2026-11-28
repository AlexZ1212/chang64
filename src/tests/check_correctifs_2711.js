/* Verification automatique de chang64.
   Lancement : node tests/check_correctifs_2711.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Le lot de 21 correctifs note par Alexandre le 27/11/2026 (captures de son
   iPhone, design/correctifs-2811/liste.md), chacun avec sa garde. Les
   mesures de mise en page (360 px, police elargie) sont faites dans un vrai
   navigateur par mesure_correctifs_2711.js, pas ici. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const net = s => String(s).replace(/\s+/g, " ").trim();
const SRC = path.join(__dirname, "..");
const lire = f => fs.readFileSync(path.join(SRC, f), "utf8");
const LANGUES = ["fr", "en", "es", "pt", "de", "ru", "it", "tr", "pl", "id"];

(async () => {
  const w = await ouvrir("fr", { attente: 2200, fetch: true });
  const d = w.document, $ = id => d.getElementById(id), ev = x => w.eval(x);

  console.log("--- 16. Plus d'espace avant « % » ---");
  T("francais : « 62% » colle", ev("pourcentTexte(.62)") === "62%", JSON.stringify(ev("pourcentTexte(.62)")));
  T("aucune espace (pleine, fine, normale) avant « % »", !/[\s  ]%/.test(ev("pourcentTexte(.05)")));
  for (const l of ["de", "ru", "es", "tr"]) {
    const wl = await ouvrir(l, { attente: 900 });
    const p = wl.eval("pourcentTexte(.62)");
    T(l + " : " + p, l === "tr" ? p === "%62" : p === "62%", JSON.stringify(p));
    wl.close();
  }
  for (const l of LANGUES) {
    const f = l === "fr" ? "badges-catalogue.js" : "badges-textes/" + l + ".json";
    T("textes des badges (" + l + ") : pas de « 64 % »", !/\d[\s  ]%/.test(lire(f)));
  }

  console.log("--- 14. « Signaler cet exercice » sous les boutons de partage ---");
  {
    const s = $("exSignaler"), b = $("dailyChallengeBlock");
    T("le lien vient apres le bloc de partage du jour", s && b && (b.compareDocumentPosition(s) & w.Node.DOCUMENT_POSITION_FOLLOWING) && !b.contains(s));
    T("un seul lien « Signaler » sur la page", d.querySelectorAll("#btnSignaler").length === 1);
  }

  console.log("--- 13. Chiffres des Statistiques qui debordaient ---");
  T("le chiffre d'une tuile dit sa longueur au CSS (« 114/286 » : --n:7)", /--n:7/.test(ev("tuileChiffre('114/286')")), ev("tuileChiffre('114/286')"));
  T("le CSS reduit la police selon la largeur de la case", /\.menu-tuile b\{[^}]*font-size:min\(22px,calc\(100cqi/.test(lire("template.html")) && /\.menu-tuile\{container-type:inline-size/.test(lire("template.html")));
  ev("ensureProgFields();prog.badges=[];menuOuvrir();menuVue('stats')");
  T("Activite : la tuile des badges passe par tuileChiffre", [...d.querySelectorAll("#menuStats .menu-tuiles.trois b")].every(b => /--n:/.test(b.getAttribute("style") || "")));
  T("graphe Elo vide : le message est du HTML qui va a la ligne, pas un <text> SVG", d.querySelector("#menuEloGraph .courbe-vide p") && !d.querySelector("#menuEloGraph svg text"));

  console.log("--- 21. Plus de chiffre sous la coche de l'etape en cours ---");
  {
    const css = lire("template.html");
    const i = css.indexOf('.debut-pas button[aria-current="step"]{'), j = css.indexOf('.debut-pas button.fait[aria-current="step"]{color:transparent}');
    T("l'etape en cours et faite cache son chiffre, apres la regle de l'etape en cours", i > 0 && j > i);
  }

  console.log("--- 20. Coche de l'annonce « Objectif atteint ! » ---");
  {
    const css = lire("template.html");
    T("la pastille de l'annonce prend la coche commune (meme masque que les etapes d'Apprendre)", /\.ap-chap\.fait \.ap-num::after,\.obj-objectif \.obj-pastille::after,\.coche-ok::after/.test(css));
    T("disque jade plat, sans la coche fine", /\.obj-objectif \.obj-pastille\{position:relative;background:var\(--jade\);box-shadow:none\}/.test(css) && /\.obj-objectif \.obj-pastille svg\{display:none\}/.test(css));
  }

  console.log("--- 19. Rien ne se lit sous le degrade des rangees qui defilent ---");
  {
    const css = lire("template.html");
    T("rangee des pastilles d'erreurs : degrade colle au bord, sur toute la hauteur, sans arrondi", /\.erreurs-defile::before,\.erreurs-defile::after\{top:0;bottom:0;width:44px;border-radius:0\}/.test(css) && /\.erreurs-defile::before\{left:0;/.test(css) && /\.erreurs-defile::after\{right:0;/.test(css));
    T("toutes les rangees : partie opaque plus large (44 px, opaque a 70 %)", /\.defile::before,\.defile::after\{[^}]*width:44px/.test(css) && (css.match(/var\(--ink\) 70%,transparent/g) || []).length === 4);
  }

  console.log("--- 1. Ma progression : ni cesure ni grand interligne ---");
  {
    const css = lire("template.html");
    T("plus de coupure de mot automatique dans les trois cases", !/\.strip\.trois \.stat span,\.strip\.trois \.stat em\{overflow-wrap:anywhere;hyphens:auto\}/.test(css) && /\.strip\.trois \.stat span,\.strip\.trois \.stat em\{overflow-wrap:normal;hyphens:manual;line-height:1\.25\}/.test(css));
    T("un mot trop long reduit la police de son libelle (homeStripAjuster)", typeof w.homeStripAjuster === "function");
  }

  console.log("--- 8. « Chercher un membre » au-dessus du clavier de l'iPhone ---");
  {
    const nav = lire("navigation.js");
    T("un champ du menu qui prend la main est remonte au-dessus du clavier (visualViewport)", typeof w.clavierDegager === "function" && /visualViewport/.test(nav) && /closest\('\.tiroir,\[role="dialog"\]'\)/.test(nav));
    T("la marge provisoire part avec le clavier", /focusout[\s\S]{0,200}paddingBottom = clavier\.marge/.test(nav));
  }

  console.log("--- 9. Un seul onglet actif (Analyser ne disparait plus) ---");
  {
    const actifs = () => [...d.querySelectorAll('#tabsNav button[aria-current="page"]')].filter(b => !b.hidden).map(b => b.id);
    ev("setMode('edit')");
    const ep = $("editPlay");
    if (ep) ep.click();
    const a = actifs();
    T("« Jouer contre l'ordinateur depuis ici » : seul Analyser reste allume", a.length === 1 && a[0] === "tab-edit", a.join(","));
    ev("setMode('play')");
    const b = actifs();
    T("retour sur Jouer : un seul onglet allume", b.length === 1, b.join(","));
    ev("markTab(document.getElementById('tab-puzzles'),true)");
    T("markTab eteint les autres onglets de la barre", actifs().join(",") === "tab-puzzles", actifs().join(","));
    ev("setMode('home')");
  }

  console.log("--- 5. Pieces gagnees : les promotions comptent ---");
  {
    const solde = fen => ev(`(function(){const sauve=game,rv=reviewGame;reviewGame=null;game=new Game(${JSON.stringify(fen)});const r=prises().solde;game=sauve;reviewGame=rv;return r})()`);
    T("position de depart : 0", solde("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") === 0);
    T("la fin de partie d'Alexandre (deux dames contre roi seul) : +18 pour les Blancs", solde("1Q6/8/k7/8/8/8/8/Q4K2 b - - 0 1") === 18, solde("1Q6/8/k7/8/8/8/8/Q4K2 b - - 0 1"));
    const promo = ev(`(function(){const sauve=game,rv=reviewGame;reviewGame=null;game=new Game("k7/7P/8/8/8/8/8/K7 w - - 0 1");const m=game.moves().find(x=>game.uci(x)==="h7h8q");game.makeMove(m);const r=prises().solde;game=sauve;reviewGame=rv;return r})()`);
    T("une promotion sans prise : +9 (une dame), plus 0", promo === 9, promo);
  }

  console.log("--- 7. Barre d'evaluation sur un mat ---");
  {
    const barre = fen => JSON.parse(ev(`(function(){const sauve=game,rv=reviewGame,rp=reviewPly;reviewGame=null;reviewPly=null;game=new Game(${JSON.stringify(fen)});updateEval();
      const r={h:document.getElementById('evalfill').style.height,n:document.getElementById('evalnum').textContent,t:document.getElementById('evaltxt').textContent};game=sauve;reviewGame=rv;reviewPly=rp;return JSON.stringify(r)})()`));
    const a = barre("4R1kr/p1p2ppp/1qp5/2N5/1B6/P2P3P/1PP2PPK/8 b - - 0 26");
    T("la partie d'Alexandre (26. Txe8#) : barre pleine cote Blancs, « # », « Échec et mat »", a.h === "94%" && a.n === "#" && /chec\s+et\s+mat/.test(a.t), JSON.stringify(a));
    const b = barre("k7/8/8/8/8/8/5PPP/3r2K1 w - - 0 1");
    T("les Noirs matent : barre pleine cote Noirs", b.h === "6%" && /#/.test(b.n), JSON.stringify(b));
    const c = barre("k7/8/1Q6/8/8/8/8/K7 b - - 0 1");
    T("pat : barre au milieu", c.h === "50%" && c.t === "Pat.", JSON.stringify(c));
  }

  console.log("--- 2. Grande medaille nette sur iPhone ---");
  {
    T("a la fin de l'arrivee, la medaille sort de la 3D pour etre redessinee (bxNettete)", typeof w.bxNettete === "function" && /bxNettete\(socle\.querySelector\("\.bx-piece3d"\)\)/.test(lire("badges.js")));
    T("le CSS de la medaille posee coupe la 3D", /\.bravo \.bx-piece3d\.bx-pose\{animation:none;transform:none;transform-style:flat\}/.test(lire("template.html")));
    const sans = ev("BADGES.filter(b=>!(bxMedailles&&bxMedailles[b.id]&&bxMedailles[b.id][1])).map(b=>b.id).join(',')");
    T("chaque badge a son dessin de medaille", sans === "", sans);
  }

  console.log("--- 18. Une seule epaisseur de jauge (6 px, choix B d'Alexandre) ---");
  {
    const css = lire("template.html");
    T("la variable --jauge vaut 6 px", /:root\{--jauge:6px\}/.test(css));
    for (const sel of [".ap-barre", ".progressbar", ".stats-barre", ".erreurs-barre i", ".defi-barre", ".cpl-jauge"]) {
      const m = css.match(new RegExp(sel.replace(/[.]/g, "\\.").replace(/ /g, " ") + "\\{[^}]*\\}"));
      T(sel + " : height:var(--jauge)", m && /height:var\(--jauge\)/.test(m[0]) && !/border:1px/.test(m[0]), m && m[0].slice(0, 80));
    }
  }

  console.log("--- 15. « Toutes mes statistiques » comme « Signaler cet exercice » ---");
  {
    const b = $("homeStatsBtn"), css = lire("template.html");
    T("le lien dit « Toutes mes statistiques », sans fleche", b && net(b.textContent) === "Toutes mes statistiques", b && b.textContent);
    T("centre, 13 px, comme Signaler", /\.home-stats-lien\{margin:8px 0 0;text-align:center\}/.test(css) && /\.home-stats-lien \.linkbtn\{font-size:13px\}/.test(css) && /\.signaler \.linkbtn\{font-size:13px/.test(css));
    T("la cle traduite existe dans les 9 langues", ["de", "es", "fr", "id", "it", "pl", "pt", "ru", "tr"].every(l => /"All my statistics":"[^"→]+"/.test(lire("langues/" + l + "/app.js"))));
  }

  console.log("--- 17. Coordonnees : un seul choix de vue, et l'echiquier se retourne ---");
  {
    T("le choix sous l'echiquier est cache (il reste pour garder le choix)", $("coordSideChamp") && $("coordSideChamp").classList.contains("hide") && !!$("coordSide"));
    ev("setMode('puzzles',{screen:'puzzles'});beginCoordFlow()");
    d.querySelector('#readySide [data-v="b"]').click();
    T("« Vue des Noirs » dans la fenetre retourne l'echiquier tout de suite", ev("flipped") === true);
    T("et le choix est garde pour le depart", $("coordSide").children[1].getAttribute("aria-pressed") === "true");
    d.querySelector('#readySide [data-v="w"]').click();
    T("« Vue des Blancs » le remet a l'endroit", ev("flipped") === false);
    ev("setMode('home')");
  }

  console.log("--- 12. Pictos des motifs : une piece + un signe (choix B), medailles comprises ---");
  {
    const M = JSON.parse(lire("badges-medailles.json"));
    for (const k of ["deflection", "double_attack", "quiet_move", "back_rank_mate", "mate_in_one", "mate_in_two", "mate_in_three", "winning_capture"]) {
      const med = M["theme_" + k] && M["theme_" + k][1];
      T("medaille theme_" + k + " : une piece et un accent", med && /data-accent="1"/.test(med) && /stroke="var\(--oeil\)"/.test(med));
      T("tuile motif_" + k + " : le meme dessin que la medaille", ev("typeof PICTOS!=='undefined'&&PICTOS.motif_" + k + "&&/data-accent/.test(PICTOS.motif_" + k + ")") === true);
    }
  }

  console.log("--- 11. Le coach montre toutes les gaffes et erreurs, imprecisions repliees ---");
  {
    ev("prefAnnounce='moves';ouvrirPartieGardee({m:'e2e4 e7e5 f1c4 b8c6 d2d3 g8f6 c1g5 h7h6 b1c3 h6g5 d1d2 f8e7 g1f3 d7d6 e1g1 c8g4',c:'w',t:Date.UTC(2026,10,21,12),k:'o'},'jeu')");
    const F = { 0: { tag: "inacc", loss: 60, best: "d2d4" }, 2: { tag: "mistake", loss: 120, best: "g1f3" }, 4: { tag: "blunder", loss: 300, best: "g1f3" }, 6: { tag: "blunder", loss: 310, best: "g5h4" },
      8: { tag: "mistake", loss: 150, best: "g1f3" }, 10: { tag: "inacc", loss: 50, best: "g1f3" }, 12: { tag: "mistake", loss: 140, best: "b1c3" }, 14: { tag: "inacc", loss: 40, best: "f1e1" } };
    ev("(function(){const F=" + JSON.stringify(F) + ",P=[];for(let i=0;i<16;i++){const f=F[i]||{};P.push({cp:0,cpTrue:0,mate:null,loss:f.loss||0,tag:f.tag||null,best:f.best||gameUci[i],mover:i%2,rep:null,pv:null,pvr:null});}finishAnalysis(P,coachPreparerSansMoteur(P));})()");
    await new Promise(r => setTimeout(r, 200));
    const visibles = [...d.querySelectorAll("#coachListe > li > .coach-ligne")].map(b => b.dataset.ply);
    T("les 5 gaffes et erreurs sont la (on en montrait 3)", visibles.join(",") === "3,5,7,9,13", visibles.join(","));
    T("l'intro dit 5 moments", /^5 moments à revoir/.test(net($("coachIntro").textContent)), $("coachIntro").textContent);
    const det = d.querySelector("#coachListe .coach-plus details");
    T("les 3 imprecisions sont repliees", det && !det.open && det.querySelectorAll(".coach-ligne").length === 3 && net(det.querySelector("summary").textContent) === "Voir les 3 imprécisions", det && det.querySelector("summary").textContent);
    T("une imprecision dit seulement le coup prefere", det && /^Le coach préférait /.test(net(det.querySelector(".coach-ligne span").textContent)), det && det.querySelector(".coach-ligne span").textContent);
    T("sous l'echiquier, une imprecision reste sans phrase du coach", ev("coachPli(0)") === null);
    T("traduit dans les 9 langues", ["de", "es", "fr", "id", "it", "pl", "pt", "ru", "tr"].every(l => /"See the inaccuracy":/.test(lire("langues/" + l + "/app.js")) && /"See the \{n\} inaccuracies":/.test(lire("langues/" + l + "/app.js"))));
    ev("setMode('home')");
  }

  console.log("--- 10. Force de l'ordinateur depuis Analyser ---");
  {
    const r = $("editLevel");
    T("cinq forces, avec leur Elo, au-dessus de « Jouer contre l'ordinateur depuis ici »", r && r.children.length === 5 && !!r.closest(".btnrow") && (r.closest(".edit-force").compareDocumentPosition($("editPlay")) & w.Node.DOCUMENT_POSITION_FOLLOWING));
    T("le titre est traduit", net(d.querySelector(".edit-force-titre").textContent) === "Force de l'ordinateur");
    ev("setMode('edit')");
    r.querySelector('[data-v="6"]').click();
    T("choisir « Tout doux » ici le choisit pour la partie", ev("botLevel") === 6 && $("segLevel").querySelector('[data-v="6"]').getAttribute("aria-pressed") === "true");
    $("segLevel").querySelector('[data-v="3"]').click();
    T("et un choix fait dans Contre l'ordinateur se retrouve ici", r.querySelector('[data-v="3"]').getAttribute("aria-pressed") === "true");
    T("« Jouer contre l'ordinateur depuis ici » joue a cette force", (ev("(function(){game=new Game();editTurnVal='w';$('editPlay').click();return botLevel})()")) === 3);
    ev("setMode('home')");
  }

  console.log("--- 3 et 4. Duels gagnes : tableau des joueurs et fiche ---");
  {
    T("un onglet « Duels gagnés » dans Meilleurs joueurs", ev("CPJ.some(x=>x[0]==='duels'&&t(x[1])==='Duels gagnés')") === true);
    T("une colonne « Duels » dans le grand tableau, lue sur u", ev("CPJ_COLONNES.some(x=>x[0]==='u'&&t(x[1])==='Duels')") === true && ev("CPJ.length===CPJ_COLONNES.length") === true);
    const h = ev("cppDuels({v:12,n:1,d:7})");
    const div = d.createElement("div"); div.innerHTML = h;
    T("bloc de la fiche : « Duels d'exercices », 12 Victoires, 1 Nul, 7 Défaites", /Duels d'exercices/.test(div.textContent) && net([...div.querySelectorAll(".menu-tuile")].map(x => x.textContent).join("|")) === "12Victoires|1Nul|7Défaites", net([...div.querySelectorAll(".menu-tuile")].map(x => x.textContent).join("|")));
    T("aucun duel : pas de bloc", ev("cppDuels(null)") === "" && ev("cppDuels({v:0,n:0,d:0})") === "");
    T("traductions des duels dans les 9 langues", ["de", "es", "fr", "id", "it", "pl", "pt", "ru", "tr"].every(l => ["Puzzle duels won", "Duels", "Puzzle duels", "Wins", "Draws", "Losses"].every(k => lire("langues/" + l + "/app.js").includes('"' + k + '":'))));
  }

  console.log("--- Poids : les traces repetes des pictos ne sont ecrits qu'une fois ---");
  {
    const m = require("../pictos_build.js"), src = m.pictosSource();
    const P = new Function(src + ";return PICTOS;")();
    T("les pictos recomposes sont identiques aux dessins", Object.keys(m.PICTOS).every(k => P[k] === m.PICTOS[k]));
    T("et la source est plus legere", src.length < JSON.stringify(m.PICTOS).length - 5000, src.length + " / " + JSON.stringify(m.PICTOS).length);
    T("la page a les memes pictos", ev("Object.keys(PICTOS).every(k=>!/\\u0001/.test(PICTOS[k]))") === true && ev("PICTOS.motif_mate_in_one") === m.PICTOS.motif_mate_in_one);
  }

  console.log("--- 28/11 : champ FEN d'Analyser traduit ---");
  T("placeholder et aria-label en francais", $("editFenIn").placeholder === "Colle un FEN ici pour le charger" && $("editFenIn").getAttribute("aria-label") === "FEN à importer", $("editFenIn").placeholder);
  T("traduits dans les 9 langues", ["de", "es", "fr", "id", "it", "pl", "pt", "ru", "tr"].every(l => /"Paste a FEN here to load it":"/.test(lire("langues/" + l + "/app.js")) && /"FEN to import":"/.test(lire("langues/" + l + "/app.js"))));

  console.log("--- 28/11 : « presque maîtrisée » et espace sous les boutons du boss ---");
  T("« 1 presque maîtrisée », « 2 presque maîtrisées »", ev("t('{n} almost learned',{n:1})") === "1 presque maîtrisée" && ev("t('{n} almost learned',{n:2})") === "2 presque maîtrisées", ev("t('{n} almost learned',{n:2})"));
  T("la phrase du boss a 12 px au-dessus d'elle", /#leconBossNote\{margin-top:12px\}/.test(lire("template.html")));

  w.close();
  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
