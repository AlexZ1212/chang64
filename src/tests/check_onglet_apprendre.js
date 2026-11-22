/* Verification automatique de chang64.
   Lancement : node tests/check_onglet_apprendre.js
   Le site doit avoir ete construit au prealable : node build_site.js

   L'onglet « Apprendre » (apprendre.js, 2026-11-22, decisions d'Alexandre) :
   - un cinquieme onglet, en deuxieme position, dans les 10 langues ;
   - il n'est jamais vide : la carte du test de placement, le chemin de
     chapitres, « Revoir tes parties », les fiches de regles ;
   - les fiches de regles quittent Explorer, leurs pages gardent leur adresse ;
   - « Revoir tes parties » ouvre LA liste existante, pas une seconde ;
   - le bouton Retour du navigateur, le clavier et les lecteurs d'ecran. */
const fs = require("fs"), path = require("path");
const { ouvrir, SITE } = require("./outils/page_langue.js");
const { CODES, PAR_CODE } = require("../langues/registre.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));
const net = s => String(s).replace(/[  ]/g, " ");
const ONGLET = { en: "Learn", fr: "Apprendre", es: "Aprender", pt: "Aprender", de: "Lernen", ru: "Учиться", it: "Impara", tr: "Öğren", pl: "Ucz się", id: "Belajar" };

(async () => {
  console.log("La barre, dans les 10 langues");
  for (const l of CODES) {
    const w = await ouvrir(l, { fetch: true, attente: 900 });
    const b = [...w.document.querySelectorAll("#tabsNav button")].filter(x => !x.hidden);
    T(l + " : cinq onglets, Apprendre en deuxieme", b.map(x => x.id).join() === "tab-jouer,tab-apprendre,tab-puzzles,tab-edit,tab-explore", b.map(x => x.id).join());
    T(l + " : libelle « " + ONGLET[l] + " »", b[1].textContent === ONGLET[l], b[1].textContent);
    T(l + " : aucun libelle d'onglet ne depasse 11 lettres", b.every(x => x.textContent.length <= 11), b.map(x => x.textContent).join("|"));
    b[1].click(); await pause(500);
    const titres = [...w.document.querySelectorAll("#apChemin .ap-chap b")].map(x => x.textContent);
    T(l + " : trois chapitres titres dans la langue", titres.length === 3 && titres.every(x => x && x !== "…") && (l === "en" || titres[1] !== "All the rules"), titres.join(" | "));
    const f = [...w.document.querySelectorAll("#apFiches a")];
    const dir = PAR_CODE[l].dirs.learn;
    T(l + " : huit fiches de regles, toutes dans /" + dir + "/", f.length === 8 && f.every(a => a.getAttribute("href").startsWith("/" + dir + "/")), f.map(a => a.getAttribute("href")).slice(0, 2).join());
    T(l + " : chaque fiche existe", f.every(a => fs.existsSync(path.join(SITE, a.getAttribute("href") + ".html"))));
    T(l + " : le lien vers toutes les fiches mene a l'index de la rubrique", w.document.getElementById("apFichesToutes").getAttribute("href") === "/" + dir + "/" && fs.existsSync(path.join(SITE, dir, "index.html")));
    w.close();
  }

  console.log("Les adresses des fiches n'ont pas bouge");
  const publie = path.join(__dirname, "..", "..", "chang64-site");
  if (fs.existsSync(publie)) {
    let perdues = [];
    for (const l of CODES) {
      const dir = PAR_CODE[l].dirs.learn, d = path.join(publie, dir);
      if (!fs.existsSync(d)) continue;
      for (const f of fs.readdirSync(d)) if (/\.html$/.test(f) && !fs.existsSync(path.join(SITE, dir, f))) perdues.push(dir + "/" + f);
    }
    T("toute page de regles deja en ligne existe encore a la meme adresse", perdues.length === 0, perdues.slice(0, 5).join(" ; "));
  } else console.log("  (copie du site en ligne absente : controle saute)");

  console.log("L'ecran");
  let w = await ouvrir("fr", { fetch: true });
  let $ = id => w.document.getElementById(id);
  const cache = id => $(id).classList.contains("hide");
  const allume = id => $(id).getAttribute("aria-current") === "page";
  $("tab-apprendre").click(); await pause(500);
  T("l'onglet ouvre son ecran, sans echiquier", w.eval("mode") === "apprendre" && !cache("pane-apprendre") && cache("appLayout") && cache("pane-home"));
  T("seul l'onglet Apprendre est allume", allume("tab-apprendre") && !allume("tab-jouer") && !allume("tab-explore") && !allume("tab-puzzles") && cache("pane-explore") && cache("pane-jouer"));
  T("body porte le mode, pour l'en-tete", w.document.body.dataset.mode === "apprendre");
  T("premiere visite : la carte du test de placement est la", !cache("apTest") && cache("apRefaire") && /jouer/.test(net($("apTest").textContent)));
  const chap = [...w.document.querySelectorAll("#apChemin .ap-chap")];
  T("le chemin est une liste ordonnee de trois boutons", $("apChemin").tagName === "OL" && chap.length === 3 && chap.every(b => b.tagName === "BUTTON" && b.parentNode.tagName === "LI"));
  T("chapitre 1 ouvert et en cours, les deux suivants verrouilles", chap[0].classList.contains("encours") && !chap[0].classList.contains("verrou") && chap[1].classList.contains("verrou") && chap[2].classList.contains("verrou"));
  T("un chapitre verrouille le dit aux lecteurs d'ecran", chap[1].getAttribute("aria-disabled") === "true" && /chapitre 1/.test(net(chap[1].getAttribute("aria-label"))) && !chap[0].hasAttribute("aria-disabled"), chap[1].getAttribute("aria-label"));
  T("chaque chapitre a un nom lisible : numero, titre, etat", /^Chapitre 1 : Je débute\. /.test(net(chap[0].getAttribute("aria-label"))), chap[0].getAttribute("aria-label"));
  T("la ligne « A venir » annonce la suite", /venir/.test($("apVenir").textContent) && !cache("apVenir"));
  T("deux titres de section pour la navigation par titres", [...w.document.querySelectorAll("#pane-apprendre h2")].map(h => net(h.textContent)).join("|") === "Ton chemin|Fiches de règles", [...w.document.querySelectorAll("#pane-apprendre h2")].map(h => h.textContent).join("|"));
  chap[1].click(); await pause(300);
  T("un chapitre verrouille ne s'ouvre pas", w.eval("mode") === "apprendre");

  console.log("Explorer garde la reference, sans les fiches de regles");
  $("tab-explore").click(); await pause(300);
  const liens = [...w.document.querySelectorAll("#exploreLinks a")].map(a => a.getAttribute("href"));
  T("cinq rubriques dans Explorer", liens.length === 5, liens.join());
  T("la rubrique des regles n'y est plus", !liens.includes("/fr/apprendre/") && liens.includes("/fr/ouvertures/") && liens.includes("/fr/lexique/"), liens.join());
  T("quitter l'onglet masque son ecran", cache("pane-apprendre") && !allume("tab-apprendre") && allume("tab-explore"));

  console.log("Ouvrir un chapitre, puis revenir");
  $("tab-apprendre").click(); await pause(300);
  w.document.querySelector("#apChemin .ap-chap").click(); await pause(400);
  T("le chapitre 1 est « Je debute »", w.eval("mode") === "debut" && w.eval("leconCh") === "debut" && w.eval("lecon===debut") && !cache("pane-debut"));
  T("l'onglet Apprendre reste allume pendant une lecon", allume("tab-apprendre") && !allume("tab-jouer"));
  T("le bandeau du haut porte le nom du chapitre", net($("debutTeteTitre").textContent) === "Je débute" && net($("leconChap").textContent) === "Je débute");
  $("btnDebutFermer").click(); await pause(300);
  T("la croix ramene a l'onglet Apprendre", w.eval("mode") === "apprendre" && !cache("pane-apprendre"));
  $("brand").click(); await pause(200);
  $("heroDebut").click(); await pause(400);
  T("depuis l'accueil, « Je debute » ouvre le chapitre 1 sans fenetre", w.eval("mode") === "debut" && w.eval("leconCh") === "debut");
  $("btnDebutFermer").click(); await pause(300);
  T("et la croix ramene a l'accueil", w.eval("mode") === "home");

  console.log("Le bouton Retour du navigateur");
  $("tab-apprendre").click(); await pause(300);
  T("l'ecran est une etape de l'historique", w.history.state && w.history.state.c64 === "apprendre", JSON.stringify(w.history.state));
  w.document.querySelector("#apChemin .ap-chap").click(); await pause(400);
  T("la lecon aussi", w.history.state && w.history.state.c64 === "debut");
  w.dispatchEvent(new w.PopStateEvent("popstate", { state: { c64: "apprendre" } })); await pause(300);
  T("Retour ramene de la lecon a l'onglet", w.eval("mode") === "apprendre" && !cache("pane-apprendre"));
  w.dispatchEvent(new w.PopStateEvent("popstate", { state: { c64: "debut" } })); await pause(300);
  T("et Avancer rouvre la lecon ou l'on etait", w.eval("mode") === "debut" && w.eval("leconCh") === "debut");

  console.log("« Revoir tes parties » : la liste existante");
  $("tab-apprendre").click(); await pause(300);
  T("sans partie : la carte invite a jouer", /Joue d'abord/.test(net($("apPartiesSub").textContent)), $("apPartiesSub").textContent);
  T("la carte est un bouton qui annonce son etat", $("apParties").tagName === "BUTTON" && $("apParties").getAttribute("aria-expanded") === "false" && $("apParties").getAttribute("aria-controls") === "apPartiesBloc" && $("apPartiesBloc").hidden);
  $("apParties").click(); await pause(200);
  T("elle deplie le bloc « Tes parties » sous elle", !$("apPartiesBloc").hidden && $("historyPanel").parentNode === $("apPartiesBloc") && !cache("historyPanel") && $("apParties").getAttribute("aria-expanded") === "true");
  T("un seul bloc « Tes parties » dans la page", w.document.querySelectorAll("#historyPanel").length === 1 && w.document.querySelectorAll("#historyList").length === 1);
  $("apParties").click(); await pause(200);
  T("un second appui le replie et le rend a l'ecran de jeu", $("apPartiesBloc").hidden && $("historyPanel").parentNode === $("pane-play"));
  $("apParties").click(); await pause(100);
  $("tab-jouer").click(); await pause(200); $("jouerOrdi").click(); await pause(300);
  T("quitter l'onglet rend le bloc a l'ecran contre l'ordinateur", $("historyPanel").parentNode === $("pane-play") && $("apPartiesBloc").hidden);
  w.close();

  /* Avec une partie gardee : le compte, puis la revue avec le coach. */
  w = await ouvrir("fr", { fetch: true, avant(x) {
    x.localStorage.setItem("chang64:games", JSON.stringify([{ t: Date.now() - 6e4, k: "o", c: "w", r: "loss", tc: "", lvl: 1, elo: 700, m: "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 d7d6", fen: null }]));
  } });
  $ = id => w.document.getElementById(id);
  $("tab-apprendre").click(); await pause(500);
  T("avec une partie : « Parties a revoir : 1 »", /Parties à revoir : 1/.test(net($("apPartiesSub").textContent)), $("apPartiesSub").textContent);
  $("apParties").click(); await pause(200);
  const item = w.document.querySelector("#apPartiesBloc .history-item");
  T("la partie est dans la liste depliee", !!item);
  if (item) { item.click(); await pause(600); }
  T("la choisir ouvre la revue de l'ecran de jeu", w.eval("mode") === "play" && w.eval("isReviewGame") === true);
  T("le bloc est revenu a sa place", $("historyPanel").parentNode === $("pane-play"));
  w.close();

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
