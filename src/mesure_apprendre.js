#!/usr/bin/env node
/* Mesure de l'onglet Apprendre a 360 px, dans les 10 langues (2026-11-22).

   Usage :  node serveur_local.js 8083      (dans une autre fenetre)
            node mesure_apprendre.js [http://localhost:8083] [dossier des captures]

   Regle d'Alexandre : a 360 px, dans les 10 langues, aucune ligne ne deborde
   et aucun libelle de bouton ne passe sur deux lignes ; une lecon tient sur
   un seul ecran de telephone. jsdom ne met rien en page : cette mesure passe
   par un vrai Chrome, sans fenetre (tests/outils/chrome_sans_fenetre.js). Ce
   n'est pas un test de la suite (il lui faut un serveur et ce Chrome), d'ou
   son nom sans « check_ ».

   Ecrans mesures, par langue : la barre d'onglets, l'accueil dans les trois
   etats du bouton, l'onglet Apprendre (premiere visite et chemin avance),
   CHAQUE exercice de chaque chapitre (consigne, puis message de reussite),
   l'ecran du boss, le test de placement (une position, le resultat) et la
   partie contre le boss (« Reprendre le coup »). */
const path = require("path"), fs = require("fs");
const { ouvrir } = require("./tests/outils/chrome_sans_fenetre.js");
const { CODES } = require("./langues/registre.js");
const BASE = (process.argv[2] || "http://localhost:8083").replace(/\/$/, "");
const CAPTURES = process.argv[3] || "";
const L = 360, H = 740;

/* Dans la page : largeur, hauteur, boutons sur deux lignes, textes coupes. */
const MESURE = `(function(nom){
  const de=document.documentElement, pb=[];
  if(de.scrollWidth>${L}) pb.push(nom+" : la page deborde en largeur ("+de.scrollWidth+" px)");
  const lignes=el=>{const r=document.createRange();r.selectNodeContents(el);return new Set([...r.getClientRects()].filter(x=>x.width>0).map(x=>Math.round(x.top/4))).size;};
  const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=="hidden";};
  for(const b of document.querySelectorAll("button.btn,.tabs button,button.linkbtn,.debut-pas button")){
    if(!visible(b)||!b.textContent.trim())continue;
    if(lignes(b)>1) pb.push(nom+" : bouton sur deux lignes « "+b.textContent.trim()+" »");
    const r=b.getBoundingClientRect();
    if(r.right>${L}+0.5||r.left<-0.5) pb.push(nom+" : bouton hors de l'ecran « "+b.textContent.trim()+" »");
    if(b.scrollWidth>b.clientWidth+1) pb.push(nom+" : libelle coupe « "+b.textContent.trim()+" »");
  }
  for(const e of document.querySelectorAll("#pane-apprendre *, #pane-debut *, .debut-tete *")){
    if(!visible(e))continue;
    const r=e.getBoundingClientRect();
    if(r.right>${L}+0.5) pb.push(nom+" : element hors de l'ecran <"+e.tagName.toLowerCase()+(e.id?"#"+e.id:"")+"> "+Math.round(r.right));
  }
  return {pb:pb.slice(0,6),h:de.scrollHeight,w:de.scrollWidth};
})`;

