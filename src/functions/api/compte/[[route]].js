/* chang64 - le compte : pseudo + code (2026-11-16)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Un compte facultatif pour retrouver sa progression sur plusieurs appareils.
 * Ce qui est garde (tables de compte-schema.sql, base D1 liee sous DB) : un
 * pseudo, l'empreinte d'un code, l'empreinte d'un code de secours, la
 * progression, des dates. Ni adresse IP, ni e-mail, ni nom ; rien n'est lu
 * dans les en-tetes en dehors du cookie de session et de l'origine.
 *
 * Routes, toutes sous /api/compte/ :
 *   POST pseudo            {pseudo}                 -> {libre, raison?}
 *   POST creer             {pseudo, code, donnees?} -> {pseudo, secours, version}
 *   POST connexion         {pseudo, code}           -> {pseudo, version}
 *   POST deconnexion
 *   GET  etat                                       -> {pseudo, version, cree}
 *   GET  synchro                                    -> {version, donnees}
 *   PUT  synchro           {version, donnees}       -> {version} ou 409 {version, donnees}
 *   GET  exporter                                   -> fichier JSON
 *   POST supprimer         {code}
 *   POST code              {ancien, nouveau}
 *   POST secours           {pseudo, secours, code}  -> {pseudo, secours, version}
 *   POST secours-nouveau   {code}                   -> {secours}
 *   POST lien                                       -> {code, expire}
 *   POST lien-connexion    {pseudo, code}           -> {pseudo, version}
 *
 * Securite, en bref :
 * - Le code choisi par le joueur ne quitte jamais son navigateur. Celui-ci
 *   l'etire (PBKDF2-SHA256, voir compte.js) et n'envoie que le resultat,
 *   32 octets. Le serveur n'en garde qu'un HMAC avec un sel par compte et, si
 *   la variable POIVRE existe, un secret hors de la base. L'etirement se fait
 *   chez le joueur parce que l'offre gratuite de Cloudflare compte le temps
 *   de calcul par requete : le faire ici ferait echouer des connexions. Le
 *   cout pour qui volerait la base est le meme.
 * - Un code a 6 chiffres ne tient que par la limite d'essais : 5 essais, puis
 *   un blocage de 15 minutes qui double a chaque nouvel echec (24 h au plus).
 *   L'essai est compte AVANT la verification, dans la meme instruction SQL :
 *   cent requetes simultanees ne donnent pas cent essais.
 * - La session est un jeton aleatoire de 32 octets, garde hache, pose dans un
 *   cookie HttpOnly, Secure, SameSite=Strict : le script de la page ne peut
 *   pas le lire. Toute ecriture exige en plus un corps JSON et la bonne
 *   origine.
 * - Les reponses ne disent pas si un pseudo existe quand on se trompe de
 *   code : "pseudo ou code incorrect".
 * - Les comptes sans activite depuis deux ans sont effaces (recommandation de
 *   la CNIL), au fil des creations et des connexions : Pages Functions n'a
 *   pas de tache planifiee.
 *
 * Tout tient dans ce fichier : Pages fait une route de chaque fichier de
 * functions/, et un seul fichier se teste tel quel dans Node
 * (tests/check_compte_serveur.js, avec une vraie base SQLite en memoire). */

const COOKIE = "__Secure-c64";
const JOUR = 864e5;
const DUREE_JETON = 180 * JOUR;      /* une session inutilisee 6 mois expire */
const DUREE_COOKIE = 400 * 86400;    /* secondes : le maximum des navigateurs */
const INACTIF = 730 * JOUR;          /* deux ans */
const DUREE_LIEN = 10 * 60e3;
const ESSAIS_LIEN = 5;
const ESSAIS_CODE = 5;
const BLOCAGE = 15 * 60e3;
const BLOCAGE_MAX = JOUR;
const SESSIONS_MAX = 10;
const TAILLE_MAX = 300000;           /* caracteres de la progression en JSON */
const CREATIONS_PAR_HEURE = 300;     /* garde-fou global, sans adresse IP */
const DELTA_SEMAINE_MAX = 300;

