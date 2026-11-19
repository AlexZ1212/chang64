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
 *       cad : 0 = 10 min, 1 = 5 min + 3 s, 2 = 15 min + 10 s
 *       erreur : "session" (pas connecte), "adversaire" (pseudo inconnu),
 *                "trop" (trop de parties creees, reessayer plus tard),
 *                "limite" (parties fermees jusqu'a demain), "reseau"
 *   directOuvrir(id, sur)     -> fil
 *       sur.etat(e)     a chaque changement (voir vue() cote serveur)
 *       sur.coupe()     le fil est tombe, on reessaie tout seul
 *       sur.perdu()     on n'y arrive pas : partie introuvable, pleine, ou
 *                       session finie
 *       sur.erreur(e)   "coup" (refuse) ou "limite"
 *       fil.coup("e2e4"), fil.abandon(), fil.nulle(), fil.nulleNon(),
 *       fil.revanche(), fil.fermer(), fil.reste(e, "b"|"n") (millisecondes)
 */
const DIRECT_CADENCES = [[600, 0], [300, 3], [900, 10]];
const DIRECT_ESSAIS = 5;          /* echecs de suite avant de renoncer */
let directBase = "";              /* autre origine : essais hors navigateur */
let directEntetes = null;
let directDelai = 500;            /* premiere attente avant de reessayer, puis le double */

function directAdresse(chemin, ws) {
  const base = directBase || (typeof location !== "undefined" ? location.origin : "");
  return (ws ? base.replace(/^http/, "ws") : base) + "/api/partie/" + chemin;
}
async function directCreer(cad, pseudo) {
  try {
    const r = await fetch(directAdresse("creer"), {
      method: "POST", credentials: "same-origin",
      headers: Object.assign({ "Content-Type": "application/json" }, directEntetes || {}),
      body: JSON.stringify(pseudo ? { cad, adv: pseudo } : { cad })
    });
    const d = await r.json().catch(() => null);
    if (r.ok && d && d.id) return { id: d.id };
    return { erreur: d && d.erreur || (r.status === 429 ? "trop" : "reseau") };
  } catch (e) { return { erreur: "reseau" }; }
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
    if (echecs > DIRECT_ESSAIS) { voulu = false; return dire("perdu"); }
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
  fil.couper = () => { if (ws) { try { ws.close(); } catch (e) {} } };
  /* Temps restant a une couleur, maintenant. Seule la pendule du joueur au
     trait tourne, et seulement une fois que chacun a joue son premier coup. */
  fil.reste = (e, couleur) => {
    const t = couleur === "b" ? e.tb : e.tn;
    const trait = e.coups.length % 2 ? "n" : "b";
    if (e.phase !== "jeu" || trait !== couleur) return t;
    return Math.max(0, t - (Date.now() - fil.decalage - e.maj));
  };
  brancher();
  return fil;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { directCreer, directOuvrir, DIRECT_CADENCES, directRegler(base, entetes, delai) { directBase = base; directEntetes = entetes; if (delai) directDelai = delai; } };
}
