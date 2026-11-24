/* chang64 - parties par correspondance : la liste et la pastille (2026-11-21)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Une partie par correspondance se joue sur l'ecran de la partie en direct
 * (direct_ecran.js), avec un delai par coup de 1, 3 ou 7 jours tenu par le
 * serveur. Ce fichier ajoute ce qui lui est propre :
 * - la liste « Tes parties en cours », en haut de l'onglet Jouer (decision
 *   d'Alexandre du 21/11) : a toi de jouer, a l'autre, invitations recues et
 *   envoyees, recherches d'adversaire, parties finies pas encore vues ;
 * - le nombre « a toi » sur l'onglet Jouer, sur la ligne « Parties en cours »
 *   du menu, et sur l'icone de l'application installee quand le navigateur le
 *   permet (il ne vaut alors que pour la derniere visite).
 * Il n'y a pas de notification : la liste est lue quand le site est ouvert
 * (a l'arrivee, au retour sur l'onglet, puis toutes les 30 secondes, dans la
 * meme requete que les invitations du direct : directGuetter).
 *
 * Une partie par correspondance n'occupe l'ecran que tant qu'on la regarde :
 * quitter l'ecran « Contre un ami » referme son fil, elle attend sur le serveur.
 */
let corrParties = [];        /* la derniere liste recue du serveur */
let corrRecuA = 0;           /* quand (horloge d'ici), pour le temps restant */
let corrMessage = "";
let corrMinuteur = 0;

/* Une duree en jours et heures, heures et minutes, ou minutes. Le chiffre
   et son unite sont colles : « 2j 4h », « 5h 12min » (demande d'Alexandre). */
function corrDuree(ms) {
  const J = 86400000, H = 3600000, M = 60000;
  if (ms >= J) { const d = Math.floor(ms / J), h = Math.floor((ms % J) / H); return h ? t("{d}d {h}h", { d, h }) : t("{d}d", { d }); }
  if (ms >= H) { const h = Math.floor(ms / H), m = Math.floor((ms % H) / M); return m ? t("{h}h {m}min", { h, m }) : t("{h}h", { h }); }
  return t("{m}min", { m: ms <= 0 ? 0 : Math.max(1, Math.ceil(ms / M)) });
}
/* Temps restant d'une ligne, d'apres l'heure du serveur recue avec elle. */
function corrReste(x) { return x.ech - (x.h + (Date.now() - corrRecuA)); }
function corrCadence(x) { const c = DIRECT_CADENCES[x.cad]; return c ? directTexteCadence(c) : ""; }
/* Ce qui attend le membre : son tour, une invitation, une fin pas encore vue. */
function corrATraiter(x) { return (x.s === "jeu" && x.atoi) || x.s === "invite" || x.s === "fin"; }
function corrNombre() { return corrParties.filter(corrATraiter).length; }

function corrRecu(liste) {
  corrParties = Array.isArray(liste) ? liste.filter(x => x && /^[a-z2-9]{12}$/.test(x.id)) : [];
  corrRecuA = Date.now();
  /* Trois parties en cours a la fois : le badge est note, annonce plus tard (badges_membres.js). */
  if (typeof bxmCorr === "function") bxmCorr(corrParties);
  corrRendre();
}
/* Relire la liste tout de suite (apres une action), ou dans un instant (un
   etat de partie vient d'arriver : le serveur finit d'ecrire son annuaire). */
async function corrActualiser() {
  if (!(typeof estMembre === "function" && estMembre())) { corrRecu([]); return; }
  const n = await directNouvelles();
  if (n.ok) corrRecu(n.corr);
}
function corrBientot() {
  clearTimeout(corrMinuteur);
  corrMinuteur = setTimeout(corrActualiser, 700);
}

