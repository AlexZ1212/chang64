/* Verification automatique de chang64.
   Lancement : node tests/check_placement_blocs.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Quatre defauts de placement signales le 2026-09-06 par Alexandre, gardes
   ensemble parce qu'ils relevent du meme geste : ou un bloc se trouve a
   l'ecran, pas ce qu'il contient.

   1. La modale de promotion couvrait tout le navigateur (position:fixed)
      alors qu'elle porte sur UNE case. Elle vit maintenant dans
      .board-frame, avec les deux autres overlays (readyBanner,
      resultBanner) et la meme geometrie.
   2. En revue d'apres-partie, le bloc "Revue" arrivait en quatrieme
      position : les reglages redeviennent visibles au-dessus de lui et la
      feuille de partie le precede. Reordonne en flex sous la classe .revue
      plutot que deplace dans le DOM, pour que l'ordre du document reste
      celui de la lecture au clavier pendant la partie.
   3. Pendant les phases de preparation le plateau est masque, mais la
      grille .layout gardait ses deux colonnes : contenu tasse a droite,
      trou a gauche. .layout.solo repasse en colonne unique centree.
   4. .bloc n'avait aucune regle CSS hors .repliable : deux blocs
      consecutifs se touchaient, et sur l'ecran Finales le titre collait au
      bloc au trait laiton juste au-dessus. Et le recap hebdo de l'accueil
      flottait hors du panneau "Ma progression" dont il commente les
      chiffres.

   Les mesures passent par getComputedStyle : verifier la presence des
   regles dans la feuille ne dirait pas si elles s'appliquent vraiment. */
const SITE = require("path").join(__dirname, "..", "site");
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(""+SITE+"/index.html","utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",
  virtualConsole:new jd.VirtualConsole(),
  beforeParse(w){ w.fetch=u=>{const p=SITE+String(u).replace(/^https?:\/\/[^/]+/,"");
    return fs.existsSync(p)?Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(JSON.parse(fs.readFileSync(p,"utf8")))})
                           :Promise.resolve({ok:false,status:404});};}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id);
const style=el=>w.getComputedStyle(el);
const ordre=id=>Number(style($(id)).order||0);

setTimeout(async()=>{
  console.log("\n--- 1. La promotion se decide sur l'echiquier ---");
  const cadre=d.querySelector(".board-frame");
  T("la modale vit dans le cadre de l'echiquier", cadre.contains($("promoModal")));
  T("elle se cale dessus et non sur l'ecran", style($("promoModal")).position==="absolute",
    style($("promoModal")).position);
  T("meme retrait que les autres overlays", style($("promoModal")).inset==="10px"
    ||style($("promoModal")).top==="10px", style($("promoModal")).top);
  T("le cadre est bien le repere de positionnement", style(cadre).position==="relative");
  T("meme geometrie que l'overlay de resultat",
    style($("promoModal")).top===style($("resultBanner")).top,
    style($("promoModal")).top+" vs "+style($("resultBanner")).top);

  console.log("\n--- 4. Rien ne touche le bloc qui le precede ---");
  const blocs=$("solveEndgamesScreen").querySelectorAll(".bloc");
  T("l'ecran Finales a bien deux blocs", blocs.length===2, blocs.length+" blocs");
  T("le second ne colle pas au premier",
    parseFloat(style(blocs[1]).marginTop)>=12, style(blocs[1]).marginTop);
  T("le recap hebdo est dans le bloc 'Ma progression'",
    $("homeProgressPanel").contains($("weeklyRecap")));

  console.log("\n--- 3. Preparation : une seule colonne, pas de trou a gauche ---");
  $("tab-play").click(); await wait(600);
  T("le plateau est bien masque pendant les reglages",
    d.querySelector(".board-wrap").classList.contains("hide"));
  T("la grille repasse en colonne unique", $("appLayout").classList.contains("solo"));
  T("la colonne de l'echiquier ne laisse plus de trou",
    style(d.querySelector(".board-side")).display==="none",
    style(d.querySelector(".board-side")).display);
  $("tab-puzzles").click(); await wait(500);
  T("meme chose sur le menu de Resoudre", $("appLayout").classList.contains("solo"));
  $("cardSolvePuzzles").click(); await wait(1600);
  T("l'echiquier revenu, la grille reprend ses deux colonnes",
    !$("appLayout").classList.contains("solo"));

  console.log("\n--- 2. Apres la partie, la revue passe devant ---");
  $("tab-play").click(); await wait(500);
  $("btnNew").click(); await wait(500);
  if(!$("readyBanner").classList.contains("hide")){$("readyStart").click(); await wait(600);}
  T("une partie est en cours", !$("appLayout").classList.contains("solo"));
  T("pendant la partie, aucun reordonnancement",
    !$("pane-play").classList.contains("revue"));
  $("btnResign").click(); await wait(150);
  $("btnResign").click(); await wait(800);
  T("la partie est terminee", !$("reviewPanel").classList.contains("hide"));
  T("le reordonnancement est actif", $("pane-play").classList.contains("revue"));
  T("la revue passe devant les reglages", ordre("reviewPanel")<ordre("settingsPanel"),
    "revue "+ordre("reviewPanel")+", reglages "+ordre("settingsPanel"));
  T("elle passe devant la feuille de partie", ordre("reviewPanel")<ordre("scoresheetPanel"),
    "revue "+ordre("reviewPanel")+", feuille "+ordre("scoresheetPanel"));
  T("le statut reste en tete", ordre("statusPanel")<ordre("reviewPanel"));
  T("l'historique et le PGN restent en fin", ordre("historyPanel")>ordre("settingsPanel")
    &&ordre("pgnPanel")>ordre("historyPanel"));
  T("l'ordre du DOM n'a pas bouge",
    $("settingsPanel").compareDocumentPosition($("reviewPanel"))&w.Node.DOCUMENT_POSITION_FOLLOWING);
  T("les panneaux ne se collent pas entre eux",
    parseFloat(style($("pane-play")).gap)>=14, style($("pane-play")).gap);

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
