/* Verification automatique de chang64.
   Lancement : node tests/check_bascule_langue.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-09-12) : ARRIVER sur une page dans une langue
   et BASCULER vers cette meme langue doivent donner le meme ecran.

   applyI18n() ne retraduit que les noeuds de texte releves au chargement du
   HTML. Tout ce qu'un render() compose ensuite en JavaScript (les tuiles de
   "Par motif", les puces de Finales, les sous-titres du menu Resoudre...)
   lui est invisible : ces blocs ne changent de langue que si quelqu'un les
   redessine, et le seul endroit qui le fasse est refreshCurrentMode()
   (ui3.js). Chaque nouveau render() oublie la-bas est donc un bloc qui reste
   dans la langue de depart apres un clic sur EN/FR -- defaut invisible en
   navigation normale, puisque arriver directement sur l'ecran le rend dans
   la bonne langue du premier coup.

   La detection ne devine pas la langue : elle compare au dictionnaire reel
   (FR dans i18n.js). Un texte visible qui est encore une CLE anglaise apres
   bascule vers le francais n'a pas ete retraduit ; une VALEUR francaise
   encore la apres bascule vers l'anglais non plus. Les gabarits ({n}
   exercices) sont compares par motif, pour attraper aussi les decomptes. */
const PATH=require("path"),SITE=PATH.join(__dirname,"..","site");
const fs=require("fs"),jd=require("jsdom"),vm=require("vm");
const html=fs.readFileSync(SITE+"/index.html","utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

/* --- dictionnaire, lu dans la source et non dans le bundle minifie ---
   Le balayage saute les commentaires avant les chaines : i18n.js en contient
   entre les entrees, et une apostrophe francaise dedans ("l'explication")
   serait prise pour un debut de chaine par un lecteur naif, qui avalerait
   alors tout le reste du fichier. */
function dico(){
  const src=fs.readFileSync(PATH.join(__dirname,"..","i18n.js"),"utf8");
  let i=src.indexOf("{",src.indexOf("const FR=")),depth=0,end=-1,q=null,esc=false;
  for(let k=i;k<src.length;k++){const c=src[k];
    if(q){if(esc)esc=false;else if(c==="\\")esc=true;else if(c===q)q=null;continue;}
    if(c==="/"&&src[k+1]==="*"){k=src.indexOf("*/",k+2);if(k<0)break;k++;continue;}
    if(c==="/"&&src[k+1]==="/"){k=src.indexOf("\n",k);if(k<0)break;continue;}
    if(c==='"'||c==="'"||c==="`"){q=c;continue;}
    if(c==="{")depth++;else if(c==="}"){depth--;if(!depth){end=k;break;}}}
  return vm.runInNewContext("("+src.slice(i,end+1)+")");
}
const FR=dico();
/* Les cles d'un seul caractere sont ecartees : W/L/D (resultat d'une partie,
   "G"/"P"/"N" en francais) valent aussi comme initiales de jours dans
   l'en-tete du calendrier ("L" pour lundi, "D" pour dimanche). Hors contexte
   elles ne prouvent rien, et le calendrier ne passe de toute facon pas par
   t() pour ses initiales : il lit WEEKDAY_SHORT[LANG] directement. */
const PAIRES=Object.entries(FR).filter(([k,v])=>k!==v&&k.length>1&&v.length>1);
const ech=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
function motifs(cote){                    /* cote 0 = anglais, 1 = francais */
  return PAIRES.map(p=>{
    const s=p[cote];
    return s.includes("{")
      ? {re:new RegExp("^"+ech(s).replace(/\\\{[a-z]+\\\}/gi,"[^ ]{1,20}")+"$"),s:s}
      : {exact:s,s:s};
  });
}
const ANG=motifs(0),FRA=motifs(1);
const restant=(txt,liste)=>liste.some(m=>m.exact!==undefined?m.exact===txt:m.re.test(txt));

function ouvrir(lang){return new Promise(res=>{
  const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",
    virtualConsole:new jd.VirtualConsole(),
    beforeParse(w){Object.defineProperty(w.navigator,"language",{value:lang});
      w.fetch=u=>{const p=SITE+String(u).replace(/^https?:\/\/[^/]+/,"");
        return fs.existsSync(p)
          ? Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(JSON.parse(fs.readFileSync(p,"utf8")))})
          : Promise.resolve({ok:false,status:404});};}});
  setTimeout(()=>res(dom.window),3400);});}

/* Visibilite EFFECTIVE : un texte demasque dans un conteneur masque reste
   invisible, et c'est un piege deja paye plusieurs fois sur ce projet. */
function visibles(w){
  const d=w.document,out=[],walk=d.createTreeWalker(d.body,w.NodeFilter.SHOW_TEXT,null);
  let n;
  while(n=walk.nextNode()){
    const p=n.parentNode;
    if(!p||/^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.nodeName))continue;
    let cache=false;
    for(let x=n.parentElement;x&&x!==d.body;x=x.parentElement)
      if(x.classList&&x.classList.contains("hide")){cache=true;break;}
    if(cache)continue;
    const v=n.nodeValue.trim();
    if(v)out.push({txt:v,ou:n.parentElement.id?"#"+n.parentElement.id:(n.parentElement.className||n.parentElement.nodeName)});
  }
  return out;
}

const ECRANS=[
  ["menu Resoudre",      "setMode('puzzles');showSolveScreen('menu')"],
  ["grille des motifs",  "setMode('puzzles');showSolveScreen('motifs')"],
  ["motif en cours",     "setMode('puzzles');showSolveScreen('motifs');startMotif('Knight fork')"],
  ["exercices",          "setMode('puzzles');showSolveScreen('puzzles')"],
  ["exercice du jour",   "setMode('puzzles');showSolveScreen('daily')"],
  ["finales",            "setMode('puzzles');showSolveScreen('endgames')"],
  ["calendrier complet", "setMode('calendar')"],
  /* Les deux epreuves chronometrees s'atteignent depuis les cartes du menu
     Resoudre : on s'arrete a leur lanceur, sans demarrer de chronometre. */
  ["lanceur Sprint",     "trainView='sprint';setMode('train')"],
  ["lanceur Coordonnees","trainView='coord';setMode('train')"],
  ["accueil",            "setMode('home')"]
];

(async()=>{
  for(const [depart,vers,liste] of [["en-US","fr",ANG],["fr-FR","en",FRA]]){
    console.log("\n--- arrivee en "+depart+", bascule vers "+vers+" ---");
    for(const [nom,code] of ECRANS){
      const w=await ouvrir(depart);
      try{w.eval(code);}catch(e){T(nom,false,"erreur "+e.message);continue;}
      await wait(900);
      w.eval('document.querySelector(\'#langSwitch [data-lang="'+vers+'"]\').click()');
      await wait(900);
      const restes=[...new Set(visibles(w).filter(x=>restant(x.txt,liste)).map(x=>x.ou+" :: "+x.txt.slice(0,60)))];
      T(nom,restes.length===0,restes.slice(0,6).join(" | "));
    }
  }
  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
})();
