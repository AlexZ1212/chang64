/* ==========================================================
   PUZZLES + LEVELS
   ========================================================== */
/* Jusqu'ici, la banque entiere (__PUZZLES__, des dizaines de milliers
   d'exercices) etait embarquee telle quelle dans ce script, integre a
   index.html : la page d'accueil pesait plusieurs Mo pour un visiteur qui
   n'en resoudra jamais qu'une fraction dans une session. Meme principe que
   loadOpeningBook/openingMap plus bas (ui2.js) pour le livre d'ouvertures :
   chaque niveau de difficulte est un fichier a part (/data/level-N.json),
   charge a la demande au premier besoin reel, puis mis en cache en memoire
   pour le reste de la session. Un petit index id->niveau (/data/puzzle-
   index.json) et un decompte par theme (/data/theme-counts.json) restent
   legers et permettent de resoudre un id ou d'afficher les compteurs sans
   charger un niveau entier. Le Sprint (ui2.js) pioche dans un echantillon
   dedie (/data/rush-pool.json) plutot que dans la banque complete, pour ne
   jamais avoir a tout charger d'un coup, meme en jouant.
   Meme mecanique de repli que loadOpeningBook : si une requete echoue, on
   reessaie au prochain appel (rien ne reste bloque), et un message clair
   s'affiche plutot qu'un exercice qui ne charge jamais silencieusement. */
const TOTAL_PUZZLES = __TOTAL_PUZZLES__;
const LEVEL_CACHE = {}, LEVEL_PENDING = {};
const PUZZLE_CACHE = {};
let PUZZLE_INDEX = null, PUZZLE_INDEX_PENDING = false;
let THEME_COUNTS = null, THEME_COUNTS_PENDING = false;

function fetchJSON(url, done, fail) {
  if (typeof fetch === "function") {
    fetch(url).then(r => r.ok ? r.json() : Promise.reject(r.status)).then(done).catch(fail);
  } else if (typeof XMLHttpRequest === "function") {
    try {
      const x = new XMLHttpRequest();
      x.open("GET", url, true);
      x.onload = () => { try { x.status >= 200 && x.status < 300 ? done(JSON.parse(x.responseText)) : fail(); } catch (e) { fail(); } };
      x.onerror = fail;
      x.send();
    } catch (e) { fail(); }
  } else fail();
}
function puzzleDataError() {
  const s = $("status");
  if (s) { s.className = "status lose"; s.textContent = t("Couldn't load puzzles. Check your connection and try again."); }
}
/* onReady est rappelee des l'arrivee des donnees (comme done() dans
   loadOpeningBook) : chaque appelant se re-declenche lui-meme une fois
   pret, plutot que de threader des Promises dans tout le fichier -- meme
   choix que le livre d'ouvertures, pour rester coherent avec le reste du
   code et limiter la surface du changement. */
function loadLevel(lvl, onReady) {
  if (LEVEL_CACHE[lvl]) { onReady && onReady(LEVEL_CACHE[lvl]); return; }
  if (LEVEL_PENDING[lvl]) return;
  LEVEL_PENDING[lvl] = true;
  fetchJSON("/data/level-" + lvl + ".json",
    data => { LEVEL_CACHE[lvl] = data; LEVEL_PENDING[lvl] = false; for (const p of data) PUZZLE_CACHE[p.id] = p; onReady && onReady(data); },
    () => { LEVEL_PENDING[lvl] = false; puzzleDataError(); });
}
function loadPuzzleIndex(onReady) {
  if (PUZZLE_INDEX) { onReady && onReady(PUZZLE_INDEX); return; }
  if (PUZZLE_INDEX_PENDING) return;
  PUZZLE_INDEX_PENDING = true;
  fetchJSON("/data/puzzle-index.json",
    data => { PUZZLE_INDEX = data; PUZZLE_INDEX_PENDING = false; onReady && onReady(data); },
    () => { PUZZLE_INDEX_PENDING = false; puzzleDataError(); });
}
function loadThemeCounts(onReady) {
  if (THEME_COUNTS) { onReady && onReady(THEME_COUNTS); return; }
  if (THEME_COUNTS_PENDING) return;
  THEME_COUNTS_PENDING = true;
  fetchJSON("/data/theme-counts.json",
    data => { THEME_COUNTS = data; THEME_COUNTS_PENDING = false; onReady && onReady(data); },
    () => { THEME_COUNTS_PENDING = false; puzzleDataError(); });
}
/* Echantillon dedie pour le Sprint (Defis) : jusqu'a 400 exercices resolus
   en un coup par theme (voir la note dans startRush, ui2.js), pioches sur
   toute la banque plutot que sur un seul niveau -- le Sprint doit varier et
   monter doucement en difficulte en trois minutes, ce qu'un seul niveau ne
   permettrait pas. Fichier a part et de taille bornee (~quelques centaines
   de Ko) plutot que la banque complete : charger tout pour jouer un sprint
   de trois minutes irait a l'encontre du chargement a la demande. */
let RUSH_POOL = null, RUSH_POOL_PENDING = false;
function loadRushPool(onReady) {
  if (RUSH_POOL) { onReady && onReady(RUSH_POOL); return; }
  if (RUSH_POOL_PENDING) return;
  RUSH_POOL_PENDING = true;
  fetchJSON("/data/rush-pool.json",
    data => { RUSH_POOL = data; RUSH_POOL_PENDING = false; for (const p of data) PUZZLE_CACHE[p.id] = p; onReady && onReady(data); },
    () => { RUSH_POOL_PENDING = false; puzzleDataError(); });
}
/* Resout un exercice par id sans connaitre son niveau a l'avance (lien
   direct /#puzzle=..., ou reprise d'un exercice de revision) : consulte
   d'abord le cache, sinon l'index (leger, toujours charge en un coup), puis
   le niveau concerne. */
function loadPuzzleById(id, onReady) {
  if (PUZZLE_CACHE[id]) { onReady && onReady(PUZZLE_CACHE[id]); return; }
  loadPuzzleIndex(idx => {
    const lvl = idx[id];
    if (!lvl) { onReady && onReady(null); return; }
    loadLevel(lvl, () => onReady && onReady(PUZZLE_CACHE[id] || null));
  });
}

/* Dix paliers plutot que cinq : avec cinq, on atteignait le sommet en une
   quinzaine d'exercices reussis (trois de suite pour monter), ce qui donnait
   une impression de plafond bas. Le nom de chaque palier reste honnete avec
   ce que la banque contient reellement a ce niveau de difficulte (calculee a
   la generation, voir gen_puzzles.js et le champ "diff" de puzzles.json) :
   les niveaux 9 et 10 sont presque exclusivement des mats en deux, les huit
   premiers melangent surtout des prises et des mats en un de complexite
   croissante. */
const LEVELS=[
  {n:1,name:"First steps"},
  {n:2,name:"Building confidence"},
  {n:3,name:"Everyday tactics"},
  {n:4,name:"Sharper eyes"},
  {n:5,name:"Wider board"},
  {n:6,name:"Real calculation"},
  {n:7,name:"Advanced tactics"},
  {n:8,name:"Mating attacks"},
  {n:9,name:"Forcing mates"},
  {n:10,name:"Grandmaster finishes"}
];
/* L'indice suivait autrefois le niveau (1 phrase fixe pour les dix), pas
   l'exercice : "cherche la piece mal protegee" s'affichait par exemple sur
   un mat, puisque le niveau 2 promet ca a tous ses exercices sans exception,
   quel que soit leur theme reel. Mesure sur la banque : le niveau 3
   ("Forks and pins") n'est une vraie fourchette que dans 18% des cas, 59%
   sont de simples prises. Chaque exercice connait deja son theme exact
   (classify() dans gen_puzzles.js) ; l'indice le suit desormais lui, plus le
   niveau. Les dix phrases ci-dessous reprennent presque toutes celles qui
   servaient aux niveaux : bien ecrites individuellement, seulement mal
   rattachees. */
const THEME_HINTS={
  "Mate in one":"One move is enough.",
  "Mate in two":"Your first move forces the reply.",
  "Mate in three":"See two moves ahead, not one.",
  "Back-rank mate":"The back rank is not as safe as it looks.",
  "Smothered mate":"The king is boxed in by its own pieces.",
  "Knight fork":"One piece can attack two at once.",
  "Pawn fork":"One piece can attack two at once.",
  "Double attack":"Two threats, only one defence.",
  "Skewer":"Force the bigger piece to move first.",
  "Pin":"This piece can't move without exposing something bigger behind it.",
  "Winning capture":"Look for the loose piece.",
  "Winning move":"The quiet move is often the strongest.",
  "Long-range attack":"A piece far from the action can still reach this square.",
  "Sacrifice":"Count every capture before you play."
};

/* ==========================================================
   TIME CONTROLS
   ========================================================== */
const TC_CATS=[
  {id:"bullet",label:"Bullet",items:[[1,0],[1,1],[2,1]]},
  {id:"blitz",label:"Blitz",items:[[3,0],[3,2],[5,0],[5,3]]},
  {id:"rapid",label:"Rapid",items:[[10,0],[10,5],[15,10]]},
  {id:"classical",label:"Classical",items:[[30,0],[30,20],[60,0]]},
  {id:"daily",label:"Daily",items:[[1],[3],[7]]},
  {id:"none",label:"No clock",items:[[0,0]]}
];
const TC_NOTES={
  bullet:"Bullet: every second counts. The engine will move almost instantly.",
  blitz:"Blitz: the most popular pace online.",
  rapid:"Rapid: enough time to actually think. A good default.",
  classical:"Classical: long games, no rush.",
  daily:"Daily games are played with a friend over a link, one move at a time.",
  none:"No clock: take as long as you like."
};
let tcCat="rapid", tcIdx=0;
function tcCurrent(){
  const c=TC_CATS.find(x=>x.id===tcCat);
  return {cat:c.id,item:c.items[Math.min(tcIdx,c.items.length-1)]};
}
function tcLabel(cat,item){
  if(cat==="daily")return t(item[0]===1?"{n} day/move":"{n} days/move",{n:item[0]});
  if(cat==="none")return t("Unlimited");
  return item[0]+"+"+item[1];
}

/* ==========================================================
   INTERFACE
   ========================================================== */
const $=id=>document.getElementById(id);
const boardEl=$("board");

let mode="home";
let game=new Game();
let flipped=false;
/* Consomme par newGame() : demarre la partie depuis cette position plutot
   que le depart standard, sans changer la signature de newGame() (appelee
   sans argument partout ailleurs). Pose par l'editeur de position (ui3.js,
   "Jouer contre le bot depuis ici"). */
let pendingStartFen=null;
/* Consomme egalement par newGame() : force une partie sans pendule, quel
   que soit le dernier reglage de cadence choisi dans l'onglet Jouer. Pose
   par "Jouer contre le bot depuis ici" (editeur de position) -- reprendre
   la derniere cadence choisie n'aurait aucun sens pour une position deja
   en cours (un chrono frais de 10 minutes sur une fin de partie a trois
   coups, par exemple). */
let pendingNoClock=false;
/* Animation des deplacements : activee par defaut, desactivable dans les
   preferences. Le reglage est relu au demarrage depuis le stockage local. */
let animOn=true;
/* Dernier coup anime : evite de rejouer l'animation a chaque rendu, car
   render() est appele aussi pour une simple selection de piece. Declare ici
   et non pres de render, qui s'execute avant. */
let lastAnimated=null;
/* Une animation est-elle en cours ? Sert a la reprendre si un rendu survient
   avant sa fin, ce qui arrive des qu'on selectionne une piece. */
let animEnCours=false,animTimer=null;
/* Etat du bouton d'aide des exercices : faux = "Indice", vrai = "Voir la
   solution". Declare ici et non pres de hintPuzzle : loadPuzzle le remet a
   faux et s'execute avant, ce qui provoquerait une erreur de zone morte. */
let hintShown=false;
let selected=-1;
let legalCache=[];
let lastMove=null;
let marks={};
let busy=false;
let myColor=W;
/* colorMode retient le choix du joueur ("w", "b" ou "r"), myColor la couleur
   reellement jouee. En mode aleatoire les deux divergent : le tirage est
   refait a chaque nouvelle partie, et le selecteur doit alors montrer la
   couleur obtenue tout en gardant le mode en memoire. */
let colorMode="w";
let botLevel=2;
let pendingPromo=null;
let sanList=[];
let mainGame=null,mainSan=null,mainLast=null,mainStarted=false,mainFlipped=false;
let gameStarted=false;

/* puzzles */
let puzzle=null,puzzleN=0,puzzleTries=0,puzzleDone=false,puzzleSolPly=0,solCache={};
/* Horodatage du chargement de l'exercice courant, pour le record "Fastest
   solve" (records personnels, item 3 de la liste "pour plus tard").
   Remis a zero a CHAQUE loadPuzzle() (voir plus bas), y compris pendant un
   Chang Sprint -- sans consequence, puisque finishPuzzle() court-circuite
   avant d'atteindre le code qui lit cette variable pendant un sprint (meme
   garde que pour prog.solved/themeSolved/solveLog). */
let puzzleStartTs=0;
let prog={level:1,solved:0,streak:0,best:0,correctRun:0,wrongRun:0,seen:[]};
/* Delta de notation du dernier exercice juge (integration ELO) : mis a
   jour par updateRating() (ui2.js), lu par finishPuzzle() juste apres pour
   l'afficher a cote du verdict. Reinitialise a chaque nouvel exercice
   charge (loadPuzzle) pour ne jamais laisser un delta perime s'afficher
   sur l'exercice suivant si jamais l'affichage etait lu avant qu'un nouveau
   delta ne soit calcule. */
let lastRatingDelta=null;

/* ---------- storage ----------
   window.storage n'existe pas dans un navigateur : cette API vient de
   l'environnement dans lequel le prototype a ete construit. Sans cette
   implementation, tous les appels ci-dessous levent une TypeError, avalee
   par les try/catch, et RIEN n'est jamais enregistre : progression,
   classement, serie, historique des parties et partie entre amis
   disparaissent a chaque rechargement.

   On la reimplemente sur localStorage, avec la meme signature asynchrone
   pour ne rien changer aux appelants. Repli en memoire si le navigateur
   refuse localStorage (navigation privee sur certains Safari, stockage
   plein, cookies tiers bloques dans une iframe). */
