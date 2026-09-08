/* Verification automatique de chang64.
   Lancement : node tests/check_entrainement_motif.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-09-07) : la section "Par motif" remplace le
   filtre par menu deroulant qui vivait dans l'ecran des exercices.

   L'ancien filtre ne se contentait pas d'etre invisible, il MENTAIT. Depuis
   le redecoupage par famille, un motif tient entierement dans un niveau ;
   le filtre laissait l'echelle courir, et des la premiere montee levelPool()
   retombait silencieusement sur le lot du nouveau niveau. Le menu affichait
   donc un motif et le site en servait un autre, sans erreur ni message.

   La promesse ecrite sur la carte est donc double, et les deux moities se
   testent ici :
     1. on recoit bien le motif demande, et rien d'autre ;
     2. le niveau ne bouge pas, ni en montant ni en descendant.

   Un test qui verifierait seulement que motifEnCours est pose passerait au
   vert sur le code casse : ce qui compte est l'exercice REELLEMENT servi et
   la valeur de prog.level apres coup. */
const SITE = require("path").join(__dirname, "..", "site");
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(""+SITE+"/index.html","utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function ouvrir(hash,cb){
  const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,
    url:"https://chang64.com/"+hash,virtualConsole:new jd.VirtualConsole(),
    beforeParse(w){w.fetch=u=>{const p=SITE+String(u).replace(/^https?:\/\/[^/]+/,"");
      return fs.existsSync(p)?Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(JSON.parse(fs.readFileSync(p,"utf8")))})
                             :Promise.resolve({ok:false,status:404});};}});
  setTimeout(()=>cb(dom.window),3600);
}
/* Visibilite EFFECTIVE : un element demasque dans un conteneur masque reste
   invisible, et c'est un piege deja paye plusieurs fois sur ce projet. */
const vu=(w,id)=>{const d=w.document,e=d.getElementById(id); if(!e)return "absent";
  for(let n=e;n&&n!==d.body;n=n.parentElement)
    if(n.classList&&n.classList.contains("hide"))return "masque";
  return "visible";};

