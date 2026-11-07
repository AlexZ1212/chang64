/* Makruk, les echecs thais : l'easter egg de chang64 (decide par Alexandre
   le 2026-11-01). On y entre par le mot ช้าง (chang, l'elephant) de
   l'encadre "L'elephant sur l'echiquier" de l'accueil.

   Fichier a part, charge au premier clic : la page ne pese rien de plus pour
   qui ne le trouve pas. Le meme fichier sert a trois usages :
   - dans la page : le mode Makruk (plateau, ordinateur ou partie a deux,
     fiche des regles), isole du reste du site : il ne lit ni n'ecrit la
     progression aux echecs ;
   - dans un Worker cree depuis ce meme fichier : la recherche du moteur, pour
     que la page ne se fige pas pendant que l'ordinateur reflechit ;
   - sous Node : module.exports donne les regles et le moteur aux tests.
   Stockfish ne joue pas le makruk : regles et moteur sont ecrits ici, sans
   rien partager avec engine_browser.js. Tout tient dans une fonction
   anonyme, parce que la page declare deja W, B, N, R... en global. */
(function(){
"use strict";

/* ---------- regles ---------- */
/* Pieces : valeur positive pour les Blancs, negative pour les Noirs.
   Le Bia ngai est le pion promu ("coquillage retourne"), qui joue comme le
   Met. */
const BIA=1,MA=2,KHON=3,RUA=4,MET=5,KHUN=6,NGAI=7;
const LETTRE={1:"p",2:"n",3:"s",4:"r",5:"m",6:"k",7:"f"};
const DE_LETTRE={p:BIA,n:MA,s:KHON,r:RUA,m:MET,k:KHUN,f:NGAI};
/* Position de depart : les rois ne se font pas face (Khun blanc en d1,
   Khun noir en e8) et les Bia partent de la 3e et de la 6e rangee. */
const DEPART="rnsmksnr/8/pppppppp/8/8/PPPPPPPP/8/RNSKMSNR w";
/* Case 0 = a8, case 63 = h1, comme le FEN. */
const nomCase=i=>"abcdefgh"[i&7]+(8-(i>>3));
const caseDe=s=>(8-parseInt(s[1],10))*8+"abcdefgh".indexOf(s[0]);
/* Coup : depart | arrivee<<6 | PROMO. La promotion est obligatoire et
   toujours en Bia ngai, un seul bit suffit. */
const PROMO=4096;
const uci=m=>nomCase(m&63)+nomCase((m>>6)&63);

const SAUTS=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const DIAG=[[-1,-1],[-1,1],[1,-1],[1,1]];
const DROIT=[[-1,0],[1,0],[0,-1],[0,1]];
const TOUT=DIAG.concat(DROIT);
/* Le Khon avance d'une case droit devant, en plus des quatre diagonales :
   "devant" depend du camp. */
const KHON_BLANC=DIAG.concat([[-1,0]]);
const KHON_NOIR=DIAG.concat([[1,0]]);

/* Valeurs en centiemes de Bia, pour le moteur et pour designer le camp fort
   du comptage. */
const VALEUR=[0,100,300,270,500,180,0,180];

/* Cles de Zobrist sur 32 bits, tirees d'un generateur fixe : la meme
   position a la meme cle dans la page et dans le Worker. */
let graine=0x9e3779b9;
const alea=()=>{graine^=graine<<13;graine^=graine>>>17;graine^=graine<<5;return graine>>>0;};
const Z=[];for(let i=0;i<15*64;i++)Z.push(alea());
const Z_TRAIT=alea();
const zp=(p,i)=>Z[(p+7)*64+i];

/* Comptage (regle thai de fin de partie).
   - Comptage du plateau : des qu'il ne reste plus aucun Bia non promu, le
     camp fort a 64 coups pour mater.
   - Comptage des pieces : des qu'un camp n'a plus que son Khun, la limite
     depend des pieces du camp fort (8 avec deux Rua, 16 avec une, 22 avec
     deux Khon, 44 avec un, 32 avec deux Ma, 64 sinon), moins le nombre de
     pieces sur l'echiquier au moment ou le comptage commence.
   Faute de mat dans la limite, la partie est nulle. On compte les coups du
   camp fort ; une prise ou une promotion relance le comptage des pieces. */
function limitePieces(b,fort){
  let r=0,s=0,n=0;
  for(let i=0;i<64;i++){
    const p=b[i]*fort; if(p<=0)continue;
    if(p===RUA)r++; else if(p===KHON)s++; else if(p===MA)n++;
  }
  if(r>=2)return 8; if(r===1)return 16;
  if(s>=2)return 22; if(s===1)return 44;
  if(n>=2)return 32;
  return 64;
}

class Partie{
  constructor(fen){this.charger(fen||DEPART);}
  charger(fen){
    const champs=fen.trim().split(/\s+/);
    this.b=new Int8Array(64);this.rois=[-1,-1];
    let i=0;
    for(const ch of champs[0]){
      if(ch==="/")continue;
      if(ch>="1"&&ch<="8"){i+=+ch;continue;}
      const t=DE_LETTRE[ch.toLowerCase()],c=ch===ch.toUpperCase()?1:-1;
      this.b[i]=t*c;
      if(t===KHUN)this.rois[c>0?0:1]=i;
      i++;
    }
    this.trait=champs[1]==="b"?-1:1;
    this.pile=[];
    this.h=this.hacher();
    this.vus=new Map([[this.h,1]]);
    this.compte=this.compter(null,true,0);
  }
  hacher(){
    let h=0;
    for(let i=0;i<64;i++)if(this.b[i])h^=zp(this.b[i],i);
    if(this.trait<0)h^=Z_TRAIT;
    return h>>>0;
  }
  fen(){
    let s="";
    for(let r=0;r<8;r++){
      let vide=0;
      for(let c=0;c<8;c++){
        const p=this.b[r*8+c];
        if(!p){vide++;continue;}
        if(vide){s+=vide;vide=0;}
        const l=LETTRE[p<0?-p:p];
        s+=p>0?l.toUpperCase():l;
      }
      if(vide)s+=vide;
      if(r<7)s+="/";
    }
    return s+" "+(this.trait>0?"w":"b");
  }
  /* Etat du comptage apres un coup de `joueur` (0 au chargement). */
  compter(ancien,change,joueur){
    const b=this.b;
    let pions=false,blancSeul=true,noirSeul=true,matB=0,matN=0,n=0;
    for(let i=0;i<64;i++){
      const p=b[i]; if(!p)continue;
      n++;
      const t=p<0?-p:p;
      if(t===BIA)pions=true;
      if(t===KHUN)continue;
      if(p>0){blancSeul=false;matB+=VALEUR[t];}else{noirSeul=false;matN+=VALEUR[t];}
    }
    if(blancSeul&&noirSeul)return null;
    if(blancSeul!==noirSeul){
      const fort=blancSeul?-1:1;
      if(ancien&&ancien.genre==="pieces"&&ancien.fort===fort&&!change)
        return joueur===fort?{genre:"pieces",fort,reste:ancien.reste-1}:ancien;
      return {genre:"pieces",fort,reste:Math.max(1,limitePieces(b,fort)-n)};
    }
    if(pions)return null;
    if(ancien&&ancien.genre==="plateau")
      return joueur===ancien.fort?{genre:"plateau",fort:ancien.fort,reste:ancien.reste-1}:ancien;
    return {genre:"plateau",fort:matB>=matN?1:-1,reste:64};
  }
  /* Coups pseudo-legaux du camp au trait ; prises=true : prises et
     promotions seulement (recherche de calme du moteur). */
  pseudo(prises){
    const b=this.b,s=this.trait,out=[];
    for(let i=0;i<64;i++){
      const p=b[i]; if(!p||(p>0)!==(s>0))continue;
      const t=p<0?-p:p,r=i>>3,c=i&7;
      if(t===BIA){
        const r2=r-s; if(r2<0||r2>7)continue;
        const promo=r2===(s>0?2:5)?PROMO:0;
        const a=r2*8+c;
        if(!b[a]&&(!prises||promo))out.push(i|(a<<6)|promo);
        for(let dc=-1;dc<=1;dc+=2){
          const c2=c+dc; if(c2<0||c2>7)continue;
          const a2=r2*8+c2,q=b[a2];
          if(q&&(q>0)!==(s>0))out.push(i|(a2<<6)|promo);
        }
        continue;
      }
      if(t===RUA){
        for(const [dr,dc] of DROIT){
          let r2=r+dr,c2=c+dc;
          while(r2>=0&&r2<8&&c2>=0&&c2<8){
            const a=r2*8+c2,q=b[a];
            if(q){if((q>0)!==(s>0))out.push(i|(a<<6));break;}
            if(!prises)out.push(i|(a<<6));
            r2+=dr;c2+=dc;
          }
        }
        continue;
      }
      const dirs=t===MA?SAUTS:t===KHUN?TOUT:t===KHON?(s>0?KHON_BLANC:KHON_NOIR):DIAG;
      for(const [dr,dc] of dirs){
        const r2=r+dr,c2=c+dc; if(r2<0||r2>7||c2<0||c2>7)continue;
        const a=r2*8+c2,q=b[a];
        if(q&&(q>0)===(s>0))continue;
        if(prises&&!q)continue;
        out.push(i|(a<<6));
      }
    }
    return out;
  }
  /* La case i est-elle attaquee par le camp `par` ? */
  attaque(i,par){
    const b=this.b,r=i>>3,c=i&7;
    const at=(r2,c2)=>(r2<0||r2>7||c2<0||c2>7)?0:b[r2*8+c2]*par;
    for(const [dr,dc] of SAUTS)if(at(r+dr,c+dc)===MA)return true;
    for(const [dr,dc] of DIAG){const t=at(r+dr,c+dc);if(t===KHUN||t===MET||t===NGAI||t===KHON)return true;}
    for(const [dr,dc] of DROIT)if(at(r+dr,c+dc)===KHUN)return true;
    /* Khon qui avance droit devant, Bia qui prend en diagonale : tous deux
       viennent de la rangee d'ou le camp `par` avance vers i. */
    const der=par>0?1:-1;
    if(at(r+der,c)===KHON)return true;
    if(at(r+der,c-1)===BIA||at(r+der,c+1)===BIA)return true;
    for(const [dr,dc] of DROIT){
      let r2=r+dr,c2=c+dc;
      while(r2>=0&&r2<8&&c2>=0&&c2<8){
        const q=b[r2*8+c2];
        if(q){if(q*par===RUA)return true;break;}
        r2+=dr;c2+=dc;
      }
    }
    return false;
  }
  enEchec(cote){return this.attaque(this.rois[cote>0?0:1],-cote);}
  jouer(m){
    const de=m&63,a=(m>>6)&63,b=this.b,p=b[de],prise=b[a],s=this.trait;
    this.pile.push({m,prise,compte:this.compte,h:this.h});
    let h=this.h^zp(p,de);
    if(prise)h^=zp(prise,a);
    const np=(m&PROMO)?NGAI*s:p;
    b[a]=np;b[de]=0;h^=zp(np,a);
    if(p===KHUN*s)this.rois[s>0?0:1]=a;
    this.trait=-s;
    this.h=(h^Z_TRAIT)>>>0;
    this.vus.set(this.h,(this.vus.get(this.h)||0)+1);
    this.compte=this.compter(this.compte,!!prise||!!(m&PROMO),s);
  }
  annuler(){
    const u=this.pile.pop(); if(!u)return;
    const m=u.m,de=m&63,a=(m>>6)&63,b=this.b,s=-this.trait;
    const n=this.vus.get(this.h);
    if(n>1)this.vus.set(this.h,n-1);else this.vus.delete(this.h);
    const p=(m&PROMO)?BIA*s:b[a];
    b[de]=p;b[a]=u.prise;
    if(p===KHUN*s)this.rois[s>0?0:1]=de;
    this.trait=s;this.h=u.h;this.compte=u.compte;
  }
  coups(){
    const s=this.trait,out=[];
    for(const m of this.pseudo(false)){
      this.jouer(m);
      if(!this.enEchec(s))out.push(m);
      this.annuler();
    }
    return out;
  }
  aDesCoups(){
    const s=this.trait;
    for(const m of this.pseudo(false)){
      this.jouer(m);
      const ok=!this.enEchec(s);
      this.annuler();
      if(ok)return true;
    }
    return false;
  }
  depuisUci(u){return this.coups().find(m=>uci(m)===u)||0;}
  /* Fin de partie : null tant qu'elle continue, sinon {gagnant, raison},
     gagnant 1 (Blancs), -1 (Noirs) ou 0 (nulle). Le mat passe avant tout :
     mater au dernier coup permis par le comptage, c'est gagner. */
  fin(){
    if(!this.aDesCoups())
      return this.enEchec(this.trait)?{gagnant:-this.trait,raison:"mat"}:{gagnant:0,raison:"pat"};
    let seuls=true;
    for(let i=0;i<64;i++){const p=this.b[i];if(p&&p!==KHUN&&p!==-KHUN){seuls=false;break;}}
    if(seuls)return {gagnant:0,raison:"rois"};
    if(this.compte&&this.compte.reste<=0)return {gagnant:0,raison:"comptage"};
    if((this.vus.get(this.h)||0)>=3)return {gagnant:0,raison:"repetition"};
    return null;
  }
}

/* ---------- moteur ---------- */
const MAT=100000,INF=1e9;
/* Proximite du centre, de 0 (coin) a 6 (centre). */
const CENTRE=[];
for(let i=0;i<64;i++)CENTRE.push(7-(Math.abs(2*(i>>3)-7)+Math.abs(2*(i&7)-7))/2);
const distance=(a,b)=>Math.abs((a>>3)-(b>>3))+Math.abs((a&7)-(b&7));

/* Evaluation du point de vue des Blancs. Materiel, centre pour les pieces
   courtes, avance des Bia. En finale, le camp fort pousse le Khun adverse
   vers le bord et en rapproche le sien : sans cela le moteur promene ses
   pieces sans jamais mater et laisse filer le comptage. */
function evaluer(P){
  const b=P.b;
  let sc=0,matB=0,matN=0;
  for(let i=0;i<64;i++){
    const p=b[i]; if(!p)continue;
    const t=p<0?-p:p,s=p>0?1:-1;
    let v=VALEUR[t];
    if(t===BIA)v+=(s>0?5-(i>>3):(i>>3)-2)*10+CENTRE[i]*2;
    else if(t===MA||t===KHON||t===MET||t===NGAI)v+=CENTRE[i]*5;
    else if(t===RUA)v+=CENTRE[i];
    if(t!==KHUN){if(s>0)matB+=VALEUR[t];else matN+=VALEUR[t];}
    sc+=s*v;
  }
  const [kb,kn]=P.rois;
  if(matB+matN<=1400){
    const ecart=matB-matN;
    if(Math.abs(ecart)>=150){
      const fort=ecart>0?1:-1,kf=fort>0?kb:kn,kfa=fort>0?kn:kb;
      sc+=fort*((6-CENTRE[kfa])*14+(14-distance(kf,kfa))*5);
    } else {
      sc+=(CENTRE[kb]-CENTRE[kn])*4;
    }
  }
  return sc;
}

/* Niveaux : profondeur, temps (ms) et bruit (centiemes de Bia) ajoute aux
   notes des coups a la racine. Le bruit rend le niveau facile battable :
   il voit les prises, mais choisit souvent un coup moyen. */
const NIVEAUX=[
  {profondeur:1,temps:400,bruit:180},
  {profondeur:3,temps:1200,bruit:25},
  {profondeur:64,temps:2000,bruit:0}
];

function chercher(P,opt){
  const limite=Date.now()+opt.temps,bruit=opt.bruit||0;
  let noeuds=0,coupe=false;
  const tt=new Map(),tueurs=[];
  const horloge=()=>{if((++noeuds&1023)===0&&Date.now()>limite)coupe=true;return coupe;};
  const ordonner=(liste,premier,ply)=>{
    const b=P.b;
    return liste.map(m=>{
      let s=0;
      if(m===premier)s=1e6;
      else{
        const q=b[(m>>6)&63];
        if(q)s=1e5+VALEUR[q<0?-q:q]*10-VALEUR[Math.abs(b[m&63])];
        else if(m&PROMO)s=9e4;
        else if(tueurs[ply]===m)s=8e4;
      }
      return [s,m];
    }).sort((x,y)=>y[0]-x[0]).map(x=>x[1]);
  };
  function calme(alpha,beta,ply){
    if(horloge())return 0;
    const s=P.trait,debout=evaluer(P)*s;
    if(debout>=beta||ply>48)return debout;
    if(debout>alpha)alpha=debout;
    for(const m of ordonner(P.pseudo(true),0,ply)){
      P.jouer(m);
      if(P.enEchec(s)){P.annuler();continue;}
      const v=-calme(-beta,-alpha,ply+1);
      P.annuler();
      if(coupe)return 0;
      if(v>=beta)return v;
      if(v>alpha)alpha=v;
    }
    return alpha;
  }
  function ab(prof,alpha,beta,ply){
    const s=P.trait;
    if((P.vus.get(P.h)||0)>=2)return 0;
    if(P.compte&&P.compte.reste<=0)
      return P.aDesCoups()?0:(P.enEchec(s)?-MAT+ply:0);
    const echec=P.enEchec(s);
    if(echec)prof++;
    if(prof<=0)return calme(alpha,beta,ply);
    if(horloge())return 0;
    const e=tt.get(P.h);
    if(e&&e.p>=prof){
      if(e.f===0)return e.v;
      if(e.f===1&&e.v>=beta)return e.v;
      if(e.f===2&&e.v<=alpha)return e.v;
    }
    const a0=alpha;
    let meilleur=-INF,mm=0,legaux=0;
    for(const m of ordonner(P.pseudo(false),e?e.m:0,ply)){
      P.jouer(m);
      if(P.enEchec(s)){P.annuler();continue;}
      legaux++;
      const v=-ab(prof-1,-beta,-alpha,ply+1);
      P.annuler();
      if(coupe)return 0;
      if(v>meilleur){meilleur=v;mm=m;}
      if(v>alpha)alpha=v;
      if(alpha>=beta){if(!P.b[(m>>6)&63])tueurs[ply]=m;break;}
    }
    if(!legaux)return echec?-MAT+ply:0;
    if(tt.size>400000)tt.clear();
    tt.set(P.h,{p:prof,v:meilleur,f:meilleur<=a0?2:meilleur>=beta?1:0,m:mm});
    return meilleur;
  }
  const racine=P.coups();
  if(!racine.length)return 0;
  if(racine.length===1)return racine[0];
  let choisi=racine[0],notes=null;
  for(let prof=1;prof<=opt.profondeur;prof++){
    let alpha=-INF,meilleur=0,mv=-INF;
    const n=new Map();
    for(const m of ordonner(racine,choisi,0)){
      P.jouer(m);
      /* Avec du bruit, chaque coup de la racine a besoin de sa vraie note,
         pas d'une borne : fenetre pleine. */
      const v=-ab(prof-1,-INF,bruit?INF:-alpha,1);
      P.annuler();
      if(coupe)break;
      n.set(m,v);
      if(v>mv){mv=v;meilleur=m;}
      if(v>alpha)alpha=v;
    }
    if(coupe){if(!notes&&meilleur)choisi=meilleur;break;}
    choisi=meilleur;notes=n;
    if(mv>MAT-200)break;
  }
  if(bruit&&notes){
    let mieux=-INF;
    for(const [m,v] of notes){
      const w=v>MAT-200||v<-MAT+200?v:v+(Math.random()*2-1)*bruit;
      if(w>mieux){mieux=w;choisi=m;}
    }
  }
  return choisi;
}

/* ---------- Node (tests) ---------- */
if(typeof module!=="undefined"&&module.exports){
  module.exports={Partie,chercher,evaluer,NIVEAUX,DEPART,nomCase,caseDe,uci,limitePieces,PROMO};
  return;
}

/* ---------- Worker : la recherche hors de la page ---------- */
if(typeof document==="undefined"){
  self.onmessage=e=>{
    const d=e.data,P=new Partie();
    for(const u of d.coups){const m=P.depuisUci(u);if(m)P.jouer(m);}
    const m=chercher(P,NIVEAUX[d.niveau]||NIVEAUX[1]);
    self.postMessage({id:d.id,coup:m?uci(m):null});
  };
  return;
}

/* ---------- page : le mode Makruk ---------- */
const SCRIPT=document.currentScript&&document.currentScript.src;
const tr=(s,v)=>typeof t==="function"?t(s,v):s.replace(/\{(\w+)\}/g,(x,k)=>v&&k in v?v[k]:x);

/* Pieces dessinees dans le style du jeu d'echecs du site (maquette du
   2026-10-26) : carre de 45, socle pose sur y=38, contour #101413,
   remplissage craie ou ardoise, formes "fixe" a l'encre jamais recolorees.
   Le Ma reprend le cavalier du site tel quel. Ajoutees a PIECES pour que
   pieceSVG() (pieces_browser.js) les dessine comme les autres. */
const FORMES={
  k:[{d:"M12.9,32.5h19.2c1.32,0,2.4,1.08,2.4,2.4v3.1H10.5v-3.1c0-1.32,1.08-2.4,2.4-2.4Z"},
     {d:"M13,32.5c2.6-2,4.6-5.2,4.8-8.5h9.4c.2,3.3,2.2,6.5,4.8,8.5Z"},
     {d:"M20.4,13.2c.3-2.6,1.6-4.4,2.1-7.6.5,3.2,1.8,5,2.1,7.6Z"},
     {d:"M19.6,15.4l.6-2.2h4.6l.6,2.2Z"},
     {d:"M18.4,18l.7-2.6h6.8l.7,2.6Z"},
     {d:"M16.8,21l.8-3h9.8l.8,3Z"},
     {d:"M15.5,24c-1,0-1.6-.6-1.6-1.3s.9-1.7,2.2-1.7h12.8c1.3,0,2.2,1,2.2,1.7s-.6,1.3-1.6,1.3Z"},
     {d:"M21.4,5a1.1,1.1,0,1,0,2.2,0a1.1,1.1,0,1,0,-2.2,0Z"}],
  m:[{d:"M14.2,33h16.6c1.21,0,2.2.99,2.2,2.2v2.8H12v-2.8c0-1.21.99-2.2,2.2-2.2Z"},
     {d:"M14.5,33c2.3-1.9,4-4.7,4.2-7.5h7.6c.2,2.8,1.9,5.6,4.2,7.5Z"},
     {d:"M18.9,20c-.3-3.4,1.6-5.6,3.6-7.4,2,1.8,3.9,4,3.6,7.4Z"},
     {d:"M18,22.8l.7-2.8h7.6l.7,2.8Z"},
     {d:"M16.6,25.5c-.9,0-1.5-.55-1.5-1.2s.85-1.5,2-1.5h10.8c1.15,0,2,.85,2,1.5s-.6,1.2-1.5,1.2Z"},
     {d:"M21.5,11.6a1,1,0,1,0,2,0a1,1,0,1,0,-2,0Z"}],
  s:[{d:"M14.2,33h16.6c1.21,0,2.2.99,2.2,2.2v2.8H12v-2.8c0-1.21.99-2.2,2.2-2.2Z"},
     {d:"M14.6,33c2.6-2.1,4.4-5.2,4.6-8.3h6.6c.2,3.1,2,6.2,4.6,8.3Z"},
     {d:"M17.8,22.2c-1.4-3.6-.9-8.4,4.7-15.4,5.6,7,6.1,11.8,4.7,15.4Z"},
     {d:"M17,24.7c-.85,0-1.4-.5-1.4-1.15s.8-1.35,1.9-1.35h10c1.1,0,1.9.7,1.9,1.35s-.55,1.15-1.4,1.15Z"},
     {d:"M22.5,11.6c.7,2.4.7,5.6,0,8.4-.7-2.8-.7-6,0-8.4Z",fixe:true}],
  r:[{d:"M13.4,33h18.2c1.33,0,2.4,1.07,2.4,2.4v2.6H11v-2.6c0-1.33,1.07-2.4,2.4-2.4Z"},
     {d:"M13.9,33c1.8-1.4,2.4-3.6,2.6-6.4l.4-12.1h11.2l.4,12.1c.2,2.8.8,5,2.6,6.4Z"},
     {d:"M16.4,14.5c-.9,0-1.4-.6-1.4-1.4v-1.2c0-.8.6-1.4,1.4-1.4h12.2c.8,0,1.4.6,1.4,1.4v1.2c0,.8-.5,1.4-1.4,1.4Z"},
     {d:"M18.5,10.5l.5-2.2c.1-.4.4-.6.8-.6h5.4c.4,0,.7.2.8.6l.5,2.2Z"}],
  p:[{d:"M14.31,33.79h16.38c1.14,0,2.07.93,2.07,2.07v2.14H12.24v-2.14c0-1.14.93-2.07,2.07-2.07Z"},
     {d:"M14.4,33.79c-.5-7.6,3.4-13.4,8.1-13.4s8.6,5.8,8.1,13.4Z"}],
  f:[{d:"M14.31,33.79h16.38c1.14,0,2.07.93,2.07,2.07v2.14H12.24v-2.14c0-1.14.93-2.07,2.07-2.07Z"},
     {d:"M14.4,33.79c-.5-7.6,3.4-13.4,7.3-13.4l.8,2.4.8-2.4c3.9,0,7.8,5.8,7.3,13.4Z"},
     {d:"M22.5,24.2c1,2.6,1,5.9,0,8.6-1-2.7-1-6,0-8.6Z",fixe:true}]
};
for(const k in FORMES)PIECES["mk_"+k]=FORMES[k].map(f=>({t:"path",d:f.d,fixe:!!f.fixe}));
const dessinPiece=p=>{
  const l=LETTRE[p<0?-p:p];
  return pieceSVG(l==="n"?"n":"mk_"+l,p>0?"w":"b");
};
/* Noms des pieces pour les lecteurs d'ecran, par camp : une seule phrase a
   traduire par piece, sans accord a construire. */
const NOMS={
  1:["White bia","Black bia"],2:["White ma","Black ma"],3:["White khon","Black khon"],
  4:["White rua","Black rua"],5:["White met","Black met"],6:["White khun","Black khun"],
  7:["White bia ngai","Black bia ngai"]
};

const STYLE=`
.mk{position:fixed;inset:0;z-index:200;background:rgba(10,14,13,.78);overflow-y:auto;
  padding:16px;box-sizing:border-box;display:flex;justify-content:center;align-items:flex-start}
.mk[hidden],.mk [hidden]{display:none}
.mk-panneau{width:100%;max-width:520px;margin:auto 0;display:flex;flex-direction:column;gap:12px;
  background-color:var(--slate);border:1px solid var(--rule);border-radius:var(--r);padding:16px;
  box-sizing:border-box;box-shadow:var(--e2);color:var(--chalk)}
.mk-tete{display:flex;align-items:baseline;gap:10px}
.mk-tete h2{margin:0;font-size:22px}
.mk-thai{color:var(--sage);font-size:16px}
.mk-fermer{margin-left:auto;align-self:center;font:inherit;font-size:22px;line-height:1;width:44px;height:44px;
  border-radius:8px;border:1px solid var(--rule);background-color:var(--raise);color:var(--chalk);cursor:pointer}
.mk-fermer:focus-visible{outline:2px solid var(--brass);outline-offset:2px}
.mk .chips{margin-bottom:0}
.mk .chip{padding:8px 12px;font-size:12.5px}
.mk-etat{margin:0;min-height:1.4em;font-weight:600}
.mk-compte{margin:-6px 0 0;font-size:13px;color:var(--sage);min-height:1.2em}
.mk .board-frame{padding:8px}
.mk-actions{display:flex;flex-wrap:wrap;gap:8px}
.mk details{border-top:1px solid var(--rule);padding-top:10px;font-size:14px;line-height:1.5;color:var(--sage)}
.mk summary{cursor:pointer;color:var(--chalk);font-weight:600}
.mk details p{margin:8px 0 0}
.mk details ul{margin:8px 0 0;padding-left:18px}
.mk details li{margin:4px 0}
.mk details strong{color:var(--chalk)}
/* Petite piece blanche a cote de chaque nom de la fiche. La boite ne fait
   qu'une ligne de haut et la piece en deborde, centree : l'interligne de la
   fiche ne bouge pas (21 px avec ou sans piece). max-height:none, parce
   qu'une regle generale du site borne les svg a leur boite. */
.mk-icone{display:inline-block;position:relative;width:1.9em;height:1em;vertical-align:-.15em}
.mk-icone svg{position:absolute;left:0;top:50%;width:1.9em;height:1.9em;max-width:none;max-height:none;transform:translateY(-55%)}
html.mk-ouvert{overflow:hidden}
.mk-compte:empty{display:none}
/* Telephone : les marges du voile, du panneau et du cadre s'additionnaient
   (le plateau ne faisait que 291 px sur 375). On les resserre pour rendre
   la place au plateau. */
@media(max-width:480px){
  .mk{padding:8px}
  .mk-panneau{padding:12px;gap:10px}
  .mk .board-frame{padding:4px}
  .mk .chip{padding:7px 10px}
}
`;

let racine=null,plateau=null,P=null,legaux=[],sel=-1,dernier=0,fini=null;
let mode="ordi",niveau=1,camp=1,attente=false,demande=0,focale=-1,porte=null,moteur=null,enCours=null;

function construire(){
  const st=document.createElement("style");
  st.textContent=STYLE;
  document.head.appendChild(st);
  racine=document.createElement("div");
  racine.className="mk";racine.id="makruk";racine.hidden=true;
  racine.setAttribute("role","dialog");racine.setAttribute("aria-modal","true");
  racine.setAttribute("aria-labelledby","mkTitre");
  const regles=[
    ["Khun","moves one square in any direction, like the king.",KHUN],
    ["Met","moves one square diagonally.",MET],
    ["Khon","moves one square diagonally or one square straight forward.",KHON],
    ["Ma","moves like the knight.",MA],
    ["Rua","moves like the rook.",RUA],
    ["Bia","moves one square forward and captures one square diagonally forward, never two squares at once. On the sixth rank it turns over and becomes a bia ngai, which moves like the met.",BIA],
    /* Ligne a part (2026-11-07) pour montrer la piece retournee, qu'on ne
       voyait qu'apres une promotion. Meme phrase que le Met. */
    ["Bia ngai","moves one square diagonally.",NGAI]
  ];
  poserHtml(racine,
    '<div class="mk-panneau">'+
      '<div class="mk-tete"><h2 id="mkTitre">Makruk</h2><span class="mk-thai" lang="th">หมากรุก</span>'+
        '<button type="button" class="mk-fermer" id="mkFermer" aria-label="'+echappe(tr("Back to chess"))+'">×</button></div>'+
      '<div class="chips" role="group" aria-label="'+echappe(tr("Opponent"))+'">'+
        '<button type="button" class="chip" data-mode="ordi">'+echappe(tr("Against the computer"))+'</button>'+
        '<button type="button" class="chip" data-mode="deux">'+echappe(tr("Two players"))+'</button></div>'+
      '<div class="chips" id="mkOptions">'+
        '<span class="chips" role="group" aria-label="'+echappe(tr("Level"))+'">'+
          ["Easy","Medium","Hard"].map((n,i)=>'<button type="button" class="chip" data-niveau="'+i+'">'+echappe(tr(n))+"</button>").join("")+"</span>"+
        '<span class="chips" role="group" aria-label="'+echappe(tr("Your side"))+'">'+
          '<button type="button" class="chip" data-camp="1">'+echappe(tr("White"))+'</button>'+
          '<button type="button" class="chip" data-camp="-1">'+echappe(tr("Black"))+"</button></span></div>"+
      '<p class="mk-etat" id="mkEtat" aria-live="polite"></p>'+
      '<p class="mk-compte" id="mkCompte"></p>'+
      '<div class="board-frame"><div class="board" id="mkPlateau" role="group" aria-label="'+echappe(tr("Makruk board"))+'"></div></div>'+
      '<div class="mk-actions"><button type="button" class="btn primary" id="mkNouvelle">'+echappe(tr("New game"))+'</button>'+
        '<button type="button" class="btn" id="mkAnnuler">'+echappe(tr("Take back"))+"</button></div>"+
      "<details><summary>"+echappe(tr("Rules of makruk"))+"</summary>"+
        "<p>"+echappe(tr("Makruk is the chess of Thailand, a descendant of chaturanga. White moves first. The goal is the same: checkmate the khun."))+"</p>"+
        "<ul>"+regles.map(([n,r,p])=>'<li><strong>'+echappe(tr(n))+'</strong> <span class="mk-icone">'+dessinPiece(p)+"</span> "+echappe(tr(r))+"</li>").join("")+"</ul>"+
        "<p>"+echappe(tr("No castling, no en passant. Stalemate is a draw."))+"</p>"+
        "<p>"+echappe(tr("Counting: once no unpromoted bia is left, the stronger side has 64 moves to checkmate. When one side has only its khun left, the limit depends on the stronger side's pieces: 8 with two rua, 16 with one, 22 with two khon, 44 with one, 32 with two ma, 64 otherwise, minus the number of pieces on the board. Without checkmate in time, the game is drawn."))+"</p>"+
      "</details>"+
    "</div>");
  document.body.appendChild(racine);
  plateau=racine.querySelector("#mkPlateau");
  for(let d=0;d<64;d++){
    const c=document.createElement("div");
    c.setAttribute("role","button");
    c.dataset.d=String(d);
    plateau.appendChild(c);
  }
  plateau.addEventListener("click",e=>{
    const c=e.target.closest("[data-d]"); if(!c)return;
    const d=+c.dataset.d;focale=d;toucher(versCase(d));
  });
  plateau.addEventListener("keydown",e=>{
    const c=e.target.closest("[data-d]"); if(!c)return;
    let d=+c.dataset.d;
    const pas={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[e.key];
    if(pas){
      e.preventDefault();
      const r=(d>>3)+(pas===-8?-1:pas===8?1:0),f=(d&7)+(pas===-1?-1:pas===1?1:0);
      if(r<0||r>7||f<0||f>7)return;
      focale=r*8+f;dessiner();plateau.children[focale].focus();
    } else if(e.key==="Enter"||e.key===" "){
      e.preventDefault();focale=d;toucher(versCase(d));
      const el=plateau.children[focale];if(el)el.focus();
    }
  });
  racine.querySelector("#mkFermer").addEventListener("click",fermer);
  racine.addEventListener("keydown",e=>{
    if(e.key==="Escape"){e.preventDefault();fermer();return;}
    if(e.key!=="Tab")return;
    /* Fenetre modale : la tabulation tourne dans le panneau. */
    const f=[...racine.querySelectorAll("button:not([disabled]),summary,[tabindex='0']")].filter(x=>x.offsetParent!==null||x===document.activeElement);
    if(!f.length)return;
    if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f[f.length-1].focus();}
    else if(!e.shiftKey&&document.activeElement===f[f.length-1]){e.preventDefault();f[0].focus();}
  });
  racine.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>{mode=b.dataset.mode;nouvelle();}));
  racine.querySelectorAll("[data-niveau]").forEach(b=>b.addEventListener("click",()=>{niveau=+b.dataset.niveau;nouvelle();}));
  racine.querySelectorAll("[data-camp]").forEach(b=>b.addEventListener("click",()=>{camp=+b.dataset.camp;nouvelle();}));
  racine.querySelector("#mkNouvelle").addEventListener("click",nouvelle);
  racine.querySelector("#mkAnnuler").addEventListener("click",reprendre);
  try{if(SCRIPT&&typeof Worker==="function"){moteur=new Worker(SCRIPT);moteur.onmessage=recu;moteur.onerror=()=>{moteur=null;};}}catch(e){moteur=null;}
}

