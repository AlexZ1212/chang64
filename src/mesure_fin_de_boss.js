/* Mesures a 360 px, dans un vrai navigateur, de la carte de fin d'une partie
   contre un boss (2026-11-23, apprendre.js : bossCarteMontrer).

   Usage :  node serveur_local.js 0          (dans une autre fenetre : il dit son port)
            node mesure_fin_de_boss.js http://localhost:<port> [dossier des captures]

   Dans les 10 langues, a 360 x 740, chaque forme de la carte : victoire,
   premiere defaite, troisieme defaite (qui ouvre la suite), defaite la suite
   deja ouverte, nulle, dernier boss perdu, dernier boss battu. Pour chacune :
   rien ne deborde, aucun libelle de bouton sur deux lignes, aucune ligne qui
   commence par « : ; ! ? », titre, phrase et boutons centres dans la carte,
   et la carte tient sur l'echiquier. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./tests/outils/chrome_sans_fenetre.js");
const { LANGUES } = require("./langues/registre.js");
const BASE = (process.argv[2] || "http://localhost:8096").replace(/\/$/, "");
const SORTIE = process.argv[3] || path.join(__dirname, "..", "design", "apprendre", "fin-de-boss");
const CHAPITRES = require("./chemin/plan.json").chapitres;
const DERNIER = CHAPITRES[CHAPITRES.length - 1];
const BOSS = "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const DEBUT = { e: 6, x: 0, f: [0, 1, 2, 3, 4, 5] };
const chemin = (b, tous) => ({ v: 2, o: [], p: { x: 1 }, c: tous
  ? Object.fromEntries(CHAPITRES.slice(1).map(c => [c, { e: 5, x: 0, f: c === DERNIER ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5] }]))
  : { regles: Object.assign({ e: 5, x: 0, f: [0, 1, 2, 3, 4] }, b ? { b: b } : {}) } });
/* nom, progression de depart, chapitre du boss, issue */
const CAS = [
  ["victoire", chemin(0), "regles", "win"],
  ["defaite-1", chemin(0), "regles", "lose"],
  ["defaite-3", chemin(2), "regles", "lose"],
  ["defaite-suite-ouverte", chemin(3), "regles", "lose"],
  ["nulle", chemin(0), "regles", "draw"],
  ["dernier-perdu", chemin(0, true), DERNIER, "lose"],
  ["dernier-battu", chemin(0, true), DERNIER, "win"],
];
const CAPTURES = { fr: 1, de: 1, ru: 1, pt: 1 };

