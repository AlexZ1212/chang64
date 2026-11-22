/* Verification automatique de chang64.
   Lancement : node tests/check_test_placement.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Le test de placement (apprendre.js, 2026-11-22, decisions d'Alexandre) :
   - il se propose par une carte dans l'onglet Apprendre, jamais par une
     fenetre ; on peut l'ecarter, puis le faire ou le refaire quand on veut ;
   - dix positions au plus, un seul essai chacune, un bouton « Je ne sais
     pas » ; apres chaque reponse, un message net (juste ou non), une pastille
     par position, et un bouton « Suivant » (retours d'Alexandre du 22/11) ;
   - il s'arrete apres deux erreurs de suite, et le resultat le dit ;
   - l'echiquier est toujours du cote de celui qui repond ;
   - il regle le chapitre d'entree (les chapitres d'avant restent ouverts), le
     Niveau exercices et la force de l'ordinateur ; ce qui a deja ete gagne en
     jouant n'est jamais ecrase ; on peut refuser les reglages ;
   - aucune recompense ne surgit pendant le test. */
const { ouvrir } = require("./outils/page_langue.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));
const net = s => String(s).replace(/[  ]/g, " ");
const dit = x => JSON.stringify(x);
const avec = o => ({ fetch: true, avant(w) { for (const k in o) w.localStorage.setItem(k, typeof o[k] === "string" ? o[k] : JSON.stringify(o[k])); } });

/* Passe le test : reponses[i] vaut true (bon coup), false (mauvais coup) ou
   null (« Je ne sais pas »). Rend le nombre de positions vues. */
async function passer(w, reponses) {
  const $ = id => w.document.getElementById(id), ev = s => w.eval(s);
  let vues = 0;
  for (let i = 0; i < reponses.length; i++) {
    if (ev("test.fin") || !ev("test.actif")) break;
    for (let k = 0; k < 20 && (ev("test.occupe") || ev("test.i") !== i); k++) await pause(100);
    if (ev("test.fin")) break;
    vues++;
    if (ev("flipped") !== false) w.__aLEnvers = (w.__aLEnvers || []).concat([i + 1]);
    if (reponses[i] === null) $("btnTestPasse").click();
    else {
      w.__bon = reponses[i];
      ev("(function(){const p=cheminD.placement[test.i];const m=legalCache.find(x=>window.__bon?p.sol.includes(game.uci(x)):!p.sol.includes(game.uci(x)));testReponse(m);})()");
    }
    await pause(40);
    $("btnTestSuite").click();
    await pause(60);
  }
  return vues;
}

(async () => {
  console.log("--- La carte, dans l'onglet ---");
  let w = await ouvrir("fr", { fetch: true });
  let $ = id => w.document.getElementById(id), ev = s => w.eval(s);
  const cache = id => $(id).classList.contains("hide");
  T("aucune fenetre a l'arrivee sur le site", ev("mode") === "home" && cache("pane-apprendre") && ev("test.actif") === false);
  $("tab-apprendre").click(); await pause(500);
  T("la carte propose le test, avec deux boutons", !cache("apTest") && net($("apTestGo").textContent) === "Faire le test" && net($("apTestPlusTard").textContent) === "Plus tard");
  $("apTestPlusTard").click(); await pause(100);
  T("« Plus tard » ecarte la carte", cache("apTest") && dit(JSON.parse(w.localStorage.getItem("chang64:chemin")).p) === dit({ x: 1 }));
  T("un lien discret permet de le faire quand meme", !cache("apRefaire") && net($("apTestRefaire").textContent) === "Faire le test de placement");
  T("l'ecarter ne compte pas comme un chemin commence", ev("cheminCommence()") === false && net($("heroDebut").textContent) === "Je débute");

  console.log("--- Deux erreurs de suite : il s'arrete ---");
  $("apTestRefaire").click(); await pause(600);
  T("le test s'ouvre sur l'ecran des lecons", ev("mode") === "debut" && ev("test.actif") === true && ev("testEnCours()") === true);
  const pastilles = () => [...$("testPastilles").children].map(i => i.className || "-").join(" ");
  T("titre, position 1 sur 10, dix pastilles dont la premiere en cours", net($("debutTeteTitre").textContent) === "Test de placement" && /Position 1 sur 10/.test(net($("debutEtape").textContent)) && !cache("testPastilles") && pastilles() === "ici - - - - - - - - -", pastilles());
  T("les pastilles ont un nom pour les lecteurs d'ecran", $("testPastilles").getAttribute("role") === "img" && /Bonnes réponses : 0 sur 10/.test(net($("testPastilles").getAttribute("aria-label"))), $("testPastilles").getAttribute("aria-label"));
  T("l'echiquier est du cote des Blancs", ev("flipped") === false);
  T("ni pastilles, ni indice, ni titre de lecon", cache("debutPas") && cache("debutActions") && cache("debutTitre") && cache("debutIntro") && cache("leconBoss") && cache("debutFin"));
  T("consigne et bouton « Je ne sais pas », pas encore de « Suivant »", /meilleur coup/.test(net($("debutStatus").textContent)) && !cache("testActions") && net($("btnTestPasse").textContent) === "Je ne sais pas" && !cache("btnTestPasse") && cache("btnTestSuite"));
  T("aucune recompense ne peut surgir pendant le test", ev("bravoOccupe()") === true);
  const avantStock = w.localStorage.getItem("chang64:chemin");
  $("btnTestPasse").click(); await pause(50);
  T("apres une reponse, la position est fermee : un seul essai", ev("test.occupe") === true && ev("legalCache.length") === 0 && cache("btnTestPasse") && ev("leconBloquee()") === true);
  T("position passee : c'est dit, sans reproche", /^Position passée\. /.test(net($("debutStatus").textContent)) && !$("debutStatus").classList.contains("lose"), $("debutStatus").textContent);
  T("et l'idee est expliquee en une phrase", net($("debutStatus").textContent).endsWith(net(ev("cheminD.placement[0].ex"))) && /cavalier en b7/.test(net($("debutStatus").textContent)), $("debutStatus").textContent);
  T("le bon coup est montre sur l'echiquier", ev("selected===debutCase('f3')") && ev("marks[debutCase('b7')]") === "hint");
  T("la pastille de la position est marquee manquee, avec une croix", pastilles() === "rate - - - - - - - - -" && !!$("testPastilles").firstChild.querySelector("svg"), pastilles());
  T("un bouton « Suivant » apparait", !cache("btnTestSuite") && net($("btnTestSuite").textContent) === "Suivant" && $("btnTestSuite").classList.contains("primary"));
  await pause(1600);
  T("rien n'avance tant qu'on n'a pas appuye", ev("test.i") === 0 && /Position 1 sur 10/.test(net($("debutEtape").textContent)));
  $("btnTestSuite").click(); await pause(60);
  T("« Suivant » amene la position 2", ev("test.i") === 1 && /Position 2 sur 10/.test(net($("debutEtape").textContent)) && pastilles() === "rate ici - - - - - - - -" && cache("btnTestSuite") && !cache("btnTestPasse"), pastilles());
  ev("(function(){const p=cheminD.placement[test.i];testReponse(legalCache.find(x=>!p.sol.includes(game.uci(x))));})()");
  T("un mauvais coup : dit nettement, la case jouee est marquee", /pas le meilleur coup/.test(net($("debutStatus").textContent)) && $("debutStatus").classList.contains("lose") && ev("Object.values(marks).includes('bad')"), $("debutStatus").textContent);
  T("le mauvais coup est repris, le bon est montre, et la phrase dit pourquoi", ev("game.history.length") === 0 && ev("selected===debutCase('g1')") && ev("marks[debutCase('g7')]") === "hint" && /protégée par ton roi/.test(net($("debutStatus").textContent)), $("debutStatus").textContent);
  T("la position reste fermee pendant l'explication", ev("legalCache.length") === 0 && ev("leconBloquee()") === true);
  T("deuxieme erreur de suite : le bouton annonce le resultat", net($("btnTestSuite").textContent) === "Voir le résultat", $("btnTestSuite").textContent);
  $("btnTestSuite").click(); await pause(100);
  T("deux erreurs de suite : le test s'arrete a la deuxieme position", ev("test.fin") === true && ev("test.rep.length") === 2);
  T("resultat sans echiquier", $("appLayout").dataset.test === "resultat" && !cache("testResultat") && cache("testActions"));
  T("les pastilles restent : deux manquees, huit jamais vues", !cache("testPastilles") && pastilles() === "rate rate - - - - - - - -", pastilles());
  T("l'arret avant la dixieme position est explique", !cache("testArret") && /arrêté après deux positions manquées de suite/.test(net($("testArret").textContent)), $("testArret").textContent);
  T("le compte est dit", /Bonnes réponses : 0 sur 10/.test(net($("debutEtape").textContent)), $("debutEtape").textContent);
  let lignes = [...w.document.querySelectorAll("#testLignes .test-ligne")].map(l => net(l.textContent));
  T("trois reglages expliques : chemin, niveau, ordinateur", lignes.length === 3 && /^Chemin/.test(lignes[0]) && /^Niveau exercices/.test(lignes[1]) && /^Ordinateur/.test(lignes[2]), lignes.join(" || "));
  T("debutant : chapitre 1, palier 1 a 700, ordinateur Debutant", /chapitre 1 : Je débute/.test(lignes[0]) && !/restent ouverts/.test(lignes[0]) && /Palier 1 \| niveau exercices 700/.test(lignes[1]) && /Débutant/.test(lignes[2]) && /700/.test(lignes[2]), lignes.join(" || "));
  T("le chemin est note tout de suite, pas les reglages", JSON.parse(w.localStorage.getItem("chang64:chemin")).p.e === "debut" && ev("prog.rating") === 800 && w.localStorage.getItem("chang64:chemin") !== avantStock);
  T("deux boutons : commencer, ou garder ses reglages", net($("btnTestAppliquer").textContent) === "Commencer le chapitre 1" && net($("btnTestGarder").textContent) === "Garder mes réglages actuels" && !$("btnTestGarder").parentNode.classList.contains("hide"));
  $("btnTestGarder").click(); await pause(500);
  T("« Garder mes reglages » : rien ne bouge, le chapitre s'ouvre", ev("prog.rating") === 800 && ev("prog.level") === 1 && ev("mode") === "debut" && ev("leconCh") === "debut" && ev("test.actif") === false && !JSON.parse(w.localStorage.getItem("chang64:chemin")).p.f);
  T("l'ecran des lecons a retrouve ses elements", !cache("debutPas") && !cache("debutTitre") && cache("testResultat") && cache("testPastilles") && $("appLayout").dataset.test === undefined);
  T("accueil : le chemin est commence", (() => { $("brand").click(); return net($("heroDebut").textContent) === "Continuer : chapitre 1"; })(), $("heroDebut").textContent);
  w.close();

  console.log("--- Un joueur qui connait les regles ---");
  w = await ouvrir("fr", { fetch: true });
  $ = id => w.document.getElementById(id); ev = s => w.eval(s);
  $("tab-apprendre").click(); await pause(500);
  $("apTestGo").click(); await pause(600);
  /* Les cinq premieres trouvees (chapitres 1 et 2), puis deux erreurs. */
  let vues = await passer(w, [true, true, true, true, true, false, null, true, true, true]);
  T("il s'arrete apres la septieme position", vues === 7 && ev("test.fin") === true, String(vues));
  T("la position avec un coup prealable a montre le pion avancer", ev("cheminD.placement[3].avant") === "d7d5" && ev("test.rep[3]") === 1);
  T("l'echiquier n'a jamais ete a l'envers, position 4 comprise", !w.__aLEnvers, JSON.stringify(w.__aLEnvers));
  T("pastilles du resultat : cinq trouvees, deux manquees, trois jamais vues", [...$("testPastilles").children].map(i => i.className || "-").join(" ") === "bon bon bon bon bon rate rate - - -");
  lignes = [...w.document.querySelectorAll("#testLignes .test-ligne")].map(l => net(l.textContent));
  T("5 sur 10 : entree au chapitre 3, les chapitres d'avant restent ouverts", /Bonnes réponses : 5 sur 10/.test(net($("debutEtape").textContent)) && /chapitre 3 : Ne rien donner/.test(lignes[0]) && /restent ouverts/.test(lignes[0]), lignes[0]);
  T("palier 1 a 800, ordinateur Debutant", /Palier 1 \| niveau exercices 800/.test(lignes[1]) && /Débutant/.test(lignes[2]), lignes.slice(1).join(" || "));
  $("btnTestAppliquer").click(); await pause(600);
  T("« Commencer le chapitre 3 » ouvre ce chapitre", ev("mode") === "debut" && ev("leconCh") === "securite");
  T("les trois chapitres sont ouverts", ev("cheminOuvert(0)&&cheminOuvert(1)&&cheminOuvert(2)") === true && dit(ev("chemin.o")) === dit(["debut", "regles", "securite"]));
  T("le chapitre a suivre est le 3, meme si le 1 n'est pas fait", ev("cheminCourant()") === 2);
  $("btnDebutFermer").click(); await pause(300);
  T("la croix ramene a l'onglet, qui propose de refaire le test", ev("mode") === "apprendre" && $("apTest").classList.contains("hide") && net($("apTestRefaire").textContent) === "Refaire le test de placement");
  const chap = [...w.document.querySelectorAll("#apChemin .ap-chap")];
  T("aucun chapitre n'est verrouille, le 3 est en cours", chap.every(b => !b.classList.contains("verrou")) && chap[2].classList.contains("encours"));
  w.close();

  console.log("--- Tout juste ---");
  w = await ouvrir("fr", { fetch: true });
  $ = id => w.document.getElementById(id); ev = s => w.eval(s);
  $("tab-apprendre").click(); await pause(500);
  $("apTestGo").click(); await pause(600);
  vues = await passer(w, [true, true, true, true, true, true, true, true, true, true]);
  T("dix positions vues, dix trouvees", vues === 10 && ev("test.res.score") === 10 && ev("test.fin") === true, vues + " / " + ev("test.res && test.res.score"));
  T("test complet : aucune phrase d'arret, dix pastilles vertes", $("testArret").classList.contains("hide") && [...$("testPastilles").children].every(i => i.className === "bon") && !w.__aLEnvers);
  lignes = [...w.document.querySelectorAll("#testLignes .test-ligne")].map(l => net(l.textContent));
  T("au-dela des chapitres sortis : ils restent ouverts, Resoudre est indique", /restent ouverts/.test(lignes[0]) && /Résoudre/.test(lignes[0]), lignes[0]);
  T("palier 6 a 1450, ordinateur Serieux a 1600", /Palier 6 \| niveau exercices 1450/.test(lignes[1]) && /Sérieux/.test(lignes[2]) && /1600/.test(lignes[2]), lignes.slice(1).join(" || "));
  T("le bouton ramene au chemin", net($("btnTestAppliquer").textContent) === "Retour au chemin");
  $("btnTestAppliquer").click(); await pause(500);
  T("les reglages sont appliques", ev("prog.level") === 6 && ev("prog.rating") === 1450 && ev("botLevel") === 3 && ev("prog.ratingHistory[prog.ratingHistory.length-1].r") === 1450);
  T("la force retenue est gardee pour les prochaines visites", JSON.parse(w.localStorage.getItem("chang64:chemin")).p.f === 3);
  T("retour a l'onglet ; plus de bouton sur l'accueil", ev("mode") === "apprendre" && ev("cheminCourant()") === -1 && $("heroDebut").classList.contains("hide"));
  T("la progression des exercices est enregistree", JSON.parse(w.localStorage.getItem("chang64:progress")).rating === 1450);
  w.close();

  console.log("--- A la visite suivante ---");
  w = await ouvrir("fr", avec({ "chang64:chemin": { v: 1, c: {}, o: ["debut", "regles"], p: { t: 1, n: 8, e: "regles", f: 2 } } }));
  $ = id => w.document.getElementById(id); ev = s => w.eval(s);
  T("la force de l'ordinateur retenue par le test est remise", ev("botLevel") === 2);
  T("accueil : « Continuer : chapitre 2 »", net($("heroDebut").textContent) === "Continuer : chapitre 2", $("heroDebut").textContent);
  w.close();

  console.log("--- Ce qui a ete gagne en jouant n'est pas ecrase ---");
  w = await ouvrir("fr", avec({ "chang64:progress": { solved: 60, level: 4, echelle: 2, rating: 1210, badges: [], eloOrdi: { r: 950, n: 4, pic: 960, h: [[1, 800], [2, 950]] } } }));
  $ = id => w.document.getElementById(id); ev = s => w.eval(s);
  T("joueur installe : palier 4, niveau 1210", ev("prog.level") === 4 && ev("prog.rating") === 1210);
  $("tab-apprendre").click(); await pause(500);
  $("apTestGo").click(); await pause(600);
  await passer(w, [null, null]);
  lignes = [...w.document.querySelectorAll("#testLignes .test-ligne")].map(l => net(l.textContent));
  T("le niveau et la force sont dits inchanges", /^Niveau exercices ?Inchangé/.test(lignes[1]) && /^Ordinateur ?Inchangée/.test(lignes[2]), lignes.slice(1).join(" || "));
  T("rien a refuser : un seul bouton", $("btnTestGarder").parentNode.classList.contains("hide"));
  $("btnTestAppliquer").click(); await pause(500);
  T("ni le palier, ni le niveau, ni la force n'ont bouge", ev("prog.level") === 4 && ev("prog.rating") === 1210 && ev("botLevel") === 2 && !JSON.parse(w.localStorage.getItem("chang64:chemin")).p.f);
  w.close();

  console.log("--- Le sens de l'echiquier ---");
  w = await ouvrir("fr", { fetch: true });
  $ = id => w.document.getElementById(id); ev = s => w.eval(s);
  ev("flipped=true");
  $("tab-apprendre").click(); await pause(500);
  $("apTestGo").click(); await pause(600);
  T("apres une partie avec les Noirs, le test repart du cote des Blancs", ev("flipped") === false);
  for (let i = 0; i < 10; i++) {
    ev("test.i=" + i + ";test.rep.length=" + i + ";for(let k=0;k<" + i + ";k++)test.rep[k]=1;testRendre()");
    await pause(ev("!!cheminD.placement[" + i + "].avant") ? 800 : 30);
    T("position " + (i + 1) + " : le camp qui repond est en bas", ev("flipped") === (ev("game.turn===B")) && ev("game.turn===W"), "flipped " + ev("flipped") + ", trait " + ev("game.turn"));
  }
  ev("test.i=3;test.rep.length=3;test.rep[0]=1;test.rep[1]=1;test.rep[2]=1;testRendre()"); await pause(800);
  ev("(function(){const p=cheminD.placement[3];testReponse(legalCache.find(x=>p.sol.includes(game.uci(x))));})()");
  T("une bonne reponse recoit aussi son explication", /^Bonne réponse\. /.test(net($("debutStatus").textContent)) && /prise en passant/.test(net($("debutStatus").textContent)) && $("debutStatus").classList.contains("win") && ev("game.history.length") === 2, $("debutStatus").textContent);
  $("btnTestSuite").click(); await pause(60);
  ev("(function(){const p=cheminD.placement[4];testReponse(legalCache.find(x=>game.uci(x)==='c7c8q'));})()");
  T("promotion manquee : le pion revient, la case d'arrivee est montree, la phrase nomme le cavalier", ev("game.history.length") === 0 && ev("selected===debutCase('c7')") && ev("marks[debutCase('c8')]") === "hint" && /promotion en cavalier/.test(net($("debutStatus").textContent)), $("debutStatus").textContent);
  w.close();

  console.log("--- Le chapitre de depart : une erreur isolee est pardonnee ---");
  /* Decision d'Alexandre (22/11) : avec 9 sur 10 et la seule position 5
     manquee, le test l'envoyait au chapitre 2. Un chapitre est acquis si
     toutes ses positions sont trouvees, ou si une seule est manquee et qu'au
     moins deux positions plus dures sont trouvees. Positions : 1 a 3 chapitre
     1, 4 et 5 chapitre 2, 6 et 7 chapitre 3, 8 a 10 au-dela. */
  w = await ouvrir("fr", { fetch: true });
  $ = id => w.document.getElementById(id); ev = s => w.eval(s);
  $("tab-apprendre").click(); await pause(500);
  $("apTestGo").click(); await pause(600);
  const entree = rep => { w.__rep = rep; return ev("(function(){test.rep=window.__rep.slice();testCalculer();return test.res.entree;})()"); };
  T("9 sur 10, la position 5 manquee : au-dela des trois chapitres", entree([1, 1, 1, 1, 0, 1, 1, 1, 1, 1]) === 3);
  T("9 sur 10, la position 2 manquee : au-dela aussi", entree([1, 0, 1, 1, 1, 1, 1, 1, 1, 1]) === 3);
  T("deux erreurs isolees dans deux chapitres, le reste trouve : au-dela", entree([0, 1, 1, 1, 1, 0, 1, 1, 1, 1]) === 3);
  T("une erreur au chapitre 1 puis rien de plus dur trouve : chapitre 1", entree([1, 0, 1, 0, 0]) === 0);
  T("les deux positions du chapitre 2 manquees : chapitre 2", entree([1, 1, 1, 0, 0]) === 1);
  T("une erreur au chapitre 2, une seule position plus dure trouvee : chapitre 2", entree([1, 1, 1, 1, 0, 1, 0, 0]) === 1);
  T("une erreur au chapitre 3, deux positions plus dures trouvees : au-dela", entree([1, 1, 1, 1, 1, 1, 0, 1, 1, 0]) === 3);
  T("une erreur au chapitre 3, une seule position plus dure trouvee : chapitre 3", entree([1, 1, 1, 1, 1, 0, 1, 1, 0, 0]) === 2);
  T("tout juste : au-dela ; rien de trouve : chapitre 1", entree([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]) === 3 && entree([0, 0]) === 0);
  T("le chapitre d'entree est note dans la progression", (() => { ev("chemin.o=[]"); entree([1, 1, 1, 1, 0, 1, 0, 0]); return JSON.stringify(ev("chemin.o")) === JSON.stringify(["debut", "regles"]) && ev("chemin.p.e") === "regles"; })(), JSON.stringify(ev("chemin.o")));
  w.close();

  console.log("--- Quitter en cours de test ---");
  w = await ouvrir("fr", { fetch: true });
  $ = id => w.document.getElementById(id); ev = s => w.eval(s);
  $("tab-apprendre").click(); await pause(500);
  $("apTestGo").click(); await pause(600);
  await passer(w, [true]);
  $("btnDebutFermer").click(); await pause(300);
  T("la croix abandonne le test sans rien regler", ev("mode") === "apprendre" && ev("test.actif") === false && w.localStorage.getItem("chang64:chemin") === null && !$("apTest").classList.contains("hide"));
  T("aucune position ne revient apres coup", ev("mode") === "apprendre" && ev("test.actif") === false);
  w.document.querySelector("#apChemin .ap-chap").click(); await pause(400);
  T("ouvrir ensuite un chapitre montre bien la lecon", ev("mode") === "debut" && !$("debutPas").classList.contains("hide") && $("testPastilles").classList.contains("hide") && net($("debutTeteTitre").textContent) === "Je débute");
  w.close();

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
