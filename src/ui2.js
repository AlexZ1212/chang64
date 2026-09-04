/* ==========================================================
   6. OPENING BOOK
   ========================================================== */
/* Le livre d'ouvertures pese 94 Ko sur les 360 du fichier, et ne sert qu'a
   afficher un libelle : le nom de l'ouverture en cours de partie, et celui
   des parties de l'historique. Il est donc charge a la demande, au premier
   besoin reel, puis mis en cache par le service worker.
   Tant qu'il n'est pas arrive, detectOpening renvoie null et le libelle
   reste vide : aucun blocage, aucune attente. */
let OPENING_DATA=null,OPENING_PENDING=false;
const OPENING_SLUGS=__OPENING_SLUGS__;
let OPENINGS=null;
function loadOpeningBook(){
  if(OPENING_DATA||OPENING_PENDING)return;
  OPENING_PENDING=true;
  const done=d=>{
    OPENING_DATA=d;OPENING_PENDING=false;
    /* le libelle et l'historique se reaffichent une fois le livre arrive */
    try{renderOpening();}catch(e){}
    try{renderHistory();}catch(e){}
  };
  const fail=()=>{OPENING_PENDING=false;};
  /* repli sur XMLHttpRequest si fetch est absent : navigateurs anciens, et
     environnements de test qui n'exposent pas fetch. Sans ce garde-fou, la
     detection d'ouverture leverait une ReferenceError. */
  if(typeof fetch==="function"){
    fetch("/openings-book.json")
      .then(r=>r.ok?r.json():Promise.reject(r.status))
      .then(done).catch(fail);
  }else if(typeof XMLHttpRequest==="function"){
    try{
      const x=new XMLHttpRequest();
      x.open("GET","/openings-book.json",true);
      x.onload=()=>{try{x.status>=200&&x.status<300?done(JSON.parse(x.responseText)):fail();}catch(e){fail();}};
      x.onerror=fail;
      x.send();
    }catch(e){fail();}
  }else fail();
}
function openingMap(){
  if(OPENINGS)return OPENINGS;
  if(!OPENING_DATA){loadOpeningBook();return null;}
  OPENINGS=new Map();
  for(const line of OPENING_DATA.o.split("\n")){
    const p=line.split("\t");
    if(p.length<4)continue;
    const fam=OPENING_DATA.f[+p[1]];
    OPENINGS.set(p[0],{name:p[2]?fam+": "+p[2]:fam,eco:p[3]});
  }
  return OPENINGS;
}
function cleanSan(s){return s.replace(/[+#!?]/g,"");}
function detectOpening(list){
  if(!list||!list.length)return null;
  const map=openingMap();
  if(!map)return null;
  const moves=list.map(cleanSan);
  for(let n=Math.min(moves.length,8);n>=1;n--){
    const hit=map.get(moves.slice(0,n).join(" "));
    if(hit)return hit;
  }
  return null;
}
function openingHref(family){
  const e=OPENING_SLUGS[family];
  if(!e)return null;
  return LANG==="fr"?"/fr/ouvertures/"+e.fr+".html":"/openings/"+e.en+".html";
}
function renderOpening(){
  const el=$("opening"); if(!el)return;
  const o=detectOpening(sanList);
  if(!o){el.textContent="";return;}
  const family=o.name.split(":")[0].trim();
  const href=openingHref(family);
  const label=o.eco+" \u00b7 "+o.name;
  el.innerHTML=href
    ? '<a href="'+href+'">'+label.replace(/&/g,"&amp;").replace(/</g,"&lt;")+'</a>'
    : label.replace(/&/g,"&amp;").replace(/</g,"&lt;");
}
const EXPLORE=[
  {en:["/openings/","Openings","__NF__ families, __NL__ named lines"],fr:["/fr/ouvertures/","Ouvertures","__NF__ familles, __NL__ variantes"]},
  {en:["/learn/","Learn the rules","Castling, en passant, notation"],fr:["/fr/apprendre/","Apprendre les règles","Roque, prise en passant, notation"]},
  {en:["/glossary/","Glossary","Forks, pins, zugzwang"],fr:["/fr/lexique/","Lexique","Fourchettes, clouages, zugzwang"]},
  {en:["/endgames/","Endgames","The five you must know"],fr:["/fr/finales/","Finales","Les cinq à connaître"]},
  {en:["/traps/","Opening traps","Scholar's, Legal's, Fried Liver"],fr:["/fr/pieges/","Pièges d'ouverture","Berger, Légal, Fegatello"]},
  {en:["/puzzles/","Puzzle library","__NP__ verified positions"],fr:["/fr/exercices/","Bibliothèque d'exercices","__NP__ positions vérifiées"]}
];
function renderExplore(){
  const box=$("exploreLinks"); if(!box)return;
  $("exploreTitle").textContent=t("Explore");
  $("exploreNote").textContent=t("Every page below is built from the same engine that runs the board.");
  box.innerHTML=EXPLORE.map(e=>{
    const [href,title,sub]=LANG==="fr"?e.fr:e.en;
    return '<a href="'+href+'">'+title+'<span>'+sub+'</span></a>';
  }).join("");
}

/* ==========================================================
   7. MOVE NAVIGATION AND REVIEW
   ========================================================== */
let gameUci=[];          // moves of the current play-mode game, in UCI
let reviewPly=null;      // null = live position
let analysis=null;       // per-ply analysis once computed
/* FEN de depart de la partie Jouer en cours : null pour la position
   standard (l'immense majorite des cas), sinon la position composee dans
   l'editeur ("Jouer contre le bot depuis ici"). rebuildTo() en a besoin
   pour reconstruire correctement une position anterieure : sans ca, revenir
   en arriere dans le bandeau de coups d'une partie demarree depuis une
   position personnalisee repartait toujours du plateau standard, donnant
   un echiquier plein n'importe quoi au lieu de la position jouee. */
let gameStartFen=null;

function recordUci(m){gameUci.push(sqN(m.from)+sqN(m.to)+(m.promo?SYM[m.promo]:""));}
function rebuildTo(ply){
  const g=gameStartFen?new Game(gameStartFen):new Game();
  let last=null;
  for(let i=0;i<ply&&i<gameUci.length;i++){
    const mv=g.moves().find(x=>g.uci(x)===gameUci[i]);
    if(!mv)break;
    last=mv;g.makeMove(mv);
  }
  return {game:g,last:last};
}
const VERDICT={blunder:"Blunder",mistake:"Mistake",inacc:"Inaccuracy"};
function renderPlyInfo(){
  const box=$("plyInfo"); if(!box)return;
  if(reviewPly===null||!analysis||!analysis.plies[reviewPly-1]){box.className="plyinfo hide";return;}
  const a=analysis.plies[reviewPly-1];
  const played=sanList[reviewPly-1];
  const isBest=!a.tag;
  box.className="plyinfo "+(a.tag||"best");
  let html='<span class="played">'+t("Played")+' <b>'+played+'</b></span>';
  if(a.best){
    const g=rebuildTo(reviewPly-1).game;
    const mv=g.moves().find(m=>g.uci(m)===a.best);
    const bestSan=mv?g.san(mv):a.best;
    if(isBest)html+=' <span class="verdict">'+t("The engine agrees: best move.")+'</span>';
    else html+=' <span class="better">'+t("Engine preferred")+' <b>'+bestSan+'</b></span>'+
      '<span class="verdict">'+t(VERDICT[a.tag])+" \u00b7 "+t("{n} advantage lost.",{n:fmtNum(a.loss/100)})+'</span>';
  }
  box.innerHTML=html;
}
function markBestMove(){
  if(reviewPly===null||!analysis)return;
  const a=analysis.plies[reviewPly-1];
  if(!a||!a.tag||!a.best)return;
  const from=a.best.slice(0,2),to=a.best.slice(2,4);
  marks[nSq(from)]="hint";marks[nSq(to)]="hint";
}
function evalFromAnalysis(){
  /* Renvoie {cp, cpTrue, mate} : cp reste la valeur ecretee (graphique,
     classement des coups), cpTrue la valeur reelle non tronquee pour
     l'affichage numerique, et mate la distance de mat forcee (perspective
     Blancs) quand le moteur en a trouve un a cette ply, sinon null.
     Mode "analyse" (exploration libre depuis l'editeur de position) : pas
     de partie/liste de coups a consulter, juste la derniere evaluation
     recue en direct (voir queueAnalyseEval, ui3.js), mise a jour a chaque
     coup ou changement de position dans le bandeau. */
  if(mode==="analyse")return analyseEvalCache;
  if(reviewPly===null||!analysis)return null;
  if(reviewPly===0)return {cp:0,cpTrue:0,mate:null};
  const a=analysis.plies[reviewPly-1];
  return a?{cp:a.cp,cpTrue:(a.cpTrue!=null?a.cpTrue:a.cp),mate:a.mate}:null;
}
function gotoPly(ply){
  ply=Math.max(0,Math.min(gameUci.length,ply));
  if(ply===gameUci.length){exitReview();return;}
  reviewPly=ply;
  const r=rebuildTo(ply);
  reviewGame=r.game;reviewLast=r.last;
  selected=-1;marks={};
  markBestMove();
  render();updateEval();renderSheetPlay();renderNav();renderPlyInfo();renderClocks();
}
function exitReview(){
  reviewPly=null;reviewGame=null;reviewLast=null;
  selected=-1;marks={};
  render();updateEval();renderSheetPlay();renderNav();renderPlyInfo();renderClocks();
}
function renderNav(){
  const n=gameUci.length;
  const at=reviewPly===null?n:reviewPly;
  const row=$("navRow");
  if(row)row.classList.toggle("hide",mode!=="play");
  renderNavStrip(at);
  $("navNote").textContent=reviewPly===null
    ? t(n?"Live position. Arrow keys step through the game.":"Use the arrow keys to step through the game.")
    : t("Reviewing move {i} of {n}. Play a move or press End to return.",{i:at,n:n});
}
/* Bandeau horizontal de coups (remplace les boutons |< et >| : taper la
   premiere ou la derniere puce fait la meme chose, et Origine/Fin au
   clavier restent disponibles). Reconstruit a chaque appel de renderNav :
   la partie reste courte (quelques dizaines de coups au grand maximum),
   donc pas besoin d'un rendu incrémental. */
function sanPieceType(san){
  const s=(san||"").replace(/[+#]/g,"");
  if(s.indexOf("O-O")===0)return "k";
  const c=s[0];
  return "NBRQK".indexOf(c)>=0?c.toLowerCase():"p";
}
function renderNavStrip(at){
  const el=$("navScroll"); if(!el)return;
  let h='<span class="navchip start'+(at===0?" cur":"")+'" data-ply="0">'+t("Game start")+'</span>';
  for(let i=0;i<sanList.length;i++){
    const a=analysis&&analysis.plies[i];
    const tag=a&&a.tag?TAGS[a.tag]:"";
    const cls=["navchip",(i===at-1?"cur":""),(a&&a.tag?"tag-"+a.tag:"")].filter(Boolean).join(" ");
    const num=i%2===0?'<span class="navnum">'+(i/2+1)+'.</span>':"";
    /* Petit picto de la piece jouee : reprend le jeu de pieces du site
       (pieces_browser.js), recadre sur sa boite englobante (serre=true,
       meme technique que les pieces prises au-dessus de la pendule).
       Toujours rendu avec le remplissage clair (memes contours) : le
       remplissage "noir" des pieces (#232b28) est quasi invisible sur le
       fond sombre du bandeau, contrairement a un vrai plateau ou les cases
       apportent le contraste. Blancs/Noirs restent distingues par le
       numero de coup (present uniquement cote Blancs) et une opacite
       reduite cote Noirs. */
    const side=i%2===0?"w":"b";
    const icon=typeof pieceSVG==="function"
      ?'<i class="navpiece side-'+side+'">'+pieceSVG(sanPieceType(sanList[i]),"w",true)+'</i>':"";
    h+='<span class="'+cls+'" data-ply="'+(i+1)+'">'+num+icon+sanList[i]+tag+'</span>';
  }
  el.innerHTML=h;
  el.querySelectorAll("[data-ply]").forEach(sp=>{sp.onclick=()=>gotoPly(+sp.dataset.ply);});
  /* Garde le coup courant visible dans le bandeau sans faire defiler toute
     la page (block:"nearest" plutot que "center" par defaut). */
  const curEl=el.querySelector(".cur");
  if(curEl&&typeof curEl.scrollIntoView==="function"){
    try{curEl.scrollIntoView({behavior:"smooth",inline:"center",block:"nearest"});}catch(e){}
  }
  updateNavScrollHint();
}
/* Meme indice de defilement que la barre d'onglets (voir updateTabsScrollHint
   dans ui3.js) : degrade + chevron aux bords de #navScroll, visibles
   seulement quand il y a reellement plus a voir dans ce sens. Appelee ici
   et depuis renderAnalyseNav() (ui3.js), les deux constructions du meme
   bandeau. */
function updateNavScrollHint(){
  const el=$("navScroll"); if(!el)return;
  el.classList.toggle("sl",el.scrollLeft>2);
  el.classList.toggle("sr",el.scrollLeft<el.scrollWidth-el.clientWidth-2);
  el.onscroll=updateNavScrollHint;
}
const TAGS={blunder:"??",mistake:"?",inacc:"?!"};
function renderSheetPlay(){
  const el=$("sheet");
  if(!sanList.length){el.innerHTML='<div class="sheet-empty">'+t("No moves yet")+'</div>';renderNav();return;}
  const at=reviewPly===null?sanList.length:reviewPly;
  let h="";
  for(let i=0;i<sanList.length;i+=2){
    h+='<div class="sheet-row"><span class="n">'+(i/2+1)+'</span>';
    for(const j of [i,i+1]){
      if(j>=sanList.length){h+='<span></span>';continue;}
      const a=analysis&&analysis.plies[j];
      const tag=a&&a.tag?TAGS[a.tag]:"";
      const cls=[(j===at-1?"view":""),(a&&a.tag?"tag-"+a.tag:"")].filter(Boolean).join(" ");
      h+='<span class="'+cls+'" data-ply="'+(j+1)+'">'+sanList[j]+tag+'</span>';
    }
    h+='</div>';
  }
  el.innerHTML=h;
  el.querySelectorAll("[data-ply]").forEach(sp=>{
    sp.onclick=()=>gotoPly(+sp.dataset.ply);
  });
  el.scrollTop=el.scrollHeight;
  renderNav();
}
let resultDismissed=false;
function renderResult(show){
  const b=$("resultBanner"); if(!b)return;
  if(show&&resultInfo){
    if(mode==="play")saveFinishedGame();
    else if(mode==="friend"&&typeof saveFinishedAmiGame==="function")saveFinishedAmiGame();
  }
  if(!show||!resultInfo||resultDismissed){b.className="result hide";return;}
  b.className="result "+resultInfo.kind;
  $("resultTitle").textContent=resultInfo.title;
  $("resultSub").textContent=resultInfo.sub;
  $("resultAnalyse").classList.toggle("hide",mode!=="play"&&mode!=="friend");
  $("resultNew").textContent=mode==="friend"?t("Create game"):t("New game");
  $("resultAnalyse").textContent=t("Review");
  $("resultClose").textContent=t("Dismiss");
}
function afterGameRender(over){
  renderOpening();
  renderSheetPlay();
  applyEvalPref();
  renderResult(!!over);
}
$("resultNew").onclick=()=>{
  if(finAction){const f=finAction;finAction=null;$("resultBanner").className="result hide";f();return;}
  resultDismissed=false;
  /* Retour aux reglages plutot qu'une relance directe avec les memes choix :
     l'occasion de reconsiderer (couleur, force, cadence) avant de rejouer,
     plutot que d'etre embarque dans le meme parametrage sans le vouloir.
     Les reglages restent presorted sur le dernier choix (rien ne les
     reinitialise ailleurs), donc rejouer a l'identique ne demande qu'un tap
     de plus sur "Jouer". skipReady n'a alors plus lieu d'etre : reprendre
     depuis les reglages redevient un demarrage normal, l'overlay "Pret ?"
     d'une partie chronometree doit s'y proposer comme n'importe quelle
     autre fois. */
  if(mode==="friend")newAmiGame();
  else setupGame();
};
$("resultClose").onclick=()=>{
  resultDismissed=true;
  $("resultBanner").className="result hide";
  finAction=null;
};
/* Bandeau de fin generique, reutilise pour Chang Sprint et les coordonnees.
   Le message ne vivait que dans la barre de statut, facile a manquer, et le
   bloc repartait aussitot dans l'onglet Exercices : on se retrouvait ailleurs
   sans comprendre ce qui venait de se passer. */
let finAction=null;
function showFin(titre,sousTitre,libelleRejouer,action){
  const b=$("resultBanner"); if(!b)return;
  finAction=action||null;
  $("resultTitle").textContent=titre;
  $("resultSub").textContent=sousTitre;
  /* Generique aux fins de partie normales : la rangee de bilan du sprint
     n'a de sens que pour rushEnd(), qui la remplit juste apres cet appel. */
  const rh=$("rushHistory"); if(rh){rh.innerHTML="";rh.classList.add("hide");}
  $("resultNew").textContent=libelleRejouer;
  /* "Revoir la partie" n'a pas de sens pour une epreuve. */
  const an=$("resultAnalyse"); if(an)an.classList.toggle("hide",!!action);
  $("resultClose").textContent=t("Close");
  b.className="result win";
  resultDismissed=false;
  /* Meme conflit que readyStart : focus() sans preventScroll recadre tout
     seul la vue sur le bouton, et la fin naturelle d'un sprint (temps
     ecoule ou 3 erreurs) n'appelait ici aucun focusBoard() du tout. Le
     bandeau pouvait donc rester partiellement sous l'en-tete ancree. */
  try{$("resultNew").focus({preventScroll:true});}catch(e){try{$("resultNew").focus();}catch(e2){}}
  if(typeof focusBoard==="function")focusBoard();
}
$("resultAnalyse").onclick=()=>{
  resultDismissed=true;
  $("resultBanner").className="result hide";
  if(mode==="friend"){
    /* saveFinishedAmiGame() vient de s'executer (voir renderResult) : la
       partie qui se termine est deja en tete de l'historique Entre amis,
       on la rouvre directement plutot que de dupliquer sa logique ici. */
    if(typeof openAmiHistoryGame==="function")openAmiHistoryGame(0);
    return;
  }
  if($("btnAnalyse")){$("btnAnalyse").scrollIntoView&&$("btnAnalyse").scrollIntoView({block:"center"});analyseGame();}
};
document.addEventListener("keydown",e=>{
  if(mode!=="play")return;
  const tag=e.target.tagName;
  if(tag==="INPUT"||tag==="TEXTAREA")return;
  /* si le focus est sur une case, les fleches deplacent le curseur :
     c'est l'echiquier qui les traite, pas la navigation dans la partie */
  if(e.target&&e.target.classList&&e.target.classList.contains("sq"))return;
  const at=reviewPly===null?gameUci.length:reviewPly;
  if(e.key==="ArrowLeft"){e.preventDefault();gotoPly(at-1);}
  else if(e.key==="ArrowRight"){e.preventDefault();gotoPly(at+1);}
  else if(e.key==="Home"){e.preventDefault();gotoPly(0);}
  else if(e.key==="End"){e.preventDefault();exitReview();}
});

/* ==========================================================
   8. GAME ANALYSIS
   ========================================================== */
function clearAnalysis(){
  analysis=null;gameUci=[];reviewPly=null;
  const o=$("analysisOut"); if(o)o.classList.add("hide");
  const p=$("anaProgress"); if(p)p.classList.add("hide");
}
function classify(loss,isBest){
  if(isBest)return null;
  if(loss>=250)return "blunder";
  if(loss>=120)return "mistake";
  if(loss>=55)return "inacc";
  return null;
}
function analyseGame(){
  if(mode==="play"&&!isReviewGame&&!gameFinished()&&!analysis)return;
  if(!gameUci.length){$("analysisNote").textContent=t("Play a few moves first.");$("analysisOut").classList.remove("hide");return;}
  const btn=$("btnAnalyse");btn.disabled=true;btn.textContent=t("Analysing…");
  const bar=$("anaProgress");bar.classList.remove("hide");bar.firstElementChild.style.width="0%";
  const g=new Game();
  const plies=[];
  let i=0;
  const CLAMP=1200;
  function step(){
    if(i>=gameUci.length){finishAnalysis(plies);return;}
    const r=search(g,2,140);
    const before=Math.max(-CLAMP,Math.min(CLAMP,r.score));
    const bestUci=r.move?g.uci(r.move):null;
    const mv=g.moves().find(x=>g.uci(x)===gameUci[i]);
    if(!mv){finishAnalysis(plies);return;}
    const mover=g.turn;
    g.makeMove(mv);
    const r2=search(g,2,140);
    const afterForMover=Math.max(-CLAMP,Math.min(CLAMP,-r2.score));
    const loss=Math.max(0,before-afterForMover);
    /* Detection de mat force par le moteur integre : alphabeta() renvoie
       MATE-ply (ou -MATE+ply) quand un mat est trouve dans l'arbre, ply
       etant le nombre de demi-coups depuis la racine de CETTE recherche
       (celle d'apres coup, donc perspective de l'adversaire du mover).
       Le seuil MATE-100 est le meme que celui deja utilise par search()
       pour arreter l'approfondissement iteratif des qu'un mat est trouve. */
    let mate=null;
    if(Math.abs(r2.score)>MATE-100){
      const plyDist=MATE-Math.abs(r2.score);
      const movesDist=Math.max(1,Math.ceil(plyDist/2));
      /* r2.score positif => l'adversaire (au trait apres le coup) mate =>
         defavorable au mover => signe oppose une fois ramene au mover. */
      const mateForMover=(r2.score>0?-1:1)*movesDist;
      mate=mover===W?mateForMover:-mateForMover;
    }
    const cpTrue=mate==null?(mover===W?afterForMover:-afterForMover):null;
    plies.push({cp:mover===W?afterForMover:-afterForMover,cpTrue:cpTrue,mate:mate,loss:loss,
      tag:classify(loss,bestUci===gameUci[i]),best:bestUci,mover:mover});
    i++;
    bar.firstElementChild.style.width=(100*i/gameUci.length).toFixed(0)+"%";
    setTimeout(step,0);
  }
  setTimeout(step,30);
}
function finishAnalysis(plies){
  analysis={plies:plies};
  const btn=$("btnAnalyse");btn.disabled=false;btn.textContent=t("Analyse this game");
  $("anaProgress").classList.add("hide");
  $("analysisOut").classList.remove("hide");
  const mine=plies.filter(p=>p.mover===myColor);
  const blunders=mine.filter(p=>p.tag==="blunder").length;
  const mistakes=mine.filter(p=>p.tag==="mistake").length;
  const inacc=mine.filter(p=>p.tag==="inacc").length;
  const avg=mine.length?mine.reduce((a,b)=>a+b.loss,0)/mine.length:0;
  const acc=Math.max(15,Math.min(99,Math.round(100-avg/3.2)));
  $("accScore").textContent=acc+"%";
  $("accBlunders").textContent=blunders;
  $("accMistakes").textContent=mistakes;
  let note=t("Your side: {b} blunder(s), {m} mistake(s), {i} inaccuracy(ies).",{b:blunders,m:mistakes,i:inacc});
  const worst=mine.filter(p=>p.tag).sort((a,b)=>b.loss-a.loss)[0];
  if(worst){
    const idx=plies.indexOf(worst);
    note+=" "+t("The costliest was move {n} ({san}); the engine preferred {best}.",{n:Math.floor(idx/2+1),san:sanList[idx],best:worst.best});
  }
  note+=" "+t("Accuracy here is a rough guide from a shallow search, not a rating.");
  $("analysisNote").textContent=note;
  drawGraph(plies);
  renderSheetPlay();
}
function drawGraph(plies){
  const w=300,h=96,mid=h/2,CLAMP=1200;
  let d="";
  plies.forEach((p,i)=>{
    const x=plies.length>1?(i/(plies.length-1))*w:w/2;
    const y=mid-(Math.max(-CLAMP,Math.min(CLAMP,p.cp))/CLAMP)*(mid-6);
    d+=(i?"L":"M")+x.toFixed(1)+" "+y.toFixed(1);
  });
  const area=d?d+"L"+w+" "+mid+"L0 "+mid+"Z":"";
  $("evalGraph").innerHTML=
    '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none" role="img" aria-label="'+t("Evaluation over the game")+'">'+
    '<line x1="0" y1="'+mid+'" x2="'+w+'" y2="'+mid+'" stroke="rgba(239,233,217,.25)" stroke-width="1"/>'+
    (area?'<path d="'+area+'" fill="rgba(217,168,63,.18)"/>':"")+
    (d?'<path d="'+d+'" fill="none" stroke="#D9A83F" stroke-width="2" stroke-linejoin="round"/>':"")+
    '</svg>';
}
/* Historique de notation (integration ELO, point 2). Meme principe que
   drawGraph() ci-dessus (SVG en ligne, viewBox proportionnel) mais avec une
   echelle DYNAMIQUE plutot que le CLAMP fixe de l'eval : la notation n'a
   pas de plage naturelle a l'avance (peut aller de 400 a plus de 2300),
   contrairement au centipawn deja borne par construction. Min/max calcules
   sur l'historique lui-meme a chaque rendu -- toujours a jour, jamais une
   plage codee en dur qui deviendrait fausse a mesure que la notation
   progresse au fil des mois.
   preserveAspectRatio="xMidYMid meet" (pas "none" comme drawGraph) : le
   texte des graduations serait deforme si le rendu ne matchait pas
   exactement le ratio du viewBox -- voir .graph.ratinggraph svg en CSS,
   qui fixe ce ratio via aspect-ratio plutot qu'une hauteur figee, pour que
   "meet" n'ait justement jamais besoin d'ajouter de bandes vides. */
function drawRatingGraph(){
  const el=$("ratingGraph"); if(!el)return;
  ensureProgFields();
  const hist=prog.ratingHistory;
  const w=300,h=90,padL=30,padR=6,padT=8,padB=16;
  const plotW=w-padL-padR,plotH=h-padT-padB;
  /* Etat vide/quasi-vide (signale : "pas tres joli lorsqu'il est vide") :
     une ligne pointillee et un message plutot qu'un cadre nu qui se lit
     comme un bug -- meme esprit que "Rien de resolu, on propose de
     commencer" deja applique ailleurs dans l'app pour un premier
     visiteur. Il faut au moins 2 points pour tracer une ligne. */
  if(hist.length<2){
    /* Marges symetriques ici (pas padL/padR, reserves aux graduations du
       mode rempli) : signale, les pointilles n'etaient pas centres --
       cause exacte, padL (30, reserve aux libelles Elo) et padR (6)
       n'ont aucune raison d'etre asymetriques quand il n'y a justement
       aucun libelle a afficher en mode vide. */
    const ePad=10;
    el.innerHTML='<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+t("Rating over time")+'">'+
      '<line x1="'+ePad+'" y1="'+(h/2)+'" x2="'+(w-ePad)+'" y2="'+(h/2)+'" stroke="rgba(239,233,217,.18)" stroke-width="1" stroke-dasharray="4 4"/>'+
      '<text x="'+(w/2)+'" y="'+(h/2-10)+'" text-anchor="middle" fill="var(--sage)" font-size="10">'+t("Solve a few puzzles to see your progress here.")+'</text>'+
      '</svg>';
    return;
  }
  const values=hist.map(p=>p.r);
  const min=Math.min.apply(null,values),max=Math.max.apply(null,values);
  const range=Math.max(1,max-min);
  /* Graduations verticales : pas ROND (100/200/400/500...) adapte a
     l'etendue reelle de l'historique plutot qu'un nombre de lignes fixe --
     sinon on affiche des valeurs illisibles comme "1053, 1179, 1305" des
     que min/max ne tombent pas sur des ronds. Vise environ 3 intervalles. */
  const rawStep=range/3;
  const mag=Math.pow(10,Math.floor(Math.log10(rawStep||1)));
  const niceSteps=[1,2,5,10];
  let step=mag*10;
  for(const n of niceSteps){if(rawStep<=n*mag){step=n*mag;break;}}
  const gridVals=[];
  for(let v=Math.ceil(min/step)*step;v<=max+0.001;v+=step)gridVals.push(Math.round(v));
  let gridSvg="";
  for(const v of gridVals){
    const y=padT+plotH-((v-min)/range)*plotH;
    gridSvg+='<line x1="'+padL+'" y1="'+y.toFixed(1)+'" x2="'+(w-padR)+'" y2="'+y.toFixed(1)+'" stroke="rgba(239,233,217,.10)" stroke-width="1"/>'+
      '<text x="'+(padL-4)+'" y="'+(y+3).toFixed(1)+'" text-anchor="end" fill="var(--sage)" font-size="8.5">'+v+'</text>';
  }
  /* Graduation horizontale : la date du premier et du dernier point.
     Un historique construit un point par exercice resolu (pas un point
     par jour), donc des graduations intermediaires egalement espacees ne
     correspondraient a aucun intervalle de temps regulier -- seules les
     deux extremites ont une date sure a afficher sans supposer une
     repartition uniforme dans le temps. */
  /* Format americain (mois/jour) en anglais, francais (jour/mois) en
     francais -- nom distinct de fmtDate() plus haut dans ce fichier
     (utilisee pour l'historique des parties, portee locale ici donc pas
     de collision reelle), mais meme faille repartie a ne pas reproduire :
     un simple gabarit identique pour les deux langues afficherait "jour"
     partout sans jamais vraiment adapter l'ordre a la langue active. */
  const fmtDate=ts=>{
    const d=new Date(ts),mo=String(d.getMonth()+1).padStart(2,"0"),da=String(d.getDate()).padStart(2,"0");
    return LANG==="fr"?da+"/"+mo:mo+"/"+da;
  };
  const dateSvg='<text x="'+padL+'" y="'+(h-3)+'" text-anchor="start" fill="var(--sage)" font-size="8.5">'+fmtDate(hist[0].t)+'</text>'+
    '<text x="'+(w-padR)+'" y="'+(h-3)+'" text-anchor="end" fill="var(--sage)" font-size="8.5">'+fmtDate(hist[hist.length-1].t)+'</text>';
  let d="";
  hist.forEach((p,i)=>{
    const x=padL+(hist.length>1?(i/(hist.length-1))*plotW:plotW/2);
    const y=padT+plotH-((p.r-min)/range)*plotH;
    d+=(i?"L":"M")+x.toFixed(1)+" "+y.toFixed(1);
  });
  /* Couleur laiton du site (signale : "si la barre reste tout du long,
     autant la mettre dans le jaune du site") -- c'est un element permanent
     de l'interface, pas un accuse de reception ponctuel (contrairement au
     vert des badges debloques), donc coherent de reprendre l'accent
     principal du site plutot qu'une couleur secondaire. */
  el.innerHTML='<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+t("Rating over time")+'">'+
    gridSvg+dateSvg+
    '<path d="'+d+'" fill="none" stroke="var(--brass)" stroke-width="2" stroke-linejoin="round"/>'+
    '</svg>';
}
$("btnAnalyse").onclick=analyseGame;

/* ==========================================================
   9. PGN
   ========================================================== */
function buildPgn(){
  const d=new Date();
  const date=d.getFullYear()+"."+String(d.getMonth()+1).padStart(2,"0")+"."+String(d.getDate()).padStart(2,"0");
  let result="*";
  const g=game;
  if(isFlagged())result=clock.flagged===W?"0-1":"1-0";
  else if(g.isCheckmate())result=g.turn===W?"0-1":"1-0";
  else if(g.isDraw())result="1/2-1/2";
  const {cat,item}=tcCurrent();
  const tc=cat==="none"||cat==="daily"?"-":(item[0]*60)+"+"+item[1];
  /* Meme nom que celui affiche a l'ecran, avec la force : une partie
     exportee doit dire contre quoi elle a ete jouee. */
  const bot=(typeof botLabel==="function")?botLabel():"Chang";
  const white=myColor===W?"You":bot;
  const black=myColor===W?bot:"You";
  let body="",line="";
  for(let i=0;i<sanList.length;i++){
    const tok=(i%2===0?(i/2+1)+". ":"")+sanList[i]+" ";
    if(line.length+tok.length>78){body+=line.trim()+"\n";line="";}
    line+=tok;
  }
  body+=line.trim();
  return '[Event "Casual game"]\n[Site "chang64"]\n[Date "'+date+'"]\n[Round "-"]\n[White "'+white+
    '"]\n[Black "'+black+'"]\n[Result "'+result+'"]\n[TimeControl "'+tc+'"]\n\n'+
    (body?body+" "+result:result)+"\n";
}
function loadPgn(text){
  const msg=$("pgnMsg");
  let raw=(text||"").replace(/\[[^\]]*\]/g,"").replace(/\{[^}]*\}/g,"").replace(/;[^\n]*/g,"");
  raw=raw.replace(/\$\d+/g,"").replace(/\d+\s*\.(\.\.)?/g," ").replace(/(1-0|0-1|1\/2-1\/2|\*)/g," ");
  const toks=raw.split(/\s+/).filter(Boolean);
  if(!toks.length){msg.textContent=t("No moves found in that PGN.");return false;}
  const g=new Game();const san=[],uci=[];let stopped=null;
  for(const tok of toks){
    const clean=tok.replace(/[!?]+$/,"");
    const mv=g.moves().find(m=>cleanSan(g.san(m))===cleanSan(clean));
    if(!mv){stopped=tok;break;}
    san.push(g.san(mv));uci.push(g.uci(mv));g.makeMove(mv);
  }
  if(!san.length){
    msg.textContent=stopped
      ? t("Could not read that PGN: \u201c{tok}\u201d is not a legal move from the start.",{tok:stopped})
      : t("Could not read any legal move from that PGN.");
    return false;
  }
  clearAnalysis();
  isReviewGame=true;
  game=g;sanList=san;gameUci=uci;
  gameStartFen=null;
  lastMove=g.history.length?g.history[g.history.length-1].m:null;
  clock={enabled:false,w:0,b:0,inc:0,active:null,last:0,flagged:null};
  myColor=W;flipped=false;mainGame=null;
  refreshGame();
  msg.textContent=stopped
    ? t("Loaded {n} half-moves, then stopped: \u201c{tok}\u201d is not legal in that position.",{n:san.length,tok:stopped})
    : t("Loaded {n} half-moves. Step through with the arrows, or analyse it.",{n:san.length});
  return true;
}
$("btnPgnCopy").onclick=()=>{copyText(buildPgn());$("pgnMsg").textContent=t("PGN copied to the clipboard.");};
$("btnPgnDownload").onclick=()=>{
  try{
    const blob=new Blob([buildPgn()],{type:"application/x-chess-pgn"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);a.download="chang64-game.pgn";
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(a.href),2000);
    $("pgnMsg").textContent=t("Download started.");
  }catch(e){copyText(buildPgn());$("pgnMsg").textContent=t("Download unavailable here, PGN copied instead.");}
};
$("btnPgnLoad").onclick=()=>loadPgn($("pgnIn").value);


/* ==========================================================
   9b. HISTORIQUE DES PARTIES (dans le navigateur)
   ========================================================== */
let history=[],gameSaved=false;
async function loadHistory(){
  try{
    const r=await window.storage.get("chang64:games");
    if(r&&r.value){const d=JSON.parse(r.value);if(Array.isArray(d))history=d;}
  }catch(e){}
}
async function saveHistory(){
  try{await window.storage.set("chang64:games",JSON.stringify(history.slice(0,30)));}catch(e){}
}
function resultCode(){
  if(typeof resigned!=="undefined"&&resigned!==null)return resigned===myColor?"loss":"win";
  if(isFlagged())return clock.flagged===myColor?"loss":"win";
  if(game.isCheckmate())return (game.turn===W?B:W)===myColor?"win":"loss";
  return "draw";
}
function saveFinishedGame(){
  if(gameSaved||mode!=="play"||isReviewGame)return;
  if(gameUci.length<4)return;
  gameSaved=true;
  const {cat,item}=tcCurrent();
  history.unshift({
    t:Date.now(),
    c:myColor===W?"w":"b",
    r:resultCode(),
    tc:cat==="none"?"":tcLabel(cat,item),
    lvl:botLevel,
    m:gameUci.join(" "),
    fen:gameStartFen||null
  });
  history=history.slice(0,30);
  saveHistory();renderHistory();
}
function fmtDate(ts){
  const d=new Date(ts);
  const day=String(d.getDate()).padStart(2,"0"),mon=String(d.getMonth()+1).padStart(2,"0");
  const hh=String(d.getHours()).padStart(2,"0"),mm=String(d.getMinutes()).padStart(2,"0");
  return LANG==="fr"?`${day}/${mon} ${hh}:${mm}`:`${day}/${mon} ${hh}:${mm}`;
}
const RES_LABEL={win:"W",loss:"L",draw:"D"};
function renderHistory(){
  const box=$("historyList"); if(!box)return;
  const htt=$("historyTitleTxt"); if(htt)htt.textContent=t("Your games");
  $("historyActions").classList.toggle("hide",history.length===0);
  if(!history.length){
    $("historyNote").textContent=t("Finished games are stored in this browser so you can replay and review them later.");
    box.innerHTML='<p class="history-empty">'+t("No finished game yet.")+'</p>';
    return;
  }
  $("historyNote").textContent=t("{n} game(s) kept on this device. Pick one to replay and review it.",{n:history.length});
  box.innerHTML="";
  history.forEach((g,i)=>{
    const b=document.createElement("button");
    b.className="history-item";
    const san=sanOf(g.m,g.fen);
    const op=detectOpening(san);
    const side=g.c==="w"?t("White"):t("Black");
    const moves=Math.ceil(g.m.split(" ").filter(Boolean).length/2);
    b.innerHTML='<span class="res '+g.r+'">'+t(RES_LABEL[g.r])+'</span>'+
      '<span class="meta"><b>'+(op?op.name:t("Game"))+'</b>'+
      '<span>'+fmtDate(g.t)+" \u00b7 "+side+(g.tc?" \u00b7 "+g.tc:"")+" \u00b7 "+t("{n} moves",{n:moves})+'</span></span>';
    b.onclick=()=>openHistoryGame(i);
    box.appendChild(b);
  });
}
function sanOf(uciStr,fen){
  const g=fen?new Game(fen):new Game(),out=[];
  for(const u of uciStr.split(" ").filter(Boolean)){
    const mv=g.moves().find(x=>g.uci(x)===u);
    if(!mv)break;
    out.push(g.san(mv));g.makeMove(mv);
  }
  return out;
}
/* Ouvrir une ancienne partie du journal reste dans Jouer, dans la meme
   interface de revue que juste apres avoir joue (bandeau, jauge, panneau
   Revue) -- appelee uniquement depuis l'onglet Jouer lui-meme (le journal y
   vit), aucun changement de mode n'est necessaire. */
function openHistoryGame(i){
  const rec=history[i]; if(!rec)return;
  const startFen=typeof rec.fen==="string"?rec.fen:null;
  const g=startFen?new Game(startFen):new Game(),san=[],uci=[];
  for(const u of rec.m.split(" ").filter(Boolean)){
    const mv=g.moves().find(x=>g.uci(x)===u);
    if(!mv)break;
    san.push(g.san(mv));uci.push(u);g.makeMove(mv);
  }
  if(!san.length)return;
  clearAnalysis();
  isReviewGame=true;gameSaved=true;
  game=g;sanList=san;gameUci=uci;
  gameStartFen=startFen;
  myColor=rec.c==="w"?W:B;flipped=myColor===B;
  lastMove=g.history.length?g.history[g.history.length-1].m:null;
  clock={enabled:false,w:0,b:0,inc:0,active:null,last:0,flagged:null};
  if(typeof resigned!=="undefined")resigned=null;
  if(typeof gameStarted!=="undefined")gameStarted=true;
  resultInfo=null;mainGame=null;
  refreshGame();
  gotoPly(0);
  const st=$("status");st.className="status";
  st.textContent=t("Replaying a saved game. Step through it or run the review.");
  if(typeof focusBoard==="function")focusBoard();
}
$("btnHistoryClear").onclick=()=>{
  const b=$("btnHistoryClear");
  if(!b.classList.contains("armed")){
    b.classList.add("armed");b.textContent=t("Confirm");
    setTimeout(()=>{b.classList.remove("armed");b.textContent=t("Clear history");},5000);
    return;
  }
  b.classList.remove("armed");b.textContent=t("Clear history");
  history=[];saveHistory();renderHistory();
};

/* ==========================================================
   HISTORIQUE ENTRE AMIS
   ========================================================== */
/* Meme principe que l'historique de Jouer (chang64:games) juste au-dessus,
   mais separe : contrairement a une partie Jouer, une partie Entre amis
   n'avait jusqu'ici aucune trace persistante au-dela de la plus recente
   (chang64:friend, ecrasee a chaque nouvelle partie) -- impossible de
   retrouver une ancienne partie une fois la suivante commencee. */
let amiHistory=[],amiGameSaved=false;
async function loadAmiHistory(){
  try{const r=await window.storage.get("chang64:friendgames");
    if(r&&r.value){const d=JSON.parse(r.value);if(Array.isArray(d))amiHistory=d;}}catch(e){}
}
async function saveAmiHistory(){
  try{await window.storage.set("chang64:friendgames",JSON.stringify(amiHistory.slice(0,30)));}catch(e){}
}
function amiResultCode(){
  if(amiResigned!==null)return amiResigned===amiColor?"loss":"win";
  if(game.isCheckmate())return (game.turn===W?B:W)===amiColor?"win":"loss";
  return "draw";
}
function saveFinishedAmiGame(){
  if(amiGameSaved||mode!=="friend")return;
  if(amiMoves.length<2)return;
  /* amiMoves stocke des objets {from64,to64,promo} (voir rebuildAmi), pas
     des chaines UCI comme gameUci en mode Jouer : il faut rejouer la partie
     pour en tirer la liste UCI reellement utilisable par gotoPly()/
     rebuildTo() une fois la partie rouverte depuis l'historique. */
  const g=new Game(),uci=[];
  for(const m of amiMoves){
    const mv=g.moves().find(x=>sq64(x.from)===m.from64&&sq64(x.to)===m.to64&&(x.promo||0)===(m.promo||0));
    if(!mv)break;
    uci.push(sqN(mv.from)+sqN(mv.to)+(mv.promo?SYM[mv.promo]:""));
    g.makeMove(mv);
  }
  if(uci.length<2)return;
  amiGameSaved=true;
  amiHistory.unshift({t:Date.now(),c:amiColor===W?"w":"b",r:amiResultCode(),m:uci.join(" ")});
  amiHistory=amiHistory.slice(0,30);
  saveAmiHistory();renderAmiHistory();
}
function renderAmiHistory(){
  const box=$("amiHistoryList"); if(!box)return;
  $("amiHistoryActions").classList.toggle("hide",amiHistory.length===0);
  if(!amiHistory.length){
    $("amiHistoryNote").textContent=t("Finished games are stored in this browser so you can replay and review them later.");
    box.innerHTML='<p class="history-empty">'+t("No finished game yet.")+'</p>';
    return;
  }
  $("amiHistoryNote").textContent=t("{n} game(s) kept on this device. Pick one to replay and review it.",{n:amiHistory.length});
  box.innerHTML="";
  amiHistory.forEach((g,i)=>{
    const b=document.createElement("button");
    b.className="history-item";
    const san=sanOf(g.m,null);
    const op=detectOpening(san);
    const side=g.c==="w"?t("White"):t("Black");
    const moves=Math.ceil(g.m.split(" ").filter(Boolean).length/2);
    b.innerHTML='<span class="res '+g.r+'">'+t(RES_LABEL[g.r])+'</span>'+
      '<span class="meta"><b>'+(op?op.name:t("Game"))+'</b>'+
      '<span>'+fmtDate(g.t)+" \u00b7 "+side+" \u00b7 "+t("{n} moves",{n:moves})+'</span></span>';
    b.onclick=()=>openAmiHistoryGame(i);
    box.appendChild(b);
  });
}
/* Meme principe que openHistoryGame juste au-dessus, "idem pour inviter" :
   reste dans l'interface de revue de Jouer plutot que de basculer vers
   Analyser. mainGame/mainSan/mainStarted sont le cache que setMode("play")
   restaure normalement en y revenant depuis un autre onglet -- les
   pre-remplir ici avec la partie choisie fait prendre exactement ce
   chemin, sans dupliquer la logique de setMode(). */
function openAmiHistoryGame(i){
  const rec=amiHistory[i]; if(!rec)return;
  const g=new Game(),san=[],uci=[];
  for(const u of rec.m.split(" ").filter(Boolean)){
    const mv=g.moves().find(x=>g.uci(x)===u);
    if(!mv)break;
    san.push(g.san(mv));uci.push(u);g.makeMove(mv);
  }
  if(!san.length)return;
  if(typeof clearAnalysis==="function")clearAnalysis();
  gameUci=uci;gameStartFen=null;
  isReviewGame=true;gameSaved=true;
  myColor=rec.c==="w"?W:B;
  if(typeof resigned!=="undefined")resigned=null;
  resultInfo=null;
  mainGame=g;mainSan=san;
  mainLast=g.history.length?g.history[g.history.length-1].m:null;
  mainStarted=true;mainFlipped=myColor===B;
  setMode("play");
  gotoPly(0);
  const st=$("status"); if(st){st.className="status";st.textContent=t("Replaying a saved game. Step through it or run the review.");}
  if(typeof focusBoard==="function")focusBoard();
}
$("btnAmiHistoryClear").onclick=()=>{
  const b=$("btnAmiHistoryClear");
  if(!b.classList.contains("armed")){
    b.classList.add("armed");b.textContent=t("Confirm");
    setTimeout(()=>{b.classList.remove("armed");b.textContent=t("Clear history");},5000);
    return;
  }
  b.classList.remove("armed");b.textContent=t("Clear history");
  amiHistory=[];saveAmiHistory();renderAmiHistory();
};

/* ==========================================================
   10. PUZZLE RATING, DAY STREAK, PUZZLE RUSH
   ========================================================== */
/* Un point par palier de LEVELS (voir ui.js) : dix valeurs desormais, dans
   le meme esprit qu'un classement Elo approximatif par niveau, pour que
   updateRating() sache a quoi comparer une victoire ou une defaite. */
const LEVEL_RATING=[800,1000,1150,1300,1450,1600,1750,1900,2100,2300];
/* Badges de constance/volume/notation (session gamification) : construits
   sur des compteurs deja suivis (prog.solved/days/rating), pas de nouvel
   etat a inventer pour ceux-la. Le seuil, une fois franchi, reste acquis
   pour toujours meme si le compteur redescend ensuite (rating qui baisse
   apres une mauvaise serie, streak de jours qui se casse) -- prog.badges
   n'enregistre que les ids deja debloques, jamais retires. Pas de badges
   thematiques ici volontairement : ils demandent un historique par motif
   qui n'existe pas encore (a construire une fois la banque de puzzles
   stabilisee, cf. classify() corrige cette semaine). Noms factuels plutot
   que des titres ronflants ("Centurion" etc.) : coherent avec le ton
   "No account. No ads. No noise." du reste du site. */
const BADGES=[
  {id:"solved_10",type:"solved",n:10,label:"10 solved"},
  {id:"solved_25",type:"solved",n:25,label:"25 solved"},
  {id:"solved_50",type:"solved",n:50,label:"50 solved"},
  {id:"solved_100",type:"solved",n:100,label:"100 solved"},
  {id:"solved_250",type:"solved",n:250,label:"250 solved"},
  {id:"solved_500",type:"solved",n:500,label:"500 solved"},
  {id:"solved_1000",type:"solved",n:1000,label:"1000 solved"},
  {id:"solved_2000",type:"solved",n:2000,label:"2000 solved"},
  {id:"solved_5000",type:"solved",n:5000,label:"5000 solved"},
  {id:"days_1",type:"days",n:1,label:"First day"},
  {id:"days_3",type:"days",n:3,label:"3-day streak"},
  {id:"days_7",type:"days",n:7,label:"7-day streak"},
  {id:"days_14",type:"days",n:14,label:"14-day streak"},
  {id:"days_30",type:"days",n:30,label:"30-day streak"},
  {id:"days_60",type:"days",n:60,label:"60-day streak"},
  {id:"days_100",type:"days",n:100,label:"100-day streak"},
  {id:"days_365",type:"days",n:365,label:"365-day streak"},
  {id:"rating_900",type:"rating",n:900,label:"900 rating"},
  {id:"rating_1000",type:"rating",n:1000,label:"1000 rating"},
  {id:"rating_1100",type:"rating",n:1100,label:"1100 rating"},
  {id:"rating_1200",type:"rating",n:1200,label:"1200 rating"},
  {id:"rating_1350",type:"rating",n:1350,label:"1350 rating"},
  {id:"rating_1500",type:"rating",n:1500,label:"1500 rating"},
  {id:"rating_1650",type:"rating",n:1650,label:"1650 rating"},
  {id:"rating_1800",type:"rating",n:1800,label:"1800 rating"},
  {id:"rating_2000",type:"rating",n:2000,label:"2000 rating"},
  {id:"rating_2100",type:"rating",n:2100,label:"2100 rating"},
  {id:"rating_2300",type:"rating",n:2300,label:"2300 rating"},
  /* Badges thematiques (item logue "pour plus tard" dans les sessions
     precedentes, deferré jusqu'a stabilisation des 13 categories -- fait
     maintenant). Un seul palier par theme (25, comme l'exemple donne :
     "Pin: 25 solved") plutot que plusieurs paliers comme solved/days/rating
     : au nombre de 13 themes, multiplier les paliers gonflerait vite la
     grille de badges pour un gain de lisibilite douteux. Facile a etendre
     a plusieurs paliers plus tard si besoin. label est un gabarit
     {theme}/{n}, pas une chaine figee -- voir renderBadges() qui construit
     le texte final via t(b.label,{theme:t(b.theme),n:b.n}), et checkBadges()
     qui compare a prog.themeSolved[b.theme] plutot qu'a un champ de stat
     plat. theme reprend exactement les 13 libellés de content.js/THEME10,
     pas de nouvelle liste a maintenir en parallele. */
  {id:"theme_winning_capture",type:"theme",theme:"Winning capture",n:25,label:"{theme}: {n} solved"},
  {id:"theme_double_attack",type:"theme",theme:"Double attack",n:25,label:"{theme}: {n} solved"},
  {id:"theme_skewer",type:"theme",theme:"Skewer",n:25,label:"{theme}: {n} solved"},
  {id:"theme_mate_in_two",type:"theme",theme:"Mate in two",n:25,label:"{theme}: {n} solved"},
  {id:"theme_winning_move",type:"theme",theme:"Winning move",n:25,label:"{theme}: {n} solved"},
  {id:"theme_knight_fork",type:"theme",theme:"Knight fork",n:25,label:"{theme}: {n} solved"},
  {id:"theme_mate_in_one",type:"theme",theme:"Mate in one",n:25,label:"{theme}: {n} solved"},
  {id:"theme_back_rank_mate",type:"theme",theme:"Back-rank mate",n:25,label:"{theme}: {n} solved"},
  {id:"theme_pin",type:"theme",theme:"Pin",n:25,label:"{theme}: {n} solved"},
  {id:"theme_pawn_fork",type:"theme",theme:"Pawn fork",n:25,label:"{theme}: {n} solved"},
  {id:"theme_deflection",type:"theme",theme:"Deflection",n:25,label:"{theme}: {n} solved"},
  {id:"theme_quiet_move",type:"theme",theme:"Quiet move",n:25,label:"{theme}: {n} solved"},
  {id:"theme_mate_in_three",type:"theme",theme:"Mate in three",n:25,label:"{theme}: {n} solved"},
  /* Sprint et Coordonnees (2026-09-03, "allons-y tant qu'on y est") : un
     seul palier chacun, meme logique minimale que les badges thematiques
     ci-dessus -- pas une echelle complete comme solved/days/rating, ce
     sont des defis courts et rejouables, pas une progression a collectionner.
     Seuils estimes (pas de donnees de jeu reelles pour calibrer) : a
     ajuster si l'un des deux se revele trop facile ou trop dur une fois
     essaye en conditions reelles, meme esprit que les seuils de poids de
     page ailleurs dans le projet -- des reperes vivants, pas graves dans
     le marbre. type compare directement a prog.rushBest/prog.coordBest
     (deja suivis, rien de nouveau a journaliser) -- voir checkBadges(). */
  {id:"sprint_15",type:"rushBest",n:15,label:"Chang Sprint: {n} solved"},
  {id:"coord_20",type:"coordBest",n:20,label:"Coordinates: {n} correct"}
];
function checkBadges(){
  ensureProgFields();
  const stat={solved:prog.solved||0,days:prog.days||0,rating:prog.rating||0,
    rushBest:prog.rushBest||0,coordBest:prog.coordBest||0};
  let gained=null;
  for(const b of BADGES){
    if(prog.badges.includes(b.id))continue;
    /* type "theme" compare a un compteur par theme (prog.themeSolved), pas
       au flat "stat" ci-dessus -- seul type qui a besoin d'une cle
       supplementaire (b.theme) plutot que juste b.n. */
    const val=b.type==="theme"?(prog.themeSolved[b.theme]||0):stat[b.type];
    if(val>=b.n){prog.badges.push(b.id);prog.badgeDates[b.id]=Date.now();gained=b;}
  }
  return gained; /* le dernier nouveau badge de cet appel, pour un eventuel accuse de reception discret -- pas de popup pour l'instant, cf. "no noise" */
}
function renderBadges(){
  const el=$("badgeGrid");if(!el)return;
  ensureProgFields();
  el.innerHTML=BADGES.map(b=>{
    const unlocked=prog.badges.includes(b.id);
    const label=badgeLabel(b);
    return '<div class="badge'+(unlocked?' unlocked':'')+'">'+label+'</div>';
  }).join("");
}
function badgeLabel(b){
  /* {n} passe desormais a tous les types, pas seulement "theme" : les
     badges Sprint/Coordonnees (2026-09-03) en ont besoin pour leur
     gabarit "Chang Sprint: {n} solved". Inoffensif pour les anciens
     libelles fixes ("10 solved") qui n'ont pas de {n} a remplacer. */
  return b.type==="theme"?t(b.label,{theme:t(b.theme),n:b.n}):t(b.label,{n:b.n});
}
/* JJ/MM, sans heure -- juste le jour de deblocage, pas le moment precis
   (contrairement a fmtDate(), pense pour l'historique de parties). Meme
   convention deux chiffres/deux chiffres que fmtDate() par coherence, et
   parce qu'un format nomme (ex: "3 Sep") demanderait sa propre table de
   traduction FR alors que ce format-la n'en a pas besoin. */
function fmtDayMonth(ts){
  const d=new Date(ts);
  return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0");
}
/* Resume compact des badges (2026-09-03) : la grille complete (41 badges,
   la plupart grises pour un nouveau venu) restait lourde meme repliee dans
   "Mon historique". Affiche "X/41 debloques" et les quelques plus
   recents avec leur date -- la grille complete reste disponible juste en
   dessous, dans son propre repli imbrique (voir template.html). */
function renderBadgeSummary(){
  const sum=$("badgeSummary"),recent=$("badgeRecentGrid");
  if(!sum||!recent)return;
  ensureProgFields();
  /* Accord singulier/pluriel de "debloque(s)" (mise en page/texte) : le
     francais exige l'accord ("1/43 debloque" vs "2/43 debloques"), chose
     dont l'anglais n'a pas besoin ("1/43 unlocked" est deja correct quel
     que soit n) -- passer par LANG directement plutot que par deux cles
     t() distinctes, qui auraient du texte anglais identique pour un
     resultat francais different (impossible avec un dictionnaire a cle
     unique comme t()). */
  sum.textContent=LANG==="fr"
    ? prog.badges.length+"/"+BADGES.length+" débloqué"+(prog.badges.length===1?"":"s")
    : prog.badges.length+"/"+BADGES.length+" unlocked";
  const ids=prog.badges.slice().sort((a,b)=>(prog.badgeDates[b]||0)-(prog.badgeDates[a]||0)).slice(0,4);
  recent.innerHTML=ids.map(id=>{
    const b=BADGES.find(x=>x.id===id); if(!b)return "";
    const d=prog.badgeDates[id];
    return '<div class="badge unlocked">'+badgeLabel(b)+(d?' · <span class="badge-date">'+fmtDayMonth(d)+'</span>':'')+'</div>';
  }).join("");
}
function ensureProgFields(){
  if(typeof prog.showEval!=="boolean")prog.showEval=false;
  if(typeof prog.theme!=="string")prog.theme="";
  if(typeof prog.usedHint!=="boolean")prog.usedHint=false;
  if(typeof prog.rating!=="number")prog.rating=800;
  if(typeof prog.days!=="number")prog.days=0;
  if(typeof prog.rushBest!=="number")prog.rushBest=0;
  if(typeof prog.coordBest!=="number")prog.coordBest=0;
  if(!prog.endgames)prog.endgames={};
  if(!prog.lastDay)prog.lastDay="";
  if(!Array.isArray(prog.badges))prog.badges=[];
  if(!Array.isArray(prog.ratingHistory))prog.ratingHistory=[];
  if(!prog.dailyLog||typeof prog.dailyLog!=="object")prog.dailyLog={};
  /* Compteur par theme (badges thematiques) : {"Pin":12,"Skewer":3,...},
     incremente dans finishPuzzle() (ui.js) a chaque exercice reussi, tous
     modes confondus SAUF Chang Sprint (onPuzzleResult() y court-circuite
     finishPuzzle avant d'atteindre ce code, comme pour prog.solved). */
  if(!prog.themeSolved||typeof prog.themeSolved!=="object")prog.themeSolved={};
  /* Recap hebdo (item 3 de la liste "pour plus tard") : deux journaux
     timestampes de plus, meme logique de plafonnement que
     prog.ratingHistory (shift() des plus anciens au-dela de 500 entrees --
     largement plus que 7 jours d'usage normal, la fenetre glissante ne lit
     jamais que la queue recente). solveLog : un timestamp par exercice
     REUSSI (pas par tentative, contrairement a prog.ratingHistory qui logge
     aussi les echecs) -- c'est "solved" au sens ou le reste du site
     l'entend deja (prog.solved, badges "solved_N"). badgeDates : date de
     deblocage de chaque badge, cle=id du badge -- absent avant cette
     session, prog.badges ne contenait que les ids sans horodatage. */
  if(!Array.isArray(prog.solveLog))prog.solveLog=[];
  if(!prog.badgeDates||typeof prog.badgeDates!=="object")prog.badgeDates={};
  /* Records personnels au-dela du Sprint (item 3, "pour plus tard") :
     - fastestSolveMs : record absolu, jamais recalcule a la baisse -- meme
       philosophie que prog.best (streak) et les badges, un record acquis
       reste acquis. undefined tant qu'aucun exercice n'a ete resolu du
       premier coup (voir finishPuzzle) : distinct de 0, qui serait un
       temps reel (impossible mais on evite l'ambiguite).
     - dayCount/dayCountDate : compteur du jour EN COURS uniquement (remis a
       zero au changement de date, meme mecanique que prog.lastDay dans
       bumpStreak()) -- pas destine a etre lu directement, sert juste a
       calculer bestDay ci-dessous sans dependre de prog.solveLog (qui est
       plafonne a 500 entrees et perdrait un record ancien avec le temps).
     - bestDay : record absolu du nombre d'exercices resolus en une seule
       journee, derive de dayCount mais persistant independamment de lui. */
  if(typeof prog.fastestSolveMs!=="number")prog.fastestSolveMs=undefined;
  if(typeof prog.dayCount!=="number")prog.dayCount=0;
  if(!prog.dayCountDate)prog.dayCountDate="";
  if(typeof prog.bestDay!=="number")prog.bestDay=0;
  /* File de revision des erreurs (item 4, "pour plus tard") : jusqu'ici,
     la revision (reviewMistakes/loadAndRevealSolution) n'existait que pour
     le Sprint et seulement pendant la session en cours (lastRushHistory,
     variable JS non persistee). Ici : une file PERSISTANTE, alimentee
     depuis TOUS les modes (registerWrong(), ui.js), disponible n'importe
     quand apres -- pas de fenetre de 3 minutes. {id,theme,code,ts,box,due}
     par entree, dedupliquee par id (un exercice rate plusieurs fois de
     suite n'apparait qu'une fois), plafonnee a 200 comme les autres
     journaux. box/due : repetition espacee (item 5, ajoutee dans la meme
     session) -- voir SRS_DELAYS_DAYS plus bas pour le barème. Une entree
     n'est retiree qu'apres 5 reussites espacees (finishPuzzle, ui.js), pas
     des la premiere : contrairement a une simple liste "a corriger", elle
     doit reapparaitre plusieurs fois avant de se vider pour de bon. */
  if(!Array.isArray(prog.mistakeQueue))prog.mistakeQueue=[];
}
function todayKey(){
  const d=new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function bumpStreak(){
  ensureProgFields();
  const day=todayKey();
  if(prog.lastDay===day)return;
  const y=new Date();y.setDate(y.getDate()-1);
  const yk=y.getFullYear()+"-"+String(y.getMonth()+1).padStart(2,"0")+"-"+String(y.getDate()).padStart(2,"0");
  prog.days=prog.lastDay===yk?prog.days+1:1;
  prog.lastDay=day;
  if(typeof checkBadges==="function")checkBadges();
}
/* ==========================================================
   CALENDRIER DE COMPLETION (exercices du jour)
   ========================================================== */
/* Pas d'Intl.DateTimeFormat pour les noms de mois/jours : meme choix que
   fmtDate() plus haut (graphique de notation), un gabarit fige par langue
   plutot qu'une API dont la disponibilite des locales varie selon le
   navigateur. */
const MONTH_NAMES={
  en:["January","February","March","April","May","June","July","August","September","October","November","December"],
  fr:["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"]
};
const WEEKDAY_SHORT={en:["Mo","Tu","We","Th","Fr","Sa","Su"],fr:["L","M","M","J","V","S","D"]};
function calDateKey(y,m,d){return y+"-"+String(m+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");}
/* Meme formule que dailyPuzzle() (ui.js), mais pour une date donnee plutot
   que "aujourd'hui" -- doit rester EXACTEMENT synchronisee avec elle (meme
   epoch, meme modulo) sinon le calendrier pointerait vers un autre
   exercice que celui reellement resolu ce jour-la. */
function dateToDailyId(key){
  const [y,m,d]=key.split("-").map(Number);
  const n=Math.floor(Date.UTC(y,m-1,d)/86400000);
  const ids=Object.keys(PUZZLE_INDEX);
  return ids[n%ids.length];
}
/* Duel du jour (item 6) : le lien pointe vers #puzzle=<id du jour>, deja
   compris par applyDeepLink() (ui.js) -- l'ami qui l'ouvre tombe
   directement sur l'exercice, quel que soit le jour ou il clique (l'id est
   calcule a partir de la date d'AUJOURD'HUI au moment du partage, pas
   recalcule cote destinataire ; s'il ouvre le lien un autre jour, il joue
   quand meme LE bon exercice, celui du jour ou son ami l'a envoye -- pas
   forcement celui de SON propre jour). {n} coups : longueur de puzzle.sol,
   propriete de l'exercice lui-meme, pas une performance personnelle a
   suivre -- rien de nouveau a stocker. */
function openDailyChallenge(){
  const panel=$("dailyChallengePanel"),link=$("dailyChallengeLink"),share=$("dailyChallengeShare");
  if(!panel||!link||!share||!puzzle)return;
  const url=baseUrl()+"#puzzle="+dateToDailyId(todayKey());
  link.value=url;
  panel.classList.remove("hide");
  shareButtons(share,url,t("I solved today's puzzle in {n} moves. Your turn:",{n:(puzzle.sol||[]).length}),true);
}
if($("btnChallengeDaily"))$("btnChallengeDaily").onclick=openDailyChallenge;
/* ==========================================================
   MENU A 5 CARTES DE "RESOUDRE" (discussion UX, 2026-09-03)
   ========================================================== */
/* Routeur interne a l'onglet "puzzles", independant des couches de
   setMode() (voir ui.js/ui3.js) -- Puzzles/Puzzle du jour/Finales sont de
   nouveaux "ecrans" geres ici ; Sprint et Coordonnees restent geres par
   setMode("train") comme avant (ce mode partage deja le meme plateau et
   sait deja router les clics vers l'entrainement, pas de raison de le
   dupliquer), juste selectionnes via trainView (ui3.js) avant d'y entrer. */
let solveScreen="menu";
/* Drapeau anti-course (bug trouve en corrigeant le rattrapage des jours
   manques, item 1) : showSolveScreen("puzzles"|"daily") declenche en
   interne nextPuzzle()/dailyPuzzle(), qui chargent chacun un exercice de
   facon ASYNCHRONE (niveau pas encore en cache -> loadLevel(cb)). Un
   appelant qui veut charger LUI-MEME un exercice precis (rattrapage d'un
   jour, revision d'une erreur, revisite d'un jour deja fait) doit d'abord
   passer par setMode()/showSolveScreen() pour amener le bon ecran a
   l'affichage -- mais si on laisse faire, ce chargement interne demarre sa
   propre chaine asynchrone en parallele de celle de l'appelant, et peut
   ecraser silencieusement le puzzle voulu si elle termine APRES la
   sienne (l'ordre des deux chaines n'est pas garanti, ca depend de ce qui
   est deja en cache). Ce drapeau, leve juste autour de l'appel a
   setMode()/showSolveScreen() puis aussitot redescendu (lecture/ecriture
   synchrones, aucun risque d'entrelacement), supprime purement et
   simplement le chargement interne concurrent -- l'appelant reste seul
   maitre du puzzle charge. Touche attemptDailyArchive() (ci-dessous),
   viewDailyArchive() et retryMistake() : les trois amenent un exercice
   precis vers l'ecran "puzzles"/"daily". */
let solveScreenSuppressAutoload=false;
function showSolveScreen(screen){
  solveScreen=screen;
  const menu=$("solveMenu"),ex=$("exPanel"),pzSide=$("solvePuzzlesSidebar"),
    daySide=$("solveDailySidebar"),eg=$("solveEndgamesScreen");
  if(menu)menu.classList.toggle("hide",screen!=="menu");
  if(ex)ex.classList.toggle("hide",screen!=="puzzles"&&screen!=="daily");
  if(pzSide)pzSide.classList.toggle("hide",screen!=="puzzles");
  if(daySide)daySide.classList.toggle("hide",screen!=="daily");
  if(eg)eg.classList.toggle("hide",screen!=="endgames");
  /* "Exercice suivant" n'a de sens que sur l'ecran Puzzles (file classique) :
     il n'existe pas de "prochain" puzzle du jour, il n'y en a qu'un par
     jour. Le laisser visible sur l'ecran "daily" chargeait silencieusement
     un exercice de la file classique tout en gardant affichee la barre
     laterale du jour (serie + calendrier) -- rien a voir l'un avec
     l'autre. Indice et Recommencer restent utiles sur les deux ecrans,
     donc seul ce bouton est cache, pas toute la rangee. */
  { const nb=$("btnNext"); if(nb)nb.classList.toggle("hide",screen==="daily"); }
  /* setMode() (ui.js) force le plateau partage visible pour tout mode
     autre que Jouer/Entre amis, juste avant d'arriver ici -- le menu est
     le seul ecran de "puzzles" qui n'a rien a y montrer, donc on le
     masque apres coup plutot que de contredire setMode() avant. */
  const bw=document.querySelector(".board-wrap");
  if(bw)bw.classList.toggle("hide",screen==="menu");
  if(screen==="menu"){renderSolveMenu();return;}
  if(screen==="puzzles"){if(!solveScreenSuppressAutoload)nextPuzzle();return;}
  if(screen==="daily"){if(!solveScreenSuppressAutoload)dailyPuzzle();return;}
  /* "endgames" : pas de demarrage automatique -- "Pick an endgame below."
     (deja dans le HTML) invite a choisir une puce. Un auto-demarrage ici
     a deja cause un bug par le passe (voir le commentaire dans ui3.js,
     branche "train" : plateau ecrase par une position Dame+Roi au simple
     passage sur l'onglet, avant meme un clic) -- on ne le reproduit pas.
*/
}
/* Sous-texte d'etat par carte : contexte de reprise sans bouton
   "Continuer" a part (aurait recree une hierarchie entre les 5 cartes,
   voir la discussion). Donnees deja stockees, juste affichees ici. */
function renderSolveMenu(){
  ensureProgFields();
  const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
  set("subSolvePuzzles",t("Level {n} · {r} rating",{n:prog.level,r:prog.rating}));
  const doneToday=!!(prog.dailyLog&&prog.dailyLog[todayKey()]);
  set("subSolveDaily",t(doneToday?"Done today ✓ · {n}-day streak":"Not done yet · {n}-day streak",{n:prog.days||0}));
  set("subSolveSprint",t("Best: {n}",{n:prog.rushBest||0}));
  set("subSolveCoord",t("Best: {n}",{n:prog.coordBest||0}));
  /* "Reussies" plutot que "tentees" (2026-09-03) : une finale tentee sans
     jamais tenir l'objectif de coups ne dit pas grand-chose sur la maitrise
     reelle. prog.endgames[id] est le meilleur nombre de coups obtenu ; on
     compare a scenario.budget (ENDGAMES, ui3.js) pour savoir si ce record
     tient effectivement l'objectif, pas seulement si la finale a ete
     essayee au moins une fois. */
  const egDone=typeof ENDGAMES!=="undefined"?ENDGAMES.filter(sc=>{
    const best=(prog.endgames||{})[sc.id];
    return typeof best==="number"&&best<=sc.budget;
  }).length:0;
  set("subSolveEndgames",t("{n}/5 mastered",{n:egDone}));
}
if($("cardSolvePuzzles"))$("cardSolvePuzzles").onclick=()=>showSolveScreen("puzzles");
if($("cardSolveDaily"))$("cardSolveDaily").onclick=()=>showSolveScreen("daily");
if($("cardSolveEndgames"))$("cardSolveEndgames").onclick=()=>showSolveScreen("endgames");
if($("cardSolveSprint"))$("cardSolveSprint").onclick=()=>{
  trainView="sprint";setMode("train");
  /* Precharge le pool en tache de fond des le clic sur la carte : le temps
     que l'utilisateur lise "Ready when you are" et clique sur "Start", il
     est generalement deja arrive -- evite que startRush() (ui2.js) n'ait
     a afficher "Chargement des exercices..." juste apres avoir dit qu'on
     etait pret, contradiction qui n'avait aucun sens a l'ecran. */
  if(!RUSH_POOL&&typeof loadRushPool==="function")loadRushPool();
  /* Va directement a l'ecran "Ready when you are" (beginRushFlow, plus
     bas) : cliquer la carte exprime deja l'intention de demarrer, pas la
     peine de repasser par le bouton "Start Chang Sprint" du panneau
     -- sauf si un sprint est deja en cours (repli sur ce meme panneau
     pour l'abandonner, pas de demarrage force par-dessus). */
  if(!(typeof rush!=="undefined"&&rush)&&typeof beginRushFlow==="function")beginRushFlow();
  goTop();
};
if($("cardSolveCoord"))$("cardSolveCoord").onclick=()=>{
  trainView="coord";setMode("train");
  /* Meme logique que la carte Chang Sprint (ui2.js) : va directement a
     l'ecran "Ready", saute le bouton intermediaire "Start 30 seconds" du
     panneau. Ne force rien si des coordonnees tournent deja (repli sur le
     panneau pour arreter). coordSide reste toujours present dans le DOM
     (juste cache par CSS, jamais retire), donc beginCoordFlow() peut le
     lire sans attendre quoi que ce soit. */
  if(!coord&&typeof beginCoordFlow==="function")beginCoordFlow();
  goTop();
};
/* Rouvre l'exercice du jour d'une date passee, solution deja jouee et
   affichee (mode consultation) -- reutilise loadAndRevealSolution(), deja
   ecrit pour la revision des erreurs de Sprint, meme mecanique. */
function viewDailyArchive(key){
  if(!PUZZLE_INDEX){loadPuzzleIndex(()=>viewDailyArchive(key));return;}
  const id=dateToDailyId(key);
  const lvl=PUZZLE_INDEX[id];
  if(!lvl)return;
  if(!LEVEL_CACHE[lvl]){loadLevel(lvl,()=>viewDailyArchive(key));return;}
  const p=PUZZLE_CACHE[id];
  if(!p)return;
  /* Voir solveScreenSuppressAutoload plus haut : sans ce drapeau,
     showSolveScreen("daily") lancait sa propre chaine asynchrone
     (dailyPuzzle(), exercice d'AUJOURD'HUI) qui pouvait ecraser p apres
     coup, silencieusement -- bug de course trouve en corrigeant le
     rattrapage (item 1), touchait deja ce code existant. */
  solveScreenSuppressAutoload=true;
  if(typeof setMode==="function")setMode("puzzles",{screen:"daily"});
  solveScreenSuppressAutoload=false;
  loadAndRevealSolution(p);
  /* loadAndRevealSolution() pose puzzle.daily=false (ecrit pour le Sprint,
     qui n'a pas ce concept) : on le remet a true ici pour que l'etiquette
     "Puzzle of the day" reste correcte sur un exercice archive, et on
     rafraichit le texte deja pose par loadPuzzle() avec l'ancienne valeur. */
  puzzle.daily=true;
  puzzle.dailyCatchupKey=null; /* consultation d'un jour deja fait, pas un rattrapage */
  const et=$("exTheme"); if(et)et.textContent=t("Puzzle of the day · ")+t(puzzle.theme);
}
/* Rattrapage d'un jour PASSE et MANQUE (item 1) : contrairement a
   viewDailyArchive() ci-dessus (qui rejoue la solution DEJA connue), on
   charge l'exercice en vraie tentative -- meme mecanique que dailyPuzzle(),
   juste pour une date choisie plutot que celle du jour. puzzle.dailyCatchupKey
   indique a finishPuzzle() (ui.js) de cocher CE jour-la dans le calendrier
   (pas aujourd'hui), de ne pas faire avancer la serie, et de ne pas
   reveler "Defier un ami" (qui affirme resoudre le puzzle du jour ACTUEL). */
function attemptDailyArchive(key){
  if(!PUZZLE_INDEX){loadPuzzleIndex(()=>attemptDailyArchive(key));return;}
  const id=dateToDailyId(key);
  const lvl=PUZZLE_INDEX[id];
  if(!lvl)return;
  if(!LEVEL_CACHE[lvl]){loadLevel(lvl,()=>attemptDailyArchive(key));return;}
  const p=PUZZLE_CACHE[id];
  if(!p)return;
  solveScreenSuppressAutoload=true;
  if(typeof setMode==="function")setMode("puzzles",{screen:"daily"});
  solveScreenSuppressAutoload=false;
  puzzle=p;
  puzzle.daily=true;
  puzzle.dailyCatchupKey=key;
  loadPuzzle();
}
/* opts.nav=true : fleches mois precedent/suivant (page a part). Sans nav :
   mois courant fixe, pas de bouton (widget compact de l'ecran de
   progression). monthOffset=0 est toujours le mois en cours ; on empeche
   d'avancer au-dela (les exercices futurs n'existent pas encore a jouer). */
function renderCalendarGrid(containerId,monthOffset,opts){
  const el=$(containerId); if(!el)return;
  ensureProgFields();
  const now=new Date();
  const base=new Date(now.getFullYear(),now.getMonth()+monthOffset,1);
  const y=base.getFullYear(),m=base.getMonth();
  const daysInMonth=new Date(y,m+1,0).getDate();
  let startWeekday=new Date(y,m,1).getDay();
  startWeekday=(startWeekday+6)%7; /* dimanche=0 -> lundi=0 */
  const todayStr=calDateKey(now.getFullYear(),now.getMonth(),now.getDate());
  const wk=WEEKDAY_SHORT[LANG]||WEEKDAY_SHORT.en;
  const mo=MONTH_NAMES[LANG]||MONTH_NAMES.en;
  const nav=opts&&opts.nav;
  let html="";
  if(nav){
    /* "Mois precedent" borne au premier jour reellement enregistre dans
       prog.dailyLog (2026-09-03) : sans limite, on pouvait remonter
       indefiniment vers des mois forcement vides, puisque le calendrier
       n'existait pas avant. Pas de date de lancement fixe a coder en dur
       (site sans compte, chaque appareil a sa propre premiere utilisation) :
       on se base sur les propres donnees de la personne. Aucune donnee du
       tout -> rien d'utile a voir en arriere, le bouton est desactive des
       le mois courant. */
    const keys=Object.keys(prog.dailyLog||{});
    let prevDisabled=true;
    if(keys.length){
      keys.sort();
      const [ey,emRaw]=keys[0].split("-").map(Number);
      const em=emRaw-1;
      const prevBase=new Date(y,m-1,1);
      prevDisabled=prevBase.getFullYear()<ey||(prevBase.getFullYear()===ey&&prevBase.getMonth()<em);
    }
    html+='<div class="cal-head"><button type="button" class="cal-nav" data-dir="-1" aria-label="'+t("Previous month")+'"'+(prevDisabled?" disabled":"")+'>\u2039</button>'+
      '<span class="cal-title">'+mo[m]+" "+y+'</span>'+
      '<button type="button" class="cal-nav" data-dir="1" aria-label="'+t("Next month")+'"'+(monthOffset>=0?" disabled":"")+'>\u203a</button></div>';
  } else {
    html+='<div class="cal-head"><span class="cal-title">'+mo[m]+" "+y+"</span></div>";
  }
  html+='<div class="cal-grid">';
  for(const d of wk)html+='<div class="cal-dow">'+d+"</div>";
  for(let i=0;i<startWeekday;i++)html+='<div class="cal-day empty"></div>';
  for(let d=1;d<=daysInMonth;d++){
    const key=calDateKey(y,m,d);
    const done=!!prog.dailyLog[key];
    const isFuture=key>todayStr;
    const isToday=key===todayStr;
    /* "Manque, mais rattrapable" (item 1) : jour PASSE (pas aujourd'hui,
       pas futur -- inutile de proposer un rattrapage pour un jour qui
       n'est pas encore termine, il a deja son propre acces via l'ecran
       "Puzzle du jour") et jamais coche. Style distinct de "done" (voir
       CSS .cal-day.missed) -- contour pointille plutot que fond plein,
       pour ne pas laisser croire que le jour a ete resolu. */
    const missed=!done&&!isFuture&&!isToday;
    const cls=["cal-day"];
    if(done)cls.push("done");
    if(missed)cls.push("missed");
    if(isToday)cls.push("today");
    if(isFuture)cls.push("future");
    const clickable=(done||missed)&&!isFuture;
    html+='<div class="'+cls.join(" ")+'"'+(clickable?' data-date="'+key+'" role="button" tabindex="0" aria-label="'+key+'"':"")+">"+d+"</div>";
  }
  html+="</div>";
  el.innerHTML=html;
  el.querySelectorAll(".cal-day.done[data-date]").forEach(cell=>{
    cell.addEventListener("click",()=>viewDailyArchive(cell.getAttribute("data-date")));
    cell.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();viewDailyArchive(cell.getAttribute("data-date"));}});
  });
  el.querySelectorAll(".cal-day.missed[data-date]").forEach(cell=>{
    cell.addEventListener("click",()=>attemptDailyArchive(cell.getAttribute("data-date")));
    cell.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();attemptDailyArchive(cell.getAttribute("data-date"));}});
  });
  if(nav){
    el.querySelectorAll(".cal-nav").forEach(btn=>{
      if(btn.disabled)return;
      btn.addEventListener("click",()=>{
        const next=monthOffset+parseInt(btn.dataset.dir,10);
        if(opts.onNav)opts.onNav(next);
        renderCalendarGrid(containerId,next,opts);
      });
    });
  }
}
let calFullOffset=0;
function renderCalendarWidget(){
  const eb=$("tipCalendar"); if(eb)eb.textContent=t("Highlighted days are puzzles of the day you've solved. Tap one to see it again with the solution shown.");
  const fl=$("calFullLink"); if(fl)fl.textContent=t("See full calendar");
  renderCalendarGrid("calWidget",0,{nav:false});
}
function renderFullCalendar(){
  const ti=$("calendarTitle"); if(ti)ti.textContent=t("Daily puzzle calendar");
  const su=$("calendarSub"); if(su)su.textContent=t("Every day you've solved the puzzle of the day. Tap a highlighted day to see it again.");
  const bl=$("calBackLink"); if(bl)bl.textContent=t("Back to your progress");
  /* Conserve le mois affiche lors d'un changement de langue en cours de
     navigation (refreshCurrentMode rappelle cette fonction) : sans ca, on
     etait systematiquement ramene au mois courant. */
  renderCalendarGrid("calFull",calFullOffset,{nav:true,onNav:o=>{calFullOffset=o;}});
}
function updateRating(puzzleLevel,won){

  ensureProgFields();
  const pr=LEVEL_RATING[(puzzleLevel||1)-1];
  const e=1/(1+Math.pow(10,(pr-prog.rating)/400));
  const oldRating=prog.rating;
  /* Delta reellement applique, pas le delta "brut" : pres du plancher a
     400, l'arrondi + le Math.max ecretent parfois le changement reel
     (ex: -11 de calcul brut mais seulement -4 realises si on etait deja a
     404). Recalculer newRating-oldRating APRES le clamp, plutot que de
     stocker le delta brut, garantit que le nombre affiche a l'ecran
     correspond exactement a ce qui vient de se passer. */
  const newRating=Math.round(Math.max(400,oldRating+28*((won?1:0)-e)));
  prog.rating=newRating;
  lastRatingDelta=newRating-oldRating;
  /* Historique de notation (integration ELO, point 2) : un point par
     resolution, plafonne pour ne jamais grossir sans limite -- 500 points
     couvrent des mois d'usage normal (quelques exercices par jour) sans
     jamais peser sur le stockage local. On garde les PLUS RECENTS (shift
     en tete) plutot que les plus anciens : la courbe recente est ce qui
     interesse, pas le tout debut de l'historique si la limite est atteinte.
     prog.ratingHistory deja initialise par ensureProgFields() ci-dessus. */
  prog.ratingHistory.push({t:Date.now(),r:newRating});
  if(prog.ratingHistory.length>500)prog.ratingHistory.shift();
  if(typeof checkBadges==="function")checkBadges();
  return lastRatingDelta;
}
function renderExtraStats(){
  ensureProgFields();
  const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
  set("stRating",prog.rating);set("stDays",prog.days);
  set("hRating",prog.rating);set("hStreak",prog.days);
  set("rushBestTrain",prog.rushBest);   /* meme record, affiche dans Defis */
  /* Records personnels : "–" tant qu'aucun record n'existe encore (distinct
     d'un vrai "0:00", qui laisserait croire a un exercice resolu en temps
     nul), fmtTime() deja ecrit pour les pendules de partie -- meme format
     mm:ss.d, pas de nouveau formateur a maintenir. */
  set("stFastest",typeof prog.fastestSolveMs==="number"?fmtTime(prog.fastestSolveMs):"–");
  set("stBestDay",prog.bestDay||0);
  if(typeof renderBadges==="function")renderBadges();
  if(typeof renderBadgeSummary==="function")renderBadgeSummary();
  if(typeof renderCalendarWidget==="function")renderCalendarWidget();
  if(typeof drawRatingGraph==="function")drawRatingGraph();
  if(typeof renderWeeklyRecap==="function")renderWeeklyRecap();
  if(typeof renderMistakeQueue==="function")renderMistakeQueue();
  /* Rien de resolu : la bande n'afficherait que des zeros, ce qu'un premier
     visiteur lit comme "le site est vide" plutot que comme sa propre
     progression encore vierge. On lui propose de commencer a la place. */
  const vierge=!prog.solved;
  const strip=$("homeStrip"), start=$("homeStart");
  if(strip)strip.classList.toggle("hide",vierge);
  if(start)start.classList.toggle("hide",!vierge);
}
/* Recap hebdo (item 3, "pour plus tard") : une ligne discrete sur l'ecran
   d'accueil, pas de popup -- coherent avec "No account. No ads. No noise."
   deja affiche dans le code. Fenetre GLISSANTE de 7 jours (Date.now()-7j),
   pas la semaine calendaire (lundi-dimanche) : plus simple, et evite l'
   effet de bord d'un recap qui se vide brutalement chaque lundi matin.
   Masquee entierement si 0 exercice cette semaine plutot que d'afficher
   "0 exercices" -- meme logique que le refus du streak-freeze : rien qui
   ressemble a une relance culpabilisante. */