/* ---------- Pseudo ---------- */
/* PSEUDO-DEBUT : ce bloc est recopie a l'identique dans compte.js (le
   navigateur s'en sert pour verifier le pseudo pendant la saisie et pour
   saler l'etirement du code) ; check_compte_serveur.js compare les deux. */
const PSEUDO_MIN = 3, PSEUDO_MAX = 20;
const PSEUDO_SOSIES = { "а": "a", "в": "b", "е": "e", "к": "k", "м": "m", "н": "h", "о": "o", "р": "p", "с": "c", "т": "t", "у": "y", "х": "x", "ѕ": "s", "і": "i", "ј": "j", "һ": "h", "ԁ": "d", "ԛ": "q", "ԝ": "w", "ı": "i", "ł": "l", "ø": "o", "đ": "d", "α": "a", "ο": "o", "ρ": "p", "ν": "v", "τ": "t", "ι": "i", "κ": "k" };
const PSEUDO_ECRITURES = ["Latin", "Cyrillic", "Greek", "Arabic", "Hebrew", "Thai", "Devanagari", "Hangul", "Han", "Hiragana", "Katakana"];
const PSEUDO_RESERVES = ["chang64", "admin", "moderat", "support", "officiel", "official", "staff", "systeme", "system"];
const PSEUDO_INTERDITS = ["fuck", "shit", "bitch", "cunt", "nigg", "fagg", "whore", "slut", "porn", "sex", "penis", "vagin", "hitler", "nazi", "pedoph", "rapist",
  "pute", "salop", "connard", "connasse", "encul", "nique", "merde", "batard", "pedale", "tapette", "bougnoul", "negro",
  "puta", "mierda", "pendej", "maricon", "cabron", "polla", "caralh", "foda", "buceta", "viado",
  "fotze", "schlampe", "arschloch", "wichser", "hurensohn", "schwuchtel",
  "cazzo", "stronz", "vaffancul", "puttana", "troia", "frocio",
  "kurwa", "chuj", "pizd", "jeban", "pierdol",
  "orospu", "siktir", "yarrak", "amcik",
  "bangsat", "kontol", "memek", "ngentot", "anjing",
  "хуй", "хуе", "пизд", "бляд", "блят", "ебат", "ебан", "сука", "пидор", "мудак", "говн"];
const PSEUDO_INTERDITS_EXACTS = ["rape", "bite", "con", "cul", "pd", "ass", "dick", "cock", "anal", "anus", "tits", "nique", "zob", "fdp", "ntm"];
/* Rend {ok:true, pseudo, cle} ou {ok:false, raison} ; raison vaut
   "longueur", "caracteres", "melange" ou "interdit". */
function pseudoValider(brut) {
  if (typeof brut !== "string") return { ok: false, raison: "caracteres" };
  const pseudo = brut.normalize("NFC").trim();
  const n = Array.from(pseudo).length;
  if (n < PSEUDO_MIN || n > PSEUDO_MAX) return { ok: false, raison: "longueur" };
  if (!/^[\p{L}0-9_-]+$/u.test(pseudo) || !/[\p{L}0-9]/u.test(pseudo)) return { ok: false, raison: "caracteres" };
  /* Une seule ecriture par pseudo : pas de lettre cyrillique glissee dans un
     mot latin pour imiter quelqu'un. Le japonais melange les siennes. */
  const vues = new Set();
  for (const c of pseudo) {
    if (!/\p{L}/u.test(c)) continue;
    const e = PSEUDO_ECRITURES.find(x => new RegExp("\\p{Script=" + x + "}", "u").test(c));
    if (!e) return { ok: false, raison: "caracteres" };
    vues.add(e === "Hiragana" || e === "Katakana" ? "Han" : e);
  }
  if (vues.size > 1) return { ok: false, raison: "melange" };
  const bas = pseudo.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  const cle = Array.from(bas).map(c => PSEUDO_SOSIES[c] || c).join("");
  const nu = s => s.replace(/[_-]/g, "").replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t").replace(/8/g, "b");
  for (const s of [nu(bas), nu(cle), bas.replace(/[_-]/g, "")]) {
    if (PSEUDO_INTERDITS_EXACTS.includes(s)) return { ok: false, raison: "interdit" };
    if (PSEUDO_RESERVES.some(m => s.includes(m)) || PSEUDO_INTERDITS.some(m => s.includes(m))) return { ok: false, raison: "interdit" };
  }
  return { ok: true, pseudo, cle };
}
/* PSEUDO-FIN */

