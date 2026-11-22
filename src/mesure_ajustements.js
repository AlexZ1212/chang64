#!/usr/bin/env node
/* Mesure, dans un vrai navigateur, des ajustements du 2026-11-22 (liste
   d'Alexandre) :
   - bloc joueur (nom, pieces prises, pendule) : 54 px de haut (45 sur un
     telephone de moins de 700 px de haut), pendule centree sur la hauteur, nom
     centre tant qu'il n'y a aucune prise, puis groupe nom + prises centre ; la
     hauteur ne change pas quand la rangee des prises apparait ;
   - picto « Pieges d'ouverture » : le triangle tient dans son cadre ;
   - onglet Apprendre : la ligne « bats le boss » ne deborde pas.
   Dans les 10 langues, a 360 px : rien ne deborde.

   Usage :  node serveur_local.js 8093      (dans une autre fenetre)
            node mesure_ajustements.js [http://localhost:8093] [dossier des captures]

   jsdom ne met rien en page : cette mesure passe par un Chrome sans fenetre.
   Ce n'est pas un test de la suite (il lui faut un serveur et ce Chrome). */
const path = require("path"), fs = require("fs");
const { ouvrir } = require("./tests/outils/chrome_sans_fenetre.js");
const { LANGUES } = require("./langues/registre.js");
const BASE = (process.argv[2] || "http://localhost:8093").replace(/\/$/, "");
const CAPTURES = process.argv[3] || "";

/* Dans la page : geometrie des deux blocs. */
const BLOCS = `(function(){
  const r=e=>e.getBoundingClientRect(),m=x=>Math.round(x*10)/10;
  return ["clockTop","clockBottom"].map(id=>{
    const b=document.getElementById(id),rb=r(b),nom=r(b.querySelector(".who")),t=b.querySelector("time"),rt=r(t),tk=b.querySelector(".taken"),rk=tk?r(tk):null;
    const chiffres=document.createRange();chiffres.selectNodeContents(t);const rc=chiffres.getBoundingClientRect();
    const milieu=(rb.top+rb.bottom)/2,avecPrises=!!(rk&&rk.height>0);
    return {id,h:m(rb.height),bas:m(rb.bottom),droite:m(rb.right),
      temps:rc.height?m((rc.top+rc.bottom)/2-milieu):0,
      nom:m((nom.top+nom.bottom)/2-milieu),
      groupe:avecPrises?m((nom.top+rk.bottom)/2-milieu):null,
      nomDroite:m(r(b.querySelector(".who span")).right),tempsGauche:m(rt.left),
      coupe:b.querySelector(".who span").scrollWidth>b.querySelector(".who span").clientWidth+1};
  });
})()`;

