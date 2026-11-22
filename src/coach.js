/* ==========================================================
   COACH DE RELECTURE (2026-11-22)
   ========================================================== */
/* Apres une partie, la relecture disait « gaffe » ou « erreur » sans dire
   pourquoi. Le coach donne une phrase par faute, dans la langue du joueur.

   REGLE DE VERITE. La lecon du 21/11 (28 761 phrases d'explication
   d'exercices fausses sur 161 675, surtout « rien ne defend X ») : une
   phrase n'est dite que si le fait qu'elle affirme est controle ici, sur
   l'echiquier, par les regles du jeu. Le moteur d'analyse (Stockfish) ne
   sert qu'a dire quel coup compte : le meilleur coup, la reponse adverse,
   la suite. Il ne sert jamais a affirmer un fait. Si aucune condition
   n'est remplie, expliquer() rend null et l'ecran dit seulement le coup
   que le coach preferait.

   Ce fichier a deux parties :
   1. COACH : les cas et leurs conditions exactes, sans ecran. Il marche
      dans la page et dans node (tests, controle sur un lot de parties par
      coach_controle.js, qui verifie chaque fait avec un programme a part).
   2. plus bas, l'ecran : phrases, bloc « Le coach », exercices tires des
      parties.

   LES CAS, dans l'ordre ou ils sont essayes. J : le joueur qui vient de
   jouer le coup m ; A : son adversaire ; b : le meilleur coup selon le
   moteur ; r : la meilleure reponse de A apres m.
     pat                le coup m fait pat.
     mat1_manque        un coup legal de J matait tout de suite.
     mat1_permis        apres m, un coup legal de A mate ; b ne le permettait pas.
     mat2_manque        J avait un mat force en deux coups.
     mat2_permis        apres m, A a un mat force en deux coups ; pas apres b.
   Puis, parmi ceux qui s'appliquent, celui qui pese le plus de materiel :
     prise_perdante     m prend une piece avec une piece plus chere, et r
                        reprend sur la meme case.
     en_prise           r prend une piece de J (cavalier ou plus), et soit
                        aucune piece de J n'attaque la case apres r (libre),
                        soit la piece qui prend vaut moins (moindre). « deja » :
                        la piece etait deja attaquee par ce meme attaquant
                        avant m, et elle n'a pas bouge.
     promo_manquee      b fait une dame que rien ne peut prendre.
     prise_manquee      b prend une piece que plus rien ne defend (libre), ou
                        avec une piece qui vaut moins (moindre).
     fourchette_permise r attaque deux pieces a la fois, et la suite du moteur
                        en prend une avec la piece qui fourchette, gain net.
     fourchette_manquee pareil pour b.
   Valeurs : pion 1, cavalier 3, fou 3, tour 5, dame 9. */
