/* Verification automatique de chang64.
   Lancement : node tests/<fichier>.js  (depuis la racine des sources)
   Le site doit avoir ete construit au prealable : node build_site.js */
const SITE = require("path").join(__dirname, "..", "site");
const BASE = process.env.CHANG64_BASELINE || "";   /* site deja en ligne, facultatif */
const fs=require("fs");
const {Game,search}=require(require("path").join(__dirname,"..","engine.js"));
const P=JSON.parse(fs.readFileSync(require("path").join(__dirname,"..","puzzles.json"),"utf8"));
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const f=n=>{const c=n.charCodeAt(0)-97,r=8-(+n[1]);return r*16+c;};

console.log("\n--- Integrite de la banque ("+P.length+" exercices) ---");
T("aucun identifiant en double", new Set(P.map(p=>p.id)).size===P.length,
  (P.length-new Set(P.map(p=>p.id)).size)+" doublons");
T("aucune position en double", new Set(P.map(p=>p.fen.split(" ").slice(0,4).join(" "))).size===P.length,
  (P.length-new Set(P.map(p=>p.fen.split(" ").slice(0,4).join(" "))).size)+" doublons");
T("tous les champs presents", P.every(p=>p.id&&p.fen&&p.type&&p.sol&&p.sol.length&&p.theme&&p.level));
T("niveaux entre 1 et 5", P.every(p=>p.level>=1&&p.level<=5));
T("chaque niveau a des exercices", [1,2,3,4,5].every(l=>P.some(p=>p.level===l)));

console.log("\n--- Chaque FEN se charge et chaque solution est legale ---");
let badFen=[],badMove=[],inCheckGain=[];
for(const p of P){
  let g; try{g=new Game(p.fen);}catch(e){badFen.push(p.id);continue;}
  const u=p.sol[0];
  const mv=g.moves().find(m=>m.from===f(u.slice(0,2))&&m.to===f(u.slice(2,4)));
  if(!mv)badMove.push(p.id+" "+u);
}
T("toutes les positions se chargent", badFen.length===0, badFen.slice(0,4).join(", "));
T("toutes les solutions sont legales", badMove.length===0, badMove.slice(0,4).join(", "));

console.log("\n--- Les mats annonces sont bien des mats ---");
let notMate=[];
for(const p of P.filter(x=>x.type==="mate"&&x.n===1)){
  const g=new Game(p.fen);
  const u=p.sol[0];
  const mv=g.moves().find(m=>m.from===f(u.slice(0,2))&&m.to===f(u.slice(2,4)));
  if(!mv){notMate.push(p.id);continue;}
  g.makeMove(mv);
  if(!(g.moves().length===0&&g.inCheck()))notMate.push(p.id);
}
T("tous les mats en un sont des mats", notMate.length===0, notMate.length+" faux : "+notMate.slice(0,4).join(", "));

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
