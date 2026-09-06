/* Verification automatique de chang64.
   Lancement : node tests/check_avertissement_stockage.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (ajoute le 2026-09-06, apres un defaut trouve en
   audit) : quand localStorage est refuse (navigation privee) ou plein, la
   couche de stockage bascule en memoire pour eviter le plantage. Elle le
   faisait en silence, et le pied de page continuait d'annoncer "progression
   enregistree sur cet appareil" alors qu'elle partait a la fermeture de
   l'onglet. Sur un site sans compte, ce mecanisme EST la sauvegarde.
   On verifie que la bascule est signalee, dans les deux langues, et qu'elle
   ne se declenche pas quand tout va bien. */
const SITE = require("path").join(__dirname, "..", "site");
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(""+SITE+"/index.html","utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function ouvrir(localStorageCasse){
  const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,
    url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole(),
    beforeParse(w){
      if(!localStorageCasse)return;
      /* Refus pur et simple, comme Safari en navigation privee. */
      Object.defineProperty(w,"localStorage",{get(){throw new Error("refuse");}});
    }});
  return dom.window;
}

(async()=>{
  console.log("\n--- Stockage disponible : rien ne s'affiche ---");
  {
    const w=ouvrir(false); await wait(1200);
    const el=w.document.getElementById("storageWarn");
    T("l'element existe", !!el);
    T("il reste masque", el.classList.contains("hide"), el.className);
    T("aucun texte", !(el.textContent||"").trim(), el.textContent);
    T("aucun drapeau pose", !w.storageMemoireSeule);
  }

  console.log("\n--- Stockage refuse : l'utilisateur est prevenu ---");
  {
    const w=ouvrir(true); await wait(1200);
    const el=w.document.getElementById("storageWarn");
    T("le drapeau est pose", !!w.storageMemoireSeule);
    T("l'avertissement est visible", el&&!el.classList.contains("hide"), el&&el.className);
    T("il parle de progression perdue", /progress|progression/i.test(el.textContent||""), (el.textContent||"").slice(0,60));
    T("c'est une region de statut", el&&el.getAttribute("role")==="status", el&&el.getAttribute("role"));

    console.log("\n--- Et il suit la langue ---");
    const sw=w.document.getElementById("langSwitch");
    [...sw.children].find(b=>b.dataset.lang==="fr").click();
    await wait(500);
    T("traduit en francais", /onglet/.test(el.textContent||""), (el.textContent||"").slice(0,60));
    T("tutoiement respecte", !/vous|votre/i.test(el.textContent||""), el.textContent);
  }

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
})();
