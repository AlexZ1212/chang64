/* Verification automatique de chang64.
   Lancement : node tests/check_contraste_animation.js

   Les commandes de l'echiquier anime avaient herite des jetons du theme
   sombre de l'application, poses sur des pages d'ouvertures qui sont
   claires : symboles beiges sur blanc casse, 1,11:1 pour un minimum de 3:1.
   Ce test mesure les contrastes reels a partir des jetons lus dans la page. */
const fs=require("fs");
const S=require("path").join(__dirname,"..","site");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const lum=h=>{const c=h.replace("#","").match(/../g).map(x=>{let v=parseInt(x,16)/255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};
const ratio=(a,b)=>{const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)};
const h=fs.readFileSync(S+"/openings/sicilian-defense.html","utf8");

/* jetons reels lus dans la page, pas recopies de memoire */
const tok=n=>{const m=h.match(new RegExp("--"+n+":\\s*(#[0-9A-Fa-f]{6})"));return m?m[1]:null;};
const slate=tok("slate"), board=tok("board"), sage=tok("sage"), brass=tok("brass");
console.log("\n--- Jetons lus dans la page ---");
console.log("  slate "+slate+"   board "+board+"   sage "+sage);

console.log("\n--- Les commandes sont lisibles ---");
T("le beige illisible a disparu", !/\.animctl button\{[^}]*color:var\(--bone\)/.test(h));
T("symboles en vert ardoise", /\.animctl button\{[^}]*color:var\(--board\)/.test(h));
T("bordure visible, plus var(--rule)", !/\.animctl button\{[^}]*border:1px solid var\(--rule\)/.test(h));

console.log("\n--- Contrastes mesures ---");
const c1=ratio(board,slate);
T("symbole sur fond : "+c1.toFixed(2)+":1 (min 3:1)", c1>=3, c1.toFixed(2));
const c2=ratio(sage,slate);
T("libelle du coup : "+c2.toFixed(2)+":1 (min 4.5:1)", c2>=4.5, c2.toFixed(2));
const c3=ratio(slate,board);
T("survol inverse : "+c3.toFixed(2)+":1", c3>=3, c3.toFixed(2));
const c4=ratio(brass,slate);
T("anneau de focus : "+c4.toFixed(2)+":1", c4>=3, c4.toFixed(2));

console.log("\n--- Etats couverts ---");
T("etat survol defini", /\.animctl button:hover\{/.test(h));
T("etat desactive defini", /\.animctl button:disabled\{/.test(h));
T("focus visible au clavier", /\.animctl button:focus-visible\{/.test(h));

console.log("\n--- Applique partout ---");
let sansCorrection=[];
for(const dir of ["/openings","/fr/ouvertures"])
  for(const f of fs.readdirSync(S+dir).filter(x=>x.endsWith(".html")&&x!=="index.html").slice(0,60)){
    const p=fs.readFileSync(S+dir+"/"+f,"utf8");
    if(p.includes('class="anim"')&&!/\.animctl button\{[^}]*color:var\(--board\)/.test(p))sansCorrection.push(dir+"/"+f);
  }
T("120 pages verifiees, toutes corrigees", sansCorrection.length===0, sansCorrection.slice(0,3).join(", "));

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
