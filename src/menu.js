/* ==========================================================
   MENU (2026-11-15, demande d'Alexandre)
   ========================================================== */
/* Un tiroir qui glisse depuis la droite et reunit ce qui etait disperse :
   statistiques et badges (consultables sans quitter l'ecran en cours),
   nouveautes, preferences, accessibilite, langues, mentions. Colle apres
   badges.js par build_site.js ; le build pose le nombre de
   nouveautes publiees (data/nouveautes-<langue>.json). Un point laiton sur le
   bouton signale une nouveaute pas encore lue : on retient le NOMBRE de
   nouveautes deja vues (chang64:nouveautesLues), plus robuste qu'une date. */
const MENU_NOMBRE=__NOUVEAUTES_NOMBRE__;
let menuAvant=null,menuNouveautes=null;
function menuEl(id){return document.getElementById(id);}
function menuVu(){try{return Number(localStorage.getItem("chang64:nouveautesLues"))||0;}catch(e){return 0;}}
function menuPoint(){
  const nouveau=MENU_NOMBRE>menuVu();
  const p=menuEl("btnMenuPoint"),q=menuEl("menuNouveau");
  if(p)p.hidden=!nouveau;
  if(q)q.hidden=!nouveau;
}
/* Libelles poses par t() au chargement (data-t = la phrase anglaise). */
function menuTraduire(){
  document.querySelectorAll("#menuTiroir [data-t],#btnMenu[data-t-label]").forEach(e=>{
    if(e.dataset.t)e.textContent=t(e.dataset.t);
    if(e.dataset.tLabel)e.setAttribute("aria-label",t(e.dataset.tLabel));
  });
  ["menuFermer","menuRetour"].forEach(id=>{const e=menuEl(id);if(e&&e.dataset.tLabel)e.setAttribute("aria-label",t(e.dataset.tLabel));});
  menuLangues();
}
/* Le selecteur de langue vit dans le tiroir : sa liste y reste ouverte, sans
   le bouton qui la depliait. ui3.js le referme a tout clic ailleurs (comme
   une liste deroulante) : on le rouvre aussitot tant que le tiroir est
   ouvert, et apres le clic qui vient d'ouvrir le tiroir. */
function menuLangues(){
  const ls=menuEl("langSwitch");if(!ls)return;
  if(!ls.dataset.menu){
    ls.dataset.menu="1";
    ls.addEventListener("toggle",()=>{const r=menuEl("menuTiroir");if(!ls.open&&r&&!r.hidden)ls.open=true;});
  }
  ls.open=true;setTimeout(()=>{ls.open=true;},0);
}
function menuVue(nom){
  const vues={accueil:"menuAccueil",stats:"menuStats",badges:"menuBadges",nouveautes:"menuNouveautes",langues:"menuLanguesVue",transfert:"menuTransfertVue",reset:"menuResetVue"};
  for(const [k,id] of Object.entries(vues)){const e=menuEl(id);if(e)e.hidden=k!==nom;}
  const titres={accueil:"Menu",stats:"Statistics",badges:"Badges",nouveautes:"What's new",langues:"Language",transfert:"Continue on another device",reset:"Reset my progress"};
  menuEl("menuTitre").textContent=t(titres[nom]);
  menuEl("menuRetour").hidden=nom==="accueil";
  if(nom==="stats")menuStats();
  if(nom==="badges")menuBadges();
  /* La remise a zero se rearme a chaque ouverture : la confirmation ne reste
     jamais deployee d'une visite a l'autre. */
  menuResetArmer(false);
  if(nom==="nouveautes")menuListeNouveautes();
  if(nom==="langues"){menuLangues();const a=document.querySelector('#menuTiroir .langmenu a[aria-current="true"]');if(a)setTimeout(()=>a.focus({preventScroll:true}),mouvementCalme()?0:280);}
  const v=menuEl(vues[nom]);if(v){v.scrollTop=0;if(nom!=="accueil"&&!mouvementCalme()&&v.animate)v.animate([{opacity:0,transform:"translateX(18px)"},{opacity:1,transform:"none"}],{duration:260,easing:"cubic-bezier(.22,.7,.3,1)"});}
}
/* Remise a zero en deux temps (2026-11-19) : depuis le menu, un seul appui
   au mauvais endroit ne doit rien effacer. #btnReset garde son role (ui.js,
   compte.js) ; il n'apparait qu'apres « Tout reinitialiser ». */
