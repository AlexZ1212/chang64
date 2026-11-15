/* ==========================================================
   BADGES ILLUSTRES (2026-11-15, chantier gamification valide par Alexandre)
   ========================================================== */
/* 182 badges en medailles (bronze, argent, or, jade borde d'or pour les jours
   speciaux), chacun avec un nom, un symbole et une anecdote d'echecs. Colle a
   la fin de ui3.js par build_site.js, qui injecte la liste des identifiants.
   - Les textes (nom, condition, anecdote) et les medailles (metal + symbole
     SVG) vivent dans data/badges-<langue>.json et data/badges-medailles.json,
     charges a la demande : 200 Ko de dessins n'alourdissent pas la page.
   - Les 42 anciens identifiants sont gardes : personne ne perd un badge.
   - Les nouveaux compteurs vivent dans prog.bx : f (badges a evenement,
     drapeau pose une fois), j (jours d'activite), c (petits compteurs).
     Ils ne comptent qu'a partir de cette version, sans effet retroactif.
   - Detection : checkBadges() (ui2.js) est remplacee ; l'annonce reste
     bravoAnnoncer(), qui attend toujours la fin d'un chrono ou d'une partie. */
const BX_LISTE=__BADGES_LISTE__;
/* Familles pas encore jouables : leurs badges n'apparaissent pas. */
const BX_CACHEES=["defis"];
const BX_THEMES={winning_capture:"Winning capture",double_attack:"Double attack",skewer:"Skewer",
  mate_in_two:"Mate in two",winning_move:"Winning move",knight_fork:"Knight fork",mate_in_one:"Mate in one",
  back_rank_mate:"Back-rank mate",pin:"Pin",pawn_fork:"Pawn fork",deflection:"Deflection",
  quiet_move:"Quiet move",mate_in_three:"Mate in three"};
