/* Verification automatique de chang64.
   Lancement : node tests/check_reglages_partie.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Reglages de partie contre l'ordinateur (2026-11-21, decisions d'Alexandre) :
   - la couleur se dit en un mot (Blancs, Noirs, Au hasard) ;
   - quatre forces, chacune avec son Elo dessous ;
   - un interrupteur « S'adapter a mon niveau (≈ N) » remplace le cinquieme
     bouton : allume, il estompe les quatre forces et l'ordinateur joue a
     l'Elo du joueur ; toucher une force l'eteint ;
   - sur un telephone de 360 px, dans les 10 langues, aucun de ces libelles ne
     passe sur deux lignes ni ne deborde.

   jsdom ne met pas en page : la tenue a 360 px est gardee par un budget de
   caracteres par libelle, cale sur une mesure faite dans un vrai navigateur
   le 2026-11-21 (360 px, 10 langues : aucun libelle coupe ni sur deux lignes).
   Les largeurs : la rangee fait 308 px ; un bouton de couleur a 92 px de
   texte, un bouton de force 71 px, a 12,5 px de corps (6,6 px par lettre
   latine en moyenne, 7,4 px par lettre cyrillique). */
const path = require("path");
const { ouvrir } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const LANGUES = ["en", "fr", "es", "pt", "de", "ru", "it", "tr", "pl", "id"];
const dico = l => l === "en" ? {} : require(path.join(__dirname, "..", "langues", l, "app.js"));
const tr = (k, l) => { const v = dico(l)[k]; return typeof v === "string" ? v : k; };
/* Largeur estimee d'un texte a 12,5 px. */
const largeur = s => [...s].reduce((n, c) => n + (/[Ѐ-ӿ]/.test(c) ? 7.4 : /[A-ZÀ-ÞĞİŞ]/.test(c) ? 8 : /[ilI.,'’ ]/.test(c) ? 3.4 : 6.6), 0);

(async () => {
  console.log("--- La structure ---");
  const w = await ouvrir("fr", { attente: 2200 });
  const d = w.document, $ = id => d.getElementById(id);
  w.eval("setMode('play')");
  await attendre(400);
  const couleurs = [...$("segColor").children].map(b => b.textContent.replace(/\s+/g, " ").trim());
  T("couleur : trois choix en un mot", couleurs.join("|") === "Blancs|Noirs|Au hasard", couleurs.join("|"));
  const forces = [...$("segLevel").children];
  T("quatre forces, pas de cinquieme bouton", forces.length === 4 && forces.map(b => b.dataset.v).join() === "1,2,3,4");
  T("chaque force porte son nom et son Elo", forces.every(b => b.querySelector(".seg-nom").textContent.trim().length > 2 && /^\d{3,4}$/.test(b.querySelector(".seg-elo").textContent)),
    forces.map(b => b.textContent).join("|"));
  T("les Elo sont ceux de l'echelle du moteur", forces.map(b => b.querySelector(".seg-elo").textContent).join() === [1, 2, 3, 4].map(k => w.eval("NIVEAU_ELO[" + k + "]")).join());
  const inter = $("adapteNiveau");
  T("un interrupteur « S'adapter a mon niveau », avec l'Elo du joueur", inter.getAttribute("role") === "switch" && inter.getAttribute("aria-checked") === "false" && /S.adapter à\s+mon niveau/.test(inter.textContent) && /\(≈ \d{3,4}\)/.test($("adapteElo").textContent), inter.textContent);

  console.log("--- L'interrupteur ---");
  w.eval("botLevel=3;syncForce()");
  inter.click();
  T("allume : l'ordinateur joue a l'Elo du joueur", w.eval("botLevel") === w.eval("NIVEAU_MESURE") && inter.getAttribute("aria-checked") === "true" && w.eval("eloSouhaite()") === w.eval("eloJoueurOrdi()"));
  T("les quatre forces s'estompent, aucune n'est en avant", $("segLevel").classList.contains("estompe") && forces.every(b => b.getAttribute("aria-pressed") === "false"));
  T("elles restent utilisables", forces.every(b => !b.disabled));
  T("le nom de l'adversaire dit « Adapté » et l'Elo", /^Chang \| Adapté ≈ \d{3,4} Elo$/.test(w.eval("botLabel()")), w.eval("botLabel()"));
  inter.click();
  T("eteint : on retrouve la force d'avant", w.eval("botLevel") === 3 && forces[2].getAttribute("aria-pressed") === "true" && !$("segLevel").classList.contains("estompe"));
  inter.click();
  forces[0].click();
  T("toucher une force eteint l'interrupteur", w.eval("botLevel") === 1 && inter.getAttribute("aria-checked") === "false" && forces[0].getAttribute("aria-pressed") === "true");
  w.eval("prog.eloOrdi={r:1234,n:25,pic:1240,h:[]};refreshGame()");
  T("l'interrupteur suit l'Elo du joueur (1234, arrondi a 50)", $("adapteElo").textContent === "(≈ 1250)", $("adapteElo").textContent);

  console.log("--- Pendant une partie ---");
  inter.click();
  $("btnNew").click(); await attendre(450);
  if ($("readyBanner").classList.contains("hide")) { $("btnNew").click(); await attendre(450); }
  T("fenetre « Pret » : « Adapté ≈ 1250 Elo »", /Adapté ≈ 1250 Elo/.test($("readySub").textContent), $("readySub").textContent);
  $("readyStart").click(); await attendre(350);
  T("la force de la partie est figee a 1250", w.eval("eloPartie()") === 1250);
  T("interrupteur et forces verrouilles pendant la partie", inter.disabled && forces.every(b => b.disabled));
  T("l'adversaire est nomme au-dessus de la pendule", /^Chang \| Adapté ≈ 1250 Elo$/.test($("clockTopName").textContent.trim()), $("clockTopName").textContent);
  $("btnResign").click(); await attendre(160); $("btnResign").click(); await attendre(450);
  T("apres la partie, tout redevient reglable", !inter.disabled && forces.every(b => !b.disabled));
  T("la partie gardee porte la force jouee", w.eval("history.length") === 0 || w.eval("history[0].elo") === 1250);
  w.close();

  console.log("--- A 360 px, dans les 10 langues ---");
  for (const l of LANGUES) {
    const coul = ["White", "Black", "Random"].map(k => tr(k, l)), forc = ["Beginner", "Casual", "Solid", "Tough"].map(k => tr(k, l));
    const trop = coul.filter(s => largeur(s) > 92).concat(forc.filter(s => largeur(s) > 71));
    T(l + " : couleur et force tiennent sur une ligne", trop.length === 0, trop.map(s => s + " (" + Math.round(largeur(s)) + " px)").join(", "));
    /* 38 px de pastille, 10 d'ecart, 12 px par signe de « (≈ 1250) » a 12 px. */
    const libelle = tr("Adapt to my level", l);
    T(l + " : l'interrupteur tient sur une ligne", largeur(libelle) * 13 / 12.5 + 38 + 10 + 6 + 9 * 7.2 <= 302, libelle + " (" + Math.round(largeur(libelle)) + " px)");
  }
  {
    const p = await ouvrir("pl", { attente: 1800 });
    const noms = [...p.document.querySelectorAll("#segLevel .seg-nom")].map(x => x.textContent.trim());
    T("polonais : Nowicjusz et Amator", noms[0] === "Nowicjusz" && noms[1] === "Amator", noms.join("|"));
    p.close();
    const e = await ouvrir("es", { attente: 1800 });
    T("espagnol : Novato", e.document.querySelector("#segLevel .seg-nom").textContent.trim() === "Novato");
    e.close();
  }

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
