const W=0,B=1,P=1,N=2,BI=3,R=4,Q=5,K=6;
const OFF_N=[-33,-31,-18,-14,14,18,31,33];
const OFF_B=[-17,-15,15,17];
const OFF_R=[-16,-1,1,16];
const OFF_K=[-17,-16,-15,-1,1,15,16,17];
const CWK=1,CWQ=2,CBK=4,CBQ=8;
const SYM={1:"p",2:"n",3:"b",4:"r",5:"q",6:"k"};
const FSYM={p:1,n:2,b:3,r:4,q:5,k:6};
const mk=(t,c)=>t|(c<<3), pT=p=>p&7, pC=p=>p>>3;
const onB=s=>(s&0x88)===0, fOf=s=>s&7, rOf=s=>s>>4;
const sqN=s=>"abcdefgh"[fOf(s)]+(8-rOf(s));
const nSq=s=>(8-parseInt(s[1],10))*16+"abcdefgh".indexOf(s[0]);

class Game{
  constructor(fen){this.load(fen||"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");}
  load(fen){
    this.board=new Int8Array(128);this.kingSq=[-1,-1];this.history=[];this.posCounts=new Map();
    const p=fen.trim().split(/\s+/);let sq=0;
    for(const ch of p[0]){
      if(ch==="/"){sq=(sq+16)&~15;continue;}
      if(ch>="1"&&ch<="8"){sq+=+ch;continue;}
      const c=ch===ch.toUpperCase()?W:B,t=FSYM[ch.toLowerCase()];
      this.board[sq]=mk(t,c); if(t===K)this.kingSq[c]=sq; sq++;
    }
    this.turn=p[1]==="b"?B:W;this.castling=0;
    if(p[2]&&p[2]!=="-"){if(p[2].includes("K"))this.castling|=CWK;if(p[2].includes("Q"))this.castling|=CWQ;
      if(p[2].includes("k"))this.castling|=CBK;if(p[2].includes("q"))this.castling|=CBQ;}
    this.ep=p[3]&&p[3]!=="-"?nSq(p[3]):-1;
    this.half=p[4]?+p[4]:0;this.full=p[5]?+p[5]:1;this.bump(1);
  }
  fen(){
    let s="";
    for(let r=0;r<8;r++){let e=0;
      for(let f=0;f<8;f++){const p=this.board[r*16+f];
        if(!p){e++;continue;} if(e){s+=e;e=0;}
        const y=SYM[pT(p)];s+=pC(p)===W?y.toUpperCase():y;}
      if(e)s+=e; if(r<7)s+="/";}
    let c="";
    if(this.castling&CWK)c+="K";if(this.castling&CWQ)c+="Q";
    if(this.castling&CBK)c+="k";if(this.castling&CBQ)c+="q";
    return s+" "+(this.turn===W?"w":"b")+" "+(c||"-")+" "+(this.ep>=0?sqN(this.ep):"-")+" "+this.half+" "+this.full;
  }
  posKey(){return this.fen().split(" ").slice(0,4).join(" ");}
  bump(d){const k=this.posKey(),v=(this.posCounts.get(k)||0)+d; if(v<=0)this.posCounts.delete(k);else this.posCounts.set(k,v);}
  attacked(sq,by){
    const dir=by===W?16:-16;
    for(const d of [dir-1,dir+1]){const s=sq+d;
      if(onB(s)){const p=this.board[s];if(p&&pC(p)===by&&pT(p)===P)return true;}}
    for(const d of OFF_N){const s=sq+d;
      if(onB(s)){const p=this.board[s];if(p&&pC(p)===by&&pT(p)===N)return true;}}
    for(const d of OFF_K){const s=sq+d;
      if(onB(s)){const p=this.board[s];if(p&&pC(p)===by&&pT(p)===K)return true;}}
    for(const d of OFF_B){let s=sq+d;
      while(onB(s)){const p=this.board[s];
        if(p){if(pC(p)===by&&(pT(p)===BI||pT(p)===Q))return true;break;} s+=d;}}
    for(const d of OFF_R){let s=sq+d;
      while(onB(s)){const p=this.board[s];
        if(p){if(pC(p)===by&&(pT(p)===R||pT(p)===Q))return true;break;} s+=d;}}
    return false;
  }
  inCheck(c){const x=c===undefined?this.turn:c;return this.attacked(this.kingSq[x],x^1);}
  pseudo(capsOnly){
    const us=this.turn,them=us^1,out=[];
    const add=(from,to,flags,promo,cap)=>out.push({from,to,flags:flags||0,promo:promo||0,captured:cap||0,piece:this.board[from]});
    for(let sq=0;sq<128;sq++){
      if(sq&0x88){sq+=7;continue;}
      const p=this.board[sq]; if(!p||pC(p)!==us)continue;
      const t=pT(p);
      if(t===P){
        const fwd=us===W?-16:16,sr=us===W?6:1,pr=us===W?0:7,one=sq+fwd;
        if(!capsOnly&&onB(one)&&!this.board[one]){
          if(rOf(one)===pr){for(const x of [Q,R,BI,N])add(sq,one,8,x,0);}
          else{add(sq,one,0,0,0);const two=sq+fwd*2;
            if(rOf(sq)===sr&&!this.board[two])add(sq,two,2,0,0);}
        }
        for(const d of [fwd-1,fwd+1]){const to=sq+d; if(!onB(to))continue;
          const c=this.board[to];
          if(c&&pC(c)===them){
            if(rOf(to)===pr){for(const x of [Q,R,BI,N])add(sq,to,12,x,c);} else add(sq,to,4,0,c);
          } else if(!c&&to===this.ep) add(sq,to,20,0,mk(P,them));
        }
      } else if(t===N||t===K){
        for(const d of (t===N?OFF_N:OFF_K)){const to=sq+d; if(!onB(to))continue;
          const c=this.board[to];
          if(c){if(pC(c)===them)add(sq,to,4,0,c);} else if(!capsOnly)add(sq,to,0,0,0);}
      } else {
        for(const d of (t===BI?OFF_B:t===R?OFF_R:OFF_K)){let to=sq+d;
          while(onB(to)){const c=this.board[to];
            if(c){if(pC(c)===them)add(sq,to,4,0,c);break;}
            if(!capsOnly)add(sq,to,0,0,0); to+=d;}}
      }
    }
    if(!capsOnly){
      const t2=them;
      if(us===W){
        if((this.castling&CWK)&&!this.board[117]&&!this.board[118]&&!this.attacked(116,t2)&&!this.attacked(117,t2)&&!this.attacked(118,t2))add(116,118,32,0,0);
        if((this.castling&CWQ)&&!this.board[115]&&!this.board[114]&&!this.board[113]&&!this.attacked(116,t2)&&!this.attacked(115,t2)&&!this.attacked(114,t2))add(116,114,64,0,0);
      } else {
        if((this.castling&CBK)&&!this.board[5]&&!this.board[6]&&!this.attacked(4,t2)&&!this.attacked(5,t2)&&!this.attacked(6,t2))add(4,6,32,0,0);
        if((this.castling&CBQ)&&!this.board[3]&&!this.board[2]&&!this.board[1]&&!this.attacked(4,t2)&&!this.attacked(3,t2)&&!this.attacked(2,t2))add(4,2,64,0,0);
      }
    }
    return out;
  }
  moves(capsOnly){
    const res=[];
    for(const m of this.pseudo(capsOnly)){
      this.makeMove(m);
      if(!this.attacked(this.kingSq[this.turn^1],this.turn))res.push(m);
      this.undoMove();
    }
    return res;
  }
  makeMove(m){
    const us=this.turn;
    this.history.push({m,castling:this.castling,ep:this.ep,half:this.half,full:this.full,kw:this.kingSq[0],kb:this.kingSq[1]});
    this.bump(-1);
    const pc=this.board[m.from];
    this.board[m.from]=0;
    this.board[m.to]=m.promo?mk(m.promo,us):pc;
    if(m.flags&16)this.board[m.to+(us===W?16:-16)]=0;
    if(m.flags&32){const rf=us===W?119:7,rt=us===W?117:5;this.board[rt]=this.board[rf];this.board[rf]=0;}
    if(m.flags&64){const rf=us===W?112:0,rt=us===W?115:3;this.board[rt]=this.board[rf];this.board[rf]=0;}
    if(pT(pc)===K){this.kingSq[us]=m.to;this.castling&=us===W?~(CWK|CWQ):~(CBK|CBQ);}
    if(m.from===119||m.to===119)this.castling&=~CWK;
    if(m.from===112||m.to===112)this.castling&=~CWQ;
    if(m.from===7||m.to===7)this.castling&=~CBK;
    if(m.from===0||m.to===0)this.castling&=~CBQ;
    this.ep=(m.flags&2)?m.from+(us===W?-16:16):-1;
    this.half=(m.captured||pT(pc)===P)?0:this.half+1;
    if(us===B)this.full++;
    this.turn=us^1;
    this.bump(1);
  }
  undoMove(){
    const h=this.history.pop(); if(!h)return;
    this.bump(-1);
    const m=h.m,us=this.turn^1;
    this.board[m.from]=m.promo?mk(P,us):this.board[m.to];
    this.board[m.to]=0;
    if(m.flags&16)this.board[m.to+(us===W?16:-16)]=m.captured;
    else if(m.captured)this.board[m.to]=m.captured;
    if(m.flags&32){const rf=us===W?119:7,rt=us===W?117:5;this.board[rf]=this.board[rt];this.board[rt]=0;}
    if(m.flags&64){const rf=us===W?112:0,rt=us===W?115:3;this.board[rf]=this.board[rt];this.board[rt]=0;}
    this.castling=h.castling;this.ep=h.ep;this.half=h.half;this.full=h.full;
    this.kingSq[0]=h.kw;this.kingSq[1]=h.kb;this.turn=us;this.bump(1);
  }
  san(m){
    const legal=this.moves();let s;
    if(m.flags&32)s="O-O";
    else if(m.flags&64)s="O-O-O";
    else{
      const t=pT(m.piece);
      if(t===P){
        s=(m.flags&4)?"abcdefgh"[fOf(m.from)]+"x"+sqN(m.to):sqN(m.to);
        if(m.promo)s+="="+SYM[m.promo].toUpperCase();
      } else {
        let dis="";
        const same=legal.filter(x=>x.to===m.to&&x.from!==m.from&&pT(x.piece)===t);
        if(same.length){
          const sf=same.some(x=>fOf(x.from)===fOf(m.from)), sr=same.some(x=>rOf(x.from)===rOf(m.from));
          dis=!sf?"abcdefgh"[fOf(m.from)]:!sr?String(8-rOf(m.from)):sqN(m.from);
        }
        s=SYM[t].toUpperCase()+dis+((m.flags&4)?"x":"")+sqN(m.to);
      }
    }
    this.makeMove(m);
    if(this.inCheck())s+=this.moves().length===0?"#":"+";
    this.undoMove();
    return s;
  }
  uci(m){return sqN(m.from)+sqN(m.to)+(m.promo?SYM[m.promo]:"");}
  isCheckmate(){return this.inCheck()&&this.moves().length===0;}
  isStalemate(){return !this.inCheck()&&this.moves().length===0;}
  isInsufficient(){
    const ps=[];
    for(let sq=0;sq<128;sq++){if(sq&0x88){sq+=7;continue;}
      const p=this.board[sq]; if(p&&pT(p)!==K)ps.push([pT(p),(fOf(sq)+rOf(sq))&1]);}
    if(ps.length===0)return true;
    if(ps.length===1&&(ps[0][0]===N||ps[0][0]===BI))return true;
    if(ps.length===2&&ps.every(x=>x[0]===BI)&&ps[0][1]===ps[1][1])return true;
    return false;
  }
  isRepetition(){return (this.posCounts.get(this.posKey())||0)>=3;}
  isDraw(){return this.isStalemate()||this.isInsufficient()||this.half>=100||this.isRepetition();}
}

