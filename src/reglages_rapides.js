/* chang64 - reglages rapides pendant une partie (2026-11-21)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Constat d'Alexandre : pour changer de theme ou couper le son pendant une
 * partie, il fallait passer par Menu puis Preferences, qui remplacent l'ecran
 * de partie. Une roue dentee sous l'echiquier ouvre desormais un panneau
 * PAR-DESSUS la partie (une feuille qui monte du bas sur telephone) : theme,
 * couleurs de l'echiquier, animations, sons, appliques tout de suite. On
 * ferme avec la croix, Echap ou un appui a cote. La partie continue dessous,
 * la pendule aussi.
 *
 * Pas de seconde copie des reglages : ce sont les blocs des Preferences
 * eux-memes, avec leurs boutons et leurs ecouteurs, qui sont deplaces dans la
 * feuille le temps qu'elle est ouverte, puis remis a leur place. */
/* Un element de chaque bloc .field a montrer, dans l'ordre de la feuille : les
   deux interrupteurs d'abord, la longue grille des themes en dernier. */
const RR_BLOCS = ["segSon", "segAnim", "boardThemes", "themeChoix"];
let rrPlaces = [], rrAvant = null;

function rrOuvert() { const r = $("reglagesRapides"); return !!r && !r.hidden; }
function rrOuvrir() {
  const r = $("reglagesRapides"), corps = $("rrCorps");
  if (!r || !corps || rrOuvert()) return;
  if (typeof renderPrefs === "function") renderPrefs();
  if (typeof rendreThemes === "function") rendreThemes();
  rrPlaces = [];
  for (const id of RR_BLOCS) {
    const bloc = $(id) && $(id).closest(".field");
    if (!bloc) continue;
    /* Un repere garde la place du bloc dans les Preferences. */
    const repere = document.createComment("reglages rapides");
    bloc.parentNode.insertBefore(repere, bloc);
    corps.appendChild(bloc);
    rrPlaces.push([repere, bloc]);
  }
  rrAvant = document.activeElement;
  r.hidden = false;
  document.documentElement.classList.add("rr-ouvert");
  const premier = r.querySelector("#rrFermer");
  if (premier) premier.focus();
}
function rrFermer() {
  const r = $("reglagesRapides");
  if (!r || r.hidden) return;
  for (const [repere, bloc] of rrPlaces) { if (repere.parentNode) { repere.parentNode.insertBefore(bloc, repere); repere.parentNode.removeChild(repere); } }
  rrPlaces = [];
  r.hidden = true;
  document.documentElement.classList.remove("rr-ouvert");
  if (rrAvant && rrAvant.focus && document.contains(rrAvant)) rrAvant.focus();
  rrAvant = null;
}
if ($("btnReglages") && $("reglagesRapides")) {
  $("btnReglages").addEventListener("click", rrOuvrir);
  $("rrFermer").addEventListener("click", rrFermer);
  /* Un appui a cote de la feuille la referme. */
  $("reglagesRapides").addEventListener("click", e => { if (e.target === e.currentTarget) rrFermer(); });
  document.addEventListener("keydown", e => {
    if (!rrOuvert()) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); rrFermer(); return; }
    if (e.key !== "Tab") return;
    /* La tabulation reste dans la feuille. */
    const f = [...$("reglagesRapides").querySelectorAll("button:not([disabled]),[href],input,[tabindex]:not([tabindex='-1'])")].filter(x => x.offsetParent !== null || x === document.activeElement);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }, true);
  /* Changer d'ecran (onglet, menu, bouton Retour) referme la feuille, pour que
     les blocs soient revenus dans les Preferences si on y va. */
  const avant = setMode;
  setMode = function () { rrFermer(); return avant.apply(this, arguments); };
  /* Choisir un theme redessine les couleurs de l'echiquier : themes.js ne le
     fait que si les Preferences sont a l'ecran, on le fait ici pour la feuille. */
  $("reglagesRapides").addEventListener("click", e => {
    if (e.target.closest && e.target.closest("#themeChoix button") && typeof renderPrefs === "function") setTimeout(() => { if (rrOuvert()) renderPrefs(); }, 0);
  });
}
