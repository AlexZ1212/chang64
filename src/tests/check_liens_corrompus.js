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
    const oneSelected=tabs.filter(t=>t.getAttribute("aria-current")==="page").length;
    T(bad.slice(0,20)+" : echiquier intact", !!board&&board.children.length===64, board?board.children.length:"absent");
    /* Repli sur l'accueil (lien totalement illisible) : plus aucun onglet ne
       lui correspond depuis qu'Accueil a ete retire de la barre (0 est
       correct). Mais certains de ces liens degrades (ex. "#p=" vide,
       "#line=" partiellement lisible) aboutissent a un mode reel plutot
       qu'au repli -- Entre amis ou Jouer, avec alors 1 onglet actif,
       comportement inchange et legitime. Ce qui compte reellement ici :
       jamais plus d'un onglet actif a la fois (pas de double affichage). */
    T(bad.slice(0,20)+" : au plus un onglet actif", oneSelected<=1, oneSelected+" onglets actifs");
    T(bad.slice(0,20)+" : aucune erreur JS", errs.length===0, errs.slice(0,1).join(""));
  }
  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
})();
