/* Verification automatique de chang64.
   Lancement : node tests/check_texte_alternatif.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-10-18) : aucune image sans texte alternatif,
   l'erreur "Missing alternative text" que WAVE (webaim.org) relevait sur
   l'accueil. La coupable etait l'icone du bouton qui retourne l'echiquier :
   un <svg> sans nom ni aria-hidden, alors que le bouton porte deja son
   aria-label. Une icone dans un bouton nomme est decorative : aria-hidden.
   On regarde la page APRES execution des scripts, comme WAVE : la plupart
   des icones et les graphiques sont poses par le JavaScript. */
const path=require("path");
const SITE=path.join(__dirname,"..","site");
const fs=require("fs"),jd=require("jsdom");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};

const dom=new jd.JSDOM(fs.readFileSync(SITE+"/index.html","utf8"),{runScripts:"dangerously",pretendToBeVisual:true,
  url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole(),
  beforeParse(w){w.fetch=u=>{const p=SITE+String(u).replace(/^https?:\/\/[^/]+/,"");
    return fs.existsSync(p)?Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(JSON.parse(fs.readFileSync(p,"utf8")))})
                           :Promise.resolve({ok:false,status:404});};}});
setTimeout(()=>{
  const d=dom.window.document;
  const decrit=e=>(e.getAttribute("aria-label")||"").trim()||e.getAttribute("aria-labelledby")||e.querySelector(":scope>title");
  const cache=e=>!!e.closest("[aria-hidden=true]");

  console.log("\n--- Accueil, apres execution des scripts ---");
  const imgs=[...d.querySelectorAll("img,input[type=image],area")].filter(e=>!e.hasAttribute("alt"));
  T("toute image a un attribut alt",imgs.length===0,imgs.map(e=>e.outerHTML.slice(0,80)).join(" | "));
  const svgs=[...d.querySelectorAll("svg")];
  const muets=svgs.filter(s=>!cache(s)&&!decrit(s));
  T("tout svg est nomme ou masque ("+svgs.length+" svg)",muets.length===0,
    muets.map(s=>"#"+(s.parentElement.id||s.parentElement.className)).join(", "));
  const roles=[...d.querySelectorAll("[role=img]")].filter(e=>!cache(e)&&!decrit(e));
  T("tout element role=img est nomme",roles.length===0,roles.map(e=>e.tagName).join(", "));
  const flip=d.querySelector("#btnFlip svg");
  T("l'icone du bouton de retournement est decorative",!!flip&&flip.getAttribute("aria-hidden")==="true");

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},4000);
