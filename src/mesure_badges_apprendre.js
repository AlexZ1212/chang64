/* Mesures a 360 px, dans un vrai navigateur, des badges du chemin d'Apprendre
   et du sous-titre « Resultats » (2026-11-23).

   Usage :  node serveur_local.js 0          (dans une autre fenetre : il dit son port)
            node mesure_badges_apprendre.js http://localhost:<port> [dossier des captures]

   jsdom ne met rien en page : une largeur, un libelle sur deux lignes ou un
   debordement ne se mesurent que dans un navigateur. Dans les 10 langues, a
   360 x 740 :
   - l'ecran Badges, famille « Chemin d'apprentissage » : 14 medailles, rien ne
     deborde, aucun nom coupe ;
   - la fiche de chacun des 14 badges, puis la fenetre Bravo de chacun, comme
     au moment ou il est gagne : la fenetre tient dans l'ecran, le bouton sur
     une ligne ;
   - la fenetre Bravo a plusieurs pages (cinq medailles d'un coup) ;
   - l'annonce du rattrapage, au singulier et au pluriel, avec sa phrase ;
   - Statistiques : le sous-titre « Resultats » ; Top joueurs : la pastille
     « Parties gagnees entre membres » sur une ligne ; la fiche d'un membre :
     sa ligne et son titre « Resultats » ; le grand tableau (telephone tourne) :
     l'en-tete de la colonne. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./tests/outils/chrome_sans_fenetre.js");
const { LANGUES } = require("./langues/registre.js");
const CATALOGUE = require("./badges-catalogue.js");
const BASE = (process.argv[2] || "http://localhost:8096").replace(/\/$/, "");
const SORTIE = process.argv[3] || path.join(__dirname, "..", "design", "badges", "apprendre", "mesures");
const IDS = CATALOGUE.filter(b => b[1] === "apprendre").map(b => b[0]);
const FICHE = { p: "Moi", depuis: "2026-03", s: 12, n: 1450, r: 320, j: 9, b: 41, k: 14, d: 14, rangs: { s: 3, n: 1, r: 2, j: 4, b: 5, k: 7, d: 6 }, bl: [], pays: "",
  ef: { b: { r: 1012, n: 12 }, r: { r: 980, n: 1 }, c: { r: 0, n: 0 }, k: { r: 1104, n: 11 } }, dir: { v: 14, n: 3, d: 11, f: { b: [7, 2, 3], r: [1, 0, 0], c: [0, 0, 0], k: [4, 1, 6] } } };

/* Dans la page : ce qui deborde dans un bloc ; mono : les elements dont le texte doit tenir sur une ligne. */
const CONTROLE = `(function(sel, mono){
  const pb=[], racine=document.querySelector(sel);
  if(!racine)return ["bloc absent : "+sel];
  if(document.documentElement.scrollWidth>innerWidth+1)pb.push("la page deborde en largeur ("+document.documentElement.scrollWidth+" px)");
  const R=racine.getBoundingClientRect();
  if(R.right>innerWidth+1||R.left<-1)pb.push("le bloc sort de l'ecran ("+Math.round(R.left)+" a "+Math.round(R.right)+")");
  for(const e of [racine].concat([...racine.querySelectorAll("*")])){
    if(e.closest("svg")&&e.tagName.toLowerCase()!=="svg")continue;
    const r=e.getBoundingClientRect();
    if(r.width<=1||r.height<=1)continue;
    const cs=getComputedStyle(e);
    if(cs.visibility==="hidden")continue;
    if(!e.closest(".tc-cats,.bx-socle")&&(r.right>innerWidth+1||r.left<-1))pb.push("<"+e.tagName.toLowerCase()+"."+(typeof e.className==="string"?e.className:"")+"> sort de l'ecran ("+Math.round(r.left)+" a "+Math.round(r.right)+")");
    if(e.children.length===0&&e.textContent.trim()&&cs.overflowX!=="auto"&&e.scrollWidth>e.clientWidth+1&&cs.display!=="inline")pb.push("texte coupe dans <"+e.tagName.toLowerCase()+"> « "+e.textContent.trim().slice(0,30)+" »");
    if(mono&&e.matches(mono)){const lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.3;if(r.height>lh*1.7+parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom))pb.push("libelle sur deux lignes : « "+e.textContent.trim()+" »");}
  }
  return pb;
})`;
/* Jamais « : ; ! ? » seul en debut de ligne (regle d'Alexandre) : chaque ligne rendue d'un bloc de texte. */
const DEBUTS = `(function(sel){
  const pb=[];
  for(const e of document.querySelectorAll(sel)){
    const tw=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n,haut=null,debut="";
    while((n=tw.nextNode())){
      for(let i=0;i<n.length;i++){
        const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+1);const b=r.getBoundingClientRect();
        if(!b.width&&!b.height)continue;
        if(haut===null||b.top>haut+4){haut=b.top;debut=n.data[i];if(/[:;!?»]/.test(debut))pb.push("ligne qui commence par « "+debut+" » dans « "+e.textContent.trim().slice(0,40)+" »");}
      }
    }
  }
  return pb;
})`;

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const c = await ouvrir({ largeur: 360, hauteur: 740, pause: 300 });
  const pb = [], ailleurs = [];
  let n = 0;
  const noter = async (nom, sel, mono, textes) => {
    n++;
    for (const p of await c.js(CONTROLE + "(" + JSON.stringify(sel) + "," + JSON.stringify(mono || "") + ")")) pb.push(nom + " : " + p);
    if (textes) for (const p of await c.js(DEBUTS + "(" + JSON.stringify(textes) + ")")) pb.push(nom + " : " + p);
  };
  for (const lg of LANGUES) {
    const l = lg.code, url = BASE + lg.accueil;
    await c.aller(url);
    await c.js(`localStorage.clear();localStorage.setItem("chang64:lang",${JSON.stringify(l)});localStorage.setItem("chang64:compte",JSON.stringify({pseudo:"Moi",cle:"moi",version:1,dev:"abc123",n:0,sync:0}));` +
      `localStorage.setItem("chang64:progress",JSON.stringify({level:2,solved:20,best:4,rating:850,days:2,badges:["ch_regles","boss_1","test_fait"],badgeDates:{ch_regles:1763900000000,boss_1:1763900000000,test_fait:1763900000000},bx:{f:{ch_regles:1,boss_1:1,test_fait:1},j:{},c:{}}}));1`);
    await c.aller(url);
    await c.attendre(900);
    await c.js(`cppLire=async()=>(${JSON.stringify(FICHE)});bxCharger().then(()=>1)`);

    /* 1. L'ecran Badges : la famille du chemin. */
    await c.js(`menuOuvrir();menuVue("badges");1`); await c.attendre(700);
    const fam = await c.js(`(function(){const g=document.getElementById("menuBadgeGrid"),ids=${JSON.stringify(IDS)};const c=ids.map(id=>g.querySelector('[data-bx="'+id+'"]'));if(c.some(x=>!x))return {manque:ids.filter((id,i)=>!c[i]).join()};` +
      `const h=[...g.querySelectorAll(".bx-famille")].find(x=>x.nextElementSibling===c[0]);h.scrollIntoView({block:"start"});return {titre:h?h.textContent:"",noms:c.map(x=>x.querySelector(".bx-nom").textContent),vides:c.filter(x=>!x.querySelector("svg")).length};})()`);
    await c.attendre(300);
    if (fam.manque) pb.push(l + " ecran Badges : medailles absentes " + fam.manque);
    else {
      if (!fam.titre.trim()) pb.push(l + " ecran Badges : la famille n'a pas de titre");
      if (fam.vides) pb.push(l + " ecran Badges : " + fam.vides + " carte(s) sans medaille");
      if (fam.noms.some(x => !x.trim() || /^(ch_|boss_|chemin_|test_)/.test(x))) pb.push(l + " ecran Badges : un nom manque (" + fam.noms.join(" | ") + ")");
    }
    for (const id of IDS) await noter(l + " ecran Badges, carte " + id, '#menuBadgeGrid [data-bx="' + id + '"]');
    {
      const hors = await c.js(`(function(){const ids=${JSON.stringify(IDS)},g=document.getElementById("menuBadgeGrid"),G=g.getBoundingClientRect(),o=[];for(const b of g.querySelectorAll(".bx-carte")){const s=b.querySelector(".bx-nom"),r=s.getBoundingClientRect(),k=b.getBoundingClientRect();if(r.right>k.right+2||r.left<k.left-2)o.push([ids.includes(b.dataset.bx),b.dataset.bx,s.textContent,Math.round(r.width),Math.round(k.width)]);}return o;})()`);
      for (const h of hors) (h[0] ? pb : ailleurs).push(l + " ecran Badges : le nom « " + h[2] + " » (" + h[1] + ", " + h[3] + " px) depasse de sa carte (" + h[4] + " px)");
      const titre = await c.js(`(function(){const ids=${JSON.stringify(IDS)},g=document.getElementById("menuBadgeGrid"),c=g.querySelector('[data-bx="'+ids[0]+'"]'),h=c.previousElementSibling,r=h.getBoundingClientRect(),cs=getComputedStyle(h);return {texte:h.textContent,g:Math.round(r.left),d:Math.round(r.right),lignes:Math.round(r.height/(parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.3))};})()`);
      if (titre.g < 0 || titre.d > 360 || titre.lignes > 1) pb.push(l + " ecran Badges : titre de la famille " + JSON.stringify(titre));
    }
    await c.capture(path.join(SORTIE, "ecran-badges-" + l + ".png"));

    /* 2. La fiche de chaque badge (gagne ou a gagner). */
    for (const id of IDS) {
      await c.js(`bxFiche(${JSON.stringify(id)});1`); await c.attendre(120);
      await noter(l + " fiche " + id, "#bravo .bravo-fenetre", "#bravoOk", "#bravoNoms div, #bravoTexte, #bravoTitre");
      if ((id === "ch_menaces" || id === "boss_net") && (l === "fr" || l === "de" || l === "ru" || l === "pl")) await c.capture(path.join(SORTIE, "fiche-" + id + "-" + l + ".png"));
      await c.js(`bravoFermer();1`);
    }
    await c.js(`menuFermer();1`);

    /* 3. La fenetre Bravo de chaque badge, comme a l'instant ou il est gagne. */
    for (const id of IDS) {
      await c.js(`bravoFile=[BADGES.find(b=>b.id===${JSON.stringify(id)})];bravoTenter();1`); await c.attendre(160);
      const ouvert = await c.js(`!document.getElementById("bravo").hidden&&document.getElementById("bravoNoms").textContent.trim().length>1`);
      if (!ouvert) pb.push(l + " Bravo " + id + " : la fenetre ne s'ouvre pas");
      await noter(l + " Bravo " + id, "#bravo .bravo-fenetre", "#bravoOk", "#bravoNoms div, #bravoTexte, #bravoTitre");
      if ((id === "ch_menaces" || id === "boss_tous") && (l === "fr" || l === "de" || l === "ru" || l === "id")) { await c.attendre(1500); await c.capture(path.join(SORTIE, "bravo-" + id + "-" + l + ".png")); }
      await c.js(`bravoFermer();1`);
    }
    /* Cinq medailles d'un coup : les petites medailles des pages tiennent dans la fenetre. */
    await c.js(`bravoFile=${JSON.stringify(["ch_regles", "chemin_fini", "boss_tous", "boss_net", "test_parfait"])}.map(id=>BADGES.find(b=>b.id===id));bravoTenter();1`); await c.attendre(200);
    await noter(l + " Bravo a cinq pages", "#bravo .bravo-fenetre", "#bravoOk", "#bravoNoms div, #bravoTexte");
    const pages = await c.js(`(function(){const a=document.getElementById("bravoAutres"),r=a.getBoundingClientRect();return {n:a.children.length,g:Math.round(r.left),d:Math.round(r.right),bouton:document.getElementById("bravoOk").textContent};})()`);
    if (pages.n !== 5 || pages.g < 0 || pages.d > 360) pb.push(l + " Bravo a cinq pages : rangee des pages " + JSON.stringify(pages));
    if (l === "fr") { await c.attendre(1500); await c.capture(path.join(SORTIE, "bravo-cinq-pages-fr.png")); }
    await c.js(`bravoFermer();bravoFile=[];1`);

    /* 4. L'annonce du rattrapage, au pluriel puis au singulier. */
    for (const k of [7, 1]) {
      await c.js(`(function(){const a=document.getElementById("objAnnonce");if(a)a.remove();objFile.length=0;objEnCours=false;bxAdoptes=${k};bxAdoptesAutres=true;bxAdoptesAnnoncer();})();1`); await c.attendre(700);
      const txt = await c.js(`(function(){const a=document.getElementById("objAnnonce");return a?a.textContent:"";})()`);
      if (!txt.includes(String(k))) pb.push(l + " annonce du rattrapage (" + k + ") : absente ou sans nombre « " + txt + " »");
      await noter(l + " annonce du rattrapage (" + k + ")", "#objAnnonce", "", "#objAnnonce *");
      if (k === 7 && (l === "fr" || l === "de" || l === "ru" || l === "tr")) await c.capture(path.join(SORTIE, "annonce-rattrapage-" + l + ".png"));
    }
    await c.js(`(function(){const a=document.getElementById("objAnnonce");if(a)a.remove();objFile.length=0;objEnCours=false;})();1`);

    /* 5. « Resultats » : Statistiques, Top joueurs, fiche d'un membre. */
    await c.js(`menuOuvrir();menuVue("stats");1`); await c.attendre(1500);
    await c.js(`(function(){const m=document.getElementById("menuStats"),t=document.querySelector("#menuMembres .stats-cat");m.scrollTop+=t.getBoundingClientRect().top-m.getBoundingClientRect().top-8;})();1`); await c.attendre(300);
    await noter(l + " statistiques, sous-titre", "#menuDirect", ".tiroir-section, .tc-cats button, .stats-legende li");
    const st = await c.js(`(function(){const a=document.querySelector("#menuMembres .stats-cat"),b=document.querySelector("#menuDirect .tiroir-section");return [a?a.textContent:"",b?b.textContent:""];})()`);
    if (!st[1].trim() || st[0].trim() === st[1].trim()) pb.push(l + " statistiques : sous-titre « " + st[1] + " » sous « " + st[0] + " »");
    if (l === "fr" || l === "de" || l === "ru") await c.capture(path.join(SORTIE, "statistiques-resultats-" + l + ".png"));
    await c.js(`menuVue("joueurs");1`); await c.attendre(900);
    await noter(l + " Top joueurs, pastilles", "#menuJoueursVue .cpj-onglets", ".cpj-onglets button");
    await c.js(`cpjVue("direct");1`); await c.attendre(600);
    await noter(l + " Top joueurs, tableau des parties gagnees", "#menuJoueursVue", ".cpj-onglets button");
    if (l === "fr" || l === "es" || l === "pl") await c.capture(path.join(SORTIE, "top-joueurs-" + l + ".png"));
    await c.js(`menuFermer();cppOuvrir("Moi");1`); await c.attendre(900);
    await noter(l + " fiche d'un membre", "#cpProfilContenu", ".cpp-liste li span:first-child, .cpp-direct-titre, .cpp-direct .menu-tuile span");
    const lignes = await c.js(`[...document.querySelectorAll("#cpProfilContenu .cpp-liste li")].map(x=>Math.round(x.getBoundingClientRect().height))`);
    if (lignes.length !== 7 || Math.max.apply(null, lignes) > Math.min.apply(null, lignes) + 2) pb.push(l + " fiche d'un membre : les sept lignes n'ont pas la meme hauteur " + JSON.stringify(lignes));
    await c.js(`(function(){const e=document.querySelector("#cpProfilContenu .cpp-liste");if(e)e.scrollIntoView({block:"start"});})();1`); await c.attendre(200);
    if (l === "fr" || l === "es" || l === "pt" || l === "pl") await c.capture(path.join(SORTIE, "fiche-membre-" + l + ".png"));
    await c.js(`cppFermer();1`);
  }
  /* 6. Le grand tableau, telephone tourne (740 x 360) : l'en-tete de la derniere colonne. */
  await c.taille(740, 360);
  for (const lg of LANGUES) {
    const l = lg.code;
    await c.aller(BASE + lg.accueil); await c.attendre(600);
    await c.js(`menuOuvrir();menuVue("joueurs");1`); await c.attendre(900);
    await c.js(`(function(){cpjTout={joueurs:[{p:"Moi",s:12,n:1450,r:320,j:9,b:41,k:14,d:14},{p:"Anna",s:3,n:990,r:120,j:2,b:17,k:9,d:2}]};const g=document.getElementById("cpjGrand");g.classList.add("ouvert");cpjGrandDessiner();})();1`); await c.attendre(300);
    const t = await c.js(`(function(){const g=document.getElementById("cpjGrand"),ths=[...g.querySelectorAll("thead th")];if(!ths.length)return null;const r=g.querySelector("table").getBoundingClientRect();return {n:ths.length,dernier:ths[ths.length-1].textContent,largeur:Math.round(r.width),droite:Math.round(r.right),hauts:[...new Set(ths.map(x=>Math.round(x.getBoundingClientRect().height)))].length};})()`);
    n++;
    if (!t) pb.push(l + " grand tableau : absent");
    else {
      if (t.n !== 9 || !t.dernier.trim()) pb.push(l + " grand tableau : en-tetes " + JSON.stringify(t));
      if (t.droite > 741) pb.push(l + " grand tableau : il deborde de l'ecran tourne (" + t.droite + " px)");
      if (t.hauts !== 1) pb.push(l + " grand tableau : un en-tete passe sur deux lignes");
    }
    if (l === "fr" || l === "tr") await c.capture(path.join(SORTIE, "grand-tableau-" + l + ".png"));
  }
  await c.fermer();
  console.log(n + " ecrans mesures (360 x 740, puis 740 x 360 pour le grand tableau), " + LANGUES.length + " langues ; captures dans " + SORTIE);
  if (ailleurs.length) { console.log("Vu en passant, hors de ce lot (ne fait pas echouer) :"); for (const p of ailleurs) console.log("  " + p); }
  if (pb.length) { console.log(pb.length + " defaut(s) :"); for (const p of pb) console.log("  " + p); process.exit(1); }
  console.log("aucun defaut");
})().catch(e => { console.error(e); process.exit(1); });
