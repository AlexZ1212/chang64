/* Verification automatique de chang64.
   Lancement : node tests/check_verrouillage_partie.js

   Pendant une partie, seul "Abandonner" reste actif. Changer de couleur
   relancait une partie et faisait disparaitre celle en cours sans prevenir.
   Et un bouton "Analyser la partie" cliquable pendant qu on joue laisse
   croire qu il sert a trouver le meilleur coup (Stockfish tourne derriere ce
   bouton depuis la fusion des deux moteurs) : aux echecs, le soupcon de
   triche suffit a poser probleme, meme quand la fonction ne le permet pas. */
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(require("path").join(__dirname,"..","site","index.html"),"utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole()});
const w=dom.window,d=w.document;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const seg=(id)=>[...d.getElementById(id).children];
setTimeout(async()=>{
  console.log("\n--- Avant de commencer, tout est reglable ---");
  d.getElementById("tab-play").click(); await wait(400);
  T("couleur reglable", seg("segColor").every(b=>!b.disabled));
  T("force reglable", seg("segLevel").every(b=>!b.disabled));
  T("cadence reglable", seg("tcCats2").every(b=>!b.disabled));
  /* Rien a analyser tant qu'aucune partie n'est terminee : contrairement a
     l'ancien bouton "Activer Stockfish" (un simple telechargement, utile
     n'importe quand), "Analyser la partie" reste grise tant que la partie en
     cours n'est pas finie. */
  T("Analyser la partie grise avant toute partie", d.getElementById("btnAnalyse").disabled);
  T("bouton de partie actif", !d.getElementById("btnNew").disabled);

  console.log("\n--- Pendant une partie, seul Abandonner reste actif ---");
  d.getElementById("btnNew").click(); await wait(500);
  const ready=d.getElementById("readyBanner");
  if(!ready.classList.contains("hide")){d.getElementById("readyStart").click();await wait(300);}
  T("couleur verrouillee", seg("segColor").every(b=>b.disabled));
  T("force verrouillee", seg("segLevel").every(b=>b.disabled));
  T("cadence verrouillee", seg("tcCats2").every(b=>b.disabled));
  T("chips de cadence verrouillees", seg("tcChips2").every(b=>b.disabled));
  T("Nouvelle partie verrouillee", d.getElementById("btnNew").disabled);
  T("Analyser la partie verrouille", d.getElementById("btnAnalyse").disabled);
  T("Abandonner reste actif", !d.getElementById("btnResign").disabled);

  console.log("\n--- Apres abandon, tout redevient reglable ---");
  d.getElementById("btnResign").click(); await wait(250);
  d.getElementById("btnResign").click(); await wait(500);
  T("couleur de nouveau reglable", seg("segColor").every(b=>!b.disabled));
  T("Nouvelle partie de nouveau active", !d.getElementById("btnNew").disabled);
  T("Analyser la partie disponible, la partie est finie", !d.getElementById("btnAnalyse").disabled);

  console.log("\n--- Le libelle leve l'ambiguite sur la triche ---");
  const note=d.getElementById("sfStatus").textContent;
  T("le texte precise qu'il n'aide pas a jouer", /never helps you while you play/i.test(note), note.slice(0,80));

  console.log("\n--- En francais ---");
  [...d.getElementById("langSwitch").children].find(b=>b.dataset.lang==="fr").click();
  await wait(400);
  T("bouton traduit", /analyse/i.test(d.getElementById("btnAnalyse").textContent),
     d.getElementById("btnAnalyse").textContent);
  T("note traduite", /ne t'aide jamais pendant que tu joues/.test(d.getElementById("sfStatus").textContent),
     d.getElementById("sfStatus").textContent.slice(0,90));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