function menuResetArmer(oui){
  const d=menuEl("btnResetDemande"),c=menuEl("resetConfirme");
  if(d)d.hidden=!!oui;
  if(c)c.hidden=!oui;
}
function menuOuvrir(){
  const r=menuEl("menuTiroir");if(!r||!r.hidden)return;
  menuAvant=document.activeElement;
  menuTraduire();menuResume();
  menuVue("accueil");
  r.hidden=false;
  menuEl("btnMenu").setAttribute("aria-expanded","true");
  document.documentElement.classList.add("menu-ouvert");
  requestAnimationFrame(()=>r.classList.add("ouvert"));
  menuEl("menuFermer").focus();
}
function menuFermer(){
  const r=menuEl("menuTiroir");if(!r||r.hidden)return;
  r.classList.remove("ouvert");
  menuEl("btnMenu").setAttribute("aria-expanded","false");
  document.documentElement.classList.remove("menu-ouvert");
  const fin=()=>{r.hidden=true;};
  if(mouvementCalme())fin();else setTimeout(fin,260);
  if(menuAvant&&menuAvant.focus&&document.contains(menuAvant))menuAvant.focus();
}
/* Raccourci sous chaque entree : la notation, le nombre de badges. */
function menuResume(){
  ensureProgFields();
  const s=menuEl("menuResume");if(s)s.textContent=String(prog.rating||800);
  /* Le code de transfert est la solution sans compte : un membre connecte
     n'en a pas besoin, sa progression suit son compte. */
  {const l=menuEl("menuTransfertLigne");if(l)l.hidden=typeof cp!=="undefined"&&!!cp;}
  {const l=menuEl("menuAmisLigne");if(l)l.hidden=!(typeof cp!=="undefined"&&cp);}
  if(typeof cpaPoint==="function")cpaPoint();
  if(typeof cpaCharger==="function"&&typeof cp!=="undefined"&&cp)cpaCharger();
  const la=document.querySelector('#menuTiroir .langmenu a[aria-current="true"]'),ld=menuEl("menuLangueActuelle");if(la&&ld)ld.textContent=la.textContent;
  const b=menuEl("menuBadgesCompte");
  if(b){const vis=BADGES.filter(bxVisible);b.textContent=prog.badges.filter(id=>vis.some(x=>x.id===id)).length+"/"+vis.length;}
  menuPoint();
}
function menuStats(){
  ensureProgFields();
  const bx=bxEtat(),vis=BADGES.filter(bxVisible);
  const finales=["kq","kr","krr","kbn","kp"].filter(e=>(prog.endgames||{})[e]!==undefined).length;
  const tuiles=[
    ["Rating",prog.rating||800],
    ["Puzzles solved",prog.solved||0],
    ["Days in a row",prog.days||0],
    ["Days played",Object.keys(bx.j).length],
    ["Badges",prog.badges.filter(id=>vis.some(x=>x.id===id)).length+"/"+vis.length],
    ["Sprint record",prog.rushBest||0],
    ["Coordinates record",prog.coordBest||0],
    ["Endgames won",finales+"/5"]
  ];
  /* Graphes (2026-11-16, demande d'Alexandre) : le classement dans le temps
     (meme dessin que dans Exercices) avec son explication, et les exercices
     reussis par jour sur 30 jours. */
  poserHtml(menuEl("menuStats"),'<div class="menu-tuiles">'+tuiles.map(([l,v])=>
    '<div class="menu-tuile"><b>'+echapper(String(v))+'</b><span>'+echapper(t(l))+"</span></div>").join("")+"</div>"+
    '<p class="tiroir-section">'+echapper(t("Rating over time"))+"</p>"+
    '<div class="graph ratinggraph menu-graphe" id="menuRatingGraph"></div>'+
    '<details class="menu-explication"><summary>'+echapper(t("How does the rating work?"))+"</summary>"+
    ["Your rating estimates your level at puzzles. You start at 800.",
     "Each puzzle has its own rating, set by its difficulty. Solving it on the first try earns points, more if it is harder than your level. A mistake, a hint or the solution costs points, once per puzzle, even if you move on.",
     "Only the puzzles in Puzzles count. The puzzle of the day and the Sprint do not change it.",
     "It is a chang64 measure: it cannot be compared directly with a FIDE rating or another site's."].map(x=>"<p>"+echapper(t(x))+"</p>").join("")+"</details>"+
    (estMembre()?'<p class="tiroir-section">'+echapper(t("Puzzles solved, last 30 days"))+"</p>"+
    '<div class="graph menu-graphe" id="menuJoursGraph"></div>':"")+
    /* Parties en direct (2026-11-19) : comptees par le serveur, lues sur la fiche du membre. */
    '<p class="cp-note" id="menuDirect" hidden></p>');
  if(estMembre()&&typeof cppLire==="function"&&typeof cp!=="undefined"&&cp){
    cppLire(cp.pseudo).then(j=>{
      const e=menuEl("menuDirect"),d=j&&j.dir;
      if(!e||!d||!(d.v+d.n+d.d>0))return;
      e.textContent=t("Live games: {v} won, {n} drawn, {d} lost",{v:d.v,n:d.n,d:d.d});e.hidden=false;
    }).catch(()=>{});
  }
  drawRatingGraph(menuEl("menuRatingGraph"));
  if(estMembre())menuJoursGraphe(menuEl("menuJoursGraph"));
  menuChiffres();
}
/* Les chiffres des tuiles montent a l'ouverture des statistiques, comme ceux
   de l'accueil (2026-11-18, demande d'Alexandre). Seul le premier nombre
   d'une tuile bouge ("12/246" : le 12). Rien en mouvement reduit. */
