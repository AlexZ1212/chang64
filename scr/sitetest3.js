const fs=require("fs"),path=require("path");
const {Game}=require("./engine.js");
const OUT="./site";
const THEMES=JSON.parse(fs.readFileSync(require("path").join(__dirname,"themes.json"),"utf8"));
const puzzles=JSON.parse(fs.readFileSync(require("path").join(__dirname,"puzzles.json"),"utf8"));
for(const p of puzzles) if(THEMES[p.theme]) p.theme=THEMES[p.theme];
const T=(l,ok,x)=>console.log((ok?"  ok  ":" FAIL ")+l+(x?" — "+x:""));
const read=p=>fs.readFileSync(OUT+"/"+p,"utf8");
const list=d=>fs.readdirSync(OUT+"/"+d).filter(f=>f.endsWith(".html"));

const SEC=[["learn","fr/apprendre",9],["glossary","fr/lexique",21],["endgames","fr/finales",6],["traps","fr/pieges",7],["puzzles","fr/exercices",puzzles.length+1]];
for(const [en,fr,n] of SEC){
  T(`${en}: ${n} pages EN`, list(en).length===n, list(en).length);
  T(`${en}: ${n} pages FR`, list(fr).length===n, list(fr).length);
}

// metadonnees
let bad={t:0,d:0,c:0,h:0,l:0};
const titles=new Map();
for(const [en,fr] of SEC.map(s=>[s[0],s[1]]))
 for(const [dir,lang] of [[en,"en"],[fr,"fr"]])
  for(const f of list(dir)){
    const h=read(`${dir}/${f}`);
    const t=(h.match(/<title>(.*?)<\/title>/)||[])[1]||"";
    const d=(h.match(/name="description" content="(.*?)"/)||[])[1]||"";
    if(t.length<20||t.length>75)bad.t++;
    if(d.length<70||d.length>320)bad.d++;
    if(!h.includes('rel="canonical"'))bad.c++;
    if(!/hreflang="x-default"/.test(h))bad.h++;
    if(!new RegExp(`<html lang="${lang}"`).test(h))bad.l++;
    titles.set(t,(titles.get(t)||0)+1);
  }
T("titles well sized", bad.t===0, bad.t);
T("descriptions well sized", bad.d===0, bad.d);
T("canonical everywhere", bad.c===0, bad.c);
T("hreflang everywhere", bad.h===0, bad.h);
T("html lang correct", bad.l===0, bad.l);
T("no duplicate titles", [...titles.values()].every(v=>v===1), [...titles.entries()].filter(e=>e[1]>1).length+" dupes");

// reciprocite des liens de langue sur le contenu
let broken=0;
for(const [en,fr] of SEC.map(s=>[s[0],s[1]]))
 for(const f of list(en)){
   const h=read(`${en}/${f}`);
   const m=h.match(/hreflang="fr" href="https:\/\/chang64\.com\/([^"]+)"/);
   if(!m){broken++;continue;}
   const target=m[1].replace(/\/$/,"/index.html");
   if(!fs.existsSync(OUT+"/"+target)){broken++;console.log("     cible manquante:",target);continue;}
   if(!read(target).includes(`href="https://chang64.com/${en}/${f}"`)&&!read(target).includes(`href="https://chang64.com/${en}/"`))broken++;
 }
T("language links reciprocal and resolving", broken===0, broken+" broken");

// solutions d'exercices exactes
let wrongSol=0,checked=0;
for(const p of puzzles){
  const g=new Game(p.fen);
  const mv=g.moves().find(m=>g.uci(m)===p.sol[0]);
  const san=g.san(mv);
  const th=p.theme.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const f=`${p.id.replace("p","")}-${th}.html`;
  if(!fs.existsSync(`${OUT}/puzzles/${f}`)){wrongSol++;continue;}
  const h=read(`puzzles/${f}`);
  checked++;
  if(!h.includes(`>${san}<`))wrongSol++;
}
T("puzzle pages show the engine's own solution", wrongSol===0, checked+" checked");

// pieges rejoues
const traps=[["scholars-mate",true],["legals-mate",true],["blackburne-shilling-trap",true],["englund-gambit-trap",true],["fried-liver-attack",false],["damiano-defence-punished",false]];
let trapBad=0;
for(const [sl,shouldMate] of traps){
  const h=read(`traps/${sl}.html`);
  const m=h.match(/<div class="moves">([^<]+)</);
  if(!m){trapBad++;continue;}
  const san=m[1].replace(/\d+\./g," ").split(/\s+/).filter(Boolean);
  const g=new Game(); let ok=true;
  for(const x of san){const mv=g.moves().find(y=>g.san(y)===x); if(!mv){ok=false;break;} g.makeMove(mv);}
  if(!ok||g.isCheckmate()!==shouldMate){trapBad++;console.log("     piege douteux:",sl,"mat="+g.isCheckmate());}
}
T("trap lines replay legally and end as claimed", trapBad===0, trapBad);

// liens internes du lexique vers les exercices
let glossBad=0;
for(const f of list("glossary")){
  const h=read(`glossary/${f}`);
  for(const m of h.matchAll(/href="\/(puzzles\/[^"]+)"/g))
    if(!fs.existsSync(OUT+"/"+m[1]))glossBad++;
}
T("glossary links to real puzzle pages", glossBad===0, glossBad);

// index de section listant toutes ses pages
for(const [en,fr] of SEC.map(s=>[s[0],s[1]])){
  const idx=read(`${en}/index.html`);
  const missing=list(en).filter(f=>f!=="index.html"&&!idx.includes(`/${en}/${f}`)).length;
  T(`${en} index links every page`, missing===0, missing+" missing");
}

// profil
T("profile page exists", fs.existsSync(OUT+"/players/index.html"));
T("profile is noindex", read("players/index.html").includes('name="robots" content="noindex"'));
const sm=fs.readFileSync(OUT+"/sitemap.xml","utf8");
T("profile kept out of the sitemap", !sm.includes("/players/"));
T("sitemap covers the new sections", ["/learn/","/glossary/","/endgames/","/traps/","/puzzles/","/fr/apprendre/","/fr/lexique/","/fr/exercices/"].every(x=>sm.includes(x)));
/* Le nombre d'URL evolue avec le contenu : le figer condamnait ce test a
   echouer a chaque ajout. On verifie ce qui compte reellement, a savoir que
   le sitemap couvre toutes les pages publiees, hors profil volontairement
   exclu et hors 404. */
{
  const html=[];
  (function walk(p){for(const f of fs.readdirSync(p)){const q=p+"/"+f;
    const st=fs.statSync(q);
    if(st.isDirectory())walk(q); else if(f.endsWith(".html"))html.push(q.replace(OUT,""));}})(OUT);
  const publiables=html.filter(u=>!u.startsWith("/players/")&&!u.endsWith("/404.html"));
  const locs=new Set([...sm.matchAll(/<loc>https:\/\/chang64\.com([^<]*)<\/loc>/g)].map(m=>m[1]));
  const absentes=publiables.filter(u=>!locs.has(u)&&!locs.has(u.replace(/index\.html$/,"")));
  T("sitemap couvre toutes les pages publiees", absentes.length===0,
    absentes.length+" absentes : "+absentes.slice(0,3).join(", "));
  T("sitemap non vide et coherent", locs.size>=publiables.length*0.9, locs.size+" URL pour "+publiables.length+" pages");
}
