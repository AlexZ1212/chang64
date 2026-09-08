/* --- ramener l'échiquier sous les yeux quand l'action part d'un bouton situé plus bas --- */
function focusBoard(){
  try{
    const el=document.querySelector(".board-side");
    if(!el||typeof el.scrollIntoView!=="function")return;
    const r=el.getBoundingClientRect?el.getBoundingClientRect():null;
    const vh=window.innerHeight||document.documentElement.clientHeight||0;
    /* L'en-tete est ancree (position:sticky) et occupe en permanence le
       haut du viewport : un calcul de visibilite qui part de y=0 pouvait
       croire l'echiquier deja bien visible alors qu'une partie de son haut
       restait recouverte par l'en-tete opaque, et sautait le defilement a
       tort. On mesure sa hauteur reelle plutot que de deviner un chiffre
       fixe, pour rester juste quel que soit la largeur d'ecran. */
    const header=document.querySelector("header");
    const headerH=header&&header.getBoundingClientRect?header.getBoundingClientRect().height:0;
    if(r&&r.height>0&&vh>headerH){
      const visible=Math.min(r.bottom,vh)-Math.max(r.top,headerH);
      if(visible>=Math.min(r.height,vh-headerH)*0.7)return;   // déjà bien visible : on ne bouge pas
    }
    const smooth=!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    el.scrollIntoView(smooth?{behavior:"smooth",block:"start"}:{block:"start"});
  }catch(e){}
}

/* --- amener une section sous les yeux, et lui donner le focus ---
   Plusieurs boutons ouvrent un panneau qui contient plusieurs sections :
   sans cela, on arrivait systematiquement en haut, donc au mauvais endroit.
   Le focus compte autant que le defilement : un lecteur d'ecran continue
   sinon a lire depuis le debut du document. */
/* Revenir en haut de la nouvelle vue. Sans cela, cliquer sur un onglet
   depuis le bas de la page laissait a la meme hauteur, donc au milieu d'un
   contenu sans rapport. Volontairement limite aux clics de navigation : le
   declencher dans setMode ferait sauter la page a chaque rafraichissement
   interne, par exemple un changement de langue. */
function goTop(){
  const calme=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  try{window.scrollTo(calme?{top:0}:{top:0,behavior:"smooth"});}
  catch(e){try{window.scrollTo(0,0);}catch(e2){}}
}
function goToSection(id){
  const el=document.getElementById(id);
  if(!el)return;
  try{el.focus({preventScroll:true});}catch(e){try{el.focus();}catch(e2){}}
  if(typeof el.scrollIntoView!=="function")return;
  const calme=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  try{el.scrollIntoView(calme?{block:"start"}:{behavior:"smooth",block:"start"});}
  catch(e){el.scrollIntoView();}
}

/* ==========================================================
   14. ENDGAME TRAINER
   ========================================================== */
/* Les budgets etaient cales sur le jeu PARFAIT : 34 coups pour Fou+Cavalier,
   c'est exactement l'optimum theorique, 12 pour Dame contre Roi en est a un
   coup. Un exercice dont la reussite exige de ne jamais devier n'est pas
   atteignable pour qui l'apprend, et c'est bien la ce qu'on lui demande
   d'apprendre. Marge ajoutee : la contrainte reste reelle (on ne peut pas
   errer), le mat reste possible sans jouer comme une table de finales. */
const ENDGAMES=[
  {id:"kq",name:"Queen vs King",budget:16,white:["Q"],black:[],
   brief:"Push the lone king to the edge with the queen, then bring your own king up. Watch for stalemate."},
  {id:"kr",name:"Rook vs King",budget:26,white:["R"],black:[],
   brief:"Cut the king off with the rook and shrink the box one rank at a time."},
  {id:"krr",name:"Two rooks vs King",budget:14,white:["R","R"],black:[],
   brief:"The ladder: one rook cuts, the other checks, and they alternate."},
  {id:"kbn",name:"Bishop and knight",budget:45,white:["B","N"],black:[],
   brief:"The hard one. Mate only happens in a corner your bishop controls."},
  {id:"kp",name:"King and pawn",budget:32,white:["P"],black:[],
   brief:"Promote the pawn, then mate. Opposition decides it."}
];
/* Roi et pion : une position tiree au hasard est nulle une bonne partie du
   temps (roi noir devant le pion, opposition du mauvais cote). L'exercice
   demande un mat : la position doit donc etre gagnante, sinon on demande
   l'impossible. Deux configurations sures, verifiees plutot que devinees :
   - le roi noir est hors du carre du pion, qui passe alors tout seul ;
   - le roi blanc est devant son pion et a portee, le roi noir strictement
     plus loin de la case de promotion que lui.
   Ce n'est pas une table KPK, c'est un filtre conservateur : il ecarte les
   positions douteuses, quitte a refuser des positions qui seraient gagnantes.
   Le generateur retire jusqu'a 400 fois, il a de la marge. */
function kpGagnable(wk,bk,pion){
  const pr=rOf(pion),pf=fOf(pion);      /* rangee 0 = case de promotion */
  const dPromo=sq=>Math.max(rOf(sq),Math.abs(fOf(sq)-pf));
  if(dPromo(bk)>pr)return true;
  const devant=rOf(wk)<pr&&Math.abs(fOf(wk)-pf)<=1&&pr-rOf(wk)<=2;
  return devant&&dPromo(bk)>dPromo(wk)+1;
}
let eg=null;   // {scen, moves, done}

function randEndgame(scen){
  for(let tries=0;tries<400;tries++){
    const used=new Set(),place=()=>{
      let s;do{s=Math.floor(Math.random()*8)*16+Math.floor(Math.random()*8);}while(used.has(s));
      used.add(s);return s;
    };
    const wk=place(),bk=place();
    if(Math.abs(rOf(wk)-rOf(bk))<=1&&Math.abs(fOf(wk)-fOf(bk))<=1)continue;
    const board={};board[wk]="K";board[bk]="k";
    let ok=true,pion=-1;
    for(const p of scen.white){
      let s;
      if(p==="P"){
        let g=0;
        do{s=(1+Math.floor(Math.random()*5))*16+Math.floor(Math.random()*8);g++;}while(used.has(s)&&g<40);
        if(used.has(s)){ok=false;break;}
        pion=s;
      } else s=place();
      used.add(s);board[s]=p;
    }
    if(!ok)continue;
    if(pion>=0&&!kpGagnable(wk,bk,pion))continue;
    let fen="";
    for(let r=0;r<8;r++){
      let e=0;
      for(let f=0;f<8;f++){
        const p=board[r*16+f];
        if(!p){e++;continue;}
        if(e){fen+=e;e=0;}
        fen+=p;
      }
      if(e)fen+=e;
      if(r<7)fen+="/";
    }
    fen+=" w - - 0 1";
    let g;
    try{g=new Game(fen);}catch(e){continue;}
    if(g.attacked(g.kingSq[B],W))continue;
    if(g.inCheck())continue;
    if(g.moves().length<5)continue;
    // aucune pièce blanche ne doit pouvoir être croquée par le roi noir au premier coup
    let fragile=false;
    for(let sq=0;sq<128;sq++){
      if(sq&0x88){sq+=7;continue;}
      const pc=g.board[sq];
      if(!pc||pC(pc)!==W||pT(pc)===K)continue;
      const bk=g.kingSq[B];
      const near=Math.abs(rOf(bk)-rOf(sq))<=1&&Math.abs(fOf(bk)-fOf(sq))<=1;
      if(near&&!g.attacked(sq,W)){fragile=true;break;}
    }
    if(fragile)continue;
    return fen;
  }
  return null;
}
function startEndgame(scenId,statusKind){
  const scen=ENDGAMES.find(s=>s.id===scenId)||ENDGAMES[0];
  const fen=randEndgame(scen);
  if(!fen){$("egStatus").textContent=t("Could not build a position, try again.");return;}
  eg={scen:scen,moves:0,done:false,statusKind:statusKind||"chip"};
  game=new Game(fen);
  eg.g=game;
  flipped=false;selected=-1;marks={};lastMove=null;busy=false;
  legalCache=game.moves();
  render();
  renderEndgame();
  focusBoard();
}
/* Le libelle de statut ("Trait aux Blancs...", "Echec et mat en N coups...")
   est recalcule a chaque appel a partir de eg.statusKind plutot que fige au
   moment du clic : sans ca, un changement de langue pendant ou apres une
   tentative laissait ce texte precis dans l'ancienne langue jusqu'au coup
   ou clic suivant, alors que le titre, le descriptif et les puces se
   retraduisaient correctement (eux passent par un nouvel appel a t() a
   chaque renderEndgame, pas ce libelle-la qui n'etait ecrit qu'a la main). */
function renderEgStatus(){
  if(!eg||!eg.statusKind)return;
  const st=$("egStatus");
  const MSG={
    "new":()=>t("New position. White to move."),
    "chip":()=>t("White to move. Mate within {n} moves.",{n:eg.scen.budget}),
    "your-move":()=>t("Your move. {n} moves left.",{n:eg.scen.budget-eg.moves}),
    "checkmate":()=>t("Checkmate in {n} moves. Well done.",{n:eg.moves}),
    "stalemate-lone":()=>t("Stalemate. The lone king escaped with a draw."),
    "no-material":()=>t("You lost your material. Draw."),
    "out-of-moves":()=>t("Out of moves. The target was {n}.",{n:eg.scen.budget}),
    "mated-wrong":()=>t("You are mated. That should not happen here."),
    "stalemate-defence":()=>t("Stalemate. The defence held.")
  };
  st.className="status"+(eg.done?(eg.statusKind==="checkmate"?" win":" lose"):"");
  st.textContent=MSG[eg.statusKind]();
}
function renderEndgame(){
  if(!eg)return;
  $("egName").textContent=t(eg.scen.name);
  $("egBrief").textContent=t(eg.scen.brief);
  $("egMoves").textContent=eg.moves;
  $("egBudget").textContent=eg.scen.budget;
  const best=(prog.endgames||{})[eg.scen.id];
  $("egBest").textContent=best?best:"–";
  for(const b of $("egChips").children)b.setAttribute("aria-pressed",b.dataset.id===eg.scen.id);
  renderEgStatus();
}
function endEndgame(kind){
  eg.done=true;
  eg.statusKind=kind;
  if(kind==="checkmate"){
    prog.endgames=prog.endgames||{};
    const cur=prog.endgames[eg.scen.id];
    if(!cur||eg.moves<cur)prog.endgames[eg.scen.id]=eg.moves;
    saveProg();
  }
  renderEndgame();
}
function handleEndgameClick(sq){
  if(!eg||eg.done||busy)return;
  const p=game.board[sq];
  if(selected>=0){
    const r=pickMove(selected,sq);
    if(r){
      marks={};
      if(r.promo){askPromo(r.promo,m=>playEndgame(m));selected=-1;render();return;}
      playEndgame(r.move);return;
    }
  }
  if(p&&pC(p)===game.turn){selected=sq;marks={};}else selected=-1;
  render();
}
function playEndgame(m){
  game.makeMove(m);lastMove=m;selected=-1;marks={};
  eg.moves++;
  legalCache=game.moves();
  render();renderEndgame();
  if(!legalCache.length){
    if(game.inCheck())endEndgame("checkmate");
    else endEndgame("stalemate-lone");
    return;
  }
  // matériel perdu ?
  let heavy=0;
  for(let sq=0;sq<128;sq++){if(sq&0x88){sq+=7;continue;}
    const p=game.board[sq];
    if(p&&pC(p)===W&&pT(p)!==K)heavy++;}
  if(heavy===0){endEndgame("no-material");return;}
  if(eg.moves>=eg.scen.budget){endEndgame("out-of-moves");return;}
  busy=true;
  $("egStatus").className="status";
  $("egStatus").textContent=t("The defending king replies…");
  setTimeout(()=>{
    const rep=search(game,3,450).move||game.moves()[0];
    game.makeMove(rep);lastMove=rep;busy=false;
    legalCache=game.moves();
    render();
    if(!legalCache.length){
      endEndgame(game.inCheck()?"mated-wrong":"stalemate-defence");
      return;
    }
    eg.statusKind="your-move";
    renderEgStatus();
  },380);
}

