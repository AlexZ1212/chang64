/* Verification automatique de chang64.
   Lancement : node tests/check_bandes_niveaux.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-09-06) : les niveaux sont decoupes par FAMILLE
   d'exercices, une famille par niveau. Ce n'est pas un detail
   d'implementation, c'est ce qui rend les noms des niveaux vrais :
   "Fourchettes" ne veut dire quelque chose que si le niveau contient des
   fourchettes.
   Avant, le decoupage se faisait sur le seul score diff du moteur, et le
   resultat mesure etait l'inverse de ce que les noms promettaient : 8% de
   mats dans "Mating attacks", 3% dans "Forcing mates", contre 26% dans
   "First steps".
   Ce test a lui-meme du etre refait : ses deux premieres assertions
   verifiaient que la mediane de diff montait a chaque niveau. C'etait
   l'ancien modele. diff n'est PAS comparable d'une famille a l'autre, un mat
   obtient un score bas parce qu'il est forcant, pas parce qu'il est facile.
   Exiger une progression de diff a travers les familles reviendrait a
   redemander le defaut qu'on vient de corriger. On verifie donc la
   progression LA ou elle a un sens : a l'interieur d'une famille coupee en
   deux paliers sur diff.

   Refait le 2026-10-18 : HUIT niveaux, plus aucune prise en un coup (voir
   BANDES dans build_site.js). Les quatre paliers de prises n'existent plus ;
   la seule famille coupee en deux sur diff est celle des mats en deux et
   plus, c'est donc la que la progression de diff est verifiee. Le nombre de
   niveaux est lu dans LEVELS (ui.js) et non plus ecrit en dur. */
const path=require("path");
const SITE = path.join(__dirname, "..", "site");
const fs=require("fs");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};

const UI=fs.readFileSync(path.join(__dirname,"..","ui.js"),"utf8");
const NIV=((UI.match(/const LEVELS=\[[\s\S]*?\n\];/)||[""])[0].match(/name:/g)||[]).length;
const TOUS=Array.from({length:NIV},(_,i)=>i+1);

/* Depuis le decoupage du 2026-09-06, level-N.json est un manifeste et les
   exercices vivent dans level-N-0.json, level-N-1.json... On recolle les
   morceaux ici : ce test parle du contenu des niveaux, pas de leur stockage.
   On en profite pour verifier que le manifeste et les morceaux s'accordent,
   un manifeste qui ment ferait charger un fichier inexistant en production. */
const N={},MANIFESTES={};
for(const l of TOUS){
  const m=JSON.parse(fs.readFileSync(SITE+"/data/level-"+l+".json","utf8"));
  MANIFESTES[l]=m;
  let tout=[];
  for(let k=0;k<m.morceaux;k++)
    tout=tout.concat(JSON.parse(fs.readFileSync(SITE+"/data/level-"+l+"-"+k+".json","utf8")));
  N[l]=tout;
}
const part=(l,ths)=>N[l].filter(p=>ths.includes(p.theme)).length/N[l].length;
const med=l=>{const v=N[l].map(p=>p.diff||0).sort((a,b)=>a-b);return v[Math.floor(v.length/2)];};

console.log("\n--- Les "+NIV+" niveaux existent et sont peuples ---");
T("huit niveaux dans LEVELS", NIV===8, String(NIV));
T("aucun fichier de niveau au-dela", !fs.existsSync(SITE+"/data/level-"+(NIV+1)+".json"));
T("aucun niveau vide", Object.values(N).every(a=>a.length>0),
  Object.entries(N).map(([l,a])=>l+":"+a.length).join(" "));
T("aucun niveau squelettique", Object.values(N).every(a=>a.length>=1500),
  Object.entries(N).map(([l,a])=>l+":"+a.length).join(" "));

console.log("\n--- Chaque niveau contient ce que son nom annonce ---");
/* Le seuil est a 95% et non a 100% : une famille peut recevoir un theme
   voisin sans que le nom devienne faux. En dessous, le nom ment. */
const ATTENDU=[
  [1,"mat en un",         ["Mate in one"]],
  [2,"mat du couloir",    ["Back-rank mate"]],
  [3,"fourchettes",       ["Knight fork","Pawn fork"]],
  [4,"clouages/enfilades",["Pin","Skewer","Deflection"]],
  [5,"attaques doubles",  ["Double attack"]],
  [6,"coup gagnant",      ["Winning move","Quiet move","Winning capture"]],
  [7,"mats en deux",      ["Mate in two","Mate in three"]],
  [8,"mats plus profonds",["Mate in two","Mate in three"]]
];
for(const [l,nom,ths] of ATTENDU)
  T("niveau "+l+" : "+nom, part(l,ths)>=0.95, Math.round(100*part(l,ths))+"%");

