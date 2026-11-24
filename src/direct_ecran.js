/* chang64 - partie en direct entre deux membres : l'ecran (2026-11-19)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * S'installe dans l'onglet « Jouer avec un ami » (mode "friend") et se sert
 * de son echiquier. Tant qu'une partie en direct est ouverte, trois fonctions
 * de l'application lui passent la main (elles testent directActif()) :
 * showAmi -> directMontrer, handleAmiClick -> directClic,
 * renderClocks -> directPendules ; renderResult (ui2.js) lui demande
 * d'enregistrer la partie et confie « Revanche » a son bouton.
 * Le fil avec le serveur est dans direct.js. Le serveur decide de tout : un
 * coup joue ici est montre tout de suite, puis l'etat recu fait foi.
 *
 * OUVERT A TOUS depuis le 21/11/2026 (decision d'Alexandre, apres sa partie
 * reussie a deux comptes). Le serveur exige toujours un membre connecte : un
 * visiteur sans compte voit l'invitation a en creer un.
 */
const DIRECT_LIEN = /^#partie=([a-z2-9]{12})$/;
/* Le rideau d'acces reserve (?direct=essai, 19/11) est leve : DIRECT_OUVERT
   reste une constante pour que le code qui la lit ne change pas. L'ancienne
   cle chang64:direct est effacee, devenue sans objet. */
const DIRECT_OUVERT = true;
try { localStorage.removeItem("chang64:direct"); } catch (e) {}
let directF = null, directE = null, directId = "", directCad = 0;
let directJeu = null, directSan = [], directVu = "", directCoupe = false, directMessage = "", directAttenteCoup = false;
let directInvite = "";            /* pseudo du membre que je viens d'inviter */
const directDeclinees = {};       /* invitations deja montrees ou refusees sur cette page */
let directGuet = 0;
let directHasard = null;          /* je cherche un adversaire au hasard : { cad, depuis } */
let directCoul = "h";             /* couleur demandee pour la partie que je cree : b, n ou h (au hasard) */
let directCat = 1;                /* famille choisie dans AMI_FAMILLES : 0 = blitz, 1 = rapides (par defaut), 2 = classiques, 3 = correspondance */
/* Les familles de l'ecran (2026-11-22) : les trois a la pendule, puis la
   correspondance. C'est la CADENCE qui dit si la partie est en direct ou par
   correspondance : il n'y a plus de bandeau pour le choisir. */
const AMI_FAMILLES = DIRECT_FAMILLES.concat([["Correspondence", DIRECT_CORR]]);
const AMI_CORR = AMI_FAMILLES.length - 1;
/* Ecran « Contre un ami » : direct (le bloc de lancement entre membres, a la
   pendule ou par correspondance selon la cadence), lien (la partie par lien,
   sans compte), ou hasard (« Contre un joueur en ligne », meme bloc sans
   couleur ni adversaire). */
let amiMode = "lien";
/* Le bloc de lancement prepare une partie par correspondance. */
function amiCorr() { return amiMode !== "lien" && directCat === AMI_CORR; }
/* La partie ouverte a l'ecran est une partie par correspondance. */
function directEstCorr() { return !!(directE && directE.cad && directE.cad[0] >= 86400); }
/* Un membre arrive sur le bloc de lancement, toujours ; un visiteur sur la
   partie par lien. Une partie par lien deja commencee ne s'impose plus : elle
   est dans « Tes parties en cours » (corr.js). Avant le 2026-11-22, toute
   trace d'une partie par lien, meme finie, rouvrait l'echiquier d'office. */
function amiModeDefaut() { return typeof estMembre === "function" && estMembre() ? "direct" : "lien"; }
/* Vrai quand l'ecran ne montre pas la partie par lien (et qu'aucune partie en direct n'est ouverte). */
function amiHorsLien() { return amiMode !== "lien" && !directId; }
/* Rapide 10+0 a chaque arrivee sur l'ecran (2026-11-24, decision d'Alexandre :
   « Toujours Rapide 10+0 »). Avant, la derniere cadence etait retenue sur
   l'appareil, et un joueur qui avait choisi la correspondance y retombait.
   Appele par les cartes de Jouer et de l'accueil (jouer.js). */
function amiCadenceDefaut() { directCat = 1; directCad = AMI_FAMILLES[1][1][0]; if ($("directCats")) directCadencesRendre(); }
function amiModeRegler(m) {
  /* « corr » etait un choix du bandeau : c'est desormais la famille Correspondance. */
  if (m === "corr") { directCat = AMI_CORR; m = "direct"; }
  amiMode = m === "direct" || m === "hasard" ? m : "lien";
  const p = $("pane-friend"); if (!p) return;
  const c = amiCorr();
  p.dataset.ami = amiMode;
  p.dataset.corr = c ? "1" : "";
  const ti = $("directTitre"), so = $("directSous");
  if (ti) ti.textContent = t(amiMode === "hasard" ? "Against a player online" : "Against a friend");
  if (so) so.textContent = t(amiMode === "hasard" ? (c ? "A correspondence game against an opponent picked at random, close to your level. Colours are drawn at random."
      : "A live game against an opponent picked at random, close to your level. Colours are drawn at random.")
    : c ? "Everyone plays when they like, with no clock to watch. The game waits for you here, even if you close the site."
    : "Play a friend in real time, with a clock. Invite them by username, or send them a link.");
  /* La cadence suit la famille : un delai en jours, ou une cadence a la pendule. */
  if (!AMI_FAMILLES[directCat][1].includes(directCad)) directCad = directCat === AMI_CORR ? DIRECT_CORR[1] : AMI_FAMILLES[directCat][1][0];
  directMessage = "";
  amiAnnexes();
  if (mode === "friend" && !directId) showAmi(); else directPanneau();
}
/* Autour de la partie par lien : le retour vers l'invitation d'un membre, ou,
   pour un visiteur, ce qu'un compte apporte. */
