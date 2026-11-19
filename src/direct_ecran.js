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
 * PAS ENCORE OUVERT AU PUBLIC : le panneau ne s'affiche que sur un poste de
 * developpement (DIRECT_OUVERT), le temps que le serveur des parties soit
 * essaye sur le vrai Cloudflare et que les ecrans soient valides.
 */
const DIRECT_LIEN = /^#partie=([a-z2-9]{12})$/;
/* Acces reserve (2026-11-19, choix d'Alexandre) : avant l'ouverture a tous,
   l'ecran s'affiche aussi sur le vrai site pour qui ouvre une fois l'adresse
   avec ?direct=essai, ou pour qui recoit le lien d'une partie. Le navigateur
   s'en souvient ; ?direct=non referme. Ce n'est pas une protection (le serveur
   exige de toute facon un membre connecte), seulement un rideau. */
const DIRECT_OUVERT = (() => {
  if (/^(localhost|127\.\d+\.\d+\.\d+)$/.test(location.hostname)) return true;
  try {
    const q = (location.search.match(/[?&]direct=([a-z]+)/) || [])[1];
    if (q === "non") localStorage.removeItem("chang64:direct");
    else if (q === "essai" || DIRECT_LIEN.test(location.hash)) localStorage.setItem("chang64:direct", "1");
    return localStorage.getItem("chang64:direct") === "1";
  } catch (e) { return false; }
})();
let directF = null, directE = null, directId = "", directCad = 0;
let directJeu = null, directSan = [], directVu = "", directCoupe = false, directMessage = "", directAttenteCoup = false;
let directInvite = "";            /* pseudo du membre que je viens d'inviter */
const directDeclinees = {};       /* invitations deja montrees ou refusees sur cette page */
let directGuet = 0;
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
  const el = $("directCadences");
  if (!el.children.length) DIRECT_CADENCES.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = directTexteCadence(c);
    b.onclick = () => { directCad = i; [...el.children].forEach((x, k) => x.setAttribute("aria-pressed", k === i)); directCadenceNote(); };
    b.setAttribute("aria-pressed", i === directCad);
    el.appendChild(b);
  });
  directCadenceNote();
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
  renderSheetInto("amiSheet", directSan);
  const assis = e.phase !== "attente";
  const bw = document.querySelector(".board-wrap"); if (bw) bw.classList.toggle("hide", !assis);
  const sp = $("amiScoresheetPanel"); if (sp) sp.classList.toggle("hide", !assis);
  const bt = $("boardTools"); if (bt) bt.classList.add("hide");
  majLayoutSolo();
  directPendules();
  const trait = e.coups.length % 2 ? "n" : "b", autre = e.moi === "b" ? "n" : "b";
  if (e.phase === "attente") {
    directDire(e.inv || directInvite ? t("{name} is invited and will see it if the site is open. You can also send this link.", { name: e.inv || directInvite }) : t("Send this link to your opponent. The game starts when they open it."));
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
  renderSheetInto("amiSheet", directSan);
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
  if (directF) directF.fermer();
  const etait = !!directId;
  directF = null; directE = null; directId = ""; directJeu = null; directSan = [];
  if (DIRECT_LIEN.test(location.hash)) { try { window.history.replaceState(null, "", location.pathname + location.search); } catch (x) {} }
  if (!etait || silence) return;
  directMessage = "";
  if (mode === "friend") { renderResult(false); renderClocks(); showAmi(); }
  directPanneau();
}
async function directCreerPartie() {
  const b = $("btnDirectCreer"), pseudo = $("directPseudo").value.trim();
  b.disabled = true;
  const r = await directCreer(directCad, pseudo || undefined);
  b.disabled = false;
  if (r.id) { directBrancher(r.id); directInvite = r.adv || pseudo; return; }
  directMessage = t({ session: "Create a free account to play live against other members.", adversaire: "No member has this username.",
    trop: "You have created many games. Try again in an hour.", invitations: "Too many invitations waiting for this member. Try again later.", limite: "Live games are closed until tomorrow. The rest of the site still works.", reseau: "No connection. Check your network and try again." }[r.erreur] || "Something went wrong. Try again later.");
  directPanneau(); directDire(directMessage);
}
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
    '<p class="bilan-sous">' + echapper(t("Time control: {pace}. The game starts as soon as you join.", { pace: directTexteCadence(cad) })) + "</p>" + DUEL_FILET +
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
  $("btnDirectCreer").onclick = directCreerPartie;
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
