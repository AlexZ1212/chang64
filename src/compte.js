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
   - un champ inconnu (ajoute plus tard) : celui de l'appareil le plus recent ;
   - remise a zero : la plus recente efface tout ce qui la precede, partout. */
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
  l=cpObjet(l);d=cpObjet(d);
  /* Remise a zero ("Recommencer la progression") : elle porte une date, raz.
     Le cote dont la remise a zero est la plus recente l'emporte en entier,
     sinon l'ancienne progression reviendrait par un autre appareil. */
  /* Seulement pour un appareil deja relie au compte (il a une base) : un
     appareil qui se connecte pour la premiere fois garde ce qu'il apporte. */
  const avecBase=!!b;b=cpObjet(b);
  if(avecBase&&cpNombre(l.raz)!==cpNombre(d.raz))return JSON.parse(JSON.stringify(cpNombre(l.raz)>cpNombre(d.raz)?l:d));
  const R=distantRecent?d:l,A=distantRecent?l:d;
  const o=Object.assign({},A,R);
  const max=k=>{if(typeof l[k]==="number"||typeof d[k]==="number")o[k]=Math.max(cpNombre(l[k]),cpNombre(d[k]));};
  o.solved=cpPlus(l.solved,d.solved,b.solved,avecBase);
  ["best","rushBest","coordBest","bestDay","raz"].forEach(max);
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
        ok:[0,1,2].map(i=>!!(cpListe(dl.ok)[i]||cpListe(dd.ok)[i])),jours:cpUnion(dl.jours,dd.jours),objJours:cpUnion(dl.objJours,dd.objJours),
        /* Jours de l'exercice du jour et finales deja comptees : sans eux, une synchronisation les oubliait (2026-11-18). */
        jourJours:cpUnion(dl.jourJours,dd.jourJours),fin:cpUnion(dl.fin,dd.fin)};
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
      cpPseudoRecu(r.j.pseudo);
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
/* Le serveur donne le pseudo a chaque lecture : s'il a change sur un autre
   appareil, celui-ci le reprend, avec sa cle (le sel du code en depend). */
function cpPseudoRecu(pseudo){
  if(!cp||typeof pseudo!=="string"||pseudo===cp.pseudo)return;
  const v=pseudoValider(pseudo);if(!v.ok)return;
  const b=cpLire("chang64:compteBase");
  if(b&&b.cle===cp.cle){b.cle=v.cle;cpEcrire("chang64:compteBase",b);}
  cp.pseudo=v.pseudo;cp.cle=v.cle;cpSauver();cpPoint();
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
  prog.raz=Date.now();cpSilence=true;try{saveProg();}finally{cpSilence=false;}
  const env=cpEnveloppe();
  env.vv=Object.assign({},cpObjet(r.j.donnees&&r.j.donnees.vv));
  const w=await cpApi("PUT","synchro",{version:r.j.version,donnees:env});
  if(w.s===200){cp.version=w.j.version;cpBaseEcrire(env);cpEcrire("chang64:compteEnvois",null);cpEtat("ok");}
}
/* Ouvre la session locale apres une creation ou une connexion reussie. */
function cpOuvrir(pseudo,version){
  const v=pseudoValider(pseudo),ancien=cpLire("chang64:compte");
  cp={pseudo:pseudo,cle:v.ok?v.cle:pseudo.toLowerCase(),version:version,dev:(ancien&&ancien.dev)||Math.random().toString(36).slice(2,8),n:(ancien&&ancien.n)||0,sync:0};
  cpEtatSync="";cpSauver();cpPoint();cpRedessiner();
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
  cpPoint();cpRedessiner();
}

/* ---------- Ecrans ---------- */
let cpEcran="",cpBrouillon={},cpPseudoMinuteur=0,cpLienMinuteur=0;
function cpVueOuverte(){const v=$("menuCompteVue"),r=$("menuTiroir");return !!(v&&r&&!r.hidden&&!v.hidden);}
/* Le point du bouton de menu signale aussi une session a rouvrir. */
/* Redessine ce qui change selon qu'on est connecte ou non (historique,
   graphes, collection de badges, themes) : sans cela une connexion ou une
   deconnexion laissait l'ecran dans l'etat d'avant (2026-11-19). */
