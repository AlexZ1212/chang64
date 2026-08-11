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

function recordUci(m){gameUci.push(sqN(m.from)+sqN(m.to)+(m.promo?SYM[m.promo]:""));}
function rebuildTo(ply){
  const g=new Game();
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
      '<span class="verdict">'+t(VERDICT[a.tag])+" \u00b7 "+t("{n} pawns lost.",{n:(a.loss/100).toFixed(1)})+'</span>';
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
  if(reviewPly===null||!analysis)return null;
  if(reviewPly===0)return 0;
  const a=analysis.plies[reviewPly-1];
  return a?a.cp:null;
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
  if(row)row.classList.toggle("hide",mode!=="play"||n===0);
  $("navStart").disabled=at===0;
  $("navPrev").disabled=at===0;
  $("navNext").disabled=at>=n;
  $("navEnd").disabled=at>=n;
  $("navNote").textContent=reviewPly===null
    ? t(n?"Live position. Arrow keys step through the game.":"Use the arrow keys to step through the game.")
    : t("Reviewing move {i} of {n}. Play a move or press End to return.",{i:at,n:n});
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
  if(show&&resultInfo&&mode==="play")saveFinishedGame();
  if(!show||!resultInfo||resultDismissed){b.className="result hide";return;}
  b.className="result "+resultInfo.kind;
  $("resultTitle").textContent=resultInfo.title;
  $("resultSub").textContent=resultInfo.sub;
  $("resultAnalyse").classList.toggle("hide",mode!=="play");
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
  resultDismissed=false;
  /* On relance depuis le bandeau de fin : le choix vient d'etre fait, on ne
     represente pas l'overlay de preparation. */
  if(mode==="friend")newAmiGame();
  else {skipReady=true;newGame();}
};
$("resultClose").onclick=()=>{resultDismissed=true;$("resultBanner").className="result hide";};
$("resultAnalyse").onclick=()=>{
  resultDismissed=true;
  $("resultBanner").className="result hide";
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
$("navStart").onclick=()=>gotoPly(0);
$("navPrev").onclick=()=>gotoPly((reviewPly===null?gameUci.length:reviewPly)-1);
$("navNext").onclick=()=>gotoPly((reviewPly===null?gameUci.length:reviewPly)+1);
$("navEnd").onclick=()=>exitReview();

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
    plies.push({cp:mover===W?afterForMover:-afterForMover,loss:loss,
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
    m:gameUci.join(" ")
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
  $("historyTitle").textContent=t("Your games");
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
    const san=sanOf(g.m);
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
function sanOf(uciStr){
  const g=new Game(),out=[];
  for(const u of uciStr.split(" ").filter(Boolean)){
    const mv=g.moves().find(x=>g.uci(x)===u);
    if(!mv)break;
    out.push(g.san(mv));g.makeMove(mv);
  }
  return out;
}
function openHistoryGame(i){
  const rec=history[i]; if(!rec)return;
  const g=new Game(),san=[],uci=[];
  for(const u of rec.m.split(" ").filter(Boolean)){
    const mv=g.moves().find(x=>g.uci(x)===u);
    if(!mv)break;
    san.push(g.san(mv));uci.push(u);g.makeMove(mv);
  }
  if(!san.length)return;
  clearAnalysis();
  isReviewGame=true;gameSaved=true;
  game=g;sanList=san;gameUci=uci;
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
   10. PUZZLE RATING, DAY STREAK, PUZZLE RUSH
   ========================================================== */
const LEVEL_RATING=[800,1050,1300,1600,1900];
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
}
function updateRating(puzzleLevel,won){
  ensureProgFields();
  const pr=LEVEL_RATING[(puzzleLevel||1)-1];
  const e=1/(1+Math.pow(10,(pr-prog.rating)/400));
  prog.rating=Math.round(Math.max(400,prog.rating+28*((won?1:0)-e)));
}
function renderExtraStats(){
  ensureProgFields();
  const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
  set("stRating",prog.rating);set("stDays",prog.days);set("stRush",prog.rushBest);
  set("hRating",prog.rating);set("hStreak",prog.days);
  /* Rien de resolu : la bande n'afficherait que des zeros, ce qu'un premier
     visiteur lit comme "le site est vide" plutot que comme sa propre
     progression encore vierge. On lui propose de commencer a la place. */
  const vierge=!prog.solved;
  const strip=$("homeStrip"), start=$("homeStart");
  if(strip)strip.classList.toggle("hide",vierge);
  if(start)start.classList.toggle("hide",!vierge);
}

/* --- Chang Sprint : le mode chronometre. Anciennement "Puzzle Rush",
   renomme pour ne pas reprendre le nom d'une fonctionnalite existante
   ailleurs. Les identifiants internes (rush, rushBest, btnRush) sont
   conserves : les renommer casserait la progression deja enregistree chez
   les visiteurs, dont la cle rushBest. --- */
let rush=null;
function rushRender(){
  if(!rush)return;
  const left=Math.max(0,rush.endsAt-Date.now());
  const m=Math.floor(left/60000),s=Math.floor((left%60000)/1000);
  $("rushTime").textContent=m+":"+String(s).padStart(2,"0");
  $("rushScore").textContent=rush.score;
  $("rushStrikes").textContent="\u2717".repeat(3-rush.strikes)||"—";
  if(left<=0)rushEnd(t("Time is up."));
}
function startRush(){
  ensureProgFields();
  rush={score:0,strikes:0,endsAt:Date.now()+180000,queue:[]};
  const byLevel=[1,2,3,4,5].map(l=>PUZZLES.filter(p=>p.level===l).slice());
  for(const arr of byLevel)arr.sort(()=>Math.random()-0.5);
  rush.queue=[].concat(...byLevel);
  $("rushBar").classList.remove("hide");
  $("btnRush").textContent=t("Stop Rush");
  rushNext();
  rush.timer=setInterval(rushRender,250);
  rushRender();
}
function rushNext(){
  if(!rush)return;
  if(!rush.queue.length){rushEnd(t("You cleared every puzzle."));return;}
  puzzle=rush.queue.shift();puzzle.daily=false;
  loadPuzzle();
  $("exStatus").className="status";
  $("exStatus").textContent=t("Rush: solve as many as you can. Three misses and it stops.");
}
function rushEnd(why){
  if(!rush)return;
  clearInterval(rush.timer);
  const score=rush.score;
  const best=score>prog.rushBest;
  if(best)prog.rushBest=score;
  rush=null;
  $("rushBar").classList.add("hide");
  $("btnRush").textContent=t("Chang Sprint");
  saveProg();renderExtraStats();
  const st=$("exStatus");st.className="status "+(best?"win":"");
  st.textContent=best?t("{why} Score: {score} — a new personal best.",{why:why,score:score}):t("{why} Score: {score} (best: {best}).",{why:why,score:score,best:prog.rushBest});
  puzzleDone=true;
}
function onPuzzleResult(won){
  bumpStreak();
  updateRating(puzzle.level,won&&puzzleTries===0);
  saveProg();renderExtraStats();
  if(rush){
    if(won){rush.score++;rushRender();setTimeout(()=>{if(rush)rushNext();},650);}
    return false;
  }
  return false;
}
function onPuzzleWrong(){
  ensureProgFields();
  updateRating(puzzle.level,false);
  saveProg();renderExtraStats();
  if(rush){
    rush.strikes++;rushRender();
    if(rush.strikes>=3){rushEnd(t("Three misses."));return;}
    setTimeout(()=>{if(rush)rushNext();},750);
  }
}
$("btnRush").onclick=()=>{if(rush)rushEnd(t("Stopped."));else startRush();};

/* ==========================================================
   11. WATCH
   ========================================================== */
const CHANNELS=[
  {id:"UCQHX6ViZmPsWiYSFAyS0a3Q",name:"GothamChess",handle:"@GothamChess",desc:"Game recaps, opening guides and the friendliest teaching on the platform."},
  {id:"UCweCc7bSMX5J4jEH7HFImng",name:"GMHikaru",handle:"@GMHikaru",desc:"Super-grandmaster speed chess, tournament recaps and long live streams."},
  {id:"UCL5YbN5WLFD8dLIegT5QAbA",name:"agadmator's Chess Channel",handle:"@agadmator",desc:"Calm, story-driven walkthroughs of historic and current games."}
];
function ytLoad(url,label){
  const w=$("ytPlayer");
  w.classList.remove("hide");
  w.innerHTML='<iframe src="'+url+'" title="'+label+'" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
  $("ytNote").textContent=t("Now loading: {label}. YouTube is serving this player, so their terms and cookies apply from here on.",{label:label});
  w.scrollIntoView&&w.scrollIntoView({block:"nearest"});
}
function renderChannels(){
  const box=$("channels");if(!box)return;
  box.innerHTML="";
  for(const c of CHANNELS){
    const el=document.createElement("div");
    el.className="chan";
    el.innerHTML='<h3>'+c.name+'</h3><p>'+t(c.desc)+'</p>';
    const row=document.createElement("div");row.className="btnrow";
    const live=document.createElement("button");
    live.className="btn primary";live.textContent=t("Live");
    live.onclick=()=>ytLoad("https://www.youtube-nocookie.com/embed/live_stream?channel="+c.id,c.name+" live");
    const latest=document.createElement("button");
    latest.className="btn";latest.textContent=t("Latest");
    latest.onclick=()=>ytLoad("https://www.youtube-nocookie.com/embed/videoseries?list=UU"+c.id.slice(2),c.name+" latest uploads");
    const open=document.createElement("button");
    open.className="btn";open.textContent=t("Channel");
    open.onclick=()=>window.open("https://www.youtube.com/"+c.handle,"_blank","noopener");
    row.appendChild(live);row.appendChild(latest);row.appendChild(open);
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
      "Stockfish est optionnel : il n'est chargé qu'après activation explicite depuis le panneau d'analyse.</p>"+
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
      "Stockfish is optional: it is only loaded once you enable it from the analysis panel.</p>"+
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
  if(rush&&m!=="puzzles")rushEnd(t("Stopped."));
  if(m==="watch"||m==="legal"||m==="prefs"){
    if(mode==="play"&&game){mainGame=game;mainSan=sanList;mainLast=lastMove;}
    mode=m;
    const tabs={home:"tab-home",play:"tab-play",puzzles:"tab-puzzles",friend:"tab-friend",watch:"tab-watch"};
    for(const k in tabs)$(tabs[k]).setAttribute("aria-selected",k===m);
    $("pane-home").classList.add("hide");
    $("appLayout").classList.add("hide");
    $("pane-watch").classList.toggle("hide",m!=="watch");
    $("pane-legal").classList.toggle("hide",m!=="legal");
    const pp=$("pane-prefs"); if(pp)pp.classList.toggle("hide",m!=="prefs");
    if(m==="watch")renderChannels();
    else if(m==="prefs"){if(typeof renderPrefs==="function")renderPrefs();}
    else renderLegal();
    return;
  }
  $("pane-watch").classList.add("hide");
  $("pane-legal").classList.add("hide");
  { const pp=$("pane-prefs"); if(pp)pp.classList.add("hide"); }
  $("tab-watch").setAttribute("aria-selected","false");
  baseSetMode(m,opts);
  renderExtraStats();applyEvalPref();
  if(m==="play"){renderOpening();renderSheetPlay();}
};
$("tab-watch").onclick=()=>{setMode("watch");goTop();};
/* Les deux liens ouvrent le meme panneau : sans cible, "Confidentialite"
   amenait sur les mentions legales. On amene chacun a sa propre section. */
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
  }
};
undoGame=function(){
  const before=game.history.length;
  baseUndoGame();
  if(game.history.length<before){gameUci.splice(-2);analysis=null;}
};
$("btnUndo").onclick=()=>undoGame();
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
function showReady(tcTxt){
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
  const s=$("status"); if(s)s.textContent=t("Press start when you are ready.");
  try{$("readyStart").focus();}catch(e){}
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
if($("readyStart"))$("readyStart").onclick=startReadyGame;
if($("readySettings"))$("readySettings").onclick=()=>{
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
