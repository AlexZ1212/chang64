/* ==========================================================
   COMPTE : PSEUDO + CODE (2026-11-16)
   ========================================================== */
/* Un compte facultatif pour retrouver sa progression sur plusieurs appareils
   (serveur : functions/api/compte/[[route]].js). Colle apres webapp.js par
   build_site.js. Quatre parties :
   1. le pseudo (memes regles que le serveur, bloc recopie) et le code, etire
      ici avant tout envoi : le serveur ne voit jamais le code choisi ;
   2. la fusion de deux progressions (cpFusion, fonction pure, testee par
      tests/check_compte_fusion.js) ;
   3. la synchronisation (cpSynchro) ;
   4. les ecrans de la vue "Mon compte" du menu.
   Rien ne change pour qui n'a pas de compte : sans session, ce module ne
   fait aucune requete. */

/* PSEUDO-DEBUT : ce bloc est recopie a l'identique dans compte.js (le
   navigateur s'en sert pour verifier le pseudo pendant la saisie et pour
   saler l'etirement du code) ; check_compte_serveur.js compare les deux. */
const PSEUDO_MIN = 3, PSEUDO_MAX = 20;
const PSEUDO_SOSIES = { "а": "a", "в": "b", "е": "e", "к": "k", "м": "m", "н": "h", "о": "o", "р": "p", "с": "c", "т": "t", "у": "y", "х": "x", "ѕ": "s", "і": "i", "ј": "j", "һ": "h", "ԁ": "d", "ԛ": "q", "ԝ": "w", "ı": "i", "ł": "l", "ø": "o", "đ": "d", "α": "a", "ο": "o", "ρ": "p", "ν": "v", "τ": "t", "ι": "i", "κ": "k" };
const PSEUDO_ECRITURES = ["Latin", "Cyrillic", "Greek", "Arabic", "Hebrew", "Thai", "Devanagari", "Hangul", "Han", "Hiragana", "Katakana"];
const PSEUDO_RESERVES = ["chang64", "admin", "moderat", "support", "officiel", "official", "staff", "systeme", "system"];
const PSEUDO_INTERDITS = ["fuck", "shit", "bitch", "cunt", "nigg", "fagg", "whore", "slut", "porn", "sex", "penis", "vagin", "hitler", "nazi", "pedoph", "rapist",
  "pute", "salop", "connard", "connasse", "encul", "nique", "merde", "batard", "pedale", "tapette", "bougnoul", "negro",
  "puta", "mierda", "pendej", "maricon", "cabron", "polla", "caralh", "foda", "buceta", "viado",
  "fotze", "schlampe", "arschloch", "wichser", "hurensohn", "schwuchtel",
  "cazzo", "stronz", "vaffancul", "puttana", "troia", "frocio",
  "kurwa", "chuj", "pizd", "jeban", "pierdol",
  "orospu", "siktir", "yarrak", "amcik",
  "bangsat", "kontol", "memek", "ngentot", "anjing",
  "хуй", "хуе", "пизд", "бляд", "блят", "ебат", "ебан", "сука", "пидор", "мудак", "говн"];
const PSEUDO_INTERDITS_EXACTS = ["rape", "bite", "con", "cul", "pd", "ass", "dick", "cock", "anal", "anus", "tits", "nique", "zob", "fdp", "ntm"];
/* Rend {ok:true, pseudo, cle} ou {ok:false, raison} ; raison vaut
   "longueur", "caracteres", "melange" ou "interdit". */
function pseudoValider(brut) {
  if (typeof brut !== "string") return { ok: false, raison: "caracteres" };
  const pseudo = brut.normalize("NFC").trim();
  const n = Array.from(pseudo).length;
  if (n < PSEUDO_MIN || n > PSEUDO_MAX) return { ok: false, raison: "longueur" };
  if (!/^[\p{L}0-9_-]+$/u.test(pseudo) || !/[\p{L}0-9]/u.test(pseudo)) return { ok: false, raison: "caracteres" };
  /* Une seule ecriture par pseudo : pas de lettre cyrillique glissee dans un
     mot latin pour imiter quelqu'un. Le japonais melange les siennes. */
  const vues = new Set();
  for (const c of pseudo) {
    if (!/\p{L}/u.test(c)) continue;
    const e = PSEUDO_ECRITURES.find(x => new RegExp("\\p{Script=" + x + "}", "u").test(c));
    if (!e) return { ok: false, raison: "caracteres" };
    vues.add(e === "Hiragana" || e === "Katakana" ? "Han" : e);
  }
  if (vues.size > 1) return { ok: false, raison: "melange" };
  const bas = pseudo.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  const cle = Array.from(bas).map(c => PSEUDO_SOSIES[c] || c).join("");
  const nu = s => s.replace(/[_-]/g, "").replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t").replace(/8/g, "b");
  for (const s of [nu(bas), nu(cle), bas.replace(/[_-]/g, "")]) {
    if (PSEUDO_INTERDITS_EXACTS.includes(s)) return { ok: false, raison: "interdit" };
    if (PSEUDO_RESERVES.some(m => s.includes(m)) || PSEUDO_INTERDITS.some(m => s.includes(m))) return { ok: false, raison: "interdit" };
  }
  return { ok: true, pseudo, cle };
}
/* PSEUDO-FIN */

/* ---------- Le code ---------- */
/* Au moins 6 chiffres, et pas un code que tout le monde essaierait en
   premier : les pseudos sont publics (classement), un code evident ne
   tiendrait pas cinq essais. Rend "" si le code convient, sinon la raison :
   "chiffres", "court", "long" ou "facile". */
const CP_CODES_FACILES=["123123","112233","111222","121212","123321","101010","147258","258369","159753","789456","456789","654321","696969","102030","131313","246810","135790","112358","314159","420420","007007"];
function cpCodeDefaut(c){
  if(!/^\d*$/.test(c))return "chiffres";
  if(c.length<6)return "court";
  if(c.length>12)return "long";
  const d=Array.from(c,Number);
  if(d.every(x=>x===d[0]))return "facile";
  for(const pas of [1,9])if(d.every((x,i)=>!i||x===(d[i-1]+pas)%10))return "facile";
  for(const n of [1,2,3])if(c.length%n===0&&c.length>n&&c===c.slice(0,n).repeat(c.length/n))return "facile";
  if(CP_CODES_FACILES.includes(c))return "facile";
  return "";
}
/* Etirement : PBKDF2-SHA256, sale par le pseudo. Un voleur de la base doit
   refaire ce calcul pour chaque code essaye ; le serveur, lui, ne recoit que
   le resultat. Ne JAMAIS changer ces parametres : plus personne ne pourrait
   se connecter. Une evolution passerait par un nouveau prefixe de version. */
const CP_TOURS=150000;
async function cpEtirer(cle,code){
  const e=new TextEncoder();
  const k=await crypto.subtle.importKey("raw",e.encode(code),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:e.encode("chang64-compte-v1:"+cle),iterations:CP_TOURS},k,256);
  let s="";for(const o of new Uint8Array(bits))s+=String.fromCharCode(o);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

/* ---------- Fusion de deux progressions ---------- */
/* Une "enveloppe" reunit ce qui suit le joueur d'un appareil a l'autre :
     {v:1, t:{nom: date du dernier changement}, vv:{appareil: numero d'envoi},
      progress, prefs, debut, games, friendgames, duels, duelNom}
   cpFusion(local, distant, base) rend l'enveloppe fusionnee. base est le
   dernier etat que cet appareil sait partage avec le serveur : avec lui, deux
   appareils qui ont chacun avance s'additionnent (local + distant - base) ;
   sans lui (premiere connexion d'un appareil), on prend le plus grand, pour
   ne jamais compter deux fois. Regles :
   - compteurs (exercices resolus, par motif, victoires, defis) : additionnes ;
   - records (Sprint, Coordonnees, meilleure suite, meilleur jour) : le
     meilleur ; finales : le moins de coups ; exercice le plus rapide : le
     plus court ;
   - ensembles (badges, jours joues, exercices du jour, ouvertures, lecons) :
     reunis ; date d'un badge : la plus ancienne ;
   - journaux (classement, reussites, parties) : reunis, tries, plafonnes ;
   - serie de jours : les deux series sont raboutees si elles se touchent ;
   - etat du moment (niveau, classement, suite en cours, preferences, etape de
     Je debute) : celui de l'appareil qui a joue en dernier ;
   - un champ inconnu (ajoute plus tard) : celui de l'appareil le plus recent. */
