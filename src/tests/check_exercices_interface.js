/* Verification automatique de chang64.
   Lancement : node tests/<fichier>.js  (depuis la racine des sources)
   Le site doit avoir ete construit au prealable : node build_site.js */
const SITE = require("path").join(__dirname, "..", "site");
const BASE = process.env.CHANG64_BASELINE || "";   /* site deja en ligne, facultatif */
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(""+SITE+"/index.html","utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole()});
const w=dom.window,d=w.document;
setTimeout(async()=>{
  console.log("\n--- La banque est bien chargee ---");
  const hc=d.getElementById("hCount");
  T("compteur d'exercices en page d'accueil", hc && +hc.textContent===777, hc&&hc.textContent);

  console.log("\n--- Le filtre par theme propose les nouveaux motifs ---");
  d.getElementById("tab-train").click();
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
  d.getElementById("tab-train").click();
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
  d.getElementById("btnRush").click();
  await new Promise(r=>setTimeout(r,600));
  T("le bloc revient a sa place a l'arret", ou()==="puzzles", ou());
  /* second cas : on quitte Defis pendant un sprint */
  d.getElementById("tab-train").click();
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
  d.getElementById("tab-train").click();
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
  d.getElementById("btnRush").click();
  await new Promise(r=>setTimeout(r,500));

  d.getElementById("tab-train").click();
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
     le sprint enchaine les cinq niveaux. Il a ses propres compteurs en haut. */
  d.getElementById("tab-train").click();
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
  d.getElementById("btnRush").click();
  await new Promise(r=>setTimeout(r,500));
  d.getElementById("tab-puzzles").click();
  await new Promise(r=>setTimeout(r,600));
  T("tout revient apres le sprint", !cache("btnNext") && !cache("stSolved"));

  console.log("\n--- Le sprint enchaine bien les exercices ---");
  /* Le sprint lance depuis Defis tourne avec mode==="train". Or ui3.js
     redefinit onSquare et envoie tous les clics de ce mode vers
     handleTrainClick, qui gere les finales et les coordonnees : le coup etait
     joue sur l'echiquier mais jamais reconnu comme solution, et l'exercice ne
     passait jamais au suivant. */
  d.getElementById("tab-train").click();
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
  d.getElementById("btnRush").click();
  await new Promise(r=>setTimeout(r,500));
  {const b=d.getElementById("resultBanner"); if(!b.classList.contains("hide"))d.getElementById("resultClose").click();}
  await new Promise(r=>setTimeout(r,300));

  console.log("\n--- Chang Sprint est un defi, pas un entrainement ---");
  /* Quatre corrections : le thème et l'enonce revelaient la reponse ("Mat en
     un coup"), la progression par niveau s'incrementait et annoncait "Tu
     passes au niveau 2" au milieu du defi, le bouton ne permettait pas
     d'abandonner, et la file etait ordonnee par niveau donc composee a 97%
     de mats en un coup au debut. */
  d.getElementById("tab-train").click();
  await new Promise(r=>setTimeout(r,400));
  {
    const niv=w.eval("prog.level"), res=w.eval("prog.solved");
    const bt=d.getElementById("btnGoRush");
    bt.click(); await new Promise(r=>setTimeout(r,400));
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
      const oSlot=parseInt(w.getComputedStyle(slot).order||"0",10);
      const oBtn=parseInt(w.getComputedStyle(rangee).order||"0",10);
      T("le bouton passe sous l'echiquier", oBtn>oSlot, "echiquier "+oSlot+", bouton "+oBtn);
      const desc=[...bt.closest(".panel").children].filter(x=>x.tagName==="P");
      T("la description se masque", desc.every(x=>w.getComputedStyle(x).display==="none"));
    }

    /* variete : la file alterne les themes au lieu de grouper par niveau */
    const themes=w.eval("new Set(rush.queue.slice(0,20).map(function(p){return p.theme;})).size");
    T("au moins 5 themes dans les 20 premiers", themes>=5, themes+" themes");

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
  d.getElementById("tab-train").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("readyStart").click();
  await new Promise(r=>setTimeout(r,500));
  d.getElementById("btnCoord").click();
  await new Promise(r=>setTimeout(r,600));
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
  d.getElementById("btnRush").click();
  await new Promise(r=>setTimeout(r,500));
  {const b=d.getElementById("resultBanner"); if(!b.classList.contains("hide"))d.getElementById("resultClose").click();}
  await new Promise(r=>setTimeout(r,300));

  console.log("\n--- Bandeau de fin d'epreuve ---");
  /* La fin ne vivait que dans la barre de statut, facile a manquer, et le
     bloc repartait aussitot dans l'onglet Exercices : on se retrouvait
     ailleurs sans comprendre. On reutilise le bandeau de fin de partie
     plutot que d'en creer un second. */
  d.getElementById("tab-train").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("readyStart").click();
  await new Promise(r=>setTimeout(r,500));
  d.getElementById("btnRush").click();
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
  d.getElementById("btnRush").click();
  await new Promise(r=>setTimeout(r,600));
  d.getElementById("resultClose").click();
  await new Promise(r=>setTimeout(r,300));
  T("'Fermer' ne relance rien", !w.eval("rush") && ban.classList.contains("hide"));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
