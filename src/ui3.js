/* --- ramener l'échiquier sous les yeux quand l'action part d'un bouton situé plus bas --- */
function focusBoard(){
  try{
    const el=document.querySelector(".board-side");
    if(!el||typeof el.scrollIntoView!=="function")return;
    const r=el.getBoundingClientRect?el.getBoundingClientRect():null;
    const vh=window.innerHeight||document.documentElement.clientHeight||0;
    if(r&&r.height>0&&vh>0){
      const visible=Math.min(r.bottom,vh)-Math.max(r.top,0);
      if(visible>=Math.min(r.height,vh)*0.7)return;   // déjà bien visible : on ne bouge pas
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
const ENDGAMES=[
  {id:"kq",name:"Queen vs King",budget:12,white:["Q"],black:[],
   brief:"Push the lone king to the edge with the queen, then bring your own king up. Watch for stalemate."},
  {id:"kr",name:"Rook vs King",budget:20,white:["R"],black:[],
   brief:"Cut the king off with the rook and shrink the box one rank at a time."},
  {id:"krr",name:"Two rooks vs King",budget:10,white:["R","R"],black:[],
   brief:"The ladder: one rook cuts, the other checks, and they alternate."},
  {id:"kbn",name:"Bishop and knight",budget:34,white:["B","N"],black:[],
   brief:"The hard one. Mate only happens in a corner your bishop controls."},
  {id:"kp",name:"King and pawn",budget:26,white:["P"],black:[],
   brief:"Promote the pawn, then mate. Opposition decides it."}
];
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
    let ok=true;
    for(const p of scen.white){
      let s;
      if(p==="P"){
        let g=0;
        do{s=(1+Math.floor(Math.random()*5))*16+Math.floor(Math.random()*8);g++;}while(used.has(s)&&g<40);
        if(used.has(s)){ok=false;break;}
      } else s=place();
      used.add(s);board[s]=p;
    }
    if(!ok)continue;
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
function startEndgame(scenId){
  const scen=ENDGAMES.find(s=>s.id===scenId)||ENDGAMES[0];
  const fen=randEndgame(scen);
  if(!fen){$("egStatus").textContent=t("Could not build a position, try again.");return;}
  eg={scen:scen,moves:0,done:false};
  game=new Game(fen);
  eg.g=game;
  flipped=false;selected=-1;marks={};lastMove=null;busy=false;
  legalCache=game.moves();
  render();
  renderEndgame();
  focusBoard();
}
function renderEndgame(){
  if(!eg)return;
  $("egName").textContent=t(eg.scen.name);
  $("egBrief").textContent=t(eg.scen.brief);
  $("egMoves").textContent=eg.moves;
  $("egBudget").textContent=eg.scen.budget;
  const best=(prog.endgames||{})[eg.scen.id];
  $("egBest").textContent=best?best:"—";
  for(const b of $("egChips").children)b.setAttribute("aria-pressed",b.dataset.id===eg.scen.id);
}
function endEndgame(won,msg){
  eg.done=true;
  const st=$("egStatus");
  st.className="status "+(won?"win":"lose");
  st.textContent=msg;
  if(won){
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
    if(game.inCheck())endEndgame(true,t("Checkmate in {n} moves. Well done.",{n:eg.moves}));
    else endEndgame(false,t("Stalemate. The lone king escaped with a draw."));
    return;
  }
  // matériel perdu ?
  let heavy=0;
  for(let sq=0;sq<128;sq++){if(sq&0x88){sq+=7;continue;}
    const p=game.board[sq];
    if(p&&pC(p)===W&&pT(p)!==K)heavy++;}
  if(heavy===0){endEndgame(false,t("You lost your material. Draw."));return;}
  if(eg.moves>=eg.scen.budget){endEndgame(false,t("Out of moves. The target was {n}.",{n:eg.scen.budget}));return;}
  busy=true;
  $("egStatus").className="status";
  $("egStatus").textContent=t("The defending king replies…");
  setTimeout(()=>{
    const rep=search(game,3,450).move||game.moves()[0];
    game.makeMove(rep);lastMove=rep;busy=false;
    legalCache=game.moves();
    render();
    if(!legalCache.length){
      endEndgame(false,game.inCheck()?t("You are mated. That should not happen here."):t("Stalemate. The defence held."));
      return;
    }
    const st=$("egStatus");st.className="status";
    st.textContent=t("Your move. {n} moves left.",{n:eg.scen.budget-eg.moves});
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
  coord=null;
  $("coordHud").classList.add("hide");
  $("chudSquare").textContent="\u2014";
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
  const box=$("egChips");box.innerHTML="";
  for(const s of ENDGAMES){
    const b=document.createElement("button");
    b.className="chip";b.textContent=t(s.name);b.dataset.id=s.id;
    b.setAttribute("aria-pressed",eg&&eg.scen.id===s.id);
    b.onclick=()=>{if(coord)stopCoord();startEndgame(s.id);
      const st=$("egStatus");st.className="status";
      st.textContent=t("White to move. Mate within {n} moves.",{n:ENDGAMES.find(x=>x.id===s.id).budget});};
    box.appendChild(b);
  }
}
$("btnEgNew").onclick=()=>{if(coord)stopCoord();startEndgame(eg?eg.scen.id:"kq");
  const st=$("egStatus");st.className="status";st.textContent=t("New position. White to move.");};
$("btnCoord").onclick=()=>{
  if(coord){stopCoord();return;}
  /* Trente secondes seulement : perdre les deux premieres a comprendre ou on
     est, ca compte. Meme overlay que les parties chronometrees. */
  if(typeof showReadyFor==="function")
    showReadyFor(t("Thirty seconds · click the square that is named"),
      ()=>startCoord(), t("Start"));
  else startCoord();
};
$("coordSide").addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  for(const x of e.currentTarget.children)x.setAttribute("aria-pressed",x===b);
  if(coord){flipped=b.dataset.v==="b";render();}
});

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
    el.innerHTML=pieceSVG(SYM[pT(p)],pC(p)===W?"w":"b");
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
function sfEnable(){
  if(sf.ready){sfStatus(t("Stockfish is already running."));return;}
  const btn=$("btnStockfish");btn.disabled=true;btn.textContent=t("Loading…");
  sfStatus(t("Fetching the engine, this can take a moment on a first visit."));
  let settled=false;
  const fail=why=>{
    if(settled)return;settled=true;
    btn.disabled=false;btn.textContent=t("Stockfish for review");
    sf.worker=null;sf.ready=false;
    sfStatus(t("Stockfish could not start ({why}). The built-in engine stays in use.",{why:t(why)}));
  };
  try{
    const w=new Worker(SF_PATH);
    const timer=setTimeout(()=>fail("timed out"),25000);
    w.onerror=()=>{clearTimeout(timer);fail("file not found");};
    w.onmessage=ev=>{
      const line=typeof ev.data==="string"?ev.data:(ev.data&&ev.data.data)||"";
      if(/uciok/.test(line)){w.postMessage("isready");}
      else if(/readyok/.test(line)&&!settled){
        settled=true;clearTimeout(timer);
        sf.worker=w;sf.ready=true;
        btn.disabled=false;btn.textContent=t("Stockfish enabled");
        sfStatus(t("Stockfish is ready. Game review will now use it instead of the built-in engine."));
      }
    };
    w.postMessage("uci");
  }catch(e){fail(e.message||"blocked");}
}
function sfEvalFen(fen,depth){
  return new Promise(resolve=>{
    if(!sf.ready){resolve(null);return;}
    let score=null,best=null,done=false;
    const finish=()=>{if(!done){done=true;sf.worker.onmessage=prev;resolve({cp:score,best:best});}};
    const prev=sf.worker.onmessage;
    const timer=setTimeout(finish,4000);
    sf.worker.onmessage=ev=>{
      const line=typeof ev.data==="string"?ev.data:(ev.data&&ev.data.data)||"";
      let m=line.match(/score cp (-?\d+)/);
      if(m)score=parseInt(m[1],10);
      m=line.match(/score mate (-?\d+)/);
      if(m)score=(parseInt(m[1],10)>0?1:-1)*(20000-Math.abs(parseInt(m[1],10))*100);
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
  const g=new Game(),plies=[],CLAMP=1200;
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
    plies.push({cp:mover===W?a:-a,loss:Math.max(0,b-a),
      tag:classify(Math.max(0,b-a),bestUci===gameUci[i]),best:bestUci,mover:mover});
    bar.firstElementChild.style.width=(100*(i+1)/gameUci.length).toFixed(0)+"%";
  }
  if(!plies.length){btn.disabled=false;btn.textContent=t("Analyse this game");bar.classList.add("hide");
    sfStatus(t("Stockfish stopped responding, falling back to the built-in engine."));sf.ready=false;analyseGame();return;}
  finishAnalysis(plies);
  $("analysisNote").textContent=$("analysisNote").textContent.replace(
    t("Accuracy here is a rough guide from a shallow search, not a rating."),
    t("Analysed with Stockfish at depth 12."));
}
const baseAnalyseGame=analyseGame;
analyseGame=function(){
  if(sf.ready){analyseWithStockfish();return;}
  baseAnalyseGame();
};
$("btnAnalyse").onclick=()=>analyseGame();
$("btnStockfish").onclick=sfEnable;

/* ==========================================================
   19. INSTALL AS AN APP
   ========================================================== */
let installEvent=null;
window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();installEvent=e;
  const b=$("btnInstall");if(b)b.classList.remove("hide");
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
const prevSetMode=setMode;
setMode=function(m,opts){
  if(coord)stopCoord();
  if(m==="train"){
    if(mode==="play"&&game){mainGame=game;mainSan=sanList;mainLast=lastMove;mainStarted=gameStarted;}
    mode="train";
    const tabs={home:"tab-home",play:"tab-play",puzzles:"tab-puzzles",train:"tab-train",friend:"tab-friend",watch:"tab-watch"};
    for(const k in tabs){const el=$(tabs[k]);if(el)el.setAttribute("aria-selected",k===m);}
    $("pane-home").classList.add("hide");
    $("pane-watch").classList.add("hide");
    $("pane-legal").classList.add("hide");
    $("appLayout").classList.remove("hide");
    $("pane-play").classList.add("hide");
    $("pane-puzzles").classList.add("hide");
    $("pane-friend").classList.add("hide");
    $("pane-train").classList.remove("hide");
    $("evalwrap").classList.add("hide");
    $("clockTop").classList.add("hide");$("clockBottom").classList.add("hide");
    $("coordHud").classList.add("hide");
    renderCoordHud();
    $("coordBest").textContent=prog.coordBest||0;
    renderEgChips();
    if(!eg||!eg.g)startEndgame("kq");
    else{game=eg.g;legalCache=game.moves();selected=-1;marks={};render();}
    renderEndgame();
    const st=$("egStatus");st.className="status";
    st.textContent=t("Pick an endgame, or run the coordinate drill below.");
    return;
  }
  $("pane-train").classList.add("hide");
  const tt=$("tab-train");if(tt)tt.setAttribute("aria-selected","false");
  prevSetMode(m,opts);
};
$("tab-train").onclick=()=>{setMode("train");goTop();};

/* clics du plateau : router vers l'entraînement, et ignorer le clic issu d'un glisser */
const baseOnSquare=onSquare;
onSquare=function(e){
  if(suppressClick)return;
  if(mode==="train"){
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
const SQ_NAMES=(()=>{
  const o={};
  for(let s=0;s<128;s++){
    if(s&0x88)continue;
    o[s]="abcdefgh"[s&7]+(1+(s>>4));
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
function focusCell(i){
  setRoving(i);
  const c=boardCells()[i];
  if(c){c.focus();announceCell(i);}
}
function announceCell(i){
  if(prefAnnounce==="off")return;
  const sq=idxToSq(i);
  const g=(typeof viewGame==="function")?viewGame():game;
  let msg=sqName(sq);
  try{
    const pc=g.board[sq];
    if(pc){
      const isWhite=pColor(pc)===W;
      const side=LANG==="fr"?(isWhite?"blanc":"noir"):(isWhite?"white":"black");
      const word=pieceWord("pnbrqk"[pType(pc)-1]||"");
      msg=(LANG==="fr"?word+" "+side+" en "+sqName(sq):side+" "+word+" on "+sqName(sq));
    }else{
      msg=(LANG==="fr"?"case vide "+sqName(sq):"empty "+sqName(sq));
    }
  }catch(e){}
  announce(msg,"cell");
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
    box.innerHTML="";
    for(const th of BOARD_THEMES){
      const b=document.createElement("button");
      b.className="chip";
      b.type="button";
      b.setAttribute("role","radio");
      b.setAttribute("aria-checked",String(th.id===prefBoard));
      b.setAttribute("aria-pressed",String(th.id===prefBoard));
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
    segA.innerHTML="";
    for(const v of ["on","off"]){
      const b=document.createElement("button");
      b.type="button";
      b.setAttribute("data-v",v);
      b.setAttribute("role","radio");
      const actif=(v==="on")===animOn;
      b.setAttribute("aria-checked",String(actif));
      b.setAttribute("aria-pressed",String(actif));
      b.textContent=lab[v];
      b.onclick=()=>{animOn=(v==="on");savePrefs();renderPrefs();};
      segA.appendChild(b);
    }
  }
  const seg=$("segAnnounce");
  if(seg){
    const labels=fr?{off:"Aucune",moves:"Les coups",full:"Coups et état"}
                  :{off:"Off",moves:"Moves",full:"Moves and status"};
    seg.innerHTML="";
    for(const v of ["off","moves","full"]){
      const b=document.createElement("button");
      b.type="button";
      b.setAttribute("data-v",v);
      b.setAttribute("role","radio");
      b.setAttribute("aria-checked",String(v===prefAnnounce));
      b.setAttribute("aria-pressed",String(v===prefAnnounce));
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
    help.innerHTML=fr
      ? "<p>Sur l'échiquier : les <b>flèches</b> déplacent le curseur, <b>Entrée</b> ou <b>Espace</b> sélectionne une pièce puis sa case d'arrivée, <b>Échap</b> annule la sélection. <b>Origine</b> et <b>Fin</b> vont au bord de la rangée, <b>Page haut</b> et <b>Page bas</b> aux extrémités de la colonne.</p>"
      : "<p>On the board: <b>arrow keys</b> move the cursor, <b>Enter</b> or <b>Space</b> picks a piece then its destination, <b>Escape</b> clears the selection. <b>Home</b> and <b>End</b> jump to the edge of the rank, <b>Page Up</b> and <b>Page Down</b> to the ends of the file.</p>";
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