function corrOuvrir(id) {
  corrMessage = "";
  setMode("friend");
  directBrancher(id);
  if (typeof goTop === "function") goTop();
}
function corrLigne(x) {
  const nom = x.adv || t("Opponent"), cad = corrCadence(x), reste = corrDuree(corrReste(x));
  const el = document.createElement(x.s === "invite" || x.s === "envoyee" || x.s === "cherche" ? "div" : "button");
  el.className = "history-item corr-item";
  el.dataset.s = x.s; el.dataset.id = x.id;
  let badge = "", titre = "", sous = "", urgent = false, boutons = "";
  if (x.s === "jeu") {
    titre = t("Against {name}", { name: nom });
    if (x.atoi) { badge = '<span class="res corr-atoi">' + echapper(t("Your turn")) + "</span>"; sous = t("You have {time} left", { time: reste }) + " | " + cad; urgent = corrReste(x) < 86400000; }
    else sous = t("{name} to move", { name: nom }) + " | " + t("{time} left", { time: reste });
  } else if (x.s === "invite") {
    titre = t("{name} invites you", { name: nom });
    sous = cad + " | " + t(x.coul === "b" ? "You play White." : "You play Black.");
    boutons = '<button type="button" class="btn primary" data-corr="accepter">' + echapper(t("Accept")) + '</button><button type="button" class="btn" data-corr="refuser">' + echapper(t("Decline")) + "</button>";
  } else if (x.s === "envoyee") {
    titre = t("Waiting for {name}", { name: nom });
    sous = t("Invitation sent") + " | " + cad;
    boutons = '<button type="button" class="btn" data-corr="retirer">' + echapper(t("Cancel")) + "</button>";
  } else if (x.s === "cherche") {
    titre = t("Looking for an opponent");
    sous = cad + " | " + t("{time} left", { time: reste });
    boutons = '<button type="button" class="btn" data-corr="retirer">' + echapper(t("Cancel")) + "</button>";
  } else {
    titre = x.r === "refus" ? t("{name} can't play right now.", { name: nom }) : t("Against {name}", { name: nom });
    if (x.r === "win" || x.r === "loss" || x.r === "draw") badge = '<span class="res ' + x.r + '">' + echapper(t(RES_LABEL[x.r])) + "</span>";
    sous = x.r === "refus" ? t("Invitation declined") + " | " + cad
      : t({ win: "Game over: you won.", loss: "Game over: you lost.", draw: "Game over: a draw.", annulee: "Game cancelled" }[x.r] || "Game cancelled");
  }
  poserHtml(el, badge + '<span class="meta"><b>' + echapper(titre) + "</b><span" + (urgent ? ' class="corr-urgent"' : "") + ">" + echapper(sous) + "</span></span>" +
    (boutons ? '<span class="corr-boutons">' + boutons + "</span>" : '<span class="corr-fleche" aria-hidden="true">›</span>'));
  if (el.tagName === "BUTTON") { el.type = "button"; el.onclick = () => corrOuvrir(x.id); }
  return el;
}
/* La partie par lien en cours (ui.js) : une ligne de la liste, pour un
   membre comme pour un visiteur. Elle ne s'impose plus a l'ouverture de
   « Contre un ami » ; on la retrouve ici. */
function corrLigneLien() {
  const el = document.createElement("button"), atoi = typeof amiIsMyTurn === "function" && amiIsMyTurn();
  el.type = "button"; el.className = "history-item corr-item"; el.dataset.s = "lien";
  poserHtml(el, (atoi ? '<span class="res corr-atoi">' + echapper(t("Your turn")) + "</span>" : "") +
    '<span class="meta"><b>' + echapper(t("Game by link")) + "</b><span>" + echapper(t(atoi ? "Your move, then send the link." : "Move saved. Send this link to your friend.")) + "</span></span>" +
    '<span class="corr-fleche" aria-hidden="true">›</span>');
  el.onclick = () => { setMode("friend"); amiModeRegler("lien"); if (typeof goTop === "function") goTop(); };
  return el;
}
/* Une partie se joue a l'ecran : contre l'ordinateur, ou en direct a la pendule. */
function corrEnPartie() {
  try {
    if (mode === "play" && gameStarted && !resultInfo && !isReviewGame) return true;
    return typeof directOccupe === "function" && directOccupe() && !directEstCorr();
  } catch (e) { return false; }
}
/* Le carre de notification : le nombre de parties qui attendent le membre.
   Jamais pendant une partie (rien ne la derange), ni sur l'ecran qui montre
   deja la liste. */
/* 2026-11-24 (decision d'Alexandre, « Dans le carre ») : il dit aussi qu'une
   partie est en cours pendant qu'on est sur un autre ecran (navPartie,
   navigation.js), a la place de l'ancienne pastille de l'onglet Jouer. Ce
   cas passe avant les parties qui attendent : un toucher ramene a
   l'echiquier. Un petit rond laiton remplace alors le nombre, et le dessin
   est celui de l'adversaire (ordinateur, ou les deux pions). */
