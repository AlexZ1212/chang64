/* chang64 - badges des parties entre membres et des nouvelles fonctions (2026-11-22)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Trente badges pour la partie en direct, le Blitz, la correspondance,
 * l'adversaire au hasard, les Elo, les ligues, les amis, les defis entre
 * membres et les coups prepares (liste et paliers valides par Alexandre le
 * 21/11 au soir). Les textes sont dans badges-catalogue.js, les conditions
 * simples (Elo contre l'ordinateur) dans badges.js ; ici, ce qui regarde le
 * serveur des parties et le compte.
 *
 * D'ou viennent les nombres :
 * - a la fin d'une partie entre membres, le serveur des parties envoie avec
 *   l'etat final la variation d'Elo (elo) et, depuis cette version, les
 *   compteurs du joueur (cpt : gagnees, nulles, perdues, parties classees par
 *   famille). Rien n'est compte par le navigateur : un palier est donc donne
 *   au bon moment, sur des chiffres verifies. Un serveur des parties pas
 *   encore redeploye n'envoie pas cpt : les paliers arrivent alors a la
 *   visite suivante, par le rattrapage ;
 * - a l'arrivee sur le site, la fiche publique du membre donne les memes
 *   chiffres (dir, ef) : c'est le RATTRAPAGE des parties deja jouees, qui
 *   entre dans la collection sans fenetre (bxAdopter, badges.js).
 *
 * Regle du site : aucune recompense pendant une partie. La fenetre Bravo ne
 * s'ouvre qu'une fois la partie finie (bravoOccupe) ; ce qui est seulement
 * note en chemin (coup prepare, trois parties par correspondance, ligue,
 * cinquieme ami) est annonce a la fin de la partie ou de l'exercice suivant,
 * comme les autres badges de membre (cpBadge, compte.js).
 */
const BXM_PALIERS = [900, 1000, 1200];   /* Elo entre membres, toutes familles */
const BXM_ETABLI = 20;                   /* parties classees dans une meme famille */
const BXM_AMIS = 5;
const BXM_SIMUL = 3;                     /* parties par correspondance en cours a la fois */
const BXM_GOLIATH = 100;                 /* points d'Elo de plus chez l'adversaire battu */
const BXM_FAMILLES = ["b", "r", "c", "k"];   /* Blitz, Rapide, Classique, Correspondance */

/* Les nombres du serveur : x = { v, n, d : parties gagnees, nulles, perdues ;
   f : [parties classees en Blitz, Rapide, Classique, Correspondance] ;
   r : le meilleur Elo entre membres connu }. Pose les faits acquis et rend
   les identifiants concernes (pour le rattrapage). */
function bxmNombres(x) {
  const ids = [];
  if (!x || typeof x !== "object" || typeof bxMarquer !== "function") return ids;
  const nb = v => Math.max(0, Math.floor(+v || 0));
  const v = nb(x.v), d = nb(x.d), total = v + nb(x.n) + d;
  const f = BXM_FAMILLES.map((c, i) => nb(Array.isArray(x.f) ? x.f[i] : 0)), r = nb(x.r);
  const m = (id, ok) => { if (ok) { bxMarquer(id); ids.push(id); } };
  m("mp_1", total >= 1);
  m("mp_victoire", v >= 1);
  m("mp_10", total >= 10);
  m("mp_50", total >= 50);
  m("lec_membre", d >= 1);
  m("cad_blitz", f[0] >= 1);
  m("cad_corr", f[3] >= 1);
  m("cad_toutes", f.every(y => y >= 1));
  m("em_etabli", f.some(y => y >= BXM_ETABLI));
  for (const p of BXM_PALIERS) m("em_" + p, r >= p);
  return ids;
}
/* La fiche publique d'un membre (route profil) ramenee a ces nombres. */
function bxmDepuisFiche(j) {
  if (!j || typeof j !== "object") return null;
  const dir = j.dir && typeof j.dir === "object" ? j.dir : {};
  const ef = j.ef && typeof j.ef === "object" ? j.ef : j.em && typeof j.em === "object" ? { r: j.em } : {};
  const un = c => (ef[c] && typeof ef[c] === "object" && ef[c].n > 0 ? ef[c] : null);
  return { v: dir.v, n: dir.n, d: dir.d, f: BXM_FAMILLES.map(c => (un(c) ? un(c).n : 0)),
    r: Math.max.apply(null, [0].concat(BXM_FAMILLES.map(c => (un(c) ? +un(c).r || 0 : 0)))) };
}

