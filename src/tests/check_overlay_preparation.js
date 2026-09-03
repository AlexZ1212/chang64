/* Verification automatique de chang64.
   Lancement : node tests/check_overlay_preparation.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Sur une partie chronometree, la pendule demarrait en meme temps que la
   partie : arriver depuis l'accueil coutait de vraies secondes en bullet.
   L'overlay de preparation gele tout jusqu'au feu vert du joueur. */
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(require("path").join(__dirname,"..","site","index.html"),"utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole()});
const w=dom.window,d=w.document;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(async()=>{
  const ready=d.getElementById("readyBanner");

  console.log("\n--- Depuis l'accueil, en cadence chronometree ---");
  d.getElementById("heroPlay").click();
  await wait(600);
  T("overlay affiche", !ready.classList.contains("hide"));
  T("cadence et force annoncees", (d.getElementById("readySub").textContent||"").length>10,
     d.getElementById("readySub").textContent);
  T("statut invite a demarrer", /prêt|ready/i.test(d.getElementById("status").textContent||""),
     d.getElementById("status").textContent);

  console.log("\n--- La pendule ne s'ecoule pas pendant l'attente ---");
  const lire=()=>d.getElementById("clockBottomTime").textContent+" / "+d.getElementById("clockTopTime").textContent;
  T("les pendules existent bien", !!d.getElementById("clockBottomTime"), lire());
  const avant=lire();
  await wait(1600);
  const apres=lire();
  T("pendule figee pendant l'attente", avant===apres, avant+" -> "+apres);

  console.log("\n--- Le lancement demarre bien la partie ---");
  d.getElementById("readyStart").click();
  await wait(400);
  T("overlay masque", ready.classList.contains("hide"));
  T("echiquier jouable", d.getElementById("board").children.length===64);

  console.log("\n--- La pendule repart, sans saut ---");
  /* Attente conditionnelle : on attend que la pendule bouge plutot que de
     parier sur une duree, qui echouerait sous charge sans defaut reel. */
  const t1=lire();
  const jusqua=Date.now()+4000;
  while(lire()===t1&&Date.now()<jusqua)await wait(120);
  const t2=lire();
  T("la pendule s'ecoule apres le lancement", t1!==t2, t1+" -> "+t2);
  T("aucun saut : moins de 5 s consommees d'un coup",
    (()=>{const p=x=>{const m=x.split(" / ")[0].split(":");return +m[0]*60+ +m[1];};
      return p(avant)-p(t2)<=5;})(), avant+" -> "+t2);

  console.log("\n--- Sans pendule, pas d'overlay ---");
  d.getElementById("tab-play").click(); await wait(300);
  const cats=[...d.getElementById("tcCats").children];
  const sans=cats[cats.length-1];
  sans.click(); await wait(300);
  d.getElementById("btnNew").click(); await wait(500);
  T("aucun overlay en cadence libre", ready.classList.contains("hide"),
     "cadence : "+sans.textContent.trim());

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
