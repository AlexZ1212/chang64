/* Verification automatique de chang64.
   Lancement : node tests/check_fin_de_boss.js
   Le site doit avoir ete construit au prealable : node build_site.js

   La fin d'une partie contre un boss propose la suite (apprendre.js,
   2026-11-23). Demande d'Alexandre : « A la fin de chaque boss, il faudrait
   proposer d'aller au niveau d'apprentissage suivant. » Ses choix (QCM du
   23/11, maquettes a 360 px) : la carte de fin, posee sur l'echiquier, change
   ses boutons pour une partie contre un boss ;
   - victoire : « Chapitre suivant » (en avant), « Retour au chemin » ;
   - defaite (ou nulle) quand la suite est fermee : « Reessayer le boss » (en
     avant), « Retour au chemin » ;
   - troisieme defaite, qui ouvre la suite : « Chapitre suivant » (en avant),
     « Reessayer le boss » ;
   - dernier boss battu : « Resoudre des exercices », « Jouer une partie », et
     « Retour au chemin » en lien a la place de « Masquer » ;
   - plus d'annonce de 4 s qui le dirait une seconde fois ;
   - rien pendant la partie ; une partie ordinaire garde sa carte habituelle. */
const { ouvrir } = require("./outils/page_langue.js");
const { LANGUES } = require("../langues/registre.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));
const net = s => String(s).replace(/[  ]/g, " ").trim();
const CHAPITRES = require("../chemin/plan.json").chapitres;
const DERNIER = CHAPITRES[CHAPITRES.length - 1];
const BOSS = "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const avec = o => ({ fetch: true, avant(w) { for (const k in o) w.localStorage.setItem(k, typeof o[k] === "string" ? o[k] : JSON.stringify(o[k])); } });
/* Chapitre 2 fini, boss pas encore battu. */
const AU_BOSS = { "chang64:debut": { e: 6, x: 0, f: [0, 1, 2, 3, 4, 5] }, "chang64:chemin": { v: 2, c: { regles: { e: 5, x: 0, f: [0, 1, 2, 3, 4] } }, o: [], p: { x: 1 } } };
/* Tout fini, tous les boss battus sauf le dernier. */
const AU_DERNIER = { "chang64:debut": { e: 6, x: 0, f: [0, 1, 2, 3, 4, 5] }, "chang64:chemin": { v: 2,
  c: Object.fromEntries(CHAPITRES.slice(1).map(c => [c, { e: 5, x: 0, f: c === DERNIER ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5] }])), o: [], p: { x: 1 } } };

let w, $, ev;
const charger = async (lang, o) => { w = await ouvrir(lang || "fr", avec(o)); $ = id => w.document.getElementById(id); ev = s => w.eval(s); };
const lancer = async ch => { ev("cheminLancerPartie(" + JSON.stringify(ch || "regles") + "," + JSON.stringify(BOSS) + ",1)"); await pause(300); };
/* La fin, posee comme le fait l'application (renderResult apres le dernier coup). */
const finir = async (issue, abandon) => {
  ev("(function(){const g=new Game(gameStartFen);for(const u of ['e2e4','e7e5','g1f3','b8c6']){g.makeMove(g.moves().find(x=>g.uci(x)===u));}game=g;gameUci=['e2e4','e7e5','g1f3','b8c6'];" +
    "resigned=" + (abandon || "null") + ";resultInfo={kind:'" + issue + "',title:'Titre de la partie',sub:'Sous-titre de la partie'};gameSaved=false;resultDismissed=false;renderResult(true);})()");
  await pause(200);
};
const carte = () => ({ visible: !$("resultBanner").classList.contains("hide"), titre: net($("resultTitle").textContent), sous: net($("resultSub").textContent),
  b1: net($("resultNew").textContent), b2: $("resultAnalyse").classList.contains("hide") ? null : net($("resultAnalyse").textContent), lien: net($("resultClose").textContent),
  enAvant: $("resultNew").classList.contains("primary") && !$("resultAnalyse").classList.contains("primary") });
const dit = x => JSON.stringify(x);
const espionAnnonces = () => ev("window.__annonces=[];(function(){const av=objAnnoncer;objAnnoncer=function(a,b){window.__annonces.push(b);return av.apply(this,arguments);};})()");

