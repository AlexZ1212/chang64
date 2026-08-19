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
T("le nom reste affiche", /chang<span class="sixtyfour">64<\/span>/.test(h));
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

console.log("\n--- Le logo reprend exactement celui de l'application ---");
/* Memes tailles, memes proportions, meme position relative. Seules les
   couleurs changent pour le fond clair : elephant et 64 en laiton, nom et
   baseline en gris fonce. */
{
  const jd=require("jsdom");
  const w=f=>new jd.JSDOM(fs.readFileSync(f,"utf8"),{pretendToBeVisual:true,virtualConsole:new jd.VirtualConsole()}).window;
  const app=w(S+"/index.html"), pg=w(S+"/fr/ouvertures/index.html");
  const st=(win,sel)=>{const e=win.document.querySelector(sel);return e?win.getComputedStyle(e):null;};
  for(const [nom,sa,sb,prop] of [
    ["taille du glyphe",".brand .glyph",".brandmark","width"],
    ["taille du nom",".brand h1",".brand .bname","fontSize"],
    ["graisse du nom",".brand h1",".brand .bname","fontWeight"],
    ["police du nom",".brand h1",".brand .bname","fontFamily"],
    ["taille du 64",".brand h1 .sixtyfour",".brand .sixtyfour","fontSize"],
    ["taille de la baseline",".tagline",".brand .tagline","fontSize"],
    ["ecart entre logo et nom",".brand",".brand","gap"]
  ]){
    const a=st(app,sa),b=st(pg,sb);
    T(nom+" identique", a&&b&&a[prop]===b[prop], a&&b ? a[prop]+" vs "+b[prop] : "selecteur introuvable");
  }
  T("baseline presente sur les pages claires", !!pg.document.querySelector(".brand .tagline"));
  T("nom en gris fonce", (st(pg,".brand .bname")||{}).color==="var(--chalk)");
  T("64 en laiton", (st(pg,".brand .sixtyfour")||{}).color==="var(--brass)");
  T("elephant en laiton", (st(pg,".brandmark")||{}).color==="var(--brass)");
}

console.log("\n--- L'application affiche aussi la marque sans JavaScript ---");
/* L'application la posait par script au demarrage ($("brandmark").innerHTML=
   markSVG(...) dans ui.js) : un moteur d'indexation, une extension qui
   bloque le JavaScript, ou une previsualisation qui ne l'execute pas
   voyaient un entete sans logo. Elle est desormais dans le HTML genere,
   comme sur les pages claires, aux deux emplacements ou elle apparait. */
{
  const app=fs.readFileSync(S+"/index.html","utf8");
  const glyph=(app.match(/<span class="glyph" id="brandmark">([\s\S]*?)<\/span>/)||[])[1]||"";
  T("marque presente dans l'entete sans script", /<svg class="brandmark"/.test(glyph), glyph.slice(0,60));
  const origin=(app.match(/<span class="origin-mark" id="originMark"[^>]*>([\s\S]*?)<\/span>/)||[])[1]||"";
  T("marque presente dans le filigrane sans script", /<svg class="brandmark"/.test(origin), origin.slice(0,60));
  T("plus aucun jeton de substitution oublie", !app.includes("__BRANDMARK__"));
}

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
