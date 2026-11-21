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
let directCat = 0;                /* 0 = cadences rapides, 1 = classiques */
/* Ecran « Contre un ami » : direct, lien, ou hasard (« Contre un joueur en ligne »). */
let amiMode = "lien";
function amiModeDefaut() {
  const membre = typeof estMembre === "function" && estMembre();
  let lienEnCours = false; try { lienEnCours = !!amiStarted; } catch (e) {}
  return membre && !lienEnCours ? "direct" : "lien";
}
/* Vrai quand l'ecran ne montre pas la partie par lien (et qu'aucune partie en direct n'est ouverte). */
function amiHorsLien() { return amiMode !== "lien" && !directId; }
function amiModeRegler(m) {
  amiMode = m === "direct" || m === "hasard" ? m : "lien";
  const p = $("pane-friend"); if (!p) return;
  p.dataset.ami = amiMode;
  const seg = $("amiModes");
  if (seg) for (const b of seg.children) b.setAttribute("aria-pressed", String(b.dataset.v === amiMode));
  const ti = $("directTitre"), so = $("directSous");
  if (ti) ti.textContent = t(amiMode === "hasard" ? "Against a player online" : "Live game");
  if (so) so.textContent = t(amiMode === "hasard" ? "A live game against an opponent picked at random, close to your level. Colours are drawn at random."
    : "Play a friend in real time, with a clock. Invite them by username, or send them a link.");
  directMessage = "";
  if (mode === "friend" && !directId) showAmi(); else directPanneau();
}
let directAnime = "";              /* dernier coup deja anime : partie/manche/nombre de coups */

function directActif() { return !!directId && mode === "friend"; }
/* Une partie se joue en ce moment : ni felicitations ni defi recu avant la fin. */
function directOccupe() { return !!(directE && (directE.phase === "debut" || directE.phase === "jeu")); }
function directAdv() { const e = directE; return e ? (e.moi === "b" ? e.nr : e.b) || t("Opponent") : t("Opponent"); }
function directUrl() { return location.origin + location.pathname + "#partie=" + directId; }
function directTexteCadence(c) { return (c[0] / 60) + "+" + c[1]; }

/* ---------- Panneau ---------- */
function directPanneau() {
  const p = $("directPanel"); if (!p) return;
  p.classList.toggle("hide", !DIRECT_OUVERT);
  if (!DIRECT_OUVERT) return;
  const membre = typeof estMembre === "function" && estMembre();
  const e = directE, enJeu = !!directId;
  $("pane-friend").classList.toggle("en-direct", enJeu);
  $("directInvite").classList.toggle("hide", membre || enJeu);
  if (!membre && !enJeu) poserHtml($("directInvite"), inviteMembre("Create a free account to play live against other members."));
  $("directNouveau").classList.toggle("hide", !membre || enJeu);
  $("directLienBloc").classList.toggle("hide", !(enJeu && e && e.phase === "attente"));
  $("directStatus").classList.toggle("hide", !enJeu && !directMessage);
  const jouee = e && (e.phase === "debut" || e.phase === "jeu"), finie = e && e.phase === "fin";
  $("btnDirectNulle").classList.toggle("hide", !(e && e.phase === "jeu" && e.nulle !== (e.moi === "b" ? "n" : "b")));
  $("btnDirectNulle").disabled = !!(e && e.nulle);
  $("btnDirectAccepter").classList.toggle("hide", !(e && e.phase === "jeu" && e.nulle && e.nulle !== e.moi));
  $("btnDirectRefuser").classList.toggle("hide", !(e && e.phase === "jeu" && e.nulle && e.nulle !== e.moi));
  $("btnDirectAbandon").classList.toggle("hide", !jouee);
  $("btnDirectRevanche").classList.toggle("hide", !finie || !e.fin.r);
  $("btnDirectRevanche").disabled = !!(finie && e.rev[e.moi]);
  $("btnDirectQuitter").classList.toggle("hide", !(enJeu && !jouee));
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
  return t(DIRECT_MOTIFS[m] || "");
}
/* Cadences du bloc de lancement : deux familles, Rapide et Classique, puis
   les cadences de la famille choisie. Reconstruit seulement quand la famille change. */
