/* Verification automatique de chang64.
   Lancement : node tests/check_motifs_minces.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-10-18) : un motif trop mince n'est plus propose
   comme objectif. Apres la purge des prises en un coup, Winning capture n'a
   plus que 30 exercices, et Quiet move n'en a jamais eu que 21, ce qui
   rendait son badge a 25 impossible a obtenir. Sous SEUIL_MOTIF (ui.js,
   meme valeur dans content.js) :
     - pas de tuile dans "Par motif", et le "3/12 motifs" ne la compte pas ;
     - pas de badge a gagner, mais un badge deja gagne reste affiche ;
     - pas de bouton "Entraine-toi" sur la page Apprendre, qui reste.
   Le seuil suit les donnees : un motif rempli par le minage revient seul. */
const path=require("path");
const SITE=path.join(__dirname,"..","site");
const fs=require("fs"),jd=require("jsdom");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

const html=fs.readFileSync(SITE+"/index.html","utf8");
const counts=JSON.parse(fs.readFileSync(SITE+"/data/theme-counts.json","utf8"));
const UI=fs.readFileSync(path.join(__dirname,"..","ui.js"),"utf8");
const SEUIL=+((UI.match(/const SEUIL_MOTIF=(\d+)[;,]/)||[])[1]||0);
const minces=Object.keys(counts).filter(th=>counts[th]<SEUIL);

(async()=>{
  console.log("\n--- Le seuil et les donnees ---");
  T("SEUIL_MOTIF est lisible dans ui.js",SEUIL>0,String(SEUIL));
  T("content.js applique le meme seuil",
    new RegExp("const SEUIL_MOTIF = "+SEUIL+";").test(fs.readFileSync(path.join(__dirname,"..","content.js"),"utf8")));
  /* Winning capture et Quiet move etaient sous le seuil le 2026-10-18 ; la
     fusion du 2026-10-22 les a repeuples (3396 et 4623). Le test suit donc
     les donnees au lieu de figer quels motifs sont minces. */
  T("le seuil range chaque motif selon son compte",
    Object.keys(counts).every(th=>minces.includes(th)===(counts[th]<SEUIL)),minces.join(", ")||"aucun motif mince");
  T("Mate in three reste au-dessus",counts["Mate in three"]>=SEUIL,String(counts["Mate in three"]));

  const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,
    url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole(),
    beforeParse(w){w.fetch=u=>{const p=SITE+String(u).replace(/^https?:\/\/[^/]+/,"");
      return fs.existsSync(p)?Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(JSON.parse(fs.readFileSync(p,"utf8")))})
                             :Promise.resolve({ok:false,status:404});};}});
  const w=dom.window,d=w.document;
  await wait(3600);

  console.log("\n--- Par motif ---");
  w.eval("setMode('puzzles');showSolveScreen('motifs')"); await wait(700);
  const tuiles=[...d.querySelectorAll("#motifsGrid button[data-motif]")].map(b=>b.dataset.motif);
  T("aucune tuile pour un motif mince",tuiles.every(th=>!minces.includes(th)),tuiles.join(", "));
  T("Mate in three garde sa tuile",tuiles.includes("Mate in three"));
  const repeuples=["Winning capture","Quiet move"].filter(th=>counts[th]>=SEUIL);
  T("un motif repeuple par le minage retrouve sa tuile",
    repeuples.every(th=>tuiles.includes(th)),repeuples.join(", ")+" / "+tuiles.join(", "));
  w.eval("renderSolveMenu()"); await wait(300);
  const sous=(d.getElementById("subSolveMotifs")||{}).textContent||"";
  T("le compte des motifs ne compte que les tuiles affichees",
    new RegExp("/"+tuiles.length+"\\b").test(sous),sous+" pour "+tuiles.length+" tuiles");

  console.log("\n--- Badges ---");
  const badgesVisibles=()=>{w.eval("renderBadges()");
    return [...d.querySelectorAll("#badgeGrid .badge")].map(b=>b.textContent);};
  const nomMotif=th=>w.eval("t("+JSON.stringify(th)+")");
  let vus=badgesVisibles();
  T("pas de badge a gagner pour un motif mince",
    minces.every(th=>!vus.some(x=>x.includes(nomMotif(th)))),vus.join(" | "));
  T("les badges des motifs proposes restent",vus.some(x=>x.includes(nomMotif("Knight fork"))));
  w.eval("prog.badges.push('theme_winning_capture')");
  vus=badgesVisibles();
  T("un badge deja gagne reste affiche",vus.some(x=>x.includes(nomMotif("Winning capture"))));

  console.log("\n--- Page Apprendre ---");
  for(const f of ["learn/spotting-a-hanging-piece.html","learn/the-quiet-move.html"]){
    const h=fs.readFileSync(SITE+"/"+f,"utf8");
    const th=f.includes("hanging")?"Winning capture":"Quiet move";
    const bouton=/href="\/#theme=/.test(h);
    T(f+" : page conservee, bouton d'entrainement "+(counts[th]>=SEUIL?"present":"absent")+" ("+counts[th]+" exercices)",
      bouton===(counts[th]>=SEUIL));
  }
  T("learn/knight-fork.html garde son bouton",
    /href="\/#theme=Knight%20fork"/.test(fs.readFileSync(SITE+"/learn/knight-fork.html","utf8")));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
})();
