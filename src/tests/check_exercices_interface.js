/* Verification automatique de chang64.
   Lancement : node tests/<fichier>.js  (depuis la racine des sources)
   Le site doit avoir ete construit au prealable : node build_site.js */
const SITE = require("path").join(__dirname, "..", "site");
const BASE = process.env.CHANG64_BASELINE || "";   /* site deja en ligne, facultatif */
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(""+SITE+"/index.html","utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole()});
const w=dom.window,d=w.document;
setTimeout(async()=>{
  console.log("\n--- La banque est bien chargee ---");
  const hc=d.getElementById("hCount");
  T("compteur d'exercices en page d'accueil", hc && +hc.textContent===777, hc&&hc.textContent);

  console.log("\n--- Le filtre par theme propose les nouveaux motifs ---");
  d.getElementById("tab-train").click();
  await new Promise(r=>setTimeout(r,400));
  const sel=d.getElementById("themeFilter");
  const opts=[...sel.options].map(o=>o.textContent);
  T("filtre peuple", opts.length>5, opts.length+" entrees");
  T("Clouage propose", opts.some(o=>/Pin/.test(o)), opts.filter(o=>/Pin/.test(o))[0]);
  T("Enfilade proposee", opts.some(o=>/Skewer/.test(o)), opts.filter(o=>/Skewer/.test(o))[0]);

  console.log("\n--- Un exercice se charge et se resout ---");
  const fen=d.getElementById("board");
  T("echiquier construit", fen && fen.children.length===64, fen&&fen.children.length);
  const st=d.getElementById("status");
  T("un exercice est propose", (st.textContent||"").length>0, (st.textContent||"").slice(0,50));

  console.log("\n--- Filtrer sur Clouage donne bien des exercices ---");
  const pin=[...sel.options].find(o=>/Pin/.test(o.textContent));
  sel.value=pin.value;
  sel.dispatchEvent(new w.Event("change",{bubbles:true}));
  await new Promise(r=>setTimeout(r,400));
  T("le filtre ne casse pas l'exercice", d.getElementById("board").children.length===64);
  T("statut toujours renseigne", (d.getElementById("status").textContent||"").length>0);

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
