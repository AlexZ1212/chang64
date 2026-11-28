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
  /* 2026-11-24 : plus de pastille sur l'onglet Jouer ; le carre en bas a
     droite le dit (corrCarre, corr.js), et y ramene. */
  const onglet = $("tab-jouer");
  if (onglet) {
    onglet.classList.remove("partie-en-cours");
    if (ailleurs) onglet.setAttribute("aria-description", t("Game in progress")); else onglet.removeAttribute("aria-description");
  }
  if (typeof corrCarre === "function") corrCarre();
  for (const el of document.querySelectorAll(".retour-jeu")) el.hidden = !ailleurs;
  navRetourMaj();
}
{
  const avant = setMode;
  setMode = function (m, opts) {
    const d = mode, place = navPlace();
    const r = avant.apply(this, arguments);
    /* Preferences, Accessibilite, pages legales : on retient d'ou l'on vient,
       pour y revenir exactement (2026-11-24). */
    if (NAV_PAGES.includes(mode) && !NAV_PAGES.includes(d) && mode !== d) navDepuis = place;
    try {
      if (!navRetour && mode !== d) {
        /* L'ecran qu'on quitte garde son nom : les liens a diese remettent
           l'etat a zero quand ils nettoient l'adresse. Il garde aussi sa
           position (y) et son sous-ecran (e) : Retour y ramene. */
        window.history.replaceState({ c64: d, y: place.y, e: place.e }, "");
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
    if (typeof e.state.y === "number") navAller({ m: s, y: e.state.y, e: e.state.e || "" });
    else { setMode(s); if (typeof goTop === "function") goTop(); }
  } catch (x) {}
  navRetour = false;
});
/* Le carre « partie en cours » ramene a la partie (avant la liste des parties
   de corr.js : ecoute en capture). */
document.addEventListener("click", e => {
  const c = e.target.closest && e.target.closest("#carreParties");
  if (!c || !/^partie-/.test(c.dataset.etat || "")) return;
  const p = navPartie();
  if (!p) return;
  e.stopPropagation();
  setMode(p);
  if (typeof goTop === "function") goTop();
}, true);
document.addEventListener("click", e => {
  if (!e.target.closest || !e.target.closest("[data-retour-jeu]")) return;
  const p = navPartie();
  if (!p) return;
  setMode(p);
  if (typeof goTop === "function") goTop();
});
/* ---------- Retour a l'ecran d'avant (2026-11-24, decisions d'Alexandre :
   « A + glisser », et « Ok pour Pas de fenetre […] pas de bouton retour en
   haut » pendant une partie) ----------
   1. Un bouton « ‹ Resoudre » / « ‹ Jouer » / « ‹ Retour » en haut des
      sous-ecrans : Travailler un motif, les reglages de partie (ordinateur,
      ami, joueur en ligne) tant qu'aucune partie n'est a l'ecran, et
      Preferences, Accessibilite, pages legales.
   2. Sur telephone, glisser depuis le bord gauche vers la droite fait la meme
      chose (jamais pendant une partie : il n'y a alors pas de bouton).
   3. Preferences, Accessibilite et pages legales ramenent EXACTEMENT ou l'on
      etait (remarque d'Alexandre : « il ne faut plus que l'on perde ou l'on
      est ») : l'ecran, son sous-ecran (l'exercice en cours n'est pas
      remplace) et la position dans la page. Le bouton Retour du navigateur
      aussi. Pendant une partie, la ligne « Retour a la partie » reste. */
const NAV_PAGES = ["prefs", "legal"];
let navDepuis = null;
function navPlace() {
  return { m: mode, y: window.scrollY || window.pageYOffset || 0, e: mode === "puzzles" && typeof solveScreen !== "undefined" ? solveScreen : "" };
}
function navAller(p) {
  if (p.m === "puzzles" && p.e && typeof solveScreenSuppressAutoload !== "undefined") {
    /* Revenir sur l'exercice en cours sans en charger un autre. */
    solveScreenSuppressAutoload = true;
    try { setMode("puzzles", { screen: p.e }); } finally { solveScreenSuppressAutoload = false; }
  } else setMode(p.m);
  const y = p.y || 0;
  const poser = () => { try { window.scrollTo(0, y); } catch (e) {} };
  poser();
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => { poser(); requestAnimationFrame(poser); });
}
/* Ou mene le bouton sur l'ecran affiche, et ou il se pose ; null s'il n'y en a pas. */
function navRetourCible() {
  try {
    if (NAV_PAGES.includes(mode)) {
      const p = navPartie();
      if (p && mode !== p) return null;            /* la ligne « Retour a la partie » s'en charge */
      const pane = $("pane-" + mode), panel = pane && pane.querySelector(".panel");
      return panel ? { libelle: t("Back"), lieu: panel, aller: () => { const d = navDepuis; navDepuis = null; if (d && !NAV_PAGES.includes(d.m)) navAller(d); else { setMode("home"); if (typeof goTop === "function") goTop(); } } } : null;
    }
    if (mode === "puzzles" && typeof solveScreen !== "undefined" && solveScreen === "motifs")
      return { libelle: t("Solve"), lieu: $("solveMotifsScreen"), aller: () => { showSolveScreen("menu"); if (typeof goTop === "function") goTop(); } };
    if ((mode === "play" || mode === "friend") && typeof ecranDePartie === "function" && !ecranDePartie()) {
      const pane = $(mode === "play" ? "pane-play" : "pane-friend");
      const panel = mode === "play" ? $("settingsPanel") : pane && [...pane.querySelectorAll(".panel")].find(x => !x.classList.contains("hide") && x.offsetParent !== null);
      if (!panel || panel.classList.contains("hide")) return null;
      return { libelle: t("Play"), lieu: panel, aller: () => { setMode("jouer"); if (typeof goTop === "function") goTop(); } };
    }
  } catch (e) {}
  return null;
}
let navRetourAller = null;
function navRetourMaj() {
  let b = document.getElementById("retourEcran");
  const c = navRetourCible();
  if (!c) { if (b) b.hidden = true; navRetourAller = null; return; }
  if (!b) {
    b = document.createElement("button");
    b.type = "button"; b.id = "retourEcran"; b.className = "retour-ecran";
    b.addEventListener("click", () => { if (navRetourAller) navRetourAller(); });
  }
  if (b.parentNode !== c.lieu || c.lieu.firstElementChild !== b) c.lieu.insertBefore(b, c.lieu.firstChild);
  const txt = "‹ " + c.libelle;
  if (b.textContent !== txt) b.textContent = txt;
  b.setAttribute("aria-label", c.libelle === t("Back") ? c.libelle : t("Back") + " : " + c.libelle);
  b.hidden = false;
  navRetourAller = c.aller;
}
if (typeof showSolveScreen === "function") {
  const av = showSolveScreen;
  showSolveScreen = function () { const r = av.apply(this, arguments); try { navRetourMaj(); } catch (e) {} return r; };
}
/* Glisser depuis le bord gauche vers la droite : le meme retour. */
{
  let x0 = -1, y0 = 0, t0 = 0;
  document.addEventListener("touchstart", e => {
    const p = e.touches && e.touches[0];
    x0 = p && e.touches.length === 1 && p.clientX <= 28 ? p.clientX : -1; y0 = p ? p.clientY : 0; t0 = Date.now();
  }, { passive: true });
  document.addEventListener("touchend", e => {
    if (x0 < 0) return;
    const p = e.changedTouches && e.changedTouches[0], dx = p ? p.clientX - x0 : 0, dy = p ? Math.abs(p.clientY - y0) : 99;
    x0 = -1;
    if (dx < 70 || dy > 50 || Date.now() - t0 > 700) return;
    const b = document.getElementById("retourEcran");
    if (b && !b.hidden && navRetourAller) navRetourAller();
  }, { passive: true });
}
/* La partie peut finir ou commencer pendant qu'on est ailleurs (pendule,
   invitation acceptee) : le repere suit, sans attendre un changement d'ecran. */
