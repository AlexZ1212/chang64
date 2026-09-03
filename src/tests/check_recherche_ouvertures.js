/* Verification automatique de chang64.
   Lancement : node tests/check_recherche_ouvertures.js

   141 ouvertures sur une seule page ne se parcourent pas a l oeil. Le champ
   filtre sur le nom (dans les deux langues), les coups et le code ECO, sans
   tenir compte des accents ni de la ponctuation.

   Regle : le champ est masque par defaut et revele par le script. Sans
   JavaScript, la page reste exactement ce qu elle etait et personne ne se
   retrouve devant un champ inerte. */
const fs=require("fs"),jd=require("jsdom");
const S=require("path").join(__dirname,"..","site");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const html=fs.readFileSync(S+"/fr/ouvertures/index.html","utf8");

console.log("\n--- Sans JavaScript, rien ne change ---");
{
  const d=new jd.JSDOM(html).window.document;
  T("champ masque", d.getElementById("filtreBloc").classList.contains("hide"));
  T("toutes les ouvertures visibles", [...d.querySelectorAll("[data-cle]")].every(t=>!t.hidden));
  T("141 entrees presentes", d.querySelectorAll("[data-cle]").length===141,
     d.querySelectorAll("[data-cle]").length);
}

console.log("\n--- Avec JavaScript ---");
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/fr/ouvertures/",virtualConsole:new jd.VirtualConsole()});
const w=dom.window,d=w.document;
setTimeout(()=>{
  const champ=d.getElementById("filtre");
  T("champ revele", !d.getElementById("filtreBloc").classList.contains("hide"));
  /* On mesure le style REELLEMENT calcule, pas l'attribut. Une tuile peut
     porter hidden et rester visible : la regle [hidden]{display:none} vient
     de la feuille par defaut du navigateur, donc .tile{display:block}
     l'emportait et la recherche semblait ne rien faire. */
  const vis=()=>[...d.querySelectorAll("[data-cle]")].filter(t=>w.getComputedStyle(t).display!=="none");
  const saisir=v=>{champ.value=v;champ.dispatchEvent(new w.Event("input",{bubbles:true}));};

  console.log("\n--- Recherche par nom ---");
  saisir("sic");
  T("'sic' filtre", vis().length>0&&vis().length<20, vis().length+" resultats");
  T("la sicilienne est trouvee", vis().some(t=>/sicilienne/i.test(t.textContent)),
     vis().slice(0,3).map(t=>t.querySelector("b").textContent).join(", "));

  console.log("\n--- Insensible aux accents ---");
  saisir("defense sicilien");
  T("'defense sicilien' sans accent trouve", vis().length>0, vis().length+" resultats");

  console.log("\n--- Recherche par coups ---");
  saisir("e4 c5");
  T("'e4 c5' trouve la sicilienne", vis().some(t=>/sicilienne/i.test(t.textContent)),
     vis().slice(0,3).map(t=>t.querySelector("b").textContent).join(", "));

  console.log("\n--- Recherche par code ECO ---");
  saisir("B20");
  T("'B20' donne des resultats", vis().length>0, vis().length+" resultats");

  console.log("\n--- Mots dans le desordre ---");
  saisir("sicilienne e4");
  T("l'ordre des mots n'importe pas", vis().length>0, vis().length+" resultats");

  console.log("\n--- Retours a l'utilisateur ---");
  saisir("zzzzzz");
  T("aucun resultat annonce", /Aucun/.test(d.getElementById("filtreEtat").textContent),
     d.getElementById("filtreEtat").textContent);
  saisir("sic");
  T("compte annonce", /sur 141/.test(d.getElementById("filtreEtat").textContent),
     d.getElementById("filtreEtat").textContent);
  saisir("");
  T("champ vide : tout revient", vis().length===141, vis().length);
  T("etat efface", d.getElementById("filtreEtat").textContent==="");

  console.log("\n--- Le script n'est pas emis inutilement ---");
  T("absent des pages d'ouverture", !fs.readFileSync(S+"/fr/ouvertures/defense-sicilienne.html","utf8").includes("filtreBloc"));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},900);