function amiAnnexes() {
  const membre = typeof estMembre === "function" && estMembre();
  const r = $("amiRetourMembre"), c = $("amiComptePanel");
  if (r) r.classList.toggle("hide", !membre);
  if (c) c.classList.toggle("hide", membre);
}
/* Indices de defilement d'une rangee .defile : de quel cote il reste a voir. */
function defileMaj(enveloppe) {
  const el = enveloppe && enveloppe.firstElementChild; if (!el) return;
  const max = el.scrollWidth - el.clientWidth;
  enveloppe.classList.toggle("has-scroll-left", el.scrollLeft > 2);
  enveloppe.classList.toggle("has-scroll-right", el.scrollLeft < max - 2);
}
/* Toute rangee de familles de cadences (accueil, contre l'ordinateur, contre
   un ami) tient sur une ligne qui defile de cote, SANS barre de defilement
   (retour d'Alexandre : pas de barre dans le navigateur), avec le degrade et
   le chevron au bord. La rangee recoit son enveloppe .defile si elle n'en a
   pas, et ses indices se tiennent a jour seuls. */
function defileBrancher(rangee) {
  let enveloppe = rangee.parentNode;
  if (!enveloppe || !enveloppe.classList.contains("defile")) {
    enveloppe = document.createElement("div"); enveloppe.className = "defile";
    rangee.parentNode.insertBefore(enveloppe, rangee); enveloppe.appendChild(rangee);
  }
  if (enveloppe.dataset.branche) return;
  enveloppe.dataset.branche = "1";
  const maj = () => defileMaj(enveloppe);
  rangee.addEventListener("scroll", maj, { passive: true });
  window.addEventListener("resize", maj);
  if (typeof MutationObserver === "function") new MutationObserver(maj).observe(rangee, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["aria-pressed", "class"] });
  maj();
}
let directAnime = "";              /* dernier coup deja anime : partie/manche/nombre de coups */
let directRefus = "";              /* ma nulle vient d'etre declinee : partie/manche/nombre de coups */
let directTic = "";                /* alerte des 10 secondes deja sonnee pour cette partie/manche */

function directActif() { return !!directId && mode === "friend"; }
/* Une partie se joue en ce moment : ni felicitations ni defi recu avant la fin. */
function directOccupe() { return !!(directE && (directE.phase === "debut" || directE.phase === "jeu")); }
function directAdv() { const e = directE; return e ? (e.moi === "b" ? e.nr : e.b) || t("Opponent") : t("Opponent"); }
function directUrl() { return location.origin + location.pathname + "#partie=" + directId; }
function directTexteCadence(c) {
  if (c[0] >= 86400) return t(c[0] === 86400 ? "{n} day/move" : "{n} days/move", { n: c[0] / 86400 });
  return (c[0] / 60) + "+" + c[1];
}

/* ---------- Panneau ---------- */
function directPanneau() {
  const p = $("directPanel"); if (!p) return;
  p.classList.toggle("hide", !DIRECT_OUVERT);
  if (!DIRECT_OUVERT) return;
  const membre = typeof estMembre === "function" && estMembre();
  const e = directE, enJeu = !!directId, parCorr = directEstCorr();
  $("pane-friend").classList.toggle("en-direct", enJeu);
  $("directInvite").classList.toggle("hide", membre || enJeu);
  if (!membre && !enJeu) poserHtml($("directInvite"), inviteMembre("Create a free account to play live against other members."));
  $("directNouveau").classList.toggle("hide", !membre || enJeu);
  /* Par correspondance, pas de lien a envoyer : l'invite est prevenu dans sa liste. */
  $("directLienBloc").classList.toggle("hide", !(enJeu && e && e.phase === "attente" && !parCorr));
  $("directStatus").classList.toggle("hide", !enJeu && !directMessage);
  const jouee = e && (e.phase === "debut" || e.phase === "jeu"), finie = e && e.phase === "fin";
  $("btnDirectNulle").classList.toggle("hide", !(e && e.phase === "jeu" && e.nulle !== (e.moi === "b" ? "n" : "b")));
  $("btnDirectNulle").disabled = !!(e && e.nulle);
  $("btnDirectAccepter").classList.toggle("hide", !(e && e.phase === "jeu" && e.nulle && e.nulle !== e.moi));
  $("btnDirectRefuser").classList.toggle("hide", !(e && e.phase === "jeu" && e.nulle && e.nulle !== e.moi));
  /* Nulle proposee par l'adversaire : Accepter et Refuser sur leur rangee, Abandonner dessous (360 px). */
  p.classList.toggle("nulle-recue", !!(e && e.phase === "jeu" && e.nulle && e.nulle !== e.moi));
  /* Par correspondance, « Retour a mes parties » a sa propre rangee (360 px). */
  p.classList.toggle("corr-partie", parCorr);
  $("btnDirectAbandon").classList.toggle("hide", !jouee);
  $("btnDirectRevanche").classList.toggle("hide", !finie || !e.fin.r);
  $("btnDirectRevanche").disabled = !!(finie && (e.rev[e.moi] || directRevancheCorr === e.id));
  /* Par correspondance on quitte l'ecran quand on veut : la partie attend sur le serveur. */
  $("btnDirectQuitter").classList.toggle("hide", !(enJeu && (!jouee || parCorr)));
  $("btnDirectQuitter").textContent = t(parCorr ? "Back to my games" : "Leave");
  { const an = $("btnDirectAnnuler"); if (an) {
    an.classList.toggle("hide", !(parCorr && e.phase === "attente"));
    an.textContent = t(e && e.inv ? "Cancel the invitation" : "Cancel the search");
  } }
  directCadencesRendre();
  { const seg = $("directCouleur"); if (seg) for (const b of seg.children) b.setAttribute("aria-pressed", String(b.dataset.v === directCoul)); }
  { const r = $("directResume"); if (r) r.textContent = e && e.phase === "attente" ? directTexteCadence(e.cad) + " | " + t(e.moi === "b" ? "You play White." : "You play Black.") : ""; }
  if (membre && !enJeu) directAmis();
}
/* Mes amis en pastilles : un appui choisit l'ami a inviter (un second l'enleve).
   La liste vient du compte (cpaCharger, gardee une minute). */
