/* Verification automatique de chang64.
   Lancement : node tests/<fichier>.js  (depuis la racine des sources)
   Le site doit avoir ete construit au prealable : node build_site.js */
const SITE = require("path").join(__dirname, "..", "site");
const BASE = process.env.CHANG64_BASELINE || "";   /* site deja en ligne, facultatif */
const fs=require("fs");
const crypto=require("crypto");
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

console.log("\n--- Identifiant court de chaque exercice (#XXXXX) ---");
const { puzzleCode } = require(require("path").join(__dirname,"..","gen_puzzles.js"));
T("chaque exercice a un code", P.every(p=>p.code), P.filter(p=>!p.code).length+" sans code");
T("format attendu (5 caracteres base36 majuscules)", P.every(p=>/^[0-9A-Z]{5}$/.test(p.code||"")),
  P.filter(p=>!/^[0-9A-Z]{5}$/.test(p.code||"")).slice(0,4).map(p=>p.id).join(", "));
T("aucun code en double", new Set(P.map(p=>p.code)).size===P.length,
  (P.length-new Set(P.map(p=>p.code)).size)+" doublons");
/* Le code doit rester derive du contenu (position+solution), jamais fige a
   part : sinon un exercice modifie sans regenerer son code pointerait vers
   un identifiant qui ne correspond plus a ce qu'il affiche.
   Nuance ajoutee le 2026-09-05 : 17 exercices ont legitimement un code qui
   ne correspond PAS a la derivation directe. Ce sont les collisions de hash
   resolues lors du nettoyage de la banque : deux positions differentes
   tombaient sur le meme code a 5 caracteres, et la seconde a recu une
   variante salee (schema "fen|solution|N", N incremente jusqu'a trouver un
   code libre). Verifie ici : les 17 ecarts s'expliquent tous par ce schema,
   et les 17 codes bruts correspondants sont effectivement deja pris par un
   autre exercice. L'ancienne assertion les signalait comme desynchronises,
   c'est-a-dire qu'elle demandait de recreer les collisions qu'on venait de
   resoudre. On accepte donc un code derive soit directement, soit par
   salage, mais jamais un code arbitraire. */
const SEL_MAX=20;
function codeAdmissible(p){
  if(p.code===puzzleCode(p.fen,p.sol))return true;
  for(let n=1;n<=SEL_MAX;n++){
    const h=crypto.createHash("sha256").update(p.fen+"|"+p.sol.join(" ")+"|"+n).digest();
    if(p.code===(h.readUInt32BE(0)%Math.pow(36,5)).toString(36).toUpperCase().padStart(5,"0"))return true;
  }
  return false;
}
const codeDerive=P.filter(p=>!codeAdmissible(p));
T("le code derive du contenu (directement ou par variante anti-collision)", codeDerive.length===0,
  codeDerive.length+" hors schema : "+codeDerive.slice(0,4).map(p=>p.id).join(", "));
/* Garde-fou : le salage ne doit rester qu'une exception rare. S'il explosait,
   ce serait le signe que la derivation elle-meme a un probleme. */
const sales=P.filter(p=>p.code!==puzzleCode(p.fen,p.sol));
T("les variantes salees restent marginales (< 0,1% de la banque)",
  sales.length < P.length*0.001, sales.length+" sur "+P.length);

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
/* Echantillonnage ajoute le 2026-09-06. La verification exhaustive des 11455
   mats ne termine pas dans un temps utilisable : elle depassait les 300 s du
   lanceur, donc cette section n'etait JAMAIS executee et la limitation etait
   documentee comme permanente. Un test qui ne tourne pas ne garde rien.
   On en verifie desormais un echantillon deterministe (un sur N, pas un
   tirage au sort : deux executions doivent donner le meme resultat, sinon un
   echec devient impossible a reproduire). CHANG64_MATS=0 remet la
   verification complete, a lancer de temps en temps hors du lanceur. */
const PAS_MATS=process.env.CHANG64_MATS==="0"?1:(+process.env.CHANG64_MATS||12);
const MATS=P.filter(x=>x.type==="mate").filter((_,i)=>i%PAS_MATS===0);
console.log("  ("+MATS.length+" mats verifies sur "+P.filter(x=>x.type==="mate").length+
  (PAS_MATS>1?", un sur "+PAS_MATS+" ; CHANG64_MATS=0 pour tout verifier)":", verification complete)"));
for(const p of MATS){
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

/* Retire le 2026-09-06 : "chaque motif couvre plusieurs niveaux" lisait le
   champ level de puzzles.json, qui n'est PLUS celui qui est servi. Depuis le
   redecoupage, build_site.js recalcule les niveaux par famille d'exercices,
   et un motif vit desormais dans un seul niveau : c'est le but. L'assertion
   ne passait que parce qu'elle lisait une valeur perimee. La composition des
   niveaux est gardee par tests/check_bandes_niveaux.js, sur les fichiers
   reellement publies.
   ATTENTION : le champ level de puzzles.json n'est plus une source de
   verite. Ne rien en deduire ici. */

console.log("\n--- Les themes ont tous une traduction francaise ---");
/* Corrige le 2026-09-06 : cette assertion lisait themes.json, qui est une
   table de RENOMMAGE de themes (vide aujourd'hui), pas une table de
   traduction. Elle declarait donc les 13 themes non traduits alors qu'ils le
   sont tous. Personne ne l'avait vu parce que la section precedente, la
   verification exhaustive des 11455 mats, depassait les 300 s du lanceur :
   ce fichier n'atteignait jamais cette ligne. Un test qui ne tourne pas ne
   garde rien, et il peut mentir longtemps.
   On lit maintenant i18n.js, le vrai chemin : exTheme affiche t(puzzle.theme). */
const I18N=fs.readFileSync(require("path").join(__dirname,"..","i18n.js"),"utf8");
const sansTrad=Object.keys(byTheme).filter(th=>!new RegExp('"'+th.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+'"\\s*:\\s*"[^"]+"').test(I18N));
T("aucun theme sans traduction francaise", sansTrad.length===0, sansTrad.join(", "));

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
