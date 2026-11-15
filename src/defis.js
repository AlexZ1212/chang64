/* ==========================================================
   DEFIS DE LA SEMAINE (2026-11-15)
   ========================================================== */
/* Trois defis par semaine, renouveles chaque lundi (heure locale), les memes
   pour tout le monde : ils sont tires d'un generateur pseudo-aleatoire
   amorce par la date du lundi, comme l'exercice du jour. Un defi "facile",
   un defi "technique", un defi "variete", sans doublon de type. Les trois
   reussis = semaine parfaite, recompensee par un gel de serie (2 au plus,
   voir objectif.js). La progression vit dans prog.bx.c.defis et repart a
   zero quand le lundi change. Colle apres objectif.js par build_site.js. */
const DEFI_TYPES={
  resoudre:{groupe:"facile",cibles:[15,20,30],texte:"Solve {n} puzzles"},
  jour:{groupe:"facile",cibles:[3,4,5],texte:"Solve the puzzle of the day on {n} days"},
  objectif:{groupe:"facile",cibles:[3,5],texte:"Reach your daily goal on {n} days"},
  jours:{groupe:"facile",cibles:[3,4,5],texte:"Play on {n} different days"},
  motif:{groupe:"technique",cibles:[5,8],texte:"Solve {n} puzzles with the theme {theme}"},
  sansfaute:{groupe:"technique",cibles:[5,8],texte:"Solve {n} puzzles in a row without a mistake"},
  sprint:{groupe:"technique",cibles:[8,10,12],texte:"Score {n} or more in a Sprint"},
  coord:{groupe:"variete",cibles:[12,15,20],texte:"Score {n} or more in Coordinates"},
  victoire:{groupe:"variete",cibles:[2,3],texte:"Win {n} games against the computer"},
  finale:{groupe:"variete",cibles:[2,3],texte:"Win {n} endgames"}
};
/* Types dont la progression est un record de la semaine (on garde le
   meilleur score), et non un cumul. */
const DEFI_RECORD=["sprint","coord","sansfaute"];
function defiLundi(d){
  const x=new Date(d||Date.now());x.setHours(12,0,0,0);
  x.setDate(x.getDate()-((x.getDay()+6)%7));
  return bxCle(x);
}
/* Generateur deterministe (mulberry32) amorce par la date du lundi. */
function defiHasard(graine){
  let h=1779033703^graine.length;
  for(let i=0;i<graine.length;i++){h=Math.imul(h^graine.charCodeAt(i),3432918353);h=h<<13|h>>>19;}
  let a=h>>>0;
  return()=>{a|=0;a=a+0x6D2B79F5|0;let t2=Math.imul(a^a>>>15,1|a);t2=t2+Math.imul(t2^t2>>>7,61|t2)^t2;return((t2^t2>>>14)>>>0)/4294967296;};
}
function defiListe(lundi){
  const r=defiHasard("chang64-defis-"+lundi),liste=[];
  for(const groupe of ["facile","technique","variete"]){
    const types=Object.keys(DEFI_TYPES).filter(k=>DEFI_TYPES[k].groupe===groupe);
    const type=types[Math.floor(r()*types.length)],cibles=DEFI_TYPES[type].cibles;
    const d={type:type,cible:cibles[Math.floor(r()*cibles.length)]};
    if(type==="motif"){
      const motifs=Object.values(BX_THEMES).filter(m=>typeof motifPropose!=="function"||motifPropose(m));
      d.theme=motifs[Math.floor(r()*motifs.length)]||"Knight fork";
    }
    liste.push(d);
  }
  return liste;
}
function defiEtat(){
  const c=bxEtat().c,lundi=defiLundi();
  if(!c.defis||c.defis.lundi!==lundi)c.defis={lundi:lundi,p:[0,0,0],ok:[false,false,false],jours:[],objJours:[]};
  if(typeof c.defisFaits!=="number")c.defisFaits=0;
  if(typeof c.semParfaites!=="number")c.semParfaites=0;
  return c;
}
function defiTexte(d){return t(DEFI_TYPES[d.type].texte,{n:d.cible,theme:d.theme?t(d.theme):""});}
/* Une avancee : valeur = increment (cumul) ou score (record). */
function defiNoter(type,valeur){
  const c=defiEtat(),s=c.defis,liste=defiListe(s.lundi);
  let change=false;
  liste.forEach((d,i)=>{
    if(d.type!==type||s.ok[i])return;
    if(type==="motif"&&valeur!==d.theme)return;
    const v=type==="motif"?1:valeur;
    s.p[i]=DEFI_RECORD.includes(type)?Math.max(s.p[i],v):s.p[i]+v;
    change=true;
    if(s.p[i]>=d.cible){
      s.p[i]=d.cible;s.ok[i]=true;c.defisFaits++;
      objAnnoncer("defi",t("Challenge completed!"),defiTexte(d));
      if(typeof SON!=="undefined"&&SON.medaille)SON.medaille(0.1,true);
      if(s.ok.every(Boolean)){
        c.semParfaites++;
        const g=objEtat();
        if(g.gels<OBJ_GELS_MAX){g.gels++;objAnnoncer("parfait",t("Perfect week!"),t("You earn a streak freeze."));}
        else objAnnoncer("parfait",t("Perfect week!"),t("All three challenges completed."));
      }
    }
  });
  if(change){bxVerifier();defiMaj();}
}
/* Les jours comptent une seule fois chacun (exercice du jour, objectif,
   jours joues). */
