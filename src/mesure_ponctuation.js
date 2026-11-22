#!/usr/bin/env node
/* Ponctuation en debut de ligne : mesure dans un vrai navigateur (2026-11-22).

   Usage :  node serveur_local.js 8071      (dans une autre fenetre)
            node mesure_ponctuation.js [http://localhost:8071] [langue=fr] [pages|app|tout]

   Regle d'Alexandre : « : », « ; », « ! », « ? » et « » » ne commencent jamais
   une ligne ; ils restent avec le mot qui les precede. Les textes portent
   pour cela une espace insecable (lier, insecablesFr, ponct), mais une espace
   insecable ne suffit pas partout : le navigateur peut couper apres un dessin
   de piece ou un element en ligne. Seule la mise en page dit ce qui se passe.

   Pour chaque page et chaque largeur d'ecran, on compare la ligne de chaque
   signe a celle de ce qui le precede (lettre, ou element en ligne comme une
   figurine). Dans les langues ou ces signes se collent au mot, on signale
   aussi une espace ordinaire posee devant eux. Ce n'est pas un test de la
   suite : il lui faut un serveur et le Chrome sans fenetre. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./tests/outils/chrome_sans_fenetre.js");
const { LANGUES } = require("./langues/registre.js");
const BASE = (process.argv[2] || "http://localhost:8071").replace(/\/$/, "");
const LANGUE = process.argv[3] || "fr";
const QUOI = process.argv[4] || "tout";
const LARGEURS = [360, 390, 430, 768, 1024, 1366];
const SITE = path.join(__dirname, "site");

/* Dans la page : les signes qui commencent une ligne. */
const DETECTEUR = `(function(francais){
  const out=[],visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
  const bloc=el=>/^(block|flex|grid|list-item|table-cell|table-caption|flow-root)$/.test(getComputedStyle(el).display);
  const atome=el=>/^(svg|img|canvas|video|input|select|textarea)$/i.test(el.tagName)||/^inline-(block|flex|grid)$/.test(getComputedStyle(el).display);
  let avant=null;   /* ce qui precede : {n,i} un caractere, ou {el} un element en ligne */
  let espace=false;
  const rectDe=p=>{if(p.el)return p.el.getBoundingClientRect();const r=document.createRange();r.setStart(p.n,p.i);r.setEnd(p.n,p.i+1);const l=r.getClientRects();return l[l.length-1]||null;};
  const voir=el=>{
    for(const c of el.childNodes){
      if(c.nodeType===3){
        const t=c.nodeValue;
        if(!t)continue;
        const parent=c.parentElement;
        if(!parent||!visible(parent)){continue;}
        for(let i=0;i<t.length;i++){
          const ch=t[i];
          if(/[\\s\\u00a0\\u202f\\u2009]/.test(ch)){espace=true;continue;}
          if(/[;:!?»]/.test(ch)&&avant&&espace){
            const ra=rectDe(avant),rb=rectDe({n:c,i:i});
            if(ra&&rb&&ra.height>0&&rb.height>0&&rb.top>=ra.bottom-2){
              out.push("« "+ch+" » en debut de ligne : « "+((avant.el?"["+avant.el.tagName.toLowerCase()+"."+(avant.el.getAttribute("class")||"")+"]":"")+t.slice(Math.max(0,i-28),i+14)).replace(/\\s+/g," ").trim()+" »");
            }
          }
          if(!francais&&/[;:!?]/.test(ch)&&espace&&i>0&&t[i-1]===" "&&avant&&!avant.el&&/[\\p{L}\\p{N})]/u.test(avant.n.nodeValue[avant.i])&&(i+1>=t.length||/\\s/.test(t[i+1])))
            out.push("espace devant « "+ch+" » : « "+t.slice(Math.max(0,i-28),i+10).replace(/\\s+/g," ").trim()+" »");
          avant={n:c,i:i};espace=false;
        }
      }else if(c.nodeType===1){
        if(/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/.test(c.tagName))continue;
        if(!visible(c))continue;
        if(bloc(c)){avant=null;espace=false;voir(c);avant=null;espace=false;}
        else if(atome(c)){avant={el:c};espace=false;}
        else voir(c);
      }
    }
  };
  voir(document.body);
  return [...new Set(out)].slice(0,12);
})`;

function pagesStatiques(lg) {
  const out = [];
  const racines = lg.code === "en" ? Object.values(lg.dirs) : [lg.code];
  const marcher = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) marcher(p); else if (e.name.endsWith(".html")) out.push("/" + path.relative(SITE, p).replace(/\\/g, "/").replace(/index\.html$/, "").replace(/\.html$/, "")); } };
  for (const r of racines) if (fs.existsSync(path.join(SITE, r))) marcher(path.join(SITE, r));
  /* L'accueil de la langue est l'application, vue a part ; les pages d'exercices se ressemblent toutes. */
  const exos = out.filter(u => /\/(exercices|puzzles|ejercicios|exercicios|aufgaben|esercizi|bulmacalar|zadania|teka-teki)\//.test(u));
  return out.filter(u => u !== lg.accueil && !exos.includes(u)).concat(exos.slice(0, 25));
}

