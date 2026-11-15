/* ==========================================================
   MENU (2026-11-15, demande d'Alexandre)
   ========================================================== */
/* Un tiroir qui glisse depuis la droite et reunit ce qui etait disperse :
   statistiques et badges (consultables sans quitter l'ecran en cours),
   nouveautes, preferences, accessibilite, langues, mentions. Colle apres
   badges.js par build_site.js ; __NOUVEAUTES_DATE__ = date de la plus
   recente nouveaute (data/nouveautes-<langue>.json). Un point laiton sur le
   bouton signale une nouveaute pas encore vue (chang64:nouveautesVues). */
const MENU_DERNIERE="__NOUVEAUTES_DATE__";
let menuAvant=null,menuNouveautes=null;
function menuEl(id){return document.getElementById(id);}
function menuVu(){try{return localStorage.getItem("chang64:nouveautesVues")||"";}catch(e){return "";}}
function menuPoint(){
  const nouveau=MENU_DERNIERE>menuVu();
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
  const vues={accueil:"menuAccueil",stats:"menuStats",badges:"menuBadges",nouveautes:"menuNouveautes",langues:"menuLanguesVue"};
  for(const [k,id] of Object.entries(vues)){const e=menuEl(id);if(e)e.hidden=k!==nom;}
  const titres={accueil:"Menu",stats:"Statistics",badges:"Badges",nouveautes:"What's new",langues:"Language"};
  menuEl("menuTitre").textContent=t(titres[nom]);
  menuEl("menuRetour").hidden=nom==="accueil";
  if(nom==="stats")menuStats();
  if(nom==="badges")menuBadges();
  if(nom==="nouveautes")menuListeNouveautes();
  if(nom==="langues"){menuLangues();const a=document.querySelector('#menuTiroir .langmenu a[aria-current="true"]');if(a)setTimeout(()=>a.focus({preventScroll:true}),mouvementCalme()?0:280);}
  const v=menuEl(vues[nom]);if(v){v.scrollTop=0;if(nom!=="accueil"&&!mouvementCalme()&&v.animate)v.animate([{opacity:0,transform:"translateX(18px)"},{opacity:1,transform:"none"}],{duration:260,easing:"cubic-bezier(.22,.7,.3,1)"});}
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
  poserHtml(menuEl("menuStats"),'<div class="menu-tuiles">'+tuiles.map(([l,v])=>
    '<div class="menu-tuile"><b>'+echapper(String(v))+'</b><span>'+echapper(t(l))+"</span></div>").join("")+"</div>");
}
function menuBadges(){
  /* Meme grille que la collection de Resoudre (renderBadges), dessinee ici. */
  const g=menuEl("menuBadgeGrid");if(g)renderBadges(g);
}
function menuListeNouveautes(){
  const el=menuEl("menuNouveautes");
  const dessiner=()=>{
    const vu=menuVu();
    poserHtml(el,(menuNouveautes||[]).map(n=>
      '<article class="menu-nouveaute'+(n.d>vu?" neuve":"")+'"><time datetime="'+n.d+'">'+echapper(fmtDayMonth(new Date(n.d+"T12:00:00"))+"/"+n.d.slice(0,4))+"</time>"+
      "<h3>"+echapper(n.t)+"</h3><p>"+echapper(n.x)+"</p></article>").join(""));
    try{localStorage.setItem("chang64:nouveautesVues",MENU_DERNIERE);}catch(e){}
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
      const f=[...r.querySelectorAll("button,a[href],[tabindex]:not([tabindex='-1'])")].filter(x=>x.offsetParent);
      if(!f.length)return;
      const i=f.indexOf(document.activeElement);
      if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus();}
      else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus();}
    });
    menuTraduire();
    setTimeout(menuPoint,0);
  }
}
