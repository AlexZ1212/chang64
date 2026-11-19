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
 *   GET  /api/partie/invitations                          ->  {liste:[{id, p, cad, cree}]}
 *   POST /api/partie/refuser {id}                         l'invite decline ; celui qui
 *        a invite le voit (fin "refusee"), sans autre detail
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
const CADENCES = [[600, 0], [300, 3], [900, 10]];   /* secondes + secondes par coup */
const PREMIER_COUP = 60e3;               /* sinon la partie est annulee */
const GARDE = 30 * 60e3;                 /* attente d'un adversaire, puis d'une revanche */
const CREATIONS_PAR_HEURE = 20;          /* par membre : un script ne vide pas le quota du jour */
const HEURE = 3600e3;
const INVITATIONS_MEME_MEMBRE = 3;       /* en attente, d'un meme membre vers un meme invite */
const INVITATIONS_BOITE = 10;            /* en attente chez un invite */
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
    if (adv) {
      let pose = null;
      try {
        await env.DB.prepare("DELETE FROM invitations WHERE cree < ?1").bind(now - GARDE).run();
        pose = await env.DB.prepare(
          "INSERT INTO invitations (partie, de, a, cad, cree) SELECT ?1, ?2, ?3, ?4, ?5 " +
          "WHERE (SELECT COUNT(*) FROM invitations WHERE de = ?2 AND a = ?3) < ?6 AND (SELECT COUNT(*) FROM invitations WHERE a = ?3) < ?7"
        ).bind(id, s.id, adv.id, d.cad, now, INVITATIONS_MEME_MEMBRE, INVITATIONS_BOITE).run();
      } catch (e) {}
      /* Sans la table, la partie reste reservee : il suffira d'envoyer le lien. */
      if (pose && pose.meta && pose.meta.changes === 0) return erreur("invitations", 429);
    }
    const r = await objet(id).fetch("https://partie/creer", {
      method: "POST",
      body: JSON.stringify({ id, cad: d.cad, de: { id: s.id, p: s.pseudo }, pour: adv ? adv.id : null, pourP: adv ? adv.pseudo : null })
    });
    if (!r.ok) return erreur("indisponible", 503);
    return json(adv ? { id, adv: adv.pseudo } : { id });
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
    return json({ liste });
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
  echeance() {
    const p = this.p;
    if (p.phase === "attente") return p.cree + GARDE;
    if (p.phase === "debut") return p.maj + PREMIER_COUP;
    if (p.phase === "jeu") return p.maj + p.t[this.trait()];
    return p.finA + GARDE;
  }
  trait() { return this.p.coups.length % 2 ? "n" : "b"; }

  nouvelle(now) {
    const p = this.p, base = CADENCES[p.cad][0] * 1000;
    p.coups = []; p.t = { b: base, n: base }; p.maj = now; p.phase = "debut";
    p.fin = null; p.finA = 0; p.nulle = null; p.nulleA = { b: -1, n: -1 }; p.rev = { b: false, n: false };
    this.jeu = null;
  }
  finir(r, motif, now) {
    const p = this.p;
    /* La pendule s'arrete a l'instant de la fin : le temps du joueur au trait
       est arrete ici (abandon, nulle par accord). Apres un coup, il l'est deja. */
    if (p.phase === "jeu") { const c = this.trait(); p.t[c] = Math.max(0, p.t[c] - (now - p.maj)); p.maj = now; }
    p.phase = "fin"; p.fin = { r, m: motif }; p.finA = now; p.nulle = null;
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
      phase: p.phase, fin: p.fin, nulle: p.nulle, rev: p.rev, la, inv: p.phase === "attente" || (p.fin && p.fin.m === "refusee") ? p.pourP || null : null
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

    if (url.pathname === "/creer") {
      if (p) return new Response(null, { status: 409 });
      const d = await request.json();
      const blancs = crypto.getRandomValues(new Uint8Array(1))[0] & 1;
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
      }
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/siege") {
      const j = +url.searchParams.get("j");
      if (!p) return json({ etat: "absente" });
      if (this.couleur(j)) return json({ etat: "joueur" });
      if (p.phase !== "attente" || (p.pour && p.pour !== j)) return json({ etat: "pleine" });
      return json({ etat: "libre", de: p.de, pour: !!p.pour });
    }

    if (url.pathname === "/ws") {
      if (!p) return new Response(null, { status: 404 });
      const j = +request.headers.get("X-Joueur"), pseudo = decodeURIComponent(request.headers.get("X-Pseudo") || "");
      if (!this.couleur(j)) {
        if (p.phase !== "attente" || (p.pour && p.pour !== j)) return new Response(null, { status: 403 });
        p.j[p.j.b ? "n" : "b"] = { id: j, p: pseudo };
        p.phase = "debut"; p.maj = now;
        await this.planifier(this.echeance(), now);
        await this.ecrire();
      }
      const paire = new WebSocketPair();
      this.ctx.acceptWebSocket(paire[1]);
      paire[1].serializeAttachment({ j });
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
          if (now - p.maj > PREMIER_COUP) return this.tomber(now);
        } else {
          p.t[moi] -= now - p.maj;
          if (p.t[moi] <= 0) return this.tomber(now);
          p.t[moi] += CADENCES[p.cad][1] * 1000;
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
        if (p.phase !== "fin" || p.rev[moi]) return;
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
    await this.compter();
  }

  async alarm() {
    const now = Date.now(), p = await this.lire();
    if (!p) return;
    p.alarme = 0;
    if (now >= this.echeance()) {
      if (p.phase === "debut" || p.phase === "jeu") return this.tomber(now);
      /* Personne n'est venu, ou la partie finie a attendu assez : on efface tout. */
      for (const ws of this.ctx.getWebSockets()) { try { ws.close(1000, "fin"); } catch (e) {} }
      await this.ctx.storage.deleteAll();
      this.p = null; this.jeu = null;
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
