/* Verification automatique de chang64.
   Lancement : node tests/check_navigation.js

   Mentions legales et Confidentialite vivent dans le meme panneau : sans
   ancre, les deux liens amenaient en haut, donc sur les mentions legales.
   Chaque lien vise desormais sa section, et les onglets remontent en haut
   de la nouvelle vue au lieu de conserver la position precedente. */
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(require("path").join(__dirname,"..","site","index.html"),"utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole()});
const w=dom.window,d=w.document;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
/* jsdom ne fait pas de mise en page : on trace les appels plutot que de
   mesurer une position, ce qui prouve la cible visee sans simuler l'ecran. */
let cibles=[],tops=0;
w.HTMLElement.prototype.scrollIntoView=function(){cibles.push(this.id||this.tagName);};
w.scrollTo=()=>{tops++;};
setTimeout(async()=>{
  console.log("\n--- Chaque lien du pied de page vise sa propre section ---");
  cibles=[];
  d.getElementById("footLegal").click(); await wait(300);
  T("Mentions legales vise son titre", cibles.includes("legalTitle"), cibles.join(", "));
  T("le titre prend le focus", d.activeElement && d.activeElement.id==="legalTitle",
     d.activeElement && d.activeElement.id);

  cibles=[];
  d.getElementById("footPrivacy").click(); await wait(300);
  T("Confidentialite vise son titre", cibles.includes("privacyTitle"), cibles.join(", "));
  T("et non celui des mentions legales", !cibles.includes("legalTitle"), cibles.join(", "));
  T("le titre prend le focus", d.activeElement && d.activeElement.id==="privacyTitle",
     d.activeElement && d.activeElement.id);

  cibles=[];
  d.getElementById("footAccess").click(); await wait(300);
  T("Accessibilite vise sa section", cibles.includes("accessibilite"), cibles.join(", "));

  console.log("\n--- Les onglets remontent en haut ---");
  for(const id of ["tab-play","tab-puzzles","tab-friend","tab-home"]){
    const avant=tops;
    d.getElementById(id).click(); await wait(250);
    T(id+" remonte", tops>avant, "appels : "+(tops-avant));
  }

  console.log("\n--- Les cartes de l'accueil aussi ---");
  for(const id of ["cardPuzzles","cardFriend"]){
    d.getElementById("tab-home").click(); await wait(200);
    const avant=tops;
    d.getElementById(id).click(); await wait(250);
    T(id+" remonte", tops>avant);
  }

  console.log("\n--- Les autres liens du pied de page ---");
  d.getElementById("tab-puzzles").click(); await wait(250);
  let avant=tops;
  d.getElementById("footHome").click(); await wait(250);
  T("Accueil remonte en haut", tops>avant, "appels : "+(tops-avant));
  T("et ouvre bien l'accueil", !d.getElementById("pane-home").classList.contains("hide"));

  d.getElementById("tab-puzzles").click(); await wait(250);
  avant=tops;
  d.getElementById("footPrefs").click(); await wait(250);
  T("Preferences remonte en haut", tops>avant, "appels : "+(tops-avant));
  T("et ouvre le panneau", !d.getElementById("pane-prefs").classList.contains("hide"));

  console.log("\n--- Les ancres existent et sont focalisables ---");
  for(const id of ["legalTitle","privacyTitle","accessibilite"]){
    const e=d.getElementById(id);
    T(id+" present et focalisable", !!e && e.getAttribute("tabindex")==="-1",
       e?("tabindex="+e.getAttribute("tabindex")):"absent");
  }

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