function renderWeeklyRecap(){
  ensureProgFields();
  const el=$("weeklyRecap"); if(!el)return;
  const since=Date.now()-7*86400000;
  const n=prog.solveLog.filter(ts=>ts>=since).length;
  const badgesThisWeek=Object.values(prog.badgeDates).filter(ts=>ts>=since).length;
  /* Corrige le 2026-09-03 : la condition d'affichage ne regardait QUE "n"
     (puzzles classiques cette semaine), donc une semaine passee entierement
     sur Chang Sprint/Coordonnees -- badges Sprint/Coordonnees ajoutes ce
     meme jour inclus -- laissait le recap entierement invisible, alors
     qu'il y avait bien quelque chose a montrer. Le declencheur est
     desormais "y a-t-il au moins une clause a dire", pas seulement des
     puzzles resolus. */
  if(!n&&!badgesThisWeek){el.classList.add("hide");el.textContent="";return;}
  const parts=[];
  if(n)parts.push(t(n===1?"{n} puzzle":"{n} puzzles",{n:n}));
  /* Delta de notation sur la fenetre : rating actuel moins le rating juste
     AVANT le premier point de la fenetre (le point precedent le premier
     "recent", pas le premier point recent lui-meme -- sinon on rate le
     changement du tout debut de la fenetre). Si toute l'historique est
     dans la fenetre (compte recent depuis moins de 7 jours), 800 (rating de
     depart, meme valeur que ensureProgFields()) sert de reference. Omis si
     delta nul : pas plus parlant qu'un "+0", juste du bruit. Reste
     conditionne a "n" : la notation ne bouge que par la resolution
     classique (Sprint et Coordonnees n'y touchent jamais), donc un delta
     sans aucun puzzle cette semaine n'a pas de sens a chercher. */
  if(n){
    const hist=prog.ratingHistory;
    const idx=hist.findIndex(h=>h.t>=since);
    if(idx!==-1){
      const baseline=idx>0?hist[idx-1].r:800;
      const delta=prog.rating-baseline;
      if(delta!==0)parts.push(t("{d} rating",{d:(delta>=0?"+":"\u2212")+Math.abs(delta)}));
    }
  }
  if(badgesThisWeek===1)parts.push(t("{n} new badge",{n:badgesThisWeek}));
  else if(badgesThisWeek>1)parts.push(t("{n} new badges",{n:badgesThisWeek}));
  el.textContent=t("This week:")+" "+parts.join(", ")+".";
  el.classList.remove("hide");
}
/* File de revision des erreurs, etendue a tous les modes (item 4, "pour
   plus tard") : reprend le meme langage visuel que le bilan de fin de
   sprint (.rushHistory/.loss, pastilles rouges scrollables), mais persiste
   au-dela d'une session et se vide au fur et a mesure des reussites
   (prog.mistakeQueue, alimentee dans registerWrong() et videe dans
   finishPuzzle(), toutes deux dans ui.js). Section entiere masquee si la
   file est vide : un "aucune erreur a revoir" en permanence pour un
   nouveau visiteur serait juste du bruit, meme logique que le recap hebdo
   masque au premier passage. */
