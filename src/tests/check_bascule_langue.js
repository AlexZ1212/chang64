/* Verification automatique de chang64.
   Lancement : node tests/check_bascule_langue.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test gardait (2026-09-12) : ARRIVER sur un ecran dans une langue
   et BASCULER vers cette langue devaient donner le meme ecran. La bascule en
   direct ne retraduisait que le texte statique ; chaque bloc compose en
   JavaScript devait etre redessine par refreshCurrentMode(), et chaque oubli
   laissait un bloc dans la langue de depart.

   Depuis le 2026-10-25, changer de langue charge la page de cette langue
   (/, /fr/, /es/...) : il n'y a plus rien a redessiner. Le test garde donc :
   1. chaque ecran, ouvert dans chaque langue, n'affiche aucune phrase
      anglaise du dictionnaire de cette langue (y compris les blocs composes
      en JavaScript, la ou les defauts se cachaient) ;
   2. le selecteur de langue : une entree par langue du registre, la langue
      courante marquee, et un clic qui note la langue choisie et emporte le
      # (un lien vers un exercice ou une partie reste ouvert) ;
   3. le renvoi de "/" vers la langue retenue, ou celle du navigateur, et
      jamais pour un visiteur anglophone sans choix enregistre. */
const PATH = require("path"), fs = require("fs"), vm = require("vm");
const { ouvrir, SITE } = require("./outils/page_langue.js");
const { LANGUES } = require("../langues/registre.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const wait = ms => new Promise(r => setTimeout(r, ms));

function motifs(D) {
  const ech = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  /* Les cles d'un seul caractere sont ecartees : W/L/D (resultat d'une
     partie) valent aussi comme initiales de jours dans le calendrier. */
  return Object.entries(D).filter(([k, v]) => typeof v === "string" && k !== v && k.length > 1 && v.length > 1 && !k.startsWith("@"))
    .map(([k]) => k.includes("{") ? { re: new RegExp("^" + ech(k).replace(/\\\{[a-z]+\\\}/gi, "[^ ]{1,20}") + "$") } : { exact: k });
}
const restant = (txt, liste) => liste.some(m => m.exact !== undefined ? m.exact === txt : m.re.test(txt));

/* Visibilite EFFECTIVE : un texte demasque dans un conteneur masque reste
   invisible, et c'est un piege deja paye plusieurs fois sur ce projet. */
function visibles(w) {
  const d = w.document, out = [], walk = d.createTreeWalker(d.body, w.NodeFilter.SHOW_TEXT, null);
  let n;
  while (n = walk.nextNode()) {
    const p = n.parentNode;
    if (!p || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.nodeName)) continue;
    let cache = false;
    for (let x = n.parentElement; x && x !== d.body; x = x.parentElement)
      if ((x.classList && x.classList.contains("hide")) || x.id === "kbdHelp") { cache = true; break; }
    if (cache) continue;
    const v = n.nodeValue.trim();
    if (v) out.push({ txt: v, ou: n.parentElement.id ? "#" + n.parentElement.id : (n.parentElement.className || n.parentElement.nodeName) });
  }
  return out;
}

const ECRANS = [
  ["menu Resoudre",      "setMode('puzzles');showSolveScreen('menu')"],
  ["grille des motifs",  "setMode('puzzles');showSolveScreen('motifs')"],
  ["motif en cours",     "setMode('puzzles');showSolveScreen('motifs');startMotif('Knight fork')"],
  ["exercices",          "setMode('puzzles');showSolveScreen('puzzles')"],
  ["exercice du jour",   "setMode('puzzles');showSolveScreen('daily')"],
  ["finales",            "setMode('puzzles');showSolveScreen('endgames')"],
  ["calendrier complet", "setMode('calendar')"],
  /* Les deux epreuves chronometrees s'atteignent depuis les cartes du menu
     Resoudre : on s'arrete a leur lanceur, sans demarrer de chronometre. */
  ["lanceur Sprint",     "trainView='sprint';setMode('train')"],
  ["lanceur Coordonnees","trainView='coord';setMode('train')"],
  ["preferences",        "setMode('prefs')"],
  ["accueil",            "setMode('home')"]
];