const COACH=(function(){
  const VAL={1:1,2:3,3:3,4:5,5:9,6:0};
  const LET={1:"p",2:"n",3:"b",4:"r",5:"q",6:"k"};
  const O_N=[-33,-31,-18,-14,14,18,31,33],O_B=[-17,-15,15,17],O_R=[-16,-1,1,16],O_K=[-17,-16,-15,-1,1,15,16,17];
  const nom=s=>"abcdefgh"[s&7]+(8-(s>>4));
  const typ=p=>p&7,coul=p=>p>>3;
  const uci=m=>nom(m.from)+nom(m.to)+(m.promo?LET[m.promo]:"");
  const trouver=(g,u)=>{if(!u)return null;for(const m of g.moves())if(uci(m)===u)return m;return null;};
  /* Cases d'ou une piece de la couleur « par » attaque la case sq. Attaque
     au sens geometrique : une piece clouee attaque quand meme, et le roi
     aussi. C'est le sens le plus exigeant pour dire « rien ne defend ». */
  function attaquants(g,sq,par){
    const b=g.board,out=[],dir=par===0?16:-16;
    for(const d of [dir-1,dir+1]){const s=sq+d;if(!(s&0x88)){const p=b[s];if(p&&coul(p)===par&&typ(p)===1)out.push(s);}}
    for(const d of O_N){const s=sq+d;if(!(s&0x88)){const p=b[s];if(p&&coul(p)===par&&typ(p)===2)out.push(s);}}
    for(const d of O_K){const s=sq+d;if(!(s&0x88)){const p=b[s];if(p&&coul(p)===par&&typ(p)===6)out.push(s);}}
    for(const d of O_B){let s=sq+d;while(!(s&0x88)){const p=b[s];if(p){if(coul(p)===par&&(typ(p)===3||typ(p)===5))out.push(s);break;}s+=d;}}
    for(const d of O_R){let s=sq+d;while(!(s&0x88)){const p=b[s];if(p){if(coul(p)===par&&(typ(p)===4||typ(p)===5))out.push(s);break;}s+=d;}}
    return out;
  }
  /* Cases occupees par l'adversaire qu'attaque la piece posee en sq. */
  function ciblesDe(g,sq){
    const b=g.board,p=b[sq],out=[];if(!p)return out;
    const c=coul(p),t=typ(p);
    const voir=s=>{if(!(s&0x88)){const q=b[s];if(q&&coul(q)!==c)out.push(s);}};
    if(t===1){const av=c===0?-16:16;voir(sq+av-1);voir(sq+av+1);}
    else if(t===2)for(const d of O_N)voir(sq+d);
    else if(t===6)for(const d of O_K)voir(sq+d);
    else{
      const dirs=t===3?O_B:t===4?O_R:O_K;
      for(const d of dirs){let s=sq+d;while(!(s&0x88)){const q=b[s];if(q){if(coul(q)!==c)out.push(s);break;}s+=d;}}
    }
    return out;
  }
  const estMat=g=>g.moves().length===0&&g.inCheck();
  function matsEn1(g){
    const out=[];
    for(const m of g.moves()){g.makeMove(m);const fin=estMat(g);g.undoMove();if(fin)out.push(m);}
    return out;
  }
  /* Le camp au trait force-t-il le mat en n coups au plus ? */
  function forceMat(g,n){
    if(n<=0)return false;
    for(const m of g.moves()){
      g.makeMove(m);
      const rep=g.moves();let ok;
      if(!rep.length)ok=g.inCheck();
      else if(n===1)ok=false;
      else{ok=true;for(const r of rep){g.makeMove(r);const s=forceMat(g,n-1);g.undoMove();if(!s){ok=false;break;}}}
      g.undoMove();
      if(ok)return true;
    }
    return false;
  }
  /* Premiers coups d'un mat force en deux coups exactement. */
  function matsEn2(g){
    const out=[];
    for(const m of g.moves()){
      g.makeMove(m);
      const rep=g.moves();let ok=rep.length>0;
      if(ok)for(const r of rep){g.makeMove(r);const s=forceMat(g,1);g.undoMove();if(!s){ok=false;break;}}
      g.undoMove();
      if(ok)out.push(m);
    }
    return out;
  }
  /* Materiel de chaque camp, en pions. */
  function materiel(g){
    const s=[0,0],b=g.board;
    for(let sq=0;sq<128;sq++){if(sq&0x88){sq+=7;continue;}const p=b[sq];if(p)s[coul(p)]+=VAL[typ(p)];}
    return s;
  }
  const choisir=(liste,prefere)=>{const u=liste.map(uci);return prefere&&u.indexOf(prefere)>=0?prefere:u[0];};
  const fiche=(p,sq)=>({p:LET[typ(p)],sq:nom(sq)});

  /* Fourchette : le coup mv (du camp au trait dans g) pose une piece qui
     attaque au moins deux pieces adverses qui comptent (le roi, une piece
     plus chere que celle qui attaque, ou une piece d'au moins trois points
     que rien ne defend), ET la suite du moteur (pv, qui commence par mv)
     prend l'une d'elles avec cette meme piece au coup suivant, pour un gain
     net d'au moins un point une fois la reponse adverse jouee. Rend les deux
     cibles les plus cheres, ou null. g est rendu tel qu'il a ete recu. */
  function fourchette(g,mv,pv){
    if(!mv||!pv||pv.length<3||pv[0]!==uci(mv))return null;
    const tp=mv.promo||typ(mv.piece);
    if(tp===6)return null;
    const camp=g.turn,avant=materiel(g);
    let fait=0,res=null;
    try{
      g.makeMove(mv);fait++;
      const w=mv.to,b=g.board;
      const cibles=[];
      for(const s of ciblesDe(g,w)){
        const q=b[s],tq=typ(q);
        if(tq===6||VAL[tq]>VAL[tp]||(VAL[tq]>=3&&attaquants(g,s,coul(q)).length===0))cibles.push(s);
      }
      if(cibles.length<2)return null;
      /* La suite : reponse adverse, puis notre prise d'une cible avec la
         piece qui fourchette. */
      const a1=trouver(g,pv[1]);if(!a1)return null;
      g.makeMove(a1);fait++;
      const j2=trouver(g,pv[2]);
      if(!j2||j2.from!==w||!j2.captured||(j2.flags&16))return null;
      if(cibles.indexOf(j2.to)<0||typ(j2.captured)===6)return null;
      g.makeMove(j2);fait++;
      const a2=pv[3]?trouver(g,pv[3]):null;
      /* Suite du moteur trop courte pour montrer la reponse : on compte comme
         si la piece qui vient de prendre etait reprise, des qu'une piece
         adverse l'attaque. */
      let reprise=0;
      if(a2){
        g.makeMove(a2);fait++;
        /* Tant que la suite du moteur continue de prendre, on la suit : le
           bilan se lit une fois les echanges finis (une piece prise par
           l'adversaire au passage peut etre reprise au coup suivant). */
        for(let k=4;k<pv.length&&k<10&&a2.captured;k++){
          const mk=trouver(g,pv[k]);
          if(!mk||!mk.captured)break;
          g.makeMove(mk);fait++;
        }
      }
      else if(attaquants(g,j2.to,camp^1).length)reprise=VAL[tp];
      const apres=materiel(g);
      const net=(apres[camp]-avant[camp])-(apres[camp^1]-avant[camp^1])-reprise;
      if(net<1)return null;
      /* Les cibles sont relues sur la position juste apres mv. */
      while(fait>1){g.undoMove();fait--;}
      const tri=cibles.slice().sort((x,y)=>(typ(g.board[y])===6?99:VAL[typ(g.board[y])])-(typ(g.board[x])===6?99:VAL[typ(g.board[x])]));
      /* La cible prise par la suite est toujours citee. */
      let deux=tri.slice(0,2);
      if(deux.indexOf(j2.to)<0)deux=[tri[0],j2.to];
      res={cibles:deux.map(s=>fiche(g.board[s],s)),gain:net};
      return res;
    }finally{while(fait>0){g.undoMove();fait--;}}
  }

  /* d : { fen, coup, meilleur, reponse, pv, pvr, mateAvant, mateApres }
     fen : position avant le coup ; coup : le coup joue ; meilleur : le
     meilleur coup du moteur ; reponse : la meilleure reponse adverse apres
     le coup ; pv : suite du moteur depuis fen (commence par meilleur) ; pvr :
     suite apres le coup (commence par reponse). Tous les coups en notation
     UCI. mateAvant / mateApres : distance de mat annoncee par le moteur pour
     le camp au trait avant et apres le coup (null s'il n'en annonce pas) ;
     si le champ manque, le mat en deux est cherche de toute facon. */
  function expliquer(G,d){
    let g;
    try{g=new G(d.fen);}catch(e){return null;}
    const J=g.turn,A=J^1;
    const m=trouver(g,d.coup);if(!m)return null;
    const b=d.meilleur&&d.meilleur!==d.coup?trouver(g,d.meilleur):null;
    const mieux=b?d.meilleur:null;
    /* --- avant le coup --- */
    const m1=matsEn1(g);
    if(m1.length&&m1.every(x=>uci(x)!==d.coup))return {cas:"mat1_manque",de:"avant",coup:choisir(m1,d.meilleur)};
    /* --- apres le coup --- */
    g.makeMove(m);
    const rep=g.moves();
    if(!rep.length){
      /* Plus aucun coup : mat (rien a expliquer, la partie est gagnee) ou pat. */
      const echec=g.inCheck();
      g.undoMove();
      return echec?null:{cas:"pat",de:"apres",mieux:mieux};
    }
    const a1=matsEn1(g);
    if(a1.length){
      /* Le meilleur coup evitait-il le mat en un ? Sinon ce coup n'y est pour rien. */
      g.undoMove();
      let evite=false;
      if(b){g.makeMove(b);evite=matsEn1(g).length===0;g.undoMove();}
      if(evite)return {cas:"mat1_permis",de:"apres",coup:choisir(a1,d.reponse),mieux:mieux};
      return null;
    }
    g.undoMove();
    if(d.mateAvant===undefined||(d.mateAvant!=null&&d.mateAvant>=1&&d.mateAvant<=2)){
      const m2=matsEn2(g);
      if(m2.length&&m2.every(x=>uci(x)!==d.coup))return {cas:"mat2_manque",de:"avant",coup:choisir(m2,d.meilleur)};
    }
    if(d.mateApres===undefined||(d.mateApres!=null&&d.mateApres>=1&&d.mateApres<=2)){
      g.makeMove(m);
      const a2=matsEn2(g);
      g.undoMove();
      if(a2.length){
        let evite=false;
        if(b){g.makeMove(b);evite=!forceMat(g,2);g.undoMove();}
        if(evite)return {cas:"mat2_permis",de:"apres",coup:choisir(a2,d.reponse),mieux:mieux};
        return null;
      }
    }
    /* --- materiel : on garde le cas qui pese le plus --- */
    const cands=[];
    const pris=m.captured&&!(m.flags&16)?VAL[typ(m.captured)]:(m.flags&16?1:0);
    g.makeMove(m);
    const r=trouver(g,d.reponse);
    if(r&&r.captured&&!(r.flags&16)){
      const s=r.to,X=g.board[s],vX=VAL[typ(X)],Y=typ(r.piece),y=r.from;
      /* prise_perdante : m a pris sur s avec une piece plus chere, r reprend. */
      if(m.to===s&&m.captured&&!(m.flags&16)&&!m.promo){
        const va=VAL[typ(m.piece)],vc=VAL[typ(m.captured)];
        if(va-vc>=2)cands.push({cas:"prise_perdante",de:"apres",piece:fiche(m.captured,s),preneur:fiche(m.piece,s),coup:d.reponse,mieux:mieux,poids:va-vc});
      }
      /* en_prise */
      if(vX>=3&&typ(X)!==6){
        g.makeMove(r);
        const libre=attaquants(g,s,J).length===0;
        g.undoMove();
        const moindre=Y!==6&&VAL[Y]<vX;
        const perte=libre?vX-pris:moindre?vX-VAL[Y]-pris:0;
        if((libre||moindre)&&perte>=2&&!(m.to===s&&m.captured&&VAL[typ(m.piece)]-VAL[typ(m.captured)]>=2&&!m.promo)){
          /* deja : la piece n'a pas bouge et ce meme attaquant la visait deja. */
          g.undoMove();
          const avantX=g.board[s];
          const deja=m.to!==s&&avantX===X&&attaquants(g,s,A).indexOf(y)>=0;
          g.makeMove(m);
          cands.push({cas:"en_prise",de:"apres",variante:libre?"libre":"moindre",deja:deja,piece:fiche(X,s),attaquant:fiche(r.piece,y),coup:d.reponse,mieux:mieux,poids:perte});
        }
      }
    }
    /* fourchette_permise */
    if(r){
      const f=fourchette(g,r,d.pvr);
      if(f)cands.push({cas:"fourchette_permise",de:"apres",coup:d.reponse,cibles:f.cibles,mieux:mieux,poids:f.gain});
    }
    g.undoMove();
    if(b){
      /* promo_manquee : une dame que rien ne peut prendre. */
      if(b.promo===5&&!m.promo){
        g.makeMove(b);
        const sure=attaquants(g,b.to,A).length===0;
        g.undoMove();
        if(sure)cands.push({cas:"promo_manquee",de:"avant",coup:d.meilleur,poids:8});
      }
      /* prise_manquee */
      if(b.captured&&!(b.flags&16)&&!b.promo&&!(m.to===b.to&&m.captured)){
        const z=b.to,Z=b.captured,vZ=VAL[typ(Z)],W=typ(b.piece);
        if(typ(Z)!==6){
          g.makeMove(b);
          const libre=attaquants(g,z,A).length===0;
          g.undoMove();
          const moindre=W!==6&&VAL[W]<vZ;
          const gain=libre?vZ:moindre?vZ-VAL[W]:0;
          if((libre&&vZ>=3)||(!libre&&moindre&&gain>=2))
            cands.push({cas:"prise_manquee",de:"avant",variante:libre?"libre":"moindre",piece:fiche(Z,z),preneur:fiche(b.piece,b.from),coup:d.meilleur,poids:gain});
        }
      }
      /* fourchette_manquee */
      const f=fourchette(g,b,d.pv);
      if(f)cands.push({cas:"fourchette_manquee",de:"avant",coup:d.meilleur,cibles:f.cibles,poids:f.gain});
    }
    if(!cands.length)return null;
    let top=cands[0];
    for(const c of cands)if(c.poids>top.poids)top=c;
    return top;
  }

  /* Compliment : le joueur punit une faute de l'adversaire. d : { fen
     (avant le coup du joueur), coup (son coup), adv (ce que expliquer() a
     rendu pour le coup adverse d'avant, ou null) }. */
  function compliment(G,d){
    if(!d.adv)return null;
    let g;
    try{g=new G(d.fen);}catch(e){return null;}
    const m=trouver(g,d.coup);if(!m)return null;
    g.makeMove(m);
    if(d.adv.cas==="mat1_permis"&&estMat(g))return {cas:"bien_mat",de:"avant",coup:d.coup};
    if(d.adv.cas==="en_prise"&&d.adv.variante==="libre"&&d.adv.coup===d.coup&&m.captured&&!(m.flags&16)&&
       nom(m.to)===d.adv.piece.sq&&LET[typ(m.captured)]===d.adv.piece.p&&attaquants(g,m.to,g.turn).length===0)
      return {cas:"bien_prise",de:"avant",piece:d.adv.piece,coup:d.coup};
    return null;
  }

  /* L'exercice qu'une faute expliquee peut donner. net : la solution est
     nette sans autre controle (un mat : tout coup qui mate est accepte).
     Sinon il faut encore l'exigence stricte, un seul bon coup nettement
     au-dessus des autres, que seul le moteur peut mesurer (voir coachNet). */
  function exercice(d,e){
    if(!e||!e.cas)return null;
    if(e.cas==="mat1_manque")return {type:"mate",n:1,sol:[e.coup],theme:"Mate in one",net:true};
    if(e.cas==="mat2_manque")return {type:"mate",n:2,sol:[e.coup],theme:"Mate in two",net:true};
    if(!d.meilleur||d.meilleur===d.coup)return null;
    const theme=e.cas==="prise_manquee"?"Winning capture":e.cas==="fourchette_manquee"?"Double attack":"Winning move";
    return {type:"gain",n:1,sol:[d.meilleur],theme:theme,net:false};
  }
  /* Exigence stricte, la meme que pour la banque (filtre_stockfish.js) : le
     meilleur coup devance le deuxieme d'au moins 200 centipions. Deux
     garde-fous propres aux parties : apres le meilleur coup la position
     n'est pas deja perdue (pas pire que -500, soit une tour de retard :
     « trouve mieux » n'a pas de sens quand tout perd), et le deuxieme coup
     ne mate pas lui aussi (deux mats de longueurs differentes ne font pas
     un seul bon coup).
     l1, l2 : { cp, mate } des deux premieres lignes du moteur, vues du camp
     au trait ; l2 null s'il n'y a qu'un coup legal. */
  const MARGE=200,PLANCHER=-500;
  const enCp=l=>l.mate!=null?(l.mate>0?1:-1)*(20000-Math.abs(l.mate)*100):l.cp;
  function net(l1,l2){
    if(!l1||(l1.cp==null&&l1.mate==null))return false;
    const a=enCp(l1);
    if(a<PLANCHER)return false;
    if(!l2||(l2.cp==null&&l2.mate==null))return true;
    if(l2.mate!=null&&l2.mate>0)return false;
    return a-enCp(l2)>=MARGE;
  }
  /* --- La relecture d'une partie entiere --- */
  /* Meme bareme que la relecture depuis toujours (classify, ui2.js) : gaffe
     a partir de 250 centipions perdus, erreur a 120, imprecision a 55. */
  function classer(perte,estMeilleur){
    if(estMeilleur)return null;
    return perte>=250?"blunder":perte>=120?"mistake":perte>=55?"inacc":null;
  }
  /* evals[k] : ce que le moteur dit de la position k (0 : depart ; k : apres
     le k-ieme demi-coup), vu du camp au trait : { cp, mate, best, pv }.
     Chaque position n'est evaluee qu'UNE fois : l'evaluation d'apres un coup
     est celle d'avant le coup suivant (avant le 22/11 elle etait calculee
     deux fois). Rend un pli par demi-coup, avec ce qu'il faut au coach. */
  function plis(G,departFen,ucis,evals){
    const g=departFen?new G(departFen):new G(),out=[],CLAMP=1200;
    for(let i=0;i<ucis.length&&i+1<evals.length;i++){
      const av=evals[i],ap=evals[i+1],mv=trouver(g,ucis[i]);
      if(!mv||!av||!ap)break;
      const mover=g.turn;
      g.makeMove(mv);
      const b=Math.max(-CLAMP,Math.min(CLAMP,av.cp||0)),a=Math.max(-CLAMP,Math.min(CLAMP,-(ap.cp||0)));
      /* mate : distance de mat vue des Blancs (positif : les Blancs matent). */
      const matePourJ=ap.mate!=null?-ap.mate:null;
      const mate=matePourJ==null?null:(mover===0?matePourJ:-matePourJ);
      const cpTrue=ap.mate==null?(mover===0?-(ap.cp||0):(ap.cp||0)):null;
      const perte=Math.max(0,b-a);
      out.push({cp:mover===0?a:-a,cpTrue:cpTrue,mate:mate,loss:perte,tag:classer(perte,av.best===ucis[i]),best:av.best||null,mover:mover,
        rep:ap.best||null,pv:av.pv||null,pvr:ap.pv||null,mateAvant:av.mate==null?null:av.mate,mateApres:ap.mate==null?null:ap.mate});
    }
    return out;
  }
  /* Pour chaque pli : e, l'explication d'une gaffe ou d'une erreur DU JOUEUR
     (null si aucun cas ne s'applique) ; c, un compliment quand il punit une
     faute de l'adversaire. Les fautes de l'adversaire ne sont pas
     expliquees a l'ecran (decision d'Alexandre, 22/11) : leur explication ne
     sert qu'au compliment. joueur : 0 Blancs, 1 Noirs. */
  function relire(G,departFen,ucis,plies,joueur){
    const g=departFen?new G(departFen):new G(),out=[];
    let advPrec=null;
    for(let i=0;i<plies.length;i++){
      const p=plies[i],fen=g.fen(),mv=trouver(g,ucis[i]);
      if(!mv)break;
      const faute=p.tag==="blunder"||p.tag==="mistake";
      let e=null,c=null;
      if(faute){
        const d={fen:fen,coup:ucis[i],meilleur:p.best,reponse:p.rep,pv:p.pv,pvr:p.pvr};
        if("mateAvant" in p)d.mateAvant=p.mateAvant;
        if("mateApres" in p)d.mateApres=p.mateApres;
        try{e=expliquer(G,d);}catch(err){e=null;}
      }
      if(p.mover===joueur){
        if(!faute&&advPrec){try{c=compliment(G,{fen:fen,coup:ucis[i],adv:advPrec});}catch(err){c=null;}}
        out.push({e:e,c:c});advPrec=null;
      }else{out.push({e:null,c:null});advPrec=e;}
      g.makeMove(mv);
    }
    return out;
  }
  return {expliquer:expliquer,compliment:compliment,exercice:exercice,net:net,classer:classer,plis:plis,relire:relire,
    attaquants:attaquants,ciblesDe:ciblesDe,matsEn1:matsEn1,matsEn2:matsEn2,forceMat:forceMat,fourchette:fourchette,VAL:VAL};
})();

