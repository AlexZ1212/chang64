/* chang64 - parties en direct entre deux membres (2026-11-19)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Un Worker a part du projet Pages, parce qu'un projet Pages ne peut pas
 * definir de Durable Object. Il n'a AUCUNE adresse workers.dev : il n'est
 * servi que par la route chang64.com/api/partie/* (voir wrangler.toml), donc
 * sous le meme domaine que le site, et il recoit le cookie de session du
 * compte (Path=/api/).
 *
 * Routes :
 *   POST /api/partie/creer   {cad: 0|1|2, adv?: pseudo}  ->  {id}
 *        (20 creations par heure et par membre, sinon 429 « trop »)
 *   GET  /api/partie/ws?id=  (WebSocket)                  la partie elle-meme
 *   GET  /api/partie/invitations                          ->  {liste:[{id, p, cad, coul, cree}]}
 *   POST /api/partie/refuser {id}                         l'invite decline ; celui qui
 *        a invite le voit (fin "refusee"), sans autre detail
 *
 * Par correspondance (2026-11-21) : cadences 6, 7 et 8 = 1, 3 ou 7 jours PAR
 * COUP. Meme objet, memes messages, meme ecran ; seules changent les durees
 * (voir echeance()) et la facon de compter le temps (le delai repart a
 * chaque coup). L'objet dort des jours entiers : son alarme le reveille a
 * l'echeance, que quelqu'un soit la ou non. Une table de la base du site,
 * correspondances (compte-schema.sql), tient l'annuaire de ces parties :
 * c'est elle qui donne a un membre la liste de ses parties et lui dit quand
 * c'est a lui de jouer. L'objet reste seul juge ; la table le suit (suivre()).
 *   POST /api/partie/creer {cad: 6|7|8, adv: pseudo}      invitation, valable 7 jours
 *   POST /api/partie/chercher {cad: 6|7|8}                adversaire au hasard : rejoint
 *        une recherche ouverte, sinon en ouvre une (7 jours)
 *   POST /api/partie/accepter {id}                        l'invite s'assoit
 *   POST /api/partie/retirer {id}                         le createur retire son invitation
 *        ou sa recherche, tant que personne n'est venu
 *   GET  /api/partie/invitations                          rend aussi corr:[...], les
 *        parties par correspondance du membre (voir corrListe)
 *   10 parties par correspondance en cours au plus par membre (erreur « plein »).
 *   Une fois par heure, balayer() retire des parties tout ce qui reste d'un
 *   compte supprime et reveille une partie dont l'alarme n'aurait pas sonne.
 *
 * Inviter un membre par son pseudo (adv) lui reserve la partie et pose une
 * ligne dans la table invitations de la base du site (compte-schema.sql),
 * gardee 30 minutes au plus : c'est ce que sa page vient lire. Elle part des
 * qu'il rejoint ou refuse. Le code tolere l'absence de la table.
 *
 * Un objet Partie par partie. Il verifie chaque coup avec le moteur du site
 * (src/engine.js), tient la pendule, et dort entre deux messages (API
 * d'hibernation des WebSockets) : seul le temps de traitement compte.
 *
 * Economie des ecritures (100 000 lignes par jour en offre gratuite) :
 * - tout l'etat tient dans UNE ligne, reecrite a chaque coup ;
 * - l'alarme n'est reposee que si elle doit sonner plus TOT que prevu ; une
 *   alarme qui sonne trop tot se repose toute seule. Une partie coute ainsi
 *   une ligne par coup et une poignee d'alarmes, au lieu de deux par coup.
 *
 * Messages recus (JSON) : {t:"coup", c:"e2e4"} {t:"abandon"} {t:"nulle"}
 *   {t:"nulle-non"} {t:"revanche"} ; le texte "ping" recoit "pong" sans
 *   reveiller l'objet.
 * Message envoye : {t:"etat", ...} a chaque changement (voir vue()), ou
 *   {t:"erreur", e:"limite"|"coup"}.
 */
import moteur from "../engine.js";
const { Game, pType, pColor, K } = moteur;

const COOKIE = "__Secure-c64";
const JOUR = 864e5;
const DUREE_JETON = 180 * JOUR;          /* comme le serveur du compte */
/* Secondes + secondes par coup. Les trois premieres sont les cadences rapides
   d'origine ; les classiques (2026-11-21) s'ajoutent A LA SUITE : le numero
   d'une cadence voyage dans les liens et les invitations, il ne doit jamais
   changer. */
const CADENCES = [[600, 0], [300, 3], [900, 10], [1800, 0], [1800, 20], [3600, 0],
  /* Correspondance (2026-11-21) : un delai PAR COUP, en secondes (1, 3, 7 jours). */
  [86400, 0], [259200, 0], [604800, 0]];
const CORR = 6;                          /* premiere cadence par correspondance */
const corr = cad => cad >= CORR;
/* Une invitation garde aussi la couleur de l'invite, dans la meme colonne que
   la cadence, pour ne pas ajouter de colonne a la table : cad + 16 s'il joue
   les Blancs, cad + 32 s'il joue les Noirs. Une ancienne ligne (sans couleur)
   se lit comme avant. */
const COULEUR_INVITE = { b: 16, n: 32 };
const PREMIER_COUP = 60e3;               /* sinon la partie est annulee */
const GARDE = 30 * 60e3;                 /* attente d'un adversaire, puis d'une revanche */
const CREATIONS_PAR_HEURE = 20;          /* par membre : un script ne vide pas le quota du jour */
const HEURE = 3600e3;
const INVITATIONS_MEME_MEMBRE = 3;       /* en attente, d'un meme membre vers un meme invite */
const SALLE_ATTENTE = 40e3;              /* sans nouvelles d'un membre qui cherche, il sort de la salle */
const INVITATIONS_BOITE = 10;            /* en attente chez un invite */
const CORR_ATTENTE = 7 * JOUR;           /* invitation ou recherche restee sans reponse */
const CORR_GARDE = 14 * JOUR;            /* partie finie gardee, le temps que chacun voie la fin */
const CORR_MAX = 10;                     /* parties par correspondance en cours, par membre */
const ID = /^[a-z2-9]{12}$/;
const ALPHA_ID = "abcdefghjkmnpqrstuvwxyz23456789";   /* sans i, l, o, 0, 1 */

