/* Verification automatique de chang64.
   Lancement : node tests/check_defilement_marge.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Defilements automatiques (2026-11-22, demande d'Alexandre : « on arrive
   parfois trop bas, trop haut »). Mesure faite dans un vrai navigateur
   (mesure_defilement.js, 72 defilements, quatre largeurs) :
   - la marge laissee sous l'en-tete colle etait fixe (145 px dans
     l'application, 150 px sur les pages statiques) alors que l'en-tete
     mesure de 67 a 126 px : sur telephone, tout arrivait 50 px trop bas ;
   - l'echiquier pouvait rester en partie sous l'en-tete : s'il etait visible
     a 70 %, on ne le ramenait pas.
   jsdom ne met rien en page : ce test verifie le mecanisme (la marge suit la
   hauteur mesuree de l'en-tete, au moment du defilement), la mesure reelle
   restant celle de mesure_defilement.js. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const SITE = path.join(__dirname, "..", "site");

(async () => {
  const w = await ouvrir("fr", { attente: 2200 });
  const d = w.document, racine = d.documentElement, entete = d.querySelector("header");
  /* Un en-tete de hauteur connue, comme le navigateur le mesurerait. */
  let haut = 93;
  entete.getBoundingClientRect = () => ({ top: 0, left: 0, right: 360, bottom: haut, width: 360, height: haut });
  w.eval("majMargeDefilement()");
  T("la marge suit la hauteur de l'en-tete : 93 px mesures, 105 px de marge", racine.style.scrollPaddingTop === "105px", racine.style.scrollPaddingTop);
  haut = 126;
  w.dispatchEvent(new w.Event("resize"));
  T("elle se recalcule quand la fenetre change de taille : 126 px, 138 px de marge", racine.style.scrollPaddingTop === "138px", racine.style.scrollPaddingTop);
  haut = 0;
  w.eval("majMargeDefilement()");
  T("un en-tete pas encore mis en page ne remet pas la marge a zero", racine.style.scrollPaddingTop === "138px");
  /* Au moment du defilement : l'ecran vient de changer, l'en-tete peut avoir change de hauteur. */
  haut = 114;
  let appels = [];
  d.getElementById("privacyTitle").scrollIntoView = function (o) { appels.push(racine.style.scrollPaddingTop + " " + JSON.stringify(o || {})); };
  w.eval("setMode('legal');goToSection('privacyTitle')");
  T("goToSection mesure l'en-tete juste avant de defiler, et amene la section en haut", appels.length === 1 && /^126px /.test(appels[0]) && /"block":"start"/.test(appels[0]), appels.join(" | "));

  console.log("--- L'echiquier ---");
  const cote = d.querySelector(".board-side");
  let boite = { top: 30, bottom: 430, height: 400 }, defile = 0;
  cote.getBoundingClientRect = () => Object.assign({ left: 0, right: 360, width: 360 }, boite);
  cote.scrollIntoView = () => { defile++; };
  Object.defineProperty(w, "innerHeight", { value: 740, configurable: true });
  haut = 93;
  w.eval("focusBoard()");
  T("echiquier dont le haut est sous l'en-tete (30 px pour un en-tete de 93) : on le ramene, meme visible a plus de 70 %", defile === 1, String(defile));
  boite = { top: 110, bottom: 510, height: 400 }; defile = 0;
  w.eval("focusBoard()");
  T("echiquier entier sous l'en-tete : on ne bouge pas", defile === 0, String(defile));
  boite = { top: 600, bottom: 1000, height: 400 }; defile = 0;
  w.eval("focusBoard()");
  T("echiquier presque hors de l'ecran, en bas : on le ramene", defile === 1, String(defile));
  w.close();

  console.log("--- Pages statiques ---");
  for (const f of ["fr/ouvertures/defense-sicilienne.html", "openings/index.html", "fr/apprendre/le-roque.html"]) {
    const h = fs.readFileSync(path.join(SITE, f), "utf8");
    T(f + " : la marge suit l'en-tete colle (script), 150 px restant le repli de la feuille de style", /scrollPaddingTop=Math\.round\(x\+12\)\+"px"/.test(h) && /getComputedStyle\(eh\)\.position!=="sticky"/.test(h) && /scroll-padding-top:150px/.test(h));
  }
  const app = fs.readFileSync(path.join(SITE, "fr", "index.html"), "utf8");
  T("application : 145 px reste le repli sans JavaScript", /scroll-padding-top:145px/.test(app));
  /* 2026-11-23 : l'ecran qui arrive en glissant (.arrivee-d, 18 px) elargissait
     la page sur telephone le temps de l'animation, et un defilement lance a
     ce moment-la visait 21 px trop haut (titres Confidentialite et
     Accessibilite a 32 px sous l'en-tete, mesure dans un vrai navigateur par
     mesure_defilement.js). Le corps coupe ce qui depasse sur les cotes. */
  T("application : le corps coupe ce qui depasse sur les cotes (body{overflow-x:clip}), apres le filet de html", /html\{overflow-x:hidden\}body\{overflow-x:clip\}/.test(app));
  T("application : l'animation d'arrivee glisse toujours de 18 px", /@keyframes arriveeDroite\{(?:0%|from)\{opacity:0;transform:translateX\(18px\)\}/.test(app));

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