/* Dans la page : ce qui deborde dans un bloc ; mono : les elements dont le texte doit tenir sur une ligne. */
const CONTROLE = `(function(sel, mono){
  const pb=[], racine=document.querySelector(sel);
  if(!racine)return ["bloc absent : "+sel];
  if(document.documentElement.scrollWidth>innerWidth+1)pb.push("la page deborde en largeur ("+document.documentElement.scrollWidth+" px)");
  for(const e of [racine].concat([...racine.querySelectorAll("*")])){
    const r=e.getBoundingClientRect();
    if(r.width<=1||r.height<=1)continue;
    const cs=getComputedStyle(e);
    if(cs.visibility==="hidden"||cs.display==="none")continue;
    if(r.right>innerWidth+1||r.left<-1)pb.push("<"+e.tagName.toLowerCase()+"#"+e.id+"> sort de l'ecran ("+Math.round(r.left)+" a "+Math.round(r.right)+")");
    if(e.children.length===0&&e.textContent.trim()&&e.scrollWidth>e.clientWidth+1&&cs.display!=="inline")pb.push("texte coupe dans <"+e.tagName.toLowerCase()+"#"+e.id+"> « "+e.textContent.trim().slice(0,30)+" »");
    if(mono&&e.matches(mono)){const lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.3;if(r.height>lh*1.7+parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom))pb.push("libelle sur deux lignes : « "+e.textContent.trim()+" »");}
  }
  return pb;
})`;
/* Jamais « : ; ! ? » seul en debut de ligne (regle d'Alexandre). */
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
/* Centre : chaque ligne de texte et chaque bouton a la meme marge a gauche et a droite de la carte. */
const CENTRE = `(function(){
  const pb=[], k=document.querySelector("#resultBanner .result-card").getBoundingClientRect();
  const voir=(e,quoi)=>{
    const rs=[...(()=>{const r=document.createRange();r.selectNodeContents(e);return r.getClientRects();})()];
    for(const r of rs){if(r.width<2)continue;const g=r.left-k.left,d=k.right-r.right;if(Math.abs(g-d)>3)pb.push(quoi+" pas centre ("+Math.round(g)+" / "+Math.round(d)+")");}
  };
  for(const id of ["resultTitle","resultSub"]){const e=document.getElementById(id);if(e.textContent.trim())voir(e,id);}
  for(const id of ["resultNew","resultAnalyse","resultClose"]){const e=document.getElementById(id);if(e.classList.contains("hide"))continue;
    const r=e.getBoundingClientRect(),g=r.left-k.left,d=k.right-r.right;if(Math.abs(g-d)>3)pb.push(id+" pas centre dans la carte ("+Math.round(g)+" / "+Math.round(d)+")");voir(e,id+" (texte)");}
  const f=document.querySelector(".board-frame")||document.getElementById("resultBanner").parentElement, F=f.getBoundingClientRect();
  if(k.top<F.top-1||k.bottom>F.bottom+1)pb.push("la carte deborde de l'echiquier ("+Math.round(k.top)+"-"+Math.round(k.bottom)+" pour "+Math.round(F.top)+"-"+Math.round(F.bottom)+")");
  return pb;
})()`;

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const c = await ouvrir({ largeur: 360, hauteur: 740, pause: 300 });
  const pb = [];
  let n = 0;
  for (const lg of LANGUES) {
    const l = lg.code, url = BASE + lg.accueil;
    for (const [nom, ch0, ch, issue] of CAS) {
      await c.aller(url);
      await c.js(`localStorage.clear();localStorage.setItem("chang64:lang",${JSON.stringify(l)});localStorage.setItem("chang64:debut",${JSON.stringify(JSON.stringify(DEBUT))});` +
        `localStorage.setItem("chang64:chemin",${JSON.stringify(JSON.stringify(ch0))});1`);
      await c.aller(url);
      await c.attendre(700);
      await c.js(`cheminPret(true).then(()=>{cheminLancerPartie(${JSON.stringify(ch)},${JSON.stringify(BOSS)},1);return 1})`);
      await c.attendre(500);
      await c.js(`(function(){const g=new Game(gameStartFen);for(const u of ['e2e4','e7e5','g1f3','b8c6']){g.makeMove(g.moves().find(x=>g.uci(x)===u));}game=g;gameUci=['e2e4','e7e5','g1f3','b8c6'];` +
        /* Le sous-titre de la partie (montre par la nulle et le dernier boss perdu) : une phrase longue du site, pour charger la carte. */
        `resigned=${issue === "win" ? "B" : issue === "lose" ? "W" : "null"};resultInfo={kind:'${issue}',title:${issue === "draw" ? "t('Draw')" : issue === "lose" ? "t('You resign')" : "''"},` +
        `sub:t('Training game: it counts for neither your Elo nor your badges.')};gameSaved=false;resultDismissed=false;render();renderResult(true);})();1`);
      await c.attendre(500);
      await c.js(`(function(){try{bravoFermer();}catch(e){}bravoFile=[];const a=document.getElementById("objAnnonce");if(a)a.remove();window.scrollTo(0,0);})();1`);
      await c.attendre(500);
      const etat = await c.js(`JSON.stringify({actif:bossCarteActive(),vis:!document.getElementById("resultBanner").classList.contains("hide"),b1:document.getElementById("resultNew").textContent,b2:document.getElementById("resultAnalyse").textContent,lien:document.getElementById("resultClose").textContent,titre:document.getElementById("resultTitle").textContent,sous:document.getElementById("resultSub").textContent})`);
      const e = JSON.parse(etat);
      n++;
      const ici = l + " " + nom;
      if (!e.actif || !e.vis) { pb.push(ici + " : la carte du boss n'est pas la " + etat); continue; }
      if (!e.titre.trim()) pb.push(ici + " : pas de titre");
      for (const p of await c.js(CONTROLE + "(\"#resultBanner .result-card\",\"#resultNew, #resultAnalyse, #resultClose\")")) pb.push(ici + " : " + p);
      for (const p of await c.js(DEBUTS + "(\"#resultTitle, #resultSub\")")) pb.push(ici + " : " + p);
      for (const p of await c.js(CENTRE)) pb.push(ici + " : " + p);
      if (CAPTURES[l]) await c.capture(path.join(SORTIE, nom + "-" + l + ".png"));
      if (l === "fr") console.log("  " + nom + " : " + e.titre + " | " + e.sous + " | [" + e.b1 + "] [" + e.b2 + "] " + e.lien);
    }
  }
  await c.fermer();
  console.log(n + " cartes mesurees (360 x 740), " + LANGUES.length + " langues ; captures dans " + SORTIE);
  if (pb.length) { console.log(pb.length + " defaut(s) :"); for (const p of pb) console.log("  " + p); process.exit(1); }
  console.log("aucun defaut");
})().catch(e => { console.error(e); process.exit(1); });
