/* chang64 - partie en direct entre deux membres, cote navigateur (2026-11-19)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Le fil avec le serveur des parties (src/worker-parties/index.js), sans rien
 * d'ecran : creer une partie, s'y brancher, y revenir apres une coupure. Le
 * serveur decide de tout (coups permis, pendule, fin) ; ici on ne fait
 * qu'envoyer une intention et afficher l'etat recu.
 *
 *   directCreer(cad, pseudo)  -> Promise {id} ou {erreur}
 *       cad : 0 = 10 min, 1 = 5 min + 3 s, 2 = 15 min + 10 s, 3 a 5 = classiques,
 *             6 a 8 = correspondance, 9 = blitz 3 min + 2 s
 *       erreur : "session" (pas connecte), "adversaire" (pseudo inconnu),
 *                "trop" (trop de parties creees, reessayer plus tard),
 *                "invitations" (trop d'invitations en attente chez ce membre),
 *                "limite" (parties fermees jusqu'a demain), "reseau"
 *   directOuvrir(id, sur)     -> fil
 *       sur.etat(e)     a chaque changement (voir vue() cote serveur)
 *       sur.coupe()     le fil est tombe, on reessaie tout seul
 *       sur.perdu()     on n'y arrive pas : partie introuvable, pleine, ou
 *                       session finie
 *       sur.erreur(e)   "coup" (refuse) ou "limite"
 *       fil.coup("e2e4"), fil.abandon(), fil.nulle(), fil.nulleNon(),
 *       fil.revanche(), fil.fermer(), fil.reste(e, "b"|"n") (millisecondes)
 *
 * Par correspondance (2026-11-21) : cadences 6, 7, 8 = 1, 3, 7 jours PAR COUP.
 * Meme fil, memes messages ; le temps restant (fil.reste) est alors celui du
 * coup en cours. En plus :
 *   directNouvelles()   -> { liste, corr } : invitations du direct, et mes
 *       parties par correspondance (voir corrListe cote serveur)
 *   directAccepter(id)  -> { id } ou { erreur } ("plein" : deja 10 parties)
 *   directRetirer(id)   retire mon invitation ou ma recherche
 */
/* Meme liste, dans le meme ordre, que CADENCES du Worker : chaque cadence
   garde son numero pour toujours (les parties en cours et les invitations le
   portent), une nouvelle s'ajoute a la suite. L'ORDRE DE L'ECRAN est celui des
   listes par famille ci-dessous, de la plus courte a la plus longue
   (2026-11-22, demande d'Alexandre), avec les memes familles que contre
   l'ordinateur : le 5+3 est un Blitz, le 10+5 (numero 10) un Rapide. Entre
   membres, toujours un increment en Blitz : ni 3+0 ni 5+0. */
const DIRECT_CADENCES = [[600, 0], [300, 3], [900, 10], [1800, 0], [1800, 20], [3600, 0], [86400, 0], [259200, 0], [604800, 0], [180, 2], [600, 5]];
const DIRECT_RAPIDES = [0, 10, 2], DIRECT_CLASSIQUES = [3, 4, 5];
/* Correspondance : un delai par coup, 1, 3 ou 7 jours. */
const DIRECT_CORR = [6, 7, 8];
/* Blitz : 3+2 (numero 9, 2026-11-21), puis 5+3 (numero 1, range ici le 2026-11-22). */
const DIRECT_BLITZ = [9, 1];
/* Les familles du choix de cadence, dans l'ordre de l'ecran (le meme que contre l'ordinateur). */
const DIRECT_FAMILLES = [["Blitz", DIRECT_BLITZ], ["Rapid", DIRECT_RAPIDES], ["Classical", DIRECT_CLASSIQUES]];
function directCadCorr(i) { return DIRECT_CORR.includes(i); }
const DIRECT_ESSAIS = 5;          /* echecs de suite avant de renoncer, si la partie n'a jamais repondu */
const DIRECT_ESSAIS_EN_JEU = 60;  /* partie deja vue : on insiste (telephone verrouille, tunnel), environ un quart d'heure */
let directBase = "";              /* autre origine : essais hors navigateur */
let directEntetes = null;
let directDelai = 500;            /* premiere attente avant de reessayer, puis le double */