/* ---------- Outils ---------- */
const enc = new TextEncoder();
function b64u(octets) {
  let s = "";
  for (const o of new Uint8Array(octets)) s += String.fromCharCode(o);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function alea(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; }
async function sha256(texte) { return b64u(await crypto.subtle.digest("SHA-256", enc.encode(texte))); }
/* Comparaison a temps constant : la duree ne dit pas ou deux empreintes
   divergent. */
function egal(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let d = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i % (b.length || 1));
  return d === 0;
}
function json(corps, statut, entetes) {
  return new Response(corps === null ? null : JSON.stringify(corps), {
    status: statut || 200,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, entetes || {})
  });
}
const erreur = (code, statut, plus) => json(Object.assign({ erreur: code }, plus || {}), statut);

/* Le code etire par le navigateur : 32 octets en base64 pour URL. */
const codeValide = c => typeof c === "string" && /^[A-Za-z0-9_-]{43}$/.test(c);
async function hmac(cle, message) {
  const k = await crypto.subtle.importKey("raw", enc.encode(cle), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
}
/* Empreinte gardee en base : v1.<p0|p1>.<sel>.<hmac>. p1 = le secret POIVRE
   (variable du projet, absente de la base) est entre dans le calcul. */
async function codeHacher(code, env, sel) {
  const poivre = env && typeof env.POIVRE === "string" && env.POIVRE ? env.POIVRE : "";
  sel = sel || b64u(alea(16));
  return "v1." + (poivre ? "p1" : "p0") + "." + sel + "." + await hmac("chang64-compte-v1:" + poivre, sel + ":" + code);
}
async function codeComparer(code, garde, env) {
  const p = String(garde || "").split(".");
  if (p.length !== 4 || p[0] !== "v1") return false;
  const avecPoivre = p[1] === "p1";
  const refait = await codeHacher(code, avecPoivre ? env : null, p[2]);
  return egal(refait, garde) && (!avecPoivre || !!(env && env.POIVRE));
}

const ALPHA_SECOURS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";   /* sans I, L, O, U */
const ALPHA_LIEN = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";       /* sans I, L, O, 0, 1 */
function tirer(alphabet, n) {
  /* Tirage sans biais : on rejette les octets au-dela du dernier multiple. */
  const max = 256 - (256 % alphabet.length);
  let s = "";
  while (s.length < n) for (const o of alea(n * 2)) if (o < max && s.length < n) s += alphabet[o % alphabet.length];
  return s;
}
function secoursCreer() { return tirer(ALPHA_SECOURS, 16).replace(/(.{4})(?=.)/g, "$1-"); }
function secoursNormaliser(s) {
  return String(s || "").toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1").replace(/[^0-9A-Z]/g, "");
}
const secoursHacher = (s, env) => hmac("chang64-secours-v1:" + ((env && env.POIVRE) || ""), secoursNormaliser(s));
const lienHacher = (code, id) => sha256("chang64-lien-v1:" + id + ":" + String(code || "").toUpperCase().replace(/[^0-9A-Z]/g, ""));

/* Lundi de la semaine en cours (UTC), pour le classement de la semaine. */
function lundi(ms) {
  const d = new Date(ms);
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
/* Chiffres du classement, lus dans la progression envoyee et bornes : ce que
   le navigateur declare n'est pas verifiable, on ecarte au moins l'absurde. */
function chiffres(donnees) {
  const p = donnees && typeof donnees.progress === "object" && donnees.progress ? donnees.progress : {};
  const n = (v, min, max, defaut) => Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : defaut;
  return {
    note: n(p.rating, 100, 3500, 800),
    resolus: n(p.solved, 0, 1e7, 0),
    serie: n(p.days, 0, 5000, 0),
    badges: Array.isArray(p.badges) ? Math.min(1000, new Set(p.badges.filter(x => typeof x === "string")).size) : 0,
    sprint: n(p.rushBest, 0, 500, 0)
  };
}
/* Rend le JSON a garder, ou null : un objet, pas un tableau, pas trop gros. */
function donneesTexte(donnees) {
  if (donnees === undefined || donnees === null) return "";
  if (typeof donnees !== "object" || Array.isArray(donnees)) return null;
  const s = JSON.stringify(donnees);
  return s.length > TAILLE_MAX ? null : s;
}

/* ---------- Requete ---------- */
async function corps(request) {
  if (!/^application\/json\b/i.test(request.headers.get("Content-Type") || "")) return null;
  const texte = await request.text();
  if (texte.length > TAILLE_MAX + 2000) return null;
  try {
    const d = JSON.parse(texte);
    return d && typeof d === "object" && !Array.isArray(d) ? d : null;
  } catch (e) { return null; }
}
/* Une ecriture ne vient que de la page elle-meme. Le cookie SameSite=Strict
   le garantit deja ; l'origine est une seconde serrure. */
function memeOrigine(request) {
  const o = request.headers.get("Origin");
  if (!o) return true;
  try { return new URL(o).host === new URL(request.url).host; } catch (e) { return false; }
}
function cookieLire(request) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([A-Za-z0-9_-]{43})(?:;|$)"));
  return m ? m[1] : "";
}
const cookiePoser = jeton => ({ "Set-Cookie": COOKIE + "=" + jeton + "; Path=/api/; Max-Age=" + DUREE_COOKIE + "; HttpOnly; Secure; SameSite=Strict" });
const cookieOter = () => ({ "Set-Cookie": COOKIE + "=; Path=/api/; Max-Age=0; HttpOnly; Secure; SameSite=Strict" });

/* ---------- Sessions ---------- */
async function sessionOuvrir(env, id, now) {
  const jeton = b64u(alea(32));
  await env.DB.batch([
    env.DB.prepare("INSERT INTO jetons (hash, compte_id, cree, vu) VALUES (?1, ?2, ?3, ?3)").bind(await sha256(jeton), id, now),
    env.DB.prepare("DELETE FROM jetons WHERE compte_id = ?1 AND hash NOT IN (SELECT hash FROM jetons WHERE compte_id = ?1 ORDER BY vu DESC, cree DESC LIMIT ?2)").bind(id, SESSIONS_MAX),
    env.DB.prepare("UPDATE comptes SET vu = ?2 WHERE id = ?1").bind(id, now)
  ]);
  return jeton;
}
/* Le compte de la session en cours, ou null. */
async function sessionLire(request, env, now) {
  const jeton = cookieLire(request);
  if (!jeton) return null;
  const hash = await sha256(jeton);
  const c = await env.DB.prepare(
    "SELECT c.id, c.cle, c.pseudo, c.version, c.cree, c.vu, j.vu AS jvu FROM jetons j JOIN comptes c ON c.id = j.compte_id WHERE j.hash = ?1"
  ).bind(hash).first();
  if (!c) return null;
  if (c.jvu < now - DUREE_JETON) {
    await env.DB.prepare("DELETE FROM jetons WHERE hash = ?1").bind(hash).run();
    return null;
  }
  /* La date de derniere activite avance au plus une fois par jour : c'est
     elle qui compte pour les deux ans, inutile d'ecrire a chaque requete. */
  if (c.jvu < now - JOUR) {
    await env.DB.batch([
      env.DB.prepare("UPDATE jetons SET vu = ?2 WHERE hash = ?1").bind(hash, now),
      env.DB.prepare("UPDATE comptes SET vu = ?2 WHERE id = ?1").bind(c.id, now)
    ]);
  }
  c.jeton = hash;
  return c;
}

/* ---------- Limite d'essais ---------- */
/* Compte l'essai puis verifie. Rend "ok", "faux" ou {bloque: date}. */
async function codeEssayer(env, id, code, now) {
  const r = await env.DB.prepare(
    "UPDATE comptes SET echecs = echecs + 1, " +
    "bloque_jusqu = CASE WHEN echecs + 1 >= ?3 THEN ?2 + MIN(?5, ?4 * (1 << MIN(echecs + 1 - ?3, 10))) ELSE 0 END " +
    "WHERE id = ?1 AND bloque_jusqu <= ?2 RETURNING pin_hash"
  ).bind(id, now, ESSAIS_CODE, BLOCAGE, BLOCAGE_MAX).first();
  if (!r) {
    const b = await env.DB.prepare("SELECT bloque_jusqu FROM comptes WHERE id = ?1").bind(id).first();
    return { bloque: b ? b.bloque_jusqu : now + BLOCAGE };
  }
  if (!codeValide(code) || !(await codeComparer(code, r.pin_hash, env))) return "faux";
  /* Bon code : le compteur repart de zero. Si le secret POIVRE a ete ajoute
     depuis la creation, l'empreinte est refaite avec lui. */
  const refaire = env.POIVRE && r.pin_hash.split(".")[1] === "p0";
  await env.DB.prepare("UPDATE comptes SET echecs = 0, bloque_jusqu = 0, vu = ?2, pin_hash = ?3 WHERE id = ?1")
    .bind(id, now, refaire ? await codeHacher(code, env) : r.pin_hash).run();
  return "ok";
}
function reponseEssai(r, now) {
  if (r === "faux") return erreur("identifiants", 401);
  return erreur("bloque", 429, { attendre: Math.max(1, Math.ceil((r.bloque - now) / 1000)) });
}

/* ---------- Menage ---------- */
/* Comptes sans activite depuis deux ans, sessions expirees, liens perimes. */
async function nettoyer(env, now) {
  const vieux = now - INACTIF;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM jetons WHERE compte_id IN (SELECT id FROM comptes WHERE vu < ?1)").bind(vieux),
    env.DB.prepare("DELETE FROM liens_appareil WHERE compte_id IN (SELECT id FROM comptes WHERE vu < ?1)").bind(vieux),
    env.DB.prepare("DELETE FROM comptes WHERE vu < ?1").bind(vieux),
    env.DB.prepare("DELETE FROM jetons WHERE vu < ?1").bind(now - DUREE_JETON),
    env.DB.prepare("DELETE FROM liens_appareil WHERE expire < ?1").bind(now)
  ]);
}

