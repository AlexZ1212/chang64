/* Verification automatique de chang64.
   Lancement : node tests/check_recherche_exercices.js

   Les exercices sont groupes par theme sur une seule page. Le champ filtre sur le
   theme (dans les deux langues), le niveau et le numero.

   Particularite par rapport aux ouvertures : les exercices sont groupes en
   sections. Un titre de theme dont plus aucune tuile ne correspond doit
   disparaitre, sinon la page se remplit d intitules suivis de vide. Le
   sommaire est masque pendant une recherche : il ne mene plus nulle part. */
const fs=require("fs"),jd=require("jsdom");
const S=require("path").join(__dirname,"..","site");
const NPUZ=JSON.parse(fs.readFileSync(require("path").join(__dirname,"..","puzzles.json"),"utf8")).length;
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const html=fs.readFileSync(S+"/fr/exercices/index.html","utf8");

console.log("\n--- Sans JavaScript ---");
{
  const d=new jd.JSDOM(html).window.document;
  T("champ masque", d.getElementById("filtreBloc").classList.contains("hide"));
  T(NPUZ+" exercices presents", d.querySelectorAll("[data-cle]").length===NPUZ,
     d.querySelectorAll("[data-cle]").length);
  T("sommaire des themes present", !!d.querySelector(".toc"));
  T("sections thematiques visibles", [...d.querySelectorAll("[data-theme]")].every(s=>!s.hidden));
}

console.log("\n--- Avec JavaScript ---");
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/fr/exercices/",virtualConsole:new jd.VirtualConsole()});
const w=dom.window,d=w.document;
setTimeout(()=>{
  const champ=d.getElementById("filtre");
  T("champ revele", !d.getElementById("filtreBloc").classList.contains("hide"));
  /* On mesure le style REELLEMENT calcule, pas l'attribut. Une tuile peut
     porter hidden et rester visible : la regle [hidden]{display:none} vient
     de la feuille par defaut du navigateur, donc .tile{display:block}
     l'emportait et la recherche semblait ne rien faire. */
  const vis=()=>[...d.querySelectorAll("[data-cle]")].filter(t=>w.getComputedStyle(t).display!=="none");
  const blocsVis=()=>[...d.querySelectorAll("[data-theme]")].filter(s=>!s.hidden);
  const saisir=v=>{champ.value=v;champ.dispatchEvent(new w.Event("input",{bubbles:true}));};

  console.log("\n--- Recherche par theme ---");
  saisir("clouage");
  T("'clouage' filtre", vis().length>0&&vis().length<100, vis().length+" resultats");
  T("les sections vides disparaissent", blocsVis().length<=2, blocsVis().length+" sections affichees");
  T("le sommaire est masque", d.querySelector(".toc").hidden);

  console.log("\n--- Recherche par niveau ---");
  saisir("difficile");
  T("'difficile' donne des resultats", vis().length>0, vis().length+" resultats");

  console.log("\n--- Recherche par numero ---");
  saisir("#42");
  /* Seuil relatif plutot que fige : "#42" trouve tout identifiant qui le
     contient (#42, #420-429, #142...942), donc le nombre de resultats croit
     avec la taille de la banque. Le test verifie que le filtre reste fin
     (largement sous la totalite), pas un compte exact. */
  T("'#42' filtre finement", vis().length>0&&vis().length<NPUZ/10, vis().length+" resultats");

  console.log("\n--- Recherche dans l'autre langue ---");
  saisir("pin");
  T("'pin' trouve les clouages", vis().length>0, vis().length+" resultats");

  console.log("\n--- Retour a l'etat initial ---");
  saisir("");
  T("tous les exercices reviennent", vis().length===NPUZ, vis().length);
  T("toutes les sections reviennent", blocsVis().length===[...d.querySelectorAll("[data-theme]")].length);
  T("le sommaire revient", !d.querySelector(".toc").hidden);

  console.log("\n--- Aucun resultat ---");
  saisir("zzzzz");
  T("message affiche", /Aucun/.test(d.getElementById("filtreEtat").textContent),
     d.getElementById("filtreEtat").textContent);
  T("aucune section orpheline", blocsVis().length===0, blocsVis().length);

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1200);