async function directAmis() {
  const bloc = $("directAmisBloc"), el = $("directAmis");
  if (!bloc || !el || typeof cpaCharger !== "function") return;
  const a = await cpaCharger();
  const noms = a && Array.isArray(a.amis) ? a.amis.map(x => String(x.p)).sort((x, y) => x.localeCompare(y)) : [];
  bloc.classList.toggle("hide", !noms.length);
  /* Avec des amis en pastilles, le champ sert a « un autre pseudo ». */
  { const champ = $("directPseudo"); if (champ) champ.placeholder = t(noms.length ? "or another username" : "Username"); }
  if (el.dataset.noms === noms.join("|")) return;
  el.dataset.noms = noms.join("|");
  el.textContent = "";
  const champ = $("directPseudo");
  const marquer = () => [...el.children].forEach(b => b.setAttribute("aria-pressed", b.textContent === champ.value.trim()));
  for (const n of noms) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = n;
    b.onclick = () => { champ.value = champ.value.trim() === n ? "" : n; marquer(); };
    el.appendChild(b);
  }
  champ.oninput = marquer;
  marquer();
}
/* Depuis « Mes amis » du menu : ouvre l'ecran et cree la partie avec cet ami. */
function directInviterAmi(pseudo) {
  if (!DIRECT_OUVERT || !pseudo) return;
  setMode("friend");
  if (directId) { if (directOccupe()) return; directQuitter(true); }
  amiModeRegler("direct");
  $("directPseudo").value = pseudo;
  if (typeof goTop === "function") goTop();
  directCreerPartie();
}
function directDire(texte, ton) {
  const st = $("directStatus"); if (!st) return;
  st.className = "status" + (ton ? " " + ton : "");
  st.textContent = texte;
}

/* ---------- Etat recu ---------- */
const DIRECT_MOTIFS = { mat: "Checkmate.", temps: "Time is up.", abandon: "Resignation.", refusee: "{name} can't play right now.", accord: "Draw agreed.", pat: "Stalemate.",
  repetition: "The same position came three times.", "50": "Fifty moves without a capture or a pawn move.",
  materiel: "Not enough pieces left to checkmate.", annulee: "Game cancelled: the first move was not played within a minute." };
function directResultat(e) {
  if (!e.fin.r) return "annulee";
  if (e.fin.r === "1/2") return "draw";
  return (e.fin.r === "1-0") === (e.moi === "b") ? "win" : "loss";
}
/* Le motif de la fin, dit pour celui qui lit : qui a abandonne, qui a manque de temps. */
function directMotif(e) {
  const m = e.fin.m, r = directResultat(e), nom = { name: directAdv() };
  if (m === "refusee") return t(DIRECT_MOTIFS.refusee, { name: e.inv || directInvite || t("Opponent") });
  if (m === "abandon" && r !== "draw") return r === "win" ? t("{name} resigned.", nom) : t("You resigned.");
  if (m === "temps" && r !== "draw") return r === "win" ? t("{name} ran out of time.", nom) : t("You ran out of time.");
  if (m === "annulee" && directEstCorr()) return t("Game cancelled: the first move was not played in time.");
  return t(DIRECT_MOTIFS[m] || "");
}
/* Cadences du bloc de lancement : quatre familles sur une ligne (Blitz, Rapide,
   Classique, Correspondance), puis les cadences de la famille choisie.
   Reconstruit seulement quand la famille change. */
