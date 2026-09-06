/* Verification automatique de chang64.
   Lancement : node tests/check_code_progression.js

   Ce que ce test garde (ajoute le 2026-09-06, apres un defaut trouve en
   audit) : le code CH64 est la seule facon de deplacer sa progression d'un
   appareil a l'autre, le site n'ayant pas de compte. Il doit rendre
   exactement ce qu'il a pris, sur toute l'echelle des niveaux.
   Le defaut trouve : readCode() bornait le niveau a 5 alors que LEVELS en
   compte 10. Un joueur au niveau 8 repartait au niveau 5 sans rien voir, le
   message de confirmation affichant deja le niveau ecrete. uitest5.js
   testait l'aller-retour, mais au niveau 1 : un ecretage ne se voit qu'en
   balayant l'echelle, jamais en testant un seul point.

   On evalue ici les vraies fonctions de ui.js, extraites telles quelles :
   elles ne sont pas exposees dans la version minifiee, et les recopier
   reviendrait a tester une copie plutot que le site. */
const fs=require("fs"),vm=require("vm"),path=require("path");
const SRC=path.join(__dirname,"..","ui.js");
const src=fs.readFileSync(SRC,"utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};

/* nombre de niveaux reellement definis */
const mLev=src.match(/const LEVELS=\[[\s\S]*?\n\];/);
const NIVEAUX=mLev?(mLev[0].match(/name:/g)||[]).length:0;

/* bloc b64u .. readCode, delimite par les noms de fonctions eux-memes pour
   ne pas dependre de numeros de ligne qui bougeront */
const debut=src.indexOf("function b64u(");
const fin=src.indexOf("function showCode(");
const bloc=src.slice(debut,fin);
const ctx=vm.createContext({
  btoa:x=>Buffer.from(x,"binary").toString("base64"),
  atob:x=>Buffer.from(x,"base64").toString("binary"),
  LEVELS:new Array(NIVEAUX).fill({name:"x"}),
  prog:null, console
});
vm.runInContext(bloc,ctx);

console.log("\n--- L'echelle ---");
T("LEVELS est lisible dans la source", NIVEAUX>0, String(NIVEAUX));
T("le bloc du code de reprise est extrait", /function readCode\(/.test(bloc));

console.log("\n--- Un code rend le niveau qu'il a pris, sur toute l'echelle ---");
const ecarts=[];
for(let lvl=1; lvl<=NIVEAUX; lvl++){
  ctx.prog={level:lvl,solved:120,best:14,streak:5,correctRun:2,wrongRun:0,seen:["p42","p77"]};
  const code=vm.runInContext("makeCode()",ctx);
  const relu=vm.runInContext("readCode("+JSON.stringify(code)+")",ctx);
  if(!relu){ecarts.push("niveau "+lvl+" : code refuse");continue;}
  if(relu.level!==lvl)ecarts.push("niveau "+lvl+" relu "+relu.level);
}
T("les "+NIVEAUX+" niveaux font l'aller-retour", ecarts.length===0, ecarts.join(" | "));

console.log("\n--- Le reste de la progression survit aussi ---");
ctx.prog={level:NIVEAUX,solved:120,best:14,streak:5,correctRun:2,wrongRun:0,seen:["p42","p77"]};
const r=vm.runInContext("readCode(makeCode())",ctx);
T("exercices resolus", r&&r.solved===120, r&&String(r.solved));
T("record", r&&r.best===14, r&&String(r.best));
T("serie", r&&r.streak===5, r&&String(r.streak));
T("exercices deja vus", r&&r.seen.length===2, r&&r.seen.join(","));

console.log("\n--- La borne ne doit pas etre un nombre en dur ---");
/* C'est ainsi que le defaut est apparu : une borne figee a 5, restee en place
   pendant que l'echelle passait a 10. */
const mB=src.match(/level:Math\.min\(([^,]+),Math\.max\(1,nums\[0\]\|0\)\)/);
T("la borne existe", !!mB, mB?mB[1]:"motif introuvable");
T("la borne suit LEVELS", !!mB && /LEVELS\.length/.test(mB[1]), mB?mB[1]:"");

console.log("\n--- Un code invalide reste refuse ---");
for(const mauvais of ["", "CH64", "CH64-abc-zz", "n'importe quoi", "CH64-MS4x-00"])
  T("refuse "+JSON.stringify(mauvais), vm.runInContext("readCode("+JSON.stringify(mauvais)+")",ctx)===null);

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