console.log("\n--- Plus aucune prise en un coup ---");
/* La demande d'Alexandre du 2026-10-18, a la lettre : "meme au niveau le
   plus bas". Une prise gagnante a plusieurs coups reste admise. */
const prisesUnCoup=TOUS.reduce((n,l)=>n+N[l].filter(p=>p.theme==="Winning capture"&&(p.sol||[]).length<2).length,0);
T("aucune Winning capture en un coup", prisesUnCoup===0, String(prisesUnCoup));

console.log("\n--- La progression, la ou diff a un sens ---");
/* Les deux paliers de mats sont coupes a l'interieur d'une meme famille,
   sur la longueur de la solution puis sur diff : la comparaison est
   legitime et la mediane doit monter. */
T("la difficulte monte du niveau 7 au niveau 8", med(7)<med(8), med(7)+" puis "+med(8));
T("les mats en trois sont au palier difficile",
  N[7].every(p=>p.theme!=="Mate in three"), N[7].filter(p=>p.theme==="Mate in three").length+" au niveau 7");

console.log("\n--- Le calcul arrive bien en haut de l'echelle ---");
/* Le defaut d'origine : la profondeur DIMINUAIT en montant, 18% d'exercices a
   plusieurs coups au niveau 6 contre 5% au niveau 10. */
const multi=l=>N[l].filter(p=>(p.sol||[]).length>1).length/N[l].length;
T("le dernier niveau demande un calcul a plusieurs coups", multi(NIV)>=0.5, Math.round(100*multi(NIV))+"%");
T("au moins autant que n'importe quel niveau inferieur",
  TOUS.slice(0,-1).every(l=>multi(l)<=multi(NIV)),
  TOUS.map(l=>l+":"+Math.round(100*multi(l))+"%").join(" "));

console.log("\n--- Les morceaux et leur manifeste s'accordent ---");
let ecarts=[],desordre=[];
for(const l of TOUS){
  const m=MANIFESTES[l];
  if(m.total!==N[l].length)ecarts.push("niveau "+l+" : manifeste "+m.total+", morceaux "+N[l].length);
  if(m.morceaux!==Math.ceil(m.total/m.taille))ecarts.push("niveau "+l+" : nombre de morceaux incoherent");
  /* L'ordre par difficulte est ce qui rend le decoupage utile : le premier
     morceau doit contenir les exercices les plus faciles du niveau. */
  const d=N[l].map(p=>p.diff||0);
  for(let i=1;i<d.length;i++) if(d[i]<d[i-1]){desordre.push("niveau "+l);break;}
}
T("chaque manifeste annonce le bon total", ecarts.length===0, ecarts.slice(0,3).join(" | "));
T("les morceaux sont ranges par difficulte croissante", desordre.length===0, desordre.join(", "));
T("aucun morceau ne depasse la taille annoncee",
  TOUS.every(l=>JSON.parse(fs.readFileSync(SITE+"/data/level-"+l+"-0.json","utf8")).length<=MANIFESTES[l].taille));

console.log("\n--- Rien n'a ete perdu ni oublie ---");
const total=Object.values(N).reduce((n,a)=>n+a.length,0);
/* L'index est decoupe en tranches de 10 000 identifiants depuis le
   2026-10-24 (data/ids/<k>.json) : on les reunit pour le controler. */
const idx={};
for(const f of fs.readdirSync(SITE+"/data/ids"))Object.assign(idx,JSON.parse(fs.readFileSync(SITE+"/data/ids/"+f,"utf8")));
T("l'index couvre exactement la banque", Object.keys(idx).length===total,
  Object.keys(idx).length+" dans l'index pour "+total+" exercices");
let mauvais=0;
for(const l of TOUS) for(const p of N[l]){
  const e=idx[p.id];
  if(!Array.isArray(e)||e[0]!==l)mauvais++;
}
T("l'index pointe le bon niveau pour chacun", mauvais===0, mauvais+" incoherences");
/* Un theme ajoute a la banque sans etre declare dans BANDES tomberait au
   dernier niveau et le diluerait sans que personne ne le voie. */
const themesDernier=[...new Set(N[NIV].map(p=>p.theme))];
T("aucun theme inattendu echoue au dernier niveau",
  themesDernier.every(t=>["Mate in two","Mate in three"].includes(t)), themesDernier.join(", "));

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
