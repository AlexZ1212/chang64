/* Verification automatique de chang64.
   Lancement : node tests/check_badges_apprendre.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Badges du chemin de l'onglet Apprendre (2026-11-23, liste, conditions et
   medailles validees par Alexandre) : un badge par chapitre dont les lecons
   sont finies (chapitres 2 a 9), trois pour les boss, un pour le chemin
   entier, deux pour le test de placement.
   - le catalogue : 14 badges, une famille d'un seul tenant, chacun avec sa
     medaille (sans transparence) et ses trois textes dans les 10 langues ; la
     condition d'un chapitre cite son titre tel que le chemin l'ecrit ;
   - les conditions, une par une, lues dans la progression ;
   - le moment : la fenetre Bravo ne s'ouvre qu'a la fin d'une lecon, d'une
     partie contre un boss ou du test de placement, jamais pendant ;
   - le test de placement ne donne aucun badge de chapitre ;
   - une partie contre un boss ne donne toujours aucun badge de partie ;
   - le rattrapage : ce qui etait merite avant ce lot, ou sur un autre
     appareil, entre dans la collection sans fenetre, avec une seule annonce ;
   - le compte : la fusion garde les faits acquis et le resultat du test ;
   - le compteur de badges suit le nouveau total. */
const path = require("path"), fs = require("fs");
const { ouvrir, SITE } = require("./outils/page_langue.js");
const { CODES } = require("../langues/registre.js");
const CATALOGUE = require("../badges-catalogue.js");
const PLAN = require("../chemin/plan.json").chapitres;
const CH = Object.fromEntries(PLAN.map(id => [id, require("../chemin/" + id + ".json")]));
const POSITIONS = require("../chemin/placement.json").positions.length;
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));
const net = s => String(s).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
const dit = x => JSON.stringify(x);

const CHAPITRES = PLAN.slice(1), BOSS = CHAPITRES.filter(id => CH[id].boss);
const DE_CHAPITRE = CHAPITRES.map(id => "ch_" + id);
const AUTRES = ["boss_1", "boss_net", "boss_tous", "chemin_fini", "test_fait", "test_parfait"];
const NOUVEAUX = DE_CHAPITRE.concat(AUTRES);
const avec = o => ({ fetch: true, avant(w) { for (const k in o) w.localStorage.setItem(k, typeof o[k] === "string" ? o[k] : JSON.stringify(o[k])); } });
/* Progressions toutes faites. Un chapitre fini : ses lecons 0 a n-1 ; son boss battu : l'indice n en plus. */
const DEBUT_FINI = { e: 6, x: 0, f: [0, 1, 2, 3, 4, 5] };
/* La progression d'un joueur qui a fini « Je debute » et deja joue aujourd'hui : ses badges d'avant sont
   dans sa collection, et la journee est comptee (sinon le badge du jour de la semaine, ou d'un jour de
   fete, viendrait se meler a ceux qu'on controle ici). */