/* ==========================================================
   15. COORDINATE TRAINER
   ========================================================== */
let coord=null;
function coordSquareName(){
  return "abcdefgh"[Math.floor(Math.random()*8)]+(1+Math.floor(Math.random()*8));
}
function startCoord(){
  coord={score:0,misses:0,endsAt:Date.now()+30000,target:coordSquareName()};
  game=new Game("8/8/8/8/8/8/8/8 w - - 0 1");
  flipped=$("coordSide").children[1].getAttribute("aria-pressed")==="true";
  selected=-1;marks={};lastMove=null;legalCache=[];
  render();
  $("coordHud").classList.remove("hide");
  $("btnCoord").textContent=t("Stop");
  coord.timer=setInterval(coordTick,200);
  coordTick();
  focusBoard();
}
function coordTick(){
  if(!coord)return;
  const left=Math.max(0,coord.endsAt-Date.now());
  const secs=(left/1000).toFixed(1);
  $("chudTime").textContent=secs;
  $("chudScore").textContent=coord.score;
  $("chudMiss").textContent=coord.misses;
  $("chudSquare").textContent=coord.target;
  $("coordHud").classList.toggle("low",left<10000);
  if(left<=0)stopCoord();
}
function stopCoord(){
  if(!coord)return;
  clearInterval(coord.timer);
  const s=coord.score;
  prog.coordBest=Math.max(prog.coordBest||0,s);
  if(typeof checkBadges==="function")checkBadges();
  coord=null;
  $("coordHud").classList.add("hide");
  $("chudSquare").textContent="\u2013";
  if(eg&&eg.g){game=eg.g;legalCache=game.moves();selected=-1;marks={};}
  render();
  $("btnCoord").textContent=t("Start 30 seconds");
  if(typeof showFin==="function"){
    const record=s>=(prog.coordBest||0)&&s>0;
    showFin(
      record?t("New personal best"):t("Time's up"),
      record?t("Score: {score}. Your best yet.",{score:s})
            :t("Score: {score}. Your best is {best}.",{score:s,best:prog.coordBest||0}),
      t("Play again"),
      ()=>startCoord());
  }
  saveProg();
  $("coordBest").textContent=prog.coordBest;
  const st=$("egStatus");st.className="status win";
  st.textContent=t("Coordinates: {n} correct in 30 seconds. Best: {best}.",{n:s,best:prog.coordBest});
}
function handleCoordClick(sq){
  if(!coord)return;
  const name=sqN(sq);
  if(name===coord.target){
    coord.score++;
    marks={};marks[sq]="good";
    coord.target=coordSquareName();
  } else {
    coord.misses++;
    marks={};marks[sq]="bad";
  }
  render();coordTick();
  setTimeout(()=>{marks={};render();},220);
}

/* ==========================================================
   16. TRAIN TAB WIRING
   ========================================================== */
function handleTrainClick(sq){
  if(coord)handleCoordClick(sq);
  else handleEndgameClick(sq);
}
function renderEgChips(){
  const box=$("egChips");poserHtml(box,"");
  for(const s of ENDGAMES){
    const b=document.createElement("button");
    b.className="chip";b.textContent=t(s.name);b.dataset.id=s.id;
    b.setAttribute("aria-pressed",eg&&eg.scen.id===s.id);
    b.onclick=()=>{if(coord)stopCoord();startEndgame(s.id,"chip");};
    box.appendChild(b);
  }
}
$("btnEgNew").onclick=()=>{if(coord)stopCoord();startEndgame(eg?eg.scen.id:"kq","new");};
/* Extrait le 2026-09-03, meme raison que beginRushFlow() (ui2.js) : le clic
   sur la carte "Coordonnees" du menu peut desormais aller droit a l'ecran
   "Ready" plutot que de repasser par le bouton "Start 30 seconds" du
   panneau Defis. sideChoice=true reste specifique aux coordonnees : c'est
   la seule des epreuves chronometrees ou le point de vue se choisit avant
   de commencer (voir showReadyFor, ui2.js). */
function beginCoordFlow(){
  /* Une seule epreuve a la fois : sans cela, un sprint en cours continuait de
     tourner en arriere-plan, son chronometre decomptait et son bandeau restait
     affiche au-dessus de celui des coordonnees. */
  if(typeof rush!=="undefined"&&rush&&typeof rushEnd==="function")
    rushEnd(t("Stopped."));
  /* Trente secondes seulement : perdre les deux premieres a comprendre ou on
     est, ca compte. Meme overlay que les parties chronometrees. */
  /* Manquait ici (signale) : sans focusBoard(), l'ecran "Ready" pouvait
     s'afficher presque entierement hors champ si le clic partait d'un
     endroit scrolle plus bas, par exemple juste apres avoir lu la
     description de ce meme bloc. */
  if(typeof focusBoard==="function")focusBoard();
  /* Titre "Coordinates" plutot que le "Ready when you are" generique
     (2026-09-03), meme raison que beginRushFlow() (ui2.js). */
  if(typeof showReadyFor==="function")
    showReadyFor(t("Thirty seconds · click the square that is named"),
      ()=>startCoord(), t("Start"), t("Coordinates"), null, null, true);
  else startCoord();
}
$("btnCoord").onclick=()=>{
  if(coord){stopCoord();return;}
  beginCoordFlow();
};
$("coordSide").addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  for(const x of e.currentTarget.children)x.setAttribute("aria-pressed",x===b);
  if(coord){flipped=b.dataset.v==="b";render();}
});
/* Le choix de couleur de l'overlay (readySide, template.html) reste
   synchronise avec coordSide plutot que d'etre une source separee :
   startCoord() (plus haut) continue de lire coordSide sans modification,
   et rouvrir le panneau Defis (abandon en cours, etc.) retrouve le meme
   choix que celui fait dans l'overlay. */
{ const rs=$("readySide");
  if(rs)rs.addEventListener("click",e=>{
    const b=e.target.closest("button");if(!b)return;
    for(const x of e.currentTarget.children)x.setAttribute("aria-pressed",x===b);
    const cs=$("coordSide");
    if(cs)for(const x of cs.children)x.setAttribute("aria-pressed",x.dataset.v===b.dataset.v);
  });
}

/* ==========================================================
   17. DRAG AND DROP
   ========================================================== */
let drag=null,suppressClick=false;
function squareFromPoint(x,y){
  const r=boardEl.getBoundingClientRect();
  if(x<r.left||x>r.right||y<r.top||y>r.bottom)return -1;
  const f=Math.floor((x-r.left)/(r.width/8)),k=Math.floor((y-r.top)/(r.height/8));
  const i=Math.max(0,Math.min(63,k*8+f));
  return idxToSq(i);
}
function modeClick(sq){
  /* Meme cas que dans onSquare (ui.js) : les finales vivent dans l'onglet
     Resoudre, donc avec mode==="puzzles". Sans ce test, le glisser-deposer
     comme le clic partaient vers handlePuzzleClick. */
  if(typeof enFinales==="function"&&enFinales()){handleEndgameClick(sq);return;}
  if(mode==="play")handleGameClick(sq);
  else if(mode==="friend")handleAmiClick(sq);
  else if(mode==="puzzles")handlePuzzleClick(sq);
  else if(mode==="train")handleTrainClick(sq);
}
boardEl.addEventListener("pointerdown",e=>{
  if(busy||pendingPromo||coord)return;
  const sq=squareFromPoint(e.clientX,e.clientY);
  if(sq<0)return;
  const g=viewGame();
  const p=g.board[sq];
  if(!p||pC(p)!==g.turn)return;
  drag={from:sq,x:e.clientX,y:e.clientY,moved:false,ghost:null};
});
boardEl.addEventListener("pointermove",e=>{
  if(!drag)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.moved&&Math.abs(dx)+Math.abs(dy)<6)return;
  if(!drag.moved){
    drag.moved=true;
    const g=viewGame(),p=g.board[drag.from];
    const el=document.createElement("div");
    el.className="dragghost";
    const r=boardEl.getBoundingClientRect();
    el.style.cssText="position:fixed;pointer-events:none;z-index:60;width:"+(r.width/8*0.86)+"px;height:"+(r.height/8*0.86)+"px;transform:translate(-50%,-50%)";
    poserHtml(el,pieceSVG(SYM[pT(p)],pC(p)===W?"w":"b"));
    document.body.appendChild(el);
    drag.ghost=el;
    if(selected!==drag.from){selected=drag.from;render();}
  }
  if(drag.ghost){drag.ghost.style.left=e.clientX+"px";drag.ghost.style.top=e.clientY+"px";}
});
function endDrag(e){
  if(!drag)return;
  const d=drag;drag=null;
  if(d.ghost&&d.ghost.parentNode)d.ghost.parentNode.removeChild(d.ghost);
  if(!d.moved)return;
  suppressClick=true;
  setTimeout(()=>{suppressClick=false;},60);
  const to=squareFromPoint(e.clientX,e.clientY);
  if(to<0||to===d.from){selected=-1;render();return;}
  selected=d.from;
  modeClick(to);
}
boardEl.addEventListener("pointerup",endDrag);
boardEl.addEventListener("pointercancel",()=>{
  if(drag&&drag.ghost&&drag.ghost.parentNode)drag.ghost.parentNode.removeChild(drag.ghost);
  drag=null;
});

/* ==========================================================
   18. STOCKFISH (optional, GPL v3)
   ========================================================== */
const SF_PATH="engine/stockfish-18-lite-single.js";
let sf={worker:null,ready:false,busy:false};
function sfStatus(msg){const el=$("sfStatus");if(el)el.textContent=msg;}
/* Charge Stockfish si besoin et renvoie une promesse resolue a true (pret)
   ou false (echec, on continuera avec le moteur integre). Un seul point
   d'entree desormais : "Analyser la partie" l'appelle lui-meme au premier
   clic, il n'y a plus de bouton "Activer Stockfish" separe a cote. Le
   telechargement ne demarre donc qu'une fois, meme si l'analyse est lancee
   plusieurs fois de suite pendant qu'il est en cours. */
