/* Verification automatique de chang64.
   Lancement : node tests/<fichier>.js  (depuis la racine des sources)
   Le site doit avoir ete construit au prealable : node build_site.js */
const path=require("path");
const SITE = path.join(__dirname, "..", "site");
const BASE = process.env.CHANG64_BASELINE || "";   /* site deja en ligne, facultatif */
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(""+SITE+"/index.html","utf8");
const NPUZ=JSON.parse(fs.readFileSync(require("path").join(__dirname,"..","puzzles.json"),"utf8")).length;
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
/* fetchJSON (ui.js) fait un vrai fetch("/data/level-N.json") resolu contre
   l'URL de base fictive "https://chang64.com/" : sans ce garde, le test
   tentait un appel reseau reel vers la production a chaque niveau charge,
   ce qui echoue dans un environnement sans acces sortant vers ce domaine et
   qui, meme quand ca reussirait ailleurs, testerait les donnees DEJA EN
   LIGNE plutot que celles du build local qu'on vient de generer. On sert
   donc "/data/..." depuis les fichiers locaux de site/data/. */
function stubFetch(w){
  w.fetch=(url)=>{
    const p=path.join(SITE,String(url).replace(/^https?:\/\/[^/]+/,""));
    try{ const data=JSON.parse(fs.readFileSync(p,"utf8")); return Promise.resolve({ok:true,json:()=>Promise.resolve(data)}); }
    catch(e){ return Promise.resolve({ok:false,status:404}); }
  };
}
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole()});
const w=dom.window,d=w.document;
stubFetch(w);
setTimeout(async()=>{
  console.log("\n--- La banque est bien chargee ---");
  const hc=d.getElementById("hCount");
  T("compteur d'exercices en page d'accueil", hc && +hc.textContent===NPUZ, hc&&hc.textContent);

  console.log("\n--- Le filtre par theme propose les nouveaux motifs ---");
  /* tab-train et son "Defis" ont disparu le 2026-09-03 (menu a 5 cartes) :
     themeFilter vit desormais dans l'onglet Puzzles, atteint via sa carte. */
  d.getElementById("tab-puzzles").click();
  await new Promise(r=>setTimeout(r,300));
  d.getElementById("cardSolvePuzzles").click();
  await new Promise(r=>setTimeout(r,400));
  const sel=d.getElementById("themeFilter");
  const opts=[...sel.options].map(o=>o.textContent);
  T("filtre peuple", opts.length>5, opts.length+" entrees");
  T("Clouage propose", opts.some(o=>/Pin/.test(o)), opts.filter(o=>/Pin/.test(o))[0]);
  T("Enfilade proposee", opts.some(o=>/Skewer/.test(o)), opts.filter(o=>/Skewer/.test(o))[0]);

  console.log("\n--- Un exercice se charge et se resout ---");
  const fen=d.getElementById("board");
  T("echiquier construit", fen && fen.children.length===64, fen&&fen.children.length);
  const st=d.getElementById("status");
  T("un exercice est propose", (st.textContent||"").length>0, (st.textContent||"").slice(0,50));

  console.log("\n--- Explication apres resolution (pas avant, pas apres un echec) ---");
  /* PUZZLES etait un tableau global embarque, remplace depuis la refonte en
     donnees par niveau charge a la demande (LEVEL_CACHE/PUZZLE_CACHE,
     "10 patterns, 3 examples each") : ce nom n'existe plus. On travaille sur
     p23, verifie present dans puzzles.json et porteur d'un explain.piece.
     Mis a jour le 2026-09-06 : son niveau etait ecrit en dur (4). Le
     redecoupage des niveaux par famille l'a deplace, et le test s'est mis a
     charger un shard qui ne le contenait plus. Le commentaire d'origine
     disait vouloir ne pas dependre du contenu d'un niveau : il en dependait
     entierement. On lit desormais son niveau dans puzzle-index.json, que le
     site publie justement pour ca. */
  d.getElementById("tab-puzzles").click();
  await new Promise(r=>setTimeout(r,300));
  d.getElementById("cardSolvePuzzles").click();
  await new Promise(r=>setTimeout(r,300));
  /* Mis a jour le 2026-09-06, deuxieme fois : apres le decoupage des shards,
     l'index rend [niveau, morceau] et charger le niveau ne charge plus que
     son premier morceau, ou p23 n'est pas forcement. loadPuzzleById va
     chercher le bon morceau et c'est la seule bonne facon d'atteindre un
     exercice precis. Le niveau ecrit en dur, puis le niveau lu dans l'index,
     ont chacun casse a leur tour : ne remets pas de chemin plus court ici. */
  w.eval('loadPuzzleById("p23", function(){})');
  await new Promise(r=>setTimeout(r,800));
  const withExplain=w.eval('PUZZLE_CACHE["p23"]&&PUZZLE_CACHE["p23"].explain&&PUZZLE_CACHE["p23"].explain.piece');
  T("un exercice avec detail exploitable existe", !!withExplain);
  w.eval('puzzle=PUZZLE_CACHE["p23"]; loadPuzzle();');
  T("rien avant resolution", d.getElementById("exExplain").textContent==="");
  w.eval('finishPuzzle(true,"test")');
  T("explication citant la case reelle apres une reussite",
    new RegExp(w.eval('puzzle.explain.sq')).test(d.getElementById("exExplain").textContent),
    d.getElementById("exExplain").textContent);
  w.eval('loadPuzzle()');
  T("effacee au chargement de l'exercice suivant", d.getElementById("exExplain").textContent==="");
  w.eval('finishPuzzle(false,"test")');
  T("rien apres un echec", d.getElementById("exExplain").textContent==="");
  w.eval('rush={score:0,strikes:0,history:[]}; finishPuzzle(true,"test"); rush=null;');
  T("aucune explication pendant un sprint", d.getElementById("exExplain").textContent==="");

  console.log("\n--- Filtrer sur Clouage donne bien des exercices ---");
  const pin=[...sel.options].find(o=>/Pin/.test(o.textContent));
  sel.value=pin.value;
  sel.dispatchEvent(new w.Event("change",{bubbles:true}));
  await new Promise(r=>setTimeout(r,400));
  T("le filtre ne casse pas l'exercice", d.getElementById("board").children.length===64);
  T("statut toujours renseigne", (d.getElementById("status").textContent||"").length>0);

  console.log("\n--- Le bouton d'aide a deux etats ---");
  /* Un seul bouton : "Indice" surligne la piece a jouer, puis le meme bouton
     devient "Voir la solution" et donne le coup complet. Ca libere une place
     dans une rangee chargee sur telephone et impose de tenter avec un coup de
     pouce avant d'obtenir la reponse. Les deux coutent la meme chose :
     l'exercice ne compte plus comme resolu du premier coup. */
  /* L'aide n'agit que sur l'onglet Exercices, avec un exercice charge. */
  d.getElementById("tab-puzzles").click();
  await new Promise(r=>setTimeout(r,700));
  T("un seul bouton d'aide", !d.getElementById("btnSolve"));
  const aide=d.getElementById("btnHintEx");
  T("libelle initial Indice", /Hint|Indice/i.test(aide.textContent), aide.textContent);
  aide.click(); await new Promise(r=>setTimeout(r,400));
  T("devient Voir la solution", /solution/i.test(aide.textContent), aide.textContent);
  T("la piece a jouer est surlignee", d.querySelectorAll(".sq.hint").length===1,
    String(d.querySelectorAll(".sq.hint").length));
  aide.click(); await new Promise(r=>setTimeout(r,400));
  T("le coup complet est donne", d.querySelectorAll(".sq.hint").length===2,
    String(d.querySelectorAll(".sq.hint").length));
  T("la reponse est annoncee", /answer|réponse|solution/i.test(d.getElementById("exStatus").textContent),
    d.getElementById("exStatus").textContent.slice(0,50));
  d.getElementById("btnNext").click(); await new Promise(r=>setTimeout(r,600));
  T("revient a Indice a l'exercice suivant", /Hint|Indice/i.test(aide.textContent), aide.textContent);
  T("surlignage efface", d.querySelectorAll(".sq.hint").length===0);

  console.log("\n--- Chang Sprint se joue sans quitter Defis ---");
  /* Le sprint pilote le bloc de l'exercice (chronometre, enonce, statut), qui
     vit dans l'onglet Exercices. Comme l'echiquier est partage entre les
     onglets, on deplace ce bloc dans Defis le temps du sprint plutot que de
     basculer d'onglet. Il doit imperativement revenir a sa place, sinon
     l'onglet Exercices se retrouverait vide. */
  const ou=()=>d.getElementById("pane-train").contains(d.getElementById("exPanel"))?"train"
    :(d.getElementById("pane-puzzles").contains(d.getElementById("exPanel"))?"puzzles":"perdu");
  d.getElementById("cardSolveSprint").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,500));
  /* Un overlay attend desormais le feu vert avant de lancer le sprint. */
  if(!d.getElementById("readyBanner").classList.contains("hide")){
    d.getElementById("readyStart").click();
    await new Promise(r=>setTimeout(r,500));
  }
  T("on reste dans Defis", !d.getElementById("pane-train").classList.contains("hide"));
  T("le bloc de l'exercice y est deplace", ou()==="train", ou());
  T("la barre de score est visible", !d.getElementById("rushBar").classList.contains("hide"));
  T("l'echiquier est charge", d.querySelectorAll(".sq .piece").length>1);
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,300));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,600));
  T("le bloc revient a sa place a l'arret", ou()==="puzzles", ou());
  /* second cas : on quitte Defis pendant un sprint */
  d.getElementById("cardSolveSprint").click();
  await new Promise(r=>setTimeout(r,300));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,600));
  d.getElementById("tab-puzzles").click();
  await new Promise(r=>setTimeout(r,700));
  T("le bloc revient si on quitte Defis", ou()==="puzzles", ou());
  T("l'onglet Exercices n'est jamais vide",
    d.getElementById("pane-puzzles").querySelectorAll(".panel,.repliable").length>=3,
    String(d.getElementById("pane-puzzles").querySelectorAll(".panel,.repliable").length));

  console.log("\n--- Les epreuves chronometrees attendent le feu vert ---");
  /* Meme principe que les parties : trois minutes pour le sprint, trente
     secondes pour les coordonnees, rien ne doit demarrer avant que le joueur
     soit pret. On reutilise l'overlay des parties plutot que d'inventer un
     second motif, et le sous-titre annonce la regle, qui n'etait nulle part. */
  d.getElementById("cardSolveSprint").click();
  await new Promise(r=>setTimeout(r,500));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,500));
  T("overlay avant le sprint", !d.getElementById("readyBanner").classList.contains("hide"));
  T("la regle est annoncee", /minute|erreur|wrong/i.test(d.getElementById("readySub").textContent),
    d.getElementById("readySub").textContent);
  T("'Changer les reglages' masque", d.getElementById("readySettings").classList.contains("hide"));
  T("le sprint n'a pas demarre", !w.eval("(typeof rush!=='undefined'&&rush)?true:false"));
  d.getElementById("readyStart").click();
  await new Promise(r=>setTimeout(r,500));
  T("il demarre au feu vert", !!w.eval("rush"));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,300));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,500));

  d.getElementById("cardSolveCoord").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("btnCoord").click();
  await new Promise(r=>setTimeout(r,500));
  T("overlay avant les coordonnees", !d.getElementById("readyBanner").classList.contains("hide"));
  T("le chrono n'a pas demarre", !w.eval("typeof coord!=='undefined'&&coord"));
  d.getElementById("readyStart").click();
  await new Promise(r=>setTimeout(r,400));
  T("il demarre au feu vert", !!w.eval("coord"));

  console.log("\n--- Pendant un sprint, l'interface se reduit a l'essentiel ---");
  /* Le mode exercice normal affiche des commandes et des compteurs qui n'ont
     pas de sens dans une epreuve chronometree : "Exercice suivant" sortirait
     de la file du sprint et chargerait un exercice du mode normal, l'indice
     serait une aide, et la progression par niveau ne s'applique pas puisque
     le sprint enchaine tous les niveaux. Il a ses propres compteurs en haut. */
  d.getElementById("cardSolveSprint").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("readyStart").click();
  await new Promise(r=>setTimeout(r,600));
  /* On remonte toute la chaine : l'element peut etre masque par un ancetre
     eloigne, pas seulement par son parent direct. */
  const cache=id=>{
    let e=d.getElementById(id);
    if(!e)return true;
    while(e&&e!==d.body){
      if(w.getComputedStyle(e).display==="none")return true;
      e=e.parentElement;
    }
    return false;
  };
  T("chronometre visible", !d.getElementById("rushBar").classList.contains("hide"));
  /* L'enonce est desormais masque aussi : dans un defi, annoncer "Mat en un
     coup" revient a donner la reponse. Seul le statut reste, pour les retours
     immediats. */
  T("enonce masque", cache("exQuest"));
  T("statut visible", !cache("exStatus"));
  T("'Exercice suivant' masque", cache("btnNext"));
  T("'Indice' masque", cache("btnHintEx"));
  T("progression par niveau masquee", cache("ladder"));
  T("compteurs du mode normal masques", cache("stSolved"));
  T("le statut ne repete plus la regle",
    !/Rush|trois échecs|three misses/i.test(d.getElementById("exStatus").textContent),
    d.getElementById("exStatus").textContent.slice(0,40));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,300));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,500));
  d.getElementById("tab-puzzles").click();
  await new Promise(r=>setTimeout(r,300));
  /* Depuis le 2026-09-03, cliquer sur l'onglet Resoudre sans preciser
     d'ecran montre toujours le menu a 5 cartes, jamais directement un
     exercice (voir setMode(), ui.js) : c'est le comportement voulu, pas un
     residu a contourner. Pour retrouver btnNext/stSolved, il faut donc
     rechoisir la carte Puzzles, comme un utilisateur le ferait. */
  d.getElementById("cardSolvePuzzles").click();
  await new Promise(r=>setTimeout(r,400));
  T("tout revient apres le sprint", !cache("btnNext") && !cache("stSolved"));

  console.log("\n--- Le sprint enchaine bien les exercices ---");
  /* Le sprint lance depuis Defis tourne avec mode==="train". Or ui3.js
     redefinit onSquare et envoie tous les clics de ce mode vers
     handleTrainClick, qui gere les finales et les coordonnees : le coup etait
     joue sur l'echiquier mais jamais reconnu comme solution, et l'exercice ne
     passait jamais au suivant. */
  d.getElementById("cardSolveSprint").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("readyStart").click();
  await new Promise(r=>setTimeout(r,600));
  {
    const cells=[...d.querySelectorAll(".sq")];
    /* Certains exercices sont des mats en plusieurs coups : un seul coup ne
       les resout pas. On joue donc la solution jusqu'a ce que l'exercice
       change, sans quoi le test reussit ou echoue selon le tirage. */
    const jouerSolution=async()=>{
      const depart=w.eval("puzzle.id");
      for(let essai=0;essai<10;essai++){
        /* Attendre que le moteur ait fini de repondre : cliquer pendant que
           busy est vrai fait ignorer le clic, et l'exercice semble bloque. */
        for(let g=0;g<20&&w.eval("busy");g++)await new Promise(x=>setTimeout(x,80));
        const r=w.eval('(function(){var m=currentSolutions()[0];if(!m)return "null";'+
          'var idx=function(sq){for(var i=0;i<64;i++)if(idxToSq(i)===sq)return i;return -1;};'+
          'return JSON.stringify({a:idx(m.from),b:idx(m.to)});})()');
        if(r==="null")break;
        const i=JSON.parse(r);
        cells[i.a].click(); await new Promise(x=>setTimeout(x,160));
        cells[i.b].click(); await new Promise(x=>setTimeout(x,1200));
        if(w.eval("puzzle.id")!==depart)break;
      }
    };
    const premier=w.eval("puzzle.id");
    await jouerSolution();
    T("l'exercice change apres une bonne reponse", w.eval("puzzle.id")!==premier,
      premier+" -> "+w.eval("puzzle.id"));
    T("le score monte", d.getElementById("rushScore").textContent!=="0",
      d.getElementById("rushScore").textContent);
    /* On ne verifie pas un second point : certains exercices sont des mats en
       plusieurs coups, et la reponse de l'adversaire rend la duree variable.
       Ce qui compte est que le sprint continue d'accepter les coups, c'est
       exactement ce qui etait casse quand les clics partaient vers le
       gestionnaire des finales. */
    const avant=w.eval("game.history.length");
    await jouerSolution();
    T("le sprint continue d'accepter les coups",
      w.eval("game.history.length")!==avant || Number(d.getElementById("rushScore").textContent)>=2);
    T("et il est toujours en cours", !!w.eval("rush"));
  }
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,300));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,500));
  {const b=d.getElementById("resultBanner"); if(!b.classList.contains("hide"))d.getElementById("resultClose").click();}
  await new Promise(r=>setTimeout(r,300));

  console.log("\n--- Chang Sprint est un defi, pas un entrainement ---");
  /* Quatre corrections : le thème et l'enonce revelaient la reponse ("Mat en
     un coup"), la progression par niveau s'incrementait et annoncait "Tu
     passes au niveau 2" au milieu du defi, le bouton ne permettait pas
     d'abandonner, et la file etait ordonnee par niveau donc composee a 97%
     de mats en un coup au debut. */
  d.getElementById("cardSolveSprint").click();
  await new Promise(r=>setTimeout(r,400));
  {
    const niv=w.eval("prog.level"), res=w.eval("prog.solved");
    const bt=d.getElementById("btnGoRush");
    bt.click(); await new Promise(r=>setTimeout(r,400));
    /* Signale : sous l'ecran "Ready when you are" (qui ne recouvre que
       l'echiquier), on voyait encore l'enonce complet, les boutons Exercice
       suivant/Indice et le niveau/statistiques d'Exercices, avec en plus le
       code de l'exercice vide si Defis etait visite avant Exercices. La vue
       reduite doit s'appliquer des ce premier clic, pas seulement apres
       avoir confirme "Start". */
    T("rien d'Exercices ne fuite sous l'ecran Ready (theme)",
      w.getComputedStyle(d.getElementById("exTheme")).display==="none");
    T("rien d'Exercices ne fuite sous l'ecran Ready (niveau/stats)",
      w.getComputedStyle(d.getElementById("lvlNum").closest(".hors-sprint")).display==="none");
    T("le code de l'exercice n'est pas vide sous l'ecran Ready",
      d.getElementById("exCode").textContent.length>0, JSON.stringify(d.getElementById("exCode").textContent));
    d.getElementById("readyStart").click(); await new Promise(r=>setTimeout(r,600));

    const masque=id=>{let e=d.getElementById(id);
      while(e&&e!==d.body){if(w.getComputedStyle(e).display==="none")return true;e=e.parentElement;}return false;};
    T("le theme est masque", masque("exTheme"));
    T("l'enonce est masque", masque("exQuest"));
    T("le bouton devient un abandon", /Give up|Abandonner/i.test(bt.textContent), bt.textContent);
    T("avec les codes d'alerte", bt.classList.contains("danger"));
    /* Place au-dessus de l'echiquier, le bouton sortait de l'ecran des qu'on
       regardait le plateau : on ne trouvait plus comment arreter. Il descend
       donc sous l'echiquier pendant le sprint. */
    {
      const slot=d.getElementById("rushSlot");
      const rangee=bt.closest(".btnrow");
      const pane=d.getElementById("pane-train");
      const kids=[...pane.querySelectorAll("*")];
      T("le bouton passe sous l'echiquier", kids.indexOf(slot)<kids.indexOf(rangee),
        "echiquier "+kids.indexOf(slot)+", bouton "+kids.indexOf(rangee));
      const desc=[...bt.closest(".panel").children].filter(x=>x.tagName==="P");
      T("la description se masque", desc.length>0&&desc.every(x=>w.getComputedStyle(x).display==="none"));
    }

    /* variete : la file alterne les themes au lieu de grouper par niveau */
    const themes=w.eval("new Set(rush.queue.slice(0,20).map(function(p){return p.theme;})).size");
    T("au moins 5 themes dans les 20 premiers", themes>=5, themes+" themes");

    /* Le statut annonce "Trouve le coup gagnant" (singulier) : un mat en
       deux coups demande de jouer, attendre la reponse du moteur, puis en
       trouver un second. Un joueur se retrouvait donc a jouer plusieurs
       coups sur un exercice alors qu'on lui en avait promis un seul. La
       file du sprint ne doit donc plus contenir aucun mat a plus d'un coup. */
    const multiCoups=w.eval('rush.queue.filter(function(p){return p.type==="mate"&&p.n>1;}).length');
    T("aucun mat a plusieurs coups dans la file du sprint", multiCoups===0, multiCoups+" sur "+w.eval("rush.queue.length"));

    /* resoudre trois exercices ne doit pas toucher la progression */
    const cells=[...d.querySelectorAll(".sq")];
    for(let k=0;k<3;k++){
      const r=w.eval('(function(){var m=currentSolutions()[0];if(!m)return "null";'+
        'var idx=function(sq){for(var i=0;i<64;i++)if(idxToSq(i)===sq)return i;return -1;};'+
        'return JSON.stringify({a:idx(m.from),b:idx(m.to)});})()');
      if(r==="null")break;
      const i=JSON.parse(r);
      cells[i.a].click(); await new Promise(x=>setTimeout(x,160));
      cells[i.b].click(); await new Promise(x=>setTimeout(x,1200));
    }
    T("le niveau ne bouge pas", w.eval("prog.level")===niv, niv+" -> "+w.eval("prog.level"));
    T("le compteur de resolus non plus", w.eval("prog.solved")===res, res+" -> "+w.eval("prog.solved"));
    T("aucun message de passage de niveau",
      !/niveau|level/i.test(d.getElementById("exStatus").textContent),
      d.getElementById("exStatus").textContent.slice(0,40));

    /* l'abandon demande confirmation, comme pour une partie */
    bt.click(); await new Promise(r=>setTimeout(r,300));
    T("premier clic : demande confirmation", bt.classList.contains("armed"));
    T("le sprint tourne encore", !!w.eval("rush"));
    bt.click(); await new Promise(r=>setTimeout(r,600));
    T("second clic : le sprint s'arrete", !w.eval("(typeof rush!=='undefined'&&rush)?true:false"));
    {const b=d.getElementById("resultBanner"); if(!b.classList.contains("hide"))d.getElementById("resultClose").click();}
    await new Promise(r=>setTimeout(r,300));
  }

  console.log("\n--- Une seule epreuve a la fois ---");
  /* Passer d'une epreuve a l'autre laissait la premiere tourner : son
     chronometre continuait de decompter en arriere-plan et son bandeau
     restait affiche au-dessus de celui de la nouvelle. */
  d.getElementById("cardSolveSprint").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("readyStart").click();
  await new Promise(r=>setTimeout(r,500));
  /* Signale : demarrer Coordonnees ne defilait jamais vers l'echiquier,
     contrairement a Chang Sprint et aux finales qui appellent focusBoard().
     On espionne l'appel plutot que la position d'ecran, que jsdom ne
     calcule pas reellement (verifie en conditions reelles avec Chrome). */
  const appele=w.eval('(function(){window.__fb=false; const orig=focusBoard; focusBoard=function(){window.__fb=true; return orig.apply(this,arguments);}; return true;})()');
  d.getElementById("btnCoord").click();
  await new Promise(r=>setTimeout(r,600));
  T("demarrer Coordonnees defile vers l'echiquier (focusBoard appele)", w.eval("window.__fb")===true);
  T("le sprint est arrete", !w.eval("(typeof rush!=='undefined'&&rush)?true:false"));
  T("son bandeau disparait", d.getElementById("rushBar").classList.contains("hide"));
  T("pas de bandeau de fin superpose", d.getElementById("resultBanner").classList.contains("hide"));
  T("l'overlay des coordonnees s'affiche", !d.getElementById("readyBanner").classList.contains("hide"));
  d.getElementById("readyStart").click();
  await new Promise(r=>setTimeout(r,500));
  /* et dans l'autre sens */
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,600));
  T("les coordonnees sont arretees", !w.eval("(typeof coord!=='undefined'&&coord)?true:false"));
  T("leur bandeau disparait", d.getElementById("coordHud").classList.contains("hide"));
  d.getElementById("readyStart").click();
  await new Promise(r=>setTimeout(r,500));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,300));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,500));
  {const b=d.getElementById("resultBanner"); if(!b.classList.contains("hide"))d.getElementById("resultClose").click();}
  await new Promise(r=>setTimeout(r,300));

  console.log("\n--- Bilan de fin de sprint : revoir ou on s'est trompe ---");
  d.getElementById("cardSolveSprint").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("readyStart").click();
  await new Promise(r=>setTimeout(r,500));
  w.eval('finishPuzzle(true,"ok");');
  await new Promise(r=>setTimeout(r,800));
  w.eval('onPuzzleWrong();');
  await new Promise(r=>setTimeout(r,800));
  w.eval('onPuzzleWrong();');
  await new Promise(r=>setTimeout(r,800));
  w.eval('rushEnd("Time is up.");');
  await new Promise(r=>setTimeout(r,300));
  const chips=[...d.getElementById("rushHistory").querySelectorAll("button")];
  T("une pastille par exercice tente", chips.length===3, chips.length);
  T("code couleur reussi/rate respecte", chips[0].className==="win"&&chips[1].className==="loss"&&chips[2].className==="loss",
    chips.map(c=>c.className).join(","));
  T("symboles corrects", chips[0].textContent==="✓"&&chips[1].textContent==="✗",
    chips.map(c=>c.textContent).join(","));
  T("carre a bords arrondis, comme le selecteur de langue", w.eval('getComputedStyle(document.querySelector("#rushHistory button")).borderRadius')==="6px");
  T("note expliquant qu'on peut toucher une pastille", !d.getElementById("rushHistoryNote").classList.contains("hide") &&
    /solved|resoudre|resolu/i.test(d.getElementById("rushHistoryNote").textContent), d.getElementById("rushHistoryNote").textContent);
  chips[1].click();
  await new Promise(r=>setTimeout(r,300));
  T("la banniere se ferme au clic", d.getElementById("resultBanner").classList.contains("hide"));
  T("l'exercice rate se recharge avec sa solution jouee", /winning move was|Le coup gagnant/i.test(d.getElementById("exStatus").textContent),
    d.getElementById("exStatus").textContent);
  T("statut en vert (reussite affichee, pas echec)", d.getElementById("exStatus").className.includes("win"));
  /* Bug signale : revoir une erreur renvoyait vers Exercices, alors que
     rushRestore() venait d'y ramener exPanel a la fin du sprint. L'usager
     est deja sur Defis a ce moment-la, il n'a aucune raison d'en repartir. */
  T("reste dans Defis plutot que de basculer vers Exercices", w.eval("mode")==="train", w.eval("mode"));
  T("le panneau d'exercice est bien revenu dans Defis", d.getElementById("rushSlot").contains(d.getElementById("exPanel")));
  T("l'onglet Exercices reste cache", d.getElementById("pane-puzzles").classList.contains("hide"));
  T("croix/coche plus grandes et grasses", w.eval('getComputedStyle(document.querySelector("#rushHistory button")).fontSize')==="17px" &&
    w.eval('getComputedStyle(document.querySelector("#rushHistory button")).fontWeight')==="800");
  T("carre toujours a la meme taille", w.eval('getComputedStyle(document.querySelector("#rushHistory button")).width')==="30px");
  T("l'enonce perime (Les Blancs jouent...) est cache en revue",
    w.getComputedStyle(d.getElementById("exQuest")).display==="none");
  T("Exercice suivant/Indice caches en revue, inadaptes a un exercice deja resolu",
    w.getComputedStyle(d.getElementById("exQuest").parentElement.querySelector(".btnrow")).display==="none");
  T("le theme, lui, reste visible en revue", w.getComputedStyle(d.getElementById("exTheme")).display!=="none");
  /* Signale ensuite : le bouton "Start Chang Sprint" et son texte
     precedaient toujours l'explication, puisque rushSlot et le lanceur
     partageaient la meme bordure de panneau. Le lanceur doit rester juste
     au-dessus de Coordonnees, comme son propre bloc, mais apres le contenu
     de la revue plutot qu'avant. */
  T("l'explication de l'exercice passe avant le lanceur Chang Sprint",
    (()=>{const pane=d.getElementById("pane-train");
      const posExplain=[...pane.querySelectorAll("*")].indexOf(d.getElementById("exExplain"));
      const posLauncher=[...pane.querySelectorAll("*")].indexOf(d.getElementById("btnGoRush"));
      return posExplain>=0&&posLauncher>=0&&posExplain<posLauncher;})());
  T("le lanceur Chang Sprint est un bloc a part, comme Coordonnees",
    d.getElementById("btnGoRush").closest(".panel")!==d.getElementById("exPanel"));
  T("niveau/statistiques d'Exercices absents de la revue d'un defi",
    w.getComputedStyle(d.getElementById("lvlNum").closest(".hors-sprint")).display==="none");
  /* Signale : le lanceur Chang Sprint etait correctement espace de
     Coordonnees (regle .panel + .panel), mais colle au contenu de
     l'exercice au-dessus, puisque rushSlot n'est pas lui-meme un .panel. */
  T("le lanceur Chang Sprint est bien espace du contenu qui le precede",
    parseInt(w.getComputedStyle(d.getElementById("rushLauncher")).marginTop,10)>0,
    w.getComputedStyle(d.getElementById("rushLauncher")).marginTop);

  console.log("\n--- Voir tous les resultats depuis une erreur en cours de revue ---");
  d.getElementById("btnRushSummary").click();
  await new Promise(r=>setTimeout(r,300));
  T("le bandeau se rouvre", !d.getElementById("resultBanner").classList.contains("hide"));
  T("les trois pastilles (reussie et ratees) sont toutes la",
    d.getElementById("rushHistory").querySelectorAll("button").length===3);
  T("la note reapparait avec le bilan rouvert", !d.getElementById("rushHistoryNote").classList.contains("hide"));
  d.getElementById("rushHistory").querySelector("button.loss").click();
  await new Promise(r=>setTimeout(r,300));

  console.log("\n--- Enchainer toutes les erreurs du sprint sans repasser par le bandeau ---");
  T("navigation visible, deux erreurs a revoir", !d.getElementById("reviewNav").classList.contains("hide"));
  T("position 1 sur 2", d.getElementById("reviewPos").textContent.includes("1"), d.getElementById("reviewPos").textContent);
  T("precedent desactive sur la premiere", d.getElementById("reviewPrev").disabled);
  T("suivant actif", !d.getElementById("reviewNext").disabled);
  d.getElementById("reviewNext").click();
  await new Promise(r=>setTimeout(r,300));
  T("position 2 sur 2 apres Suivant", d.getElementById("reviewPos").textContent.includes("2"), d.getElementById("reviewPos").textContent);
  T("suivant desactive sur la derniere", d.getElementById("reviewNext").disabled);
  T("precedent actif", !d.getElementById("reviewPrev").disabled);
  d.getElementById("reviewPrev").click();
  await new Promise(r=>setTimeout(r,300));
  T("retour a la position 1 sur 2 apres Precedent", d.getElementById("reviewPos").textContent.includes("1"), d.getElementById("reviewPos").textContent);
  d.getElementById("tab-explore").click();
  await new Promise(r=>setTimeout(r,300));
  d.getElementById("tab-puzzles").click();
  await new Promise(r=>setTimeout(r,300));
  /* reviewNav ne se cache que dans loadPuzzle() (ui.js) : revenir sur le
     menu (comportement de tab-puzzles seul depuis le 2026-09-03) ne charge
     aucun exercice et ne l'appelle donc jamais. Il faut revenir sur un vrai
     exercice, comme un utilisateur le ferait via la carte Puzzles. */
  d.getElementById("cardSolvePuzzles").click();
  await new Promise(r=>setTimeout(r,400));
  T("la navigation disparait des qu'on quitte la revue", d.getElementById("reviewNav").classList.contains("hide"));

  console.log("\n--- Bandeau de fin d'epreuve ---");
  /* La fin ne vivait que dans la barre de statut, facile a manquer, et le
     bloc repartait aussitot dans l'onglet Exercices : on se retrouvait
     ailleurs sans comprendre. On reutilise le bandeau de fin de partie
     plutot que d'en creer un second. */
  d.getElementById("cardSolveSprint").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("readyStart").click();
  await new Promise(r=>setTimeout(r,500));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,300));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,600));
  const ban=d.getElementById("resultBanner");
  T("bandeau affiche a la fin du sprint", !ban.classList.contains("hide"));
  T("le score est annonce", /Score/i.test(d.getElementById("resultSub").textContent),
    d.getElementById("resultSub").textContent);
  T("'Revoir la partie' masque pour une epreuve",
    d.getElementById("resultAnalyse").classList.contains("hide"));
  d.getElementById("resultNew").click();
  await new Promise(r=>setTimeout(r,700));
  T("'Rejouer' relance le sprint", !!w.eval("rush"));
  T("et reste dans Defis", !d.getElementById("pane-train").classList.contains("hide"));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,300));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,600));
  d.getElementById("resultClose").click();
  await new Promise(r=>setTimeout(r,300));
  T("'Fermer' ne relance rien", !w.eval("rush") && ban.classList.contains("hide"));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
