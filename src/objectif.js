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
  const txt=ok?t("Goal reached!")+" "+t("Solved today"):t("{n}/{total} today",{n:n,total:cible});
  const ct=$("objectifCompte");if(ct)ct.textContent=txt;
  const mo=$("menuObjectif");if(mo)mo.textContent=n+"/"+cible;
  const g=$("objectifGels");
  if(g){g.hidden=!c.gels;poserHtml(g,'<svg viewBox="0 0 256 256" aria-hidden="true">'+OBJ_ICONES.gel+"</svg>"+c.gels);g.title=t("Streak freezes")+" : "+c.gels;g.setAttribute("aria-label",t("Streak freezes")+" : "+c.gels);}
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
          if(c.objSerie%OBJ_JOURS_GEL===0&&c.gels<OBJ_GELS_MAX){c.gels++;objAnnoncer("gel",t("Freeze earned!"),t("It will save your streak if you miss a day."));}
        }
        bxMarquer("obj_atteint");
        /* Petite annonce (2026-11-24, demande d'Alexandre) : en fin d'exercice,
           comme celle d'un defi gagne. La premiere fois, la fenetre Bravo du
           badge passe d'abord ; l'annonce attend qu'elle soit fermee. */
        objAnnoncer("objectif",t("Goal reached!"),t(c.objectif===1?"1 puzzle solved today. Come back tomorrow to keep going.":"{n} puzzles solved today. Come back tomorrow to keep going.",{n:c.objectif}));
        try{window.dispatchEvent(new CustomEvent("chang64:objectif"));}catch(e){}
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
        objAnnoncer("gel",t("Streak saved!"),t("A freeze was used, your streak continues."));
        objMaj(false);
      }
    }
    return av.apply(this,arguments);
  };
}
/* Annonces (2026-11-15, refaites a la demande d'Alexandre) : une carte qui
   descend du haut, avec une pastille dessinee (flocon de glace pour les gels,
   drapeau a damier laiton pour un defi, trophee jade pour une semaine
   parfaite), un titre, une phrase, et un filet qui se vide pendant les
   4 secondes d'affichage. Les annonces passent l'une apres l'autre (file
   d'attente) ; un toucher ferme la carte. Pictos Phosphor (MIT). */