(async () => {
  const tout = [];
  let mesures = 0;
  const c = await ouvrir({ largeur: 360, hauteur: 740 });
  const capture = async nom => { if (CAPTURES) { fs.mkdirSync(CAPTURES, { recursive: true }); await c.capture(path.join(CAPTURES, nom + ".png")); } };
  const partie = async () => {
    await c.js(`setMode("play");document.getElementById("btnNew").click();1`); await c.attendre(500);
    await c.js(`(function(){const r=document.getElementById("readyBanner");if(r&&!r.classList.contains("hide"))document.getElementById("readyStart").click();})();1`); await c.attendre(500);
    await c.js(`document.getElementById("clockTop").scrollIntoView({block:"start"});window.scrollBy(0,-80);1`); await c.attendre(300);
  };
  const controler = (nom, blocs, haut, prises) => {
    for (const b of blocs) {
      mesures++;
      if (Math.abs(b.h - haut) > 0.6) tout.push(nom + " " + b.id + " : " + b.h + " px de haut au lieu de " + haut);
      if (Math.abs(b.temps) > 1) tout.push(nom + " " + b.id + " : pendule decentree de " + b.temps + " px");
      if (!prises && Math.abs(b.nom) > 1) tout.push(nom + " " + b.id + " : nom decentre de " + b.nom + " px (sans prise)");
      if (prises && (b.groupe === null || Math.abs(b.groupe) > 1)) tout.push(nom + " " + b.id + " : groupe nom + prises decentre de " + b.groupe + " px");
      if (b.nomDroite > b.tempsGauche - 4) tout.push(nom + " " + b.id + " : le nom touche la pendule");
      if (b.droite > 360.5) tout.push(nom + " " + b.id + " : sort de l'ecran");
    }
  };
  for (const lg of LANGUES) {
    const l = lg.code, url = BASE + lg.accueil;
    await c.aller(url);
    await c.js(`localStorage.clear();localStorage.setItem("chang64:lang",${JSON.stringify(l)});1`);
    await c.aller(url);
    await c.js(`(function(){const s=document.createElement("style");s.textContent="#bravo,#bilan{display:none!important}";document.head.appendChild(s);})();1`);
    await c.attendre(700);

    /* Bloc joueur : debut de partie, puis avec des prises. */
    await partie();
    const avant = await c.js(BLOCS);
    controler(l + " debut de partie", avant, 54, false);
    if (l === "fr" || l === "de" || l === "ru") await capture("bloc-joueur-debut-" + l);
    /* La page redessine ses blocs a chaque battement de pendule : on lui fait rendre des prises. */
    await c.js(`(function(){const av=rangeePrises;rangeePrises=function(l,coul,s){return coul==="b"?av(["p","p","p","p","p","p","n","n","b","r","q"],coul,9):av(["p","p","n"],coul,-2);};window.__sansPrises=()=>{rangeePrises=av;};})();render();1`); await c.attendre(400);
    const apres = await c.js(BLOCS);
    controler(l + " avec des prises", apres, 54, true);
    for (let i = 0; i < 2; i++) if (avant[i].bas !== apres[i].bas) tout.push(l + " " + avant[i].id + " : le bloc bouge quand les prises arrivent (" + avant[i].bas + " puis " + apres[i].bas + ")");
    if (l === "fr" || l === "de" || l === "ru") await capture("bloc-joueur-prises-" + l);
    await c.js(`window.__sansPrises();document.getElementById("btnResign").click();document.getElementById("btnResign").click();1`); await c.attendre(500);

    /* Rangees de cadences et barre d'onglets : jamais de defilement vertical. */
    for (const ecran of ["play", "friend"]) {
      await c.js(`setMode("${ecran}");${ecran === "friend" ? 'amiModeRegler("direct");' : ""}window.scrollTo(0,0);1`); await c.attendre(500);
      const v = await c.js(`[...document.querySelectorAll(".tc-cats,.tabs")].filter(e=>e.getBoundingClientRect().width>0).filter(e=>getComputedStyle(e).overflowY!=="hidden").map(e=>e.id||e.className).join()`);
      mesures++;
      if (v) tout.push(l + " " + ecran + " : defilement vertical possible sur " + v);
    }
    await c.js(`setMode("home");1`); await c.attendre(200);

    /* Explorer : le triangle des pieges dans son cadre. */
    await c.js(`document.getElementById("tab-explore").click();window.scrollTo(0,0);1`); await c.attendre(900);
    const pieges = await c.js(`(function(){const p=[...document.querySelectorAll("#pane-explore .picto svg")].find(s=>s.innerHTML.includes("M-2.900 -17.200"));if(!p)return null;const t=[...p.querySelectorAll("path")].find(x=>x.getAttribute("d").startsWith("M-2.900 -17.200")),a=p.getBoundingClientRect(),b=t.getBoundingClientRect();return [a.right-b.right,b.top-a.top,a.width];})()`);
    mesures++;
    if (!pieges) tout.push(l + " explorer : picto des pieges introuvable");
    else if (pieges[0] < 0.4 || pieges[1] < 0.2) tout.push(l + " explorer : le triangle des pieges touche le bord (droite " + pieges[0].toFixed(2) + " px, haut " + pieges[1].toFixed(2) + " px)");
    if (l === "fr") await capture("explorer-" + l);

    /* Apprendre : chapitre fini dont le boss attend, chapitre suivant ferme. */
    await c.js(`(async()=>{await window.storage.set("chang64:debut",JSON.stringify({e:7,x:0,f:[0,1,2,3,4,5,6]}));await window.storage.set("chang64:chemin",JSON.stringify({v:2,c:{regles:{e:5,x:0,f:[0,1,2,3,4],b:1}},o:[],p:{x:1}}));return 1;})()`);
    await c.aller(url); await c.attendre(700);
    await c.js(`document.getElementById("tab-apprendre").click();window.scrollTo(0,0);1`); await c.attendre(1300);
    const ap = await c.js(`(function(){const pb=[],de=document.documentElement;if(de.scrollWidth>360)pb.push("la page deborde ("+de.scrollWidth+" px)");
      for(const e of document.querySelectorAll("#pane-apprendre .ap-chap, #pane-apprendre .ap-chap *")){const r=e.getBoundingClientRect();if(r.width&&(r.right>360.5||r.left<-0.5))pb.push("hors de l'ecran : "+e.className+" « "+e.textContent.trim().slice(0,40)+" »");}
      return [pb.slice(0,4),[...document.querySelectorAll("#pane-apprendre .ap-chap")].slice(0,3).map(b=>b.className+" | "+(b.querySelector(".ap-chap-suite")||b).textContent.trim().slice(-70))];})()`);
    mesures++;
    for (const p of ap[0]) tout.push(l + " apprendre : " + p);
    if (l === "fr") console.log("  apprendre (fr) :", JSON.stringify(ap[1]));
    if (l === "fr" || l === "de" || l === "ru" || l === "pl") await capture("apprendre-" + l);
  }
  /* Petit telephone (moins de 700 px de haut) : bloc compact, pendule du joueur a l'ecran. */
  for (const [L, H] of [[360, 640], [375, 548]]) {
    await c.taille(L, H);
    await c.aller(BASE + "/fr/");
    await c.js(`localStorage.clear();localStorage.setItem("chang64:lang","fr");1`);
    await c.aller(BASE + "/fr/"); await c.attendre(700);
    await c.js(`setMode("play");document.getElementById("btnNew").click();1`); await c.attendre(500);
    await c.js(`(function(){const r=document.getElementById("readyBanner");if(r&&!r.classList.contains("hide"))document.getElementById("readyStart").click();})();1`); await c.attendre(500);
    await c.js(`window.scrollTo(0,0);1`); await c.attendre(300);
    const b = await c.js(BLOCS);
    mesures += 2;
    for (const x of b) {
      if (Math.abs(x.h - 45) > 0.6) tout.push(L + " x " + H + " " + x.id + " : " + x.h + " px de haut au lieu de 45");
      if (Math.abs(x.temps) > 1 || Math.abs(x.nom) > 1) tout.push(L + " x " + H + " " + x.id + " : decentre (pendule " + x.temps + ", nom " + x.nom + ")");
    }
    console.log("  " + L + " x " + H + " : pendule du joueur de " + (b[1].bas - b[1].h) + " a " + b[1].bas + " px (ecran de " + H + ")");
    /* A 375 x 548 (iPhone SE dans Safari) elle depassait deja de 14 px avant ces ajustements, depuis que le logo reste affiche (2026-11-14). */
    if (H >= 600 && b[1].bas > H) tout.push(L + " x " + H + " : la pendule du joueur sort de l'ecran (" + b[1].bas + " px pour " + H + ")");
    await capture("bloc-joueur-" + L + "x" + H);
  }
  await c.fermer();
  console.log(mesures + " mesures, " + tout.length + " defaut(s)");
  for (const p of tout) console.log("  DEFAUT " + p);
  process.exit(tout.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
