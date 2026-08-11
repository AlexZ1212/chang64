/* Verification automatique de chang64.
   Lancement : node tests/check_nom_adversaire.js

   L'adversaire s'appelait "Ordinateur". Il porte desormais la marque et sa
   force : "Chang · Coriace". Chang designe l'adversaire, chang64 le site :
   les confondre laisserait croire qu'on joue contre la plateforme. */
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(require("path").join(__dirname,"..","site","index.html"),"utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole()});
const d=dom.window.document;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(async()=>{
  d.getElementById("heroPlay").click(); await wait(600);
  d.getElementById("readyStart").click(); await wait(300);
  const nom=()=>d.getElementById("clockTopName").textContent.trim();

  console.log("\n--- L'adversaire est nomme ---");
  T("plus d'Ordinateur generique", !/^(Computer|Ordinateur)$/.test(nom()), nom());
  T("porte la marque", /^Chang/.test(nom()), nom());
  T("porte la force", nom().includes("\u00b7"), nom());
  T("ce n'est pas le nom du site", !/chang64/i.test(nom()), nom());
  T("assez court pour la barre", nom().length<=22, nom().length+" caracteres : "+nom());
  T("le joueur reste distinct", d.getElementById("clockBottomName").textContent.trim()!==nom());

  console.log("\n--- Le nom suit le changement de force ---");
  /* La force n'est plus modifiable pendant une partie : changer d'adversaire
     en cours de route n'aurait pas de sens. On abandonne donc d'abord, ce qui
     est le chemin reel d'un joueur voulant changer de niveau. */
  const seg=d.getElementById("segLevel");
  const avant=nom();
  T("force verrouillee pendant la partie", seg.children[0].disabled);
  d.getElementById("btnResign").click(); await wait(250);
  d.getElementById("btnResign").click(); await wait(400);
  T("force deverrouillee apres abandon", !seg.children[0].disabled);
  seg.querySelector('[data-v="4"]').click(); await wait(300);
  d.getElementById("btnNew").click(); await wait(500);
  const rb=d.getElementById("readyBanner");
  if(rb&&!rb.classList.contains("hide")){d.getElementById("readyStart").click();await wait(300);}
  T("le nom a change", nom()!==avant, avant+" -> "+nom());
  T("il reflete le niveau choisi",
    nom().includes(seg.querySelector('[data-v="4"]').textContent.trim()), nom());

  console.log("\n--- En francais ---");
  /* renderClocks sort immediatement si les pendules sont masquees : il faut
     donc une partie reellement en cours pour verifier le nom affiche. */
  /* On repart d'une partie chronometree franchement demarree, sinon les
     pendules restent masquees et le nom n'est jamais recalcule. */
  if(!d.getElementById("btnNew").disabled){
    d.getElementById("btnNew").click(); await wait(500);
    const rb2=d.getElementById("readyBanner");
    if(rb2&&!rb2.classList.contains("hide")){d.getElementById("readyStart").click();await wait(300);}
  }
  [...d.getElementById("langSwitch").children].find(b=>b.dataset.lang==="fr").click();
  await wait(600);
  T("les pendules sont visibles", !d.getElementById("clockTop").classList.contains("hide"));
  T("la force est traduite", /Coriace|Tranquille|Sérieux|Débutant/.test(nom()), nom());
  T("Chang reste en l'etat", /^Chang /.test(nom()), nom());

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
