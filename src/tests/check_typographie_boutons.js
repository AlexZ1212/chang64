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
  for(const [id,att] of [["btnDaily","du"],["btnSolve","la"],["btnReset","ma"]]){
    const t=lire(id);
    T(id+" : article lie", t.includes(att+NB), JSON.stringify(t));
  }
  d.getElementById("tab-play").click(); await wait(400);
  T("btnHint : article lie", lire("btnHint").includes("un"+NB), JSON.stringify(lire("btnHint")));

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
