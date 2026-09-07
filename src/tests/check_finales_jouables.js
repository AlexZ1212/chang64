/* Verification automatique de chang64.
   Lancement : node tests/check_finales_jouables.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-09-06, signale par Alexandre : "l'exercice
   finales est casse"). Deux defauts distincts, tous deux invisibles pour les
   suites existantes parce qu'elles ne cliquaient jamais sur une PIECE de
   finale, seulement sur les puces de scenario.

   1. Le routage des clics. Les finales ont quitte l'onglet Defis pour
      l'onglet Resoudre : elles tournent donc avec mode==="puzzles". Or
      onSquare (ui.js) comme modeClick (ui3.js, le chemin du glisser-deposer)
      envoyaient tout mode==="puzzles" vers handlePuzzleClick, qui valide le
      clic contre l'exercice tactique charge auparavant.
      handleEndgameClick n'etait jamais atteint : aucune piece ne bougeait.
      Le garde est enFinales() (ui2.js), teste des deux cotes.

   2. La position affichee. L'ecran Finales ne touchait pas au plateau : on y
      arrivait devant la position du dernier exercice tactique, et une finale
      commencee puis quittee ne revenait pas. Il ouvre desormais une position
      s'il n'y en a pas, et restaure la sienne s'il y en a une.

   Ne remplace pas le test du deplacement par un test de selection seule :
   c'est le COUP joue qui distingue les deux chemins de code, la selection
   d'une piece pouvant reussir par accident. */
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
const cases=()=>[...d.getElementById("board").children];
const pieces=()=>d.getElementById("board").querySelectorAll(".piece").length;
const caseBlanche=()=>cases().find(c=>{const p=c.querySelector(".piece");
  return p&&/^w/.test(p.getAttribute("data-p"))&&p.getAttribute("data-p")!=="wk";});
const caseRoiBlanc=()=>cases().find(c=>{const p=c.querySelector(".piece");
  return p&&p.getAttribute("data-p")==="wk";});

setTimeout(async()=>{
  $("tab-puzzles").click(); await wait(500);
  $("cardSolveEndgames").click(); await wait(600);

  console.log("\n--- L'ecran ouvre sur une vraie position, pas sur le puzzle precedent ---");
  T("l'ecran Finales est affiche", !$("solveEndgamesScreen").classList.contains("hide"));
  T("le menu a laisse la place", $("solveMenu").classList.contains("hide"));
  T("une position de finale est en place", pieces()>=3&&pieces()<=4, pieces()+" pieces");
  T("le compteur de coups part de zero", $("egMoves").textContent==="0", $("egMoves").textContent);
  T("un budget est annonce", Number($("egBudget").textContent)>0, $("egBudget").textContent);

  console.log("\n--- On peut deplacer les pieces comme on veut ---");
  const dep=caseBlanche()||caseRoiBlanc();
  T("une piece blanche est cliquable", !!dep);
  dep.click(); await wait(200);
  T("la piece se selectionne", dep.className.includes("sel"), dep.className);
  const dests=cases().filter(c=>c.querySelector(".dot")||c.querySelector(".ring"));
  T("ses coups legaux sont proposes", dests.length>0, dests.length+" destinations");
  const avant=Number($("egMoves").textContent);
  if(dests.length)dests[0].click();
  await wait(400);
  T("le coup est joue et compte", Number($("egMoves").textContent)===avant+1,
    "compteur "+$("egMoves").textContent);
  T("le coup libre n'a pas ete traite comme un exercice tactique",
    !/Not quite|Pas tout a fait|Pas tout à fait/i.test($("egStatus").textContent||""),
    $("egStatus").textContent);

  console.log("\n--- Aller et retour : la finale en cours est retrouvee ---");
  const coups=$("egMoves").textContent,nom=$("egName").textContent;
  $("cardSolvePuzzles")&&$("tab-puzzles").click(); await wait(400);
  $("cardSolvePuzzles").click(); await wait(1600);
  T("un exercice tactique a bien pris la place", pieces()>4, pieces()+" pieces");
  $("tab-puzzles").click(); await wait(400);
  $("cardSolveEndgames").click(); await wait(600);
  T("la finale est revenue sur le plateau", pieces()>=3&&pieces()<=4, pieces()+" pieces");
  T("c'est la meme finale", $("egName").textContent===nom, $("egName").textContent);
  T("le compteur de coups n'a pas ete perdu", $("egMoves").textContent===coups,
    $("egMoves").textContent+" au lieu de "+coups);

  console.log("\n--- Le budget laisse une marge sur le jeu parfait ---");
  /* Les budgets etaient cales sur l'optimum theorique (34 pour Fou+Cavalier,
     dont l'optimum EST 33) : la moindre imprecision rendait le mat
     impossible. On verifie ici la marge, pas la valeur exacte. */
  const budgets={"Queen vs King":16,"Rook vs King":26,"Two rooks vs King":14,
    "Bishop and knight":45,"King and pawn":32};
  for(const b of $("egChips").children){
    b.click(); await wait(400);
    const attendu=budgets[$("egName").textContent];
    T("budget de "+$("egName").textContent, Number($("egBudget").textContent)===attendu,
      $("egBudget").textContent+" au lieu de "+attendu);
  }

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
