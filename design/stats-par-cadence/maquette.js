#!/usr/bin/env node
/* Maquette montree a Alexandre le 2026-11-23 : trois facons d'afficher les
   parties gagnees / nulles / perdues par cadence dans les statistiques.

   Usage :  node src/serveur_local.js 8096      (dans une autre fenetre)
            node design/stats-par-cadence/maquette.js [http://localhost:8096]

   Les trois variantes sont posees dans la vraie page (vraies couleurs, vraies
   polices, 360 px de large) avec des chiffres inventes, puis photographiees. */
const path = require("path");
const { ouvrir } = require("../../src/tests/outils/chrome_sans_fenetre.js");
const BASE = (process.argv[2] || "http://localhost:8096").replace(/\/$/, "");
const FAM = { b: [7, 2, 3], r: [1, 0, 0], c: [0, 0, 0], k: [4, 1, 6] };
const FICHE = { ef: { b: { r: 1012, n: 12 }, r: { r: 980, n: 1 }, c: { r: 0, n: 0 }, k: { r: 1104, n: 11 } }, dir: { v: 12, n: 3, d: 9 } };

const VARIANTES = {
  /* A : une barre par cadence, les unes sous les autres. */
  A: `(function(){
    const F=${JSON.stringify(FAM)},e=document.getElementById("menuDirect");
    let h=statsSous("Live games")+statsBilan(12,3,9);
    for(const [c,nom] of ELO_FAMILLES){const x=F[c];if(x[0]+x[1]+x[2]>0)h+=statsSous(nom)+statsBilan(x[0],x[1],x[2]);}
    poserHtml(e,h);
  })()`,
  /* B : une rangee de pastilles, une seule barre qui change. */
  B: `(function(){
    const F=${JSON.stringify(FAM)},e=document.getElementById("menuDirect");
    const p=[["","All"]].concat(ELO_FAMILLES).map(([c,nom])=>'<button type="button" aria-pressed="'+(c==="b")+'">'+echapper(c?t(nom):"Toutes")+"</button>").join("");
    poserHtml(e,statsSous("Live games")+'<div class="defile" style="margin:0 2px 8px"><div class="tc-cats">'+p+"</div></div>"+statsBilan(F.b[0],F.b[1],F.b[2]));
    if(typeof defileBrancher==="function")e.querySelectorAll(".tc-cats").forEach(defileBrancher);
  })()`,
  /* C : le detail dans chaque tuile d'Elo, la barre du total dessous. */
  C: `(function(){
    const F=${JSON.stringify(FAM)};
    document.querySelectorAll("#menuEloFamilles .menu-tuile").forEach(tu=>{
      const x=F[tu.dataset.f],tot=x[0]+x[1]+x[2];
      if(!tot)return;
      const d=document.createElement("div");
      d.innerHTML='<div class="stats-barre" style="height:8px;margin-top:6px">'+[["g",x[0]],["n",x[1]],["p",x[2]]].filter(c=>c[1]>0).map(c=>'<i class="'+c[0]+'" style="flex-grow:'+c[1]+'"></i>').join("")+"</div>"+
        '<ul class="stats-legende" style="margin-top:6px;gap:4px 10px;font-size:12px">'+[["g",x[0]],["n",x[1]],["p",x[2]]].map(c=>'<li class="'+c[0]+'"><b style="font-size:13px">'+c[1]+"</b></li>").join("")+"</ul>";
      tu.appendChild(d);
    });
    const e=document.getElementById("menuDirect");
    poserHtml(e,statsSous("Live games")+statsBilan(12,3,9));
  })()`
};

(async () => {
  const c = await ouvrir({ largeur: 360, hauteur: 760, pause: 300 });
  await c.aller(BASE + "/fr/");
  await c.js(`localStorage.clear();localStorage.setItem("chang64:lang","fr");localStorage.setItem("chang64:compte",JSON.stringify({pseudo:"Moi",cle:"moi",version:1,dev:"abc123",n:0,sync:0}));localStorage.setItem("chang64:progress",JSON.stringify({level:2,solved:20,best:4,rating:850,days:2}));1`);
  for (const [nom, code] of Object.entries(VARIANTES)) {
    await c.aller(BASE + "/fr/");
    await c.js(`(function(){const s=document.createElement("style");s.textContent="#bravo,#bilan{display:none!important}";document.head.appendChild(s);})();1`);
    await c.attendre(700);
    /* Pas de vrai compte sur le serveur local : on pose le membre a la main. */
    await c.js(`cp={pseudo:"Moi",cle:"moi",version:1,dev:"abc123",n:0,sync:0};cppLire=async()=>(${JSON.stringify(FICHE)});menuOuvrir();menuVue("stats");1`);
    await c.attendre(1500);
    await c.js(code + ";1");
    await c.js(`(function(){const m=document.getElementById("menuStats"),t=document.querySelector("#menuMembres .stats-cat");m.scrollTop+=t.getBoundingClientRect().top-m.getBoundingClientRect().top-8;})();1`);
    await c.attendre(500);
    await c.capture(path.join(__dirname, "variante-" + nom + ".png"));
    console.log("variante " + nom + " : " + await c.js(`(function(){const e=document.getElementById("menuMembres");return "hauteur du bloc "+Math.round(e.getBoundingClientRect().height)+" px";})()`));
  }
  await c.fermer();
})().catch(e => { console.error(e); process.exit(1); });