/* ==========================================================
   2. ÉVALUATION ET RECHERCHE
   ========================================================== */
const VAL={1:100,2:320,3:330,4:500,5:900,6:20000};
const PST={
1:[0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0],
2:[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
3:[-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20],
4:[0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0],
5:[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
6:[-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20],
61:[-50,-40,-30,-20,-20,-30,-40,-50,-30,-20,-10,0,0,-10,-20,-30,-30,-10,20,30,30,20,-10,-30,-30,-10,30,40,40,30,-10,-30,-30,-10,30,40,40,30,-10,-30,-30,-10,20,30,30,20,-10,-30,-30,-30,0,0,0,0,-30,-30,-50,-30,-30,-30,-30,-30,-30,-50]};
const MATE=100000;

function evaluate(g){
  let score=0,phase=0;const list=[];
  for(let sq=0;sq<128;sq++){
    if(sq&0x88){sq+=7;continue;}
    const p=g.board[sq]; if(!p)continue;
    const t=pT(p),c=pC(p);
    if(t!==P&&t!==K)phase+=VAL[t];
    list.push([sq,t,c]);
  }
  const end=phase<1800;
  for(const [sq,t,c] of list){
    const idx=c===W?rOf(sq)*8+fOf(sq):(7-rOf(sq))*8+fOf(sq);
    const v=VAL[t]+((t===K&&end)?PST[61][idx]:PST[t][idx]);
    score+=c===W?v:-v;
  }
  return g.turn===W?score:-score;
}
function materialSTM(g){
  let s=0;
  for(let sq=0;sq<128;sq++){if(sq&0x88){sq+=7;continue;}
    const p=g.board[sq]; if(!p)continue; const t=pT(p); if(t===K)continue;
    s+=pC(p)===W?VAL[t]:-VAL[t];}
  return g.turn===W?s:-s;
}
function search(g,maxDepth,timeMs){
  const t0=Date.now();let best=null,bestScore=0,stop=false;
  function order(ms,pv){
    for(const m of ms){
      let s=0;
      if(pv&&m.from===pv.from&&m.to===pv.to&&m.promo===pv.promo)s=1e7;
      else if(m.captured)s=1e6+VAL[pT(m.captured)]*10-VAL[pT(m.piece)];
      if(m.promo)s+=VAL[m.promo];
      m._s=s;
    }
    ms.sort((a,b)=>b._s-a._s);return ms;
  }
  function quiesce(a,b,ply){
    const st=evaluate(g);
    if(st>=b)return b; if(st>a)a=st;
    if(ply>8)return a;
    for(const m of order(g.moves(true),null)){
      g.makeMove(m);const sc=-quiesce(-b,-a,ply+1);g.undoMove();
      if(sc>=b)return b; if(sc>a)a=sc;
    }
    return a;
  }
  function ab(depth,a,b,ply,pv){
    if((Date.now()-t0)>timeMs){stop=true;return a;}
    if(ply>0&&(g.isRepetition()||g.half>=100||g.isInsufficient()))return 0;
    const ms=g.moves();
    if(!ms.length)return g.inCheck()?-MATE+ply:0;
    if(depth<=0)return quiesce(a,b,ply);
    order(ms,pv);
    for(const m of ms){
      g.makeMove(m);
      const ext=g.inCheck()?1:0;
      const sc=-ab(depth-1+ext,-b,-a,ply+1,null);
      g.undoMove();
      if(stop)return a;
      if(sc>a){a=sc; if(ply===0){best=m;bestScore=sc;}}
      if(a>=b)break;
    }
    if(ply===0&&!best&&ms.length)best=ms[0];
    return a;
  }
  let pv=null;
  for(let d=1;d<=maxDepth;d++){
    const pb=best,ps=bestScore;
    ab(d,-Infinity,Infinity,0,pv);
    if(stop){if(pb){best=pb;bestScore=ps;}break;}
    pv=best;
    if(Math.abs(bestScore)>MATE-100)break;
  }
  return {move:best,score:bestScore};
}
/* mats forcés : utilisé pour valider les exercices en direct */
function forcesMateIn(g,n){
  if(n<=0)return false;
  for(const m of g.moves()){
    g.makeMove(m);
    const rep=g.moves();
    let ok;
    if(!rep.length)ok=g.inCheck();
    else if(n===1)ok=false;
    else{
      ok=true;
      for(const r of rep){g.makeMove(r);const s=forcesMateIn(g,n-1);g.undoMove();if(!s){ok=false;break;}}
    }
    g.undoMove();
    if(ok)return true;
  }
  return false;
}
function matingMoves(g,n){
  const out=[];
  for(const m of g.moves()){
    g.makeMove(m);
    const rep=g.moves();
    let ok;
    if(!rep.length)ok=g.inCheck();
    else if(n===1)ok=false;
    else{
      ok=true;
      for(const r of rep){g.makeMove(r);const s=forcesMateIn(g,n-1);g.undoMove();if(!s){ok=false;break;}}
    }
    g.undoMove();
    if(ok)out.push(m);
  }
  return out;
}