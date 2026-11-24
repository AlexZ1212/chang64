/* Verification automatique de chang64.
   Lancement : node tests/check_entrainement.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Reglage « Entrainement » contre l'ordinateur (apprendre.js, 2026-11-24).
   Choix d'Alexandre (QCM du 24/11) :
   - un interrupteur sous la force, choisi AVANT la partie, jamais pendant ;
   - allume : la partie est un entrainement des le depart, « Reprendre le
     coup » est la toute la partie, ni Elo ni badges ; eteint : partie
     classee, aucune aide ;
   - la pendule garde la cadence choisie : reprendre rend la position, pas
     les secondes ;
   - le reglage reste comme on l'a laisse d'une partie a l'autre ; la
     fenetre « Pret » le rappelle. */
const { ouvrir } = require("./outils/page_langue.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));
const net = x => String(x).replace(/\s+/g, " ").replace(/\u2019/g, "'").trim();
const BOSS = "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

let w, $, ev;
const charger = async (avant) => { w = await ouvrir("fr", { fetch: true, avant }); $ = id => w.document.getElementById(id); ev = s => w.eval(s); };
const cache = id => $(id).classList.contains("hide");
/* Une partie neuve contre l'ordinateur, Blancs, 10+0, la fenetre « Pret » ouverte. */
const nouvelle = async () => {
  ev("colorMode='w';myColor=W;botLevel=1;syncForce();tcCat='rapid';tcIdx=0;setMode('play',{fresh:true})");
  await pause(300);
};
const demarrer = async () => { if (!cache("readyBanner")) { $("readyStart").click(); await pause(300); } };
const jouer = async uci => {
  const n = ev("game.history.length");
  ev("playUser(game.moves().find(m=>game.uci(m)==='" + uci + "'))");
  for (let i = 0; i < 80 && (ev("game.history.length") < n + 2 || ev("busy")); i++) await pause(150);
};
const abandonner = async () => { $("btnResign").click(); $("btnResign").click(); await pause(300); };

(async () => {
  console.log("--- Au premier passage : eteint ---");
  await charger();
  const sw = $("entrainementSwitch");
  T("l'interrupteur est sous la force, eteint, avec son nom traduit", !!sw && sw.getAttribute("role") === "switch" && sw.getAttribute("aria-checked") === "false" &&
    net(sw.textContent) === "Entraînement" && $("adapteNiveau").parentElement === sw.parentElement, sw && net(sw.textContent));
  T("sa phrase d'aide est cachee", cache("entrainementAide"));

  console.log("--- Eteint : partie classee, aucune aide ---");
  await nouvelle();
  T("la fenetre « Pret » ne parle pas d'entrainement", !cache("readyBanner") && !/Entraînement/.test($("readySub").textContent), $("readySub").textContent);
  await demarrer();
  await jouer("e2e4");
  T("deux coups joues, pas de « Reprendre le coup », pas de note", ev("game.history.length") === 2 && cache("btnReprendre") && cache("entrainementNote") && ev("partieEntrainement()") === false);
  T("pendant la partie, l'interrupteur est grise", sw.disabled === true);
  sw.click();
  T("et un appui ne le change pas", sw.getAttribute("aria-checked") === "false" && ev("entrainementOn") === false);
  await jouer("g1f3");
  await abandonner();
  T("la partie finie compte (pas de marque d'entrainement)", ev("history[0].ent") === undefined && ev("history[0].k") === "o", ev("JSON.stringify(history[0])"));
  T("partie finie : l'interrupteur se rallume", sw.disabled === false);

  console.log("--- On l'allume ---");
  sw.click();
  T("allume : aria-checked, phrase d'aide visible, garde sur l'appareil",
    sw.getAttribute("aria-checked") === "true" && !cache("entrainementAide") && ev("localStorage.getItem('chang64:entrainement')") === "1");
  T("la phrase d'aide dit ce qu'il change", net($("entrainementAide").textContent) === "Tu peux reprendre un coup. La partie ne compte ni pour ton Elo ni pour tes badges.", $("entrainementAide").textContent);

  console.log("--- Allume : la partie est un entrainement des le depart ---");
  await nouvelle();
  T("la fenetre « Pret » le rappelle", / \| Entraînement \| /.test(net($("readySub").textContent)), $("readySub").textContent);
  await demarrer();
  T("des le premier coup : partie d'entrainement, la note le dit", ev("partieEntrainement()") === true && !cache("entrainementNote"));
  T("« Reprendre le coup » est la, grise tant qu'il n'y a rien a reprendre", !cache("btnReprendre") && $("btnReprendre").disabled === true);
  await jouer("e2e4");
  await jouer("g1f3");
  T("quatre coups joues : « Reprendre le coup » est actif", ev("game.history.length") === 4 && $("btnReprendre").disabled === false);
  T("la pendule tourne (cadence gardee)", ev("clock.enabled") === true);
  ev("clock.w-=7000");
  const avant = ev("clock.w");
  $("btnReprendre").click(); await pause(200);
  T("reprendre ramene deux demi-coups en arriere, a moi de jouer", ev("game.history.length") === 2 && ev("game.turn") === ev("W"));
  T("les secondes deja passees ne reviennent pas", ev("clock.w") <= avant, ev("clock.w") + " > " + avant);
  T("toujours un entrainement", ev("partieEntrainement()") === true && !cache("entrainementNote"));
  await jouer("d2d4");
  $("btnReprendre").click(); await pause(200);
  T("on peut reprendre autant de fois qu'on veut", ev("game.history.length") === 2);
  await jouer("g1f3");
  await abandonner();
  T("partie finie : marquee entrainement dans « Tes parties »", ev("history[0].ent") === 1, ev("JSON.stringify(history[0])"));
  T("et elle ne compte pas pour l'Elo contre l'ordinateur", ev("typeof eloCompter") === 'function' && ev("eloCompter(history[0])") === null);
  T("plus de « Reprendre le coup » une fois la partie finie", cache("btnReprendre"));

  console.log("--- Garde d'une visite a l'autre ---");
  w.close();
  await charger(x => x.localStorage.setItem("chang64:entrainement", "1"));
  T("au chargement, l'interrupteur est comme on l'a laisse", $("entrainementSwitch").getAttribute("aria-checked") === "true" && !cache("entrainementAide") && ev("entrainementOn") === true);
  await nouvelle(); await demarrer();
  T("et la partie suivante est un entrainement", ev("partieEntrainement()") === true);
  await abandonner();

  console.log("--- Depuis une position (Analyser, « Jouer contre l'ordinateur depuis ici ») ---");
  ev("pendingStartFen='r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3'");
  await nouvelle(); await demarrer();
  T("la partie depuis une position est aussi un entrainement", ev("gameStartFen") !== null && ev("partieEntrainement()") === true && !cache("btnReprendre"));
  await abandonner();

  console.log("--- Le chemin garde ses regles ---");
  ev("cheminLancerPartie('regles'," + JSON.stringify(BOSS) + ",1)"); await pause(300);
  T("une partie contre un boss reste une partie du chemin (son chapitre, sa position)", ev("cheminPartie.ch") === "regles" && ev("cheminPartie.e") === undefined && ev("partieEntrainement()") === true);
  await abandonner();

  console.log("--- On l'eteint ---");
  $("entrainementSwitch").click();
  T("eteint : phrase cachee, garde sur l'appareil", $("entrainementSwitch").getAttribute("aria-checked") === "false" && cache("entrainementAide") && ev("localStorage.getItem('chang64:entrainement')") === "0");
  await nouvelle(); await demarrer();
  await jouer("e2e4");
  T("la partie suivante est classee : ni bouton ni note", ev("partieEntrainement()") === false && cache("btnReprendre") && cache("entrainementNote"));
  w.close();

  await pause(50);
  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
