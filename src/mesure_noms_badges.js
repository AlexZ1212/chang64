/* Noms de badges coupes au milieu d'un mot (2026-11-24, remarque d'Alexandre :
   « échauffemen / t »). Dans un vrai navigateur, a 360 et 320 px, dans les 10
   langues : chaque nom de la collection, mot par mot ; un mot dont les lettres
   tiennent sur deux lignes est signale, sauf s'il est coupe a un trait d'union
   conditionnel (le tiret s'affiche alors).

   Usage :  node serveur_local.js 0      (dans une autre fenetre : il dit son port)
            node mesure_noms_badges.js http://localhost:<port> */
const { ouvrir } = require("./tests/outils/chrome_sans_fenetre.js");
const { LANGUES } = require("./langues/registre.js");
const BASE = (process.argv[2] || "http://localhost:8096").replace(/\/$/, "");
const MESURE = `(function(){
  const pb=[];
  for(const e of document.querySelectorAll("#menuBadgeGrid .bx-nom")){
    const tw=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;
    while((n=tw.nextNode())){
      const re=/[^\\s-]+-?/g;let m;
      while((m=re.exec(n.data))){
        const r=document.createRange();const tops=new Set();
        for(let i=m.index;i<m.index+m[0].length;i++){if(n.data[i]==="\\u00ad")continue;r.setStart(n,i);r.setEnd(n,i+1);const b=r.getBoundingClientRect();if(b.width)tops.add(Math.round(b.top));}
        if(tops.size>1&&!/\\u00ad/.test(m[0]))pb.push(m[0]);
        else if(tops.size>1){/* coupe a un trait d'union conditionnel : accepte */}
      }
    }
    if(e.scrollWidth>e.clientWidth+1)pb.push("deborde : "+e.textContent);
  }
  return pb;
})()`;
(async () => {
  const c = await ouvrir({ largeur: 360, hauteur: 740, pause: 300 });
  let total = 0;
  for (const [largeur, large] of [[360, 0], [320, 0], [360, 1]]) {
    await c.taille(largeur, 740);
    for (const lg of LANGUES) {
      const url = BASE + lg.accueil;
      await c.aller(url);
      await c.js(`localStorage.clear();localStorage.setItem("chang64:lang",${JSON.stringify(lg.code)});localStorage.setItem("chang64:compte",JSON.stringify({pseudo:"Moi",cle:"moi",version:1,dev:"abc123",n:0,sync:Date.now()}));1`);
      await c.aller(url);
      /* large : une police un peu plus large, comme celle de Safari sur iPhone. */
      if (large) await c.js(`document.head.insertAdjacentHTML("beforeend","<style>.bx-nom{letter-spacing:.05em}</style>");1`);
      await c.js(`menuOuvrir();menuVue("badges");1`);
      await c.attendre(700);
      const pb = await c.js(MESURE);
      total += pb.length;
      console.log(largeur + (large ? " (police large)" : "") + " " + lg.code + " : " + (pb.length ? pb.join(", ") : "aucun mot coupe"));
    }
  }
  await c.fermer();
  console.log(total ? total + " mot(s) coupe(s)" : "Aucun mot coupe.");
  process.exit(total ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
