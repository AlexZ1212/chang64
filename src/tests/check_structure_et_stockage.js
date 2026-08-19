/* Verification automatique de chang64.
   Lancement : node tests/<fichier>.js  (depuis la racine des sources)
   Le site doit avoir ete construit au prealable : node build_site.js */
const SITE = require("path").join(__dirname, "..", "site");
const BASE = process.env.CHANG64_BASELINE || "";   /* site deja en ligne, facultatif */
const fs=require("fs");
const {JSDOM}=require("jsdom");
const html=fs.readFileSync(""+SITE+"/index.html","utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};

const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",
  virtualConsole:new (require("jsdom").VirtualConsole)()});
const w=dom.window,d=w.document;

setTimeout(()=>{
  console.log("\n--- Le stockage fonctionne-t-il vraiment ? ---");
  T("window.storage defini", typeof w.storage==="object");
  T("adosse a localStorage", typeof w.localStorage==="object");

  console.log("\n--- Chargement differe du livre ---");
  T("fetch de openings-book.json present", html.includes('fetch("/openings-book.json")'));
  T("livre absent de index.html", !html.includes("Sicilian Defense: Najdorf"));
  T("slugs conserves (liens ouvertures)", html.includes("OPENING_SLUGS"));

  console.log("\n--- Themes d'echiquier ---");
  T("5 themes declares en CSS", (html.match(/html\[data-board=/g)||[]).length===5);
  const root=d.documentElement;
  T("theme applique au chargement", root.getAttribute("data-board")!==null, "data-board="+root.getAttribute("data-board"));
  T("panneau de themes present", !!d.getElementById("boardThemes"));

  console.log("\n--- Accessibilite ---");
  const sr=d.getElementById("srAnnounce");
  T("zone d'annonces presente", !!sr);
  T("zone en role=status", sr && sr.getAttribute("role")==="status");
  T("zone en aria-live=polite", sr && sr.getAttribute("aria-live")==="polite");
  T("zone vide au demarrage (opt-in)", sr && sr.textContent.trim()==="");
  T("zone non masquee par display:none", !html.includes(".visually-hidden{display:none"));
  T("reglage d'annonces present", !!d.getElementById("segAnnounce"));
  T("aide clavier presente", !!d.getElementById("kbdHelp"));

  console.log("\n--- Tabindex roulant sur l'echiquier ---");
  const cells=d.querySelectorAll(".sq");
  T("64 cases construites", cells.length===64, cells.length+" cases");
  if(cells.length===64){
    const focusables=[...cells].filter(c=>c.tabIndex===0).length;
    T("une seule case atteignable au Tab", focusables===1, focusables+" cases a tabindex=0");
    T("les 63 autres sont a -1", [...cells].filter(c=>c.tabIndex===-1).length===63);
  }

  console.log("\n--- Panneau de preferences ---");
  T("pane-prefs present", !!d.getElementById("pane-prefs"));
  T("bouton dans le pied de page", !!d.getElementById("footPrefs"));

  console.log("\n--- Rien n'a ete casse ---");
  for(const id of ["pane-play","pane-legal","btnAnalyse","legalBody","privacyBody","board","opening"])
    T(id+" toujours present", !!d.getElementById(id));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1500);