/* Repetition espacee (item 5, "pour plus tard") : barème de type Leitner,
   valide avec l'utilisateur avant codage. 5 reussites pour maitriser un
   exercice, avec un ecart croissant entre chacune -- delays[box-1] est le
   delai APRES la reussite au palier "box" (palier 1->2 : 1 jour ; 2->3 :
   3 jours ; 3->4 : 7 jours ; 4->5 : 16 jours). La 5e reussite (palier 5)
   maitrise l'exercice et le retire directement : le 5e delai (35 jours)
   n'est donc jamais reellement applique comme une attente -- il marque le
   seuil au-dela duquel on a juge inutile de programmer un 6e passage,
   plutot qu'un vrai palier supplementaire. */
const SRS_DELAYS_DAYS=[1,3,7,16,35];
function renderMistakeQueue(){
  ensureProgFields();
  const sec=$("mistakeSection"),box=$("mistakeGrid");
  if(!sec||!box)return;
  /* Seules les entrees ECHUES (due<=maintenant) s'affichent -- celles en
     attente d'un prochain palier restent invisibles jusqu'a leur tour,
     sans aucun compteur "X en attente" qui inviterait a revenir plus tot.
     (m.due||0) : entree plus ancienne sans champ due (avant cette session)
     -> traitee comme echue immediatement, pas de migration necessaire. */
  const now=Date.now();
  const due=prog.mistakeQueue.filter(m=>(m.due||0)<=now);
  if(!due.length){sec.classList.add("hide");box.innerHTML="";return;}
  box.innerHTML="";
  due.forEach(m=>{
    const b=document.createElement("button");
    b.className="loss";
    b.textContent="✗";
    b.setAttribute("aria-label",m.code?t(m.theme)+" · #"+m.code:t(m.theme));
    b.onclick=()=>retryMistake(m.id);
    box.appendChild(b);
  });
  sec.classList.remove("hide");
}
/* Recharge l'exercice rate EN MODE TENTATIVE normal (pas loadAndRevealSolution,
   qui ne fait que rejouer et montrer la solution) -- "rejouer ce qu'on a
   rate", explicitement demande, pas juste le revoir. Une reussite ici
   passe par le chemin habituel (tryPuzzleMove -> finishPuzzle) et retire
   donc l'entree de la file normalement, sans code special. */