(async () => {
  console.log("--- Pendant la partie contre le boss : rien ---");
  await charger("fr", AU_BOSS);
  espionAnnonces();
  await lancer();
  T("la partie contre le boss est lancee", ev("mode") === "play" && ev("cheminPartieActive()") === true && ev("gameStartFen") === BOSS);
  T("pas de carte de fin pendant la partie", $("resultBanner").classList.contains("hide") && ev("bossCarteActive()") === false);
  ev("(function(){const m=legalCache.find(x=>game.uci(x)==='e2e4');playUser(m);})()");
  for (let i = 0; i < 60 && ev("game.history.length") < 2; i++) await pause(150);
  ev("renderResult(false)");
  T("apres un coup de chaque cote, toujours rien", $("resultBanner").classList.contains("hide") && ev("bossCarte") === null && ev("__annonces.length") === 0);

  console.log("--- Premiere et deuxieme defaites : reessayer ---");
  await finir("lose", "W");
  let c = carte();
  T("carte : « Le boss a gagne », les defaites comptees", c.visible && c.titre === "Le boss a gagné" && c.sous === "Défaites contre ce boss : 1 sur 3. À la troisième, le chapitre suivant s'ouvre quand même.", dit(c));
  T("carte : « Reessayer le boss » en avant, « Retour au chemin », « Masquer »", c.b1 === "Réessayer le boss" && c.enAvant && c.b2 === "Retour au chemin" && c.lien === "Masquer", dit(c));
  T("aucune annonce en plus", ev("__annonces.length") === 0, ev("__annonces.join()"));
  $("resultNew").click(); await pause(400);
  T("« Reessayer le boss » relance le meme boss, au meme niveau, sans carte", ev("mode") === "play" && ev("gameStarted") === true && ev("gameStartFen") === BOSS && ev("botLevel") === 1 &&
    ev("cheminPartieActive()") === true && ev("game.history.length") === 0 && $("resultBanner").classList.contains("hide"));
  await finir("lose", "W");
  c = carte();
  T("deuxieme defaite : 2 sur 3", c.sous.startsWith("Défaites contre ce boss : 2 sur 3.") && c.b1 === "Réessayer le boss", dit(c));
  $("resultAnalyse").click(); await pause(300);
  T("« Retour au chemin » ramene a l'onglet Apprendre", ev("mode") === "apprendre");

  console.log("--- Troisieme defaite : la suite s'ouvre, on la propose ---");
  await lancer(); await finir("lose", "W");
  c = carte();
  T("carte : « Le chapitre 3 est ouvert », sans reproche", c.titre === "Le chapitre 3 est ouvert" && c.sous === "Trois essais contre le boss : tu peux continuer, et revenir le battre plus tard.", dit(c));
  T("carte : « Chapitre suivant » en avant, puis « Reessayer le boss »", c.b1 === "Chapitre suivant" && c.enAvant && c.b2 === "Réessayer le boss" && c.lien === "Masquer", dit(c));
  T("aucune annonce en plus", ev("__annonces.length") === 0, ev("__annonces.join()"));
  $("resultNew").click(); await pause(600);
  T("« Chapitre suivant » ouvre la premiere lecon du chapitre 3", ev("mode") === "debut" && ev("leconCh") === CHAPITRES[2] && ev("lecon.e") === 0 && ev("lecon.x") === 0, ev("mode") + " " + ev("leconCh") + " " + ev("lecon.e"));
  T("et le retour de ce chapitre mene au chemin", ev("cheminRetour()") === "apprendre");

  console.log("--- Une defaite de plus, la suite deja ouverte ---");
  await lancer(); await finir("lose", "W");
  c = carte();
  T("carte : « Le boss a gagne », la suite est ouverte", c.titre === "Le boss a gagné" && c.sous === "Le chapitre suivant est ouvert. Reviens battre ce boss quand tu veux." && c.b1 === "Chapitre suivant" && c.b2 === "Réessayer le boss", dit(c));
  $("resultAnalyse").click(); await pause(400);
  T("« Reessayer le boss » relance le boss", ev("mode") === "play" && ev("gameStartFen") === BOSS && ev("cheminPartieActive()") === true && $("resultBanner").classList.contains("hide"));

  console.log("--- La victoire ---");
  await finir("win", "B");
  c = carte();
  T("carte : « Boss battu », « Le chapitre 3 est ouvert. »", c.titre === "Boss battu" && c.sous === "Le chapitre 3 est ouvert.", dit(c));
  T("carte : « Chapitre suivant » en avant, « Retour au chemin », « Masquer »", c.b1 === "Chapitre suivant" && c.enAvant && c.b2 === "Retour au chemin" && c.lien === "Masquer", dit(c));
  T("le boss est marque battu", ev("cheminEtat(1).boss") === true);
  T("plus d'annonce « Boss battu » de 4 s", ev("__annonces.length") === 0, ev("__annonces.join()"));
  $("resultClose").click(); await pause(100);
  T("« Masquer » garde son role : la carte s'efface, on reste sur la partie", $("resultBanner").classList.contains("hide") && ev("mode") === "play");
  w.close();

  console.log("--- Victoire du premier coup : la fenetre Bravo, puis la carte ---");
  await charger("fr", AU_BOSS);
  espionAnnonces();
  await lancer(); await finir("win", "B");
  T("les badges du boss sont fetes par la fenetre Bravo", (!$("bravo").hidden || ev("(bravoFile||[]).length") > 0) && ev("prog.badges.includes('boss_1')") && ev("prog.badges.includes('boss_net')"));
  c = carte();
  T("la carte attend dessous, deja prete : « Chapitre suivant »", c.visible && c.b1 === "Chapitre suivant" && c.b2 === "Retour au chemin", dit(c));
  T("la carte ne s'ouvre pas par-dessus la fenetre Bravo", (() => {
    const b = $("bravo"), r = $("resultBanner");
    if (b.hidden) return true;
    return !b.contains(r) && !r.contains(b) && (b.compareDocumentPosition(r) & w.Node.DOCUMENT_POSITION_PRECEDING) !== 0;
  })());
  T("aucune annonce", ev("__annonces.length") === 0, ev("__annonces.join()"));
  ev("try{bravoFermer();}catch(e){}bravoFile=[]");
  $("resultNew").click(); await pause(600);
  T("« Chapitre suivant » ouvre le chapitre 3 a sa premiere lecon", ev("mode") === "debut" && ev("leconCh") === CHAPITRES[2] && ev("lecon.e") === 0 && ev("lecon.x") === 0);
  w.close();

  console.log("--- Une nulle contre le boss ---");
  await charger("fr", AU_BOSS);
  await lancer(); await finir("draw");
  c = carte();
  T("nulle : le titre de la partie, et ce qu'il faut pour ouvrir la suite", c.titre === "Titre de la partie" && c.sous === "Bats le boss pour ouvrir le chapitre suivant." && c.b1 === "Réessayer le boss" && c.b2 === "Retour au chemin", dit(c));
  T("la nulle ne compte pas comme une defaite", ev("cheminEtat(1).defaites") === 0);
  w.close();

  console.log("--- Boss battu avant la fin des lecons ---");
  await charger("fr", { "chang64:debut": { e: 6, x: 0, f: [0, 1, 2, 3, 4, 5] }, "chang64:chemin": { v: 2, c: { regles: { e: 5, x: 0, f: [0, 1] } }, o: [], p: { x: 1 } } });
  await lancer(); await finir("win", "B");
  c = carte();
  T("la suite reste fermee : « Retour au chemin » en avant, « Analyser » garde", c.titre === "Boss battu" && c.b1 === "Retour au chemin" && c.b2 === "Analyser" && ev("cheminOuvert(2)") === false, dit(c));
  w.close();

  console.log("--- Le dernier boss ---");
  await charger("fr", AU_DERNIER);
  espionAnnonces();
  await lancer(DERNIER); await finir("lose", "W");
  c = carte();
  T("defaite : « Reessayer le boss », « Retour au chemin », le sous-titre de la partie", c.titre === "Le boss a gagné" && c.sous === "Sous-titre de la partie" && c.b1 === "Réessayer le boss" && c.b2 === "Retour au chemin" && c.lien === "Masquer", dit(c));
  $("resultNew").click(); await pause(400);
  T("« Reessayer le boss » relance le dernier boss", ev("mode") === "play" && ev("cheminPartie.ch") === DERNIER && ev("cheminPartieActive()") === true);
  await finir("win", "B");
  c = carte();
  T("victoire : « Boss battu », « C'etait le dernier boss du chemin. »", c.titre === "Boss battu" && c.sous === "C'était le dernier boss du chemin.", dit(c));
  T("« Resoudre des exercices », « Jouer une partie », et « Retour au chemin » en lien", c.b1 === "Résoudre des exercices" && c.enAvant && c.b2 === "Jouer une partie" && c.lien === "Retour au chemin", dit(c));
  T("aucune annonce", ev("__annonces.length") === 0, ev("__annonces.join()"));
  ev("try{bravoFermer();}catch(e){}bravoFile=[]");
  $("resultClose").click(); await pause(300);
  T("le lien « Retour au chemin » ramene a l'onglet Apprendre", ev("mode") === "apprendre");
  $("tab-jouer").click(); await pause(300);
  T("revenir sur la partie finie montre la meme carte", ev("mode") === "play" && carte().b1 === "Résoudre des exercices", dit(carte()));
  $("resultNew").click(); await pause(300);
  T("« Resoudre des exercices » ouvre Resoudre", ev("mode") === "puzzles");
  $("tab-jouer").click(); await pause(300);
  $("resultAnalyse").click(); await pause(300);
  T("« Jouer une partie » ouvre le choix de partie", ev("mode") === "jouer", ev("mode"));
  w.close();

  console.log("--- Une partie ordinaire garde sa carte ---");
  await charger("fr", AU_BOSS);
  await lancer(); await finir("lose", "W");
  T("(fin d'une partie contre le boss)", carte().b1 === "Réessayer le boss");
  $("tab-jouer").click(); await pause(200);
  ev("setupGame()"); await pause(100);
  $("tab-jouer").click(); await pause(200); $("jouerOrdi").click(); await pause(300);
  ev("pendingNoClock=true;newGame()"); await pause(300);
  T("(partie ordinaire contre l'ordinateur)", ev("mode") === "play" && ev("gameStarted") === true, ev("mode"));
  T("une nouvelle partie ordinaire n'est plus une partie du chemin", ev("cheminPartieActive()") === false && ev("bossCarteActive()") === false);
  await finir("win", "B");
  c = carte();
  T("carte habituelle : « Nouvelle partie », « Analyser », « Masquer »", c.visible && c.titre === "Titre de la partie" && c.b1 === "Nouvelle partie" && c.b2 === "Analyser" && c.lien === "Masquer", dit(c));
  $("resultNew").click(); await pause(200);
  T("« Nouvelle partie » ramene aux reglages, comme avant", ev("mode") === "play" && ev("gameStarted") === false);
  w.close();

  console.log("--- Les dix langues ---");
  for (const lg of LANGUES) {
    await charger(lg.code, AU_BOSS);
    const cles = ["Try the boss again", "The boss won", "Three tries against the boss: you can move on, and come back to beat it later.", "That was the last boss of the path.", "Solve puzzles", "Play a game"];
    const manque = lg.code === "en" ? [] : cles.filter(k => ev("t(" + JSON.stringify(k) + ")") === k);
    await lancer(); await finir("lose", "W");
    const a = carte();
    await lancer(); await finir("win", "B");
    const b = carte();
    T(lg.code + " : les phrases sont traduites, les deux cartes remplies", !manque.length && a.b1 && a.b2 && a.titre && a.sous && b.b1 && b.b2 && a.b1 !== b.b1 &&
      b.b1 === net(ev("t('Next chapter')")) && a.b1 === net(ev("t('Try the boss again')")), manque.join(" | ") + " " + dit([a, b]));
    T(lg.code + " : jamais « : ; ! ? » seul en debut de phrase", ![a.titre, a.sous, b.titre, b.sous].some(s => /^[:;!?]/.test(s)));
    w.close();
  }

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