function defiJour(cle,type){
  const s=defiEtat().defis,auj=bxCle(new Date());
  s[cle]=Array.isArray(s[cle])?s[cle]:[];
  if(s[cle].includes(auj))return;
  s[cle].push(auj);
  defiNoter(type,1);
}
/* ---------- Branchements ---------- */
{
  const av=finishPuzzle;
  finishPuzzle=function(won){
    const pz=puzzle,r=av.apply(this,arguments);
    if(won){
      defiNoter("resoudre",1);
      if(pz&&pz.theme)defiNoter("motif",pz.theme);
      defiNoter("sansfaute",bxEtat().c.sansErreur||0);
      if(pz&&pz.daily&&!pz.dailyCatchupKey)defiJour("jourJours","jour");
      defiJour("jours","jours");
    }
    return r;
  };
}
{const av=rushEnd;rushEnd=function(){const sc=rush?rush.score:0,r=av.apply(this,arguments);if(sc>0){defiNoter("sprint",sc);defiJour("jours","jours");}return r;};}
{const av=stopCoord;stopCoord=function(){const sc=coord?coord.score:0,r=av.apply(this,arguments);if(sc>0){defiNoter("coord",sc);defiJour("jours","jours");}return r;};}
{const av=endEndgame;endEndgame=function(kind){const r=av.apply(this,arguments);if(kind==="checkmate")defiNoter("finale",1);defiJour("jours","jours");return r;};}
{const av=saveFinishedGame;saveFinishedGame=function(){
  const avant=gameSaved,r=av.apply(this,arguments);
  if(!avant&&gameSaved&&resultInfo){if(resultInfo.kind==="win")defiNoter("victoire",1);defiJour("jours","jours");}
  return r;
};}
/* L'objectif du jour atteint (objectif.js) compte un jour. */
window.addEventListener("chang64:objectif",()=>defiJour("objJours","objectif"));
/* ---------- Affichage ---------- */
function defiResteJours(){
  const l=new Date(defiLundi()+"T12:00:00");l.setDate(l.getDate()+7);
  const a=new Date();a.setHours(12,0,0,0);
  return Math.max(1,Math.round((l-a)/864e5));
}
function defiMaj(){
  const s=defiEtat().defis,faits=s.ok.filter(Boolean).length;
  const m=$("menuDefis");if(m)m.textContent=faits+"/3";
  const r=$("defisRaccourciCompte");if(r)r.textContent=faits+"/3";
  if(!$("menuDefisVue")||$("menuDefisVue").hidden)return;
  const liste=defiListe(s.lundi),reste=defiResteJours();
  poserHtml($("menuDefisVue"),liste.map((d,i)=>{
    const pc=Math.round(100*s.p[i]/d.cible);
    return '<div class="defi'+(s.ok[i]?" fait":"")+'"><div class="defi-tete"><span class="defi-texte">'+echapper(defiTexte(d))+"</span>"+
      '<span class="defi-compte">'+(s.ok[i]?"✓":s.p[i]+"/"+d.cible)+"</span></div>"+
      '<div class="defi-barre" role="progressbar" aria-valuemin="0" aria-valuemax="'+d.cible+'" aria-valuenow="'+s.p[i]+'"><i style="width:0" data-w="'+pc+'%"></i></div></div>';
  }).join("")+'<p class="defi-note">'+echapper(reste===1?t("New challenges tomorrow."):t("New challenges in {n} days.",{n:reste}))+" "+
    echapper(t("Complete all three to earn a streak freeze."))+"</p>");
  /* Les barres partent de zero et se remplissent l'une apres l'autre a
     l'ouverture de la vue (2026-11-15, demande d'Alexandre). */
  const barres=[...$("menuDefisVue").querySelectorAll(".defi-barre i")];
  const remplir=()=>barres.forEach((b,i)=>{b.style.transitionDelay=mouvementCalme()?"0s":(0.18+i*0.14)+"s";b.style.width=b.dataset.w;});
  if(mouvementCalme())remplir();else requestAnimationFrame(()=>requestAnimationFrame(remplir));
}
{
  /* Vue du menu, entree "Defis de la semaine", raccourci dans Resoudre. */
  const av=menuVue;
  menuVue=function(nom){
    if(nom==="defis"){
      for(const id of ["menuAccueil","menuStats","menuBadges","menuNouveautes","menuLanguesVue","menuObjectifVue"]){const e=$(id);if(e)e.hidden=true;}
      const v=$("menuDefisVue");v.hidden=false;
      $("menuTitre").textContent=t("Weekly challenges");$("menuRetour").hidden=false;
      defiMaj();
      if(!mouvementCalme()&&v.animate)v.animate([{opacity:0,transform:"translateX(18px)"},{opacity:1,transform:"none"}],{duration:260,easing:"cubic-bezier(.22,.7,.3,1)"});
      return;
    }
    const v=$("menuDefisVue");if(v)v.hidden=true;
    return av.apply(this,arguments);
  };
  const ar=menuResume;menuResume=function(){const r=ar.apply(this,arguments);defiMaj();return r;};
  const b=$("defisRaccourci");
  if(b)b.addEventListener("click",()=>{menuOuvrir();menuVue("defis");});
  const tr=$("menuTiroir");
  if(tr)tr.addEventListener("click",e=>{if(e.target.closest("[data-vue-defis]"))menuVue("defis");});
  const tt=$("defisRaccourciTitre");if(tt)tt.textContent=t("Weekly challenges");
  setTimeout(defiMaj,2700);
}