/* ---------- Fin d'une partie entre membres ---------- */
/* Appelee a chaque etat recu (directRecu, direct_ecran.js) ; n'agit que sur
   une partie finie avec un resultat. L'etat final arrive d'abord seul, puis
   une seconde fois avec l'Elo et les compteurs : la verification attend un
   instant, pour que tous les badges d'une meme partie partagent la fenetre. */
let bxmMinuteur = 0;
function bxmVerifierBientot(ms) {
  clearTimeout(bxmMinuteur);
  bxmMinuteur = setTimeout(() => { bxmMinuteur = 0; if (typeof bxVerifier === "function") bxVerifier(); }, ms);
}
function bxmFin(e) {
  if (typeof bxMarquer !== "function" || !e || e.phase !== "fin" || !e.fin || !e.fin.r || !Array.isArray(e.coups) || e.coups.length < 2) return;
  /* Les deux places tenues par le meme compte : rien a recompenser. */
  if (e.b && e.b === e.nr) return;
  const moi = e.moi, autre = moi === "b" ? "n" : "b";
  if (moi !== "b" && moi !== "n") return;
  const res = e.fin.r === "1/2" ? "draw" : (e.fin.r === "1-0") === (moi === "b") ? "win" : "loss";
  const corr = !!(e.cad && e.cad[0] >= 86400);
  bxActivite();
  bxMarquer("mp_1");
  if (res === "win") bxMarquer("mp_victoire");
  if (res === "loss") { bxMarquer("lec_membre"); if (e.fin.m === "temps") bxMarquer("lec_membre_temps"); }
  const fam = e.elo && e.elo.f ? e.elo.f : corr ? "k" : e.cad && e.cad[0] < 600 ? "b" : "";
  if (fam === "b") bxMarquer("cad_blitz");
  if (fam === "k") bxMarquer("cad_corr");
  /* Une revanche en direct est la manche suivante de la meme partie. */
  if (!corr && e.n > 1) bxMarquer("mp_revanche");
  const h = bxEtat().c.hasard;
  if (Array.isArray(h) && h.includes(e.id)) bxMarquer("mp_hasard");
  const em = e.elo && e.elo[moi], ea = e.elo && e.elo[autre];
  if (em && typeof em.r === "number") {
    for (const p of BXM_PALIERS) if (em.r >= p) bxMarquer("em_" + p);
    /* L'Elo d'avant la partie : le nouveau moins la variation. */
    if (res === "win" && ea && typeof ea.r === "number" && typeof ea.d === "number" && typeof em.d === "number" &&
      (ea.r - ea.d) - (em.r - em.d) >= BXM_GOLIATH) bxMarquer("mp_david");
  }
  if (e.cpt && typeof e.cpt === "object") bxmNombres({ v: e.cpt.v, n: e.cpt.n, d: e.cpt.d, f: e.cpt.f, r: em && typeof em.r === "number" ? em.r : 0 });
  bxmVerifierBientot(e.elo ? 400 : 1500);
  /* Contre un membre de ma liste d'amis (la liste est gardee une minute). */
  const adv = moi === "b" ? e.nr : e.b;
  if (adv && !bxEtat().f.mb_ami_partie && typeof cpaCharger === "function") {
    cpaCharger().then(l => {
      if (l && Array.isArray(l.amis) && l.amis.some(a => a && a.p === adv)) { bxMarquer("mb_ami_partie"); bxmVerifierBientot(300); }
    }).catch(() => {});
  }
}

/* ---------- Ce qui est seulement note en chemin ---------- */
/* Adversaire au hasard : la partie ouverte par « Chercher un adversaire » est
   retenue (les 20 dernieres), pour la reconnaitre a sa fin, meme des jours
   plus tard par correspondance et sur un autre appareil. */
