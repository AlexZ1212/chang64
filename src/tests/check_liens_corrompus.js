/* Verification automatique de chang64.
   Lancement : node tests/<fichier>.js  (depuis la racine des sources)
   Le site doit avoir ete construit au prealable : node build_site.js */
const SITE = require("path").join(__dirname, "..", "site");
const BASE = process.env.CHANG64_BASELINE || "";   /* site deja en ligne, facultatif */
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(""+SITE+"/index.html","utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
function open_(url){
  const errs=[];
  const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url,virtualConsole:new jd.VirtualConsole()});
  dom.window.addEventListener("error",e=>errs.push(e.message));
  return {w:dom.window,d:dom.window.document,errs};
}
(async()=>{
  console.log("\n--- Un lien de partie corrompu ne doit pas casser le site ---");
  for(const bad of ["#p=!!!!zzz","#p=","#line=%%%","#p="+"A".repeat(5000),"#line=e4_zz9_@@"]){
    const {d,errs}=open_("https://chang64.com/"+bad);
    await new Promise(r=>setTimeout(r,700));
    const board=d.getElementById("board");
    const tabs=[...d.querySelectorAll('[role="tab"],.tabs button')];
    const oneSelected=tabs.filter(t=>t.getAttribute("aria-selected")==="true").length;
    T(bad.slice(0,20)+" : echiquier intact", !!board&&board.children.length===64, board?board.children.length:"absent");
    T(bad.slice(0,20)+" : un seul onglet actif", oneSelected===1, oneSelected+" onglets actifs");
    T(bad.slice(0,20)+" : aucune erreur JS", errs.length===0, errs.slice(0,1).join(""));
  }
  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
})();