function retryMistake(id){
  /* Meme drapeau anti-course qu'attemptDailyArchive()/viewDailyArchive()
     (voir solveScreenSuppressAutoload plus haut) : showSolveScreen("puzzles")
     lancait sa propre chaine asynchrone (nextPuzzle(), exercice au hasard)
     qui pouvait ecraser l'erreur qu'on voulait rejouer -- deuxieme endroit
     deja en production touche par le meme defaut latent (item 1). */
  solveScreenSuppressAutoload=true;
  if(typeof setMode==="function")setMode("puzzles",{screen:"puzzles"});
  solveScreenSuppressAutoload=false;
  loadPuzzleById(id,p=>{
    if(!p)return;
    puzzle=p;puzzle.daily=false;puzzle.dailyCatchupKey=null;
    loadPuzzle();
    if(typeof focusBoard==="function")focusBoard();
  });
}

/* --- Chang Sprint : le mode chronometre. Anciennement "Puzzle Rush",
   renomme pour ne pas reprendre le nom d'une fonctionnalite existante
   ailleurs. Les identifiants internes (rush, rushBest) sont conserves :
   les renommer casserait la progression deja enregistree chez les
   visiteurs, dont la cle rushBest. Un seul point d'entree desormais,
   btnGoRush dans Defis : l'ancien bouton btnRush (Exercices) laissait le
   panneau theme/Puzzle du jour/Restart actif pendant un sprint en cours,
   sans aucun garde-fou contre un clic qui aurait charge un exercice hors
   file et desynchronise le score. --- */
