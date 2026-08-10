/* Verification automatique de chang64.
   Lancement : node tests/<fichier>.js  (depuis la racine des sources)
   Le site doit avoir ete construit au prealable : node build_site.js */
const SITE = require("path").join(__dirname, "..", "site");
const BASE = process.env.CHANG64_BASELINE || "";   /* site deja en ligne, facultatif */
const fs=require("fs");
const S=SITE;
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};

console.log("\n--- Notation : plus rien en francais ---");
const rx=/[^A-Za-z]([CFTD])([a-h1-8]?)(x?)([a-h][1-8])(?![0-9])/g;
let bad=[];
const walk=d=>{for(const f of fs.readdirSync(d)){const p=d+"/"+f;
  if(fs.statSync(p).isDirectory())walk(p);
  else if(f.endsWith(".html")){
    const t=fs.readFileSync(p,"utf8").replace(/<script[\s\S]*?<\/script>/g,"").replace(/<svg[\s\S]*?<\/svg>/g,"");
    let m; rx.lastIndex=0;
    while((m=rx.exec(t))) bad.push(p.replace(S,"")+" : "+m[0].trim());
  }}};
walk(S+"/fr"); walk(S+"/learn"); walk(S+"/openings");
T("aucun coup en notation francaise", bad.length===0, bad.slice(0,6).join(" | "));

console.log("\n--- La lecon francaise enseigne l'international ---");
const lec=fs.readFileSync(S+"/fr/apprendre/la-notation-des-coups.html","utf8");
T("montre Nf3, Bb5, Qd2", /Nf3/.test(lec)&&/Bb5/.test(lec)&&/Qd2/.test(lec));
T("explique d'ou viennent les lettres", /knight/.test(lec)&&/bishop/.test(lec));
T("signale que les lettres francaises existent", /cavalier/.test(lec)&&/C pour cavalier/.test(lec));
T("promotion en =Q", /=Q/.test(lec));

console.log("\n--- Animation sur les pages francaises ---");
const fr=fs.readFileSync(S+"/fr/ouvertures/defense-sicilienne.html","utf8");
T("echiquier anime present", fr.includes('class="anim"'));
T("commandes en francais", fr.includes("Coup suivant")&&fr.includes("Rejouer la ligne"));
T("libelle de depart en francais", fr.includes("Position de d\u00e9part"));

console.log("\n--- Couverture de l'animation ---");
let sans=[],avec=0;
for(const dir of ["/openings","/fr/ouvertures"])
  for(const f of fs.readdirSync(S+dir).filter(x=>x.endsWith(".html")&&x!=="index.html")){
    const h=fs.readFileSync(S+dir+"/"+f,"utf8");
    h.includes('class="anim"')?avec++:sans.push(dir+"/"+f);
  }
T(avec+" pages animees", avec===282, avec);
T("aucune page sans animation (repli non declenche)", sans.length===0, sans.slice(0,4).join(", "));

console.log("\n--- Fondu au demarrage de partie ---");
const idx=fs.readFileSync(S+"/index.html","utf8");
T("keyframes dealIn presente", idx.includes("@keyframes dealIn"));
T("classe posee au demarrage", idx.includes('classList.add("dealt")'));
T("retiree apres l'animation", idx.includes('classList.remove("dealt")'));
T("respecte prefers-reduced-motion", /prefers-reduced-motion:reduce\)\{\.board\.dealt/.test(idx));

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
