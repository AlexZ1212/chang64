/* Verification automatique de chang64.
   Lancement : node tests/check_verrouillage_partie.js

   Pendant une partie, seul "Abandonner" reste actif. Changer de couleur
   relancait une partie et faisait disparaitre celle en cours sans prevenir.
   Et un bouton Stockfish cliquable pendant qu on joue laisse croire qu il
   sert a trouver le meilleur coup : aux echecs, le soupcon de triche suffit
   a poser probleme, meme quand la fonction ne le permet pas. */
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
  T("Stockfish disponible", !d.getElementById("btnStockfish").disabled);
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
  T("Stockfish verrouille", d.getElementById("btnStockfish").disabled);
  T("Abandonner reste actif", !d.getElementById("btnResign").disabled);

  console.log("\n--- Apres abandon, tout redevient reglable ---");
  d.getElementById("btnResign").click(); await wait(250);
  d.getElementById("btnResign").click(); await wait(500);
  T("couleur de nouveau reglable", seg("segColor").every(b=>!b.disabled));
  T("Nouvelle partie de nouveau active", !d.getElementById("btnNew").disabled);
  T("Stockfish de nouveau disponible", !d.getElementById("btnStockfish").disabled);

  console.log("\n--- Le libelle leve l'ambiguite sur la triche ---");
  const sfBtn=d.getElementById("btnStockfish").textContent.trim();
  T("le bouton dit a quoi il sert", /review|analyse/i.test(sfBtn), sfBtn);
  T("plus de simple 'Activer Stockfish'", !/^Enable Stockfish$/.test(sfBtn), sfBtn);
  const note=d.getElementById("sfStatus").textContent;
  T("le texte precise qu'il n'aide pas a jouer", /never to help you play/i.test(note), note.slice(0,80));

  console.log("\n--- En francais ---");
  [...d.getElementById("langSwitch").children].find(b=>b.dataset.lang==="fr").click();
  await wait(400);
  T("bouton traduit", /analyse/i.test(d.getElementById("btnStockfish").textContent),
     d.getElementById("btnStockfish").textContent);
  /* Espace insecable possible entre les mots courts : on l'accepte. */
  T("note traduite", /jamais[\s\u00a0]à[\s\u00a0]t'aider/.test(d.getElementById("sfStatus").textContent),
     d.getElementById("sfStatus").textContent.slice(0,70));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
