/* Mesures a 360 px, dans un vrai navigateur, des ajustements du 24/11/2026.

   Usage :  node serveur_local.js 0          (dans une autre fenetre : il dit son port)
            node mesure_ajustements_2411.js http://localhost:<port> [dossier des captures]

   Dans les 10 langues, a 360 x 740 : le bouton de l'accueil vers Apprendre
   (quatre cas), Contre l'ordinateur (titre, cinq forces sur une ligne qui
   defile, bouton retour), Contre un ami, Travailler un motif (pictos),
   Accessibilite (touches en liste), Inviter sur chang64 (QR code), l'annonce
   de l'objectif du jour, la regle de la correspondance. Rien ne deborde,
   aucun libelle de bouton sur deux lignes, aucune ligne qui commence par
   « : ; ! ? ». */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./tests/outils/chrome_sans_fenetre.js");
const { LANGUES } = require("./langues/registre.js");
const BASE = (process.argv[2] || "http://localhost:8096").replace(/\/$/, "");
const SORTIE = process.argv[3] || path.join(__dirname, "..", "design", "ajustements-2311", "360");
const CAPTURES = { fr: 1, de: 1, ru: 1, pt: 1 };

const CONTROLE = `(function(sel, mono){
  const pb=[], racine=document.querySelector(sel);
  if(!racine)return ["bloc absent : "+sel];
  if(document.documentElement.scrollWidth>innerWidth+1)pb.push("la page deborde en largeur");
  for(const e of [racine].concat([...racine.querySelectorAll("*")])){
    const r=e.getBoundingClientRect();
    if(r.width<=1||r.height<=1)continue;
    const cs=getComputedStyle(e);
    if(cs.visibility==="hidden"||cs.display==="none")continue;
    if((r.right>innerWidth+1||r.left<-1)&&!e.closest(".tc-cats"))pb.push("<"+e.tagName.toLowerCase()+"#"+e.id+"> sort de l'ecran");
    if(e.children.length===0&&e.textContent.trim()&&e.scrollWidth>e.clientWidth+1&&cs.display!=="inline")pb.push("texte coupe « "+e.textContent.trim().slice(0,30)+" »");
  }
  for(const e of (mono?document.querySelectorAll(mono):[])){
    const r=document.createRange();r.selectNodeContents(e);
    if(new Set([...r.getClientRects()].filter(x=>x.width>1).map(x=>Math.round(x.top))).size>1)pb.push("sur deux lignes : « "+e.textContent.trim()+" »");
  }
  return pb;
})`;
const DEBUTS = `(function(sel){
  const pb=[];
  for(const e of document.querySelectorAll(sel)){
    const tw=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n,haut=null;
    while((n=tw.nextNode())){
      for(let i=0;i<n.length;i++){
        const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+1);const b=r.getBoundingClientRect();
        if(!b.width&&!b.height)continue;
        if(haut===null||b.top>haut+4){haut=b.top;if(/[:;!?»]/.test(n.data[i]))pb.push("ligne qui commence par « "+n.data[i]+" » dans « "+e.textContent.trim().slice(0,40)+" »");}
      }
    }
  }
  return pb;
})`;

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const c = await ouvrir({ largeur: 360, hauteur: 740, pause: 300 });
  const pb = [];
  let n = 0, ici = "";
  const verifier = async (nom, sel, mono, debuts) => {
    n++;
    for (const p of await c.js(CONTROLE + "(" + JSON.stringify(sel) + "," + JSON.stringify(mono) + ")")) pb.push(ici + nom + " : " + p);
    if (debuts) for (const p of await c.js(DEBUTS + "(" + JSON.stringify(debuts) + ")")) pb.push(ici + nom + " : " + p);
  };
  for (const lg of LANGUES) {
    const l = lg.code, url = BASE + lg.accueil;
    ici = l + " ";
    const neuf = async avant => { await c.aller(url); await c.js("localStorage.clear();localStorage.setItem('chang64:lang','" + l + "');" + (avant || "") + "1"); await c.aller(url); await c.attendre(700); };
    const cap = async f => { if (CAPTURES[l]) await c.capture(path.join(SORTIE, f + "-" + l + ".png")); };
    /* 1. Accueil : le bouton vers Apprendre, dans ses quatre cas. */
    for (const [cas, avant] of [["debut", ""], ["continuer", "localStorage.setItem('chang64:debut',JSON.stringify({e:3,x:1,f:[0,1,2]}));"],
      ["commencer", "localStorage.setItem('chang64:debut',JSON.stringify({e:6,x:0,f:[0,1,2,3,4,5]}));"],
      ["revoir", "localStorage.setItem('chang64:chemin',JSON.stringify({v:2,c:{},o:[],p:{t:1,n:19,q:19,e:'fin'}}));"]]) {
      await neuf(avant);
      const etat = await c.js("(function(){const h=document.getElementById('heroDebut');return h.dataset.cas+'|'+getComputedStyle(h).visibility})()");
      if (etat !== cas + "|visible") pb.push(ici + "accueil : cas attendu " + cas + ", obtenu " + etat);
      await verifier("accueil (" + cas + ")", ".hero .cta", ".hero .cta .btn");
      if (cas === "commencer") await cap("accueil-commencer");
    }
    /* 2. Contre l'ordinateur : titre, sous-titre, cinq forces sur une ligne qui defile, bouton retour. */
    await c.js("setMode('jouer');document.getElementById('jouerOrdi').click();scrollTo(0,0);1"); await c.attendre(500);
    await verifier("contre l'ordinateur", "#settingsPanel", "#segLevel .seg-nom,#retourEcran,#segColor button", "#ordiSous");
    const rangee = await c.js("(function(){const r=document.getElementById('segLevel');return [r.scrollWidth>r.clientWidth+1?1:0,getComputedStyle(r).overflowX,r.parentElement.className].join(' ')})()");
    if (!/ auto /.test(rangee) || !/defile/.test(rangee)) pb.push(ici + "forces : la rangee ne defile pas (" + rangee + ")");
    if (/^1 /.test(rangee) && !/has-scroll-(right|left)/.test(rangee)) pb.push(ici + "forces : rangee trop longue sans chevron (" + rangee + ")");
    await cap("ordinateur");
    /* 3. Contre un ami (visiteur) : premier bloc et bouton retour. */
    await c.js("setMode('jouer');document.getElementById('jouerAmi').click();scrollTo(0,0);1"); await c.attendre(500);
    await verifier("contre un ami", "#pane-friend", "#retourEcran");
    /* 4. Travailler un motif : pictos, separateur, bouton retour. */
    await c.js("setMode('puzzles');document.getElementById('cardSolveMotifs').click();scrollTo(0,0);1"); await c.attendre(900);
    await verifier("motifs", "#solveMotifsScreen", "#retourEcran,.motif-tuile b");
    await cap("motifs");
    /* 5. Accessibilite : les touches en liste. */
    await c.js("document.getElementById('footAccess').click();1"); await c.attendre(600);
    await verifier("accessibilite", "#kbdHelp", null, "#kbdHelp p");
    await cap("accessibilite");
    /* 6. Inviter sur chang64 : le QR code. */
    await c.js("menuOuvrir();menuVue('inviter');1"); await c.attendre(600);
    await verifier("inviter", "#menuInviterVue", null, "#siteQrNote");
    const qr = await c.js("(function(){const q=document.getElementById('siteQr').getBoundingClientRect();return Math.round(q.width)+'x'+Math.round(q.height)})()");
    const [qw, qh] = qr.split("x").map(Number);
    if (!(qw >= 150 && qw === qh)) pb.push(ici + "QR : taille " + qr);
    await cap("inviter");
    await c.js("menuFermer();1"); await c.attendre(300);
    /* 7. L'annonce de l'objectif atteint. */
    await c.js("objAnnoncer('objectif',t('Goal reached!'),t('{n} puzzles solved today. Come back tomorrow to keep going.',{n:3}));1"); await c.attendre(900);
    await verifier("annonce objectif", "#objAnnonce", null, "#objAnnonce");
    await cap("objectif");
    /* 8. La regle de la correspondance, sous les cadences de Contre un ami. */
    await c.js("document.getElementById('objAnnonce').click();amiModeRegler('direct');directCat=AMI_CORR;directCad=7;directCadencesRendre();1"); await c.attendre(200);
    await verifier("correspondance", "#directCadenceNote", null, "#directCadenceNote");
  }
  await c.fermer();
  console.log(n + " ecrans mesures (360 x 740), " + LANGUES.length + " langues ; captures dans " + SORTIE);
  if (pb.length) { console.log(pb.length + " defaut(s) :"); for (const p of pb) console.log("  " + p); process.exit(1); }
  console.log("aucun defaut");
})().catch(e => { console.error(e); process.exit(1); });
