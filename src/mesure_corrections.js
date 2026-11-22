#!/usr/bin/env node
/* Mesure a 360 px, dans les 10 langues, des ecrans touches par les corrections
   du 2026-11-22 (liste d'Alexandre) : accueil (trois chiffres et lien),
   statistiques par categorie, barre sous l'echiquier, reglages rapides,
   Analyser (chargement d'une partie), lien des finales, aide clavier,
   ecran Contre un ami refondu (membre, correspondance, joueur en ligne,
   partie par lien sans compte) et carre de notification.

   Usage :  node serveur_local.js 8071      (dans une autre fenetre)
            node mesure_corrections.js [http://localhost:8071] [dossier des captures]

   Regle d'Alexandre : a 360 px, dans les 10 langues, aucune ligne ne deborde
   et aucun libelle de bouton ne passe sur deux lignes. jsdom ne met rien en
   page : cette mesure passe par un vrai Chrome sans fenetre. Ce n'est pas un
   test de la suite (il lui faut un serveur et ce Chrome). */
const path = require("path"), fs = require("fs");
const { ouvrir } = require("./tests/outils/chrome_sans_fenetre.js");
const { LANGUES } = require("./langues/registre.js");
const BASE = (process.argv[2] || "http://localhost:8071").replace(/\/$/, "");
const CAPTURES = process.argv[3] || "";
const L = 360, H = 740;

const PARTIES = ["win", "win", "loss", "win", "draw", "loss", "win", "win", "loss"].map((r, i) => ({ t: Date.now() - i * 864e5, k: "o", c: "w", r, lvl: 1, elo: 700, m: "e2e4 e7e5 g1f3 b8c6" }));
const PROG = { level: 3, solved: 128, best: 14, rating: 1012, days: 12, rushBest: 17, coordBest: 23, endgames: { kq: 9, kr: 20 },
  eloOrdi: { r: 945, n: 29, pic: 960, h: Array.from({ length: 30 }, (x, i) => [Date.now() - (30 - i) * 864e5, 800 + i * 5]) },
  ratingHistory: Array.from({ length: 20 }, (x, i) => ({ t: Date.now() - (20 - i) * 864e5, r: 800 + i * 11 })),
  solveLog: Array.from({ length: 60 }, (x, i) => Date.now() - (i % 25) * 864e5) };

/* Dans la page : ce qui deborde ou passe sur deux lignes dans la zone donnee. */
const MESURE = `(function(nom,zone){
  const de=document.documentElement,pb=[],racine=document.querySelector(zone)||document.body;
  if(de.scrollWidth>${L})pb.push(nom+" : la page deborde en largeur ("+de.scrollWidth+" px)");
  const lignes=el=>{const r=document.createRange();r.selectNodeContents(el);return new Set([...r.getClientRects()].filter(x=>x.width>0).map(x=>Math.round(x.top/4))).size;};
  const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=="hidden";};
  for(const b of racine.querySelectorAll("button.btn,button.linkbtn,button.chip,.seg button,.tc-cats button")){
    if(!visible(b)||!b.textContent.trim())continue;
    if(lignes(b)>1)pb.push(nom+" : bouton sur deux lignes « "+b.textContent.trim()+" »");
    if(b.scrollWidth>b.clientWidth+1)pb.push(nom+" : libelle coupe « "+b.textContent.trim()+" »");
  }
  for(const e of racine.querySelectorAll("*")){
    if(!visible(e)||e.closest(".navscroll"))continue;
    const r=e.getBoundingClientRect();
    if(r.right>${L}+0.5||r.left<-0.5)pb.push(nom+" : hors de l'ecran <"+e.tagName.toLowerCase()+(e.id?"#"+e.id:"")+(e.className&&typeof e.className==="string"?"."+e.className.split(" ")[0]:"")+"> "+Math.round(r.left)+".."+Math.round(r.right));
    if((e.matches(".menu-tuile,.stat,.stats-legende li,.stats-bilan-tete,.clavier-liste dd,.clavier-liste dt"))&&e.scrollWidth>e.clientWidth+1)pb.push(nom+" : texte coupe dans <"+e.className+"> « "+e.textContent.trim().slice(0,30)+" »");
  }
  /* Une ponctuation haute en debut de ligne (francais). */
  if(document.documentElement.lang==="fr"){
    const tw=document.createTreeWalker(racine,NodeFilter.SHOW_TEXT);let n;
    while((n=tw.nextNode())){
      const t=n.nodeValue;if(!n.parentElement||!visible(n.parentElement))continue;
      for(let i=1;i<t.length;i++){
        if(!/[;:!?»]/.test(t[i]))continue;
        let j=i-1;while(j>=0&&/\\s/.test(t[j]))j--;if(j<0||j===i-1)continue;
        const a=document.createRange();a.setStart(n,j);a.setEnd(n,j+1);const b=document.createRange();b.setStart(n,i);b.setEnd(n,i+1);
        const ra=a.getClientRects()[0],rb=b.getClientRects()[0];
        if(ra&&rb&&rb.top>ra.top+4)pb.push(nom+" : « "+t[i]+" » seul en debut de ligne dans « "+t.slice(Math.max(0,i-25),i+8).trim()+" »");
      }
    }
  }
  return pb.slice(0,8);
})`;