let sfLoading=null;
function sfEnable(){
  if(sf.ready)return Promise.resolve(true);
  if(sfLoading)return sfLoading;
  sfStatus(t("Fetching the engine, this can take a moment on a first visit."));
  sfLoading=new Promise(resolve=>{
    let settled=false;
    const fail=why=>{
      if(settled)return;settled=true;sfLoading=null;
      sf.worker=null;sf.ready=false;
      sfStatus(t("Stockfish could not start ({why}); this review uses the built-in engine instead.",{why:t(why)}));
      resolve(false);
    };
    try{
      const w=new Worker(SF_PATH);
      const timer=setTimeout(()=>fail("timed out"),25000);
      w.onerror=()=>{clearTimeout(timer);fail("file not found");};
      w.onmessage=ev=>{
        const line=typeof ev.data==="string"?ev.data:(ev.data&&ev.data.data)||"";
        if(/uciok/.test(line)){w.postMessage("isready");}
        else if(/readyok/.test(line)&&!settled){
          settled=true;clearTimeout(timer);sfLoading=null;
          sf.worker=w;sf.ready=true;
          sfStatus(t("Stockfish is ready."));
          resolve(true);
        }
      };
      w.postMessage("uci");
    }catch(e){fail(e.message||"blocked");}
  });
  return sfLoading;
}
function sfEvalFen(fen,depth){
  return new Promise(resolve=>{
    if(!sf.ready){resolve(null);return;}
    /* score : toujours rempli, y compris sur un mat force (grande valeur
       synthetique +-20000, uniquement pour comparer avant/apres et classer
       la qualite du coup). mate : rempli UNIQUEMENT sur un mat force, avec
       la distance signee telle que rendue par Stockfish (positif = le
       camp au trait mate en n coups, negatif = il est mate en n coups) :
       c'est cette valeur, et non score, qui doit atteindre l'affichage. */
    let score=null,mate=null,best=null,done=false;
    const finish=()=>{if(!done){done=true;sf.worker.onmessage=prev;resolve({cp:score,mate:mate,best:best});}};
    const prev=sf.worker.onmessage;
    const timer=setTimeout(finish,4000);
    sf.worker.onmessage=ev=>{
      const line=typeof ev.data==="string"?ev.data:(ev.data&&ev.data.data)||"";
      let m=line.match(/score cp (-?\d+)/);
      if(m){score=parseInt(m[1],10);mate=null;}
      m=line.match(/score mate (-?\d+)/);
      if(m){
        const n=parseInt(m[1],10);
        mate=n;
        score=(n>0?1:-1)*(20000-Math.abs(n)*100);
      }
      m=line.match(/^bestmove (\S+)/);
      if(m){best=m[1];clearTimeout(timer);finish();}
    };
    sf.worker.postMessage("position fen "+fen);
    sf.worker.postMessage("go depth "+(depth||12));
  });
}
async function analyseWithStockfish(){
  const btn=$("btnAnalyse");btn.disabled=true;btn.textContent=t("Analysing with Stockfish…");
  const bar=$("anaProgress");bar.classList.remove("hide");bar.firstElementChild.style.width="0%";
  /* gameStartFen, sinon une partie lancee depuis Analyser (position
     personnalisee) sortait de la boucle des le premier coup, et la liste
     vide etait lue comme "le moteur n'a pas repondu" : on affichait
     "Stockfish ne repond plus" alors que Stockfish allait tres bien. */
  const g=gameStartFen?new Game(gameStartFen):new Game(),plies=[],CLAMP=1200;
  for(let i=0;i<gameUci.length;i++){
    const before=await sfEvalFen(g.fen(),12);
    if(!before){break;}
    const bestUci=before.best;
    const mv=g.moves().find(x=>g.uci(x)===gameUci[i]);
    if(!mv)break;
    const mover=g.turn;
    g.makeMove(mv);
    const after=await sfEvalFen(g.fen(),12);
    const b=Math.max(-CLAMP,Math.min(CLAMP,before.cp||0));
    const a=Math.max(-CLAMP,Math.min(CLAMP,-(after&&after.cp||0)));
    /* cpTrue : la vraie valeur en centipawns (non ecretee, non substituee par
       la grande valeur synthetique d'un mat), pour l'affichage numerique.
       mate : distance de mat, perspective Blancs (positif = les Blancs
       matent), null hors mat force. after.mate est donne du point de vue du
       camp au trait APRES le coup (l'adversaire du mover), d'ou l'inversion
       de signe, comme pour after.cp plus haut. */
    const afterMateForMover=(after&&after.mate!=null)?-after.mate:null;
    const mate=afterMateForMover==null?null:(mover===W?afterMateForMover:-afterMateForMover);
    const cpTrue=(after&&after.mate==null)?(mover===W?-(after.cp||0):(after.cp||0)):null;
    plies.push({cp:mover===W?a:-a,cpTrue:cpTrue,mate:mate,loss:Math.max(0,b-a),
      tag:classify(Math.max(0,b-a),bestUci===gameUci[i]),best:bestUci,mover:mover});
    bar.firstElementChild.style.width=(100*(i+1)/gameUci.length).toFixed(0)+"%";
  }
  if(!plies.length){btn.disabled=false;btn.textContent=t("Analyse this game");bar.classList.add("hide");
    /* baseAnalyseGame(), pas analyseGame() : sf.ready=false ferait sinon
       relancer un telechargement de Stockfish au lieu du repli immediat sur
       le moteur integre qu'annonce le message. */
    sfStatus(t("Stockfish stopped responding, falling back to the built-in engine."));sf.ready=false;baseAnalyseGame();return;}
  finishAnalysis(plies);
  $("analysisNote").textContent=$("analysisNote").textContent.replace(
    t("Accuracy here is a rough guide from a shallow search, not a rating."),
    t("Analysed with Stockfish at depth 12."));
}
/* Un seul bouton, "Analyser la partie" : il utilise Stockfish s'il est deja
   pret, sinon il le telecharge d'abord (silencieusement, avec un libelle de
   progression), et se rabat sur le moteur integre si le telechargement
   echoue. Avant la fusion, il fallait cliquer "Activer Stockfish" puis
   "Analyser la partie" pour obtenir la meilleure analyse : deux moteurs,
   deux boutons, pour un seul geste ("analyser ma partie"). */
const baseAnalyseGame=analyseGame;
analyseGame=async function(){
  if(mode==="play"&&!isReviewGame&&!gameFinished()&&!analysis)return;
  if(!gameUci.length){$("analysisNote").textContent=t("Play a few moves first.");$("analysisOut").classList.remove("hide");return;}
  if(typeof focusBoard==="function")focusBoard();
  if(sf.ready){analyseWithStockfish();return;}
  const btn=$("btnAnalyse");
  btn.disabled=true;btn.textContent=t("Downloading the engine…");
  const ok=await sfEnable();
  if(!ok){
    btn.disabled=false;btn.textContent=t("Analyse this game");
    baseAnalyseGame();
    return;
  }
  analyseWithStockfish();
};
$("btnAnalyse").onclick=()=>analyseGame();

/* ==========================================================
   19. INSTALL AS AN APP
   ========================================================== */
let installEvent=null;
/* Chromium bureau envoie encore beforeinstallprompt dans la fenetre d'une
   application deja installee : le bouton "Installer l'application"
   apparaissait donc DANS l'application, et pas dans le navigateur, ou
   l'evenement ne part plus une fois l'installation faite. Exactement
   l'inverse de ce qu'il faut. On ne se fie donc pas a la seule presence de
   l'evenement, on regarde le mode d'affichage reel. window-controls-overlay
   couvre les fenetres d'application de bureau, navigator.standalone iOS. */
function estDejaInstallee(){
  if(navigator.standalone===true)return true;
  if(!window.matchMedia)return false;
  return ["standalone","window-controls-overlay","minimal-ui","fullscreen"]
    .some(m=>matchMedia("(display-mode: "+m+")").matches);
}
window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();installEvent=e;
  if(estDejaInstallee())return;
  const b=$("btnInstall");if(b)b.classList.remove("hide");
});
/* Le navigateur qui vient de faire l'installation garde l'onglet ouvert :
   sans ceci le bouton resterait propose alors qu'il n'a plus d'objet. */
window.addEventListener("appinstalled",()=>{
  installEvent=null;
  const b=$("btnInstall");if(b)b.classList.add("hide");
});
const bi=$("btnInstall");
if(bi)bi.onclick=async()=>{
  if(!installEvent){bi.textContent=t("Use your browser menu: Add to home screen");return;}
  installEvent.prompt();
  try{await installEvent.userChoice;}catch(e){}
  installEvent=null;bi.classList.add("hide");
};
if("serviceWorker" in navigator&&location.protocol==="https:"){
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  });
}

/* ==========================================================
   19c. ECHIQUIER ANIME DE L'ACCUEIL
   ========================================================== */
/* Partie de l'Opera : Morphy contre le duc de Brunswick et le comte
   Isouard, Paris 1858. Choisie pour trois raisons : 33 demi-coups, donc une
   boucle d'une quarantaine de secondes et non de plusieurs minutes ; elle
   finit sur un vrai mat et pas sur un abandon, donc la boucle a une fin
   nette ; et elle est assez connue pour etre reconnue par une partie des
   visiteurs. Les coups d'une partie sont des faits, pas une oeuvre.
   Stockee en UCI, 164 octets. Le moteur du site la rejoue a la volee : rien
   n'est precalcule, aucune position n'est stockee, aucune image n'est
   chargee. Les cases et les pieces reprennent les classes du vrai plateau,
   donc le visuel suit aussi le theme d'echiquier choisi dans les
   preferences, sans une ligne de CSS en plus. Verifiee contre engine.js :
   les 33 coups sont legaux et le dernier est bien mat. */
const COUPS_ACCUEIL=("e2e4 e7e5 g1f3 d7d6 d2d4 c8g4 d4e5 g4f3 d1f3 d6e5 f1c4 g8f6 f3b3 d8e7 "+
  "b1c3 c7c6 c1g5 b7b5 c3b5 c6b5 c4b5 b8d7 e1c1 a8d8 d1d7 d8d7 h1d1 e7e6 b5d7 f6d7 "+
  "b3b8 d7b8 d1d8").split(" ");
const CADENCE_ACCUEIL=1100;   /* un demi-coup toutes les 1,1 s */
const PAUSE_MAT_ACCUEIL=3400; /* le mat reste affiche avant de reboucler */
let partieAccueil=null,plyAccueil=0,minuteurAccueil=null,accueilVisible=false;
function cellulesAccueil(){
  const el=$("heroBoard"); if(!el)return null;
  if(!el.childElementCount){
    for(let i=0;i<64;i++){
      const c=document.createElement("div");
      /* Meme calcul que idxToSq() (ui.js) mais sans "flipped" : ce plateau
         n'est jamais retourne, il ne depend pas de l'etat de la partie en
         cours de la personne. */
      const r=Math.floor(i/8),f=i%8;
      c.className="sq "+(((r+f)%2===1)?"d":"l");
      c.dataset.sq=String(r*16+f);
      el.appendChild(c);
    }
  }
  return el;
}
function dessinerAccueil(coup){
  const el=cellulesAccueil(); if(!el||!partieAccueil)return;
  const cells=el.children;
  for(let i=0;i<64;i++){
    const r=Math.floor(i/8),f=i%8,sq=r*16+f;
    const c=cells[i],p=partieAccueil.board[sq];
    let cls="sq "+(((r+f)%2===1)?"d":"l");
    if(coup&&(sq===coup.from||sq===coup.to))cls+=" last";
    c.className=cls;
    poserHtml(c,p?'<span class="piece">'+pieceSVG(SYM[pT(p)],pC(p)===W?"w":"b")+"</span>":"");
  }
  if(!coup)return;
  /* Glissement : la piece est deja dessinee sur sa case d'arrivee, on la
     repart visuellement de sa case de depart puis on relache au cadre
     suivant. Le decalage se calcule en cases et non en pixels mesures, ce
     qui reste juste quelle que soit la taille du plateau et n'oblige a lire
     aucune geometrie (donc aucun reflow force). */
  const dep=cells[(coup.from>>4)*8+(coup.from&7)];
  const arr=cells[(coup.to>>4)*8+(coup.to&7)];
  const piece=arr&&arr.firstElementChild;
  if(!dep||!piece)return;
  const dx=((coup.from&7)-(coup.to&7))*100,dy=(((coup.from>>4))-((coup.to>>4)))*100;
  piece.style.transform="translate("+dx+"%,"+dy+"%)";
  requestAnimationFrame(()=>{
    piece.classList.add("slide");
    piece.style.transform="";
  });
}
function coupSuivantAccueil(){
  if(!partieAccueil)return;
  if(plyAccueil>=COUPS_ACCUEIL.length){
    /* Fin de boucle : on repart de zero. dessinerAccueil() sans coup, donc
       sans glissement, sinon les 32 pieces glisseraient toutes a la fois. */
    partieAccueil=new Game();plyAccueil=0;dessinerAccueil(null);
    minuteurAccueil=setTimeout(coupSuivantAccueil,CADENCE_ACCUEIL);
    return;
  }
  const u=COUPS_ACCUEIL[plyAccueil++];
  const mv=partieAccueil.moves().find(m=>partieAccueil.uci(m)===u);
  /* Un coup introuvable ne devrait pas arriver (la suite est verifiee), mais
     on s'arrete proprement plutot que de boucler sur une position figee. */
  if(!mv){arreterAccueil();return;}
  partieAccueil.makeMove(mv);
  dessinerAccueil(mv);
  const fini=plyAccueil>=COUPS_ACCUEIL.length;
  minuteurAccueil=setTimeout(coupSuivantAccueil,fini?PAUSE_MAT_ACCUEIL:CADENCE_ACCUEIL);
}
function arreterAccueil(){
  if(minuteurAccueil){clearTimeout(minuteurAccueil);minuteurAccueil=null;}
}
function demarrerAccueil(){
  if(minuteurAccueil||!accueilVisible||document.hidden)return;
  if(!partieAccueil){partieAccueil=new Game();plyAccueil=0;dessinerAccueil(null);}
  minuteurAccueil=setTimeout(coupSuivantAccueil,CADENCE_ACCUEIL);
}
/* Doit rester alignee sur la media query de .hero-visual dans
   template.html : en dessous de ce seuil le bloc est en display:none, et il
   ne s'agit pas seulement de ne pas l'animer mais de ne rien construire du
   tout. Dessiner 32 pieces SVG dans un element invisible serait du travail
   pur perte sur chaque chargement mobile, c'est-a-dire sur la majorite. */