(async () => {
  for (const l of LANGUES.filter(x => x.code !== "en")) {
    const D = require(PATH.join(__dirname, "..", "langues", l.code, "app.js"));
    const liste = motifs(D);
    /* Un texte qui est aussi une traduction de cette langue n'est pas un
       reste : "Start" est l'allemand de "Home". L'aide du clavier, ecartee
       par visibles(), cite les touches par leur nom (Home, End). */
    const valeurs = new Set(Object.values(D).filter(v => typeof v === "string"));
    console.log("\n--- chaque ecran ouvert en " + l.code + " ---");
    for (const [nom, code] of ECRANS) {
      const w = await ouvrir(l.code, { fetch: true, attente: 2400 });
      try { w.eval(code); } catch (e) { T(nom, false, "erreur " + e.message); w.close(); continue; }
      await wait(900);
      const restes = [...new Set(visibles(w).filter(x => !valeurs.has(x.txt) && restant(x.txt, liste)).map(x => x.ou + " :: " + x.txt.slice(0, 60)))];
      T(nom, restes.length === 0, restes.slice(0, 6).join(" | "));
      w.close();
    }
  }

  console.log("\n--- selecteur de langue ---");
  for (const l of LANGUES) {
    const w = await ouvrir(l.code, { attente: 1200 });
    const d = w.document, box = d.getElementById("langSwitch");
    const liens = box ? [...box.querySelectorAll("a[data-lang]")] : [];
    T(l.code + " : une entree par langue (" + LANGUES.length + ")", liens.length === LANGUES.length, liens.length);
    const courant = liens.filter(a => a.getAttribute("aria-current") === "true").map(a => a.dataset.lang);
    T(l.code + " : la langue de la page est marquee", courant.length === 1 && courant[0] === l.code, courant.join(","));
    T(l.code + " : chaque entree mene a l'accueil de sa langue",
      liens.every(a => a.getAttribute("href") === LANGUES.find(x => x.code === a.dataset.lang).accueil),
      liens.map(a => a.getAttribute("href")).join(" "));
    T(l.code + " : le resume affiche le code de la langue", (box.querySelector("summary") || {}).textContent === l.code.toUpperCase());
    w.close();
  }
  {
    const w = await ouvrir("fr", { attente: 1200 });
    w.history.replaceState(null, "", "#puzzle=p12");
    const vers = [...w.document.querySelectorAll("#langSwitch a[data-lang]")].find(a => a.dataset.lang === "es");
    vers.addEventListener("click", e => e.preventDefault());   /* pas de navigation dans jsdom */
    vers.click();
    T("clic : la langue choisie est notee", w.localStorage.getItem("chang64:lang") === "es", w.localStorage.getItem("chang64:lang"));
    T("clic : le # suit le lien", vers.getAttribute("href") === "/es/#puzzle=p12", vers.getAttribute("href"));
    w.close();
  }

  console.log("\n--- renvoi depuis la page anglaise ---");
  /* Le script de tete de "/" est rejoue dans un bac a sable, avec un
     stockage, une langue de navigateur et un location.replace factices. */
  const html = fs.readFileSync(PATH.join(SITE, "index.html"), "utf8");
  const script = (html.match(/<head>[\s\S]*?<script>([\s\S]*?)<\/script>/) || [])[1] || "";
  T("script de renvoi present en tete de la page anglaise", /location\.replace/.test(script));
  const essai = (stocke, nav, hash) => {
    let vers = null;
    vm.runInNewContext(script, {
      localStorage: { getItem: k => k === "chang64:lang" ? stocke : null },
      navigator: { language: nav },
      location: { search: "", hash: hash || "", replace: u => { vers = u; } }
    });
    return vers;
  };
  T("anglophone sans choix : reste sur /", essai(null, "en-US") === null);
  T("choix enregistre : anglais, meme avec un navigateur francais", essai("en", "fr-FR") === null);
  T("navigateur francais sans choix : /fr/", essai(null, "fr-FR") === "/fr/");
  T("navigateur bresilien : /pt/", essai(null, "pt-BR") === "/pt/");
  T("choix enregistre : allemand, le # suit", essai("de", "en-US", "#puzzle=p3") === "/de/#puzzle=p3");
  T("langue hors registre : reste sur /", essai(null, "it-IT") === null);
  for (const l of LANGUES.filter(x => x.code !== "en")) {
    const h = fs.readFileSync(PATH.join(SITE, l.code, "index.html"), "utf8");
    T("pas de renvoi sur " + l.accueil, !/location\.replace/.test((h.match(/<head>[\s\S]*?<\/head>/) || [""])[0]));
  }

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
