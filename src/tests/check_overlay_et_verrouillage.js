/* Verification automatique de chang64.
   Lancement : node tests/check_overlay_et_verrouillage.js

   Quatre defauts corriges ensemble :
   1. "Changer les reglages" fermait l overlay sans annuler la partie : le
      verrouillage en cours de partie gardait donc les reglages desactives et
      le bouton menait a des reglages intouchables.
   2. L overlay couvre exactement l echiquier (inset = marge du cadre) : son
      rayon doit etre celui de l echiquier, sinon les coins laissent voir les
      cases dessous.
   3. "Changer les reglages" se coupait en plein mot sur telephone.
   4. Un bouton verrouille reagissait encore au clic et changeait de couleur,
      donc il semblait fonctionner. */
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(require("path").join(__dirname,"..","site","index.html"),"utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole()});
const w=dom.window,d=w.document;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const seg=id=>[...d.getElementById(id).children];
setTimeout(async()=>{
  console.log("\n--- Bug 1 : Changer les reglages libere bien les reglages ---");
  d.getElementById("heroPlay").click(); await wait(600);
  T("overlay affiche", !d.getElementById("readyBanner").classList.contains("hide"));
  T("reglages verrouilles pendant l'attente", seg("segLevel").every(b=>b.disabled));
  d.getElementById("readySettings").click(); await wait(400);
  T("overlay ferme", d.getElementById("readyBanner").classList.contains("hide"));
  T("couleur de nouveau reglable", seg("segColor").every(b=>!b.disabled));
  T("force de nouveau reglable", seg("segLevel").every(b=>!b.disabled));
  T("cadence de nouveau reglable", seg("tcCats2").every(b=>!b.disabled));
  T("bouton de partie actif", !d.getElementById("btnNew").disabled);
  T("statut invite a choisir", /couleur|colour|force|strength/i.test(d.getElementById("status").textContent||""),
     d.getElementById("status").textContent);

  console.log("\n--- Le reglage prend effet ---");
  seg("segLevel").find(b=>b.dataset.v==="4").click(); await wait(250);
  T("le clic change bien le niveau", seg("segLevel").find(b=>b.dataset.v==="4").getAttribute("aria-pressed")==="true");

  console.log("\n--- Bug 2 : rayon de l'overlay ---");
  T("overlay au rayon de l'echiquier", /\.result\{[^}]*border-radius:2px/.test(html),
     (html.match(/\.result\{[^}]*border-radius:(\d+)px/)||[])[1]+"px");

  console.log("\n--- Bug 3 : cesure sur telephone ---");
  T("boutons empiles sous 430 px", /max-width:430px\)\{[\s\S]{0,150}\.result-actions\{flex-direction:column/.test(html));

  console.log("\n--- Bug 4 : boutons verrouilles inertes ---");
  T("aucune interaction au clic", /\.btn:disabled[^{]*\{[^}]*pointer-events:none/.test(html));
  T("attenuation nette", /\.btn:disabled[^{]*\{[^}]*opacity:\.38/.test(html));
  T("pas de changement au survol", /\.btn:disabled:hover[^{]*\{[^}]*background-color:var\(--raise\)/.test(html));
  T("segments couverts", /\.seg button:disabled/.test(html));
  T("cadences couvertes", /\.tc-cats button:disabled/.test(html));

  console.log("\n--- Lancement depuis l'accueil : les reglages se verrouillent ---");
  /* startReadyGame n'appelait pas refreshGame : une partie lancee depuis
     l'overlay laissait couleur, force et cadence modifiables, alors qu'une
     partie relancee apres abandon les verrouillait correctement. La
     difference venait de ce que newGame, lui, passe par refreshGame. */
  d.getElementById("tab-home").click(); await wait(300);
  d.getElementById("heroPlay").click(); await wait(600);
  const rb2=d.getElementById("readyBanner");
  T("overlay affiche depuis l'accueil", !rb2.classList.contains("hide"));
  d.getElementById("readyStart").click(); await wait(500);
  T("couleur verrouillee", seg("segColor").every(b=>b.disabled));
  T("force verrouillee", seg("segLevel").every(b=>b.disabled));
  T("cadence verrouillee", seg("tcCats2").every(b=>b.disabled));
  T("Nouvelle partie verrouillee", d.getElementById("btnNew").disabled);
  T("Abandonner reste actif", !d.getElementById("btnResign").disabled);

  console.log("\n--- Le verrouillage fonctionne toujours ---");
  d.getElementById("btnNew").click(); await wait(500);
  const rb=d.getElementById("readyBanner");
  if(!rb.classList.contains("hide")){d.getElementById("readyStart").click();await wait(300);}
  T("reglages verrouilles en partie", seg("segLevel").every(b=>b.disabled));
  T("Abandonner reste actif", !d.getElementById("btnResign").disabled);

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
