/* Verification automatique de chang64.
   Lancement : node tests/<fichier>.js  (depuis la racine des sources)
   Le site doit avoir ete construit au prealable : node build_site.js */
const SITE = require("path").join(__dirname, "..", "site");
const BASE = process.env.CHANG64_BASELINE || "";   /* site deja en ligne, facultatif */
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(""+SITE+"/index.html","utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole()});
const w=dom.window,d=w.document;
setTimeout(async()=>{
  console.log("\n--- Le mot Accessibilite est visible dans le pied de page ---");
  const fa=d.getElementById("footAccess");
  T("lien present", !!fa);
  T("libelle explicite", (fa.textContent||"").trim()==="Accessibility", fa.textContent);

  console.log("\n--- Il mene bien a la section ---");
  fa.click();
  await new Promise(r=>setTimeout(r,150));
  T("panneau ouvert", !d.getElementById("pane-prefs").classList.contains("hide"));
  const h=d.getElementById("accessibilite");
  T("titre de section present", !!h && (h.textContent||"").trim().length>0, h&&h.textContent);
  T("la section prend le focus", d.activeElement===h, d.activeElement&&d.activeElement.id);
  T("focusable par programme uniquement", h.getAttribute("tabindex")==="-1");

  console.log("\n--- Les reglages sont bien dans cette section ---");
  const pos=t=>html.indexOf(t);
  T("annonces apres le titre", pos('id="segAnnounce"')>pos('id="accessibilite"'));
  T("clavier apres le titre", pos('id="kbdHelp"')>pos('id="accessibilite"'));
  T("themes avant le titre (hors accessibilite)", pos('id="boardThemes"')<pos('id="accessibilite"'));

  console.log("\n--- En francais ---");
  [...d.getElementById("langSwitch").children].find(b=>b.dataset.lang==="fr").click();
  await new Promise(r=>setTimeout(r,200));
  d.getElementById("footAccess").click();
  await new Promise(r=>setTimeout(r,200));
  T("lien traduit", (d.getElementById("footAccess").textContent||"").trim()==="Accessibilité",
     d.getElementById("footAccess").textContent);
  T("titre traduit", (d.getElementById("accessibilite").textContent||"").trim()==="Accessibilité",
     d.getElementById("accessibilite").textContent);
  T("intro traduite", (d.getElementById("prefsA11yIntro").textContent||"").includes("sans souris"),
     d.getElementById("prefsA11yIntro").textContent);
  T("Preferences traduit aussi", (d.getElementById("footPrefs").textContent||"").trim()==="Préférences",
     d.getElementById("footPrefs").textContent);

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
