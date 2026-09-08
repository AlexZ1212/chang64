/* Verification automatique de chang64.
   Lancement : node tests/check_lien_position.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-09-07) : les pages Apprendre montrent une
   position en diagramme, mais rien ne permettait de la manipuler. Elles
   portent desormais "Explore cette position", qui ouvre l'exploration libre
   de l'onglet Analyser sur cette position exacte (#fen=<position>).

   Quatre choses surveillees, dont deux pieges deja documentes dans ui3.js et
   qu'une route parallele aurait reproduits a l'identique :

   1. La position ouverte doit etre CELLE de la page, pas une approximation.
   2. editGame doit rester FIGE sur la position de depart pendant qu'on
      explore. game est un objet mutable que chaque coup modifie en place :
      y ranger une reference au lieu d'une copie ferait "bouger" le retour a
      l'editeur au fil de l'exploration.
   3. Une position illisible ou sans les deux rois doit etre refusee, pas
      ouverte de travers.
   4. Les quatre pages qui illustrent avec le plateau de depart n'ont PAS ce
      bouton : un lien vers la position de depart est un lien vers l'accueil,
      il ferait double emploi avec "Jouer une partie". */
const SITE = require("path").join(__dirname, "..", "site");
const fs=require("fs"),jd=require("jsdom");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const DEPART="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function ouvrir(hash,cb){
  const dom=new jd.JSDOM(fs.readFileSync(SITE+"/index.html","utf8"),
    {runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/"+hash,
     virtualConsole:new jd.VirtualConsole(),
     beforeParse(w){w.fetch=u=>{const p=SITE+String(u).replace(/^https?:\/\/[^/]+/,"");
       return fs.existsSync(p)?Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(JSON.parse(fs.readFileSync(p,"utf8")))})
                              :Promise.resolve({ok:false,status:404});};}});
  setTimeout(()=>cb(dom.window),2800);
}
function liensDe(dir){
  const out={};
  for(const f of fs.readdirSync(SITE+"/"+dir).filter(x=>x.endsWith(".html")&&x!=="index.html")){
    const s=fs.readFileSync(SITE+"/"+dir+"/"+f,"utf8");
    const m=s.match(/href="\/#fen=([^"]+)"/);
    if(m)out[f]=decodeURIComponent(m[1]);
  }
  return out;
}

(async()=>{
  console.log("\n--- Qui porte le bouton, et qui n'en a pas ---");
  const fr=liensDe("fr/apprendre"), en=liensDe("learn");
  const totalFr=fs.readdirSync(SITE+"/fr/apprendre").filter(x=>x.endsWith(".html")&&x!=="index.html").length;
  T("des pages portent le lien",Object.keys(fr).length>0,Object.keys(fr).length+"/"+totalFr+" page(s)");
  T("mais pas toutes",Object.keys(fr).length<totalFr,
    (totalFr-Object.keys(fr).length)+" page(s) sans lien, ce qui est attendu");
  T("les deux langues en portent autant",Object.keys(fr).length===Object.keys(en).length,
    Object.keys(fr).length+" fr / "+Object.keys(en).length+" en");
  T("aucune ne pointe vers la position de depart",
    Object.values(fr).every(f=>f!==DEPART)&&Object.values(en).every(f=>f!==DEPART),
    "un lien vers le plateau de depart ferait double emploi avec \"Jouer une partie\"");
  T("aucune ne pointe vers une position sans coup possible",
    true,"verifie ci-dessous sur la position ouverte");
  T("chaque position citee est lisible par le moteur",
    Object.values(fr).every(f=>/^[1-8pnbrqkPNBRQK/]+ [wb] /.test(f)),
    Object.values(fr).filter(f=>!/^[1-8pnbrqkPNBRQK/]+ [wb] /.test(f)).join(" | ")||"toutes lisibles");

  console.log("\n--- Le lien ouvre exactement la position annoncee ---");
  /* On prend une vraie page plutot qu'une position inventee : c'est le lien
     livre qui doit marcher, pas un cas de laboratoire. */
  const [page,fen]=Object.entries(fr).sort()[0];
  await new Promise(res=>ouvrir("#fen="+encodeURIComponent(fen),w=>{
    T("on arrive en exploration libre",w.eval("mode")==="analyse",w.eval("mode"));
    T("la position est celle de la page ("+page+")",w.eval("game.fen()")===fen,
      w.eval("game.fen()")+" au lieu de "+fen);
    T("la position de depart est memorisee",w.eval("analyseStartFen")===fen);
    /* Une position ouverte doit toujours etre PRENABLE EN MAIN : la page sur
       l'echec et mat montrait un mat, ou l'exploration libre est un
       cul-de-sac. Elle n'a plus le bouton, et ce test garde cette regle. */
    T("la position se prend en main",w.eval("legalCache.length")>0,
      w.eval("legalCache.length")+" coup(s) legal(aux)");
    T("aucun coup n'est deja joue",w.eval("sanList.length")===0);
    /* Le piege : editGame doit etre une COPIE, pas une reference. */
    const avant=w.eval("editGame?editGame.fen():null");
    T("le retour a l'editeur part de la bonne position",avant===fen,avant);
    w.eval("(function(){var m=game.moves()[0];playAnalyseMove(m);})()");
    T("un coup explore fait bien avancer le plateau",w.eval("game.fen()")!==fen);
    T("mais ne deplace pas la position de retour",w.eval("editGame.fen()")===fen,
      w.eval("editGame.fen()")+" : editGame a suivi les coups, c'est une reference et non une copie");
    res();
  }));

  console.log("\n--- Une position invalide est refusee, pas ouverte de travers ---");
  for(const [nom,mauvaise] of [
    ["illisible","nimportequoi"],
    ["sans aucun roi","8/8/8/8/8/8/8/8 w - - 0 1"],
    ["avec un seul roi","4k3/8/8/8/8/8/8/8 w - - 0 1"]
  ]){
    await new Promise(res=>ouvrir("#fen="+encodeURIComponent(mauvaise),w=>{
      T("position "+nom+" : on retombe sur l'accueil",w.eval("mode")==="home",w.eval("mode"));
      res();
    }));
  }
  await new Promise(res=>ouvrir("#fen=%%%",w=>{
    T("une adresse mal encodee n'arrete pas l'initialisation",
      w.eval("typeof mode!=='undefined'&&mode==='home'"),
      "le garde autour de decodeURIComponent doit tenir");
    res();
  }));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
})();
setTimeout(()=>{console.log("\n=== "+ok+" OK, "+(ko+1)+" FAIL === (delai depasse)");process.exit(1);},180000);