let rush=null;
let lastRushHistory=[];
let lastRushSummary=null;
function rushRender(){
  if(!rush)return;
  const left=Math.max(0,rush.endsAt-Date.now());
  /* Dixiemes de seconde dans les dix dernieres : sur trois minutes, les
     afficher tout du long distrairait de l'echiquier (1800 changements),
     mais a la fin ils signalent l'urgence, comme sur les coordonnees. */
  const el=$("rushTime");
  if(left<10000){
    el.textContent=(left/1000).toFixed(1);
    el.classList.add("urgent");
  } else {
    const m=Math.floor(left/60000),s=Math.floor((left%60000)/1000);
    el.textContent=m+":"+String(s).padStart(2,"0");
    el.classList.remove("urgent");
  }
  $("rushScore").textContent=rush.score;
  $("rushStrikes").textContent="\u2717".repeat(3-rush.strikes)||"–";
  if(left<=0)rushEnd(t("Time is up."));
}
function startRush(){
  ensureProgFields();
  /* Le pool dedie n'est pas encore en cache : on le charge puis on se
     rappelle soi-meme, meme mecanique que nextPuzzle/dailyPuzzle (ui.js). */
  if(!RUSH_POOL){
    const s=$("exStatus"); if(s){s.className="status";s.textContent=t("Loading puzzles…");}
    loadRushPool(startRush);
    return;
  }
  rush={score:0,strikes:0,endsAt:Date.now()+180000,queue:[],history:[]};
  /* La file etait ordonnee par niveau : le niveau 1 etant compose a 97% de
     mats en un coup, on en enchainait 90 avant de voir autre chose. Un defi
     de trois minutes n'a pas de progression a respecter, il doit varier.
     On alterne donc les themes et on melange les niveaux, en gardant une
     difficulte moyenne croissante pour que ca monte doucement. */
  /* Seuls les exercices resolus en un coup entrent dans le sprint : le
     statut affiche "Trouve LE coup gagnant" (singulier) et le rythme du
     mode repose sur un jugement instantane par position. Les mats en 2
     (188 sur 1000) demandent de jouer un coup, attendre la reponse du
     moteur, puis en trouver un second : un joueur s'y retrouvait a jouer
     plusieurs coups alors qu'on lui avait promis d'en chercher un seul.
     Filtre etendu de "type mat a plus d'un coup" a "solution a plus d'un
     coup" tout court : gen_puzzles_v2.js introduit des gains materiels a
     2-3 coups (deviation, suite forcee), invisibles pour ce garde-fou tant
     qu'il ne regardait que le type -- 113 exercices du nouveau lot
     seraient passes au travers sans ce changement.
     Puise desormais dans RUSH_POOL (echantillon dedie, voir loadRushPool
     dans ui.js) plutot que dans la banque complete -- deja filtre a la
     construction du site, mais le garde-fou reste ici par prudence, au cas
     ou le fichier serait un jour genere autrement. */
  const parTheme={};
  for(const p of RUSH_POOL){
    if(p.sol.length>1)continue;
    (parTheme[p.theme]=parTheme[p.theme]||[]).push(p);
  }
  for(const k in parTheme)parTheme[k].sort(()=>Math.random()-0.5);
  const themes=Object.keys(parTheme).sort(()=>Math.random()-0.5);
  const file=[];
  let reste=true;
  while(reste){
    reste=false;
    for(const th of themes){
      const lot=parTheme[th];
      if(lot.length){file.push(lot.shift());reste=true;}
    }
  }
  rush.queue=file;
  $("rushBar").classList.remove("hide");
  document.body.classList.add("rush-on");
  rushNext();
  /* 100 ms : sans cela, les dixiemes sauteraient de 3 en 3. */
  rush.timer=setInterval(rushRender,100);
  rushRender();
}
function rushNext(){
  if(!rush)return;
  if(!rush.queue.length){rushEnd(t("You cleared every puzzle."));return;}
  puzzle=rush.queue.shift();puzzle.daily=false;
  loadPuzzle();
  $("exStatus").className="status";
  /* La regle est deja dite deux fois, dans la description du bloc et dans
     l'overlay de lancement : la repeter ici a chaque exercice n'apprend rien.
     Le statut sert donc a ce qu'il fait le reste du temps, indiquer quoi
     chercher. */
  $("exStatus").textContent=t("Find the winning move.");
}
function rushEnd(why){
  if(!rush)return;
  clearInterval(rush.timer);
  const score=rush.score;
  const best=score>prog.rushBest;
  if(best)prog.rushBest=score;
  /* Badge de score (2026-09-03) : verifie sur prog.rushBest, pas sur
     "score" directement -- meme si ce n'est pas un nouveau record, le
     score du jour peut suffire a depasser le seuil du badge la premiere
     fois qu'on l'atteint. */
  if(typeof checkBadges==="function")checkBadges();
  lastRushHistory=rush.history.slice();
  rush=null;
  $("rushBar").classList.add("hide");
  document.body.classList.remove("rush-on");
  /* Le bloc de l'exercice retourne dans l'onglet Exercices : sans cela il
     resterait coince dans Defis, et l'onglet Exercices serait vide. */
  if(typeof rushRestore==="function")rushRestore();
  if(typeof desarmerRush==="function")desarmerRush();
  saveProg();renderExtraStats();
  /* Bandeau de fin : le score, le record eventuel, et de quoi relancer ou
     clore sans chercher. Garde aussi de quoi le rouvrir depuis
     btnRushSummary, pour revenir au bilan complet (reussis+rates) apres
     avoir consulte une ou plusieurs erreurs. */
  const titre=best?t("New personal best"):t("Sprint over");
  const sousTitre=best?t("Score: {score}. Your best yet.",{score:score})
      :t("Score: {score}. Your best is {best}.",{score:score,best:prog.rushBest});
  lastRushSummary={titre,sousTitre};
  showFin(titre,sousTitre,t("Play again"),()=>{
    moveExPanelToRush();
    if(typeof setMode==="function")setMode("train");
    startRush();
  });
  renderRushHistory(lastRushHistory);
  const st=$("exStatus");st.className="status "+(best?"win":"");
  st.textContent=best?t("{why} Score: {score}, a new personal best.",{why:why,score:score}):t("{why} Score: {score} (best: {best}).",{why:why,score:score,best:prog.rushBest});
  puzzleDone=true;
}
/* Bilan de fin de sprint : une pastille par exercice tente, dans l'ordre,
   verte ou rouge. Cliquer dessus rejoue directement le coup gagnant et
   affiche l'explication (voir explainSentence dans ui.js) : l'objectif est
   de comprendre l'erreur, pas de retenter pour le score. */
