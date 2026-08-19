/* Verification automatique de chang64.
   Lancement : node tests/<fichier>.js  (depuis la racine des sources)
   Le site doit avoir ete construit au prealable : node build_site.js */
const SITE = require("path").join(__dirname, "..", "site");
const BASE = process.env.CHANG64_BASELINE || "";   /* site deja en ligne, facultatif */
const fs=require("fs");
const {Game,search,allMatingMoves,pType,pColor,K}=require(require("path").join(__dirname,"..","engine.js"));
const P=JSON.parse(fs.readFileSync(require("path").join(__dirname,"..","puzzles.json"),"utf8"));
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const f=n=>{const c=n.charCodeAt(0)-97,r=8-(+n[1]);return r*16+c;};

console.log("\n--- Integrite de la banque ("+P.length+" exercices) ---");
T("aucun identifiant en double", new Set(P.map(p=>p.id)).size===P.length,
  (P.length-new Set(P.map(p=>p.id)).size)+" doublons");
T("aucune position en double", new Set(P.map(p=>p.fen.split(" ").slice(0,4).join(" "))).size===P.length,
  (P.length-new Set(P.map(p=>p.fen.split(" ").slice(0,4).join(" "))).size)+" doublons");
const NLEVELS=10;
T("tous les champs presents", P.every(p=>p.id&&p.fen&&p.type&&p.sol&&p.sol.length&&p.theme&&p.level));
T("niveaux entre 1 et "+NLEVELS, P.every(p=>p.level>=1&&p.level<=NLEVELS));
T("chaque niveau a des exercices", Array.from({length:NLEVELS},(_,i)=>i+1).every(l=>P.some(p=>p.level===l)));

console.log("\n--- Chaque FEN se charge et chaque solution est legale ---");
let badFen=[],badMove=[],illegalStart=[],badKingCount=[];
for(const p of P){
  let g; try{g=new Game(p.fen);}catch(e){badFen.push(p.id);continue;}
  /* Position illegale si l'adversaire de celui qui doit jouer est deja en
     echec : aucune partie jouee coup par coup ne peut y mener. Vu en
     situation reelle (roi noir en h8, tour blanche en h2, deja en echec au
     tour des blancs) : l'exercice etait litteralement insoluble, la case de
     depart contredisait les regles du jeu avant meme le premier coup. */
  if(g.inCheck(g.turn^1))illegalStart.push(p.id);
  let wk=0,bk=0;
  for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;}const pc=g.board[s];if(pc&&pType(pc)===K)(pColor(pc)===0?wk++:bk++);}
  if(wk!==1||bk!==1)badKingCount.push(p.id+" ("+wk+"/"+bk+")");
  const u=p.sol[0];
  const mv=g.moves().find(m=>m.from===f(u.slice(0,2))&&m.to===f(u.slice(2,4)));
  if(!mv)badMove.push(p.id+" "+u);
}
T("toutes les positions se chargent", badFen.length===0, badFen.slice(0,4).join(", "));
T("aucune position de depart illegale (adversaire deja en echec)", illegalStart.length===0,
  illegalStart.length+" : "+illegalStart.slice(0,4).join(", "));
T("un seul roi de chaque couleur", badKingCount.length===0, badKingCount.slice(0,4).join(", "));
T("toutes les solutions sont legales", badMove.length===0, badMove.slice(0,4).join(", "));

console.log("\n--- Les mats annonces sont bien des mats forces, quel que soit n ---");
/* Ne verifier que n===1 laissait passer un mat en deux ou trois annonce mais
   pas reellement force : le moteur en jeu (matingMoves/forcesMateIn dans
   engine_browser.js) recalcule la solution a chaque coup plutot que de
   suivre le champ "sol", donc un "mat en n" qui n'en est pas un rend
   l'exercice insoluble en pratique, quel que soit n. allMatingMoves fait
   exactement la meme verification exhaustive (contre toutes les defenses)
   que le code du navigateur, ici cote Node. */
let notMate=[],wrongLen=[];
for(const p of P.filter(x=>x.type==="mate")){
  const g=new Game(p.fen);
  const mm=allMatingMoves(g,p.n);
  if(!mm.length){notMate.push(p.id+" (n="+p.n+")");continue;}
  if(p.n>1){
    const g2=new Game(p.fen);
    if(allMatingMoves(g2,p.n-1).length)wrongLen.push(p.id+" (annonce n="+p.n+", en fait "+(p.n-1)+")");
  }
}
T("tous les mats annonces sont des mats forces", notMate.length===0, notMate.length+" faux : "+notMate.slice(0,4).join(", "));
T("aucun mat annonce plus long qu'il ne l'est en realite", wrongLen.length===0, wrongLen.slice(0,4).join(", "));

console.log("\n--- Les nouveaux motifs sont exploitables ---");
const byTheme={};
for(const p of P)byTheme[p.theme]=(byTheme[p.theme]||0)+1;
for(const th of ["Pin","Skewer","Double attack","Knight fork"])
  T(th+" : "+(byTheme[th]||0)+" exercices", (byTheme[th]||0)>=20, String(byTheme[th]||0));

console.log("\n--- Chaque motif couvre plusieurs niveaux ---");
for(const th of ["Pin","Skewer"]){
  const lv=new Set(P.filter(p=>p.theme===th).map(p=>p.level));
  T(th+" reparti sur "+lv.size+" niveaux", lv.size>=2, [...lv].sort().join(","));
}

console.log("\n--- Les themes ont tous une traduction ---");
const TH=JSON.parse(fs.readFileSync(require("path").join(__dirname,"..","themes.json"),"utf8"));
const trad=new Set(Object.values(TH));
const sansTrad=Object.keys(byTheme).filter(t=>!trad.has(t));
T("aucun theme sans traduction francaise", sansTrad.length===0, sansTrad.join(", "));

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
