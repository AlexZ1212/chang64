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

  console.log("\n--- Le bouton d'aide a deux etats ---");
  /* Un seul bouton : "Indice" surligne la piece a jouer, puis le meme bouton
     devient "Voir la solution" et donne le coup complet. Ca libere une place
     dans une rangee chargee sur telephone et impose de tenter avec un coup de
     pouce avant d'obtenir la reponse. Les deux coutent la meme chose :
     l'exercice ne compte plus comme resolu du premier coup. */
  /* L'aide n'agit que sur l'onglet Exercices, avec un exercice charge. */
  d.getElementById("tab-puzzles").click();
  await new Promise(r=>setTimeout(r,700));
  T("un seul bouton d'aide", !d.getElementById("btnSolve"));
  const aide=d.getElementById("btnHintEx");
  T("libelle initial Indice", /Hint|Indice/i.test(aide.textContent), aide.textContent);
  aide.click(); await new Promise(r=>setTimeout(r,400));
  T("devient Voir la solution", /solution/i.test(aide.textContent), aide.textContent);
  T("la piece a jouer est surlignee", d.querySelectorAll(".sq.hint").length===1,
    String(d.querySelectorAll(".sq.hint").length));
  aide.click(); await new Promise(r=>setTimeout(r,400));
  T("le coup complet est donne", d.querySelectorAll(".sq.hint").length===2,
    String(d.querySelectorAll(".sq.hint").length));
  T("la reponse est annoncee", /answer|réponse|solution/i.test(d.getElementById("exStatus").textContent),
    d.getElementById("exStatus").textContent.slice(0,50));
  d.getElementById("btnNext").click(); await new Promise(r=>setTimeout(r,600));
  T("revient a Indice a l'exercice suivant", /Hint|Indice/i.test(aide.textContent), aide.textContent);
  T("surlignage efface", d.querySelectorAll(".sq.hint").length===0);

  console.log("\n--- Chang Sprint se joue sans quitter Defis ---");
  /* Le sprint pilote le bloc de l'exercice (chronometre, enonce, statut), qui
     vit dans l'onglet Exercices. Comme l'echiquier est partage entre les
     onglets, on deplace ce bloc dans Defis le temps du sprint plutot que de
     basculer d'onglet. Il doit imperativement revenir a sa place, sinon
     l'onglet Exercices se retrouverait vide. */
  const ou=()=>d.getElementById("pane-train").contains(d.getElementById("exPanel"))?"train"
    :(d.getElementById("pane-puzzles").contains(d.getElementById("exPanel"))?"puzzles":"perdu");
  d.getElementById("tab-train").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,500));
  /* Un overlay attend desormais le feu vert avant de lancer le sprint. */
  if(!d.getElementById("readyBanner").classList.contains("hide")){
    d.getElementById("readyStart").click();
    await new Promise(r=>setTimeout(r,500));
  }
  T("on reste dans Defis", !d.getElementById("pane-train").classList.contains("hide"));
  T("le bloc de l'exercice y est deplace", ou()==="train", ou());
  T("la barre de score est visible", !d.getElementById("rushBar").classList.contains("hide"));
  T("l'echiquier est charge", d.querySelectorAll(".sq .piece").length>1);
  d.getElementById("btnRush").click();
  await new Promise(r=>setTimeout(r,600));
  T("le bloc revient a sa place a l'arret", ou()==="puzzles", ou());
  /* second cas : on quitte Defis pendant un sprint */
  d.getElementById("tab-train").click();
  await new Promise(r=>setTimeout(r,300));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,600));
  d.getElementById("tab-puzzles").click();
  await new Promise(r=>setTimeout(r,700));
  T("le bloc revient si on quitte Defis", ou()==="puzzles", ou());
  T("l'onglet Exercices n'est jamais vide",
    d.getElementById("pane-puzzles").querySelectorAll(".panel,.repliable").length>=3,
    String(d.getElementById("pane-puzzles").querySelectorAll(".panel,.repliable").length));

  console.log("\n--- Les epreuves chronometrees attendent le feu vert ---");
  /* Meme principe que les parties : trois minutes pour le sprint, trente
     secondes pour les coordonnees, rien ne doit demarrer avant que le joueur
     soit pret. On reutilise l'overlay des parties plutot que d'inventer un
     second motif, et le sous-titre annonce la regle, qui n'etait nulle part. */
  d.getElementById("tab-train").click();
  await new Promise(r=>setTimeout(r,500));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,500));
  T("overlay avant le sprint", !d.getElementById("readyBanner").classList.contains("hide"));
  T("la regle est annoncee", /minute|erreur|wrong/i.test(d.getElementById("readySub").textContent),
    d.getElementById("readySub").textContent);
  T("'Changer les reglages' masque", d.getElementById("readySettings").classList.contains("hide"));
  T("le sprint n'a pas demarre", !w.eval("(typeof rush!=='undefined'&&rush)?true:false"));
  d.getElementById("readyStart").click();
  await new Promise(r=>setTimeout(r,500));
  T("il demarre au feu vert", !!w.eval("rush"));
  d.getElementById("btnRush").click();
  await new Promise(r=>setTimeout(r,500));

  d.getElementById("tab-train").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("btnCoord").click();
  await new Promise(r=>setTimeout(r,500));
  T("overlay avant les coordonnees", !d.getElementById("readyBanner").classList.contains("hide"));
  T("le chrono n'a pas demarre", !w.eval("typeof coord!=='undefined'&&coord"));
  d.getElementById("readyStart").click();
  await new Promise(r=>setTimeout(r,400));
  T("il demarre au feu vert", !!w.eval("coord"));

  console.log("\n--- Pendant un sprint, l'interface se reduit a l'essentiel ---");
  /* Le mode exercice normal affiche des commandes et des compteurs qui n'ont
     pas de sens dans une epreuve chronometree : "Exercice suivant" sortirait
     de la file du sprint et chargerait un exercice du mode normal, l'indice
     serait une aide, et la progression par niveau ne s'applique pas puisque
     le sprint enchaine les cinq niveaux. Il a ses propres compteurs en haut. */
  d.getElementById("tab-train").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("readyStart").click();
  await new Promise(r=>setTimeout(r,600));
  /* On remonte toute la chaine : l'element peut etre masque par un ancetre
     eloigne, pas seulement par son parent direct. */
  const cache=id=>{
    let e=d.getElementById(id);
    if(!e)return true;
    while(e&&e!==d.body){
      if(w.getComputedStyle(e).display==="none")return true;
      e=e.parentElement;
    }
    return false;
  };
  T("chronometre visible", !d.getElementById("rushBar").classList.contains("hide"));
  T("enonce visible", !cache("exQuest"));
  T("'Exercice suivant' masque", cache("btnNext"));
  T("'Indice' masque", cache("btnHintEx"));
  T("progression par niveau masquee", cache("ladder"));
  T("compteurs du mode normal masques", cache("stSolved"));
  T("le statut ne repete plus la regle",
    !/Rush|trois échecs|three misses/i.test(d.getElementById("exStatus").textContent),
    d.getElementById("exStatus").textContent.slice(0,40));
  d.getElementById("btnRush").click();
  await new Promise(r=>setTimeout(r,500));
  d.getElementById("tab-puzzles").click();
  await new Promise(r=>setTimeout(r,600));
  T("tout revient apres le sprint", !cache("btnNext") && !cache("stSolved"));

  console.log("\n--- Bandeau de fin d'epreuve ---");
  /* La fin ne vivait que dans la barre de statut, facile a manquer, et le
     bloc repartait aussitot dans l'onglet Exercices : on se retrouvait
     ailleurs sans comprendre. On reutilise le bandeau de fin de partie
     plutot que d'en creer un second. */
  d.getElementById("tab-train").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("btnGoRush").click();
  await new Promise(r=>setTimeout(r,400));
  d.getElementById("readyStart").click();
  await new Promise(r=>setTimeout(r,500));
  d.getElementById("btnRush").click();
  await new Promise(r=>setTimeout(r,600));
  const ban=d.getElementById("resultBanner");
  T("bandeau affiche a la fin du sprint", !ban.classList.contains("hide"));
  T("le score est annonce", /Score/i.test(d.getElementById("resultSub").textContent),
    d.getElementById("resultSub").textContent);
  T("'Revoir la partie' masque pour une epreuve",
    d.getElementById("resultAnalyse").classList.contains("hide"));
  d.getElementById("resultNew").click();
  await new Promise(r=>setTimeout(r,700));
  T("'Rejouer' relance le sprint", !!w.eval("rush"));
  T("et reste dans Defis", !d.getElementById("pane-train").classList.contains("hide"));
  d.getElementById("btnRush").click();
  await new Promise(r=>setTimeout(r,600));
  d.getElementById("resultClose").click();
  await new Promise(r=>setTimeout(r,300));
  T("'Fermer' ne relance rien", !w.eval("rush") && ban.classList.contains("hide"));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