function directAdresse(chemin, ws) {
  const base = directBase || (typeof location !== "undefined" ? location.origin : "");
  return (ws ? base.replace(/^http/, "ws") : base) + "/api/partie/" + chemin;
}
/* coul : "b" (je joue les Blancs), "n" (les Noirs), sinon au hasard. */
async function directCreer(cad, pseudo, coul) {
  try {
    const corps = pseudo ? { cad, adv: pseudo } : { cad };
    if (coul === "b" || coul === "n") corps.coul = coul;
    const r = await fetch(directAdresse("creer"), {
      method: "POST", credentials: "same-origin",
      headers: Object.assign({ "Content-Type": "application/json" }, directEntetes || {}),
      body: JSON.stringify(corps)
    });
    const d = await r.json().catch(() => null);
    if (r.ok && d && d.id) return { id: d.id, adv: typeof d.adv === "string" ? d.adv : "" };
    return { erreur: d && d.erreur || (r.status === 429 ? "trop" : "reseau") };
  } catch (e) { return { erreur: "reseau" }; }
}
/* Adversaire au hasard : { id, attente } (attente = personne encore, la partie
   est ouverte et j'y attends), ou { erreur }. A redemander tant qu'on attend. */
async function directChercher(cad) {
  try {
    const r = await fetch(directAdresse("chercher"), {
      method: "POST", credentials: "same-origin",
      headers: Object.assign({ "Content-Type": "application/json" }, directEntetes || {}), body: JSON.stringify({ cad })
    });
    const d = await r.json().catch(() => null);
    if (r.ok && d && d.id) return { id: d.id, attente: !!d.attente };
    return { erreur: d && d.erreur || (r.status === 429 ? "trop" : "reseau") };
  } catch (e) { return { erreur: "reseau" }; }
}
function directChercherFin() {
  return fetch(directAdresse("chercher-fin"), {
    method: "POST", credentials: "same-origin",
    headers: Object.assign({ "Content-Type": "application/json" }, directEntetes || {}), body: "{}"
  }).catch(() => {});
}
/* Les invitations recues, les plus recentes d'abord : [{id, p, cad, cree}].
   La meme reponse porte les parties par correspondance du membre : elles
   voyagent avec le tableau rendu (propriete corr), pour ne pas doubler la
   requete ; deux lectures en meme temps ne se marchent pas dessus. */