/* ---------- Outils ---------- */
const enc = new TextEncoder();
function b64u(octets) {
  let s = "";
  for (const o of new Uint8Array(octets)) s += String.fromCharCode(o);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256(texte) { return b64u(await crypto.subtle.digest("SHA-256", enc.encode(texte))); }
function json(corps, statut) {
  return new Response(JSON.stringify(corps), {
    status: statut || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}
const erreur = (code, statut) => json({ erreur: code }, statut);
function memeOrigine(request, exigee) {
  const o = request.headers.get("Origin");
  if (!o) return !exigee;
  try { return new URL(o).host === new URL(request.url).host; } catch (e) { return false; }
}
function idTirer() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  let s = "";
  for (const o of a) s += ALPHA_ID[o % ALPHA_ID.length];
  return s;
}
/* Le membre de la session en cours, ou null. Lecture seule : c'est le serveur
   du compte qui fait avancer la date de derniere activite. */
async function sessionLire(request, env, now) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([A-Za-z0-9_-]{43})(?:;|$)"));
  if (!m) return null;
  const c = await env.DB.prepare(
    "SELECT c.id, c.pseudo, j.vu AS jvu FROM jetons j JOIN comptes c ON c.id = j.compte_id WHERE j.hash = ?1"
  ).bind(await sha256(m[1])).first();
  return c && c.jvu >= now - DUREE_JETON ? c : null;
}
/* Vrai si l'un des deux a bloque l'autre. Sans la table, personne n'est bloque. */
async function bloques(env, a, b) {
  try {
    return !!(await env.DB.prepare(
      "SELECT 1 AS x FROM blocages WHERE (compte_id = ?1 AND bloque_id = ?2) OR (compte_id = ?2 AND bloque_id = ?1) LIMIT 1"
    ).bind(a, b).first());
  } catch (e) { return false; }
}

/* Niveau d'un membre, pour rapprocher les adversaires tires au hasard : son
   Elo entre membres des qu'il en a un, sinon sa note aux exercices. */
async function niveau(env, id) {
  let note = 800;
  try { const c = await env.DB.prepare("SELECT note FROM comptes WHERE id = ?1").bind(id).first(); if (c && c.note > 0) note = c.note; } catch (e) {}
  /* Requete a part : la base peut ne pas encore avoir la colonne. */
  try { const c = await env.DB.prepare("SELECT elo FROM comptes WHERE id = ?1").bind(id).first(); if (c && c.elo > 0) note = c.elo; } catch (e) {}
  return note;
}

/* ---------- Correspondance : l'annuaire ---------- */
/* Parties en cours d'un membre (invitations envoyees et recherches comprises). */
async function corrCompte(env, id) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM correspondances WHERE etat < 2 AND (b = ?1 OR n = ?1)").bind(id).first();
  return r ? r.n : 0;
}
/* Les parties par correspondance d'un membre, pour sa liste et sa pastille :
     s : "invite" (on m'invite), "envoyee" (j'attends sa reponse), "cherche"
         (j'attends un adversaire au hasard), "jeu", "fin" (finie, pas encore vue)
     adv : pseudo de l'autre (null tant qu'il n'y a personne), cad, coul : ma couleur,
     atoi : c'est a moi de jouer, ech : date limite, r : win | loss | draw |
     annulee | refus (quand s vaut "fin"), h : l'heure du serveur.
   Une ligne en retard sur son echeance fait reveiller sa partie, qui se remet
   d'accord avec l'annuaire (l'alarme l'aurait fait ; ceinture et bretelles). */
async function corrListe(env, moi, now, objet) {
  const lire = async () => (await env.DB.prepare(
    "SELECT x.partie AS id, x.b, x.n, x.pour, x.cad, x.etat, x.trait, x.echeance AS ech, x.res, x.vu, cb.pseudo AS pb, cn.pseudo AS pn, cp.pseudo AS pp " +
    "FROM correspondances x LEFT JOIN comptes cb ON cb.id = x.b LEFT JOIN comptes cn ON cn.id = x.n LEFT JOIN comptes cp ON cp.id = x.pour " +
    "WHERE x.b = ?1 OR x.n = ?1 OR (x.pour = ?1 AND x.etat = 0) ORDER BY x.echeance LIMIT 40"
  ).bind(moi).all()).results || [];
  let l;
  try { l = await lire(); } catch (e) { return []; }
  /* Rattrapage : echeance depassee, ou adversaire dont le compte a disparu
     (le balayage de chaque heure l'aurait fait aussi : voir balayer). */
  let reveils = 0;
  for (const x of l) {
    if (reveils >= 4) break;
    const adv = x.b === moi ? x.n : x.b, parti = x.etat >= 1 && adv && !(x.b === moi ? x.pn : x.pb);
    if (!(x.etat < 2 && x.ech < now - 5000) && !parti) continue;
    reveils++;
    try {
      const r = await objet(x.id).fetch("https://partie/annuaire?id=" + x.id + (parti ? "&parti=" + adv : ""));
      if (r.status === 404) await env.DB.prepare("DELETE FROM correspondances WHERE partie = ?1").bind(x.id).run();
    } catch (e) {}
  }
  if (reveils) { try { l = await lire(); } catch (e) {} }
  let bloques = null;
  const out = [];
  for (const x of l) {
    const assis = x.b === moi || x.n === moi, coul = x.b === moi ? "b" : x.n === moi ? "n" : x.b ? "n" : "b";
    const o = { id: x.id, cad: x.cad, coul, ech: x.ech, h: now };
    if (!assis) {
      /* Invitation recue : pas celle d'un membre bloque (dans un sens ou dans l'autre). */
      if (x.ech <= now) continue;
      if (!bloques) {
        try { bloques = ((await env.DB.prepare("SELECT bloque_id AS x FROM blocages WHERE compte_id = ?1 UNION SELECT compte_id AS x FROM blocages WHERE bloque_id = ?1").bind(moi).all()).results || []).map(y => y.x); }
        catch (e) { bloques = []; }
      }
      if (bloques.includes(x.b || x.n)) continue;
      o.s = "invite"; o.adv = x.pb || x.pn || null;
    } else if (x.etat === 0) {
      if (x.ech <= now) continue;
      o.s = x.pour ? "envoyee" : "cherche"; o.adv = x.pp || null;
    } else if (x.etat === 1) {
      o.s = "jeu"; o.adv = (coul === "b" ? x.pn : x.pb) || null; o.atoi = x.trait === moi;
    } else {
      if (x.vu & (coul === "b" ? 1 : 2)) continue;
      o.s = "fin"; o.adv = (coul === "b" ? x.pn : x.pb) || x.pp || null;
      o.r = x.res === "refus" ? "refus" : x.res === "1/2" ? "draw" : !x.res ? "annulee" : (x.res === "1-0") === (coul === "b") ? "win" : "loss";
    }
    out.push(o);
  }
  return out;
}

/* Une fois par heure (declencheur de wrangler.toml), sans attendre qu'un
   joueur revienne : les parties dont un joueur a supprime son compte n'en
   gardent plus rien (la suppression d'un compte doit tout emporter, pseudo
   compris), et celles dont l'echeance est passee sans que leur alarme ait
   sonne sont reveillees. Une lecture de la base par passage, rien d'autre
   quand tout est en ordre. */
