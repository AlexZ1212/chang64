/* Verification automatique de chang64.
   Lancement : node tests/check_chemin_progression.js
   Le site doit avoir ete construit au prealable : node build_site.js

   La progression dans le chemin d'apprentissage (apprendre.js, 2026-11-22) :
   - « Je debute » est le chapitre 1 SANS RIEN FAIRE PERDRE : une progression
     chang64:debut deja acquise reste acquise, le badge y reste attache,
     #start mene au chapitre 1 ;
   - le bouton de l'accueil suit la progression, puis disparait ;
   - le chapitre suivant s'ouvre quand les lecons sont finies ET le boss battu
     (2026-11-22, decision d'Alexandre) ; apres trois defaites contre le boss,
     il s'ouvre quand meme ; un chapitre deja ouvert chez un joueur le reste ;
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
/* Les chapitres viennent du fichier : le test suit ceux qui sortent. */
const CHAPITRES = require("../chemin/plan.json").chapitres;
const avec = o => ({ fetch: true, avant(w) { for (const k in o) w.localStorage.setItem(k, typeof o[k] === "string" ? o[k] : JSON.stringify(o[k])); } });

(async () => {
  console.log("--- Premiere visite ---");
  let w = await ouvrir("fr", { fetch: true });
  let $ = id => w.document.getElementById(id), ev = s => w.eval(s);
  T("accueil : « Je debute »", net($("heroDebut").textContent) === "Je débute" && !$("heroDebut").classList.contains("hide"), $("heroDebut").textContent);
  T("rien n'est commence, le chapitre 1 est le chapitre a suivre", ev("cheminCourant()") === 0 && ev("cheminCommence()") === false);
  T("le plan pose dans le script : les chapitres du fichier, cinq lecons chacun apres le premier", ev("CHEMIN_PLAN.map(c=>c.id).join()") === CHAPITRES.join() && CHAPITRES.slice(1).every((c, i) => ev("CHEMIN_PLAN[" + (i + 1) + "].n") === 5), ev("CHEMIN_PLAN.map(c=>c.id+':'+c.n).join()"));
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
  T("le chapitre 1 fini ne parle pas de boss : il finit par une premiere partie", /Chapitre terminé$/.test(net(chap[0].querySelector(".ap-sub").textContent)), chap[0].querySelector(".ap-sub").textContent);
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
      T(nom + " : affichee, echiquier du cote des Blancs", ev("lecon.e") === i && ev("lecon.x") === j && ev("flipped") === false, ev("lecon.e") + "." + ev("lecon.x") + " " + ev("flipped"));
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

  console.log("--- La fin du chapitre : le boss, qui ouvre la suite ---");
  T("derniere etape : le boss, sans exercice", !$("leconBoss").classList.contains("hide") && $("debutStatus").classList.contains("hide") && /dame/.test($("debutTitre").textContent), $("debutTitre").textContent);
  T("deux boutons : affronter le boss, ou revenir au chemin", net($("btnLeconBoss").textContent) === "Affronter le boss" && net($("btnLeconSuite").textContent) === "Retour au chemin" && $("leconBossFait").classList.contains("hide"));
  T("c'est dit : battre le boss ouvre le chapitre suivant", !$("leconBossNote").classList.contains("hide") && net($("leconBossNote").textContent) === "Bats le boss pour ouvrir le chapitre suivant.", $("leconBossNote").textContent);
  T("les lecons finies ne suffisent plus : le chapitre 3 attend le boss", ev("cheminEtat(1).fini") === true && ev("cheminEtat(1).boss") === false && ev("cheminPasse(1)") === false && ev("cheminOuvert(2)") === false && ev("cheminBossBarre(1)") === true);
  T("l'echiquier montre la position du boss, du cote des Blancs", ev("game.fen().split(' ')[0]") === "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR" && ev("flipped") === false);
  $("btnDebutFermer").click(); await pause(200);
  T("accueil : « Continuer : chapitre 2 », celui dont le boss attend", net($("heroDebut").textContent) === "Continuer : chapitre 2" && ev("cheminCourant()") === 1, $("heroDebut").textContent);
  $("tab-apprendre").click(); await pause(300);
  chap = [...w.document.querySelectorAll("#apChemin .ap-chap")];
  T("onglet : lecons du chapitre 2 finies, son boss ouvre la suite ; il reste le chapitre en cours", chap[1].classList.contains("fait") && chap[1].classList.contains("encours") && /Leçons finies\. Bats le boss pour ouvrir la suite/.test(net(chap[1].textContent)), net(chap[1].textContent));
  T("la coche du chapitre fait et en cours n'est pas recouverte par son numero", /.ap-chap.fait.encours .ap-num{color:transparent}/.test(w.document.documentElement.innerHTML));
  T("onglet : le chapitre 3 est ferme, et dit pourquoi", chap[2].classList.contains("verrou") && chap[2].getAttribute("aria-disabled") === "true" && /Bats le boss du chapitre 2 pour ouvrir celui-ci/.test(net(chap[2].textContent)), net(chap[2].textContent));
  chap[2].click(); await pause(200);
  T("un chapitre ferme ne s'ouvre pas", ev("mode") === "apprendre");
  T("le chapitre 4, lui, attend encore les lecons du 3", /S'ouvre une fois le chapitre 3 fini/.test(net(chap[3].textContent)), net(chap[3].textContent));

  console.log("--- La partie contre le boss ---");
  const eloAvant = dit(ev("prog.eloOrdi")), vicAvant = ev("(bxEtat().c.vic||0)"), badgesAvant = ev("prog.badges.length");
  chap[1].click(); await pause(400);
  T("un chapitre fini se rouvre sur son boss", ev("lecon.e") === 5 && !$("leconBoss").classList.contains("hide"));
  $("btnLeconBoss").click(); await pause(500);
  T("le boss : partie contre l'ordinateur, Blancs, niveau le plus facile", ev("mode") === "play" && ev("gameStarted") === true && ev("myColor===W") && ev("botLevel") === 1);
  T("le boss : l'echiquier est du cote des Blancs", ev("flipped") === false);
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
  /* Une defaite d'abord, posee comme le fait l'application en fin de partie. */
  const FIN = (issue, abandon) => "(function(){const g=new Game(gameStartFen);for(const u of ['e2e4','e7e5','g1f3','b8c6']){g.makeMove(g.moves().find(x=>g.uci(x)===u));}game=g;gameUci=['e2e4','e7e5','g1f3','b8c6'];" +
    "resigned=" + abandon + ";resultInfo={kind:'" + issue + "',title:'x',sub:'y'};gameSaved=false;resultDismissed=false;renderResult(true);})()";
  ev("window.__annonces=[];(function(){const av=objAnnoncer;objAnnoncer=function(a,b){window.__annonces.push(b);return av.apply(this,arguments);};})()");
  ev(FIN("lose", "W")); await pause(200);
  T("une partie perdue contre le boss est comptee", ev("cheminEtat(1).defaites") === 1 && JSON.parse(w.localStorage.getItem("chang64:chemin")).c.regles.b === 1, w.localStorage.getItem("chang64:chemin"));
  T("une seule defaite n'ouvre rien, et n'annonce rien", ev("cheminOuvert(2)") === false && ev("cheminEtat(1).boss") === false && ev("__annonces.length") === 0, ev("__annonces.join()"));
  $("tab-apprendre").click(); await pause(300);
  w.document.querySelectorAll("#apChemin .ap-chap")[1].click(); await pause(400);
  T("ecran du boss : « Défaites contre ce boss : 1 sur 3 », et la suite promise a la troisieme", /Défaites contre ce boss : 1 sur 3\. À la troisième, le chapitre suivant s'ouvre quand même\./.test(net($("leconBossNote").textContent)) && net($("btnLeconSuite").textContent) === "Retour au chemin", $("leconBossNote").textContent);
  ev("lecon.x=0;debutSauver()");
  T("la suite des lecons ne fait pas oublier la defaite", JSON.parse(w.localStorage.getItem("chang64:chemin")).c.regles.b === 1);
  $("btnLeconBoss").click(); await pause(500);
  /* La victoire, posee comme le fait l'application en fin de partie. */
  ev("(function(){const g=new Game(gameStartFen);for(const u of ['e2e4','e7e5','g1f3','b8c6']){g.makeMove(g.moves().find(x=>g.uci(x)===u));}game=g;gameUci=['e2e4','e7e5','g1f3','b8c6'];" +
    "resigned=B;resultInfo={kind:'win',title:'x',sub:'y'};gameSaved=false;resultDismissed=false;renderResult(true);})()");
  await pause(200);
  T("les deux parties sont gardees dans « Tes parties », marquees entrainement", ev("history.length") === 2 && ev("history[0].ent") === 1 && ev("history[0].r") === "win" && ev("history[1].ent") === 1 && ev("history[1].r") === "loss", ev("JSON.stringify(history.map(p=>[p.r,p.ent]))"));
  T("elle ne compte pas pour l'Elo", dit(ev("prog.eloOrdi")) === eloAvant, dit(ev("prog.eloOrdi")));
  T("ni pour les badges de partie", ev("(bxEtat().c.vic||0)") === vicAvant && !ev("prog.badges.includes('jeu_victoire')") && !ev("prog.badges.includes('jeu_niv1')"), ev("prog.badges.slice(" + badgesAvant + ").join()"));
  T("le boss est marque battu", ev("cheminEtat(1).boss") === true && JSON.parse(w.localStorage.getItem("chang64:chemin")).c.regles.f.includes(5));
  /* 2026-11-23 : la suite se dit sur la carte de fin (check_fin_de_boss.js), plus par une annonce. */
  T("le boss battu ouvre le chapitre 3, et la carte de fin le dit", ev("cheminPasse(1)") === true && ev("cheminOuvert(2)") === true && ev("cheminCourant()") === 2 && ev("__annonces.length") === 0 &&
    net($("resultTitle").textContent) === "Boss battu" && net($("resultNew").textContent) === "Chapitre suivant", ev("__annonces.join()") + " / " + $("resultTitle").textContent);
  T("la progression gardee porte la marque de la nouvelle regle", JSON.parse(w.localStorage.getItem("chang64:chemin")).v === 2);
  T("partie finie : plus de reprise", $("btnReprendre").classList.contains("hide"));
  $("tab-apprendre").click(); await pause(300);
  chap = [...w.document.querySelectorAll("#apChemin .ap-chap")];
  T("onglet : « Chapitre termine, boss battu »", /boss battu/.test(net(chap[1].textContent)), net(chap[1].textContent));
  chap[1].click(); await pause(400);
  T("ecran du boss : la reussite est dite, on peut le rejouer", !$("leconBossFait").classList.contains("hide") && /Boss battu/.test($("leconBossFait").textContent) && net($("btnLeconBoss").textContent) === "Rejouer le boss" && $("debutPas").lastChild.classList.contains("fait"));
  T("boss battu : plus de phrase sur les defaites, « Chapitre suivant » en avant", $("leconBossNote").classList.contains("hide") && net($("btnLeconSuite").textContent) === "Chapitre suivant" && $("btnLeconSuite").classList.contains("primary") && !$("btnLeconBoss").classList.contains("primary"));
  $("btnLeconSuite").click(); await pause(500);
  T("« Chapitre suivant » ouvre le chapitre 3", ev("mode") === "debut" && ev("leconCh") === "securite" && /pièce/.test($("debutTitre").textContent), $("debutTitre").textContent);

  console.log("--- Apres une partie avec les Noirs, les lecons reviennent a l'endroit ---");
  ev("flipped=true;mainFlipped=true");
  for (const [id, n] of CHAPITRES.map(c => [c, c === "debut" ? 6 : 5])) {
    ev("cheminActiver('" + id + "');setMode('apprendre');setMode('debut')"); await pause(200);
    let envers = [];
    for (let e = 0; e <= n; e++) { ev("flipped=true;lecon.e=" + e + ";lecon.x=0;debutCharger()"); if (ev("flipped") !== false) envers.push(e + 1); }
    T("chapitre " + id + " : chaque etape, boss compris, remet l'echiquier du cote des Blancs", envers.length === 0, envers.join());
  }

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
  /* Toutes les lecons, tous les boss sauf le dernier : il n'ouvre rien, il ne retient donc personne. */
  ev(CHAPITRES.slice(1).map((c, k, l) => "chemin.c." + c + "={e:5,x:0,f:[0,1,2,3,4" + (k < l.length - 1 ? ",5" : "") + "]};").join("") + "cheminEcrire()");
  $("brand").click(); await pause(200);
  T("chemin fini : plus de bouton", $("heroDebut").classList.contains("hide") && ev("cheminCourant()") === -1);
  T("le boss du dernier chapitre ne barre rien", ev("cheminEtat(CHEMIN_PLAN.length-1).boss") === false && ev("cheminBossBarre(CHEMIN_PLAN.length-1)") === false);
  T("« Exercice du jour » reste", !$("heroPuzzle").classList.contains("hide"));
  w.close();

  console.log("--- Rechargement : tout est retrouve ---");
  w = await ouvrir("fr", avec({ "chang64:debut": { e: 6, x: 0, f: [0, 1, 2, 3, 4, 5] }, "chang64:chemin": { v: 1, c: { regles: { e: 2, x: 1, f: [0, 1] } }, o: [], p: null } }));
  $ = id => w.document.getElementById(id); ev = s => w.eval(s);
  T("accueil : « Continuer : chapitre 2 »", net($("heroDebut").textContent) === "Continuer : chapitre 2");
  $("heroDebut").click(); await pause(600);
  T("on reprend a la lecon et a l'exercice gardes", ev("leconCh") === "regles" && ev("lecon.e") === 2 && ev("lecon.x") === 1 && [...$("debutPas").children].map(b => b.classList.contains("fait") ? 1 : 0).join("") === "110000");
  T("une progression abimee ne casse rien", (() => { ev("chemin=cheminNormaliser({c:{regles:{e:99,x:-3,f:['a',2,2,77]},inconnu:{f:[1]}},o:['regles','zzz'],p:7})"); return dit(ev("chemin")) === dit({ v: 2, c: { regles: { e: 0, x: 0, f: [2] } }, o: ["regles"], p: null }); })(), dit(ev("chemin")));
  T("un nombre de defaites abime est borne ou ecarte", ev("cheminNormaliser({v:2,c:{regles:{f:[],b:99},securite:{f:[],b:-2},mats:{f:[],b:'x'}}}).c.regles.b") === 3 && ev("'b' in cheminNormaliser({v:2,c:{securite:{f:[],b:-2}}}).c.securite") === false && ev("'b' in cheminNormaliser({v:2,c:{mats:{f:[],b:'x'}}}).c.mats") === false);
  w.close();

  console.log("--- Trois defaites contre le boss ouvrent la suite quand meme ---");
  w = await ouvrir("fr", avec({ "chang64:debut": { e: 6, x: 0, f: [0, 1, 2, 3, 4, 5] }, "chang64:chemin": { v: 2, c: { regles: { e: 5, x: 0, f: [0, 1, 2, 3, 4] } }, o: [], p: { x: 1 } } }));
  $ = id => w.document.getElementById(id); ev = s => w.eval(s);
  ev("window.__annonces=[];(function(){const av=objAnnoncer;objAnnoncer=function(a,b,c){window.__annonces.push(b+' / '+c);return av.apply(this,arguments);};})()");
  const BOSS = "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const perdre = async () => {
    ev("cheminLancerPartie('regles'," + JSON.stringify(BOSS) + ",1)"); await pause(400);
    ev("(function(){const g=new Game(gameStartFen);for(const u of ['e2e4','e7e5','g1f3','b8c6']){g.makeMove(g.moves().find(x=>g.uci(x)===u));}game=g;gameUci=['e2e4','e7e5','g1f3','b8c6'];" +
      "resigned=W;resultInfo={kind:'lose',title:'x',sub:'y'};gameSaved=false;resultDismissed=false;renderResult(true);})()");
    await pause(200);
  };
  T("au depart : chapitre 3 ferme", ev("cheminOuvert(2)") === false && ev("cheminCourant()") === 1);
  await perdre(); await perdre();
  T("deux defaites : toujours ferme, rien n'est annonce", ev("cheminEtat(1).defaites") === 2 && ev("cheminOuvert(2)") === false && ev("__annonces.length") === 0, ev("__annonces.join()"));
  await perdre();
  T("troisieme defaite : le chapitre 3 s'ouvre", ev("cheminEtat(1).defaites") === 3 && ev("cheminPasse(1)") === true && ev("cheminOuvert(2)") === true && ev("cheminCourant()") === 2);
  T("c'est dit sur la carte de fin, sans reproche (plus d'annonce)", ev("__annonces.length") === 0 && net($("resultTitle").textContent) === "Le chapitre 3 est ouvert" &&
    net($("resultSub").textContent) === "Trois essais contre le boss : tu peux continuer, et revenir le battre plus tard.", ev("__annonces.join()") + " / " + $("resultSub").textContent);
  T("le boss n'est pas marque battu pour autant", ev("cheminEtat(1).boss") === false);
  await perdre();
  T("une quatrieme defaite ne change plus rien", ev("cheminEtat(1).defaites") === 3 && ev("__annonces.length") === 0 &&JSON.parse(w.localStorage.getItem("chang64:chemin")).c.regles.b === 3);
  ev("setupGame()");
  $("tab-apprendre").click(); await pause(300);
  chap = [...w.document.querySelectorAll("#apChemin .ap-chap")];
  T("onglet : le boss du chapitre 2 attend toujours, le chapitre 3 est en cours", /Chapitre terminé\. Le boss t'attend/.test(net(chap[1].textContent)) && chap[2].classList.contains("encours") && !chap[2].classList.contains("verrou"), net(chap[1].textContent));
  chap[1].click(); await pause(400);
  T("ecran du boss : la suite est ouverte, on peut revenir le battre", /Le chapitre suivant est ouvert\. Reviens battre ce boss quand tu veux\./.test(net($("leconBossNote").textContent)) && net($("btnLeconSuite").textContent) === "Chapitre suivant" && $("btnLeconSuite").classList.contains("primary") && !$("btnLeconBoss").classList.contains("primary"), $("leconBossNote").textContent);
  T("une nulle contre le boss ne compte ni comme victoire ni comme defaite", (() => {
    ev("chemin.c.regles.b=1;cheminLancerPartie('regles'," + JSON.stringify(BOSS) + ",1)");
    ev("(function(){const g=new Game(gameStartFen);for(const u of ['e2e4','e7e5','g1f3','b8c6']){g.makeMove(g.moves().find(x=>g.uci(x)===u));}game=g;gameUci=['e2e4','e7e5','g1f3','b8c6'];" +
      "resultInfo={kind:'draw',title:'x',sub:'y'};gameSaved=false;resultDismissed=false;renderResult(true);})()");
    return ev("cheminEtat(1).defaites") === 1 && ev("cheminEtat(1).boss") === false;
  })());
  ev("setupGame()");
  w.close();

  console.log("--- Un chapitre deja ouvert sous l'ancienne regle le reste ---");
  w = await ouvrir("fr", avec({ "chang64:debut": { e: 6, x: 0, f: [0, 1, 2, 3, 4, 5] }, "chang64:chemin": { v: 1, c: { regles: { e: 5, x: 0, f: [0, 1, 2, 3, 4] }, securite: { e: 2, x: 0, f: [0, 1] } }, o: [], p: null } }));
  $ = id => w.document.getElementById(id); ev = s => w.eval(s);
  T("progression d'avant : le chapitre 3, ouvert par les seules lecons du 2, reste ouvert", ev("cheminEtat(1).boss") === false && ev("cheminOuvert(2)") === true && ev("chemin.o.includes('securite')") && ev("chemin.v") === 2, dit(ev("chemin")));
  T("accueil : « Continuer : chapitre 3 »", net($("heroDebut").textContent) === "Continuer : chapitre 3", $("heroDebut").textContent);
  ev("chemin.c.securite={e:5,x:0,f:[0,1,2,3,4]};cheminEcrire()");
  T("le chapitre 4, qui n'etait pas ouvert, suit la nouvelle regle", ev("cheminOuvert(3)") === false && ev("cheminCourant()") === 2);
  T("une fois ecrite, la progression garde ce chapitre ouvert pour de bon", (() => { const g = JSON.parse(w.localStorage.getItem("chang64:chemin")); return g.v === 2 && g.o.includes("securite") && !g.o.includes("mats"); })(), w.localStorage.getItem("chang64:chemin"));
  T("cheminHerite ne dit rien d'une progression deja a la nouvelle regle", ev("cheminHerite({v:2,c:{regles:{f:[0,1,2,3,4]}}}).length") === 0 && ev("cheminHerite({v:1,c:{regles:{f:[0,1,2,3,4]}}}).join()") === "securite" && ev("cheminHerite({c:{regles:{f:[0,1,2,3]}}}).length") === 0 && ev("cheminHerite(null).length") === 0);

  console.log("--- Le compte fusionne deux appareils ---");
  const f = ev("JSON.parse(JSON.stringify(cpFusion(" +
    "{t:{chemin:200},chemin:{v:1,c:{regles:{e:3,x:0,f:[0,1,2]}},o:['debut'],p:{x:1}}}," +
    "{t:{chemin:100},chemin:{v:1,c:{regles:{e:1,x:1,f:[0,4]},securite:{e:1,x:0,f:[0]}},o:['regles'],p:{t:50,n:6,e:'securite'}}},null)))");
  T("les lecons reussies s'additionnent", dit(f.chemin.c.regles.f) === "[0,1,2,4]" && dit(f.chemin.c.securite.f) === "[0]", dit(f.chemin));
  T("l'endroit ou l'on est suit l'appareil le plus recent", f.chemin.c.regles.e === 3 && f.chemin.c.regles.x === 0);
  T("les chapitres ouverts par le test s'additionnent", f.chemin.o.slice().sort().join() === "debut,regles");
  T("un test passe l'emporte sur un test ecarte", f.chemin.p && f.chemin.p.t === 50 && f.chemin.p.e === "securite");
  T("le chemin fait partie de ce que le compte garde", ev("CP_STOCK['chang64:chemin']") === "chemin" && ev("CP_NOMS.includes('chemin')"));
  T("la fusion porte la marque de la nouvelle regle", f.chemin.v === 2);
  const g = ev("JSON.parse(JSON.stringify(cpFusion(" +
    "{t:{chemin:200},chemin:{v:2,c:{regles:{e:5,x:0,f:[0,1,2,3,4],b:1},securite:{e:5,x:0,f:[0,1,2,3,4],b:2}},o:[],p:null}}," +
    "{t:{chemin:100},chemin:{v:1,c:{regles:{e:5,x:0,f:[0,1,2,3,4]},securite:{e:1,x:0,f:[0],b:3}},o:[],p:null}},null)))");
  T("les defaites contre un boss : le plus grand des deux nombres", g.chemin.c.regles.b === 1 && g.chemin.c.securite.b === 3, dit(g.chemin));
  T("l'appareil reste a l'ancienne regle garde ouvert le chapitre qu'il avait ouvert", g.chemin.o.join() === "securite" && g.chemin.v === 2, dit(g.chemin.o));
  const h = ev("JSON.parse(JSON.stringify(cpFusion(" +
    "{t:{chemin:200},chemin:{v:2,c:{regles:{e:5,x:0,f:[0,1,2,3,4]}},o:[],p:null}}," +
    "{t:{chemin:100},chemin:{v:2,c:{regles:{e:2,x:0,f:[0,1]}},o:[],p:null}},null)))");
  T("deux appareils a la nouvelle regle : rien ne s'ouvre sans le boss, pas de champ en trop", h.chemin.o.length === 0 && !("b" in h.chemin.c.regles), dit(h.chemin));
  ev("cheminAdopter({v:1,c:{regles:{e:5,x:0,f:[0,1,2,3,4]}},o:[],p:null})");
  T("une progression venue du compte est adoptee sans recharger", ev("cheminEtat(1).fini") === true && ev("cheminCourant()") === 2);
  ev("cheminAdopter({v:2,c:{regles:{e:5,x:0,f:[0,1,2,3,4]}},o:[],p:null})");
  T("venue du compte a la nouvelle regle : le boss du chapitre 2 retient la suite", ev("cheminOuvert(2)") === false && ev("cheminCourant()") === 1 && net($("heroDebut").textContent) === "Continuer : chapitre 2", $("heroDebut").textContent);
  w.close();

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
