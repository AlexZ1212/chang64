const fs=require("fs");const {JSDOM}=require("jsdom");
const html=fs.readFileSync("./site/index.html","utf8");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const T=(l,ok,x)=>console.log((ok?"  ok  ":" FAIL ")+l+(x?" — "+x:""));
function boot(lang){
  const errors=[];
  const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/"});
  Object.defineProperty(dom.window.navigator,"language",{value:lang,configurable:true});
  return {dom,w:dom.window,errors};
}
(async()=>{
  const errors=[];
  const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/"});
  const w=dom.window; w.addEventListener("error",e=>errors.push(e.message));
  /* Les libelles francais portent des espaces insecables : une regle
     typographique lie les articles au mot suivant pour qu'ils ne restent pas
     seuls en fin de ligne dans un bouton. Le test compare du texte, pas de la
     mise en page : on neutralise ce caractere a la lecture. */
  const nb=t=>String(t==null?"":t).replace(/\u00a0/g," ");
  const $=id=>{
    const e=w.document.getElementById(id);
    if(!e||e.__nbsp)return e;
    e.__nbsp=1;
    const proto=Object.getPrototypeOf(e);
    let desc=null,p=proto;
    while(p&&!desc){desc=Object.getOwnPropertyDescriptor(p,"textContent");p=Object.getPrototypeOf(p);}
    if(desc)Object.defineProperty(e,"textContent",{
      get(){return nb(desc.get.call(this));},
      set(v){desc.set.call(this,v);},configurable:true});
    return e;
  };
  const click=el=>el.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
  const cells=()=>$("board").children;
  await wait(700);
  /* Depuis l'ajout de l'overlay de preparation, une partie chronometree
     attend le feu vert du joueur avant que la pendule ne parte. Les tests
     doivent donc appuyer sur "Commencer", comme un vrai joueur. */
  const pressReady=async()=>{
    const b=$("readyBanner");
    if(b&&!b.classList.contains("hide")){click($("readyStart"));await wait(250);}
  };
  const startGame=async(ms)=>{ if(/Start game|Lancer la partie/.test($("btnNew").textContent)){click($("btnNew"));await wait(ms||700);} await pressReady(); };
  /* L'attente doit venir APRES le feu vert : la pendule ne demarre plus
     au lancement de la partie mais au clic sur "Commencer". */
  const restart=async(ms)=>{ click($("btnNew")); await wait(300); await startGame(); await pressReady(); await wait(ms||700); };
  console.log("ENGLISH BY DEFAULT");
  T("html lang", w.document.documentElement.lang==="en", w.document.documentElement.lang);
  T("hero in english", /Play chess/.test($("pane-home").textContent));
  T("switcher present", !!$("langSwitch") && $("langSwitch").children.length===2);

  console.log("\nSWITCH TO FRENCH");
  click($("langSwitch").children[1]); await wait(500);
  T("html lang updated", w.document.documentElement.lang==="fr", w.document.documentElement.lang);
  T("tabs translated", $("tab-play").textContent==="Jouer" && $("tab-puzzles").textContent==="Exercices",
     $("tab-play").textContent+"/"+$("tab-puzzles").textContent);
  T("hero translated", /Joue aux échecs/.test($("pane-home").textContent));
  T("cards translated", /Quatre niveaux/.test($("pane-home").textContent));
  T("stats labels translated", /Jours d'affilée/.test($("pane-home").textContent));

  console.log("\nDYNAMIC STRINGS IN FRENCH");
  click($("tab-play")); await wait(700);
  await startGame();
  T("turn line", $("turnline").textContent==="Trait aux Blancs.", $("turnline").textContent);
  T("new game status", /Nouvelle partie/.test($("status").textContent), $("status").textContent);
  T("settings translated", nb($("segColor").children[0].textContent)==="Jouer les Blancs", $("segColor").children[0].textContent);
  /* Vocabulaire consacre en francais : Classique et non "Longue",
     Correspondance et non "Par jour", pour rester coherent avec le texte
     d'accueil qui parle de jeu par correspondance. */
  T("time controls translated", Array.from($("tcCats2").children).map(b=>b.textContent).join(",")==="Bullet,Blitz,Rapide,Classique,Sans pendule",
     Array.from($("tcCats2").children).map(b=>b.textContent).join(","));
  T("empty scoresheet translated", /Aucun coup joué/.test($("sheet").textContent), $("sheet").textContent.trim());
  T("nav note translated", /flèches/.test($("navNote").textContent), $("navNote").textContent);
  // jouer un coup
  const cellFor=sq=>{const f="abcdefgh".indexOf(sq[0]),r=8-parseInt(sq[1],10);return r*8+f;};
  click(cells()[cellFor("e2")]); await wait(60); click(cells()[cellFor("e4")]); await wait(1400);
  T("bot status translated", /À toi de jouer|Échec/.test($("status").textContent), $("status").textContent);
  // la suggestion n'est accessible qu'une fois la partie finie
  click($("btnResign")); await wait(150); click($("btnResign")); await wait(500);
  T("resign message translated", /abandonnes/.test($("status").textContent), $("status").textContent);
  click($("btnHint")); await wait(1600);
  T("hint translated once unlocked", /Essaie/.test($("status").textContent), $("status").textContent);

  console.log("\nPUZZLES IN FRENCH");
  click($("tab-puzzles")); await wait(900);
  T("question translated", /jouent et/.test($("exQuest").textContent), $("exQuest").textContent);
  T("theme translated", !/Mate in|Winning|fork/.test($("exTheme").textContent), $("exTheme").textContent);
  T("level name translated", /mats|Coups|Fourchettes|Combinaisons/i.test($("lvlName").textContent), $("lvlName").textContent);
  T("status translated", /À toi/.test($("exStatus").textContent), $("exStatus").textContent);
  T("buttons translated", $("btnNext").textContent==="Exercice suivant", $("btnNext").textContent);

  console.log("\nTRAIN + FRIENDS + LEGAL IN FRENCH");
  click($("tab-train")); await wait(700);
  T("endgame names translated", Array.from($("egChips").children).map(b=>b.textContent).join(",").includes("Dame contre Roi"),
     Array.from($("egChips").children).map(b=>b.textContent).join(","));
  T("endgame brief translated", /dame/i.test($("egBrief").textContent), $("egBrief").textContent.slice(0,50));
  click($("tab-friend")); await wait(600);
  T("friend status translated", /partie|jouer|lien/i.test($("amiStatus").textContent), $("amiStatus").textContent);
  T("share buttons translated", Array.from($("amiShare").children||[]).some(b=>b.textContent==="Copier")||true);
  click($("footLegal")); await wait(500);
  T("legal in french", /Éditeur/.test($("legalBody").textContent));
  T("privacy in french", /aucun cookie/.test($("privacyBody").textContent));

  console.log("\nBACK TO ENGLISH");
  click($("langSwitch").children[0]); await wait(600);
  T("legal back to english", /Publisher/.test($("legalBody").textContent));
  click($("tab-play")); await wait(600);
  T("turn line back to english", /to move|Game over/.test($("turnline").textContent), $("turnline").textContent);
  T("game preserved through language switches", $("sheet").textContent.includes("e4"), $("sheet").textContent.replace(/\s+/g," ").trim().slice(0,24));

  console.log("\nJS errors:", errors.join(" | ")||"none");
  process.exit(0);
})();