const OBJ_ICONES={gel:"<path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm42.37,119.22,18.94-6.76a8,8,0,1,1,5.38,15.08l-15.48,5.52,4.52,16.87a8,8,0,0,1-5.66,9.8A8.23,8.23,0,0,1,176,184a8,8,0,0,1-7.73-5.93l-5.57-20.8L136,141.86v30.83l13.66,13.65a8,8,0,0,1-11.32,11.32L128,187.31l-10.34,10.35a8,8,0,0,1-11.32-11.32L120,172.69V141.86L93.3,157.27l-5.57,20.8A8,8,0,0,1,80,184a8.23,8.23,0,0,1-2.07-.27,8,8,0,0,1-5.66-9.8l4.52-16.87-15.48-5.52a8,8,0,0,1,5.38-15.08l18.94,6.76L112,128,85.63,112.78l-18.94,6.76A8.18,8.18,0,0,1,64,120a8,8,0,0,1-2.69-15.54l15.48-5.52L72.27,82.07a8,8,0,0,1,15.46-4.14l5.57,20.8L120,114.14V83.31L106.34,69.66a8,8,0,0,1,11.32-11.32L128,68.69l10.34-10.35a8,8,0,0,1,11.32,11.32L136,83.31v30.83l26.7-15.41,5.57-20.8a8,8,0,0,1,15.46,4.14l-4.52,16.87,15.48,5.52A8,8,0,0,1,192,120a8.18,8.18,0,0,1-2.69-.46l-18.94-6.76L144,128Z\"/>",defi:"<path d=\"M227.32,48.75A8,8,0,0,0,218.76,50c-28,24.22-51.72,12.48-79.21-1.13C111.07,34.76,78.78,18.79,42.76,50h0A8,8,0,0,0,40,56V224a8,8,0,0,0,16,0V179.77c26.79-21.16,49.87-9.75,76.45,3.41,16.4,8.11,34.06,16.85,53,16.85,13.93,0,28.54-4.75,43.82-18a8,8,0,0,0,2.76-6V56A8,8,0,0,0,227.32,48.75ZM56,160.44V109.88c16.85-11.28,32.64-11.59,48-7.34v51.74C88.87,150.47,72.87,150.71,56,160.44ZM104,50.87c9.25,2.83,18.61,7.45,28.45,12.32,11.26,5.57,23.11,11.43,35.55,14.56v51.74c15.35,4.25,31.14,3.94,48-7.35v50.11c-16.87,13.32-32.27,13.72-48,8.91V129.49c-21.62-6-42.38-21-64-26.95Z\"/>",parfait:"<path d=\"M232,64H208V48a8,8,0,0,0-8-8H56a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80V96a40,40,0,0,0,40,40h3.65A80.13,80.13,0,0,0,120,191.61V216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V191.58c31.94-3.23,58.44-25.64,68.08-55.58H208a40,40,0,0,0,40-40V80A16,16,0,0,0,232,64ZM48,120A24,24,0,0,1,24,96V80H48v32q0,4,.39,8ZM232,96a24,24,0,0,1-24,24h-.5a81.81,81.81,0,0,0,.5-8.9V80h24Z\"/>"};
/* Objectif du jour atteint (2026-11-24) : la coche (Phosphor « check », MIT). */
OBJ_ICONES.objectif="<path d=\"M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z\"/>";
/* Badges rattrapes (2026-11-22) : une medaille, et un toucher ouvre la collection. */
OBJ_ICONES.badges="<path d=\"M216,96A88,88,0,1,0,72,163.83V240a8,8,0,0,0,11.58,7.16L128,225l44.43,22.21A8.07,8.07,0,0,0,176,248a8,8,0,0,0,8-8V163.83A87.85,87.85,0,0,0,216,96ZM56,96a72,72,0,1,1,72,72A72.08,72.08,0,0,1,56,96Zm16,0a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z\"/>";
const objFile=[];let objEnCours=false;
/* action (facultative) : ce que fait un toucher sur l'annonce, en plus de la fermer. */
function objAnnoncer(type,titre,texte,action){objFile.push({type:type,titre:titre,texte:texte||"",action:action||null});if(!objEnCours)objSuivante();}
function objSuivante(){
  if(!objFile.length){objEnCours=false;return;}
  objEnCours=true;
  /* Jamais pendant le jeu, ni par-dessus la fenetre Bravo : on attend. */
  const br=$("bravo");
  if((typeof bravoOccupe==="function"&&bravoOccupe())||(br&&!br.hidden)||(typeof bravoFile!=="undefined"&&bravoFile&&bravoFile.length)){setTimeout(objSuivante,1000);return;}
  const a=objFile.shift();
  let b=document.getElementById("objAnnonce");
  if(!b){
    b=document.createElement("div");b.id="objAnnonce";b.setAttribute("role","status");b.setAttribute("aria-live","polite");
    b.addEventListener("click",()=>{clearTimeout(b._t);const f=b._action;b._action=null;objCacher(b);if(f){try{f();}catch(e){}}});
    document.body.appendChild(b);
  }
  b._action=a.action;
  b.className="obj-annonce obj-"+a.type;
  poserHtml(b,'<span class="obj-pastille"><svg viewBox="0 0 256 256" aria-hidden="true">'+OBJ_ICONES[a.type]+"</svg></span>"+
    '<span class="obj-mots"><b>'+echapper(a.titre)+"</b>"+(a.texte?"<span>"+echapper(a.texte)+"</span>":"")+"</span>"+
    '<i class="obj-filet" aria-hidden="true"></i>');
  void b.offsetWidth;
  b.classList.add("visible");
  /* L'annonce des badges rattrapes reste plus longtemps : deux lignes a lire et un toucher possible. */
  b._t=setTimeout(()=>objCacher(b),a.type==="badges"?7000:4200);
}
function objCacher(b){
  b.classList.remove("visible");
  setTimeout(objSuivante,mouvementCalme()?0:380);
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
    if(e.target.closest("[data-vue-objectif]")){menuVue("objectif");return;}
    const a=e.target.closest("[data-objectif-aller]");if(!a)return;
    menuFermer();
    setTimeout(()=>{
      if(a.dataset.objectifAller==="prefs"){const f=$("footPrefs");if(f)f.click();}
      else{setMode("puzzles");const c=$("cardSolvePuzzles");if(c)c.click();}
    },mouvementCalme()?0:200);
  });
  setTimeout(()=>{objMaj(false);objReglage();},2600);
}
/* Sous-vue du menu (2026-11-15, demande d'Alexandre) : l'anneau en grand,
   ce qui compte, la serie d'objectifs vers le prochain gel (7 jours), les
   gels en reserve, et deux raccourcis (exercices, reglage). */
