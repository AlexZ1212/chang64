/* Apercu des pieces a contours (ajustements du 2026-11-22), tel que le site les
   dessine : les pictos des cartes aux trois tailles, puis toutes les medailles
   qui portent une piece, et les deux moutons (« Tondu », « Coup du berger »).

   Usage : node serveur_local.js 8093     (dans src, autre fenetre, site construit)
           node design/ajustements-2211/apercu-contours.js [http://localhost:8093]
   Ecrit design/ajustements-2211/contours-pictos.png et contours-medailles.png */
const path = require("path");
const SRC = path.join(__dirname, "..", "..", "src");
const { ouvrir } = require(path.join(SRC, "tests/outils/chrome_sans_fenetre.js"));
const BASE = (process.argv[2] || "http://localhost:8093").replace(/\/$/, "");

const PICTOS = `(function(){
  const noms=Object.keys(PICTOS);
  let h='<div id="ap" style="position:absolute;left:0;top:0;z-index:99999;background:var(--slate);padding:14px;display:grid;grid-template-columns:repeat(4,auto);gap:12px 22px;width:max-content">';
  for(const n of noms)h+='<div style="display:flex;align-items:center;gap:8px">'+pictoHtml(n,"grand")+pictoHtml(n)+pictoHtml(n,"petit")+'</div>';
  document.body.insertAdjacentHTML("beforeend",h+"</div>");
  const r=document.getElementById("ap").getBoundingClientRect();return [Math.ceil(r.width),Math.ceil(r.height)];
})()`;
const MEDAILLES = `(function(){
  document.getElementById("ap").remove();
  const ids=Object.keys(bxMedailles).filter(k=>Array.isArray(bxMedailles[k])&&/paint-order/.test(bxMedailles[k][1]));
  const tete=["lec_tondu","ouv_berger"].concat(ids);
  let h='<div id="ap" style="position:absolute;left:0;top:0;z-index:99999;background:var(--ink);padding:14px;width:1180px;box-sizing:border-box;color:var(--sage);font:12px Archivo,sans-serif">';
  const rang=(titre,l,t,gagne)=>{h+='<div style="margin:8px 0 4px">'+titre+'</div><div style="display:flex;flex-wrap:wrap;gap:8px">';for(const k of l)h+=bxMedaille(k,gagne).replace('class="bx-medaille','style="width:'+t+'px;height:'+t+'px" class="bx-medaille');h+='</div>';};
  rang("Les deux moutons, puis toutes les médailles qui portent une pièce ("+ids.length+")",tete,88,true);
  rang("À la taille de la collection (54 px)",tete.slice(0,40),54,true);
  rang("Pas encore gagnées",tete.slice(0,20),54,false);
  document.body.insertAdjacentHTML("beforeend",h+"</div>");
  const r=document.getElementById("ap").getBoundingClientRect();return [Math.ceil(r.width),Math.ceil(r.height)];
})()`;

(async () => {
  const c = await ouvrir({ largeur: 1180, hauteur: 800, echelle: 2 });
  await c.aller(BASE + "/fr/");
  await c.js(`bxCharger().then(()=>1)`);
  await c.js(`document.body.style.overflow="hidden";1`);
  let t = await c.js(PICTOS);
  await c.taille(t[0], t[1]); await c.attendre(900);
  await c.capture(path.join(__dirname, "contours-pictos.png"));
  await c.taille(1180, 800);
  t = await c.js(MEDAILLES);
  await c.taille(t[0], t[1]); await c.attendre(900);
  await c.capture(path.join(__dirname, "contours-medailles.png"));
  await c.fermer();
})().catch(e => { console.error(e); process.exit(1); });