function directCadencesRendre() {
  const cats = $("directCats"), el = $("directCadences"); if (!cats || !el) return;
  const c = amiCorr(), titre = $("directCadenceTitre");
  if (titre) titre.textContent = t(c ? "Time per move" : "Time control");
  if (!cats.children.length) {
    AMI_FAMILLES.forEach(([nom], k) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = t(nom); b.dataset.fam = String(k);
      b.onclick = () => {
        directCat = k; directCad = k === AMI_CORR ? DIRECT_CORR[1] : AMI_FAMILLES[k][1][0];
        /* Le sous-titre, le lien a envoyer et les cadences suivent la famille. */
        amiModeRegler(amiMode);
      };
      cats.appendChild(b);
    });
  }
  [...cats.children].forEach((b, k) => b.setAttribute("aria-pressed", String(k === directCat)));
  /* La famille choisie reste visible dans la rangee, puis les indices du bord. */
  { const actif = cats.children[directCat], enveloppe = $("directCatsDefile");
    if (actif && cats.clientWidth && (actif.offsetLeft < cats.scrollLeft || actif.offsetLeft + actif.offsetWidth > cats.scrollLeft + cats.clientWidth))
      cats.scrollLeft = Math.max(0, actif.offsetLeft - (cats.clientWidth - actif.offsetWidth) / 2);
    if (enveloppe) defileMaj(enveloppe); }
  const famille = String(directCat);
  if (el.dataset.cat !== famille) {
    el.dataset.cat = famille;
    el.textContent = "";
    for (const i of AMI_FAMILLES[directCat][1]) {
      const b = document.createElement("button"), jours = DIRECT_CADENCES[i][0] / 86400;
      b.type = "button"; b.className = "chip"; b.dataset.cad = String(i);
      b.textContent = c ? t(jours === 1 ? "{n} day" : "{n} days", { n: jours }) : directTexteCadence(DIRECT_CADENCES[i]);
      b.onclick = () => { directCad = i; directCadencesRendre(); };
      el.appendChild(b);
    }
  }
  [...el.children].forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.cad === directCad)));
  directCadenceNote();
}
function directCadenceNote() {
  const n = $("directCadenceNote"), c = DIRECT_CADENCES[directCad]; if (!n) return;
  if (directCadCorr(directCad)) {
    const j = c[0] / 86400;
    n.textContent = t(j === 1 ? "Each player has {n} day for every move. After that, the game is lost, or cancelled if one of you has not played a first move yet." : "Each player has {n} days for every move. After that, the game is lost, or cancelled if one of you has not played a first move yet.", { n: j });
    return;
  }
  n.textContent = c[1] ? t("{n} minutes each, plus {s} seconds added after every move.", { n: c[0] / 60, s: c[1] }) : t("{n} minutes each for the whole game.", { n: c[0] / 60 });
}
/* Sons de la partie en direct (2026-11-21) : ce qui vient de changer entre
   l'etat d'avant et celui qu'on recoit. Une nouvelle partie ou une revanche
   qui commence a deja son son de debut ; la fin de partie (mat, temps, nulle,
   abandon) sonne dans renderResult, comme contre l'ordinateur. */
