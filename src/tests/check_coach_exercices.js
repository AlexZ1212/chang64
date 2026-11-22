/* Verification automatique de chang64.
   Lancement : node tests/check_coach_exercices.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-11-22, decisions d'Alexandre par QCM) : les
   exercices tires des parties du joueur.
   - une faute expliquee dont la solution est nette devient un exercice : la
     position juste avant, « trouve mieux » ;
   - un mat manque est net par nature ; sinon il faut l'exigence stricte de
     la banque (un seul bon coup, 200 centipions devant le deuxieme), mesuree
     par Stockfish : sans cette mesure, pas d'exercice ;
   - ils vont dans « Erreurs a revoir » avec les autres, 50 au plus, la plus
     ancienne sort ; meme repetition espacee ;
   - a la fin de la relecture, « Rejouer maintenant » les enchaine ;
   - ils comptent pour l'objectif du jour et les exercices resolus, PAS pour
     le Niveau exercices ni pour le palier ;
   - ils se synchronisent avec le compte par la file existante (aucune table
     nouvelle). */
const { ouvrir } = require("./outils/page_langue.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));
const propre = s => String(s).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
const plis = (n, fautes) => "(function(){const F=" + JSON.stringify(fautes) + ",P=[];for(let i=0;i<" + n + ";i++){const f=F[i]||{};" +
  "P.push({cp:0,cpTrue:0,mate:null,loss:f.loss||0,tag:f.tag||null,best:f.best||gameUci[i],mover:i%2,rep:f.rep||null,pv:null,pvr:null});}return P;})()";

(async () => {
  const w = await ouvrir("fr", { fetch: true });
  const d = w.document, $ = id => d.getElementById(id), cache = id => $(id).classList.contains("hide");
  const file = () => JSON.parse(w.eval("JSON.stringify(prog.mistakeQueue)"));
  const jouer = u => w.eval("tryPuzzleMove(game.moves().find(m=>game.uci(m)==='" + u + "'))");
  w.eval("ensureProgFields();prog.rating=1000;prog.level=3;prog.solved=10;prog.correctRun=2;prog.wrongRun=1;" +
    "prog.mistakeQueue=[{id:777,theme:'Pin',code:'ABC',ts:5,box:1,due:5}];saveProg()");

  console.log("Un mat en un manque devient un exercice");
  const JOUR = Date.UTC(2026, 10, 20, 12);
  w.eval("ouvrirPartieGardee({m:'e2e4 e7e5 f1c4 b8c6 d1h5 g8f6 h5f3 c6d4 f3d3 d7d5',c:'w',t:" + JOUR + ",k:'o'},'jeu')");
  w.eval("(function(){const P=" + plis(10, { 6: { tag: "blunder", loss: 1200, best: "h5f7" } }) + ";finishAnalysis(P,coachPreparerSansMoteur(P));})()");
  await pause(150);
  let q = file();
  const e1 = q.find(m => m.pj);
  T("une entree de plus dans la file des erreurs", q.length === 2 && !!e1, JSON.stringify(q));
  T("elle porte la position d'avant la faute, la solution, le coup joue", e1 && e1.pj.f === "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4" && e1.pj.s === "h5f7" && e1.pj.j === "h5f3" && e1.pj.y === "m" && e1.pj.n === 1, JSON.stringify(e1));
  T("la date de la partie relue et le numero du coup", e1 && e1.pj.d === JOUR && e1.pj.k === 4);
  T("elle est due tout de suite, au premier palier", e1 && e1.box === 1 && e1.due <= Date.now() && typeof e1.id === "string" && /^pj/.test(e1.id));
  T("le bloc du coach l'annonce", !cache("coachExoNote") && propre($("coachExoNote").textContent) === "1 position de cette partie est dans tes Erreurs à revoir.", $("coachExoNote").textContent);
  T("« Rejouer maintenant » est propose", !cache("btnCoachRejouer") && propre($("btnCoachRejouer").textContent) === "Rejouer maintenant", $("btnCoachRejouer").textContent);
  T("la carte « Erreurs a revoir » compte les deux", !cache("mistakeSection") && propre(d.querySelector("#mistakeGrid .erreurs-n").textContent) === "2", $("mistakeGrid").textContent);
  w.eval("(function(){const P=" + plis(10, { 6: { tag: "blunder", loss: 1200, best: "h5f7" } }) + ";finishAnalysis(P,coachPreparerSansMoteur(P));})()");
  await pause(100);
  T("relire la meme partie ne double pas l'entree", file().filter(m => m.pj).length === 1);

  console.log("Rejouer maintenant");
  $("btnCoachRejouer").click();
  await pause(500);
  T("on passe a l'ecran d'exercice", w.eval("mode") === "puzzles" && w.eval("puzzle&&puzzle.id") === e1.id && w.eval("game.fen()") === e1.pj.f, w.eval("mode") + " " + w.eval("puzzle&&puzzle.id"));
  T("pas de motif affiche : « Tire de ta partie »", propre($("exTheme").textContent) === "Tiré de ta partie", $("exTheme").textContent);
  T("la consigne : le coup joue, trouve mieux", /^Tu avais joué .*f3\. Trouve mieux !$/.test(propre($("exQuest").textContent)), $("exQuest").textContent);
  T("le camp au trait", propre($("exStatus").textContent) === "À toi. Les Blancs jouent.", $("exStatus").textContent);
  T("d'ou vient la position", propre($("exExplain").textContent) === "Partie du 20/11, coup 4.", $("exExplain").textContent);
  T("la bulle dit que le Niveau exercices ne bouge pas", /ne change pas ton Niveau exercices/.test(propre($("tipStrength").textContent)), $("tipStrength").textContent);
  jouer("a2a3");
  await pause(900);
  T("un mauvais coup : ni Niveau exercices ni palier ne bougent", w.eval("prog.rating") === 1000 && w.eval("prog.level") === 3 && w.eval("prog.correctRun") === 2 && w.eval("prog.wrongRun") === 1, w.eval("prog.rating+'/'+prog.level+'/'+prog.correctRun+'/'+prog.wrongRun"));
  const jourAvant = w.eval("prog.dayCountDate===todayKey()?prog.dayCount:0");
  jouer("h5f7");
  await pause(500);
  T("le mat est accepte", w.eval("puzzleDone") === true && $("exStatus").classList.contains("win") && /mat/.test(propre($("exStatus").textContent)), $("exStatus").textContent);
  T("il compte pour les exercices resolus", w.eval("prog.solved") === 11, w.eval("prog.solved"));
  T("et pour l'objectif du jour", w.eval("prog.dayCount") === jourAvant + 1, w.eval("prog.dayCount"));
  T("pas pour le Niveau exercices", w.eval("prog.rating") === 1000 && !/Niveau exercices\)/.test(propre($("exStatus").textContent)), w.eval("prog.rating") + " " + $("exStatus").textContent);
  T("ni pour le palier", w.eval("prog.level") === 3 && w.eval("prog.correctRun") === 2 && w.eval("prog.wrongRun") === 1 && w.eval("echelleGelee") === false, w.eval("prog.level+'/'+prog.correctRun+'/'+prog.wrongRun"));
  T("le coach redit pourquoi", /^Il y avait mat en un coup : .*xf7#\. Partie du 20\/11, coup 4\.$/.test(propre($("exExplain").textContent)), $("exExplain").textContent);
  q = file();
  const apres = q.find(m => m.id === e1.id);
  T("repetition espacee : palier suivant, a revoir demain", apres && apres.box === 2 && apres.due > Date.now() + 20 * 3600000, JSON.stringify(apres));

  console.log("Un gain : le message ne promet pas du materiel");
  w.eval("prog.mistakeQueue.push({id:'pjtest1',theme:'Winning move',code:'',ts:Date.now(),box:1,due:Date.now()," +
    "pj:{f:'r1bqkb1r/pppp1pp1/2n2n1p/4p1B1/2B1P3/3P4/PPP2PPP/RN1QK1NR w KQkq - 0 5',s:'g5h4',y:'g',n:1,j:'b1c3',d:" + JOUR + ",k:5," +
    "e:{cas:'en_prise',de:'apres',variante:'libre',deja:true,piece:{p:'b',sq:'g5'},attaquant:{p:'p',sq:'h6'},coup:'h6g5',mieux:'g5h4'}}});retryMistake('pjtest1')");
  await pause(500);
  T("la position se charge depuis la file", w.eval("puzzle&&puzzle.id") === "pjtest1" && w.eval("puzzle.type") === "gain");
  jouer("g5h4");
  await pause(500);
  T("« c'etait le coup », pas « materiel gagne »", /^.*h4 : c'était le coup\. Bien trouvé !$/.test(propre($("exStatus").textContent)) && !/matériel|pièce de plus|gratuit/.test(propre($("exStatus").textContent)), $("exStatus").textContent);
  T("la phrase du coach, pas une phrase tiree de la seule solution", /^Le fou en g5 était déjà attaqué et rien ne le défend : hxg5 le prend\. Partie du 20\/11, coup 5\.$/.test(propre($("exExplain").textContent)), $("exExplain").textContent);
  T("le Niveau exercices n'a toujours pas bouge", w.eval("prog.rating") === 1000 && w.eval("prog.ratingHistory.length") === 0, w.eval("prog.rating+'/'+prog.ratingHistory.length"));

  console.log("L'exigence stricte, mesuree par Stockfish");
  const PARTIE = "ouvrirPartieGardee({m:'e2e4 e7e5 g1f3 d8g5 b1c3 g5g2',c:'w',t:" + JOUR + ",k:'o'},'jeu')";
  const FAUTE = { 4: { tag: "blunder", loss: 900, best: "f3g5", rep: "g5g2" } };
  const mesurer = async lignes => {
    w.eval(PARTIE + ";sfDeuxLignes=async function(){return " + JSON.stringify(lignes) + ";}");
    return JSON.parse(await w.eval("(async function(){const P=" + plis(6, FAUTE) + ";const r=await coachPreparer(P);return JSON.stringify({cas:r.coach[4].e&&r.coach[4].e.cas,exos:r.exos.map(x=>x.ex.sol[0])});})()"));
  };
  let r = await mesurer([{ cp: 800, mate: null, coup: "f3g5" }, { cp: 100, mate: null, coup: "d2d4" }]);
  T("un seul bon coup, 700 devant : exercice", r.cas === "prise_manquee" && r.exos.join() === "f3g5", JSON.stringify(r));
  r = await mesurer([{ cp: 800, mate: null, coup: "f3g5" }, { cp: 650, mate: null, coup: "d2d4" }]);
  T("deuxieme coup a 150 : pas d'exercice", r.exos.length === 0, JSON.stringify(r));
  r = await mesurer([{ cp: 800, mate: null, coup: "d2d4" }, { cp: 100, mate: null, coup: "f3g5" }]);
  T("les deux lignes designent un autre coup : pas d'exercice", r.exos.length === 0, JSON.stringify(r));
  r = await mesurer(null);
  T("le moteur n'a pas repondu : pas d'exercice", r.exos.length === 0, JSON.stringify(r));
  w.eval(PARTIE);
  T("sans Stockfish : seuls les mats, donc aucun ici", w.eval("(function(){const P=" + plis(6, FAUTE) + ";return coachPreparerSansMoteur(P).exos.length;})()") === 0);

  console.log("50 positions au plus, la plus ancienne sort");
  w.eval("prog.mistakeQueue=[{id:777,theme:'Pin',code:'ABC',ts:5,box:1,due:5}];" +
    "for(let k=0;k<12;k++){const c=[];for(let j=0;j<5;j++){const n=k*5+j;c.push({i:6,fen:'8/8/8/8/8/k7/'+(n%8+1)+'p'+(6-n%8)+'/K'+(Math.floor(n/8)+1)+'N'+(5-Math.floor(n/8))+' w - - '+n+' 1',joue:'a1b1',e:{cas:'mat1_manque',de:'avant',coup:'a1a2'},ex:{type:'mate',n:1,sol:['a1a2'],theme:'Mate in one'}});}" +
    "const av=Date.now;Date.now=()=>1000000+k;coachEnregistrer(c);Date.now=av;}");
  q = file();
  T("60 positions proposees, 50 gardees", q.filter(m => m.pj).length === 50, q.filter(m => m.pj).length);
  T("ce sont les plus recentes", Math.min.apply(null, q.filter(m => m.pj).map(m => m.ts)) === 1000002, Math.min.apply(null, q.filter(m => m.pj).map(m => m.ts)));
  T("l'erreur d'exercice de la banque n'est pas touchee", q.some(m => m.id === 777) && q.length === 51);

  console.log("Synchronisation avec le compte : la file existante suffit");
  const fus = JSON.parse(w.eval("JSON.stringify(cpFusionProg({mistakeQueue:[{id:'pjaaa',theme:'Mate in one',code:'',ts:10,box:1,due:10,pj:{f:'x',s:'a1a2',y:'m',n:1,j:'a1b1',d:1,k:3}}]},{mistakeQueue:[{id:42,theme:'Pin',code:'Z',ts:5,box:2,due:99}]},null,false).mistakeQueue)"));
  T("une position venue d'un autre appareil arrive entiere", fus.length === 2 && fus.some(m => m.id === "pjaaa" && m.pj && m.pj.f === "x" && m.pj.s === "a1a2") && fus.some(m => m.id === 42), JSON.stringify(fus));
  T("un identifiant inconnu ne casse rien", w.eval("coachPuzzle('pjinconnu')") === null && w.eval("coachPuzzle(777)") === null);
  let recu = "rien";
  w.cb = p => { recu = p; };
  w.eval("loadPuzzleById('pjinconnu',window.cb)");
  await pause(700);
  T("la banque repond « introuvable » pour lui, comme avant", recu === null || recu === undefined, String(recu));

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception " + (e && e.stack || e)); process.exit(1); });
