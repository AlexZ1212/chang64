/* Verification du parcours "Je debute" (2026-11-08).
   Lancement : node tests/check_parcours_debut.js (apres node build_site.js)

   Controle chaque position contre le moteur (coup legal, mat reel, suite
   jouable), puis joue le parcours entier a travers l'interface. */
const path = require("path");
const { Game } = require(path.join(__dirname, "..", "engine.js"));
const { ouvrir } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const w = await ouvrir("fr");
  const ev = s => w.eval(s);
  const E = ev("debutEtapes()");
  T("sept etapes", E.length === 7, String(E.length));
  T("derniere etape sans exercice", E[6].exos.length === 0);

  console.log("\n--- Positions ---");
  E.forEach((et, i) => et.exos.forEach((ex, j) => {
    const nom = "etape " + (i + 1) + " exercice " + (j + 1);
    const g = new Game(ex.fen);
    const trouve = u => g.moves().find(m => g.uci(m) === u);
    T(nom + " : Blancs au trait", g.turn === 0 || / w /.test(ex.fen));
    const m = trouve(ex.sol[0]);
    T(nom + " : coup legal", !!m, ex.sol[0]);
    if (!m) return;
    if (ex.cible) T(nom + " : la case marquee est l'arrivee", ex.sol[0].slice(2) === ex.cible);
    if (ex.mat) {
      let mats = 0;
      for (const c of g.moves()) { g.makeMove(c); if (g.isCheckmate()) mats++; g.undoMove(); }
      T(nom + " : un seul mat possible", mats === 1, String(mats));
    }
    g.makeMove(m);
    if (ex.mat) T(nom + " : la solution mate", g.isCheckmate());
    for (const u of ex.suite || []) {
      const s = trouve(u);
      T(nom + " : suite legale " + u, !!s);
      if (s) g.makeMove(s);
    }
    if (ex.suite) T(nom + " : la suite prend une piece", g.history[g.history.length - 1].m.captured > 0);
  }));
  const f = E[1].exos[2], g = new Game(f.fen);
  T("etape 2 : l'autre prise existe et perd la dame", !!g.moves().find(m => g.uci(m) === "d1d5") && !!f.faux.d1d5);

  console.log("\n--- Interface ---");
  const $ = id => w.document.getElementById(id);
  T("bouton Je debute traduit", $("heroDebut").textContent === "Je débute", $("heroDebut").textContent);
  $("heroDebut").click(); await attendre(150);
  T("mode debut", ev("mode") === "debut");
  T("panneau visible", !$("pane-debut").classList.contains("hide"));
  T("accueil cache", $("pane-home").classList.contains("hide"));
  T("etape indiquee", /tape\s1\ssur\s7/.test($("debutEtape").textContent), $("debutEtape").textContent);
  T("sept boutons d'etape", $("debutPas").children.length === 7);
  T("case marquee", ev("marks[debutCase('a5')]") === "cible");
  T("piece a jouer deplacable au doigt", w.document.querySelectorAll("#board .sq.prenable").length === 2);
  /* Le glisser-deposer passe par modeClick, qui ne connaissait pas ce mode. */
  ev("selected=debutCase('a1');modeClick(debutCase('a5'))");
  await attendre(20);
  T("glisser-deposer : le coup est joue", ev("debut.ok") === true);
  ev("debutCharger()");

  const jouer = async u => {
    ev(`handleDebutClick(debutCase('${u.slice(0, 2)}'))`);
    ev(`handleDebutClick(debutCase('${u.slice(2, 4)}'))`);
    await attendre(20);
  };
  ev("debut.e=1;debut.x=2;debutCharger()");
  await jouer("d1d5");
  T("mauvaise prise : message propre", /défendu/.test($("debutStatus").textContent), $("debutStatus").textContent);
  T("mauvaise prise : la position ne change pas", ev("game.history.length") === 0);
  T("mauvaise prise : pas de suivant", $("btnDebutSuite").classList.contains("hide"));
  $("btnDebutIndice").click();
  T("indice : la piece est selectionnee", ev("selected===debutCase('d1')"));
  T("indice : l'arrivee est marquee", ev("marks[debutCase('h5')]") === "hint");
  ev("selected=-1");

  console.log("\n--- Parcours complet ---");
  ev("debut.e=0;debut.x=0;debut.faites=[];debutCharger()");
  let vus = 0;
  for (let i = 0; i < E.length; i++) {
    for (let j = 0; j < E[i].exos.length; j++) {
      const ex = E[i].exos[j];
      await jouer(ex.sol[0]);
      if (ex.suite) await attendre(750 * ex.suite.length + 250);
      await attendre(10);
      T(`etape ${i + 1}.${j + 1} : reussie`, ev("debut.ok") === true && $("debutStatus").className === "status win", $("debutStatus").textContent);
      vus++;
      T(`etape ${i + 1}.${j + 1} : bouton suivant`, !$("btnDebutSuite").classList.contains("hide"));
      $("btnDebutSuite").click(); await attendre(5);
    }
  }
  T("tous les exercices joues", vus === E.reduce((s, e) => s + e.exos.length, 0), String(vus));
  T("arrivee a la derniere etape", ev("debut.e") === 6);
  T("six etapes cochees", ev("debut.faites.length") === 6);
  T("boutons de fin visibles", !$("debutFin").classList.contains("hide"));
  T("indice cache a la fin", $("btnDebutIndice").classList.contains("hide"));
  T("pas de niveau modifie", ev("prog.solved") === 0, String(ev("prog.solved")));

  const stocke = JSON.parse(w.localStorage.getItem("chang64:debut") || "{}");
  T("progression gardee sur l'appareil", stocke.e === 6 && stocke.f.length === 6, JSON.stringify(stocke));

  $("btnDebutPartie").click(); await attendre(300);
  T("premiere partie : onglet Jouer", ev("mode") === "play");
  T("premiere partie : niveau le plus facile", ev("botLevel") === 1);
  T("premiere partie : sans pendule", ev("clock.enabled") === false);
  T("premiere partie : Blancs", ev("myColor") === ev("W"));
  T("premiere partie : pas d'ecran d'attente", ev("awaitingStart") === false);
  w.close();

  console.log("\n--- Adresse directe ---");
  const w2 = await ouvrir("en", { avant(x) { x.location.hash = "#start"; } });
  T("#start ouvre le parcours", w2.eval("mode") === "debut", w2.eval("mode"));

  console.log("\n--- Plein ecran sur telephone ---");
  const croix = w2.document.getElementById("btnDebutFermer");
  T("croix presente et nommee", !!croix && !!croix.getAttribute("aria-label"));
  croix.click(); await attendre(50);
  T("la croix ramene a l'accueil", w2.eval("mode") === "home", w2.eval("mode"));
  T("l'accueil est visible apres la croix", !w2.document.getElementById("pane-home").classList.contains("hide"));
  const css = require("fs").readFileSync(path.join(__dirname, "..", "site", "index.html"), "utf8").replace(/\s+/g, " ");
  const tel = css.search(/@media ?\(max-width:599px\) ?\{ ?body\[data-mode="debut"\] header/);
  const bloc = tel >= 0 ? css.slice(tel, css.indexOf(".sq.prenable", tel)) : "";
  T("telephone : en-tete et pied de page masques", /body\[data-mode="debut"\] header,body\[data-mode="debut"\] footer\{display:none\}/.test(bloc));
  T("telephone : echiquier agrandi", /100svh - 392px/.test(bloc));
  T("croix visible seulement sur telephone", /\.debut-fermer\{display:none\}/.test(css) && /\.debut-fermer\{display:flex/.test(bloc));
  w2.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + e.message); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