(function(){
  if(window.storage&&typeof window.storage.get==="function")return;
  var mem=Object.create(null),usable=false;
  try{
    var probe="chang64:__probe";
    window.localStorage.setItem(probe,"1");
    window.localStorage.removeItem(probe);
    usable=true;
  }catch(e){}
  function rd(k){
    if(!usable)return mem[k]===undefined?null:mem[k];
    try{return window.localStorage.getItem(k);}catch(e){return mem[k]===undefined?null:mem[k];}
  }
  function wr(k,v){
    mem[k]=v;
    if(!usable)return;
    try{window.localStorage.setItem(k,v);}
    catch(e){usable=false;}   /* quota depasse : on bascule en memoire */
  }
  function rm(k){
    delete mem[k];
    if(!usable)return;
    try{window.localStorage.removeItem(k);}catch(e){}
  }
  window.storage={
    get:function(key){
      var v=rd(key);
      return Promise.resolve(v===null||v===undefined?null:{key:key,value:v,shared:false});
    },
    set:function(key,value){
      var v=typeof value==="string"?value:JSON.stringify(value);
      wr(key,v);
      return Promise.resolve({key:key,value:v,shared:false});
    },
    "delete":function(key){
      rm(key);
      return Promise.resolve({key:key,deleted:true,shared:false});
    },
    list:function(prefix){
      var out=[],p=prefix||"";
      if(usable){
        try{
          for(var i=0;i<window.localStorage.length;i++){
            var k=window.localStorage.key(i);
            if(k&&k.indexOf(p)===0)out.push(k);
          }
        }catch(e){}
      }else{
        for(var k2 in mem)if(k2.indexOf(p)===0)out.push(k2);
      }
      return Promise.resolve({keys:out,prefix:p,shared:false});
    }
  };
})();

async function saveProg(){try{await window.storage.set("chang64:progress",JSON.stringify(prog));}catch(e){}}
async function loadProg(){
  try{const r=await window.storage.get("chang64:progress");
    if(r&&r.value)prog=Object.assign(prog,JSON.parse(r.value));}catch(e){}
}

/* ==========================================================
   CLOCKS
   ========================================================== */
let clock={enabled:false,w:0,b:0,inc:0,active:null,last:0,flagged:null};
const isFlagged=()=>clock.flagged!==null&&clock.flagged!==undefined;
let clockHist=[];

function clockSetup(){
  const {cat,item}=tcCurrent();
  if(cat==="none"||cat==="daily"){
    clock={enabled:false,w:0,b:0,inc:0,active:null,last:0,flagged:null};
  } else {
    const ms=item[0]*60000;
    clock={enabled:true,w:ms,b:ms,inc:item[1]*1000,active:W,last:Date.now(),flagged:null};
  }
  clockHist=[{w:clock.w,b:clock.b}];
  renderClocks();
}
/* Tant que la partie n'est pas lancee depuis l'overlay de preparation, la
   pendule ne doit pas s'ecouler et l'ordinateur ne doit pas jouer. */
let awaitingStart=false;
/* Pose par le bandeau de fin : on vient de choisir, inutile de redemander. */
let skipReady=false;
let readyStatus="";
function clockDrain(){
  if(awaitingStart)return;
  if(!clock.enabled||clock.active===null||isFlagged())return;
  const now=Date.now(),d=now-clock.last;
  clock.last=now;
  if(clock.active===W)clock.w=Math.max(0,clock.w-d); else clock.b=Math.max(0,clock.b-d);
}
function clockAfterMove(mover){
  if(!clock.enabled||isFlagged())return;
  clockDrain();
  if(mover===W)clock.w+=clock.inc; else clock.b+=clock.inc;
  clock.active=mover^1;
  clock.last=Date.now();
  clockHist.push({w:clock.w,b:clock.b});
}
function clockStop(){clockDrain();clock.active=null;}
function fmtTime(ms){
  if(ms<=0)return "0:00";
  const secs=Math.ceil(ms/100)/10;
  const m=Math.floor(secs/60),s=secs-m*60;
  if(ms<20000)return m+":"+(s<10?"0":"")+s.toFixed(1);
  return m+":"+String(Math.floor(s)).padStart(2,"0");
}
/* "Chang" designe l'adversaire, pas le site : chang64 reste le nom du site,
   et le distinguer evite de croire qu'on joue contre la plateforme. */
function botLabel(){
  const seg=document.getElementById("segLevel");
  let force="";
  if(seg){const b=seg.querySelector('[data-v="'+botLevel+'"]');if(b)force=b.textContent.trim();}
  return force?"Chang \u00b7 "+force:"Chang";
}
/* Pieces capturees et solde materiel, affiches dans la pendule de chaque
   joueur. On reconstitue depuis l'historique plutot que de tenir un compteur
   a part : impossible de desynchroniser, et une annulation de coup se reflete
   toute seule.
   Convention : pion 1, cavalier et fou 3, tour 5, dame 9. Seul le joueur en
   avantage affiche un nombre. */
const VAL_PIECE={p:1,n:3,b:3,r:5,q:9,k:0};
function prises(){
  const par={w:[],b:[]};
  const g=viewGame();
  for(const h of g.history||[]){
    const c=h.m&&h.m.captured;
    if(!c)continue;
    /* la piece prise appartient a l'adversaire du joueur qui a joue */
    const preneur=pC(c)===W?"b":"w";
    par[preneur].push(SYM[pT(c)]);
  }
  const ordre={q:0,r:1,b:2,n:3,p:4};
  for(const k of ["w","b"])par[k].sort((a,b)=>(ordre[a]||9)-(ordre[b]||9));
  const val=k=>par[k].reduce((s,x)=>s+(VAL_PIECE[x]||0),0);
  return {w:par.w,b:par.b,solde:val("w")-val("b")};
}
/* Rangee compacte : les pieces se chevauchent pour tenir sur une ligne, meme
   avec une quinzaine de prises. Le chevauchement ne vaut qu'au sein d'un
   meme type : trois pions pris se tassent en petit tas, mais le tas de pions
   ne se melange pas visuellement a celui des fous. La liste est deja triee
   par type (voir prises() plus haut), donc deux prises voisines du meme
   type sont forcement consecutives dans la boucle. */
/* Hauteur d'une piece prise, en pixels. Sert aussi a calculer sa largeur :
   les deux doivent rester coherents avec la regle .taken .tk du gabarit. */
const TAILLE_PRISE=20;
/* Chevauchement au sein d'un groupe : assez pour que le tas se voie, pas
   assez pour masquer la silhouette du dessous (le pion, piece la plus
   etroite une fois recadree sur sa boite, ne fait que 11px : au-dela on ne
   distinguerait plus qu'une seule piece). Ecart entre deux groupes : plus
   large que l'ancien espacement uniforme de 2px, pour que la coupure entre
   deux types saute aux yeux sans avoir besoin d'un separateur visuel. */
const CHEVAUCHEMENT_GROUPE=-5,ECART_GROUPE=4;
function rangeePrises(liste,couleur,solde){
  /* Toujours retourner la rangee, meme sans aucune prise ni solde (au lieu
     d'une chaine vide) : sinon le bloc pendule demarrait plus bas, puis
     grandissait brusquement des la premiere prise, decalant l'echiquier et
     tout ce qui suit. La hauteur reste ainsi fixe du debut a la fin de la
     partie. */
  const cls="tk"+(couleur==="b"?" noire":""); // "noire" declenche le contour clair, sinon confondue au fond sombre
  let s='<span class="taken">';
  let precedent=null;
  for(const t of liste){
    /* Largeur proportionnelle a la boite englobante : le pion reste plus
       etroit que la dame, comme sur l'echiquier, et chaque piece part de son
       propre bord au lieu d'un vide interne different a chaque fois. */
    const bb=(typeof PIECE_BB!=="undefined"&&PIECE_BB[t])||[0,45];
    const larg=(TAILLE_PRISE*(bb[1]-bb[0])/45).toFixed(1);
    /* Premiere piece de la rangee : pas de marge, elle part du bord (deja
       decale par le padding-left de .taken). Les suivantes reprennent le
       chevauchement ou l'ecart selon qu'elles poursuivent le meme groupe. */
    const marge=precedent===null?0:(precedent===t?CHEVAUCHEMENT_GROUPE:ECART_GROUPE);
    s+='<i class="'+cls+'" style="width:'+larg+'px;margin-left:'+marge+'px">'+pieceSVG(t,couleur,true)+"</i>";
    precedent=t;
  }
  /* Les deux cotes affichent leur solde : celui qui mene en positif, celui
     qui est mene en negatif. Voir qu'on a trois points de retard est aussi
     utile que de voir qu'on en a trois d'avance. */
  if(solde)s+='<b class="adv">'+(solde>0?"+":"\u2212")+Math.abs(solde)+"</b>";
  return s+"</span>";
}
function renderClocks(){
  const show=clock.enabled&&mode==="play"&&gameStarted;
  $("clockTop").classList.toggle("hide",!show);
  $("clockBottom").classList.toggle("hide",!show);
  if(!show)return;
  const topColor=myColor^1,botColor=myColor;
  const snap=(typeof reviewPly!=="undefined"&&reviewPly!==null&&typeof clockHist!=="undefined"&&clockHist[reviewPly])
    ? clockHist[reviewPly] : clock;
  const val=c=>c===W?snap.w:snap.b;
  /* L'adversaire s'appelait "Ordinateur", ce qui ne dit rien. On le nomme,
     et on rappelle sa force : battre "Chang · Coriace" veut dire quelque
     chose, et on sait en permanence contre quoi on joue. Le libelle de force
     est lu sur le selecteur, deja traduit, plutot que maintenu en double. */
  $("clockTopName").textContent=botLabel();
  $("clockBottomName").textContent=t("You");
  $("clockTopSwatch").className=topColor===B?"dark":"";
  $("clockBottomSwatch").className=botColor===B?"dark":"";
  $("clockTopTime").textContent=fmtTime(val(topColor));
  $("clockBottomTime").textContent=fmtTime(val(botColor));
  const set=(el,c)=>{
    el.classList.toggle("active",clock.active===c&&!isFlagged());
    el.classList.toggle("low",val(c)<20000&&val(c)>0);
    el.classList.toggle("flagged",clock.flagged===c);
  };
  set($("clockTop"),topColor);
  set($("clockBottom"),botColor);
  /* Pieces prises par chacun, et solde pour celui qui mene. */
  const pr=prises();
  const cle=c=>c===W?"w":"b";
  const soldeDe=c=>(c===W?pr.solde:-pr.solde);
  const tt=$("takenTop"), tb=$("takenBottom");
  if(tt)tt.innerHTML=rangeePrises(pr[cle(topColor)],cle(topColor)==="w"?"b":"w",soldeDe(topColor));
  if(tb)tb.innerHTML=rangeePrises(pr[cle(botColor)],cle(botColor)==="w"?"b":"w",soldeDe(botColor));
}
setInterval(()=>{
  if(mode!=="play"||!clock.enabled||isFlagged()||clock.active===null)return;
  clockDrain();
  renderClocks();
  if(clock.w<=0||clock.b<=0){
    clock.flagged=clock.w<=0?W:B;
    clock.active=null;
    const iLost=clock.flagged===myColor;
    const s=$("status");
    const other=clock.flagged^1;
    const g2=game;
    let insufficient=false;
    try{
      let mat=0;
      for(let sq=0;sq<128;sq++){if(sq&0x88){sq+=7;continue;}
        const p=g2.board[sq];
        if(p&&pC(p)===other&&pT(p)!==K&&pT(p)!==N&&pT(p)!==BI)mat++;
        if(p&&pC(p)===other&&(pT(p)===N||pT(p)===BI))mat+=0.5;}
      insufficient=mat<1;
    }catch(e){}
    if(insufficient){s.className="status";s.textContent=t("Flag falls, but there is not enough material to mate. Draw.");
      resultInfo={kind:"draw",title:t("Draw"),sub:s.textContent};}
    else{s.className="status "+(iLost?"lose":"win");
      s.textContent=iLost?t("Your flag fell. The computer wins on time."):t("The computer's flag fell. You win on time.");
      resultInfo={kind:iLost?"lose":"win",title:iLost?t("You lose"):t("You win"),sub:s.textContent};}
    renderClocks();refreshGame();
  }
},100);

/* ==========================================================
   BOARD
   ========================================================== */
function buildBoard(){
  boardEl.innerHTML="";
  for(let i=0;i<64;i++){
    const d=document.createElement("div");
    d.className="sq";
    /* tabindex roulant : une seule case est atteignable a la tabulation,
       sinon traverser l'echiquier demanderait 64 pressions de Tab. Les
       fleches deplacent ensuite le curseur (voir ui3.js). */
    d.tabIndex=-1;
    d.setAttribute("role","button");
    d.addEventListener("click",onSquare);
    d.addEventListener("keydown",ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();onSquare(ev);}});
    /* Glisser-depose : uniquement dans l'editeur de position (mode==="edit"),
       et uniquement depuis une case occupee -- une case vide n'a rien a
       glisser, le tap-pour-poser habituel (via le "click" ci-dessus) reste
       seul en jeu dans ce cas. Voir la section dediee dans ui3.js pour le
       detail complet de la mecanique. */
    d.addEventListener("pointerdown",ev=>{
      if(mode!=="edit"||typeof editPointerDown!=="function")return;
      const i=Array.prototype.indexOf.call(boardEl.children,ev.currentTarget);
      const sq=idxToSq(i);
      const p=game.board[sq];
      if(!p)return;
      editPointerDown(ev,{source:"board",sq:sq,piece:p});
    });
    boardEl.appendChild(d);
  }
  /* Une seule case porte tabindex=0. On la pose directement, sans passer par
     setRoving : ui3.js n'est pas encore execute a ce stade et ses variables
     en let seraient en zone morte temporelle. La case 56 est a1, en bas a
     gauche. ui3.js reprend la main ensuite via les fleches et le focus. */
  if(boardEl.children[56])boardEl.children[56].tabIndex=0;
}
function idxToSq(i){
  const r=Math.floor(i/8),f=i%8;
  return flipped?(7-r)*16+(7-f):r*16+f;
}
let reviewGame=null,reviewLast=null;
function viewGame(){return reviewGame||game;}
function render(){
  const g=viewGame();
  const cells=boardEl.children;
  const targets=new Map();
  if(!reviewGame&&selected>=0)for(const m of legalCache)if(m.from===selected)targets.set(m.to,m);
  const checkSq=g.inCheck()?g.kingSq[g.turn]:-1;
  const hl=reviewGame?reviewLast:lastMove;
  for(let i=0;i<64;i++){
    const sq=idxToSq(i),c=cells[i],p=g.board[sq];
    const dark=(fOf(sq)+rOf(sq))%2===1;
    let cls="sq "+(dark?"d":"l");
    if(hl&&(sq===hl.from||sq===hl.to))cls+=" last";
    if(sq===selected)cls+=" sel";
    if(sq===checkSq)cls+=" check";
    if(marks[sq])cls+=" "+marks[sq];
    c.className=cls;
    let html="";
    const r=Math.floor(i/8),f=i%8;
    if(r===7)html+='<span class="co f">'+"abcdefgh"[fOf(sq)]+'</span>';
    if(f===0)html+='<span class="co r">'+(8-rOf(sq))+'</span>';
    if(p){const cc=pC(p)===W?"w":"b";
      /* data-sq permet de retrouver la piece apres un rendu : render()
         reconstruit tout le HTML, donc l'element d'origine n'existe plus et
         on ne peut pas l'animer directement. On anime la nouvelle piece en la
         faisant partir de l'ancienne case. */
      html+='<span class="piece" data-sq="'+sq+'" data-p="'+cc+SYM[pT(p)]+'">'+pieceSVG(SYM[pT(p)],cc)+'</span>';}
    if(targets.has(sq))html+=p?'<span class="ring"></span>':'<span class="dot"></span>';
    c.innerHTML=html;
  }
  /* Anime le dernier coup joue, quel que soit le mode : partie, exercice,
     finale ou revue. On compare au coup precedemment anime pour ne pas
     rejouer l'animation a chaque rendu (survol, selection, redimensionnement). */
  const mv=reviewGame?reviewLast:lastMove;
  if(mv&&mv!==lastAnimated){lastAnimated=mv;animateMove(mv);}
  else if(!mv)lastAnimated=null;
  else if(mv&&animEnCours)animateMove(mv,true);   /* rendu pendant l'animation */
}
/* Glissement de la piece jouee, de sa case de depart vers son arrivee.
   render() ayant recree le HTML, on positionne la nouvelle piece a l'endroit
   de l'ancienne puis on la laisse revenir a zero : le navigateur anime la
   transition. Purement visuel, aucun effet sur la partie. */
