/* Verification automatique de chang64.
   Lancement : node tests/<fichier>.js  (depuis la racine des sources)
   Le site doit avoir ete construit au prealable : node build_site.js */
const SITE = require("path").join(__dirname, "..", "site");
const BASE = process.env.CHANG64_BASELINE || "";   /* site deja en ligne, facultatif */
const fs=require("fs"),jd=require("jsdom");
const S=SITE;
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};

const file=S+"/openings/sicilian-defense.html";
const html=fs.readFileSync(file,"utf8");

console.log("\n--- Sans JavaScript (repli) ---");
{
  const d=new jd.JSDOM(html).window.document;
  const g=d.querySelectorAll(".anim svg > g[data-ply]");
  T("positions presentes dans le HTML", g.length>=2, g.length+" positions");
  const vis=[...g].filter(x=>!x.hasAttribute("hidden"));
  T("une seule position visible sans JS", vis.length===1, vis.length+" visibles");
  T("c'est la position finale", vis[0]===g[g.length-1]);
  T("commandes masquees sans JS", d.querySelector(".animctl").hasAttribute("hidden"));
  T("regle CSS explicite pour le masquage", html.includes("g[data-ply][hidden]{display:none}"));
  T("formes definies une seule fois", (html.match(/<symbol /g)||[]).length===12,
     (html.match(/<symbol /g)||[]).length+" symboles");
  T("pieces posees par reference", (html.match(/<use href="#/g)||[]).length>0);
}

console.log("\n--- Avec JavaScript ---");
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/openings/sicilian-defense.html",virtualConsole:new jd.VirtualConsole()});
const w=dom.window,d=w.document;
setTimeout(()=>{
  const g=d.querySelectorAll(".anim svg > g[data-ply]");
  const ctl=d.querySelector(".animctl");
  T("commandes revelees", !ctl.hasAttribute("hidden"));
  const vis=()=>[...g].findIndex(x=>!x.hasAttribute("hidden"));
  T("demarre a la position de depart", vis()===0, "ply "+vis());
  const lab=d.querySelector(".animply");
  T("libelle affiche la position de depart", (lab.textContent||"").length>0, lab.textContent);

  const next=ctl.querySelector('[data-act="next"]'), prev=ctl.querySelector('[data-act="prev"]'), play=ctl.querySelector('[data-act="play"]');
  T("bouton precedent desactive au depart", prev.disabled);
  next.click();
  T("suivant avance d'un coup", vis()===1, "ply "+vis());
  T("libelle suit le coup", /1\.e4/.test(lab.textContent||""), lab.textContent);
  next.click();
  T("suivant encore", vis()===2, "ply "+vis());
  T("libelle du coup noir", /1\u2026c5|1\.\.\.c5/.test(lab.textContent||""), lab.textContent);
  T("bouton suivant desactive en fin de ligne", next.disabled);
  prev.click();
  T("precedent recule", vis()===1, "ply "+vis());
  play.click();
  T("lecture demarree (icone pause)", play.innerHTML.includes("\u2759")||play.innerHTML.includes("&#10073;")||play.innerHTML!=="\u25b6",
     JSON.stringify(play.innerHTML));

  console.log("\n--- Toujours une seule position visible ---");
  T("invariant respecte", [...g].filter(x=>!x.hasAttribute("hidden")).length===1);

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},600);