function renderRushHistory(history){
  const box=$("rushHistory"); if(!box)return;
  const note=$("rushHistoryNote");
  box.innerHTML="";
  if(!history||!history.length){
    box.classList.add("hide");
    if(note)note.classList.add("hide");
    return;
  }
  history.forEach((h,i)=>{
    const b=document.createElement("button");
    b.className=h.correct?"win":"loss";
    b.textContent=h.correct?"✓":"✗";
    b.setAttribute("aria-label",t(h.correct?"Exercise {n}, solved":"Exercise {n}, missed",{n:i+1}));
    b.onclick=()=>reviewRushPuzzle(h.id);
    box.appendChild(b);
  });
  box.classList.remove("hide");
  if(note){note.textContent=t("Tap ✓ or ✗ to see how it was solved.");note.classList.remove("hide");}
}
/* Charge un exercice deja joue avec sa solution posee sur l'echiquier et
   l'explication affichee, sans repasser par une tentative. */
function loadAndRevealSolution(p){
  puzzle=p;puzzle.daily=false;
  loadPuzzle();
  /* loadPuzzle() vient d'effacer cette classe (chargement normal) : on la
     repose ici pour masquer l'enonce perime ("Les Blancs jouent...", faux
     puisque le coup est deja joue) et les boutons Exercice suivant/Indice,
     qui n'ont aucun sens sur un exercice deja resolu et revele. */
  document.body.classList.add("reviewing-rush");
  /* Rejoue TOUTE la sequence stockee (puzzle.sol), pas seulement le premier
     coup : necessaire depuis la Deviation (gain a plusieurs coups,
     sol.length>1) -- s'arreter au premier coup y laissait le plateau a
     mi-chemin, sans jamais montrer la prise finale qui est pourtant le
     point de l'exercice. Rejoue directement depuis puzzle.sol (pas
     currentSolutions()/puzzleSolPly, qui suivent l'etat d'une partie EN
     COURS de resolution par le joueur -- ici on affiche une reponse toute
     faite, sans lien avec cet etat). */
  const sanParts=[];
  for(const uci of puzzle.sol){
    const mv=game.moves().find(x=>game.uci(x)===uci);
    if(!mv)break;
    sanParts.push(game.san(mv));
    game.makeMove(mv);lastMove=mv;
  }
  legalCache=game.moves();
  selected=-1;marks={};
  puzzleDone=true;
  render();
  const st=$("exStatus");st.className="status win";
  st.textContent=t("The winning move was {san}.",{san:sanParts.join(" ")});
  const ex=$("exExplain");if(ex)ex.textContent=typeof explainSentence==="function"?explainSentence(puzzle):"";
  const pg=$("exPedagogy");if(pg)pg.textContent=typeof pedagogySentence==="function"?pedagogySentence(puzzle):"";
}
/* Les exercices rates d'un meme sprint, pour les enchainer sans revenir au
   bandeau a chaque fois. Cliquer une pastille reussie affiche l'exercice
   mais ne propose pas ce cycle : il n'y a rien a corriger dessus. */
let reviewMistakes=[];
let reviewIdx=-1;
function updateReviewNav(){
  const nav=$("reviewNav"); if(!nav)return;
  if(reviewIdx<0||!reviewMistakes.length){nav.classList.add("hide");return;}
  nav.classList.remove("hide");
  $("reviewPos").textContent=t("Mistake {a} of {b}",{a:reviewIdx+1,b:reviewMistakes.length});
  $("reviewPrev").disabled=reviewIdx<=0;
  $("reviewNext").disabled=reviewIdx>=reviewMistakes.length-1;
}
function reviewRushPuzzle(id){
  resultDismissed=true;
  $("resultBanner").className="result hide";
  /* rushEnd() a deja renvoye exPanel dans Exercices via rushRestore() : on
     le ramene ici, dans Defis, plutot que de changer d'onglet pour aller le
     chercher. L'utilisateur est deja sur Defis en consultant ce bilan, il
     n'a aucune raison d'en repartir pour revoir une erreur. */
  moveExPanelToRush();
  if(typeof setMode==="function")setMode("train");
  reviewMistakes=lastRushHistory.filter(h=>!h.correct).map(h=>h.id);
  const idx=reviewMistakes.indexOf(id);
  /* loadAndRevealSolution() appelle loadPuzzle(), qui remet reviewIdx a -1
     pour tout chargement normal : on ne fixe la vraie valeur qu'apres.
     Deja en cache dans l'immense majorite des cas (l'exercice vient d'etre
     joue), donc resolu sans latence visible ; loadPuzzleById ne refait une
     requete que si necessaire. */
  loadPuzzleById(id,p=>{if(p)loadAndRevealSolution(p);});
  reviewIdx=idx;
  updateReviewNav();
  if(typeof focusBoard==="function")focusBoard();
}
if($("reviewPrev"))$("reviewPrev").onclick=()=>{
  if(reviewIdx<=0)return;
  const idx=reviewIdx-1;
  loadPuzzleById(reviewMistakes[idx],p=>{if(p)loadAndRevealSolution(p);});
  reviewIdx=idx;
  updateReviewNav();
  if(typeof focusBoard==="function")focusBoard();
};
if($("reviewNext"))$("reviewNext").onclick=()=>{
  if(reviewIdx>=reviewMistakes.length-1)return;
  const idx=reviewIdx+1;
  loadPuzzleById(reviewMistakes[idx],p=>{if(p)loadAndRevealSolution(p);});
  reviewIdx=idx;
  updateReviewNav();
  if(typeof focusBoard==="function")focusBoard();
};
if($("btnRushSummary"))$("btnRushSummary").onclick=()=>{
  if(!lastRushSummary)return;
  /* focusBoard() n'est plus necessaire ici : showFin() l'appelle desormais
     elle-meme pour tous ses appelants (voir plus haut). */
  showFin(lastRushSummary.titre,lastRushSummary.sousTitre,t("Play again"),()=>{
    moveExPanelToRush();
    if(typeof setMode==="function")setMode("train");
    startRush();
  });
  renderRushHistory(lastRushHistory);
};
function onPuzzleResult(won){
  /* Pendant un sprint, rien ne doit toucher a la progression : ce n'est pas
     un entrainement mais un defi de trois minutes. Annoncer "Tu passes au
     niveau 2" au milieu casse le rythme et n'a aucun sens ici. */
  if(rush){
    if(won){rush.score++;rush.history.push({id:puzzle.id,correct:true});rushRender();setTimeout(()=>{if(rush)rushNext();},650);}
    /* true interrompt finishPuzzle : sans cela, la progression continuait de
       s'incrementer et le message "Tu passes au niveau 2" s'affichait au
       milieu du sprint. */
    return true;
  }
  /* bumpStreak() ne s'appelle plus ici depuis le 2026-09-03 : la serie de
     jours est desormais strictement liee au Puzzle du jour (voir
     finishPuzzle(), ui.js), pas a n'importe quel exercice reussi.
     Symetriquement : la notation (ELO) ne doit bouger QUE par la
     resolution classique (l'echelle de niveaux de l'ecran "Puzzles"),
     jamais par le Puzzle du jour (puzzle.daily, y compris un rattrapage
     via attemptDailyArchive -- meme drapeau) ni par Sprint/Coordonnees
     (deja exclus plus haut). Chaque categorie du menu a sa propre mesure
     de progres (niveau/ELO, serie de jours, meilleur score, record de
     coups) ; avant cette correction, resoudre UNIQUEMENT le puzzle du
     jour, jour apres jour, faisait quand meme progresser le classement
     sans jamais toucher a l'echelle de niveaux -- incoherent avec
     l'affichage "Niveau {n}" juste a cote, qui ne bougeait pas lui. */
  if(!puzzle.daily)updateRating(puzzle.level,won&&puzzleTries===0);
  saveProg();renderExtraStats();
  return false;
}
function onPuzzleWrong(){
  ensureProgFields();
  if(rush){
    rush.strikes++;rush.history.push({id:puzzle.id,correct:false});rushRender();
    if(rush.strikes>=3){rushEnd(t("Three misses."));return;}
    setTimeout(()=>{if(rush)rushNext();},750);
  }
}

/* ==========================================================
   11. WATCH
   ========================================================== */
const CHANNELS=[
  {id:"UCQHX6ViZmPsWiYSFAyS0a3Q",name:"GothamChess",handle:"@GothamChess",desc:"Game recaps, opening guides and the friendliest teaching on the platform."},
  {id:"UCweCc7bSMX5J4jEH7HFImng",name:"GMHikaru",handle:"@GMHikaru",desc:"Super-grandmaster speed chess, tournament recaps and long live streams."},
  {id:"UCL5YbN5WLFD8dLIegT5QAbA",name:"agadmator's Chess Channel",handle:"@agadmator",desc:"Calm, story-driven walkthroughs of historic and current games."},
  {id:"UChDxbOUQRXEZ1zdI14Zyx9w",name:"Chess Vibes",handle:"@ChessVibesOfficial",desc:"Practical lessons and rating-climb series built for beginner and intermediate players."},
  {id:"UCUfvZgo9uLvTEt7unKw_Xhw",name:"Blunder Man",handle:"@Blunder_Man",desc:"An advanced player working openly to cut out his own blunders, one honest game at a time."},
  {id:"UC76v5qR-TKSRalQeKskzoDg",name:"Alex Banzea",handle:"@AlexBanzea",desc:"Romanian IM breaking down openings, especially the London System and Caro-Kann, with tournament recaps."},
  {id:"UC4liTXRJ-XknH6OtKz-tOuw",name:"ChessDojo",handle:"@ChessDojo",desc:"Three coaches reviewing student games and teaching the fundamentals behind real improvement."},
  {id:"UClV9nqHHcsrm2krkFDPPr-g",name:"GingerGM",handle:"@GingerGM",desc:"GM Simon Williams brings aggressive attacking chess and lively commentary on his own games."},
  {id:"UCXy10-NEFGxQ3b4NVrzHw1Q",name:"Eric Rosen",handle:"@eric-rosen",desc:"Calm, friendly streaming highlights from an IM known for the Stafford Gambit and London System."}
];
function renderChannels(){
  const box=$("channels");if(!box)return;
  box.innerHTML="";
  for(const c of CHANNELS){
    const el=document.createElement("div");
    el.className="chan";
    /* list=UU+id : playlist "uploads" de la chaine. YouTube y place toujours
       la derniere video en premier, donc l'aperçu se met a jour tout seul,
       sans jamais coder une video precise en dur. youtube-nocookie.com pour
       limiter le pistage tant que la video n'est pas lancee. */
    el.innerHTML='<div class="chanEmbed"><iframe src="https://www.youtube-nocookie.com/embed/videoseries?list=UU'+c.id.slice(2)+'" title="'+c.name+'" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>'+
      '<h3>'+c.name+'</h3><p>'+t(c.desc)+'</p>';
    const row=document.createElement("div");row.className="btnrow";
    const open=document.createElement("button");
    open.className="btn primary";open.textContent=t("See the channel");
    open.onclick=()=>window.open("https://www.youtube.com/"+c.handle,"_blank","noopener");
    row.appendChild(open);
    el.appendChild(row);
    box.appendChild(el);
  }
}

/* ==========================================================
   12. LEGAL
   ========================================================== */
