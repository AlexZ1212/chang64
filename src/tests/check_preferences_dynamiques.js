/* Verification automatique de chang64.
   Lancement : node tests/<fichier>.js  (depuis la racine des sources)
   Le site doit avoir ete construit au prealable : node build_site.js */
const SITE = require("path").join(__dirname, "..", "site");
const BASE = process.env.CHANG64_BASELINE || "";   /* site deja en ligne, facultatif */
const fs=require("fs");
const jd=require("jsdom");
const html=fs.readFileSync(""+SITE+"/index.html","utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole()});
const w=dom.window,d=w.document;
const key=(el,k)=>el.dispatchEvent(new w.KeyboardEvent("keydown",{key:k,bubbles:true,cancelable:true}));

setTimeout(async()=>{
  const cells=[...d.querySelectorAll(".sq")];

  console.log("\n--- Navigation aux fleches ---");
  cells[56].focus();
  T("focus initial sur a1", d.activeElement===cells[56]);
  key(cells[56],"ArrowRight");
  T("fleche droite -> b1", d.activeElement===cells[57]);
  key(d.activeElement,"ArrowUp");
  T("fleche haut -> b2", d.activeElement===cells[49]);
  key(d.activeElement,"Home");
  T("Home -> bord gauche de la rangee", d.activeElement===cells[48]);
  key(d.activeElement,"End");
  T("End -> bord droit", d.activeElement===cells[55]);
  key(d.activeElement,"PageUp");
  T("PageUp -> haut de la colonne", d.activeElement===cells[7]);
  key(d.activeElement,"ArrowUp");
  T("ne sort pas par le haut", d.activeElement===cells[7]);
  key(cells[63],"ArrowRight");
  cells[63].focus(); key(cells[63],"ArrowRight");
  T("ne sort pas par la droite", d.activeElement===cells[63]);

  console.log("\n--- Le tabindex suit le curseur ---");
  const at0=cells.filter(c=>c.tabIndex===0);
  T("toujours une seule case a tabindex 0", at0.length===1, at0.length+" cases");
  T("c'est la case focalisee", at0[0]===d.activeElement);

  console.log("\n--- Les annonces respectent l'opt-in ---");
  const sr=d.getElementById("srAnnounce");
  T("silencieuse par defaut", sr.textContent.trim()==="");
  const seg=d.getElementById("segAnnounce");
  d.getElementById("footPrefs").click();
  await new Promise(r=>setTimeout(r,120));
  const btnMoves=[...d.getElementById("segAnnounce").children].find(b=>b.dataset.v==="moves");
  btnMoves.click();
  await new Promise(r=>setTimeout(r,80));
  cells[56].focus(); key(cells[56],"ArrowRight");
  T("annonce apres activation", sr.textContent.trim().length>0, JSON.stringify(sr.textContent.trim()));
  const btnOff=[...d.getElementById("segAnnounce").children].find(b=>b.dataset.v==="off");
  btnOff.click();
  sr.textContent="";
  key(d.activeElement,"ArrowRight");
  T("redevient silencieuse une fois coupee", sr.textContent.trim()==="");

  console.log("\n--- Les themes changent vraiment ---");
  const chips=[...d.getElementById("boardThemes").children];
  T("5 themes proposes", chips.length===5, chips.length);
  const avant=d.documentElement.getAttribute("data-board");
  chips[1].click();
  await new Promise(r=>setTimeout(r,80));
  const apres=d.documentElement.getAttribute("data-board");
  T("le theme change", apres!==avant, avant+" -> "+apres);
  T("un seul chip coche", chips.filter(c=>c.getAttribute("aria-checked")==="true").length===1);

  console.log("\n--- Persistance reelle ---");
  const raw=w.localStorage.getItem("chang64:prefs");
  T("preferences ecrites dans localStorage", !!raw, raw);

  console.log("\n--- Bascule de langue ---");
  const fr=[...d.getElementById("langSwitch").children].find(b=>b.dataset.lang==="fr");
  fr.click();
  await new Promise(r=>setTimeout(r,150));
  d.getElementById("footPrefs").click();
  await new Promise(r=>setTimeout(r,120));
  T("panneau traduit en francais", (d.getElementById("prefsTitle").textContent||"").includes("Préférences"),
     d.getElementById("prefsTitle").textContent);
  T("noms de themes traduits", [...d.getElementById("boardThemes").children].some(c=>c.textContent==="Noyer"));

  console.log("\n--- Animation des deplacements ---");
/* La piece glisse de sa case de depart vers son arrivee. render() recree
   tout le HTML a chaque appel, donc l'element d'origine n'existe plus : on
   anime la nouvelle piece en la faisant partir de l'ancienne position.
   Le decalage se calcule en cases et non en pixels, pour ne pas dependre
   d'une mise en page deja calculee. Activee par defaut, desactivable, et
   respecte le reglage systeme "moins d'animations". */
T("reglage present dans les preferences", /id="segAnim"/.test(html));
T("fonction d'animation", /function animateMove/.test(html));
T("respecte prefers-reduced-motion", /prefersReducedMotion\(\)/.test(html));
T("calcul en cases, pas en pixels", /dCol\*100/.test(html));
T("sauvegarde du reglage", /anim:animOn/.test(html));
T("activee par defaut", /let animOn=true/.test(html));
T("une valeur absente ne la desactive pas", /typeof d\.anim==="boolean"/.test(html));

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