/* reprise=true quand render() a eu lieu PENDANT une animation : selectionner
   une piece declenche un rendu, qui recree le HTML et effaçait l'animation en
   plein vol. On la reprend alors la ou elle en etait au lieu de la perdre. */
function animateMove(mv,reprise){
  if(!mv||prefersReducedMotion()||!animOn)return;
  if(reprise&&!animEnCours)return;
  const dep=cellOf(mv.from), arr=cellOf(mv.to);
  if(!dep||!arr)return;
  const piece=arr.querySelector(".piece");
  if(!piece)return;
  /* On calcule le decalage en cases plutot qu'en pixels : la taille d'une
     case varie avec l'ecran, mais le rapport reste le meme. Utiliser
     offsetLeft directement fonctionne aussi, mais depend d'une mise en page
     deja calculee, ce qui n'est pas garanti au premier rendu. */
  const idx=el=>[...boardEl.children].indexOf(el);
  const iD=idx(dep), iA=idx(arr);
  if(iD<0||iA<0)return;
  const colD=iD%8, ligD=(iD/8)|0, colA=iA%8, ligA=(iA/8)|0;
  const dCol=colD-colA, dLig=ligD-ligA;
  if(!dCol&&!dLig)return;
  const dx=dCol*100, dy=dLig*100;   /* en pourcentage de la case */
  piece.style.transition="none";
  piece.style.transform="translate("+dx+"%,"+dy+"%)";
  piece.style.zIndex="6";
  /* deux images plus tard, pour que le navigateur prenne en compte la
     position de depart avant d'animer */
  animEnCours=true;
  clearTimeout(animTimer);
  animTimer=setTimeout(()=>{animEnCours=false;},200);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    piece.style.transition="transform .18s cubic-bezier(.22,.61,.36,1)";
    piece.style.transform="translate(0,0)";
  }));
}
/* Retrouve la case d'un carre : on inverse idxToSq, qui tient compte de
   l'orientation de l'echiquier. */
function cellOf(sq){
  for(let i=0;i<64;i++)if(idxToSq(i)===sq)return boardEl.children[i];
  return null;
}
function prefersReducedMotion(){
  try{return window.matchMedia("(prefers-reduced-motion: reduce)").matches;}catch(e){return false;}
}
function updateEval(){
  const g=viewGame();
  let cpTrue=null,mate=null;
  if(typeof evalFromAnalysis==="function"){
    const ea=evalFromAnalysis();
    if(ea){cpTrue=ea.cpTrue;mate=ea.mate;}
  }
  if(cpTrue===null&&mate===null)cpTrue=evaluate(g)*(g.turn===W?1:-1);
  const pawnsTrue=(cpTrue||0)/100;
  /* BAR_CAP : ecretage VISUEL de la barre seulement (comme sur chess.com et
     lichess, dont la barre est quasi pleine bien avant un avantage de 10
     pions). Ce plafond ne touche plus le nombre affiche : avant ce
     correctif, Math.max(-10,Math.min(10,...)) ecretait aussi le texte, donc
     "+14.0" restait bloque a "+10.0". Sur un mat force, la barre va au
     maximum du cote gagnant plutot que de suivre un pseudo-score. */
  const BAR_CAP=10;
  const pawnsForBar=mate!==null?(mate>0?BAR_CAP:-BAR_CAP):Math.max(-BAR_CAP,Math.min(BAR_CAP,pawnsTrue));
  /* La hauteur represente toujours la part des Blancs. C'est l'orientation
     de la barre qui suit celle de l'echiquier, pas la valeur. */
  $("evalfill").style.height=(50+pawnsForBar*4.4).toFixed(1)+"%";
  { const tr=document.querySelector(".evaltrack");
    if(tr)tr.classList.toggle("flipped",!!flipped); }
  /* Sur un mat force, chess.com et lichess affichent "M{n}" (le nombre de
     coups jusqu'au mat) plutot qu'une valeur en pions : un score numerique
     n'a pas de sens face a une issue forcee et binaire. */
  $("evalnum").textContent=mate!==null?(mate>0?"M":"\u2212M")+Math.abs(mate):(pawnsTrue>0?"+":"")+pawnsTrue.toFixed(1);
  const el=$("evaltxt");
  const side=(mate!==null?mate>0:pawnsTrue>0)?"White":"Black";
  if(mate!==null)el.textContent=t(side+" mates in {n}",{n:Math.abs(mate)});
  else if(Math.abs(pawnsTrue)<0.6)el.textContent=t("Even position");
  else if(Math.abs(pawnsTrue)<1.6)el.textContent=t(side+" slightly better");
  else if(Math.abs(pawnsTrue)<3.5)el.textContent=t(side+" is better");
  else el.textContent=t(side+" is winning");
}
function onSquare(e){
  const i=Array.prototype.indexOf.call(boardEl.children,e.currentTarget);
  const sq=idxToSq(i);
  if(busy||pendingPromo)return;
  /* Un sprint lance depuis Defis se joue avec mode==="train" : sans ce cas,
     les clics sur l'echiquier etaient ignores et l'exercice ne passait jamais
     au suivant.
     On interroge document.body plutot que la variable rush : celle-ci est
     declaree avec let dans ui2.js, charge APRES ce fichier, donc elle est en
     zone morte ici et typeof la masque silencieusement. La classe rush-on est
     posee sur body au demarrage du sprint, elle est donc fiable. */
  if(document.body.classList.contains("rush-on")){handlePuzzleClick(sq);return;}
  if(mode==="train"){handlePuzzleClick(sq);return;}   /* sprint : traite comme un exercice */
  if(mode==="play")handleGameClick(sq);
  else if(mode==="friend")handleAmiClick(sq);
  else if(mode==="puzzles")handlePuzzleClick(sq);
  else if(mode==="edit"){if(typeof handleEditorClick==="function")handleEditorClick(sq);}
  else if(mode==="analyse"){if(typeof handleAnalyseClick==="function")handleAnalyseClick(sq);}
}
function pickMove(from,to){
  const c=legalCache.filter(m=>m.from===from&&m.to===to);
  if(!c.length)return null;
  if(c.length>1&&c[0].promo)return {promo:c};
  return {move:c[0]};
}
function askPromo(cands,then){
  pendingPromo=true;
  const box=$("promoBtns");box.innerHTML="";
  const names={5:t("Queen"),4:t("Rook"),3:t("Bishop"),2:t("Knight")};
  for(const t of [Q,R,BI,N]){
    const m=cands.find(x=>x.promo===t); if(!m)continue;
    const b=document.createElement("button");
    b.innerHTML=pieceSVG(SYM[t],game.turn===W?"w":"b");
    b.setAttribute("aria-label",names[t]);
    b.onclick=()=>{$("promoModal").classList.remove("on");pendingPromo=null;then(m);};
    box.appendChild(b);
  }
  $("promoModal").classList.add("on");
}

/* ==========================================================
   PLAY VS COMPUTER
   ========================================================== */
/* Tant qu'aucune partie n'est active (reglages pas encore lances), le
   plateau lui-meme reste cache : le voir plein de pieces avant meme d'avoir
   choisi couleur/force/cadence laissait croire qu'on pouvait deja jouer, le
   clic ne faisant en realite rien (handleGameClick commence par
   "if(!gameStarted)return", sans aucun signal). Exception : le choix de
   reprise d'une partie sauvegardee (pendingPlaySave) doit rester visible,
   il vit dans ce meme bloc (readyBanner, a l'interieur de .board-wrap).
   Appelee depuis refreshGame() (couvre la quasi-totalite des transitions
   d'etat en mode Jouer) et explicitement depuis showResumeChoice(), le seul
   chemin qui ne passe pas par refreshGame(). */
