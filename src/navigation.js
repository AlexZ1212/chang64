/* chang64 - le bouton Retour du navigateur, et le repere « Retour a la partie » (2026-11-21)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Constat d'Alexandre (teste sur le site le 21/11) : pendant une partie,
 * ouvrir les Preferences par le menu remplace l'ecran de partie ; aucun
 * onglet n'est allume, rien ne rappelle la partie, et le bouton Retour du
 * navigateur ou du telephone QUITTE LE SITE, car l'adresse ne change jamais.
 *
 * 1. Chaque ecran devient une etape de l'historique du navigateur. L'adresse
 *    ne change pas (les liens a diese existants gardent la leur) : seul un
 *    petit etat { c64: "play" } est empile. Retour ramene donc a l'ecran
 *    d'avant, partie comprise, surtout dans l'application installee.
 * 2. Un repere discret tant qu'une partie n'est pas finie et qu'on est
 *    ailleurs : une pastille sur l'onglet Jouer, et une ligne « Retour a la
 *    partie » en haut des Preferences, de l'Accessibilite et des pages legales.
 *
 * La pendule ne s'arrete jamais quand on quitte l'ecran (decision d'Alexandre).
 * Colle en dernier dans le lot (badges_build.js) : il enveloppe setMode apres
 * tous les autres. */
let navRetour = false;   /* on obeit a un Retour : ne rien empiler */

/* L'ecran ou une partie attend son joueur ("play", "friend"), ou "". Une
   partie par lien n'attend personne : chacun joue quand il veut. */
function navPartie() {
  try {
    if (typeof directOccupe === "function" && directOccupe()) return "friend";
    if (mode === "play") return gameStarted && !resultInfo ? "play" : "";
    if (mainGame && mainStarted && resigned === null && !isFlagged() && mainGame.moves().length > 0 && !(typeof mainGame.isDraw === "function" && mainGame.isDraw())) return "play";
  } catch (e) {}
  return "";
}
function navRepere() {
  const p = navPartie(), ailleurs = !!p && mode !== p;
  const onglet = $("tab-jouer");
  if (onglet) {
    onglet.classList.toggle("partie-en-cours", ailleurs);
    if (ailleurs) onglet.setAttribute("aria-description", t("Game in progress")); else onglet.removeAttribute("aria-description");
  }
  for (const el of document.querySelectorAll(".retour-jeu")) el.hidden = !ailleurs;
}
{
  const avant = setMode;
  setMode = function (m, opts) {
    const d = mode;
    const r = avant.apply(this, arguments);
    try {
      if (!navRetour && mode !== d) {
        /* L'ecran qu'on quitte garde son nom : les liens a diese remettent
           l'etat a zero quand ils nettoient l'adresse. */
        window.history.replaceState({ c64: d }, "");
        window.history.pushState({ c64: mode }, "");
      }
    } catch (e) {}
    navRepere();
    return r;
  };
}
window.addEventListener("popstate", e => {
  const s = e.state && e.state.c64;
  if (typeof s !== "string" || s === mode) return;
  navRetour = true;
  try {
    if (typeof menuFermer === "function") menuFermer();
    setMode(s);
    if (typeof goTop === "function") goTop();
  } catch (x) {}
  navRetour = false;
});
document.addEventListener("click", e => {
  if (!e.target.closest || !e.target.closest("[data-retour-jeu]")) return;
  const p = navPartie();
  if (!p) return;
  setMode(p);
  if (typeof goTop === "function") goTop();
});
/* La partie peut finir ou commencer pendant qu'on est ailleurs (pendule,
   invitation acceptee) : le repere suit, sans attendre un changement d'ecran. */
setInterval(navRepere, 2000);
try { window.history.replaceState({ c64: mode }, ""); } catch (e) {}
navRepere();