/* ==========================================================
   2. L'ECRAN (dans la page seulement)
   ========================================================== */
/* Decisions d'Alexandre (QCM du 22/11/2026) : une phrase pour chaque gaffe
   et chaque erreur du joueur, sous l'echiquier pendant la revue ET dans un
   bloc « Le coach » apres l'analyse (les trois moments les plus couteux) ;
   un compliment quand il punit une faute adverse ; la piece nommee avec sa
   case (« le fou en g5 », GRAMMAIRE.groupe), sans possessif ; sans cas
   verifiable, seulement le coup que le coach preferait ; les fautes a
   solution nette deviennent des exercices dans « Erreurs a revoir », 50 au
   plus, qui comptent pour l'objectif du jour et les resolus, pas pour le
   Niveau exercices. AUCUNE aide pendant une partie : rien ici ne s'execute
   avant finishAnalysis, qui n'existe que pour une partie finie. */
/* Garde-fou : jamais pendant une partie en cours, quelle que soit sa sorte
   (ordinateur, lien, direct, correspondance). L'analyse n'existe deja que
   pour une partie finie ; ceci le redit au cas ou un chemin l'oublierait. */
function coachInterdit(){
  try{return typeof partieEnCours==="function"&&partieEnCours();}catch(e){return true;}
}
function coachSan(fen,u){
  try{const g=new Game(fen),m=g.moves().find(x=>g.uci(x)===u);return m?g.san(m):u;}catch(e){return u;}
}
function coachFenApres(fen,u){
  try{const g=new Game(fen),m=g.moves().find(x=>g.uci(x)===u);if(m)g.makeMove(m);return g.fen();}catch(e){return fen;}
}
/* La phrase d'un cas. fen : position avant le coup du joueur ; coup : son
   coup ; mots : les pieces en toutes lettres, pour les lecteurs d'ecran. Les
   coups sont ecrits en notation anglaise : l'observateur de ui3.js les passe
   en figurines a l'affichage. */