/* ---------- Routes ---------- */
async function rPseudo(d, env) {
  const v = pseudoValider(d.pseudo);
  if (!v.ok) return json({ libre: false, raison: v.raison });
  const pris = await env.DB.prepare("SELECT 1 AS x FROM comptes WHERE cle = ?1").bind(v.cle).first();
  return json(pris ? { libre: false, raison: "pris" } : { libre: true });
}

async function rCreer(d, env, now) {
  const v = pseudoValider(d.pseudo);
  if (!v.ok) return erreur("pseudo", 400, { raison: v.raison });
  if (!codeValide(d.code)) return erreur("code", 400);
  const texte = donneesTexte(d.donnees);
  if (texte === null) return erreur("donnees", 413);
  await nettoyer(env, now);
  const recents = await env.DB.prepare("SELECT COUNT(*) AS n FROM comptes WHERE cree > ?1").bind(now - 3600e3).first();
  if (recents && recents.n >= CREATIONS_PAR_HEURE) return erreur("plus_tard", 429);
  const secours = secoursCreer(), c = chiffres(d.donnees);
  let ligne;
  try {
    ligne = await env.DB.prepare(
      "INSERT INTO comptes (cle, pseudo, pin_hash, secours_hash, cree, vu, donnees, version, note, resolus, serie, badges, sprint, sem, sem_resolus) " +
      "VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 0) RETURNING id, version"
    ).bind(v.cle, v.pseudo, await codeHacher(d.code, env), await secoursHacher(secours, env), now,
      texte || null, texte ? 1 : 0, c.note, c.resolus, c.serie, c.badges, c.sprint, lundi(now)).first();
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message))) return erreur("pseudo", 409, { raison: "pris" });
    throw e;
  }
  const jeton = await sessionOuvrir(env, ligne.id, now);
  return json({ pseudo: v.pseudo, secours, version: ligne.version }, 201, cookiePoser(jeton));
}

