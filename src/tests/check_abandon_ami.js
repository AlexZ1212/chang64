/* Verification automatique de chang64.
   Lancement : node tests/check_abandon_ami.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-09-06, signale par Alexandre) : une partie
   "Inviter" une fois lancee ne pouvait plus etre abandonnee.

   Le defaut n'etait pas dans le bouton : showAmi() (ui.js) le demasquait
   correctement. Il etait dans son CONTENEUR. "Abandonner" et "Annuler mon
   coup" vivaient dans #amiNewGamePanel, et ce panneau se masque entierement
   des qu'une partie est activement en cours -- decision prise le 2026-09-04
   pour eviter d'ecraser une partie en cours avec une nouvelle. Les deux
   boutons disparaissaient donc precisement quand ils servent. Ils vivent
   desormais dans le bloc de statut, comme "Abandonner" cote Jouer.

   D'ou le point de ce test : verifier la visibilite EFFECTIVE, en remontant
   toute la chaine des ancetres. Un test sur la seule classe du bouton passe
   au vert sur le code casse. */
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
/* Visibilite reelle : le bouton peut etre demasque a l'interieur d'un
   conteneur cache, c'est exactement le defaut corrige ici. */
const cacheur=el=>{for(let n=el;n&&n!==d.body;n=n.parentElement)
  if(n.classList&&n.classList.contains("hide"))return n.id||n.className;
  return null;};

setTimeout(async()=>{
  $("tab-friend").click(); await wait(500);

  console.log("\n--- Avant creation : rien a abandonner ---");
  T("le bouton d'abandon existe", !!$("btnAmiResign"));
  T("il est masque tant qu'aucune partie n'existe", !!cacheur($("btnAmiResign")));

  console.log("\n--- Partie creee et en cours ---");
  $("btnAmiNew").click(); await wait(200);
  T("le choix de couleur s'ouvre", $("amiColorModal").classList.contains("on"));
  $("amiColorBtns").children[0].click(); await wait(600);
  T("une partie est en cours", !$("appLayout").classList.contains("hide"));
  T("le panneau de nouvelle partie se retire bien", $("amiNewGamePanel").classList.contains("hide"));
  T("l'abandon reste ATTEIGNABLE", cacheur($("btnAmiResign"))===null,
    "cache par "+cacheur($("btnAmiResign")));
  T("annuler son coup aussi", cacheur($("btnAmiUndo"))===null,
    "cache par "+cacheur($("btnAmiUndo")));
  T("l'abandon n'est pas grise", !$("btnAmiResign").disabled);
  T("il est dans le bloc de statut, comme cote Jouer",
    $("amiStatusPanel").contains($("btnAmiResign")));

  console.log("\n--- Et il fonctionne : deux clics, confirmation comprise ---");
  $("btnAmiResign").click(); await wait(150);
  T("premier clic : demande de confirmation", $("btnAmiResign").classList.contains("armed"),
    $("btnAmiResign").textContent);
  $("btnAmiResign").click(); await wait(500);
  T("la partie est abandonnee", /resign/i.test($("amiStatus").textContent||""),
    $("amiStatus").textContent);
  T("le lien porte l'abandon", /&r=/.test($("amiLink").value||""), $("amiLink").value);
  T("une nouvelle partie redevient possible", !$("amiNewGamePanel").classList.contains("hide"));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