function coachPhrase(e,fen,coup,mots){
  const depuis=e.de==="avant"?fen:coachFenApres(fen,coup);
  const ecrire=s=>mots&&typeof sanEnMots==="function"?sanEnMots(s):s;
  const move=e.coup?ecrire(coachSan(depuis,e.coup)):"";
  const gp=f=>groupe(f.p,f.sq);
  switch(e.cas){
    case "pat":return t("This move is stalemate: the opponent is not in check but has no legal move left, so the game is a draw.");
    case "mat1_manque":return t("There was checkmate in one move: {move}.",{move:move});
    case "mat2_manque":return t("There was a forced checkmate in 2 moves, starting with {move}.",{move:move});
    case "mat1_permis":return t("After this move, {move} is checkmate.",{move:move});
    case "mat2_permis":return t("After this move, the opponent has a forced checkmate in 2 moves, starting with {move}.",{move:move});
    case "promo_manquee":return t("The pawn could become a queen: {move}.",{move:move});
    case "prise_perdante":return t("{piece} was defended: {move} takes back {taker}.",{piece:gp(e.piece),taker:gp(e.preneur),move:move});
    case "en_prise":
      if(e.variante==="libre")return e.deja
        ?t("{piece} was already attacked and nothing defends it: {move} takes it.",{piece:gp(e.piece),move:move})
        :t("After this move, nothing defends {piece}: {move} takes it.",{piece:gp(e.piece),move:move});
      return e.deja
        ?t("{piece} was already attacked by {attacker}: {move} takes it.",{piece:gp(e.piece),attacker:gp(e.attaquant),move:move})
        :t("After this move, {attacker} can take {piece}: {move}.",{piece:gp(e.piece),attacker:gp(e.attaquant),move:move});
    case "prise_manquee":return e.variante==="libre"
      ?t("Nothing defended {piece}: {move} took it for free.",{piece:gp(e.piece),move:move})
      :t("{taker} could take {piece}: {move}.",{piece:gp(e.piece),taker:gp(e.preneur),move:move});
    case "fourchette_manquee":return t("There was a fork: {move} attacks both {p1} and {p2}.",{move:move,p1:gp(e.cibles[0]),p2:gp(e.cibles[1])});
    case "fourchette_permise":return t("After this move, {move} is a fork: it attacks both {p1} and {p2}.",{move:move,p1:gp(e.cibles[0]),p2:gp(e.cibles[1])});
    case "bien_prise":return t("Well spotted: nothing defended {piece}, and {move} takes it.",{piece:gp(e.piece),move:move});
    case "bien_mat":return t("Well spotted: {move} is checkmate.",{move:move});
  }
  return "";
}
/* Ce que le coach dit d'un pli (rang a partir de 0), ou null s'il n'a rien
   a en dire : fautes du joueur et compliments seulement. */
