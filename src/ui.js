/* ==========================================================
   PUZZLES + LEVELS
   ========================================================== */
const PUZZLES = __PUZZLES__;

const LEVELS=[
  {n:1,name:"First mates",hint:"One move is enough."},
  {n:2,name:"Winning moves",hint:"Look for the loose piece."},
  {n:3,name:"Forks and pins",hint:"One piece can attack two at once."},
  {n:4,name:"Mate in two",hint:"Your first move forces the reply."},
  {n:5,name:"Combinations",hint:"A sacrifice often opens the door."}
];

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
let mainGame=null,mainSan=null,mainLast=null,mainStarted=false;
let gameStarted=false;

/* puzzles */
let puzzle=null,puzzleN=0,puzzleTries=0,puzzleDone=false,solCache={};
let prog={level:1,solved:0,streak:0,best:0,correctRun:0,wrongRun:0,seen:[]};

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
   avec une quinzaine de prises. */
/* Hauteur d'une piece prise, en pixels. Sert aussi a calculer sa largeur :
   les deux doivent rester coherents avec la regle .taken .tk du gabarit. */
const TAILLE_PRISE=22;
function rangeePrises(liste,couleur,solde){
  if(!liste.length&&!solde)return "";
  /* La classe "noire" declenche le contour clair : sans lui, une piece noire
     se confondrait avec le fond sombre de la pendule. */
  const cls="tk"+(couleur==="b"?" noire":"");
  let s='<span class="taken">';
  for(const t of liste){
    /* Largeur proportionnelle a la boite englobante : le pion reste plus
       etroit que la dame, comme sur l'echiquier, et chaque piece part de son
       propre bord au lieu d'un vide interne different a chaque fois. */
    const bb=(typeof PIECE_BB!=="undefined"&&PIECE_BB[t])||[0,45];
    const larg=(TAILLE_PRISE*(bb[1]-bb[0])/45).toFixed(1);
    s+='<i class="'+cls+'" style="width:'+larg+'px">'+pieceSVG(t,couleur,true)+"</i>";
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
  let cp=null;
  if(typeof evalFromAnalysis==="function")cp=evalFromAnalysis();
  const raw=cp!==null?cp:evaluate(g)*(g.turn===W?1:-1);
  const pawns=Math.max(-10,Math.min(10,raw/100));
  /* La hauteur represente toujours la part des Blancs. C'est l'orientation
     de la barre qui suit celle de l'echiquier, pas la valeur. */
  $("evalfill").style.height=(50+pawns*4.4).toFixed(1)+"%";
  { const tr=document.querySelector(".evaltrack");
    if(tr)tr.classList.toggle("flipped",!!flipped); }
  $("evalnum").textContent=(pawns>0?"+":"")+pawns.toFixed(1);
  const el=$("evaltxt");
  const side=pawns>0?"White":"Black";
  if(Math.abs(pawns)<0.6)el.textContent=t("Even position");
  else if(Math.abs(pawns)<1.6)el.textContent=t(side+" slightly better");
  else if(Math.abs(pawns)<3.5)el.textContent=t(side+" is better");
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
function refreshGame(){
  legalCache=game.moves();
  render();updateEval();renderSheetInto("sheet",sanList);renderClocks();
  const over=gameOver();
  $("turnline").textContent=!gameStarted?t("Not started yet."):(over?t("Game over."):(game.turn===W?t("White to move."):t("Black to move.")));
  if(typeof afterGameRender==="function")afterGameRender(over);
  $("btnNew").textContent=gameStarted?t("New game"):t("Start game");
  $("btnResign").disabled=!gameStarted||(over&&resigned===null);
  $("btnHint").disabled=busy||(typeof gameFinished==="function"&&!gameFinished()&&!isReviewGame);
  /* (le verrouillage en cours de partie, plus bas, a le dernier mot) */

  /* Pendant une partie en cours, seul "Abandonner" reste actif.
     Deux raisons distinctes :
     - changer de couleur relancait immediatement une nouvelle partie et
       faisait disparaitre celle en cours sans prevenir ;
     - un bouton Stockfish cliquable pendant qu'on joue laisse croire qu'il
       peut servir a trouver le meilleur coup. Il ne le peut pas, la
       suggestion utilise le moteur integre et reste bloquee tant que la
       partie n'est pas finie, mais aux echecs le soupcon de triche suffit a
       poser probleme : mieux vaut lever toute ambiguite. */
  const enCours=gameStarted&&!over;
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
  /* Stockfish : ne pas contrarier son propre etat. Pendant le telechargement
     il se desactive lui-meme, et on ne doit surtout pas le rallumer. */
  {
    const sfBtn=$("btnStockfish");
    if(sfBtn){
      const enChargement=typeof sf!=="undefined"&&sf&&!sf.ready&&sf.worker;
      if(enCours)sfBtn.disabled=true;
      else if(!enChargement)sfBtn.disabled=false;
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
  game=new Game();sanList=[];lastMove=null;selected=-1;marks={};busy=false;
  reviewGame=null;reviewLast=null;
  flipped=myColor===B;
  clock={enabled:false,w:0,b:0,inc:0,active:null,last:0,flagged:null};
  clockHist=[];
  mainGame=null;
  refreshGame();
  const s=$("status");s.className="status";
  s.textContent=t("Choose your colour, the engine's strength and a time control, then start.");
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
  game=new Game();sanList=[];lastMove=null;selected=-1;marks={};busy=false;
  flipped=myColor===B;
  /* Entree en fondu des pieces. La classe est retiree apres l'animation pour
     ne pas la rejouer a chaque rendu de l'echiquier en cours de partie. */
  if(boardEl){
    boardEl.classList.remove("dealt");
    void boardEl.offsetWidth;            /* force le redemarrage de l'animation */
    boardEl.classList.add("dealt");
    setTimeout(function(){boardEl.classList.remove("dealt");},900);
  }
  clockSetup();
  const {cat,item}=tcCurrent();
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
function levelPool(lvl){
  let pool=PUZZLES.filter(p=>p.level===lvl&&themeOK(p));
  if(!pool.length&&prog.theme)pool=PUZZLES.filter(themeOK);   // thème rare : on ignore le niveau
  return pool.length?pool:PUZZLES.filter(p=>p.level===lvl);
}
function renderThemeFilter(){
  const sel=$("themeFilter"); if(!sel)return;
  $("themeTitle").textContent=t("Theme");
  const counts={};
  for(const p of PUZZLES)counts[p.theme]=(counts[p.theme]||0)+1;
  const themes=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
  sel.innerHTML='<option value="">'+t("All themes")+" ("+PUZZLES.length+")</option>"+
    themes.map(th=>'<option value="'+th.replace(/"/g,"&quot;")+'">'+t(th)+" ("+counts[th]+")</option>").join("");
  sel.value=prog.theme||"";
}
function nextPuzzle(){
  const pool=levelPool(prog.level);
  const fresh=pool.filter(p=>!prog.seen.includes(p.id));
  const list=fresh.length?fresh:pool;
  puzzle=list[Math.floor(Math.random()*list.length)];
  puzzle.daily=false;
  loadPuzzle();
}
function dailyPuzzle(){
  const d=new Date();
  const n=Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000);
  puzzle=PUZZLES[n%PUZZLES.length];
  puzzle.daily=true;
  loadPuzzle();
}
function loadPuzzle(){
  solCache={};
  game=new Game(puzzle.fen);
  flipped=game.turn===B;
  selected=-1;marks={};lastMove=null;busy=false;
  puzzleN=puzzle.type==="mate"?puzzle.n:0;
  puzzleTries=0;puzzleDone=false;
  /* Le bouton d'aide repart sur "Indice" a chaque exercice. */
  hintShown=false;
  if(typeof syncHintBtn==="function")syncHintBtn();
  legalCache=game.moves();
  const side=game.turn===W?"White":"Black";
  $("exTheme").textContent=(puzzle.daily?t("Puzzle of the day · "):"")+t(puzzle.theme);
  $("exQuest").textContent=puzzle.type==="mate"
    ? t(side+" to play and mate in {n} "+(puzzle.n>1?"moves.":"move."),{n:puzzle.n})
    : t(side+" to play and win material.");
  const st=$("exStatus");st.className="status";
  st.textContent=t("Your move. {hint}",{hint:t(LEVELS[prog.level-1].hint)});
  render();updateEval();renderProgress();
  if(typeof focusBoard==="function")focusBoard();
}
function currentSolutions(){
  /* Aucun exercice charge : appuyer sur "Solution" ou "Indice" avant que la
     banque ne soit prete levait une TypeError qui remontait jusqu'a la
     console et laissait l'interface dans un etat incoherent. */
  if(!puzzle)return [];
  if(puzzle.type!=="mate")return game.moves().filter(m=>puzzle.sol.includes(game.uci(m)));
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
  if(!legalCache.length&&game.inCheck()){finishPuzzle(true,t("{san} — checkmate.",{san:san}));return;}
  if(puzzle.type!=="mate"){finishPuzzle(true,t("{san} — material won. Nicely spotted.",{san:san}));return;}
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
function finishPuzzle(won,msg){
  puzzleDone=true;
  if(typeof onPuzzleResult==="function"&&onPuzzleResult(won,msg))return;
  const st=$("exStatus");
  st.className="status "+(won?"win":"lose");
  st.textContent=msg;
  if(won&&puzzleTries===0)registerSolved();
  else if(won)registerPartial();
  if(!prog.seen.includes(puzzle.id)){prog.seen.push(puzzle.id);if(prog.seen.length>200)prog.seen.shift();}
  saveProg();renderProgress();
}
function registerSolved(){
  prog.solved++;prog.streak++;prog.correctRun++;prog.wrongRun=0;
  if(prog.streak>prog.best)prog.best=prog.streak;
  if(prog.correctRun>=3&&prog.level<5){
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
  let h="";
  for(let i=1;i<=5;i++)h+='<i class="'+(i<=prog.level?"on":"")+'"></i>';
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
    else{copyText(url);$("amiNote").textContent=t("Link copied — paste it into Messenger.");}
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
function showAmi(){
  game=amiGame;flipped=amiColor===B;
  legalCache=game.moves();
  lastMove=game.history.length?game.history[game.history.length-1].m:null;
  selected=-1;marks={};
  render();updateEval();renderSheetInto("amiSheet",amiSan);
  const st=$("amiStatus");
  const over=!legalCache.length||game.isDraw();
  if(!over)renderResult(false);
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
  shareButtons($("amiShare"),amiUrl(),t("Chess on chang64 — your move ({pace}):",{pace:t(amiPace===1?"{n} day/move":"{n} days/move",{n:amiPace})}),true);
  updateAmiNote();
}
function handleAmiClick(sq){
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
  amiResigned=null;amiMoves=[];rebuildAmi();showAmi();saveAmi();
  if(typeof focusBoard==="function")focusBoard();
  const st=$("amiStatus");st.className="status";
  st.textContent=amiColor===W
    ? t("You start. Play your move, then send the link.")
    : t("Send this link so your friend opens with White.");
  if(amiColor===B){
    $("amiLinkPanel").classList.remove("hide");
    $("amiLink").value=amiUrl();
    shareButtons($("amiShare"),amiUrl(),t("I challenge you on chang64 — you play White:"),true);
    updateAmiNote();
  }
}
async function saveAmi(){try{await window.storage.set("chang64:friend",JSON.stringify({m:amiMoves,c:amiColor,p:amiPace,r:amiResigned}));}catch(e){}}
async function loadAmi(){
  try{const r=await window.storage.get("chang64:friend");
    if(r&&r.value){const d=JSON.parse(r.value);amiMoves=d.m||[];amiColor=d.c===1?B:W;amiPace=d.p||3;amiResigned=(d.r===0||d.r===1)?d.r:null;}}catch(e){}
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
    setMode("train");
    if(typeof startEndgame==="function"&&ENDGAMES.some(e=>e.id===d.id)){
      startEndgame(d.id);
      const st=$("egStatus");st.className="status";
      st.textContent=t("White to move. Mate within {n} moves.",{n:ENDGAMES.find(e=>e.id===d.id).budget});
    }
    return true;
  }
  if(d.kind==="puzzle"){
    const pz=PUZZLES.find(p=>p.id===d.id);
    if(!pz)return false;
    setMode("puzzles");
    puzzle=pz;puzzle.daily=false;loadPuzzle();
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
  if(mode==="play"&&m!=="play"&&game){mainGame=game;mainSan=sanList;mainLast=lastMove;mainStarted=gameStarted;}
  mode=m;busy=false;
  const tabs={home:"tab-home",play:"tab-play",puzzles:"tab-puzzles",friend:"tab-friend"};
  for(const k in tabs)$(tabs[k]).setAttribute("aria-selected",k===m);
  $("pane-home").classList.toggle("hide",m!=="home");
  $("appLayout").classList.toggle("hide",m==="home");
  $("pane-play").classList.toggle("hide",m!=="play");
  $("pane-puzzles").classList.toggle("hide",m!=="puzzles");
  $("pane-friend").classList.toggle("hide",m!=="friend");
  $("evalwrap").classList.toggle("hide",m!=="play");
  /* Les pendules ne concernent que l'onglet Jouer. renderClocks le sait deja,
     mais rien ne l'appelait au changement d'onglet : elles restaient donc
     affichees au-dessus de l'echiquier des exercices. */
  if(typeof renderClocks==="function")renderClocks();
  if(m==="home"){renderProgress();syncTC();return;}
  if(m==="play"){
    if(opts.fresh)newGame();
    else if(mainGame&&mainStarted){game=mainGame;sanList=mainSan;lastMove=mainLast;gameStarted=true;flipped=myColor===B;selected=-1;marks={};refreshGame();}
    else setupGame();
    syncTC();
  } else if(m==="puzzles"){
    /* Si un sprint tournait dans Defis, le bloc de l'exercice y est encore :
       on le ramene avant d'afficher l'onglet, sinon il serait vide. */
    if(typeof rushRestore==="function")rushRestore();
    renderProgress();
    if(opts.daily)dailyPuzzle(); else nextPuzzle();
    /* Les finales sont dans cet onglet depuis la reorganisation : sans cet
       appel, la liste des cinq positions restait vide. Elles vivaient
       auparavant dans l'onglet "train", qui les preparait de son cote. */
    if(typeof renderEgChips==="function")renderEgChips();
  } else {
    renderDailyChips();rebuildAmi();showAmi();
  }
}

/* ---------- listeners ---------- */
$("brand").onclick=()=>{setMode("home");goTop();};
$("tab-home").onclick=()=>{setMode("home");goTop();};
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
$("btnDaily").onclick=dailyPuzzle;
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
$("brandmark").innerHTML=markSVG("#E0A93B");
$("originMark").innerHTML=markSVG("#E0A93B");
$("icoPlay").innerHTML=icoBrass("n");
$("icoPuzzles").innerHTML=icoBrass("q");
$("icoFriend").innerHTML=icoBrass("p");
const _hc=$("hCount"); if(_hc)_hc.textContent=PUZZLES.length;

buildBoard();
Promise.all([loadProg(),loadAmi(),loadLang(),loadHistory()]).then(()=>{
  applyI18n();
  renderProgress();syncTC();renderDailyChips();renderExplore();renderHistory();
  shareButtons($("siteShare"),baseUrl(),t("Come play chess on chang64:"),true);
  for(const x of $("segAmiColor").children)x.setAttribute("aria-pressed",x.dataset.v===(amiColor===W?"w":"b"));
  const deep=readDeepLink();
  if(deep&&applyDeepLink(deep)){}
  else if(readHash())setMode("friend");
  else setMode("home");
});