const CP_NOMS=["progress","prefs","debut","games","friendgames","duels","duelNom"];
function cpNombre(x){return typeof x==="number"&&isFinite(x)?x:0;}
function cpObjet(x){return x&&typeof x==="object"&&!Array.isArray(x)?x:{};}
function cpListe(x){return Array.isArray(x)?x:[];}
/* JSON a cles triees : deux objets egaux donnent le meme texte. */
function cpTexte(x){
  if(Array.isArray(x))return "["+x.map(cpTexte).join(",")+"]";
  if(x&&typeof x==="object")return "{"+Object.keys(x).filter(k=>x[k]!==undefined).sort().map(k=>JSON.stringify(k)+":"+cpTexte(x[k])).join(",")+"}";
  return JSON.stringify(x===undefined?null:x);
}
function cpUnion(a,b){const vus=new Set(),out=[];for(const x of cpListe(a).concat(cpListe(b))){const k=typeof x==="string"?x:cpTexte(x);if(!vus.has(k)){vus.add(k);out.push(x);}}return out;}
function cpCles(a,b){return Array.from(new Set(Object.keys(cpObjet(a)).concat(Object.keys(cpObjet(b)))));}
function cpJour(k){return Math.round(new Date(k+"T12:00:00Z").getTime()/864e5);}
/* Addition a trois voies, jamais en dessous du plus grand des deux. */
function cpPlus(l,d,b,avecBase){const x=cpNombre(l),y=cpNombre(d);return avecBase?Math.max(x,y,x+y-cpNombre(b)):Math.max(x,y);}
function cpSerie(l,d){
  const a={n:cpNombre(l.days),k:typeof l.lastDay==="string"?l.lastDay:""},c={n:cpNombre(d.days),k:typeof d.lastDay==="string"?d.lastDay:""};
  if(!a.k)return c;if(!c.k)return a;
  const x=cpJour(a.k)>=cpJour(c.k)?a:c,y=x===a?c:a;
  if(a.k===c.k)return {n:Math.max(a.n,c.n),k:a.k};
  const dx=cpJour(x.k)-Math.max(1,x.n)+1,dy=cpJour(y.k)-Math.max(1,y.n)+1;
  /* La plus recente commence au plus tard le lendemain de la fin de
     l'autre : c'est une seule et meme serie. */
  if(dx<=cpJour(y.k)+1)return {n:cpJour(x.k)-Math.min(dx,dy)+1,k:x.k};
  return x;
}
function cpFusionProg(l,d,b,distantRecent){
  l=cpObjet(l);d=cpObjet(d);const avecBase=!!b;b=cpObjet(b);
  const R=distantRecent?d:l,A=distantRecent?l:d;
  const o=Object.assign({},A,R);
  const max=k=>{if(typeof l[k]==="number"||typeof d[k]==="number")o[k]=Math.max(cpNombre(l[k]),cpNombre(d[k]));};
  o.solved=cpPlus(l.solved,d.solved,b.solved,avecBase);
  ["best","rushBest","coordBest","bestDay"].forEach(max);
  const vit=[l.fastestSolveMs,d.fastestSolveMs].filter(x=>typeof x==="number"&&x>0);
  if(vit.length)o.fastestSolveMs=Math.min.apply(null,vit);else delete o.fastestSolveMs;
  if(l.usedHint||d.usedHint)o.usedHint=true;
  /* Classement : celui dont le dernier point du journal est le plus recent. */
  const hl=cpListe(l.ratingHistory),hd=cpListe(d.ratingHistory);
  const fin=h=>h.length?cpNombre(h[h.length-1].t):0;
  if(hl.length||hd.length){
    o.ratingHistory=cpUnion(hl,hd).filter(x=>x&&typeof x.t==="number").sort((x,y)=>x.t-y.t).slice(-500);
    const src=fin(hl)===fin(hd)?R:fin(hd)>fin(hl)?d:l;
    if(typeof src.rating==="number")o.rating=src.rating;
  }
  if(l.solveLog||d.solveLog)o.solveLog=Array.from(new Set(cpListe(l.solveLog).concat(cpListe(d.solveLog)).filter(x=>typeof x==="number"))).sort((x,y)=>x-y).slice(-500);
  /* Badges : reunis, dans l'ordre ou ils ont ete gagnes. */
  if(l.badges||d.badges){
    o.badgeDates={};
    for(const k of cpCles(l.badgeDates,d.badgeDates)){const v=[cpObjet(l.badgeDates)[k],cpObjet(d.badgeDates)[k]].filter(x=>typeof x==="number");if(v.length)o.badgeDates[k]=Math.min.apply(null,v);}
    const rang={};cpListe(R.badges).concat(cpListe(A.badges)).forEach((id,i)=>{if(rang[id]===undefined)rang[id]=i;});
    o.badges=cpUnion(R.badges,A.badges).filter(x=>typeof x==="string").sort((x,y)=>(o.badgeDates[x]||0)-(o.badgeDates[y]||0)||rang[x]-rang[y]);
  }
  if(l.dailyLog||d.dailyLog)o.dailyLog=Object.assign({},cpObjet(l.dailyLog),cpObjet(d.dailyLog));
  {
    const x=l.dailyRes,y=d.dailyRes;
    if(x&&y&&x.k&&y.k)o.dailyRes=x.k!==y.k?(x.k>y.k?x:y):(cpNombre(x.f)-cpNombre(y.f)||cpNombre(x.i)-cpNombre(y.i))<=0?x:y;
  }
  if(l.themeSolved||d.themeSolved){
    o.themeSolved={};
    for(const k of cpCles(l.themeSolved,d.themeSolved))o.themeSolved[k]=cpPlus(cpObjet(l.themeSolved)[k],cpObjet(d.themeSolved)[k],cpObjet(b.themeSolved)[k],avecBase);
  }
  if(l.endgames||d.endgames){
    o.endgames={};
    for(const k of cpCles(l.endgames,d.endgames)){const v=[cpObjet(l.endgames)[k],cpObjet(d.endgames)[k]].filter(x=>typeof x==="number");if(v.length)o.endgames[k]=Math.min.apply(null,v);}
  }
  /* File des erreurs a revoir : une entree sortie de la file sur un appareil
     (cinq reussites espacees) ne revient pas par l'autre. */
  if(l.mistakeQueue||d.mistakeQueue){
    const par=q=>{const m=new Map();for(const e of cpListe(q))if(e&&e.id!==undefined)m.set(String(e.id),e);return m;};
    const ml=par(l.mistakeQueue),md=par(d.mistakeQueue),mb=par(b.mistakeQueue),out=[];
    for(const id of new Set(Array.from(ml.keys()).concat(Array.from(md.keys())))){
      const x=ml.get(id),y=md.get(id);
      if(avecBase&&mb.has(id)&&(!x||!y))continue;
      out.push(!x?y:!y?x:(cpNombre(x.box)-cpNombre(y.box)||cpNombre(x.due)-cpNombre(y.due))>=0?x:y);
    }
    o.mistakeQueue=out.sort((x,y)=>cpNombre(x.ts)-cpNombre(y.ts)).slice(-200);
  }
  const s=cpSerie(l,d);
  if(s.k){o.days=s.n;o.lastDay=s.k;}
  /* Compteur du jour : meme jour des deux cotes, on additionne. */
  if(l.dayCountDate&&l.dayCountDate===d.dayCountDate)o.dayCount=cpPlus(l.dayCount,d.dayCount,b.dayCountDate===l.dayCountDate?b.dayCount:0,avecBase);
  else if(l.dayCountDate||d.dayCountDate){const src=String(l.dayCountDate||"")>=String(d.dayCountDate||"")?l:d;o.dayCount=cpNombre(src.dayCount);o.dayCountDate=src.dayCountDate;}
  if(typeof o.dayCount==="number")o.bestDay=Math.max(cpNombre(o.bestDay),o.dayCount);
  /* Compteurs des badges (badges.js) : f = faits acquis, j = jours joues,
     c = compteurs et etats (objectif du jour, gels, defis de la semaine). */
  if(l.bx||d.bx){
    const xl=cpObjet(l.bx),xd=cpObjet(d.bx),xb=cpObjet(b.bx),cl=cpObjet(xl.c),cd=cpObjet(xd.c),cb=cpObjet(xb.c);
    const cR=distantRecent?cd:cl,cA=distantRecent?cl:cd,c=Object.assign({},cA,cR);
    for(const k of ["vic","defisFaits","semParfaites"])if(typeof cl[k]==="number"||typeof cd[k]==="number")c[k]=cpPlus(cl[k],cd[k],cb[k],avecBase);
    if(typeof cl.defaite==="number"||typeof cd.defaite==="number")c.defaite=Math.max(cpNombre(cl.defaite),cpNombre(cd.defaite));
    if(cl.perduNiv||cd.perduNiv)c.perduNiv=Object.assign({},cpObjet(cl.perduNiv),cpObjet(cd.perduNiv));
    for(const k of ["langues","ouvFam"])if(cl[k]||cd[k])c[k]=cpUnion(cl[k],cd[k]);
    if(cl.jour&&cl.jour===cd.jour)c.jourN=cpPlus(cl.jourN,cd.jourN,cb.jour===cl.jour?cb.jourN:0,avecBase);
    else if(cl.jour||cd.jour){const src=String(cl.jour||"")>=String(cd.jour||"")?cl:cd;c.jour=src.jour;c.jourN=cpNombre(src.jourN);}
    /* Gels : gagnes et depenses s'additionnent quand on connait la base. */
    if(avecBase&&typeof cl.gels==="number"&&typeof cd.gels==="number")c.gels=Math.max(0,Math.min(2,cl.gels+cd.gels-cpNombre(cb.gels)));
    if(cl.objDernier||cd.objDernier){
      const src=String(cl.objDernier||"")===String(cd.objDernier||"")?(cpNombre(cl.objSerie)>=cpNombre(cd.objSerie)?cl:cd):String(cl.objDernier||"")>String(cd.objDernier||"")?cl:cd;
      c.objDernier=src.objDernier;c.objSerie=cpNombre(src.objSerie);
    }
    /* Defis de la semaine : la semaine la plus recente ; meme semaine, le
       meilleur de chaque defi. */
    const dl=cl.defis,dd=cd.defis;
    if(dl&&dd&&dl.lundi&&dd.lundi){
      if(dl.lundi!==dd.lundi)c.defis=dl.lundi>dd.lundi?dl:dd;
      else c.defis={lundi:dl.lundi,p:[0,1,2].map(i=>Math.max(cpNombre(cpListe(dl.p)[i]),cpNombre(cpListe(dd.p)[i]))),
        ok:[0,1,2].map(i=>!!(cpListe(dl.ok)[i]||cpListe(dd.ok)[i])),jours:cpUnion(dl.jours,dd.jours),objJours:cpUnion(dl.objJours,dd.objJours)};
    }
    o.bx={f:Object.assign({},cpObjet(xl.f),cpObjet(xd.f)),j:Object.assign({},cpObjet(xl.j),cpObjet(xd.j)),c:c};
  }
  return o;
}
function cpFusion(L,D,B){
  if(!D||typeof D!=="object")return L;
  if(!L||typeof L!=="object")return D;
  const tl=cpObjet(L.t),td=cpObjet(D.t),recent=n=>cpNombre(td[n])>cpNombre(tl[n]);
  const out={v:1,t:{},vv:{}};
  for(const n of cpCles(tl,td))out.t[n]=Math.max(cpNombre(tl[n]),cpNombre(td[n]));
  for(const a of cpCles(L.vv,D.vv))out.vv[a]=Math.max(cpNombre(cpObjet(L.vv)[a]),cpNombre(cpObjet(D.vv)[a]));
  const base=B&&typeof B==="object"&&B.progress?B.progress:null;
  if(L.progress||D.progress)out.progress=cpFusionProg(L.progress,D.progress,base,recent("progress"));
  for(const n of ["prefs","duelNom"]){
    const v=recent(n)?(D[n]!==undefined?D[n]:L[n]):(L[n]!==undefined?L[n]:D[n]);
    if(v!==undefined)out[n]=v;
  }
  if(L.debut||D.debut){
    const R=recent("debut")?D.debut||L.debut:L.debut||D.debut,x=cpObjet(L.debut),y=cpObjet(D.debut);
    out.debut=Object.assign({},R,{f:cpUnion(x.f,y.f).filter(Number.isInteger).sort((p,q)=>p-q)});
  }
  for(const n of ["games","friendgames"])if(L[n]||D[n])out[n]=cpUnion(L[n],D[n]).filter(g=>g&&typeof g==="object").sort((x,y)=>cpNombre(y.t)-cpNombre(x.t)).slice(0,30);
  if(L.duels||D.duels)out.duels=cpUnion(D.duels,L.duels).slice(-20);
  return out;
}
/* Meme contenu ? Les dates et les numeros d'envoi ne comptent pas. */
function cpContenu(e){const c=Object.assign({},e);delete c.t;delete c.vv;return cpTexte(c);}

