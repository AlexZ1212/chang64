#!/usr/bin/env node
/* Les cinq points du 2026-11-23, mesures a 360 px dans les 10 langues.

   Usage :  node serveur_local.js 8096      (dans une autre fenetre)
            node mesure_cinq_points.js [http://localhost:8096] [dossier des captures]

   jsdom ne met rien en page : ce qui tient ou deborde ne se mesure que dans
   un vrai navigateur. Ce n'est pas un test de la suite : il lui faut un
   serveur et le Chrome sans fenetre.
   - « Touche », pas « Clique » : les trois textes changes (lecon « Comment
     bougent les pieces », carte Coordonnees, bandeau de depart) tiennent dans
     leur bloc et disent bien le mot du toucher.
   - Statistiques par cadence : la rangee de pastilles tient sur UNE ligne qui
     defile, sans barre de defilement ; aucun libelle sur deux lignes ; la
     barre et sa legende ne debordent pas. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./tests/outils/chrome_sans_fenetre.js");
const { LANGUES } = require("./langues/registre.js");
const BASE = (process.argv[2] || "http://localhost:8096").replace(/\/$/, "");
const SORTIE = process.argv[3] || path.join(__dirname, "..", "design", "cinq-points-2311");
const TOUCHER = { en: /\btap/i, fr: /touche/i, es: /\btoca/i, pt: /\btoqu|\btocar/i, de: /tipp/i, ru: /наж/i, it: /\btocc/i, tr: /dokun/i, pl: /dotkn/i, id: /ketuk|mengetuk/i };
const FICHE = { ef: { b: { r: 1012, n: 12 }, r: { r: 980, n: 1 }, c: { r: 0, n: 0 }, k: { r: 1104, n: 11 } }, dir: { v: 14, n: 3, d: 11, f: { b: [7, 2, 3], r: [1, 0, 0], c: [0, 0, 0], k: [4, 1, 6] } } };

/* Dans la page : ce qui deborde dans un bloc. */
const CONTROLE = `(function(sel, mono){
  const pb=[], racine=document.querySelector(sel);
  if(!racine)return ["bloc absent : "+sel];
  if(document.documentElement.scrollWidth>innerWidth+1)pb.push("la page deborde en largeur ("+document.documentElement.scrollWidth+" px)");
  const vus=[racine].concat([...racine.querySelectorAll("*")]);
  for(const e of vus){
    const r=e.getBoundingClientRect();
    if(!r.width||!r.height)continue;
    const cs=getComputedStyle(e);
    if(cs.visibility==="hidden")continue;
    const defile=e.closest(".tc-cats");
    if(!defile&&(r.right>innerWidth+1||r.left<-1))pb.push("<"+e.tagName.toLowerCase()+"."+(typeof e.className==="string"?e.className:"")+"> sort de l'ecran ("+Math.round(r.left)+" a "+Math.round(r.right)+")");
    if(e.children.length===0&&e.textContent.trim()&&cs.overflowX!=="auto"&&e.scrollWidth>e.clientWidth+1&&cs.display!=="inline")pb.push("texte coupe dans <"+e.tagName.toLowerCase()+"> « "+e.textContent.trim().slice(0,30)+" »");
    if(mono&&e.matches(mono)){const lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.3;if(r.height>lh*1.7+parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom))pb.push("libelle sur deux lignes : « "+e.textContent.trim()+" »");}
  }
  return pb;
})`;

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const c = await ouvrir({ largeur: 360, hauteur: 740, pause: 300 });
  const pb = [];
  let n = 0;
  const noter = async (nom, sel, mono) => { n++; for (const p of await c.js(CONTROLE + "(" + JSON.stringify(sel) + "," + JSON.stringify(mono || "") + ")")) pb.push(nom + " : " + p); };
  for (const lg of LANGUES) {
    const l = lg.code, url = BASE + lg.accueil;
    await c.aller(url);
    await c.js(`localStorage.clear();localStorage.setItem("chang64:lang",${JSON.stringify(l)});localStorage.setItem("chang64:progress",JSON.stringify({level:2,solved:20,best:4,rating:850,days:2}));1`);
    await c.aller(url);
    await c.js(`(function(){const s=document.createElement("style");s.textContent="#bravo,#bilan{display:none!important}";document.head.appendChild(s);})();1`);
    await c.attendre(700);

    /* 1. Carte Coordonnees, puis le bandeau de depart. */
    await c.js(`setMode("puzzles");document.getElementById("cardSolveCoord").click();1`); await c.attendre(500);
    const carte = await c.js(`(function(){const p=document.querySelector("#coordLauncher p.sub");return p?p.textContent:"";})()`);
    if (!TOUCHER[l].test(carte)) pb.push(l + " carte Coordonnees : le mot du toucher manque dans « " + carte.slice(0, 60) + " »");
    await noter(l + " carte Coordonnees", "#coordLauncher");
    if (l === "fr") await c.capture(path.join(SORTIE, "coordonnees-carte-fr.png"));
    await c.js(`document.getElementById("btnCoord").click();1`); await c.attendre(600);
    const bandeau = await c.js(`(function(){const b=document.getElementById("readyBanner");return b&&!b.classList.contains("hide")?b.textContent.replace(/\\s+/g," "):"";})()`);
    if (!TOUCHER[l].test(bandeau)) pb.push(l + " bandeau des coordonnees : le mot du toucher manque dans « " + bandeau.slice(0, 80) + " »");
    await noter(l + " bandeau des coordonnees", "#readyBanner");
    if (l === "fr" || l === "de" || l === "ru") await c.capture(path.join(SORTIE, "coordonnees-bandeau-" + l + ".png"));

    /* 2. La lecon « Comment bougent les pieces ». */
    await c.aller(url); await c.attendre(500);
    await c.js(`(function(){const s=document.createElement("style");s.textContent="#bravo,#bilan{display:none!important}";document.head.appendChild(s);})();1`);
    const intro = await c.js(`(function(){const e=debutEtapes()[0];document.getElementById("debutIntro").textContent=e.intro;return e.intro;})()`);
    if (!TOUCHER[l].test(intro)) pb.push(l + " lecon : le mot du toucher manque dans « " + intro.slice(0, 60) + " »");
    await c.js(`setMode("debut");1`); await c.attendre(900);
    await c.js(`document.getElementById("debutIntro").textContent=debutEtapes()[0].intro;document.getElementById("debutIntro").scrollIntoView({block:"center"});1`); await c.attendre(300);
    await noter(l + " lecon", "#debutIntro");
    if (l === "fr") await c.capture(path.join(SORTIE, "lecon-fr.png"));

    /* 3. Statistiques par cadence (quand elles existent dans cette version). */
    const aStats = await c.js(`typeof statsFamilles==="function"`);
    if (aStats) {
      await c.aller(url); await c.attendre(500);
      await c.js(`(function(){const s=document.createElement("style");s.textContent="#bravo,#bilan{display:none!important}";document.head.appendChild(s);})();1`);
      await c.js(`cp={pseudo:"Moi",cle:"moi",version:1,dev:"abc123",n:0,sync:0};cppLire=async()=>(${JSON.stringify(FICHE)});menuOuvrir();menuVue("stats");1`);
      await c.attendre(1600);
      await c.js(`(function(){const m=document.getElementById("menuStats"),t=document.querySelector("#menuMembres .stats-cat");m.scrollTop+=t.getBoundingClientRect().top-m.getBoundingClientRect().top-8;})();1`);
      await c.attendre(400);
      const rangee = await c.js(`(function(){const r=document.querySelector("#menuDirect .tc-cats");if(!r)return null;const cs=getComputedStyle(r),b=[...r.children];return {n:b.length,hauts:[...new Set(b.map(x=>Math.round(x.getBoundingClientRect().top)))].length,barre:r.offsetHeight-r.clientHeight,defile:r.scrollWidth>r.clientWidth+1,env:r.parentNode.className,sw:cs.scrollbarWidth};})()`);
      if (!rangee) pb.push(l + " statistiques : pas de rangee de pastilles");
      else {
        if (rangee.n !== 5) pb.push(l + " statistiques : " + rangee.n + " pastilles au lieu de 5");
        if (rangee.hauts !== 1) pb.push(l + " statistiques : les pastilles ne sont pas sur une seule ligne");
        if (rangee.barre > 2) pb.push(l + " statistiques : une barre de defilement de " + rangee.barre + " px se voit sous les pastilles");
        if (!/defile/.test(rangee.env)) pb.push(l + " statistiques : la rangee n'a pas son enveloppe .defile");
      }
      await noter(l + " statistiques, toutes les parties", "#menuDirect", ".tc-cats button, .stats-legende li");
      await c.capture(path.join(SORTIE, "statistiques-toutes-" + l + ".png"));
      /* Chaque pastille : la barre change, rien ne deborde. */
      for (const f of ["b", "r", "c", "k"]) {
        await c.js(`document.querySelector('#menuDirect .tc-cats button[data-f="${f}"]').click();1`); await c.attendre(350);
        await noter(l + " statistiques, pastille " + f, "#menuDirect", ".tc-cats button, .stats-legende li");
        if (f === "b" || (f === "k" && (l === "fr" || l === "de" || l === "ru" || l === "pl")) || (f === "c" && l === "fr")) await c.capture(path.join(SORTIE, "statistiques-" + f + "-" + l + ".png"));
      }
    }
  }
  await c.fermer();
  console.log(n + " ecrans mesures a 360 px, " + LANGUES.length + " langues ; captures dans " + SORTIE);
  if (pb.length) { console.log(pb.length + " defaut(s) :"); for (const p of pb) console.log("  " + p); process.exit(1); }
  console.log("aucun defaut");
})().catch(e => { console.error(e); process.exit(1); });