const REQUETE_ACCUEIL="(min-width:700px)";
let accueilPret=false,ecouteAccueil=false;
function initAccueilAnime(){
  const el=$("heroBoard"); if(!el)return;
  const mq=window.matchMedia?matchMedia(REQUETE_ACCUEIL):null;
  /* Une rotation en paysage franchit le seuil : on construit a ce
     moment-la plutot que jamais. Une seule inscription, quel que soit le
     nombre d'allers-retours. */
  if(mq&&mq.addEventListener&&!ecouteAccueil){
    ecouteAccueil=true;
    mq.addEventListener("change",()=>initAccueilAnime());
  }
  if(mq&&!mq.matches){arreterAccueil();return;}
  if(accueilPret)return;
  accueilPret=true;
  cellulesAccueil();
  partieAccueil=new Game();plyAccueil=0;dessinerAccueil(null);
  /* Mouvement reduit : on montre la position finale, immobile. Le but du
     bloc est de montrer l'echiquier, pas le mouvement ; le supprimer
     entierement priverait ces personnes du visuel pour rien. */
  if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches){
    for(const u of COUPS_ACCUEIL){
      const mv=partieAccueil.moves().find(m=>partieAccueil.uci(m)===u);
      if(!mv)break;
      partieAccueil.makeMove(mv);
    }
    dessinerAccueil(null);
    return;
  }
  /* Ne tourner que quand le bloc est reellement a l'ecran. Cela couvre d'un
     coup les trois cas ou l'animation ne servirait a rien et couterait du
     processeur : onglet du site quitte (le panneau d'accueil passe en
     display:none, donc plus d'intersection), page defilee plus bas, et
     onglet du navigateur en arriere-plan (visibilitychange ci-dessous). */
  if(window.IntersectionObserver){
    new IntersectionObserver(entries=>{
      accueilVisible=entries.some(e=>e.isIntersecting);
      if(accueilVisible)demarrerAccueil();else arreterAccueil();
    },{threshold:.15}).observe(el);
  } else {
    accueilVisible=true;demarrerAccueil();
  }
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden)arreterAccueil();else demarrerAccueil();
  });
}
initAccueilAnime();

/* ==========================================================
   19b. LANGUAGE SWITCH
   ========================================================== */
function renderCoordHud(){
  const set=(id,k)=>{const el=$(id); if(el)el.textContent=t(k);};
  set("chudLabel","Find");set("chudTimeLabel","Seconds");
  set("chudScoreLabel","Correct");set("chudMissLabel","Missed");
}
function refreshCurrentMode(){
  applyI18n();
  renderCoordHud();
  if(typeof disarmResign==="function"&&resigned===null)disarmResign();
  const ar=$("btnAmiResign");
  if(ar&&!ar.classList.contains("armed"))ar.textContent=t("Resign this game");
  /* Les finales vivent desormais dans l'onglet Exercices : leur rendu doit
     suivre ce mode-la, pas "train" qui ne contient plus qu'elles nommement. */
  if(mode==="puzzles"&&puzzle){loadPuzzle();renderEgChips();renderEndgame();}
  else if(mode==="train"){renderEgChips();renderEndgame();}
  else if(mode==="friend")showAmi();
  else if(mode==="play"){refreshGame();}
  else if(mode==="watch")renderChannels();
  else if(mode==="legal")renderLegal();
  syncTC();renderExplore();renderHistory();
  renderProgress();renderExtraStats();
  /* Sous-titres des 5 tuiles du menu Resoudre (Niveau, À faire, Record...) :
     composes en JS par renderSolveMenu() (ui2.js), donc hors d'applyI18n
     qui ne retraduit que le texte statique du HTML. Sans cet appel, basculer
     la langue pendant que ce menu est affiche laissait ces sous-titres dans
     l'ancienne langue -- le seul appel existant a renderSolveMenu() se
     trouve dans showSolveScreen("menu"), jamais rejoue ici. Appel
     inconditionnel comme les autres lignes ci-dessus (renderHistory etc.) :
     sans cout reel puisque set() ne touche que des elements deja dans le
     DOM, visibles ou non. */
  if(typeof renderSolveMenu==="function")renderSolveMenu();
  shareButtons($("siteShare"),baseUrl(),t("Come play chess on chang64:"),true);
  const n=$("tcNote"); if(n&&TC_NOTES[tcCat])n.textContent=t(TC_NOTES[tcCat]);
  renderDailyChips();
}
$("langSwitch").addEventListener("click",e=>{
  const b=e.target.closest("button"); if(!b)return;
  if(LANG===b.dataset.lang)return;
  LANG=b.dataset.lang;
  saveLang();
  refreshCurrentMode();
  /* le panneau de preferences est construit en JS : il ne passe pas par
     applyI18n et doit donc etre redessine a la bascule de langue */
  if(typeof renderPrefs==="function"&&mode==="prefs")renderPrefs();
  if(typeof renderFullCalendar==="function"&&mode==="calendar")renderFullCalendar();
  /* Le nom de l'adversaire porte la force ("Chang · Coriace"), composee en
     JavaScript : elle ne passe pas par applyI18n et resterait en anglais
     apres un changement de langue. */
  if(typeof renderClocks==="function")renderClocks();
  /* L'overlay de preparation est compose en JavaScript : il ne passe pas par
     applyI18n et restait dans l'ancienne langue s'il etait affiche au moment
     de la bascule. */
  const rb=$("readyBanner");
  if(rb&&!rb.classList.contains("hide")&&typeof showReady==="function"){
    try{
      const {cat,item}=tcCurrent();
      showReady(cat==="none"?t("No clock"):tcLabel(cat,item)+" "+t(cat.charAt(0).toUpperCase()+cat.slice(1)));
    }catch(e){}
  }
});

/* ==========================================================
   20. MODE EXTENSION FOR TRAIN
   ========================================================== */
/* Sprint et Coordonnees partagent toujours ce mode ("train" en interne,
   plus d'onglet dedie dans la nav depuis le menu a 5 cartes du
   2026-09-03) -- trainView dit lequel des deux lanceurs afficher.
   Defaut "sprint" : au cas ou quelque chose appellerait setMode("train")
   sans etre passe par une carte du menu (lien profond, etc.). */
let trainView="sprint";
const prevSetMode=setMode;
setMode=function(m,opts){
  if(coord)stopCoord();
  if(m==="train"){
    if(mode==="play"&&game){mainGame=game;mainSan=sanList;mainLast=lastMove;mainStarted=gameStarted;mainFlipped=flipped;}
    mode="train";
    const tabs={play:"tab-play",puzzles:"tab-puzzles",edit:"tab-edit",friend:"tab-friend",watch:"tab-watch",explore:"tab-explore"};
    /* "Resoudre" reste surligne pendant Chang Sprint/Coordonnees (bug
       trouve en verifiant les autres endroits touches par la disparition
       de l'onglet "S'entrainer") : ce tableau ne referencait plus "train"
       du tout depuis que tab-train a ete retire du HTML (2026-09-03,
       remplace par le menu a 5 cartes) -- aucune cle ne valait jamais m
       ("train"), donc AUCUN onglet ne restait marque selectionne des
       qu'on lancait un sprint ou une seance de coordonnees. Or les deux
       s'atteignent desormais depuis les cartes du menu de "Resoudre"
       (cardSolveSprint/cardSolveCoord, voir ui2.js) : tab-puzzles doit
       donc rester actif tant que mode==="train", pas seulement quand
       m==="puzzles" a la lettre. */
    for(const k in tabs)markTab($(tabs[k]),k==="puzzles"?(m===k||m==="train"):k===m);
    $("pane-home").classList.add("hide");
    $("pane-watch").classList.add("hide");
    { const pex=$("pane-explore"); if(pex)pex.classList.add("hide"); }
    { const pcal=$("pane-calendar"); if(pcal)pcal.classList.add("hide"); }
    $("pane-legal").classList.add("hide");
    $("appLayout").classList.remove("hide");
    $("pane-play").classList.add("hide");
    $("pane-puzzles").classList.add("hide");
    $("pane-friend").classList.add("hide");
    $("pane-train").classList.remove("hide");
    /* Un seul des deux lanceurs visible a la fois : Sprint et Coordonnees
       sont deux cartes distinctes du menu desormais (2026-09-03), plus
       une paire toujours affichee ensemble comme du temps de l'onglet
       "Entrainement". */
    { const rl=$("rushLauncher"); if(rl)rl.classList.toggle("hide",trainView!=="sprint"); }
    { const cl=$("coordLauncher"); if(cl)cl.classList.toggle("hide",trainView!=="coord"); }
    /* Resynchronise l'etat (visible/cache, texte, couleur) du bouton
       "Start Chang Sprint" a chaque entree sur Defis (item 5) : couvre le
       tout premier arrivage (avant meme un clic sur la carte), et evite
       tout residu visuel d'un etat precedent si on revient ici entre deux
       ecrans sans etre passe par rushEnd()/beginRushFlow(). */
    if(typeof desarmerRush==="function")desarmerRush();
    /* Le plateau reste cache tant que la partie Jouer n'a pas demarre (voir
       updatePlayBoardVisibility) : cette branche gerant elle-meme son
       propre mode, sans jamais redescendre vers la logique centrale de
       setMode() (ui.js) qui s'en charge d'habitude, cet etat "cache"
       restait colle en arrivant ici depuis l'ecran de reglages de Jouer --
       alors que Chang Sprint/coordonnees en ont besoin des l'entree. */
    { const bw=document.querySelector(".board-wrap"); if(bw)bw.classList.remove("hide"); }
    if(typeof majLayoutSolo==="function")majLayoutSolo();
    $("evalwrap").classList.add("hide");
    $("clockTop").classList.add("hide");$("clockBottom").classList.add("hide");
    $("coordHud").classList.add("hide");
    renderCoordHud();
    $("coordBest").textContent=prog.coordBest||0;
    /* Les finales ont demenage dans Exercices (voir refreshCurrentMode et
       setMode("puzzles") dans ui.js), et ont depuis leur propre ecran dans
       le menu a 5 cartes (2026-09-03) : elles ne vivent plus ici. Ce bloc
       appelait auparavant startEndgame("kq") a chaque arrivee sur Defis,
       ce qui ecrasait silencieusement l'echiquier partage avec une
       position Dame+Roi generee au hasard, sans aucune puce ni statut
       visible pour l'expliquer. On ne touche plus a l'echiquier ici (ni
       startEndgame, ni reassignation de game) : il garde son dernier
       contenu jusqu'a ce que Sprint ou Coordonnees le remplacent
       explicitement au demarrage. render() reste necessaire quand Defis
       est le tout premier ecran visite dans la session (avant Jouer ou
       Resoudre) : sans lui, l'echiquier serait construit mais jamais
       peint. */
    render();
    return;
  }
  $("pane-train").classList.add("hide");
  prevSetMode(m,opts);
};

