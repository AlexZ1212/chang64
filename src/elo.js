/* ==========================================================
   ELO DU JOUEUR CONTRE L'ORDINATEUR (2026-11-21, decision d'Alexandre)
   ==========================================================
   Un classement de parties, distinct du classement d'exercices : pour tous,
   avec ou sans compte, calcule dans le navigateur. Il est garde dans la
   progression (prog.eloOrdi), donc synchronise avec un compte sans table
   nouvelle. Le serveur le borne (voir eloOrdiPropre, cote serveur) mais ne
   peut pas le verifier : il n'entre dans aucun tableau public.

   prog.eloOrdi = { r : classement, n : parties classees, pic : record,
                    h : [[date, classement], ...] les 50 derniers points }
   La cle prog.eloOrdi.r est lue par eloJoueurOrdi() (ui.js) pour regler
   l'ordinateur "a ma mesure" : tant qu'aucune partie n'a compte, le champ
   n'existe pas et ui.js se rabat sur le classement d'exercices.

   Formule : attendu = 1 / (1 + 10^((adversaire - joueur) / 400)) ;
   variation = K x (resultat - attendu), resultat = 1, 0,5 ou 0 ;
   K = 40 pendant les 20 premieres parties, 20 ensuite ; depart a 800.

   Partie classee : terminee (mat, nulle, abandon, temps), au moins 4 coups
   du joueur, partie de la position initiale. Une position preparee
   (gameStartFen) ou une partie quittee sans abandonner ne comptent pas. */
const ELO_DEPART=800,ELO_PLANCHER=100,ELO_PLAFOND=3000,ELO_K_DEBUT=40,ELO_K_SUITE=20,ELO_PROVISOIRE=20;
const ELO_POINTS=50,ELO_SANS_COMPTE=10,ELO_COUPS_MIN=4;
function eloAttendu(joueur,adversaire){return 1/(1+Math.pow(10,(adversaire-joueur)/400));}
/* Variation entiere : le classement reste un nombre entier, et le serveur
   peut borner un saut a 40 points par partie comptee. */
function eloVariation(joueur,adversaire,resultat,parties){
  return Math.round((parties<ELO_PROVISOIRE?ELO_K_DEBUT:ELO_K_SUITE)*(resultat-eloAttendu(joueur,adversaire)));
}
function eloValide(e){return !!(e&&typeof e==="object"&&typeof e.r==="number"&&isFinite(e.r)&&typeof e.n==="number"&&e.n>=0);}
function eloEtat(){return typeof prog!=="undefined"&&prog&&eloValide(prog.eloOrdi)?prog.eloOrdi:null;}
/* Compte une partie finie. p : l'entree de l'historique ({c,r,elo,m,fen}).
   Rend ce qui a change, ou null si la partie ne compte pas. */
function eloCompter(p){
  if(!p||p.fen||p.ent||typeof p.elo!=="number"||typeof p.m!=="string")return null;
  const demi=p.m.split(" ").filter(Boolean).length;
  if((p.c==="w"?Math.ceil(demi/2):Math.floor(demi/2))<ELO_COUPS_MIN)return null;
  const s=p.r==="win"?1:p.r==="draw"?0.5:p.r==="loss"?0:null;
  if(s===null)return null;
  const av=eloEtat(),avant=av?Math.round(av.r):ELO_DEPART,n=av?Math.floor(av.n):0;
  const picAvant=av&&typeof av.pic==="number"?av.pic:avant;
  const r=Math.max(ELO_PLANCHER,Math.min(ELO_PLAFOND,avant+eloVariation(avant,p.elo,s,n)));
  const t0=typeof p.t==="number"?p.t:Date.now();
  /* Le premier point de la courbe est le depart, pour qu'une seule partie
     trace deja un trait. */
  const h=(av&&Array.isArray(av.h)&&av.h.length?av.h.slice():[[t0-1,avant]]).concat([[t0,r]]).slice(-ELO_POINTS);
  prog.eloOrdi={r:r,n:n+1,pic:Math.max(picAvant,r),h:h};
  if(typeof saveProg==="function")saveProg();
  return {d:r-avant,r:r,n:n+1,record:n>=ELO_PROVISOIRE&&r>picAvant,m:p.m};
}
/* Derniere partie comptee : ce que la carte de fin de partie affiche. */
let eloDernier=null,eloRappelFait=false;
if(typeof saveFinishedGame==="function"){
  const av=saveFinishedGame;
  saveFinishedGame=function(){
    const avant=gameSaved,r=av.apply(this,arguments);
    if(!avant&&gameSaved){
      eloDernier=resultInfo&&history[0]?eloCompter(history[0]):null;eloRappel();
      /* Badges de palier (eo_*, badges.js) : l'Elo vient de bouger, apres la
         verification faite par badges.js sur cette meme fin de partie. */
      if(eloDernier&&typeof bxVerifier==="function")bxVerifier();
    }
    return r;
  };
}
/* Rappel vers le compte : une ligne, jamais une fenetre, a trois moments
   seulement (3e partie classee, classement etabli a la 20e, record ensuite)
   et une fois par session au plus. Rien pour un membre. */