let menuChiffresRaf=0;
function menuChiffres(){
  const tuiles=[...menuEl("menuStats").querySelectorAll(".menu-tuile b")].map(el=>{
    const m=/^(\d+)(.*)$/.exec(el.textContent);
    return m?{el:el,n:+m[1],suite:m[2],fin:el.textContent}:null;
  }).filter(Boolean);
  cancelAnimationFrame(menuChiffresRaf);
  if(!tuiles.length||(typeof mouvementCalme==="function"&&mouvementCalme())||!window.requestAnimationFrame)return;
  for(const x of tuiles)x.el.textContent="0"+x.suite;
  const t0=performance.now();
  const pas=now=>{
    let fini=true;
    tuiles.forEach((x,i)=>{
      const k=Math.max(0,Math.min(1,(now-t0-120-i*60)/800));
      if(k<1)fini=false;
      x.el.textContent=k<1?Math.round(x.n*(1-Math.pow(1-k,3)))+x.suite:x.fin;
    });
    menuChiffresRaf=fini?0:requestAnimationFrame(pas);
  };
  menuChiffresRaf=requestAnimationFrame(pas);
}
/* Exercices reussis par jour, 30 derniers jours (prog.solveLog : un
   horodatage par reussite, 500 au plus). Barres en laiton, aujourd'hui en
   plein ; trois dates sous l'axe ; le meilleur jour indique en haut. */