async function directInvitations() {
  try {
    const r = await fetch(directAdresse("invitations"), { credentials: "same-origin", headers: directEntetes || {} });
    const d = r.ok ? await r.json().catch(() => null) : null;
    const liste = d && Array.isArray(d.liste) ? d.liste : [];
    if (d && Array.isArray(d.corr)) liste.corr = d.corr;
    return liste;
  } catch (e) { return []; }
}
/* Invitations du direct ET parties par correspondance, en une seule requete. */
async function directNouvelles() {
  const liste = await directInvitations();
  return { liste, corr: liste && liste.corr || [], ok: !!(liste && liste.corr) };
}
async function directPoster(route, corps) {
  try {
    const r = await fetch(directAdresse(route), {
      method: "POST", credentials: "same-origin",
      headers: Object.assign({ "Content-Type": "application/json" }, directEntetes || {}), body: JSON.stringify(corps)
    });
    const d = await r.json().catch(() => null);
    if (r.ok && d) return d;
    return { erreur: d && d.erreur || "reseau" };
  } catch (e) { return { erreur: "reseau" }; }
}
function directAccepter(id) { return directPoster("accepter", { id }); }
function directRetirer(id) { return directPoster("retirer", { id }); }
function directRefuser(id) {
  return fetch(directAdresse("refuser"), {
    method: "POST", credentials: "same-origin",
    headers: Object.assign({ "Content-Type": "application/json" }, directEntetes || {}), body: JSON.stringify({ id })
  }).catch(() => {});
}
function directOuvrir(id, sur) {
  sur = sur || {};
  const fil = { etat: null, ouvert: false, decalage: 0 }, entetes = directEntetes;
  let ws = null, voulu = true, echecs = 0, minuteur = null, battement = null;
  const dire = (quoi, x) => { try { if (sur[quoi]) sur[quoi](x); } catch (e) {} };
  function brancher() {
    minuteur = null;
    if (!voulu) return;
    try { ws = entetes ? new WebSocket(directAdresse("ws?id=" + id, true), { headers: entetes }) : new WebSocket(directAdresse("ws?id=" + id, true)); }
    catch (e) { return retenter(); }
    const moi = ws;
    moi.onopen = () => {
      fil.ouvert = true;
      battement = setInterval(() => { try { moi.send("ping"); } catch (e) {} }, 25000);
      if (battement.unref) battement.unref();
    };
    moi.onmessage = m => {
      if (m.data === "pong") return;
      let d = null;
      try { d = JSON.parse(m.data); } catch (e) { return; }
      if (!d) return;
      echecs = 0;
      if (d.t === "etat") {
        /* L'horloge du serveur fait foi : on retient l'ecart avec la notre. */
        fil.decalage = Date.now() - d.h;
        fil.etat = d;
        dire("etat", d);
      } else if (d.t === "erreur") dire("erreur", d.e);
    };
    moi.onclose = () => {
      if (ws !== moi) return;
      clearInterval(battement);
      fil.ouvert = false; ws = null;
      if (voulu) retenter();
    };
    moi.onerror = () => {};
  }
  function retenter() {
    echecs++;
    if (echecs > (fil.etat ? DIRECT_ESSAIS_EN_JEU : DIRECT_ESSAIS)) { voulu = false; return dire("perdu"); }
    dire("coupe");
    minuteur = setTimeout(brancher, Math.min(15000, directDelai * Math.pow(2, echecs - 1)));
  }
  const envoyer = o => { if (ws && fil.ouvert) { try { ws.send(JSON.stringify(o)); return true; } catch (e) {} } return false; };
  fil.coup = c => envoyer({ t: "coup", c });
  fil.abandon = () => envoyer({ t: "abandon" });
  fil.nulle = () => envoyer({ t: "nulle" });
  fil.nulleNon = () => envoyer({ t: "nulle-non" });
  fil.revanche = () => envoyer({ t: "revanche" });
  fil.fermer = () => {
    voulu = false;
    clearTimeout(minuteur); clearInterval(battement);
    if (ws) { try { ws.close(1000); } catch (e) {} }
  };
  /* Fil a refaire tout de suite (retour du reseau, onglet reveille). */
  fil.couper = () => {
    if (ws) { try { ws.close(); } catch (e) {} }
    else if (voulu && minuteur) { clearTimeout(minuteur); brancher(); }
  };
  /* Temps restant a une couleur, maintenant. Seule la pendule du joueur au
     trait tourne, et seulement une fois que chacun a joue son premier coup. */
  fil.reste = (e, couleur) => {
    const t = couleur === "b" ? e.tb : e.tn;
    const trait = e.coups.length % 2 ? "n" : "b";
    /* Par correspondance le delai court des le premier coup (pas de minute de grace). */
    const court = e.phase === "jeu" || (e.phase === "debut" && e.cad[0] >= 86400);
    if (!court || trait !== couleur) return t;
    return Math.max(0, t - (Date.now() - fil.decalage - e.maj));
  };
  brancher();
  return fil;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { directCreer, directOuvrir, directInvitations, directRefuser, directChercher, directNouvelles, directAccepter, directRetirer, DIRECT_CADENCES, DIRECT_RAPIDES, DIRECT_CLASSIQUES, DIRECT_CORR, DIRECT_BLITZ, DIRECT_FAMILLES, directRegler(base, entetes, delai) { directBase = base; directEntetes = entetes; if (delai) directDelai = delai; } };
}