async function balayer(env, now) {
  if (!env.DB || !env.PARTIES) return 0;
  const l = (await env.DB.prepare(
    "SELECT x.partie AS id, x.b, x.n, cb.id AS ib, cn.id AS ic FROM correspondances x LEFT JOIN comptes cb ON cb.id = x.b LEFT JOIN comptes cn ON cn.id = x.n " +
    "WHERE (x.etat >= 1 AND ((x.b <> 0 AND cb.id IS NULL) OR (x.n <> 0 AND cn.id IS NULL))) OR (x.etat < 2 AND x.echeance < ?1) LIMIT 25"
  ).bind(now - 60000).all()).results || [];
  for (const x of l) {
    const partis = [x.b && !x.ib ? x.b : 0, x.n && !x.ic ? x.n : 0].filter(Boolean);
    try {
      const r = await env.PARTIES.get(env.PARTIES.idFromName(x.id)).fetch("https://partie/annuaire?id=" + x.id + (partis.length ? "&parti=" + partis.join(",") : ""));
      if (r.status === 404) await env.DB.prepare("DELETE FROM correspondances WHERE partie = ?1").bind(x.id).run();
    } catch (e) {}
  }
  return l.length;
}

/* ---------- Entree du Worker ---------- */
async function repondre(request, env) {
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/partie\/?/, "").replace(/\/$/, "");
  if (!env.DB || !env.PARTIES) return erreur("indisponible", 503);
  const now = Date.now(), m = request.method;
  const objet = id => env.PARTIES.get(env.PARTIES.idFromName(id));

  if (m === "POST" && route === "creer") {
    if (!memeOrigine(request)) return erreur("origine", 403);
    const s = await sessionLire(request, env, now);
    if (!s) return erreur("session", 401);
    let d = null;
    try { d = JSON.parse((await request.text()).slice(0, 500)); } catch (e) {}
    if (!d || !CADENCES[d.cad]) return erreur("requete", 400);
    /* Couleur du createur (2026-11-21) : "b" Blancs, "n" Noirs, sinon au
       hasard. Tiree ici, pour que l'invitation puisse dire la sienne a l'invite. */
    if (d.coul !== undefined && d.coul !== "b" && d.coul !== "n" && d.coul !== "h") return erreur("requete", 400);
    const blancs = d.coul === "b" ? true : d.coul === "n" ? false : !!(crypto.getRandomValues(new Uint8Array(1))[0] & 1);
    let adv = null;
    if (d.adv !== undefined) {
      if (typeof d.adv !== "string" || d.adv.length > 40) return erreur("requete", 400);
      adv = await env.DB.prepare("SELECT id, pseudo FROM comptes WHERE pseudo = ?1 COLLATE NOCASE").bind(d.adv).first();
      /* Un membre qui m'a bloque repond comme un pseudo inconnu : il n'est pas denonce. */
      if (!adv || adv.id === s.id || await bloques(env, s.id, adv.id)) return erreur("adversaire", 404);
    }
    /* Le compteur du membre vit dans un objet a son nom ("membre-12"), qui ne
       peut pas se confondre avec une partie (12 signes sans tiret). */
    if ((await objet("membre-" + s.id).fetch("https://partie/quota")).status === 429) return erreur("trop", 429);
    const id = idTirer();
    if (corr(d.cad)) {
      /* Par correspondance : toujours une invitation (l'adversaire au hasard
         passe par « chercher »). L'annuaire remplace la table invitations :
         l'invitation y reste 7 jours, et la ligne suit ensuite la partie. */
      if (!adv) return erreur("requete", 400);
      let pose;
      try {
        if (await corrCompte(env, s.id) >= CORR_MAX) return erreur("plein", 429);
        await env.DB.prepare("DELETE FROM correspondances WHERE echeance < ?1 AND etat <> 1").bind(now - JOUR).run();
        pose = await env.DB.prepare(
          "INSERT INTO correspondances (partie, b, n, pour, cad, etat, trait, echeance, note, cree) SELECT ?1, ?2, ?3, ?4, ?5, 0, 0, ?6, 0, ?7 " +
          "WHERE (SELECT COUNT(*) FROM correspondances WHERE etat = 0 AND pour = ?4 AND (b = ?8 OR n = ?8)) < ?9 AND (SELECT COUNT(*) FROM correspondances WHERE etat = 0 AND pour = ?4) < ?10"
        ).bind(id, blancs ? s.id : 0, blancs ? 0 : s.id, adv.id, d.cad, now + CORR_ATTENTE, now, s.id, INVITATIONS_MEME_MEMBRE, INVITATIONS_BOITE).run();
      } catch (e) { return erreur("indisponible", 503); }   /* sans la table, pas de correspondance */
      if (pose && pose.meta && pose.meta.changes === 0) return erreur("invitations", 429);
    } else if (adv) {
      let pose = null;
      try {
        await env.DB.prepare("DELETE FROM invitations WHERE cree < ?1").bind(now - GARDE).run();
        pose = await env.DB.prepare(
          "INSERT INTO invitations (partie, de, a, cad, cree) SELECT ?1, ?2, ?3, ?4, ?5 " +
          "WHERE (SELECT COUNT(*) FROM invitations WHERE de = ?2 AND a = ?3) < ?6 AND (SELECT COUNT(*) FROM invitations WHERE a = ?3) < ?7"
        ).bind(id, s.id, adv.id, d.cad + COULEUR_INVITE[blancs ? "n" : "b"], now, INVITATIONS_MEME_MEMBRE, INVITATIONS_BOITE).run();
      } catch (e) {}
      /* Sans la table, la partie reste reservee : il suffira d'envoyer le lien. */
      if (pose && pose.meta && pose.meta.changes === 0) return erreur("invitations", 429);
    }
    const r = await objet(id).fetch("https://partie/creer", {
      method: "POST",
      body: JSON.stringify({ id, cad: d.cad, blancs, de: { id: s.id, p: s.pseudo }, pour: adv ? adv.id : null, pourP: adv ? adv.pseudo : null })
    });
    if (!r.ok) {
      if (corr(d.cad)) { try { await env.DB.prepare("DELETE FROM correspondances WHERE partie = ?1").bind(id).run(); } catch (e) {} }
      return erreur("indisponible", 503);
    }
    return json(adv ? { id, adv: adv.pseudo } : { id });
  }

  /* Adversaire au hasard (2026-11-19) : une salle d'attente, tenue par un objet
     a part ("salle-attente"). Le premier qui cherche cree une partie ordinaire
     et s'y assoit ; le suivant, a la meme cadence, la rejoint. S'il y a
     plusieurs membres en attente, on prend celui dont le niveau est le plus
     proche. Le navigateur redemande toutes les 15 secondes tant qu'il attend. */
  if (m === "POST" && (route === "chercher" || route === "chercher-fin")) {
    if (!memeOrigine(request)) return erreur("origine", 403);
    const s = await sessionLire(request, env, now);
    if (!s) return erreur("session", 401);
    const salle = objet("salle-attente");
    if (route === "chercher-fin") {
      await salle.fetch("https://partie/salle-fin", { method: "POST", body: JSON.stringify({ j: s.id }) });
      return json({ ok: true });
    }
    let d = null;
    try { d = JSON.parse((await request.text()).slice(0, 200)); } catch (e) {}
    if (!d || !CADENCES[d.cad]) return erreur("requete", 400);
    const note = await niveau(env, s.id);
    let exclus = [];
    if (corr(d.cad)) {
      /* Par correspondance, pas de salle d'attente a tenir eveillee : les
         recherches ouvertes sont des lignes de l'annuaire (pour = 0, etat = 0),
         gardees 7 jours. Je rejoins la plus proche de mon niveau ; s'il n'y en
         a pas, j'ouvre la mienne (une seule par cadence). */
      try {
        const ouvertes = (await env.DB.prepare(
          "SELECT x.partie AS id FROM correspondances x WHERE x.etat = 0 AND x.pour = 0 AND x.cad = ?1 AND x.b <> ?2 AND x.n <> ?2 AND x.echeance > ?3 " +
          "AND NOT EXISTS (SELECT 1 FROM blocages k WHERE (k.compte_id = ?2 AND k.bloque_id IN (x.b, x.n)) OR (k.bloque_id = ?2 AND k.compte_id IN (x.b, x.n))) " +
          "ORDER BY ABS(x.note - ?4), x.cree LIMIT 3"
        ).bind(d.cad, s.id, now, note).all()).results || [];
        const mienne = await env.DB.prepare("SELECT partie AS id FROM correspondances WHERE etat = 0 AND pour = 0 AND cad = ?1 AND (b = ?2 OR n = ?2) AND echeance > ?3 LIMIT 1").bind(d.cad, s.id, now).first();
        /* Ma propre recherche ne compte pas deux fois : en rejoindre une autre la remplace. */
        if (await corrCompte(env, s.id) - (mienne ? 1 : 0) >= CORR_MAX) return erreur("plein", 429);
        for (const x of ouvertes) {
          const r = await objet(x.id).fetch("https://partie/rejoindre", { method: "POST", body: JSON.stringify({ j: s.id, p: s.pseudo }) });
          if (r.status !== 204) continue;
          if (mienne) { try { await objet(mienne.id).fetch("https://partie/retrait?j=" + s.id); } catch (e) {} }
          return json({ id: x.id, attente: false });
        }
        if (mienne) return json({ id: mienne.id, attente: true });
        if ((await objet("membre-" + s.id).fetch("https://partie/quota")).status === 429) return erreur("trop", 429);
        const id = idTirer(), blancs = !!(crypto.getRandomValues(new Uint8Array(1))[0] & 1);
        await env.DB.prepare("INSERT INTO correspondances (partie, b, n, pour, cad, etat, trait, echeance, note, cree) VALUES (?1, ?2, ?3, 0, ?4, 0, 0, ?5, ?6, ?7)")
          .bind(id, blancs ? s.id : 0, blancs ? 0 : s.id, d.cad, now + CORR_ATTENTE, note, now).run();
        const cree = await objet(id).fetch("https://partie/creer", { method: "POST", body: JSON.stringify({ id, cad: d.cad, blancs, de: { id: s.id, p: s.pseudo }, pour: null, pourP: null }) });
        if (!cree.ok) { await env.DB.prepare("DELETE FROM correspondances WHERE partie = ?1").bind(id).run(); return erreur("indisponible", 503); }
        /* Deux membres qui cherchent au meme instant ouvrent chacun une
           recherche sans se voir : celui dont la ligne est arrivee en second
           rejoint l'autre et retire la sienne. */
        const avant = await env.DB.prepare(
          "SELECT x.partie AS id FROM correspondances x WHERE x.etat = 0 AND x.pour = 0 AND x.cad = ?1 AND x.b <> ?2 AND x.n <> ?2 AND x.echeance > ?3 AND x.rowid < (SELECT rowid FROM correspondances WHERE partie = ?4) " +
          "AND NOT EXISTS (SELECT 1 FROM blocages k WHERE (k.compte_id = ?2 AND k.bloque_id IN (x.b, x.n)) OR (k.bloque_id = ?2 AND k.compte_id IN (x.b, x.n))) " +
          "ORDER BY x.rowid LIMIT 1"
        ).bind(d.cad, s.id, now, id).first();
        if (avant && (await objet(avant.id).fetch("https://partie/rejoindre", { method: "POST", body: JSON.stringify({ j: s.id, p: s.pseudo }) })).status === 204) {
          try { await objet(id).fetch("https://partie/retrait?j=" + s.id); } catch (e) {}
          return json({ id: avant.id, attente: false });
        }
        return json({ id, attente: true });
      } catch (e) { return erreur("indisponible", 503); }
    }
    try {
      exclus = ((await env.DB.prepare("SELECT bloque_id AS x FROM blocages WHERE compte_id = ?1 UNION SELECT compte_id AS x FROM blocages WHERE bloque_id = ?1").bind(s.id).all()).results || []).map(x => x.x);
    } catch (e) {}
    const r = await (await salle.fetch("https://partie/salle", { method: "POST", body: JSON.stringify({ cad: d.cad, j: s.id, note, id: idTirer(), exclus }) })).json();
    if (r.neuf) {
      const lacher = () => salle.fetch("https://partie/salle-fin", { method: "POST", body: JSON.stringify({ j: s.id }) });
      if ((await objet("membre-" + s.id).fetch("https://partie/quota")).status === 429) { await lacher(); return erreur("trop", 429); }
      const cree = await objet(r.id).fetch("https://partie/creer", { method: "POST", body: JSON.stringify({ id: r.id, cad: d.cad, de: { id: s.id, p: s.pseudo }, pour: null, pourP: null }) });
      if (!cree.ok) { await lacher(); return erreur("indisponible", 503); }
    }
    return json({ id: r.id, attente: !r.trouve });
  }

  if (m === "GET" && route === "invitations") {
    const s = await sessionLire(request, env, now);
    if (!s) return erreur("session", 401);
    let liste = [];
    try {
      liste = (await env.DB.prepare(
        "SELECT i.partie AS id, c.pseudo AS p, i.cad, i.cree FROM invitations i JOIN comptes c ON c.id = i.de WHERE i.a = ?1 AND i.cree > ?2 " +
        "AND NOT EXISTS (SELECT 1 FROM blocages b WHERE (b.compte_id = i.a AND b.bloque_id = i.de) OR (b.compte_id = i.de AND b.bloque_id = i.a)) " +
        "ORDER BY i.cree DESC LIMIT 5"
      ).bind(s.id, now - GARDE).all()).results || [];
    } catch (e) {}
    /* La colonne cad porte aussi la couleur de l'invite : on les separe. */
    liste = liste.map(x => ({ id: x.id, p: x.p, cad: x.cad % 16, coul: x.cad >= 32 ? "n" : x.cad >= 16 ? "b" : null, cree: x.cree }));
    /* Dans la meme reponse, pour ne pas doubler les requetes de la page : les
       parties par correspondance du membre (liste et pastille « a toi »). */
    return json({ liste, corr: await corrListe(env, s.id, now, objet) });
  }

  /* Correspondance : l'invite accepte. Il s'assoit sans ouvrir de fil, la
     partie commence et le delai du premier coup part. */
  if (m === "POST" && (route === "accepter" || route === "retirer")) {
    if (!memeOrigine(request)) return erreur("origine", 403);
    const s = await sessionLire(request, env, now);
    if (!s) return erreur("session", 401);
    let d = null;
    try { d = JSON.parse((await request.text()).slice(0, 200)); } catch (e) {}
    if (!d || typeof d.id !== "string" || !ID.test(d.id)) return erreur("requete", 400);
    if (route === "retirer") {
      /* Le createur retire son invitation ou sa recherche, tant que personne n'est venu. */
      const r = await objet(d.id).fetch("https://partie/retrait?j=" + s.id);
      return r.status === 204 ? json({ ok: true }) : erreur("partie", 404);
    }
    try { if (await corrCompte(env, s.id) >= CORR_MAX) return erreur("plein", 429); } catch (e) { return erreur("indisponible", 503); }
    const r = await objet(d.id).fetch("https://partie/rejoindre", { method: "POST", body: JSON.stringify({ j: s.id, p: s.pseudo }) });
    if (r.status === 204) return json({ ok: true, id: d.id });
    return r.status === 404 ? erreur("partie", 404) : erreur("pleine", 403);
  }

  if (m === "POST" && route === "refuser") {
    if (!memeOrigine(request)) return erreur("origine", 403);
    const s = await sessionLire(request, env, now);
    if (!s) return erreur("session", 401);
    let d = null;
    try { d = JSON.parse((await request.text()).slice(0, 200)); } catch (e) {}
    if (!d || typeof d.id !== "string" || !ID.test(d.id)) return erreur("requete", 400);
    try { await env.DB.prepare("DELETE FROM invitations WHERE partie = ?1 AND a = ?2").bind(d.id, s.id).run(); } catch (e) {}
    /* Celui qui a invite est prevenu, pour ne pas attendre en vain. La partie
       ne reagit que si elle etait bien reservee a ce membre. */
    try { await objet(d.id).fetch("https://partie/refus?j=" + s.id); } catch (e) {}
    return json({ ok: true });
  }

  if (m === "GET" && route === "ws") {
    if ((request.headers.get("Upgrade") || "").toLowerCase() !== "websocket") return erreur("requete", 426);
    if (!memeOrigine(request, true)) return erreur("origine", 403);
    const id = url.searchParams.get("id") || "";
    if (!ID.test(id)) return erreur("requete", 400);
    const s = await sessionLire(request, env, now);
    if (!s) return erreur("session", 401);
    const o = objet(id);
    const siege = await (await o.fetch("https://partie/siege?j=" + s.id)).json();
    if (siege.etat === "absente") return erreur("partie", 404);
    if (siege.etat === "pleine") return erreur("pleine", 403);
    if (siege.etat === "libre") {
      if (await bloques(env, s.id, siege.de)) return erreur("partie", 404);
      /* Par correspondance, s'asseoir compte dans les 10 parties en cours. */
      if (siege.corr) { try { if (await corrCompte(env, s.id) >= CORR_MAX) return erreur("plein", 403); } catch (e) { return erreur("indisponible", 503); } }
      /* L'invite arrive : son invitation a fait son office. */
      if (siege.pour) { try { await env.DB.prepare("DELETE FROM invitations WHERE partie = ?1").bind(id).run(); } catch (e) {} }
    }
    const h = new Headers(request.headers);
    h.set("X-Joueur", String(s.id));
    h.set("X-Pseudo", encodeURIComponent(s.pseudo));
    return o.fetch(new Request("https://partie/ws", { headers: h }));
  }
  return erreur("inconnu", 404);
}