/* Contre l'ordinateur avec les Noirs, le plateau se retourne. */
const retourne=()=>mode==="ordi"&&camp<0;
const versCase=d=>retourne()?63-d:d;

function nouvelle(){
  demande++;attente=false;
  P=new Partie();sel=-1;dernier=0;fini=null;legaux=P.coups();
  if(focale<0)focale=52;
  dessiner();
  if(mode==="ordi"&&P.trait!==camp)lancerOrdi();
}
function reprendre(){
  if(!P.pile.length)return;
  demande++;attente=false;
  P.annuler();
  if(mode==="ordi"&&P.trait!==camp&&P.pile.length)P.annuler();
  sel=-1;fini=null;legaux=P.coups();
  dernier=P.pile.length?P.pile[P.pile.length-1].m:0;
  dessiner();
  if(mode==="ordi"&&P.trait!==camp)lancerOrdi();
}
function toucher(i){
  if(fini||attente)return;
  if(mode==="ordi"&&P.trait!==camp)return;
  if(sel>=0){
    const m=legaux.find(m=>(m&63)===sel&&((m>>6)&63)===i);
    if(m){jouerCoup(m);return;}
  }
  const p=P.b[i];
  sel=(p&&(p>0)===(P.trait>0)&&sel!==i)?i:-1;
  dessiner();
}
function jouerCoup(m){
  P.jouer(m);dernier=m;sel=-1;
  legaux=P.coups();fini=P.fin();
  dessiner();
  if(!fini&&mode==="ordi"&&P.trait!==camp)lancerOrdi();
}
function lancerOrdi(){
  attente=true;
  const id=++demande,debut=Date.now();
  dessiner();
  const appliquer=u=>{
    /* Un coup instantane se lit mal : on laisse au moins 400 ms entre le
       coup de la personne et celui de l'ordinateur. */
    setTimeout(()=>{
      if(id!==demande)return;
      attente=false;
      const m=u&&P.depuisUci(u);
      if(m)jouerCoup(m);else dessiner();
    },Math.max(0,400-(Date.now()-debut)));
  };
  enCours=appliquer;
  const coups=P.pile.map(x=>uci(x.m));
  if(moteur)moteur.postMessage({id,coups,niveau});
  else setTimeout(()=>{if(id!==demande)return;const m=chercher(P,NIVEAUX[niveau]);appliquer(m?uci(m):null);},20);
}
function recu(e){
  if(!e.data||e.data.id!==demande||!enCours)return;
  enCours(e.data.coup);
}

