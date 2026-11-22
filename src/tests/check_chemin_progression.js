/* Verification automatique de chang64.
   Lancement : node tests/check_chemin_progression.js
   Le site doit avoir ete construit au prealable : node build_site.js

   La progression dans le chemin d'apprentissage (apprendre.js, 2026-11-22) :
   - « Je debute » est le chapitre 1 SANS RIEN FAIRE PERDRE : une progression
     chang64:debut deja acquise reste acquise, le badge y reste attache,
     #start mene au chapitre 1 ;
   - le bouton de l'accueil suit la progression, puis disparait ;
   - finir les lecons d'un chapitre ouvre le suivant, le boss est facultatif ;
   - un chapitre du chemin se joue de bout en bout (chaque solution passee par
     l'interface), y compris le coup prealable de la prise en passant, la
     promotion et le pat ;
   - le boss : partie a handicap, sans pendule, qui ne compte ni pour l'Elo ni
     pour les badges de partie ; « Reprendre un coup » n'existe que dans les
     parties du chemin ;
   - la progression est gardee dans le navigateur et fusionnee par le compte. */
const { ouvrir } = require("./outils/page_langue.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));
const net = s => String(s).replace(/[  ]/g, " ");
const dit = x => JSON.stringify(x);
const avec = o => ({ fetch: true, avant(w) { for (const k in o) w.localStorage.setItem(k, typeof o[k] === "string" ? o[k] : JSON.stringify(o[k])); } });

(async () => {
  console.log("--- Premiere visite ---");
  let w = await ouvrir("fr", { fetch: true });
  let $ = id => w.document.getElementById(id), ev = s => w.eval(s);
  T("accueil : « Je debute »", net($("heroDebut").textContent) === "Je débute" && !$("heroDebut").classList.contains("hide"), $("heroDebut").textContent);
  T("rien n'est commence, le chapitre 1 est le chapitre a suivre", ev("cheminCourant()") === 0 && ev("cheminCommence()") === false);
  T("le plan pose dans le script : trois chapitres", ev("CHEMIN_PLAN.map(c=>c.id).join()") === "debut,regles,securite" && ev("CHEMIN_PLAN[1].n") === 5 && ev("CHEMIN_PLAN[2].n") === 5);
  w.close();

  console.log("--- Une ancienne progression « Je debute » est gardee ---");
  w = await ouvrir("fr", avec({ "chang64:debut": { e: 3, x: 1, f: [0, 1, 2] } }));
  $ = id => w.document.getElementById(id); ev = s => w.eval(s);
  T("accueil : « Continuer : chapitre 1 »", net($("heroDebut").textContent) === "Continuer : chapitre 1", $("heroDebut").textContent);
  T("les etapes deja reussies sont la avant meme d'ouvrir le parcours", dit(ev("debut.faites")) === "[0,1,2]" && ev("debut.e") === 3 && ev("debut.x") === 1);
  $("tab-apprendre").click(); await pause(500);
  let chap = [...w.document.querySelectorAll("#apChemin .ap-chap")];
  T("onglet : chapitre 1 en cours, a l'etape 4 sur 7, avec sa barre", chap[0].classList.contains("encours") && /Étape 4 sur 7/.test(net(chap[0].textContent)) && !!chap[0].querySelector(".ap-barre i") && chap[0].querySelector(".ap-barre i").style.width === "50%", net(chap[0].textContent));
  T("le chapitre 2 reste verrouille tant que le 1 n'est pas fini", chap[1].classList.contains("verrou"));
  chap[0].click(); await pause(400);
  T("on reprend ou l'on s'etait arrete", ev("mode") === "debut" && ev("lecon.e") === 3 && ev("lecon.x") === 1 && /tape 4 sur 7, exercice 2 sur 3/.test(net($("debutEtape").textContent)), $("debutEtape").textContent);
  T("les pastilles gardent les etapes reussies", [...$("debutPas").children].map(b => b.classList.contains("fait") ? 1 : 0).join("") === "1110000");
  T("la cle de stockage n'a pas change de forme", dit(JSON.parse(w.localStorage.getItem("chang64:debut"))) === dit({ e: 3, x: 1, f: [0, 1, 2] }), w.localStorage.getItem("chang64:debut"));
  w.close();

  console.log("--- Parcours deja termine : le badge et la suite ---");
  w = await ouvrir("fr", avec({ "chang64:debut": { e: 6, x: 0, f: [0, 1, 2, 3, 4, 5] } }));
  $ = id => w.document.getElementById(id); ev = s => w.eval(s);
  T("accueil : « Continuer : chapitre 2 »", net($("heroDebut").textContent) === "Continuer : chapitre 2", $("heroDebut").textContent);
  T("le parcours debutant compte comme termine", ev("debutFini()") === true && ev("cheminEtat(0).fini") === true);
  $("tab-apprendre").click(); await pause(500);
  chap = [...w.document.querySelectorAll("#apChemin .ap-chap")];
  T("onglet : chapitre 1 fait, chapitre 2 ouvert et en cours, chapitre 3 verrouille", chap[0].classList.contains("fait") && chap[1].classList.contains("encours") && !chap[1].classList.contains("verrou") && chap[2].classList.contains("verrou"));
  chap[0].click(); await pause(500);
  T("rouvrir le chapitre 1 attribue le badge « Parcours debutant termine »", ev("prog.badges.includes('debut_fini')") === true);
  T("#start mene toujours au chapitre 1", (() => { ev("cheminActiver('regles')"); ev("applyDeepLink({kind:'start'})"); return ev("mode") === "debut" && ev("leconCh") === "debut" && ev("lecon===debut"); })());
  $("btnDebutFermer").click(); await pause(200);

  console.log("--- Le chapitre 2, de bout en bout ---");
  $("heroDebut").click(); await pause(600);
  T("le bouton de l'accueil ouvre le chapitre a suivre", ev("mode") === "debut" && ev("leconCh") === "regles" && ev("lecon!==debut"));
  T("six pastilles : cinq lecons et le boss, qui porte une dame", $("debutPas").children.length === 6 && $("debutPas").lastChild.classList.contains("boss") && !!$("debutPas").lastChild.querySelector("svg") && /boss/.test($("debutPas").lastChild.getAttribute("aria-label")));
  T("etape et exercice annonces", /tape 1 sur 6, exercice 1 sur 3/.test(net($("debutEtape").textContent)), $("debutEtape").textContent);
  T("la premiere lecon met le roi en echec", ev("game.inCheck()") === true && /échec/.test($("debutStatus").textContent));
  T("les boutons de fin de « Je debute » restent caches ici", $("debutFin").classList.contains("hide") && $("leconBoss").classList.contains("hide"));
  const E = ev("JSON.parse(JSON.stringify(leconEtapes()))");
  T("le contenu vient du fichier du chapitre", E.length === 6 && E[5].boss && E[5].exos.length === 0 && E.slice(0, 5).every(e => e.exos.length >= 2));
  const jouer = async u => { w.__u = u; ev("(function(){const ex=leconEtapes()[lecon.e].exos[lecon.x];const m=legalCache.find(x=>game.uci(x)===window.__u);if(m)debutEssai(m,ex);})()"); await pause(30); };
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < E[i].exos.length; j++) {
      const ex = E[i].exos[j], nom = "lecon " + (i + 1) + "." + (j + 1);
      T(nom + " : affichee", ev("lecon.e") === i && ev("lecon.x") === j, ev("lecon.e") + "." + ev("lecon.x"));
      if (ex.avant) {
        T(nom + " : la main n'est pas au joueur avant le coup des Noirs", ev("lecon.occupe") === true && ev("legalCache.length") === 0);
        await pause(800);
        T(nom + " : le pion noir a avance de deux cases", ev("game.history.length") === 1 && ev("lecon.occupe") === false && ev("legalCache.length") > 0);
      }
      /* Un coup faux d'abord, quand l'exercice en decrit un. */
      const faux = Object.keys(ex.faux || {}).find(u => u !== "*");
      if (faux) {
        await jouer(faux);
        T(nom + " : le coup faux est refuse avec sa raison", ev("lecon.ok") === false && net($("debutStatus").textContent) === net(ex.faux[faux]) && $("debutStatus").classList.contains("lose"), $("debutStatus").textContent);
        T(nom + " : la position ne change pas", ev("game.history.length") === (ex.avant ? 1 : 0));
      }
      await jouer(ex.sol[0]);
      await pause((ex.suite ? ex.suite.length * 800 : 0) + 60);
      T(nom + " : la solution est acceptee", ev("lecon.ok") === true && $("debutStatus").classList.contains("win"), $("debutStatus").textContent);
      if (ex.apres) T(nom + " : l'explication s'affiche", net($("debutStatus").textContent) === net(ex.apres), $("debutStatus").textContent);
      if (ex.suite) T(nom + " : la suite est jouee", ev("game.history.length") === 1 + ex.suite.length);
      T(nom + " : bouton suivant", !$("btnDebutSuite").classList.contains("hide") && $("btnDebutIndice").classList.contains("hide"));
      $("btnDebutSuite").click(); await pause(60);
    }
    T("lecon " + (i + 1) + " : marquee reussie", ev("lecon.faites.includes(" + i + ")"));
  }
  T("la promotion passe par le choix de piece de l'application", (() => {
    ev("lecon.e=2;lecon.x=0;debutCharger()");
    ev("handleDebutClick(debutCase('e7'));handleDebutClick(debutCase('e8'))");
    const n = $("promoBtns").children.length, attente = ev("pendingPromo");
    if (n) $("promoBtns").firstChild.click();
    return n === 4 && attente === true && ev("lecon.ok") === true;
  })());
  T("l'indice montre la piece et la case", (() => { ev("lecon.e=1;lecon.x=0;debutCharger()"); $("btnDebutIndice").click(); return ev("selected===debutCase('e1')") && ev("marks[debutCase('g1')]") === "hint"; })());
  ev("lecon.e=5;lecon.x=0;debutSauver();debutCharger()");
  let gardee = JSON.parse(w.localStorage.getItem("chang64:chemin"));
  T("la progression est gardee dans le navigateur", dit(gardee.c.regles.f) === "[0,1,2,3,4]" && gardee.c.regles.e === 5, w.localStorage.getItem("chang64:chemin"));
  T("« Je debute » n'a pas ete touche", dit(JSON.parse(w.localStorage.getItem("chang64:debut")).f) === "[0,1,2,3,4,5]");
  T("aucun badge d'etape de « Je debute » gagne par un autre chapitre", ev("debut.faites.length") === 6);

  console.log("--- La fin du chapitre : le boss, facultatif ---");
  T("derniere etape : le boss, sans exercice", !$("leconBoss").classList.contains("hide") && $("debutStatus").classList.contains("hide") && /dame/.test($("debutTitre").textContent), $("debutTitre").textContent);
  T("deux boutons : affronter le boss, ou le chapitre suivant", net($("btnLeconBoss").textContent) === "Affronter le boss" && net($("btnLeconSuite").textContent) === "Chapitre suivant" && $("leconBossFait").classList.contains("hide"));
  T("les lecons finies ouvrent le chapitre 3, boss ou non", ev("cheminEtat(1).fini") === true && ev("cheminEtat(1).boss") === false && ev("cheminOuvert(2)") === true);
  T("l'echiquier montre la position du boss", ev("game.fen().split(' ')[0]") === "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
  $("btnDebutFermer").click(); await pause(200);
  T("accueil : « Continuer : chapitre 3 »", net($("heroDebut").textContent) === "Continuer : chapitre 3", $("heroDebut").textContent);
  $("tab-apprendre").click(); await pause(300);
  chap = [...w.document.querySelectorAll("#apChemin .ap-chap")];
  T("onglet : chapitre 2 termine, son boss attend ; chapitre 3 en cours", chap[1].classList.contains("fait") && /boss t'attend/.test(net(chap[1].textContent)) && chap[2].classList.contains("encours") && !chap[2].classList.contains("verrou"), net(chap[1].textContent));

  console.log("--- La partie contre le boss ---");
  const eloAvant = dit(ev("prog.eloOrdi")), vicAvant = ev("(bxEtat().c.vic||0)"), badgesAvant = ev("prog.badges.length");
  chap[1].click(); await pause(400);
  T("un chapitre fini se rouvre sur son boss", ev("lecon.e") === 5 && !$("leconBoss").classList.contains("hide"));
  $("btnLeconBoss").click(); await pause(500);
  T("le boss : partie contre l'ordinateur, Blancs, niveau le plus facile", ev("mode") === "play" && ev("gameStarted") === true && ev("myColor===W") && ev("botLevel") === 1);
  T("il manque la dame noire", ev("gameStartFen") === "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" && ev("game.board[debutCase('d8')]") === 0);
  T("sans pendule", ev("clock.enabled") === false);
  T("c'est un entrainement, et c'est dit", ev("partieEntrainement()") === true && !$("entrainementNote").classList.contains("hide") && /ni pour ton Elo ni pour tes badges/.test(net($("entrainementNote").textContent)));
  T("« Reprendre le coup » est la, inactif tant que rien n'est joue", !$("btnReprendre").classList.contains("hide") && $("btnReprendre").disabled === true);
  /* Un coup du joueur, la reponse de l'ordinateur, puis la reprise. */
  ev("(function(){const m=legalCache.find(x=>game.uci(x)==='e2e4');playUser(m);})()");
  T("pendant que l'ordinateur reflechit, pas de reprise", $("btnReprendre").disabled === true);
  for (let i = 0; i < 60 && ev("game.history.length") < 2; i++) await pause(150);
  T("l'ordinateur a repondu", ev("game.history.length") === 2 && ev("game.turn===myColor"));
  T("la reprise devient possible", $("btnReprendre").disabled === false);
  $("btnReprendre").click(); await pause(100);
  T("les deux coups sont repris", ev("game.history.length") === 0 && ev("gameUci.length") === 0 && ev("sanList.length") === 0);
  T("la reprise est notee sur la partie", JSON.parse(w.localStorage.getItem("chang64:cheminPartie")).r === 1);
  /* La victoire, posee comme le fait l'application en fin de partie. */
  ev("(function(){const g=new Game(gameStartFen);for(const u of ['e2e4','e7e5','g1f3','b8c6']){g.makeMove(g.moves().find(x=>g.uci(x)===u));}game=g;gameUci=['e2e4','e7e5','g1f3','b8c6'];" +
    "resigned=B;resultInfo={kind:'win',title:'x',sub:'y'};gameSaved=false;resultDismissed=false;renderResult(true);})()");
  await pause(200);
  T("la partie est gardee dans « Tes parties », marquee entrainement", ev("history.length") === 1 && ev("history[0].ent") === 1 && ev("history[0].r") === "win");
  T("elle ne compte pas pour l'Elo", dit(ev("prog.eloOrdi")) === eloAvant, dit(ev("prog.eloOrdi")));
  T("ni pour les badges de partie", ev("(bxEtat().c.vic||0)") === vicAvant && !ev("prog.badges.includes('jeu_victoire')") && !ev("prog.badges.includes('jeu_niv1')"), ev("prog.badges.slice(" + badgesAvant + ").join()"));
  T("le boss est marque battu", ev("cheminEtat(1).boss") === true && JSON.parse(w.localStorage.getItem("chang64:chemin")).c.regles.f.includes(5));
  T("partie finie : plus de reprise", $("btnReprendre").classList.contains("hide"));
  $("tab-apprendre").click(); await pause(300);
  chap = [...w.document.querySelectorAll("#apChemin .ap-chap")];
  T("onglet : « Chapitre termine, boss battu »", /boss battu/.test(net(chap[1].textContent)), net(chap[1].textContent));
  chap[1].click(); await pause(400);
  T("ecran du boss : la reussite est dite, on peut le rejouer", !$("leconBossFait").classList.contains("hide") && /Boss battu/.test($("leconBossFait").textContent) && net($("btnLeconBoss").textContent) === "Rejouer le boss" && $("debutPas").lastChild.classList.contains("fait"));
  $("btnLeconSuite").click(); await pause(500);
  T("« Chapitre suivant » ouvre le chapitre 3", ev("mode") === "debut" && ev("leconCh") === "securite" && /pièce/.test($("debutTitre").textContent), $("debutTitre").textContent);

  console.log("--- Une partie ordinaire n'a pas de reprise ---");
  $("tab-jouer").click(); await pause(200); $("jouerOrdi").click(); await pause(300);
  ev("pendingNoClock=true;newGame()"); await pause(200);
  T("partie lancee hors du chemin : ni reprise, ni mention d'entrainement", ev("gameStarted") === true && $("btnReprendre").classList.contains("hide") && $("entrainementNote").classList.contains("hide") && ev("partieEntrainement()") === false);
  T("la partie du chemin est oubliee", w.localStorage.getItem("chang64:cheminPartie") === null);
  ev("setupGame()");

  console.log("--- La premiere partie de « Je debute » ---");
  ev("cheminActiver('debut');debut.e=6;debut.x=0;setMode('debut')"); await pause(300);
  $("btnDebutPartie").click(); await pause(500);
  T("c'est une partie du chemin : la reprise y est offerte", ev("mode") === "play" && !$("btnReprendre").classList.contains("hide"));
  T("sans reprise, elle compte comme avant", ev("partieEntrainement()") === false && $("entrainementNote").classList.contains("hide") && ev("gameStartFen") === null);
  ev("(function(){const m=legalCache.find(x=>game.uci(x)==='e2e4');playUser(m);})()");
  for (let i = 0; i < 60 && ev("game.history.length") < 2; i++) await pause(150);
  $("btnReprendre").click(); await pause(100);
  T("des qu'un coup est repris, elle devient un entrainement", ev("partieEntrainement()") === true && !$("entrainementNote").classList.contains("hide"));
  ev("setupGame()");

  console.log("--- Tout est fini : le bouton de l'accueil s'efface ---");
  ev("chemin.c.securite={e:5,x:0,f:[0,1,2,3,4]};cheminEcrire()");
  $("brand").click(); await pause(200);
  T("chemin fini : plus de bouton", $("heroDebut").classList.contains("hide") && ev("cheminCourant()") === -1);
  T("« Exercice du jour » reste", !$("heroPuzzle").classList.contains("hide"));
  w.close();

  console.log("--- Rechargement : tout est retrouve ---");
  w = await ouvrir("fr", avec({ "chang64:debut": { e: 6, x: 0, f: [0, 1, 2, 3, 4, 5] }, "chang64:chemin": { v: 1, c: { regles: { e: 2, x: 1, f: [0, 1] } }, o: [], p: null } }));
  $ = id => w.document.getElementById(id); ev = s => w.eval(s);
  T("accueil : « Continuer : chapitre 2 »", net($("heroDebut").textContent) === "Continuer : chapitre 2");
  $("heroDebut").click(); await pause(600);
  T("on reprend a la lecon et a l'exercice gardes", ev("leconCh") === "regles" && ev("lecon.e") === 2 && ev("lecon.x") === 1 && [...$("debutPas").children].map(b => b.classList.contains("fait") ? 1 : 0).join("") === "110000");
  T("une progression abimee ne casse rien", (() => { ev("chemin=cheminNormaliser({c:{regles:{e:99,x:-3,f:['a',2,2,77]},inconnu:{f:[1]}},o:['regles','zzz'],p:7})"); return dit(ev("chemin")) === dit({ v: 1, c: { regles: { e: 0, x: 0, f: [2] } }, o: ["regles"], p: null }); })(), dit(ev("chemin")));

  console.log("--- Le compte fusionne deux appareils ---");
  const f = ev("JSON.parse(JSON.stringify(cpFusion(" +
    "{t:{chemin:200},chemin:{v:1,c:{regles:{e:3,x:0,f:[0,1,2]}},o:['debut'],p:{x:1}}}," +
    "{t:{chemin:100},chemin:{v:1,c:{regles:{e:1,x:1,f:[0,4]},securite:{e:1,x:0,f:[0]}},o:['regles'],p:{t:50,n:6,e:'securite'}}},null)))");
  T("les lecons reussies s'additionnent", dit(f.chemin.c.regles.f) === "[0,1,2,4]" && dit(f.chemin.c.securite.f) === "[0]", dit(f.chemin));
  T("l'endroit ou l'on est suit l'appareil le plus recent", f.chemin.c.regles.e === 3 && f.chemin.c.regles.x === 0);
  T("les chapitres ouverts par le test s'additionnent", f.chemin.o.slice().sort().join() === "debut,regles");
  T("un test passe l'emporte sur un test ecarte", f.chemin.p && f.chemin.p.t === 50 && f.chemin.p.e === "securite");
  T("le chemin fait partie de ce que le compte garde", ev("CP_STOCK['chang64:chemin']") === "chemin" && ev("CP_NOMS.includes('chemin')"));
  ev("cheminAdopter({v:1,c:{regles:{e:5,x:0,f:[0,1,2,3,4]}},o:[],p:null})");
  T("une progression venue du compte est adoptee sans recharger", ev("cheminEtat(1).fini") === true && ev("cheminCourant()") === 2);
  w.close();

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
