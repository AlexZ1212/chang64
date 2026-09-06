const fs=require("fs"),path=require("path");
const {Game}=require("./engine.js");
const OUT="./site";
const THEMES=JSON.parse(fs.readFileSync(require("path").join(__dirname,"themes.json"),"utf8"));
const puzzles=JSON.parse(fs.readFileSync(require("path").join(__dirname,"puzzles.json"),"utf8"));
for(const p of puzzles) if(THEMES[p.theme]) p.theme=THEMES[p.theme];
const T=(l,ok,x)=>console.log((ok?"  ok  ":" FAIL ")+l+(x?" — "+x:""));
const read=p=>fs.readFileSync(OUT+"/"+p,"utf8");
const list=d=>fs.readdirSync(OUT+"/"+d).filter(f=>f.endsWith(".html"));

/* Mis a jour le 2026-09-06 : ces effectifs etaient figes en dur et deja
   corriges une fois (learn 10->19, glossary 21->28). Le Lexique est passe a
   44 pages depuis, et le test echouait a nouveau sur une croissance normale
   du contenu. Un compte fige condamne ce test a echouer a chaque page
   ajoutee, et un echec permanent finit par masquer les vrais.
   On garde donc ce qui ne se perime pas : chaque section existe, et la
   version francaise a exactement le meme nombre de pages que l'anglaise.
   C'est la propriete reellement utile, une page ajoutee d'un seul cote
   etant le vrai defaut a attraper.
   /puzzles/ reste a part : depuis la refonte en 13 pages de theme, il en
   contient 13 + index.html quelle que soit la taille de la banque. */
const SEC=[["learn","fr/apprendre"],["glossary","fr/lexique"],["endgames","fr/finales"],["traps","fr/pieges"],["puzzles","fr/exercices"]];
for(const [en,fr] of SEC){
  T(`${en}: section non vide`, list(en).length>0, list(en).length);
  T(`${en}: autant de pages FR que EN`, list(en).length===list(fr).length,
    list(en).length+" EN pour "+list(fr).length+" FR");
}
T("puzzles: 13 pages de theme + index", list("puzzles").length===14, list("puzzles").length);

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

/* Le bloc "solutions d'exercices exactes" a ete retire (2026-09-02) : il
   cherchait un fichier par exercice individuel (`${id}-${theme}.html`),
   architecture abandonnee au profit de 13 pages de theme (3 exemples
   travailles chacune). Une verification equivalente sur les 39 exemples
   actuellement affiches (verifier que le coup montre correspond au coup
   reellement joue par le moteur sur la position de depart) reste a
   ecrire si besoin -- pas fait ici pour rester dans le perimetre demande
   (retirer l'obsolete, pas ajouter une nouvelle couverture). */

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
  /* Mis a jour le 2026-09-06 : le correctif du 05/09 met noindex,follow sur
     les pages d'ouvertures sans note redigee. Elles restent publiees et
     maillees depuis /openings/, mais n'ont plus rien a faire au sitemap :
     y declarer une page noindex est contradictoire. Le controle porte
     desormais sur les seules pages indexables, et verifie en plus qu'aucune
     page noindex n'y figure. */
  const estNoindex=u=>/name="robots" content="noindex/.test(fs.readFileSync(OUT+u,"utf8"));
  const publiables=html.filter(u=>!u.startsWith("/players/")&&!u.endsWith("/404.html"));
  const indexables=publiables.filter(u=>!estNoindex(u));
  const locs=new Set([...sm.matchAll(/<loc>https:\/\/chang64\.com([^<]*)<\/loc>/g)].map(m=>m[1]));
  const dansLeSitemap=u=>locs.has(u)||locs.has(u.replace(/index\.html$/,""));
  const absentes=indexables.filter(u=>!dansLeSitemap(u));
  const enTrop=publiables.filter(u=>estNoindex(u)&&dansLeSitemap(u));
  T("sitemap couvre toutes les pages indexables", absentes.length===0,
    absentes.length+" absentes : "+absentes.slice(0,3).join(", "));
  T("aucune page noindex au sitemap", enTrop.length===0,
    enTrop.length+" en trop : "+enTrop.slice(0,3).join(", "));
  T("sitemap non vide et coherent", locs.size>=indexables.length*0.9, locs.size+" URL pour "+indexables.length+" pages indexables");
}
