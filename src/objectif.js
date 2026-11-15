/* ==========================================================
   OBJECTIF DU JOUR ET GEL DE SERIE (2026-11-15)
   ========================================================== */
/* Objectif du jour : un nombre d'exercices a reussir chaque jour (3 par
   defaut ; 1, 3, 5 ou 10 dans les Preferences), compte par badges.js
   (prog.bx.c.jour / jourN, tous les exercices reussis du jour). L'anneau de
   Resoudre et celui du menu se remplissent ; atteint, il se ferme en jade
   avec une coche, un carillon et le badge "Objectif atteint".
   Gel de serie : 7 jours d'affilee avec l'objectif atteint rapportent un gel
   (2 au plus). Quand la serie de l'exercice du jour reprend apres un ou
   plusieurs jours manques, un gel par jour manque la sauve, si on en a assez
   (badge "Glacon"). Colle apres menu.js par build_site.js. */
const OBJ_CHOIX=[1,3,5,10],OBJ_GELS_MAX=2,OBJ_JOURS_GEL=7;
function objEtat(){
  const c=bxEtat().c;
  if(!OBJ_CHOIX.includes(c.objectif))c.objectif=3;
  if(typeof c.gels!=="number")c.gels=0;
  return c;
}
function objFaits(){const c=objEtat();return c.jour===bxCle(new Date())?(c.jourN||0):0;}
function objMaj(pulse){
  const c=objEtat(),n=objFaits(),cible=c.objectif,ok=n>=cible;
  const reste=Math.max(0,100-Math.round(100*Math.min(n,cible)/cible));
  for(const id of ["objectifAnneau","menuObjectifAnneau"]){
    const a=$(id);if(!a)continue;
    a.style.setProperty("--obj",String(reste));
    a.classList.toggle("obj-atteint",ok);
    if(pulse&&!mouvementCalme()){a.classList.remove("obj-pulse");void a.getBoundingClientRect();a.classList.add("obj-pulse");}
  }
  const txt=ok?t("Goal reached!")+" "+t("{n}/{total} today",{n:n,total:cible}):t("{n}/{total} today",{n:n,total:cible});
  const ct=$("objectifCompte");if(ct)ct.textContent=txt;
  const mo=$("menuObjectif");if(mo)mo.textContent=n+"/"+cible;
  const g=$("objectifGels");
  if(g){g.hidden=!c.gels;g.textContent="❄ "+c.gels;g.title=t("Streak freezes")+" : "+c.gels;g.setAttribute("aria-label",t("Streak freezes")+" : "+c.gels);}
}
/* Exercice reussi : l'objectif est-il atteint a l'instant ? Alors serie
   d'objectifs (pour les gels), carillon, badge. */
{
  const av=finishPuzzle;
  finishPuzzle=function(won){
    const avant=objFaits(),r=av.apply(this,arguments);
    if(won){
      const c=objEtat(),apres=objFaits();
      if(avant<c.objectif&&apres>=c.objectif){
        const auj=bxCle(new Date()),hier=new Date();hier.setDate(hier.getDate()-1);
        if(c.objDernier!==auj){
          c.objSerie=c.objDernier===bxCle(hier)?(c.objSerie||0)+1:1;
          c.objDernier=auj;
          if(c.objSerie%OBJ_JOURS_GEL===0&&c.gels<OBJ_GELS_MAX){c.gels++;objAnnoncer(t("You earned a streak freeze."));}
        }
        bxMarquer("obj_atteint");
        if(typeof SON!=="undefined"&&SON.medaille)SON.medaille(0.25,true);
        bxVerifier();
      }
      objMaj(true);
    }
    return r;
  };
}
/* Serie de l'exercice du jour (bumpStreak, ui2.js) : des jours manques
   depuis le dernier jour joue ? Un gel par jour manque, si on en a assez ;
   la serie continue alors comme si on avait joue hier. */
{
  const av=bumpStreak;
  bumpStreak=function(){
    ensureProgFields();
    const c=objEtat(),auj=new Date(),cle=bxCle(auj);
    if(prog.lastDay&&prog.lastDay!==cle&&prog.days>0){
      const manques=Math.round((new Date(cle+"T12:00:00")-new Date(prog.lastDay+"T12:00:00"))/864e5)-1;
      if(manques>=1&&manques<=c.gels){
        c.gels-=manques;
        const hier=new Date(auj);hier.setDate(hier.getDate()-1);
        prog.lastDay=bxCle(hier);
        bxMarquer("obj_gel");
        objAnnoncer(t("Your streak is saved: a freeze was used."));
        objMaj(false);
      }
    }
    return av.apply(this,arguments);
  };
}
/* Petit bandeau en haut de l'ecran (serie sauvee, gel gagne). */
function objAnnoncer(msg){
  let b=document.getElementById("objAnnonce");
  if(!b){b=document.createElement("div");b.id="objAnnonce";b.className="obj-annonce";b.setAttribute("role","status");document.body.appendChild(b);}
  b.textContent="❄ "+msg;
  requestAnimationFrame(()=>b.classList.add("visible"));
  clearTimeout(b._t);b._t=setTimeout(()=>b.classList.remove("visible"),4200);
}
/* Reglage dans les Preferences. */
function objReglage(){
  const s=$("segObjectif");if(!s)return;
  const c=objEtat();
  poserHtml(s,"");
  for(const v of OBJ_CHOIX){
    const b=document.createElement("button");
    b.type="button";b.setAttribute("role","radio");b.setAttribute("data-v",String(v));
    b.setAttribute("aria-checked",String(v===c.objectif));
    b.textContent=String(v);
    b.onclick=()=>{objEtat().objectif=v;saveProg();objReglage();objMaj(false);};
    s.appendChild(b);
  }
  const l=$("prefsObjectifLabel");if(l)l.textContent=t("Daily goal");
  const n=$("prefsObjectifNote");if(n)n.textContent=t("Puzzles to solve each day. Reach it 7 days in a row to earn a streak freeze.");
}
if(typeof renderPrefs==="function"){const av=renderPrefs;renderPrefs=function(){const r=av.apply(this,arguments);objReglage();return r;};}
/* Libelles, et mise a jour a l'ouverture du menu et des ecrans. */
{
  const tt=$("objectifTitre");if(tt)tt.textContent=t("Daily goal");
  const av=menuResume;menuResume=function(){const r=av.apply(this,arguments);objMaj(false);return r;};
  const r=$("menuTiroir");
  if(r)r.addEventListener("click",e=>{
    if(!e.target.closest("[data-aller-objectif]"))return;
    menuFermer();
    setTimeout(()=>{setMode("puzzles");const c=$("cardSolvePuzzles");if(c)c.click();},mouvementCalme()?0:200);
  });
  setTimeout(()=>{objMaj(false);objReglage();},2600);
}
