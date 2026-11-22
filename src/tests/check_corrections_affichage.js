/* Verification automatique de chang64.
   Lancement : node tests/check_corrections_affichage.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Corrections d'affichage du 2026-11-22 (liste d'Alexandre) :
   - reglages rapides : le titre et la croix restent en place, seule la liste
     des reglages defile ;
   - liens de texte sans style propre (« Voir le calendrier complet »,
     « Retour », mentions legales) : la couleur du theme, plus le bleu du
     navigateur ;
   - pages statiques : les boutons pleins changent au survol, comme ceux de
     l'application ;
   - cartes de Jouer : le globe est celui de la ligne « Langue » du menu, la
     puce est le processeur de Phosphor ;
   - Analyser : le bouton de retournement est en bas a droite de l'echiquier,
     avec la roue dentee, comme partout ailleurs ;
   - le contour de focus ne s'affiche qu'a qui navigue au clavier. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const SITE = path.join(__dirname, "..", "site");

(async () => {
  const page = fs.readFileSync(path.join(SITE, "fr", "index.html"), "utf8");
  const regle = sel => { const i = page.indexOf(sel + "{"); return i < 0 ? "" : page.slice(i, page.indexOf("}", i) + 1); };

  console.log("--- Reglages rapides : l'en-tete reste en place ---");
  T("la feuille ne defile plus elle-meme", /overflow:hidden/.test(regle(".rr-feuille")) && /flex-direction:column/.test(regle(".rr-feuille")) && !/overflow-y:auto/.test(regle(".rr-feuille")), regle(".rr-feuille"));
  T("c'est la liste des reglages qui defile, sous l'en-tete", /overflow-y:auto/.test(regle("#rrCorps")) && /min-height:0/.test(regle("#rrCorps")), regle("#rrCorps"));
  T("l'en-tete ne retrecit pas et porte un filet, comme celui du menu", /flex:none/.test(regle(".rr-tete")) && /border-bottom:1px solid var\(--rule\)/.test(regle(".rr-tete")), regle(".rr-tete"));

  console.log("--- Liens de texte : la couleur du theme ---");
  T("un lien sans style propre prend l'accent du theme", /:where\(a\)\{color:var\(--brass\)/.test(page));
  T("la regle ne pese rien : aucune regle « a{color} » nue qui ecraserait les liens deja colores", !/[};]a\{color:/.test(page.slice(page.indexOf("<style"), page.indexOf("</style>"))));
  {
    const sansRegle = id => !new RegExp("#" + id + "\\b[^{]*\\{[^}]*color:").test(page);
    T("« Voir le calendrier complet » et « Retour » n'ont pas d'autre couleur", /id="calFullLink"/.test(page) && /id="calBackLink"/.test(page) && sansRegle("calFullLink") && sansRegle("calBackLink"));
  }

  console.log("--- Pages statiques : survol des boutons ---");
  for (const f of ["openings/sicilian-defense.html", "fr/finales/dame-contre-roi.html", "fr/apprendre/index.html"]) {
    const p = path.join(SITE, f);
    if (!fs.existsSync(p)) { T(f + " existe", false); continue; }
    const h = fs.readFileSync(p, "utf8");
    T(f + " : le bouton plein s'eclaircit au survol, le creux prend un fond, les deux s'enfoncent", /\.cta:hover\{background:color-mix\(in srgb,var\(--brass\) 86%,#fff\)\}/.test(h) && /\.cta\.ghost:hover\{background:var\(--survol\)\}/.test(h) && /\.cta:active\{transform:scale\(\.96\)\}/.test(h) && /--survol:#[0-9a-fA-F]{6}/.test(h));
  }

  console.log("--- Cartes de Jouer : globe et puce ---");
  const { PICTOS, GLOBE_LANGUE } = require("../pictos_build.js");
  const gabarit = fs.readFileSync(path.join(__dirname, "..", "template.html"), "utf8");
  const ligneLangue = (gabarit.match(/<button[^>]*data-vue="langues"[^>]*>[\s\S]*?<\/button>/) || [""])[0];
  T("le globe de « Contre un joueur en ligne » est le dessin de la ligne « Langue » du menu", GLOBE_LANGUE.length > 200 && ligneLangue.includes('d="' + GLOBE_LANGUE + '"') && PICTOS.enligne.includes(GLOBE_LANGUE));
  T("l'ancien globe (disque et meridiens au trait) a disparu", !/<circle cx="0" cy="0" r="18"/.test(PICTOS.enligne));
  T("la puce de « Contre l'ordinateur » est le processeur de Phosphor", /M104,104h48v48H104Z/.test(PICTOS.ordinateur) && !/rx="1\.9/.test(PICTOS.ordinateur));
  T("les deux pictos sont dans la page", page.includes(GLOBE_LANGUE) && page.includes("M104,104h48v48H104Z"));
  {
    /* Un dessin Phosphor remplit sa boite (jusqu'a 21 unites du centre) : pose
       trop pres du coin, il sortait de la boite de 48 et etait rogne. */
    const dedans = nom => {
      const m = /scale\(1\.06\)[\s\S]*translate\(([\d.]+) -([\d.]+)\) scale\(([\d.]+)\)"><g transform="scale\(\.1875\)/.exec(PICTOS[nom]);
      return !!m && m[1] === m[2] && (+m[1] + 21 * +m[3]) * 1.06 <= 24;
    };
    T("la puce et le globe tiennent entiers dans le cadre de la carte", dedans("ordinateur") && dedans("enligne"), PICTOS.ordinateur.slice(-420, -300));
  }

  console.log("--- Analyser : le retournement en bas a droite ---");
  const w = await ouvrir("fr", { attente: 2200 });
  const d = w.document, $ = id => d.getElementById(id), cache = e => e.classList.contains("hide");
  w.eval("setMode('edit')"); await attendre(250);
  T("dans Analyser, le bouton de retournement est sous l'echiquier", $("btnFlip").parentElement === $("boardTools") && !cache($("boardTools")) && !$("btnFlip").hidden);
  T("il n'est plus dans la bande « Editeur de position »", !d.querySelector("#editIntro #btnFlip"));
  T("la roue dentee l'accompagne, juste avant lui", $("btnReglages").nextElementSibling === $("btnFlip") && !$("btnReglages").hidden);
  T("pas de bouton du clavier dans Analyser, ni de bandeau de coups", cache($("btnClavier")) && cache($("navRow")));
  {
    const avant = w.eval("flipped");
    $("btnFlip").click();
    T("il retourne bien l'echiquier", w.eval("flipped") === !avant);
    $("btnFlip").click();
  }
  $("btnReglages").click(); await attendre(120);
  T("la roue dentee ouvre les reglages rapides par-dessus Analyser", !$("reglagesRapides").hidden && w.eval("mode") === "edit");
  $("rrFermer").click(); await attendre(80);
  w.eval("setMode('play')"); await attendre(200);
  T("retour dans Jouer : les trois boutons sont dans la barre, dans l'ordre clavier, roue, retournement", [...$("boardTools").querySelectorAll("button.navchev")].map(b => b.id).join() === "btnClavier,btnReglages,btnFlip");
  T("la barre range ses boutons a droite", /justify-content:flex-end/.test(regle(".board-tools")));
  /* .navchev pose display:flex plus bas dans la feuille : la regle qui masque
     le bouton au doigt doit peser plus qu'une classe seule. */
  T("le bouton du clavier est masque au doigt, par une regle qui l'emporte sur .navchev", /@media \(hover:none\),\(pointer:coarse\)\{\.board-tools \.clavier-btn\{display:none\}\}/.test(page));

  console.log("--- Contour de focus : au clavier seulement ---");
  const racine = d.documentElement;
  d.body.dispatchEvent(new w.MouseEvent("mousedown", { bubbles: true }));
  T("apres un clic, la page note la saisie au pointeur", racine.dataset.saisie === "pointeur", racine.dataset.saisie);
  d.body.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Shift", bubbles: true }));
  T("une touche de modification seule ne change rien", racine.dataset.saisie === "pointeur");
  d.body.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
  T("apres la touche Tab, la saisie au clavier", racine.dataset.saisie === "clavier", racine.dataset.saisie);
  {
    const r = (page.match(/html\[data-saisie="pointeur"\] button:focus-visible[^{]*\{[^}]*\}/) || [""])[0];
    T("la feuille de style retire le contour apres un clic, pas au clavier", /\{outline:none!important\}$/.test(r) && !/html\[data-saisie="clavier"\][^{]*\{[^}]*outline:none/.test(page), r.slice(0, 120));
    T("boutons, liens et cases a choix sont couverts, chacun sous <html> (un espace les separe)", ["button", "a", "summary", '[role="button"]', '[role="radio"]', "[tabindex]"].every(x => r.includes('html[data-saisie="pointeur"] ' + x + ":focus-visible")), r);
    T("les champs de texte ne sont pas concernes", !/input|textarea|select/.test(r));
  }
  w.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