function cpRedessiner(){
  [typeof renderHistory==="function"&&renderHistory,typeof renderBadges==="function"&&renderBadges,
   typeof drawRatingGraph==="function"&&drawRatingGraph,typeof rendreThemes==="function"&&rendreThemes]
    .forEach(f=>{if(f)try{f();}catch(e){}});
  /* Les copies du menu, meme ferme : sinon une invitation d'avant y restait. */
  try{const g=$("menuBadgeGrid");if(g&&g.firstChild)renderBadges(g);}catch(e){}
  try{const g=$("menuRatingGraph");if(g&&g.firstChild)drawRatingGraph(g);}catch(e){}
}
function cpPoint(){
  const d=$("menuCompteDetail");
  if(d)d.textContent=cp?cp.pseudo:"";
  const p=$("menuComptePoint");if(p)p.hidden=cpEtatSync!=="session";
}
const CP_RAISONS={longueur:"Between 3 and 20 characters.",caracteres:"Letters, digits, - and _ only.",melange:"Use a single alphabet.",interdit:"This username is not allowed. Try another one.",pris:"This username is already taken."};
const CP_CODE_RAISONS={chiffres:"Digits only.",court:"At least 6 digits.",long:"12 digits at most.",facile:"Too easy to guess. Choose another one."};
const CP_ERREURS={identifiants:"Wrong username or code.",lien:"Wrong or expired device code.",plus_tard:"Too many sign-ups right now. Try again in an hour.",adresse:"Too many accounts created from this connection today. Try again tomorrow.",appareil:"Two accounts have already been created on this device this month. Log in to one of them, or try again later.",session:"Your session has ended. Log in again."};
function cpErreur(r){
  if(r.s===0)return t("No connection. Check your network and try again.");
  if(r.s===429&&r.j.erreur==="pseudo_recent")return t("You have already changed your username this week. Try again later.");
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
      '<ul class="app-avantages">'+["Your rating, badges, streak and games on your phone, tablet and computer.","Nothing is lost if you clear your browser or change device.","Your badge collection, your progress charts, the themes you earn and your full game history.","Your place in Top players, with your own profile and your rank.","Challenge other members by their username, and compare your week with your friends.","Free, and optional: everything stays playable without an account."].map(x=>"<li>"+cpE(x)+"</li>").join("")+"</ul>"+
      '<p class="tiroir-section">'+cpE("What we ask for")+"</p>"+
      '<p class="cp-note">'+cpE("A username and a code of 6 digits or more. That is all: today we ask for no name and no email address.")+"</p>"+
      '<button type="button" class="btn primary cp-large reflet" data-cp="creer1">'+cpE("Create an account")+"</button>"+
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
      '<p class="tiroir-section">'+cpE("My profile")+"</p>"+cpyChoix(cp.pays||"")+
      '<p class="tiroir-section">'+cpE("My devices")+"</p>"+
      '<button type="button" class="tiroir-lien" data-cp="appareil"><span>'+cpE("Add a device")+"</span></button>"+
      '<p class="tiroir-section">'+cpE("Security")+"</p>"+
      '<button type="button" class="tiroir-lien" data-cp="pseudo"><span>'+cpE("Change my username")+"</span></button>"+
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
  }else if(ecran==="pseudo"){
    h="<h3>"+cpE("Change my username")+"</h3>"+
      '<p class="cp-note">'+echapper(t("Username: {pseudo}",{pseudo:cp.pseudo}))+"</p>"+
      cpChamp("cpPseudo","New username",CP_ATTR_PSEUDO,"3 to 20 letters or digits. Other players will see it.")+
      cpChamp("cpAncien","Your code",cpAttrCode(false))+
      '<p class="cp-note">'+cpE("Your code stays the same.")+" "+cpE("You can change your username once a week.")+"</p>"+msg+
      '<button type="button" class="btn primary cp-large" id="cpPseudoOk" disabled>'+cpE("Change my username")+"</button>"+retour("connecte");
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
  const i=$("cpPseudo"),b=$("cpSuite")||$("cpPseudoOk"),ecran=cpEcran;if(!i||!b)return;
  clearTimeout(cpPseudoMinuteur);b.disabled=true;
  const brut=i.value;
  if(!brut.trim()){cpMessage("");return;}
  const v=pseudoValider(brut);
  if(!v.ok){cpMessage(t(CP_RAISONS[v.raison]));return;}
  cpMessage(t("Checking…"));
  cpPseudoMinuteur=setTimeout(async()=>{
    const r=await cpApi("POST","pseudo",{pseudo:v.pseudo});
    if(cpEcran!==ecran||!$("cpPseudo")||$("cpPseudo").value!==brut)return;
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
  }else if(id==="cpPseudoOk"){
    const code=$("cpAncien").value,ancienne=cp.cle;
    if(!cpBrouillon.pseudo||!cpBrouillon.cle)return;
    cpOccupe(true);
    r=await cpApi("POST","pseudo-changer",{pseudo:cpBrouillon.pseudo,ancien:await cpEtirer(ancienne,code),nouveau:await cpEtirer(cpBrouillon.cle,code)});
    if(r.s===200){cpBrouillon={};cpPseudoRecu(r.j.pseudo);cpjCache={};cpVue("connecte");cpMessage(t("Your username has been changed."),true);return;}
    if(r.s===409||(r.s===400&&r.j.erreur==="pseudo")){cpOccupe(false);cpMessage(t(CP_RAISONS[r.j.raison]||CP_RAISONS.interdit));return;}
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
  if(e.target.id==="cpPseudo"&&(cpEcran==="creer1"||cpEcran==="pseudo"))cpPseudoVerifier();
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

/* ---------- Tableaux des joueurs ---------- */
/* Vue "Meilleurs joueurs" du menu (2026-11-17) : six tableaux de 50 joueurs
   lus dans /api/classement (pseudo + chiffre, rien d'autre). Ouverte a tous ;
   seuls les joueurs qui ont un compte y figurent. La ligne du joueur
   connecte est mise en avant. Chaque tableau est garde une minute ici, cinq
   sur le serveur. */
const CPJ=[["semaine","This week"],["note","Rating"],["resolus","Puzzles solved"],["serie","Days in a row"],["badges","Badges"],["sprint","Sprint record"],["direct","Live games won"]];
let cpjPar="semaine",cpjCache={};
const CPL=["Pawn","Knight","Bishop","Rook","Queen"];
async function cpjVue(par){
  const v=$("menuJoueursVue");if(!v)return;
  if(par)cpjPar=par;
  const p=cpjPar;
  const onglets='<div class="cpj-onglets">'+CPJ.concat(cp?[["amis","My friends"],["ligue","My league"]]:[]).map(([k,l])=>'<button type="button" aria-pressed="'+(k===p)+'" data-cpj="'+k+'">'+cpE(l)+"</button>").join("")+"</div>"+
    (p==="semaine"?'<p class="cp-note">'+cpE("Puzzles solved since Monday.")+"</p>":"");
  const pied='<p class="cp-note cp-centre cpj-astuce">'+cpE("Turn your phone sideways to see all the stats at once.")+"</p>"+
    '<button type="button" class="btn cp-large cpj-tout" data-cpj-tout>'+cpE("All the stats")+"</button>"+
    (cp?'<button type="button" class="btn cp-large" data-cpp="'+echapper(cp.pseudo)+'">'+cpE("My profile")+"</button>"+
      '<label class="cp-champ cpj-cherche" for="cpjCherche"><span>'+cpE("Find a member")+'</span><input type="search" id="cpjCherche" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="'+cpE("Username")+'"></label>'+
      '<ul class="cpj-liste cpj-trouves" id="cpjTrouves" aria-live="polite"></ul>':"")+
    (cp?"":'<p class="cp-note cp-centre">'+cpE("Create an account to appear here.")+'</p><button type="button" class="btn cp-large" data-vue-compte="1">'+cpE("Create an account")+"</button>");
  const dessiner=corps=>{if(p===cpjPar&&!v.hidden)poserHtml(v,onglets+corps+pied);};
  if(p==="amis"){
    /* Tableau des amis (2026-11-18) : soi et les joueurs ajoutes depuis leur
       fiche, classes par exercices de la semaine. Liste privee, lue avec la session. */
    if(!cp){cpjPar="semaine";return cpjVue();}
    if(!cpaListe)dessiner('<p class="cp-note cp-centre">'+cpE("Loading…")+"</p>");
    const a=await cpaCharger();
    if(!a){dessiner('<p class="cp-msg">'+cpE("Could not load the list. Try again later.")+"</p>");return;}
    const recues=cpListe(a.demandes).filter(x=>typeof x==="string");
    const demandes=recues.length?'<p class="tiroir-section">'+cpE("Friend requests")+'</p><ul class="cpj-liste cpa-demandes">'+recues.map(p=>
      '<li><span class="cpj-nom"><button type="button" class="cpj-joueur" data-cpp="'+echapper(p)+'">'+echapper(p)+"</button></span>"+
      '<button type="button" class="cpj-inviter" data-cpa-rep="accepter" data-pseudo="'+echapper(p)+'">'+cpE("Accept")+"</button>"+
      '<button type="button" class="cpj-inviter cpa-non" data-cpa-rep="refuser" data-pseudo="'+echapper(p)+'">'+cpE("Decline")+"</button></li>").join("")+"</ul>":"";
    if(!cpListe(a.amis).length){dessiner(demandes+'<p class="cp-note cp-centre">'+cpE("No friends yet. Open a player's profile to add them.")+"</p>");return;}
    const la=cpListe(a.amis).concat(a.moi?[a.moi]:[]).sort((x,y)=>cpNombre(y.s)-cpNombre(x.s)||cpNombre(y.r)-cpNombre(x.r)||String(x.p).localeCompare(String(y.p)));
    dessiner(demandes+'<p class="cp-note">'+cpE("You and your friends, by puzzles solved since Monday.")+'</p><ol class="cpj-liste">'+la.map((x,i)=>{
      const m=cp&&x.p===cp.pseudo;
      return "<li"+(m?' class="cpj-moi"':"")+'><span class="cpj-rang">'+(i+1)+'</span><span class="cpj-nom"><button type="button" class="cpj-joueur" data-cpp="'+echapper(String(x.p))+'">'+echapper(String(x.p))+"</button>"+
        (m?" <em>("+cpE("You")+")</em>":x.m?" <em>("+cpE("Friend")+")</em>":"")+"</span>"+
        (!m&&typeof DIRECT_OUVERT!=="undefined"&&DIRECT_OUVERT?'<button type="button" class="cpj-inviter" data-direct-inviter="'+echapper(String(x.p))+'">'+cpE("Invite to play")+"</button>":"")+
        "<b>"+echapper(String(cpNombre(x.s)))+"</b></li>";
    }).join("")+"</ol>");
    return;
  }
  if(p==="ligue"){
    /* Ma ligue (2026-11-18) : cinq ligues, de Pion a Dame. Tant qu'elles ne
       sont pas ouvertes (50 membres actifs dans une semaine), on dit ou on en
       est. Ensuite : sa ligue, le classement de son groupe par exercices
       reussis depuis lundi, et les places qui montent ou descendent. Lu avec
       la session (route ligue), garde une minute. */
    if(!cp){cpjPar="semaine";return cpjVue();}
    let g=cpjCache.ligue;
    if(!g||g.pour!==cp.pseudo||Date.now()-g.t>60000){
      dessiner('<p class="cp-note cp-centre">'+cpE("Loading…")+"</p>");
      const r=await cpApi("GET","ligue");
      if(r.s!==200||!cp){dessiner('<p class="cp-msg">'+cpE("Could not load the list. Try again later.")+"</p>");return;}
      g=cpjCache.ligue={t:Date.now(),j:r.j,pour:cp.pseudo};
    }
    const j=g.j,regle='<p class="cp-note">'+cpE("Five leagues, from Pawn to Queen. Each week you play in a group of about 20 players, ranked by puzzles solved since Monday. The top 5 move up, the bottom 5 move down.")+"</p>";
    if(!j.ouvert){
      const seuil=Math.max(1,cpNombre(j.seuil)||50),n=Math.min(seuil,cpNombre(j.actifs));
      dessiner('<div class="cpl-attente"><b>'+echapper(t("{n} out of {m}",{n:n,m:seuil}))+"</b><span>"+cpE("active players last week")+'</span>'+
        '<div class="cpl-jauge" role="img" aria-label="'+echapper(t("{n} out of {m}",{n:n,m:seuil}))+'"><i style="width:'+Math.round(100*n/seuil)+'%"></i></div></div>'+
        '<p class="cp-note">'+echapper(t("Leagues open the Monday after {m} players have each solved at least one puzzle in the same week.",{m:seuil}))+"</p>"+regle);
      return;
    }
    const lg=Math.max(0,Math.min(4,cpNombre(j.ligue))),l=cpListe(j.groupe),monte=cpNombre(j.monte),descend=cpNombre(j.descend);
    const echelle='<ol class="cpl-echelle" aria-label="'+cpE("Leagues")+'">'+CPL.map((nom,i)=>"<li"+(i===lg?' class="cpl-ici" aria-current="true"':"")+">"+cpE(nom)+"</li>").join("")+"</ol>";
    const mouv=j.mouv===1?'<p class="cpl-mouv">'+cpE("You moved up a league. Well played.")+"</p>":j.mouv===-1?'<p class="cpl-mouv">'+cpE("You moved down a league. This week is your chance to climb back.")+"</p>":"";
    if(!l.length){dessiner(echelle+mouv+'<p class="cp-note cp-centre">'+cpE("Solve one puzzle this week to join a group.")+"</p>"+regle);return;}
    dessiner(echelle+mouv+'<ol class="cpj-liste cpl-liste">'+l.map((x,i)=>{
      const m=x.p===cp.pseudo;
      return (monte&&i===monte?'<li class="cpl-zone" aria-hidden="true">'+echapper(t("The top {n} move up",{n:monte}))+"</li>":"")+
        (descend&&i===l.length-descend?'<li class="cpl-zone" aria-hidden="true">'+echapper(t("The bottom {n} move down",{n:descend}))+"</li>":"")+
        "<li"+(m?' class="cpj-moi"':"")+'><span class="cpj-rang">'+(i+1)+'</span><span class="cpj-nom"><button type="button" class="cpj-joueur" data-cpp="'+echapper(String(x.p))+'">'+echapper(String(x.p))+"</button>"+
        (m?" <em>("+cpE("You")+")</em>":"")+"</span><b>"+echapper(String(cpNombre(x.v)))+"</b></li>";
    }).join("")+"</ol>"+regle);
    return;
  }
  let c=cpjCache[p];
  if(!c||Date.now()-c.t>60000){
    dessiner('<p class="cp-note cp-centre">'+cpE("Loading…")+"</p>");
    try{
      const r=await fetch("/api/classement?par="+p);
      if(r.status!==200)throw new Error("statut");
      c=cpjCache[p]={t:Date.now(),j:await r.json()};
    }catch(e){dessiner('<p class="cp-msg">'+cpE("Could not load the list. Try again later.")+"</p>");return;}
  }
  const l=cpListe(c.j&&c.j.joueurs);
  if(!l.length){dessiner('<p class="cp-note cp-centre">'+cpE("No one here yet. Be the first!")+"</p>");return;}
  const moi=cp?l.findIndex(x=>x.p===cp.pseudo):-1;
  dessiner('<ol class="cpj-liste">'+l.map((x,i)=>
    '<li'+(i===moi?' class="cpj-moi"':"")+'><span class="cpj-rang">'+(i+1)+'</span><span class="cpj-nom">'+'<button type="button" class="cpj-joueur" data-cpp="'+echapper(String(x.p))+'">'+echapper(String(x.p))+"</button>"+(i===moi?" <em>("+cpE("You")+")</em>":"")+
    '</span><b>'+echapper(String(x.v))+"</b></li>").join("")+"</ol>"+
    (cp&&moi<0?'<p class="cp-note cp-centre" id="cpjMonRang">'+cpE("You are not in the top 50 yet.")+"</p>":""));
  if(cp&&moi<0){
    const cle=CPJ_COLONNES[CPJ.findIndex(x=>x[0]===p)][0];
    cppLire(cp.pseudo).then(j=>{
      const e=$("cpjMonRang"),rang=j&&j.rangs?j.rangs[cle]:null;
      if(e&&p===cpjPar&&rang)e.textContent=t("Your rank: {n}",{n:rang});
    }).catch(()=>{});
  }
}
/* Le tableau complet (2026-11-17, demande d'Alexandre) : toutes les stats de
   tous les joueurs des six tableaux, triable en touchant un en-tete. Sur
   telephone il s'ouvre en tournant l'appareil : c'est la seule exception a
   l'ecran "Redresse ton telephone" (html.joueurs-ouverts, voir le CSS). Sur
   ordinateur et tablette, le bouton "Toutes les stats" l'ouvre. */
const CPJ_COLONNES=[["s","This week"],["n","Rating"],["r","Puzzles"],["j","Streak"],["b","Badges"],["k","Sprint"],["d","Live wins"]];
let cpjTout=null,cpjToutT=0,cpjTri="r",cpjSens=-1;
function cpjGrandDessiner(){
  const g=$("cpjGrand");if(!g)return;
  const tete='<div class="cpj-grand-tete"><h2 id="cpjGrandTitre">'+cpE("Top players")+'</h2><button type="button" class="tiroir-bouton" data-cpj-fermer aria-label="'+cpE("Close")+'">&times;</button></div>';
  if(!cpjTout){poserHtml(g,tete+'<p class="cp-note cp-centre">'+cpE("Loading…")+"</p>");return;}
  const l=cpListe(cpjTout.joueurs).slice().sort((x,y)=>cpjSens*(cpNombre(x[cpjTri])-cpNombre(y[cpjTri]))||cpNombre(y.r)-cpNombre(x.r)||String(x.p).localeCompare(String(y.p)));
  if(!l.length){poserHtml(g,tete+'<p class="cp-note cp-centre">'+cpE("No one here yet. Be the first!")+"</p>");return;}
  poserHtml(g,tete+'<div class="cpj-grand-corps"><table class="cpj-table"><thead><tr><th scope="col" class="cpj-rang">#</th><th scope="col">'+cpE("Username")+"</th>"+
    CPJ_COLONNES.map(([k,nom])=>'<th scope="col" aria-sort="'+(k===cpjTri?(cpjSens<0?"descending":"ascending"):"none")+'"><button type="button" data-cpj-tri="'+k+'">'+cpE(nom)+
      '<span aria-hidden="true">'+(k===cpjTri?(cpjSens<0?" ▾":" ▴"):"")+"</span></button></th>").join("")+"</tr></thead><tbody>"+
    l.map((x,i)=>"<tr"+(cp&&x.p===cp.pseudo?' class="cpj-moi"':"")+'><td class="cpj-rang">'+(i+1)+'</td><th scope="row">'+'<button type="button" class="cpj-joueur" data-cpp="'+echapper(String(x.p))+'">'+echapper(String(x.p))+"</button>"+"</th>"+
      CPJ_COLONNES.map(([k])=>"<td"+(k===cpjTri?' class="cpj-tri"':"")+">"+echapper(String(cpNombre(x[k])))+"</td>").join("")+"</tr>").join("")+"</tbody></table></div>");
}
async function cpjGrandCharger(){
  if(cpjTout&&Date.now()-cpjToutT<60000){cpjGrandDessiner();return;}
  cpjGrandDessiner();
  try{
    const r=await fetch("/api/classement?par=tout");
    if(r.status!==200)throw new Error("statut");
    cpjTout=await r.json();cpjToutT=Date.now();
  }catch(e){const g=$("cpjGrand");if(g&&!cpjTout)poserHtml(g,'<div class="cpj-grand-tete"><h2>'+cpE("Top players")+'</h2><button type="button" class="tiroir-bouton" data-cpj-fermer aria-label="'+cpE("Close")+'">&times;</button></div><p class="cp-msg">'+cpE("Could not load the list. Try again later.")+"</p>");return;}
  cpjGrandDessiner();
}
function cpjGrandFermer(){const g=$("cpjGrand");if(g)g.classList.remove("ouvert");document.documentElement.classList.remove("joueurs-ouverts");}
{const av=menuFermer;menuFermer=function(){cpjGrandFermer();return av.apply(this,arguments);};}
{
  const av=menuVue;
  menuVue=function(nom){
    const v=$("menuJoueursVue");
    document.documentElement.classList.toggle("joueurs-ouverts",nom==="joueurs");
    if(nom==="joueurs")cpjGrandCharger();else{const g=$("cpjGrand");if(g)g.classList.remove("ouvert");}
    if(nom!=="joueurs"){if(v)v.hidden=true;return av.apply(this,arguments);}
    av.call(this,"accueil");
    for(const e of document.querySelectorAll("#menuTiroir .tiroir-vue"))e.hidden=e!==v;
    $("menuRetour").hidden=false;
    $("menuTitre").textContent=t("Top players");
    cpjVue();
    if(v){v.scrollTop=0;if(!mouvementCalme()&&v.animate)v.animate([{opacity:0,transform:"translateX(18px)"},{opacity:1,transform:"none"}],{duration:260,easing:"cubic-bezier(.22,.7,.3,1)"});}
  };
}
document.addEventListener("click",e=>{
  if(e.target.closest("[data-vue-joueurs]")){menuVue("joueurs");return;}
  /* « Mes amis » du menu (2026-11-19) : la meme vue, ouverte sur la liste d'amis. */
  if(e.target.closest("[data-vue-amis]")){cpjPar=cp?"amis":"semaine";menuVue("joueurs");if(cp)$("menuTitre").textContent=t("My friends");return;}
  /* « Inviter a jouer » : ferme le menu et cree la partie en direct avec cet ami. */
  {const inv=e.target.closest("[data-direct-inviter]");
    if(inv&&typeof directInviterAmi==="function"){if(typeof menuFermer==="function")menuFermer();directInviterAmi(inv.dataset.directInviter);return;}}
  const b=e.target.closest("#menuJoueursVue [data-cpj]");
  if(b){cpjVue(b.dataset.cpj);return;}
  if(e.target.closest("[data-cpj-tout]")){const g=$("cpjGrand");if(g){g.classList.add("ouvert");cpjGrandCharger();const f=g.querySelector("[data-cpj-fermer]");if(f)f.focus();}return;}
  if(e.target.closest("[data-cpj-fermer]")){
    /* Fenetre ouverte par le bouton : on la referme. Ouverte par la rotation
       du telephone : on quitte la vue, l'ecran "Redresse ton telephone" revient. */
    const g=$("cpjGrand");
    if(g&&g.classList.contains("ouvert"))g.classList.remove("ouvert");else menuFermer();
    return;
  }
  const tri=e.target.closest("[data-cpj-tri]");
  if(tri){const k=tri.dataset.cpjTri;if(k===cpjTri)cpjSens=-cpjSens;else{cpjTri=k;cpjSens=-1;}cpjGrandDessiner();const n=document.querySelector('#cpjGrand [data-cpj-tri="'+k+'"]');if(n)n.focus();}
});

/* ---------- Pays de la fiche ---------- */
/* Le joueur choisit son pays dans Mon compte (2026-11-18), ou rien : il
   s'affiche sur sa fiche. Les noms viennent du navigateur (Intl), dans la
   langue de la page : rien a traduire. Le petit drapeau est un emoji ; Windows
   ne les dessine pas (il affiche deux lettres), on s'y contente du nom. */
const CPY_CODES="AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");
function cpyNom(code){try{return new Intl.DisplayNames([LANG_INTL],{type:"region"}).of(code)||code;}catch(e){return code;}}
/* Le drapeau seul, sans le nom du pays (2026-11-18, demande d'Alexandre) :
   le nom reste dit au survol et aux lecteurs d'ecran. Windows ne dessine pas
   ces emojis et montre les deux lettres du pays a la place. */
function cpyDrapeau(code){
  try{return String.fromCodePoint(127397+code.charCodeAt(0),127397+code.charCodeAt(1));}catch(e){return "";}
}
function cpyLigne(code){
  if(typeof code!=="string"||!CPY_CODES.includes(code))return "";
  const d=cpyDrapeau(code);
  return (d?d+" ":"")+cpyNom(code);
}
function cpyChoix(actuel){
  let tri;
  try{const c=new Intl.Collator(LANG_INTL);tri=(a,b)=>c.compare(a[1],b[1]);}catch(e){tri=(a,b)=>a[1]<b[1]?-1:a[1]>b[1]?1:0;}
  const l=CPY_CODES.map(c=>[c,cpyNom(c)]).sort(tri);
  return '<label class="cp-champ" for="cpPays"><span>'+cpE("Country")+'</span><select id="cpPays"><option value="">'+cpE("Not shown")+"</option>"+
    l.map(([c,n])=>'<option value="'+c+'"'+(c===actuel?" selected":"")+">"+echapper(n)+"</option>").join("")+
    "</select><small>"+cpE("Shown on your player profile. Optional.")+"</small></label>";
}
/* Le pays connu du serveur, lu une fois par appareil. */
async function cpyLire(){
  if(!cp||typeof cp.pays==="string")return;
  const r=await cpApi("GET","etat");
  if(r.s!==200||!cp)return;
  cp.pays=typeof r.j.pays==="string"?r.j.pays:"";cpSauver();
  const s=$("cpPays");if(s)s.value=cp.pays;
}
document.addEventListener("change",async e=>{
  if(!e.target||e.target.id!=="cpPays"||!cp)return;
  const s=e.target,v=s.value;
  s.disabled=true;
  const r=await cpApi("POST","pays",{pays:v});
  s.disabled=false;
  if(r.s===200){cp.pays=v;cpSauver();cppCache={};cpMessage(t("Saved."),true);}
  else{s.value=cp.pays||"";cpMessage(cpErreur(r));}
});
{const av=cpVue;cpVue=function(ecran){const r=av.apply(this,arguments);if(ecran==="connecte")cpyLire();return r;};}

/* ---------- Presentation du compte en trois etapes ---------- */
/* Une fenetre qui explique le compte a qui n'en a pas (2026-11-18, demande
   d'Alexandre) : ce qu'il garde, ce qu'il ouvre avec les autres joueurs, ce
   qu'il demande. Elle vient a la fin d'un exercice (cinq reussis au moins) ou
   d'une partie contre l'ordinateur, jamais pendant, et jamais par-dessus une
   autre fenetre. Deux fois au plus, a quatorze jours d'ecart ; plus jamais
   une fois le compte cree. */
const CPI_ETAPES=[
  ["Keep your progress","Your rating, your badges and your streak follow you on your phone, tablet and computer. Nothing is lost if you change device."],
  ["Play with the others","Appear in Top players, challenge a member on five puzzles, and compare your week with your friends."],
  ["A username and a code","That is all we ask: no name, no email address. It is free, and you can delete your account at any time."]];
const CPI_FOIS=2,CPI_ECART=14*864e5,CPI_EXERCICES=5;
/* Une medaille par etape, gravee comme celles des badges (retour d'Alexandre
   du 18/11 : pas d'arc ni d'elephant sur une fenetre qui informe, et des
   pictogrammes aussi soignes que les badges) : la carte de membre, les deux
   silhouettes, le buste du profil. */
const CPI_MEDAILLES=["mb_compte","mb_ami","_profil"];
function cpiMedaille(){return '<span class="popin-medaille" data-medaille="'+CPI_MEDAILLES[cpiEtape]+'" aria-hidden="true"></span>';}
let cpiEtape=0,cpiAttente=false,cpiAvant=null;
function cpiEtat(){const e=cpLire("chang64:compteInvite");return e&&typeof e==="object"&&!Array.isArray(e)?e:{n:0,t:0};}
function cpiDue(){
  if(cp)return false;
  const e=cpiEtat();
  return cpNombre(e.n)<CPI_FOIS&&!(cpNombre(e.t)&&Date.now()-cpNombre(e.t)<CPI_ECART);
}
function cpiDessiner(){
  const c=$("cpInviteContenu");if(!c)return;
  const [titre,texte]=CPI_ETAPES[cpiEtape],fin=cpiEtape===CPI_ETAPES.length-1;
  poserHtml(c,cpiMedaille()+'<p class="bilan-entete">'+cpE("Why create an account?")+'</p><h2 id="cpInviteTitre">'+cpE(titre)+"</h2>"+
    '<p class="cpi-texte">'+cpE(texte)+"</p>"+
    '<div class="popin-filet"></div><p class="cpi-points" role="img" aria-label="'+echapper(t("Step {n} of 3",{n:cpiEtape+1}))+'">'+CPI_ETAPES.map((x,i)=>"<i"+(i===cpiEtape?' class="ici"':"")+"></i>").join("")+"</p>"+
    '<button type="button" class="btn primary'+(fin?" reflet":"")+'" data-cpi="'+(fin?"creer":"suite")+'">'+cpE(fin?"Create an account":"Next")+"</button>"+
    '<button type="button" class="btn" data-cpi="fermer">'+cpE("Not now")+"</button>");
  if(typeof popinMedailles==="function")popinMedailles();
  const b=c.querySelector("[data-cpi]");if(b)b.focus();
}
function cpiOuvrir(){
  const f=$("cpInvite");if(!f||!f.hidden)return;
  const e=cpiEtat();cpEcrire("chang64:compteInvite",{n:cpNombre(e.n)+1,t:Date.now()});
  cpiAvant=document.activeElement;cpiEtape=0;
  f.hidden=false;

  f.classList.remove("bilan-joue");void f.offsetWidth;f.classList.add("bilan-joue");
  cpiDessiner();
}
function cpiFermer(){
  const f=$("cpInvite");if(!f||f.hidden)return;
  f.hidden=true;
  if(cpiAvant&&cpiAvant.focus&&document.contains(cpiAvant))cpiAvant.focus();
}
/* Apres la fin d'un exercice ou d'une partie : on laisse d'abord passer les
   felicitations, le bilan et les defis, puis on se montre si rien n'occupe l'ecran. */
function cpiTenter(essais){
  if(!cpiAttente)return;
  if(!cpiDue()){cpiAttente=false;return;}
  const br=$("bravo"),an=document.getElementById("objAnnonce"),bi=$("bilan"),ti=$("menuTiroir");
  const occupe=(typeof bravoOccupe==="function"&&bravoOccupe())||(br&&!br.hidden)||(typeof bravoFile!=="undefined"&&bravoFile&&bravoFile.length)||(an&&an.classList.contains("visible"))||
    (typeof objFile!=="undefined"&&objFile.length)||(bi&&!bi.hidden)||(typeof duelOuvert==="function"&&duelOuvert())||(typeof duel!=="undefined"&&duel)||(typeof rush!=="undefined"&&rush)||(ti&&!ti.hidden);
  if(occupe){if((essais||0)<40)setTimeout(()=>cpiTenter((essais||0)+1),1500);else cpiAttente=false;return;}
  cpiAttente=false;cpiOuvrir();
}
function cpiProposer(){
  if(cpiAttente||!cpiDue())return;
  cpiAttente=true;setTimeout(()=>cpiTenter(0),2500);
}
if(typeof finishPuzzle==="function"){const av=finishPuzzle;finishPuzzle=function(won){const r=av.apply(this,arguments);if(won&&typeof prog!=="undefined"&&cpNombre(prog.solved)>=CPI_EXERCICES)cpiProposer();return r;};}
if(typeof saveFinishedGame==="function"){const av=saveFinishedGame;saveFinishedGame=function(){const avant=typeof gameSaved!=="undefined"&&gameSaved,r=av.apply(this,arguments);if(!avant&&typeof gameSaved!=="undefined"&&gameSaved)cpiProposer();return r;};}
document.addEventListener("click",e=>{
  const f=$("cpInvite");if(!f||f.hidden)return;
  const b=e.target.closest("[data-cpi]");
  if(b&&b.dataset.cpi==="suite"){cpiEtape=Math.min(CPI_ETAPES.length-1,cpiEtape+1);cpiDessiner();return;}
  if(b&&b.dataset.cpi==="creer"){cpiFermer();menuOuvrir();menuVue("compte");return;}
  if((b&&b.dataset.cpi==="fermer")||e.target===f)cpiFermer();
});
document.addEventListener("keydown",e=>{
  const f=$("cpInvite");
  if(e.key==="Escape"&&f&&!f.hidden){e.stopPropagation();e.preventDefault();cpiFermer();}
},true);

/* ---------- Badges de membre ---------- */
/* Cinq badges lies au compte (2026-11-18) : avoir un compte, envoyer un defi
   a un membre, ajouter un ami, entrer dans les 10 premiers d'un tableau,
   repondre a une question. Ici on ne fait que les noter : l'annonce attend la
   fin du prochain exercice ou de la prochaine partie, comme toute recompense
   (checkBadges y est appele), jamais au milieu d'un menu. */
function cpBadge(id){
  if(typeof bxEtat!=="function")return;
  const f=bxEtat().f;
  if(!f[id]){f[id]=1;saveProg();}
}
if(typeof checkBadges==="function"){const av=checkBadges;checkBadges=function(){if(cp)bxEtat().f.mb_compte=1;return av.apply(this,arguments);};}

/* ---------- Recherche de membres ---------- */
/* Les premieres lettres suffisent (2026-11-18, demande d'Alexandre : il
   fallait saisir le pseudo en entier). Reservee aux joueurs connectes ; le
   serveur rend huit pseudos au plus. Sert au champ "Chercher un membre" de
   Meilleurs joueurs et aux suggestions du champ d'envoi d'un defi. */
let cpmMinuteur=0,cpmDernier="";
async function cpmChercher(q){
  q=String(q||"").trim();
  if(!cp||Array.from(q).length<2)return [];
  const r=await cpApi("GET","membres?q="+encodeURIComponent(q));
  return r.s===200?cpListe(r.j.membres).filter(p=>typeof p==="string"):[];
}
document.addEventListener("input",e=>{
  const c=e.target;
  if(!c||(c.id!=="cpjCherche"&&c.id!=="duelMembre"&&c.id!=="directPseudo"))return;
  clearTimeout(cpmMinuteur);
  const q=c.value;
  cpmMinuteur=setTimeout(async()=>{
    cpmDernier=q;
    const l=await cpmChercher(q);
    if(cpmDernier!==q)return;
    if(c.id==="duelMembre"||c.id==="directPseudo"){
      /* Meme liste de suggestions pour inviter a une partie en direct (2026-11-19). */
      const lid=c.id==="duelMembre"?"duelMembres":"directMembres";
      let d=$(lid);
      if(!d){d=document.createElement("datalist");d.id=lid;c.after(d);c.setAttribute("list",lid);}
      poserHtml(d,l.map(p=>'<option value="'+echapper(p)+'"></option>').join(""));
      return;
    }
    const z=$("cpjTrouves");if(!z)return;
    poserHtml(z,Array.from(q.trim()).length<2?"":l.length?l.map(p=>'<li><span class="cpj-nom"><button type="button" class="cpj-joueur" data-cpp="'+echapper(p)+'">'+echapper(p)+"</button></span></li>").join(""):
      '<li><span class="cpj-nom">'+cpE("No member found.")+"</span></li>");
  },250);
});

/* ---------- Fiche d'un membre ---------- */
/* Toucher un pseudo dans les tableaux ouvre sa fiche (2026-11-18) : le mois
   de creation du compte, les six chiffres des tableaux et le rang dans
   chacun, lus dans /api/compte/profil. Rien de plus que ce que les tableaux
   montrent deja, mais pour n'importe quel membre et pas seulement les 50
   premiers ; c'est aussi la qu'un joueur trouve son rang au-dela du 50e.
   Un joueur connecte peut defier le membre depuis sa fiche. */
let cppCache={},cppAvant=null;
async function cppLire(pseudo){
  const k=String(pseudo).toLowerCase(),c=cppCache[k];
  if(c&&Date.now()-c.t<60000)return c.j;
  const r=await fetch("/api/compte/profil?p="+encodeURIComponent(pseudo));
  if(r.status!==200)throw new Error("statut");
  const j=await r.json();
  cppCache[k]={t:Date.now(),j:j};
  if(cp&&j&&j.p===cp.pseudo&&Object.values(cpObjet(j.rangs)).some(r=>cpNombre(r)>=1&&cpNombre(r)<=10))cpBadge("mb_top10");
  return j;
}
function cppMois(am){
  const m=/^(\d{4})-(\d{2})$/.exec(String(am));if(!m)return "";
  try{return new Intl.DateTimeFormat(LANG_INTL,{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(+m[1],+m[2]-1,15)));}catch(e){return m[0];}
}
function cppFermer(){
  const f=$("cpProfil");if(!f||f.hidden)return;
  f.hidden=true;
  if(cppAvant&&cppAvant.focus&&document.contains(cppAvant))cppAvant.focus();
}
async function cppOuvrir(pseudo){
  const f=$("cpProfil"),c=$("cpProfilContenu");if(!f||!c)return;
  if(f.hidden)cppAvant=document.activeElement;
  /* En-tete sans arc (2026-11-18, retour d'Alexandre) : la fiche informe, elle
     ne fete rien. Un pictogramme de profil (Phosphor "user", celui du menu),
     le nom et la date a sa droite, un filet dessous. L'arc reste aux fenetres
     qui ont un dessin a y poser : medaille de Bravo, elephant du bilan et des defis. */
  /* La medaille de profil : meme dessin grave que les badges (bxMedaille,
     badges.js), au metal du meilleur rang du joueur : or dans les 3 premiers
     d'un tableau, argent dans les 10 premiers, bronze sinon. Tant que les
     dessins ne sont pas charges (ou s'ils ne se chargent pas), un rond vide
     tient la place : la mise en page ne bouge pas. */
  const medaille=rangs=>{
    const md=typeof bxMedailles!=="undefined"&&bxMedailles&&bxMedailles._profil;
    if(!md||typeof bxMedaille!=="function")return '<span class="cpp-picto" aria-hidden="true"></span>';
    const r=Object.values(cpObjet(rangs)).map(cpNombre).filter(x=>x>=1),meilleur=r.length?Math.min.apply(null,r):0;
    const metal=meilleur>=1&&meilleur<=3?"or":meilleur>=1&&meilleur<=10?"argent":"bronze";
    const avant=md[0];md[0]=metal;
    try{return '<span class="cpp-picto cpp-medaille" aria-hidden="true">'+bxMedaille("_profil",true)+"</span>";}finally{md[0]=avant;}
  };
  const tete=(nom,sous,rangs,pays)=>'<div class="cpp-tete">'+medaille(rangs)+'<div class="cpp-qui"><p class="bilan-entete">'+cpE("Player profile")+'</p><h2><span id="cpProfilTitre">'+echapper(String(nom))+"</span>"+(pays&&cpyLigne(pays)?' <span class="cpp-drapeau" role="img" aria-label="'+echapper(cpyNom(pays))+'" title="'+echapper(cpyNom(pays))+'">'+cpyDrapeau(pays)+"</span>":"")+"</h2>"+(sous?'<p class="bilan-sous">'+echapper(sous)+"</p>":"")+"</div></div>";
  const fermer='<button type="button" class="btn cpp-fermer" data-cpp-fermer>'+cpE("Close")+"</button>";
  const poser=h=>{poserHtml(c,h);const b=c.querySelector("[data-cpp-premier]")||c.querySelector("[data-cpp-fermer]");if(b)b.focus();};
  poserHtml(c,tete(pseudo)+'<p class="cp-note cp-centre">'+cpE("Loading…")+"</p>"+fermer);
  f.hidden=false;f.dataset.pseudo=String(pseudo);
  const b0=c.querySelector("[data-cpp-fermer]");if(b0)b0.focus();
  let j;
  if(typeof bxCharger==="function")bxCharger();
  try{j=await cppLire(pseudo);if(typeof bxCharger==="function")await bxCharger();}
  catch(e){if(!f.hidden&&f.dataset.pseudo===String(pseudo))poser(tete(pseudo)+'<p class="cp-msg">'+cpE("Could not load this profile.")+"</p>"+fermer);return;}
  if(cp&&j.p!==cp.pseudo)await cpaCharger();
  if(f.hidden||f.dataset.pseudo!==String(pseudo))return;
  const moi=!!(cp&&j.p===cp.pseudo),rangs=cpObjet(j.rangs),mois=cppMois(j.depuis);
  poser(tete(j.p,mois?t("Member since {date}",{date:mois}):"",rangs,j.pays)+
    '<ul class="cpp-liste">'+CPJ.map(([,nom],i)=>{
      const k=CPJ_COLONNES[i][0],rang=cpNombre(rangs[k]);
      return "<li><span>"+cpE(nom)+"</span><b>"+echapper(String(cpNombre(j[k])))+'</b><span class="cpp-rang">'+(rang>0?"#"+rang:"–")+"</span></li>";
    }).join("")+"</ul>"+
    /* Parties en direct : le detail, des qu'une partie a compte. */
    (cpNombre(cpObjet(j.dir).v)+cpNombre(cpObjet(j.dir).n)+cpNombre(cpObjet(j.dir).d)>0?'<p class="cp-note cpp-direct">'+echapper(t("Live games: {v} won, {n} drawn, {d} lost",{v:cpNombre(j.dir.v),n:cpNombre(j.dir.n),d:cpNombre(j.dir.d)}))+"</p>":"")+
    cppBadges(j.bl)+
    (cp&&!moi&&cpaReciproque(j.p)?'<p class="cp-note cpp-amis">'+cpE("You are friends: you have each added the other.")+"</p>":"")+
    (cp&&!moi?'<button type="button" class="btn primary" data-cpp-defier="'+echapper(String(j.p))+'" data-cpp-premier>'+cpE("Challenge this player")+"</button>"+
      '<button type="button" class="btn" data-cpa="'+(cpaEst(j.p)||cpaEnvoyee(j.p)?"retirer":"ajouter")+'" data-pseudo="'+echapper(String(j.p))+'">'+cpE(cpaEst(j.p)?"Remove from my friends":cpaEnvoyee(j.p)?"Cancel my friend request":cpaRecue(j.p)?"Accept the friend request":"Add to my friends")+"</button>"+
      (cpaEnvoyee(j.p)?'<p class="cp-note cpp-amis">'+cpE("Friend request sent. {name} has to accept it.").replace("{name}",echapper(String(j.p)))+"</p>":"")+
      '<p class="cp-msg cpp-msg" id="cppMsg" aria-live="polite"></p>':"")+fermer);
}
/* Les badges du joueur, en petites medailles (2026-11-18) : les treize
   derniers gagnes (avec le nombre des autres, cela fait deux rangees pleines
   de sept sur telephone), du plus recent au plus ancien, et le nombre des autres.
   Le nom du badge est dit au survol et aux lecteurs d'ecran. Rien si les
   dessins ne sont pas charges ou si le joueur n'a pas encore de badge. */
const CPP_BADGES_MAX=13;
function cppBadges(liste){
  if(typeof bxMedailles==="undefined"||!bxMedailles||typeof bxMedaille!=="function")return "";
  const l=cpListe(liste).filter(id=>typeof id==="string"&&id[0]!=="_"&&Array.isArray(bxMedailles[id])).reverse();
  if(!l.length)return "";
  const vus=l.slice(0,CPP_BADGES_MAX),reste=l.length-vus.length;
  return '<p class="cpp-badges-titre">'+cpE("Badges")+'</p><ul class="cpp-badges">'+vus.map(id=>{
    const nom=typeof bxTexte==="function"?bxTexte(id,0):"";
    return '<li title="'+echapper(nom)+'">'+bxMedaille(id,true)+'<span class="cp-sr">'+echapper(nom)+"</span></li>";
  }).join("")+(reste>0?'<li class="cpp-badges-reste" aria-label="'+echapper("+"+reste)+'">+'+reste+"</li>":"")+"</ul>";
}

/* ---------- Amis ---------- */
/* Une liste privee de joueurs (2026-11-18), tenue par le serveur (routes amis,
   ami-ajouter, ami-retirer). On ajoute un joueur depuis sa fiche, sans
   demande : il n'est pas prevenu et personne d'autre ne voit la liste. Elle
   donne le tableau "Mes amis" de Meilleurs joueurs. Gardee une minute ici. */
let cpaListe=null,cpaT=0,cpaPour="";
async function cpaCharger(force){
  if(!cp)return null;
  if(!force&&cpaListe&&cpaPour===cp.pseudo&&Date.now()-cpaT<60000)return cpaListe;
  const r=await cpApi("GET","amis");
  if(r.s!==200||!cp)return null;
  cpaListe=r.j;cpaT=Date.now();cpaPour=cp.pseudo;
  cpaPoint();
  return cpaListe;
}
/* Ami reciproque : l'autre joueur m'a ajoute lui aussi (m rendu par le serveur). */
function cpaReciproque(pseudo){return !!(cp&&cpaListe&&cpaPour===cp.pseudo&&cpListe(cpaListe.amis).some(x=>x.p===pseudo&&x.m));}
function cpaEst(pseudo){return !!(cp&&cpaListe&&cpaPour===cp.pseudo&&cpListe(cpaListe.amis).some(x=>x.p===pseudo));}
/* Demandes d'amis (2026-11-19) : celles que j'ai envoyees, celles que j'ai recues. */
function cpaEnvoyee(pseudo){return !!(cp&&cpaListe&&cpaPour===cp.pseudo&&cpListe(cpaListe.envoyees).includes(pseudo));}
function cpaRecue(pseudo){return !!(cp&&cpaListe&&cpaPour===cp.pseudo&&cpListe(cpaListe.demandes).includes(pseudo));}
function cpaDemandes(){return cp&&cpaListe&&cpaPour===cp.pseudo?cpListe(cpaListe.demandes).filter(x=>typeof x==="string"):[];}
/* Le nombre de demandes recues, a droite de « Mes amis », et le point du menu. */
function cpaPoint(){
  const n=cpaDemandes().length,d=$("menuAmisDetail"),p=$("btnMenuPoint");
  if(d)d.textContent=n?String(n):"";
  if(p&&n)p.hidden=false;
}
/* Repondre a une demande depuis « Mes amis ». */
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-cpa-rep]");
  if(!b||!cp)return;
  b.disabled=true;
  const oui=b.dataset.cpaRep==="accepter";
  const r=await cpApi("POST",oui?"ami-accepter":"ami-refuser",{pseudo:b.dataset.pseudo||""});
  if(oui&&(r.s===200||r.s===201))cpBadge("mb_ami");
  await cpaCharger(true);
  const v=$("menuJoueursVue");
  if(cpjPar==="amis"&&v&&!v.hidden)cpjVue();
});
setTimeout(()=>{if(cp)cpaCharger();},6000);
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-cpa]");
  if(!b||!cp)return;
  const pseudo=b.dataset.pseudo||"",ajout=b.dataset.cpa==="ajouter";
  b.disabled=true;
  const r=await cpApi("POST",ajout?"ami-ajouter":"ami-retirer",{pseudo:pseudo});
  if(r.s!==200&&r.s!==201&&r.s!==202){
    b.disabled=false;
    const m=$("cppMsg");if(m)m.textContent=t(r.s===429?"Your friends list is full.":"Could not load the list. Try again later.");
    return;
  }
  /* Le badge vient quand on est vraiment amis, pas a la simple demande. */
  if(ajout&&r.j&&r.j.etat!=="demande")cpBadge("mb_ami");
  await cpaCharger(true);
  const f=$("cpProfil");
  if(f&&!f.hidden&&f.dataset.pseudo===pseudo)cppOuvrir(pseudo);
  const v=$("menuJoueursVue");
  if(cpjPar==="amis"&&v&&!v.hidden)cpjVue();
});
document.addEventListener("click",e=>{
  const o=e.target.closest("[data-cpp]");
  if(o){cppOuvrir(o.dataset.cpp);return;}
  const d=e.target.closest("[data-cpp-defier]");
  if(d){cpdRevanche=d.dataset.cppDefier||"";cppFermer();menuFermer();duelCreer();return;}
  if(e.target.closest("[data-cpp-fermer]")||e.target.id==="cpProfil")cppFermer();
});
/* Echap ferme la fiche, et elle seule (le menu reste ouvert derriere). */
document.addEventListener("keydown",e=>{
  const f=$("cpProfil");
  if(e.key==="Escape"&&f&&!f.hidden){e.stopPropagation();e.preventDefault();cppFermer();}
},true);
{const av=menuFermer;menuFermer=function(){cppFermer();return av.apply(this,arguments);};}