/* clics du plateau : router vers l'entraînement, et ignorer le clic issu d'un glisser */
const baseOnSquare=onSquare;
onSquare=function(e){
  if(suppressClick)return;
  /* Un Chang Sprint lance depuis Defis tourne avec mode==="train" : sans ce
     garde, les clics partaient vers handleTrainClick, qui gere les finales et
     les coordonnees, et l'exercice ne passait jamais au suivant. Le sprint
     prime donc sur l'onglet courant. */
  if(mode==="train"&&!(typeof rush!=="undefined"&&rush)){
    const i=Array.prototype.indexOf.call(boardEl.children,e.currentTarget);
    handleTrainClick(idxToSq(i));
    return;
  }
  baseOnSquare(e);
};
buildBoard();

/* le plateau vide du drill de coordonnées */
const baseRender2=render;
render=function(){
  baseRender2();
  if(coord){
    for(const p of boardEl.querySelectorAll(".piece"))p.remove();
    for(const c of boardEl.querySelectorAll(".co"))c.remove();
  }
};

/* ==========================================================
   PREFERENCES : themes d'echiquier, annonces, clavier
   ==========================================================
   Deux reglages, tous deux enregistres sur l'appareil :
   - la couleur du damier, posee en attribut data-board sur <html>
   - les annonces aux lecteurs d'ecran, desactivees par defaut

   Les annonces sont volontairement en opt-in. Une zone aria-live qui
   parle sans qu'on l'ait demande est penible pour qui utilise un lecteur
   d'ecran sur un site ou il ne s'y attend pas, et inutile pour tous les
   autres. Trois niveaux : rien, les coups seuls, les coups et l'etat.
   ========================================================== */
const BOARD_THEMES=[
  {id:"olive", en:"Olive",  fr:"Olive"},
  {id:"walnut",en:"Walnut", fr:"Noyer"},
  {id:"slate", en:"Slate",  fr:"Ardoise"},
  {id:"ink",   en:"Ink",    fr:"Encre"},
  {id:"moss",  en:"Moss",   fr:"Mousse"}
];
let prefBoard="olive",prefAnnounce="off";

async function loadPrefs(){
  try{
    const r=await window.storage.get("chang64:prefs");
    if(r&&r.value){
      const d=JSON.parse(r.value);
      if(BOARD_THEMES.some(x=>x.id===d.board))prefBoard=d.board;
      if(["off","moves","full"].includes(d.announce))prefAnnounce=d.announce;
      /* Animation activee par defaut : seule une valeur explicitement fausse
         la desactive, pour qu'une preference absente ne la coupe pas. */
      if(typeof d.anim==="boolean")animOn=d.anim;
    }
  }catch(e){}
  applyBoardTheme();
}
async function savePrefs(){
  try{await window.storage.set("chang64:prefs",JSON.stringify({board:prefBoard,announce:prefAnnounce,anim:animOn}));}catch(e){}
}
function applyBoardTheme(){
  document.documentElement.setAttribute("data-board",prefBoard);
}

/* ---------- annonces ---------- */
let lastAnnounce="";
function announce(msg,level){
  if(prefAnnounce==="off")return;
  if(level==="status"&&prefAnnounce!=="full")return;
  const el=$("srAnnounce");
  if(!el||!msg)return;
  /* un texte identique au precedent n'est pas relu : on force le changement */
  el.textContent = msg===lastAnnounce ? msg+"\u00a0" : msg;
  lastAnnounce=el.textContent;
}
/* Corrige le 2026-09-06 : la rangee etait calculee 1+(s>>4) alors que tout le
   reste du projet utilise 8-(s>>4) -- engine_browser.js l.11 (sqN, la
   reference du moteur) et sqLabel() dans ui.js. Les deux formules sont
   l'image miroir l'une de l'autre et ne coincident pour aucune rangee, donc
   les 64 cases etaient annoncees a l'envers : la tour noire en a8 etait
   annoncee "a1". Mesure avant correction : 0 case sur 64 ou le nom accessible
   et l'annonce concordaient. Ne pas "simplifier" en 1+(s>>4) : c'est la
   numerotation interne du damier 0x88, pas le nom lu par un humain. */
const SQ_NAMES=(()=>{
  const o={};
  for(let s=0;s<128;s++){
    if(s&0x88)continue;
    o[s]="abcdefgh"[s&7]+(8-(s>>4));
  }
  return o;
})();
function sqName(s){return SQ_NAMES[s]||"";}
const PIECE_WORDS={
  en:{p:"pawn",n:"knight",b:"bishop",r:"rook",q:"queen",k:"king"},
  fr:{p:"pion",n:"cavalier",b:"fou",r:"tour",q:"dame",k:"roi"}
};
function pieceWord(ch){
  const k=(ch||"").toLowerCase();
  return (PIECE_WORDS[LANG==="fr"?"fr":"en"][k])||"";
}
/* "tour" et "dame" sont feminins, les quatre autres pieces masculines : sans
   cet accord, une annonce disait "tour blanc en h1" et "dame noir en d8"
   (2026-09-05). Ce n'est pas un detail de style pour un lecteur d'ecran,
   c'est la seule information qu'il prononce a voix haute. */
const PIECES_FEM={r:true,q:true};
function sideWord(ch,isWhite){
  if(LANG!=="fr")return isWhite?"white":"black";
  const fem=PIECES_FEM[(ch||"").toLowerCase()];
  return isWhite?(fem?"blanche":"blanc"):(fem?"noire":"noir");
}

/* ---------- navigation clavier sur l'echiquier ----------
   Une seule case est atteignable a la tabulation (tabindex roulant) :
   sans cela, traverser l'echiquier demanderait 64 pressions de Tab.
   Une fois dedans, les fleches deplacent le curseur case par case. */
let kbdIdx=56;   /* a1 : la case que buildBoard rend atteignable au Tab */
function boardCells(){return boardEl?boardEl.children:[];}
function setRoving(i){
  const cells=boardCells();
  if(!cells.length)return;
  i=Math.max(0,Math.min(63,i));
  for(let k=0;k<cells.length;k++)cells[k].tabIndex = k===i?0:-1;
  kbdIdx=i;
}
/* Plus d'annonce de case dans la region live (2026-09-06).
   Deux fonctions decrivaient la meme case et avaient fini par se contredire :
   sqLabel() posait le nom accessible que le lecteur d'ecran lit quand le
   focus arrive sur la case, announceCell() ecrivait sa propre phrase dans la
   region live. Une fois les deux remises d'accord, le defaut restant sautait
   aux yeux : elles disaient exactement la meme chose, donc l'utilisateur
   l'entendait deux fois.
   On garde le nom accessible et on retire l'annonce. Le focus est le bon
   canal ici : la navigation aux fleches n'existe que quand une case a le
   focus (voir le gestionnaire keydown plus bas, qui exige que e.target soit
   une case), donc le lecteur d'ecran annonce forcement le nom au moment ou
   le curseur bouge. La region live n'ajoutait rien.
   Elle reste utilisee pour ce que le focus ne dit jamais : les coups joues,
   le statut de la partie, l'annulation d'une selection. Le reglage
   "Annonces aux lecteurs d'ecran" continue donc de servir.
   Une case vide n'est plus dite "case vide e6" mais "e6", ce qui reste sans
   ambiguite : une case occupee nomme toujours sa piece. */