/* ---------- Etat local ---------- */
/* chang64:compte       {pseudo, cle, version, dev, n, sync} : la session vue
                        d'ici (le jeton, lui, est dans un cookie illisible) ;
   chang64:compteMaj    {nom: date} : dernier changement de chaque morceau ;
   chang64:compteBase   {cle, env} : dernier etat partage avec le serveur ;
   chang64:compteEnvois [{n, env}] : envois dont la reponse n'est pas arrivee. */
const CP_STOCK={"chang64:progress":"progress","chang64:prefs":"prefs","chang64:debut":"debut","chang64:games":"games","chang64:friendgames":"friendgames","chang64:duels":"duels","chang64:duelNom":"duelNom"};
let cp=null,cpMaj={},cpSilence=false,cpEnCours=false,cpEncore=false,cpMinuteur=0,cpEtatSync="",cpDernier={};
function cpLire(k){try{const v=localStorage.getItem(k);return v===null?null:JSON.parse(v);}catch(e){return null;}}
function cpEcrire(k,v){try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}
function cpSauver(){cpEcrire("chang64:compte",cp);}
function cpBase(){const b=cpLire("chang64:compteBase");return cp&&b&&b.cle===cp.cle?b.env:null;}
/* Le quota du navigateur peut refuser la base : on s'en passe (la fusion
   prend alors le plus grand au lieu d'additionner). */
function cpBaseEcrire(env){if(cp&&!cpEcrire("chang64:compteBase",{cle:cp.cle,env:env}))cpEcrire("chang64:compteBase",null);}
/* Tout changement d'un morceau suivi est date et declenche un envoi. */
{
  const av=window.storage.set;
  window.storage.set=function(k,v){
    const nom=CP_STOCK[k];
    if(nom&&!cpSilence){
      const s=typeof v==="string"?v:JSON.stringify(v);
      let brut=s;try{brut=cpTexte(JSON.parse(s));}catch(e){}
      if(cpDernier[k]!==undefined&&cpDernier[k]!==brut){cpMaj[nom]=Date.now();cpEcrire("chang64:compteMaj",cpMaj);cpPlanifier(20000);}
      cpDernier[k]=brut;
    }
    return av.apply(this,arguments);
  };
}
function cpStockLire(k){
  let v=null;try{v=localStorage.getItem(k);}catch(e){}
  if(v===null||v===undefined)return undefined;
  if(k==="chang64:duelNom")return v;
  try{return JSON.parse(v);}catch(e){return undefined;}
}
/* L'etat de cet appareil, pret a etre fusionne ou envoye. */
function cpEnveloppe(){
  const b=cpBase(),e={v:1,t:Object.assign({},cpMaj),vv:Object.assign({},b&&b.vv)};
  for(const k in CP_STOCK){
    const v=k==="chang64:progress"?JSON.parse(JSON.stringify(prog)):cpStockLire(k);
    if(v!==undefined&&v!==null)e[CP_STOCK[k]]=v;
  }
  return e;
}
/* Pose une enveloppe sur cet appareil, sans que cela compte pour un
   changement local. */
function cpAppliquer(env){
  cpSilence=true;
  try{
    cpMaj=Object.assign({},cpObjet(env.t));cpEcrire("chang64:compteMaj",cpMaj);
    for(const k in CP_STOCK){
      const nom=CP_STOCK[k],v=env[nom];
      if(v===undefined||v===null)continue;
      if(nom==="progress"){
        const avant=prog.badges?prog.badges.length:0;
        prog=JSON.parse(JSON.stringify(v));
        if(typeof migrerNiveau==="function")prog=migrerNiveau(prog);
        ensureProgFields();
        /* Les badges venus de l'autre appareil sont deja gagnes : le bilan de
           seance ne les compte pas, aucune fenetre ne les annonce. */
        if(typeof bilanS!=="undefined"&&bilanS)bilanS.badges+=Math.max(0,prog.badges.length-avant);
        saveProg();
      }else{
        window.storage.set(k,nom==="duelNom"?String(v):JSON.stringify(v));
        if(nom==="games"&&typeof history!=="undefined"&&Array.isArray(history))history=v;
        if(nom==="friendgames"&&typeof amiHistory!=="undefined"&&Array.isArray(amiHistory))amiHistory=v;
      }
      cpDernier[k]=nom==="duelNom"?String(v):cpTexte(nom==="progress"?prog:v);
    }
  }finally{cpSilence=false;}
  try{if(typeof renderProgress==="function")renderProgress();}catch(e){}
  try{if(typeof objMaj==="function")objMaj(false);}catch(e){}
  try{if(typeof menuResume==="function")menuResume();}catch(e){}
}

