/* Mesures a 360 px, dans un vrai navigateur, de la fiche privee (2026-11-24).

   Usage :  node serveur_local.js 0          (dans une autre fenetre : il dit son port)
            node mesure_fiche_privee.js http://localhost:<port> [dossier des captures]

   Dans les 10 langues, a 360 x 740 : l'interrupteur de Mon compte (son nom sur
   une ligne, la phrase pour les parents sans ligne qui commence par
   « : ; ! ? »), et la fiche d'un membre prive vue par un autre (le message,
   centre, rien qui deborde). Le compte est simule dans la page : aucun appel
   au serveur. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./tests/outils/chrome_sans_fenetre.js");
const { LANGUES } = require("./langues/registre.js");
const BASE = (process.argv[2] || "http://localhost:8096").replace(/\/$/, "");
const SORTIE = process.argv[3] || path.join(__dirname, "..", "design", "fiche-privee");
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
    if(r.right>innerWidth+1||r.left<-1)pb.push("<"+e.tagName.toLowerCase()+"#"+e.id+"> sort de l'ecran");
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
  let n = 0;
  for (const lg of LANGUES) {
    const l = lg.code, url = BASE + lg.accueil, ici = l + " ";
    await c.aller(url);
    await c.js(`localStorage.clear();localStorage.setItem("chang64:lang",${JSON.stringify(l)});1`);
    await c.aller(url);
    await c.attendre(700);
    await c.js(`cp={pseudo:'EssaiLocal',pays:'',prive:1,sync:Date.now()};cpEtatSync='ok';menuOuvrir();menuVue('compte');cpVue('connecte');document.getElementById('cpPrive').scrollIntoView({block:'center'});1`);
    await c.attendre(600);
    n++;
    for (const p of await c.js(CONTROLE + "(\"#cpPrive\",\"#cpPrive .adapte-texte\")")) pb.push(ici + "Mon compte : " + p);
    for (const p of await c.js(CONTROLE + "(\"#cpPriveAide\",null)")) pb.push(ici + "Mon compte : " + p);
    for (const p of await c.js(DEBUTS + "(\"#cpPriveAide\")")) pb.push(ici + "Mon compte : " + p);
    if (CAPTURES[l]) await c.capture(path.join(SORTIE, "compte-" + l + ".png"));
    await c.js(`window.fetch=u=>String(u).includes('/api/compte/profil')?Promise.resolve({status:403,ok:false,json:()=>Promise.resolve({erreur:'prive'})}):Promise.reject(new Error('non'));cppCache={};cppOuvrir('Lea');1`);
    await c.attendre(700);
    n++;
    const txt = await c.js(`document.getElementById('cpProfilContenu').textContent`);
    if (!/\S/.test(txt)) pb.push(ici + "fiche : vide");
    for (const p of await c.js(CONTROLE + "(\"#cpProfilContenu\",\".cpp-fermer\")")) pb.push(ici + "fiche : " + p);
    for (const p of await c.js(DEBUTS + "(\"#cpProfilContenu .cp-note\")")) pb.push(ici + "fiche : " + p);
    if (CAPTURES[l]) await c.capture(path.join(SORTIE, "fiche-" + l + ".png"));
  }
  await c.fermer();
  console.log(n + " ecrans mesures (360 x 740), " + LANGUES.length + " langues ; captures dans " + SORTIE);
  if (pb.length) { console.log(pb.length + " defaut(s) :"); for (const p of pb) console.log("  " + p); process.exit(1); }
  console.log("aucun defaut");
})().catch(e => { console.error(e); process.exit(1); });