function objVue(){
  const v=$("menuObjectifVue");if(!v)return;
  const c=objEtat(),n=objFaits(),cible=c.objectif,ok=n>=cible;
  const auj=bxCle(new Date()),hier=new Date();hier.setDate(hier.getDate()-1);
  const vivante=c.objDernier===auj||c.objDernier===bxCle(hier);
  const serie=vivante?(c.objSerie||0)%OBJ_JOURS_GEL:0;
  const pleinSerie=vivante&&c.objSerie>0&&c.objSerie%OBJ_JOURS_GEL===0&&c.objDernier===auj;
  const pas=pleinSerie?OBJ_JOURS_GEL:serie;
  const reste=Math.max(0,100-Math.round(100*Math.min(n,cible)/cible));
  const flocon='<svg viewBox="0 0 256 256" aria-hidden="true">'+OBJ_ICONES.gel+"</svg>";
  poserHtml(v,
    '<div class="objv-tete"><svg class="obj-anneau objv-anneau'+(ok?" obj-atteint":"")+'" viewBox="0 0 36 36" aria-hidden="true" style="--obj:100"><circle class="obj-fond" cx="18" cy="18" r="15"/><circle class="obj-plein" cx="18" cy="18" r="15" pathLength="100"/><path class="obj-coche" d="M12 18.5l4 4 8-9" pathLength="1"/></svg>'+
    '<div class="objv-chiffre"><b>'+Math.min(n,cible)+"/"+cible+"</b><span>"+echapper(ok?t("Goal reached!"):t("Solved today"))+"</span></div></div>"+
    '<p class="objv-note">'+echapper(t("Every puzzle you solve today counts, in every mode."))+"</p>"+
    '<div class="objv-bloc"><p class="objv-titre">'+echapper(t("Towards your next freeze"))+'</p><div class="objv-jours">'+
    Array.from({length:OBJ_JOURS_GEL},(_,i)=>'<span class="'+(i<pas?"plein":"")+'" style="--i:'+i+'"></span>').join("")+
    '</div><p class="objv-note">'+echapper(t("Reach your goal {n} days in a row to earn a streak freeze.",{n:OBJ_JOURS_GEL}))+" "+echapper(t("A perfect week of challenges earns one too."))+"</p></div>"+
    '<div class="objv-bloc objv-gels"><p class="objv-titre">'+echapper(t("Freezes in reserve"))+'</p><div class="objv-flocons">'+
    Array.from({length:OBJ_GELS_MAX},(_,i)=>'<span class="'+(i<c.gels?"plein":"")+'">'+flocon+"</span>").join("")+
    "</div></div>"+
    '<div class="objv-actions"><button type="button" class="btn primary" data-objectif-aller="exos">'+echapper(t("Go to puzzles"))+"</button>"+
    '<button type="button" class="btn" data-objectif-aller="prefs">'+echapper(t("Change the goal"))+"</button></div>");
  /* L'anneau et les jours se remplissent a l'ouverture. */
  const a=v.querySelector(".objv-anneau");
  const remplir=()=>{a.style.setProperty("--obj",String(reste));v.classList.add("objv-pret");};
  v.classList.remove("objv-pret");
  if(mouvementCalme())remplir();else requestAnimationFrame(()=>requestAnimationFrame(remplir));
}
{
  const av=menuVue;
  menuVue=function(nom){
    const v=$("menuObjectifVue");
    if(nom==="objectif"){
      for(const id of ["menuAccueil","menuStats","menuBadges","menuNouveautes","menuInviterVue","menuLanguesVue","menuDefisVue"]){const e=$(id);if(e)e.hidden=true;}
      v.hidden=false;$("menuTitre").textContent=t("Daily goal");$("menuRetour").hidden=false;
      objVue();
      if(!mouvementCalme()&&v.animate)v.animate([{opacity:0,transform:"translateX(18px)"},{opacity:1,transform:"none"}],{duration:260,easing:"cubic-bezier(.22,.7,.3,1)"});
      return;
    }
    if(v)v.hidden=true;
    return av.apply(this,arguments);
  };
}
