/* Verification automatique de chang64.
   Lancement : node tests/check_etat_selection_visible.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-09-07, signale par Alexandre) : dans les
   preferences d'accessibilite, les trois boutons "Annonces aux lecteurs
   d'ecran" semblaient morts. Ils ne l'etaient pas : le clic passait, la
   preference changeait, elle etait bien enregistree. C'est le RETOUR VISUEL
   qui manquait.

   Le 2026-09-06, #segAnnounce est passe a aria-checked seul, en retirant
   aria-pressed pour une bonne raison (aria-pressed n'est pas valide sur un
   role="radio" et faisait annoncer deux etats concurrents). Mais la feuille
   de style peignait l'etat retenu avec .seg button[aria-pressed="true"].
   Le groupe s'est donc retrouve sans aucune regle qui le selectionne.

   D'ou le point de ce test, et c'est le trou par lequel le defaut est passe :
   les suites existantes verifient les attributs ARIA d'un cote et le CSS de
   l'autre, jamais la JONCTION. On compare donc le style calcule du bouton
   retenu a celui d'un bouton non retenu du meme groupe : s'ils sont
   identiques, l'etat est invisible, quels que soient les attributs.

   Un test sur le seul aria-checked passe au vert sur le code casse. */
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

/* Les proprietes par lesquelles un etat retenu peut se distinguer. On n'en
   impose aucune en particulier : c'est au style de choisir, le test exige
   seulement qu'il en change AU MOINS une. */
const AXES=["backgroundColor","color","fontWeight","borderColor","borderTopColor","outlineColor","boxShadow"];
function ecart(a,b){
  const sa=w.getComputedStyle(a),sb=w.getComputedStyle(b);
  return AXES.filter(p=>sa[p]&&sa[p]!==sb[p]);
}
function verifieGroupe(id,attr){
  const box=$(id);
  if(!box){T("groupe "+id+" present",false);return;}
  const btns=[...box.querySelectorAll("button")];
  T("groupe "+id+" : au moins deux options",btns.length>=2,btns.length+" bouton(s)");
  const pris=btns.find(b=>b.getAttribute(attr)==="true");
  const libre=btns.find(b=>b.getAttribute(attr)!=="true");
  T("groupe "+id+" : une option et une seule est marquee "+attr,
    btns.filter(b=>b.getAttribute(attr)==="true").length===1);
  if(!pris||!libre)return;
  const diff=ecart(pris,libre);
  T("groupe "+id+" : l'option retenue se voit",diff.length>0,
    diff.length?diff.join(", "):"style calcule identique a une option non retenue");
}

setTimeout(async()=>{
  w.eval("setMode('prefs')"); await wait(300);

  console.log("\n--- L'etat retenu doit se voir, pas seulement s'annoncer ---");
  verifieGroupe("segAnnounce","aria-checked");
  verifieGroupe("segAnim","aria-checked");
  verifieGroupe("boardThemes","aria-checked");

  console.log("\n--- Coherence ARIA des groupes radio ---");
  /* Decision du 2026-09-06 : aria-pressed n'est pas valide sur role="radio".
     Les trois groupes doivent la suivre, pas seulement celui qui avait ete
     corrige a l'epoque. */
  for(const id of ["segAnnounce","segAnim","boardThemes"]){
    const btns=[...$(id).querySelectorAll("button")];
    T(id+" : boutons en role=radio",btns.length>0&&btns.every(b=>b.getAttribute("role")==="radio"));
    T(id+" : aucun aria-pressed residuel",btns.every(b=>!b.hasAttribute("aria-pressed")),
      btns.filter(b=>b.hasAttribute("aria-pressed")).length+" bouton(s) en portent encore");
    T(id+" : conteneur en role=radiogroup",$(id).getAttribute("role")==="radiogroup");
  }

  console.log("\n--- Le clic change bien l'etat, et l'etat suit ---");
  const seg=()=>[...$("segAnnounce").querySelectorAll("button")];
  const avant=w.eval("prefAnnounce");
  seg()[2].click(); await wait(120);
  T("la preference a change",w.eval("prefAnnounce")!==avant,
    avant+" -> "+w.eval("prefAnnounce"));
  const apres=seg();
  T("le marquage a suivi le clic",apres[2].getAttribute("aria-checked")==="true"
    &&apres[0].getAttribute("aria-checked")==="false");
  const diff2=ecart(apres[2],apres[0]);
  T("et la nouvelle option retenue se voit",diff2.length>0,
    diff2.length?diff2.join(", "):"style calcule identique");

  console.log("\n--- La feuille de style accepte les deux attributs ---");
  /* aria-pressed reste legitime sur les vraies bascules : le correctif
     devait ELARGIR la regle, pas deplacer le probleme sur l'autre groupe. */
  T("l'etat retenu est peint sur aria-checked",
    /\.seg button\[aria-checked="true"\]/.test(html));
  T("l'etat retenu reste peint sur aria-pressed",
    /\.seg button\[aria-pressed="true"\]/.test(html));
  T("les pastilles acceptent aussi aria-checked",
    /\.chip\[aria-checked="true"\]/.test(html));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1400);
setTimeout(()=>{console.log("\n=== "+ok+" OK, "+(ko+1)+" FAIL === (delai depasse)");process.exit(1);},60000);