async function compteParPseudo(env, pseudo) {
  const v = pseudoValider(pseudo);
  if (!v.ok) return null;
  return env.DB.prepare("SELECT id, pseudo, version, secours_hash FROM comptes WHERE cle = ?1").bind(v.cle).first();
}

async function rConnexion(d, env, now) {
  if (Math.random() < 0.1) await nettoyer(env, now);
  const c = await compteParPseudo(env, d.pseudo);
  /* Pseudo inconnu : meme reponse qu'un mauvais code. */
  if (!c) { await codeHacher(codeValide(d.code) ? d.code : "x", env); return erreur("identifiants", 401); }
  const r = await codeEssayer(env, c.id, d.code, now);
  if (r !== "ok") return reponseEssai(r, now);
  const jeton = await sessionOuvrir(env, c.id, now);
  return json({ pseudo: c.pseudo, version: c.version }, 200, cookiePoser(jeton));
}

async function rSynchroLire(s, env) {
  const l = await env.DB.prepare("SELECT version, donnees FROM comptes WHERE id = ?1").bind(s.id).first();
  return json({ version: l.version, donnees: l.donnees ? JSON.parse(l.donnees) : null });
}
async function rSynchroEcrire(s, d, env, now) {
  if (!Number.isInteger(d.version) || d.version < 0) return erreur("version", 400);
  const texte = donneesTexte(d.donnees);
  if (!texte) return erreur("donnees", texte === null ? 413 : 400);
  const c = chiffres(d.donnees), sem = lundi(now);
  /* La version garantit qu'on n'ecrase pas ce qu'un autre appareil vient
     d'envoyer : si elle a bouge, on rend l'etat actuel et le navigateur
     fusionne avant de reessayer. Les exercices de la semaine sont comptes
     ici, par difference, et plafonnes par envoi. */
  const r = await env.DB.prepare(
    "UPDATE comptes SET donnees = ?3, version = version + 1, vu = ?4, note = ?5, serie = ?7, badges = ?8, sprint = ?9, " +
    "sem_resolus = CASE WHEN sem = ?10 THEN sem_resolus ELSE 0 END + MIN(?11, MAX(0, ?6 - resolus)), resolus = ?6, sem = ?10 " +
    "WHERE id = ?1 AND version = ?2 RETURNING version"
  ).bind(s.id, d.version, texte, now, c.note, c.resolus, c.serie, c.badges, c.sprint, sem, DELTA_SEMAINE_MAX).first();
  if (r) return json({ version: r.version });
  const l = await env.DB.prepare("SELECT version, donnees FROM comptes WHERE id = ?1").bind(s.id).first();
  return json({ erreur: "conflit", version: l.version, donnees: l.donnees ? JSON.parse(l.donnees) : null }, 409);
}