const PUBLISHER={name:"AlexZ1212",email:"contact@chang64.com"};
const HOST={name:"Cloudflare, Inc.",address:"101 Townsend Street, San Francisco, CA 94107, United States",site:"cloudflare.com"};
const REGISTRAR={name:"OVH SAS",address:"2 rue Kellermann, 59100 Roubaix, France"};
function renderLegal(){
  const fr=LANG==="fr";
  $("legalBody").innerHTML= fr
    ? "<h4>Éditeur</h4><p><strong>"+PUBLISHER.name+"</strong><br>Directeur de la publication : "+PUBLISHER.name+
      "<br>Contact : "+PUBLISHER.email+"</p>"+
      "<p>chang64 est édité par un particulier, à titre non professionnel. Conformément à l'article 1-1, II de la loi pour la confiance dans l'économie numérique, "+
      "l'éditeur a choisi de ne pas rendre publics son nom et son adresse. Ces informations sont détenues par l'hébergeur, qui les communiquera à l'autorité judiciaire sur requête.</p>"+
      "<h4>Hébergement</h4><p><strong>"+HOST.name+"</strong><br>"+HOST.address+"<br>"+HOST.site+"</p>"+
      "<h4>Nom de domaine</h4><p>Enregistré auprès de <strong>"+REGISTRAR.name+"</strong>, "+REGISTRAR.address+".</p>"+
      "<h4>Licence du code</h4><p>Le code source de chang64 est publié sous licence "+
      "<a href=\"https://www.gnu.org/licenses/gpl-3.0.html\" rel=\"license noopener\" target=\"_blank\">GNU General Public License version 3</a> "+
      "ou ultérieure. Il peut être étudié, modifié et redistribué dans les conditions de cette licence, depuis "+
      "<a href=\"https://github.com/AlexZ1212/chang64\" rel=\"noopener\" target=\"_blank\">le dépôt public du projet</a>. "+
      "Le texte de la licence est également servi à l'adresse <a href=\"/LICENSE\">/LICENSE</a>.</p>"+
      "<h4>Propriété intellectuelle</h4><p>La licence ci-dessus couvre le programme. Elle ne couvre pas le contenu éditorial : "+
      "les textes des pages d'ouvertures, de règles, de finales et de pièges, la collection d'exercices en tant qu'ensemble constitué, "+
      "ainsi que l'identité visuelle du site. Ces éléments restent protégés par le droit d'auteur et leur reproduction nécessite une autorisation. "+
      "Le détail figure dans le fichier <a href=\"/COPYING.CONTENT\">COPYING.CONTENT</a>.</p>"+
      "<p>Les noms d'ouvertures proviennent du projet lichess-org/chess-openings, publié sous licence libre.</p>"+
      "<h4>Stockfish</h4><p>L'analyse renforcée utilise <a href=\"https://stockfishchess.org\" rel=\"noopener\" target=\"_blank\">Stockfish</a>, "+
      "moteur d'échecs libre développé par les contributeurs du projet Stockfish et distribué sous licence GNU GPL v3. "+
      "Son code source est disponible sur <a href=\"https://github.com/official-stockfish/Stockfish\" rel=\"noopener\" target=\"_blank\">github.com/official-stockfish/Stockfish</a>, "+
      "et le texte de sa licence accompagne le moteur. C'est parce que chang64 distribue Stockfish que son propre code est publié sous la même licence. "+
      "Stockfish est optionnel : il n'est chargé qu'au moment où tu analyses une partie terminée, jamais pendant que tu joues.</p>"+
      "<h4>Contenus tiers</h4><p>La section Vidéos intègre des lecteurs YouTube. Ces vidéos appartiennent à leurs chaînes respectives ; "+
      "chang64 n'a aucun lien avec elles et rien ne se charge avant que tu appuies sur lecture.</p>"+
      "<h4>Signalement</h4><p>Toute demande relative au contenu du site peut être adressée à "+PUBLISHER.email+".</p>"
    : "<h4>Publisher</h4><p><strong>"+PUBLISHER.name+"</strong><br>Publication director: "+PUBLISHER.name+
      "<br>Contact: "+PUBLISHER.email+"</p>"+
      "<p>chang64 is published by a private individual, on a non-professional basis. Under article 1-1, II of the French Digital Economy Act, "+
      "the publisher has chosen not to make their name and address public. That information is held by the host and will be disclosed to the judicial authority on request.</p>"+
      "<h4>Hosting</h4><p><strong>"+HOST.name+"</strong><br>"+HOST.address+"<br>"+HOST.site+"</p>"+
      "<h4>Domain name</h4><p>Registered through <strong>"+REGISTRAR.name+"</strong>, "+REGISTRAR.address+".</p>"+
      "<h4>Code licence</h4><p>The source code of chang64 is released under the "+
      "<a href=\"https://www.gnu.org/licenses/gpl-3.0.html\" rel=\"license noopener\" target=\"_blank\">GNU General Public License version 3</a> "+
      "or later. You are free to study, modify and redistribute it under the terms of that licence, from "+
      "<a href=\"https://github.com/AlexZ1212/chang64\" rel=\"noopener\" target=\"_blank\">the project's public repository</a>. "+
      "The licence text is also served at <a href=\"/LICENSE\">/LICENSE</a>.</p>"+
      "<h4>Intellectual property</h4><p>The licence above covers the program. It does not cover the editorial content: "+
      "the written pages on openings, rules, endgames and traps, the puzzle collection as a curated set, "+
      "and the site's visual identity. Those remain protected by copyright and may not be reproduced without permission. "+
      "The exact scope is set out in <a href=\"/COPYING.CONTENT\">COPYING.CONTENT</a>.</p>"+
      "<p>Opening names come from the lichess-org/chess-openings project, published under a free licence.</p>"+
      "<h4>Stockfish</h4><p>Deeper analysis is powered by <a href=\"https://stockfishchess.org\" rel=\"noopener\" target=\"_blank\">Stockfish</a>, "+
      "a free and open source chess engine developed by the Stockfish contributors and distributed under the GNU GPL v3. "+
      "Its source code is available at <a href=\"https://github.com/official-stockfish/Stockfish\" rel=\"noopener\" target=\"_blank\">github.com/official-stockfish/Stockfish</a>, "+
      "and its licence text ships alongside the engine. It is because chang64 distributes Stockfish that its own code is released under the same licence. "+
      "Stockfish is optional: it is only loaded when you analyse a finished game, never while you play.</p>"+
      "<h4>Third-party content</h4><p>The Watch section embeds YouTube players. Those videos belong to their respective channels; "+
      "chang64 has no affiliation with them and nothing is loaded until you press play.</p>"+
      "<h4>Reporting</h4><p>Any request concerning the content of this site can be sent to "+PUBLISHER.email+".</p>";
  $("privacyBody").innerHTML= fr
    ? "<h4>En bref</h4><p>chang64 n'a ni compte, ni inscription, ni publicité. Le site ne demande jamais ton nom, "+
      "ton adresse électronique ni aucune autre donnée personnelle.</p>"+
      "<h4>Ce qui est enregistré, et où</h4><p>Ta progression, ton classement, ta série de jours et ta partie entre amis en cours sont "+
      "enregistrés <strong>dans ton propre navigateur</strong>. Rien n'est envoyé ailleurs. Effacer les données du navigateur les supprime, "+
      "d'où l'existence du code de reprise.</p>"+
      "<h4>Cookies</h4><p>chang64 ne dépose aucun cookie et n'utilise aucun traqueur : il n'y a donc pas de bandeau de consentement.</p>"+
      "<h4>Journaux techniques</h4><p>L'hébergeur conserve des journaux de connexion, dont les adresses IP, à des fins de sécurité et de "+
      "lutte contre les attaques. Ces journaux relèvent de sa propre politique de confidentialité et chang64 n'y a pas accès.</p>"+
      "<h4>Parties par lien</h4><p>Une partie entre amis tient entièrement dans le lien que tu partages. Les coups transitent par la "+
      "messagerie de ton choix ; aucune copie n'est conservée sur ce site.</p>"+
      "<h4>YouTube</h4><p>La section Vidéos ne charge rien tant que tu n'appuies pas sur lecture. Ensuite, c'est YouTube (Google) qui "+
      "sert le lecteur et applique sa propre politique de confidentialité. Les lecteurs sont demandés via youtube-nocookie.com.</p>"+
      "<h4>Tes droits</h4><p>Aucune donnée personnelle n'étant collectée par le site, il n'y a rien à consulter, corriger ou supprimer. "+
      "Toute question peut être adressée à "+PUBLISHER.email+".</p>"+
      "<h4>Évolutions</h4><p>Si des comptes ou une mesure d'audience étaient ajoutés un jour, cette page serait mise à jour avant leur mise en service.</p>"
    : "<h4>The short version</h4><p>chang64 has no accounts, no sign-up and no advertising. It never asks for your name, "+
      "your email address or any other personal detail.</p>"+
      "<h4>What is stored, and where</h4><p>Your puzzle progress, your rating, your day streak and your current friend game are saved "+
      "<strong>in your own browser</strong>. They are never sent anywhere. Clearing your browser data erases them, which is why the "+
      "transfer code exists.</p>"+
      "<h4>Cookies</h4><p>chang64 sets no cookies and uses no tracker, so there is no consent banner to click through.</p>"+
      "<h4>Server logs</h4><p>The host keeps connection logs, including IP addresses, for security and abuse prevention. Those logs fall "+
      "under its own privacy policy and chang64 has no access to them.</p>"+
      "<h4>Games played by link</h4><p>A friend game lives entirely inside the link you share. The moves travel through whichever "+
      "messaging app you choose; no copy is kept on this site.</p>"+
      "<h4>YouTube</h4><p>The Watch section loads nothing until you press play. Once you do, YouTube (Google) serves the player and "+
      "applies its own privacy policy. Players are requested through youtube-nocookie.com.</p>"+
      "<h4>Your rights</h4><p>Since no personal data is collected by the site, there is nothing for us to access, correct or delete. Any "+
      "question can go to "+PUBLISHER.email+".</p>"+
      "<h4>Changes</h4><p>Should accounts or audience measurement ever be added, this page will be updated before they go live.</p>";
}

let isReviewGame=false;
function gameFinished(){
  if(mode!=="play")return false;
  if(typeof gameStarted!=="undefined"&&!gameStarted)return false;
  if(typeof resigned!=="undefined"&&resigned!==null)return true;
  if(isFlagged())return true;
  if(!legalCache.length)return true;
  return game.isDraw();
}
function applyEvalPref(){
  const unlocked=mode==="play"&&(isReviewGame||gameFinished());
  const el=$("evalwrap");
  if(el)el.classList.toggle("hide",!(unlocked||(mode==="play"&&!!analysis)));
  const ba=$("btnAnalyse");
  if(ba)ba.disabled=!unlocked&&!analysis;
  const bh=$("btnHint");
  if(bh&&mode==="play")bh.disabled=!unlocked;
  const note=$("reviewLock");
  if(note)note.textContent=unlocked||analysis
    ? t("Review your game move by move. The engine flags what went wrong.")+(prog.usedHint?"":" "+t("Tip: “Suggest a move” shows what the engine would play in the position you are looking at."))
    : t("Review, move suggestions and the evaluation bar unlock once the game is over. No engine help while you play.");
}

/* ==========================================================
   13. NAVIGATION EXTENSIONS
   ========================================================== */
const baseSetMode=setMode;
setMode=function(m,opts){
  /* Le sprint ne peut plus demarrer que depuis Defis (btnGoRush) : comparer
     a l'onglet courant, plutot qu'a un nom d'onglet fige ("train"), reste
     la version la plus sure si un futur point d'entree ou un renommage
     d'onglet est ajoute, et n'arrete le sprint que lors d'un vrai
     changement d'onglet. */
  if(rush&&m!==mode)rushEnd(t("Stopped."));
  if(m==="watch"||m==="legal"||m==="prefs"||m==="explore"||m==="calendar"){
    if(mode==="play"&&game){mainGame=game;mainSan=sanList;mainLast=lastMove;mainStarted=gameStarted;mainFlipped=flipped;}
    mode=m;
    const tabs={play:"tab-play",puzzles:"tab-puzzles",train:"tab-train",edit:"tab-edit",friend:"tab-friend",watch:"tab-watch",explore:"tab-explore"};
    for(const k in tabs){const el=$(tabs[k]);if(el)el.setAttribute("aria-selected",k===m);}
    $("pane-home").classList.add("hide");
    $("appLayout").classList.add("hide");
    $("pane-watch").classList.toggle("hide",m!=="watch");
    $("pane-legal").classList.toggle("hide",m!=="legal");
    const pp=$("pane-prefs"); if(pp)pp.classList.toggle("hide",m!=="prefs");
    const pe=$("pane-explore"); if(pe)pe.classList.toggle("hide",m!=="explore");
    const pc=$("pane-calendar"); if(pc)pc.classList.toggle("hide",m!=="calendar");
    if(m==="watch")renderChannels();
    else if(m==="prefs"){if(typeof renderPrefs==="function")renderPrefs();}
    else if(m==="explore"){if(typeof renderExplore==="function")renderExplore();}
    else if(m==="calendar"){calFullOffset=0;if(typeof renderFullCalendar==="function")renderFullCalendar();}
    else renderLegal();
    return;
  }
  $("pane-watch").classList.add("hide");
  $("pane-legal").classList.add("hide");
  { const pp=$("pane-prefs"); if(pp)pp.classList.add("hide"); }
  { const pe=$("pane-explore"); if(pe)pe.classList.add("hide"); }
  { const pc=$("pane-calendar"); if(pc)pc.classList.add("hide"); }
  { const tex=$("tab-explore"); if(tex)tex.setAttribute("aria-selected","false"); }
  $("tab-watch").setAttribute("aria-selected","false");
  baseSetMode(m,opts);
  renderExtraStats();applyEvalPref();
  if(m==="play"){renderOpening();renderSheetPlay();}
};
/* Chang Sprint se joue sur l'echiquier des exercices : on y bascule puis on
   lance le mode, plutot que de dupliquer la logique dans l'onglet Defis. */
/* Le sprint se joue desormais sans quitter Defis : on y deplace le bloc de
   l'exercice, l'echiquier etant deja partage entre les onglets. */
/* Pendant un sprint, le bouton devient un abandon, avec les memes codes que
   "Abandonner la partie" : couleur d'alerte et confirmation en deux temps,
   pour ne pas perdre trois minutes sur un clic malheureux. */
let rushArmTimer=null;
function desarmerRush(){
  const b=$("btnGoRush"); if(!b)return;
  const enCours=!!(typeof rush!=="undefined"&&rush);
  b.classList.remove("armed");
  b.textContent=enCours?t("Give up the Sprint"):t("Start Chang Sprint");
  b.classList.toggle("danger",enCours);
  b.classList.toggle("primary",!enCours);
  /* Item 5 : visible seulement pendant un sprint actif (ou son role
     redevient "abandonner"). Hors sprint, la carte du menu emmene deja
     directement vers l'ecran "Ready" (beginRushFlow) -- ce bouton en
     double, sous le panneau, n'a plus rien a faire tant que rien n'est
     lance. "Record personnel" (rushBestTrain, hors-sprint) n'est pas
     concerne, il reste toujours affiche. */
  b.classList.toggle("hide",!enCours);
  if(rushArmTimer){clearTimeout(rushArmTimer);rushArmTimer=null;}
}
/* Extrait le 2026-09-03 : ce bloc etait uniquement dans le clic de
   btnGoRush (bouton "Start Chang Sprint" du panneau Defis). Avec le menu a
   5 cartes, cliquer sur la carte "Chang Sprint" passait D'ABORD par ce
   panneau et son propre bouton "Start", avant l'ecran "Ready when you
   are" -- redondant, la carte du menu exprime deja l'intention de
   demarrer un sprint. La carte appelle maintenant cette fonction
   directement, sautant le clic intermediaire ; btnGoRush.onclick continue
   de l'appeler aussi (il reste necessaire une fois un sprint en cours,
   pour abandonner -- voir plus bas, ce n'est pas un bouton mort). */
function beginRushFlow(){
  if(typeof coord!=="undefined"&&coord&&typeof stopCoord==="function")stopCoord();
  /* Si Defis est visite avant Exercices, aucun exercice n'a jamais ete
     charge : exPanel affichait alors ses valeurs brutes du HTML ("Back-rank
     mate", "Loading…", code vide) sous l'ecran "Ready", au lieu d'un vrai
     exercice. */
  if(!puzzle&&typeof nextPuzzle==="function")nextPuzzle();
  moveExPanelToRush();
  /* Sans ceci, la vue reduite du sprint ne s'activait qu'au clic sur
     "Start" dans l'ecran "Ready when you are" : en attendant, l'ecran
     "Ready" (qui ne recouvre que l'echiquier) laissait voir l'enonce
     complet, les boutons Exercice suivant/Indice et le niveau/statistiques
     d'Exercices juste en dessous. */
  document.body.classList.add("rush-on");
  /* goTop() ramenait le tout haut de la page, sans tenir compte de l'en-tete
     ancree ni de la position reelle de l'echiquier : selon d'ou partait le
     clic, l'ecran "Ready" pouvait rester hors champ. focusBoard() vise
     l'echiquier lui-meme et tient compte de scroll-padding-top. */
  if(typeof focusBoard==="function")focusBoard();
  /* Trois minutes chronometrees et une erreur suffit a tout arreter : on
     annonce la regle et on attend le feu vert, comme pour une partie.
     Titre "Chang Sprint" plutot que le "Ready when you are" generique
     (2026-09-03) : la carte du menu a deja dit "clic = je veux demarrer",
     inutile de re-demander confirmation d'un ton neutre -- autant nommer
     directement ce qui va commencer. */
  showReadyFor(t("Three minutes · three misses and it stops"),
    ()=>{
      if(typeof startRush==="function")startRush();
      if(typeof desarmerRush==="function")desarmerRush();   /* passe en abandon */
    },
    t("Start"),t("Chang Sprint"));
}
if($("btnGoRush"))$("btnGoRush").onclick=()=>{
  /* sprint en cours : le bouton abandonne, apres confirmation */
  if(typeof rush!=="undefined"&&rush){
    const b=$("btnGoRush");
    if(!b.classList.contains("armed")){
      b.classList.add("armed");
      b.textContent=t("Confirm give up");
      rushArmTimer=setTimeout(desarmerRush,5000);
      return;
    }
    desarmerRush();
    rushEnd(t("Given up."));
    return;
  }
  /* Le bouton descend sous l'echiquier pendant le sprint : place au-dessus,
     il sortait de l'ecran des qu'on regardait le plateau, et on ne trouvait
     plus comment abandonner. */
  beginRushFlow();
};
/* Remise en place a la fin du sprint. */
/* Deplace exPanel dans #rushSlot (Defis) en s'assurant qu'il est visible.
   Ajoute le 2026-09-03 avec le menu a 5 cartes : exPanel porte desormais
   une classe "hide" par defaut (seul showSolveScreen() la retire, pour
   les ecrans Puzzles/Puzzle du jour) -- sans ce retrait explicite ici,
   arriver sur un Sprint depuis le menu (exPanel encore cache a ce moment)
   laissait l'enonce et le statut invisibles pendant tout le sprint. Les 4
   endroits qui deplacaient exPanel vers rushSlot utilisent desormais
   cette fonction plutot que de repeter la logique. */
function moveExPanelToRush(){
  const p=$("exPanel"),slot=$("rushSlot");
  if(p&&slot&&!slot.contains(p))slot.appendChild(p);
  if(p)p.classList.remove("hide");
}
function rushRestore(){
  const p=$("exPanel"), pane=$("pane-puzzles");
  if(!p||!pane||pane.contains(p))return;
  pane.insertBefore(p,pane.firstElementChild);
  /* De retour dans Exercices : exPanel ne doit rester visible que si
     l'ecran courant en a besoin (Puzzles ou Puzzle du jour), pas sur le
     menu -- sinon la carte d'exercice resterait affichee au-dessus du
     menu apres un sprint lance depuis Defis. */
  if(typeof solveScreen!=="undefined")
    p.classList.toggle("hide",solveScreen!=="puzzles"&&solveScreen!=="daily");
}
/* Le code de reprise n'etait genere qu'au clic sur "Copier" : dans un bloc
   replie, on ouvre pour le lire, pas pour le copier a l'aveugle. On le
   remplit donc a l'ouverture. */