function updatePlayBoardVisibility(){
  const bw=document.querySelector(".board-wrap");
  if(!bw)return;
  const hide=mode==="play"&&!gameStarted&&!(typeof pendingPlaySave!=="undefined"&&pendingPlaySave);
  bw.classList.toggle("hide",hide);
  if(mode==="play"){ const bt=$("boardTools"); if(bt)bt.classList.toggle("hide",hide); }
}
function refreshGame(){
  legalCache=game.moves();
  render();updateEval();renderSheetInto("sheet",sanList);renderClocks();
  updatePlayBoardVisibility();
  const over=gameOver();
  /* turnline (element "Ta partie" / "Trait aux Blancs.") a ete retire : il
     ne faisait plus que repeter l'overlay de preparation et l'evidence de
     l'echiquier. La seule info utile de ce bloc, l'ouverture detectee, reste
     affichee via #opening ; le reste (echec, calcul en cours, resultat)
     continue de vivre dans #status, qui portait deja ces messages. */
  if(typeof afterGameRender==="function")afterGameRender(over);
  $("btnNew").textContent=gameStarted?t("New game"):t("Start game");
  $("btnResign").disabled=!gameStarted||(over&&resigned===null);
  /* Masque plutot que grise tant qu'aucune partie n'existe : "Abandonner"
     une partie qui n'a jamais commence n'a pas de sens a montrer du tout,
     grise sans explication ou pas (meme principe que "Annuler mon coup"
     en mode Entre amis). Reste disponible (grise selon la ligne au-dessus)
     une fois qu'une partie a reellement existe, y compris terminee. */
  $("btnResign").classList.toggle("hide",!gameStarted);
  $("btnHint").disabled=busy||(typeof gameFinished==="function"&&!gameFinished()&&!isReviewGame);
  /* Ces trois blocs n'ont un sens que lorsqu'il y a effectivement une partie
     (en cours ou terminee) a montrer/exporter/analyser : masques plutot que
     laisses vides ou desactives sans explication pendant le parametrage.
     Revue : jamais pendant le parametrage NI pendant qu'on joue (l'analyse
     reste bloquee tant que la partie n'est pas finie, deja le cas plus bas
     dans ce fichier) -- seulement une fois la partie finie, ou en train de
     revoir un PGN importe. Feuille de partie et export PGN : des qu'il y a
     au moins un coup a montrer/exporter, meme en cours de partie. */
  {
    const hasMoves=sanList.length>0;
    const finished=(typeof gameFinished==="function"&&gameFinished())||(typeof isReviewGame!=="undefined"&&isReviewGame);
    const sp=$("scoresheetPanel"); if(sp)sp.classList.toggle("hide",!hasMoves);
    const rp=$("reviewPanel"); if(rp)rp.classList.toggle("hide",!finished);
    const pe=$("pgnExportRow"); if(pe)pe.classList.toggle("hide",!hasMoves);
    /* Le bloc ouverture/statut n'a rien a montrer avant qu'une partie
       n'existe (l'instruction correspondante vit desormais dans la bulle
       (i) de "Reglages", voir template.html) : masque pendant le
       parametrage, reapparait avec la partie pour le statut en direct. */
    const stp=$("statusPanel"); if(stp)stp.classList.toggle("hide",!gameStarted);
    /* Reglages et PGN n'ont plus rien a faire une fois la partie
       reellement en cours : le choix de couleur/force/cadence est deja
       fait (et verrouille juste apres), et importer un PGN reecraserait la
       partie en train de se jouer. Les deux redeviennent utiles avant que
       la partie ne commence, ou une fois qu'elle est terminee (choisir la
       suivante, exporter celle qui vient de se jouer). */
    const midGame=gameStarted&&!finished;
    const gp=$("settingsPanel"); if(gp)gp.classList.toggle("hide",midGame);
    const pp=$("pgnPanel"); if(pp)pp.classList.toggle("hide",midGame);
  }
  /* (le verrouillage en cours de partie, plus bas, a le dernier mot) */

  /* Pendant une partie en cours, seul "Abandonner" reste actif.
     Deux raisons distinctes :
     - changer de couleur relancait immediatement une nouvelle partie et
       faisait disparaitre celle en cours sans prevenir ;
     - un bouton "Analyser la partie" cliquable pendant qu'on joue laisse
       croire qu'il peut servir a trouver le meilleur coup (Stockfish tourne
       derriere ce bouton depuis la fusion des deux moteurs). Il ne le peut
       pas, l'analyse reste bloquee tant que la partie n'est pas finie, mais
       aux echecs le soupcon de triche suffit a poser probleme : mieux vaut
       lever toute ambiguite. */
  const enCours=gameStarted&&!over;
  /* Sauvegarde/effacement de la partie en cours (mode Jouer uniquement,
     jamais pendant une revue de PGN importe). Voir la section 20 de ui2.js
     pour le detail : un coup vient d'etre joue -> on sauvegarde ; la partie
     vient de se terminer (mat, pat, abandon, temps) -> on efface, sinon une
     partie finie resterait proposee a la reprise par erreur. */
  if(typeof isReviewGame==="undefined"||!isReviewGame){
    if(enCours){if(typeof savePlay==="function")savePlay();}
    else if(gameStarted){if(typeof clearPlaySave==="function")clearPlaySave();}
  }
  /* En mode aleatoire, le selecteur montre la couleur tiree pendant la
     partie et le mode choisi en dehors : son etat depend donc du deroulement
     et doit etre rafraichi ici. */
  if(typeof syncColorSeg==="function")syncColorSeg();
  const geler=el=>{const e=$(el);if(e)e.disabled=enCours;};
  geler("btnNew");
  /* "Voir le meilleur coup" appartient a la revue d'apres-partie. Il etait
     deja sans effet pendant une partie, mais il apparaissait actif parmi les
     commandes de jeu, ce qui laissait croire qu'il pouvait aider a jouer. Il
     est desormais explicitement grise, comme le reste. */
  geler("btnHint");
  /* "Analyser la partie" : ne pas contrarier son propre etat. Pendant le
     telechargement de Stockfish ou le calcul de l'analyse, il se desactive
     lui-meme (voir ui3.js) et change son libelle ; on ne doit surtout pas le
     rallumer entre-temps, d'ou le test sur son texte plutot que sur enCours
     seul. */
  {
    const ba=$("btnAnalyse");
    if(ba){
      const enTrain=ba.textContent!==t("Analyse this game");
      if(enCours)ba.disabled=true;
      else if(!enTrain)ba.disabled=!(isReviewGame||(typeof gameFinished==="function"&&gameFinished()))&&!analysis;
    }
  }
  for(const seg of ["segColor","segLevel"]){
    const g=$(seg);
    if(g)for(const b of g.children)b.disabled=enCours;
  }
  for(const seg of ["tcCats2","tcChips2"]){
    const g=$(seg);
    if(g)for(const b of g.children)b.disabled=enCours;
  }
}
let resultInfo=null,resigned=null;
function gameOver(){
  if(resigned!==null)return true;
  if(isFlagged())return true;
  if(!legalCache.length||game.isDraw()){
    const s=$("status");
    if(game.isCheckmate()){
      const won=(game.turn===W?B:W)===myColor;
      s.className="status "+(won?"win":"lose");
      s.textContent=won?t("Checkmate. You win."):t("Checkmate. The computer wins.");
      resultInfo={kind:won?"win":"lose",title:won?t("You win"):t("You lose"),sub:s.textContent};
    } else {
      s.className="status";
      s.textContent=game.isStalemate()?t("Stalemate. The game is drawn."):t("The game is drawn.");
      resultInfo={kind:"draw",title:t("Draw"),sub:s.textContent};
    }
    clockStop();
    return true;
  }
  return false;
}
function handleGameClick(sq){
  if(!gameStarted)return;
  if(reviewGame){exitReview();return;}
  if(resigned!==null)return;
  if(isFlagged())return;
  if(!legalCache.length||game.isDraw())return;
  if(game.turn!==myColor)return;
  const p=game.board[sq];
  if(selected>=0){
    const r=pickMove(selected,sq);
    if(r){
      marks={};
      if(r.promo){askPromo(r.promo,m=>playUser(m));selected=-1;render();return;}
      playUser(r.move);return;
    }
  }
  if(p&&pC(p)===game.turn){selected=sq;marks={};} else selected=-1;
  render();
}
function playUser(m){
  sanList.push(game.san(m));
  game.makeMove(m);lastMove=m;selected=-1;marks={};
  clockAfterMove(myColor);
  /* busy doit etre pose AVANT refreshGame, sinon le bouton Reprendre est
     rallume puis eteint dans la meme foulee, et reste actif pendant que le
     moteur calcule. Cliquer a ce moment-la annulerait un coup sur une
     position que le moteur est en train d'analyser. */
  const suite=!isFlagged()&&legalCache.length&&!game.isDraw();
  if(suite)busy=true;
  refreshGame();
  if(!suite)return;
  $("status").className="status";
  $("status").textContent=t("The computer is thinking…");
  $("btnHint").disabled=true;
  setTimeout(botMove,60);
}
function botMove(){
  if(isFlagged()){busy=false;refreshGame();return;}
  /* Profondeurs relevees apres optimisation du moteur. Auparavant, le niveau
     4 demandait 3,7 s pour atteindre la profondeur 4 mais n'en avait que 1,5 :
     il etait coupe en cours de route et jouait en realite comme le niveau 3.
     Le moteur atteint desormais la profondeur 4,8 en moyenne dans ce meme
     budget, ce qui rend le palier 5 accessible et l'echelle enfin croissante.
     Mesure : profondeur 5 bat profondeur 4 par 5,5 a 2,5. */
  const conf={1:{d:1,t:120},2:{d:2,t:280},3:{d:3,t:700},4:{d:5,t:2000}}[botLevel];
  let budget=conf.t;
  if(clock.enabled){
    const left=(myColor===W?clock.b:clock.w);
    budget=Math.max(50,Math.min(conf.t,left/25));
  }
  let mv;
  const rnd=botLevel===1?0.35:botLevel===2?0.15:0;
  if(rnd&&Math.random()<rnd){const l=game.moves();mv=l[Math.floor(Math.random()*l.length)];}
  else mv=search(game,conf.d,budget).move;
  if(!mv){busy=false;refreshGame();return;}
  sanList.push(game.san(mv));
  game.makeMove(mv);lastMove=mv;busy=false;
  clockAfterMove(myColor^1);
  refreshGame();
  if(!gameOver()){
    const s=$("status");s.className="status";
    s.textContent=game.inCheck()?t("Check. Your move."):t("Your move.");
  }
}
function renderSheetInto(id,list){
  const el=$(id); if(!el)return;
  if(!list||!list.length){el.innerHTML='<div class="sheet-empty">'+t("No moves yet")+'</div>';return;}
  let h="";
  for(let i=0;i<list.length;i+=2){
    const last=list.length-1;
    h+='<div class="sheet-row"><span class="n">'+(i/2+1)+'</span>'+
       '<span class="'+(i===last?"cur":"")+'">'+(list[i]||"")+'</span>'+
       '<span class="'+(i+1===last?"cur":"")+'">'+(list[i+1]||"")+'</span></div>';
  }
  el.innerHTML=h;el.scrollTop=el.scrollHeight;
}
function setupGame(){
  gameStarted=false;
  resultInfo=null;resultDismissed=false;resigned=null;disarmResign();
  if(typeof isReviewGame!=="undefined")isReviewGame=false;
  if(typeof clearAnalysis==="function")clearAnalysis();
  if(typeof gameStartFen!=="undefined")gameStartFen=null;
  game=new Game();sanList=[];lastMove=null;selected=-1;marks={};busy=false;
  reviewGame=null;reviewLast=null;
  flipped=myColor===B;
  clock={enabled:false,w:0,b:0,inc:0,active:null,last:0,flagged:null};
  clockHist=[];
  mainGame=null;
  refreshGame();
  const s=$("status");s.className="status";
}
function newGame(){
  /* Le tirage est refait a chaque partie : choisir "Au hasard" une fois doit
     donner une couleur differente d'une partie a l'autre, pas une couleur
     fixee au moment du clic. Avant gameStarted, pour que syncColorSeg voie
     le bon etat. */
  if(colorMode==="r")myColor=Math.random()<0.5?W:B;
  gameStarted=true;
  if(typeof gameSaved!=="undefined")gameSaved=false;
  resultInfo=null;resultDismissed=false;resigned=null;disarmResign();
  if(typeof isReviewGame!=="undefined")isReviewGame=false;
  reviewGame=null;reviewLast=null;
  if(typeof clearAnalysis==="function")clearAnalysis();
  game=pendingStartFen?new Game(pendingStartFen):new Game();
  if(typeof gameStartFen!=="undefined")gameStartFen=pendingStartFen;
  pendingStartFen=null;sanList=[];lastMove=null;selected=-1;marks={};busy=false;
  flipped=myColor===B;
  /* Entree en fondu des pieces. La classe est retiree apres l'animation pour
     ne pas la rejouer a chaque rendu de l'echiquier en cours de partie. */
  if(boardEl){
    boardEl.classList.remove("dealt");
    void boardEl.offsetWidth;            /* force le redemarrage de l'animation */
    boardEl.classList.add("dealt");
    setTimeout(function(){boardEl.classList.remove("dealt");},900);
  }
  if(pendingNoClock){
    clock={enabled:false,w:0,b:0,inc:0,active:null,last:0,flagged:null};
    clockHist=[{w:0,b:0}];
    renderClocks();
  } else clockSetup();
  const {cat,item}=pendingNoClock?{cat:"none",item:null}:tcCurrent();
  pendingNoClock=false;
  const s=$("status");s.className="status";
  const tcTxt=cat==="none"?t("No clock"):tcLabel(cat,item)+" "+t(cat.charAt(0).toUpperCase()+cat.slice(1));
  s.textContent=myColor===W?t("New game, {tc}. You start.",{tc:tcTxt}):t("New game, {tc}. The computer opens.",{tc:tcTxt});
  mainGame=null;
  refreshGame();
  if(typeof focusBoard==="function")focusBoard();
  /* Overlay de preparation, uniquement sur les parties chronometrees : sans
     pendule rien ne presse, donc rien a proteger. skipReady est pose quand on
     relance depuis le bandeau de fin, ou le choix vient d'etre fait. */
  const chrono=cat!=="none"&&cat!=="daily";
  if(chrono&&!skipReady&&typeof showReady==="function"){
    awaitingStart=true;
    /* On memorise le message d'origine ("Nouvelle partie, 10+0 Rapide...")
       pour le restituer au demarrage : il porte la cadence, que l'overlay
       remplace temporairement par son invite. */
    readyStatus=s.textContent;
    showReady(tcTxt);
    return;                      /* l'ordinateur attend, lui aussi */
  }
  awaitingStart=false;
  skipReady=false;
  if(myColor===B){busy=true;$("status").textContent=t("The computer is thinking…");setTimeout(botMove,220);}
}
let resignTimer=null;
function disarmResign(){
  const b=$("btnResign"); if(!b)return;
  b.classList.remove("armed");b.textContent=t("Resign");
  if(resignTimer){clearTimeout(resignTimer);resignTimer=null;}
}
function resignGame(){
  if(resigned!==null||!legalCache.length)return;
  const b=$("btnResign");
  if(!b.classList.contains("armed")){
    b.classList.add("armed");b.textContent=t("Confirm resignation");
    resignTimer=setTimeout(disarmResign,5000);
    return;
  }
  disarmResign();
  resigned=myColor;
  clockStop();
  const s=$("status");s.className="status lose";
  s.textContent=t("You resigned. The computer wins.");
  resultInfo={kind:"lose",title:t("You resign"),sub:s.textContent};
  resultDismissed=false;
  selected=-1;marks={};
  refreshGame();
}
function hintGame(){
  if(busy)return;
  if(!prog.usedHint){prog.usedHint=true;saveProg();}
  if(typeof gameFinished==="function"&&!gameFinished()&&!isReviewGame)return;
  busy=true;$("btnHint").disabled=true;
  $("status").className="status";$("status").textContent=t("Analysing…");
  setTimeout(()=>{
    const r=search(game,3,900);
    busy=false;
    if(!r.move){refreshGame();return;}
    const san=game.san(r.move);
    marks={};marks[r.move.from]="hint";marks[r.move.to]="hint";
    let why;
    if(san.includes("#"))why=t("it is mate.");
    else if(r.move.captured)why=t("it wins material.");
    else if(san.includes("+"))why=t("it checks and keeps the initiative.");
    else if(r.move.flags&96)why=t("it tucks your king away.");
    else why=t("it is the soundest move here.");
    const s=$("status");s.className="status";
    s.textContent=t("Try {san}: {why}",{san:san,why:why});
    render();refreshGame();
  },60);
}
function undoGame(){
  if(busy||game.history.length<2||isFlagged())return;
  game.undoMove();game.undoMove();
  sanList.splice(-2);
  if(clock.enabled){
    /* clockHist enregistre l'etat APRES chaque coup, et la partie commence
       avec une seule entree. Retirer les deux dernieres ramenait donc au
       temps de depart des la premiere annulation : la pendule remontait,
       offrant du temps gratuit a chaque clic sur Reprendre.
       On ne restitue donc pas le temps consomme : annuler un coup rend la
       position, pas les secondes deja ecoulees. Seul l'increment eventuel
       ajoute par les deux coups annules est repris. */
    clockHist.splice(-2);
    clockDrain();                      /* decompter le temps ecoule d'abord */
    if(clock.inc){
      if(game.turn===W)clock.w=Math.max(0,clock.w-clock.inc);
      else clock.b=Math.max(0,clock.b-clock.inc);
      const autre=game.turn^1;
      if(autre===W)clock.w=Math.max(0,clock.w-clock.inc);
      else clock.b=Math.max(0,clock.b-clock.inc);
    }
    clock.active=game.turn;clock.last=Date.now();
    clockHist.push({w:clock.w,b:clock.b});
  }
  lastMove=game.history.length?game.history[game.history.length-1].m:null;
  selected=-1;marks={};
  resultInfo=null;resultDismissed=false;resigned=null;disarmResign();
  const s=$("status");s.className="status";s.textContent=t("Move taken back. Your turn.");
  refreshGame();
}

/* ==========================================================
   PUZZLES
   ========================================================== */