function directSons(avant, e) {
  if (!avant || avant.id !== e.id || avant.n !== e.n) return;
  const moi = e.moi, autre = moi === "b" ? "n" : "b";
  try {
    if (e.phase === "debut" || e.phase === "jeu") {
      /* Nulle proposee par l'adversaire : son d'appel. */
      if (e.nulle === autre && avant.nulle !== autre) SON.appel();
      /* Ma proposition a disparu sans que la partie finisse : declinee (par un refus ou par un coup). */
      else if (avant.nulle === moi && !e.nulle) { SON.refus(); directRefus = e.id + "/" + e.n + "/" + e.coups.length; }
      /* Adversaire parti, puis revenu (pas a son arrivee dans la partie). */
      if (e.cad[0] < 86400 && avant.phase === e.phase && avant.la && e.la && !!avant.la[autre] !== !!e.la[autre]) (e.la[autre] ? SON.retour : SON.depart)();
    } else if (e.phase === "fin" && avant.phase === "fin") {
      /* Revanche demandee par l'adversaire. */
      if (e.rev && e.rev[autre] && !(avant.rev && avant.rev[autre]) && !e.rev[moi]) SON.appel();
    }
  } catch (x) {}
}
function directRecu(e) {
  const neuve = !directE || directE.n !== e.n, debutee = directE && directE.phase === "attente" && e.phase !== "attente";
  directSons(directE, e);
  directE = e; directCoupe = false; directAttenteCoup = false;
  directJeu = new Game(); directSan = [];
  for (const c of e.coups) {
    const m = directJeu.moveFromUci ? directJeu.moveFromUci(c) : directJeu.moves().find(x => directJeu.uci(x) === c);
    if (!m) break;
    directSan.push(directJeu.san(m)); directJeu.makeMove(m);
  }
  if (neuve) { flipped = e.moi === "n"; resultDismissed = false; directVu = ""; }
  if (e.phase !== "attente") directHasard = null;
  if ((neuve && e.phase !== "attente") || debutee) { try { SON.debut(); } catch (x) {} }
  if (mode === "friend") directMontrer();
  /* Par correspondance, chaque etat peut changer la liste et la pastille. */
  if (e.cad[0] >= 86400 && typeof corrBientot === "function") corrBientot();
  /* Badges des parties entre membres : seulement une fois la partie finie (badges_membres.js). */
  if (typeof bxmFin === "function") bxmFin(e);
}
function directMontrer() {
  const e = directE;
  directPanneau();
  if (!e) return;
  game = directJeu;
  legalCache = e.phase === "debut" || e.phase === "jeu" ? game.moves() : [];
  lastMove = game.history.length ? game.history[game.history.length - 1].m : null;
  /* Une de mes pieces prise en main pendant le tour adverse reste en main
     quand son coup arrive (2026-11-21, premove.js) ; sinon rien n'est choisi. */
  { const mienne = selected >= 0 ? game.board[selected] : 0;
    if (!(mienne && pC(mienne) === (e.moi === "b" ? W : B) && (e.phase === "debut" || e.phase === "jeu"))) selected = -1; }
  marks = {};
  /* Chaque etat recu refait la partie, donc un nouvel objet « dernier coup » :
     sans ceci, render() rejouait l'animation du meme coup a chaque message du
     serveur (confirmation de mon coup, nulle proposee, adversaire absent). */
  { const cle = e.id + "/" + e.n + "/" + e.coups.length;
    /* Un coup arrive pendant qu'on regardait un coup passe : retour a la
       position actuelle, avec son deplacement et son son. Un message sans
       nouveau coup (nulle proposee, adversaire absent) laisse la vue ou elle
       est (2026-11-21). */
    if (cle !== directAnime) vueActuelle();
    else if (lastMove && !reviewGame) lastAnimated = lastMove;
    directAnime = cle; }
  render();
  renderSheetInto("amiSheet", directSan, reviewPly); renderNavLecture(directSan);
  const assis = e.phase !== "attente";
  const bw = document.querySelector(".board-wrap"); if (bw) bw.classList.toggle("hide", !assis);
  const sp = $("amiScoresheetPanel"); if (sp) sp.classList.toggle("hide", !assis);
  /* Le bandeau de coups vit dans #boardTools (2026-11-21) : on le garde, sans
     le bouton de retournement, inutile ici (chacun voit sa couleur en bas). */
  const bt = $("boardTools"); if (bt) bt.classList.toggle("hide", !assis);
  const fb = $("btnFlip"); if (fb) fb.hidden = true;
  majLayoutSolo();
  directPendules();
  const trait = e.coups.length % 2 ? "n" : "b", autre = e.moi === "b" ? "n" : "b";
  if (e.phase === "attente" && directEstCorr()) {
    directDire(e.inv ? t("Waiting for {name}'s answer. The invitation is valid for 7 days.", { name: e.inv })
      : t("Looking for an opponent. Your search stays open for 7 days: the game starts as soon as another member looks for the same time per move."));
  } else if (e.phase === "attente") {
    directDire(directHasard ? (Date.now() - directHasard.depuis > 60000 ? t("Nobody is looking right now. Keep this page open, or send this link to a friend.") : t("Looking for an opponent close to your level… You can also send this link to a friend."))
      : e.inv || directInvite ? t("{name} is invited and will see it if the site is open. You can also send this link.", { name: e.inv || directInvite }) : t("Send this link to your opponent. The game starts when they open it."));
    $("directAdresse").value = directUrl();
    shareButtons($("directPartage"), directUrl(), t("Play me live on chang64:"), true);
  } else if (e.phase === "fin") {
    const r = directResultat(e), motif = directMotif(e);
    /* Invitation declinee : une phrase, pas de fenetre de fin. */
    if (e.fin.m === "refusee") { directDire(motif); renderResult(false); return; }
    /* L'adversaire a quitte la partie alors que j'attends sa reponse : le dire
       tout de suite, sans laisser « Tu as demande une revanche » a l'ecran. */
    if (directEstCorr()) directDire(directRevancheCorr === e.id ? t("Invitation sent to {name}.", { name: directAdv() }) : motif, r === "win" ? "win" : r === "loss" ? "lose" : "");
    else directDire(e.rev[autre] && !e.rev[e.moi] ? t("Your opponent wants a rematch.") : e.rev[e.moi] ? (e.la[autre] ? t("You asked for a rematch.") : t("{name} has left the game. No rematch this time.", { name: directAdv() })) : motif, r === "win" ? "win" : r === "loss" ? "lose" : "");
    resultInfo = { kind: r === "win" ? "win" : r === "loss" ? "lose" : "draw", title: r === "win" ? t("You win") : r === "loss" ? t("You lose") : r === "draw" ? t("Draw") : t("Game cancelled"), sub: motif };
    renderResult(true);
    return;
  } else if (directCoupe) directDire(t("Connection lost. Reconnecting…"));
  else if (e.nulle === autre) directDire(t("Your opponent offers a draw."), "appel");
  else if (directEstCorr() && directRefus !== e.id + "/" + e.n + "/" + e.coups.length && e.nulle !== e.moi)
    directDire(trait === e.moi ? t("Your move.") : t("{name} to move. You can close the site: the game waits for you.", { name: directAdv() }));
  else if (!e.la[autre] && !directEstCorr()) directDire(t("Your opponent is away. Their clock keeps running."));
  else if (directRefus === e.id + "/" + e.n + "/" + e.coups.length) directDire(t("Your opponent declined the draw."));
  else if (e.phase === "debut") directDire(t("First moves: each player has one minute to play, then the clocks start.") + " " + (trait === e.moi ? t("Your move.") : ""));
  else if (e.nulle === e.moi) directDire(t("Draw offered."));
  else directDire(trait === e.moi ? t("Your move.") : t("Your opponent is playing."));
  renderResult(false);
}
/* La partie finie rejoint « Tes parties », une seule fois. */
function directEnregistrer() {
  const e = directE; if (!e || e.phase !== "fin") return;
  const cle = e.id + "/" + e.n, r = directResultat(e);
  if (directVu === cle) return;
  directVu = cle;
  if (r === "annulee" || e.coups.length < 2) return;
  history.unshift({ t: Date.now(), k: directEstCorr() ? "c" : "d", c: e.moi === "b" ? "w" : "b", r, tc: directTexteCadence(e.cad), adv: directAdv(), m: e.coups.join(" "), fen: null });
  history = history.slice(0, 30);
  saveHistory(); renderHistory();
}
function directCleFin() { return directE ? directE.id + "/" + directE.n : ""; }

