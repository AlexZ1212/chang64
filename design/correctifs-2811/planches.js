/* Planches pour les QCM du lot du 27/11 (points 15 et 18), rendues dans le
   vrai site a 360 px, theme et polices compris.
   Usage : node design/correctifs-2811/planches.js http://localhost:<port>
   Ecrit design/correctifs-2811/apres/planche-18-jauges.png et planche-15-lien.png. */
const path = require("path");
const SRC = path.join(__dirname, "..", "..", "src");
const { ouvrir } = require(path.join(SRC, "tests", "outils", "chrome_sans_fenetre.js"));
const sharp = require(path.join(SRC, "node_modules", "sharp"));
const BASE = (process.argv[2] || "http://localhost:8096").replace(/\/$/, "");
const SORTIE = path.join(__dirname, "apres");

const etiquette = (txt, l) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${l}" height="70"><rect width="100%" height="100%" fill="#0f1513"/><text x="24" y="48" font-family="Arial" font-weight="700" font-size="34" fill="#ffffff">${txt}</text></svg>`);
async function assembler(images, titres, fichier) {
  const metas = await Promise.all(images.map(b => sharp(b).metadata()));
  const l = Math.max(...metas.map(m => m.width)), h = Math.max(...metas.map(m => m.height)) + 70;
  const compo = [];
  images.forEach((b, i) => { compo.push({ input: etiquette(titres[i], l), left: i * (l + 20), top: 0 }, { input: b, left: i * (l + 20), top: 70 }); });
  await sharp({ create: { width: images.length * (l + 20) - 20, height: h, channels: 4, background: "#0f1513" } }).composite(compo).png().toFile(fichier);
}

(async () => {
  const c = await ouvrir({ largeur: 360, hauteur: 640 });
  await c.aller(BASE + "/fr/"); await c.attendre(900);

  /* 18 : les jauges du site, toutes a la meme epaisseur, en trois essais. */
  const jauges = [];
  for (const ep of [4, 6, 8]) {
    await c.aller(BASE + "/fr/"); await c.attendre(800);
    await c.js(`(function(){document.body.innerHTML='';document.body.style.padding='16px';const d=document.createElement('div');d.id='planche';
      const j=${ep};
      d.innerHTML='<p class="tiroir-section" style="margin:0 0 6px">Défis de la semaine</p>'+
        '<div class="defi" style="margin:0 0 8px"><div class="defi-tete"><span class="defi-texte">Réussis l\\'exercice du jour 5 jours</span><span class="defi-compte">3/5</span></div><div class="defi-barre" style="height:'+j+'px"><i style="width:60%"></i></div></div>'+
        '<div class="defi fait" style="margin:0 0 14px"><div class="defi-tete"><span class="defi-texte">Gagne 2 parties contre l\\'ordinateur</span></div><div class="defi-barre" style="height:'+j+'px"><i style="width:100%"></i></div></div>'+
        '<p class="tiroir-section" style="margin:0 0 6px">Apprendre</p><div style="padding:10px;border:1px solid var(--rule);border-radius:var(--r);margin-bottom:14px">Chapitre 3 | 4 étapes sur 7<span class="ap-barre" style="height:'+j+'px"><i style="width:57%"></i></span></div>'+
        '<p class="tiroir-section" style="margin:0 0 6px">Statistiques</p><div class="stats-barre" style="height:'+j+'px;margin-bottom:14px"><i class="g" style="flex-grow:7"></i><i class="n" style="flex-grow:1"></i><i class="p" style="flex-grow:5"></i></div>'+
        '<p class="tiroir-section" style="margin:0 0 6px">Maîtrise des erreurs</p><span class="erreurs-barre" style="display:flex;gap:4px;margin-bottom:14px">'+('<i class="pleine" style="height:'+j+'px"></i>').repeat(2)+('<i style="height:'+j+'px"></i>').repeat(3)+'</span>'+
        '<p class="tiroir-section" style="margin:0 0 6px">Analyse en cours</p><div class="progressbar" style="height:'+j+'px;border:0;margin-top:0"><i style="width:40%"></i></div>';
      document.body.appendChild(d);return 1})()`);
    await c.attendre(300);
    const f = path.join(SORTIE, "_j" + ep + ".png");
    await c.capture(f);
    jauges.push(f);
  }
  await assembler(jauges, ["A. 4 px", "B. 6 px", "C. 8 px"], path.join(SORTIE, "planche-18-jauges.png"));

  /* 15 : le lien « Toutes mes statistiques → » sous Ma progression. */
  const liens = [];
  const VARIANTES = [
    ["A", ""],
    ["B", `const p=document.querySelector('.home-stats-lien');p.style.textAlign='center';const b=document.getElementById('homeStatsBtn');b.textContent='Toutes mes statistiques';b.style.fontSize='13px';`],
    ["C", `const p=document.querySelector('.home-stats-lien');const b=document.getElementById('homeStatsBtn');b.className='tiroir-lien';b.setAttribute('data-vue','stats');b.style.cssText='border:1px solid var(--rule);background-color:var(--ink);margin-top:2px';b.innerHTML='<span>Toutes mes statistiques</span>';`],
    ["D", `const p=document.querySelector('.home-stats-lien');const b=document.getElementById('homeStatsBtn');b.className='btn';b.style.cssText='width:100%;margin-top:2px';b.textContent='Toutes mes statistiques';`]
  ];
  for (const [n, js] of VARIANTES) {
    await c.aller(BASE + "/fr/"); await c.attendre(600);
    await c.js(`ensureProgFields();prog.solved=53;prog.rating=1604;prog.days=11;saveProg();1`);
    await c.aller(BASE + "/fr/"); await c.attendre(1200);
    await c.js(`(function(){${js}document.getElementById('homeProgressPanel').scrollIntoView({block:'center'});return 1})()`);
    await c.attendre(400);
    const r = await c.js(`(function(){const r=document.getElementById('homeProgressPanel').getBoundingClientRect();return {x:Math.max(0,r.left-4),y:Math.max(0,r.top-4),w:r.width+8,h:r.height+8}})()`);
    const f = path.join(SORTIE, "_l" + n + ".png");
    await c.capture(f);
    const buf = await sharp(f).extract({ left: Math.round(r.x * 2), top: Math.round(r.y * 2), width: Math.round(Math.min(r.w, 360 - r.x) * 2), height: Math.round(r.h * 2) }).toBuffer();
    liens.push(buf);
  }
  await assembler(liens, ["A. Aujourd'hui", "B. Comme Signaler", "C. Comme le menu", "D. Bouton"], path.join(SORTIE, "planche-15-lien.png"));
  await c.fermer();
  require("fs").readdirSync(SORTIE).filter(x => /^_/.test(x)).forEach(x => require("fs").unlinkSync(path.join(SORTIE, x)));
  console.log("planches ecrites");
})();