export default {
  async fetch(request, env) {
    try { return await repondre(request, env); }
    catch (e) {
      /* Limite du jour atteinte, ou panne : la partie en direct s'arrete, le
         reste du site (pages statiques, compte) n'en depend pas. */
      return erreur("limite", 503);
    }
  },
  /* Le balayage de chaque heure (voir balayer). */
  async scheduled(evenement, env) {
    try { await balayer(env, Date.now()); } catch (e) {}
  }
};

/* ---------- Une partie ---------- */
const autre = c => (c === "b" ? "n" : "b");
function seulRoi(g, couleur) {
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) { sq += 7; continue; }
    const p = g.board[sq];
    if (p && pType(p) !== K && pColor(p) === (couleur === "b" ? 0 : 1)) return false;
  }
  return true;
}

/* Elo entre membres : fonctions pures (testees dans check_elo_membres.js). */
const ELO_DEPART = 800, ELO_DEPART_MIN = 600, ELO_DEPART_MAX = 1400, ELO_PROVISOIRE = 20;
function eloDepart(declare) {
  return Number.isFinite(declare) ? Math.max(ELO_DEPART_MIN, Math.min(ELO_DEPART_MAX, Math.round(declare))) : ELO_DEPART;
}
function eloApres(joueur, adversaire, resultat, parties) {
  const k = parties < ELO_PROVISOIRE ? 40 : 20, attendu = 1 / (1 + Math.pow(10, (adversaire - joueur) / 400));
  return Math.max(100, Math.min(3000, joueur + Math.round(k * (resultat - attendu))));
}