/* ---------- Pendules ---------- */
function directPendules() {
  const e = directE, voir = directActif() && e && e.phase !== "attente";
  $("clockTop").classList.toggle("hide", !voir);
  $("clockBottom").classList.toggle("hide", !voir);
  if (!voir) return;
  const moi = e.moi, autre = moi === "b" ? "n" : "b", trait = e.coups.length % 2 ? "n" : "b", parCorr = directEstCorr();
  $("clockTop").classList.remove("untimed"); $("clockBottom").classList.remove("untimed");
  $("clockTop").classList.toggle("corr", parCorr); $("clockBottom").classList.toggle("corr", parCorr);
  $("clockTopName").textContent = directAdv();
  $("clockBottomName").textContent = t("You");
  $("clockTopSwatch").className = autre === "n" ? "dark" : "";
  $("clockBottomSwatch").className = moi === "n" ? "dark" : "";
  const poser = (el, temps, c) => {
    const v = directF ? directF.reste(e, c) : (c === "b" ? e.tb : e.tn);
    if (parCorr) {
      /* Par correspondance : le temps du coup en cours, en jours et en heures ;
         en rouge le dernier jour, sans alerte sonore. */
      const court = (e.phase === "jeu" || e.phase === "debut") && trait === c;
      temps.textContent = corrDuree(v);
      el.classList.toggle("active", court);
      el.classList.toggle("low", court && v < 86400000 && v > 0);
      el.classList.remove("tres-bas");
      el.classList.toggle("flagged", e.phase === "fin" && e.fin.m === "temps" && v <= 0);
      return;
    }
    temps.textContent = fmtTime(v);
    el.classList.toggle("active", e.phase === "jeu" && trait === c);
    el.classList.toggle("low", v < 20000 && v > 0);
    el.classList.toggle("tres-bas", e.phase === "jeu" && trait === c && v < 10000 && v > 0);
    el.classList.toggle("flagged", e.phase === "fin" && e.fin.m === "temps" && v <= 0);
    /* Alerte des 10 secondes : une fois par partie, a mon tour, comme contre l'ordinateur. */
    if (c === moi && e.phase === "jeu" && trait === moi && v > 0 && v <= 10000 && directTic !== e.id + "/" + e.n) {
      directTic = e.id + "/" + e.n;
      try { SON.tic(); } catch (x) {}
    }
  };
  poser($("clockTop"), $("clockTopTime"), autre);
  poser($("clockBottom"), $("clockBottomTime"), moi);
  try {
    const pr = prises(), solde = c => (c === "b" ? pr.solde : -pr.solde), cle = c => (c === "b" ? "w" : "b");
    poserHtml($("takenTop"), rangeePrises(pr[cle(autre)], cle(autre) === "w" ? "b" : "w", solde(autre)));
    poserHtml($("takenBottom"), rangeePrises(pr[cle(moi)], cle(moi) === "w" ? "b" : "w", solde(moi)));
  } catch (x) {}
}
setInterval(() => { if (directActif() && directE && (directE.phase === "jeu" || (directE.phase === "debut" && directEstCorr()))) directPendules(); }, 200);

/* ---------- Coups ---------- */
function directClic(sq) {
  const e = directE;
  if (!e || !directF || directAttenteCoup || (e.phase !== "debut" && e.phase !== "jeu")) return;
  if ((e.coups.length % 2 ? "n" : "b") !== e.moi) return;
  const p = game.board[sq];
  if (selected >= 0) {
    const r = pickMove(selected, sq);
    if (r) {
      if (r.promo) { askPromo(r.promo, m => directJouer(m)); selected = -1; render(); return; }
      directJouer(r.move); return;
    }
  }
  if (p && pC(p) === game.turn) selected = sq; else selected = -1;
  render();
}
function directJouer(m) {
  if (!directF || directAttenteCoup || !directF.coup(game.uci(m))) return;
  /* Montre tout de suite ; l'etat du serveur confirmera (ou annulera). */
  directAttenteCoup = true;
  directSan.push(game.san(m));
  game.makeMove(m); lastMove = m; selected = -1; marks = {}; legalCache = [];
  if (directE) directAnime = directE.id + "/" + directE.n + "/" + (directE.coups.length + 1);
  render();
  renderSheetInto("amiSheet", directSan); renderNavLecture(directSan);
}

/* ---------- Entrer, sortir ---------- */
function directBrancher(id) {
  directQuitter(true);
  directId = id; directE = null; directMessage = ""; directInvite = "";
  /* L'adresse porte la partie : recharger la page y ramene. */
  if (!DIRECT_LIEN.test(location.hash) || location.hash.slice(8) !== id) { try { window.history.replaceState(null, "", location.pathname + location.search + "#partie=" + id); } catch (x) {} }
  directF = directOuvrir(id, {
    etat: directRecu,
    coupe() { directCoupe = true; if (directActif()) directMontrer(); },
    perdu() { directQuitter(true); directMessage = t("This game is over or no longer exists."); directPanneau(); directDire(directMessage); },
    erreur(x) {
      if (x === "limite") directDire(t("Live games are closed until tomorrow. The rest of the site still works."));
      else if (directE) directRecu(directE);
    }
  });
  directPanneau();
}
function directQuitter(silence) {
  if (directHasard && !silence) { directHasard = null; directChercherFin(); }
  if (directF) directF.fermer();
  const etait = !!directId;
  directF = null; directE = null; directId = ""; directJeu = null; directSan = [];
  if (DIRECT_LIEN.test(location.hash)) { try { window.history.replaceState(null, "", location.pathname + location.search); } catch (x) {} }
  if (!etait || silence) return;
  directMessage = "";
  if (mode === "friend") { renderResult(false); renderClocks(); showAmi(); }
  directPanneau();
}
/* avecLien : « ou envoyer un lien », la partie se cree sans inviter personne.
   « Inviter » demande un pseudo : sans lui, on le dit et on y mene. */