function eloRappel(){
  if(!eloDernier)return;
  eloDernier.rappel="";
  if(eloRappelFait||(typeof estMembre==="function"&&estMembre()))return;
  const e=eloDernier;
  const texte=e.n===3?t("Your Elo lives in this browser. Create a free account to keep it and find it on your phone."):
    e.n===ELO_PROVISOIRE?t("Your Elo is settled at ≈ {r}. Keep it with a free account.",{r:e.r}):
    e.record?t("New record: {r}. Keep it in your account.",{r:e.r}):"";
  if(texte){e.rappel=texte;eloRappelFait=true;}
}
/* Carte de fin de partie : "+12 Elo" et le nouveau classement. Les
   recompenses ne s'affichent qu'en fin de partie (regle du site). */
function eloCarte(){
  const l=$("resultElo"),n=$("resultEloNote");
  if(!l||!n)return;
  /* Partie en direct : l'Elo entre membres, calcule par le serveur. */
  if(typeof directActif==="function"&&directActif()){
    const d=typeof directE!=="undefined"&&directE&&directE.phase==="fin"&&directE.elo?directE.elo[directE.moi]:null;
    const la=!!(d&&resultInfo&&typeof d.d==="number"&&typeof d.r==="number");
    l.classList.toggle("hide",!la);n.classList.add("hide");
    /* La famille de la cadence est dite : chaque famille a son Elo. */
    if(la)poserHtml(l,"<b>"+(d.d<0?"\u2212":"+")+Math.abs(d.d)+" Elo</b> "+echapper(t(ELO_FAMILLE_PHRASE[directE.elo.f]||"{r} between members",{r:d.r})));
    return;
  }
  const e=eloDernier;
  const ici=!!(e&&mode==="play"&&!isReviewGame&&resultInfo&&gameUci.join(" ")===e.m);
  l.classList.toggle("hide",!ici);
  n.classList.toggle("hide",!ici||!e.rappel);
  if(!ici)return;
  poserHtml(l,"<b>"+(e.d<0?"−":"+")+Math.abs(e.d)+" Elo</b> "+echapper(t("≈ {r} against the computer",{r:e.r})));
  if(e.rappel)poserHtml(n,echapper(e.rappel)+' <button type="button" class="linkbtn" data-vue-compte="1">'+echapper(t("Create an account"))+"</button>");
}
if(typeof renderResult==="function"){
  const av=renderResult;
  renderResult=function(){const r=av.apply(this,arguments);try{eloCarte();}catch(e){}return r;};
}
/* Ma progression : chiffres, courbe et explication. Sans compte, la courbe
   ne montre que les 10 dernieres parties, avec une ligne qui le dit. */
/* apresTuiles : ce que l'ecran des statistiques pose entre les chiffres et la
   courbe (la barre gagnees / nulles / perdues). Le titre de la categorie est
   pose par menu.js ; ce bloc ne porte que ses petits titres. */
function eloBloc(apresTuiles){
  const e=eloEtat(),membre=typeof estMembre==="function"&&estMembre();
  const der=e&&Array.isArray(e.h)&&e.h.length>1?e.h[e.h.length-1][1]-e.h[e.h.length-2][1]:null;
  const tuiles=[
    ["Elo",e?Math.round(e.r):"–"],
    ["Best",e?Math.round(typeof e.pic==="number"?e.pic:e.r):"–"],
    ["Rated games",e?Math.floor(e.n):0],
    ["Last game",der===null?"–":(der<0?"−":"+")+Math.abs(der)]
  ];
  return '<div class="menu-tuiles" id="menuEloTuiles">'+tuiles.map(([l,v])=>
      '<div class="menu-tuile"><b>'+echapper(String(v))+"</b><span>"+echapper(t(l))+"</span></div>").join("")+"</div>"+
    (apresTuiles||"")+
    '<p class="tiroir-section">'+echapper(t("Elo over time"))+"</p>"+
    '<div class="graph ratinggraph menu-graphe" id="menuEloGraph"></div>'+
    (membre?"":'<p class="cp-note" id="menuEloSansCompte">'+echapper(t("Without an account, the last 10 games are shown."))+"</p>")+
    '<details class="menu-explication"><summary>'+echapper(t("How does this Elo work?"))+"</summary>"+
    ["Your Elo measures your level in games against the computer. You start at 800.",
     "A win earns points and a loss costs points. Beating a stronger computer earns more; losing to a weaker one costs more.",
     "Only finished games count: at least 4 moves, from the starting position. The first 20 games move it faster.",
     "It is a chang64 measure: it cannot be compared directly with a FIDE rating or another site's."].map(x=>"<p>"+echapper(t(x))+"</p>").join("")+"</details>";
}
/* Elo entre membres dans Ma progression : rempli par menu.js une fois la
   fiche du membre lue (le chiffre vient du serveur). */