function menuJoursGraphe(el){
  if(!el)return;
  const N=30,w=300,h=90,padL=6,padR=6,padT=14,padB=16,plotW=w-padL-padR,plotH=h-padT-padB;
  const jour=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x.getTime();};
  const auj=jour(Date.now()),compte=new Array(N).fill(0);
  for(const ts of prog.solveLog||[]){const i=N-1-Math.round((auj-jour(ts))/864e5);if(i>=0&&i<N)compte[i]++;}
  const total=compte.reduce((a,b)=>a+b,0),max=Math.max(1,...compte);
  const fmt=i=>{const d=new Date(auj-(N-1-i)*864e5),mo=String(d.getMonth()+1).padStart(2,"0"),da=String(d.getDate()).padStart(2,"0");
    return LANG==="en"?mo+"/"+da:["de","ru","tr","pl"].includes(LANG)?da+"."+mo:da+"/"+mo;};
  let s="";
  if(!total){
    s='<line x1="10" y1="'+(h/2)+'" x2="'+(w-10)+'" y2="'+(h/2)+'" stroke="rgba(239,233,217,.18)" stroke-width="1" stroke-dasharray="4 4"/>'+
      '<text x="'+(w/2)+'" y="'+(h/2-10)+'" text-anchor="middle" fill="var(--sage)" font-size="10">'+echapper(t("Solve a few puzzles to see your progress here."))+"</text>";
  }else{
    const bw=plotW/N;
    compte.forEach((c,i)=>{
      if(!c)return;
      const bh=Math.max(2,c/max*plotH),x=padL+i*bw+bw*.15,y=padT+plotH-bh;
      s+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+(bw*.7).toFixed(1)+'" height="'+bh.toFixed(1)+'" rx="1.5" style="fill:var(--brass)" opacity="'+(i===N-1?1:.6)+'"><title>'+fmt(i)+" : "+c+"</title></rect>";
    });
    s+='<line x1="'+padL+'" y1="'+(padT+plotH)+'" x2="'+(w-padR)+'" y2="'+(padT+plotH)+'" stroke="rgba(239,233,217,.18)" stroke-width="1"/>';
    for(const [i,a] of [[0,"start"],[Math.floor(N/2),"middle"],[N-1,"end"]])
      s+='<text x="'+(a==="start"?padL:a==="end"?w-padR:padL+(i+.5)*plotW/N)+'" y="'+(h-3)+'" text-anchor="'+a+'" fill="var(--sage)" font-size="8.5">'+fmt(i)+"</text>";
    s+='<text x="'+(w-padR)+'" y="9" text-anchor="end" fill="var(--sage)" font-size="8.5">'+echapper(t("Best day: {n}",{n:max}))+"</text>"+
      '<text x="'+padL+'" y="9" text-anchor="start" fill="var(--chalk)" font-size="8.5">'+echapper(t("{n} in 30 days",{n:total}))+"</text>";
  }
  poserHtml(el,'<svg viewBox="0 0 '+w+" "+h+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+echapper(t("Puzzles solved, last 30 days")+" : "+total)+'">'+s+"</svg>");
}
function menuBadges(){
  /* Meme grille que la collection de Resoudre (renderBadges), dessinee ici. */
  const g=menuEl("menuBadgeGrid");if(g)renderBadges(g);
}
function menuListeNouveautes(){
  const el=menuEl("menuNouveautes");
  const dessiner=()=>{
    const vu=menuVu();
    poserHtml(el,(menuNouveautes||[]).map((n,i)=>
      '<article class="menu-nouveaute'+(i<MENU_NOMBRE-vu?" neuve":"")+'"><time datetime="'+n.d+'">'+echapper(fmtDayMonth(new Date(n.d+"T12:00:00"))+"/"+n.d.slice(0,4))+"</time>"+
      "<h3>"+echapper(n.t)+"</h3><p>"+echapper(n.x)+"</p></article>").join(""));
    try{localStorage.setItem("chang64:nouveautesLues",String(MENU_NOMBRE));}catch(e){}
    menuPoint();
  };
  if(menuNouveautes){dessiner();return;}
  if(typeof fetch!=="function")return;
  fetch("/data/nouveautes-"+bxLangue()+".json").then(r=>r.json()).then(l=>{menuNouveautes=l;dessiner();}).catch(()=>{});
}
/* Branchements. */
{
  const b=menuEl("btnMenu"),r=menuEl("menuTiroir");
  if(b&&r){
    b.addEventListener("click",()=>r.hidden?menuOuvrir():menuFermer());
    menuEl("menuFermer").addEventListener("click",menuFermer);
    menuEl("menuRetour").addEventListener("click",()=>menuVue("accueil"));
    {const d=menuEl("btnResetDemande"),n=menuEl("btnResetNon"),o=menuEl("btnReset");
      if(d)d.addEventListener("click",()=>{menuResetArmer(true);if(n)n.focus();});
      if(n)n.addEventListener("click",()=>menuVue("accueil"));
      if(o)o.addEventListener("click",()=>setTimeout(menuFermer,0));}
    r.addEventListener("click",e=>{
      if(e.target.closest("[data-fermer]")){menuFermer();return;}
      const v=e.target.closest("[data-vue]");if(v){menuVue(v.dataset.vue);return;}
      const a=e.target.closest("[data-aller]");
      if(a){
        menuFermer();
        const cible={prefs:"footPrefs",access:"footAccess",legal:"footLegal",privacy:"footPrivacy"}[a.dataset.aller];
        const f=menuEl(cible);if(f)setTimeout(()=>f.click(),mouvementCalme()?0:200);
      }
    });
    /* Echap ferme ; Tab reste dans le tiroir tant qu'il est ouvert. */
    document.addEventListener("keydown",e=>{
      if(r.hidden)return;
      if(e.key==="Escape"){e.preventDefault();menuFermer();return;}
      if(e.key!=="Tab")return;
      const f=[...r.querySelectorAll("button,a[href],input,[tabindex]:not([tabindex='-1'])")].filter(x=>x.offsetParent);
      if(!f.length)return;
      const i=f.indexOf(document.activeElement);
      if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus();}
      else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus();}
    });
    menuTraduire();
    setTimeout(menuPoint,0);
  }
}