async function directCreerPartie(avecLien) {
  const b = $("btnDirectCreer"), pseudo = avecLien === true ? "" : $("directPseudo").value.trim();
  if (avecLien !== true && !pseudo) {
    directMessage = t("Type a username, or send a link.");
    directPanneau(); directDire(directMessage);
    try { $("directPseudo").focus(); } catch (e) {}
    return;
  }
  b.disabled = true;
  { const z = $("directTrouves"); if (z) z.textContent = ""; }
  const r = await directCreer(directCad, pseudo || undefined, directCoul);
  b.disabled = false;
  if (r.id && directCadCorr(directCad)) {
    /* Par correspondance : rien a attendre a l'ecran, l'invitation part et la
       partie rejoint la liste « Tes parties en cours ». */
    directMessage = t("Invitation sent to {name}. It stays valid for 7 days, and the game will be listed under Play.", { name: r.adv || pseudo });
    $("directPseudo").value = "";
    directPanneau(); directDire(directMessage);
    if (typeof corrActualiser === "function") corrActualiser();
    return;
  }
  if (r.id) { directBrancher(r.id); directInvite = r.adv || pseudo; return; }
  directMessage = t(DIRECT_ERREURS[r.erreur] || "Something went wrong. Try again later.");
  directPanneau(); directDire(directMessage);
}
/* ---------- Adversaire au hasard ---------- */
const DIRECT_ERREURS = { plein: "You already have 10 correspondence games in progress. Finish one before starting another.", indisponible: "Something went wrong. Try again later.",
  session: "Create a free account to play live against other members.", adversaire: "No member has this username.",
  trop: "You have created many games. Try again in an hour.", invitations: "Too many invitations waiting for this member. Try again later.", limite: "Live games are closed until tomorrow. The rest of the site still works.", reseau: "No connection. Check your network and try again." };
async function directChercherPartie() {
  const b = $("btnDirectHasard"); if (b) b.disabled = true;
  const r = await directChercher(directCad);
  if (b) b.disabled = false;
  if (!r.id) { directMessage = t(DIRECT_ERREURS[r.erreur] || "Something went wrong. Try again later."); directPanneau(); directDire(directMessage); return; }
  /* La partie est retenue comme tiree au hasard, pour son badge a la fin. */
  if (typeof bxmHasard === "function") bxmHasard(r.id);
  if (directCadCorr(directCad)) {
    /* Par correspondance : un adversaire trouve, la partie s'ouvre ; sinon la
       recherche reste ouverte sur le serveur, sans rien a garder a l'ecran. */
    if (typeof corrActualiser === "function") corrActualiser();
    if (!r.attente) { directBrancher(r.id); return; }
    directMessage = t("Your search is open for 7 days. The game starts as soon as another member looks for the same time per move, and it will be listed under Play.");
    directPanneau(); directDire(directMessage);
    return;
  }
  const h = { cad: directCad, depuis: Date.now() };
  directBrancher(r.id);
  directHasard = r.attente ? h : null;
}
/* Revanche par correspondance : une nouvelle invitation au meme adversaire,
   meme delai, couleurs inversees (le serveur n'en tient pas dans la partie
   finie : l'autre n'est pas la pour repondre). */
let directRevancheCorr = "";
async function directRevancheInviter() {
  const e = directE; if (!e || e.phase !== "fin" || directRevancheCorr === e.id) return;
  const cad = DIRECT_CADENCES.findIndex(c => c[0] === e.cad[0] && c[1] === e.cad[1]), adv = e.moi === "b" ? e.nr : e.b;
  if (cad < 0 || !adv) return;
  $("btnDirectRevanche").disabled = true;
  const r = await directCreer(cad, adv, e.moi === "b" ? "n" : "b");
  if (directE !== e) return;
  if (r.id) { directRevancheCorr = e.id; if (typeof corrActualiser === "function") corrActualiser(); directMontrer(); return; }
  $("btnDirectRevanche").disabled = false;
  directDire(t(DIRECT_ERREURS[r.erreur] || "Something went wrong. Try again later."));
}
/* Tant que j'attends, je me rappelle a la salle toutes les 15 secondes ; si
   elle me donne une autre partie, c'est qu'un adversaire m'y attend. */
setInterval(async () => {
  const h = directHasard;
  if (!h || !directId || !directE || directE.phase !== "attente") return;
  const r = await directChercher(h.cad);
  if (directHasard !== h) return;
  if (r.id && r.id !== directId) { if (typeof bxmHasard === "function") bxmHasard(r.id); directBrancher(r.id); directHasard = r.attente ? h : null; }
  else if (directActif()) directMontrer();
}, 15000);
/* ---------- Invitation recue ---------- */
/* La page vient voir : a l'ouverture, au retour sur l'onglet, puis une fois
   par minute tant qu'elle est a l'ecran. Jamais pendant une partie ou un
   exercice : la fenetre attend le passage suivant. */