/* ---------- Defis entre membres ---------- */
/* Le defi par lien (duel.js) sans le lien (2026-11-17) : apres ses cinq
   exercices, un joueur connecte peut envoyer le defi a un membre, par son
   pseudo. Le destinataire le trouve dans "Defis entre membres" du menu, le
   releve (memes exercices, score a battre), et les deux voient le resultat.
   Serveur : routes defis / defi-envoyer / defi-repondre / defi-supprimer de
   functions/api/compte/[[route]].js. Aucun texte libre ne circule.
   Le point du menu signale un defi a relever ou une reponse pas encore vue
   (chang64:defisVus garde les reponses deja vues sur cet appareil). */
let cpdListe=null,cpdT=0,cpdEnvoi=null,cpdRevanche="";
function cpdVus(){const v=cpLire("chang64:defisVus");return Array.isArray(v)?v:[];}
function cpdNouveaux(){
  if(!cp||!cpdListe)return 0;
  const vus=cpdVus();
  return cpListe(cpdListe.recus).filter(x=>x.r2===null).length+cpListe(cpdListe.envoyes).filter(x=>x.r2!==null&&!vus.includes(x.id)).length;
}
function cpdPoint(){
  const n=cpdNouveaux(),d=$("menuDefisMembresDetail"),p=$("btnMenuPoint");
  if(d)d.textContent=n?String(n):"";
  if(p&&n)p.hidden=false;
}
async function cpdCharger(force){
  if(!cp||cpEtatSync==="session")return cpdListe;
  if(!force&&cpdListe&&Date.now()-cpdT<60000)return cpdListe;
  const r=await cpApi("GET","defis");
  if(r.s===200&&r.j&&Array.isArray(r.j.recus)){cpdListe=r.j;cpdT=Date.now();cpdPoint();}
  return cpdListe;
}
function cpdJoueur(x,k){return {r:x["r"+k],t:x["t"+k]};}
/* Une ligne de resultat : moi et l'autre, le gagnant encadre. */
function cpdResultat(x,recu){
  const moi=cpdJoueur(x,recu?2:1),autre=cpdJoueur(x,recu?1:2),c=duelComparer(moi,autre);
  return '<p class="cpd-titre">'+echapper(c>0?t("You win!"):c<0?t("{name} wins!",{name:x.p}):t("Perfect tie!"))+"</p>"+
    '<ul class="duel-tableau">'+duelLigne(t("You"),moi,c>0)+duelLigne(x.p,autre,c<0)+"</ul>";
}
async function cpdVue(){
  const v=$("menuDefisMembresVue");if(!v)return;
  if(!cp){
    poserHtml(v,'<p class="app-intro">'+cpE("Create an account to challenge other members by their username.")+"</p>"+
      '<button type="button" class="btn primary cp-large" data-vue-compte="1">'+cpE("Create an account")+"</button>");
    return;
  }
  if(!cpdListe)poserHtml(v,'<p class="cp-note cp-centre">'+cpE("Loading…")+"</p>");
  const l=await cpdCharger(true);
  if(v.hidden)return;
  if(!l){poserHtml(v,'<p class="cp-msg">'+cpE("Could not load the list. Try again later.")+"</p>");return;}
  const aRelever=cpListe(l.recus).filter(x=>x.r2===null),attente=cpListe(l.envoyes).filter(x=>x.r2===null);
  const finis=cpListe(l.recus).filter(x=>x.r2!==null).map(x=>[x,true]).concat(cpListe(l.envoyes).filter(x=>x.r2!==null).map(x=>[x,false]))
    .sort((a,b)=>cpNombre(b[0].repondu)-cpNombre(a[0].repondu)).slice(0,20);
  let h="";
  if(aRelever.length)h+='<p class="tiroir-section">'+cpE("To take up")+"</p>"+aRelever.map(x=>
    '<div class="cpd-carte"><p class="cpd-titre">'+echapper(t("{name} challenges you!",{name:x.p}))+"</p>"+
    '<p class="cp-note">'+echapper(t("Score to beat: {n}/{total}",{n:duelPremiers(x.r1),total:DUEL_N}))+" "+duelPoints(x.r1)+" "+duelTemps(x.t1)+"</p>"+
    '<div class="cpd-boutons"><button type="button" class="btn primary" data-cpd-relever="'+x.id+'">'+cpE("Take the challenge")+'</button><button type="button" class="btn" data-cpd-supprimer="'+x.id+'">'+cpE("Decline")+"</button></div>"+
    '<button type="button" class="linkbtn cp-lien cpd-bloquer" data-cpd-bloquer="'+x.id+'">'+cpE("Stop receiving challenges from this player")+"</button></div>").join("");
  if(finis.length)h+='<p class="tiroir-section">'+cpE("Results")+"</p>"+finis.map(([x,recu])=>
    '<div class="cpd-carte">'+cpdResultat(x,recu)+"</div>").join("");
  if(attente.length)h+='<p class="tiroir-section">'+cpE("Waiting for an answer")+"</p>"+attente.map(x=>
    '<div class="cpd-carte cpd-attente"><p class="cp-note">'+echapper(t("{name} has not answered yet.",{name:x.p}))+"</p>"+
    '<button type="button" class="linkbtn cp-lien" data-cpd-supprimer="'+x.id+'">'+cpE("Withdraw")+"</button></div>").join("");
  if(!h)h='<p class="cp-note cp-centre">'+cpE("No challenge for now. Play five puzzles and send them to a member.")+"</p>";
  h+='<button type="button" class="btn cp-large" data-cpd-nouveau>'+cpE("New challenge")+"</button>";
  /* Joueurs bloques : on peut revenir sur sa decision. */
  if(cpListe(l.bloques).length)h+='<p class="tiroir-section">'+cpE("Blocked players")+"</p>"+cpListe(l.bloques).map(p=>
    '<div class="cpd-carte cpd-attente"><p class="cp-note">'+echapper(String(p))+'</p><button type="button" class="linkbtn cp-lien" data-cpd-debloquer="'+echapper(String(p))+'">'+cpE("Unblock")+"</button></div>").join("");
  poserHtml(v,h);
  /* Les reponses affichees sont vues : le point s'eteint. */
  cpEcrire("chang64:defisVus",cpListe(l.envoyes).filter(x=>x.r2!==null).map(x=>x.id).slice(0,60));
  cpdPoint();
  if(typeof menuPoint==="function")menuPoint();
}
{
  const av=menuVue;
  menuVue=function(nom){
    const v=$("menuDefisMembresVue");
    if(nom!=="defisMembres"){if(v)v.hidden=true;return av.apply(this,arguments);}
    av.call(this,"accueil");
    for(const e of document.querySelectorAll("#menuTiroir .tiroir-vue"))e.hidden=e!==v;
    $("menuRetour").hidden=false;
    $("menuTitre").textContent=t("Member challenges");
    cpdVue();
    if(v){v.scrollTop=0;if(!mouvementCalme()&&v.animate)v.animate([{opacity:0,transform:"translateX(18px)"},{opacity:1,transform:"none"}],{duration:260,easing:"cubic-bezier(.22,.7,.3,1)"});}
  };
}
/* Le point du bouton de menu : une nouveaute OU un defi qui attend. */
{const av=menuPoint;menuPoint=function(){const r=av.apply(this,arguments);cpdPoint();return r;};}
{const av=menuOuvrir;menuOuvrir=function(){const r=av.apply(this,arguments);cpdCharger().then(()=>{if(typeof menuPoint==="function")menuPoint();});return r;};}
/* Fin d'un defi cree : proposer de l'envoyer a un membre. */
{
  const av=duelVueCree;
  duelVueCree=function(ids,moi){
    const r=av.apply(this,arguments);
    const fermer=document.querySelector("#duelContenu .duel-fermer");
    if(cp&&fermer){
      cpdEnvoi={ids:ids,moi:moi};
      fermer.insertAdjacentHTML("beforebegin",'<div class="duel-membre"><label class="duel-nom" for="duelMembre"><span>'+cpE("Or send it to a member")+"</span>"+
        '<input type="text" id="duelMembre" maxlength="24" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="'+cpE("Username")+'" value="'+echapper(cpdRevanche)+'"></label>'+
        '<button type="button" class="btn" data-duel-membre>'+cpE("Send to this member")+'</button><p class="duel-note" id="duelMembreMsg" aria-live="polite"></p></div>');
    }
    cpdRevanche="";
    return r;
  };
}
/* Fin d'un defi releve chez un membre : la reponse part au serveur, pas dans
   un lien. */