function corrCarre() {
  const b = $("carreParties"); if (!b) return;
  const p = typeof navPartie === "function" ? navPartie() : "", partie = !!p && mode !== p;
  const n = partie ? 0 : (typeof corrNombre === "function" ? corrNombre() : 0);
  const montrer = partie || (n > 0 && !corrEnPartie() && mode !== "jouer");
  const etat = partie ? "partie-" + p : "";
  if (b.hidden === !montrer && b.dataset.n === String(n) && (b.dataset.etat || "") === etat) return;
  b.hidden = !montrer; b.dataset.n = String(n); b.dataset.etat = etat;
  const nb = $("carreNombre"); if (nb) { nb.textContent = partie ? "" : n > 9 ? "9+" : n ? String(n) : ""; nb.classList.toggle("point", partie); }
  const c = $("carreDessin");
  if (c && typeof PICTOS !== "undefined") { const nom = p === "play" && partie ? "ordinateur" : "ami"; if (c.dataset.nom !== nom && PICTOS[nom]) { poserHtml(c, '<svg viewBox="-24 -24 48 48" focusable="false">' + PICTOS[nom] + "</svg>"); c.dataset.nom = nom; } }
  b.setAttribute("aria-label", partie ? t("Game in progress: back to the game") : t(n === 1 ? "{n} game is waiting for you" : "{n} games are waiting for you", { n }));
}
function corrRendre() {
  const n = corrNombre();
  /* 2026-11-22 : plus de pastille sur l'onglet Jouer (mal placee, retour
     d'Alexandre) ; le nombre est sur le carre de notification. */
  { const p = $("corrPastille"); if (p) p.remove(); const o = $("tab-jouer"); if (o) o.classList.remove("a-toi"); }
  corrCarre();
  /* La ligne du menu : visible des qu'il y a au moins une partie. */
  const ligne = $("menuCorrLigne"), detail = $("menuCorrDetail");
  if (ligne) ligne.hidden = !corrParties.length;
  if (detail) detail.textContent = n ? String(n) : "";
  /* L'icone de l'application installee, quand le navigateur sait le faire. */
  try { if (navigator.setAppBadge) { if (n) navigator.setAppBadge(n).catch(() => {}); else navigator.clearAppBadge().catch(() => {}); } } catch (e) {}
  /* La liste, en haut de l'onglet Jouer. */
  const panneau = $("corrPanel"), boite = $("corrListe");
  if (!panneau || !boite) return;
  const lien = typeof amiPartieEnCours === "function" && amiPartieEnCours();
  panneau.classList.toggle("hide", !corrParties.length && !lien);
  const msg = $("corrMessage");
  if (msg) { msg.textContent = corrMessage; msg.classList.toggle("hide", !corrMessage); }
  boite.textContent = "";
  const rang = x => (x.s === "jeu" && x.atoi ? 0 : x.s === "invite" ? 1 : x.s === "fin" ? 2 : x.s === "jeu" ? 3 : 4);
  for (const x of corrParties.slice().sort((a, b) => rang(a) - rang(b) || a.ech - b.ech)) boite.appendChild(corrLigne(x));
  if (lien) boite.appendChild(corrLigneLien());
}
async function corrAction(quoi, id) {
  corrMessage = "";
  if (quoi === "accepter") {
    const r = await directAccepter(id);
    if (r.id) { await corrActualiser(); corrOuvrir(id); return; }
    corrMessage = t(r.erreur === "plein" ? "You already have 10 correspondence games in progress. Finish one before starting another."
      : r.erreur === "reseau" ? "No connection. Check your network and try again." : "This game is over or no longer exists.");
  } else if (quoi === "refuser") await directRefuser(id);
  else if (quoi === "retirer") await directRetirer(id);
  await corrActualiser();
  corrRendre();
}

if (typeof DIRECT_OUVERT !== "undefined" && DIRECT_OUVERT && document.getElementById("corrPanel")) {
  $("corrListe").addEventListener("click", e => {
    const b = e.target.closest("button[data-corr]"); if (!b) return;
    const l = b.closest(".corr-item"); if (!l) return;
    b.disabled = true;
    corrAction(b.dataset.corr, l.dataset.id);
  });
  if ($("menuCorrLigne")) $("menuCorrLigne").addEventListener("click", () => {
    if (typeof menuFermer === "function") menuFermer();
    setMode("jouer"); if (typeof goTop === "function") goTop();
  });
  /* Le carre : un appui mene a la liste ; il suit l'ecran et la partie en cours. */
  if ($("carreParties")) {
    $("carreParties").addEventListener("click", () => { setMode("jouer"); if (typeof goTop === "function") goTop(); });
    setInterval(corrCarre, 1000);
  }
  /* Le temps restant avance tout seul, une fois par minute. */
  setInterval(() => { if (corrParties.length && !document.hidden && mode === "jouer") corrRendre(); }, 60000);
  const avant = setMode;
  setMode = function (m) {
    /* Quitter l'ecran d'une partie par correspondance referme son fil : elle
       attend sur le serveur, et ne retient ni l'onglet Jouer ni les fenetres. */
    if (m !== "friend" && directId && directEstCorr()) directQuitter(mode !== "friend");
    const r = avant.apply(this, arguments);
    if (m === "jouer") { corrRendre(); corrActualiser(); }
    corrCarre();
    return r;
  };
}
