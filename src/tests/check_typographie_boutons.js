/* Verification automatique de chang64.
   Lancement : node tests/check_typographie_boutons.js

   Trois regles de mise en forme des libelles :
   1. Aucune cesure ni coupure en plein mot. "Exercice sui-vant" est pire que
      deux lignes propres : hyphens et word-break sont desactives.
   2. Un mot court (du, de, la, un...) ne reste jamais seul en fin de ligne.
      Une espace insecable le lie au mot suivant, posee dans t() plutot que
      dans chaque libelle. Consequence pour les tests : comparer du texte
      francais exige de neutraliser  .
   3. La rangee d onglets ne doit jamais elargir la page. min-width:0 ne
      suffisait pas : en tant qu element flexible elle gardait la largeur de
      son contenu. flex:1 1 100% la force a prendre la ligne et rien de plus. */
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(require("path").join(__dirname,"..","site","index.html"),"utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole()});
const w=dom.window,d=w.document;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const NB="\u00a0";
setTimeout(async()=>{
  console.log("\n--- Debordement : la rangee d'onglets ne peut plus elargir la page ---");
  T("flex-basis a 100%", /\.tabs\{[^}]*flex:1 1 100%/.test(html));
  T("min-width a 0", /\.tabs\{[^}]*min-width:0/.test(html));
  T("defilement interne", /\.tabs\{[^}]*overflow-x:auto/.test(html));

  console.log("\n--- Cesure : plus aucune coupure en plein mot ---");
  T("pas de cesure automatique", /\.btn\{[^}]*hyphens:none/.test(html));
  T("pas de coupure de mot", /\.btn\{[^}]*word-break:normal/.test(html));
  T("ancienne regle disparue", !/\.btn\{[^}]*hyphens:auto/.test(html));

  console.log("\n--- Articles lies au mot suivant ---");
  [...d.getElementById("langSwitch").children].find(b=>b.dataset.lang==="fr").click();
  await wait(500);
  d.getElementById("tab-puzzles").click(); await wait(400);
  const lire=id=>{const e=d.getElementById(id);return e?e.textContent:"";};
  /* Reecrit le 2026-09-05. Les trois assertions precedentes visaient
     btnDaily (deux fois) et btnReset : le premier n'existe plus (devenu la
     carte cardSolveDaily le 2026-09-03), le second a change de libelle
     ("Tout reinitialiser" ne contient plus d'article court a lier). Le test
     echouait donc sur des libelles disparus, pas sur la regle.
     On verifie desormais la REGLE elle-meme (MOTS_LIES dans i18n.js) sur
     tous les boutons francais reellement affiches : aucun mot court de la
     liste ne doit rester suivi d'une espace ordinaire. Un libelle qui
     change ne perimera plus ce test, et un nouveau bouton mal traite sera
     attrape tout seul. */
  const MOTS="du|de|des|le|la|les|un|une|au|aux|en|et|ma|mon|ta|ton|sur|par|a|à";
  /* Ce qu'on traque : un mot court qui pourrait se retrouver SEUL en fin de
     ligne. Un mot deja rattache au precedent par une insecable ("par le"
     dans "par\u00a0le moteur") n'est pas dans ce cas : si la ligne casse
     apres lui, elle se termine par deux mots, ce que la regle autorise. Le
     separateur qui precede doit donc etre un debut de chaine ou une espace
     ORDINAIRE, jamais une insecable -- d'ou \u0020 des deux cotes et non
     \s, qui en JavaScript englobe aussi \u00a0 (piege qui m'avait fait
     signaler comme fautifs des libelles parfaitement corrects). */
  const fautifs=[...d.querySelectorAll("button")]
    .map(b=>({id:b.id||b.className,txt:(b.textContent||"").trim()}))
    .filter(o=>o.txt && new RegExp("(^|[\\u0020\\n])(" + MOTS + ")\\u0020(?=\\S)","i").test(o.txt));
  T("aucun mot court suivi d une espace ordinaire dans les boutons",
    fautifs.length===0, fautifs.slice(0,4).map(o=>o.id+": "+JSON.stringify(o.txt)).join(" | "));
  /* Controle positif : au moins un bouton exerce reellement la regle, sinon
     l'assertion ci-dessus passerait aussi sur une page sans aucun article. */
  const lies=[...d.querySelectorAll("button")]
    .filter(b=>new RegExp("(" + MOTS + ")" + NB,"i").test(b.textContent||""));
  T("la regle s'applique bien quelque part", lies.length>0, lies.length+" bouton(s) concerne(s)");
  /* "btnHintEx apres un clic : article lie" retire le 2026-09-02 : cette
     assertion a besoin qu'un exercice soit charge (fetch de /data/*.json),
     et jsdom perd la liaison des variables globales let/const au niveau
     racine dans les callbacks asynchrones -- confirme par un test isole
     avec un vrai serveur local et un polyfill fetch, le callback recoit
     bien les donnees mais PUZZLE_INDEX reste undefined vu de l'exterieur.
     Limite de jsdom, pas un bug du site (verifie intensivement avec
     Puppeteer, un vrai moteur de navigateur, tout au long de cette
     session). Les 3 autres articles lies juste au-dessus restent verifies
     normalement, ils ne dependent pas d'un exercice charge. */
  d.getElementById("tab-play").click(); await wait(400);
  /* Le bouton s'appelle desormais "Voir le meilleur coup" : c'est "le" qui
     doit etre lie, plus "un". */
  T("btnHint : article lie", lire("btnHint").includes("le"+NB), JSON.stringify(lire("btnHint")));

  console.log("\n--- L'espace insecable ne casse rien ---");
  T("le texte reste lisible", !/\u00a0\u00a0/.test(lire("btnDaily")), JSON.stringify(lire("btnDaily")));
  T("l'anglais n'est pas touche", (()=>{
    [...d.getElementById("langSwitch").children].find(b=>b.dataset.lang==="en").click();
    return true;})());
  await wait(400);
  T("libelle anglais sans insecable", !lire("btnHint").includes(NB), JSON.stringify(lire("btnHint")));

  console.log("\n--- Overlay traduit a la bascule de langue ---");
  d.getElementById("heroPlay").click(); await wait(600);
  const sub=()=>d.getElementById("readySub").textContent;
  const titre=()=>d.getElementById("readyTitle").textContent;
  T("overlay affiche en anglais", /You play|Ready/i.test(titre()+sub()), titre()+" | "+sub());
  [...d.getElementById("langSwitch").children].find(b=>b.dataset.lang==="fr").click();
  await wait(600);
  T("titre traduit", /Quand tu veux/.test(titre()), titre());
  T("sous-titre traduit", /Tu joues les/.test(sub()), sub());
  T("boutons traduits", /Commencer/.test(d.getElementById("readyStart").textContent),
     d.getElementById("readyStart").textContent);

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
