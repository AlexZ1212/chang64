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
  },
  "21": {
    /* Une vraie lecon d'Apprendre : l'etape en cours marquee faite, comme
       juste apres sa reussite. Le chiffre doit etre invisible sous la coche. */
    async prepare(c) {
      await c.js(`cheminActiver('regles');lecon.e=2;lecon.x=0;setMode('debut');1`);
      await c.attendre(1500);
      await c.js(`(function(){const p=document.getElementById('debutPas');let b=p&&p.querySelector('button[aria-current="step"]');if(!b&&p)b=p.querySelector('button');if(b)b.classList.add('fait');return 1})()`);
      await c.attendre(300);
    },
    async controle(c) {
      return await c.js(`(function(){const p=document.getElementById('debutPas');const b=p&&p.querySelector('button.fait[aria-current="step"]');
        if(!b)return ["pas d'etape en cours dans la lecon"];
        const col=getComputedStyle(b).color;return /rgba\\(0, 0, 0, 0\\)|transparent/.test(col)?[]:["chiffre visible sous la coche ("+col+")"];})()`);
    },
    capture: "#debutPas",
    seule: true
  },
  "20": {
    async prepare(c) {
      await c.js(`objAnnoncer("objectif",t("Goal reached!"),t("{n} puzzles solved today. Come back tomorrow to keep going.",{n:3}));1`);
      await c.attendre(1400);
    },
    async controle(c) {
      const pb = [];
      const r = await c.js(`(function(){const p=document.querySelector('#objAnnonce .obj-pastille');if(!p)return "pas d'annonce";const a=getComputedStyle(p,'::after'),cs=getComputedStyle(p);
        return {fond:cs.backgroundImage,couleur:cs.backgroundColor,coche:a.maskImage||a.webkitMaskImage,svg:getComputedStyle(p.querySelector('svg')).display}})()`);
      if (typeof r === "string") return [r];
      if (r.fond !== "none") pb.push("la pastille garde son degrade : " + r.fond);
      if (!/svg/.test(r.coche || "")) pb.push("pas de coche commune");
      if (r.svg !== "none") pb.push("l'ancienne coche fine est encore dessinee");
      pb.push(...await c.js(`__m.deborde("#objAnnonce")`), ...await c.js(`__m.debuts("#objAnnonce")`));
      return pb;
    },
    capture: "#objAnnonce"
  },
  "1": {
    async prepare(c, l, elargi) {
      await c.js(`ensureProgFields();prog.solved=53;prog.rating=1604;prog.days=11;saveProg();1`);
      await c.aller(BASE + (l === "en" ? "/" : "/" + l + "/"));
      await c.attendre(1200);
      await c.js(OUTILS);
      if (elargi) await c.js(ELARGIR);
      await c.js(`document.getElementById('homeStrip').scrollIntoView({block:'center'});1`);
      await c.attendre(400);
    },
    async controle(c) {
      const pb = [];
      pb.push(...await c.js(`__m.deborde("#homeProgressPanel")`));
      pb.push(...await c.js(`__m.cesures("#homeStrip .stat span, #homeStrip .stat em")`));
      pb.push(...await c.js(`__m.uneLigne("#homeStrip .stat b, #homeStatsBtn")`));
      pb.push(...await c.js(`[...document.querySelectorAll('#homeStrip .stat span,#homeStrip .stat em')].flatMap(e=>{const cs=getComputedStyle(e),f=parseFloat(cs.fontSize),lh=parseFloat(cs.lineHeight);const r=[];if(f<8)r.push("libelle trop petit ("+f+" px) : "+e.textContent);if(lh>f*1.3)r.push("interligne "+lh+" px pour "+f+" px : "+e.textContent);return r;})`));
      return pb;
    },
    capture: "#homeProgressPanel",
    langues: ["de"]
  },
  "8": {
    /* Le clavier de l'iPhone se simule : visualViewport ramene a 380 px de
       haut (le clavier prend le reste). Le champ « Chercher un membre » est
       pose au bas du classement, comme pour un membre connecte. */
    async prepare(c) {
      await c.js(`(async function(){cp={pseudo:"Testeur",jeton:"x"};menuOuvrir();menuVue('joueurs');await new Promise(r=>setTimeout(r,4000));
        const v=document.getElementById('menuJoueursVue');if(!document.getElementById('cpjCherche')){v.insertAdjacentHTML('beforeend','<label class="cp-champ cpj-cherche" for="cpjCherche"><span>Chercher un membre</span><input type="search" id="cpjCherche"></label><ul class="cpj-liste cpj-trouves" id="cpjTrouves"></ul>');}
        v.scrollTop=v.scrollHeight;return 1})()`);
      await c.js(`Object.defineProperty(window,'visualViewport',{configurable:true,value:{height:380,width:360,offsetTop:0,offsetLeft:0,addEventListener(){}}});document.getElementById('cpjCherche').focus();1`);
      await c.attendre(700);
    },
    async controle(c) {
      const r = await c.js(`(function(){const e=document.getElementById('cpjCherche');if(!e)return "pas de champ";const r=e.getBoundingClientRect(),l=e.closest('label').getBoundingClientRect();return {haut:Math.round(l.top),bas:Math.round(r.bottom),actif:document.activeElement===e}})()`);
      if (typeof r === "string") return [r];
      const pb = [];
      if (!r.actif) pb.push("le champ n'a pas la main");
      if (r.haut < 0 || r.bas > 380 - 150) pb.push("champ cache par le clavier (titre a " + r.haut + " px, bas du champ a " + r.bas + " px ; visible jusqu'a 380)");
      return pb;
    },
    seule: true
  },
  "2": {
    /* La fenetre Felicitations d'un badge : a la fin de l'arrivee, la grande
       medaille sort de la 3D (.bx-pose). Puis une passe sur toutes les
       medailles : chacune a son dessin, et il n'est pas vide une fois peint. */
    async prepare(c) {
      await c.js(`(function(){ensureProgFields();const b=BADGES.find(x=>x.id==='ex_tetu')||BADGES[0];prog.badges=[b.id];bravoFile=[b];bravoTenter();return 1})()`);
      await c.attendre(2200);
    },
    async controle(c) {
      const pb = [];
      const pose = await c.js(`(function(){const p=document.querySelector('#bravo .bx-piece3d');if(!p||document.getElementById('bravo').hidden)return "fenetre fermee";return p.classList.contains('bx-pose')?"ok":"pas posee ("+getComputedStyle(p).transform+")"})()`);
      if (pose !== "ok") pb.push("grande medaille : " + pose);
      const vides = await c.js(`(function(){const out=[];for(const b of BADGES){const md=bxMedailles&&bxMedailles[b.id];if(!md||!md[1]){out.push(b.id+" sans dessin");continue;}
        const d=document.createElement('div');d.style.cssText='position:fixed;left:0;top:0;width:130px;height:130px';d.innerHTML=bxMedaille(b.id,true);document.body.appendChild(d);
        const g=d.querySelector('mask g');const r=g&&g.getBBox?g.getBBox():null;if(!r||r.width<5||r.height<5)out.push(b.id+" dessin vide");d.remove();}return out})()`);
      pb.push(...vides);
      return pb;
    },
    capture: "#bravo .bravo-fenetre",
    seule: true
  },
  "17": {
    async prepare(c) {
      await c.js(`setMode('puzzles',{screen:'puzzles'});1`); await c.attendre(1500);
      await c.js(`beginCoordFlow();1`); await c.attendre(600);
      await c.js(`document.querySelector('#readySide [data-v="b"]').click();1`); await c.attendre(300);
    },
    async controle(c) {
      const r = await c.js(`(function(){const champ=document.getElementById('coordSideChamp');const vis=e=>e&&e.getClientRects().length>0&&!e.closest('.hide');
        return {panneau:vis(champ),fenetre:vis(document.getElementById('readySide')),flipped:flipped,noirs:document.querySelector('#coordSide [data-v="b"]').getAttribute('aria-pressed')}})()`);
      const pb = [];
      if (r.panneau) pb.push("le choix est encore sous l'echiquier");
      if (!r.fenetre) pb.push("pas de choix dans la fenetre");
      if (!r.flipped) pb.push("l'echiquier ne s'est pas retourne");
      if (r.noirs !== "true") pb.push("le choix n'est pas garde pour le depart");
      pb.push(...await c.js(`__m.uneLigne("#readySide button")`));
      return pb;
    },
    capture: "#readySide"
  },
  "19": {
    /* Toutes les rangees .defile visibles, defilees au milieu : le degrade de
       chaque bord couvre la rangee jusqu'au bord (cadre compris) et sur toute
       la hauteur de ce qui defile, dans la couleur du fond. */
    async prepare(c) {
      await c.js(`(function(){const now=Date.now();ensureProgFields();prog.mistakeQueue=['Knight fork','Back-rank mate','Mate in three','Double attack','Deflection','Skewer','Pin','Discovered attack'].map((th,i)=>({id:'p'+(101+i),theme:th,ts:now,box:1,due:now-1}));saveProg();return 1})()`);
    },
    async controle(c) {
      const pb = [];
      const DEFILER = `(function(){for(const env of document.querySelectorAll('.defile')){const row=env.firstElementChild;if(!row)continue;row.scrollLeft=(row.scrollWidth-row.clientWidth)/2;if(typeof defileMaj==='function')defileMaj(env);}return new Promise(r=>setTimeout(()=>r(1),400))})()`;
      const VERIF = `(function(){const pb=[];
        for(const env of document.querySelectorAll('.defile')){
          const row=env.firstElementChild;if(!row||!env.getClientRects().length||env.closest('.hide'))continue;
          const r=env.getBoundingClientRect();if(r.width<2)continue;
          if(row.scrollWidth<=row.clientWidth+1)continue;
                    const rs=getComputedStyle(row),nom=(env.id||env.className);
          for(const cote of ['::before','::after']){
            const p=getComputedStyle(env,cote);
            if(p.opacity!=='1'){pb.push(nom+cote+" : degrade invisible alors que la rangee defile");continue;}
            const bord=parseFloat(cote==='::before'?rs.borderLeftWidth:rs.borderRightWidth);
            const pos=parseFloat(cote==='::before'?p.left:p.right);
            if(pos>bord+.1)pb.push(nom+cote+" : un jour de "+(pos-bord)+" px au bord");
            const haut=parseFloat(p.top),bas=parseFloat(p.bottom);
            const kids=[...row.children].map(k=>k.getBoundingClientRect()).filter(k=>k.height>0);
            const top=Math.min(...kids.map(k=>k.top))-r.top,bot=r.bottom-Math.max(...kids.map(k=>k.bottom));
            if(haut>top+.5||bas>bot+.5)pb.push(nom+cote+" : le degrade ne couvre pas toute la hauteur (haut "+haut+"/"+top.toFixed(1)+", bas "+bas+"/"+bot.toFixed(1)+")");
            const rad=parseFloat(p.borderTopLeftRadius||0)+parseFloat(p.borderTopRightRadius||0);
            const radRow=parseFloat(rs.borderTopLeftRadius||0);
            if(rad>0&&radRow===0)pb.push(nom+cote+" : degrade arrondi sur une rangee sans cadre");
          }
        }
        return pb;})()`;
      await c.js(`setMode('puzzles',{screen:'puzzles'});1`); await c.attendre(2200);
      await c.js(`renderMistakeQueue();document.getElementById('mistakeSection').scrollIntoView({block:'center'});1`); await c.attendre(500);
      await c.js(DEFILER);pb.push(...(await c.js(VERIF)).map(x => "Resoudre : " + x));
      await c.capture(path.join(SORTIE, "19-erreurs.png"));
      await c.js(`setMode('play');1`); await c.attendre(1200);
      await c.js(DEFILER);pb.push(...(await c.js(VERIF)).map(x => "Jouer : " + x));
      await c.js(`menuOuvrir();menuVue('stats');1`); await c.attendre(1200);
      await c.js(DEFILER);pb.push(...(await c.js(VERIF)).map(x => "Statistiques : " + x));
      return pb;
    },
    seule: true
  }
};

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const c = await ouvrir({ largeur: 360, hauteur: 740, pause: 300 });
  /* Sans fenetre, la page n'a jamais le focus : focus() ne declencherait pas focusin. */
  await c.cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
  const pb = [];
  const noms = QUELS || Object.keys(POINTS);
  for (const nom of noms) {
    const P = POINTS[nom];
    if (!P) { pb.push("point inconnu : " + nom); continue; }
    for (const lg of LANGUES) {
      if (P.seule && lg.code !== "fr") continue;
      const l = lg.code, url = BASE + lg.accueil;
      for (const elargi of [false, true]) {
        await c.aller(url);
        await c.js(`localStorage.clear();localStorage.setItem("chang64:lang",${JSON.stringify(l)});1`);
        await c.aller(url);
        await c.attendre(700);
        await c.js(OUTILS);
        if (elargi) await c.js(ELARGIR);
        await P.prepare(c, l, elargi);
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
