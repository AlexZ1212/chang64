/* ==========================================================
   WEB APP : TUTORIEL ET SUGGESTION D'INSTALLATION (2026-11-16)
   ========================================================== */
/* Une ligne "Installer l'app" dans le menu ouvre une vue qui en explique
   les benefices et les etapes, en commencant par l'appareil du visiteur
   (iPhone et iPad, Android, ordinateur). Quand le navigateur le permet
   (beforeinstallprompt, voir ui3.js), un bouton installe directement.
   Une suggestion discrete apparait dans le bilan de seance (fin de serie,
   jamais pendant le jeu), au plus une fois tous les 14 jours, sur
   telephone et si l'app n'est pas deja installee. Colle apres themes.js. */
function appPlateforme(){
  const ua=navigator.userAgent||"";
  if(/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1))return "ios";
  if(/Android/.test(ua))return "android";
  return "ordi";
}
function appEtapes(p){
  const li=l=>"<ol class=\"app-etapes\">"+l.map(x=>"<li>"+echapper(t(x))+"</li>").join("")+"</ol>";
  if(p==="ios")return "<h4>"+echapper(t("On iPhone and iPad (Safari)"))+"</h4>"+li(["Tap the Share button (the square with an arrow pointing up).","Choose “Add to Home Screen”.","Tap “Add”."]);
  if(p==="android")return "<h4>"+echapper(t("On Android (Chrome)"))+"</h4>"+li(["Open the Chrome menu (⋮).","Choose “Install app” or “Add to Home screen”."]);
  return "<h4>"+echapper(t("On a computer (Chrome, Edge)"))+"</h4>"+li(["Click the install icon at the right of the address bar."]);
}
function appVue(){
  const v=$("menuAppVue");if(!v)return;
  const p=appPlateforme(),deja=typeof estDejaInstallee==="function"&&estDejaInstallee();
  const avantages=["Full screen, without the browser bar.","An icon on your home screen, one tap away.","Works offline for what is already loaded.","Nothing to update: always the latest version."];
  let h='<p class="app-intro">'+echapper(t("chang64 installs like an app, for free, without going through a store."))+"</p>"+
    '<ul class="app-avantages">'+avantages.map(x=>"<li>"+echapper(t(x))+"</li>").join("")+"</ul>";
  if(deja)h+='<p class="app-deja">'+echapper(t("Already installed. Thanks!"))+"</p>";
  else{
    h+='<p class="tiroir-section">'+echapper(t("How to install it"))+"</p>";
    if(installEvent)h+='<button type="button" class="btn primary app-installer" data-app-installer>'+echapper(t("Install now"))+"</button>";
    h+='<div class="app-bloc">'+appEtapes(p)+"</div>";
    h+='<details class="app-autres"><summary>'+echapper(t("Other devices"))+"</summary>"+["ios","android","ordi"].filter(x=>x!==p).map(appEtapes).join("")+"</details>";
  }
  poserHtml(v,h);
}
{
  const av=menuVue;
  menuVue=function(nom){
    const v=$("menuAppVue");
    if(nom!=="app"){if(v)v.hidden=true;return av.apply(this,arguments);}
    for(const e of document.querySelectorAll("#menuTiroir .tiroir-vue"))e.hidden=e!==v;
    $("menuTitre").textContent=t("Install the app");
    $("menuRetour").hidden=false;
    appVue();
    if(v){v.scrollTop=0;if(!mouvementCalme()&&v.animate)v.animate([{opacity:0,transform:"translateX(18px)"},{opacity:1,transform:"none"}],{duration:260,easing:"cubic-bezier(.22,.7,.3,1)"});}
  };
}
document.addEventListener("click",e=>{
  if(e.target.closest("[data-vue-app]")){menuVue("app");return;}
  if(e.target.closest("[data-app-installer]")&&installEvent){
    installEvent.prompt();
    Promise.resolve(installEvent.userChoice).catch(()=>{}).then(()=>{installEvent=null;appVue();});
  }
});
/* Ligne du menu : masquee dans l'app deja installee. */
{const l=$("menuAppLigne");if(l&&typeof estDejaInstallee==="function"&&estDejaInstallee())l.hidden=true;}
/* Suggestion dans le bilan de seance. */
const APP_SUGG_CLE="chang64:suggestionApp",APP_SUGG_DELAI=14*864e5;
{
  const av=bilanOuvrir;
  bilanOuvrir=function(){
    const r=av.apply(this,arguments);
    const z=$("bilanApp");if(!z)return r;
    let dernier=0;try{dernier=+(localStorage.getItem(APP_SUGG_CLE)||0);}catch(e){}
    const montrer=appPlateforme()!=="ordi"&&!(typeof estDejaInstallee==="function"&&estDejaInstallee())&&Date.now()-dernier>APP_SUGG_DELAI;
    z.hidden=!montrer;
    if(montrer){
      try{localStorage.setItem(APP_SUGG_CLE,String(Date.now()));}catch(e){}
      $("bilanAppTexte").textContent=t("Play faster: install the app on your phone.");
      const b=$("bilanAppBouton");b.textContent=t("Install the app");
      b.onclick=()=>{bilanFermer();menuOuvrir();menuVue("app");};
    }
    return r;
  };
}
/* Accessibilite : l'adresse pour signaler un obstacle. */
{const c=$("a11yContact");if(c)c.textContent=t("Something gets in your way? Write to us at {email}.",{email:"contact@chang64.com"});}