/* ---------- Serveur ---------- */
async function cpApi(methode,route,corps,garder){
  try{
    const o={method:methode,credentials:"same-origin",cache:"no-store",headers:{}};
    if(corps!==undefined){o.headers["Content-Type"]="application/json";o.body=JSON.stringify(corps);if(garder&&o.body.length<60000)o.keepalive=true;}
    const r=await fetch("/api/compte/"+route,o);
    let j=null;try{j=await r.json();}catch(e){}
    return {s:r.status,j:j||{}};
  }catch(e){return {s:0,j:{}};}
}
function cpEtat(e){cpEtatSync=e;if(e==="ok"&&cp){cp.sync=Date.now();cpSauver();}cpPoint();if(cpVueOuverte()&&cpEcran==="connecte")cpVue("connecte");}
/* Un envoi dont la reponse s'est perdue a pu arriver quand meme : si l'etat
   du serveur porte son numero, il devient la base. Sans cela, ce qu'il
   contenait serait additionne une seconde fois. */
function cpConfirmer(distant){
  const envois=cpListe(cpLire("chang64:compteEnvois")),vu=cpNombre(cpObjet(distant&&distant.vv)[cp.dev]);
  const arrives=envois.filter(x=>x.n<=vu).sort((x,y)=>y.n-x.n);
  if(arrives.length)cpBaseEcrire(arrives[0].env);
  cpEcrire("chang64:compteEnvois",envois.filter(x=>x.n>vu));
}
/* Synchronise : lit le serveur si demande (tirer), fusionne, envoie. Si un
   autre appareil a ecrit entre-temps (409), on fusionne avec ce qu'il a
   laisse et on recommence. Rend true si tout est a jour. */
async function cpSynchro(o){
  if(!cp)return false;
  if(cpEnCours){cpEncore=true;return false;}
  cpEnCours=true;clearTimeout(cpMinuteur);
  try{
    let distant=null,version=cp.version,lu=false;
    if((o&&o.tirer)||!Number.isInteger(version)){
      const r=await cpApi("GET","synchro");
      if(r.s===401){cpSessionPerdue();return false;}
      if(r.s!==200){cpEtat("hors-ligne");return false;}
      distant=r.j.donnees;version=r.j.version;lu=true;
    }
    for(let essai=0;essai<4;essai++){
      const local=cpEnveloppe();
      let fusion=local;
      if(distant){
        cpConfirmer(distant);
        fusion=cpFusion(local,distant,cpBase());
        if(cpContenu(fusion)!==cpContenu(local))cpAppliquer(fusion);
        if(cpContenu(fusion)===cpContenu(distant)){cp.version=version;cpBaseEcrire(distant);cpEcrire("chang64:compteEnvois",null);cpEtat("ok");return true;}
      }else if(!lu){
        const b=cpBase();
        if(b&&cpContenu(b)===cpContenu(local)){cpEtat("ok");return true;}
      }
      cp.n=(cp.n||0)+1;cpSauver();
      fusion.vv=Object.assign({},fusion.vv);fusion.vv[cp.dev]=cp.n;
      const envois=cpListe(cpLire("chang64:compteEnvois")).slice(-1);envois.push({n:cp.n,env:fusion});
      if(!cpEcrire("chang64:compteEnvois",envois))cpEcrire("chang64:compteEnvois",null);
      const r=await cpApi("PUT","synchro",{version:version,donnees:fusion},o&&o.garder);
      if(r.s===200){cp.version=r.j.version;cpBaseEcrire(fusion);cpEcrire("chang64:compteEnvois",null);cpEtat("ok");return true;}
      if(r.s===409){distant=r.j.donnees;version=r.j.version;lu=true;continue;}
      if(r.s===401){cpSessionPerdue();return false;}
      /* Trop gros : on allege (parties les plus anciennes) et on reessaie
         au prochain changement. */
      if(r.s===413){cpAlleger();}
      cpEtat("hors-ligne");return false;
    }
    cpEtat("hors-ligne");return false;
  }finally{
    cpEnCours=false;
    if(cpEncore){cpEncore=false;cpPlanifier(5000);}
  }
}
function cpAlleger(){
  cpSilence=true;
  try{for(const k of ["chang64:games","chang64:friendgames"]){const l=cpStockLire(k);if(Array.isArray(l)&&l.length>5)window.storage.set(k,JSON.stringify(l.slice(0,Math.floor(l.length/2))));}}
  finally{cpSilence=false;}
}
function cpPlanifier(ms){
  if(!cp||cpEtatSync==="session")return;
  clearTimeout(cpMinuteur);
  cpMinuteur=setTimeout(()=>{cpSynchro();},ms);
}
/* La session a expire ou a ete fermee ailleurs (changement de code) : la
   progression reste sur l'appareil, on propose de se reconnecter. */
function cpSessionPerdue(){cpEtatSync="session";cpPoint();if(cpVueOuverte())cpVue("connecte");}
/* Remplace l'etat du serveur par celui de cet appareil, sans fusion : apres
   "Recommencer la progression", sinon l'ancienne reviendrait. */
async function cpEcraser(){
  if(!cp)return;
  const r=await cpApi("GET","synchro");
  if(r.s!==200)return;
  cpMaj.progress=Date.now();cpEcrire("chang64:compteMaj",cpMaj);
  const env=cpEnveloppe();
  env.vv=Object.assign({},cpObjet(r.j.donnees&&r.j.donnees.vv));
  const w=await cpApi("PUT","synchro",{version:r.j.version,donnees:env});
  if(w.s===200){cp.version=w.j.version;cpBaseEcrire(env);cpEcrire("chang64:compteEnvois",null);cpEtat("ok");}
}
/* Ouvre la session locale apres une creation ou une connexion reussie. */
function cpOuvrir(pseudo,version){
  const v=pseudoValider(pseudo),ancien=cpLire("chang64:compte");
  cp={pseudo:pseudo,cle:v.ok?v.cle:pseudo.toLowerCase(),version:version,dev:(ancien&&ancien.dev)||Math.random().toString(36).slice(2,8),n:(ancien&&ancien.n)||0,sync:0};
  cpEtatSync="";cpSauver();cpPoint();
}
/* Ferme la session locale. effacer : retire aussi la progression de cet
   appareil (appareil partage). */
function cpFermer(effacer){
  cp=null;clearTimeout(cpMinuteur);cpEtatSync="";
  cpEcrire("chang64:compte",null);cpEcrire("chang64:compteEnvois",null);
  if(effacer){
    cpEcrire("chang64:compteBase",null);cpEcrire("chang64:compteMaj",null);
    cpSilence=true;
    for(const k in CP_STOCK)try{window.storage.delete(k);}catch(e){}
    try{window.storage.delete("chang64:play");window.storage.delete("chang64:friend");}catch(e){}
    location.reload();
  }
  cpPoint();
}

