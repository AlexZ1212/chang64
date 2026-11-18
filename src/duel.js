/* ==========================================================
   DEFI ENTRE AMIS PAR LIEN (2026-11-15)
   ========================================================== */
/* Cinq exercices de son niveau, du plus facile au plus dur. On les joue, puis
   on envoie un lien qui porte les cinq exercices et son resultat ; l'ami joue
   les memes et voit qui a gagne, puis renvoie sa reponse. Aucun serveur : tout
   tient dans le fragment (#), que le serveur ne voit jamais.
   Format : #duel=<5 x 4 car. base 36>&r=<5 chiffres 0/1/2>&t=<secondes>&n=<prenom>
   et, pour une reponse, &r2=&t2=&n2= (le second joueur).
   Chiffres de r : 2 = trouve du premier coup, 1 = trouve apres une erreur ou un
   indice, 0 = rate ou passe. Classement : premiers coups, puis trouves, puis
   temps. Colle apres bilan.js par build_site.js, qui y pose le trace de l'elephant. */
const DUEL_N=5,DUEL_TEMPS_MAX=35999,DUEL_LANGUES=["en","fr","es","pt","de","ru","it","tr","pl","id"];
/* DUEL_LANGUES : les langues qui ont leurs pages d'apercu /d/ (defi_build.js) ;
   tests/check_defi_apercu.js verifie que la liste suit le registre. */
let duel=null,duelNom="",duelEnvoyes=[];
(async()=>{
  try{const r=await window.storage.get("chang64:duelNom");if(r&&r.value)duelNom=duelPropre(r.value);}catch(e){}
  try{const r=await window.storage.get("chang64:duels");if(r&&r.value){const l=JSON.parse(r.value);if(Array.isArray(l))duelEnvoyes=l.slice(-20);}}catch(e){}
  duelCarte();
})();
/* Le nom qui part avec le defi : le pseudo du membre connecte (compte.js),
   sinon celui que le joueur a saisi, s'il en a saisi un. */