async function rExporter(s, env) {
  const l = await env.DB.prepare("SELECT pseudo, cree, vu, version, donnees, note, resolus, serie, badges, sprint, sem, sem_resolus FROM comptes WHERE id = ?1").bind(s.id).first();
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM jetons WHERE compte_id = ?1").bind(s.id).first();
  const export_ = {
    site: "chang64.com",
    a_propos: "Tout ce que chang64 garde sur ce compte. Le code et le code de secours ne sont gardes que sous forme d'empreintes, illisibles : ils ne figurent pas ici. Aucune adresse IP, aucun e-mail, aucun nom n'est enregistre.",
    pseudo: l.pseudo,
    cree_le: new Date(l.cree).toISOString(),
    derniere_activite: new Date(l.vu).toISOString(),
    appareils_connectes: n ? n.n : 0,
    classement: { note: l.note, exercices_resolus: l.resolus, jours_de_suite: l.serie, badges: l.badges, record_sprint: l.sprint, semaine: l.sem, exercices_de_la_semaine: l.sem_resolus },
    version: l.version,
    progression: l.donnees ? JSON.parse(l.donnees) : null
  };
  return new Response(JSON.stringify(export_, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="chang64-compte.json"' }
  });
}

async function effacer(env, id) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM jetons WHERE compte_id = ?1").bind(id),
    env.DB.prepare("DELETE FROM liens_appareil WHERE compte_id = ?1").bind(id),
    env.DB.prepare("DELETE FROM comptes WHERE id = ?1").bind(id)
  ]);
}
async function rSupprimer(s, d, env, now) {
  const r = await codeEssayer(env, s.id, d.code, now);
  if (r !== "ok") return reponseEssai(r, now);
  await effacer(env, s.id);
  return json({ ok: true }, 200, cookieOter());
}