/* ---------- Ecrans ---------- */
let cpEcran="",cpBrouillon={},cpPseudoMinuteur=0,cpLienMinuteur=0;
function cpVueOuverte(){const v=$("menuCompteVue"),r=$("menuTiroir");return !!(v&&r&&!r.hidden&&!v.hidden);}
/* Le point du bouton de menu signale aussi une session a rouvrir. */
function cpPoint(){
  const d=$("menuCompteDetail");
  if(d)d.textContent=cp?cp.pseudo:"";
  const p=$("menuComptePoint");if(p)p.hidden=cpEtatSync!=="session";
}
const CP_RAISONS={longueur:"Between 3 and 20 characters.",caracteres:"Letters, digits, - and _ only.",melange:"Use a single alphabet.",interdit:"This username is not allowed. Try another one.",pris:"This username is already taken."};
const CP_CODE_RAISONS={chiffres:"Digits only.",court:"At least 6 digits.",long:"12 digits at most.",facile:"Too easy to guess. Choose another one."};
const CP_ERREURS={identifiants:"Wrong username or code.",lien:"Wrong or expired device code.",plus_tard:"Too many sign-ups right now. Try again in an hour.",session:"Your session has ended. Log in again."};
function cpErreur(r){
  if(r.s===0)return t("No connection. Check your network and try again.");
  if(r.s===429&&r.j.erreur==="bloque"){const m=Math.max(1,Math.ceil(cpNombre(r.j.attendre)/60));return t("Too many wrong codes. Try again in {n} min.",{n:m});}
  /* Deja connecte, seul le code a pu etre faux. */
  if(r.j.erreur==="identifiants"&&cp&&cpEtatSync!=="session")return t("Wrong code.");
  return t(CP_ERREURS[r.j.erreur]||"Something went wrong. Try again later.");
}
const cpE=s=>echapper(t(s));
function cpChamp(id,label,attrs,aide){
  return '<label class="cp-champ" for="'+id+'"><span>'+cpE(label)+'</span><input id="'+id+'" '+attrs+' autocapitalize="off" autocorrect="off" spellcheck="false">'+
    (aide?'<small id="'+id+'Aide">'+cpE(aide)+"</small>":"")+"</label>";
}
const CP_ATTR_PSEUDO='type="text" maxlength="24" autocomplete="username"';
const cpAttrCode=nouveau=>'type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12" autocomplete="'+(nouveau?"new-password":"current-password")+'"';
function cpMessage(texte,ok){const m=$("cpMsg");if(m){m.textContent=texte||"";m.classList.toggle("cp-ok",!!ok);}}
function cpOccupe(oui){document.querySelectorAll("#menuCompteVue button").forEach(b=>{b.disabled=!!oui;});}
/* Un QR du lien d'ajout d'appareil, dessine en SVG (voir cpQr plus bas). */
function cpVue(ecran,donnees){
  const v=$("menuCompteVue");if(!v)return;
  clearInterval(cpLienMinuteur);
  cpEcran=ecran;
  let h="";
  const msg='<p class="cp-msg" id="cpMsg" role="status" aria-live="polite"></p>';
  const retour=(vers,texte)=>'<button type="button" class="linkbtn cp-lien" data-cp="'+vers+'">'+cpE(texte||"Back")+"</button>";
  if(ecran==="accueil"){
    h='<p class="app-intro">'+cpE("An account keeps your progress safe and follows you from one device to another.")+"</p>"+
      '<ul class="app-avantages">'+["Your rating, badges, streak and games on your phone, tablet and computer.","Nothing is lost if you clear your browser or change device.","Free, and optional: everything stays playable without an account."].map(x=>"<li>"+cpE(x)+"</li>").join("")+"</ul>"+
      '<p class="tiroir-section">'+cpE("What we ask for")+"</p>"+
      '<p class="cp-note">'+cpE("A username and a code of 6 digits or more. That is all: today we ask for no name and no email address.")+"</p>"+
      '<button type="button" class="btn primary cp-large" data-cp="creer1">'+cpE("Create an account")+"</button>"+
      '<button type="button" class="btn cp-large" data-cp="connexion">'+cpE("Log in")+"</button>"+
      '<p class="cp-centre"><a class="cp-lien" href="'+echapper(cpPage())+'">'+cpE("How the account works")+"</a></p>";
  }else if(ecran==="creer1"){
    h='<p class="cp-etape">'+echapper(t("Step {n} of 3",{n:1}))+"</p><h3>"+cpE("Choose a username")+"</h3>"+
      cpChamp("cpPseudo","Username",CP_ATTR_PSEUDO,"3 to 20 letters or digits. Other players will see it.")+
      '<p class="cp-note">'+cpE("Tip: do not use your real name.")+"</p>"+msg+
      '<button type="button" class="btn primary cp-large" id="cpSuite" disabled>'+cpE("Continue")+"</button>"+retour("accueil");
  }else if(ecran==="creer2"){
    h='<p class="cp-etape">'+echapper(t("Step {n} of 3",{n:2}))+"</p><h3>"+cpE("Choose your code")+"</h3>"+
      '<p class="cp-note">'+echapper(t("Username: {pseudo}",{pseudo:cpBrouillon.pseudo}))+"</p>"+
      cpChamp("cpCode1","Code",cpAttrCode(true),"6 digits or more. You will type it to log in on another device.")+
      cpChamp("cpCode2","Same code again",cpAttrCode(true))+msg+
      '<button type="button" class="btn primary cp-large" id="cpCreer">'+cpE("Create my account")+"</button>"+retour("creer1");
  }else if(ecran==="secoursVu"){
    /* Le code de secours, montre une seule fois. */
    h=(donnees&&donnees.creation?'<p class="cp-etape">'+echapper(t("Step {n} of 3",{n:3}))+"</p>":"")+"<h3>"+cpE("Write down your recovery code")+"</h3>"+
      '<p class="cp-note">'+cpE("If you forget your code, this recovery code is the only way back into your account. We cannot show it again and we have no email address to send it to.")+"</p>"+
      '<p class="cp-secours" id="cpSecours">'+echapper(donnees.secours)+"</p>"+
      '<button type="button" class="btn cp-large" id="cpCopier">'+cpE("Copy")+"</button>"+
      '<label class="cp-case"><input type="checkbox" id="cpNote"><span>'+cpE("I have written it down in a safe place.")+"</span></label>"+
      (donnees&&donnees.creation?'<p class="cp-note">'+cpE("Good to know: an account left unused for two years is deleted, with everything it holds.")+"</p>":"")+msg+
      '<button type="button" class="btn primary cp-large" id="cpFini" disabled>'+cpE("Done")+"</button>";
  }else if(ecran==="connexion"){
    h="<h3>"+cpE("Log in")+"</h3>"+
      cpChamp("cpPseudo","Username",CP_ATTR_PSEUDO)+cpChamp("cpCode1","Code",cpAttrCode(false))+msg+
      '<button type="button" class="btn primary cp-large" id="cpConnexion">'+cpE("Log in")+"</button>"+
      '<p class="cp-centre">'+retour("lier","I have a device code")+" "+retour("secours","Forgot your code?")+"</p>"+retour(cp?"connecte":"accueil");
  }else if(ecran==="lier"){
    h="<h3>"+cpE("Add this device")+"</h3>"+
      '<p class="cp-note">'+cpE("On a device where you are already logged in, open Menu, My account, Add a device. Then type the code shown there.")+"</p>"+
      cpChamp("cpPseudo","Username",CP_ATTR_PSEUDO)+cpChamp("cpLien","Device code",'type="text" maxlength="8" autocomplete="one-time-code"')+msg+
      '<button type="button" class="btn primary cp-large" id="cpLier">'+cpE("Connect this device")+"</button>"+retour("connexion");
  }else if(ecran==="secours"){
    h="<h3>"+cpE("Forgot your code?")+"</h3>"+
      '<p class="cp-note">'+cpE("Type your recovery code, then choose a new code. Your other devices will be logged out.")+"</p>"+
      cpChamp("cpPseudo","Username",CP_ATTR_PSEUDO)+cpChamp("cpSecoursSaisi","Recovery code",'type="text" maxlength="24" autocomplete="off"')+
      cpChamp("cpCode1","New code",cpAttrCode(true),"6 digits or more.")+cpChamp("cpCode2","Same code again",cpAttrCode(true))+msg+
      '<button type="button" class="btn primary cp-large" id="cpSecoursOk">'+cpE("Change my code")+"</button>"+retour("connexion");
  }else if(ecran==="choix"){
    h="<h3>"+cpE("This device already has progress")+"</h3>"+
      '<p class="cp-note">'+cpE("What should happen to the progress saved on this device?")+"</p>"+
      '<button type="button" class="btn primary cp-large" id="cpFusionner">'+cpE("Merge it with my account")+"</button>"+
      '<p class="cp-note">'+cpE("Nothing is lost: the best of both is kept.")+"</p>"+
      '<button type="button" class="btn cp-large" id="cpRemplacer">'+cpE("Use my account only")+"</button>"+
      '<p class="cp-note">'+cpE("The progress on this device is replaced by the one in your account.")+"</p>"+msg;
  }else if(ecran==="connecte"){
    const perdue=cpEtatSync==="session";
    const etat=perdue?t("Your session has ended. Log in again."):cpEtatSync==="hors-ligne"?t("Not synced: no connection. It will retry on its own."):cp.sync?t("Last sync: {heure}",{heure:cpHeure(cp.sync)}):t("Syncing…");
    h='<div class="cp-carte"><b>'+echapper(cp.pseudo)+'</b><span class="'+(perdue||cpEtatSync==="hors-ligne"?"cp-alerte":"")+'">'+echapper(etat)+"</span></div>"+msg+
      (perdue?'<button type="button" class="btn primary cp-large" data-cp="connexion">'+cpE("Log in")+"</button>":
      '<button type="button" class="btn cp-large" id="cpSync">'+cpE("Sync now")+"</button>"+
      '<p class="tiroir-section">'+cpE("My devices")+"</p>"+
      '<button type="button" class="tiroir-lien" data-cp="appareil"><span>'+cpE("Add a device")+"</span></button>"+
      '<p class="tiroir-section">'+cpE("Security")+"</p>"+
      '<button type="button" class="tiroir-lien" data-cp="code"><span>'+cpE("Change my code")+"</span></button>"+
      '<button type="button" class="tiroir-lien" data-cp="secoursNouveau"><span>'+cpE("New recovery code")+"</span></button>"+
      '<p class="tiroir-section">'+cpE("My data")+"</p>"+
      '<a class="tiroir-lien" href="/api/compte/exporter" download="chang64-compte.json"><span>'+cpE("Download my data")+"</span></a>"+
      '<button type="button" class="tiroir-lien" data-cp="supprimer"><span>'+cpE("Delete my account")+"</span></button>")+
      '<button type="button" class="tiroir-lien" data-cp="deconnexion"><span>'+cpE("Log out")+"</span></button>"+
      '<p class="cp-centre"><a class="cp-lien" href="'+echapper(cpPage())+'">'+cpE("How the account works")+"</a></p>";
  }else if(ecran==="appareil"){
    h="<h3>"+cpE("Add a device")+"</h3>"+
      '<p class="cp-note">'+cpE("On the other device, scan this code with the camera, or open chang64, Menu, My account, Log in, “I have a device code”.")+"</p>"+
      '<div class="cp-qr" id="cpQr"></div>'+
      '<p class="cp-note cp-centre">'+echapper(t("Username: {pseudo}",{pseudo:cp.pseudo}))+"</p>"+
      '<p class="cp-secours" id="cpLienCode">······</p><p class="cp-note cp-centre" id="cpLienReste"></p>'+msg+retour("connecte");
  }else if(ecran==="code"){
    h="<h3>"+cpE("Change my code")+"</h3>"+
      cpChamp("cpAncien","Current code",cpAttrCode(false))+cpChamp("cpCode1","New code",cpAttrCode(true),"6 digits or more.")+cpChamp("cpCode2","Same code again",cpAttrCode(true))+
      '<p class="cp-note">'+cpE("Your other devices will be logged out.")+"</p>"+msg+
      '<button type="button" class="btn primary cp-large" id="cpCodeOk">'+cpE("Change my code")+"</button>"+retour("connecte");
  }else if(ecran==="secoursNouveau"){
    h="<h3>"+cpE("New recovery code")+"</h3>"+
      '<p class="cp-note">'+cpE("The previous recovery code will stop working.")+"</p>"+
      cpChamp("cpAncien","Your code",cpAttrCode(false))+msg+
      '<button type="button" class="btn primary cp-large" id="cpSecoursNouveauOk">'+cpE("Show a new recovery code")+"</button>"+retour("connecte");
  }else if(ecran==="supprimer"){
    h="<h3>"+cpE("Delete my account")+"</h3>"+
      '<p class="cp-note">'+cpE("Your account, your username and everything saved on our server are erased at once, for good. The progress on this device stays here.")+"</p>"+
      cpChamp("cpAncien","Your code",cpAttrCode(false))+msg+
      '<button type="button" class="btn cp-large cp-danger" id="cpSupprimerOk">'+cpE("Delete my account for good")+"</button>"+retour("connecte");
  }else if(ecran==="deconnexion"){
    h="<h3>"+cpE("Log out")+"</h3>"+
      '<p class="cp-note">'+cpE("Your account keeps everything. What about this device?")+"</p>"+
      '<button type="button" class="btn primary cp-large" id="cpSortirGarder">'+cpE("Log out and keep my progress here")+"</button>"+
      '<button type="button" class="btn cp-large" id="cpSortirEffacer">'+cpE("Log out and erase this device")+"</button>"+
      '<p class="cp-note">'+cpE("Choose “erase” on a device you share.")+"</p>"+msg+retour("connecte");
  }
  poserHtml(v,h);
  v.scrollTop=0;
  const titre=$("menuTitre");if(titre)titre.textContent=t("My account");
  const premier=v.querySelector("input:not([type=checkbox])")||v.querySelector("h3");
  if(premier&&premier.tagName==="INPUT"&&donnees!=="sansFocus")setTimeout(()=>{try{premier.focus({preventScroll:true});}catch(e){}},mouvementCalme()?0:280);
  if(ecran==="creer1"){const i=$("cpPseudo");if(cpBrouillon.pseudo){i.value=cpBrouillon.pseudo;cpPseudoVerifier();}}
  if(ecran==="lier"&&cpBrouillon.lien){$("cpPseudo").value=cpBrouillon.lien.pseudo;$("cpLien").value=cpBrouillon.lien.code;}
  if(ecran==="appareil")cpLienDemander();
}
function cpHeure(ts){
  const d=new Date(ts),h=String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
  return new Date().toDateString()===d.toDateString()?h:fmtDayMonth(d)+" "+h;
}
/* Adresse de la page qui explique le compte, dans la langue en cours. */
const CP_PAGES=__COMPTE_PAGES__;
function cpPage(){return CP_PAGES[typeof LANG==="string"?LANG:"en"]||CP_PAGES.en||"/";}