(async () => {
  const c = await ouvrir({ largeur: L, hauteur: H });
  const tout = [];
  let ecrans = 0, pire = 0;
  const noter = (r, nom, unEcran) => { ecrans++; for (const p of r.pb) tout.push(p); if (unEcran && r.h > H) { tout.push(nom + " : ne tient pas sur un ecran (" + r.h + " px pour " + H + ")"); } if (unEcran) pire = Math.max(pire, r.h); };
  const mesurer = async (nom, unEcran) => noter(await c.js(MESURE + "(" + JSON.stringify(nom) + ")"), nom, unEcran);
  const attendre = ms => c.js("new Promise(r=>setTimeout(r," + ms + "))");
  /* LANGUES=id,pl pour ne remesurer que quelques langues. */
  const voulues = process.env.LANGUES ? process.env.LANGUES.split(",") : CODES;
  for (const l of CODES) {
    if (!voulues.includes(l)) continue;
    const url = BASE + "/" + (l === "en" ? "" : l + "/");
    const poser = async o => {
      await c.aller(url);
      await c.js("localStorage.clear();localStorage.setItem('chang64:prefs',JSON.stringify({anim:false,son:false}));" +
        Object.keys(o).map(k => "localStorage.setItem(" + JSON.stringify(k) + "," + JSON.stringify(JSON.stringify(o[k])) + ");").join("") + "1");
      await c.aller(url);
    };
    /* 1. Premiere visite : accueil, barre, onglet. */
    await poser({});
    await mesurer(l + " accueil (Je debute)");
    const barre = await c.js("(function(){const n=document.getElementById('tabsNav');return n.scrollWidth-n.clientWidth;})()");
    if (barre > 0) tout.push(l + " : la barre d'onglets defile (" + barre + " px de trop)");
    await c.js("document.getElementById('tab-apprendre').click();new Promise(r=>setTimeout(r,700))");
    await mesurer(l + " onglet (premiere visite)");
    if (CAPTURES && (l === "fr" || l === "de" || l === "ru")) await c.capture(path.join(CAPTURES, "onglet-" + l + ".png"), true);
    /* 2. Le test de placement : une position, puis le resultat. */
    await c.js("document.getElementById('apTestGo').click();new Promise(r=>setTimeout(r,900))");
    await mesurer(l + " test, position 1", true);
    /* Apres une reponse : le message, les pastilles, le bouton Suivant. */
    await c.js("(function(){const p=cheminD.placement[0];testReponse(legalCache.find(x=>p.sol.includes(game.uci(x))));})()");
    await mesurer(l + " test, position 1, reponse juste", true);
    if (CAPTURES && l === "fr") await c.capture(path.join(CAPTURES, "test-reponse-fr.png"));
    await c.js("document.getElementById('btnTestSuite').click();new Promise(r=>setTimeout(r,100))");
    await c.js("(function(){const p=cheminD.placement[1];testReponse(legalCache.find(x=>!p.sol.includes(game.uci(x))));})()");
    await mesurer(l + " test, position 2, reponse fausse", true);
    await c.js("testArreter();setMode('apprendre');testLancer();new Promise(r=>setTimeout(r,900))");
    if (CAPTURES && l === "fr") await c.capture(path.join(CAPTURES, "test-position-fr.png"));
    await c.js("(async function(){for(let i=0;i<10&&!test.fin;i++){while(test.occupe)await new Promise(r=>setTimeout(r,60));if(test.fin)break;const p=cheminD.placement[test.i];testReponse(i<6?legalCache.find(x=>p.sol.includes(game.uci(x))):null);await new Promise(r=>setTimeout(r,60));if(i===0||i===6)window.__apres=(window.__apres||0)+1;document.getElementById('btnTestSuite').click();await new Promise(r=>setTimeout(r,80));}})()");
    await mesurer(l + " test, resultat", true);
    if (CAPTURES && (l === "fr" || l === "de")) await c.capture(path.join(CAPTURES, "test-resultat-" + l + ".png"));
    /* 3. Chemin avance : tout est ouvert, chaque exercice de chaque chapitre. */
    await poser({ "chang64:debut": { e: 0, x: 0, f: [0, 1, 2, 3, 4, 5] }, "chang64:chemin": { v: 1, c: { regles: { e: 0, x: 0, f: [0, 1, 2, 3, 4] } }, o: ["debut", "regles", "securite"], p: { t: 1, n: 5, e: "securite" } } });
    await mesurer(l + " accueil (Continuer)");
    await c.js("document.getElementById('tab-apprendre').click();new Promise(r=>setTimeout(r,700))");
    await mesurer(l + " onglet (chemin avance)");
    for (let ch = 0; ch < 3; ch++) {
      await c.js("setMode('apprendre');document.querySelectorAll('#apChemin .ap-chap')[" + ch + "].click();new Promise(r=>setTimeout(r,700))");
      const plan = await c.js("leconEtapes().map(e=>e.exos.length)");
      for (let e = 0; e < plan.length; e++) {
        for (let x = 0; x < Math.max(1, plan[e]); x++) {
          const nom = l + " chapitre " + (ch + 1) + ", etape " + (e + 1) + (plan[e] ? ", exercice " + (x + 1) : " (fin)");
          await c.js("lecon.e=" + e + ";lecon.x=" + x + ";debutCharger();new Promise(r=>setTimeout(r,80))");
          await mesurer(nom, true);
          if (!plan[e]) { if (CAPTURES && l === "fr" && ch === 1) await c.capture(path.join(CAPTURES, "boss-fr.png")); continue; }
          if (CAPTURES && l === "fr" && ch === 1 && e === 1 && x === 0) await c.capture(path.join(CAPTURES, "lecon-roque-fr.png"));
          /* Le message le plus long qu'un coup faux peut afficher, puis la reussite. */
          await c.js("(function(){const ex=leconEtapes()[lecon.e].exos[lecon.x];let long='';for(const k in (ex.faux||{}))if(ex.faux[k].length>long.length)long=ex.faux[k];if(long)debutStatut('lose',long);})()");
          await mesurer(nom + ", coup faux", true);
          await c.js("(async function(){const ex=leconEtapes()[lecon.e].exos[lecon.x];if(ex.avant)await new Promise(r=>setTimeout(r,800));const m=legalCache.find(q=>game.uci(q)===ex.sol[0]);debutEssai(m,ex);await new Promise(r=>setTimeout(r,(ex.suite?ex.suite.length*800:0)+120));})()");
          await mesurer(nom + ", reussi", true);
        }
      }
    }
    /* 4. La partie contre le boss : « Reprendre le coup » a cote d'« Abandonner ». */
    await c.js("cheminActiver('regles');lecon.e=5;lecon.x=0;setMode('debut');new Promise(r=>setTimeout(r,300))");
    await c.js("document.getElementById('btnLeconBoss').click();new Promise(r=>setTimeout(r,700))");
    await mesurer(l + " partie contre le boss");
    if (CAPTURES && l === "fr") await c.capture(path.join(CAPTURES, "partie-boss-fr.png"), true);
    console.log(l + " : mesure faite");
  }
  await c.fermer();
  console.log("\n" + ecrans + " ecrans mesures a " + L + " x " + H + " px, " + (process.env.LANGUES ? process.env.LANGUES.split(",").length : CODES.length) + " langue(s) ; ecran de lecon le plus haut : " + pire + " px.");
  if (tout.length) { console.log(tout.length + " defaut(s) :"); for (const p of tout) console.log("  - " + p); process.exit(1); }
  console.log("Aucun debordement, aucun bouton sur deux lignes, chaque lecon tient sur un ecran.");
})().catch(e => { console.error(e); process.exit(1); });