async function directGuetter() {
  /* Une partie finie encore a l'ecran n'empeche plus de recevoir une invitation. */
  /* Pendant une partie par correspondance ouverte a l'ecran, la liste des
     autres parties continue d'etre tenue a jour (la pastille « a toi »), mais
     aucune fenetre ne s'ouvre. */
  const occupe = () => !!directId && !(directE && directE.phase === "fin");
  if (!DIRECT_OUVERT || document.hidden || (occupe() && !directEstCorr()) || !(typeof estMembre === "function" && estMembre())) return;
  if (Date.now() - directGuet < 20000) return;
  directGuet = Date.now();
  const nouvelles = await directNouvelles(), liste = nouvelles.liste;
  if (nouvelles.ok && typeof corrRecu === "function") corrRecu(nouvelles.corr);
  if (occupe()) return;
  const inv = liste.find(x => x && !directDeclinees[x.id] && /^[a-z2-9]{12}$/.test(x.id));
  if (!inv || (directId && !(directE && directE.phase === "fin")) || (typeof duelOccupe === "function" && duelOccupe())) return;
  const r = $("duel"); if (!r || !r.hidden) return;
  /* Une fenetre de felicitations est a l'ecran : on repassera. */
  const br = $("bravo"); if (br && !br.hidden) { directGuet = 0; return; }
  directDeclinees[inv.id] = true;
  const cad = DIRECT_CADENCES[inv.cad] || DIRECT_CADENCES[0];
  duelOuvrir(duelMedaille("duel_lien") + '<p class="bilan-entete">' + echapper(t("Live game")) + '</p><h2 id="duelTitre">' + echapper(t("{name} invites you to play", { name: inv.p })) + "</h2>" +
    '<p class="bilan-sous">' + echapper(t("Time control: {pace}. The game starts as soon as you join.", { pace: directTexteCadence(cad) }) +
      (inv.coul === "b" || inv.coul === "n" ? " " + t(inv.coul === "b" ? "You play White." : "You play Black.") : "")) + "</p>" + DUEL_FILET +
    '<div class="duel-boutons"><button type="button" class="btn primary" id="directInvRejoindre" data-duel-fermer data-duel-premier>' + echapper(t("Join the game")) +
    '</button><button type="button" class="btn" id="directInvRefuser" data-duel-fermer>' + echapper(t("Decline")) + "</button></div>");
  /* Invitation recue : le meme son d'appel que pour une nulle ou une revanche. */
  try { SON.appel(); } catch (x) {}
  $("directInvRejoindre").addEventListener("click", () => { setMode("friend"); directBrancher(inv.id); if (typeof goTop === "function") goTop(); });
  $("directInvRefuser").addEventListener("click", () => { directRefuser(inv.id); });
}
function directLire() {
  const m = location.hash.match(DIRECT_LIEN);
  if (!m || !DIRECT_OUVERT) return false;
  if (m[1] !== directId) { setMode("friend"); directBrancher(m[1]); if (typeof goTop === "function") goTop(); }
  return true;
}
if (DIRECT_OUVERT && document.getElementById("directPanel")) {
  $("btnDirectCreer").onclick = () => directCreerPartie(false);
  if ($("btnDirectLien")) $("btnDirectLien").onclick = () => directCreerPartie(true);
  if ($("btnDirectHasard")) $("btnDirectHasard").onclick = directChercherPartie;
  if ($("directCouleur")) $("directCouleur").addEventListener("click", e => {
    const b = e.target.closest("button[data-v]"); if (!b) return;
    directCoul = b.dataset.v; directPanneau();
  });
  /* « Mon ami n'a pas de compte » : la partie par lien ; et le retour. */
  if ($("btnAmiSansCompte")) $("btnAmiSansCompte").onclick = () => { amiModeRegler("lien"); if (typeof goTop === "function") goTop(); };
  if ($("btnAmiRetourMembre")) $("btnAmiRetourMembre").onclick = () => { amiModeRegler("direct"); if (typeof goTop === "function") goTop(); };
  /* Une partie par lien qui commence ou qu'on rejoint ramene sous « Par lien ». */
  for (const nom of ["newAmiGame", "readHash"]) {
    if (typeof window[nom] !== "function") continue;
    const av = window[nom];
    window[nom] = function () {
      const r = av.apply(this, arguments);
      try { if (amiStarted && !directId && amiMode !== "lien" && (nom === "newAmiGame" || mode === "friend")) amiModeRegler("lien"); } catch (e) {}
      return r;
    };
  }
  amiCadenceDefaut();
  try { localStorage.removeItem("chang64:amiCadence"); } catch (e) {}
  document.querySelectorAll(".tc-cats").forEach(defileBrancher);
  amiModeRegler(amiModeDefaut());
  $("btnDirectNulle").onclick = () => { if (directF) directF.nulle(); };
  $("btnDirectAccepter").onclick = () => { if (directF) directF.nulle(); };
  $("btnDirectRefuser").onclick = () => { if (directF) directF.nulleNon(); };
  $("btnDirectRevanche").onclick = () => { if (directEstCorr()) directRevancheInviter(); else if (directF) directF.revanche(); };
  /* Par correspondance, « Retour a mes parties » ramene a la liste de Jouer. */
  $("btnDirectQuitter").onclick = () => { const c = directEstCorr(); directQuitter(); if (c) { setMode("jouer"); if (typeof goTop === "function") goTop(); } };
  if ($("btnDirectAnnuler")) $("btnDirectAnnuler").onclick = async () => {
    const id = directId; if (!id) return;
    await directRetirer(id);
    if (directId === id) directQuitter();
    if (typeof corrActualiser === "function") corrActualiser();
    setMode("jouer"); if (typeof goTop === "function") goTop();
  };
  /* Abandonner se confirme d'un second appui, comme dans Jouer. */
  $("btnDirectAbandon").onclick = function () {
    if (!this.classList.contains("armed")) {
      this.classList.add("armed"); this.textContent = t("Confirm resignation");
      setTimeout(() => { this.classList.remove("armed"); this.textContent = t("Resign"); }, 5000);
      return;
    }
    this.classList.remove("armed"); this.textContent = t("Resign");
    if (directF) directF.abandon();
  };
  window.addEventListener("hashchange", directLire);
  setInterval(directGuetter, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) directGuetter(); });
  setTimeout(directGuetter, 2500);
  /* Retour du reseau ou de l'onglet (telephone deverrouille) : on refait le fil sans attendre. */
  window.addEventListener("online", () => { if (directF) directF.couper(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && directF && !directF.ouvert) directF.couper(); });
  if (document.readyState === "complete") setTimeout(() => { directLire(); directPanneau(); }, 0);
  else window.addEventListener("load", () => setTimeout(() => { directLire(); directPanneau(); }, 0));
}