(async () => {
  const c = await ouvrir({ largeur: L, hauteur: H });
  const tout = [];
  let ecrans = 0;
  const noter = async (nom, zone) => { ecrans++; for (const p of await c.js(MESURE + "(" + JSON.stringify(nom) + "," + JSON.stringify(zone || "body") + ")")) tout.push(p); };
  const capture = async nom => { if (CAPTURES) { fs.mkdirSync(CAPTURES, { recursive: true }); await c.capture(path.join(CAPTURES, nom + ".png")); } };
  for (const lg of LANGUES) {
    const l = lg.code, url = BASE + lg.accueil;
    await c.aller(url);
    await c.js(`localStorage.clear();localStorage.setItem("chang64:lang",${JSON.stringify(l)});localStorage.setItem("chang64:progress",${JSON.stringify(JSON.stringify(PROG))});localStorage.setItem("chang64:games",${JSON.stringify(JSON.stringify(PARTIES))});localStorage.setItem("chang64:compte",JSON.stringify({pseudo:"Moi",cle:"moi",version:1,dev:"abc123",n:0,sync:0}));1`);
    await c.aller(url);
    /* Les felicitations de badges, que cette fausse progression declenche, ne doivent pas couvrir les captures. */
    await c.js(`(function(){const s=document.createElement("style");s.textContent="#bravo,#bilan{display:none!important}";document.head.appendChild(s);})();1`);
    await c.attendre(900);

    /* Accueil : les trois chiffres et le lien. */
    await c.js(`document.getElementById("homeProgressPanel").scrollIntoView({block:"center"});1`); await c.attendre(1400);
    await noter(l + " accueil", "#homeProgressPanel");
    if (l === "fr" || l === "de" || l === "ru") await capture("accueil-" + l);

    /* Statistiques, membre, avec des parties entre membres. */
    await c.js(`cppLire=async()=>({ef:{b:{r:1012,n:12},r:{r:980,n:1},c:{r:0,n:0},k:{r:1104,n:40}},dir:{v:12,n:3,d:9}});menuOuvrir();menuVue("stats");1`);
    await c.attendre(1800);
    await noter(l + " statistiques (haut)", "#menuTiroir");
    if (l === "fr") await capture("statistiques-1-" + l);
    const hauteur = await c.js(`document.getElementById("menuStats").scrollHeight`);
    for (let y = 560, i = 2; y < hauteur; y += 560, i++) {
      await c.js(`document.getElementById("menuStats").scrollTop=${y};1`); await c.attendre(250);
      await noter(l + " statistiques (" + i + ")", "#menuTiroir");
      if (l === "fr" || ((l === "de" || l === "ru" || l === "pl") && i <= 3)) await capture("statistiques-" + i + "-" + l);
    }
    await c.js(`menuFermer();1`); await c.attendre(350);

    /* Une partie en cours : la barre sous l'echiquier, les reglages rapides, l'aide clavier. */
    await c.js(`setMode("play");document.getElementById("btnNew").click();1`); await c.attendre(500);
    await c.js(`(function(){const r=document.getElementById("readyBanner");if(r&&!r.classList.contains("hide"))document.getElementById("readyStart").click();})();1`); await c.attendre(400);
    await c.js(`playUser(game.moves().find(m=>game.uci(m)==="e2e4"));1`); await c.attendre(1300);
    await c.js(`document.getElementById("boardTools").scrollIntoView({block:"center"});1`); await c.attendre(200);
    await noter(l + " barre sous l'echiquier", "#boardTools");
    if (l === "fr") await capture("barre-" + l);
    await c.js(`document.getElementById("btnReglages").click();1`); await c.attendre(500);
    await c.js(`document.getElementById("rrCorps").scrollTop=300;1`); await c.attendre(200);
    await noter(l + " reglages rapides", "#reglagesRapides");
    if (l === "fr") await capture("reglages-rapides-" + l);
    await c.js(`document.getElementById("rrFermer").click();clavierOuvrir();1`); await c.attendre(500);
    await noter(l + " aide clavier", "#duel");
    if (l === "fr" || l === "de") await capture("aide-clavier-" + l);
    await c.js(`document.querySelector("#duelContenu [data-duel-fermer]").click();1`); await c.attendre(300);

    /* Analyser : retournement en bas a droite, chargement d'une partie. */
    await c.js(`document.getElementById("btnResign").click();document.getElementById("btnResign").click();1`); await c.attendre(500);
    await c.js(`setMode("edit");window.scrollTo(0,0);1`); await c.attendre(500);
    await noter(l + " analyser (haut)", "#appLayout");
    if (l === "fr") await capture("analyser-" + l);
    await c.js(`document.getElementById("pgnImportPanel").scrollIntoView({block:"center"});1`); await c.attendre(300);
    await noter(l + " analyser (charger une partie)", "#pgnImportPanel");
    if (l === "fr") await capture("analyser-charger-" + l);

    /* Finales : le lien vers l'article. */
    await c.js(`document.getElementById("tab-puzzles").click();1`); await c.attendre(300);
    await c.js(`document.getElementById("cardSolveEndgames").click();1`); await c.attendre(500);
    await c.js(`document.getElementById("egChips").children[3].click();1`); await c.attendre(400);
    await c.js(`document.getElementById("egArticle").scrollIntoView({block:"center"});1`); await c.attendre(200);
    await noter(l + " finale", "#pane-train, #appLayout");
    const lignesLien = await c.js(`(function(){const a=document.querySelector("#egArticle a");if(!a)return 0;const r=document.createRange();r.selectNodeContents(a);return new Set([...r.getClientRects()].map(x=>Math.round(x.top/4))).size;})()`);
    if (lignesLien !== 1) tout.push(l + " finale : le lien vers l'article tient sur " + lignesLien + " ligne(s)");
    if (l === "fr") await capture("finale-" + l);

    /* Contre un ami, membre : un seul bloc, les familles de cadences sur UNE ligne. */
    const uneLigne = async (id, nom) => {
      const r = await c.js(`(function(){const b=[...document.getElementById("${id}").children].filter(x=>x.getBoundingClientRect().width>0);return new Set(b.map(x=>Math.round(x.getBoundingClientRect().top))).size;})()`);
      if (r !== 1) tout.push(l + " " + nom + " : sur " + r + " lignes");
    };
    await c.js(`localStorage.removeItem("chang64:amiCadence");setMode("friend");amiCadenceLire();amiModeRegler("direct");window.scrollTo(0,0);1`); await c.attendre(500);
    await noter(l + " contre un ami (membre)", "#pane-friend");
    await uneLigne("directCats", "familles de cadences"); await uneLigne("directCadences", "cadences rapides"); await uneLigne("directCouleur", "couleurs");
    const defile = await c.js(`(function(){const e=document.getElementById("directCats");return [e.scrollWidth,e.clientWidth,document.getElementById("directCatsDefile").className].join(" ");})()`);
    const [sw, cw] = defile.split(" ").map(Number);
    if (sw > cw + 2 && !/has-scroll-right/.test(defile)) tout.push(l + " familles de cadences : la rangee defile (" + sw + " > " + cw + ") sans indice a droite");
    if (l === "fr" || l === "de" || l === "ru" || l === "id") await capture("ami-membre-" + l);
    await c.js(`document.getElementById("directCats").children[3].click();1`); await c.attendre(350);
    await noter(l + " contre un ami (correspondance)", "#pane-friend");
    await uneLigne("directCats", "familles de cadences (correspondance)"); await uneLigne("directCadences", "delais par coup");
    const gauche = await c.js(`document.getElementById("directCatsDefile").className+" "+document.getElementById("directCats").scrollLeft`);
    if (sw > cw + 2 && !/has-scroll-left/.test(gauche)) tout.push(l + " familles de cadences : Correspondance choisie, pas d'indice a gauche (" + gauche + ")");
    if (l === "fr" || l === "de") await capture("ami-correspondance-" + l);
    await c.js(`document.getElementById("directCats").children[1].click();amiModeRegler("hasard");window.scrollTo(0,0);1`); await c.attendre(350);
    await noter(l + " contre un joueur en ligne", "#pane-friend");
    if (l === "fr") await capture("ami-en-ligne-" + l);
    await c.js(`amiModeRegler("lien");window.scrollTo(0,0);1`); await c.attendre(350);
    await noter(l + " partie par lien (membre)", "#pane-friend");
    await uneLigne("dailyChips", "rythme de la partie par lien");
    if (l === "fr") await capture("ami-lien-membre-" + l);
    /* Le carre de notification, sur un autre ecran. */
    await c.js(`setMode("puzzles");corrRecu([{id:"aaaaaaaaaaaa",s:"jeu",atoi:true,adv:"Lea",cad:7,ech:Date.now()+2*864e5,h:Date.now()},{id:"bbbbbbbbbbbb",s:"invite",adv:"Tom",cad:8,coul:"n",ech:Date.now()+6*864e5,h:Date.now()}]);window.scrollTo(0,0);1`); await c.attendre(400);
    const carre = await c.js(`(function(){const b=document.getElementById("carreParties"),r=b.getBoundingClientRect();return [b.hidden,Math.round(r.right),Math.round(r.bottom),Math.round(r.width),Math.round(r.height),document.getElementById("carreNombre").textContent].join(" ");})()`);
    if (!/^false 346 726 56 56 2$/.test(carre)) tout.push(l + " carre de notification : " + carre);
    if (l === "fr") await capture("carre-" + l);
    await c.js(`setMode("jouer");window.scrollTo(0,0);1`); await c.attendre(400);
    await noter(l + " jouer (parties en cours)", "#pane-jouer");
    if (l === "fr" || l === "de") await capture("jouer-" + l);
    /* Sans compte : la partie par lien et ce qu'un compte apporte. */
    /* Le compte de test est aussi en memoire : la page le reecrirait en partant. */
    await c.js(`try{cp=null;}catch(e){};localStorage.removeItem("chang64:compte");1`);
    await c.aller("about:blank"); await c.aller(url);
    await c.js(`localStorage.removeItem("chang64:compte");1`);
    await c.aller(url); await c.attendre(800);
    if (await c.js(`estMembre()`)) tout.push(l + " : la mesure sans compte se fait encore avec un compte");
    await c.js(`(function(){const s=document.createElement("style");s.textContent="#bravo,#bilan{display:none!important}";document.head.appendChild(s);})();setMode("jouer");1`); await c.attendre(300);
    await c.js(`document.getElementById("jouerAmi").click();window.scrollTo(0,0);1`); await c.attendre(500);
    await noter(l + " contre un ami (sans compte)", "#pane-friend");
    await uneLigne("dailyChips", "rythme de la partie par lien (sans compte)");
    if (l === "fr" || l === "de" || l === "ru") await capture("ami-sans-compte-" + l);
  }
  await c.fermer();
  console.log(ecrans + " ecrans mesures a " + L + " px, " + LANGUES.length + " langues");
  if (tout.length) { console.log(tout.length + " defaut(s) :"); for (const p of tout) console.log("  " + p); process.exit(1); }
  console.log("aucun defaut");
})().catch(e => { console.error(e); process.exit(1); });
