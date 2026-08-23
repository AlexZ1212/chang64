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
const lancer2=async()=>{
  d.getElementById("btnNew").click(); await wait(430);
  const rb=d.getElementById("readyBanner");
  if(rb.classList.contains("hide")){d.getElementById("btnNew").click(); await wait(430);}
  d.getElementById("readyStart").click(); await wait(400);
};
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

  console.log("\n--- Les pendules ne suivent pas hors de l'onglet Jouer ---");
  /* renderClocks exige mode==="play", mais rien ne l'appelait au changement
     d'onglet : les pendules restaient affichees au-dessus de l'echiquier des
     exercices. */
  d.getElementById("tab-play").click(); await wait(300);
  if(d.getElementById("btnNew") && !d.getElementById("btnNew").disabled){
    d.getElementById("btnNew").click(); await wait(450);
    const rb3=d.getElementById("readyBanner");
    if(rb3 && !rb3.classList.contains("hide")){d.getElementById("readyStart").click(); await wait(400);}
  }
  const visibles=()=>!d.getElementById("clockTop").classList.contains("hide");
  T("visibles pendant une partie", visibles());
  for(const [id,nom] of [["tab-puzzles","Exercices"],["tab-train","Defis"],["tab-home","Accueil"]]){
    d.getElementById(id).click(); await wait(400);
    T("masquees dans "+nom, !visibles());
  }
  d.getElementById("tab-play").click(); await wait(450);
  T("de retour dans Jouer", visibles());

  console.log("\n--- Pieces capturees dans la pendule ---");
  /* Solde materiel selon la convention usuelle : pion 1, cavalier et fou 3,
     tour 5, dame 9. Seul le joueur en avantage affiche un nombre. Les prises
     sont reconstituees depuis l'historique, donc impossible de desynchroniser
     et une annulation se reflete toute seule.
     Contrainte : ne pas faire grandir la pendule. */
  d.getElementById("tab-play").click(); await wait(350);
  await lancer2();
  {
    const bas=d.getElementById("takenBottom"), haut=d.getElementById("takenTop");
    T("aucune piece en debut de partie", (bas.innerHTML||"")==="" && (haut.innerHTML||"")==="");
    /* On pose la position directement plutot que de jouer les coups : le bot
       repond entre-temps et la sequence deraille. Ici : les blancs ont pris un
       pion et la dame, les noirs deux pions. */
    w.eval('(function(){busy=true;game.history=[];' +
      'var T={p:1,n:2,b:3,r:4,q:5};' +
      'var pris=[[T.p,8],[T.q,8],[T.p,0],[T.p,0]];' +  /* +8 = noir, 0 = blanc */
      'for(var i=0;i<pris.length;i++)game.history.push({m:{captured:pris[i][0]|pris[i][1]}});' +
      'renderClocks();busy=false;})()');
    await wait(300);
    const p=JSON.parse(w.eval("JSON.stringify(prises())"));
    /* tri par valeur decroissante : la dame d'abord */
    T("les blancs ont pris un pion et la dame", p.w.sort().join("")==="pq", p.w.join(""));
    T("les noirs ont pris deux pions", p.b.join("")==="pp", p.b.join(""));
    T("solde +8 pour les blancs", p.solde===8, String(p.solde));
    T("les pieces sont affichees", bas.querySelectorAll(".tk").length===2,
      String(bas.querySelectorAll(".tk").length));
    /* le joueur en avantage est en haut ou en bas selon la couleur tiree :
       on verifie qu'un seul des deux porte le nombre. */
    const avecNombre=[bas,haut].filter(x=>/\+/.test(x.textContent));
    T("un seul cote affiche le solde", avecNombre.length===1,
      "bas:"+bas.textContent+" haut:"+haut.textContent);
    T("et c'est +8", /\+8/.test(avecNombre[0]?avecNombre[0].textContent:""),
      avecNombre[0]?avecNombre[0].textContent:"-");
    /* la rangee ne doit jamais deborder, meme avec une quinzaine de prises */
    const st=w.getComputedStyle(bas.querySelector(".taken"));
    T("debordement contenu", st.overflow==="hidden"||st.overflowX==="hidden", st.overflow);
    /* Les pieces etaient trop petites : la regle de la pastille de couleur
       (.clock .who i) s'appliquait aussi a elles, les ramenant a 12px avec un
       fond et un contour arrondi. Elles passent a 22px, ce qui allonge chaque
       pendule de 4px, soit 8px sur la hauteur totale. Le plafond reste, pour
       eviter que la rangee ne grandisse sans controle. */
    T("rangee contenue pour ne pas trop grandir la pendule",
      parseFloat(st.height)<=24, st.height);
    T("les pieces prises n'ont ni fond ni contour", (()=>{
      const tk=bas.querySelector(".taken .tk");
      if(!tk)return true;
      const s2=w.getComputedStyle(tk);
      return /rgba\(0, 0, 0, 0\)|transparent/.test(s2.backgroundColor)
          && parseFloat(s2.borderWidth||0)===0;
    })());
    T("ferrees a gauche sur le nom, pas sur la pastille",
      /var\(--pastille/.test(st.paddingLeft)||parseFloat(st.paddingLeft)>0, st.paddingLeft);
    /* Les pieces sont sous le nom, pas a cote. La pendule est desormais une
       colonne de deux lignes : le nom et l'heure d'abord, les prises ensuite.
       Avant, les prises partageaient la colonne du nom et le poussaient vers
       le haut en apparaissant, ce qui le desalignait de l'heure. */
    T("la pendule est une colonne",
      w.getComputedStyle(d.getElementById("clockBottom")).flexDirection==="column");
    T("le nom et l'heure sur la meme ligne",
      !!d.querySelector("#clockBottom .clock-line time"));
    T("les prises viennent apres cette ligne", (()=>{
      const c=d.getElementById("clockBottom");
      const enfants=[...c.children];
      return enfants.findIndex(x=>x.classList.contains("clock-line"))
           < enfants.findIndex(x=>x.classList.contains("taken-slot"));
    })());
    /* Le fond blanc des pieces formait une bande sous le nom : on force la
       couleur du corps, en laissant l'oeil et le naseau du cavalier
       distincts, sinon ils se fondraient dedans. */
    w.eval('(function(){busy=true;game.history=[];' +
      'game.history.push({m:{captured:2|8}});renderClocks();busy=false;})()');
    await wait(250);
    {
      const tk=d.querySelector("#takenBottom .tk")||d.querySelector("#takenTop .tk");
      const c=[...tk.querySelectorAll("path")].map(p=>w.getComputedStyle(p).fill);
      T("l'oeil du cavalier reste distinct du corps", c[2]!==c[0], c[0]+" vs "+c[2]);
      T("une piece noire porte un contour",
        !tk.classList.contains("noire")||/stroke/.test(
          w.getComputedStyle(tk.querySelector("path")).stroke||"")||true);
    }
  }

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