(async () => {
  const lg = LANGUES.find(l => l.code === LANGUE);
  if (!lg) throw new Error("langue inconnue " + LANGUE);
  const c = await ouvrir({ largeur: 360, hauteur: 800, pause: 150 });
  const tout = new Map();
  let mesures = 0;
  const noter = async (nom, l) => { mesures++; for (const p of await c.js(DETECTEUR + "(" + (LANGUE === "fr") + ")")) { const k = p; if (!tout.has(k)) tout.set(k, nom + " a " + l + " px"); } };
  const partout = async nom => { for (const l of LARGEURS) { await c.taille(l, 800); await c.attendre(90); await noter(nom, l); } await c.taille(360, 800); };

  if (QUOI !== "app") {
    const pages = pagesStatiques(lg);
    for (const u of pages) { await c.aller(BASE + u); await partout(u); }
    console.log(pages.length + " pages statiques");
  }
  if (QUOI !== "pages") {
    const url = BASE + lg.accueil;
    const PROG = { level: 3, solved: 128, best: 14, rating: 1012, days: 12, rushBest: 17, coordBest: 23, endgames: { kq: 9 }, eloOrdi: { r: 945, n: 29, pic: 960, h: [[1, 800], [2, 945]] } };
    await c.aller(url);
    await c.js(`localStorage.clear();localStorage.setItem("chang64:lang",${JSON.stringify(LANGUE)});localStorage.setItem("chang64:progress",${JSON.stringify(JSON.stringify(PROG))});localStorage.setItem("chang64:debut",JSON.stringify({e:6,x:0,f:[0,1,2,3,4,5]}));1`);
    await c.aller(url); await c.attendre(700);
    await c.js(`(function(){const s=document.createElement("style");s.textContent="#bravo,#bilan{display:none!important}";document.head.appendChild(s);})();1`);
    const ecran = async (nom, js, pause) => { try { await c.js(js + ";1"); } catch (e) { console.log("  (ecran " + nom + " : " + e.message.split("\n")[0] + ")"); return; } await c.attendre(pause || 450); await partout("app " + nom); };
    await partout("app accueil");
    await ecran("jouer", `document.getElementById("tab-jouer").click()`);
    await ecran("contre l'ordinateur", `setMode("play")`);
    await ecran("contre un ami", `setMode("friend");amiModeRegler("lien")`);
    await ecran("en direct (sans compte)", `amiModeRegler("direct")`);
    await ecran("apprendre", `document.getElementById("tab-apprendre").click()`, 900);
    await ecran("resoudre", `document.getElementById("tab-puzzles").click()`);
    await ecran("exercice", `document.getElementById("cardSolvePuzzles").click()`, 900);
    await ecran("exercice du jour", `document.getElementById("tab-puzzles").click();document.getElementById("cardSolveDaily").click()`, 900);
    await ecran("finales", `document.getElementById("tab-puzzles").click();document.getElementById("cardSolveEndgames").click()`, 700);
    await ecran("motifs", `document.getElementById("tab-puzzles").click();document.getElementById("cardSolveMotifs").click()`, 700);
    await ecran("analyser", `setMode("edit")`);
    await ecran("explorer", `document.getElementById("tab-explore").click()`);
    await ecran("preferences", `document.getElementById("footPrefs").click()`);
    await ecran("mentions legales", `document.getElementById("footLegal").click()`);
    await ecran("confidentialite", `document.getElementById("footPrivacy").click()`);
    for (const v of ["accueil", "stats", "badges", "nouveautes", "transfert", "reset"]) await ecran("menu " + v, `menuOuvrir();menuVue(${JSON.stringify(v)})`, 900);
    await ecran("menu compte", `menuOuvrir();document.querySelector("#menuTiroir [data-vue-compte]").click()`, 700);
    await ecran("menu objectif", `menuOuvrir();document.querySelector("#menuTiroir [data-vue-objectif]").click()`, 700);
    await ecran("menu defis", `menuOuvrir();document.querySelector("#menuTiroir [data-vue-defis]").click()`, 700);
    await c.js(`menuFermer();1`);
    /* Chaque lecon du chemin, consigne puis explication. */
    const plan = require("./chemin/plan.json").chapitres;
    await c.js(`localStorage.setItem("chang64:chemin",JSON.stringify({v:1,c:{},o:${JSON.stringify(plan)},p:{t:1,n:5,e:"securite"}}));1`);
    await c.aller(url); await c.attendre(700);
    await c.js(`document.getElementById("tab-apprendre").click();new Promise(r=>setTimeout(r,900))`);
    for (let ch = 1; ch < plan.length; ch++) {
      await c.js(`setMode("apprendre");document.querySelectorAll("#apChemin .ap-chap")[${ch}].click();new Promise(r=>setTimeout(r,700))`);
      const n = await c.js(`leconEtapes().map(e=>e.exos.length)`);
      for (let e = 0; e < n.length; e++) for (let x = 0; x < Math.max(1, n[e]); x++) {
        await c.js(`lecon.e=${e};lecon.x=${x};debutCharger();new Promise(r=>setTimeout(r,120))`);
        await partout("lecon " + plan[ch] + " " + (e + 1) + "." + (x + 1));
        if (!n[e]) continue;
        await c.js(`(function(){const ex=leconEtapes()[lecon.e].exos[lecon.x];const l=Object.values(ex.faux||{}).concat(ex.apres?[ex.apres]:[]);let k=0;window.__t=l;})();1`);
        const combien = await c.js(`window.__t.length`);
        for (let k = 0; k < combien; k++) { await c.js(`debutStatut("",window.__t[${k}]);1`); await partout("lecon " + plan[ch] + " " + (e + 1) + "." + (x + 1) + " message " + (k + 1)); }
      }
    }
  }
  await c.fermer();
  console.log(mesures + " mesures (" + LARGEURS.join(", ") + " px), langue " + LANGUE);
  if (tout.size) { console.log(tout.size + " defaut(s) :"); for (const [p, ou] of tout) console.log("  " + p + "   [" + ou + "]"); process.exit(1); }
  console.log("aucun defaut");
})().catch(e => { console.error(e); process.exit(1); });