export class Partie {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.aCompter = false;   /* une partie vient de finir avec un resultat */
    this.p = undefined;      /* l'etat, relu apres un sommeil */
    this.jeu = null;         /* la position, rejouee depuis les coups */
    try { ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong")); } catch (e) {}
  }

  async lire() {
    if (this.p === undefined) this.p = (await this.ctx.storage.get("p")) || null;
    return this.p;
  }
  async ecrire() { await this.ctx.storage.put("p", this.p); }
  position() {
    if (!this.jeu) {
      this.jeu = new Game();
      for (const c of this.p.coups) this.jeu.makeMove(this.jeu.moveFromUci(c));
    }
    return this.jeu;
  }
  couleur(compte) {
    const j = this.p.j;
    return j.b && j.b.id === compte ? "b" : j.n && j.n.id === compte ? "n" : null;
  }
  /* L'alarme n'est reposee que si elle doit sonner plus tot. A appeler AVANT
     ecrire() : la date retenue part dans la meme ligne. */
  async planifier(quand, now) {
    const p = this.p;
    if (p.alarme && p.alarme > now && p.alarme <= quand) return;
    p.alarme = quand;
    await this.ctx.storage.setAlarm(quand);
  }
  /* Par correspondance, tout dure plus longtemps : l'attente d'un adversaire
     (7 jours), le premier coup de chacun (le delai de la partie, au lieu d'une
     minute), la partie finie (14 jours, le temps que chacun voie la fin). */
  echeance() {
    const p = this.p, c = corr(p.cad);
    if (p.phase === "attente") return p.cree + (c ? CORR_ATTENTE : GARDE);
    if (p.phase === "debut") return p.maj + (c ? this.delai() : PREMIER_COUP);
    if (p.phase === "jeu") return p.maj + p.t[this.trait()];
    return p.finA + (c ? CORR_GARDE : GARDE);
  }
  delai() { return CADENCES[this.p.cad][0] * 1000; }
  /* Un membre s'assoit a la place libre : par le fil (partie en direct, lien
     ouvert) ou par la route « rejoindre » (correspondance, sans fil). */
  async asseoir(j, pseudo, now) {
    const p = this.p;
    p.j[p.j.b ? "n" : "b"] = { id: j, p: pseudo };
    p.phase = "debut"; p.maj = now;
    await this.planifier(this.echeance(), now);
    await this.ecrire();
  }
  /* Qui a la partie sous les yeux en ce moment : 1 = Blancs, 2 = Noirs. */
  presents() {
    let v = 0;
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === this.sortant || ws.readyState > 1) continue;
      const c = this.couleur((ws.deserializeAttachment() || {}).j);
      if (c) v |= c === "b" ? 1 : 2;
    }
    return v;
  }
  /* Correspondance : la ligne de l'annuaire suit la partie (qui joue, a qui le
     tour, jusqu'a quand, resultat, qui a vu la fin). Ecrite seulement quand
     elle change ; une ligne disparue est reposee. Un echec de la base ne gene
     pas la partie : la liste se rattrape au coup suivant, ou a la lecture. */
  async suivre(force) {
    const p = this.p, db = this.env && this.env.DB;
    if (!p || !db || !corr(p.cad)) return;
    const enJeu = p.phase === "debut" || p.phase === "jeu", etat = p.phase === "attente" ? 0 : enJeu ? 1 : 2;
    const v = [p.id, p.j.b ? p.j.b.id : 0, p.j.n ? p.j.n.id : 0, p.j.b && p.j.n ? 0 : p.pour || 0, p.cad, etat,
      enJeu ? p.j[this.trait()].id : 0, this.echeance(), p.phase === "fin" ? (p.fin.m === "refusee" ? "refus" : p.fin.r) : "", p.vu || 0, p.cree];
    const sig = v.join("|");
    if (!force && sig === this.suivi) return;
    try {
      await db.prepare(
        "INSERT INTO correspondances (partie, b, n, pour, cad, etat, trait, echeance, res, vu, cree) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) " +
        "ON CONFLICT(partie) DO UPDATE SET b = ?2, n = ?3, pour = ?4, etat = ?6, trait = ?7, echeance = ?8, res = ?9, vu = ?10"
      ).bind(...v).run();
      this.suivi = sig;
    } catch (e) {}
  }
  /* La partie s'efface : sa ligne de l'annuaire aussi. */
  async effacer() {
    const p = this.p, db = this.env && this.env.DB;
    for (const ws of this.ctx.getWebSockets()) { try { ws.close(1000, "fin"); } catch (e) {} }
    if (p && db && corr(p.cad)) { try { await db.prepare("DELETE FROM correspondances WHERE partie = ?1").bind(p.id).run(); } catch (e) {} }
    await this.ctx.storage.deleteAll();
    this.p = null; this.jeu = null; this.suivi = "";
  }
  trait() { return this.p.coups.length % 2 ? "n" : "b"; }

  nouvelle(now) {
    const p = this.p, base = CADENCES[p.cad][0] * 1000;
    p.coups = []; p.t = { b: base, n: base }; p.maj = now; p.phase = "debut";
    p.fin = null; p.finA = 0; p.nulle = null; p.nulleA = { b: -1, n: -1 }; p.rev = { b: false, n: false };
    p.elo = null; p.vu = 0;
    this.jeu = null;
  }
  finir(r, motif, now) {
    const p = this.p;
    /* La pendule s'arrete a l'instant de la fin : le temps du joueur au trait
       est arrete ici (abandon, nulle par accord). Apres un coup, il l'est deja. */
    if (p.phase === "jeu") { const c = this.trait(); p.t[c] = Math.max(0, p.t[c] - (now - p.maj)); p.maj = now; }
    p.phase = "fin"; p.fin = { r, m: motif }; p.finA = now; p.nulle = null;
    /* Correspondance : celui qui a la partie sous les yeux a vu la fin ; l'autre
       la trouvera dans sa liste jusqu'a ce qu'il l'ouvre. */
    p.vu = this.presents();
    this.aCompter = !!r && p.coups.length >= 2 && !!p.j.b && !!p.j.n;
  }

  /* Victoires, nulles et defaites : comptees ICI, par le serveur, dans la
     table des comptes (colonnes direct_v, direct_n, direct_d), jamais d'apres
     ce qu'un navigateur declare. Une fois par partie finie ; une partie
     annulee ou refusee ne compte pas. Un echec de la base ne gene pas la partie. */
  async compter() {
    if (!this.aCompter) return;
    this.aCompter = false;
    const p = this.p, r = p.fin && p.fin.r, db = this.env && this.env.DB;
    if (!db || !r) return;
    const col = c => (r === "1/2" ? "direct_n" : (r === "1-0") === (c === "b") ? "direct_v" : "direct_d");
    try {
      await db.batch(["b", "n"].map(c => db.prepare("UPDATE comptes SET " + col(c) + " = " + col(c) + " + 1 WHERE id = ?1").bind(p.j[c].id)));
    } catch (e) {}
    /* Elo entre membres : a part, pour qu'une base sans les colonnes elo
       continue de compter les resultats ci-dessus. La variation est ensuite
       montree aux deux joueurs. */
    try {
      const elo = await this.compterElo(db, p, r);
      if (elo) { p.elo = elo; await this.ecrire(); this.diffuser(Date.now()); }
    } catch (e) {}
  }
  /* Elo entre membres (2026-11-21, decision d'Alexandre) : toutes les parties
     en direct comptent, entre amis comme au hasard. Formule habituelle :
     attendu = 1 / (1 + 10^((adversaire - joueur) / 400)), K = 40 pendant les
     20 premieres parties du joueur, 20 ensuite. Depart : l'Elo contre
     l'ordinateur que son navigateur a declare, ramene entre 600 et 1400 pour
     qu'une valeur gonflee ne donne pas d'avance ; 800 sinon.
     Rend { b: { d, r }, n: { d, r } } (variation et nouveau classement). */
  async compterElo(db, p, r) {
    const ids = { b: p.j.b.id, n: p.j.n.id };
    if (ids.b === ids.n) return null;
    const lire = id => db.prepare("SELECT elo, elo_n, CASE WHEN elo = 0 AND json_valid(donnees) THEN json_extract(donnees, '$.progress.eloOrdi.r') END AS eo FROM comptes WHERE id = ?1").bind(id).first();
    const l = { b: await lire(ids.b), n: await lire(ids.n) };
    if (!l.b || !l.n) return null;
    const depart = x => x.elo > 0 ? x.elo : eloDepart(x.eo);
    const avant = { b: depart(l.b), n: depart(l.n) }, sb = r === "1-0" ? 1 : r === "1/2" ? 0.5 : 0;
    const apres = {
      b: eloApres(avant.b, avant.n, sb, l.b.elo_n),
      n: eloApres(avant.n, avant.b, 1 - sb, l.n.elo_n)
    };
    await db.batch(["b", "n"].map(c => db.prepare("UPDATE comptes SET elo = ?2, elo_n = elo_n + 1 WHERE id = ?1").bind(ids[c], apres[c])));
    return { b: { d: apres.b - avant.b, r: apres.b }, n: { d: apres.n - avant.n, r: apres.n } };
  }

  vue(moi, now) {
    const p = this.p, la = { b: false, n: false };
    for (const ws of this.ctx.getWebSockets()) {
      /* Le fil qui se ferme compte deja comme parti : sinon l'adversaire
         n'apprenait le depart qu'au message suivant. */
      if (ws === this.sortant || ws.readyState > 1) continue;
      const c = this.couleur((ws.deserializeAttachment() || {}).j);
      if (c) la[c] = true;
    }
    return {
      t: "etat", id: p.id, n: p.n, cad: CADENCES[p.cad], moi,
      b: p.j.b ? p.j.b.p : null, nr: p.j.n ? p.j.n.p : null,
      coups: p.coups, tb: p.t.b, tn: p.t.n, maj: p.maj, h: now,
      phase: p.phase, fin: p.fin, nulle: p.nulle, rev: p.rev, la,
      /* Elo entre membres : la variation de chacun, une fois la partie comptee. */
      elo: p.phase === "fin" && p.elo ? p.elo : null, inv: p.phase === "attente" || (p.fin && p.fin.m === "refusee") ? p.pourP || null : null
    };
  }
  diffuser(now) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === this.sortant || ws.readyState > 1) continue;
      const c = this.couleur((ws.deserializeAttachment() || {}).j);
      try { ws.send(JSON.stringify(this.vue(c, now))); } catch (e) {}
    }
  }

  async fetch(request) {
    const url = new URL(request.url), now = Date.now();
    const p = await this.lire();

    /* La salle d'attente : cet objet-la ne porte aucune partie, seulement la
       liste de ceux qui cherchent (membre, cadence, niveau, partie ouverte). */
    if (url.pathname === "/salle" || url.pathname === "/salle-fin") {
      const d = await request.json();
      let liste = ((await this.ctx.storage.get("salle")) || []).filter(x => now - x.t < SALLE_ATTENTE);
      if (url.pathname === "/salle-fin") {
        await this.ctx.storage.put("salle", liste.filter(x => x.j !== d.j));
        return new Response("{}");
      }
      const exclus = Array.isArray(d.exclus) ? d.exclus : [];
      const autres = liste.filter(x => x.cad === d.cad && x.j !== d.j && !exclus.includes(x.j));
      autres.sort((a, b) => Math.abs(a.note - d.note) - Math.abs(b.note - d.note) || a.t - b.t);
      const mien = liste.find(x => x.j === d.j && x.cad === d.cad);
      let rep;
      if (autres.length) {
        liste = liste.filter(x => x.j !== d.j && x !== autres[0]);
        rep = { id: autres[0].id, trouve: true };
      } else if (mien) { mien.t = now; rep = { id: mien.id }; }
      else {
        /* Un membre n'attend que dans une cadence a la fois. */
        liste = liste.filter(x => x.j !== d.j);
        liste.push({ cad: d.cad, j: d.j, note: d.note, id: d.id, t: now });
        rep = { id: d.id, neuf: true };
      }
      await this.ctx.storage.put("salle", liste);
      return new Response(JSON.stringify(rep));
    }

    if (url.pathname === "/creer") {
      if (p) return new Response(null, { status: 409 });
      const d = await request.json();
      /* Le createur a pu choisir sa couleur ; sinon (adversaire au hasard), tirage. */
      const blancs = typeof d.blancs === "boolean" ? d.blancs : !!(crypto.getRandomValues(new Uint8Array(1))[0] & 1);
      this.p = { id: d.id, n: 1, cad: d.cad, de: d.de.id, pour: d.pour, pourP: d.pourP || null, cree: now, j: { b: blancs ? d.de : null, n: blancs ? null : d.de }, alarme: 0 };
      this.nouvelle(now);
      this.p.phase = "attente";
      await this.planifier(this.echeance(), now);
      await this.ecrire();
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/quota") {
      const q = ((await this.ctx.storage.get("q")) || []).filter(x => x > now - HEURE);
      if (q.length >= CREATIONS_PAR_HEURE) return new Response(null, { status: 429 });
      q.push(now);
      await this.ctx.storage.put("q", q);
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/refus") {
      if (p && p.phase === "attente" && p.pour && p.pour === +url.searchParams.get("j")) {
        this.finir("", "refusee", now);
        await this.planifier(this.echeance(), now);
        await this.ecrire();
        this.diffuser(now);
        await this.suivre();
      }
      return new Response(null, { status: 204 });
    }

    /* Correspondance : s'asseoir sans fil (invitation acceptee, adversaire au hasard). */
    if (url.pathname === "/rejoindre") {
      if (!p) return new Response(null, { status: 404 });
      /* Seulement par correspondance : en direct on s'assoit en ouvrant le fil,
         sinon la minute du premier coup partirait sans le joueur. */
      if (!corr(p.cad)) return new Response(null, { status: 403 });
      const d = await request.json();
      if (!this.couleur(d.j)) {
        if (p.phase !== "attente" || (p.pour && p.pour !== d.j)) return new Response(null, { status: 403 });
        await this.asseoir(d.j, d.p, now);
        this.diffuser(now);
        await this.suivre();
      }
      return new Response(null, { status: 204 });
    }
    /* Le createur retire son invitation ou sa recherche : la partie disparait. */
    if (url.pathname === "/retrait") {
      if (!p || p.phase !== "attente" || p.de !== +url.searchParams.get("j")) return new Response(null, { status: 404 });
      await this.effacer();
      return new Response(null, { status: 204 });
    }
    /* L'annuaire demande des nouvelles : echeance depassee sans que l'alarme
       ait encore sonne, ou adversaire dont le compte a ete supprime (la
       partie est alors gagnee par celui qui reste). */
    if (url.pathname === "/annuaire") {
      if (!p) return new Response(null, { status: 404 });
      /* parti : les comptes supprimes (un ou deux numeros). La partie n'en
         garde plus rien, ni numero ni pseudo ; en cours, elle est gagnee par
         celui qui reste (annulee si personne ne reste, ou avant le premier
         coup de chacun). */
      const partis = (url.searchParams.get("parti") || "").split(",").map(Number).filter(Boolean).map(j => this.couleur(j)).filter(Boolean);
      if (partis.length) {
        const enCours = p.phase === "debut" || p.phase === "jeu", c = partis[0];
        if (enCours) {
          const nul = p.phase === "debut" || partis.length > 1;
          this.finir(nul ? "" : c === "b" ? "0-1" : "1-0", nul ? "annulee" : "abandon", now);
        }
        for (const x of partis) {
          const id = p.j[x].id;
          if (p.pour === id) { p.pour = 0; p.pourP = null; }
          if (p.de === id) p.de = 0;
          p.j[x] = { id: 0, p: "" };
        }
        await this.planifier(this.echeance(), now);
        await this.ecrire();
        this.diffuser(now);
        await this.suivre(true);
        await this.compter();
      } else if (now >= this.echeance()) { await this.alarm(); if (!this.p) return new Response(null, { status: 404 }); }
      else await this.suivre(true);
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/siege") {
      const j = +url.searchParams.get("j");
      if (!p) return json({ etat: "absente" });
      if (this.couleur(j)) return json({ etat: "joueur" });
      if (p.phase !== "attente" || (p.pour && p.pour !== j)) return json({ etat: "pleine" });
      return json({ etat: "libre", de: p.de, pour: !!p.pour, corr: corr(p.cad) });
    }

    if (url.pathname === "/ws") {
      if (!p) return new Response(null, { status: 404 });
      const j = +request.headers.get("X-Joueur"), pseudo = decodeURIComponent(request.headers.get("X-Pseudo") || "");
      let change = false;   /* l'annuaire de la correspondance est a mettre a jour */
      if (!this.couleur(j)) {
        if (p.phase !== "attente" || (p.pour && p.pour !== j)) return new Response(null, { status: 403 });
        await this.asseoir(j, pseudo, now);
        change = true;
      }
      const paire = new WebSocketPair();
      this.ctx.acceptWebSocket(paire[1]);
      paire[1].serializeAttachment({ j });
      /* Correspondance : ouvrir une partie finie, c'est en avoir vu la fin. */
      if (corr(p.cad) && p.phase === "fin") {
        const bit = this.couleur(j) === "b" ? 1 : 2;
        if (!((p.vu || 0) & bit)) { p.vu = (p.vu || 0) | bit; await this.ecrire(); change = true; }
      }
      if (change) await this.suivre(true);
      this.diffuser(now);
      return new Response(null, { status: 101, webSocket: paire[0] });
    }
    return new Response(null, { status: 404 });
  }

  async webSocketMessage(ws, texte) {
    const now = Date.now();
    try {
      if (typeof texte !== "string" || texte.length > 200) return;
      let d;
      try { d = JSON.parse(texte); } catch (e) { return; }
      const p = await this.lire();
      if (!p || !d) return;
      const moi = this.couleur((ws.deserializeAttachment() || {}).j);
      if (!moi) return;
      const enCours = p.phase === "debut" || p.phase === "jeu";

      if (d.t === "coup") {
        if (!enCours || this.trait() !== moi || typeof d.c !== "string") return;
        const g = this.position(), coup = g.moveFromUci(d.c);
        if (!coup) { ws.send(JSON.stringify({ t: "erreur", e: "coup" })); return; }
        if (p.phase === "debut") {
          if (now - p.maj > (corr(p.cad) ? this.delai() : PREMIER_COUP)) return this.tomber(now);
        } else {
          p.t[moi] -= now - p.maj;
          if (p.t[moi] <= 0) return this.tomber(now);
          /* Par correspondance le delai repart entier a chaque coup ; en
             direct, la pendule garde son reste et gagne l'increment. */
          if (corr(p.cad)) p.t[moi] = this.delai();
          else p.t[moi] += CADENCES[p.cad][1] * 1000;
        }
        g.makeMove(coup);
        p.coups.push(d.c); p.maj = now; p.nulle = null;
        if (p.coups.length >= 2) p.phase = "jeu";
        if (g.isCheckmate()) this.finir(moi === "b" ? "1-0" : "0-1", "mat", now);
        else if (g.isStalemate()) this.finir("1/2", "pat", now);
        else if (g.isInsufficient()) this.finir("1/2", "materiel", now);
        else if (g.isRepetition()) this.finir("1/2", "repetition", now);
        else if (g.half >= 100) this.finir("1/2", "50", now);
      } else if (d.t === "abandon") {
        if (!enCours) return;
        /* Avant que chacun ait joue, quitter annule la partie : personne ne perd. */
        if (p.phase === "debut") this.finir("", "annulee", now);
        else this.finir(moi === "b" ? "0-1" : "1-0", "abandon", now);
      } else if (d.t === "nulle") {
        if (p.phase !== "jeu") return;
        if (p.nulle === autre(moi)) this.finir("1/2", "accord", now);
        /* Une proposition par coup joue : on ne harcele pas. */
        else if (!p.nulle && p.nulleA[moi] !== p.coups.length) { p.nulle = moi; p.nulleA[moi] = p.coups.length; }
        else return;
      } else if (d.t === "nulle-non") {
        if (p.nulle !== autre(moi)) return;
        p.nulle = null;
      } else if (d.t === "revanche") {
        /* Par correspondance, pas de revanche dans le meme objet : l'autre n'est
           pas la pour repondre. Une nouvelle invitation la remplace. */
        if (p.phase !== "fin" || p.rev[moi] || corr(p.cad)) return;
        p.rev[moi] = true;
        if (p.rev.b && p.rev.n) {
          p.j = { b: p.j.n, n: p.j.b };
          p.n++;
          this.nouvelle(now);
        }
      } else return;

      await this.planifier(this.echeance(), now);
      await this.ecrire();
      this.diffuser(now);
      await this.suivre();
      await this.compter();
    } catch (e) {
      /* Ecriture refusee (limite du jour) : l'etat en memoire n'est plus sur. */
      this.p = undefined; this.jeu = null;
      try { ws.send(JSON.stringify({ t: "erreur", e: "limite" })); } catch (x) {}
    }
  }

  /* Le temps du joueur au trait est ecoule (ou le premier coup n'est pas venu). */
  async tomber(now) {
    const p = this.p, c = this.trait();
    if (p.phase === "debut") this.finir("", "annulee", now);
    else {
      p.t[c] = 0;
      /* Un roi seul ne peut pas mater : nulle, comme a la pendule d'un club. */
      this.finir(seulRoi(this.position(), autre(c)) ? "1/2" : c === "b" ? "0-1" : "1-0", "temps", now);
    }
    await this.planifier(this.echeance(), now);
    await this.ecrire();
    this.diffuser(now);
    await this.suivre();
    await this.compter();
  }

  async alarm() {
    const now = Date.now(), p = await this.lire();
    if (!p) return;
    p.alarme = 0;
    if (now >= this.echeance()) {
      if (p.phase === "debut" || p.phase === "jeu") return this.tomber(now);
      /* Personne n'est venu, ou la partie finie a attendu assez : on efface tout. */
      await this.effacer();
      return;
    }
    await this.planifier(this.echeance(), now);
    await this.ecrire();
  }

  async webSocketClose(ws, code) {
    try { ws.close(code === 1005 || code === 1006 ? 1000 : code, ""); } catch (e) {}
    this.sortant = ws;
    try { if (await this.lire()) this.diffuser(Date.now()); } finally { this.sortant = null; }
  }
  async webSocketError() {
    if (await this.lire()) this.diffuser(Date.now());
  }
}

/* Pour les tests : les fonctions pures de l'Elo, sans export de plus. */
Partie._elo = { eloDepart, eloApres };
