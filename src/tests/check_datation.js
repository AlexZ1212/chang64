/* Verification automatique de chang64.
   Lancement : node tests/check_datation.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (ajoute le 2026-09-06, apres un defaut trouve en
   audit) : les pages ne portaient aucune date lisible par un humain, et leur
   dateModified valait la date de construction. Les 467 pages remontaient donc
   ensemble a chaque deploiement, y compris celles dont pas un mot n'avait
   change : un signal de fraicheur qui se declenche partout a chaque fois ne
   dit plus rien, et un visiteur n'avait aucun moyen de savoir si la page
   etait maintenue.
   Depuis, content-dates.json retient l'empreinte du contenu de chaque page
   avec ses vraies dates. Ce test verifie que le registre est complet et
   coherent avec ce qui est publie. Ne pas supprimer content-dates.json : il
   serait reconstruit avec la date du jour partout. */
const SITE = require("path").join(__dirname, "..", "site");
const fs=require("fs"),path=require("path");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};

const REG=path.join(__dirname,"..","content-dates.json");
console.log("\n--- Le registre existe et tient debout ---");
T("content-dates.json present", fs.existsSync(REG));
const D=fs.existsSync(REG)?JSON.parse(fs.readFileSync(REG,"utf8")):{};
const cles=Object.keys(D);
T("registre peuple", cles.length>0, cles.length+" pages");
const mauvais=cles.filter(k=>{const e=D[k];
  return !e.sceau||!/^\d{4}-\d{2}-\d{2}$/.test(e.publiee||"")||!/^\d{4}-\d{2}-\d{2}$/.test(e.modifiee||"");});
T("chaque entree a une empreinte et deux dates valides", mauvais.length===0, mauvais.slice(0,3).join(", "));
const inverse=cles.filter(k=>D[k].modifiee<D[k].publiee);
T("aucune modification anterieure a la publication", inverse.length===0, inverse.slice(0,3).join(", "));
T("les cles sont triees", JSON.stringify(cles)===JSON.stringify(cles.slice().sort()),
  "un ordre instable rendrait le diff illisible a chaque build");

console.log("\n--- Les pages publiees portent leurs dates ---");
const html=[];
(function walk(p){for(const f of fs.readdirSync(p)){const q=p+"/"+f;
  if(fs.statSync(q).isDirectory())walk(q); else if(f.endsWith(".html"))html.push(q);}})(SITE);
const contenu=html.filter(f=>/class="pagedate"/.test(fs.readFileSync(f,"utf8")));
T("des pages de contenu portent une date visible", contenu.length>0, contenu.length+" pages");
let sansLd=0,discordants=0;
for(const f of contenu){
  const h=fs.readFileSync(f,"utf8");
  /* Le registre est indexe sur le canonique : /openings/ et non
     /openings/index.html. Chercher le chemin de fichier tel quel donnait
     douze fausses discordances, toutes des pages d'index. */
  const brut="/"+path.relative(SITE,f).replace(/\\/g,"/");
  const url=D[brut]?brut:brut.replace(/index\.html$/,"");
  const e=D[url];
  const pub=(h.match(/"datePublished":"(\d{4}-\d{2}-\d{2})"/)||[])[1];
  const mod=(h.match(/"dateModified":"(\d{4}-\d{2}-\d{2})"/)||[])[1];
  if(!pub||!mod){sansLd++;continue;}
  if(!e||e.publiee!==pub||e.modifiee!==mod)discordants++;
}
T("chaque page datee declare ses deux dates au JSON-LD", sansLd===0, sansLd+" sans datePublished ou dateModified");
T("le JSON-LD dit la meme chose que le registre", discordants===0, discordants+" discordances");

console.log("\n--- Le signal reste utile ---");
/* Le defaut d'origine : toutes les pages modifiees le meme jour. Si cela se
   reproduit sur un site deja vieux, c'est que le registre a ete perdu. */
const dates=new Set(cles.map(k=>D[k].modifiee));
T("le registre distingue plusieurs dates, ou vient d'etre cree",
  dates.size>1||cles.every(k=>D[k].publiee===D[k].modifiee),
  dates.size+" date(s) de modification distinctes");

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
