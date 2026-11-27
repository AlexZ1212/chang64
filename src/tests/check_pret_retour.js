/* Verification automatique de chang64.
   Lancement : node tests/check_pret_retour.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Bug signale par Alexandre le 27/11 : sur une nouvelle partie, la fenetre
   « Pret » ouverte, si l'on quitte la partie puis qu'on y revient, la fenetre
   a disparu et la pendule reste bloquee (la partie attendait un bouton
   invisible). Desormais la fenetre revient tant que la partie n'a pas ete
   lancee, et « Commencer la partie » fait partir la pendule. */
const { ouvrir } = require("./outils/page_langue.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));

let w, $, ev;
const charger = async () => { w = await ouvrir("fr", { fetch: true }); $ = id => w.document.getElementById(id); ev = s => w.eval(s); };
const cache = id => $(id).classList.contains("hide");
const nouvelle = async () => {
  ev("colorMode='w';myColor=W;botLevel=1;syncForce();tcCat='rapid';tcIdx=0;setMode('play',{fresh:true})");
  await pause(300);
};
/* Revient sur la partie comme le ferait le joueur : onglet Jouer, puis la
   ligne « Retour a la partie » si elle est la ; sinon le carre en bas a
   droite ; a defaut, l'ecran de jeu directement. */
const revenir = async () => {
  $("tab-jouer").click(); await pause(300);
  const rp = $("retourPartie");
  if (rp && !rp.classList.contains("hide")) { $("btnRetourPartie").click(); await pause(300); return "Retour a la partie"; }
  const cr = $("carreParties");
  if (cr && !cr.classList.contains("hide") && !cr.hidden) { cr.click(); await pause(300); if (ev("mode") === "play") return "carre"; }
  ev("setMode('play')"); await pause(300); return "ecran de jeu";
};

(async () => {
  await charger();

  console.log("--- Une nouvelle partie chronometree ouvre la fenetre « Pret » ---");
  await nouvelle();
  T("la fenetre est ouverte et la partie attend", !cache("readyBanner") && ev("awaitingStart") === true);

  for (const [nom, partir] of [
    ["onglet Resoudre", () => $("tab-puzzles").click()],
    ["accueil", () => ev("setMode('home')")],
    ["Preferences", () => ev("setMode('prefs')")],
  ]) {
    console.log("--- On part vers " + nom + " avant de commencer, puis on revient ---");
    partir(); await pause(300);
    T("ailleurs, la fenetre n'est plus par-dessus (" + nom + ")", cache("readyBanner"));
    const par = await revenir();
    T("au retour (" + par + "), la fenetre « Pret » est de nouveau la", ev("mode") === "play" && !cache("readyBanner"), "mode=" + ev("mode"));
    T("son bouton dit « Commencer la partie »", $("readyStart").textContent.replace(/[\s  ]+/g, " ").trim() === "Commencer la partie", $("readyStart").textContent);
    T("sa ligne rappelle la cadence (10+0)", /10\+0/.test($("readySub").textContent), $("readySub").textContent);
  }

  console.log("--- Commencer fait partir la pendule ---");
  const avant = ev("clock.w");
  $("readyStart").click(); await pause(1500);
  T("la fenetre se ferme, la partie n'attend plus", cache("readyBanner") && ev("awaitingStart") === false);
  T("la pendule des Blancs s'ecoule", ev("clock.w") < avant - 500, avant + " -> " + ev("clock.w"));

  console.log("--- Partie lancee : partir et revenir ne rouvre pas la fenetre ---");
  $("tab-puzzles").click(); await pause(300);
  await revenir();
  T("pas de fenetre « Pret » sur une partie deja lancee", cache("readyBanner"));

  console.log("--- « Changer les reglages » annule la partie : rien a rouvrir ---");
  await nouvelle();
  $("readySettings").click(); await pause(300);
  $("tab-puzzles").click(); await pause(300);
  ev("setMode('play')"); await pause(300);
  T("apres « Changer les reglages », la fenetre ne revient pas", cache("readyBanner") && ev("awaitingStart") === false);

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