const AUJ = (d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"))(new Date());
const AVANT = ["debut_1", "debut_2", "debut_3", "debut_4", "debut_5", "debut_6", "debut_fini"];
const PROG = (debutFait, plus) => { const b = (debutFait ? AVANT : []).concat(plus || []); return { solved: 0, rating: 800, badges: b, badgeDates: Object.fromEntries(b.map((id, i) => [id, i + 1])), bx: { f: {}, j: { [AUJ]: 1 }, c: {} } }; };
const fini = (id, boss, perdues) => { const n = CH[id].etapes.length, s = { e: n, x: 0, f: Array.from({ length: n }, (_, i) => i).concat(boss ? [n] : []) }; if (perdues) s.b = perdues; return s; };
const chemin = (c, p) => Object.assign({ v: 2, c: c, o: [] }, p ? { p: p } : {});
const du = w => w.eval("prog.badges.filter(id=>/^(ch_|boss_|chemin_fini|test_)/.test(id)).sort().join()");
const faits = w => w.eval("Object.keys(bxEtat().f).filter(id=>/^(ch_|boss_|chemin_fini|test_)/.test(id)).sort().join()");
const bravoOuvert = w => !w.document.getElementById("bravo").hidden;
const bravoNoms = w => w.eval("(bxPages||[]).map(b=>b.id).sort().join()");
/* Joue l'exercice a l'ecran par sa premiere solution, comme le ferait un doigt. */
async function jouerExo(w) {
  const ev = s => w.eval(s);
  const ex = ev("JSON.parse(JSON.stringify(leconEtapes()[lecon.e].exos[lecon.x]))");
  if (ex.avant) for (let i = 0; i < 30 && ev("lecon.occupe"); i++) await pause(100);
  w.__u = ex.sol[0];
  const joue = u => { w.__u = u; ev("(function(){const ex=leconEtapes()[lecon.e].exos[lecon.x];const m=legalCache.find(x=>game.uci(x)===window.__u);if(m)debutEssai(m,ex);})()"); };
  joue(ex.sol[0]);
  /* 24/11 : les coups du joueur dans la suite, c'est lui qui les joue. */
  if (ex.suite) for (let k = 0; k < ex.suite.length; k += 2) { await pause(800); if (k + 1 < ex.suite.length) joue(ex.suite[k + 1]); }
  await pause(80);
  return ex;
}
/* La fin d'une partie, posee comme le fait l'application. */
const FIN = (issue, abandon) => "(function(){const g=new Game(gameStartFen||undefined);for(const u of ['e2e4','e7e5','g1f3','b8c6']){const m=g.moves().find(x=>g.uci(x)===u);if(m)g.makeMove(m);}game=g;gameUci=['e2e4','e7e5','g1f3','b8c6'];" +
  "resigned=" + abandon + ";resultInfo={kind:'" + issue + "',title:'x',sub:'y'};gameSaved=false;resultDismissed=false;renderResult(true);})()";
/* Passe le test de placement : true (bon coup), false (mauvais coup). */
async function passerTest(w, reponses) {
  const $ = id => w.document.getElementById(id), ev = s => w.eval(s);
  for (let i = 0; i < reponses.length; i++) {
    if (ev("test.fin") || !ev("test.actif")) break;
    for (let k = 0; k < 20 && (ev("test.occupe") || ev("test.i") !== i); k++) await pause(100);
    if (ev("test.fin")) break;
    w.__bon = reponses[i];
    ev("(function(){const p=cheminD.placement[test.i];const m=legalCache.find(x=>window.__bon?p.sol.includes(game.uci(x)):!p.sol.includes(game.uci(x)));testReponse(m);})()");
    await pause(40);
    if (i === reponses.length - 1 || ev("testFini()")) return;   /* la derniere reponse : « Voir le resultat » reste a toucher */
    $("btnTestSuite").click();
    await pause(60);
  }
}

(async () => {
  console.log("--- Le catalogue, les medailles, les textes ---");
  T("le chemin a 9 chapitres et 8 boss : les textes « neuf chapitres » et « huit boss » disent vrai", PLAN.length === 9 && BOSS.length === 8, PLAN.length + " chapitres, " + BOSS.length + " boss");
  T("14 badges nouveaux, tous au catalogue, dans la famille « apprendre »", NOUVEAUX.length === 14 && NOUVEAUX.every(id => CATALOGUE.some(b => b[0] === id && b[1] === "apprendre")), NOUVEAUX.filter(id => !CATALOGUE.some(b => b[0] === id)).join());
  T("chaque chapitre apres « Je debute » a son badge, et aucun badge de chapitre n'est orphelin", dit(CATALOGUE.filter(b => /^ch_/.test(b[0])).map(b => b[0])) === dit(DE_CHAPITRE), CATALOGUE.filter(b => /^ch_/.test(b[0])).map(b => b[0]).join());
  T("la famille ne contient rien d'autre", CATALOGUE.filter(b => b[1] === "apprendre").length === 14);
  T("aucun identifiant en double dans le catalogue", new Set(CATALOGUE.map(b => b[0])).size === CATALOGUE.length);
  {
    const rangs = CATALOGUE.map((b, i) => (b[1] === "apprendre" ? i : -1)).filter(i => i >= 0);
    T("la famille est d'un seul tenant, juste apres « Je debute »", rangs[rangs.length - 1] - rangs[0] === rangs.length - 1 && CATALOGUE[rangs[0] - 1][1] === "debut", CATALOGUE[rangs[0] - 1][1]);
    const morceaux = {}; let avant = "";
    for (const b of CATALOGUE) { if (b[1] !== avant) { morceaux[b[1]] = (morceaux[b[1]] || 0) + 1; avant = b[1]; } }
    T("aucune famille n'est coupee en deux dans le catalogue", Object.values(morceaux).every(n => n === 1), Object.keys(morceaux).filter(k => morceaux[k] > 1).join(", "));
  }
  const M = JSON.parse(fs.readFileSync(path.join(SITE, "data", "badges-medailles.json"), "utf8"));
  T("chaque badge a sa medaille (bronze, argent ou or)", NOUVEAUX.every(id => Array.isArray(M[id]) && ["bronze", "argent", "or"].includes(M[id][0]) && M[id][1].length > 40), NOUVEAUX.filter(id => !M[id]).join(","));
  T("aucune medaille n'utilise la transparence", NOUVEAUX.every(id => !/opacity|rgba\(/.test(M[id][1])), NOUVEAUX.filter(id => /opacity|rgba\(/.test(M[id][1])).join(","));
  T("aucun dessin ne reprend tel quel une medaille existante", NOUVEAUX.every(id => Object.keys(M).every(k => k === id || M[k][1] !== M[id][1])), NOUVEAUX.filter(id => Object.keys(M).some(k => k !== id && M[k][1] === M[id][1])).join(","));
  {
    /* Les pieces gardent leurs contours (regle d'Alexandre, 22/11) : six medailles de chapitre portent une piece. */
    const pieces = ["ch_securite", "ch_mats", "ch_menaces", "ch_clouer", "ch_ouverture", "ch_finales"];
    T("les six pieces des medailles de chapitre ont leurs contours", pieces.every(id => /stroke="var\(--oeil\)"[^>]*paint-order="stroke"/.test(M[id][1])), pieces.filter(id => !/paint-order="stroke"/.test(M[id][1])).join());
    T("le metal monte avec le chemin : bronze (2 a 4), argent (5 a 7), or (8 et 9)", DE_CHAPITRE.map(id => M[id][0]).join() === "bronze,bronze,bronze,argent,argent,argent,or,or", DE_CHAPITRE.map(id => M[id][0]).join());
  }
  const textes = {};
  for (const c of CODES) textes[c] = JSON.parse(fs.readFileSync(path.join(SITE, "data", "badges-" + c + ".json"), "utf8"));
  T("10 langues", CODES.length === 10);
  for (const c of CODES) {
    const t = textes[c], manque = NOUVEAUX.filter(id => !Array.isArray(t[id]) || t[id].length !== 3 || t[id].some(x => typeof x !== "string" || !x.trim()));
    T(c + " : nom, condition et anecdote pour les 14 badges", !manque.length, manque.join(","));
    if (manque.length) continue;
    if (c !== "en") {
      const pareil = NOUVEAUX.filter(id => t[id][1] === textes.en[id][1] || t[id][2] === textes.en[id][2]);
      T(c + " : conditions et anecdotes traduites, pas laissees en anglais", !pareil.length, pareil.join(","));
    }
    T(c + " : la famille a son nom", !!t._ui["famille:apprendre"] && (c === "en" || t._ui["famille:apprendre"] !== textes.en._ui["famille:apprendre"]), t._ui["famille:apprendre"]);
    const noms = Object.keys(t).filter(k => k !== "_ui").map(k => t[k][0]);
    const doubles = NOUVEAUX.filter(id => noms.filter(n => n === t[id][0]).length > 1);
    T(c + " : aucun nouveau badge ne reprend le nom d'un autre", !doubles.length, doubles.map(id => id + " = " + t[id][0]).join(", "));
    /* La condition d'un chapitre : son numero et son titre, tels que le chemin les ecrit. */
    const faux = CHAPITRES.filter((id, i) => { const k = net(t["ch_" + id][1]); return !k.includes(net(CH[id].titre[c])) || !new RegExp("(^|\\D)" + (i + 2) + "(\\D|$)").test(k); });
    T(c + " : la condition de chaque chapitre cite son numero et son titre", !faux.length, faux.map(id => t["ch_" + id][1]).join(" | "));
    T(c + " : aucun emoji, aucun point median, aucun tiret long", NOUVEAUX.every(id => !/[\u{1F000}-\u{1FFFF}☀-➿·—]/u.test(t[id].join(" "))), NOUVEAUX.filter(id => /[·—]/.test(t[id].join(" "))).join());
    T(c + " : rien qui reste a remplir ({n}, {titre})", NOUVEAUX.every(id => !/[{}]/.test(t[id].join(" "))));
  }
  T("fr : ponctuation haute liee au mot qui precede", !/ [:;!?»]/.test(NOUVEAUX.map(id => textes.fr[id].join(" ")).join(" ")));
  T("fr : le badge du chapitre 2 dit « Finir les lecons du chapitre 2 : Toutes les regles »", net(textes.fr.ch_regles[1]) === "Finir les leçons du chapitre 2 : Toutes les règles", textes.fr.ch_regles[1]);
  T("fr : tutoiement, jamais de vous", !/\bvous\b|\bvotre\b|\bvos\b/i.test(NOUVEAUX.map(id => textes.fr[id].join(" ")).join(" ")));
  {
    const N = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "nouveautes.json"), "utf8"));
    const e = N.find(x => x.en[0] === "Badges for the Learn tab") || {};
    T("une nouveaute, dans les 10 langues, titre et texte", CODES.every(c => Array.isArray(e[c]) && e[c].length === 2 && e[c].every(x => x.trim().length > 10)), e.en && e.en[0]);
    /* 2026-11-23 : d'autres nouveautes du meme jour peuvent passer devant (fin de boss). */
    T("elle est datee du 23/11/2026, sans rien de plus ancien devant elle", e.d === "2026-11-23" && N.slice(0, N.indexOf(e)).every(x => x.d >= e.d), N[0].en[0]);
    T("elle tutoie, sans point median ni tiret long, et dit que le passe compte", !!e.fr && /Quatorze/.test(e.fr[1]) && /déjà fait compte/.test(e.fr[1]) && !/[·—–]/.test(CODES.map(c => e[c].join(" ")).join(" ")) && !/\bvous\b|\bvotre\b/i.test(e.fr[1]));
  }

  console.log("--- Premiere visite : rien, et le compteur suit le nouveau total ---");
  let w = await ouvrir("fr", Object.assign(avec({ "chang64:progress": PROG(false) }), { attente: 3200 }));
  let $ = id => w.document.getElementById(id), ev = s => w.eval(s);
  T("aucun badge du chemin, aucun fait acquis", du(w) === "" && faits(w) === "" && ev("cheminBadgesIds().length") === 0, du(w) + " / " + faits(w));
  T("les 14 badges sont dans la liste du site", NOUVEAUX.every(id => ev("BADGES.some(b=>b.id===" + dit(id) + ")")));
  T("le nombre de positions du test est pose dans le script", ev("CHEMIN_TEST") === POSITIONS, ev("CHEMIN_TEST"));
  {
    const visibles = CATALOGUE.filter(b => b[1] !== "ligues").length;
    T("le total visible : tout le catalogue moins les 4 badges de ligue, soit 14 de plus qu'avant", ev("BADGES.filter(bxVisible).length") === visibles && visibles === 286, ev("BADGES.filter(bxVisible).length") + " / " + visibles);
    ev("menuOuvrir();menuVue('stats')"); await pause(400);
    const tuiles = [...w.document.querySelectorAll("#menuStats .menu-tuile")].map(x => net(x.textContent));
    T("Statistiques : la tuile Badges dit 0/" + visibles, tuiles.some(x => x.replace(/\s/g, "").includes("0/" + visibles)), tuiles.filter(x => /Badges/.test(x)).join(" | "));
    ev("menuVue('badges')"); await pause(300);
    T("ecran Badges sans compte : le compte dit aussi /" + visibles, net($("menuBadgeGrid").textContent).replace(/\s/g, "").includes("0/" + visibles), net($("menuBadgeGrid").textContent).slice(0, 60));
    ev("menuFermer()");
  }
  w.close();

  console.log("--- Un chapitre : le badge a la fin de la derniere lecon, pas avant ---");
  /* Chapitre 2, quatre lecons faites, la cinquieme a jouer. */
  w = await ouvrir("fr", Object.assign(avec({ "chang64:progress": PROG(true), "chang64:debut": DEBUT_FINI, "chang64:chemin": chemin({ regles: { e: 4, x: 0, f: [0, 1, 2, 3] } }) }), { attente: 3200 }));
  $ = id => w.document.getElementById(id); ev = s => w.eval(s);
  await pause(4600);   /* le rattrapage du chargement et sa possible annonce sont passes */
  T("quatre lecons sur cinq : aucun badge du chemin, meme apres le rattrapage", du(w) === "" && faits(w) === "" && !bravoOuvert(w) && !w.document.getElementById("objAnnonce"), du(w));
  $("tab-apprendre").click(); await pause(400);
  w.document.querySelectorAll("#apChemin .ap-chap")[1].click(); await pause(500);
  const E = ev("JSON.parse(JSON.stringify(leconEtapes()))");
  T("on est a la cinquieme lecon du chapitre 2", ev("leconCh") === "regles" && ev("lecon.e") === 4 && ev("lecon.x") === 0);
  T("pendant l'exercice, aucune fenetre ne peut s'ouvrir", ev("bravoOccupe()") === true);
  for (let j = 0; j < E[4].exos.length; j++) {
    const dernier = j === E[4].exos.length - 1;
    if (!dernier) {
      await jouerExo(w);
      T("exercice " + (j + 1) + " reussi : la lecon n'est pas finie, pas de badge", ev("lecon.ok") === true && du(w) === "" && faits(w) === "", du(w));
      $("btnDebutSuite").click(); await pause(150);
      T("exercice " + (j + 2) + " a l'ecran : de nouveau aucune fenetre possible", ev("lecon.x") === j + 1 && ev("bravoOccupe()") === true);
    } else {
      await jouerExo(w);
      T("dernier exercice reussi : le chapitre est fini", ev("lecon.ok") === true && ev("cheminEtat(1).fini") === true);
      T("le badge du chapitre est gagne tout de suite, et lui seul", du(w) === "ch_regles" && faits(w) === "ch_regles", du(w));
      T("la lecon est finie : la fenetre peut s'ouvrir", ev("bravoOccupe()") === false);
    }
  }
  await pause(1500);
  T("la fenetre Bravo s'ouvre, avec la medaille « Arbitre »", bravoOuvert(w) && bravoNoms(w) === "ch_regles" && net($("bravoNoms").textContent) === "Arbitre" && !!$("bravoSocle").querySelector("svg.bx-bronze"), net($("bravoNoms").textContent));
  T("elle raconte son anecdote", /Angleterre/.test(net($("bravoTexte").textContent)), net($("bravoTexte").textContent).slice(0, 80));
  T("le boss n'est pas demande pour ce badge", ev("cheminEtat(1).boss") === false);
  $("bravoOk").click(); await pause(100);
  T("rejouer une lecon du chapitre ne redonne rien", (() => { ev("cheminBadgesGagner()"); return ev("(bravoFile||[]).length") === 0 && du(w) === "ch_regles"; })());

  console.log("--- Le boss : a la fin de la partie, jamais pendant ---");
  $("btnDebutSuite").click(); await pause(300);
  T("l'ecran du boss est la", !$("leconBoss").classList.contains("hide") && ev("lecon.e") === 5);
  $("btnLeconBoss").click(); await pause(500);
  T("la partie contre le boss est en cours : aucune fenetre possible", ev("mode") === "play" && ev("gameStarted") === true && ev("partieEntrainement()") === true && ev("bravoOccupe()") === true);
  ev("cheminBadgesGagner()");
  T("rien n'est donne tant qu'elle n'est pas gagnee", du(w) === "ch_regles");
  const eloAvant = dit(ev("prog.eloOrdi")), vicAvant = ev("(bxEtat().c.vic||0)");
  ev(FIN("win", "B")); await pause(200);
  T("boss battu a la premiere partie : « Premier boss » et « Du premier coup »", du(w) === "boss_1,boss_net,ch_regles", du(w));
  T("la partie est finie : la fenetre peut s'ouvrir", ev("bravoOccupe()") === false);
  await pause(1500);
  T("la fenetre Bravo montre les deux medailles, une par page", bravoOuvert(w) && bravoNoms(w) === "boss_1,boss_net" && w.document.querySelectorAll("#bravoAutres .bx-page").length === 2, bravoNoms(w));
  T("l'argent passe avant le bronze : « Du premier coup » en premier", net($("bravoNoms").textContent) === "Du premier coup", net($("bravoNoms").textContent));
  T("toujours ni Elo ni badge de partie pour un entrainement", dit(ev("prog.eloOrdi")) === eloAvant && ev("(bxEtat().c.vic||0)") === vicAvant && !ev("prog.badges.includes('jeu_victoire')") && !ev("prog.badges.includes('jeu_niv1')"));
  ev("bravoFermer()");
  w.close();

  console.log("--- Un boss battu apres une defaite : pas « Du premier coup » ---");
  w = await ouvrir("fr", Object.assign(avec({ "chang64:progress": PROG(true), "chang64:debut": DEBUT_FINI, "chang64:chemin": chemin({ regles: fini("regles", false) }) }), { attente: 3200 }));
  $ = id => w.document.getElementById(id); ev = s => w.eval(s);
  await pause(4600);
  T("le chapitre fini avant ce lot est deja dans la collection (rattrapage)", du(w) === "ch_regles", du(w));
  ev("cheminLancerPartie('regles'," + dit(CH.regles.boss.fen) + ",1)"); await pause(400);
  ev(FIN("lose", "W")); await pause(200);
  T("une defaite contre le boss ne donne aucun badge", du(w) === "ch_regles" && ev("cheminEtat(1).defaites") === 1, du(w));
  ev("cheminLancerPartie('regles'," + dit(CH.regles.boss.fen) + ",1)"); await pause(400);
  ev(FIN("draw", "null")); await pause(200);
  T("une nulle non plus", du(w) === "ch_regles");
  ev("cheminLancerPartie('regles'," + dit(CH.regles.boss.fen) + ",1)"); await pause(400);
  ev(FIN("win", "B")); await pause(200);
  T("la victoire donne « Premier boss », sans « Du premier coup »", du(w) === "boss_1,ch_regles", du(w));
  /* Un autre boss, battu d'entree : « Du premier coup » arrive alors. */
  ev("bravoFermer();bravoFile=[];chemin.c.securite=" + dit(fini("securite", false)) + ";cheminEcrire()");
  ev("cheminLancerPartie('securite'," + dit(CH.securite.boss.fen) + ",1)"); await pause(400);
  ev(FIN("win", "B")); await pause(200);
  T("un autre boss battu sans defaite : « Du premier coup »", /boss_net/.test(du(w)) && !/boss_tous/.test(du(w)), du(w));
  T("le chapitre 3, fini sans passer par une lecon a l'ecran, a son badge a la fin de cette partie", /ch_securite/.test(du(w)), du(w));
  w.close();

  console.log("--- Tous les boss, et le chemin entier ---");
  {
    /* Sept boss battus, le huitieme a battre ; huit chapitres finis, une lecon manque au chapitre 2. */
    const c = {};
    for (const id of CHAPITRES) c[id] = fini(id, id !== "mat2", id === "mats" ? 2 : 0);
    c.regles = { e: 4, x: 0, f: [0, 1, 2, 3, 5] };
    w = await ouvrir("fr", Object.assign(avec({ "chang64:progress": PROG(true), "chang64:debut": DEBUT_FINI, "chang64:chemin": chemin(c) }), { attente: 3200 }));
    $ = id => w.document.getElementById(id); ev = s => w.eval(s);
    await pause(4600);
    const attendu = CHAPITRES.filter(id => id !== "regles").map(id => "ch_" + id).concat(["boss_1", "boss_net"]).sort().join();
    T("au chargement : sept chapitres, « Premier boss », « Du premier coup », rien de plus", du(w) === attendu, du(w));
    ev("cheminLancerPartie('mat2'," + dit(CH.mat2.boss.fen) + ",2)"); await pause(400);
    ev(FIN("win", "B")); await pause(200);
    T("le huitieme boss tombe : « Tombeur de boss »", /boss_tous/.test(du(w)) && !/chemin_fini/.test(du(w)), du(w));
    await pause(1500);
    T("annonce par la fenetre Bravo, medaille d'or", bravoOuvert(w) && bravoNoms(w) === "boss_tous" && net($("bravoNoms").textContent) === "Tombeur de boss" && !!$("bravoSocle").querySelector("svg.bx-or"), bravoNoms(w));
    ev("bravoFermer()");
    /* La derniere lecon qui manquait. */
    $("tab-apprendre").click(); await pause(400);
    w.document.querySelectorAll("#apChemin .ap-chap")[1].click(); await pause(500);
    ev("lecon.e=4;lecon.x=0;debutCharger()"); await pause(200);
    const n = ev("leconEtapes()[4].exos.length");
    for (let j = 0; j < n; j++) { await jouerExo(w); if (j < n - 1) { T("pas de « Sommet » avant le dernier exercice (" + (j + 1) + " sur " + n + ")", !/chemin_fini/.test(du(w))); $("btnDebutSuite").click(); await pause(150); } }
    T("la derniere lecon du dernier chapitre a finir : le chapitre et « Sommet »", /ch_regles/.test(du(w)) && /chemin_fini/.test(du(w)), du(w));
    await pause(1500);
    T("la fenetre Bravo : deux pages, « Sommet » (or) avant « Arbitre » (bronze)", bravoOuvert(w) && bravoNoms(w) === "ch_regles,chemin_fini" && net($("bravoNoms").textContent) === "Sommet", net($("bravoNoms").textContent));
    T("les 12 badges hors test sont gagnes, les 2 du test non", du(w) === NOUVEAUX.filter(id => !/^test_/.test(id)).sort().join(), du(w));
    w.close();
  }
  {
    /* « Sommet » demande aussi le chapitre 1. */
    const c = {};
    for (const id of CHAPITRES) c[id] = fini(id, true);
    w = await ouvrir("fr", Object.assign(avec({ "chang64:progress": PROG(false, ["debut_1", "debut_2"]), "chang64:debut": { e: 2, x: 0, f: [0, 1] }, "chang64:chemin": Object.assign(chemin(c), { o: PLAN.slice() }) }), { attente: 3200 }));
    await pause(4600);
    T("huit chapitres finis mais pas « Je debute » : pas de « Sommet »", !/chemin_fini/.test(du(w)) && /boss_tous/.test(du(w)) && DE_CHAPITRE.every(id => du(w).includes(id)), du(w));
    w.close();
  }

  console.log("--- Le test de placement ---");
  w = await ouvrir("fr", Object.assign(avec({ "chang64:progress": PROG(false) }), { attente: 3200 }));
  $ = id => w.document.getElementById(id); ev = s => w.eval(s);
  $("tab-apprendre").click(); await pause(400);
  $("apTestGo").click(); await pause(700);
  T("le test est ouvert : aucune fenetre possible", ev("testEnCours()") === true && ev("bravoOccupe()") === true);
  await passerTest(w, Array(POSITIONS).fill(true));
  T("toutes les positions trouvees, le resultat n'est pas encore affiche : aucun badge", ev("test.rep.length") === POSITIONS && ev("test.fin") === false && du(w) === "" && ev("bravoOccupe()") === true, du(w));
  $("btnTestSuite").click(); await pause(150);
  T("le resultat est a l'ecran", ev("test.fin") === true && !$("testResultat").classList.contains("hide"));
  T("« Point de depart » et « Sans faute » sont gagnes", du(w) === "test_fait,test_parfait", du(w));
  T("le test fini, la fenetre peut s'ouvrir par-dessus le resultat", ev("bravoOccupe()") === false);
  T("le nombre de positions est garde avec le resultat", JSON.parse(w.localStorage.getItem("chang64:chemin")).p.q === POSITIONS && JSON.parse(w.localStorage.getItem("chang64:chemin")).p.n === POSITIONS);
  T("le test fait sauter tous les chapitres, mais ne donne aucun badge de chapitre", ev("chemin.p.e") === "fin" && !/ch_|chemin_fini|boss_/.test(du(w)), du(w));
  await pause(1500);
  T("la fenetre Bravo : « Sans faute » (or) puis « Point de depart » (bronze)", bravoOuvert(w) && bravoNoms(w) === "test_fait,test_parfait" && net($("bravoNoms").textContent) === "Sans faute", net($("bravoNoms").textContent));
  ev("bravoFermer()");
  w.close();
  w = await ouvrir("fr", Object.assign(avec({ "chang64:progress": PROG(false) }), { attente: 3200 }));
  $ = id => w.document.getElementById(id); ev = s => w.eval(s);
  $("tab-apprendre").click(); await pause(400);
  $("apTestGo").click(); await pause(700);
  await passerTest(w, [true, false, false]);
  T("deux positions manquees de suite : le test s'arrete", ev("testFini()") === true && ev("test.fin") === false && du(w) === "");
  $("btnTestSuite").click(); await pause(150);
  T("test fini avec des erreurs : « Point de depart » seul", du(w) === "test_fait", du(w));
  await pause(1500);
  T("une seule medaille dans la fenetre", bravoOuvert(w) && bravoNoms(w) === "test_fait" && net($("bravoNoms").textContent) === "Point de départ");
  ev("bravoFermer()");
  /* Quitter le test en route ne donne rien. */
  ev("prog.badges=[];prog.badgeDates={};prog.bx.f={};chemin.p=null;cheminEcrire()");
  $("tab-apprendre").click(); await pause(300);
  ev("testLancer()"); await pause(700);
  await passerTest(w, [true]);
  $("tab-apprendre").click(); await pause(300);
  T("test quitte avant la fin : aucun badge", du(w) === "" && ev("test.actif") === false && ev("cheminBadgesIds().length") === 0, du(w));
  w.close();

  console.log("--- Rattrapage : ce qui etait deja merite, sans fenetre ---");
  {
    /* Avant ce lot : chapitres 2 a 4 finis, boss 2 battu d'entree, boss 3 battu apres deux defaites,
       boss 4 pas battu apres trois defaites ; test fait le 22/11, 19 sur 19, sans le champ q. */
    const c = { regles: fini("regles", true), securite: fini("securite", true, 2), mats: fini("mats", false, 3), menaces: { e: 2, x: 1, f: [0, 1] } };
    w = await ouvrir("fr", avec({ "chang64:debut": DEBUT_FINI, "chang64:chemin": chemin(c, { t: Date.UTC(2026, 10, 22), n: POSITIONS, e: "menaces" }),
      "chang64:progress": Object.assign(PROG(true, ["solved_1", "solved_10"]), { solved: 12 }) }));
    $ = id => w.document.getElementById(id); ev = s => w.eval(s);
    ev("window.__annonces=[];(function(){const av=objAnnoncer;objAnnoncer=function(a,b,c){window.__annonces.push([a,b,c]);return av.apply(this,arguments);};})();" +
      "window.__bravos=0;(function(){const av=bravoAnnoncer;bravoAnnoncer=function(l){window.__bravos+=l.length;return av.apply(this,arguments);};})()");
    await pause(2600);
    const attendu = ["ch_regles", "ch_securite", "ch_mats", "boss_1", "boss_net", "test_fait", "test_parfait"].sort().join();
    T("les sept badges merites sont dans la collection", du(w) === attendu && faits(w) === attendu, du(w));
    T("ni le chapitre en cours, ni « Tombeur de boss », ni « Sommet »", !/ch_menaces|boss_tous|chemin_fini/.test(du(w)));
    T("ceux d'avant sont toujours la, a leur date", ev("prog.badges.includes('debut_fini')") && ev("prog.badgeDates.debut_fini") === 7 && ev("prog.badgeDates.solved_10") === 9 && ev("prog.badges.length") === 16, ev("prog.badges.join()"));
    T("aucune fenetre Bravo : ni ouverte, ni en attente, ni demandee", !bravoOuvert(w) && ev("(bravoFile||[]).length") === 0 && ev("__bravos") === 0, ev("__bravos"));
    T("pas encore d'annonce (les sources du rattrapage sont reunies)", ev("__annonces.length") === 0 && !w.document.getElementById("objAnnonce"));
    await pause(4600);
    const an = ev("__annonces");
    T("une seule annonce discrete : « 7 badges ajoutes »", an.length === 1 && an[0][0] === "badges" && net(an[0][1]) === "7 badges ajoutés", dit(an));
    T("sa phrase ne parle pas de parties : « Pour ce que tu as deja fait. Touche pour les voir. »", an.length === 1 && net(an[0][2]) === "Pour ce que tu as déjà fait. Touche pour les voir.", an[0] && an[0][2]);
    T("elle est a l'ecran", !!w.document.getElementById("objAnnonce") && /7 badges ajoutés/.test(net(w.document.getElementById("objAnnonce").textContent)));
    T("toujours aucune fenetre Bravo", !bravoOuvert(w) && ev("__bravos") === 0);
    T("la progression gardee porte les badges", (() => { const p = JSON.parse(w.localStorage.getItem("chang64:progress")); return attendu.split(",").every(id => p.badges.includes(id) && p.bx.f[id] === 1); })());
    ev("cheminRattraper();bxAdopterLocal()"); await pause(300);
    T("le rattrapage relance ne rajoute rien", ev("bxAdoptes") === 0 && ev("prog.badges.length") === 16);
    ev("checkBadges()"); await pause(100);
    T("une verification ordinaire non plus, et ne rouvre rien", ev("__bravos") === 0 && ev("prog.badges.length") === 16);
    /* Une progression qui arrive du compte (autre appareil) : meme regle, sans fenetre. */
    w.__c = Object.assign(chemin(Object.assign({}, c, { menaces: fini("menaces", false) }), { t: Date.UTC(2026, 10, 22), n: POSITIONS, e: "menaces" }));
    ev("cheminAdopter(window.__c)"); await pause(400);
    T("progression venue du compte : le chapitre 5 entre dans la collection sans fenetre", /ch_menaces/.test(du(w)) && ev("__bravos") === 0 && !bravoOuvert(w), du(w));
    /* Ce qu'on gagne ensuite, on le gagne normalement, avec la fenetre. */
    ev("cheminLancerPartie('menaces'," + dit(CH.menaces.boss.fen) + ",1)"); await pause(400);
    ev(FIN("win", "B")); await pause(200);
    T("un boss battu ensuite : rien de neuf (les deux badges de boss sont deja la), donc pas de fenetre", ev("__bravos") === 0 && ev("cheminEtat(4).boss") === true);
    w.close();
  }
  {
    /* Un vieux resultat du test, quand il avait 10 positions : fait, mais pas « Sans faute ». */
    w = await ouvrir("fr", Object.assign(avec({ "chang64:progress": PROG(false), "chang64:chemin": chemin({}, { t: Date.UTC(2026, 10, 21), n: 10, e: "fin" }) }), { attente: 3200 }));
    await pause(600);
    T("test d'avant a 10 sur 10, sans le nombre de positions : « Point de depart » seul", du(w) === "test_fait", du(w));
    w.close();
    w = await ouvrir("fr", Object.assign(avec({ "chang64:chemin": chemin({}, { x: 1 }) }), { attente: 3200 }));
    await pause(600);
    T("test ecarte (« Plus tard ») : aucun badge", du(w) === "", du(w));
    w.close();
    w = await ouvrir("fr", Object.assign(avec({ "chang64:chemin": chemin({}, { t: 5, n: 18, q: 19, e: "mat2" }) }), { attente: 3200 }));
    await pause(600);
    T("18 sur 19 : pas « Sans faute »", du(w) === "test_fait", du(w));
    w.close();
  }
  {
    /* Un seul badge rattrape : le singulier. */
    w = await ouvrir("fr", avec({ "chang64:progress": PROG(true), "chang64:debut": DEBUT_FINI, "chang64:chemin": chemin({ regles: fini("regles", false) }) }));
    w.eval("window.__annonces=[];(function(){const av=objAnnoncer;objAnnoncer=function(a,b,c){window.__annonces.push([a,b,c]);return av.apply(this,arguments);};})()");
    await pause(7400);
    const an = w.eval("__annonces");
    T("un seul badge rattrape : « 1 badge ajoute »", an.length === 1 && net(an[0][1]) === "1 badge ajouté" && du(w) === "ch_regles", dit(an));
    w.close();
  }

  console.log("--- Le compte : la fusion garde tout ---");
  w = await ouvrir("fr", { fetch: true });
  {
    const L = { v: 1, t: { progress: 10, chemin: 10 }, progress: { badges: ["ch_regles", "boss_1"], badgeDates: { ch_regles: 100, boss_1: 200 }, bx: { f: { ch_regles: 1, boss_1: 1 }, j: {}, c: {} } },
      chemin: chemin({ regles: fini("regles", true) }, { t: 50, n: POSITIONS, q: POSITIONS, e: "fin" }) };
    const D = { v: 1, t: { progress: 20, chemin: 5 }, progress: { badges: ["ch_securite", "boss_1"], badgeDates: { ch_securite: 300, boss_1: 150 }, bx: { f: { ch_securite: 1, boss_1: 1 }, j: {}, c: {} } },
      chemin: chemin({ securite: fini("securite", false, 1) }, { t: 40, n: 3, q: POSITIONS, e: "regles" }) };
    w.__L = L; w.__D = D;
    const R = JSON.parse(w.eval("JSON.stringify(cpFusion(window.__L,window.__D,null))"));
    T("les badges des deux appareils s'additionnent", ["ch_regles", "ch_securite", "boss_1"].every(id => R.progress.badges.includes(id)) && R.progress.badges.length === 3, dit(R.progress.badges));
    T("les faits acquis aussi", ["ch_regles", "ch_securite", "boss_1"].every(id => R.progress.bx.f[id] === 1), dit(R.progress.bx.f));
    T("un badge gagne des deux cotes garde sa date la plus ancienne", R.progress.badgeDates.boss_1 === 150);
    T("le test le plus recent l'emporte, avec son nombre de positions", R.chemin.p.t === 50 && R.chemin.p.n === POSITIONS && R.chemin.p.q === POSITIONS, dit(R.chemin.p));
    T("les chapitres des deux appareils sont la, la defaite contre le boss aussi", R.chemin.c.regles.f.includes(5) && R.chemin.c.securite.f.length === 5 && R.chemin.c.securite.b === 1, dit(R.chemin.c));
    /* La progression fusionnee, une fois adoptee, ne fait rien gagner deux fois. */
    w.__R = R;
    w.eval("prog.badges=window.__R.progress.badges.slice();prog.badgeDates=window.__R.progress.badgeDates;prog.bx=window.__R.progress.bx;" +
      "window.__bravos=0;(function(){const av=bravoAnnoncer;bravoAnnoncer=function(l){window.__bravos+=l.length;return av.apply(this,arguments);};})();" +
      "debut.faites=[0,1,2,3,4,5];cheminAdopter(window.__R.chemin)");
    await pause(500);
    T("apres la fusion : « Du premier coup » et le test, merites, entrent sans fenetre", w.eval("__bravos") === 0 && du(w) === ["boss_1", "boss_net", "ch_regles", "ch_securite", "test_fait", "test_parfait"].sort().join(), du(w));
    T("le serveur du compte accepte largement ce nombre de badges (plafond 1000)", /Math\.min\(1000, new Set\(p\.badges/.test(fs.readFileSync(path.join(__dirname, "..", "functions", "api", "compte", "[[route]].js"), "utf8")));
  }
  w.close();

  console.log("--- La collection et la fiche d'un badge ---");
  w = await ouvrir("fr", Object.assign(avec({ "chang64:compte": { pseudo: "Moi", cle: "moi", version: 1, dev: "abc123", n: 0, sync: 0 }, "chang64:progress": PROG(true), "chang64:debut": DEBUT_FINI, "chang64:chemin": chemin({ regles: fini("regles", false) }) }), { attente: 3200 }));
  $ = id => w.document.getElementById(id); ev = s => w.eval(s);
  await pause(800);
  ev("menuOuvrir();menuVue('badges')"); await pause(600);
  {
    const titres = [...w.document.querySelectorAll("#menuBadgeGrid .bx-famille")].map(x => net(x.textContent));
    T("la collection a sa famille « Chemin d'apprentissage », une seule fois, apres « Je debute »", titres.filter(x => x === "Chemin d'apprentissage").length === 1 && titres[titres.indexOf("Chemin d'apprentissage") - 1] === "Je débute", titres.join(" | "));
    const cartes = NOUVEAUX.map(id => w.document.querySelector('#menuBadgeGrid [data-bx="' + id + '"]'));
    T("ses 14 medailles y sont, avec leur nom", cartes.every(c => c && c.querySelector("svg") && net(c.querySelector(".bx-nom").textContent).length > 2), cartes.filter(c => !c).length);
    T("le chapitre fini est allume, les autres sont sombres", cartes[0].classList.contains("unlocked") && cartes.slice(1).every(c => !c.classList.contains("unlocked") && c.querySelector("svg.bx-ombre")));
    ev("bxFiche('boss_tous')"); await pause(100);
    T("fiche d'un badge a gagner : « Pour l'obtenir : Battre les huit boss »", net($("bravoNoms").textContent) === "Pour l'obtenir : Battre les huit boss", net($("bravoNoms").textContent));
    ev("bravoFermer();bxFiche('ch_regles')"); await pause(100);
    T("fiche d'un badge gagne : sa date, et comment il l'a ete", /^Gagné le /.test(net($("bravoNoms").textContent)) && /Finir les leçons du chapitre 2 : Toutes les règles/.test(net($("bravoNoms").textContent)), net($("bravoNoms").textContent));
    ev("bravoFermer();menuFermer()");
  }
  w.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
