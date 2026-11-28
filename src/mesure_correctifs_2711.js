/* Mesures a 360 px, dans un vrai navigateur, du lot de correctifs du 27/11
   (captures de l'iPhone d'Alexandre, design/correctifs-2811/liste.md).

   Usage :  node serveur_local.js 0          (dans une autre fenetre : il dit son port)
            node mesure_correctifs_2711.js http://localhost:<port> [points] [dossier des captures]
            points : liste separee par des virgules (ex. 14,13), tous par defaut.

   Chaque point est mesure dans les 10 langues, a 360 x 740, deux fois : avec
   la police telle quelle, puis elargie (letter-spacing .05em), parce que
   Safari sur iPhone dessine plus large que Chrome. Aucun debordement, aucun
   bouton ni nombre sur deux lignes, aucune ligne qui commence par « : ; ! ? ».
   Les captures (francais, police elargie) vont dans design/correctifs-2811/apres. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./tests/outils/chrome_sans_fenetre.js");
const { LANGUES } = require("./langues/registre.js");
const BASE = (process.argv[2] || "http://localhost:8096").replace(/\/$/, "");
const QUELS = process.argv[3] && process.argv[3] !== "tous" ? process.argv[3].split(",") : null;
const SORTIE = process.argv[4] || path.join(__dirname, "..", "design", "correctifs-2811", "apres");

/* Outils evalues dans la page. */
const OUTILS = `window.__m={
  deborde(sel, sauf){
    const pb=[], racine=document.querySelector(sel);
    if(!racine)return ["absent : "+sel];
    if(document.documentElement.scrollWidth>innerWidth+1)pb.push("la page deborde en largeur ("+document.documentElement.scrollWidth+" px)");
    for(const e of [racine].concat([...racine.querySelectorAll("*")])){
      const r=e.getBoundingClientRect();
      if(r.width<=1||r.height<=1)continue;
      const cs=getComputedStyle(e);
      if(cs.visibility==="hidden"||cs.display==="none"||e.closest(".hide"))continue;
      if(sauf&&e.closest(sauf))continue;
      if(r.right>innerWidth+1||r.left<-1)pb.push("<"+e.tagName.toLowerCase()+"."+e.className+"> sort de l'ecran ("+Math.round(r.left)+" a "+Math.round(r.right)+")");
      if(e.children.length===0&&e.textContent.trim()&&e.scrollWidth>e.clientWidth+1&&cs.display!=="inline"&&cs.overflow!=="visible")pb.push("texte coupe dans <"+e.tagName.toLowerCase()+"."+e.className+"> « "+e.textContent.trim().slice(0,30)+" »");
      /* Un enfant qui sort de son parent a bord (case, bouton). */
      const p=e.parentElement;
      if(p&&e.children.length===0&&e.textContent.trim()){const rp=p.getBoundingClientRect();if(r.right>rp.right+1||r.left<rp.left-1)pb.push("« "+e.textContent.trim().slice(0,20)+" » sort de sa case <"+p.tagName.toLowerCase()+"."+p.className+">");}
    }
    return pb;
  },
  uneLigne(sel){
    const pb=[];
    for(const e of document.querySelectorAll(sel)){
      if(e.closest(".hide")||!e.getClientRects().length)continue;
      const r=document.createRange();r.selectNodeContents(e);
      const lignes=new Set([...r.getClientRects()].filter(x=>x.width>1).map(x=>Math.round(x.top/3)));
      if(lignes.size>1)pb.push("sur deux lignes : « "+e.textContent.trim().slice(0,40)+" »");
    }
    return pb;
  },
  debuts(sel){
    const pb=[];
    for(const e of document.querySelectorAll(sel)){
      if(e.closest(".hide"))continue;
      const tw=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n,haut=null;
      while((n=tw.nextNode())){
        for(let i=0;i<n.length;i++){
          const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+1);const b=r.getBoundingClientRect();
          if(!b.width&&!b.height)continue;
          if(haut===null||b.top>haut+4){haut=b.top;if(/[:;!?»%]/.test(n.data[i]))pb.push("ligne qui commence par « "+n.data[i]+" » dans « "+e.textContent.trim().slice(0,40)+" »");}
        }
      }
    }
    return pb;
  },
  /* Un mot coupe par un trait d'union de cesure (hyphens:auto). */
  cesures(sel){
    const pb=[];
    for(const e of document.querySelectorAll(sel)){
      if(e.closest(".hide")||!e.getClientRects().length)continue;
      const tw=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;
      while((n=tw.nextNode())){
        const mots=n.data.split(/(\\s+)/);let k=0;
        for(const m of mots){
          if(m.trim().length>1){
            const r=document.createRange();r.setStart(n,k);r.setEnd(n,k+m.length);
            const tops=new Set([...r.getClientRects()].filter(x=>x.width>0).map(x=>Math.round(x.top)));
            if(tops.size>1)pb.push("mot coupe : « "+m+" »");
          }
          k+=m.length;
        }
      }
    }
    return pb;
  }
};1`;
const ELARGIR = `(function(){let s=document.getElementById("__elargi");if(!s){s=document.createElement("style");s.id="__elargi";document.head.appendChild(s);}s.textContent="*{letter-spacing:.05em!important}";return 1})()`;