/* Un Elo entre membres par famille de cadences (2026-11-21 au soir, decision
   d'Alexandre) : Blitz, Rapide, Classique, Correspondance, dans cet ordre.
   La fiche du serveur les rend dans ef ; une reponse d'avant ne porte que em,
   qui est le Rapide. */
const ELO_FAMILLES=[["b","Blitz"],["r","Rapid"],["c","Classical"],["k","Correspondence"]];
const ELO_FAMILLE_PHRASE={b:"{r} in Blitz",r:"{r} in Rapid",c:"{r} in Classical",k:"{r} in Correspondence"};
function eloFamilles(j){
  const f=j&&j.ef&&typeof j.ef==="object"?j.ef:(j&&j.em?{r:j.em}:null);
  return f&&ELO_FAMILLES.some(([c])=>f[c]&&f[c].n>0)?f:null;
}
/* Les quatre lignes ; un tiret tant qu'aucune partie de la famille n'a compte.
   avecParties : le nombre de parties comptees, pour Ma progression. */
function eloFamillesHtml(f,avecParties){
  return '<ul class="elo-familles">'+ELO_FAMILLES.map(([c,nom])=>{
    const x=f[c],la=!!(x&&x.n>0);
    return '<li data-f="'+c+'"><span>'+echapper(t(nom))+"</span>"+
      (la?"<b>"+Math.round(x.r)+"</b>":'<b class="vide"><span aria-hidden="true">–</span><span class="visually-hidden">'+echapper(t("No game of this kind yet."))+"</span></b>")+
      (avecParties?'<span class="elo-parties">'+(la?echapper(t(x.n===1?"{n} game":"{n} games",{n:x.n})):"")+"</span>":"")+"</li>";
  }).join("")+"</ul>";
}
/* Fiche d'un joueur : le titre et les quatre lignes, ou rien. */
function eloFamillesFiche(j){
  const f=eloFamilles(j);
  return f?'<div class="cpp-elo-membres"><p class="tiroir-section cpp-direct-titre">'+echapper(t("Elo between members"))+"</p>"+eloFamillesHtml(f,false)+"</div>":"";
}
/* Dans les statistiques, les quatre Elo sont des tuiles, comme l'Elo contre
   l'ordinateur (2026-11-22 : un meme aspect pour un meme type de chiffre). La
   liste a lignes reste celle de la fiche d'un joueur. */
function eloFamillesTuiles(f){
  return '<div class="menu-tuiles">'+ELO_FAMILLES.map(([c,nom])=>{
    const x=f[c],la=!!(x&&x.n>0);
    return '<div class="menu-tuile" data-f="'+c+'">'+
      (la?"<b>"+Math.round(x.r)+"</b>":'<b class="vide"><span aria-hidden="true">–</span><span class="visually-hidden">'+echapper(t("No game of this kind yet."))+"</span></b>")+
      "<span>"+echapper(t(nom))+"</span>"+
      '<small class="elo-parties">'+(la?echapper(t(x.n===1?"{n} game":"{n} games",{n:x.n})):"")+"</small></div>";
  }).join("")+"</div>";
}
function eloMembresBloc(){
  return '<div id="menuEloMembres" hidden><p class="tiroir-section">'+echapper(t("Elo between members"))+'</p><div id="menuEloFamilles"></div></div>';
}
function eloMembresRemplir(j){
  const b=$("menuEloMembres"),f=eloFamilles(j);
  if(!b||!f)return;
  poserHtml($("menuEloFamilles"),eloFamillesTuiles(f));
  b.hidden=false;
}
function eloCourbe(el){
  if(!el||typeof traceCourbe!=="function")return;
  const e=eloEtat(),membre=typeof estMembre==="function"&&estMembre();
  let h=e&&Array.isArray(e.h)?e.h.filter(x=>Array.isArray(x)&&typeof x[0]==="number"&&typeof x[1]==="number").map(x=>({t:x[0],r:x[1]})):[];
  /* 10 parties = 11 points, le premier etant le classement d'avant. */
  if(!membre)h=h.slice(-(ELO_SANS_COMPTE+1));
  traceCourbe(el,h,t("Elo against the computer"),t("Play a few games against the computer to see your Elo here."));
}