function directCadencesRendre() {
  const cats = $("directCats"), el = $("directCadences"); if (!cats || !el) return;
  const familles = [["Rapid", DIRECT_RAPIDES], ["Classical", DIRECT_CLASSIQUES]];
  if (!cats.children.length) familles.forEach(([nom], k) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = t(nom);
    b.onclick = () => { directCat = k; directCad = familles[k][1][0]; directCadencesRendre(); };
    cats.appendChild(b);
  });
  [...cats.children].forEach((b, k) => b.setAttribute("aria-pressed", String(k === directCat)));
  if (el.dataset.cat !== String(directCat)) {
    el.dataset.cat = String(directCat);
    el.textContent = "";
    for (const i of familles[directCat][1]) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.dataset.cad = String(i); b.textContent = directTexteCadence(DIRECT_CADENCES[i]);
      b.onclick = () => { directCad = i; directCadencesRendre(); };
      el.appendChild(b);
    }
  }
  [...el.children].forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.cad === directCad)));
  directCadenceNote();
}
function directCadenceNote() {
  const n = $("directCadenceNote"), c = DIRECT_CADENCES[directCad]; if (!n) return;
  n.textContent = c[1] ? t("{n} minutes each, plus {s} seconds added after every move.", { n: c[0] / 60, s: c[1] }) : t("{n} minutes each for the whole game.", { n: c[0] / 60 });
}
function directRecu(e) {
  const neuve = !directE || directE.n !== e.n, debutee = directE && directE.phase === "attente" && e.phase !== "attente";
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
}
function directMontrer() {
  const e = directE;
  directPanneau();
  if (!e) return;
  game = directJeu;
  legalCache = e.phase === "debut" || e.phase === "jeu" ? game.moves() : [];
  lastMove = game.history.length ? game.history[game.history.length - 1].m : null;
  selected = -1; marks = {};
  /* Chaque etat recu refait la partie, donc un nouvel objet « dernier coup » :
     sans ceci, render() rejouait l'animation du meme coup a chaque message du
     serveur (confirmation de mon coup, nulle proposee, adversaire absent). */
  { const cle = e.id + "/" + e.n + "/" + e.coups.length;
    if (cle === directAnime && lastMove) lastAnimated = lastMove;
    directAnime = cle; }
  render();
  renderSheetInto("amiSheet", directSan); renderNavLecture(directSan);
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
  if (e.phase === "attente") {
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
    directDire(e.rev[autre] && !e.rev[e.moi] ? t("Your opponent wants a rematch.") : e.rev[e.moi] ? (e.la[autre] ? t("You asked for a rematch.") : t("{name} has left the game. No rematch this time.", { name: directAdv() })) : motif, r === "win" ? "win" : r === "loss" ? "lose" : "");
    resultInfo = { kind: r === "win" ? "win" : r === "loss" ? "lose" : "draw", title: r === "win" ? t("You win") : r === "loss" ? t("You lose") : r === "draw" ? t("Draw") : t("Game cancelled"), sub: motif };
    renderResult(true);
    return;
  } else if (directCoupe) directDire(t("Connection lost. Reconnecting…"));
  else if (e.nulle === autre) directDire(t("Your opponent offers a draw."));
  else if (!e.la[autre]) directDire(t("Your opponent is away. Their clock keeps running."));
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
  history.unshift({ t: Date.now(), c: e.moi === "b" ? "w" : "b", r, tc: directTexteCadence(e.cad), adv: directAdv(), m: e.coups.join(" "), fen: null });
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
  const moi = e.moi, autre = moi === "b" ? "n" : "b", trait = e.coups.length % 2 ? "n" : "b";
  $("clockTop").classList.remove("untimed"); $("clockBottom").classList.remove("untimed");
  $("clockTopName").textContent = directAdv();
  $("clockBottomName").textContent = t("You");
  $("clockTopSwatch").className = autre === "n" ? "dark" : "";
  $("clockBottomSwatch").className = moi === "n" ? "dark" : "";
  const poser = (el, temps, c) => {
    const v = directF ? directF.reste(e, c) : (c === "b" ? e.tb : e.tn);
    temps.textContent = fmtTime(v);
    el.classList.toggle("active", e.phase === "jeu" && trait === c);
    el.classList.toggle("low", v < 20000 && v > 0);
    el.classList.toggle("tres-bas", e.phase === "jeu" && trait === c && v < 10000 && v > 0);
    el.classList.toggle("flagged", e.phase === "fin" && e.fin.m === "temps" && v <= 0);
  };
  poser($("clockTop"), $("clockTopTime"), autre);
  poser($("clockBottom"), $("clockBottomTime"), moi);
  try {
    const pr = prises(), solde = c => (c === "b" ? pr.solde : -pr.solde), cle = c => (c === "b" ? "w" : "b");
    poserHtml($("takenTop"), rangeePrises(pr[cle(autre)], cle(autre) === "w" ? "b" : "w", solde(autre)));
    poserHtml($("takenBottom"), rangeePrises(pr[cle(moi)], cle(moi) === "w" ? "b" : "w", solde(moi)));
  } catch (x) {}
}
setInterval(() => { if (directActif() && directE && directE.phase === "jeu") directPendules(); }, 200);

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
  const r = await directCreer(directCad, pseudo || undefined, directCoul);
  b.disabled = false;
  if (r.id) { directBrancher(r.id); directInvite = r.adv || pseudo; return; }
  directMessage = t({ session: "Create a free account to play live against other members.", adversaire: "No member has this username.",
    trop: "You have created many games. Try again in an hour.", invitations: "Too many invitations waiting for this member. Try again later.", limite: "Live games are closed until tomorrow. The rest of the site still works.", reseau: "No connection. Check your network and try again." }[r.erreur] || "Something went wrong. Try again later.");
  directPanneau(); directDire(directMessage);
}
/* ---------- Adversaire au hasard ---------- */
const DIRECT_ERREURS = { session: "Create a free account to play live against other members.", adversaire: "No member has this username.",
  trop: "You have created many games. Try again in an hour.", invitations: "Too many invitations waiting for this member. Try again later.", limite: "Live games are closed until tomorrow. The rest of the site still works.", reseau: "No connection. Check your network and try again." };