/* Chaque point : prepare(c, l) met la page dans l'etat voulu ; controle(c, l)
   rend la liste des problemes ; capture = selecteur a amener a l'ecran. */
const POINTS = {
  "14": {
    async prepare(c) {
      await c.js(`setMode('puzzles',{screen:'daily'});1`);
      await c.attendre(1800);
      await c.js(`document.getElementById('dailyChallengeBlock').classList.remove('hide');document.getElementById('exSignaler').classList.remove('hide');document.getElementById('exSignaler').scrollIntoView({block:'center'});1`);
      await c.attendre(300);
    },
    async controle(c) {
      const pb = [];
      const ordre = await c.js(`(function(){const a=document.getElementById('btnShareDaily').getBoundingClientRect(),s=document.getElementById('btnSignaler').getBoundingClientRect();return s.top>=a.bottom})()`);
      if (!ordre) pb.push("« Signaler cet exercice » n'est pas sous les boutons de partage");
      pb.push(...await c.js(`__m.uneLigne("#btnShareDaily, #btnChallengeDaily, #btnSignaler")`));
      pb.push(...await c.js(`__m.deborde("#dailyChallengeBlock")`), ...await c.js(`__m.deborde("#exSignaler")`));
      return pb;
    },
    capture: "#exSignaler"
  },
  "13": {
    /* De gros chiffres partout : 9999 resolus, record 1234, 5/5 finales, 114/286 badges, 1000 jours. */
    async prepare(c) {
      await c.js(`ensureProgFields();prog.rating=2345;prog.solved=12345;prog.best=1234;prog.rushBest=123;prog.coordBest=12345;prog.days=1000;
        prog.endgames={kq:1,kr:1,krr:1,kbn:1,kp:1};const vis=BADGES.filter(bxVisible);prog.badges=vis.slice(0,114).map(x=>x.id);saveProg();menuOuvrir();menuVue('stats');1`);
      await c.attendre(1500);
      await c.js(`document.querySelector('#menuStats .menu-tuiles.trois').scrollIntoView({block:'center'});1`);
    },
    async controle(c) {
      const pb = [];
      pb.push(...await c.js(`__m.deborde("#menuStats", ".defile")`));
      pb.push(...await c.js(`__m.uneLigne("#menuStats .menu-tuile b")`));
      /* Le chiffre tient dans sa case, marges comprises. */
      pb.push(...await c.js(`[...document.querySelectorAll('#menuStats .menu-tuile b')].filter(b=>{const r=b.getBoundingClientRect(),p=b.parentElement.getBoundingClientRect();const rg=document.createRange();rg.selectNodeContents(b);const t=rg.getBoundingClientRect();return t.right>p.right-6||t.left<p.left+6}).map(b=>"chiffre hors de sa case : "+b.textContent)`));
      return pb;
    },
    capture: "#menuStats .menu-tuiles.trois"
  }
};

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const c = await ouvrir({ largeur: 360, hauteur: 740, pause: 300 });
  const pb = [];
  const noms = QUELS || Object.keys(POINTS);
  for (const nom of noms) {
    const P = POINTS[nom];
    if (!P) { pb.push("point inconnu : " + nom); continue; }
    for (const lg of LANGUES) {
      const l = lg.code, url = BASE + lg.accueil;
      for (const elargi of [false, true]) {
        await c.aller(url);
        await c.js(`localStorage.clear();localStorage.setItem("chang64:lang",${JSON.stringify(l)});1`);
        await c.aller(url);
        await c.attendre(700);
        await c.js(OUTILS);
        if (elargi) await c.js(ELARGIR);
        await P.prepare(c, l);
        await c.js(OUTILS);
        for (const p of await P.controle(c, l)) pb.push(nom + " " + l + (elargi ? " (elargie) " : " ") + ": " + p);
        if (elargi && (l === "fr" || (P.langues || []).includes(l))) {
          if (P.capture) await c.js(`(function(){const e=document.querySelector(${JSON.stringify(P.capture)});if(e)e.scrollIntoView({block:'center'});return 1})()`);
          await c.attendre(300);
          await c.capture(path.join(SORTIE, nom + "-" + l + ".png"));
        }
      }
    }
    console.log("point " + nom + " mesure");
  }
  await c.fermer();
  console.log(pb.length ? pb.join("\n") : "Aucun probleme.");
  console.log("\n" + pb.length + " probleme(s).");
  process.exit(pb.length ? 1 : 0);
})();
