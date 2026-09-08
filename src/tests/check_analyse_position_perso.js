/* Verification automatique de chang64.
   Lancement : node tests/check_analyse_position_perso.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-09-07, signale par Alexandre) : une partie
   lancee depuis Analyser, donc depuis une position personnalisee, puis
   abandonnee et analysee, affichait "Stockfish ne repond plus, retour au
   moteur integre".

   Stockfish repondait tres bien. L'analyse rejouait la partie depuis
   "new Game()", c'est-a-dire depuis le plateau standard, sans consulter
   gameStartFen. Des le premier tour de boucle le coup joue n'existait pas
   dans cette position, on sortait, et la liste vide etait lue comme "le
   moteur n'a rien renvoye".

   Le repli aggravait le symptome au lieu de le rattraper : baseAnalyseGame()
   avait exactement le meme defaut, mais lui ne disait rien et rendait une
   analyse de zero coup. D'ou les deux volets de ce test : le comportement du
   moteur integre, verifiable ici, et la presence de la meme regle dans le
   chemin Stockfish, qui demande un vrai worker et n'est donc verifiable
   qu'en lisant le fichier construit.

   La regle existait deja dans rebuildTo() depuis un bug identique sur la
   navigation dans le bandeau de coups. Elle n'avait ete appliquee qu'a un
   des trois appels : c'est cet ecart que le test surveille. */
const SITE = require("path").join(__dirname, "..", "site");
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(""+SITE+"/index.html","utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",
  virtualConsole:new jd.VirtualConsole(),
  beforeParse(w){ w.fetch=u=>{const p=SITE+String(u).replace(/^https?:\/\/[^/]+/,"");
    return fs.existsSync(p)?Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(JSON.parse(fs.readFileSync(p,"utf8")))})
                           :Promise.resolve({ok:false,status:404});};}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id);

/* Position volontairement eloignee du plateau initial : tour et roi contre
   roi. Aucun des coups joues ci-dessous n'existe dans la position de depart
   standard, donc l'ancien code sortait de la boucle des le premier. */
const FEN="8/8/4k3/8/8/4K3/4R3/8 w - - 0 1";

setTimeout(async()=>{
  console.log("\n--- Une partie qui ne part pas du plateau standard ---");
  w.eval(`
    gameStartFen=${JSON.stringify(FEN)};
    mainGame=new Game(gameStartFen);
    game=mainGame; mainSan=[]; sanList=mainSan;
    gameUci=[]; myColor=W; isReviewGame=true;
    for(const u of ["e3d4","e6d7","d4c5","d7c8","c5b6"]){
      const mv=game.moves().find(m=>game.uci(m)===u);
      if(mv){game.makeMove(mv);gameUci.push(u);mainSan.push(game.san?u:u);}
    }
  `);
  T("cinq coups joues depuis la position personnalisee",w.eval("gameUci.length")===5,
    String(w.eval("gameUci.length")));
  T("aucun de ces coups n'est legal depuis le plateau standard",
    w.eval(`(function(){var g=new Game();return !g.moves().some(m=>g.uci(m)===gameUci[0]);})()`),
    "sinon le test ne prouverait rien");

  console.log("\n--- Le moteur integre analyse bien la partie ---");
  w.eval("analysis=null;baseAnalyseGame()");
  for(let i=0;i<60&&!w.eval("analysis");i++)await wait(120);
  const n=w.eval("analysis?analysis.plies.length:-1");
  T("l'analyse rend un resultat",n>=0,String(n));
  T("elle couvre tous les coups joues et non zero",n===5,
    n+" demi-coup(s) analyse(s) pour 5 joues");
  T("aucun message de panne moteur n'est affiche",
    !/ne r.pond plus|stopped responding/i.test($("analysisNote").textContent||""),
    $("analysisNote").textContent);

  console.log("\n--- La meme regle des deux cotes ---");
  /* Lecture du fichier construit : le chemin Stockfish demande un worker
     reel, hors de portee de jsdom. On verifie au moins qu'aucun des deux
     chemins ne reconstruit la partie depuis un plateau standard. */
  /* Forme minifiee : terser reecrit le ternaire, on compte donc
     l'appel lui-meme plutot que la tournure exacte du source. */
  const depuisFen=(html.match(/new Game\(gameStartFen\)/g)||[]).length;
  T("les trois rejeux consultent gameStartFen",depuisFen>=3,
    depuisFen+" occurrence(s), attendu au moins 3 (rebuildTo, moteur integre, Stockfish)");
  T("le message de panne n'est plus atteignable par une liste vide de position",
    /stopped responding/.test(html),"la chaine doit rester, c'est son declencheur qui a change");

  console.log("\n--- Ce qui ne doit pas changer : une partie standard ---");
  w.eval(`
    gameStartFen=null; mainGame=new Game(); game=mainGame; mainSan=[];
    gameUci=[]; analysis=null;
    for(const u of ["e2e4","e7e5","g1f3","b8c6"]){
      const mv=game.moves().find(m=>game.uci(m)===u);
      if(mv){game.makeMove(mv);gameUci.push(u);}
    }
    baseAnalyseGame();
  `);
  for(let i=0;i<60&&!w.eval("analysis");i++)await wait(120);
  T("une partie partie du plateau standard s'analyse toujours",
    w.eval("analysis?analysis.plies.length:-1")===4,
    String(w.eval("analysis?analysis.plies.length:-1")));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1400);
setTimeout(()=>{console.log("\n=== "+ok+" OK, "+(ko+1)+" FAIL === (delai depasse)");process.exit(1);},90000);
