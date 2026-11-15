/* ==========================================================
   BILAN DE SEANCE (2026-11-15)
   ========================================================== */
/* Tous les 10 exercices termines dans Exercices (reussis ou non, hors
   Sprint), un petit bilan avec l'elephant : resolus, du premier coup,
   classement gagne, meilleure suite sans erreur, objectif du jour, defis,
   badges gagnes pendant la seance. Il attend la fin de l'exercice, la
   fenetre Bravo et les annonces (regle d'Alexandre : jamais pendant).
   Une seance repart a zero apres 30 minutes sans exercice. Colle apres
   defis.js par build_site.js. */
const BILAN_TOUS=10,BILAN_PAUSE=30*60*1000;
let bilanS=null,bilanAttente=false;
function bilanSeance(){
  const now=Date.now();
  if(!bilanS||now-bilanS.dernier>BILAN_PAUSE)
    bilanS={debut:now,dernier:now,faits:0,reussis:0,premier:0,suite:0,meilleure:0,note:prog.rating||800,badges:prog.badges.length,depuis:0};
  return bilanS;
}
{
  const av=finishPuzzle;
  finishPuzzle=function(won){
    const enSprint=!!rush,essais=typeof puzzleTries==="number"?puzzleTries:0;
    const r=av.apply(this,arguments);
    if(enSprint||mode!=="puzzles")return r;
    const s=bilanSeance();
    s.dernier=Date.now();s.faits++;s.depuis++;
    if(won){s.reussis++;if(essais===0){s.premier++;s.suite++;s.meilleure=Math.max(s.meilleure,s.suite);}else s.suite=0;}
    else s.suite=0;
    if(s.depuis>=BILAN_TOUS){s.depuis=0;bilanAttente=true;setTimeout(bilanTenter,1200);}
    return r;
  };
}
{const av=registerWrong;registerWrong=function(){if(bilanS)bilanS.suite=0;return av.apply(this,arguments);};}
function bilanTenter(){
  if(!bilanAttente)return;
  const br=$("bravo"),an=document.getElementById("objAnnonce");
  const occupe=bravoOccupe()||(br&&!br.hidden)||(bravoFile&&bravoFile.length)||(an&&an.classList.contains("visible"))||objFile.length||(typeof duelOuvert==="function"&&duelOuvert());
  if(occupe){setTimeout(bilanTenter,1000);return;}
  bilanAttente=false;bilanOuvrir();
}
function bilanOuvrir(){
  const s=bilanS,r=$("bilan");if(!s||!r)return;
  ensureProgFields();
  const taux=s.faits?s.reussis/s.faits:0;
  $("bilanTitre").textContent=taux>=0.8?t("Brilliant session!"):taux>=0.5?t("Well played!"):t("Every mistake teaches you something.");
  $("bilanSous").textContent=t("{n} puzzles in this session",{n:s.faits});
  const delta=(prog.rating||800)-s.note;
  const tuiles=[
    [s.reussis+"/"+s.faits,"Solved"],
    [String(s.premier),"First try"],
    [(delta>=0?"+":"−")+Math.abs(delta),"Rating"],
    [String(s.meilleure),"Best run"]
  ];
  poserHtml($("bilanTuiles"),tuiles.map(([v,l],i)=>'<div class="bilan-tuile" style="--i:'+i+'"><b>'+echapper(v)+"</b><span>"+echapper(t(l))+"</span></div>").join(""));
  /* Objectif du jour et defis, en une ligne chacun. */
  const c=objEtat(),n=objFaits(),d=defiEtat().defis;
  const lignes=['<li>'+echapper(t("Daily goal"))+"<b>"+Math.min(n,c.objectif)+"/"+c.objectif+(n>=c.objectif?" ✓":"")+"</b></li>",
    '<li>'+echapper(t("Weekly challenges"))+"<b>"+d.ok.filter(Boolean).length+"/3</b></li>"];
  poserHtml($("bilanLignes"),lignes.join(""));
  const gagnes=prog.badges.slice(s.badges);s.badges=prog.badges.length;
  poserHtml($("bilanBadges"),gagnes.slice(0,6).map(id=>bxMedaille(id,true)).join(""));
  $("bilanBadgesBloc").hidden=!gagnes.length;
  /* L'elephant du logo. */
  /* Le signe officiel (src/ds/signe.svg), avec son oeil : evenodd. */
  poserHtml($("bilanMascotte"),'<svg viewBox="0 0 64 64" fill="currentColor"><path fill-rule="evenodd" d="__ELEPHANT_SIGNE__"/></svg>');
  r.hidden=false;
  r.classList.remove("bilan-joue");void r.offsetWidth;r.classList.add("bilan-joue");
  if(typeof SON!=="undefined"&&SON.medaille)SON.medaille(0.3,true);
  bilanAvant=document.activeElement;
  $("bilanOk").focus();
}
let bilanAvant=null;
function bilanFermer(){
  const r=$("bilan");if(!r||r.hidden)return;
  r.hidden=true;
  if(bilanAvant&&bilanAvant.focus&&document.contains(bilanAvant))bilanAvant.focus();
}
{
  const r=$("bilan");
  if(r){
    $("bilanOk").addEventListener("click",bilanFermer);
    r.addEventListener("click",e=>{if(e.target===r)bilanFermer();});
    document.addEventListener("keydown",e=>{if(!r.hidden&&e.key==="Escape"){e.preventDefault();bilanFermer();}});
    const tt=$("bilanEntete");if(tt)tt.textContent=t("Session summary");
    $("bilanOk").textContent=t("Continue");
    const bt=$("bilanBadgesTitre");if(bt)bt.textContent=t("Badges earned");
  }
}