async function cpdRepondre(ids,adv,moi){
  const c=duelComparer(moi,adv);
  duelOuvrir(duelTete(c>0?t("You win!"):c<0?t("{name} wins!",{name:adv.n}):t("Perfect tie!"),"").replace(echapper(t("Challenge a friend")),echapper(t("Member challenges")))+
    '<ul class="duel-tableau">'+duelLigne(t("You"),moi,c>0)+duelLigne(adv.n,adv,c<0)+"</ul>"+
    '<p class="duel-note" id="cpdRepMsg" aria-live="polite">'+cpE("Syncing…")+"</p>"+
    '<div class="duel-boutons"><button type="button" class="btn primary" data-duel-nouveau data-cpd-revanche="'+echapper(adv.n)+'" data-duel-premier>'+cpE("Rematch")+
    '</button><button type="button" class="btn" data-duel-fermer>'+cpE("Close")+"</button></div>");
  const envoyer=async()=>{
    const r=await cpApi("POST","defi-repondre",{id:adv.membre,r:moi.r,t:moi.t});
    const m=$("cpdRepMsg");if(!m)return;
    if(r.s===200){m.textContent=t("Your answer has been sent to {name}.",{name:adv.n});cpdT=0;cpdCharger(true);return;}
    /* Deja repondu ou defi retire : rien a renvoyer. */
    if(r.s===404){m.textContent="";cpdT=0;return;}
    poserHtml(m,echapper(t("Your answer could not be sent. Check your network."))+' <button type="button" class="linkbtn cp-lien" id="cpdReessayer">'+cpE("Try again")+"</button>");
    const b=$("cpdReessayer");if(b)b.onclick=()=>{m.textContent=t("Syncing…");envoyer();};
  };
  envoyer();
}
{
  const av=duelVueReponse;
  duelVueReponse=function(ids,adv,moi){
    if(adv&&adv.membre&&cp){cpdRepondre(ids,adv,moi);return;}
    return av.apply(this,arguments);
  };
}
document.addEventListener("click",async e=>{
  if(e.target.closest("[data-vue-defis-membres]")){menuVue("defisMembres");return;}
  const rev=e.target.closest("[data-cpd-revanche]");
  if(rev){cpdRevanche=rev.dataset.cpdRevanche||"";return;}
  if(e.target.closest("[data-cpd-nouveau]")){menuFermer();duelCreer();return;}
  const rel=e.target.closest("[data-cpd-relever]");
  if(rel){
    const x=cpListe(cpdListe&&cpdListe.recus).find(y=>String(y.id)===rel.dataset.cpdRelever),ids=x&&duelDec(x.exos);
    if(x&&ids){menuFermer();duelDemarrer(ids,{r:x.r1,t:x.t1,n:x.p,membre:x.id});}
    return;
  }
  const blo=e.target.closest("[data-cpd-bloquer]");
  if(blo){blo.disabled=true;await cpApi("POST","defi-bloquer",{id:+blo.dataset.cpdBloquer});cpdVue();return;}
  const deb=e.target.closest("[data-cpd-debloquer]");
  if(deb){deb.disabled=true;await cpApi("POST","defi-debloquer",{pseudo:deb.dataset.cpdDebloquer});cpdVue();return;}
  const sup=e.target.closest("[data-cpd-supprimer]");
  if(sup){sup.disabled=true;await cpApi("POST","defi-supprimer",{id:+sup.dataset.cpdSupprimer});cpdVue();return;}
  const env=e.target.closest("[data-duel-membre]");
  if(env&&cpdEnvoi){
    const msg=$("duelMembreMsg"),v=pseudoValider(($("duelMembre")||{}).value||"");
    if(!v.ok){msg.textContent=t("No member has this username.");return;}
    env.disabled=true;msg.textContent=t("Syncing…");
    const r=await cpApi("POST","defi-envoyer",{a:v.pseudo,exos:duelEnc(cpdEnvoi.ids),r:cpdEnvoi.moi.r,t:cpdEnvoi.moi.t});
    env.disabled=false;
    if(r.s===201){msg.textContent=t("Challenge sent to {name}.",{name:r.j.a||v.pseudo});env.disabled=true;cpdT=0;cpBadge("mb_defi");return;}
    msg.textContent=r.s===404?t("No member has this username."):r.s===400&&r.j.erreur==="soi"?t("You cannot challenge yourself."):r.s===429&&r.j.erreur==="trop"?t("Too many challenges waiting. Try again later."):cpErreur(r);
  }
});
/* Au demarrage, une fois la session lue : y a-t-il un defi a relever ? */
setTimeout(()=>{cpdCharger().then(()=>{if(typeof menuPoint==="function")menuPoint();});},4000);

