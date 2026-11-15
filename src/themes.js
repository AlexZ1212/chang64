/* ==========================================================
   THEMES GAGNES PAR LES BADGES (2026-11-15)
   ========================================================== */
/* Neuf ambiances : Chang (offert) et huit a gagner, chacune debloquee par un
   badge. Un theme change toute l'interface (fond, cartes, textes, accent) et
   propose son damier ; les pieces et les medailles ne changent pas. Les
   couleurs vivent dans la feuille (html[data-theme], genere par
   themes_build.js depuis THEMES_COULEURS) ; ici, le choix, le verrou et
   l'annonce. Le damier "Assorti au theme" (data-board="theme") reprend celui
   du theme ; les cinq damiers d'avant restent offerts.
   Un petit script en tete de page pose data-theme et data-board avant le
   premier affichage (pas d'eclair du theme par defaut). Colle apres duel.js
   par build_site.js. */
const THEMES=[{"id":"chang","b":null,"en":"Chang"},{"id":"glace","b":"obj_gel","en":"Ice"},{"id":"jade","b":"defi_parfait","en":"Jade"},{"id":"bibliotheque","b":"ouv_15","en":"Library"},{"id":"hibou","b":"ex_hibou","en":"Owl"},{"id":"siam","b":"mk_facile","en":"Siam night"},{"id":"braise","b":"sprint_20","en":"Ember"},{"id":"fritkot","b":"fete_0801","en":"Fritkot"},{"id":"or","b":"solved_1000","en":"Gold"},{"id":"fetes","b":"saison_fetes","en":"Holidays","s":[1220,106]},{"id":"valentin","b":"saison_valentin","en":"King and Queen","s":[210,216]},{"id":"songkran","b":"saison_songkran","en":"Songkran","s":[413,415]},{"id":"solstice","b":"saison_solstice","en":"Solstice","s":[620,624]},{"id":"mondial","b":"saison_mondial","en":"World chess","s":[715,725]},{"id":"turc","b":"saison_turc","en":"The Turk","s":[1025,1102]}];
/* Point de depart : ce que le script de tete a lu dans les preferences,
   pour ne rien changer a l'affichage avant que tout soit charge. */
let prefTheme=document.documentElement.getAttribute("data-theme")||"chang";
let themeProgLue=false;
function themeOuvert(th){return !th.b||(prog&&Array.isArray(prog.badges)&&prog.badges.includes(th.b));}
function themeNom(th){return t(th.en);}
/* Le verrou ne se verifie qu'une fois la progression lue (sinon un theme
   gagne repasserait a Chang le temps du chargement). Un theme verrouille
   s'affiche en Chang sans effacer le choix enregistre. */
function appliquerTheme(){
  const th=THEMES.find(x=>x.id===prefTheme);
  const effectif=!th?"chang":(!themeProgLue||themeOuvert(th))?prefTheme:"chang";
  const h=document.documentElement;
  if(h.getAttribute("data-theme")!==effectif)h.setAttribute("data-theme",effectif);
  const m=document.querySelector('meta[name="theme-color"]');
  if(m){const c=getComputedStyle(h).getPropertyValue("--ink").trim();if(c&&m.getAttribute("content")!==c)m.setAttribute("content",c);}
}
/* renderProgress est appele une fois la progression chargee (fin de
   l'initialisation, ui.js), puis apres chaque exercice : bon moment pour
   verifier le verrou, et pour suivre un badge perdu (progression remise a
   zero, code de sauvegarde). */
{const av=renderProgress;renderProgress=function(){const r=av.apply(this,arguments);themeProgLue=true;appliquerTheme();return r;};}
/* Le damier assorti rejoint les cinq damiers offerts. */
if(!BOARD_THEMES.some(x=>x.id==="theme"))BOARD_THEMES.unshift({id:"theme",en:"Matching the theme",fr:"Assorti au thème"});
savePrefs=async function(){
  try{await window.storage.set("chang64:prefs",JSON.stringify({board:prefBoard,announce:prefAnnounce,anim:animOn,son:sonOn,theme:prefTheme}));}catch(e){}
};
/* loadPrefs (ui3.js) est deja lance quand ce script s'execute : le theme
   enregistre est relu ici. */
window.storage.get("chang64:prefs").then(s=>{
  try{if(s&&s.value){const d=JSON.parse(s.value);if(THEMES.some(x=>x.id===d.theme))prefTheme=d.theme;}}catch(e){}
  appliquerTheme();
}).catch(()=>{});
function choisirTheme(id){
  const th=THEMES.find(x=>x.id===id);if(!th||!themeOuvert(th))return;
  prefTheme=id;prefBoard="theme";
  appliquerTheme();applyBoardTheme();savePrefs();
  if(typeof announce==="function")announce(t("Theme {name}",{name:themeNom(th)}),"cell");
  rendreThemes();
  const bt=$("boardThemes");if(bt&&typeof renderPrefs==="function"&&$("pane-prefs")&&!$("pane-prefs").classList.contains("hide"))renderPrefs();
}
/* Rangee "Theme" des Preferences : un apercu par theme (fond, carte, accent,
   damier), le nom, et pour un theme verrouille la medaille de son badge.
   Toucher un theme verrouille ouvre la fiche du badge. */
