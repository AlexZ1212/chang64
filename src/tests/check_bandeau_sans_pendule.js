/* Verification automatique de chang64.
   Lancement : node tests/check_bandeau_sans_pendule.js

   En partie sans pendule, le bandeau au-dessus et au-dessous de l'echiquier
   etait masque en entier : on perdait le temps (normal), mais aussi le nom
   des deux joueurs et les pieces prises. Desormais le bandeau reste, seul
   le temps disparait (classe "untimed"), sans laisser de vide a sa place,
   et le bandeau garde la meme hauteur qu'avec pendule. */
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(require("path").join(__dirname,"..","site","index.html"),"utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole()});
const w=dom.window,d=w.document;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const $=id=>d.getElementById(id);
const visible=id=>!$(id).classList.contains("hide");
const tempsMasque=id=>w.getComputedStyle($(id).querySelector("time")).display==="none";
/* Pose des prises directement dans l'historique, comme
   check_overlay_et_verrouillage.js : jouer les coups ferait repondre le bot
   entre-temps. Les blancs ont pris un cavalier, les noirs un pion. */
const poserPrises=()=>w.eval('(function(){busy=true;game.history=[];' +
  'game.history.push({m:{captured:2|8}});game.history.push({m:{captured:1|0}});' +
  'renderClocks();busy=false;})()');
setTimeout(async()=>{
  $("heroPlay").click(); await wait(600);
  /* Partie avec pendule d'abord : c'est la reference. */
  if(!$("readyBanner").classList.contains("hide")){$("readyStart").click(); await wait(400);}

  console.log("\n--- Reference : partie avec pendule ---");
  T("bandeaux visibles", visible("clockTop")&&visible("clockBottom"));
  T("le temps est affiche", !tempsMasque("clockTop")&&!tempsMasque("clockBottom"));
  T("pas de classe untimed", !$("clockTop").classList.contains("untimed"));

  /* Abandon, puis cadence "Sans pendule", puis nouvelle partie. */
  $("btnResign").click(); await wait(250);
  $("btnResign").click(); await wait(400);
  const sans=[...$("tcCats2").children].find(b=>b.dataset.cat==="none"||/No clock|Sans pendule/.test(b.textContent));
  T("la cadence sans pendule existe", !!sans);
  if(sans){sans.click(); await wait(300);}
  /* Premier clic : "Nouvelle partie" remet l'echiquier a zero ; second
     clic : "Lancer la partie" la demarre. */
  $("btnNew").click(); await wait(400);
  if(!w.eval("gameStarted")){$("btnNew").click(); await wait(500);}
  if(!$("readyBanner").classList.contains("hide")){$("readyStart").click(); await wait(400);}

  console.log("\n--- Partie sans pendule ---");
  T("la pendule est bien desactivee", w.eval("clock.enabled")===false);
  T("bandeau du haut visible", visible("clockTop"));
  T("bandeau du bas visible", visible("clockBottom"));
  T("marque untimed des deux cotes",
    $("clockTop").classList.contains("untimed")&&$("clockBottom").classList.contains("untimed"));
  T("le temps n'est pas affiche en haut", tempsMasque("clockTop"));
  T("le temps n'est pas affiche en bas", tempsMasque("clockBottom"));
  T("aucun texte de temps residuel", !$("clockTopTime").textContent&&!$("clockBottomTime").textContent);
  const nomHaut=$("clockTopName").textContent.trim(), nomBas=$("clockBottomName").textContent.trim();
  T("l'adversaire est nomme", /^Chang/.test(nomHaut), nomHaut);
  T("le joueur est nomme", /^(You|Vous)$/.test(nomBas), nomBas);
  const pastilles=[$("clockTopSwatch").className,$("clockBottomSwatch").className];
  T("une pastille claire et une foncee", pastilles.filter(c=>c==="dark").length===1, pastilles.join("|"));
  T("aucun bandeau actif, faute de pendule",
    !$("clockTop").classList.contains("active")&&!$("clockBottom").classList.contains("active"));

  console.log("\n--- Pieces prises sans pendule ---");
  T("rangee presente des le debut", !!$("takenTop").querySelector(".taken")&&!!$("takenBottom").querySelector(".taken"));
  poserPrises(); await wait(250);
  const nb=$("takenTop").querySelectorAll(".tk").length+$("takenBottom").querySelectorAll(".tk").length;
  T("les deux prises sont affichees", nb===2, String(nb));
  T("le solde est affiche", /\+2/.test($("takenTop").textContent+$("takenBottom").textContent),
    $("takenTop").textContent+" / "+$("takenBottom").textContent);

  console.log("\n--- Meme rendu qu'avec pendule ---");
  /* jsdom ne calcule pas de mise en page : on verifie la regle elle-meme.
     La ligne du nom garde la hauteur du chronometre (20px). */
  const css=[...d.querySelectorAll("style")].map(s=>s.textContent).join("\n");
  T("regle qui masque le temps", /\.clock\.untimed time\{display:none\}/.test(css));
  T("la ligne garde la hauteur du chronometre", /\.clock\.untimed \.clock-line\{min-height:20px\}/.test(css));
  T("meme structure : nom puis prises",
    !!$("clockBottom").querySelector(".clock-line .who")&&!!$("clockBottom").querySelector(".taken-slot .taken"));

  console.log("\n--- Hors de l'onglet Jouer ---");
  $("tab-puzzles").click(); await wait(400);
  T("bandeaux masques dans Exercices", !visible("clockTop")&&!visible("clockBottom"));
  $("tab-play").click(); await wait(450);
  T("de retour dans Jouer", visible("clockTop")&&$("clockTop").classList.contains("untimed"));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