/* Verification du pseudo pendant la saisie : les regles d'abord, ici, puis
   la disponibilite, demandee au serveur apres une courte pause. */
function cpPseudoVerifier(){
  const i=$("cpPseudo"),b=$("cpSuite");if(!i||!b)return;
  clearTimeout(cpPseudoMinuteur);b.disabled=true;
  const brut=i.value;
  if(!brut.trim()){cpMessage("");return;}
  const v=pseudoValider(brut);
  if(!v.ok){cpMessage(t(CP_RAISONS[v.raison]));return;}
  cpMessage(t("Checking…"));
  cpPseudoMinuteur=setTimeout(async()=>{
    const r=await cpApi("POST","pseudo",{pseudo:v.pseudo});
    if(cpEcran!=="creer1"||$("cpPseudo").value!==brut)return;
    if(r.s!==200){cpMessage(cpErreur(r));return;}
    if(!r.j.libre){cpMessage(t(CP_RAISONS[r.j.raison]||CP_RAISONS.interdit));return;}
    cpMessage(t("This username is free."),true);
    cpBrouillon.pseudo=v.pseudo;cpBrouillon.cle=v.cle;b.disabled=false;
  },400);
}
/* Lit et controle les deux saisies du nouveau code ; rend le code ou "". */
function cpNouveauCode(){
  const a=$("cpCode1").value,b=$("cpCode2").value,defaut=cpCodeDefaut(a);
  if(defaut){cpMessage(t(CP_CODE_RAISONS[defaut]));$("cpCode1").focus();return "";}
  if(a!==b){cpMessage(t("The two codes are different."));$("cpCode2").focus();return "";}
  return a;
}
/* Pseudo saisi sur un ecran de connexion : {pseudo, cle} ou null. */
function cpPseudoSaisi(){
  const v=pseudoValider($("cpPseudo").value);
  if(!v.ok){cpMessage(t(CP_ERREURS.identifiants));return null;}
  return v;
}
/* Y a-t-il ici une progression qui vaille une question avant de fusionner ? */
function cpProgressionLocale(){
  return (prog.solved||0)>0||(prog.badges&&prog.badges.length>0)||(Array.isArray(cpStockLire("chang64:games"))&&cpStockLire("chang64:games").length>0);
}
/* Apres une connexion reussie : on lit le compte, puis on fusionne. Si cet
   appareil a deja une progression qui ne vient pas de ce compte, on demande. */
async function cpApresConnexion(pseudo,version){
  cpOuvrir(pseudo,version);
  const r=await cpApi("GET","synchro");
  if(r.s!==200){cpVue("connecte");cpEtat("hors-ligne");return;}
  cp.version=r.j.version;cpSauver();
  const distant=r.j.donnees;
  if(distant&&!cpBase()&&cpProgressionLocale()&&cpContenu(cpFusion(cpEnveloppe(),distant,null))!==cpContenu(distant)){
    cpBrouillon.distant=distant;cpVue("choix");return;
  }
  await cpSynchro({tirer:true});
  cpRecharger();
}
/* La page est relue pour que tout (preferences, historique, Je debute)
   reprenne l'etat fusionne ; le menu se rouvre sur Mon compte. */
