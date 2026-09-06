/* Verification automatique de chang64.
   Lancement : node tests/check_bouton_suivant.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-09-06, demande d'Alexandre) : "Exercice suivant"
   ne doit pas permettre d'enchainer les exercices sans en regarder un seul.
   Le piege, trouve en verifiant : le critere naturel, puzzleDone, est FAUX
   ici. Un mauvais coup n'est pas terminal, il rend la main pour un nouvel
   essai, et RIEN ne clot un exercice en echec -- meme la solution affichee
   demande de jouer le coup. Bloquer sur puzzleDone enfermait donc pour de
   bon quelqu'un qui refuse de jouer la reponse : recharger la page etait la
   seule sortie.
   Le critere est donc "rien n'a ete tente" : puzzleTries a zero. Le premier
   essai libere, l'indice et la solution aussi puisqu'ils posent puzzleTries
   a 1. Ne repasse pas sur puzzleDone sans relire ce paragraphe.
   Une ligne sous l'echiquier explique le blocage et nomme la sortie :
   un bouton grise sans explication laisse la personne devant un mur, et
   l'infobulle n'existe pas au doigt. */
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

setTimeout(async()=>{
  $("homeStartBtn").click(); await wait(400);
  $("tab-puzzles").click(); await wait(400);
  $("cardSolvePuzzles").click(); await wait(1500);

  console.log("\n--- Exercice charge, rien de tente ---");
  T("un exercice est bien charge", ($("exQuest").textContent||"").trim().length>0, $("exQuest").textContent);
  T("le bouton suivant est desactive", $("btnNext").disabled);
  T("une explication est visible", !$("nextLock").classList.contains("hide"));
  T("elle nomme la sortie", /Hint|indice/i.test($("nextLock").textContent||""), $("nextLock").textContent);
  T("elle est sous le statut de l'exercice",
    $("exStatus").compareDocumentPosition($("nextLock"))&w.Node.DOCUMENT_POSITION_FOLLOWING);

  console.log("\n--- L'indice libere, il ne faut pas rester coince ---");
  $("btnHintEx").click(); await wait(500);
  T("le bouton suivant est libere", !$("btnNext").disabled);
  T("l'explication disparait", $("nextLock").classList.contains("hide"));

  console.log("\n--- Un nouvel exercice rebloque ---");
  $("btnNext").click(); await wait(1500);
  T("le bouton se rebloque sur l'exercice suivant", $("btnNext").disabled);
  T("l'explication revient", !$("nextLock").classList.contains("hide"));

  console.log("\n--- En francais ---");
  [...$("langSwitch").children].find(b=>b.dataset.lang==="fr").click();
  await wait(500);
  T("l'explication est traduite", /indice/.test($("nextLock").textContent||""), $("nextLock").textContent);
  T("tutoiement respecte", !/vous|votre/i.test($("nextLock").textContent||""), $("nextLock").textContent);

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