function focusCell(i){
  setRoving(i);
  const c=boardCells()[i];
  if(c)c.focus();
}
if(typeof boardEl!=="undefined"&&boardEl){
  boardEl.addEventListener("keydown",e=>{
    const cells=boardCells();
    if(!cells.length)return;
    let i=Array.prototype.indexOf.call(cells,e.target);
    if(i<0)return;
    let n=null;
    switch(e.key){
      case "ArrowRight": n=(i%8===7)?i:i+1; break;
      case "ArrowLeft":  n=(i%8===0)?i:i-1; break;
      case "ArrowUp":    n=(i<8)?i:i-8;     break;
      case "ArrowDown":  n=(i>55)?i:i+8;    break;
      case "Home":       n=i-(i%8);         break;
      case "End":        n=i-(i%8)+7;       break;
      case "PageUp":     n=i%8;             break;
      case "PageDown":   n=56+(i%8);        break;
      case "Escape":
        if(typeof selected!=="undefined"&&selected>=0){
          e.preventDefault();
          selected=-1;
          try{render();}catch(err){}
          announce(LANG==="fr"?"selection annulee":"selection cleared","cell");
        }
        return;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();   /* ne pas declencher la navigation dans la partie */
    focusCell(n);
  });
  boardEl.addEventListener("focusin",e=>{
    const i=Array.prototype.indexOf.call(boardCells(),e.target);
    if(i>=0)setRoving(i);
  });
}
/* Le tabindex roulant est pose directement dans buildBoard (ui.js) : une
   surcharge ici ne fonctionnerait pas, buildBoard etant une declaration de
   fonction dont les appels internes ne passent pas par la reassignation. */

/* ---------- avertissement de stockage ---------- */
/* Pose ici et pas dans ui.js : le texte doit passer par t(), qui vit dans
   i18n.js, et suivre un changement de langue comme le reste de l'interface.
   collectI18n() ne peut pas s'en charger, l'element etant vide au chargement
   et rempli seulement si le stockage lache. */
function majAvertissementStockage(){
  const el=$("storageWarn");
  if(!el)return;
  if(!window.storageMemoireSeule){el.classList.add("hide");el.textContent="";return;}
  el.textContent=t("This browser isn't keeping your progress: it will be lost when you close the tab. Private browsing or a full storage can cause this.");
  el.classList.remove("hide");
}
window.addEventListener("chang64:stockage-memoire",majAvertissementStockage);
majAvertissementStockage();
/* Retraduit avec le reste quand la langue change. */
if(typeof applyI18n==="function"){
  const baseApply=applyI18n;
  applyI18n=function(){baseApply.apply(this,arguments);majAvertissementStockage();};
}

/* ---------- annonce des coups joues ---------- */
if(typeof playUser==="function"){
  const basePlayUser3=playUser;
  playUser=function(m){
    basePlayUser3(m);
    try{
      const san=sanList&&sanList.length?sanList[sanList.length-1]:"";
      if(san)announce((LANG==="fr"?"Toi : ":"You: ")+san,"move");
    }catch(e){}
  };
}
if(typeof botMove==="function"){
  const baseBotMove3=botMove;
  botMove=function(){
    const before=(typeof sanList!=="undefined"&&sanList)?sanList.length:0;
    baseBotMove3.apply(this,arguments);
    try{
      if(sanList&&sanList.length>before){
        const san=sanList[sanList.length-1];
        announce((LANG==="fr"?"Adversaire : ":"Opponent: ")+san,"move");
        const g=viewGame();
        if(g.isCheckmate())announce(LANG==="fr"?"Echec et mat":"Checkmate","status");
        else if(g.inCheck())announce(LANG==="fr"?"Echec":"Check","status");
      }
    }catch(e){}
  };
}

/* ---------- interface des preferences ---------- */
function renderPrefs(){
  const fr=LANG==="fr";
  const set=(id,txt)=>{const e=$(id);if(e)e.textContent=txt;};
  set("prefsTitle",fr?"Préférences":"Preferences");
  set("prefsSub",fr?"Enregistrées sur cet appareil. Rien n'est envoyé ailleurs."
                  :"Kept on this device. Nothing is sent anywhere.");
  set("prefsBoardLabel",fr?"Couleurs de l'échiquier":"Board colours");
  set("accessibilite",fr?"Accessibilité":"Accessibility");
  set("prefsA11yIntro",fr?"Deux réglages pour jouer sans souris et pour faire lire la partie à voix haute."
                        :"Two settings, to play without a mouse and to have the game read aloud.");
  set("prefsA11yLabel",fr?"Annonces aux lecteurs d'écran":"Screen reader announcements");
  set("prefsA11yNote",fr?"Désactivées par défaut. Une fois activées, les coups joués et l'état de la partie sont annoncés à voix haute par ton lecteur d'écran."
                       :"Off by default. Once on, moves and game state are read aloud by your screen reader.");
  set("prefsKbdLabel",fr?"Clavier":"Keyboard");
  set("footAccess",fr?"Accessibilité":"Accessibility");
  set("footPrefs",fr?"Préférences":"Preferences");

  const box=$("boardThemes");
  if(box){
    poserHtml(box,"");
    for(const th of BOARD_THEMES){
      const b=document.createElement("button");
      b.className="chip";
      b.type="button";
      b.setAttribute("role","radio");
      /* aria-checked seul, comme segAnnounce : aria-pressed n'est pas valide
         sur role="radio". Le style suit desormais les deux attributs (voir
         .chip[aria-checked] dans la feuille), donc plus rien n'oblige a
         porter le doublon. */
      b.setAttribute("aria-checked",String(th.id===prefBoard));
      b.textContent=fr?th.fr:th.en;
      b.onclick=()=>{
        prefBoard=th.id;applyBoardTheme();savePrefs();renderPrefs();
        announce((fr?"Échiquier ":"Board ")+(fr?th.fr:th.en),"cell");
      };
      box.appendChild(b);
    }
  }
  const prev=$("themePreview");
  if(prev&&!prev.childElementCount){
    for(let r=0;r<4;r++)for(let f=0;f<8;f++){
      const i=document.createElement("i");
      i.className=((r+f)%2===0)?"l":"d";
      prev.appendChild(i);
    }
  }
  const segA=$("segAnim");
  if(segA){
    const lab=fr?{on:"Activée",off:"Désactivée"}:{on:"On",off:"Off"};
    poserHtml(segA,"");
    for(const v of ["on","off"]){
      const b=document.createElement("button");
      b.type="button";
      b.setAttribute("data-v",v);
      b.setAttribute("role","radio");
      const actif=(v==="on")===animOn;
      /* Idem : aria-checked seul sur un role="radio". */
      b.setAttribute("aria-checked",String(actif));
      b.textContent=lab[v];
      b.onclick=()=>{animOn=(v==="on");savePrefs();renderPrefs();};
      segA.appendChild(b);
    }
  }
  const seg=$("segAnnounce");
  if(seg){
    const labels=fr?{off:"Aucune",moves:"Les coups",full:"Coups et état"}
                  :{off:"Off",moves:"Moves",full:"Moves and status"};
    poserHtml(seg,"");
    for(const v of ["off","moves","full"]){
      const b=document.createElement("button");
      b.type="button";
      b.setAttribute("data-v",v);
      b.setAttribute("role","radio");
      /* aria-checked seul (2026-09-06) : aria-pressed n'est pas valide sur
         role="radio", il appartient au patron bouton bascule. Les porter tous
         les deux fait annoncer deux etats concurrents pour un seul controle
         par certains lecteurs d'ecran. Le groupe est bien un radiogroup, voir
         le conteneur segAnnounce dans le gabarit. */
      b.setAttribute("aria-checked",String(v===prefAnnounce));
      b.textContent=labels[v];
      b.onclick=()=>{
        prefAnnounce=v;savePrefs();renderPrefs();
        if(v!=="off")announce(fr?"Annonces activées":"Announcements on","cell");
      };
      seg.appendChild(b);
    }
  }
  const help=$("kbdHelp");
  if(help){
    poserHtml(help,fr
      ? "<p>Sur l'échiquier : les <b>flèches</b> déplacent le curseur, <b>Entrée</b> ou <b>Espace</b> sélectionne une pièce puis sa case d'arrivée, <b>Échap</b> annule la sélection. <b>Origine</b> et <b>Fin</b> vont au bord de la rangée, <b>Page haut</b> et <b>Page bas</b> aux extrémités de la colonne.</p>"
      : "<p>On the board: <b>arrow keys</b> move the cursor, <b>Enter</b> or <b>Space</b> picks a piece then its destination, <b>Escape</b> clears the selection. <b>Home</b> and <b>End</b> jump to the edge of the rank, <b>Page Up</b> and <b>Page Down</b> to the ends of the file.</p>");
  }
}
if($("homeStartBtn"))$("homeStartBtn").onclick=()=>setMode("puzzles");
if($("footPrefs"))$("footPrefs").onclick=()=>{setMode("prefs");goTop();};
/* Lien dedie : "Preferences" est trop generique pour qui cherche des reglages
   d'accessibilite. Le second lien mene au meme panneau mais amene directement
   a la section, et lui donne le focus pour les lecteurs d'ecran. */
if($("footAccess"))$("footAccess").onclick=()=>{
  setMode("prefs");
  goToSection("accessibilite");   /* meme mecanique que les autres sections */
};
loadPrefs();

/* ==========================================================
   BULLES D'INFO PEDAGOGIQUES
   ========================================================== */
/* Gestionnaire delegue unique : chaque bulle est un simple couple bouton
   (.info-tip, aria-controls -> id du texte) + texte (.info-tip-pop, cache
   par defaut). Pas de re-branchement necessaire quand un panneau est
   recree ou reaffiche dynamiquement (Entre amis, banniere de reprise...),
   puisque la delegation se fait sur le document entier. Une seule bulle
   ouverte a la fois, pour rester discret : en ouvrir une referme les
   autres. */
function closeAllInfoTips(){
  document.querySelectorAll(".info-tip-pop:not(.hide)").forEach(p=>p.classList.add("hide"));
  document.querySelectorAll('.info-tip[aria-expanded="true"]').forEach(b=>b.setAttribute("aria-expanded","false"));
}
document.addEventListener("click",e=>{
  const btn=e.target.closest(".info-tip");
  if(btn){
    const pop=document.getElementById(btn.getAttribute("aria-controls"));
    if(!pop)return;
    const willOpen=pop.classList.contains("hide");
    closeAllInfoTips();
    if(willOpen){pop.classList.remove("hide");btn.setAttribute("aria-expanded","true");}
    return;
  }
  if(!e.target.closest(".info-tip-pop"))closeAllInfoTips();
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeAllInfoTips();});

/* ==========================================================
   EDITEUR DE POSITION (onglet Analyse)
   ========================================================== */
/* Reutilise directement la variable globale "game" (comme Jouer et Entre
   amis), pas un objet dedie : render(), pieceSVG() et le reste du rendu du
   plateau partage n'ont donc rien de nouveau a apprendre. editGame/
   editGameTurn memorisent la composition en cours quand on quitte l'onglet,
   sur le meme principe que mainGame pour Jouer -- sinon revenir sur Analyse
   apres un detour par Exercices ou Entre amis effacerait la position. */
let editTool=null,editTurnVal="w",editGame=null,editGameTurn="w";
/* Glisser-depose : etat de bas niveau, voir la section dediee plus bas
   (apres editRenderPalette) pour le detail de la mecanique. */
let editDrag=null,editDragJustHappened=false;
const EDIT_DRAG_THRESHOLD=6;
const EDIT_ORDER=["k","q","r","b","n","p"];
function editPieceName(sym){
  const names={k:t("King"),q:t("Queen"),r:t("Rook"),b:t("Bishop"),n:t("Knight"),p:t("Pawn")};
  return names[sym]||sym;
}
function editRenderPalette(){
  for(const color of ["w","b"]){
    const el=$(color==="w"?"editPalWhite":"editPalBlack"); if(!el)continue;
    poserHtml(el,"");
    for(const sym of EDIT_ORDER){
      const b=document.createElement("button");
      b.type="button";
      poserHtml(b,pieceSVG(sym,color));
      b.setAttribute("aria-pressed","false");
      b.setAttribute("aria-label",editPieceName(sym)+" ("+(color==="w"?t("White"):t("Black"))+")");
      b.onclick=()=>selectEditTool(sym,color);
      b.addEventListener("pointerdown",ev=>{
        if(typeof editPointerDown==="function")editPointerDown(ev,{source:"palette",tool:{t:sym,c:color}});
      });
      el.appendChild(b);
    }
  }
}
function selectEditTool(sym,color){
  editTool={t:sym,c:color};
  document.querySelectorAll(".editpal button").forEach(b=>b.setAttribute("aria-pressed","false"));
  const idx=EDIT_ORDER.indexOf(sym);
  const el=$(color==="w"?"editPalWhite":"editPalBlack");
  if(el&&el.children[idx])el.children[idx].setAttribute("aria-pressed","true");
}
function handleEditorClick(sq){
  /* Le "click" natif qui suit un vrai glissement (voir la mecanique de
     glisser-depose plus bas) est ignore ici : le glissement a deja tout
     fait, ce clic fantome ne doit rien refaire par-dessus. */
  if(editDragJustHappened){editDragJustHappened=false;return;}
  /* Taper une case deja occupee la vide, quel que soit l'outil en main :
     c'est le geste le plus naturel pour corriger une position, et evite un
     bouton "gomme" separe. Sinon, poser la piece choisie dans la palette.
     Exception : le roi ne peut jamais etre retire, seulement deplace --
     une position sans roi n'a pas de sens et bloquait "Jouer"/"Analyser"
     de toute facon ; autant l'empecher a la source plutot que de laisser
     l'utilisateur decouvrir le blocage apres coup. */
  if(game.board[sq]){
    const p=game.board[sq];
    if(pT(p)===K)return;
    game.board[sq]=0;
    editRefresh();
    return;
  }
  if(!editTool)return;
  const ty=FSYM[editTool.t],c=editTool.c==="w"?W:B;
  if(ty===K&&game.kingSq[c]>=0&&game.kingSq[c]!==sq)game.board[game.kingSq[c]]=0;
  if(ty===K)game.kingSq[c]=sq;
  game.board[sq]=mk(ty,c);
  editRefresh();
}
/* Droits au roque deduits de la position plutot que geres a la main : roi
   et tour encore sur leurs cases d'origine. Une seule case pour le concept
   "prise en passant" existe cote moteur, mais l'editeur ne la propose pas
   (cas rare, complexite disproportionnee pour ce que ca apporte ici). */
function editCastling(){
  let c=0;
  if(game.board[nSq("e1")]===mk(K,W)){
    if(game.board[nSq("h1")]===mk(R,W))c|=CWK;
    if(game.board[nSq("a1")]===mk(R,W))c|=CWQ;
  }
  if(game.board[nSq("e8")]===mk(K,B)){
    if(game.board[nSq("h8")]===mk(R,B))c|=CBK;
    if(game.board[nSq("a8")]===mk(R,B))c|=CBQ;
  }
  return c;
}
function editRefresh(){
  game.turn=editTurnVal==="b"?B:W;
  game.castling=editCastling();
  game.ep=-1;game.half=0;game.full=1;
  legalCache=[];selected=-1;
  render();
  const out=$("editFenOut"); if(out)out.value=game.fen();
  const kw=game.kingSq[W]>=0,kb=game.kingSq[B]>=0,ok=kw&&kb;
  const msg=$("editMsg");
  if(msg)msg.textContent=ok?"":(!kw&&!kb?t("Place a king for each side."):!kw?t("Place a white king."):t("Place a black king."));
  const pb=$("editPlay"); if(pb)pb.disabled=!ok;
}
function editSyncTurnSeg(){
  const seg=$("editTurnSeg"); if(!seg)return;
  for(const x of seg.children)x.setAttribute("aria-pressed",x.dataset.v===editTurnVal);
}
editRenderPalette();
{ const seg=$("editTurnSeg");
  if(seg)for(const b of seg.children)b.onclick=()=>{editTurnVal=b.dataset.v;editSyncTurnSeg();editRefresh();};
}
if($("editStart"))$("editStart").onclick=()=>{
  game=new Game();editTurnVal="w";editSyncTurnSeg();editRefresh();
};
if($("editClear"))$("editClear").onclick=()=>{
  /* Les rois restent sur leurs cases de depart plutot qu'un echiquier
     totalement vide : ce sont les seules pieces qu'une position ne peut
     jamais ne pas avoir, autant eviter l'aller-retour "vider puis
     reposer les deux rois a la main" a chaque fois. */
  game=new Game("4k3/8/8/8/8/8/8/4K3 w - - 0 1");editTurnVal="w";editSyncTurnSeg();editRefresh();
};
if($("editFenCopy"))$("editFenCopy").onclick=()=>{
  copyText($("editFenOut").value);
  const msg=$("editMsg"); if(msg)msg.textContent=t("FEN copied to the clipboard.");
};
if($("editFenLoad"))$("editFenLoad").onclick=()=>{
  const v=$("editFenIn").value.trim(); if(!v)return;
  let g=null;
  try{g=new Game(v);}catch(e){g=null;}
  if(!g||g.kingSq[W]<0||g.kingSq[B]<0){
    const msg=$("editMsg"); if(msg)msg.textContent=t("Each side needs exactly one king.");
    return;
  }
  game=g;editTurnVal=game.turn===B?"b":"w";editSyncTurnSeg();
  $("editFenIn").value="";
  editRefresh();
};
/* pendingStartFen : consomme par newGame() (ui.js) pour demarrer une partie
   depuis cette position plutot que depuis le depart standard, sans changer
   la signature de newGame() (appelee sans argument partout ailleurs). */
if($("editPlay"))$("editPlay").onclick=()=>{
  if(game.kingSq[W]<0||game.kingSq[B]<0)return;
  pendingStartFen=game.fen();
  pendingNoClock=true;
  myColor=editTurnVal==="b"?B:W;
  colorMode=myColor===W?"w":"b";
  skipReady=true;
  setMode("play",{fresh:true});
  /* La partie nait depuis l'editeur : on reste visuellement sur l'onglet
     Analyser plutot que de faire sauter la barre sur "Jouer" -- seule la
     surbrillance change, le contenu affiche est bien celui du mode Jouer. */
  const tp=$("tab-play"),te=$("tab-edit");
  markTab(tp,false);
  markTab(te,true);
};

const prevSetModeEdit=setMode;
setMode=function(m,opts){
  if(m==="edit"){
    if(mode==="play"&&game){mainGame=game;mainSan=sanList;mainLast=lastMove;mainStarted=gameStarted;mainFlipped=flipped;}
    mode="edit";busy=false;
    const tabs={play:"tab-play",edit:"tab-edit",puzzles:"tab-puzzles",train:"tab-train",friend:"tab-friend",watch:"tab-watch",explore:"tab-explore"};
    for(const k in tabs)markTab($(tabs[k]),k===m);
    $("pane-home").classList.add("hide");
    $("pane-watch").classList.add("hide");
    { const pex=$("pane-explore"); if(pex)pex.classList.add("hide"); }
    { const pcal=$("pane-calendar"); if(pcal)pcal.classList.add("hide"); }
    const pl=$("pane-legal"); if(pl)pl.classList.add("hide");
    const pp=$("pane-prefs"); if(pp)pp.classList.add("hide");
    $("appLayout").classList.remove("hide");
    $("pane-play").classList.add("hide");
    $("pane-puzzles").classList.add("hide");
    $("pane-friend").classList.add("hide");
    const pt=$("pane-train"); if(pt)pt.classList.add("hide");
    $("pane-edit").classList.remove("hide");
    { const ei=$("editIntro"); if(ei)ei.classList.remove("hide"); }
    /* Meme garde-fou que pour Train (voir plus haut) : sans lui, arriver
       ici depuis l'ecran de reglages de Jouer (plateau cache tant que la
       partie n'a pas demarre) laissait l'editeur sans echiquier du tout. */
    { const bw=document.querySelector(".board-wrap"); if(bw)bw.classList.remove("hide"); }
    if(typeof majLayoutSolo==="function")majLayoutSolo();
    $("evalwrap").classList.add("hide");
    $("clockTop").classList.add("hide");$("clockBottom").classList.add("hide");
    /* Le bouton de retournement rejoint la bande "Editeur de position" : en
       edition, il n'y a pas de bandeau de coups a cote de lui dans
       #boardTools, qui se serait donc reduit a une ligne entiere pour ce
       seul bouton -- de la place perdue, precieuse sur mobile pour loger
       le plateau et la palette sur un seul ecran. #boardTools n'a alors
       plus rien a montrer : masque. */
    { const eir=document.querySelector("#editIntro .edit-intro-row"),fb=$("btnFlip"); if(eir&&fb&&fb.parentElement!==eir)eir.appendChild(fb); }
    { const bt=$("boardTools"); if(bt)bt.classList.add("hide"); }
    { const nr=$("navRow"); if(nr)nr.classList.add("hide"); }
    game=editGame||new Game();
    editTurnVal=editGame?editGameTurn:"w";
    editGame=null;
    editSyncTurnSeg();
    editRefresh();
    return;
  }
  const pe=$("pane-edit"); if(pe)pe.classList.add("hide");
  { const ei=$("editIntro"); if(ei)ei.classList.add("hide"); }
  /* Le bouton de retournement reprend sa place habituelle a droite du
     bandeau de coups, avant que le code de la chaine plus bas ne decide de
     l'afficher ou non pour la destination reelle (m). */
  { const bt=$("boardTools"),fb=$("btnFlip"); if(bt&&fb&&fb.parentElement!==bt)bt.appendChild(fb); }
  markTab($("tab-edit"),false);
  if(mode==="edit"&&game){editGame=game;editGameTurn=editTurnVal;}
  prevSetModeEdit(m,opts);
};
if($("tab-edit"))$("tab-edit").onclick=()=>{setMode("edit");goTop();};

/* ==========================================================
   MODE ANALYSE (exploration libre depuis l'editeur de position)
   ========================================================== */
/* Contrairement a Jouer, les deux camps sont deplacables (pas de bot, pas
   de camp attribue) : on explore une ligne pour la comprendre, pas pour
   affronter quelqu'un. La jauge d'evaluation et le meilleur coup sont donc
   affiches en direct des le premier coup -- Jouer les masque expres tant
   que la partie n'est pas finie ("pas d'aide du moteur pendant que tu
   joues"), une regle qui n'a pas de sens ici puisqu'il n'y a personne a
   affronter. */
let analyseUci=[],analysePly=null,analyseStartFen=null,analyseEvalCache=null,analyseEvalToken=0;
function handleAnalyseClick(sq){
  if(!legalCache.length||game.isDraw())return;
  const p=game.board[sq];
  if(selected>=0){
    const r=pickMove(selected,sq);
    if(r){
      marks={};
      if(r.promo){askPromo(r.promo,m=>playAnalyseMove(m));selected=-1;render();return;}
      playAnalyseMove(r.move);return;
    }
  }
  if(p&&pC(p)===game.turn){selected=sq;marks={};} else selected=-1;
  render();
}
function playAnalyseMove(m){
  /* Rejouer un coup depuis une position anterieure (apres avoir navigue en
     arriere dans le bandeau) ecrase la suite deja exploree : meme principe
     qu'un logiciel d'analyse classique, une seule ligne a la fois, pas un
     arbre de variantes complet (hors de portee raisonnable pour cette
     premiere version). */
  if(analysePly!==null&&analysePly<analyseUci.length){sanList.length=analysePly;analyseUci.length=analysePly;}
  analysePly=null;
  sanList.push(game.san(m));
  analyseUci.push(sqN(m.from)+sqN(m.to)+(m.promo?SYM[m.promo]:""));
  game.makeMove(m);lastMove=m;selected=-1;marks={};
  legalCache=game.moves();
  render();
  renderAnalyseNav();
  queueAnalyseEval();
}
function analyseGoto(ply){
  ply=Math.max(0,Math.min(analyseUci.length,ply));
  const g=new Game(analyseStartFen);
  let lm=null;
  for(let i=0;i<ply;i++){
    const mv=g.moves().find(x=>g.uci(x)===analyseUci[i]);
    if(!mv)break;
    g.makeMove(mv);lm=mv;
  }
  game=g;lastMove=lm;selected=-1;marks={};
  legalCache=game.moves();
  analysePly=ply===analyseUci.length?null:ply;
  render();
  renderAnalyseNav();
  queueAnalyseEval();
}
function renderAnalyseNav(){
  const n=analyseUci.length,at=analysePly===null?n:analysePly;
  const row=$("navRow"); if(row)row.classList.remove("hide");
  const el=$("navScroll"); if(!el)return;
  let h='<span class="navchip start'+(at===0?" cur":"")+'" data-ply="0">'+t("Game start")+'</span>';
  for(let i=0;i<sanList.length;i++){
    const cls="navchip"+(i===at-1?" cur":"");
    const num=i%2===0?'<span class="navnum">'+(i/2+1)+'.</span>':"";
    const side=i%2===0?"w":"b";
    const icon=typeof pieceSVG==="function"?'<i class="navpiece side-'+side+'">'+pieceSVG(sanPieceType(sanList[i]),"w",true)+'</i>':"";
    h+='<span class="'+cls+'" data-ply="'+(i+1)+'">'+num+icon+sanList[i]+'</span>';
  }
  poserHtml(el,h);
  el.querySelectorAll("[data-ply]").forEach(sp=>{sp.onclick=()=>analyseGoto(+sp.dataset.ply);});
  if(typeof recenterNavChip==="function")recenterNavChip(el);
  if(typeof updateNavScrollHint==="function")updateNavScrollHint();
}
/* Interroge Stockfish (avec repli sur le moteur integre, comme partout
   ailleurs sur le site) pour la position actuellement affichee, qu'elle
   soit la derniere jouee ou une position anterieure consultee dans le
   bandeau. Le jeton evite qu'une reponse tardive d'un coup precedent
   n'ecrase l'affichage d'une position consultee depuis. */
async function queueAnalyseEval(){
  const myToken=++analyseEvalToken;
  const fen=game.fen(),turnAtQuery=game.turn;
  const be=$("analyseBest"); if(be)be.textContent=t("Analysing…");
  let cp=null,mateVal=null,bestUci=null;
  if(typeof sf!=="undefined"&&sf.ready){
    const r=await sfEvalFen(fen,14);
    if(myToken!==analyseEvalToken)return;
    if(r){
      cp=turnAtQuery===W?(r.cp||0):-(r.cp||0);
      mateVal=r.mate==null?null:(turnAtQuery===W?r.mate:-r.mate);
      bestUci=r.best;
    }
  }
  if(cp===null&&mateVal===null){
    const r=search(game,3,300);
    if(myToken!==analyseEvalToken)return;
    cp=turnAtQuery===W?r.score:-r.score;
    bestUci=r.move?game.uci(r.move):null;
  }
  analyseEvalCache={cp:cp||0,cpTrue:cp||0,mate:mateVal};
  if(typeof updateEval==="function")updateEval();
  if(be){
    if(!bestUci)be.textContent="";
    else{
      const mv=game.moves().find(x=>game.uci(x)===bestUci);
      be.textContent=mv?t("Best move: {m}",{m:game.san(mv)}):"";
    }
  }
}
/* Extrait du gestionnaire de "Analyser cette position" le 2026-09-07 : la
   route #fen= (voir applyDeepLink, ui.js) emprunte exactement ce chemin.
   Les deux pieges documentes ci-dessous se seraient reproduits a
   l'identique dans une copie, et personne ne l'aurait vu avant longtemps. */
function ouvrirExploration(){
  if(game.kingSq[W]<0||game.kingSq[B]<0)return false;
  analyseStartFen=game.fen();
  /* editGame/editGameTurn ne sont normalement mis a jour qu'en quittant
     l'onglet Analyse (voir l'extension setMode plus bas) : passer par
     "Analyser cette position" contourne ce chemin, il faut donc les fixer
     ici explicitement. Sans ca, revenir depuis l'exploration affichait soit
     une position perimee (si l'onglet avait deja ete quitte une fois
     avant), soit la position de depart standard par defaut (la toute
     premiere fois), jamais la position reellement composee. */
  /* new Game(analyseStartFen), pas game directement : game est le meme
     objet mutable qui va ensuite recevoir tous les coups de l'exploration
     (game.makeMove() modifie l'instance en place). Y stocker une simple
     reference aurait fait "bouger" editGame avec chaque coup explore au
     lieu de rester fige sur la position de depart. */
  editGame=new Game(analyseStartFen);editGameTurn=editTurnVal;
  sanList=[];analyseUci=[];analysePly=null;lastMove=null;selected=-1;marks={};analyseEvalCache=null;
  setMode("analyse");
  return true;
}
if($("editAnalyse"))$("editAnalyse").onclick=()=>{ouvrirExploration();};
if($("analyseBack"))$("analyseBack").onclick=()=>setMode("edit");


const prevSetModeAnalyse=setMode;
setMode=function(m,opts){
  /* L'ecran "Ready when you are" (readyBanner) n'appartient qu'au flux
     Jouer (clic sur Start game avant confirmation, ou reprise d'une partie
     sauvegardee) : il vit dans .board-wrap, que Train/Editeur/Analyse/
     Exercices/Entre amis/Regarder forcent tous a rester visible pour leur
     propre plateau (voir plus bas et plus haut : "meme garde-fou"). Sans
     ceci, quitter Jouer alors que ce panneau etait affiche le laissait
     colle par-dessus l'ecran de destination, quel qu'il soit -- verifie
     sur les 6 autres onglets, pas seulement Analyser. Point d'entree unique
     choisi ici car c'est la couche la plus externe : tout appel a
     setMode(), quelle que soit sa cible, passe par cette fonction en
     premier avant de redescendre eventuellement vers prevSetModeAnalyse. */
  if(m!=="play"){const rb=$("readyBanner"); if(rb)rb.classList.add("hide");}
  if(m==="analyse"){
    if(mode==="play"&&game){mainGame=game;mainSan=sanList;mainLast=lastMove;mainStarted=gameStarted;mainFlipped=flipped;}
    mode="analyse";busy=false;
    const tabs={play:"tab-play",edit:"tab-edit",puzzles:"tab-puzzles",train:"tab-train",friend:"tab-friend",watch:"tab-watch",explore:"tab-explore"};
    for(const k in tabs)markTab($(tabs[k]),k==="edit");
    $("pane-home").classList.add("hide");
    $("pane-watch").classList.add("hide");
    { const pex=$("pane-explore"); if(pex)pex.classList.add("hide"); }
    { const pcal=$("pane-calendar"); if(pcal)pcal.classList.add("hide"); }
    const pl=$("pane-legal"); if(pl)pl.classList.add("hide");
    const pp=$("pane-prefs"); if(pp)pp.classList.add("hide");
    $("appLayout").classList.remove("hide");
    $("pane-play").classList.add("hide");
    $("pane-puzzles").classList.add("hide");
    $("pane-friend").classList.add("hide");
    const pt=$("pane-train"); if(pt)pt.classList.add("hide");
    $("pane-edit").classList.add("hide");
    { const ei=$("editIntro"); if(ei)ei.classList.add("hide"); }
    $("pane-analyse").classList.remove("hide");
    /* Meme garde-fou que pour Train/Analyse-editeur (voir plus haut). */
    { const bw=document.querySelector(".board-wrap"); if(bw)bw.classList.remove("hide"); }
    if(typeof majLayoutSolo==="function")majLayoutSolo();
    $("evalwrap").classList.remove("hide");
    $("clockTop").classList.add("hide");$("clockBottom").classList.add("hide");
    { const bt=$("boardTools"); if(bt)bt.classList.remove("hide"); }
    { const bt=$("boardTools"),fb=$("btnFlip"); if(bt&&fb&&fb.parentElement!==bt)bt.appendChild(fb); }
    legalCache=game.moves();selected=-1;marks={};
    render();
    renderAnalyseNav();
    queueAnalyseEval();
    return;
  }
  const pa=$("pane-analyse"); if(pa)pa.classList.add("hide");
  prevSetModeAnalyse(m,opts);
};

/* ==========================================================
   GLISSER-DEPOSER DANS L'EDITEUR DE POSITION
   ========================================================== */
/* Pointer Events : un seul jeu d'evenements pour souris/tactile/stylet,
   bien supporte partout. Actif uniquement quand mode==="edit" (verifie a
   l'origine du geste, dans buildBoard() et editRenderPalette() ci-dessus) :
   ne remplace ni ne desactive le systeme de clic classique utilise partout
   ailleurs sur le site (Jouer, Entre amis, exploration Analyser), qui
   continue de fonctionner a l'identique.

   Un simple tap (deplacement sous le seuil) ne fait rien ici : le "click"
   natif qui suit s'execute ensuite normalement, geree par handleEditorClick
   / selectEditTool comme avant. Un vrai glissement (au-dela du seuil) prend
   le relais et, pour une origine "board", court-circuite ensuite ce meme
   clic fantome via editDragJustHappened (sinon le clic qui suit un
   glissement termine sur la case de depart aurait retire la piece qu'on
   vient juste de reposer dessus).

   setPointerCapture sur l'element d'origine garantit que pointermove/up
   continuent d'arriver meme quand le pointeur sort de ses limites -- pas
   besoin d'ecouteurs poses/retires sur document. La case ou la piece
   atterrirait est retrouvee via elementFromPoint sur les coordonnees du
   pointeur, independant de la capture. */
function editCellIndexFromPoint(x,y){
  const el=document.elementFromPoint(x,y);
  const cell=el&&el.closest?el.closest(".sq"):null;
  if(!cell||cell.parentElement!==boardEl)return -1;
  return Array.prototype.indexOf.call(boardEl.children,cell);
}
function editHighlightCellAt(x,y){
  const idx=editCellIndexFromPoint(x,y);
  for(const c of boardEl.children)c.classList.remove("drag-over");
  if(idx>=0)boardEl.children[idx].classList.add("drag-over");
  return idx;
}
function editMakeGhost(sym,color){
  const g=document.createElement("div");
  g.className="edit-ghost";
  poserHtml(g,pieceSVG(sym,color));
  document.body.appendChild(g);
  return g;
}
function editPositionGhost(x,y){
  if(!editDrag||!editDrag.ghost)return;
  editDrag.ghost.style.left=x+"px";
  editDrag.ghost.style.top=y+"px";
}
function editEndDrag(){
  if(editDrag&&editDrag.ghost&&editDrag.ghost.parentNode)editDrag.ghost.parentNode.removeChild(editDrag.ghost);
  for(const c of boardEl.children)c.classList.remove("drag-over","drag-source");
  editDrag=null;
}
function editPointerDown(e,info){
  if(mode!=="edit"||(e.button!=null&&e.button>0))return;
  const el=e.currentTarget;
  if(el.setPointerCapture){try{el.setPointerCapture(e.pointerId);}catch(err){}}
  editDrag={...info,startX:e.clientX,startY:e.clientY,moved:false,ghost:null,el:el};
  el.addEventListener("pointermove",editPointerMove,{passive:false});
  el.addEventListener("pointerup",editPointerUp,{passive:false});
  el.addEventListener("pointercancel",editPointerCancel,{passive:false});
}
function editPointerMove(e){
  if(!editDrag)return;
  if(!editDrag.moved){
    const dx=e.clientX-editDrag.startX,dy=e.clientY-editDrag.startY;
    if(Math.sqrt(dx*dx+dy*dy)<EDIT_DRAG_THRESHOLD)return;
    editDrag.moved=true;
    const sym=editDrag.source==="board"?SYM[pT(editDrag.piece)]:editDrag.tool.t;
    const col=editDrag.source==="board"?(pC(editDrag.piece)===W?"w":"b"):editDrag.tool.c;
    editDrag.ghost=editMakeGhost(sym,col);
    const rect=editDrag.el.getBoundingClientRect();
    editDrag.ghost.style.width=rect.width+"px";
    editDrag.ghost.style.height=rect.height+"px";
    if(editDrag.source==="board")editDrag.el.classList.add("drag-source");
  }
  e.preventDefault();
  editPositionGhost(e.clientX,e.clientY);
  editHighlightCellAt(e.clientX,e.clientY);
}
function editPointerUp(e){
  if(!editDrag)return;
  const el=editDrag.el;
  el.removeEventListener("pointermove",editPointerMove);
  el.removeEventListener("pointerup",editPointerUp);
  el.removeEventListener("pointercancel",editPointerCancel);
  if(!editDrag.moved){editEndDrag();return;}
  if(editDrag.source==="board")editDragJustHappened=true;
  const targetIdx=editCellIndexFromPoint(e.clientX,e.clientY);
  const drag=editDrag;
  editEndDrag();
  editApplyDrop(drag,targetIdx);
}
function editPointerCancel(){
  if(!editDrag)return;
  const el=editDrag.el;
  el.removeEventListener("pointermove",editPointerMove);
  el.removeEventListener("pointerup",editPointerUp);
  el.removeEventListener("pointercancel",editPointerCancel);
  editEndDrag();
}
/* Applique le resultat d'un glissement termine : deplacement/retrait pour
   une origine "board", pose pour une origine "palette". Le roi ne peut
   jamais etre retire (lache hors de l'echiquier) -- seulement deplace --
   meme regle que pour le retrait au tap (handleEditorClick). */
function editApplyDrop(drag,targetIdx){
  if(drag.source==="board"){
    const sourceSq=drag.sq,piece=drag.piece;
    if(targetIdx<0){
      if(pT(piece)===K)return;
      game.board[sourceSq]=0;
      editRefresh();
      return;
    }
    const targetSq=idxToSq(targetIdx);
    if(targetSq===sourceSq)return;
    const existing=game.board[targetSq];
    if(existing&&pT(existing)===K)game.kingSq[pC(existing)]=-1;
    game.board[targetSq]=piece;
    game.board[sourceSq]=0;
    if(pT(piece)===K)game.kingSq[pC(piece)]=targetSq;
    editRefresh();
  } else {
    if(targetIdx<0)return;
    const targetSq=idxToSq(targetIdx);
    const ty=FSYM[drag.tool.t],c=drag.tool.c==="w"?W:B;
    if(ty===K&&game.kingSq[c]>=0&&game.kingSq[c]!==targetSq)game.board[game.kingSq[c]]=0;
    const existing=game.board[targetSq];
    if(existing&&pT(existing)===K)game.kingSq[pC(existing)]=-1;
    game.board[targetSq]=mk(ty,c);
    if(ty===K)game.kingSq[c]=targetSq;
    editRefresh();
  }
}

/* ==========================================================
   INDICE DE DEFILEMENT DE LA BARRE D'ONGLETS
   ========================================================== */
/* Sur mobile, les libelles tronques par le bord de l'ecran peuvent laisser
   croire que le menu s'arrete la (ex. "Inviter" semble etre le dernier
   onglet alors que "Regarder"/"Explorer" suivent). Un fin degrade colle a
   chaque bord (voir le CSS de .tabs) signale qu'il y a plus a voir en
   glissant -- uniquement quand c'est vrai, jamais du cote ou il n'y a
   effectivement plus rien. */
function updateTabsScrollHint(){
  const el=$("tabsNav"); if(!el)return;
  const max=el.scrollWidth-el.clientWidth;
  el.classList.toggle("has-scroll-left",el.scrollLeft>2);
  el.classList.toggle("has-scroll-right",el.scrollLeft<max-2);
}
{
  const el=$("tabsNav");
  if(el){
    updateTabsScrollHint();
    el.addEventListener("scroll",updateTabsScrollHint,{passive:true});
    window.addEventListener("resize",updateTabsScrollHint);
    /* Les libelles changent de longueur au changement de langue (le
       francais deborde plus que l'anglais, deja constate) : un observateur
       de mutations recalcule alors tout seul, sans avoir a modifier chaque
       endroit du code qui appelle applyI18n(). */
    if("MutationObserver" in window){
      new MutationObserver(updateTabsScrollHint).observe(el,{characterData:true,childList:true,subtree:true});
    }
    /* Pas de navigation aux fleches ici. Elle avait ete ajoutee le matin du
       2026-09-05, quand la barre s'annoncait encore comme un role="tablist"
       et devait donc la fournir. La barre etant passee dans la journee au
       patron "navigation" (voir template.html), les fleches deviendraient
       au contraire une surprise : dans une <nav>, un lecteur d'ecran les
       reserve a la lecture du texte, et les intercepter lui retirerait ce
       geste. Les six entrees restent atteignables au Tab, comme n'importe
       quel groupe de liens. */
  }
}