function cpRecharger(){
  try{sessionStorage.setItem("chang64:compteRetour","1");}catch(e){}
  location.reload();
}
async function cpLienDemander(){
  const r=await cpApi("POST","lien",{});
  if(cpEcran!=="appareil")return;
  if(r.s===401){cpSessionPerdue();return;}
  if(r.s!==200){cpMessage(cpErreur(r));return;}
  $("cpLienCode").textContent=r.j.code;
  const url=location.origin+location.pathname+"#lier="+cp.pseudo+"~"+r.j.code;
  try{poserHtml($("cpQr"),cpQr(url));$("cpQr").setAttribute("role","img");$("cpQr").setAttribute("aria-label",t("QR code to add a device"));}catch(e){$("cpQr").hidden=true;}
  const maj=()=>{
    const s=Math.max(0,Math.round((r.j.expire-Date.now())/1000)),e=$("cpLienReste");
    if(!e||cpEcran!=="appareil"){clearInterval(cpLienMinuteur);return;}
    if(!s){clearInterval(cpLienMinuteur);cpVue("appareil");return;}
    e.textContent=t("Valid for {m}:{s}, once.",{m:Math.floor(s/60),s:String(s%60).padStart(2,"0")});
  };
  maj();cpLienMinuteur=setInterval(maj,1000);
}
async function cpAction(id){
  if(id==="cpSuite"){cpVue("creer2");return;}
  if(id==="cpCopier"){copyText($("cpSecours").textContent);cpMessage(t("Copied."),true);return;}
  if(id==="cpFini"){cpBrouillon={};cpVue("connecte");return;}
  if(id==="cpSync"){cpOccupe(true);cpMessage(t("Syncing…"));await cpSynchro({tirer:true});if(cpEcran==="connecte")cpVue("connecte");return;}
  if(id==="cpSortirGarder"||id==="cpSortirEffacer"){
    cpOccupe(true);
    if(id==="cpSortirGarder")await cpSynchro();
    await cpApi("POST","deconnexion",{});
    cpFermer(id==="cpSortirEffacer");
    cpVue("accueil");return;
  }
  if(id==="cpFusionner"||id==="cpRemplacer"){
    cpOccupe(true);
    if(id==="cpRemplacer"){cpAppliquer(cpBrouillon.distant);cpBaseEcrire(cpBrouillon.distant);}
    else await cpSynchro({tirer:true});
    cpBrouillon={};cpRecharger();return;
  }
  cpMessage("");
  let r=null;
  if(id==="cpCreer"){
    const code=cpNouveauCode();if(!code)return;
    cpOccupe(true);cpMessage(t("Creating your account…"));
    r=await cpApi("POST","creer",{pseudo:cpBrouillon.pseudo,code:await cpEtirer(cpBrouillon.cle,code),donnees:cpEnveloppe()});
    if(r.s===201){
      cpOuvrir(r.j.pseudo,r.j.version);cpBaseEcrire(cpEnveloppe());cpEtat("ok");
      cpVue("secoursVu",{secours:r.j.secours,creation:true});return;
    }
    if(r.s===409||(r.s===400&&r.j.erreur==="pseudo")){cpVue("creer1");cpMessage(t(CP_RAISONS[r.j.raison]||CP_RAISONS.interdit));return;}
    /* Progression trop grosse pour partir avec la creation : on cree sans,
       la synchronisation suivra. */
    if(r.s===413){cpAlleger();}
  }else if(id==="cpConnexion"){
    const v=cpPseudoSaisi();if(!v)return;
    const code=$("cpCode1").value;
    if(!/^\d{1,12}$/.test(code)){cpMessage(t(CP_ERREURS.identifiants));return;}
    cpOccupe(true);cpMessage(t("Logging in…"));
    r=await cpApi("POST","connexion",{pseudo:v.pseudo,code:await cpEtirer(v.cle,code)});
    if(r.s===200){await cpApresConnexion(r.j.pseudo,r.j.version);return;}
  }else if(id==="cpLier"){
    const v=cpPseudoSaisi();if(!v)return;
    cpOccupe(true);cpMessage(t("Logging in…"));
    r=await cpApi("POST","lien-connexion",{pseudo:v.pseudo,code:$("cpLien").value});
    if(r.s===200){cpBrouillon={};await cpApresConnexion(r.j.pseudo,r.j.version);return;}
  }else if(id==="cpSecoursOk"){
    const v=cpPseudoSaisi();if(!v)return;
    const code=cpNouveauCode();if(!code)return;
    cpOccupe(true);
    r=await cpApi("POST","secours",{pseudo:v.pseudo,secours:$("cpSecoursSaisi").value,code:await cpEtirer(v.cle,code)});
    if(r.s===200){
      const secours=r.j.secours;
      cpOuvrir(r.j.pseudo,r.j.version);
      await cpSynchro({tirer:true});
      cpVue("secoursVu",{secours:secours});return;
    }
  }else if(id==="cpCodeOk"){
    const code=cpNouveauCode();if(!code)return;
    cpOccupe(true);
    r=await cpApi("POST","code",{ancien:await cpEtirer(cp.cle,$("cpAncien").value),nouveau:await cpEtirer(cp.cle,code)});
    if(r.s===200){cpVue("connecte");cpMessage(t("Your code has been changed."),true);return;}
  }else if(id==="cpSecoursNouveauOk"){
    cpOccupe(true);
    r=await cpApi("POST","secours-nouveau",{code:await cpEtirer(cp.cle,$("cpAncien").value)});
    if(r.s===200){cpVue("secoursVu",{secours:r.j.secours});return;}
  }else if(id==="cpSupprimerOk"){
    cpOccupe(true);
    r=await cpApi("POST","supprimer",{code:await cpEtirer(cp.cle,$("cpAncien").value)});
    if(r.s===200){cpFermer(false);cpEcrire("chang64:compteBase",null);cpVue("accueil");cpMessage(t("Your account has been deleted."),true);return;}
  }else return;
  cpOccupe(false);
  if(r&&r.s===401&&r.j.erreur==="session"){cpSessionPerdue();return;}
  if(r)cpMessage(cpErreur(r));
}
/* Branchements : la vue du menu, comme celle de l'app (webapp.js). */
{
  const av=menuVue;
  menuVue=function(nom){
    const v=$("menuCompteVue");
    if(nom!=="compte"){if(v){v.hidden=true;clearInterval(cpLienMinuteur);}return av.apply(this,arguments);}
    av.call(this,"accueil");
    for(const e of document.querySelectorAll("#menuTiroir .tiroir-vue"))e.hidden=e!==v;
    $("menuRetour").hidden=false;
    cpVue(cp?"connecte":cpBrouillon.lien?"lier":"accueil");
    if(v&&!mouvementCalme()&&v.animate)v.animate([{opacity:0,transform:"translateX(18px)"},{opacity:1,transform:"none"}],{duration:260,easing:"cubic-bezier(.22,.7,.3,1)"});
  };
}
document.addEventListener("click",e=>{
  if(e.target.closest("[data-vue-compte]")){menuVue("compte");return;}
  const v=$("menuCompteVue");if(!v||!v.contains(e.target))return;
  const c=e.target.closest("[data-cp]");
  if(c){cpVue(c.dataset.cp);return;}
  const b=e.target.closest("button[id]");
  if(b&&!b.disabled)cpAction(b.id);
});
document.addEventListener("input",e=>{
  if(e.target.id==="cpPseudo"&&cpEcran==="creer1")cpPseudoVerifier();
  if(e.target.id==="cpNote"){const b=$("cpFini");if(b)b.disabled=!e.target.checked;}
});
/* Entree valide l'ecran en cours. */
document.addEventListener("keydown",e=>{
  if(e.key!=="Enter"||!e.target.closest||!e.target.closest("#menuCompteVue input"))return;
  const b=document.querySelector("#menuCompteVue .btn.primary");
  if(b&&!b.disabled){e.preventDefault();b.click();}
});
/* "Recommencer la progression" efface aussi celle du compte. */
{const b=$("btnReset");if(b){const av=b.onclick;b.onclick=function(){const r=av&&av.apply(this,arguments);if(cp)setTimeout(cpEcraser,300);return r;};}}
/* Invitation discrete dans le bilan de seance, au plus une fois tous les
   14 jours, jamais en meme temps que celle de l'app. */
const CP_SUGG_CLE="chang64:suggestionCompte";
{
  const av=bilanOuvrir;
  bilanOuvrir=function(){
    const r=av.apply(this,arguments);
    const z=$("bilanCompte"),autre=$("bilanApp");if(!z)return r;
    let dernier=0;try{dernier=+(localStorage.getItem(CP_SUGG_CLE)||0);}catch(e){}
    const montrer=!cp&&!(autre&&!autre.hidden)&&(prog.solved||0)>=20&&Date.now()-dernier>14*864e5;
    z.hidden=!montrer;
    if(montrer){
      try{localStorage.setItem(CP_SUGG_CLE,String(Date.now()));}catch(e){}
      $("bilanCompteTexte").textContent=t("Keep your progress on all your devices: create a free account.");
      const b=$("bilanCompteBouton");b.textContent=t("Create an account");
      b.onclick=()=>{bilanFermer();menuOuvrir();menuVue("compte");};
    }
    return r;
  };
}
/* Demarrage : session locale, premiere synchronisation, lien d'appareil
   recu par QR (#lier=pseudo~code), retour apres rechargement. */
