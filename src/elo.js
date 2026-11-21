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
  if(!p||p.fen||typeof p.elo!=="number"||typeof p.m!=="string")return null;
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
    if(!avant&&gameSaved){eloDernier=resultInfo&&history[0]?eloCompter(history[0]):null;eloRappel();}
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
function eloBloc(){
  const e=eloEtat(),membre=typeof estMembre==="function"&&estMembre();
  const der=e&&Array.isArray(e.h)&&e.h.length>1?e.h[e.h.length-1][1]-e.h[e.h.length-2][1]:null;
  const tuiles=[
    ["Elo",e?Math.round(e.r):"–"],
    ["Best",e?Math.round(typeof e.pic==="number"?e.pic:e.r):"–"],
    ["Rated games",e?Math.floor(e.n):0],
    ["Last game",der===null?"–":(der<0?"−":"+")+Math.abs(der)]
  ];
  return '<p class="tiroir-section">'+echapper(t("Elo against the computer"))+"</p>"+
    '<div class="menu-tuiles" id="menuEloTuiles">'+tuiles.map(([l,v])=>
      '<div class="menu-tuile"><b>'+echapper(String(v))+"</b><span>"+echapper(t(l))+"</span></div>").join("")+"</div>"+
    '<div class="graph ratinggraph menu-graphe" id="menuEloGraph"></div>'+
    (membre?"":'<p class="cp-note" id="menuEloSansCompte">'+echapper(t("Without an account, the last 10 games are shown."))+"</p>")+
    '<details class="menu-explication"><summary>'+echapper(t("How does this Elo work?"))+"</summary>"+
    ["Your Elo measures your level in games against the computer. You start at 800.",
     "A win earns points and a loss costs points. Beating a stronger computer earns more; losing to a weaker one costs more.",
     "Only finished games count: at least 4 moves, from the starting position. The first 20 games move it faster.",
     "It is a chang64 measure: it cannot be compared directly with a FIDE rating or another site's."].map(x=>"<p>"+echapper(t(x))+"</p>").join("")+"</details>";
}
function eloCourbe(el){
  if(!el||typeof traceCourbe!=="function")return;
  const e=eloEtat(),membre=typeof estMembre==="function"&&estMembre();
  let h=e&&Array.isArray(e.h)?e.h.filter(x=>Array.isArray(x)&&typeof x[0]==="number"&&typeof x[1]==="number").map(x=>({t:x[0],r:x[1]})):[];
  /* 10 parties = 11 points, le premier etant le classement d'avant. */
  if(!membre)h=h.slice(-(ELO_SANS_COMPTE+1));
  traceCourbe(el,h,t("Elo against the computer"),t("Play a few games against the computer to see your Elo here."));
}
