#!/usr/bin/env node
/* Defilements automatiques : ou arrive-t-on ? (2026-11-22, demande d'Alexandre)

   Usage :  node serveur_local.js 8071      (dans une autre fenetre)
            node mesure_defilement.js [http://localhost:8071]

   Chaque bouton qui fait defiler la page doit amener son contenu juste sous
   l'en-tete (qui reste colle en haut) : ni cache dessous, ni loin dessous.
   Pour chaque largeur d'ecran, on declenche chaque defilement et on mesure
   l'ecart entre le bas de l'en-tete et le haut de la cible. Ce n'est pas un
   test de la suite : il lui faut un serveur et le Chrome sans fenetre. */
const { ouvrir } = require("./tests/outils/chrome_sans_fenetre.js");
const BASE = (process.argv[2] || "http://localhost:8071").replace(/\/$/, "");
const LARGEURS = [[360, 740], [768, 900], [1024, 800], [1366, 800]];
/* Ecart admis, en pixels, entre le bas de l'en-tete et le haut de la cible. */
/* 16 : un titre de section arrive a 12 px de l'en-tete. Le plafond etait de
   36 px tant que les titres Confidentialite et Accessibilite arrivaient a
   33 px sur telephone : l'ecran qui arrive en glissant elargissait la page le
   temps de son animation, et le navigateur visait 21 px trop haut. Corrige
   le 2026-11-23 (body{overflow-x:clip} dans template.html). */
const MIN = 0, MAX = 16;

/* [nom, ce qu'on fait, la cible dont on mesure le haut, « haut » : on attend le haut de la page] */
const CAS = [
  ["pied : Mentions legales", `window.scrollTo(0,document.body.scrollHeight);document.getElementById("footLegal").click()`, "#legalTitle"],
  ["pied : Confidentialite", `window.scrollTo(0,document.body.scrollHeight);document.getElementById("footPrivacy").click()`, "#privacyTitle"],
  ["pied : Accessibilite", `window.scrollTo(0,document.body.scrollHeight);document.getElementById("footAccess").click()`, "#accessibilite"],
  ["pied : Preferences", `window.scrollTo(0,document.body.scrollHeight);document.getElementById("footPrefs").click()`, null],
  ["menu : Mentions legales", `menuOuvrir();document.querySelector('#menuTiroir [data-aller="legal"]').click()`, "#legalTitle"],
  ["menu : Confidentialite", `menuOuvrir();document.querySelector('#menuTiroir [data-aller="privacy"]').click()`, "#privacyTitle"],
  ["menu : Accessibilite", `menuOuvrir();document.querySelector('#menuTiroir [data-aller="access"]').click()`, "#accessibilite"],
  ["onglet Jouer depuis le bas", `window.scrollTo(0,document.body.scrollHeight);document.getElementById("tab-jouer").click()`, null],
  ["onglet Resoudre depuis le bas", `window.scrollTo(0,document.body.scrollHeight);document.getElementById("tab-puzzles").click()`, null],
  ["carte Exercices : l'echiquier", `document.getElementById("tab-puzzles").click();document.getElementById("cardSolvePuzzles").click()`, ".board-side"],
  ["carte Finales : l'echiquier apres le choix d'une finale", `document.getElementById("tab-puzzles").click();document.getElementById("cardSolveEndgames").click();window.scrollTo(0,document.body.scrollHeight);document.getElementById("egChips").children[1].click()`, ".board-side"],
  ["nouvelle partie contre l'ordinateur : l'echiquier", `setMode("play");setupGame();window.scrollTo(0,document.body.scrollHeight);document.getElementById("btnNew").click();setTimeout(()=>{const r=document.getElementById("readyBanner");if(r&&!r.classList.contains("hide"))document.getElementById("readyStart").click();},400)`, ".board-side"],
  ["Apprendre : ouvrir un chapitre", `document.getElementById("tab-apprendre").click();setTimeout(()=>{window.scrollTo(0,document.body.scrollHeight);document.querySelector("#apChemin .ap-chap").click();},700)`, ".board-side"],
  ["accueil : Toutes mes statistiques (menu ouvert en haut)", `setMode("home");window.scrollTo(0,document.body.scrollHeight);document.getElementById("homeStatsBtn").click()`, "#menuStats .stats-cat", "menu"],
  ["carre de notification : Tes parties en cours", `setMode("puzzles");corrRecu([{id:"aaaaaaaaaaaa",s:"jeu",atoi:true,adv:"Lea",cad:7,ech:Date.now()+2*864e5,h:Date.now()}]);window.scrollTo(0,document.body.scrollHeight);document.getElementById("carreParties").click()`, null],
  ["Contre un ami : Mon ami n'a pas de compte", `setMode("friend");amiModeRegler("direct");window.scrollTo(0,document.body.scrollHeight);document.getElementById("btnAmiSansCompte").click()`, null]
];
const STATIQUES = [["/fr/ouvertures/", ".toc a"], ["/fr/lexique/", ".toc a"], ["/fr/apprendre/le-roque", "a[href^='#']"], ["/openings/", ".toc a"]];

