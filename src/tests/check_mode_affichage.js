/* Verification automatique de chang64.
   Lancement : node tests/check_mode_affichage.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Deux comportements qui dependent tous les deux du MODE D'AFFICHAGE, et
   qu'aucune autre suite ne couvre parce que jsdom n'implemente pas
   matchMedia. Ce test le fournit lui-meme, ce qui permet de simuler une
   fenetre d'application installee ou un ecran etroit.

   1. Bouton "Installer l'application" (2026-09-07, signale par Alexandre) :
      il apparaissait DANS l'application installee sur Windows, et pas dans
      le navigateur. Exactement l'inverse de ce qu'il faut. Chromium bureau
      envoie encore beforeinstallprompt dans la fenetre d'une application
      deja installee, alors qu'il ne l'envoie plus dans un navigateur ou
      l'installation est faite. Se fier a la seule presence de l'evenement
      etait donc faux : on regarde desormais le mode d'affichage.

   2. Echiquier anime de l'accueil (2026-09-07) : sous le seuil de bascule il
      est en display:none, et il ne s'agit pas seulement de ne pas l'animer
      mais de ne rien construire. Le seuil vit a DEUX endroits, la media
      query et la constante REQUETE_ACCUEIL. Les desynchroniser donnerait un
      plateau construit pour rien sur telephone, ou un trou en paysage. */
const SITE = require("path").join(__dirname, "..", "site");
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(""+SITE+"/index.html","utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

/* Fabrique une page en decidant a l'avance des reponses de matchMedia.
   reponses est une fonction requete -> booleen. */
function page(reponses){
  const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",
    virtualConsole:new jd.VirtualConsole(),
    beforeParse(w){
      w.matchMedia=q=>({media:q,matches:!!reponses(q),
        addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},onchange:null});
      w.fetch=u=>{const p=SITE+String(u).replace(/^https?:\/\/[^/]+/,"");
        return fs.existsSync(p)?Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(JSON.parse(fs.readFileSync(p,"utf8")))})
                               :Promise.resolve({ok:false,status:404});};}});
  return dom.window;
}
/* L'evenement que Chromium envoie quand une installation est possible. */
function proposeInstallation(w){
  const e=new w.Event("beforeinstallprompt");
  e.prompt=()=>Promise.resolve();
  e.userChoice=Promise.resolve({outcome:"dismissed"});
  w.dispatchEvent(e);
}

setTimeout(async()=>{
  console.log("\n--- Dans un navigateur ordinaire, sur grand ecran ---");
  const nav=page(q=>/min-width/.test(q));   /* ni standalone, ni mouvement reduit */
  await wait(1300);
  T("le bouton d'installation est cache au depart",
    nav.document.getElementById("btnInstall").classList.contains("hide"));
  proposeInstallation(nav); await wait(120);
  T("il apparait quand l'installation devient possible",
    !nav.document.getElementById("btnInstall").classList.contains("hide"));
  nav.dispatchEvent(new nav.Event("appinstalled")); await wait(120);
  T("il disparait une fois l'installation faite",
    nav.document.getElementById("btnInstall").classList.contains("hide"),
    "sinon on propose d'installer ce qui vient de l'etre");

  console.log("\n--- Dans la fenetre d'une application deja installee ---");
  for(const mode of ["standalone","window-controls-overlay"]){
    const app=page(q=>/min-width/.test(q)||q.includes(mode));
    await wait(1300);
    proposeInstallation(app); await wait(120);
    T("mode "+mode+" : le bouton reste cache malgre l'evenement",
      app.document.getElementById("btnInstall").classList.contains("hide"),
      "c'est le defaut d'origine : proposer d'installer a quelqu'un deja dans l'application");
  }

  console.log("\n--- L'echiquier d'accueil suit le meme mecanisme ---");
  const large=page(q=>/min-width/.test(q));
  await wait(1300);
  T("sur grand ecran il est construit",
    large.document.querySelectorAll("#heroBoard .sq").length===64,
    large.document.querySelectorAll("#heroBoard .sq").length+" case(s)");
  T("et il porte ses 32 pieces",
    large.document.querySelectorAll("#heroBoard .piece").length===32);

  const etroit=page(q=>false);   /* aucun media ne correspond : ecran etroit */
  await wait(1300);
  T("sur ecran etroit rien n'est construit",
    etroit.document.querySelectorAll("#heroBoard .sq").length===0,
    etroit.document.querySelectorAll("#heroBoard .sq").length+" case(s) dessinee(s) pour rien");
  T("et aucun minuteur ne tourne",
    !etroit.eval("typeof minuteurAccueil!=='undefined'&&minuteurAccueil"));

  console.log("\n--- Mouvement reduit : on montre, on n'anime pas ---");
  const calme=page(q=>/min-width/.test(q)||q.includes("prefers-reduced-motion"));
  await wait(1300);
  T("le plateau est tout de meme construit",
    calme.document.querySelectorAll("#heroBoard .sq").length===64,
    "le priver du visuel serait une perte pour rien");
  T("mais rien ne bouge",!calme.eval("typeof minuteurAccueil!=='undefined'&&minuteurAccueil"));
  T("et c'est la position finale qui est montree",
    calme.document.querySelectorAll("#heroBoard .piece").length===20,
    calme.document.querySelectorAll("#heroBoard .piece").length+" pieces, attendu 20 apres le mat");

  console.log("\n--- Le seuil ne vit pas a deux valeurs differentes ---");
  const css=(html.match(/@media\(min-width:(\d+)px\)\{[^@]*\.hero-visual\{display:block/)||[])[1];
  const js=(html.match(/REQUETE_ACCUEIL="\(min-width:(\d+)px\)"/)||[])[1];
  T("le seuil CSS est lisible",!!css,String(css));
  T("le seuil JS est lisible",!!js,String(js));
  T("les deux sont accordes",css===js,"css "+css+" / js "+js);

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},200);
setTimeout(()=>{console.log("\n=== "+ok+" OK, "+(ko+1)+" FAIL === (delai depasse)");process.exit(1);},90000);
