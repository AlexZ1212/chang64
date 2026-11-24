/* Mesures a 360 px, dans un vrai navigateur, du reglage « Entrainement »
   (2026-11-24, apprendre.js).

   Usage :  node serveur_local.js 0          (dans une autre fenetre : il dit son port)
            node mesure_entrainement.js http://localhost:<port> [dossier des captures]

   Dans les 10 langues, a 360 x 740 :
   - les reglages de Contre l'ordinateur, interrupteur allume : rien ne deborde,
     le nom de l'interrupteur tient sur une ligne, sa phrase d'aide ne commence
     aucune ligne par « : ; ! ? » ;
   - la fenetre « Pret » qui le rappelle : rien ne deborde ;
   - la partie en cours : la note d'entrainement et « Reprendre le coup » a
     cote d'« Abandonner », les deux boutons sur une ligne chacun. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./tests/outils/chrome_sans_fenetre.js");
const { LANGUES } = require("./langues/registre.js");
const BASE = (process.argv[2] || "http://localhost:8096").replace(/\/$/, "");
const SORTIE = process.argv[3] || path.join(__dirname, "..", "design", "entrainement");
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
    if((r.right>innerWidth+1||r.left<-1)&&!e.closest(".tc-cats,.tc-chips"))pb.push("<"+e.tagName.toLowerCase()+"#"+e.id+"> sort de l'ecran ("+Math.round(r.left)+" a "+Math.round(r.right)+")");
    if(e.children.length===0&&e.textContent.trim()&&e.scrollWidth>e.clientWidth+1&&cs.display!=="inline")pb.push("texte coupe dans <"+e.tagName.toLowerCase()+"#"+e.id+"> « "+e.textContent.trim().slice(0,30)+" »");
  }
  for(const e of (mono?document.querySelectorAll(mono):[])){
    if(e.classList.contains("hide"))continue;
    const cs=getComputedStyle(e),lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.3;
    const r=document.createRange();r.selectNodeContents(e);
    const lignes=new Set([...r.getClientRects()].filter(x=>x.width>1).map(x=>Math.round(x.top)));
    if(lignes.size>1)pb.push("libelle sur deux lignes : « "+e.textContent.trim()+" »");
  }
  return pb;
})`;
const DEBUTS = `(function(sel){
  const pb=[];
  for(const e of document.querySelectorAll(sel)){
    if(e.classList.contains("hide"))continue;
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
  let n = 0;
  for (const lg of LANGUES) {
    const l = lg.code, url = BASE + lg.accueil, ici = l + " ";
    await c.aller(url);
    await c.js(`localStorage.clear();localStorage.setItem("chang64:lang",${JSON.stringify(l)});localStorage.setItem("chang64:entrainement","1");1`);
    await c.aller(url);
    await c.attendre(700);
    /* Les reglages de Contre l'ordinateur. */
    await c.js(`colorMode='w';myColor=W;tcCat='rapid';tcIdx=0;setMode('play');setupGame();(function(){const s=document.getElementById('entrainementSwitch');s.scrollIntoView({block:'center'});})();1`);
    await c.attendre(500);
    const etat = JSON.parse(await c.js(`JSON.stringify({on:document.getElementById('entrainementSwitch').getAttribute('aria-checked'),nom:document.getElementById('entrainementSwitch').textContent,aide:document.getElementById('entrainementAide').textContent,vis:!document.getElementById('entrainementAide').classList.contains('hide')})`));
    n++;
    if (etat.on !== "true" || !etat.vis) pb.push(ici + "reglages : interrupteur pas allume ou aide cachee " + JSON.stringify(etat));
    for (const p of await c.js(CONTROLE + "(\"#settingsPanel\",\"#entrainementSwitch .adapte-texte, #adapteNiveau .adapte-texte\")")) pb.push(ici + "reglages : " + p);
    for (const p of await c.js(DEBUTS + "(\"#entrainementAide\")")) pb.push(ici + "reglages : " + p);
    if (CAPTURES[l]) await c.capture(path.join(SORTIE, "reglages-" + l + ".png"));
    /* La fenetre « Pret ». */
    await c.js(`newGame();window.scrollTo(0,0);1`);
    await c.attendre(500);
    n++;
    const pret = await c.js(`document.getElementById('readySub').textContent`);
    if (!/\|/.test(pret)) pb.push(ici + "Pret : pas de resume « " + pret + " »");
    for (const p of await c.js(CONTROLE + "(\"#readyBanner\",\"#readyStart, #readySettings\")")) pb.push(ici + "Pret : " + p);
    for (const p of await c.js(DEBUTS + "(\"#readySub\")")) pb.push(ici + "Pret : " + p);
    if (CAPTURES[l]) await c.capture(path.join(SORTIE, "pret-" + l + ".png"));
    /* La partie en cours. */
    await c.js(`document.getElementById('readyStart').click();1`);
    await c.attendre(400);
    await c.js(`playUser(game.moves().find(m=>game.uci(m)==='e2e4'));1`);
    await c.attendre(2500);
    await c.js(`(function(){const b=document.getElementById('btnReprendre');b.scrollIntoView({block:'center'});})();1`);
    await c.attendre(400);
    n++;
    const partie = JSON.parse(await c.js(`JSON.stringify({ent:partieEntrainement(),btn:!document.getElementById('btnReprendre').classList.contains('hide'),note:!document.getElementById('entrainementNote').classList.contains('hide')})`));
    if (!partie.ent || !partie.btn || !partie.note) pb.push(ici + "partie : " + JSON.stringify(partie));
    for (const p of await c.js(CONTROLE + "(\"#btnReprendre\",\"#btnReprendre, #btnResign\")")) pb.push(ici + "partie : " + p);
    for (const p of await c.js(CONTROLE + "(\"#entrainementNote\",null)")) pb.push(ici + "partie : " + p);
    for (const p of await c.js(DEBUTS + "(\"#entrainementNote\")")) pb.push(ici + "partie : " + p);
    if (CAPTURES[l]) await c.capture(path.join(SORTIE, "partie-" + l + ".png"));
    if (l === "fr") console.log("  fr : [" + etat.nom.trim() + "] " + etat.aide + " | Pret : " + pret);
  }
  await c.fermer();
  console.log(n + " ecrans mesures (360 x 740), " + LANGUES.length + " langues ; captures dans " + SORTIE);
  if (pb.length) { console.log(pb.length + " defaut(s) :"); for (const p of pb) console.log("  " + p); process.exit(1); }
  console.log("aucun defaut");
})().catch(e => { console.error(e); process.exit(1); });