/* ---------- Mini-enquetes de satisfaction ---------- */
/* De temps en temps (2026-11-17, demande d'Alexandre), un joueur connecte se
   voit poser une question dans le bilan de seance, donc jamais pendant un
   exercice ni une partie : une note de 1 a 5, puis, s'il le veut, un
   commentaire court. Au plus une fois tous les 30 jours sur cet appareil,
   et le serveur refuse plus d'une reponse par compte en 25 jours. La
   question posee est celle a laquelle il a repondu il y a le plus
   longtemps. Serveur : routes "enquete" de functions/api/compte. */
const CPE_QUESTIONS={site:"How much do you enjoy chang64?",interface:"How easy is chang64 to use?",exercices:"Are the puzzles at the right level for you?",ordinateur:"How do you like playing against the computer?",compte:"How well does your account work for you?"};
const CPE_CLE="chang64:enqueteVue",CPE_DELAI=30*864e5;
let cpeQuestion="",cpeNote=0;
/* Cinq etoiles a la place des chiffres (2026-11-18, demande d'Alexandre). */
const CPE_ETOILE='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z"/></svg>';
async function cpeProposer(){
  const z=$("bilanEnquete");if(!z)return;
  z.hidden=true;
  if(!cp||cpEtatSync==="session")return;
  const autre=$("bilanApp");if(autre&&!autre.hidden)return;
  let dernier=0;try{dernier=+(localStorage.getItem(CPE_CLE)||0);}catch(e){}
  if(Date.now()-dernier<CPE_DELAI)return;
  const r=await cpApi("GET","enquete");
  if(r.s!==200||!r.j.possible)return;
  const bi=$("bilan");if(!bi||bi.hidden)return;
  const d=cpObjet(r.j.dernieres);
  cpeQuestion=Object.keys(CPE_QUESTIONS).sort((a,b)=>cpNombre(d[a])-cpNombre(d[b]))[0];
  cpeNote=0;
  try{localStorage.setItem(CPE_CLE,String(Date.now()));}catch(e){}
  poserHtml(z,'<p class="cpe-titre">'+cpE("Your opinion")+'</p><p class="cpe-question" id="cpeQ">'+cpE(CPE_QUESTIONS[cpeQuestion])+"</p>"+
    '<div class="cpe-notes" role="group" aria-labelledby="cpeQ">'+[1,2,3,4,5].map(n=>'<button type="button" data-cpe-note="'+n+'" aria-pressed="false" aria-label="'+echapper(t("{n} out of 5",{n:n}))+'">'+CPE_ETOILE+"</button>").join("")+"</div>"+
    '<p class="cpe-echelle" aria-hidden="true"><span>'+cpE("Not at all")+"</span><span>"+cpE("Very much")+"</span></p>"+
    '<div class="cpe-suite" id="cpeSuite" hidden><label for="cpeTexte">'+cpE("A word to add? (optional)")+'</label><textarea id="cpeTexte" maxlength="500" rows="3"></textarea>'+
    '<button type="button" class="btn primary" data-cpe-envoyer>'+cpE("Send")+"</button></div>"+
    '<p class="cpe-msg" id="cpeMsg" role="status" aria-live="polite"></p>');
  z.hidden=false;
}
{const av=bilanOuvrir;bilanOuvrir=function(){const r=av.apply(this,arguments);cpeProposer();return r;};}
document.addEventListener("click",async e=>{
  const n=e.target.closest("#bilanEnquete [data-cpe-note]");
  if(n){
    cpeNote=+n.dataset.cpeNote;
    /* Les etoiles se remplissent jusqu'a la note choisie. */
    document.querySelectorAll("#bilanEnquete [data-cpe-note]").forEach(b=>{b.setAttribute("aria-pressed",String(+b.dataset.cpeNote===cpeNote));b.classList.toggle("on",+b.dataset.cpeNote<=cpeNote);});
    const s=$("cpeSuite");if(s)s.hidden=false;
    return;
  }
  const env=e.target.closest("#bilanEnquete [data-cpe-envoyer]");
  if(env&&cpeNote){
    env.disabled=true;
    const r=await cpApi("POST","enquete",{question:cpeQuestion,note:cpeNote,commentaire:($("cpeTexte")||{}).value||"",langue:typeof LANG==="string"?LANG:""});
    const z=$("bilanEnquete");if(!z)return;
    if(r.s===201)cpBadge("mb_avis");
    if(r.s===201||r.s===429){poserHtml(z,'<p class="cpe-merci" role="status">'+cpE("Thank you! It helps make chang64 better.")+"</p>");return;}
    env.disabled=false;
    const m=$("cpeMsg");if(m)m.textContent=cpErreur(r);
  }
});

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
