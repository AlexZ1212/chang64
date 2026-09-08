/* Verification automatique de chang64.
   Lancement : node tests/check_modale_couleur.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-09-07, signale par Alexandre) : lancer une
   partie dans "Inviter" ouvrait un voile sur tout le navigateur au lieu de
   se poser sur l'echiquier, alors que #promoModal, l'autre modale du site,
   avait deja demenage dans .board-frame en session 6.

   Le piege, et c'est lui que ce test surveille : .board-wrap est en
   display:none tant qu'aucune partie ami n'existe (updateAmiBoardVisibility,
   ui.js). Deplacer la modale dans .board-frame sans devoiler le plateau la
   rend simplement invisible -- le piege 12 du handoff 6, un element demasque
   a l'interieur d'un conteneur masque. On verifie donc la visibilite
   EFFECTIVE en remontant les ancetres jusqu'a body, pas la seule classe de
   la modale.

   Second effet a surveiller : tant que le voile couvrait tout l'ecran, la
   barre d'onglets etait hors d'atteinte. Posee sur le plateau, elle laisse
   les onglets cliquables, donc changer de section doit la refermer, sinon
   elle reste affichee par-dessus l'echiquier de la section suivante. */
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

/* Remonte toute la chaine et renvoie le premier ancetre qui masque, ou null.
   On ne se contente pas de la classe "hide" : un display:none pose par une
   regle de style compte tout autant, c'est le fond du piege. */
const cacheur=el=>{
  for(let n=el;n&&n!==d.body;n=n.parentElement){
    if(n.classList&&n.classList.contains("hide"))return (n.id||n.className)+" (classe hide)";
    const st=w.getComputedStyle(n);
    if(st.display==="none")return (n.id||n.className)+" (display:none)";
  }
  return null;
};

setTimeout(async()=>{
  console.log("\n--- Place de la modale dans le document ---");
  const mod=$("amiColorModal");
  T("la modale de couleur existe",!!mod);
  T("elle vit dans .board-frame, comme celle de promotion",
    !!mod.closest(".board-frame"),mod.parentElement&&mod.parentElement.className);
  T("elle partage la geometrie de la modale de promotion",
    /#promoModal,#amiColorModal\{position:absolute/.test(html));
  T("elle n'est plus en position:fixed sur tout l'ecran",
    w.getComputedStyle(mod).position!=="fixed",w.getComputedStyle(mod).position);

  $("tab-friend").click(); await wait(400);

  console.log("\n--- Avant ouverture : le plateau est bien masque ---");
  T("le plateau ami est masque tant qu'aucune partie n'existe",
    !!cacheur(d.querySelector(".board-wrap")));
  T("la modale est fermee",!mod.classList.contains("on"));

  console.log("\n--- Ouverture : la modale doit etre REELLEMENT visible ---");
  $("btnAmiNew").click(); await wait(200);
  T("la modale est marquee ouverte",mod.classList.contains("on"));
  T("aucun ancetre ne la masque",!cacheur(mod),cacheur(mod));
  T("le plateau est devoile derriere elle",!cacheur(d.querySelector(".board-wrap")));
  T("les deux couleurs sont proposees",
    $("amiColorBtns").querySelectorAll("button[data-v]").length===2);

  console.log("\n--- Fermeture sans choisir : on remet tout comme avant ---");
  mod.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
  await wait(200);
  T("la modale est refermee",!mod.classList.contains("on"));
  T("le plateau est remasque, aucune partie n'ayant ete creee",
    !!cacheur(d.querySelector(".board-wrap")));
  T("aucune partie n'a ete creee",w.eval("amiStarted")===false);

  console.log("\n--- Changer de section referme la modale ---");
  $("btnAmiNew").click(); await wait(150);
  T("modale rouverte",mod.classList.contains("on"));
  $("tab-puzzles").click(); await wait(400);
  T("elle ne survit pas au changement de section",!mod.classList.contains("on"));

  console.log("\n--- Choisir une couleur cree bien la partie ---");
  $("tab-friend").click(); await wait(400);
  $("btnAmiNew").click(); await wait(150);
  $("amiColorBtns").querySelector('button[data-v="b"]').click(); await wait(300);
  T("la modale se referme",!mod.classList.contains("on"));
  T("la partie est lancee",w.eval("amiStarted")===true);
  T("la couleur choisie est prise en compte",w.eval("amiColor")===w.eval("B"));
  T("le plateau reste visible",!cacheur(d.querySelector(".board-wrap")));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1400);
setTimeout(()=>{console.log("\n=== "+ok+" OK, "+(ko+1)+" FAIL === (delai depasse)");process.exit(1);},60000);