function texteEtat(){
  if(fini){
    const g=fini.gagnant;
    if(fini.raison==="mat"){
      if(mode==="ordi")return tr(g===camp?"Checkmate. You win.":"Checkmate. The computer wins.");
      return tr(g>0?"Checkmate, White wins.":"Checkmate, Black wins.");
    }
    return tr({pat:"Stalemate. The game is drawn.",comptage:"Draw by counting: no checkmate in time.",
      repetition:"Draw by repetition.",rois:"Draw: only the two khun are left."}[fini.raison]);
  }
  let s;
  if(mode==="ordi")s=attente?tr("The computer is thinking…"):tr("Your move.");
  else s=tr(P.trait>0?"White to move.":"Black to move.");
  if(P.enEchec(P.trait))s+=" "+tr("Check!");
  return s;
}
function texteCompte(){
  const c=P.compte; if(!c||fini)return "";
  const genre=tr(c.genre==="plateau"?"Board's honour count":"Pieces' honour count");
  return genre+" · "+tr(c.fort>0?"White must checkmate. Moves left: {n}":"Black must checkmate. Moves left: {n}",{n:c.reste});
}
function dessiner(){
  if(!racine)return;
  racine.querySelectorAll("[data-mode]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.mode===mode)));
  racine.querySelectorAll("[data-niveau]").forEach(b=>b.setAttribute("aria-pressed",String(+b.dataset.niveau===niveau)));
  racine.querySelectorAll("[data-camp]").forEach(b=>b.setAttribute("aria-pressed",String(+b.dataset.camp===camp)));
  racine.querySelector("#mkOptions").hidden=mode!=="ordi";
  racine.querySelector("#mkEtat").textContent=texteEtat();
  racine.querySelector("#mkCompte").textContent=texteCompte();
  racine.querySelector("#mkAnnuler").disabled=!P.pile.length;
  const cibles=new Set(sel>=0?legaux.filter(m=>(m&63)===sel).map(m=>(m>>6)&63):[]);
  const echec=P.enEchec(P.trait)?P.rois[P.trait>0?0:1]:-1;
  const der=dernier?[dernier&63,(dernier>>6)&63]:[];
  for(let d=0;d<64;d++){
    const i=versCase(d),r=d>>3,f=d&7,p=P.b[i];
    const el=plateau.children[d];
    let cls="sq "+(((r+f)%2===1)?"d":"l");
    if(der.includes(i))cls+=" last";
    if(i===sel)cls+=" sel";
    if(i===echec)cls+=" check";
    el.className=cls;
    let h=p?'<span class="piece">'+dessinPiece(p)+"</span>":"";
    if(cibles.has(i))h+=p?'<span class="ring"></span>':'<span class="dot"></span>';
    const nom=nomCase(i);
    if(r===7)h+='<span class="co f" aria-hidden="true">'+nom[0]+"</span>";
    if(f===0)h+='<span class="co r" aria-hidden="true">'+nom[1]+"</span>";
    poserHtml(el,h);
    el.tabIndex=d===focale?0:-1;
    el.setAttribute("aria-label",nom+(p?", "+tr(NOMS[p<0?-p:p][p>0?0:1]):""));
  }
}

function ouvrir(depuis){
  porte=depuis||document.activeElement;
  if(!racine){construire();nouvelle();}
  racine.hidden=false;
  document.documentElement.classList.add("mk-ouvert");
  racine.querySelector("#mkFermer").focus();
}
function fermer(){
  if(!racine)return;
  racine.hidden=true;
  document.documentElement.classList.remove("mk-ouvert");
  if(porte&&porte.focus)porte.focus();
}
window.ouvrirMakruk=ouvrir;
})();
