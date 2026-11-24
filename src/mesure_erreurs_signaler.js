/* Mesures a 360 px, dans un vrai navigateur, du bloc « Erreurs a revoir » et
   de « Signaler cet exercice » (2026-11-24).

   Usage :  node serveur_local.js 0          (dans une autre fenetre : il dit son port)
            node mesure_erreurs_signaler.js http://localhost:<port> [dossier des captures]

   Dans les 10 langues, a 360 x 740 : rien ne deborde (hors la rangee des
   pastilles, qui defile exprès), le nombre, son texte et « Revoir » tiennent
   sur une ligne, chaque pastille sur une ligne, aucune ligne qui commence par
   « : ; ! ? » ; puis le lien et le choix des raisons ouvert, les boutons
   Envoyer et Annuler chacun sur une ligne. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./tests/outils/chrome_sans_fenetre.js");
const { LANGUES } = require("./langues/registre.js");
const BASE = (process.argv[2] || "http://localhost:8096").replace(/\/$/, "");
const SORTIE = process.argv[3] || path.join(__dirname, "..", "design", "erreurs-a-revoir");
const CAPTURES = { fr: 1, de: 1, ru: 1, pt: 1 };

const CONTROLE = `(function(sel, mono){
  const pb=[], racine=document.querySelector(sel);
  if(!racine)return ["bloc absent : "+sel];
  if(document.documentElement.scrollWidth>innerWidth+1)pb.push("la page deborde en largeur ("+document.documentElement.scrollWidth+" px)");
  for(const e of [racine].concat([...racine.querySelectorAll("*")])){
    const r=e.getBoundingClientRect();
    if(r.width<=1||r.height<=1)continue;
    const cs=getComputedStyle(e);
    if(cs.visibility==="hidden"||cs.display==="none")continue;
    if(e.closest(".erreurs-pastilles"))continue;
    if(r.right>innerWidth+1||r.left<-1)pb.push("<"+e.tagName.toLowerCase()+"."+e.className+"> sort de l'ecran ("+Math.round(r.left)+" a "+Math.round(r.right)+")");
    if(e.children.length===0&&e.textContent.trim()&&e.scrollWidth>e.clientWidth+1&&cs.display!=="inline")pb.push("texte coupe dans <"+e.tagName.toLowerCase()+"."+e.className+"> « "+e.textContent.trim().slice(0,30)+" »");
  }
  for(const e of (mono?document.querySelectorAll(mono):[])){
    if(e.closest(".hide"))continue;
    const r=document.createRange();r.selectNodeContents(e);
    const lignes=new Set([...r.getClientRects()].filter(x=>x.width>1).map(x=>Math.round(x.top)));
    if(lignes.size>1)pb.push("sur deux lignes : « "+e.textContent.trim()+" »");
  }
  return pb;
})`;
const DEBUTS = `(function(sel){
  const pb=[];
  for(const e of document.querySelectorAll(sel)){
    if(e.closest(".hide"))continue;
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
const FILE = `(function(){const now=Date.now(),J=864e5;ensureProgFields();prog.mistakeQueue=[
  {id:'p101',theme:'Knight fork',ts:now,box:1,due:now-1},{id:'p102',theme:'Knight fork',ts:now,box:4,due:now-1},
  {id:'p103',theme:'Back-rank mate',ts:now,box:1,due:now-1},{id:'p104',theme:'Mate in three',ts:now,box:3,due:now-1},
  {id:'p105',theme:'Double attack',ts:now,box:2,due:now-1},{id:'p106',theme:'Deflection',ts:now,box:4,due:now-1},
  {id:'p107',theme:'Skewer',ts:now,box:4,due:now+5*J},{id:'p108',theme:'Pin',ts:now,box:2,due:now+6*J}];saveProg();})();1`;

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const c = await ouvrir({ largeur: 360, hauteur: 740, pause: 300 });
  const pb = [];
  let n = 0;
  for (const lg of LANGUES) {
    const l = lg.code, url = BASE + lg.accueil, ici = l + " ";
    await c.aller(url);
    await c.js(`localStorage.clear();localStorage.setItem("chang64:lang",${JSON.stringify(l)});1`);
    await c.aller(url);
    await c.attendre(700);
    await c.js(FILE);
    await c.js(`setMode('puzzles',{screen:'puzzles'});1`);
    await c.attendre(2500);
    await c.js(`renderMistakeQueue();document.getElementById('mistakeSection').scrollIntoView({block:'center'});1`);
    await c.attendre(500);
    n++;
    for (const p of await c.js(CONTROLE + "(\"#mistakeSection\",\".erreurs-n, .erreurs-texte b, #btnMistakes, .erreurs-pastille, .erreurs-presque\")")) pb.push(ici + "bloc : " + p);
    for (const p of await c.js(DEBUTS + "(\"#mistakeSection\")")) pb.push(ici + "bloc : " + p);
    /* Le nombre, son texte et « Revoir » sur une meme ligne. */
    const ligne = await c.js(`(function(){const t=[".erreurs-n",".erreurs-texte","#btnMistakes"].map(s=>document.querySelector("#mistakeGrid "+s).getBoundingClientRect());return Math.max(...t.map(r=>r.top))<Math.min(...t.map(r=>r.bottom));})()`);
    if (!ligne) pb.push(ici + "bloc : le nombre, son texte et « Revoir » ne sont pas sur une meme ligne");
    if (CAPTURES[l]) await c.capture(path.join(SORTIE, "bloc-" + l + ".png"));
    /* Signaler : exercice fini, choix ouvert. */
    await c.js(`(function(){puzzle=Object.assign({},puzzle||{},{id:'p5696'});puzzleDone=true;majBoutonSuivant();document.getElementById('btnSignaler').click();})();1`);
    await c.attendre(700);
    await c.js(`document.getElementById('signalerChoix').scrollIntoView({block:'center'});1`);
    await c.attendre(400);
    n++;
    const vis = await c.js(`!document.getElementById('exSignaler').classList.contains('hide')&&!document.getElementById('signalerChoix').classList.contains('hide')`);
    if (!vis) pb.push(ici + "signaler : le choix n'est pas ouvert");
    for (const p of await c.js(CONTROLE + "(\"#exSignaler\",\"#btnSignaler, #signalerEnvoyer, #signalerAnnuler, .signaler-choix label span\")")) pb.push(ici + "signaler : " + p);
    for (const p of await c.js(DEBUTS + "(\"#exSignaler\")")) pb.push(ici + "signaler : " + p);
    if (CAPTURES[l]) await c.capture(path.join(SORTIE, "signaler-" + l + ".png"));
    if (l === "fr") console.log("  fr : " + await c.js(`document.getElementById('mistakeGrid').innerText.replace(/\\n+/g,' / ')`));
  }
  await c.fermer();
  console.log(n + " ecrans mesures (360 x 740), " + LANGUES.length + " langues ; captures dans " + SORTIE);
  if (pb.length) { console.log(pb.length + " defaut(s) :"); for (const p of pb) console.log("  " + p); process.exit(1); }
  console.log("aucun defaut");
})().catch(e => { console.error(e); process.exit(1); });