function themeOK(p){return !prog.theme||p.theme===prog.theme;}
function allLoadedPuzzles(){
  const out=[];
  for(const lvl in LEVEL_CACHE)out.push(...LEVEL_CACHE[lvl]);
  return out;
}
function levelPool(lvl){
  const bank=LEVEL_CACHE[lvl]||[];
  let pool=bank.filter(themeOK);
  /* theme rare, aucun exercice a ce niveau precis : on retombe sur les
     niveaux deja charges en cache (pas de nouvelle requete pour un cas
     limite) plutot que de laisser la liste vide. */
  if(!pool.length&&prog.theme)pool=allLoadedPuzzles().filter(themeOK);
  return pool.length?pool:bank;
}
function renderThemeFilter(){
  const sel=$("themeFilter"); if(!sel)return;
  $("themeTitle").textContent=t("Theme");
  if(!THEME_COUNTS){loadThemeCounts(renderThemeFilter);return;}
  const counts=THEME_COUNTS;
  const themes=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
  sel.innerHTML='<option value="">'+t("All themes")+" ("+TOTAL_PUZZLES+")</option>"+
    themes.map(th=>'<option value="'+th.replace(/"/g,"&quot;")+'">'+t(th)+" ("+counts[th]+")</option>").join("");
  sel.value=prog.theme||"";
}
/* A l'interieur d'un meme niveau, les exercices ne sortaient pas dans un
   ordre particulier : deux prises faciles pouvaient suivre un mat en deux
   difficile, ou l'inverse. Un tri strict par difficulte (champ "diff") a
   corrige ca, mais au prix d'un defaut signale : en partant de zero, la
   sequence etait entierement figee, toujours le meme premier exercice
   (#WVFK3), toujours le meme deuxieme (#HX2YE), etc., identique a chaque
   nouvelle session puisque le tri est deterministe. On decoupe desormais
   le niveau en tranches de difficulte croissante (la progression generale
   reste la meme), mais on merange l'ordre a l'interieur de chaque tranche :
   la sequence varie donc d'une session a l'autre, sans jamais faire suivre
   un exercice difficile juste apres un evident. */
function nextPuzzle(){
  /* Niveau pas encore en cache : on le charge puis on se rappelle soi-meme,
     meme mecanique que loadOpeningBook/openingMap. Le statut affiche un
     message le temps du chargement, plutot qu'un bouton qui semble ne rien
     faire -- seul le tout premier acces a un niveau donne dans la session
     est concerne, les suivants sont instantanes (cache memoire). */
  if(!LEVEL_CACHE[prog.level]){
    const s=$("status"); if(s){s.className="status";s.textContent=t("Loading puzzles…");}
    loadLevel(prog.level,nextPuzzle);
    return;
  }
  /* "Exercice suivant" sans jamais resoudre n'ajoutait rien a prog.seen
     (seul finishPuzzle() le faisait, au moment de resoudre) : cliquer
     plusieurs fois de suite sans repondre pouvait donc rester coince dans
     la meme tranche de difficulte indefiniment, puisque rien ne progressait
     jamais au-dela d'elle. On marque ici l'exercice qu'on quitte, resolu ou
     non : avoir ete vu suffit, peu importe l'issue. */
  if(puzzle&&!prog.seen.includes(puzzle.id)){prog.seen.push(puzzle.id);if(prog.seen.length>200)prog.seen.shift();}
  const sorted=levelPool(prog.level).slice().sort((a,b)=>(a.diff||0)-(b.diff||0));
  const TRANCHES=5;
  const taille=Math.max(1,Math.ceil(sorted.length/TRANCHES));
  const pool=[];
  for(let i=0;i<sorted.length;i+=taille){
    const tranche=sorted.slice(i,i+taille);
    for(let j=tranche.length-1;j>0;j--){
      const k=Math.floor(Math.random()*(j+1));
      [tranche[j],tranche[k]]=[tranche[k],tranche[j]];
    }
    pool.push(...tranche);
  }
  const fresh=pool.filter(p=>!prog.seen.includes(p.id));
  if(fresh.length){puzzle=fresh[0];}
  else{const list=pool;puzzle=list[Math.floor(Math.random()*list.length)];}
  puzzle.daily=false;puzzle.dailyCatchupKey=null;
  loadPuzzle();
}
/* Exercice du jour : meme rotation globale qu'avant (index du jour modulo
   la taille de la banque), mais resolue via l'index leger id->niveau
   plutot qu'en indexant un tableau complet embarque -- l'ordre des cles de
   PUZZLE_INDEX correspond a l'ordre d'origine de puzzles.json (chaine non
   numerique, ordre d'insertion garanti par la specification JS), donc la
   formule et le resultat pour un jour donne restent identiques a avant. */
function dailyPuzzle(){
  if(!PUZZLE_INDEX){
    const s=$("status"); if(s){s.className="status";s.textContent=t("Loading puzzles…");}
    loadPuzzleIndex(dailyPuzzle);
    return;
  }
  const d=new Date();
  const n=Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000);
  const ids=Object.keys(PUZZLE_INDEX);
  const id=ids[n%ids.length];
  const lvl=PUZZLE_INDEX[id];
  if(!LEVEL_CACHE[lvl]){loadLevel(lvl,dailyPuzzle);return;}
  puzzle=PUZZLE_CACHE[id];
  puzzle.daily=true;puzzle.dailyCatchupKey=null; /* le vrai puzzle du jour, pas un rattrapage */
  loadPuzzle();
}
function loadPuzzle(){
  solCache={};
  puzzleStartTs=Date.now();
  game=new Game(puzzle.fen);
  flipped=game.turn===B;
  selected=-1;marks={};lastMove=null;busy=false;
  puzzleN=puzzle.type==="mate"?puzzle.n:0;
  /* Progression dans puzzle.sol pour les gains a plusieurs coups (ex.
     Deviation : mon coup, reponse forcee de l'adversaire, mon coup final).
     Jusqu'ici, tout puzzle "gain" (type!=="mate") terminait des le premier
     coup correct, quelle que soit la longueur reelle de sol -- juste apres
     avoir introduit des gains a plusieurs coups (voir tryPuzzleMove). */
  puzzleSolPly=0;
  puzzleTries=0;puzzleDone=false;
  /* Repart a zero a chaque exercice : sans ca, le delta du PRECEDENT
     exercice resterait affiche par erreur si jamais quelque chose lisait
     lastRatingDelta avant que le nouveau ne soit calcule (ex: un exercice
     abandonne sans etre juge, rechargement de page). */
  lastRatingDelta=null;
  /* Le bouton d'aide repart sur "Indice" a chaque exercice. */
  hintShown=false;
  if(typeof syncHintBtn==="function")syncHintBtn();
  /* Duel du jour : masque a chaque nouvel exercice, y compris pendant un
     Chang Sprint (rushNext() appelle aussi loadPuzzle()) -- revele
     uniquement apres une reussite sur le puzzle du jour precis, voir
     finishPuzzle(). */
  { const dcb=$("dailyChallengeBlock"),dcp=$("dailyChallengePanel");
    if(dcb)dcb.classList.add("hide");
    if(dcp)dcp.classList.add("hide");
  }
  legalCache=game.moves();
  const side=game.turn===W?"White":"Black";
  $("exTheme").textContent=(puzzle.daily?t("Puzzle of the day · "):"")+t(puzzle.theme);
  const ec=$("exCode");
  if(ec){
    ec.textContent=puzzle.code?"#"+puzzle.code:"";
    /* aria-label sur l'element l'emporte sur son texte pour un lecteur
       d'ecran : sans repeter le code dedans, il annoncerait l'explication
       mais jamais le code lui-meme, inutilisable pour le signaler a l'oral
       comme a l'ecrit. */
    ec.setAttribute("aria-label",puzzle.code?t("Exercise ID: {code} · useful when reporting an issue",{code:puzzle.code}):"");
  }
  /* Force estimee de l'exercice vs la tienne (integration ELO, point 3) :
     LEVEL_RATING[level-1] est la meme table que celle utilisee par
     updateRating() pour juger la partie -- afficher exactement ce a quoi
     l'exercice est compare, pas un chiffre invente separement qui
     risquerait de diverger. Bulle d'info plutot que texte permanent
     (signale : "~1150 rated · you: 930" retombait a la ligne sur mobile
     et poussait le bouton "Exercice suivant" plus bas, hors d'atteinte
     sans defiler) -- meme mecanisme delegue que les autres bulles du site
     (.info-tip/.info-tip-pop, voir ui3.js), zero JS supplementaire a
     brancher. Fermee explicitement a chaque nouvel exercice : sinon une
     bulle laissee ouverte sur le precedent resterait affichee, avec un
     contenu qui n'a pas encore ete mis a jour au moment du re-rendu. */
  const ts=$("tipStrength");
  if(ts&&typeof LEVEL_RATING!=="undefined"){
    ensureProgFields();
    const pr=LEVEL_RATING[(puzzle.level||1)-1];
    ts.textContent=t("This exercise is rated about {pr}. You: {yr}.",{pr:pr,yr:prog.rating});
  }
  if(typeof closeAllInfoTips==="function")closeAllInfoTips();
  $("exQuest").textContent=puzzle.type==="mate"
    ? t(side+" to play and mate in {n} "+(puzzle.n>1?"moves.":"move."),{n:puzzle.n})
    : t(side+" to play and win material.");
  const st=$("exStatus");st.className="status";
  st.textContent=t("Your move. {hint}",{hint:t(THEME_HINTS[puzzle.theme]||THEME_HINTS["Winning move"])});
  const ex=$("exExplain");if(ex)ex.textContent="";
  reviewIdx=-1;
  const rn=$("reviewNav");if(rn)rn.classList.add("hide");
  document.body.classList.remove("reviewing-rush");
  render();updateEval();renderProgress();
  if(typeof focusBoard==="function")focusBoard();
}
function currentSolutions(){
  /* Aucun exercice charge : appuyer sur "Solution" ou "Indice" avant que la
     banque ne soit prete levait une TypeError qui remontait jusqu'a la
     console et laissait l'interface dans un etat incoherent. */
  if(!puzzle)return [];
  /* Gain a plusieurs coups (Deviation...) : ne verifie que le coup attendu
     a CETTE etape precise (puzzle.sol[puzzleSolPly]), pas n'importe quelle
     entree du tableau -- correct par construction plutot que par coincidence
     (un coup adverse de la sequence n'est de toute facon jamais legal a mon
     tour, mais autant etre precis que de compter dessus). */
  if(puzzle.type!=="mate")return game.moves().filter(m=>game.uci(m)===puzzle.sol[puzzleSolPly]);
  const key=game.fen()+"|"+puzzleN;
  if(!solCache[key])solCache[key]=matingMoves(game,puzzleN);
  return solCache[key];
}
function handlePuzzleClick(sq){
  if(puzzleDone)return;
  const p=game.board[sq];
  if(selected>=0){
    const r=pickMove(selected,sq);
    if(r){
      marks={};
      if(r.promo){askPromo(r.promo,m=>tryPuzzleMove(m));selected=-1;render();return;}
      tryPuzzleMove(r.move);return;
    }
  }
  if(p&&pC(p)===game.turn){selected=sq;marks={};} else selected=-1;
  render();
}
function tryPuzzleMove(m){
  const uci=game.uci(m);
  const ok=currentSolutions().some(x=>game.uci(x)===uci);
  selected=-1;
  if(!ok){
    puzzleTries++;
    marks={};marks[m.to]="bad";render();
    boardEl.classList.add("shake");
    setTimeout(()=>boardEl.classList.remove("shake"),340);
    const st=$("exStatus");st.className="status lose";
    st.textContent=puzzleTries===1
      ? t("Not quite. Look at the enemy king and its escape squares.")
      : t("Still not it. A hint or the solution can help.");
    registerWrong();
    if(typeof onPuzzleWrong==="function")onPuzzleWrong();
    setTimeout(()=>{marks={};render();},700);
    return;
  }
  const san=game.san(m);
  game.makeMove(m);lastMove=m;marks={};marks[m.to]="good";
  legalCache=game.moves();
  render();updateEval();
  if(!legalCache.length&&game.inCheck()){finishPuzzle(true,t("{san}: checkmate.",{san:san}));return;}
  puzzleSolPly++;
  /* Gain a plusieurs coups : la sequence continue tant qu'il reste des
     coups dans puzzle.sol (ma reponse suivante, apres la replique forcee
     de l'adversaire). Avant ce correctif, TOUT gain (type!=="mate")
     terminait ici des le premier coup, quelle que soit sa longueur reelle
     -- invisible tant que mine_puzzles.js ne produisait que des gains a un
     seul coup, redevenu faux depuis la Deviation (coup + reponse forcee +
     coup final, sol.length===3). */
  if(puzzle.type!=="mate"&&puzzleSolPly>=puzzle.sol.length){finishPuzzle(true,t("{san}: material won. Nicely spotted.",{san:san}));return;}
  if(puzzle.type!=="mate"){
    /* La replique adverse est CONNUE d'avance (puzzle.sol), pas a chercher :
       contrairement au mat (matingMoves() doit explorer, l'adversaire ayant
       plusieurs defenses possibles a refuter une a une), un gain valide a
       ete extrait avec une suite precise -- la rejouer telle quelle est a
       la fois plus fiable et plus rapide qu'un appel a search(). */
    const st=$("exStatus");st.className="status";
    st.textContent=t("{san}. The defence replies…",{san:san});
    busy=true;
    setTimeout(()=>{
      const oppUci=puzzle.sol[puzzleSolPly];
      const oppMv=game.moves().find(x=>game.uci(x)===oppUci);
      if(!oppMv){busy=false;finishPuzzle(true,t("{san}: material won. Nicely spotted.",{san:san}));return;}
      game.makeMove(oppMv);lastMove=oppMv;busy=false;
      puzzleSolPly++;
      legalCache=game.moves();marks={};
      render();updateEval();
      const s2=$("exStatus");s2.className="status";
      s2.textContent=t("Correct. Your move.");
    },420);
    return;
  }
  puzzleN--;
  const st=$("exStatus");st.className="status";
  st.textContent=t("{san}. The defence replies…",{san:san});
  busy=true;
  setTimeout(()=>{
    const rep=search(game,3,600).move||game.moves()[0];
    game.makeMove(rep);lastMove=rep;busy=false;
    legalCache=game.moves();marks={};
    render();updateEval();
    const s2=$("exStatus");s2.className="status";
    s2.textContent=t("Correct. Now mate in {n} "+(puzzleN>1?"moves.":"move."),{n:puzzleN});
  },420);
}
/* Assemble un groupe nominal complet (article + piece + case), au lieu de
   laisser le gabarit de traduction coller un article fixe devant un nom de
   piece variable : en francais, "dame" et "tour" sont feminines, les
   quatre autres pieces masculines. Un article fige dans le gabarit serait
   donc faux une fois sur deux ("Le dame", "Le tour"). */
function nounPhrase(ch,sq,cap){
  const pw=typeof pieceWord==="function"?pieceWord:x=>x;
  let s;
  if(LANG==="fr"){
    const fem=ch&&"qr".includes(ch.toLowerCase());
    s=(fem?"la ":"le ")+pw(ch)+" en "+sq;
  }else{
    s="the "+pw(ch)+" on "+sq;
  }
  return cap?s.charAt(0).toUpperCase()+s.slice(1):s;
}
/* Construit la phrase d'explication a partir de puzzle.explain (cases et
   pieces precises retenues par classify() dans gen_puzzles.js), plutot
   qu'un texte generique par theme qui dirait la meme chose pour les 1000
   exercices. Un theme sans detail exploitable (mat en un, coup gagnant sans
   motif nomme...) n'affiche rien : mieux vaut se taire que de remplir avec
   une phrase creuse. */
function explainSentence(p){
  const ex=p.explain||{};
  switch(p.theme){
    case "Winning capture":
      return ex.piece?t("Nothing defends {piece}.",{piece:nounPhrase(ex.piece,ex.sq,false)}):"";
    case "Knight fork":
    case "Pawn fork":
    case "Double attack": {
      if(!ex.targets||ex.targets.length<2)return "";
      const [a,b]=ex.targets;
      return t("The piece on {from} attacks both {p1} and {p2} at once.",
        {from:ex.from,p1:nounPhrase(a.piece,a.sq,false),p2:nounPhrase(b.piece,b.sq,false)});
    }
    case "Pin":
    case "Skewer":
      if(ex.captured&&ex.pinned){
        /* Accord de genre : {pinned} peut etre n'importe quelle piece (dame,
           tour = feminin ; les quatre autres = masculin), donc un seul
           gabarit traduit avec "defendu"/"cloue" fixes serait faux une fois
           sur deux ("la dame... defendu"). Compose directement plutot que
           de passer par un seul t() a un seul genre. */
        const fem=ex.pinned.piece&&"qr".includes(ex.pinned.piece.toLowerCase());
        if(LANG==="fr"){
          return nounPhrase(ex.captured.piece,ex.captured.sq,true)+" n'était défendu"+(fem?"e":"")+" que par "+
            nounPhrase(ex.pinned.piece,ex.pinned.sq,false)+", qui est cloué"+(fem?"e":"")+" et ne peut pas reprendre.";
        }
        return t("{captured} was only defended by {pinned}, which is pinned and can't recapture.",
          {captured:nounPhrase(ex.captured.piece,ex.captured.sq,true),pinned:nounPhrase(ex.pinned.piece,ex.pinned.sq,false)});
      }
      return (ex.pinned&&ex.behind)?t("{pinned} can't move without exposing {behind}.",
        {pinned:nounPhrase(ex.pinned.piece,ex.pinned.sq,true),behind:nounPhrase(ex.behind.piece,ex.behind.sq,false)}):"";
    case "Back-rank mate":
      return ex.king?t("The king on {sq} had no square to escape to.",{sq:ex.king}):"";
    case "Deflection":
      if(!ex.deflected)return "";
      if(LANG==="fr"){
        const fem=ex.deflected.piece&&"qr".includes(ex.deflected.piece.toLowerCase());
        return nounPhrase(ex.deflected.piece,ex.deflected.sq,true)+" était l'unique défenseur"+
          ". Forcé"+(fem?"e":"")+" de s'écarter, "+(fem?"elle":"il")+" ne peut plus aider.";
      }
      return t("{deflected} was the only defender. Forced away, it can no longer help.",
        {deflected:nounPhrase(ex.deflected.piece,ex.deflected.sq,true)});
    case "Smothered mate":
      return ex.king?t("The king on {sq} was boxed in by its own pieces.",{sq:ex.king}):"";
    default:
      return "";
  }
}
/* Pedagogie coup juste / coup faute (exercices mines depuis de vraies
   parties via mine_puzzles.js -- absent sur les exercices generes par
   auto-jeu, qui n'ont pas ce champ). p.pedagogy vient d'un calcul reel
   (bestDistractorExplanation) : le coup tentant candidateSan et la
   refutation refutationSan sont une ligne effectivement calculee par le
   moteur, pas une phrase generique -- si le coup tentant s'effondre plus
   loin que ce qu'un simple regard suffit a voir (trapDepth>0), le rappelle
   pour souligner que ce n'etait pas une erreur idiote. */
function pedagogySentence(p){
  const pg=p.pedagogy;
  if(!pg||!pg.candidateSan||!pg.refutationSan)return"";
  return pg.trapDepth>0
    ? t("{candidate} looks tempting, but only {refutation} actually refutes it. Worth calculating a move further next time.",{candidate:pg.candidateSan,refutation:pg.refutationSan})
    : t("Careful with {candidate}: {refutation} punishes it.",{candidate:pg.candidateSan,refutation:pg.refutationSan});
}
function finishPuzzle(won,msg){
  puzzleDone=true;
  if(typeof onPuzzleResult==="function"&&onPuzzleResult(won,msg))return;
  const st=$("exStatus");
  st.className="status "+(won?"win":"lose");
  /* Delta de notation affiche a cote du verdict (integration ELO, point 1) :
     lastRatingDelta vient d'etre pose par updateRating(), appele DANS
     onPuzzleResult() juste au-dessus -- toujours a jour a ce point precis
     du code, jamais un residu de l'exercice precedent (remis a null au
     chargement de chaque nouvel exercice, voir loadPuzzle()). Absent
     (null) pendant un Chang Sprint : onPuzzleResult() retourne avant
     d'appeler updateRating() dans ce cas, la notation ne bouge pas pendant
     un sprint -- donc rien a afficher, comportement correct par defaut
     sans code special ici. */
  st.textContent=msg+(typeof lastRatingDelta==="number"?" "+t("({delta} rating)",{delta:(lastRatingDelta>=0?"+":"\u2212")+Math.abs(lastRatingDelta)}):"");
  const ex=$("exExplain");if(ex)ex.textContent=won?explainSentence(puzzle):"";
  const pg=$("exPedagogy");if(pg)pg.textContent=won?pedagogySentence(puzzle):"";
  if(won&&puzzleTries===0)registerSolved();
  else if(won)registerPartial();
  if(!prog.seen.includes(puzzle.id)){prog.seen.push(puzzle.id);if(prog.seen.length>200)prog.seen.shift();}
  if(won){
    if(typeof ensureProgFields==="function")ensureProgFields();
    /* Calendrier de completion : une seule entree par jour, peu importe le
       nombre de tentatives -- reussi une fois dans la journee suffit. Pas de
       distinction "jamais tente" vs "rate" : les cases non marquees couvrent
       les deux, plus simple a lire d'un coup d'oeil. */
    if(puzzle.daily&&typeof todayKey==="function"){
      if(puzzle.dailyCatchupKey){
        /* Rattrapage d'un jour PASSE et manque (item 1) : on coche le jour
           CLIQUE dans le calendrier, pas aujourd'hui -- et on s'arrete la.
           Pas de bumpStreak() : rattraper un trou ancien ne fait pas
           reapparaitre une continuite qui, ce jour-la, avait ete rompue.
           Pas de "Defier un ami" : ce bouton affirme "j'ai resolu
           l'exercice DU JOUR", faux dans ce cas -- il reste reserve au vrai
           puzzle du jour, juste en dessous. */
        prog.dailyLog[puzzle.dailyCatchupKey]=true;
      } else {
        prog.dailyLog[todayKey()]=true;
        const dcb=$("dailyChallengeBlock");if(dcb)dcb.classList.remove("hide");
        /* Serie de jours : migree ici depuis onPuzzleResult() (ui2.js) le
           2026-09-03, ou elle comptait N'IMPORTE QUEL exercice reussi. Avec
           "Puzzle du jour" devenu sa propre categorie du menu (a cote de
           Puzzles/Sprint/Coordonnees/Finales), la serie doit correspondre a
           ce que montre son calendrier -- donc strict desormais : seul LE
           puzzle du jour precis, reussi, la fait avancer. Les series deja
           accumulees par les utilisateurs ne sont pas remises a zero, seul
           le calcul futur change. */
        if(typeof bumpStreak==="function")bumpStreak();
      }
    }
    /* Badges thematiques : compte tout exercice reussi (premier essai ou
       apres une tentative ratee, meme logique que prog.solved deja compte
       dans registerSolved()/registerPartial()), sur le theme reel de
       l'exercice tel que renvoye par classify(). checkBadges() est deja
       appele par registerSolved() plus haut, mais AVANT cette
       incrementation -- on le rappelle ici pour que le badge se debloque
       des l'exercice qui l'atteint, pas au suivant. Inoffensif de
       l'appeler deux fois (boucle sur BADGES, ids deja acquis ignores). */
    prog.themeSolved[puzzle.theme]=(prog.themeSolved[puzzle.theme]||0)+1;
    /* Recap hebdo : un timestamp par reussite, plafonne comme
       prog.ratingHistory. Pousse ici plutot que dans registerSolved()/
       registerPartial() pour rester au meme endroit que dailyLog et
       themeSolved ci-dessus -- un seul point d'entree "won" pour tout ce
       qui journalise une reussite. */
    prog.solveLog.push(Date.now());
    if(prog.solveLog.length>500)prog.solveLog.shift();
    /* Record "meilleur jour" : compteur du jour courant, remis a zero au
       changement de date (meme mecanique que prog.lastDay/bumpStreak()) --
       compte toute reussite, meme logique que prog.solved/solveLog
       ci-dessus (premier essai ou apres une tentative ratee). */
    { const dk=todayKey();
      if(prog.dayCountDate!==dk){prog.dayCountDate=dk;prog.dayCount=0;}
      prog.dayCount++;
      if(prog.dayCount>prog.bestDay)prog.bestDay=prog.dayCount;
    }
    /* Record "Fastest solve" : uniquement les reussites du PREMIER coup
       (puzzleTries===0), coherent avec le "Streak" existant qui a la meme
       exigence -- un temps qui inclut des tentatives ratees ne mesure pas
       la meme chose. Plancher de 300ms : filet de securite contre un
       artefact improbable (ex: rechargement d'etat) plutot qu'un vrai
       record, pas une hypothese sur la rapidite humaine reelle. */
    if(puzzleTries===0){
      const elapsed=Date.now()-puzzleStartTs;
      if(elapsed>=300&&(typeof prog.fastestSolveMs!=="number"||elapsed<prog.fastestSolveMs))
        prog.fastestSolveMs=elapsed;
    }
    if(typeof checkBadges==="function")checkBadges();
    /* Repetition espacee : une reussite fait avancer d'un palier plutot que
       de retirer l'entree tout de suite (sauf a la 5e reussite, ou c'est
       la "maitrise" -- voir SRS_DELAYS_DAYS, ui2.js, pour le detail du
       barème). Rejoue via retryMistake() (ui2.js) -- le seul chemin normal
       vers ces ids, puisque prog.seen les exclut deja du tirage classique. */
    if(prog.mistakeQueue.length){
      const mi=prog.mistakeQueue.findIndex(m=>m.id===puzzle.id);
      if(mi!==-1){
        const m=prog.mistakeQueue[mi];
        if(m.box>=5)prog.mistakeQueue.splice(mi,1);
        else{
          const delayDays=(typeof SRS_DELAYS_DAYS!=="undefined"&&SRS_DELAYS_DAYS[m.box-1])||1;
          m.box++;m.due=Date.now()+delayDays*86400000;
        }
      }
    }
  }
  saveProg();renderProgress();
}
function registerSolved(){
  prog.solved++;prog.streak++;prog.correctRun++;prog.wrongRun=0;
  if(prog.streak>prog.best)prog.best=prog.streak;
  if(typeof checkBadges==="function")checkBadges();
  if(prog.correctRun>=3&&prog.level<LEVELS.length){
    prog.level++;prog.correctRun=0;
    setTimeout(()=>{
      const st=$("exStatus");st.className="status win";
      st.textContent=t("Three in a row. Moving up to level {n}: {name}.",{n:prog.level,name:t(LEVELS[prog.level-1].name)});
    },900);
  }
}
function registerPartial(){prog.solved++;prog.correctRun=0;prog.streak=0;}
function registerWrong(){
  prog.streak=0;prog.correctRun=0;prog.wrongRun++;
  if(prog.wrongRun>=4&&prog.level>1){prog.level--;prog.wrongRun=0;}
  /* File de revision persistante, avec repetition espacee (paliers de type
     Leitner) depuis cette session -- voir SRS_DELAYS_DAYS (ui2.js) pour le
     detail des delais. Ici : un echec, qu'il s'agisse d'un premier rate ou
     d'une revision qui echoue, ramene TOUJOURS au palier 1 (due
     immediatement) -- pas de penalite progressive, plus simple a
     comprendre qu'un algorithme qui punirait plus fort a chaque echec.
     Tous modes confondus, y compris Chang Sprint -- ses erreurs deviennent
     ainsi revisables plus tard aussi, pas seulement dans le bilan de fin
     de sprint (lastRushHistory, qui reste par ailleurs inchange). */
  if(typeof ensureProgFields==="function")ensureProgFields();
  if(puzzle){
    const existing=prog.mistakeQueue.find(m=>m.id===puzzle.id);
    if(existing){existing.box=1;existing.due=Date.now();existing.ts=Date.now();}
    else{
      prog.mistakeQueue.push({id:puzzle.id,theme:puzzle.theme,code:puzzle.code||"",ts:Date.now(),box:1,due:Date.now()});
      if(prog.mistakeQueue.length>200)prog.mistakeQueue.shift();
    }
  }
  saveProg();renderProgress();
}
function renderProgress(){
  $("stSolved").textContent=prog.solved;
  $("stStreak").textContent=prog.streak;
  $("stBest").textContent=prog.best;
  $("lvlNum").textContent=prog.level;
  $("lvlName").textContent=t(LEVELS[prog.level-1].name);
  /* "of" ne fait que deux lettres : le collecteur de traductions exige au
     moins trois caracteres alphabetiques et l'ignorait, d'ou un "Niveau 1 of
     5" en francais. On le pose donc a la main. */
  { const o=$("lvlOf"); if(o)o.textContent=t("of"); }
  { const m=$("lvlMax"); if(m)m.textContent=LEVELS.length; }
  let h="";
  for(let i=1;i<=LEVELS.length;i++)h+='<i class="'+(i<=prog.level?"on":"")+'"></i>';
  $("ladder").innerHTML=h;
  renderThemeFilter();
  $("hLevel").textContent=prog.level;
  $("hSolved").textContent=prog.solved;
  $("hBest").textContent=prog.best;
  /* renderExtraStats decide d'afficher la bande ou l'invitation : il faut
     la rappeler ici, sinon l'invitation resterait affichee apres le premier
     exercice resolu. Declaree dans ui2.js, concatene apres. */
  if(typeof renderExtraStats==="function")renderExtraStats();
}
function syncHintBtn(){
  const b=$("btnHintEx"); if(!b)return;
  b.textContent=hintShown?t("Show solution"):t("Hint");
}
function hintPuzzle(){
  if(puzzleDone)return;
  /* second clic : on donne la reponse complete */
  if(hintShown){solvePuzzle();return;}
  const mv=currentSolutions()[0]; if(!mv)return;
  marks={};marks[mv.from]="hint";render();
  const st=$("exStatus");st.className="status";
  st.textContent=t("The piece to move is highlighted.");
  if(puzzleTries===0)puzzleTries=1;
  hintShown=true;
  syncHintBtn();
}
function solvePuzzle(){
  if(puzzleDone)return;
  const mv=currentSolutions()[0]; if(!mv)return;
  const san=game.san(mv);
  marks={};marks[mv.from]="hint";marks[mv.to]="hint";render();
  puzzleTries=Math.max(puzzleTries,1);
  const st=$("exStatus");st.className="status";
  st.textContent=t("The answer is {san}. Play it to continue.",{san:san});
}

/* --- transfer code --- */
function b64u(s){return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function unb64u(s){let b=s.replace(/-/g,"+").replace(/_/g,"/");while(b.length%4)b+="=";return atob(b);}
function crc(s){let n=0;for(let i=0;i<s.length;i++)n=(n*31+s.charCodeAt(i))%1296;return n.toString(36).padStart(2,"0");}
function makeCode(){
  const seen=(prog.seen||[]).slice(-40).map(x=>parseInt(String(x).replace(/\D/g,""),10))
    .filter(x=>!isNaN(x)).map(x=>x.toString(36));
  const payload=[prog.level,prog.solved,prog.best,prog.streak,prog.correctRun,prog.wrongRun].join(".")+"|"+seen.join(".");
  const body=b64u(payload);
  return "CH64-"+body+"-"+crc(body);
}
function readCode(txt){
  const clean=(txt||"").trim().replace(/\s+/g,"");
  const m=clean.match(/^CH64-([A-Za-z0-9\-_]+)-([a-z0-9]{2})$/);
  if(!m||crc(m[1])!==m[2])return null;
  let raw;try{raw=unb64u(m[1]);}catch(e){return null;}
  const parts=raw.split("|");
  const nums=parts[0].split(".").map(Number);
  if(nums.length<6||nums.some(isNaN))return null;
  const seen=(parts[1]||"").split(".").filter(Boolean).map(x=>"p"+parseInt(x,36)).filter(x=>x!=="pNaN");
  return {level:Math.min(5,Math.max(1,nums[0]|0)),solved:Math.max(0,nums[1]|0),best:Math.max(0,nums[2]|0),
    streak:Math.max(0,nums[3]|0),correctRun:Math.max(0,nums[4]|0),wrongRun:Math.max(0,nums[5]|0),seen:seen};
}
function showCode(){
  $("codeOut").value=makeCode();
  $("codeMsg").textContent=t("Keep this code: it holds your progress and nothing else.");
}
function loadCode(){
  const p=readCode($("codeIn").value),msg=$("codeMsg");
  if(!p){msg.textContent=t("That code is not valid. Check it was copied in full.");return;}
  prog=p;saveProg();renderProgress();$("codeIn").value="";
  msg.textContent=t("Progress restored: level {lvl}, {n} puzzles solved.",{lvl:prog.level,n:prog.solved});
  nextPuzzle();
}

/* ==========================================================
   SHARING AND GAMES BY LINK
   ========================================================== */
const A64="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const PROMO_I={0:0,5:1,4:2,3:3,2:4},I_PROMO=[0,Q,R,BI,N];
const sq64=s=>rOf(s)*8+fOf(s);
function encMove(e){
  const v=((e.from64*64+e.to64)*5)+(PROMO_I[e.promo||0]||0);
  return A64[(v>>12)&63]+A64[(v>>6)&63]+A64[v&63];
}
function decMoves(code){
  const out=[];
  for(let i=0;i+3<=code.length;i+=3){
    const c=code.slice(i,i+3);
    const a=A64.indexOf(c[0]),b=A64.indexOf(c[1]),d=A64.indexOf(c[2]);
    if(a<0||b<0||d<0)return null;
    const v=(a<<12)|(b<<6)|d;
    const promo=I_PROMO[v%5],rest=(v-v%5)/5;
    out.push({from64:Math.floor(rest/64),to64:rest%64,promo});
  }
  return out;
}
function baseUrl(){return location.origin+location.pathname;}
let amiResigned=null;
function amiUrl(){return baseUrl()+"#p="+amiMoves.map(encMove).join("")+(amiResigned!==null?"&r="+(amiResigned===W?"w":"b"):"");}
function isLocalFile(){return location.protocol==="file:";}
function copyText(t){
  try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t);return;}}catch(e){}
  const ta=document.createElement("textarea");
  ta.value=t;document.body.appendChild(ta);ta.select();
  try{document.execCommand("copy");}catch(e){}
  document.body.removeChild(ta);
}
function shareButtons(container,url,text,withNative){
  container.innerHTML="";
  const mk=(label,cls,fn)=>{
    const b=document.createElement("button");
    b.className=cls;b.textContent=label;b.onclick=fn;container.appendChild(b);
  };
  if(withNative&&navigator.share){
    mk(t("Share"),"native",async()=>{try{await navigator.share({title:"chang64",text:text,url:url});}catch(e){}});
  }
  mk("WhatsApp","wa",()=>{window.open("https://wa.me/?text="+encodeURIComponent(text+" "+url),"_blank","noopener");});
  mk("Messenger","msg",()=>{
    const mobile=/android|iphone|ipad|ipod/i.test(navigator.userAgent);
    if(mobile)location.href="fb-messenger://share/?link="+encodeURIComponent(url);
    else{copyText(url);$("amiNote").textContent=t("Link copied, paste it into Messenger.");}
  });
  mk("Facebook","fb",()=>{window.open("https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(url),"_blank","noopener");});
  mk(t("Copy"),"",()=>{copyText(url);$("amiNote").textContent=t("Link copied.");});
}
function updateAmiNote(){
  const n=$("amiNote"); if(!n)return;
  n.textContent=isLocalFile()
    ? t("This file is open locally, so the link will only work for your friend once the site is online.")
    : t("Your friend opens the link, plays a move and sends theirs back.");
}

let amiMoves=[],amiColor=W,amiGame=new Game(),amiSan=[],amiPace=3;
/* Miroir de gameStarted (mode Jouer) : distingue "rien configure" de "une
   vraie partie existe" (creee ou rejointe via un lien). Sans lui, l'echiquier
   par defaut (amiGame neuf, amiColor=W) repondait deja aux clics avant meme
   d'avoir clique "Creer la partie" -- pire que le probleme equivalent en
   mode Jouer, puisque le coup joue par erreur etait reellement enregistre
   (amiMoves, sauvegarde), pas seulement ignore en silence. */
let amiStarted=false;
function rebuildAmi(){
  amiGame=new Game();amiSan=[];
  for(const m of amiMoves){
    const mv=amiGame.moves().find(x=>sq64(x.from)===m.from64&&sq64(x.to)===m.to64&&(x.promo||0)===(m.promo||0));
    if(!mv)return false;
    amiSan.push(amiGame.san(mv));
    amiGame.makeMove(mv);
  }
  return true;
}
function amiIsMyTurn(){return amiGame.turn===amiColor;}
/* Meme principe que updatePlayBoardVisibility (mode Jouer) : le plateau et
   ses a-cotes (bandeau de coups, feuille de partie, lien a envoyer) restent
   caches tant qu'aucune partie n'a ete creee ou rejointe. */
function updateAmiBoardVisibility(){
  if(mode!=="friend")return;
  const bw=document.querySelector(".board-wrap");
  if(bw)bw.classList.toggle("hide",!amiStarted);
  const bt=$("boardTools"); if(bt)bt.classList.toggle("hide",!amiStarted);
  const sp=$("amiScoresheetPanel"); if(sp)sp.classList.toggle("hide",!amiStarted);
}
function showAmi(){
  /* "flipped" n'est PAS remis a plat ici : showAmi() est appelee apres
     CHAQUE coup (voir handleAmiClick, undo, resign...), donc y remettre
     l'orientation par defaut a chaque fois effacerait tout retournement
     manuel au coup suivant. La valeur par defaut (cote du joueur) est posee
     une seule fois, a l'entree reelle dans la partie : newAmiGame() pour qui
     la cree, readHash() pour qui la rejoint via le lien. */
  game=amiGame;
  legalCache=game.moves();
  lastMove=game.history.length?game.history[game.history.length-1].m:null;
  selected=-1;marks={};
  render();updateEval();renderSheetInto("amiSheet",amiSan);
  updateAmiBoardVisibility();
  const st=$("amiStatus");
  if(!amiStarted){
    /* Rien n'a encore ete configure : l'echiquier reste cache (voir
       updateAmiBoardVisibility ci-dessus), inutile de calculer un statut de
       partie ou de tour qui n'existe pas encore. */
    if(st){st.className="status";st.textContent=t("Choose your colour, then create a game.");}
    const lp=$("amiLinkPanel"); if(lp)lp.classList.add("hide");
    /* Masques plutot que grises : "Annuler mon coup"/"Abandonner" une
       partie qui n'existe pas encore n'ont pas de sens a montrer du tout. */
    $("btnAmiUndo").classList.add("hide");
    $("btnAmiResign").classList.add("hide");
    return;
  }
  const over=!legalCache.length||game.isDraw();
  if(!over)renderResult(false);
  /* Une fois une partie reellement lancee, ces deux boutons redeviennent
     visibles pour de bon (ils ne se recachent plus ensuite, meme la partie
     terminee : voir le mode Jouer, meme logique pour "Abandonner"). */
  $("btnAmiUndo").classList.remove("hide");
  $("btnAmiResign").classList.remove("hide");
  /* "Creer la partie" et le choix de couleur se verrouillent tant qu'une
     partie est activement en cours (mais pas une fois terminee ou
     abandonnee) : meme principe que geler() en mode Jouer, pour eviter
     d'ecraser par erreur une partie en cours avec une nouvelle. */
  {
    const enCoursAmi=amiResigned===null&&!over;
    const bn=$("btnAmiNew"); if(bn)bn.disabled=enCoursAmi;
    const cg=$("segAmiColor"); if(cg)for(const b of cg.children)b.disabled=enCoursAmi;
    /* Masque entierement plutot que grise sans explication pendant qu'une
       partie est activement en cours : meme principe applique cote Jouer
       (voir refreshGame() dans ui.js) pour le panneau de reglages. */
    const anp=$("amiNewGamePanel"); if(anp)anp.classList.toggle("hide",enCoursAmi);
  }
  $("amiLinkPanel").classList.toggle("hide",amiMoves.length===0&&amiColor===W);
  $("btnAmiUndo").disabled=!(amiMoves.length&&!amiIsMyTurn())||over;
  $("amiLink").value=amiUrl();
  if(amiResigned!==null){
    const iLost=amiResigned===amiColor;
    st.className="status "+(iLost?"lose":"win");
    st.textContent=iLost?t("You resigned this game."):t("Your friend resigned. You win.");
    resultInfo={kind:iLost?"lose":"win",title:iLost?t("You resign"):t("You win"),sub:st.textContent};
    renderResult(true);
    $("btnAmiUndo").disabled=true;$("btnAmiResign").disabled=true;
    shareButtons($("amiShare"),amiUrl(),t("I resign, well played."),true);
    updateAmiNote();
    return;
  }
  $("btnAmiResign").disabled=false;
  if(over){
    if(game.isCheckmate()){
      const won=(game.turn===W?B:W)===amiColor;
      st.className="status "+(won?"win":"lose");
      st.textContent=won?t("Checkmate. You win this one."):t("Checkmate. Your friend wins.");
      resultInfo={kind:won?"win":"lose",title:won?t("You win"):t("You lose"),sub:st.textContent};
    } else {st.className="status";st.textContent=t("The game is drawn.");
      resultInfo={kind:"draw",title:t("Draw"),sub:st.textContent};}
    renderResult(true);
    return;
  }
  st.className="status";
  st.textContent=amiIsMyTurn()
    ? (game.inCheck()?t("Check. Your move."):t("Your move, then send the link."))
    : t("Move saved. Send this link to your friend.");
  shareButtons($("amiShare"),amiUrl(),t("Chess on chang64, your move ({pace}):",{pace:t(amiPace===1?"{n} day/move":"{n} days/move",{n:amiPace})}),true);
  updateAmiNote();
}
function handleAmiClick(sq){
  if(!amiStarted)return;
  if(amiResigned!==null)return;
  if(!amiIsMyTurn())return;
  if(!legalCache.length||game.isDraw())return;
  const p=game.board[sq];
  if(selected>=0){
    const r=pickMove(selected,sq);
    if(r){
      if(r.promo){askPromo(r.promo,m=>playAmi(m));selected=-1;render();return;}
      playAmi(r.move);return;
    }
  }
  if(p&&pC(p)===game.turn){selected=sq;} else selected=-1;
  render();
}
function playAmi(m){
  amiSan.push(amiGame.san(m));
  amiGame.makeMove(m);
  amiMoves.push({from64:sq64(m.from),to64:sq64(m.to),promo:m.promo||0});
  selected=-1;showAmi();saveAmi();
}
function undoAmi(){
  if(!amiMoves.length||amiIsMyTurn())return;
  amiMoves.pop();rebuildAmi();showAmi();saveAmi();
}
function newAmiGame(){
  amiStarted=true;
  amiResigned=null;amiMoves=[];flipped=amiColor===B;rebuildAmi();showAmi();saveAmi();
  if(typeof focusBoard==="function")focusBoard();
  const st=$("amiStatus");st.className="status";
  st.textContent=amiColor===W
    ? t("You start. Play your move, then send the link.")
    : t("Send this link so your friend opens with White.");
  if(amiColor===B){
    $("amiLinkPanel").classList.remove("hide");
    $("amiLink").value=amiUrl();
    shareButtons($("amiShare"),amiUrl(),t("I challenge you on chang64, you play White:"),true);
    updateAmiNote();
  }
}
async function saveAmi(){try{await window.storage.set("chang64:friend",JSON.stringify({m:amiMoves,c:amiColor,p:amiPace,r:amiResigned}));}catch(e){}}
async function loadAmi(){
  try{const r=await window.storage.get("chang64:friend");
    if(r&&r.value){const d=JSON.parse(r.value);amiMoves=d.m||[];amiColor=d.c===1?B:W;amiPace=d.p||3;amiResigned=(d.r===0||d.r===1)?d.r:null;amiStarted=true;}}catch(e){}
}
function readDeepLink(){
  const h=location.hash||"";
  let m=h.match(/[#&]train=([a-z]+)/);
  if(m)return {kind:"train",id:m[1]};
  m=h.match(/[#&]puzzle=([a-zA-Z0-9]+)/);
  if(m)return {kind:"puzzle",id:m[1]};
  m=h.match(/[#&]line=([A-Za-z0-9_+#=-]+)/);
  if(m)return {kind:"line",moves:decodeURIComponent(m[1]).split("_").filter(Boolean)};
  return null;
}
function applyDeepLink(d){
  if(!d)return false;
  if(d.kind==="train"){
    /* Corrige le 2026-09-03 : ce lien (#train=<id>) visait une finale
       precise, mais pointait vers setMode("train") -- l'onglet Defis, qui
       ne montre plus les finales depuis leur demenagement dans Exercices
       (voir ui3.js). startEndgame() tournait donc derriere un panneau qui
       n'affichait ni puces ni statut pour l'expliquer. Route maintenant
       vers l'ecran dedie du menu Resoudre. Le format du lien ne change
       pas (compatibilite avec d'anciens liens deja partages), seul son
       traitement est corrige. */
    setMode("puzzles",{screen:"endgames"});
    if(typeof startEndgame==="function"&&ENDGAMES.some(e=>e.id===d.id)){
      startEndgame(d.id);
      const st=$("egStatus");st.className="status";
      st.textContent=t("White to move. Mate within {n} moves.",{n:ENDGAMES.find(e=>e.id===d.id).budget});
    }
    return true;
  }
  if(d.kind==="puzzle"){
    setMode("puzzles",{screen:"puzzles"});
    /* Resolution asynchrone (index leger + niveau concerne) : on s'engage
       tout de suite sur ce mode plutot que d'attendre la reponse, comme
       pour les autres branches -- si l'id s'avere introuvable (lien perime),
       on retombe sur un exercice normal plutot que de laisser l'ecran vide. */
    loadPuzzleById(d.id,pz=>{
      if(!pz){nextPuzzle();return;}
      puzzle=pz;puzzle.daily=false;loadPuzzle();
    });
    return true;
  }
  if(d.kind==="line"){
    setMode("play",{fresh:true});
    const g=new Game(),san=[],uci=[];
    for(const mv of d.moves){
      const m2=g.moves().find(x=>g.san(x).replace(/[+#]/g,"")===mv.replace(/[+#]/g,""));
      if(!m2)break;
      san.push(g.san(m2));uci.push(g.uci(m2));g.makeMove(m2);
    }
    if(!san.length)return false;
    game=g;sanList=san;gameUci=uci;
    myColor=g.turn===W?W:B;flipped=myColor===B;
    lastMove=g.history.length?g.history[g.history.length-1].m:null;
    selected=-1;marks={};
    refreshGame();
    const s2=$("status");s2.className="status";
    s2.textContent=t("Opening played out. Continue the game from here.");
    if(typeof focusBoard==="function")focusBoard();
    return true;
  }
  return false;
}
function readHash(){
  const h=location.hash||"";
  const m=h.match(/[#&]p=([^&]*)/);
  if(!m)return false;
  const code=m[1];
  if(code.length%3!==0)return false;
  if(code&&!/^[A-Za-z0-9\-_]+$/.test(code))return false;
  const dec=decMoves(code);
  if(!dec)return false;
  amiMoves=dec;
  if(!rebuildAmi()){amiMoves=[];rebuildAmi();return false;}
  const rm=h.match(/[#&]r=([wb])/);
  amiResigned=rm?(rm[1]==="w"?W:B):null;
  amiColor=amiResigned!==null?(amiResigned===W?B:W):amiGame.turn;
  flipped=amiColor===B;
  amiStarted=true;
  saveAmi();
  return true;
}

/* ==========================================================
   TIME CONTROL PICKERS
   ========================================================== */
function renderTC(catsId,chipsId,allowDaily){
  const cats=$(catsId),chips=$(chipsId);
  if(!cats||!chips)return;
  const list=TC_CATS.filter(c=>allowDaily||c.id!=="daily");
  cats.innerHTML="";
  for(const c of list){
    const b=document.createElement("button");
    b.textContent=t(c.label);
    b.setAttribute("aria-pressed",c.id===tcCat);
    b.onclick=()=>{tcCat=c.id;tcIdx=0;syncTC();onTCChange();};
    cats.appendChild(b);
  }
  const cat=TC_CATS.find(c=>c.id===tcCat)||TC_CATS[2];
  chips.innerHTML="";
  cat.items.forEach((item,i)=>{
    const b=document.createElement("button");
    b.className="chip";
    b.textContent=tcLabel(cat.id,item);
    b.setAttribute("aria-pressed",i===tcIdx);
    b.onclick=()=>{tcIdx=i;syncTC();onTCChange();};
    chips.appendChild(b);
  });
}
function syncTC(){
  renderTC("tcCats","tcChips",true);
  renderTC("tcCats2","tcChips2",false);
  const n=$("tcNote"); if(n)n.textContent=TC_NOTES[tcCat]?t(TC_NOTES[tcCat]):"";
}
function onTCChange(){
  if(tcCat==="daily")return;
  if(mode==="play"){
    if(!gameStarted){renderClocks();return;}
    if(!sanList.length)newGame();
    else{const s=$("status");s.className="status";s.textContent=t("New time control applies to your next game.");}
  }
}
function renderDailyChips(){
  const el=$("dailyChips"); if(!el)return;
  el.innerHTML="";
  for(const d of [1,3,7]){
    const b=document.createElement("button");
    b.className="chip";
    b.textContent=t(d===1?"{n} day/move":"{n} days/move",{n:d});
    b.setAttribute("aria-pressed",d===amiPace);
    b.onclick=()=>{amiPace=d;renderDailyChips();saveAmi();if(mode==="friend")showAmi();};
    el.appendChild(b);
  }
}

/* ==========================================================
   NAVIGATION
   ========================================================== */
function setMode(m,opts){
  opts=opts||{};
  reviewGame=null;reviewLast=null;
  const rb=$("resultBanner"); if(rb)rb.classList.add("hide");
  if(m!=="play"){
    const nr=$("navRow"); if(nr)nr.classList.add("hide");
    const pi=$("plyInfo"); if(pi)pi.className="plyinfo hide";
  }
  if(mode==="play"&&m!=="play"&&game){mainGame=game;mainSan=sanList;mainLast=lastMove;mainStarted=gameStarted;mainFlipped=flipped;}
  mode=m;busy=false;
  const tabs={play:"tab-play",puzzles:"tab-puzzles",friend:"tab-friend"};
  for(const k in tabs)$(tabs[k]).setAttribute("aria-selected",k===m);
  $("pane-home").classList.toggle("hide",m!=="home");
  $("appLayout").classList.toggle("hide",m==="home");
  $("pane-play").classList.toggle("hide",m!=="play");
  $("pane-puzzles").classList.toggle("hide",m!=="puzzles");
  $("pane-friend").classList.toggle("hide",m!=="friend");
  $("evalwrap").classList.toggle("hide",m!=="play");
  /* Bouton de retournement : visible en Jouer et Entre amis (les deux
     modes ou #board, partage par tout le site, affiche une vraie partie
     avec un camp). Masque ailleurs (Exercices, Defis...) : ces ecrans
     pilotent deja "flipped" eux-memes pour presenter la position du bon
     point de vue (cote du trait dans un exercice, etc.), un retournement
     manuel y entrerait en conflit avec ce choix deliberer. Le conteneur
     #boardTools (pas seulement le bouton) : il doit rester visible meme
     quand le bandeau de coups interne est masque (avant le premier coup,
     ou en mode Entre amis qui n'a pas de bandeau de coups du tout). */
  { const bt=$("boardTools"); if(bt)bt.classList.toggle("hide",m!=="play"&&m!=="friend"); }
  /* Pour tout mode autre que Jouer/Entre amis, le plateau doit toujours
     etre visible (Exercices, Defis, Analyser en ont besoin des l'entree).
     Pour Jouer/Entre amis specifiquement, on laisse la decision a
     updatePlayBoardVisibility()/updateAmiBoardVisibility(), appelees juste
     apres par les branches ci-dessous (setupGame/newGame/showAmi...) : sans
     ce garde-fou ici, quitter Entre amis avant d'avoir cree de partie vers
     un autre onglet aurait laisse le plateau cache partout ensuite. */
  { const bw=document.querySelector(".board-wrap"); if(bw&&m!=="play"&&m!=="friend")bw.classList.remove("hide"); }
  /* Les pendules ne concernent que l'onglet Jouer. renderClocks le sait deja,
     mais rien ne l'appelait au changement d'onglet : elles restaient donc
     affichees au-dessus de l'echiquier des exercices. */
  if(typeof renderClocks==="function")renderClocks();
  if(m==="home"){renderProgress();syncTC();return;}
  if(m==="play"){
    if(opts.fresh)newGame();
    else if(mainGame&&mainStarted){game=mainGame;sanList=mainSan;lastMove=mainLast;gameStarted=true;flipped=mainFlipped;selected=-1;marks={};refreshGame();}
    else if(pendingPlaySave&&typeof showResumeChoice==="function")showResumeChoice();
    else setupGame();
    syncTC();
  } else if(m==="puzzles"){
    /* Si un sprint tournait dans Defis, le bloc de l'exercice y est encore :
       on le ramene avant d'afficher l'onglet, sinon il serait vide. */
    if(typeof rushRestore==="function")rushRestore();
    renderProgress();
    /* Les finales sont dans cet onglet depuis la reorganisation : sans cet
       appel, la liste des cinq positions restait vide. Elles vivaient
       auparavant dans l'onglet "train", qui les preparait de son cote. */
    if(typeof renderEgChips==="function")renderEgChips();
    /* renderEgChips() ne redessine que les puces ; le statut d'une tentative
       en cours (ou son message de fin) ne suivait donc pas un changement de
       langue fait pendant qu'on etait sur un autre onglet, puisque rien ne
       rappelait renderEndgame() au retour sur Exercices. */
    if(typeof renderEndgame==="function")renderEndgame();
    /* Menu a 5 cartes (discussion UX du 2026-09-03) : par defaut, un clic
       sur l'onglet "Resoudre" (aucun opts.screen precise) montre le menu,
       pas un plateau directement -- seul un choix explicite (clic sur une
       carte) ou un lien profond/le duel du jour/une revision d'erreur
       (qui passent opts.screen eux-memes) va droit au contenu.
       opts.daily est garde pour compatibilite avec les appels existants
       (deep-link #puzzle=, etc.) qui ne connaissaient pas encore "screen". */
    const screen=opts.screen||(opts.daily?"daily":"menu");
    if(typeof showSolveScreen==="function")showSolveScreen(screen);
  } else {
    renderDailyChips();rebuildAmi();showAmi();
    if(typeof renderAmiHistory==="function")renderAmiHistory();
  }
}

/* ---------- listeners ---------- */
$("brand").onclick=()=>{setMode("home");goTop();};
$("tab-play").onclick=()=>{setMode("play");goTop();};
$("tab-puzzles").onclick=()=>{setMode("puzzles");goTop();};
$("tab-friend").onclick=()=>{setMode("friend");goTop();};
/* L'accueil ne propose pas de choix de couleur : la tirer au sort est donc
   plus juste que d'imposer les Blancs. Le reglage de l'onglet Jouer n'est pas
   ecrase, il n'y a simplement rien a respecter ici. */
function tirerCouleur(){
  /* On passe le reglage lui-meme en "au hasard", pas seulement la couleur :
     le selecteur doit decrire ce qui s'est passe. Changer myColor sans
     toucher colorMode affichait "Blancs" alors que la couleur avait ete
     tiree au sort, et une seconde partie serait repartie en Blancs fixes
     sans qu'on l'ait demande. */
  colorMode="r";
  myColor=Math.random()<0.5?W:B;
  if(typeof syncColorSeg==="function")syncColorSeg();
}
$("heroPlay").onclick=()=>{
  if(tcCat==="daily"){setMode("friend");goTop();return;}
  tirerCouleur();
  setMode("play",{fresh:true});
  goTop();
};
$("heroPuzzle").onclick=()=>{setMode("puzzles",{daily:true});goTop();};
$("cardPlay").onclick=()=>{tirerCouleur();setMode("play",{fresh:true});goTop();};
$("cardPuzzles").onclick=()=>{setMode("puzzles");goTop();};
$("cardFriend").onclick=()=>{setMode("friend");goTop();};
$("segColor").addEventListener("click",e=>{
  const b=e.target.closest("button"); if(!b)return;
  colorMode=b.dataset.v;
  if(colorMode==="r")myColor=Math.random()<0.5?W:B;
  else myColor=colorMode==="w"?W:B;
  syncColorSeg();
  if(gameStarted)newGame(); else setupGame();
});
/* Pendant une partie en mode aleatoire, on met en avant la couleur tiree
   plutot que le bouton "Au hasard" : sinon le joueur ne saurait pas de quel
   cote il joue sans regarder l'echiquier. Hors partie, c'est le mode choisi
   qui reste en avant. */
/* Le selecteur montre toujours le REGLAGE choisi, jamais la couleur tiree.
   J'avais d'abord affiche la couleur obtenue pendant une partie en mode
   aleatoire, en pensant qu'on ne saurait pas de quel cote on joue. C'est
   faux : l'echiquier est retourne, l'adversaire est nomme et la pendule
   indique qui est qui. Montrer autre chose que le reglage rendait le
   selecteur incoherent avec les deux autres options, qui restent affichees
   telles qu'on les a choisies. */
function syncColorSeg(){
  const seg=$("segColor"); if(!seg)return;
  for(const x of seg.children)x.setAttribute("aria-pressed",x.dataset.v===colorMode);
}
$("segLevel").addEventListener("click",e=>{
  const b=e.target.closest("button"); if(!b)return;
  for(const x of e.currentTarget.children)x.setAttribute("aria-pressed",x===b);
  botLevel=+b.dataset.v;
  /* Le nom affiche au-dessus de la pendule porte la force : il doit suivre
     le changement, sinon il annoncerait l'ancien niveau. */
  if(typeof renderClocks==="function")renderClocks();
});
$("btnNew").onclick=()=>{if(gameStarted)setupGame();else newGame();};
/* plus de bouton Reprendre : la fonction reste pour l'historique du code */
$("btnHint").onclick=hintGame;
$("btnNext").onclick=nextPuzzle;
$("themeFilter").addEventListener("change",e=>{
  prog.theme=e.target.value||"";
  saveProg();
  if(mode==="puzzles")nextPuzzle();
});
/* btnDaily a disparu du HTML (menu a 5 cartes, 2026-09-03) : "Puzzle du
   jour" se rejoint desormais via cardSolveDaily, cable plus bas avec les
   4 autres cartes du menu. */
$("btnHintEx").onclick=hintPuzzle;
/* btnSolve a fusionne avec btnHintEx : plus de bouton dedie. */
$("btnRetry").onclick=loadPuzzle;
$("btnCodeGen").onclick=showCode;
$("btnCodeCopy").onclick=()=>{if(!$("codeOut").value)showCode();copyText($("codeOut").value);$("codeMsg").textContent=t("Code copied.");};
$("btnCodeLoad").onclick=loadCode;
$("btnReset").onclick=()=>{
  prog={level:1,solved:0,streak:0,best:0,correctRun:0,wrongRun:0,seen:[]};
  saveProg();renderProgress();nextPuzzle();
};
$("segAmiColor").addEventListener("click",e=>{
  const b=e.target.closest("button"); if(!b)return;
  for(const x of e.currentTarget.children)x.setAttribute("aria-pressed",x===b);
  amiColor=b.dataset.v==="w"?W:B;
});
$("btnAmiNew").onclick=newAmiGame;
$("btnAmiUndo").onclick=undoAmi;
$("btnResign").onclick=resignGame;
/* Retournement manuel de l'echiquier (Jouer + Entre amis, voir setMode).
   Purement visuel : render()/updateEval() savent deja tout dessiner selon
   "flipped" (deja utilise pour l'orientation automatique cote Noirs), donc
   il n'y a rien d'autre a synchroniser. */
function toggleFlip(){flipped=!flipped;render();updateEval();}
if($("btnFlip"))$("btnFlip").onclick=toggleFlip;
$("btnAmiResign").onclick=()=>{
  const b=$("btnAmiResign");
  if(!b.classList.contains("armed")){
    b.classList.add("armed");b.textContent=t("Confirm resignation");
    setTimeout(()=>{b.classList.remove("armed");b.textContent=t("Resign this game");},5000);
    return;
  }
  b.classList.remove("armed");b.textContent=t("Resign this game");
  amiResigned=amiColor;saveAmi();showAmi();
};
window.addEventListener("hashchange",()=>{
  const d=readDeepLink();
  if(d&&applyDeepLink(d))return;
  if(readHash())setMode("friend");
});

/* ---------- start ---------- */
/* Icones des cartes d'accueil : memes pieces que sur l'echiquier, mais en
   laiton, la couleur d'illustration du site. L'oeil et le naseau du cavalier
   gardent leur remplissage noir d'origine, sans quoi ils disparaitraient. */
const icoBrass=t=>{
  let s='<svg viewBox="0 0 45 45" aria-hidden="true">';
  for(const f of PIECES[t]||[]){
    const a=[];
    if(f.t==="circle")a.push('cx="'+f.cx+'" cy="'+f.cy+'" r="'+f.r+'"');
    else a.push('d="'+f.d+'"');
    if(!f.fixe)a.push('fill="#E0A93B" stroke="#101413" stroke-linecap="round" stroke-linejoin="round"');
    else a.push('fill="#101413"');   /* oeil et naseau : plein, sans contour */
    if(f.sw)a.push('stroke-width="'+f.sw+'"');
    s+='<'+f.t+' '+a.join(' ')+'/>';
  }
  return s+'</svg>';
};
/* La marque a l'elephant (entete + filigrane "The elephant on the board")
   fait desormais partie du HTML genere par build_site.js, comme sur les
   pages claires : elle s'affiche meme si ce script ne s'execute jamais
   (moteur d'indexation, previsualisation sans JavaScript). Rien a poser ici. */
$("icoPlay").innerHTML=icoBrass("n");
$("icoPuzzles").innerHTML=icoBrass("q");
$("icoFriend").innerHTML=icoBrass("p");
const _hc=$("hCount"); if(_hc)_hc.textContent=TOTAL_PUZZLES;

buildBoard();
Promise.all([loadProg(),loadAmi(),loadLang(),loadHistory(),loadPlaySave(),loadAmiHistory()]).then(()=>{
  applyI18n();
  renderProgress();syncTC();renderDailyChips();renderExplore();renderHistory();
  shareButtons($("siteShare"),baseUrl(),t("Come play chess on chang64:"),true);
  for(const x of $("segAmiColor").children)x.setAttribute("aria-pressed",x.dataset.v===(amiColor===W?"w":"b"));
  const deep=readDeepLink();
  if(deep&&applyDeepLink(deep)){}
  else if(readHash())setMode("friend");
  else setMode("home");
});
