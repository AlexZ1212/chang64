/* Maquette du bloc joueur (nom, pieces prises, pendule), ajustements du 2026-11-22.
   Trois propositions, chacune dans une colonne de 360 px, chacune en debut de partie (aucune prise) et en
   cours de partie (des prises), dessinees dans la vraie page avec ses styles.

   Usage : node serveur_local.js 8093     (dans src, autre fenetre)
           node design/ajustements-2211/maquette-bloc-joueur.js [http://localhost:8093]
   Ecrit design/ajustements-2211/bloc-joueur-propositions.png */
const path = require("path"), fs = require("fs");
const SRC = path.join(__dirname, "..", "..", "src");
const { ouvrir } = require(path.join(SRC, "tests/outils/chrome_sans_fenetre.js"));
const BASE = (process.argv[2] || "http://localhost:8093").replace(/\/$/, "");

const DANS_LA_PAGE = `(function(){
  const css=document.createElement("style");
  css.textContent=
    /* A : deux lignes toujours reservees, bloc plus haut */
    ".mq-a .clock{min-height:54px;justify-content:center;padding-top:0;padding-bottom:0}"+
    /* B : le nom seul est centre ; a la premiere prise, nom et prises forment un groupe centre */
    ".mq-b .clock{min-height:54px;justify-content:center;padding-top:0;padding-bottom:0}"+
    ".mq-b .taken:empty{display:none}"+
    ".mq-b .taken{margin-top:3px}"+
    /* C : tout sur une seule ligne, centree comme la pendule */
    ".mq-c .clock{min-height:54px;flex-direction:row;align-items:center;gap:10px;padding-top:0;padding-bottom:0}"+
    ".mq-c .clock-line{flex:0 10 auto;min-width:48px}"+
    ".mq-c .taken-slot{flex:0 1 auto;min-width:0}"+
    ".mq-c .taken{padding-left:0}"+
    "#mq{position:absolute;left:0;top:0;z-index:99999;background:var(--ink);display:flex;color:var(--chalk)}"+"#mq>div{width:360px;flex:none;padding:10px 12px 16px;box-sizing:border-box;border-right:1px solid var(--rule)}"+
    "#mq h3{font:600 13px Archivo,sans-serif;color:var(--brass);margin:12px 0 2px}"+
    "#mq p{font:12px Archivo,sans-serif;color:var(--sage);margin:0 0 6px;min-height:30px}"+
    "#mq .et{font:11px Archivo,sans-serif;color:var(--sage);margin:6px 0 3px;opacity:.8}"+
    "#mq .clock{margin-bottom:6px}";
  document.head.appendChild(css);
  const bloc=(nom,sombre,temps,prises,actif)=>'<div class="clock'+(actif?" active":"")+'"><div class="clock-line"><span class="who"><i'+(sombre?' class="dark"':"")+'></i><span>'+nom+'</span></span><time>'+temps+'</time></div><span class="taken-slot">'+prises+'</span></div>';
  const vide=rangeePrises([],"w",0);
  const pH=rangeePrises(["p","p","n"],"w",-2),pB=rangeePrises(["p","p","p","b","r"],"b",2);
  const lourd=rangeePrises(["p","p","p","p","p","p","n","n","b","r","q"],"b",9);
  const variante=(cl,titre,texte)=>'<div class="'+cl+'"><h3>'+titre+'</h3><p>'+texte+'</p>'+
    '<div class="et">Début de partie</div>'+bloc("Chang | Tranquille ≈ 1100 Elo",true,"10:00",vide,false)+bloc("Toi",false,"9:59",vide,true)+
    '<div class="et">En cours de partie</div>'+bloc("Chang | Tranquille ≈ 1100 Elo",true,"7:42",pH,true)+bloc("Toi",false,"8:15",pB,false)+
    '<div class="et">Beaucoup de prises</div>'+bloc("Chang | Tranquille ≈ 1100 Elo",true,"2:05",pH,false)+bloc("Toi",false,"3:31",lourd,true)+"</div>";
  const h='<div id="mq">'+
    variante("mq-0","Aujourd'hui (49 px)","Le nom en haut, la ligne des prises réservée dessous.")+
    variante("mq-a","A. Plus haut, deux lignes réservées (54 px)","Comme aujourd'hui, avec 10 % de hauteur en plus.")+
    variante("mq-b","B. Nom centré, les prises arrivent dessous (54 px)","Sans prise, le nom est au milieu. Avec des prises, nom et prises forment un groupe centré.")+
    variante("mq-c","C. Tout sur une ligne (54 px)","Nom, prises et pendule sur le même axe, au milieu du bloc.")+
    "</div>";
  document.body.insertAdjacentHTML("beforeend",h);
  return [...document.querySelectorAll("#mq .clock")].map(e=>Math.round(e.getBoundingClientRect().height*10)/10).join(" ");
})()`;

(async () => {
  const c = await ouvrir({ largeur: 1440, hauteur: 700, echelle: 2 });
  await c.aller(BASE + "/fr/");
  await c.js(`localStorage.clear();localStorage.setItem("chang64:lang","fr");1`);
  await c.aller(BASE + "/fr/");
  await c.js(`setMode("play");1`); await c.attendre(600);
  console.log("hauteurs :", await c.js(DANS_LA_PAGE));
  await c.attendre(500);
  const h = await c.js(`document.getElementById("mq").scrollHeight`);
  await c.js(`window.scrollTo(0,0);document.body.style.overflow="hidden";1`); await c.taille(1440, Math.ceil(h)); await c.attendre(300);
  await c.capture(path.join(__dirname, "bloc-joueur-propositions.png"));
  await c.fermer();
})().catch(e => { console.error(e); process.exit(1); });