function coachPli(i,mots){
  if(typeof analysis==="undefined"||!analysis||!analysis.coach||coachInterdit())return null;
  const a=analysis.plies[i],x=analysis.coach[i];
  if(!a||!x||a.mover!==myColor)return null;
  const faute=a.tag==="blunder"||a.tag==="mistake";
  if(!x.c&&!faute)return null;
  const ecrire=s=>mots&&typeof sanEnMots==="function"?sanEnMots(s):s;
  let fen;
  try{fen=rebuildTo(i).game.fen();}catch(e){return null;}
  const coup=gameUci[i];
  let phrase="",mieux="",bien=false;
  if(x.c&&!faute){phrase=coachPhrase(x.c,fen,coup,mots);bien=true;}
  else if(x.e){
    phrase=coachPhrase(x.e,fen,coup,mots);
    if(x.e.mieux)mieux=t("Better: {move}",{move:ecrire(coachSan(fen,x.e.mieux))});
  }
  else if(a.best)phrase=t("The coach preferred {move}.",{move:ecrire(coachSan(fen,a.best))});
  if(!phrase)return null;
  const ech=typeof echapper==="function"?echapper:(s=>String(s).replace(/[&<>"]/g,""));
  return {
    html:'<span class="coach-phrase">'+ech(phrase)+"</span>"+(mieux?'<span class="coach-mieux">'+ech(mieux)+"</span>":""),
    texte:(faute&&!bien?t(VERDICT[a.tag])+". ":"")+phrase+(mieux?" "+mieux:""),
    phrase:phrase,mieux:mieux,bien:bien,sans:!bien&&!x.e
  };
}

/* ---------- Exercices tires des parties ---------- */
const COACH_EXOS_MAX=50,COACH_EXOS_PAR_PARTIE=5;
/* Les fautes expliquees du joueur qui peuvent donner un exercice. Une partie
   importee en PGN n'est pas forcement la sienne : aucune. */
function coachCandidats(plies,coach){
  const out=[];
  if(typeof revueMoi!=="undefined"&&revueMoi)return out;
  const g=gameStartFen?new Game(gameStartFen):new Game();
  for(let i=0;i<plies.length&&i<gameUci.length;i++){
    const p=plies[i],x=coach[i],fen=g.fen();
    const mv=g.moves().find(m=>g.uci(m)===gameUci[i]);
    if(!mv)break;
    if(x&&x.e&&p.mover===myColor){
      const ex=COACH.exercice({coup:gameUci[i],meilleur:p.best},x.e);
      if(ex)out.push({i:i,fen:fen,ex:ex,e:x.e,joue:gameUci[i],perte:p.loss});
    }
    g.makeMove(mv);
  }
  /* Les plus couteuses d'abord : ce sont elles qu'on garde si elles sont nombreuses. */
  return out.sort((a,b)=>b.perte-a.perte);
}
/* Sans Stockfish : seuls les mats, dont la solution est nette par nature. */
function coachPreparerSansMoteur(plies){
  if(coachInterdit())return null;
  let coach;
  try{coach=COACH.relire(Game,gameStartFen,gameUci,plies,myColor);}catch(e){return null;}
  return {coach:coach,exos:coachCandidats(plies,coach).filter(c=>c.ex.net).slice(0,COACH_EXOS_PAR_PARTIE)};
}
/* Avec Stockfish : l'exigence stricte de la banque d'exercices, un seul bon
   coup nettement au-dessus du deuxieme, mesuree sur les deux meilleures
   lignes (sfDeuxLignes, ui3.js). Le meilleur coup reste celui de la
   recherche a une ligne, comme dans filtre_stockfish.js. */
async function coachPreparer(plies){
  if(coachInterdit())return null;
  let coach;
  try{coach=COACH.relire(Game,gameStartFen,gameUci,plies,myColor);}catch(e){return null;}
  const exos=[];let mesures=0;
  for(const c of coachCandidats(plies,coach)){
    if(exos.length>=COACH_EXOS_PAR_PARTIE)break;
    if(c.ex.net){exos.push(c);continue;}
    if(mesures>=8||typeof sfDeuxLignes!=="function")continue;
    mesures++;
    let l=null;
    try{l=await sfDeuxLignes(c.fen,12);}catch(e){l=null;}
    if(l&&l[0]&&l[0].coup===c.ex.sol[0]&&COACH.net(l[0],l[1]))exos.push(c);
  }
  return {coach:coach,exos:exos};
}
function coachIdExo(fen,sol){
  const s=fen.split(" ").slice(0,4).join(" ")+"|"+sol;
  let h=5381;
  for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;
  return "pj"+(h>>>0).toString(36);
}
/* Range les exercices de la partie dans la file « Erreurs a revoir »
   (prog.mistakeQueue, deja synchronisee avec le compte : aucune table
   nouvelle). Une position deja dans la file garde son avancement. Rend les
   identifiants presents dans la file. */
function coachEnregistrer(cands){
  if(!cands||!cands.length||typeof prog==="undefined")return [];
  if(typeof ensureProgFields==="function")ensureProgFields();
  const now=Date.now(),ids=[];
  const quand=(typeof isReviewGame!=="undefined"&&isReviewGame&&typeof revueDate==="number"&&revueDate)?revueDate:now;
  let ajout=false;
  for(const c of cands.slice(0,COACH_EXOS_PAR_PARTIE)){
    const id=coachIdExo(c.fen,c.ex.sol[0]);
    ids.push(id);
    if(prog.mistakeQueue.some(m=>m.id===id))continue;
    const e={};
    for(const k of ["cas","de","coup","mieux","variante","deja","piece","preneur","attaquant","cibles"])if(c.e[k]!==undefined)e[k]=c.e[k];
    prog.mistakeQueue.push({id:id,theme:c.ex.theme,code:"",ts:now,box:1,due:now,
      pj:{f:c.fen,s:c.ex.sol[0],y:c.ex.type==="mate"?"m":"g",n:c.ex.n,j:c.joue,e:e,d:quand,k:Math.floor(c.i/2)+1}});
    ajout=true;
  }
  if(ajout){
    let pj=prog.mistakeQueue.filter(m=>m.pj);
    while(pj.length>COACH_EXOS_MAX){
      const vieux=pj.reduce((a,b)=>(a.ts||0)<=(b.ts||0)?a:b);
      prog.mistakeQueue.splice(prog.mistakeQueue.indexOf(vieux),1);
      pj=pj.filter(m=>m!==vieux);
    }
    while(prog.mistakeQueue.length>200)prog.mistakeQueue.shift();
    if(typeof saveProg==="function")saveProg();
    if(typeof renderMistakeQueue==="function")renderMistakeQueue();
  }
  return ids.filter(id=>prog.mistakeQueue.some(m=>m.id===id));
}
/* L'exercice d'une entree de la file tiree d'une partie, ou null. */
function coachPuzzle(id){
  if(typeof id!=="string"||id.slice(0,2)!=="pj"||typeof prog==="undefined"||!Array.isArray(prog.mistakeQueue))return null;
  const m=prog.mistakeQueue.find(x=>x.id===id&&x.pj&&typeof x.pj.f==="string"&&typeof x.pj.s==="string");
  if(!m)return null;
  /* explain.taire : explainSentence() ne tire aucune phrase de la seule
     solution ; c'est le coach qui explique (coachApresExo). */
  return {id:id,code:"",fen:m.pj.f,sol:[m.pj.s],type:m.pj.y==="m"?"mate":"gain",n:m.pj.n||1,theme:m.theme,level:1,pj:m.pj,explain:{taire:1}};
}
function coachDate(ts){
  const d=new Date(ts),j=String(d.getDate()).padStart(2,"0"),m=String(d.getMonth()+1).padStart(2,"0");
  return LANG==="en"?m+"/"+j:["de","ru","tr","pl"].indexOf(LANG)>=0?j+"."+m:j+"/"+m;
}
function coachProvenance(pj){
  return pj&&pj.d?t("Game of {date}, move {n}.",{date:coachDate(pj.d),n:pj.k||1}):"";
}
/* L'ecran d'exercice pour une position tiree d'une partie : pas de motif
   affiche (il donnerait la reponse), « trouve mieux », et d'ou elle vient. */
function coachHabillerExo(){
  const pj=puzzle.pj;
  /* Jamais de variation du Niveau exercices : sa difficulte n'est pas calibree. */
  puzzle.eloNote=true;
  const th=$("exTheme");if(th)th.textContent=t("From your game");
  const q=$("exQuest");if(q)q.textContent=t("You played {move}. Find better!",{move:coachSan(pj.f,pj.j)});
  const st=$("exStatus");if(st){st.className="status";st.textContent=t(game.turn===W?"Your move. White to play.":"Your move. Black to play.");}
  const ts=$("tipStrength");if(ts)ts.textContent=t("A position from one of your own games. It does not change your puzzle rating.");
  const ex=$("exExplain");if(ex)ex.textContent=coachProvenance(pj);
}
function coachApresExo(won){
  const pj=puzzle&&puzzle.pj;if(!pj)return;
  /* « Materiel gagne » serait faux quand le bon coup ne fait que sauver une
     piece : le message de reussite d'un gain est remplace. */
  if(won&&puzzle.type!=="mate"){
    const st=$("exStatus");
    if(st)st.textContent=t("{move}: that was the move. Well found!",{move:coachSan(pj.f,pj.s)});
  }
  const ex=$("exExplain");
  if(ex){
    let phrase="";
    try{phrase=pj.e?coachPhrase(pj.e,pj.f,pj.j,false):"";}catch(e){phrase="";}
    ex.textContent=(phrase?phrase+" ":"")+coachProvenance(pj);
  }
}
/* Rejouer tout de suite les positions de la partie relue : une session de
   revision (ui2.js) limitee a elles. */
function coachRejouer(){
  const ids=(typeof analysis!=="undefined"&&analysis&&analysis.exoIds)||[];
  if(!ids.length||typeof erreursEchues!=="function")return;
  revisionEnCours=true;revisionVus.clear();
  for(const m of erreursEchues())if(ids.indexOf(m.id)<0)revisionVus.add(m.id);
  suiteRevision();
}

/* ---------- Le bloc « Le coach » du panneau Revue ---------- */
function coachEffacer(){
  const b=$("coachBloc");if(b)b.classList.add("hide");
}
function coachAfficher(){
  const bloc=$("coachBloc");if(!bloc)return;
  if(typeof analysis==="undefined"||!analysis||!analysis.coach){bloc.classList.add("hide");return;}
  const P=analysis.plies,fautes=[];
  P.forEach((p,i)=>{if(p.mover===myColor&&(p.tag==="blunder"||p.tag==="mistake"))fautes.push(i);});
  /* Les trois moments les plus couteux, puis un compliment s'il y en a un,
     dans l'ordre de la partie. */
  const montres=fautes.slice().sort((a,b)=>P[b].loss-P[a].loss).slice(0,3);
  const nFautes=montres.length;
  const comp=analysis.coach.findIndex((x,i)=>x&&x.c&&P[i]&&P[i].mover===myColor&&!(P[i].tag==="blunder"||P[i].tag==="mistake"));
  if(comp>=0)montres.push(comp);
  montres.sort((a,b)=>a-b);
  const ech=typeof echapper==="function"?echapper:(s=>String(s).replace(/[&<>"]/g,""));
  let h="";
  for(const i of montres){
    const co=coachPli(i);if(!co)continue;
    const label=(Math.floor(i/2)+1)+(i%2?"… ":". ")+sanList[i];
    h+='<li><button type="button" class="coach-ligne'+(co.bien?" bien":co.sans?" sans":"")+'" data-ply="'+(i+1)+'"><b>'+ech(label)+"</b><span>"+ech(co.phrase)+"</span></button></li>";
  }
  const intro=$("coachIntro"),liste=$("coachListe");
  if(intro)intro.textContent=!fautes.length
    ?t("No blunder and no mistake on your side. Well played!")
    :t(nFautes===1?"{n} moment to review. Tap the line to see the position.":"{n} moments to review. Tap a line to see the position.",{n:nFautes});
  if(liste){
    poserHtml(liste,h);
    liste.classList.toggle("hide",!h);
    liste.querySelectorAll("[data-ply]").forEach(b=>{b.onclick=()=>{
      gotoPly(+b.dataset.ply);
      const bw=document.querySelector(".board-wrap");
      if(bw&&bw.scrollIntoView)bw.scrollIntoView({block:"center"});
    };});
  }
  /* Exercices : ranges une fois par analyse, puis proposes tout de suite. */
  if(!analysis.exoIds)analysis.exoIds=coachEnregistrer(analysis.exos||[]);
  const n=analysis.exoIds.length,note=$("coachExoNote"),btn=$("btnCoachRejouer");
  const dues=typeof erreursEchues==="function"?erreursEchues().filter(m=>analysis.exoIds.indexOf(m.id)>=0).length:0;
  if(note){
    note.textContent=n?t(n===1?"{n} position from this game is in your Mistakes to review.":"{n} positions from this game are in your Mistakes to review.",{n:n}):"";
    note.classList.toggle("hide",!n);
  }
  if(btn){btn.classList.toggle("hide",!dues);btn.onclick=coachRejouer;}
  bloc.classList.remove("hide");
}

/* ---------- Branchements (dans la page seulement) ---------- */
if(typeof document!=="undefined"&&typeof loadPuzzleById==="function"&&typeof finishPuzzle==="function"){
  {const av=loadPuzzleById;loadPuzzleById=function(id,pret){const p=coachPuzzle(id);if(p){pret(p);return;}return av.apply(this,arguments);};}
  {const av=loadPuzzle;loadPuzzle=function(){const r=av.apply(this,arguments);if(puzzle&&puzzle.pj)coachHabillerExo();return r;};}
  {const av=finishPuzzle;finishPuzzle=function(won){
    const ici=!!(puzzle&&puzzle.pj);
    if(ici)puzzle.eloNote=true;
    const r=av.apply(this,arguments);
    if(ici)coachApresExo(won);
    return r;
  };}
  /* Ni montee ni descente de palier sur une position tiree d'une partie,
     comme pour le Duel d'exercices (duelSansEchelle, duel.js). */
  const coachSansEchelle=function(av){
    return function(){
      if(!(puzzle&&puzzle.pj))return av.apply(this,arguments);
      const c=prog.correctRun,w=prog.wrongRun,gel=echelleGelee;
      echelleGelee=true;
      try{return av.apply(this,arguments);}
      finally{echelleGelee=gel;prog.correctRun=c;prog.wrongRun=w;}
    };
  };
  registerSolved=coachSansEchelle(registerSolved);
  registerPartial=coachSansEchelle(registerPartial);
  registerWrong=coachSansEchelle(registerWrong);
}
if(typeof module!=="undefined"&&module.exports)module.exports=COACH;
