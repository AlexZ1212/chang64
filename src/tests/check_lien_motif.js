/* Verification automatique de chang64.
   Lancement : node tests/check_lien_motif.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-09-07) : les pages Apprendre n'avaient qu'un
   bouton "Jouer une partie" qui menait a l'accueil, sans aucun rapport avec
   la notion qu'on venait de lire. Elles pointent desormais, quand la banque
   connait le motif, vers Resoudre deja filtre dessus (#theme=<nom>).

   Trois pieges sont surveilles ici, tous decouverts en construisant la
   route, et aucun n'est visible sans jouer le lien pour de vrai :

   1. Un motif ne vit plus sur toute l'echelle de difficulte. Depuis le
      redecoupage par famille, il tient ENTIEREMENT dans un niveau : Pin en
      7, Fourchette de cavalier en 6, Mat du couloir en 10. Poser le filtre
      sans changer de niveau revient a filtrer un lot qui n'en contient
      aucun.

   2. Un motif ne tient pas forcement dans le PREMIER morceau de son niveau.
      Le morceau 0 du niveau 7 ne contient que du Pin et de l'enfilade : la
      deviation n'apparait qu'a partir du morceau 1.

   3. Dans ces deux cas, levelPool() retombe SILENCIEUSEMENT sur le lot
      entier. Le lien annoncait donc un motif et en servait un autre, sans
      erreur, sans message. D'ou le point de ce test : on ne verifie pas que
      le filtre est pose, on verifie l'exercice REELLEMENT servi. */
const SITE = require("path").join(__dirname, "..", "site");
const fs=require("fs"),jd=require("jsdom");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};

function ouvrir(hash,cb){
  const dom=new jd.JSDOM(fs.readFileSync(SITE+"/index.html","utf8"),
    {runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/"+hash,
     virtualConsole:new jd.VirtualConsole(),
     beforeParse(w){w.fetch=u=>{const p=SITE+String(u).replace(/^https?:\/\/[^/]+/,"");
       return fs.existsSync(p)?Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(JSON.parse(fs.readFileSync(p,"utf8")))})
                              :Promise.resolve({ok:false,status:404});};}});
  setTimeout(()=>cb(dom.window),3600);
}

(async()=>{
  console.log("\n--- Les donnees promises par les liens existent ---");
  const counts=JSON.parse(fs.readFileSync(SITE+"/data/theme-counts.json","utf8"));
  const levels=JSON.parse(fs.readFileSync(SITE+"/data/theme-levels.json","utf8"));
  T("le fichier des niveaux par motif est produit",Object.keys(levels).length>0,
    Object.keys(levels).length+" motif(s)");
  T("il couvre exactement les memes motifs que les decomptes",
    Object.keys(levels).sort().join("|")===Object.keys(counts).sort().join("|"));
  T("chaque motif designe un niveau valide",
    Object.values(levels).every(n=>Number.isInteger(n)&&n>=1&&n<=10),
    JSON.stringify(levels));

  console.log("\n--- Les pages Apprendre pointent vers des motifs reels ---");
  /* Une faute de frappe dans la table de content.js ne casse rien de
     visible : le lien retombe sur un exercice ordinaire. Elle ne se
     verrait donc jamais sans cette comparaison au fichier de decomptes. */
  const liens=new Set();
  for(const dir of ["fr/apprendre","learn"]){
    for(const f of fs.readdirSync(SITE+"/"+dir).filter(x=>x.endsWith(".html")&&x!=="index.html")){
      const s=fs.readFileSync(SITE+"/"+dir+"/"+f,"utf8");
      const m=s.match(/href="\/#theme=([^"]+)"/);
      if(m)liens.add(decodeURIComponent(m[1]));
    }
  }
  T("des pages portent le lien",liens.size>0,liens.size+" motif(s) distinct(s)");
  T("tous les motifs cites existent dans la banque",
    [...liens].every(th=>Object.prototype.hasOwnProperty.call(counts,th)),
    [...liens].filter(th=>!counts[th]).join(", ")||"aucun inconnu");
  /* Les pages sans motif n'en recoivent pas, et c'est voulu : une page sur
     les cadences n'a rien a faire reproduire sur un echiquier. */
  const sansLien=fs.readdirSync(SITE+"/fr/apprendre")
    .filter(x=>x.endsWith(".html")&&x!=="index.html")
    .filter(f=>!/href="\/#theme=/.test(fs.readFileSync(SITE+"/fr/apprendre/"+f,"utf8")));
  T("les pages sans motif n'ont pas de bouton d'entrainement",sansLien.length>0,
    sansLien.length+" page(s) sans lien, ce qui est attendu");
  T("les deux langues portent le meme nombre de liens",
    ["fr/apprendre","learn"].map(d=>fs.readdirSync(SITE+"/"+d)
      .filter(x=>x.endsWith(".html")&&x!=="index.html")
      .filter(f=>/href="\/#theme=/.test(fs.readFileSync(SITE+"/"+d+"/"+f,"utf8"))).length)
      .reduce((a,b)=>a===b?a:-1)>0);

  console.log("\n--- Chaque lien sert bien le motif qu'il annonce ---");
  for(const th of [...liens].sort()){
    await new Promise(res=>ouvrir("#theme="+encodeURIComponent(th),w=>{
      const servi=w.eval("puzzle?puzzle.theme:null");
      T("« "+th+" » sert un exercice de ce motif",servi===th,
        "niveau "+w.eval("prog.level")+", exercice servi : "+servi);
      /* Reecrit le 2026-09-07. Le lien posait un filtre sur l'ecran des
         exercices et deplacait prog.level vers le niveau du motif ; il ouvre
         desormais l'aparte "Par motif", qui ne touche PAS a la progression.
         Le point d'entree a legitimement change, la garantie utile est
         restee la meme et elle est testee juste au-dessus : on recoit un
         exercice du motif annonce. Ce qu'on verifie en plus ici, c'est que
         suivre un lien depuis une page de cours ne deplace pas le niveau de
         la personne. */
      T("« "+th+" » ouvre l'aparte sur ce motif",w.eval("motifEnCours")===th,
        JSON.stringify(w.eval("motifEnCours")));
      T("« "+th+" » vise le niveau qui le contient",w.eval("motifNiveau")===levels[th],
        "niveau vise "+w.eval("motifNiveau")+", attendu "+levels[th]);
      T("« "+th+" » ne deplace pas la progression",w.eval("prog.level")===1,
        "prog.level="+w.eval("prog.level"));
      res();
    }));
  }

  console.log("\n--- Un lien perime ne casse rien ---");
  await new Promise(res=>ouvrir("#theme=MotifQuiNExistePas",w=>{
    T("on arrive tout de meme sur les exercices",w.eval("mode")==="puzzles",w.eval("mode"));
    T("un exercice est charge",!!w.eval("puzzle"));
    T("aucun aparte n'est ouvert sur une valeur inventee",
      w.eval("motifEnCours")===null,JSON.stringify(w.eval("motifEnCours")));
    res();
  }));
  await new Promise(res=>ouvrir("#theme=%%%",w=>{
    T("une adresse mal encodee n'arrete pas l'initialisation",!!w.eval("typeof mode!=='undefined'"),
      "le garde autour de decodeURIComponent doit tenir");
    res();
  }));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
})();
setTimeout(()=>{console.log("\n=== "+ok+" OK, "+(ko+1)+" FAIL === (delai depasse)");process.exit(1);},300000);
