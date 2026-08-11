/* Verification automatique de chang64.
   Lancement : node tests/check_marque_pages_statiques.js

   L'elephant n'apparaissait que dans l'application : les pages de contenu
   n'affichaient que le texte "chang64". Rien ne justifiait cette
   difference, l'entete est le meme reperage d'un bout a l'autre du site. */
const fs=require("fs"),path=require("path");
const S=require("path").join(__dirname,"..","site");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const lum=h=>{const c=h.replace("#","").match(/../g).map(x=>{let v=parseInt(x,16)/255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};
const ratio=(a,b)=>{const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)};

const h=fs.readFileSync(S+"/openings/sicilian-defense.html","utf8");
console.log("\n--- La marque est presente ---");
T("elephant dans l'entete", /<svg class="brandmark"/.test(h));
T("il contient des formes", (h.match(/<svg class="brandmark"[\s\S]*?<\/svg>/)||[""])[0].includes("<path"));
T("le nom reste affiche", /chang<span>64<\/span>/.test(h));
T("le tout reste un lien vers l'accueil", /<a class="brand" href="\/">/.test(h));

console.log("\n--- Accessibilite ---");
const svg=(h.match(/<svg class="brandmark"[^>]*>/)||[""])[0];
T("marque decorative, masquee aux lecteurs d'ecran", /aria-hidden="true"/.test(svg), svg.slice(0,90));
T("hors du parcours au clavier", /focusable="false"/.test(svg));

console.log("\n--- Lisibilite sur fond clair ---");
const tok=n=>{const m=h.match(new RegExp("--"+n+":\\s*(#[0-9A-Fa-f]{6})"));return m?m[1]:null;};
const c=ratio(tok("brass"), tok("ink"));
T("marque sur fond de page : "+c.toFixed(2)+":1 (min 3:1)", c>=3, c.toFixed(2));

console.log("\n--- Presente partout ---");
let sans=[],vus=0;
(function walk(p){for(const f of fs.readdirSync(p)){const q=path.join(p,f);
  if(fs.statSync(q).isDirectory())walk(q);
  else if(f.endsWith(".html")&&f!=="404.html"){
    vus++;
    const c=fs.readFileSync(q,"utf8");
    if(c.includes('class="brand"')&&!c.includes('class="brandmark"'))sans.push(q.replace(S,""));
  }}})(S+"/openings");
T(vus+" pages d'ouvertures, toutes marquees", sans.length===0, sans.slice(0,3).join(", "));

let sans2=[],vus2=0;
for(const dir of ["/learn","/endgames","/traps","/glossary","/fr/apprendre","/fr/finales"]){
  if(!fs.existsSync(S+dir))continue;
  for(const f of fs.readdirSync(S+dir).filter(x=>x.endsWith(".html"))){
    vus2++;
    const c=fs.readFileSync(S+dir+"/"+f,"utf8");
    if(c.includes('class="brand"')&&!c.includes('class="brandmark"'))sans2.push(dir+"/"+f);
  }
}
T(vus2+" autres pages de contenu, toutes marquees", sans2.length===0, sans2.slice(0,3).join(", "));

console.log("\n--- Cout maitrise ---");
const taille=(h.match(/<svg class="brandmark"[\s\S]*?<\/svg>/)||[""])[0].length;
T("moins de 1 Ko par page : "+taille+" octets", taille<1024, taille+" octets");

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