function duelNomCourant(){return typeof cp!=="undefined"&&cp&&cp.pseudo?duelPropre(cp.pseudo):duelNom;}
function duelPropre(s){return String(s||"").replace(/[\u0000-\u001f\u007f<>]/g,"").replace(/\s+/g," ").trim().slice(0,20);}
function duelEnc(ids){return ids.map(id=>(+String(id).slice(1)).toString(36).padStart(4,"0")).join("");}
function duelDec(s){
  if(!/^[0-9a-z]{20}$/.test(s))return null;
  const out=[];for(let i=0;i<20;i+=4)out.push("p"+parseInt(s.slice(i,i+4),36));
  return out;
}
function duelLire(h){
  const m=h.match(/[#&]duel=([0-9a-z]{20})(?=&|$)/);if(!m)return null;
  const ids=duelDec(m[1]);if(!ids)return null;
  const joueur=k=>{
    const r=h.match(new RegExp("[#&]r"+k+"=([012]{"+DUEL_N+"})(?=&|$)")),tt=h.match(new RegExp("[#&]t"+k+"=(\\d{1,5})(?=&|$)"));
    if(!r||!tt)return null;
    let n="";const nn=h.match(new RegExp("[#&]n"+k+"=([^&]{1,200})"));
    if(nn){try{n=duelPropre(decodeURIComponent(nn[1]));}catch(e){n="";}}
    return {r:r[1],t:Math.min(+tt[1],DUEL_TEMPS_MAX),n:n};
  };
  const a=joueur("");if(!a)return null;
  return {ids:ids,a:a,b:joueur("2")};
}
function duelLien(ids,a,b){
  const p=j=>"&r"+j.k+"="+j.r+"&t"+j.k+"="+j.t+(j.n?"&n"+j.k+"="+encodeURIComponent(j.n):"");
  /* Un defi lance passe par la page d'apercu de son score (defi_build.js),
     qui renvoie vers l'accueil avec le fragment ; une reponse garde le lien direct. */
  const apercu=!b&&/^https?:$/.test(location.protocol)&&DUEL_LANGUES.includes(LANG);
  return (apercu?location.origin+"/d/"+LANG+duelPremiers(a.r)+"/":baseUrl())+"#duel="+duelEnc(ids)+p(Object.assign({k:""},a))+(b?p(Object.assign({k:"2"},b)):"");
}
function duelPremiers(r){return (r.match(/2/g)||[]).length;}
function duelTrouves(r){return (r.match(/[12]/g)||[]).length;}
/* >0 si a fait mieux que b. */
function duelComparer(a,b){
  return (duelPremiers(a.r)-duelPremiers(b.r))||(duelTrouves(a.r)-duelTrouves(b.r))||(b.t-a.t);
}
function duelTemps(s){s=Math.max(0,Math.round(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");}
function duelPoints(r){
  return '<span class="duel-points" aria-hidden="true">'+r.split("").map((c,i)=>'<i class="d'+c+'" style="--i:'+i+'"></i>').join("")+"</span>";
}

/* ---------- partie en cours ---------- */
function duelDemarrer(ids,adv){
  duelFermer();
  if(typeof stopMotif==="function")stopMotif();
  if(typeof revisionEnCours!=="undefined"){revisionEnCours=false;revisionId=null;}
  duel={ids:ids.slice(),i:0,res:[],ms:0,debut:0,faute:false,adv:adv||null,charge:false,fin:false};
  duelCharger();
}
function duelCharger(){
  if(!duel)return;
  const id=duel.ids[duel.i];
  solveScreenSuppressAutoload=true;
  try{setMode("puzzles",{screen:"puzzles"});}finally{solveScreenSuppressAutoload=false;}
  duelBandeau();
  if(typeof afficherChargementExercice==="function")afficherChargementExercice();
  loadPuzzleById(id,p=>{
    if(!duel||duel.ids[duel.i]!==id)return;
    if(!p){duelAbandonner();if(typeof puzzleDataError==="function")puzzleDataError();return;}
    puzzle=p;puzzle.daily=false;puzzle.dailyCatchupKey=null;
    duel.charge=true;
    try{loadPuzzle();}finally{if(duel)duel.charge=false;}
    if(typeof focusBoard==="function")focusBoard();
  });
}
function duelIci(){return !!(duel&&puzzle&&puzzle.id===duel.ids[duel.i]&&duel.res[duel.i]===undefined);}
function duelNoter(v){
  if(!duel||duel.res[duel.i]!==undefined)return;
  duel.res[duel.i]=v;
  if(duel.debut)duel.ms+=Date.now()-duel.debut;
  duel.debut=0;duel.faute=false;
  duelBandeau();
  if(duel.i===DUEL_N-1){duel.fin=true;setTimeout(duelTenterFin,900);}
}
function duelSuivant(){
  if(!duel)return;
  if(duel.res[duel.i]===undefined)duelNoter(0);
  if(duel.i<DUEL_N-1){duel.i++;duelCharger();return;}
  duelTenterFin();
}
function duelAbandonner(){duel=null;duelBandeau();}
function duelBandeau(){
  const b=$("duelBandeau");if(!b)return;
  b.classList.toggle("hide",!duel);
  if(!duel)return;
  $("duelBandeauNum").textContent=t("Puzzle {n} of {total}",{n:Math.min(duel.i+1,DUEL_N),total:DUEL_N});
  let r="";for(let i=0;i<DUEL_N;i++)r+=duel.res[i]===undefined?"x":String(duel.res[i]);
  poserHtml($("duelBandeauPoints"),r.split("").map((c,i)=>'<i class="'+(c==="x"?(i===duel.i?"ici":""):"d"+c)+'"></i>').join(""));
  const adv=$("duelBandeauAdv");
  if(adv)adv.textContent=duel.adv?t("Score to beat: {n}/{total}",{n:duelPremiers(duel.adv.r),total:DUEL_N}):"";
}
/* Le temps court du chargement de l'exercice a sa fin ou au passage. */
{
  const av=loadPuzzle;
  loadPuzzle=function(){
    if(duel&&!duel.charge&&puzzle&&!duel.ids.includes(puzzle.id))duelAbandonner();
    const r=av.apply(this,arguments);
    if(duelIci()&&!duel.debut)duel.debut=Date.now();
    return r;
  };
}
{
  const av=finishPuzzle;
  finishPuzzle=function(won){
    const ici=duelIci(),essais=typeof puzzleTries==="number"?puzzleTries:0;
    /* Un exercice de defi compte pour l'objectif du jour et les exercices
       resolus, pas pour le classement (decision d'Alexandre, 2026-11-17) :
       les cinq exercices sont imposes par un autre joueur. */
    if(ici)puzzle.eloNote=true;
    const r=av.apply(this,arguments);
    if(ici)duelNoter(won?(essais===0&&!duel.faute?2:1):0);
    return r;
  };
}
if(typeof eloEchec==="function"){const av=eloEchec;eloEchec=function(){if(duelIci())return;return av.apply(this,arguments);};}
{const av=registerWrong;registerWrong=function(){if(duelIci())duel.faute=true;return av.apply(this,arguments);};}
if(typeof noterPremierEssai==="function"){const av=noterPremierEssai;noterPremierEssai=function(ok){if(!ok&&duelIci())duel.faute=true;return av.apply(this,arguments);};}
{const av=setMode;setMode=function(m,o){if(duel&&m!=="puzzles")duelAbandonner();return av.apply(this,arguments);};}
{const av=showSolveScreen;showSolveScreen=function(s){if(duel&&s!=="puzzles")duelAbandonner();return av.apply(this,arguments);};}
/* btnNext garde la fonction d'origine (onclick pose avant ce script). */
{
  const nb=$("btnNext");
  if(nb){const av=nb.onclick;nb.onclick=function(e){if(duel){duelSuivant();return;}return av&&av.call(this,e);};}
}
function duelTenterFin(){
  if(!duel||!duel.fin||duel.res.length<DUEL_N)return;
  const br=$("bravo"),an=document.getElementById("objAnnonce"),bi=$("bilan");
  const occupe=bravoOccupe()||(br&&!br.hidden)||(bravoFile&&bravoFile.length)||(an&&an.classList.contains("visible"))||objFile.length||(bi&&!bi.hidden);
  if(occupe){setTimeout(duelTenterFin,1000);return;}
  const d=duel;duel=null;duelBandeau();
  const moi={r:d.res.join(""),t:Math.min(Math.round(d.ms/1000),DUEL_TEMPS_MAX),n:duelNomCourant()};
  /* Badges de defi (2026-11-18) : a la fin des cinq exercices, donc en fin
     d'exercice, comme toute recompense. */
  if(typeof bxMarquer==="function"){
    if(!d.adv)bxMarquer("duel_lien");
    else if(duelComparer(moi,d.adv)>0)bxMarquer("duel_gagne");
    if(moi.r==="2".repeat(DUEL_N))bxMarquer("duel_parfait");
    bxVerifier();
  }
  if(d.adv)duelVueReponse(d.ids,d.adv,moi);
  else{
    duelEnvoyes.push({c:duelEnc(d.ids),r:moi.r,t:moi.t});duelEnvoyes=duelEnvoyes.slice(-20);
    try{window.storage.set("chang64:duels",JSON.stringify(duelEnvoyes));}catch(e){}
    duelCarte();
    duelVueCree(d.ids,moi);
  }
}
/* Cinq exercices du niveau du joueur, un par cinquieme de difficulte. */
function duelCreer(){
  duelFermer();
  if(typeof ensureProgFields==="function")ensureProgFields();
  const lvl=prog.level;
  solveScreenSuppressAutoload=true;
  try{setMode("puzzles",{screen:"puzzles"});}finally{solveScreenSuppressAutoload=false;}
  if(typeof afficherChargementExercice==="function")afficherChargementExercice();
  loadLevel(lvl,()=>{
    const tri=(LEVEL_CACHE[lvl]||[]).filter(p=>/^p\d+$/.test(p.id)).sort((a,b)=>(a.diff||0)-(b.diff||0));
    if(tri.length<DUEL_N){if(typeof puzzleDataError==="function")puzzleDataError();return;}
    const frais=tri.filter(p=>!prog.seen.includes(p.id));
    const base=frais.length>=DUEL_N*3?frais:tri,part=base.length/DUEL_N,ids=[];
    for(let k=0;k<DUEL_N;k++){
      const a=Math.floor(k*part),b=Math.max(a+1,Math.floor((k+1)*part));
      ids.push(base[a+Math.floor(Math.random()*(b-a))].id);
    }
    duelDemarrer(ids,null);
  });
}

/* ---------- fenetre ---------- */
let duelAvant=null;
function duelOuvrir(html){
  const r=$("duel");if(!r)return;
  poserHtml($("duelContenu"),html);
  if(typeof popinMedailles==="function")popinMedailles();
  if(r.hidden)duelAvant=document.activeElement;
  r.hidden=false;
  r.classList.remove("bilan-joue");void r.offsetWidth;r.classList.add("bilan-joue");
  const p=r.querySelector("[data-duel-premier]");if(p)p.focus();
}
function duelFermer(){
  const r=$("duel");if(!r||r.hidden)return;
  r.hidden=true;
  if(duelAvant&&duelAvant.focus&&document.contains(duelAvant))duelAvant.focus();
}
/* En-tete du modele commun (2026-11-18) : une medaille gravee, plus d'arc ni
   d'elephant. Deux epees croisees pour un defi a relever ou un resultat, deux
   maillons pour le defi qu'on vient de preparer. */
const duelMedaille=id=>'<span class="popin-medaille" data-medaille="'+id+'" aria-hidden="true"></span>';
const DUEL_FILET='<div class="popin-filet"></div>';
function duelTete(titre,sous,medaille){
  return duelMedaille(medaille||"duel_gagne")+'<p class="bilan-entete">'+echapper(t("Challenge a friend"))+'</p><h2 id="duelTitre">'+echapper(titre)+"</h2>"+(sous?'<p class="bilan-sous">'+echapper(sous)+"</p>":"");
}
function duelTuiles(j){
  return '<div class="bilan-tuiles"><div class="bilan-tuile" style="--i:0"><b>'+duelPremiers(j.r)+"/"+DUEL_N+"</b><span>"+echapper(t("First try"))+'</span></div><div class="bilan-tuile" style="--i:1"><b>'+duelTemps(j.t)+"</b><span>"+echapper(t("Time"))+"</span></div></div>";
}
function duelLigne(nom,j,gagne){
  return '<li class="duel-ligne'+(gagne?" gagne":"")+'"><span class="duel-qui">'+echapper(nom)+"</span>"+duelPoints(j.r)+"<b>"+duelPremiers(j.r)+"/"+DUEL_N+'</b><span class="duel-temps">'+duelTemps(j.t)+"</span></li>";
}
/* Prenom facultatif, lien et partage. */
function duelPartage(texte){
  /* Le bloc de partage du site, tel que sur le defi du jour (modele choisi
     par Alexandre le 18/11) : l'adresse dans son champ, puis les boutons
     communs (shareButtons, ui.js), dans un cadre. Un membre connecte n'a pas
     de nom a saisir : son pseudo part avec le defi. */
  const membre=typeof cp!=="undefined"&&cp&&cp.pseudo;
  return (membre?"":'<label class="duel-nom"><span>'+echapper(t("Your username (optional)"))+'</span><input type="text" id="duelNomChamp" maxlength="20" autocomplete="nickname" autocapitalize="off" spellcheck="false" value="'+echapper(duelNom)+'"></label>')+
    '<div class="panel duel-envoi"><input class="linkbox" id="duelLienChamp" readonly aria-label="'+echapper(t("Challenge link"))+'"><div class="shareRow" id="duelPartage"></div></div>'+
    '<p class="duel-note" id="duelNote" aria-live="polite" data-texte="'+echapper(texte)+'"></p>';
}
let duelLienCourant=null;
function duelMajLien(){
  const c=$("duelPartage"),note=$("duelNote"),r=$("duel");if(!c||!duelLienCourant)return;
  const lien=duelLienCourant(),champ=$("duelLienChamp");
  if(champ)champ.value=lien;
  shareButtons(c,lien,note?note.dataset.texte||"":"",true,note);
  /* A l'ouverture, le premier bouton de partage prend le focus ; pendant la
     saisie du pseudo, le focus reste dans le champ. */
  const b=c.querySelector("button");
  if(b&&r&&!r.contains(document.activeElement))b.focus();
}
function duelVueCree(ids,moi){
  const pc=duelPremiers(moi.r);
  const titre=pc===DUEL_N?t("Flawless!"):pc>=3?t("Well played!"):t("Challenge ready");
  duelLienCourant=()=>duelLien(ids,Object.assign({},moi,{n:duelNomCourant()}),null);
  duelOuvrir(duelTete(titre,t("Send the link: your friend plays the same five puzzles and tries to beat you."),"duel_lien")+
    duelTuiles(moi)+'<div class="duel-seul">'+duelPoints(moi.r)+"</div>"+DUEL_FILET+
    duelPartage(t("I challenge you on chang64: five puzzles, can you beat my score?"))+
    '<button type="button" class="btn duel-fermer" data-duel-fermer>'+echapper(t("Close"))+"</button>");
  duelMajLien();
}
function duelVueReponse(ids,adv,moi){
  const c=duelComparer(moi,adv),nomAdv=adv.n||t("Your friend");
  const titre=c>0?t("You win!"):c<0?t("{name} wins!",{name:nomAdv}):t("Perfect tie!");
  duelLienCourant=()=>duelLien(ids,adv,Object.assign({},moi,{n:duelNomCourant()}));
  duelOuvrir(duelTete(titre,t("Send your answer so {name} sees the result.",{name:nomAdv}))+
    '<ul class="duel-tableau">'+duelLigne(t("You"),moi,c>0)+duelLigne(nomAdv,adv,c<0)+"</ul>"+DUEL_FILET+
    duelPartage(t("I took up your chang64 challenge, here is my result:"))+
    '<div class="duel-boutons"><button type="button" class="btn" data-duel-nouveau>'+echapper(t("New challenge"))+'</button><button type="button" class="btn" data-duel-fermer>'+echapper(t("Close"))+"</button></div>");
  duelMajLien();
}
/* Lien recu : un defi a relever, ou une reponse a un defi. */
/* Jamais pendant une partie ni pendant un exercice (2026-11-18, demande
   d'Alexandre) : un lien de defi ouvert a ce moment attend la fin, puis la
   fenetre se montre. Une partie compte des son premier coup, un exercice des
   le premier coup joue ou la premiere erreur ; le Sprint et un defi deja en
   cours comptent aussi. */
let duelRecuAttente=null;
function duelOccupe(){
  try{
    if(duel||(typeof rush!=="undefined"&&rush))return true;
    if(mode==="play"&&gameStarted&&!resultInfo&&sanList.length)return true;
    if(mode==="puzzles"&&puzzle&&!puzzleDone&&(puzzleSolPly>0||puzzleTries>0||fautesExo>0))return true;
  }catch(e){}
  return false;
}
function duelRecuTenter(){
  if(!duelRecuAttente)return;
  if(duelOccupe()){setTimeout(duelRecuTenter,3000);return;}
  const d=duelRecuAttente;duelRecuAttente=null;duelRecu(d);
}
function duelRecu(d){
  if(duelOccupe()){duelRecuAttente=d;setTimeout(duelRecuTenter,3000);return;}
  setMode("puzzles",{screen:"menu"});
  if(d.b){
    const code=duelEnc(d.ids);
    const moiA=duelEnvoyes.some(e=>e.c===code&&e.r===d.a.r&&e.t===d.a.t);
    const nomA=moiA?t("You"):(d.a.n||t("Player 1")),nomB=d.b.n||(moiA?t("Your friend"):t("Player 2"));
    const c=duelComparer(d.a,d.b);
    const titre=c===0?t("Perfect tie!"):moiA?(c>0?t("You win!"):t("{name} wins!",{name:nomB})):t("{name} wins!",{name:c>0?nomA:nomB});
    duelLienCourant=null;
    duelOuvrir(duelTete(titre,moiA?t("{name} took up your challenge.",{name:nomB}):t("Challenge result"))+
      '<ul class="duel-tableau">'+duelLigne(nomA,d.a,c>0)+duelLigne(nomB,d.b,c<0)+"</ul>"+DUEL_FILET+
      '<div class="duel-boutons"><button type="button" class="btn primary" data-duel-nouveau data-duel-premier>'+echapper(t("Rematch"))+'</button><button type="button" class="btn" data-duel-fermer>'+echapper(t("Close"))+"</button></div>");
    return;
  }
  const nom=d.a.n;
  duelOuvrir(duelTete(nom?t("{name} challenges you!",{name:nom}):t("A friend challenges you!"),
      t("Five puzzles, the same for both of you. The score to beat:"))+
    duelTuiles(d.a)+'<div class="duel-seul">'+duelPoints(d.a.r)+"</div>"+
    '<p class="duel-regle">'+echapper(t("A puzzle found on the first try scores a point. If you are level, the faster player wins."))+"</p>"+DUEL_FILET+
    '<div class="duel-boutons"><button type="button" class="btn primary" data-duel-relever data-duel-premier>'+echapper(t("Take the challenge"))+'</button><button type="button" class="btn" data-duel-fermer>'+echapper(t("Not now"))+"</button></div>");
  $("duel").dataset.ids=duelEnc(d.ids);
  $("duel")._adv=d.a;
}
{
  const r=$("duel");
  if(r){
    r.addEventListener("click",e=>{
      if(e.target===r||e.target.closest("[data-duel-fermer]")){duelFermer();return;}
      if(e.target.closest("[data-duel-relever]")){const ids=duelDec(r.dataset.ids||""),adv=r._adv;if(ids&&adv)duelDemarrer(ids,adv);return;}
      if(e.target.closest("[data-duel-nouveau]")){duelCreer();return;}
    });
    r.addEventListener("input",e=>{
      if(e.target.id!=="duelNomChamp")return;
      duelNom=duelPropre(e.target.value);
      try{window.storage.set("chang64:duelNom",duelNom);}catch(x){}
      duelMajLien();
    });
    document.addEventListener("keydown",e=>{if(!r.hidden&&e.key==="Escape"){e.preventDefault();duelFermer();}});
  }
  const bq=$("duelBandeauQuitter");
  if(bq)bq.addEventListener("click",()=>{duelAbandonner();nextPuzzle();});
  const carte=$("cardSolveDuel");
  if(carte)carte.addEventListener("click",duelCreer);
}
function duelCarte(){
  const s=$("subSolveDuel");if(!s)return;
  const e=duelEnvoyes[duelEnvoyes.length-1];
  s.textContent=e?t("Last challenge: {n}/{total} on the first try",{n:duelPremiers(e.r),total:DUEL_N}):"";
}
function duelOuvert(){const r=$("duel");return !!(r&&!r.hidden);}
/* Lien profond : lu avant les autres routes de readDeepLink (ui.js). */
{const av=readDeepLink;readDeepLink=function(){const d=duelLire(location.hash||"");if(d)return {kind:"duel",d:d};return av.apply(this,arguments);};}
{const av=applyDeepLink;applyDeepLink=function(d){if(d&&d.kind==="duel"){duelRecu(d.d);return true;}return av.apply(this,arguments);};}
