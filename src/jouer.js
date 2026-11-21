/* chang64 - l'onglet « Jouer » et les pictogrammes des cartes (2026-11-19)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Un seul onglet « Jouer » (decision d'Alexandre, apres comparaison avec
 * Lichess et Chess.com) : il ouvre sur deux grandes cartes, « Contre
 * l'ordinateur » et « Contre un ami », qui menent chacune a son propre ecran.
 * Les deux jeux ne sont pas fusionnes, seule la porte d'entree est commune.
 *
 * Les anciens onglets #tab-play et #tab-friend restent dans la page, masques,
 * avec leur comportement d'avant : tout ce qui les declenche (liens profonds,
 * cartes de l'accueil, tests) continue de marcher. L'onglet visible est
 * #tab-jouer ; il reste allume dans les trois cas (choix, ordinateur, ami).
 *
 * PICTOS vient de pictos_build.js (colle juste avant ce fichier). */
function pictoHtml(nom, taille) {
  if (typeof PICTOS === "undefined" || !PICTOS[nom]) return "";
  return '<span class="picto' + (taille ? " " + taille : "") + '" aria-hidden="true"><svg viewBox="-24 -24 48 48" focusable="false">' + PICTOS[nom] + "</svg></span>";
}
/* Le picto de chaque carte de Resoudre et de chaque rubrique d'Explorer. */
const PICTOS_RESOUDRE = { cardSolvePuzzles: "exercices", cardSolveDaily: "jour", cardSolveDuel: "defi", cardSolveMistakes: "erreurs",
  cardSolveSprint: "sprint", cardSolveCoord: "coord", cardSolveEndgames: "finales", cardSolveMotifs: "motif" };
const PICTOS_EXPLORER = { openings: "ouvertures", learn: "regles", glossary: "lexique", endgames: "finales", traps: "pieges", puzzles: "biblio" };

/* Une partie contre l'ordinateur est-elle en cours ? Alors « Jouer » y ramene
   au lieu de reposer la question. */
function jouerPartieOrdi() {
  try {
    if (mode === "play") return !!gameStarted && !resultInfo;
    return !!(mainGame && mainStarted);
  } catch (e) { return false; }
}
function jouerPartieAmi() { return typeof directOccupe === "function" && directOccupe(); }

function jouerRendre() {
  const p = $("pane-jouer"); if (!p) return;
  /* Le direct est reserve aux membres : un visiteur lit la partie par lien,
     qu'il peut jouer tout de suite (2026-11-21, ouverture a tous). */
  const direct = typeof DIRECT_OUVERT !== "undefined" && DIRECT_OUVERT && typeof estMembre === "function" && estMembre();
  const d = $("jouerAmiTexte");
  if (d) d.textContent = t(direct ? "A live game, on the clock, with another member. Invite them by username or send them a link."
    : "Every move becomes a link. Send it on WhatsApp or Messenger, your friend replies whenever they like. Nothing to install, and no excuse not to play.");
  for (const [id, nom] of [["jouerOrdiPicto", "ordinateur"], ["jouerAmiPicto", "ami"], ["jouerEnLignePicto", "enligne"]]) {
    const e = $(id); if (e && !e.firstChild) poserHtml(e, pictoHtml(nom, "grand"));
  }
  /* « Contre un joueur en ligne » : reservee aux membres. Un visiteur la voit
     verrouillee, et elle le mene a la creation de compte. */
  const c = $("jouerEnLigne"), go = $("jouerEnLigneGo");
  if (c && go) {
    c.classList.toggle("verrou", !direct);
    go.textContent = t(direct ? "Find an opponent →" : "Free with an account →");
  }
}

{
  const avant = setMode;
  setMode = function (m, opts) {
    const pj = $("pane-jouer");
    if (m === "jouer" && pj) {
      /* On passe par l'ecran Explorer, qui sait deja tout masquer (echiquier,
         pendules, panneaux), puis on met le choix a sa place. */
      avant.call(this, "explore");
      const pe = $("pane-explore"); if (pe) pe.classList.add("hide");
      mode = "jouer";
      document.body.dataset.mode = "jouer";
      pj.classList.remove("hide");
      markTab($("tab-explore"), false);
      markTab($("tab-jouer"), true);
      jouerRendre();
      return;
    }
    const r = avant.apply(this, arguments);
    if (pj) pj.classList.add("hide");
    markTab($("tab-jouer"), mode === "play" || mode === "friend");
    return r;
  };
}

if ($("tab-jouer")) {
  $("tab-jouer").onclick = () => {
    setMode(jouerPartieOrdi() ? "play" : jouerPartieAmi() ? "friend" : "jouer");
    goTop();
  };
  $("jouerOrdi").onclick = () => { setMode("play"); goTop(); };
  $("jouerAmi").onclick = () => { setMode("friend"); if (typeof amiModeRegler === "function") amiModeRegler(amiModeDefaut()); goTop(); };
  if ($("jouerEnLigne")) $("jouerEnLigne").onclick = () => {
    if (!(typeof estMembre === "function" && estMembre())) { if (typeof menuOuvrir === "function") { menuOuvrir(); menuVue("compte"); } return; }
    setMode("friend"); if (typeof amiModeRegler === "function") amiModeRegler("hasard"); goTop();
  };
  /* La carte de l'accueil mene au meme ecran, dans son etat par defaut. */
  if ($("cardFriend")) $("cardFriend").addEventListener("click", () => { if (typeof amiModeRegler === "function") amiModeRegler(amiModeDefaut()); });
}

/* Les cartes de Resoudre recoivent leur picto a gauche ; leur texte est
   regroupe pour que la mise en page ne depende pas du nombre de lignes. */
for (const id in PICTOS_RESOUDRE) {
  const c = $(id);
  if (!c || c.querySelector(".picto")) continue;
  const texte = document.createElement("span");
  texte.className = "solveCard-texte";
  while (c.firstChild) texte.appendChild(c.firstChild);
  c.insertAdjacentHTML("afterbegin", pictoHtml(PICTOS_RESOUDRE[id]));
  c.appendChild(texte);
  c.classList.add("avec-picto");
}
/* Les trois cartes de l'accueil portent les memes pictos que les ecrans ou
   elles menent : meme dessin pour « contre l'ordinateur » ici et dans Jouer. */
for (const [id, nom] of [["icoPlay", "ordinateur"], ["icoPuzzles", "exercices"], ["icoFriend", "ami"]]) {
  const e = $(id), h = pictoHtml(nom);
  if (e && h) { poserHtml(e, h); e.classList.add("avec-picto"); }
}
/* Menu : « Defis entre membres » portait une epee seule, les fenetres de defi
   deux epees croisees. Un meme symbole, une meme forme. */
{
  const s = document.querySelector('[data-vue-defis-membres] svg.tiroir-ico');
  if (s && typeof PICTOS !== "undefined" && PICTOS.defi) { s.setAttribute("viewBox", "-24 -24 48 48"); poserHtml(s, PICTOS.defi); }
}