(async()=>{
  const counts=JSON.parse(fs.readFileSync(SITE+"/data/theme-counts.json","utf8"));

  console.log("\n--- L'ancien filtre a bien disparu ---");
  T("plus de menu deroulant de motif",!/id="themeFilter"/.test(html));
  T("plus de fonction de rendu du filtre",!/function renderThemeFilter/.test(html));
  T("la carte du menu existe",/id="cardSolveMotifs"/.test(html));
  T("l'ecran de choix existe",/id="solveMotifsScreen"/.test(html));

  await new Promise(res=>ouvrir("",async w=>{
    const d=w.document;
    console.log("\n--- La grille dit la verite sur les volumes ---");
    w.eval("setMode('puzzles');showSolveScreen('motifs')"); await wait(700);
    const tuiles=[...d.querySelectorAll("#motifsGrid button[data-motif]")];
    T("des motifs sont proposes",tuiles.length>0,tuiles.length+" tuile(s)");
    T("deux groupes distincts",d.querySelectorAll("#motifsGrid .motif-groupe").length===2);
    T("le fourre-tout 'Winning move' n'est pas propose",
      !tuiles.some(b=>b.dataset.motif==="Winning move"),
      "il ne veut rien dire pour un joueur et n'a pas de lecon");
    /* Le garde-fou central : aucun nombre n'est ecrit dans le gabarit, ils
       viennent tous du fichier de decomptes. Une fournee de minage qui rend
       moins que prevu fait donc baisser l'affichage toute seule, et une
       fausse promesse est impossible a ecrire. */
    let volumesJustes=true,detail="";
    for(const b of tuiles){
      const th=b.dataset.motif, attendu=counts[th];
      if(!b.textContent.includes(String(attendu))){volumesJustes=false;detail+=th+" ";}
      if(!attendu){volumesJustes=false;detail+=th+"(absent des donnees) ";}
    }
    T("chaque tuile annonce le volume reel de la banque",volumesJustes,detail||"tous justes");
    T("aucun motif vide n'est propose",
      tuiles.every(b=>counts[b.dataset.motif]>0));
    T("le plateau n'est pas affiche sur l'ecran de choix",
      d.querySelector(".board-wrap").classList.contains("hide"),
      "il n'a rien a y montrer");
    res();
  }));

  console.log("\n--- La promesse : le bon motif, et le niveau immobile ---");
  await new Promise(res=>ouvrir("#theme=Pin",async w=>{
    const d=w.document;
    const niveauAvant=w.eval("prog.level");
    T("le lien depuis une page de cours ouvre l'aparte",
      w.eval("motifEnCours")==="Pin",JSON.stringify(w.eval("motifEnCours")));
    T("l'exercice servi est du motif demande",
      w.eval("puzzle?puzzle.theme:null")==="Pin",w.eval("puzzle?puzzle.theme:'aucun'"));
    T("le niveau n'a pas bouge en arrivant",w.eval("prog.level")===niveauAvant,
      "avant "+niveauAvant+", apres "+w.eval("prog.level"));

    /* Le coeur du test. Trois reussites font normalement monter d'un niveau
       (registerSolved) et quatre erreurs descendre (registerWrong). Dans
       l'aparte, ni l'un ni l'autre. */
    w.eval("registerSolved();registerSolved();registerSolved();");
    T("trois reussites ne font pas monter",w.eval("prog.level")===niveauAvant,
      "niveau "+w.eval("prog.level"));
    T("mais le travail compte quand meme",w.eval("prog.solved")>0,
      "solved="+w.eval("prog.solved"));
    w.eval("prog.level=5;registerWrong();registerWrong();registerWrong();registerWrong();");
    T("quatre erreurs ne font pas descendre",w.eval("prog.level")===5,
      "niveau "+w.eval("prog.level"));
    w.eval("prog.level="+niveauAvant);

    /* L'exercice suivant doit RESTER dans le motif : c'est precisement la ou
       l'ancien filtre laissait filer. */
    w.eval("nextPuzzle()"); await wait(1200);
    T("l'exercice suivant reste dans le motif",
      w.eval("puzzle?puzzle.theme:null")==="Pin",w.eval("puzzle?puzzle.theme:'aucun'"));

    console.log("\n--- L'aparte se voit et se quitte ---");
    T("le bandeau du motif est reellement visible",vu(w,"motifBandeau")==="visible");
    T("il nomme le motif",!!d.getElementById("motifNom").textContent.trim());
    T("l'echelle cede la place",vu(w,"ladder")==="masque",
      "l'afficher gelee laisserait croire qu'on progresse dessus");
    T("la ligne de niveau aussi",vu(w,"lvlRow")==="masque");
    d.getElementById("btnMotifSortie").click(); await wait(900);
    T("quitter ramene au choix des motifs",w.eval("solveScreen")==="motifs",w.eval("solveScreen"));
    T("et referme l'aparte",w.eval("motifEnCours")===null);
    w.eval("showSolveScreen('puzzles')"); await wait(900);
    T("l'echelle revient ensuite",vu(w,"ladder")==="visible");
    T("le bandeau disparait",vu(w,"motifBandeau")==="masque");

    console.log("\n--- L'aparte ne survit pas en arriere-plan ---");
    /* C'etait le piege de l'ancien filtre : reste pose, oublie, il faussait
       tout ce qui suivait sans qu'on sache pourquoi. */
    w.eval("motifEnCours='Pin';showSolveScreen('menu')"); await wait(600);
    T("changer d'ecran le referme",w.eval("motifEnCours")===null);
    res();
  }));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
})();
setTimeout(()=>{console.log("\n=== "+ok+" OK, "+(ko+1)+" FAIL === (delai depasse)");process.exit(1);},180000);