/* Changer de code : l'ancien est exige, les autres appareils sont
   deconnectes. */
async function rCode(s, d, env, now) {
  if (!codeValide(d.nouveau)) return erreur("code", 400);
  const r = await codeEssayer(env, s.id, d.ancien, now);
  if (r !== "ok") return reponseEssai(r, now);
  await env.DB.batch([
    env.DB.prepare("UPDATE comptes SET pin_hash = ?2 WHERE id = ?1").bind(s.id, await codeHacher(d.nouveau, env)),
    env.DB.prepare("DELETE FROM jetons WHERE compte_id = ?1 AND hash <> ?2").bind(s.id, s.jeton)
  ]);
  return json({ ok: true });
}

/* Code oublie : le code de secours permet d'en choisir un nouveau. Il ne
   sert qu'une fois, un autre est rendu. Toutes les sessions tombent. Le code
   de secours fait 80 bits tires au hasard : aucune limite d'essais n'est
   utile, et un compte bloque par un tiers reste recuperable par son
   proprietaire. */
async function rSecours(d, env, now) {
  if (!codeValide(d.code)) return erreur("code", 400);
  const c = await compteParPseudo(env, d.pseudo);
  const donne = await secoursHacher(d.secours, env);
  if (!c || secoursNormaliser(d.secours).length !== 16 || !egal(donne, c.secours_hash)) return erreur("identifiants", 401);
  const secours = secoursCreer();
  const r = await env.DB.prepare(
    "UPDATE comptes SET pin_hash = ?2, secours_hash = ?3, echecs = 0, bloque_jusqu = 0, vu = ?5 WHERE id = ?1 AND secours_hash = ?4 RETURNING id"
  ).bind(c.id, await codeHacher(d.code, env), await secoursHacher(secours, env), c.secours_hash, now).first();
  if (!r) return erreur("identifiants", 401);
  await env.DB.prepare("DELETE FROM jetons WHERE compte_id = ?1").bind(c.id).run();
  const jeton = await sessionOuvrir(env, c.id, now);
  return json({ pseudo: c.pseudo, secours, version: c.version }, 200, cookiePoser(jeton));
}
/* Code de secours perdu mais code connu : on en refait un. */
async function rSecoursNouveau(s, d, env, now) {
  const r = await codeEssayer(env, s.id, d.code, now);
  if (r !== "ok") return reponseEssai(r, now);
  const secours = secoursCreer();
  await env.DB.prepare("UPDATE comptes SET secours_hash = ?2 WHERE id = ?1").bind(s.id, await secoursHacher(secours, env)).run();
  return json({ secours });
}

/* Ajouter un appareil : l'appareil connecte demande un code de 6 caracteres,
   valable 10 minutes et une seule fois ; le nouvel appareil donne le pseudo
   et ce code. Cinq essais au plus par code. */