(async () => {
  const c = await ouvrir({ largeur: 360, hauteur: 740, pause: 300 });
  const pb = [];
  let n = 0;
  for (const [L, H] of LARGEURS) {
    await c.taille(L, H);
    await c.aller(BASE + "/fr/");
    await c.js(`localStorage.clear();localStorage.setItem("chang64:lang","fr");localStorage.setItem("chang64:compte",JSON.stringify({pseudo:"Moi",cle:"moi",version:1,dev:"abc123",n:0,sync:0}));localStorage.setItem("chang64:progress",JSON.stringify({level:2,solved:20,best:4,rating:850,days:2}));localStorage.setItem("chang64:debut",JSON.stringify({e:6,x:0,f:[0,1,2,3,4,5]}));1`);
    for (const [nom, action, cible, special] of CAS) {
      await c.aller(BASE + "/fr/"); await c.attendre(500);
      await c.js(`(function(){const s=document.createElement("style");s.textContent="#bravo,#bilan{display:none!important}";document.head.appendChild(s);})();1`);
      try { await c.js(`(function(){${action}})();1`); } catch (e) { pb.push(L + " px, " + nom + " : " + e.message.split("\n")[0]); continue; }
      await c.attendre(1700);
      n++;
      const m = await c.js(`(function(){const h=document.querySelector("header").getBoundingClientRect(),c=${cible ? `document.querySelector(${JSON.stringify(cible)})` : "null"};return {hb:Math.round(h.bottom),y:Math.round(scrollY),t:c?Math.round(c.getBoundingClientRect().top):null,pad:getComputedStyle(document.documentElement).scrollPaddingTop};})()`);
      if (special === "menu") { if (m.t === null || m.t < 0 || m.t > 200) pb.push(L + " px, " + nom + " : la premiere categorie est a " + m.t + " px"); continue; }
      if (!cible) { if (m.y !== 0) pb.push(L + " px, " + nom + " : la page n'est pas remontee en haut (defilement " + m.y + " px)"); continue; }
      const ecart = m.t - m.hb;
      /* Une cible deja visible en haut de page (page courte) n'a pas a bouger. */
      if (m.y === 0 && ecart >= MIN) continue;
      if (ecart < MIN) pb.push(L + " px, " + nom + " : la cible est cachee sous l'en-tete de " + (-ecart) + " px");
      else if (ecart > MAX) pb.push(L + " px, " + nom + " : la cible arrive " + ecart + " px sous l'en-tete (en-tete " + m.hb + " px, marge " + m.pad + ")");
    }
    /* Pages statiques : les ancres du sommaire. */
    for (const [page, sel] of STATIQUES) {
      await c.aller(BASE + page); await c.attendre(300);
      const liens = await c.js(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(a=>a.getAttribute("href")).filter(h=>h&&h.charAt(0)==="#"&&h.length>1).slice(0,40)`);
      for (const h of [liens[0], liens[Math.floor(liens.length / 2)], liens[liens.length - 2]].filter(Boolean)) {
        await c.js(`window.scrollTo(0,0);document.querySelector('a[href="${h}"]').click();1`); await c.attendre(900);
        n++;
        const m = await c.js(`(function(){let e=document.querySelector("header");while(e&&!/sticky|fixed/.test(getComputedStyle(e).position))e=e.parentElement;const c=document.getElementById(${JSON.stringify(h.slice(1))});const colle=!!e;return {hb:colle?Math.round(e.getBoundingClientRect().bottom):0,t:c?Math.round(c.getBoundingClientRect().top):null,bas:Math.round(document.documentElement.scrollHeight-scrollY-innerHeight)};})()`);
        if (m.t === null) { pb.push(L + " px, " + page + h + " : ancre sans cible"); continue; }
        const ecart = m.t - m.hb;
        if (ecart < MIN) pb.push(L + " px, " + page + h + " : la cible est cachee sous l'en-tete de " + (-ecart) + " px");
        else if (ecart > MAX + 12 && m.bas > 4) pb.push(L + " px, " + page + h + " : la cible arrive " + ecart + " px sous l'en-tete (" + m.hb + " px)");
      }
    }
  }
  await c.fermer();
  console.log(n + " defilements mesures, largeurs " + LARGEURS.map(x => x[0]).join(", ") + " px");
  if (pb.length) { console.log(pb.length + " ecart(s) :"); for (const p of pb) console.log("  " + p); process.exit(1); }
  console.log("aucun ecart");
})().catch(e => { console.error(e); process.exit(1); });