function rendreThemes(){
  const box=$("themeChoix");if(!box)return;
  const lab=$("prefsThemeLabel");if(lab)lab.textContent=t("Site theme");
  if(typeof bxCharger==="function"&&(!bxTextes||!bxMedailles))bxCharger().then(ok=>{if(ok)rendreThemes();});
  let h="";
  for(const th of THEMES){
    const ouvert=themeOuvert(th),actif=th.id===prefTheme;
    h+='<button type="button" class="theme-choix'+(ouvert?"":" verrou")+'" data-theme-id="'+th.id+'" data-apercu="'+th.id+'" role="radio" aria-checked="'+actif+'"'+(ouvert?"":' aria-disabled="true"')+'>'+
      '<span class="theme-apercu" aria-hidden="true"><i class="ta-carte"><b></b><s></s></i><i class="ta-bouton"></i><i class="ta-damier"><u></u><u></u><u></u><u></u></i></span>'+
      '<span class="theme-nom">'+echapper(themeNom(th))+"</span>"+
      (ouvert?"":'<span class="theme-verrou'+(th.s&&saisonEnCours(th.s)?" en-saison":"")+'">'+(typeof bxMedaille==="function"?bxMedaille(th.b,false):"")+"<em>"+echapper(th.s?saisonTexte(th.s):(typeof badgeLabel==="function"?badgeLabel({id:th.b}):th.b))+"</em></span>")+
      "</button>";
  }
  poserHtml(box,h);
}
{
  const box=$("themeChoix");
  if(box)box.addEventListener("click",e=>{
    const b=e.target.closest("[data-theme-id]");if(!b)return;
    const th=THEMES.find(x=>x.id===b.dataset.themeId);if(!th)return;
    if(themeOuvert(th))choisirTheme(th.id);
    else if(typeof bxFiche==="function")bxFiche(th.b);
  });
}
{const av=renderPrefs;renderPrefs=function(){const r=av.apply(this,arguments);rendreThemes();return r;};}
/* ---------- Themes de saison ----------
   s = [debut, fin] en MMJJ (la fin peut passer le 1er janvier : Fetes du
   20 decembre au 6 janvier). Jouer un jour de la periode (exercice reussi,
   partie, finale, Makruk... : tout ce qui appelle bxActivite) donne le badge
   de la saison, qui ouvre le theme pour toute l'annee (choix d'Alexandre,
   15/11). La date est celle de l'appareil. */
function saisonEnCours(s,d){
  d=d||new Date();const md=(d.getMonth()+1)*100+d.getDate();
  return s[0]<=s[1]?md>=s[0]&&md<=s[1]:md>=s[0]||md<=s[1];
}
function saisonDate(mmjj){
  const d=new Date(2024,Math.floor(mmjj/100)-1,mmjj%100);
  try{return new Intl.DateTimeFormat(typeof LANG_INTL!=="undefined"?LANG_INTL:undefined,{day:"numeric",month:"short"}).format(d);}catch(e){return d.getDate()+"/"+(d.getMonth()+1);}
}
function saisonTexte(s){
  return saisonEnCours(s)?t("To earn until {date}",{date:saisonDate(s[1])}):t("From {start} to {end}",{start:saisonDate(s[0]),end:saisonDate(s[1])});
}
if(typeof bxActivite==="function"){
  const av=bxActivite;
  bxActivite=function(){
    const r=av.apply(this,arguments);
    for(const th of THEMES)if(th.s&&saisonEnCours(th.s))bxMarquer(th.b);
    return r;
  };
}
/* Fenetre Bravo et fiche d'un badge : "Theme debloque" et "Essayer" quand
   ce badge ouvre un theme (en fin de partie ou d'exercice, comme toujours). */
function bxPoserTheme(id){
  const z=$("bravoTheme");if(!z)return;
  const th=THEMES.find(x=>x.b===id);
  z.classList.toggle("hide",!th);
  if(!th)return;
  const ouvert=themeOuvert(th);
  $("bravoThemeTexte").textContent=ouvert?t("Theme unlocked: {name}",{name:themeNom(th)}):t("Unlocks the {name} theme",{name:themeNom(th)});
  const b=$("bravoThemeEssai");
  b.hidden=!ouvert||prefTheme===th.id;
  b.textContent=t("Try it");
  b.onclick=()=>{choisirTheme(th.id);b.hidden=true;};
  z.setAttribute("data-apercu",th.id);
}
if(typeof bxPoserLien==="function"){const av=bxPoserLien;bxPoserLien=function(id){const r=av.apply(this,arguments);bxPoserTheme(id);return r;};}
appliquerTheme();