(function(){
  const blocs=document.querySelectorAll("details.repliable");
  for(const b of blocs){
    if(!b.querySelector("#codeOut"))continue;
    b.addEventListener("toggle",()=>{
      if(b.open&&typeof showCode==="function"&&!$("codeOut").value)showCode();
    });
  }
})();
$("tab-watch").onclick=()=>{setMode("watch");goTop();};
if($("tab-explore"))$("tab-explore").onclick=()=>{setMode("explore");goTop();};
if($("calFullLink"))$("calFullLink").onclick=(e)=>{e.preventDefault();setMode("calendar");goTop();};
/* "Retour a ta progression" (item 2) : le seul point d'entree vers le
   calendrier complet est "Voir le calendrier complet" (calFullLink),
   dans l'ecran "Puzzle du jour" (voir juste au-dessus) -- le retour doit y
   ramener, pas a l'accueil general dont ce lien n'est jamais parti. */
if($("calBackLink"))$("calBackLink").onclick=(e)=>{e.preventDefault();setMode("puzzles",{screen:"daily"});goTop();};
/* Les deux liens ouvrent le meme panneau : sans cible, "Confidentialite"
   amenait sur les mentions legales. On amene chacun a sa propre section. */
/* Les pages de contenu renvoient vers /#legal et /#privacy : ces panneaux
   sont ouverts par bouton, pas par URL, donc sans ce relais les liens du pied
   de page des pages claires ne meneraient nulle part. */
(function(){
  const versFragment=()=>{
    const f=(location.hash||"").replace("#","");
    if(f==="legal"){setMode("legal");goToSection("legalTitle");}
    else if(f==="privacy"){setMode("legal");goToSection("privacyTitle");}
    else if(f==="prefs"){setMode("prefs");}
    else if(f==="accessibilite"){setMode("prefs");goToSection("accessibilite");}
  };
  window.addEventListener("hashchange",versFragment);
  setTimeout(versFragment,60);
})();
$("footLegal").onclick=()=>{setMode("legal");goToSection("legalTitle");};
$("footPrivacy").onclick=()=>{setMode("legal");goToSection("privacyTitle");};
$("footHome").onclick=()=>{setMode("home");goTop();};   /* meme mecanique que les onglets */

/* keep the UCI move list in step with the played game */
const basePlayUser=playUser,baseBotMove=botMove,baseUndoGame=undoGame;
playUser=function(m){recordUci(m);analysis=null;basePlayUser(m);};
botMove=function(){
  const before=game.history.length;
  baseBotMove();
  if(game.history.length>before){
    const h=game.history[game.history.length-1];
    recordUci(h.m);analysis=null;
    /* baseBotMove() a deja appele refreshGame() (donc mon crochet de
       sauvegarde de la partie en cours, voir plus bas) AVANT que gameUci
       soit mis a jour ici : sans ce second appel explicite, le coup du bot
       n'atteignait jamais la sauvegarde -- seuls les coups du joueur
       (recordUci avant basePlayUser, lui, l'ordre inverse) etaient captures.
       Meme logique de garde qu'a l'interieur de refreshGame() : un mat livre
       par le bot doit effacer la sauvegarde, pas la reecrire perimee. */
    if(gameStarted&&typeof gameOver==="function"&&!gameOver()){if(typeof savePlay==="function")savePlay();}
    else if(gameStarted&&typeof clearPlaySave==="function")clearPlaySave();
  }
};
undoGame=function(){
  const before=game.history.length;
  baseUndoGame();
  if(game.history.length<before){
    gameUci.splice(-2);analysis=null;
    if(gameStarted&&typeof gameOver==="function"&&!gameOver()){if(typeof savePlay==="function")savePlay();}
    else if(gameStarted&&typeof clearPlaySave==="function")clearPlaySave();
  }
};
$("btnHint").onclick=()=>hintGame();

ensureProgFields();
renderExtraStats();
applyEvalPref();

/* ==========================================================
   OVERLAY DE PREPARATION
   ==========================================================
   Sur une partie chronometree, la pendule partait en meme temps que la
   partie. Quelqu'un qui arrivait depuis l'accueil par "Jouer maintenant"
   decouvrait l'echiquier alors que son temps s'ecoulait deja, ce qui coute
   cher en bullet. L'overlay montre d'abord la cadence, la force et la
   couleur, et rien ne demarre avant qu'il le decide.

   Il n'apparait que sur les cadences chronometrees : sans pendule ou en
   correspondance, il n'y a rien a proteger et ce serait un clic de trop.
   ========================================================== */
/* Le francais ecrit 2,8 et non 2.8. Sans cela, le verdict d'analyse melange
   deux conventions dans la meme phrase. */
function fmtNum(x){
  const s=Number(x).toFixed(1);
  return (typeof LANG!=="undefined"&&LANG==="fr")?s.replace(".",","):s;
}
/* Overlay generique : sert aux parties chronometrees, a Chang Sprint et aux
   coordonnees. Les trois partagent le meme besoin, rien ne doit demarrer
   avant que le joueur soit pret, donc autant reutiliser le meme motif plutot
   que d'en inventer un second.
   sousTitre : ce qui est annonce, action : ce que fait le bouton principal,
   libelle : son texte. Sans action, on retombe sur le comportement d'origine,
   celui des parties. */
let readyAction=null;
/* readySecondaryAction : meme principe que readyAction, mais pour le bouton
   "readySettings". Sert au choix de reprise d'une partie sauvegardee (voir
   showResumeChoice plus bas) : ce bouton propose alors "Nouvelle partie"
   plutot que son role habituel de reglages. */
let readySecondaryAction=null;
function showReadyFor(sousTitre,action,libelle,titre,secondaryLibelle,secondaryAction,sideChoice){
  const b=$("readyBanner"); if(!b)return;
  /* On enchaine sur une nouvelle epreuve : le bandeau de fin de la
     precedente n'a plus lieu d'etre, et deux panneaux superposes seraient
     illisibles. */
  const fin=$("resultBanner");
  if(fin&&!fin.classList.contains("hide")){fin.className="result hide";finAction=null;}
  readyAction=action||null;
  readySecondaryAction=secondaryAction||null;
  /* La bulle "sauvegarde automatique" n'a de sens que pour le choix de
     reprise (showResumeChoice, qui la reactive juste apres cet appel) :
     partout ailleurs (Chang Sprint, coordonnees...), elle doit rester
     masquee par defaut. */
  const tb=$("tipResumeBtn");
  if(tb){tb.classList.add("hide");tb.setAttribute("aria-expanded","false");}
  const tp=$("tipResume"); if(tp)tp.classList.add("hide");
  $("readyTitle").textContent=titre||t("Ready when you are");
  $("readySub").textContent=sousTitre;
  $("readyStart").textContent=libelle||t("Start");
  /* "Changer les reglages" n'a pas de sens ici : les epreuves n'en ont pas.
     Exception : un secondaryAction explicite (choix de reprise), qui
     reutilise ce bouton pour une action alternative dediee. */
  const st=$("readySettings");
  if(st){
    if(secondaryAction){st.classList.remove("hide");st.textContent=secondaryLibelle||t("Change settings");}
    else st.classList.toggle("hide",!!action);
  }
  /* Choix de couleur (Coordonnees uniquement) : reprend l'etat deja choisi
     dans coordSide (panneau Defis) plutot que de repartir a "Blancs" a
     chaque overlay -- change de camp puis relancer par la carte du menu
     ne devait pas oublier le choix precedent. Les deux controles restent
     synchronises (voir le gestionnaire de clic plus bas) : startCoord()
     (ui3.js) continue de lire coordSide sans modification. */
  const rs=$("readySide");
  if(rs){
    rs.classList.toggle("hide",!sideChoice);
    if(sideChoice){
      const cs=$("coordSide");
      const black=cs&&cs.children[1].getAttribute("aria-pressed")==="true";
      for(const x of rs.children)x.setAttribute("aria-pressed",String((x.dataset.v==="b")===!!black));
    }
  }
  b.classList.remove("hide");
  /* preventScroll : sans lui, focus() recadre lui-meme la vue sur le
     bouton, en concurrence avec le defilement deja pose par focusBoard()
     juste avant (voir btnGoRush). Le second finit par gagner au hasard,
     laissant parfois l'echiquier hors champ malgre focusBoard(). */
  try{$("readyStart").focus({preventScroll:true});}catch(e){try{$("readyStart").focus();}catch(e2){}}
}
function showReady(tcTxt){
  readyAction=null;
  readySecondaryAction=null;
  const tb=$("tipResumeBtn");
  if(tb){tb.classList.add("hide");tb.setAttribute("aria-expanded","false");}
  const tp=$("tipResume"); if(tp)tp.classList.add("hide");
  const st=$("readySettings"); if(st)st.classList.remove("hide");
  const b=$("readyBanner"); if(!b)return;
  /* Le libelle de force est lu directement sur le selecteur : il est deja
     traduit par applyI18n, inutile de maintenir une seconde liste qui
     divergerait. */
  let force="";
  const seg=$("segLevel");
  if(seg){const b=seg.querySelector('[data-v="'+botLevel+'"]');if(b)force=b.textContent.trim();}
  $("readyTitle").textContent=t("Ready when you are");
  $("readySub").textContent=
    tcTxt+(force?" \u00b7 "+force:"")+" \u00b7 "+
    (myColor===W?t("You play White."):t("You play Black."));
  $("readyStart").textContent=t("Start the game");
  $("readySettings").textContent=t("Change settings");
  b.classList.remove("hide");
  /* Cite desormais le vrai libelle du bouton juste au-dessus (texte) :
     "Commencer" seul ne correspondait a aucun bouton reel de cet ecran,
     qui affiche "Commencer la partie" (readyStart.textContent, ligne
     precedente) -- ce statut n'est utilise que pour Jouer (voir grep, un
     seul site d'appel), donc pas de risque de desynchronisation avec un
     autre libelle de bouton partage ailleurs (Sprint dit juste "Start"). */
  const s=$("status"); if(s)s.textContent=t("Press \u201cStart the game\u201d when you are ready.");
  try{$("readyStart").focus({preventScroll:true});}catch(e){try{$("readyStart").focus();}catch(e2){}}
}
function hideReady(){
  const b=$("readyBanner"); if(b)b.classList.add("hide");
}
function startReadyGame(){
  hideReady();
  awaitingStart=false;
  /* La pendule a ete armee au moment du newGame : sans cette remise a
     l'heure, tout le temps passe sur l'overlay serait decompte d'un coup. */
  if(clock&&clock.enabled)clock.last=Date.now();
  const s=$("status");
  if(s)s.textContent=myColor===B?t("The computer is thinking…"):(readyStatus||t("Your move."));
  if(myColor===B){busy=true;setTimeout(botMove,220);}
  /* refreshGame est ce qui verrouille les reglages pendant une partie. Sans
     cet appel, une partie lancee depuis l'overlay laissait couleur, force et
     cadence modifiables, alors qu'une partie relancee apres un abandon les
     verrouillait correctement : newGame, lui, passe par refreshGame. */
  refreshGame();
  if(typeof focusBoard==="function")focusBoard();
}
if($("readyStart"))$("readyStart").onclick=()=>{
  if(readyAction){const f=readyAction;readyAction=null;readySecondaryAction=null;hideReady();f();return;}
  startReadyGame();
};
if($("readySettings"))$("readySettings").onclick=()=>{
  if(readySecondaryAction){const f=readySecondaryAction;readyAction=null;readySecondaryAction=null;hideReady();f();return;}
  /* La partie n'a pas commence : on l'annule pour de bon, sinon le
     verrouillage en cours de partie garde les reglages desactives et le
     bouton menait a des reglages intouchables. */
  hideReady();
  awaitingStart=false;
  gameStarted=false;
  if(typeof setupGame==="function")setupGame();
  refreshGame();
  const p=$("gameSettings")||$("segLevel");
  if(p){try{p.scrollIntoView({behavior:"smooth",block:"center"});}catch(e){p.scrollIntoView();}}
  const s=$("status");
  if(s)s.textContent=t("Pick a colour and a strength, then play.");
};

/* ==========================================================
   20. SAUVEGARDE DE LA PARTIE EN COURS (mode Jouer, contre le bot)
   ==========================================================
   Contrairement a "Entre amis" (deja persistant via chang64:friend) et a
   l'historique des parties terminees (chang64:games), une partie "Jouer"
   en cours ne survivait jusqu'ici a aucun rechargement : fermer l'onglet
   ou recharger la perdait purement et simplement.

   Choix retenus (discussion du 24/08/2026) :
   - la pendule continue de s'ecouler pendant l'absence, comme une horloge
     reelle : on sauvegarde clock.last tel quel (l'horodatage n'est PAS
     remis a l'heure au moment de la sauvegarde), et clockDrain() -- deja
     appele par la boucle setInterval existante -- decompte naturellement
     tout le temps ecoule des le retour, drapeau compris si le depassement
     est deja consomme.
   - au retour sur l'onglet Jouer, pas de reprise automatique et
     silencieuse : un choix explicite est propose ("Reprendre" / "Nouvelle
     partie"), pour ne pas surprendre quelqu'un qui voulait repartir a
     zero et avait oublie sa partie en cours.
   - perimetre : uniquement le mode Jouer contre le bot. */
let pendingPlaySave=null;
async function savePlay(){
  try{
    await window.storage.set("chang64:play",JSON.stringify({
      v:1,
      uci:gameUci,
      startFen:gameStartFen,
      myColor:myColor===B?1:0,
      botLevel:botLevel,
      flipped:!!flipped,
      tcCat:tcCat,tcIdx:tcIdx,
      clock:clock
    }));
  }catch(e){}
}
async function clearPlaySave(){
  pendingPlaySave=null;
  try{await window.storage.delete("chang64:play");}catch(e){}
}
async function loadPlaySave(){
  try{
    const r=await window.storage.get("chang64:play");
    if(r&&r.value){
      const d=JSON.parse(r.value);
      if(d&&d.v===1&&Array.isArray(d.uci)&&d.uci.length)pendingPlaySave=d;
    }
  }catch(e){}
}
/* Rejoue la liste de coups UCI sauvegardee sur une position vierge : meme
   principe defensif que loadPgn(), on s'arrete au premier coup qui ne
   validerait plus (donnees corrompues, ou regle du moteur qui aurait
   change entre-temps) plutot que de planter. */
function resumeSavedPlay(){
  const d=pendingPlaySave; pendingPlaySave=null;
  if(!d){setupGame();return;}
  const startFen=typeof d.startFen==="string"?d.startFen:null;
  const g=startFen?new Game(startFen):new Game(),san=[];
  for(const u of d.uci){
    const mv=g.moves().find(x=>g.uci(x)===u);
    if(!mv)break;
    san.push(g.san(mv));g.makeMove(mv);
  }
  if(!san.length){clearPlaySave();setupGame();return;}
  /* clearAnalysis() remet gameUci a [] (elle sert normalement a repartir
     d'une partie vierge) : elle doit donc s'executer AVANT de restaurer
     gameUci ci-dessous, jamais apres. */
  if(typeof clearAnalysis==="function")clearAnalysis();
  game=g;sanList=san;gameUci=d.uci.slice(0,san.length);
  gameStartFen=startFen;
  myColor=d.myColor===1?B:W;
  if(TC_CATS.some(c=>c.id===d.tcCat)){tcCat=d.tcCat;tcIdx=d.tcIdx||0;}
  if(typeof d.botLevel==="number")botLevel=d.botLevel;
  flipped=!!d.flipped;
  gameStarted=true;
  if(typeof isReviewGame!=="undefined")isReviewGame=false;
  resultInfo=null;resultDismissed=false;resigned=null;disarmResign();
  reviewGame=null;reviewLast=null;selected=-1;marks={};busy=false;
  lastMove=g.history.length?g.history[g.history.length-1].m:null;
  /* La pendule reprend telle quelle : "last" reste l'ancien horodatage,
     donc le prochain passage de clockDrain() (boucle setInterval deja en
     place, toutes les 100ms) decompte tout seul le temps ecoule pendant
     l'absence, drapeau compris s'il est deja depasse -- cette meme boucle
     gere alors la fin de partie normalement, sans rien de plus a faire ici. */
  clock=d.clock||{enabled:false,w:0,b:0,inc:0,active:null,last:0,flagged:null};
  clockHist=[{w:clock.w,b:clock.b}];
  awaitingStart=false;
  mainGame=null;
  /* refreshGame() recalcule legalCache pour CETTE position avant toute
     verification de fin de partie : l'appeler avant, comme gameOver() le
     ferait sur l'ancien legalCache (celui d'avant la reprise, potentiellement
     vide), donnerait un faux mat/pat. On fixe donc un statut neutre ici, et
     c'est refreshGame() -- puis, le cas echeant, la boucle de pendule
     100ms -- qui etablit l'etat reel. */
  const s=$("status");
  if(s){s.className="status";s.textContent=game.turn===myColor?t("Your move."):t("The computer is thinking…");}
  refreshGame();
  if(typeof focusBoard==="function")focusBoard();
  if(!gameFinished_safe()&&game.turn!==myColor){busy=true;setTimeout(botMove,220);}
}
function gameFinished_safe(){
  try{return (typeof gameOver==="function")&&gameOver();}catch(e){return false;}
}
function discardSavedPlayAndSetup(){
  clearPlaySave();
  hideReady();
  awaitingStart=false;
  gameStarted=false;
  if(typeof setupGame==="function")setupGame();
  refreshGame();
}
/* Choix explicite affiche a l'arrivee sur l'onglet Jouer quand une partie
   non terminee a ete retrouvee (voir setMode). Reutilise le bandeau
   "readyBanner" comme les autres epreuves chronometrees, avec un titre
   dedie et le bouton secondaire repurpose en "Nouvelle partie". */
function showResumeChoice(){
  const d=pendingPlaySave;
  if(!d){setupGame();return;}
  if(TC_CATS.some(c=>c.id===d.tcCat)){tcCat=d.tcCat;tcIdx=d.tcIdx||0;}
  const {cat,item}=tcCurrent();
  const tcTxt=cat==="none"?t("No clock"):tcLabel(cat,item)+" "+t(cat.charAt(0).toUpperCase()+cat.slice(1));
  const nMoves=Math.ceil((d.uci||[]).length/2);
  const sousTitre=tcTxt+" \u00b7 "+(d.myColor===1?t("You play Black."):t("You play White."))+
    " \u00b7 "+t("Move {n}",{n:nMoves});
  showReadyFor(sousTitre,resumeSavedPlay,t("Resume the game"),
    t("You have an unfinished game"),t("New game instead"),discardSavedPlayAndSetup);
  const tb=$("tipResumeBtn"); if(tb)tb.classList.remove("hide");
  /* pendingPlaySave est encore renseigne ici (resumeSavedPlay() ne le vide
     qu'au moment reel de la reprise) : le plateau doit rester visible pour
     que ce choix, qui vit dedans (readyBanner), soit seulement lisible. */
  if(typeof updatePlayBoardVisibility==="function")updatePlayBoardVisibility();
}
