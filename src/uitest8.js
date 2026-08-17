const fs=require("fs");const {JSDOM}=require("jsdom");
const html=fs.readFileSync("./site/index.html","utf8");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const T=(l,ok,x)=>console.log((ok?"  ok  ":" FAIL ")+l+(x?" — "+x:""));
(async()=>{
  const errors=[];
  const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/"});
  const w=dom.window; w.addEventListener("error",e=>errors.push(e.message));
  const $=id=>w.document.getElementById(id);
  const cells=()=>$("board").children;
  const click=el=>el.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
  const isFlipped=()=>{const c=cells()[0].querySelector(".co.r");return c?c.textContent.trim()==="1":false;};
  const cellFor=sq=>{const f="abcdefgh".indexOf(sq[0]),r=8-parseInt(sq[1],10);return isFlipped()?(7-r)*8+(7-f):r*8+f;};
  const pieceCount=()=>$("board").querySelectorAll(".piece").length;
  await wait(700);
  const startGame=async(ms)=>{ if(/Start game|Lancer la partie/.test($("btnNew").textContent)){click($("btnNew"));await wait(ms||700);} };
  const restart=async(ms)=>{ click($("btnNew")); await wait(300); await startGame(ms); };
  T("app boots", errors.length===0, errors.join(" | "));

  console.log("\nENDGAME TRAINER");
  click($("tab-train")); await wait(600);
  T("train pane shown", !$("pane-train").className.includes("hide"));
  T("five endgames offered", $("egChips").children.length===5,
    Array.from($("egChips").children).map(c=>c.textContent).join(", "));
  T("position generated", pieceCount()>=3, pieceCount()+" pieces");
  T("target shown", $("egBudget").textContent==="12", $("egBudget").textContent);
  click($("egChips").children[1]); await wait(400);
  T("switching scenario works", $("egName").textContent==="Rook vs King" && $("egBudget").textContent==="20", $("egName").textContent);
  T("rook on the board", $("board").innerHTML.includes('data-p="wr"'));
  const before=pieceCount();
  click($("btnEgNew")); await wait(400);
  T("new position keeps the same material", pieceCount()===before, pieceCount()+" pieces");
  T("moves counter reset", $("egMoves").textContent==="0");

  /* Les identifiants de l'entraineur ont change : coordTime/coordTarget/
     coordScore n'existent plus, l'affichage passe par coordHud et ses champs
     chudTime, chudSquare, chudScore. Le test visait une interface disparue et
     plantait avant d'avoir rien verifie. */
  console.log("\nCOORDINATE TRAINER");
  /* Un overlay attend le feu vert avant de lancer les trente secondes :
     perdre les deux premieres a comprendre ou on est, ca compte. */
  click($("btnCoord")); await wait(400);
  if(!$("readyBanner").classList.contains("hide")){click($("readyStart")); await wait(400);}
  T("timer started", parseFloat($("chudTime").textContent)<30 && parseFloat($("chudTime").textContent)>28, $("chudTime").textContent);
  T("board emptied", pieceCount()===0, pieceCount()+" pieces");
  T("a square is asked for", /^[a-h][1-8]$/.test($("chudSquare").textContent), $("chudSquare").textContent);
  const target=$("chudSquare").textContent;
  click(cells()[cellFor(target)]); await wait(300);
  T("correct click scores", $("chudScore").textContent==="1", $("chudScore").textContent);
  const t2=$("chudSquare").textContent;
  const wrong="abcdefgh"[( "abcdefgh".indexOf(t2[0])+3)%8]+t2[1];
  click(cells()[cellFor(wrong)]); await wait(300);
  T("wrong click counted", $("chudMiss").textContent==="1", $("chudMiss").textContent);
  /* isFlipped() lit les reperes de colonnes, or l'entrainement aux
     coordonnees les masque volontairement : c'est tout son interet. On
     verifie donc le retournement par son effet observable, en cliquant la
     case demandee selon la grille inversee et en constatant que ca marque. */
  click($("coordSide").children[1]); await wait(250);
  T("side button reflects the choice",
    $("coordSide").children[1].getAttribute("aria-pressed")==="true");
  const avant=+$("chudScore").textContent;
  const cible=$("chudSquare").textContent.trim();
  const file="abcdefgh".indexOf(cible[0]), rank=+cible[1];
  const idxFlip=(rank-1)*8+(7-file);
  click(cells()[idxFlip]); await wait(300);
  T("board can be flipped mid-drill", +$("chudScore").textContent===avant+1,
    "score "+avant+" -> "+$("chudScore").textContent);
  const atteint=+$("chudScore").textContent;
  click($("btnCoord")); await wait(400);
  /* Le record doit refleter le score reellement atteint, quel qu'il soit :
     figer une valeur obligerait a retoucher le test des qu'on ajoute une
     etape en amont. */
  T("drill stops and saves", +$("coordBest").textContent===atteint,
    "record "+$("coordBest").textContent+" pour un score de "+atteint);
  T("pieces come back", pieceCount()>=3, pieceCount()+" pieces");

  console.log("\nDRAG AND DROP");
  click($("tab-play")); await wait(600);
  await startGame();
  const rect={left:0,top:0,width:400,height:400,right:400,bottom:400};
  $("board").getBoundingClientRect=()=>rect;
  const pt=(sq)=>{const i=cellFor(sq);return {x:(i%8)*50+25,y:Math.floor(i/8)*50+25};};
  const send=(type,p)=>$("board").dispatchEvent(new w.MouseEvent(type,{bubbles:true,clientX:p.x,clientY:p.y}));
  const from=pt("e2"),to=pt("e4");
  send("pointerdown",from);
  send("pointermove",{x:from.x+20,y:from.y-20});
  send("pointermove",{x:to.x,y:to.y});
  T("ghost piece follows the pointer", w.document.querySelectorAll(".dragghost").length===1);
  send("pointerup",to);
  await wait(1200);
  T("drag played the move", $("sheet").textContent.includes("e4"), $("sheet").textContent.replace(/\s+/g," ").trim().slice(0,20));
  T("ghost removed", w.document.querySelectorAll(".dragghost").length===0);
  const sheetNow=$("sheet").textContent;
  const p1=pt("a7"),p2=pt("a5");
  send("pointerdown",p1); send("pointermove",{x:p2.x,y:p2.y}); send("pointerup",p2);
  await wait(600);
  T("cannot drag the opponent's pieces", $("sheet").textContent===sheetNow);
  T("clicking still works after dragging", (()=>{const i=cellFor("d2");click(cells()[i]);return $("board").querySelectorAll(".dot,.ring").length>0;})());

  console.log("\nSTOCKFISH");
  T("button present", !!$("btnStockfish"));
  T("honest default message", /built-in engine/.test($("sfStatus").textContent));
  click($("btnStockfish")); await wait(1500);
  T("failure handled gracefully", /could not start|Fetching/.test($("sfStatus").textContent), $("sfStatus").textContent);
  T("app still alive after failure", $("board").children.length===64);

  console.log("\nINSTALL");
  T("install button hidden until the browser offers it", $("btnInstall").className.includes("hide"));

  console.log("\nJS errors:", errors.join(" | ")||"none");
  process.exit(0);
})();