function bxmHasard(id) {
  if (typeof bxEtat !== "function" || !/^[a-z2-9]{12}$/.test(String(id))) return;
  const c = bxEtat().c;
  c.hasard = Array.isArray(c.hasard) ? c.hasard : [];
  if (c.hasard.includes(id)) return;
  c.hasard.push(id);
  c.hasard = c.hasard.slice(-20);
  saveProg();
}
/* Trois parties par correspondance en cours a la fois (corrRecu, corr.js). */
function bxmCorr(liste) {
  if (typeof cpBadge !== "function" || !Array.isArray(liste)) return;
  if (liste.filter(x => x && x.s === "jeu").length >= BXM_SIMUL) cpBadge("cad_simul");
}
/* Ligues (ecran « Ma ligue », compte.js). j : la reponse de la route ligue ;
   dansGroupe : le membre est range dans un groupe cette semaine. Les badges
   de ligue ne se montrent qu'une fois les ligues ouvertes (bxVisible). */
function bxmLigue(j, dansGroupe) {
  if (typeof cpBadge !== "function" || !j || !j.ouvert) return;
  const c = bxEtat().c;
  if (!c.ligues) { c.ligues = 1; saveProg(); }
  const lg = Math.floor(+j.ligue || 0);
  if (dansGroupe) cpBadge("ligue_groupe");
  if (j.mouv === 1) cpBadge("ligue_monte");
  if (lg >= 3) cpBadge("ligue_tour");
  if (lg >= 4) cpBadge("ligue_dame");
}
/* Cinq amis dans la liste (cpaCharger, compte.js). */
function bxmAmis(l) {
  if (typeof cpBadge !== "function" || !l || !Array.isArray(l.amis)) return false;
  if (l.amis.length < BXM_AMIS) return false;
  cpBadge("mb_amis5");
  return true;
}

/* ---------- Rattrapage ---------- */
/* Une fois par membre et par visite : la fiche du serveur et la liste d'amis
   disent ce qui a deja ete merite ; ces badges entrent dans la collection
   sans fenetre, avec une seule annonce discrete (bxAdopter). Rien pour un
   visiteur sans compte : ces badges demandent un compte. */
let bxmRattrape = "";
function bxmRattraper() {
  if (typeof cp === "undefined" || !cp || !cp.pseudo || bxmRattrape === cp.pseudo) return;
  if (typeof cppLire !== "function" || typeof bxAdopter !== "function") return;
  /* Une synchronisation est en cours : elle peut apporter des badges deja gagnes sur un autre appareil. */
  if (typeof cpEnCours !== "undefined" && cpEnCours) { setTimeout(bxmRattraper, 1000); return; }
  const pseudo = cp.pseudo;
  bxmRattrape = pseudo;
  /* Une partie vient de finir : sa fenetre Bravo passe d'abord. */
  const adopter = ids => { if (bxmMinuteur) { setTimeout(() => adopter(ids), 600); return; } bxAdopter(ids); };
  cppLire(pseudo).then(j => {
    if (!cp || cp.pseudo !== pseudo || !j || j.p !== pseudo) return;
    const x = bxmDepuisFiche(j);
    if (x) adopter(bxmNombres(x));
  }).catch(() => { bxmRattrape = ""; });
  if (typeof cpaCharger === "function") cpaCharger().then(l => { if (cp && cp.pseudo === pseudo && bxmAmis(l)) adopter(["mb_amis5"]); }).catch(() => {});
}
setTimeout(bxmRattraper, 4000);

/* ---------- Jamais pendant une partie ---------- */
/* Une partie entre membres qu'on vient d'ouvrir et dont l'etat n'est pas
   encore arrive compte deja comme une partie en cours : sans cela, une
   fenetre en attente s'ouvrait par-dessus la partie par correspondance qu'on
   venait de choisir dans la liste. */
if (typeof bravoOccupe === "function") {
  const av = bravoOccupe;
  bravoOccupe = function () {
    if (av.apply(this, arguments)) return true;
    return typeof directId !== "undefined" && !!directId && typeof directE !== "undefined" && !directE;
  };
}
