const fs=require("fs");
const {JSDOM}=require("jsdom");
const {Game}=require("./engine.js");
const OUT="./site";
const T=(l,ok,x)=>console.log((ok?"  ok  ":" FAIL ")+l+(x?" — "+x:""));

const en=fs.readdirSync(OUT+"/openings").filter(f=>f.endsWith(".html"));
const fr=fs.readdirSync(OUT+"/fr/ouvertures").filter(f=>f.endsWith(".html"));
T("english pages", en.length===142, en.length);
T("french pages", fr.length===142, fr.length);

let issues={title:0,desc:0,canon:0,alt:0,lang:0,svg:0};
const titles=new Set();
for(const [dir,lang,list] of [["openings","en",en],["fr/ouvertures","fr",fr]]){
  for(const f of list){
    const h=fs.readFileSync(`${OUT}/${dir}/${f}`,"utf8");
    const t=(h.match(/<title>(.*?)<\/title>/)||[])[1]||"";
    const d=(h.match(/name="description" content="(.*?)"/)||[])[1]||"";
    if(t.length<20||t.length>75)issues.title++;
    if(d.length<70||d.length>320)issues.desc++;
    if(!h.includes('<link rel="canonical"'))issues.canon++;
    if(!/hreflang="en"/.test(h)||!/hreflang="fr"/.test(h)||!/hreflang="x-default"/.test(h))issues.alt++;
    if(!new RegExp(`<html lang="${lang}"`).test(h))issues.lang++;
    if(!h.includes("<svg")&&f!=="index.html")issues.svg++;
    if(titles.has(t))issues.dup=(issues.dup||0)+1; titles.add(t);
  }
}
T("titles well sized", issues.title===0, issues.title);
T("titles unique across languages", !issues.dup, (issues.dup||0)+" duplicates");
T("descriptions well sized", issues.desc===0, issues.desc);
T("canonical everywhere", issues.canon===0);
T("hreflang trio everywhere", issues.alt===0, issues.alt);
T("html lang correct", issues.lang===0, issues.lang);
T("diagrams everywhere", issues.svg===0);

// reciprocite des hreflang
let bad=0;
for(const f of en.filter(f=>f!=="index.html")){
  const h=fs.readFileSync(`${OUT}/openings/${f}`,"utf8");
  const m=h.match(/hreflang="fr" href="https:\/\/chang64\.com\/fr\/ouvertures\/(.*?)"/);
  if(!m){bad++;continue;}
  const target=`${OUT}/fr/ouvertures/${m[1]}`;
  if(!fs.existsSync(target)){bad++;continue;}
  const back=fs.readFileSync(target,"utf8");
  if(!back.includes(`hreflang="en" href="https://chang64.com/openings/${f}"`))bad++;
}
T("hreflang links are reciprocal and resolve", bad===0, bad+" broken");

const sm=fs.readFileSync(OUT+"/sitemap.xml","utf8");
T("sitemap has both languages", sm.includes("/fr/ouvertures/")&&sm.includes("/openings/"));
T("sitemap declares alternates", sm.includes('xmlns:xhtml')&&sm.includes('rel="alternate"'));

// contenu francais reel
const sic=fs.readFileSync(OUT+"/fr/ouvertures/defense-sicilienne.html","utf8");
const dom=new JSDOM(sic); const doc=dom.window.document;
T("french page title translated", doc.querySelector("h1").textContent==="Défense sicilienne", doc.querySelector("h1").textContent);
T("french prose present", /Les Noirs répondent/.test(doc.body.textContent));
T("english name given for reference", /Sicilian Defense/.test(doc.body.textContent));
T("variations table filled", doc.querySelectorAll("tbody tr").length>5, doc.querySelectorAll("tbody tr").length);
T("language switch link present", !!doc.querySelector('a[hreflang="en"]'), doc.querySelector('a[hreflang="en"]')?doc.querySelector('a[hreflang="en"]').getAttribute("href"):"");

// diagrammes toujours justes cote francais
let wrong=0,checked=0;
for(const f of fr.filter(f=>f!=="index.html").slice(0,60)){
  const h=fs.readFileSync(`${OUT}/fr/ouvertures/${f}`,"utf8");
  const m=h.match(/Position après ([^<]+)</); if(!m)continue;
  const san=m[1].replace(/\d+\./g," ").split(/\s+/).filter(Boolean);
  const g=new Game(); let ok=true;
  for(const x of san){const mv=g.moves().find(y=>g.san(y).replace(/[+#]/g,"")===x); if(!mv){ok=false;break;} g.makeMove(mv);}
  let real=0; for(let sq=0;sq<128;sq++){if(sq&0x88){sq+=7;continue;}if(g.board[sq])real++;}
  /* L'echiquier des pages d'ouverture est desormais anime : les pieces sont
     posees par <use> et il y a une position par demi-coup. On compte donc
     celles du dernier groupe, qui est la position finale affichee. */
  const groups=h.match(/<g data-ply="\d+"(?: hidden)?>[\s\S]*?<\/g>/g);
  const svgPieces=groups
    ? (groups[groups.length-1].match(/<use href="#/g)||[]).length
    : (h.match(/<g transform="translate/g)||[]).length;
  checked++; if(!ok||svgPieces!==real)wrong++;
}
T("french diagrams match their moves", wrong===0, checked+" checked");
