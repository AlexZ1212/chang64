/* Verification automatique de chang64.
   Lancement : node tests/<fichier>.js  (depuis la racine des sources)
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (ajoute le 2026-09-06, apres un defaut trouve en
   audit) : deux fonctions nomment les cases et elles doivent dire la meme
   chose. sqLabel() (ui.js) pose le nom accessible que le lecteur d'ecran lit
   quand le focus arrive sur une case ; announceCell() (ui3.js) ecrit dans la
   region live ce qu'il entend en naviguant aux fleches.
   Elles avaient diverge sans que rien ne le signale : SQ_NAMES calculait la
   rangee en 1+(s>>4) au lieu de 8-(s>>4), donc les 64 cases etaient annoncees
   en miroir, la tour noire en a8 devenant "a1". Et la branche piece appelait
   pColor()/pType(), inexistantes, si bien qu'aucune piece n'etait jamais
   annoncee. Les deux defauts vivaient dans un try/catch muet : seule une
   comparaison des deux sorties pouvait les faire apparaitre. */
const SITE = require("path").join(__dirname, "..", "site");
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(""+SITE+"/index.html","utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole()});
const w=dom.window,d=w.document;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const $=id=>d.getElementById(id);
const cells=()=>[...$("board").children];
const nom=i=>($("board").children[i].getAttribute("aria-label")||"").trim();

setTimeout(async()=>{

  console.log("\n--- Aucune case anonyme, meme avant le premier rendu ---");
  /* L'echiquier reste affiche quand un shard de /data/ ne repond pas : les
     cases doivent porter un nom des leur construction, pas seulement une fois
     une position posee. */
  T("64 cases", cells().length===64, String(cells().length));
  T("aucune case sans nom accessible au chargement",
    cells().every(c=>(c.getAttribute("aria-label")||"").trim().length>0),
    cells().filter(c=>!(c.getAttribute("aria-label")||"").trim()).length+" sans nom");

  console.log("\n--- Orientation du nom accessible ---");
  $("homeStartBtn").click(); await wait(400);
  $("tab-play").click(); await wait(800);
  T("case 0 = a8", /(^| )a8$/.test(nom(0)), nom(0));
  T("case 56 = a1", /(^| )a1$/.test(nom(56)), nom(56));
  T("case 63 = h1", /(^| )h1$/.test(nom(63)), nom(63));
  T("les pieces sont nommees", / on | en /.test(nom(0)) && / on | en /.test(nom(52)), nom(0)+" / "+nom(52));

  console.log("\n--- La region live ne repete pas le nom accessible ---");
  /* Le lecteur d'ecran lit deja le nom de la case au focus. Une annonce
     identique dans la region live la lui ferait entendre deux fois : c'est
     ce qui se passait avant le 2026-09-06. La region live reste reservee aux
     coups et au statut, que le focus ne dit jamais. */
  $("footPrefs").click(); await wait(300);
  const seg=$("segAnnounce");
  const bt=[...seg.children].find(x=>x.getAttribute("data-v")==="moves");
  T("reglage des annonces disponible", !!bt);
  if(bt){ bt.click(); await wait(200); }
  $("tab-play").click(); await wait(600);
  const live=$("srAnnounce");
  let bavardes=0;
  for(let i=0;i<64;i++){
    live.textContent="";
    $("board").children[i].dispatchEvent(new w.KeyboardEvent("keydown",{key:"Home",bubbles:true}));
    await wait(4);
    let cur=i-(i%8);
    for(let k=0;k<(i%8);k++){
      $("board").children[cur].dispatchEvent(new w.KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));
      cur++; await wait(2);
    }
    if((live.textContent||"").trim())bavardes++;
  }
  T("aucune des 64 cases n'ecrit dans la region live", bavardes===0, bavardes+" cases bavardes");
  T("le nom accessible porte toute l'information", / on | en /.test(nom(52)) && /^[a-h][1-8]$/.test(nom(36)),
    nom(52)+" / "+nom(36));

  console.log("\n--- En francais ---");
  [...$("langSwitch").children].find(b=>b.dataset.lang==="fr").click();
  await wait(400);
  T("le nom accessible passe au francais", / en [a-h][1-8]$/.test(nom(52)), nom(52));
  T("accord en genre conserve", !/tour blanc en|dame blanc en|tour noir en|dame noir en/.test(nom(56)+" "+nom(59)), nom(56)+" / "+nom(59));
  T("la region live reste muette en francais aussi", (() => {
    const live=$("srAnnounce"); live.textContent="";
    $("board").children[52].dispatchEvent(new w.KeyboardEvent("keydown",{key:"ArrowUp",bubbles:true}));
    return !(live.textContent||"").trim();
  })(), $("srAnnounce").textContent);

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