async function directChercherPartie() {
  const b = $("btnDirectHasard"); if (b) b.disabled = true;
  const r = await directChercher(directCad);
  if (b) b.disabled = false;
  if (!r.id) { directMessage = t(DIRECT_ERREURS[r.erreur] || "Something went wrong. Try again later."); directPanneau(); directDire(directMessage); return; }
  const h = { cad: directCad, depuis: Date.now() };
  directBrancher(r.id);
  directHasard = r.attente ? h : null;
}
/* Tant que j'attends, je me rappelle a la salle toutes les 15 secondes ; si
   elle me donne une autre partie, c'est qu'un adversaire m'y attend. */
setInterval(async () => {
  const h = directHasard;
  if (!h || !directId || !directE || directE.phase !== "attente") return;
  const r = await directChercher(h.cad);
  if (directHasard !== h) return;
  if (r.id && r.id !== directId) { directBrancher(r.id); directHasard = r.attente ? h : null; }
  else if (directActif()) directMontrer();
}, 15000);
/* ---------- Invitation recue ---------- */
/* La page vient voir : a l'ouverture, au retour sur l'onglet, puis une fois
   par minute tant qu'elle est a l'ecran. Jamais pendant une partie ou un
   exercice : la fenetre attend le passage suivant. */
async function directGuetter() {
  /* Une partie finie encore a l'ecran n'empeche plus de recevoir une invitation. */
  if (!DIRECT_OUVERT || document.hidden || (directId && !(directE && directE.phase === "fin")) || !(typeof estMembre === "function" && estMembre())) return;
  if (Date.now() - directGuet < 20000) return;
  directGuet = Date.now();
  const liste = await directInvitations();
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
  if ($("amiModes")) $("amiModes").addEventListener("click", e => {
    const b = e.target.closest("button[data-v]"); if (!b) return;
    amiModeRegler(b.dataset.v);
  });
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
  amiModeRegler(amiModeDefaut());
  $("btnDirectNulle").onclick = () => { if (directF) directF.nulle(); };
  $("btnDirectAccepter").onclick = () => { if (directF) directF.nulle(); };
  $("btnDirectRefuser").onclick = () => { if (directF) directF.nulleNon(); };
  $("btnDirectRevanche").onclick = () => { if (directF) directF.revanche(); };
  $("btnDirectQuitter").onclick = () => directQuitter();
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