const BX_EG=["kq","kr","krr","kbn","kp"];
const BX_JOURS=["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];

/* Les badges visibles remplacent l'ancienne liste, dans le meme tableau (du
   code et des tests parcourent BADGES). */
BADGES.length=0;
for(const [id,f] of BX_LISTE)if(!BX_CACHEES.includes(f))BADGES.push({id:id,f:f,type:"bx"});

/* ---------- Donnees a la demande ---------- */
let bxTextes=null,bxMedailles=null,bxCharge=null;
function bxLangue(){return (document.documentElement.lang||"en").slice(0,2);}
function bxCharger(){
  if(typeof fetch!=="function")return Promise.resolve(false);
  if(!bxCharge)bxCharge=Promise.all([
    fetch("/data/badges-"+bxLangue()+".json").then(r=>r.json()).catch(()=>fetch("/data/badges-en.json").then(r=>r.json())),
    fetch("/data/badges-medailles.json").then(r=>r.json())
  ]).then(([tx,md])=>{bxTextes=tx;bxMedailles=md;return true;}).catch(()=>{bxCharge=null;return false;});
  return bxCharge;
}
function bxTexte(id,i){return bxTextes&&bxTextes[id]?bxTextes[id][i]:"";}
function bxUi(cle,vars){
  let s=(bxTextes&&bxTextes._ui&&bxTextes._ui[cle])||cle;
  if(vars)for(const k in vars)s=s.split("{"+k+"}").join(vars[k]);
  return s;
}
/* Nom affiche d'un badge : son nom illustre une fois les textes charges. */
badgeLabel=function(b){return bxTexte(b.id,0)||b.id;};

/* ---------- Dessin d'une medaille ---------- */
const BX_METAUX={
  bronze:{face:["#F0B98C","#C07A47","#7A4321"],tranche:["#D99566","#6A381A"],grave:"#4A2410"},
  argent:{face:["#FFFFFF","#C9CFCC","#7E8784"],tranche:["#E4E8E6","#5E6765"],grave:"#2F3634"},
  or:{face:["#FFF0C2","#E9B44C","#9C6512"],tranche:["#F6CF77","#7A4C0C"],grave:"#4E3104"},
  jade:{face:["#C9F2DC","#5FBF92","#1F6B4A"],tranche:["#F6CF77","#7A4C0C"],grave:"#0C3524"},
  ombre:{face:["#2C3532","#232B28","#1A201E"],tranche:["#2A3230","#141917"],grave:"rgba(236,234,227,.16)"}
};
let bxN=0;
/* Symbole grave : une copie claire decalee d'un demi-pixel fait le relief ;
   --oeil donne aux details creuses la couleur de la face. Une medaille pas
   encore gagnee est sombre, son symbole a peine visible. */
function bxMedaille(id,gagne){
  const md=bxMedailles&&bxMedailles[id];
  const metal=gagne&&md?md[0]:"ombre",m=BX_METAUX[metal],sym=md?md[1]:"",i="bxm"+(++bxN);
  return '<svg class="bx-medaille bx-'+metal+'" viewBox="-60 -60 120 120" aria-hidden="true" focusable="false"><defs>'+
    '<radialGradient id="'+i+'f" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="'+m.face[0]+'"/><stop offset=".45" stop-color="'+m.face[1]+'"/><stop offset="1" stop-color="'+m.face[2]+'"/></radialGradient>'+
    '<linearGradient id="'+i+'t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+m.tranche[0]+'"/><stop offset="1" stop-color="'+m.tranche[1]+'"/></linearGradient>'+
    '<linearGradient id="'+i+'r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'+
    '<clipPath id="'+i+'c"><circle r="54"/></clipPath></defs>'+
    (gagne?'<circle r="56" cy="3" fill="rgba(0,0,0,.45)"/>':"")+
    '<circle r="55" fill="url(#'+i+'t)"/><circle r="47" fill="url(#'+i+'f)"/>'+
    '<circle r="43" fill="none" stroke="'+m.grave+'" stroke-opacity=".35" stroke-width="1"/>'+
    '<circle r="47" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="1.2"/>'+
    (gagne?'<g opacity=".45" transform="translate(0 .9) scale(1.45)" style="color:#fff;--oeil:transparent">'+sym+'</g>':"")+
    '<g transform="scale(1.45)" style="color:'+m.grave+';--oeil:'+m.face[1]+'">'+sym+'</g>'+
    (gagne?'<g clip-path="url(#'+i+'c)"><rect class="bx-reflet" x="-22" y="-80" width="30" height="160" fill="url(#'+i+'r)" transform="rotate(22)" opacity=".7"/></g>':"")+
    "</svg>";
}

/* ---------- Compteurs ---------- */
function bxEtat(){
  if(!prog.bx||typeof prog.bx!=="object")prog.bx={};
  const b=prog.bx;
  if(!b.f||typeof b.f!=="object")b.f={};
  if(!b.j||typeof b.j!=="object")b.j={};
  if(!b.c||typeof b.c!=="object")b.c={};
  return b;
}
function bxMarquer(id){const b=bxEtat();if(!b.f[id]){b.f[id]=1;return true;}return false;}
function bxCle(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function bxVerifier(){if(typeof checkBadges==="function")checkBadges();saveProg();}
/* Une activite (exercice reussi, partie ou finale terminee, Makruk...) :
   jour d'activite, jour de la semaine, jours speciaux, week-end, retour. */
function bxActivite(){
  const b=bxEtat(),d=new Date(),cle=bxCle(d);
  if(b.j[cle])return;
  const jours=Object.keys(b.j).sort(),dernier=jours[jours.length-1];
  if(dernier&&(d-new Date(dernier+"T12:00:00"))/864e5>=30)bxMarquer("ex_retour");
  b.j[cle]=1;
  bxMarquer("sem_"+BX_JOURS[d.getDay()]);
  const md=String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0");
  bxMarquer("fete_"+md);
  const debutAn=new Date(d.getFullYear(),0,1),rang=Math.round((new Date(d.getFullYear(),d.getMonth(),d.getDate())-debutAn)/864e5)+1;
  if(rang===64)bxMarquer("fete_jour64");
  if(d.getDay()===0){const s=new Date(d);s.setDate(s.getDate()-1);if(b.j[bxCle(s)])bxMarquer("ex_weekend");}
  if(d.getDay()===6){const s=new Date(d);s.setDate(s.getDate()+1);if(b.j[bxCle(s)])bxMarquer("ex_weekend");}
}
/* Exercice du jour reussi du lundi au dimanche d'une meme semaine. */
function bxSemaineDuJour(){
  const log=prog.dailyLog||{};
  for(const k of Object.keys(log)){
    const d=new Date(k+"T12:00:00");if(d.getDay()!==1)continue;
    let ok=true;
    for(let i=0;i<7&&ok;i++){const x=new Date(d);x.setDate(d.getDate()+i);ok=!!log[bxCle(x)];}
    if(ok)return true;
  }
  return false;
}

/* ---------- Condition de chaque badge ---------- */
function bxAcquis(id){
  const p=prog,b=bxEtat();let r;
  if(b.f[id])return true;
  if((r=id.match(/^solved_(\d+)$/)))return (p.solved||0)>=+r[1];
  if((r=id.match(/^days_(\d+)$/)))return (p.days||0)>=+r[1];
  if((r=id.match(/^total_(\d+)$/)))return Object.keys(b.j).length>=+r[1];
  if((r=id.match(/^rating_(\d+)$/)))return (p.rating||0)>=+r[1];
  if((r=id.match(/^theme_([a-z_]+?)(?:_(10|100))?$/)))return ((p.themeSolved||{})[BX_THEMES[r[1]]]||0)>=(+r[2]||25);
  if((r=id.match(/^sprint_(\d+)$/)))return (p.rushBest||0)>=+r[1];
  if((r=id.match(/^coord_(\d+)$/)))return (p.coordBest||0)>=+r[1];
  if((r=id.match(/^jour_(\d+)$/)))return Object.keys(p.dailyLog||{}).length>=+r[1];
  if(id==="jour_semaine")return bxSemaineDuJour();
  if(id==="eg_toutes")return BX_EG.every(e=>b.f["eg_"+e]||(p.endgames||{})[e]!==undefined);
  if((r=id.match(/^eg_(kq|kr|krr|kbn|kp)$/)))return (p.endgames||{})[r[1]]!==undefined;
  if(id==="sem_toute")return BX_JOURS.every(j=>b.f["sem_"+j]);
  if(id==="jeu_10")return (b.c.vic||0)>=10;
  if(id==="debut_fini")return typeof debutFini==="function"&&debutFini();
  if((r=id.match(/^debut_(\d)$/)))return !!(debut&&debut.faites&&debut.faites.includes(+r[1]-1));
  return false;
}
checkBadges=function(){
  ensureProgFields();bxEtat();
  let gagne=null;const nouveaux=[];
  for(const b of BADGES){
    if(prog.badges.includes(b.id))continue;
    if(bxAcquis(b.id)){prog.badges.push(b.id);prog.badgeDates[b.id]=Date.now();gagne=b;nouveaux.push(b);}
  }
  if(nouveaux.length)bravoAnnoncer(nouveaux);
  return gagne;
};

/* ---------- Evenements ---------- */
/* Exercices : heure, sans erreur, sans indice, apres une erreur, marathon. */
let bxIndice=false;
if(typeof hintPuzzle==="function"){const av=hintPuzzle;hintPuzzle=function(){bxIndice=true;return av.apply(this,arguments);};}
if(typeof loadPuzzle==="function"){const av=loadPuzzle;loadPuzzle=function(){bxIndice=false;return av.apply(this,arguments);};}
if(typeof registerWrong==="function"){const av=registerWrong;registerWrong=function(){bxEtat().c.sansErreur=0;return av.apply(this,arguments);};}
{
  const av=finishPuzzle;
  finishPuzzle=function(won){
    if(won){
      const b=bxEtat(),h=new Date().getHours(),cle=bxCle(new Date());
      bxActivite();
      if(h<5)bxMarquer("ex_hibou");else if(h<7)bxMarquer("ex_coq");
      if(typeof puzzleTries==="number"&&puzzleTries>0)bxMarquer("ex_tetu");
      if(typeof puzzleTries==="number"&&puzzleTries>=3)bxMarquer("lec_acharne");
      else b.c.sansErreur=(b.c.sansErreur||0)+1;
      if(bxIndice||hintShown)b.c.sansIndice=0;else b.c.sansIndice=(b.c.sansIndice||0)+1;
      if((b.c.sansErreur||0)>=10)bxMarquer("ex_huit_dames");
      if((b.c.sansIndice||0)>=10)bxMarquer("ex_sans_filet");
      if(b.c.jour!==cle){b.c.jour=cle;b.c.jourN=0;}
      if(++b.c.jourN>=50)bxMarquer("ex_marathon");
    }
    const r=av.apply(this,arguments);
    if(won)bxVerifier();
    return r;
  };
}
/* Finales : chaque finale gagnee, et le pat par megarde. */
{
  const av=endEndgame;
  endEndgame=function(kind){
    const r=av.apply(this,arguments);
    bxActivite();
    if(kind==="checkmate"&&eg&&eg.scen)bxMarquer("eg_"+eg.scen.id);
    if(String(kind).indexOf("stalemate")===0)bxMarquer("eg_pat");
    bxVerifier();
    return r;
  };
}
/* Coordonnees : 20 justes sans une erreur. */
{
  const av=stopCoord;
  stopCoord=function(){
    if(coord&&coord.score>=20&&!coord.misses)bxMarquer("coord_parfait");
    if(coord&&coord.score>0)bxActivite();
    return av.apply(this,arguments);
  };
}
/* Parties contre l'ordinateur : une fois la partie enregistree. */
{
  const av=saveFinishedGame;
  saveFinishedGame=function(){
    const avant=gameSaved,r=av.apply(this,arguments);
    if(!avant&&gameSaved&&resultInfo){
      const b=bxEtat(),k=resultInfo.kind;
      bxActivite();
      if(k==="draw")bxMarquer("jeu_nulle");
      /* Lecons apprises (2026-11-15) : la defaite devient un apprentissage. */
      if(botLevel===4)bxMarquer("lec_courage");
      b.c.perduNiv=b.c.perduNiv&&typeof b.c.perduNiv==="object"?b.c.perduNiv:{};
      if(k==="lose"){
        bxMarquer("lec_premiere");
        b.c.perduNiv[botLevel]=1;
        b.c.defaite=Date.now();
        if(isFlagged())bxMarquer("lec_temps");
        if(game.isCheckmate()&&Math.ceil(gameUci.length/2)<10)bxMarquer("lec_berger");
      }
      if(k==="win"&&b.c.perduNiv[botLevel])bxMarquer("lec_remontada");
      if(k==="win"){
        b.c.vic=(b.c.vic||0)+1;
        bxMarquer("jeu_victoire");
        bxMarquer("jeu_niv"+botLevel);
        if(myColor===B)bxMarquer("jeu_noirs");
        const cat=(tcCurrent()||{}).cat;
        if(cat==="bullet")bxMarquer("jeu_bullet");
        if(cat==="blitz")bxMarquer("jeu_blitz");
        if(cat==="rapid")bxMarquer("jeu_rapide");
        if(cat==="classical")bxMarquer("jeu_classique");
        if(isFlagged())bxMarquer("jeu_temps");
        if(game.isCheckmate()&&Math.ceil(gameUci.length/2)<20)bxMarquer("jeu_express");
      }
      bxVerifier();
    }
    return r;
  };
}
/* Entre amis : l'invitation, une partie terminee, puis la revanche. */
let bxAmiFini=false;
{
  const av=newAmiGame;
  newAmiGame=function(){
    bxMarquer("ami_invite");
    if(bxAmiFini)bxMarquer("ami_revanche");
    bxAmiFini=false;
    const r=av.apply(this,arguments);
    bxVerifier();
    return r;
  };
  const av2=saveFinishedAmiGame;
  saveFinishedAmiGame=function(){
    const avant=amiGameSaved,r=av2.apply(this,arguments);
    if(!avant&&amiGameSaved){bxAmiFini=true;bxMarquer("ami_partie");bxActivite();bxVerifier();}
    return r;
  };
}
/* Je debute : une etape reussie compte comme une activite. */
if(typeof debutReussi==="function"){const av=debutReussi;debutReussi=function(){bxActivite();const r=av.apply(this,arguments);bxVerifier();return r;};}
if(typeof debutPremierePartie==="function"){const av=debutPremierePartie;debutPremierePartie=function(){const r=av.apply(this,arguments);bxVerifier();return r;};}
/* Makruk : makruk.js (fichier a part) envoie ses evenements. */
window.addEventListener("chang64:makruk",e=>{
  const d=e.detail||{};
  bxActivite();
  if(d.type==="coup")bxMarquer("mk_partie");
  if(d.type==="promotion")bxMarquer("mk_promotion");
  if(d.type==="fin"){
    if(d.raison==="comptage")bxMarquer("mk_comptage");
    if(d.mode==="ordi"&&d.gagnant===d.camp)bxMarquer(["mk_facile","mk_moyen","mk_difficile"][d.niveau]||"mk_facile");
  }
  bxVerifier();
});
/* Curiosites. */
{const av=toggleFlip;toggleFlip=function(){bxMarquer("ex_retourne");const r=av.apply(this,arguments);bxVerifier();return r;};}
{const av=showCode;showCode=function(){const r=av.apply(this,arguments);bxMarquer("ex_code");bxVerifier();return r;};}
{const av=editApplyDrop;editApplyDrop=function(){const r=av.apply(this,arguments);if(bxMarquer("ex_editeur"))bxVerifier();return r;};}
{const av=shareButtons;shareButtons=function(container){
  const r=av.apply(this,arguments);
  if(container&&!container.dataset.bxPartage){
    container.dataset.bxPartage="1";
    container.addEventListener("click",e=>{if(e.target.closest("a,button")&&bxMarquer("ex_partage"))bxVerifier();});
  }
  return r;
};}
{const an=$("resultAnalyse");if(an)an.addEventListener("click",()=>{
  const perdue=resultInfo&&resultInfo.kind==="lose";
  const a=bxMarquer("ex_analyse"),l=perdue&&bxMarquer("lec_analyse");
  if(a||l)bxVerifier();
});}
/* Abandon d'une partie contre l'ordinateur ; nouvelle partie lancee moins
   de deux minutes apres une defaite ; serie de jours qui repart apres une
   coupure. */
if(typeof resignGame==="function"){const av=resignGame;resignGame=function(){
  const avant=resigned,r=av.apply(this,arguments);
  if(avant===null&&resigned!==null){bxMarquer("lec_abandon");bxVerifier();}
  return r;
};}
if(typeof newGame==="function"){const av=newGame;newGame=function(){
  const b=bxEtat();
  if(b.c.defaite&&Date.now()-b.c.defaite<120000){b.c.defaite=0;bxMarquer("lec_rancunier");}
  const r=av.apply(this,arguments);
  bxVerifier();
  return r;
};}
if(typeof bumpStreak==="function"){const av=bumpStreak;bumpStreak=function(){
  ensureProgFields();
  const auj=bxCle(new Date()),hier=new Date();hier.setDate(hier.getDate()-1);
  if(prog.lastDay&&prog.lastDay!==auj&&prog.lastDay!==bxCle(hier))bxMarquer("lec_reprise");
  return av.apply(this,arguments);
};}
/* Au chargement : langues essayees, application installee. Apres la lecture
   de la progression (loadProg est asynchrone), d'ou le delai. */
setTimeout(()=>{
  const b=bxEtat(),l=bxLangue();
  b.c.langues=Array.isArray(b.c.langues)?b.c.langues:[];
  if(!b.c.langues.includes(l))b.c.langues.push(l);
  if(b.c.langues.length>=2)bxMarquer("ex_langue");
  const app=(window.matchMedia&&matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true;
  if(app)bxMarquer("ex_app");
  bxVerifier();
},2500);

/* ---------- Fenetre de gain ---------- */
/* La medaille tombe en tournant, se pose, le reflet la traverse, puis des
   rayons tournent doucement derriere (direction validee le 15/11). Plusieurs
   badges d'un coup : la premiere medaille en grand, les autres en petit. */
{
  const av=bravoTenter;
  bravoTenter=function(){
    /* Les fichiers arrivent d'habitude bien avant (prechargement au repos).
       Hors ligne au tout premier passage, on n'attend pas plus de 2 s : la
       fenetre s'ouvre quand meme, sans medaille. */
    if(!bxTextes||!bxMedailles){
      const args=arguments;let fait=false;
      const go=()=>{if(!fait){fait=true;av.apply(this,args);}};
      bxCharger().then(go);setTimeout(go,2000);
      return;
    }
    return av.apply(this,arguments);
  };
}
/* La medaille la plus precieuse en grand : jade, or, argent, bronze ; a
   metal egal, l'ordre des familles (les exercices avant les jours). */
const BX_RANG={jade:4,or:3,argent:2,bronze:1};
function bxTrier(liste){
  /* Les lecons apprises passent toujours apres les badges de victoire. */
  const rang=b=>(b.f==="lecons"?-1:0)*10+(bxMedailles&&bxMedailles[b.id]?BX_RANG[bxMedailles[b.id][0]]||0:0);
  const ordre=b=>BADGES.findIndex(x=>x.id===b.id);
  return liste.slice().sort((a,b)=>rang(b)-rang(a)||ordre(a)-ordre(b));
}
/* Une medaille a la fois (2026-11-15, choix d'Alexandre) : chaque badge a
   sa page, avec son nom et son anecdote ; "Suivant" tourne la page, et
   "Continuer" n'apparait que sur la derniere. Sous le texte, la rangee des
   petites medailles montre ou l'on en est (celle de la page en cours est
   allumee). Echap ou un clic a cote ferment tout. */
let bxPages=[],bxPage=0;
function bxAfficherPage(premiere){
  const r=$("bravo"),b=bxPages[bxPage];if(!r||!b)return;
  const socle=$("bravoSocle"),noms=$("bravoNoms"),tx=$("bravoTexte"),autres=$("bravoAutres"),ok=$("bravoOk");
  r.classList.remove("bx-fiche");
  poserHtml(socle.querySelector(".bx-piece3d"),bxMedaille(b.id,true));
  poserHtml(noms,"");
  const d=document.createElement("div");d.textContent=badgeLabel(b);noms.appendChild(d);
  tx.textContent=bxTexte(b.id,2);tx.classList.toggle("hide",!tx.textContent);
  poserHtml(autres,bxPages.length>1?bxPages.map((x,i)=>'<span class="bx-page'+(i===bxPage?" en-cours":"")+'">'+bxMedaille(x.id,true)+"</span>").join(""):"");
  autres.setAttribute("aria-hidden","true");
  const dernier=bxPage>=bxPages.length-1;
  ok.textContent=dernier?t("Continue"):t("Next");
  ok.onclick=dernier?bravoFermer:()=>{bxPage++;bxAfficherPage(false);ok.focus();};
  $("bravoTitre").textContent=t("Congratulations");
  r.classList.remove("bx-joue","bx-tourne");void r.offsetWidth;
  r.classList.add(premiere?"bx-joue":"bx-tourne");
  if(typeof SON!=="undefined"&&SON.medaille)SON.medaille(premiere&&!mouvementCalme()?0.95:0.05,!premiere);
}
bravoRemplir=function(){
  bxPages=bxTrier(bravoFile||[]);bxPage=0;
  bxAfficherPage(true);
};
/* Fiche d'un badge, depuis la collection : meme fenetre, sans la chute. */
function bxFiche(id){
  const r=$("bravo");if(!r)return;
  const gagne=prog.badges.includes(id),d=prog.badgeDates[id];
  if(!bravoPret){
    bravoPret=true;
    $("bravoOk").onclick=bravoFermer;
    r.addEventListener("click",e=>{if(e.target===r)bravoFermer();});
    document.addEventListener("keydown",bravoTouche,true);
  }
  bravoAvant=document.activeElement;
  bravoFile=[];
  poserHtml($("bravoSocle").querySelector(".bx-piece3d"),bxMedaille(id,gagne));
  $("bravoTitre").textContent=bxTexte(id,0);
  poserHtml($("bravoNoms"),"");
  const c=document.createElement("div");c.className="bx-condition";
  c.textContent=gagne&&d?bxUi("Won on {date}",{date:fmtDayMonth(d)+"/"+new Date(d).getFullYear()}):bxUi("To unlock: {c}",{c:bxTexte(id,1)});
  $("bravoNoms").appendChild(c);
  const tx=$("bravoTexte");tx.textContent=bxTexte(id,2);tx.classList.remove("hide");
  poserHtml($("bravoAutres"),"");
  $("bravoOk").textContent=t("Continue");$("bravoOk").onclick=bravoFermer;
  r.classList.add("bx-fiche");r.classList.remove("bx-joue","bx-tourne");
  r.hidden=false;
  if(gagne){void r.offsetWidth;r.classList.add("bx-brille");setTimeout(()=>r.classList.remove("bx-brille"),1300);}
  $("bravoOk").focus();
}

/* ---------- Collection ---------- */
/* Toutes les medailles par famille ; une medaille se touche pour ouvrir sa
   fiche. Les badges de motifs peu fournis restent caches tant qu'ils ne sont
   pas gagnes (meme regle qu'avant, motifPropose). */
function bxVisible(b){
  const r=b.id.match(/^theme_([a-z_]+?)(?:_(10|100))?$/);
  return !r||motifPropose(BX_THEMES[r[1]])||prog.badges.includes(b.id);
}
/* el : la grille a remplir (celle de Resoudre par defaut, ou celle du menu). */
renderBadges=function(el){
  el=el&&el.nodeType?el:$("badgeGrid");if(!el)return;
  ensureProgFields();
  /* Sans les fichiers (pas encore arrives, ou hors ligne au premier
     passage), la grille se dessine quand meme, puis se redessine. */
  if(!bxTextes||!bxMedailles)bxCharger().then(ok=>{if(ok)renderBadges(el);});
  let h="",fam="";
  for(const b of BADGES.filter(bxVisible)){
    if(b.f!==fam){fam=b.f;h+='<h4 class="bx-famille">'+echapper(bxUi("famille:"+fam))+"</h4>";}
    const g=prog.badges.includes(b.id);
    h+='<button type="button" class="badge bx-carte'+(g?" unlocked":"")+'" data-bx="'+b.id+'">'+bxMedaille(b.id,g)+
      '<span class="bx-nom">'+echapper(badgeLabel(b))+"</span></button>";
  }
  poserHtml(el,h);
};
function echapper(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
renderBadgeSummary=function(){
  const sum=$("badgeSummary"),recent=$("badgeRecentGrid");
  if(!sum||!recent)return;
  ensureProgFields();
  const total=BADGES.filter(bxVisible).length;
  sum.textContent=t("{n}/{total} unlocked",{n:prog.badges.filter(id=>BADGES.some(b=>b.id===id)).length,total:total});
  if(!bxTextes||!bxMedailles)bxCharger().then(ok=>{if(ok)renderBadgeSummary();});
  const ids=prog.badges.filter(id=>BADGES.some(b=>b.id===id)).sort((a,b)=>(prog.badgeDates[b]||0)-(prog.badgeDates[a]||0)).slice(0,6);
  poserHtml(recent,ids.map(id=>'<button type="button" class="badge bx-carte unlocked" data-bx="'+id+'">'+bxMedaille(id,true)+
    '<span class="bx-nom">'+echapper(bxTexte(id,0)||id)+"</span></button>").join(""));
};
document.addEventListener("click",e=>{
  const c=e.target.closest&&e.target.closest("[data-bx]");
  if(c)bxFiche(c.dataset.bx);
});
/* Les fichiers des badges arrivent quand le navigateur est libre, pour que
   la premiere medaille gagnee s'affiche sans attente. */
(window.requestIdleCallback||(f=>setTimeout(f,3000)))(()=>bxCharger());
