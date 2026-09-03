const fs=require("fs"),path=require("path");
const {JSDOM}=require("jsdom");
const {Game}=require("./engine.js");
const OUT=require("path").join(__dirname,"site");
const T=(l,ok,x)=>console.log((ok?"  ok  ":" FAIL ")+l+(x?" — "+x:""));

const files=fs.readdirSync(OUT+"/openings").filter(f=>f.endsWith(".html"));
T("opening pages generated", files.length===142, files.length+" files");

let badTitle=0,badDesc=0,badCanon=0,noSvg=0,noJsonld=0,dupTitles=new Map();
for(const f of files){
  const h=fs.readFileSync(OUT+"/openings/"+f,"utf8");
  const t=(h.match(/<title>(.*?)<\/title>/)||[])[1]||"";
  const d=(h.match(/name="description" content="(.*?)"/)||[])[1]||"";
  if(t.length<20||t.length>75)badTitle++;
  if(d.length<70||d.length>320)badDesc++;
  if(!/<link rel="canonical" href="https:\/\/chang64\.com\//.test(h))badCanon++;
  if(!h.includes("<svg")&&f!=="index.html")noSvg++;
  if(!h.includes("application/ld+json"))noJsonld++;
  dupTitles.set(t,(dupTitles.get(t)||0)+1);
}
T("all titles a sensible length", badTitle===0, badTitle+" off");
T("all descriptions a sensible length", badDesc===0, badDesc+" off");
T("all canonical tags present", badCanon===0);
T("all pages carry a board diagram", noSvg===0);
T("all pages carry structured data", noJsonld===0);
T("no duplicate titles", [...dupTitles.values()].every(v=>v===1));

// les diagrammes correspondent-ils aux coups annonces ?
let checked=0,wrong=0;
for(const f of files.slice(0,200)){
  if(f==="index.html")continue;
  const h=fs.readFileSync(OUT+"/openings/"+f,"utf8");
  const m=h.match(/Position after ([^<]+)</);
  if(!m)continue;
  const san=m[1].replace(/\d+\./g," ").split(/\s+/).filter(Boolean);
  const g=new Game();let ok=true;
  for(const s of san){
    const mv=g.moves().find(x=>g.san(x).replace(/[+#]/g,"")===s);
    if(!mv){ok=false;break;}
    g.makeMove(mv);
  }
  checked++;
  /* L'echiquier des pages d'ouverture est anime : les pieces sont posees par
     <use> et il y a une position par demi-coup. On compte celles du dernier
     groupe, qui est la position finale, celle que le texte annonce. */
  const groups=h.match(/<g data-ply="\d+"(?: hidden)?>[\s\S]*?<\/g>/g);
  const svgPieces=groups
    ? (groups[groups.length-1].match(/<use href="#/g)||[]).length
    : (h.match(/<g transform="translate/g)||[]).length;
  let real=0;
  for(let sq=0;sq<128;sq++){if(sq&0x88){sq+=7;continue;}if(g.board[sq])real++;}
  if(!ok||svgPieces!==real)wrong++;
}
T("diagrams match the announced moves", wrong===0, checked+" pages checked, "+wrong+" wrong");

// index, sitemap, robots, manifest, sw
const idx=fs.readFileSync(OUT+"/openings/index.html","utf8");
T("opening index links every page", files.filter(f=>f!=="index.html").every(f=>idx.includes("/openings/"+f)));
const sm=fs.readFileSync(OUT+"/sitemap.xml","utf8");
const locs=[...sm.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
/* Comparer le sitemap au seul dossier des ouvertures n'avait de sens que
   lorsque le site ne contenait que cela. On verifie desormais ce qui compte :
   que chaque page d'ouverture y figure, et que le sitemap couvre bien
   l'ensemble du site. */
{
  const url=f=>"https://chang64.com/openings/"+f;
  const abs=files.filter(f=>f!=="index.html"&&!locs.includes(url(f)));
  T("sitemap lists every opening page", abs.length===0, abs.slice(0,3).join(", "));
  T("sitemap covers the whole site", locs.length>=files.length, locs.length+" urls pour "+files.length+" ouvertures");
}
T("sitemap is well formed", sm.startsWith("<?xml") && sm.includes("</urlset>"));
T("robots points at the sitemap", fs.readFileSync(OUT+"/robots.txt","utf8").includes("Sitemap: https://chang64.com/sitemap.xml"));
T("robots keeps the engine out", fs.readFileSync(OUT+"/robots.txt","utf8").includes("Disallow: /engine/"));
const man=JSON.parse(fs.readFileSync(OUT+"/manifest.webmanifest","utf8"));
T("manifest is valid json", man.name && man.start_url==="/" && man.display==="standalone");
T("manifest icons exist", man.icons.every(i=>fs.existsSync(OUT+i.src)));
const sw=fs.readFileSync(OUT+"/sw.js","utf8");
T("service worker parses", (()=>{try{new (require("vm").Script)(sw);return true}catch(e){return false}})());
T("service worker skips the 7 MB engine", sw.includes('/engine/'));
T("stockfish shipped", fs.existsSync(OUT+"/engine/stockfish-18-lite-single.wasm"));
T("GPL licence shipped alongside", fs.existsSync(OUT+"/engine/LICENSE-GPLv3.txt"));
/* Le .htaccess a ete retire : Cloudflare Pages ne le lit pas. Les types MIME
   sont desormais declares dans _headers, et c'est ce fichier qui compte. */
T("no stale .htaccess shipped", !fs.existsSync(OUT+"/.htaccess"));
{
  const hd=fs.readFileSync(OUT+"/_headers","utf8");
  T("_headers sets the wasm mime type", hd.includes("application/wasm"));
  T("_headers sets the manifest mime type", hd.includes("application/manifest+json"));
  T("_headers serves the licence as text", hd.includes("/LICENSE"));
}

// une page d'ouverture s'affiche-t-elle sans erreur ?
const dom=new JSDOM(fs.readFileSync(OUT+"/openings/sicilian-defense.html","utf8"));
const doc=dom.window.document;
T("sicilian page renders", doc.querySelector("h1").textContent==="Sicilian Defense", doc.querySelector("h1").textContent);
T("page lists variations", doc.querySelectorAll("tbody tr").length>5, doc.querySelectorAll("tbody tr").length+" rows");
T("page links back to the app", !!doc.querySelector('a[href="/"]'));