setInterval(navRepere, 2000);
try { window.history.replaceState({ c64: mode }, ""); } catch (e) {}
navRepere();

/* Le clavier de l'iPhone cachait le champ « Chercher un membre » (capture
   d'Alexandre, 27/11) : dans le menu, panneau fixe qui defile lui-meme,
   Safari ne fait pas remonter le champ au-dessus du clavier. Quand un champ
   du menu (ou d'une fenetre) prend la main et que le clavier est ouvert
   (visualViewport plus bas que la fenetre), on fait defiler son panneau pour
   poser le champ en haut de la partie visible, ses resultats dessous. Une
   marge provisoire sous le contenu (une hauteur de panneau) laisse la place
   de defiler ; elle part avec le clavier. */
const clavier = { champ: null, defileur: null, marge: null };
function clavierDefileur(el) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (/(auto|scroll)/.test(cs.overflowY) && p.clientHeight > 0) return p;
  }
  return null;
}
function clavierDegager() {
  const v = window.visualViewport, el = clavier.champ, d = clavier.defileur;
  if (!v || !el || !d || document.activeElement !== el) return;
  const cache = window.innerHeight - v.height - v.offsetTop;   /* hauteur sous le clavier */
  if (cache < 80) return;                                      /* pas de clavier ouvert */
  const haut = v.offsetTop, bas = v.offsetTop + v.height;
  const r = (el.closest("label") || el).getBoundingClientRect();
  if (r.top >= haut + 8 && r.bottom <= bas - 160) return;      /* deja visible, place pour les resultats */
  if (clavier.marge === null) { clavier.marge = d.style.paddingBottom; d.style.paddingBottom = (parseFloat(getComputedStyle(d).paddingBottom) + d.clientHeight) + "px"; }
  d.scrollTop += r.top - (haut + 12);
}
document.addEventListener("focusin", e => {
  const el = e.target;
  if (!el || !el.matches || el.readOnly || !el.matches('input[type="search"],input[type="text"],input[type="email"],input[type="password"],input[inputmode],input:not([type]),textarea')) return;
  if (!el.closest('.tiroir,[role="dialog"]')) return;
  clavier.champ = el; clavier.defileur = clavierDefileur(el);
  setTimeout(clavierDegager, 350);
});
document.addEventListener("focusout", e => {
  if (e.target !== clavier.champ) return;
  if (clavier.defileur && clavier.marge !== null) clavier.defileur.style.paddingBottom = clavier.marge;
  clavier.champ = clavier.defileur = clavier.marge = null;
});
if (window.visualViewport) window.visualViewport.addEventListener("resize", () => setTimeout(clavierDegager, 60));