function cpDemarrer(){
  cpMaj=cpObjet(cpLire("chang64:compteMaj"));
  for(const k in CP_STOCK){const v=cpStockLire(k);cpDernier[k]=v===undefined?"null":k==="chang64:duelNom"?v:cpTexte(k==="chang64:progress"?prog:v);}
  const c=cpLire("chang64:compte");
  if(c&&typeof c.pseudo==="string"&&typeof c.cle==="string"){cp=c;cpPoint();cpSynchro({tirer:true});}
  const m=/^#lier=(.+)~([A-Za-z0-9]{6})$/.exec(location.hash||"");
  if(m){
    let pseudo=m[1];try{pseudo=decodeURIComponent(m[1]);}catch(e){}
    try{window.history.replaceState(null,"",location.pathname+location.search);}catch(e){}
    if(!cp&&pseudoValider(pseudo).ok){cpBrouillon.lien={pseudo:pseudo,code:m[2].toUpperCase()};menuOuvrir();menuVue("compte");}
  }
  let retour=false;try{retour=sessionStorage.getItem("chang64:compteRetour")==="1";sessionStorage.removeItem("chang64:compteRetour");}catch(e){}
  if(retour&&cp){menuOuvrir();menuVue("compte");}
  /* Retour sur l'onglet apres une absence : on relit le compte. En le
     quittant : on envoie ce qui attend. */
  let cache=0;
  document.addEventListener("visibilitychange",()=>{
    if(!cp)return;
    if(document.hidden){cache=Date.now();cpSynchro({garder:true});}
    else if(Date.now()-cache>5*60e3||cpEtatSync==="hors-ligne")cpSynchro({tirer:true});
  });
  window.addEventListener("online",()=>{if(cp)cpSynchro({tirer:true});});
}
{const l=$("menuCompteTexte");if(l)l.textContent=t("My account");}
setTimeout(cpDemarrer,1200);

/* ---------- QR code ---------- */
/* Encodeur minimal : mode octets, correction L, versions 1 a 6 (134 octets),
   de quoi porter l'adresse d'ajout d'appareil. Rend un SVG. Verifie par
   tests/check_compte_qr.js. */
function cpQrMatrice(texte){
  const octets=Array.from(new TextEncoder().encode(texte));
  /* [octets de donnees par bloc, octets de correction par bloc, blocs] */
  const V=[null,[19,7,1],[34,10,1],[55,15,1],[80,20,1],[108,26,1],[68,18,2]];
  let ver=0;
  for(let v=1;v<=6;v++)if(octets.length+2<=V[v][0]*V[v][2]){ver=v;break;}
  if(!ver)throw new Error("trop long");
  const [nd,ne,nb]=V[ver],total=nd*nb,bits=[];
  const pousser=(val,n)=>{for(let i=n-1;i>=0;i--)bits.push(val>>i&1);};
  pousser(4,4);pousser(octets.length,8);octets.forEach(o=>pousser(o,8));
  pousser(0,Math.min(4,total*8-bits.length));
  while(bits.length%8)bits.push(0);
  const data=[];for(let i=0;i<bits.length;i+=8)data.push(parseInt(bits.slice(i,i+8).join(""),2));
  for(let i=0;data.length<total;i++)data.push(i%2?17:236);
  /* Reed-Solomon sur GF(256), polynome 0x11d. */
  const EXP=[],LOG=[];for(let i=0,x=1;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11d;}
  const mul=(a,b)=>a&&b?EXP[(LOG[a]+LOG[b])%255]:0;
  let gen=[1];for(let i=0;i<ne;i++){const g=new Array(gen.length+1).fill(0);gen.forEach((c,j)=>{g[j]^=c;g[j+1]^=mul(c,EXP[i]);});gen=g;}
  const blocs=[],corr=[];
  for(let b=0;b<nb;b++){
    const d=data.slice(b*nd,(b+1)*nd),r=d.concat(new Array(ne).fill(0));
    for(let i=0;i<d.length;i++){const f=r[i];if(f)for(let j=1;j<gen.length;j++)r[i+j]^=mul(gen[j],f);}
    blocs.push(d);corr.push(r.slice(d.length));
  }
  const flux=[];
  for(let i=0;i<nd;i++)blocs.forEach(b=>flux.push(b[i]));
  for(let i=0;i<ne;i++)corr.forEach(c=>flux.push(c[i]));
  const n=17+4*ver,m=[],fixe=[];
  for(let i=0;i<n;i++){m.push(new Array(n).fill(0));fixe.push(new Array(n).fill(false));}
  const poser=(r,c,v)=>{if(r>=0&&r<n&&c>=0&&c<n){m[r][c]=v?1:0;fixe[r][c]=true;}};
  const repere=(r0,c0)=>{for(let r=-1;r<=7;r++)for(let c=-1;c<=7;c++){const dans=r>=0&&r<=6&&c>=0&&c<=6;poser(r0+r,c0+c,dans&&(r===0||r===6||c===0||c===6||(r>=2&&r<=4&&c>=2&&c<=4)));}};
  repere(0,0);repere(0,n-7);repere(n-7,0);
  if(ver>1){const p=n-7;for(let r=-2;r<=2;r++)for(let c=-2;c<=2;c++)poser(p+r,p+c,Math.max(Math.abs(r),Math.abs(c))!==1);}
  for(let i=8;i<n-8;i++){poser(6,i,i%2===0);poser(i,6,i%2===0);}
  poser(n-8,8,1);
  /* Zones du format, reservees avant de placer les donnees. */
  for(let i=0;i<9;i++){if(!fixe[8][i])poser(8,i,0);if(!fixe[i][8])poser(i,8,0);}
  for(let i=0;i<8;i++){poser(8,n-1-i,0);if(!fixe[n-1-i][8])poser(n-1-i,8,0);}
  /* Placement en zigzag, de bas en haut, colonne 6 sautee. */
  const fb=[];flux.forEach(o=>{for(let i=7;i>=0;i--)fb.push(o>>i&1);});
  let k=0,haut=true;
  for(let c=n-1;c>0;c-=2){
    if(c===6)c--;
    for(let i=0;i<n;i++){
      const r=haut?n-1-i:i;
      for(const cc of [c,c-1])if(!fixe[r][cc]){m[r][cc]=k<fb.length?fb[k]:0;k++;}
    }
    haut=!haut;
  }
  const MASQUES=[(r,c)=>(r+c)%2===0,(r,c)=>r%2===0,(r,c)=>c%3===0,(r,c)=>(r+c)%3===0,(r,c)=>(Math.floor(r/2)+Math.floor(c/3))%2===0,(r,c)=>r*c%2+r*c%3===0,(r,c)=>(r*c%2+r*c%3)%2===0,(r,c)=>((r+c)%2+r*c%3)%2===0];
  const format=masque=>{
    const d=(1<<3)|masque;let x=d<<10;   /* niveau L = 01 */
    for(let i=14;i>=10;i--)if(x>>i&1)x^=0x537<<(i-10);
    return ((d<<10)|x)^0x5412;
  };
  const fabriquer=masque=>{
    const g=m.map(l=>l.slice());
    for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(!fixe[r][c]&&MASQUES[masque](r,c))g[r][c]^=1;
    const f=format(masque),bit=i=>f>>i&1;
    for(let i=0;i<=5;i++)g[8][i]=bit(14-i);
    g[8][7]=bit(8);g[8][8]=bit(7);g[7][8]=bit(6);
    for(let i=0;i<=5;i++)g[5-i][8]=bit(9+i);
    for(let i=0;i<=6;i++)g[n-1-i][8]=bit(14-i);
    for(let i=0;i<=7;i++)g[8][n-8+i]=bit(7-i);
    return g;
  };
  /* Penalites de la norme : suites, carres, faux reperes, equilibre. */
  const penalite=g=>{
    let p=0,noirs=0;
    const ligne=l=>{let s=0,run=1;for(let i=1;i<=l.length;i++){if(i<l.length&&l[i]===l[i-1])run++;else{if(run>=5)s+=run-2;run=1;}}
      const t2=l.join("");for(const motif of ["10111010000","00001011101"]){let i=-1;while((i=t2.indexOf(motif,i+1))>=0)s+=40;}return s;};
    for(let r=0;r<n;r++){p+=ligne(g[r]);p+=ligne(g.map(l=>l[r]));for(let c=0;c<n;c++)noirs+=g[r][c];}
    for(let r=0;r<n-1;r++)for(let c=0;c<n-1;c++)if(g[r][c]===g[r][c+1]&&g[r][c]===g[r+1][c]&&g[r][c]===g[r+1][c+1])p+=3;
    return p+Math.floor(Math.abs(noirs*100/(n*n)-50)/5)*10;
  };
  let mieux=null,score=Infinity;
  for(let i=0;i<8;i++){const g=fabriquer(i),s=penalite(g);if(s<score){score=s;mieux=g;}}
  return mieux;
}
function cpQr(texte){
  const g=cpQrMatrice(texte),n=g.length,marge=4;
  let d="";
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(g[r][c])d+="M"+(c+marge)+" "+(r+marge)+"h1v1h-1z";
  return '<svg viewBox="0 0 '+(n+2*marge)+" "+(n+2*marge)+'" shape-rendering="crispEdges" aria-hidden="true"><rect width="100%" height="100%" fill="#fff"/><path d="'+d+'" fill="#000"/></svg>';
}