async function rLien(s, env, now) {
  const code = tirer(ALPHA_LIEN, 6), expire = now + DUREE_LIEN;
  await env.DB.prepare(
    "INSERT INTO liens_appareil (compte_id, code_hash, expire, essais) VALUES (?1, ?2, ?3, 0) " +
    "ON CONFLICT(compte_id) DO UPDATE SET code_hash = ?2, expire = ?3, essais = 0"
  ).bind(s.id, await lienHacher(code, s.id), expire).run();
  return json({ code, expire, pseudo: s.pseudo });
}
async function rLienConnexion(d, env, now) {
  const c = await compteParPseudo(env, d.pseudo);
  if (!c) return erreur("lien", 401);
  const l = await env.DB.prepare(
    "UPDATE liens_appareil SET essais = essais + 1 WHERE compte_id = ?1 AND expire > ?2 AND essais < ?3 RETURNING code_hash"
  ).bind(c.id, now, ESSAIS_LIEN).first();
  if (!l || !egal(await lienHacher(d.code, c.id), l.code_hash)) return erreur("lien", 401);
  /* Le lien ne sert qu'une fois : seul celui qui l'efface ouvre la session. */
  const pris = await env.DB.prepare("DELETE FROM liens_appareil WHERE compte_id = ?1 AND code_hash = ?2 RETURNING compte_id").bind(c.id, l.code_hash).first();
  if (!pris) return erreur("lien", 401);
  const jeton = await sessionOuvrir(env, c.id, now);
  return json({ pseudo: c.pseudo, version: c.version }, 200, cookiePoser(jeton));
}

export async function onRequest({ request, env, params }) {
  try {
    if (!env.DB) return erreur("indisponible", 503);
    const route = [].concat(params && params.route || []).join("/"), m = request.method, now = Date.now();
    const ecriture = m !== "GET" && m !== "HEAD";
    if (ecriture && !memeOrigine(request)) return erreur("origine", 403);

    /* Sans session. */
    if (m === "POST" && ["pseudo", "creer", "connexion", "secours", "lien-connexion"].includes(route)) {
      const d = await corps(request);
      if (!d) return erreur("requete", 400);
      if (route === "pseudo") return await rPseudo(d, env);
      if (route === "creer") return await rCreer(d, env, now);
      if (route === "connexion") return await rConnexion(d, env, now);
      if (route === "secours") return await rSecours(d, env, now);
      return await rLienConnexion(d, env, now);
    }
    if (m === "POST" && route === "deconnexion") {
      const jeton = cookieLire(request);
      if (jeton) await env.DB.prepare("DELETE FROM jetons WHERE hash = ?1").bind(await sha256(jeton)).run();
      return json({ ok: true }, 200, cookieOter());
    }

    /* Avec session. */
    const connues = { GET: ["etat", "synchro", "exporter"], PUT: ["synchro"], POST: ["supprimer", "code", "secours-nouveau", "lien"] };
    if (!(connues[m] || []).includes(route)) return erreur("inconnu", 404);
    const s = await sessionLire(request, env, now);
    if (!s) return erreur("session", 401, null);
    if (m === "GET") {
      if (route === "etat") return json({ pseudo: s.pseudo, version: s.version, cree: s.cree });
      if (route === "synchro") return await rSynchroLire(s, env);
      return await rExporter(s, env);
    }
    const d = await corps(request);
    if (!d) return erreur("requete", 400);
    if (route === "synchro") return await rSynchroEcrire(s, d, env, now);
    if (route === "supprimer") return await rSupprimer(s, d, env, now);
    if (route === "code") return await rCode(s, d, env, now);
    if (route === "secours-nouveau") return await rSecoursNouveau(s, d, env, now);
    return await rLien(s, env, now);
  } catch (e) {
    /* Jamais de detail d'erreur dans la reponse. */
    return erreur("serveur", 500);
  }
}

/* Pour les tests seulement : Pages ne fait de route que de onRequest*. */
export const _essai = { pseudoValider, nettoyer, lundi, chiffres, secoursNormaliser, codeHacher, codeComparer, egal, INACTIF, DUREE_JETON, DUREE_LIEN, BLOCAGE, CREATIONS_PAR_HEURE, TAILLE_MAX };
