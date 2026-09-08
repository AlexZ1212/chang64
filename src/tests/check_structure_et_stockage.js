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
  /* Selecteur restreint a #board depuis le 2026-09-07 : l'accueil affiche un
     second plateau, purement decoratif (.hero-board), qui porte les memes
     classes .board/.sq pour heriter du theme choisi. Un ".sq" nu en comptait
     donc 128. Le comportement teste ici, lui, n'a pas change : c'est le
     tabindex roulant du plateau JOUABLE. */
  const cells=d.querySelectorAll("#board .sq");
  T("64 cases construites", cells.length===64, cells.length+" cases");
  /* Corollaire du changement ci-dessus, et la vraie garantie a tenir : le
     plateau decoratif ne doit ajouter aucune etape au parcours clavier ni
     aucun bouton a annoncer. */
  const deco=d.querySelectorAll("#heroBoard .sq");
  T("plateau d'accueil construit", deco.length===64, deco.length+" cases");
  T("plateau d'accueil hors du parcours clavier",
    [...deco].every(c=>!c.hasAttribute("tabindex")&&!c.hasAttribute("role")));
  T("plateau d'accueil masque aux lecteurs d'ecran",
    d.getElementById("heroBoard").getAttribute("aria-hidden")==="true");
  /* Le seuil de bascule existe a DEUX endroits : la media query de
     .hero-visual et la constante REQUETE_ACCUEIL de ui3.js, qui decide de
     ne rien construire quand le bloc est masque. Les desynchroniser
     donnerait soit un plateau construit pour rien sur telephone, soit un
     trou blanc en paysage. jsdom n'implemente pas matchMedia, donc le
     comportement lui-meme n'est pas testable ici : on verrouille au moins
     l'accord des deux valeurs, qui est la faute la plus probable. */
  const seuilCss=(html.match(/@media\(min-width:(\d+)px\)\{[^@]*\.hero-visual\{display:block/)||[])[1];
  const seuilJs=(html.match(/REQUETE_ACCUEIL="\(min-width:(\d+)px\)"/)||[])[1];
  T("l'echiquier d'accueil est masque par defaut", html.includes(".hero-visual{display:none}"));
  T("seuil CSS et seuil JS accordes", !!seuilCss&&seuilCss===seuilJs,
    "css "+seuilCss+" / js "+seuilJs);
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
