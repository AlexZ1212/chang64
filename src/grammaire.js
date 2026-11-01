/* ==========================================================
   0b. GRAMMAIRE DES PIECES (2026-10-25)
   ========================================================== */
/* Les phrases d'explication citent des pieces : "le cavalier en e4", "the
   knight on e4". Un dictionnaire a cle unique ne suffit pas a les traduire :
   en francais, en espagnol et en portugais la dame et la tour sont
   feminines ; en allemand l'article se decline (der, den, dem) ; en russe
   le nom lui-meme change de forme (ладья, ладью, ладьи). Ce module construit
   donc le groupe nominal complet, dans chaque langue, avec ses cas et son
   genre, et les gabarits de t() choisissent la forme voulue ({x:acc},
   {x?masculin|feminin}, voir rendreGabarit dans i18n.js).
   Il sert aussi aux pages statiques (content.js), d'ou l'export Node en fin
   de fichier. Toutes les langues sont la, dans chaque page : le tout pese
   environ 3 Ko, et garder un seul script identique partout evite de
   multiplier les empreintes de la CSP. */
const GRAMMAIRE=(function(){
  /* Cas fournis : nom (sujet), acc (complement direct), dat, gen, ins.
     Les langues sans declinaison rendent la meme forme partout, sauf les
     contractions de l'article (es : al/del, pt : ao/do/pelo). */
  const P={
    en:{p:"pawn",n:"knight",b:"bishop",r:"rook",q:"queen",k:"king"},
    fr:{p:"pion",n:"cavalier",b:"fou",r:"tour",q:"dame",k:"roi"},
    es:{p:"peón",n:"caballo",b:"alfil",r:"torre",q:"dama",k:"rey"},
    pt:{p:"peão",n:"cavalo",b:"bispo",r:"torre",q:"dama",k:"rei"},
    de:{p:"Bauer",n:"Springer",b:"Läufer",r:"Turm",q:"Dame",k:"König"},
    ru:{p:"пешка",n:"конь",b:"слон",r:"ладья",q:"ферзь",k:"король"},
    it:{p:"pedone",n:"cavallo",b:"alfiere",r:"torre",q:"donna",k:"re"},
    tr:{p:"piyon",n:"at",b:"fil",r:"kale",q:"vezir",k:"şah"},
    pl:{p:"pion",n:"skoczek",b:"goniec",r:"wieża",q:"hetman",k:"król"},
    id:{p:"pion",n:"kuda",b:"gajah",r:"benteng",q:"menteri",k:"raja"}
  };
  const FEM={fr:"rq",es:"rq",pt:"rq",de:"q",ru:"pr",it:"rq",pl:"r",en:""};
  const PLURIEL={
    en:{p:"pawns",n:"knights",b:"bishops",r:"rooks",q:"queens",k:"kings"},
    fr:{p:"pions",n:"cavaliers",b:"fous",r:"tours",q:"dames",k:"rois"},
    es:{p:"peones",n:"caballos",b:"alfiles",r:"torres",q:"damas",k:"reyes"},
    pt:{p:"peões",n:"cavalos",b:"bispos",r:"torres",q:"damas",k:"reis"},
    de:{p:"Bauern",n:"Springer",b:"Läufer",r:"Türme",q:"Damen",k:"Könige"},
    it:{p:"pedoni",n:"cavalli",b:"alfieri",r:"torri",q:"donne",k:"re"},
    pl:{p:"piony",n:"skoczki",b:"gońce",r:"wieże",q:"hetmany",k:"króle"}
  };
  /* Polonais (2026-11-01) : declinaison des six noms, comme le russe. Les
     pieces se declinent en animes (zdobyć piona, wygrać gońca). */
  const PL={
    p:{nom:"pion",acc:"piona",gen:"piona",dat:"pionowi",ins:"pionem"},
    n:{nom:"skoczek",acc:"skoczka",gen:"skoczka",dat:"skoczkowi",ins:"skoczkiem"},
    b:{nom:"goniec",acc:"gońca",gen:"gońca",dat:"gońcowi",ins:"gońcem"},
    r:{nom:"wieża",acc:"wieżę",gen:"wieży",dat:"wieży",ins:"wieżą"},
    q:{nom:"hetman",acc:"hetmana",gen:"hetmana",dat:"hetmanowi",ins:"hetmanem"},
    k:{nom:"król",acc:"króla",gen:"króla",dat:"królowi",ins:"królem"}
  };
  /* Turc (2026-11-01) : pas de genre, mais un suffixe de cas accorde au nom
     (harmonie vocalique, consonne de liaison), et la case avant le nom :
     "e4'teki at", "e4'teki atı". Le suffixe de la case suit la lecture du
     chiffre (bir, iki, üç, dört, beş, altı, yedi, sekiz). */
  const TR={
    p:{nom:"piyon",acc:"piyonu",dat:"piyona",gen:"piyonun",ins:"piyonla",abl:"piyondan"},
    n:{nom:"at",acc:"atı",dat:"ata",gen:"atın",ins:"atla",abl:"attan"},
    b:{nom:"fil",acc:"fili",dat:"file",gen:"filin",ins:"fille",abl:"filden"},
    r:{nom:"kale",acc:"kaleyi",dat:"kaleye",gen:"kalenin",ins:"kaleyle",abl:"kaleden"},
    q:{nom:"vezir",acc:"veziri",dat:"vezire",gen:"vezirin",ins:"vezirle",abl:"vezirden"},
    k:{nom:"şah",acc:"şahı",dat:"şaha",gen:"şahın",ins:"şahla",abl:"şahtan"}
  };
  const TR_LOC={1:"de",2:"de",3:"te",4:"te",5:"te",6:"da",7:"de",8:"de"};
  const trLoc=sq=>{const s=String(sq||"");return s+"'"+(TR_LOC[s.slice(-1)]||"de");};
  /* Russe : declinaison des six noms, et genitif singulier/pluriel pour les
     nombres (две пешки, пять пешек). */
  const RU={
    p:{nom:"пешка",acc:"пешку",gen:"пешки",dat:"пешке",ins:"пешкой",gpl:"пешек"},
    n:{nom:"конь",acc:"коня",gen:"коня",dat:"коню",ins:"конём",gpl:"коней"},
    b:{nom:"слон",acc:"слона",gen:"слона",dat:"слону",ins:"слоном",gpl:"слонов"},
    r:{nom:"ладья",acc:"ладью",gen:"ладьи",dat:"ладье",ins:"ладьёй",gpl:"ладей"},
    q:{nom:"ферзь",acc:"ферзя",gen:"ферзя",dat:"ферзю",ins:"ферзём",gpl:"ферзей"},
    k:{nom:"король",acc:"короля",gen:"короля",dat:"королю",ins:"королём",gpl:"королей"}
  };
  /* Allemand : article defini et nom par cas. Bauer est un nom faible
     (den Bauern, des Bauern). */
  const DE={
    p:{nom:"der Bauer",acc:"den Bauern",dat:"dem Bauern",gen:"des Bauern"},
    n:{nom:"der Springer",acc:"den Springer",dat:"dem Springer",gen:"des Springers"},
    b:{nom:"der Läufer",acc:"den Läufer",dat:"dem Läufer",gen:"des Läufers"},
    r:{nom:"der Turm",acc:"den Turm",dat:"dem Turm",gen:"des Turms"},
    q:{nom:"die Dame",acc:"die Dame",dat:"der Dame",gen:"der Dame"},
    k:{nom:"der König",acc:"den König",dat:"dem König",gen:"des Königs"}
  };
  const cle=ch=>String(ch||"").toLowerCase();
  const langue=l=>P[l]?l:"en";
  function mot(l,ch){return P[langue(l)][cle(ch)]||"";}
  function genre(l,ch){return (FEM[langue(l)]||"").includes(cle(ch))?"f":"m";}
  /* Groupe nominal "la piece sur la case" : {g, nom, acc, dat, gen, ins}. */
  function groupe(l,ch,sq){
    l=langue(l);const k=cle(ch),w=mot(l,k),g=genre(l,k);
    const tous=s=>({g:g,nom:s,acc:s,dat:s,gen:s,ins:s});
    switch(l){
      case "fr":return tous((g==="f"?"la ":"le ")+w+" en "+sq);
      case "es":{const o=tous((g==="f"?"la ":"el ")+w+" en "+sq);
        o.dat=(g==="f"?"a la ":"al ")+w+" en "+sq;o.gen=(g==="f"?"de la ":"del ")+w+" en "+sq;return o;}
      case "pt":{const o=tous((g==="f"?"a ":"o ")+w+" em "+sq);
        o.dat=(g==="f"?"à ":"ao ")+w+" em "+sq;o.gen=(g==="f"?"da ":"do ")+w+" em "+sq;
        o.por=(g==="f"?"pela ":"pelo ")+w+" em "+sq;return o;}
      case "de":{const f=DE[k]||DE.p,o={g:g};
        for(const c in f)o[c]=f[c]+" auf "+sq;o.ins=o.dat;return o;}
      case "ru":{const f=RU[k]||RU.p,o={g:g};
        for(const c of ["nom","acc","gen","dat","ins"])o[c]=f[c]+" на "+sq;return o;}
      case "it":{const el=/^[aeiou]/.test(w),
          art=g==="f"?(el?"l'":"la "):(el?"l'":"il "),a=g==="f"?(el?"all'":"alla "):(el?"all'":"al "),
          di=g==="f"?(el?"dell'":"della "):(el?"dell'":"del ");
        const o=tous(art+w+" in "+sq);o.dat=a+w+" in "+sq;o.gen=di+w+" in "+sq;return o;}
      case "pl":{const f=PL[k]||PL.p,o={g:g};
        for(const c of ["nom","acc","gen","dat","ins"])o[c]=f[c]+" na "+sq;return o;}
      case "tr":{const f=TR[k]||TR.p,o={g:g};
        for(const c in f)o[c]=trLoc(sq)+"ki "+f[c];return o;}
      case "id":return tous(w+" di "+sq);
      default:return tous("the "+w+" on "+sq);
    }
  }
  /* "blanc"/"white" accorde a la piece, pour les annonces aux lecteurs
     d'ecran. */
  function couleur(l,ch,blanc){
    l=langue(l);const f=genre(l,ch)==="f";
    switch(l){
      case "fr":return blanc?(f?"blanche":"blanc"):(f?"noire":"noir");
      case "es":return blanc?(f?"blanca":"blanco"):(f?"negra":"negro");
      case "pt":return blanc?(f?"branca":"branco"):(f?"preta":"preto");
      case "de":return blanc?(f?"weiße":"weißer"):(f?"schwarze":"schwarzer");
      case "ru":return blanc?(f?"белая":"белый"):(f?"чёрная":"чёрный");
      case "it":return blanc?(f?"bianca":"bianco"):(f?"nera":"nero");
      case "pl":return blanc?(f?"biała":"biały"):(f?"czarna":"czarny");
      case "tr":return blanc?"beyaz":"siyah";
      case "id":return blanc?"putih":"hitam";
      default:return blanc?"white":"black";
    }
  }
  /* Nom accessible d'une case occupee : "cavalier blanc en e4". */
  function caseOccupee(l,ch,blanc,nom){
    l=langue(l);const w=mot(l,ch),c=couleur(l,ch,blanc);
    if(!w)return nom;
    switch(l){
      case "fr":return w+" "+c+" en "+nom;
      case "es":return w+" "+c+" en "+nom;
      case "pt":return w+" "+c+" em "+nom;
      case "de":return c+" "+w+" auf "+nom;
      case "ru":return c+" "+w+" на "+nom;
      case "it":return w+" "+c+" in "+nom;
      case "pl":return c+" "+w+" na "+nom;
      case "tr":return trLoc(nom)+" "+c+" "+w;
      case "id":return w+" "+c+" di "+nom;
      default:return c+" "+w+" on "+nom;
    }
  }
  /* Materiel gagne, en complement d'objet de "gagne" : "un cavalier", "deux
     pions", "la dame". Deux sortes de pieces au plus, au-dela la phrase ne se
     lit plus : on se rabat sur "du materiel". Accusatif en allemand et en
     russe, ou la phrase est toujours "gewinnt .../выигрывает ...". */
  const MATERIEL={en:"material",fr:"du matériel",es:"material",pt:"material",de:"Material",ru:"материал",
    it:"materiale",tr:"malzeme",pl:"materiał",id:"materi"};
  const ET={en:" and ",fr:" et ",es:" y ",pt:" e ",de:" und ",ru:" и ",it:" e ",tr:" ve ",pl:" i ",id:" dan "};
  function unePiece(l,k){
    const w=mot(l,k),f=genre(l,k)==="f";
    switch(l){
      case "fr":return k==="q"?"la dame":(f?"une ":"un ")+w;
      case "es":return k==="q"?"la dama":(f?"una ":"un ")+w;
      case "pt":return k==="q"?"a dama":(f?"uma ":"um ")+w;
      case "de":return k==="q"?"die Dame":(f?"eine ":"einen ")+(k==="p"?"Bauern":w);
      case "ru":return (RU[k]||RU.p).acc;
      case "it":return k==="q"?"la donna":(f?"una ":"un ")+w;
      case "pl":return (PL[k]||PL.p).acc;
      case "tr":return k==="q"?"veziri":"bir "+w;
      case "id":return k==="q"?"menteri":"satu "+w;
      default:return k==="q"?"the queen":"a "+w;
    }
  }
  function plusieurs(l,k,n){
    const f=genre(l,k)==="f";
    switch(l){
      case "fr":return ["","","deux","trois","quatre"][n]+" "+PLURIEL.fr[k];
      case "es":return ["","","dos","tres","cuatro"][n]+" "+PLURIEL.es[k];
      case "pt":return [,"",f?"duas":"dois","três","quatro"][n]+" "+PLURIEL.pt[k];
      case "de":return ["","","zwei","drei","vier"][n]+" "+PLURIEL.de[k];
      case "ru":{const r=RU[k]||RU.p;return [,"",f?"две":"два","три","четыре"][n]+" "+r.gen;}
      case "it":return ["","","due","tre","quattro"][n]+" "+PLURIEL.it[k];
      case "pl":return [,"",f?"dwie":"dwa","trzy","cztery"][n]+" "+PLURIEL.pl[k];
      /* Turc et indonesien : le nom reste au singulier apres un nombre. */
      case "tr":return ["","","iki","üç","dört"][n]+" "+mot(l,k);
      case "id":return ["","","dua","tiga","empat"][n]+" "+mot(l,k);
      default:return ["","","two","three","four"][n]+" "+PLURIEL.en[k];
    }
  }
  function lot(l,lt){
    l=langue(l);
    const ks="qrbnp".split("").filter(k=>lt[k]);
    if(!ks.length)return "";
    if(ks.length>2)return MATERIEL[l];
    return ks.map(k=>lt[k]>4?MATERIEL[l]:lt[k]>1?plusieurs(l,k,lt[k]):unePiece(l,k)).join(ET[l]);
  }
  /* Tour contre piece mineure, et "X contre Y". */
  const QUALITE={en:"the exchange",fr:"la qualité",es:"la calidad",pt:"a qualidade",de:"die Qualität",ru:"качество",
    it:"la qualità",tr:"kalite",pl:"jakość",id:"kualitas"};
  const CONTRE={en:" for ",fr:" contre ",es:" por ",pt:" por ",de:" für ",ru:" за ",it:" per ",pl:" za ",id:" dengan imbalan "};
  /* Gabarits a variables (2026-10-25). Au-dela du simple {n}, trois formes,
     pour les langues ou un mot change selon ce qu'on y met :
     - une traduction peut etre un objet de formes plurielles, choisie par
       Intl.PluralRules sur la variable n : {one:..., few:..., many:...,
       other:...}. Le russe en a besoin (1 ход, 2 хода, 5 ходов) ;
     - {x:acc} prend un cas d'un groupe nominal construit par groupe() :
       accusatif, datif, genitif... ({x} seul = nominatif) ;
     - {x?masculin|feminin} accorde un mot sur le genre de ce groupe
       nominal : "clavad{p?o|a}", "cloué{p?|e}".
     Un groupe nominal place en tete de phrase (debut du gabarit, ou apres
     un point) y prend la majuscule : "Der Springer...", "La torre...". */
  const RE_VARIABLE=/\{([A-Za-z0-9_]+)(?::([a-z]+))?(?:\?([^|{}]*)\|([^{}]*))?\}/g;
  /* Un groupe turc commence par sa case ("e4'teki at") : pas de majuscule
     sur une case. */
  const maj=s=>/^[a-h][1-8]/.test(s)?s:s.charAt(0).toUpperCase()+s.slice(1);
  function gabarit(modele,v){
    const out=String(modele);
    if(!v)return out;
    return out.replace(RE_VARIABLE,(tout,k,cas,m,f,pos)=>{
      if(!(k in v))return tout;
      const x=v[k];
      if(m!==undefined)return (x&&x.g==="f")?f:m;
      if(x&&typeof x==="object"){
        const s=(cas&&x[cas]!=null)?x[cas]:x.nom;
        return /(^|[.!?]\s+)$/.test(out.slice(0,pos))?maj(s):s;
      }
      return x;
    });
  }
  function pluriel(val,v,intl){
    if(!val||typeof val!=="object")return val;
    let cat="other";
    try{cat=new Intl.PluralRules(intl).select(Number(v&&v.n));}catch(e){}
    return val[cat]||val.other||val.many||val.one;
  }
  return {
    gabarit:gabarit,pluriel:pluriel,
    mot:mot,genre:genre,groupe:groupe,couleur:couleur,caseOccupee:caseOccupee,lot:lot,
    qualite:l=>QUALITE[langue(l)],
    /* Turc : "bir piyon karşılığında bir at", le prix d'abord. */
    contre:(l,g,p)=>langue(l)==="tr"?p+" karşılığında "+g:g+CONTRE[langue(l)]+p
  };
})();
if(typeof module!=="undefined"&&module.exports)module.exports=GRAMMAIRE;
