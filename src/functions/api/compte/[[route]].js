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
 *   POST pseudo-changer    {pseudo, ancien, nouveau} -> {pseudo}
 *   GET  enquete                                    -> {possible, dernieres}
 *   POST enquete           {question, note, commentaire?, langue?} -> {ok}
 *   POST lien                                       -> {code, expire}
 *   POST lien-connexion    {pseudo, code}           -> {pseudo, version}
 *   GET  defis                                      -> {recus, envoyes}
 *   POST defi-envoyer      {a, exos, r, t}          -> {id}
 *   POST defi-repondre     {id, r, t}               -> {ok}
 *   POST defi-supprimer    {id}                     -> {ok}
 *   POST defi-bloquer      {id}                     -> {ok}   (l'auteur du defi recu)
 *   POST defi-debloquer    {pseudo}                 -> {ok}
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
const CREATIONS_PAR_HEURE = 300;     /* au-dela, seules les connexions nouvelles passent encore */
const CREATIONS_SOUS_PRESSION = 2;   /* ...a raison de deux comptes par connexion et par jour */
const CREATIONS_PAR_HEURE_MAX = 3000; /* plafond absolu, pour proteger la base */
const ESSAIS_COMPTE_JOUR = 30;       /* faux codes par compte et par jour, toutes connexions confondues */
const PSEUDO_RESERVE = 30 * JOUR;    /* un pseudo quitte reste reserve ce temps-la */
const DELTA_SEMAINE_MAX = 300;
/* Defis entre membres (table defis de compte-schema.sql). */
const DEFIS_PAR_JOUR = 20;           /* envois par membre sur 24 h */
const DEFIS_MEME_MEMBRE = 3;         /* en attente vers un meme destinataire */
const DEFIS_BOITE = 30;              /* en attente chez un destinataire */
const DEFIS_DUREE = 60 * JOUR;       /* puis efface */
const DEFIS_LISTE = 30;
const BLOCAGES_MAX = 200;            /* joueurs bloques par compte */
const COMPTES_PAR_APPAREIL = 2;       /* creations de compte par appareil... */
const APPAREIL_DUREE = 30 * JOUR;    /* ...sur cette duree */
const COOKIE_APPAREIL = "__Secure-c64n";
const CREATIONS_PAR_ADRESSE = 20;    /* par jour et par connexion Internet */
const AMIS_MAX = 100;                /* amis par compte */
const PSEUDO_DELAI = 7 * JOUR;       /* un changement de pseudo par semaine */
/* Mini-enquetes de satisfaction (table enquetes). */
const ENQUETE_QUESTIONS = ["site", "interface", "exercices", "ordinateur", "compte"];
const ENQUETE_DELAI = 25 * JOUR;     /* une reponse au plus par compte sur cette duree */
const ENQUETE_TEXTE_MAX = 500;

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
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }, entetes || {})
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
/* Elo contre l'ordinateur (2026-11-21) : calcule dans le navigateur, donc
   inverifiable ici. On le borne seulement : entre 100 et 3000, et jamais a
   plus de 40 points du depart (800) par partie comptee, ce qui est le plus
   grand saut possible d'une partie. Un champ mal forme est retire. Rend
   l'objet propre, ou null. */
const ELO_DEPART = 800, ELO_SAUT = 40, ELO_PARTIES_MAX = 100000;
function eloOrdiPropre(e) {
  if (!e || typeof e !== "object" || Array.isArray(e) || !Number.isFinite(e.r) || !Number.isFinite(e.n)) return null;
  const n = Math.max(0, Math.min(ELO_PARTIES_MAX, Math.floor(e.n)));
  if (!n) return null;
  const bas = Math.max(100, ELO_DEPART - ELO_SAUT * n), haut = Math.min(3000, ELO_DEPART + ELO_SAUT * n);
  const borne = v => Math.max(bas, Math.min(haut, Math.round(v)));
  const r = borne(e.r);
  const h = (Array.isArray(e.h) ? e.h : []).filter(x => Array.isArray(x) && x.length === 2 && Number.isFinite(x[0]) && Number.isFinite(x[1]))
    .slice(-50).map(x => [Math.round(x[0]), borne(x[1])]);
  return { r, n, pic: Math.max(r, borne(Number.isFinite(e.pic) ? e.pic : r)), h };
}
/* Applique la borne a la progression recue, sur place. */
function eloOrdiBorner(donnees) {
  const p = donnees && typeof donnees.progress === "object" && donnees.progress && !Array.isArray(donnees.progress) ? donnees.progress : null;
  if (!p || p.eloOrdi === undefined) return;
  const e = eloOrdiPropre(p.eloOrdi);
  if (e) p.eloOrdi = e; else delete p.eloOrdi;
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
  /* Un corps annonce trop gros n'est meme pas lu. */
  if (+(request.headers.get("Content-Length") || 0) > 4 * TAILLE_MAX) return null;
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

/* ---------- Creations par connexion ---------- */
/* Le plafond global (CREATIONS_PAR_HEURE) pouvait etre sature par un seul
   script, qui bloquait alors les inscriptions de tout le monde. Second
   garde-fou : 20 creations par jour et par connexion Internet (une classe
   entiere passe ; un script, non). L'adresse n'est pas gardee : on en calcule
   une empreinte avec le secret du serveur et la date du jour, illisible et
   differente chaque jour, et on ne garde qu'un compteur, efface le lendemain.
   Rend false si le plafond du jour est atteint, sinon le nombre de creations
   de cette connexion aujourd'hui (celle-ci comprise). Sans adresse (essai
   local) ou sans la table, on laisse passer en rendant true : ce garde-fou ne
   doit jamais empecher une creation legitime par sa propre panne. */
async function adresseCompter(request, env, now) {
  const adresse = request.headers.get("CF-Connecting-IP") || "";
  if (!adresse) return true;
  const jour = new Date(now).toISOString().slice(0, 10);
  const empreinte = (await hmac("chang64-adresse-v1:" + ((env && env.POIVRE) || "") + ":" + jour, adresse)).slice(0, 22);
  try {
    const r = await env.DB.prepare(
      "INSERT INTO creations (empreinte, jour, n) VALUES (?1, ?2, 1) ON CONFLICT(empreinte, jour) DO UPDATE SET n = n + 1 WHERE n < ?3 RETURNING n"
    ).bind(empreinte, jour, CREATIONS_PAR_ADRESSE).first();
    return r ? r.n : false;
  } catch (e) { return true; }
}

/* ---------- Creations par appareil ---------- */
/* Un cookie a part, pose a la creation d'un compte : les dates des creations
   faites depuis cet appareil, signees par le serveur (on ne peut ni les
   inventer ni les modifier, seulement effacer le cookie). Il ne contient
   aucun identifiant : ni compte, ni pseudo, ni appareil. Un frein pour le
   visiteur ordinaire, pas un mur : sans e-mail ni adresse IP, effacer ses
   cookies remet le compte a zero. Envoye seulement a /api/compte/. */
const appareilSigner = (texte, env) => hmac("chang64-appareil-v1:" + ((env && env.POIVRE) || ""), texte);
async function appareilLire(request, env, now) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + COOKIE_APPAREIL + "=([0-9.]{1,80})\\.([A-Za-z0-9_-]{43})(?:;|$)"));
  if (!m || !egal(await appareilSigner(m[1], env), m[2])) return [];
  return m[1].split(".").map(Number).filter(t => Number.isFinite(t) && t > now - APPAREIL_DUREE && t <= now + JOUR).slice(-COMPTES_PAR_APPAREIL);
}
async function appareilPoser(dates, env) {
  const texte = dates.slice(-COMPTES_PAR_APPAREIL).join(".");
  return COOKIE_APPAREIL + "=" + texte + "." + await appareilSigner(texte, env) + "; Path=/api/compte/; Max-Age=" + Math.round(APPAREIL_DUREE / 1000) + "; HttpOnly; Secure; SameSite=Strict";
}

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
/* Faux codes (2026-11-21, decision d'Alexandre). Avant, cinq faux codes
   bloquaient le COMPTE : il suffisait de connaitre un pseudo pour empecher
   son proprietaire d'ouvrir une session. Desormais les essais sont comptes
   par connexion Internet : celui qui devine se bloque lui-meme (5 essais,
   puis 15 minutes, doublees a chaque nouvel echec, un jour au plus), et le
   proprietaire entre toujours depuis chez lui. Un second compteur, par compte
   et par jour, borne une attaque repartie sur beaucoup de connexions : au-dela
   de 30 faux codes, le code ne suffit plus jusqu'au lendemain (le code de
   secours, lui, ouvre toujours, et les sessions deja ouvertes continuent).
   Rien de lisible n'est garde : voir la table essais (compte-schema.sql).
   Sans la table, on retombe sur l'ancien blocage par compte. */
async function essaiEmpreintes(request, env, id, now) {
  const jour = new Date(now).toISOString().slice(0, 10);
  const sel = "chang64-essai-v1:" + ((env && env.POIVRE) || "") + ":" + jour;
  const adresse = (request && request.headers.get("CF-Connecting-IP")) || "";
  return { jour, a: (await hmac(sel, "a:" + id + ":" + adresse)).slice(0, 22), c: (await hmac(sel, "c:" + id)).slice(0, 22) };
}
async function essaisOublier(env, e, lesquelles) {
  try { await env.DB.batch(lesquelles.map(x => env.DB.prepare("DELETE FROM essais WHERE empreinte = ?1 AND jour = ?2").bind(e[x], e.jour))); } catch (err) {}
}
async function codeEssayer(env, id, code, now, request) {
  let e, passe;
  try {
    e = await essaiEmpreintes(request, env, id, now);
    passe = await env.DB.prepare(
      "INSERT INTO essais (empreinte, jour, n, jusqu) VALUES (?1, ?2, 1, 0) ON CONFLICT(empreinte, jour) DO UPDATE SET n = n + 1, " +
      "jusqu = CASE WHEN n + 1 >= ?4 THEN ?3 + MIN(?6, ?5 * (1 << MIN(n + 1 - ?4, 10))) ELSE 0 END WHERE jusqu <= ?3 RETURNING n"
    ).bind(e.a, e.jour, now, ESSAIS_CODE, BLOCAGE, BLOCAGE_MAX).first();
  } catch (err) { return codeEssayerCompte(env, id, code, now); }
  if (!passe) {
    const b = await env.DB.prepare("SELECT jusqu FROM essais WHERE empreinte = ?1 AND jour = ?2").bind(e.a, e.jour).first();
    return { bloque: b ? b.jusqu : now + BLOCAGE };
  }
  const duCompte = await env.DB.prepare(
    "INSERT INTO essais (empreinte, jour, n, jusqu) VALUES (?1, ?2, 1, 0) ON CONFLICT(empreinte, jour) DO UPDATE SET n = n + 1 WHERE n < ?3 RETURNING n"
  ).bind(e.c, e.jour, ESSAIS_COMPTE_JOUR).first();
  if (!duCompte) return { bloque: Date.parse(e.jour + "T00:00:00Z") + JOUR };
  const r = await env.DB.prepare("SELECT pin_hash FROM comptes WHERE id = ?1").bind(id).first();
  if (!r || !codeValide(code) || !(await codeComparer(code, r.pin_hash, env))) return "faux";
  /* Bon code : les compteurs repartent de zero. Si le secret POIVRE a ete
     ajoute depuis la creation, l'empreinte est refaite avec lui. */
  const refaire = env.POIVRE && r.pin_hash.split(".")[1] === "p0";
  await env.DB.prepare("UPDATE comptes SET echecs = 0, bloque_jusqu = 0, vu = ?2, pin_hash = ?3 WHERE id = ?1")
    .bind(id, now, refaire ? await codeHacher(code, env) : r.pin_hash).run();
  await essaisOublier(env, e, ["a", "c"]);
  return "ok";
}
/* L'ancien blocage, par compte : garde pour une base sans la table essais. */
async function codeEssayerCompte(env, id, code, now) {
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
  /* Defis : ceux de plus de 60 jours, et ceux dont un des deux comptes
     n'existe plus. A part du lot : si la table defis n'a pas encore ete
     creee, le reste du menage et la creation de compte ne doivent pas en
     souffrir. */
  try { await env.DB.prepare("DELETE FROM enquetes WHERE compte_id NOT IN (SELECT id FROM comptes)").run(); } catch (e) {}
  try { await env.DB.prepare("DELETE FROM blocages WHERE compte_id NOT IN (SELECT id FROM comptes) OR bloque_id NOT IN (SELECT id FROM comptes)").run(); } catch (e) {}
  try { await env.DB.prepare("DELETE FROM amis WHERE compte_id NOT IN (SELECT id FROM comptes) OR ami_id NOT IN (SELECT id FROM comptes)").run(); } catch (e) {}
  try { await env.DB.prepare("DELETE FROM demandes_amis WHERE cree < ?1 OR de NOT IN (SELECT id FROM comptes) OR a NOT IN (SELECT id FROM comptes)").bind(now - 60 * JOUR).run(); } catch (e) {}
  try { await env.DB.prepare("DELETE FROM ligues WHERE compte_id NOT IN (SELECT id FROM comptes)").run(); } catch (e) {}
  try { await env.DB.prepare("DELETE FROM creations WHERE jour < ?1").bind(new Date(now).toISOString().slice(0, 10)).run(); } catch (e) {}
  try { await env.DB.prepare("DELETE FROM essais WHERE jour < ?1").bind(new Date(now).toISOString().slice(0, 10)).run(); } catch (e) {}
  try { await env.DB.prepare("DELETE FROM pseudos_quittes WHERE jusqu < ?1").bind(now).run(); } catch (e) {}
  try {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM defis WHERE cree < ?1").bind(now - DEFIS_DUREE),
      env.DB.prepare("DELETE FROM defis WHERE de NOT IN (SELECT id FROM comptes) OR a NOT IN (SELECT id FROM comptes)")
    ]);
  } catch (e) {}
}

/* ---------- Routes ---------- */
/* Pseudo quitte (2026-11-21, decision d'Alexandre) : apres un changement de
   pseudo ou une suppression de compte, l'ancien pseudo reste reserve 30 jours.
   Personne d'autre ne peut le prendre (on ne se fait pas passer pour son
   ancien proprietaire) et celui-ci peut le reprendre. La base ne garde pas le
   pseudo lui-meme mais son empreinte. Sans la table, tout se passe comme
   avant : le pseudo est libre aussitot. */
const pseudoEmpreinte = async (env, cle) => (await hmac("chang64-pseudo-v1:" + ((env && env.POIVRE) || ""), cle)).slice(0, 32);
/* Vrai si ce pseudo est reserve a un autre que le compte "id" (0 = personne). */
async function pseudoReserve(env, cle, id, now) {
  try {
    const l = await env.DB.prepare("SELECT compte_id FROM pseudos_quittes WHERE cle = ?1 AND jusqu > ?2").bind(await pseudoEmpreinte(env, cle), now).first();
    return !!l && !(id > 0 && l.compte_id === id);
  } catch (e) { return false; }
}
async function pseudoReserver(env, cle, id, now) {
  try {
    await env.DB.prepare("INSERT INTO pseudos_quittes (cle, compte_id, jusqu) VALUES (?1, ?2, ?3) ON CONFLICT(cle) DO UPDATE SET compte_id = ?2, jusqu = ?3")
      .bind(await pseudoEmpreinte(env, cle), id, now + PSEUDO_RESERVE).run();
  } catch (e) {}
}
async function rPseudo(d, env, now, request) {
  const v = pseudoValider(d.pseudo);
  if (!v.ok) return json({ libre: false, raison: v.raison });
  const pris = await env.DB.prepare("SELECT 1 AS x FROM comptes WHERE cle = ?1").bind(v.cle).first();
  if (pris) return json({ libre: false, raison: "pris" });
  /* Reserve : meme reponse qu'un pseudo pris, sauf pour son ancien proprietaire. */
  let moi = 0;
  try { const s = await sessionLire(request, env, now); if (s) moi = s.id; } catch (e) {}
  return json(await pseudoReserve(env, v.cle, moi, now) ? { libre: false, raison: "pris" } : { libre: true });
}

async function rCreer(d, env, now, request) {
  const v = pseudoValider(d.pseudo);
  if (!v.ok) return erreur("pseudo", 400, { raison: v.raison });
  if (!codeValide(d.code)) return erreur("code", 400);
  const dejaCrees = await appareilLire(request, env, now);
  if (dejaCrees.length >= COMPTES_PAR_APPAREIL) return erreur("appareil", 429, { attendre: Math.max(1, Math.ceil((dejaCrees[0] + APPAREIL_DUREE - now) / 1000)) });
  eloOrdiBorner(d.donnees);
  const texte = donneesTexte(d.donnees);
  if (texte === null) return erreur("donnees", 413);
  await nettoyer(env, now);
  const duJour = await adresseCompter(request, env, now);
  if (duJour === false) return erreur("adresse", 429);
  /* Plafond de l'heure (2026-11-21) : un script reparti sur une quinzaine de
     connexions pouvait encore l'atteindre et fermer les inscriptions a tout
     le monde. Une fois atteint, on ne refuse plus que les connexions qui ont
     deja cree des comptes aujourd'hui : un nouveau venu passe toujours. Le
     plafond absolu, dix fois plus haut, protege la base. */
  const recents = await env.DB.prepare("SELECT COUNT(*) AS n FROM comptes WHERE cree > ?1").bind(now - 3600e3).first();
  const sousPression = !!recents && recents.n >= CREATIONS_PAR_HEURE;
  if (recents && recents.n >= CREATIONS_PAR_HEURE_MAX) return erreur("plus_tard", 429);
  if (sousPression && !(typeof duJour === "number" && duJour <= CREATIONS_SOUS_PRESSION)) return erreur("plus_tard", 429);
  if (await pseudoReserve(env, v.cle, 0, now)) return erreur("pseudo", 409, { raison: "pris" });
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
  const rep = json({ pseudo: v.pseudo, secours, version: ligne.version }, 201, cookiePoser(jeton));
  rep.headers.append("Set-Cookie", await appareilPoser(dejaCrees.concat([now]), env));
  return rep;
}

async function compteParPseudo(env, pseudo) {
  const v = pseudoValider(pseudo);
  if (!v.ok) return null;
  return env.DB.prepare("SELECT id, pseudo, version, secours_hash FROM comptes WHERE cle = ?1").bind(v.cle).first();
}

/* ---------- Fiche privee (2026-11-24, choix d'Alexandre par QCM) ----------
   Pour un enfant : la colonne comptes.prive (0 ou 1, SQL accepte par
   Alexandre : ALTER TABLE comptes ADD COLUMN prive INTEGER NOT NULL DEFAULT 0).
   Allumee, elle cache :
   - sa fiche (rProfil), sauf pour lui et pour ses amis ;
   - sa place dans les tableaux (classement.js) et dans les ligues ;
   - son pseudo dans la recherche de membres (rMembres) ;
   - et ferme la porte aux inconnus : seuls ses amis l'invitent (duel ici,
     parties dans le Worker des parties), et personne ne lui envoie de demande
     d'ami. Lui peut toujours en envoyer, et jouer contre un adversaire au
     hasard. Une porte fermee repond comme un pseudo inconnu, ou comme une
     demande envoyee : rien ne denonce le reglage.
   Eteinte par defaut. Tant que la base n'a pas la colonne, tout le monde est
   public et tout le reste marche (avecPrive, prive). */
async function prive(env, id) {
  try { const l = await env.DB.prepare("SELECT prive FROM comptes WHERE id = ?1").bind(id).first(); return !!(l && l.prive === 1); }
  catch (e) { return false; }
}
/* « Ses amis » : ceux que le membre prive a lui-meme dans ses amis. */
async function amiDe(env, cible, demandeur) {
  return !!(await env.DB.prepare("SELECT 1 AS x FROM amis WHERE compte_id = ?1 AND ami_id = ?2").bind(cible, demandeur).first());
}
async function fermeA(env, cible, demandeur) { return (await prive(env, cible)) && !(await amiDe(env, cible, demandeur)); }
/* Une lecture avec la condition sur prive, et la meme sans si la base n'a
   pas encore la colonne. */
async function avecPrive(avec, sans, lire) {
  try { return await lire(avec); } catch (e) { return await lire(sans); }
}
async function rPrive(s, d, env) {
  if (d.prive !== 0 && d.prive !== 1) return erreur("requete", 400);
  try { await env.DB.prepare("UPDATE comptes SET prive = ?2 WHERE id = ?1").bind(s.id, d.prive).run(); }
  catch (e) { return erreur("indisponible", 503); }
  return json({ ok: true, prive: d.prive });
}

async function rConnexion(d, env, now, request) {
  if (Math.random() < 0.1) await nettoyer(env, now);
  const c = await compteParPseudo(env, d.pseudo);
  /* Pseudo inconnu : meme reponse qu'un mauvais code. */
  if (!c) { await codeHacher(codeValide(d.code) ? d.code : "x", env); return erreur("identifiants", 401); }
  const r = await codeEssayer(env, c.id, d.code, now, request);
  if (r !== "ok") return reponseEssai(r, now);
  const jeton = await sessionOuvrir(env, c.id, now);
  return json({ pseudo: c.pseudo, version: c.version }, 200, cookiePoser(jeton));
}

async function rSynchroLire(s, env) {
  const l = await env.DB.prepare("SELECT version, donnees FROM comptes WHERE id = ?1").bind(s.id).first();
  return json({ version: l.version, pseudo: s.pseudo, donnees: l.donnees ? JSON.parse(l.donnees) : null });
}
async function rSynchroEcrire(s, d, env, now) {
  if (!Number.isInteger(d.version) || d.version < 0) return erreur("version", 400);
  eloOrdiBorner(d.donnees);
  const texte = donneesTexte(d.donnees);
  if (!texte) return erreur("donnees", texte === null ? 413 : 400);
  const c = chiffres(d.donnees), sem = lundi(now);
  /* Ligues : le changement de semaine doit passer avant que cet envoi ne
     remette a zero les exercices de la semaine du joueur. */
  await liguesEtat(env, now);
  /* La version garantit qu'on n'ecrase pas ce qu'un autre appareil vient
     d'envoyer : si elle a bouge, on rend l'etat actuel et le navigateur
     fusionne avant de reessayer. Les exercices de la semaine sont comptes
     ici, par difference, et plafonnes par envoi. */
  const r = await env.DB.prepare(
    "UPDATE comptes SET donnees = ?3, version = version + 1, vu = ?4, note = ?5, serie = ?7, badges = ?8, sprint = ?9, " +
    "sem_resolus = CASE WHEN sem = ?10 THEN sem_resolus ELSE 0 END + MIN(?11, MAX(0, ?6 - resolus)), resolus = ?6, sem = ?10 " +
    "WHERE id = ?1 AND version = ?2 RETURNING version"
  ).bind(s.id, d.version, texte, now, c.note, c.resolus, c.serie, c.badges, c.sprint, sem, DELTA_SEMAINE_MAX).first();
  if (r) {
    try { await liguesSuivre(env, s.id, now); } catch (e) {}
    return json({ version: r.version });
  }
  const l = await env.DB.prepare("SELECT version, donnees FROM comptes WHERE id = ?1").bind(s.id).first();
  return json({ erreur: "conflit", version: l.version, donnees: l.donnees ? JSON.parse(l.donnees) : null }, 409);
}

async function rExporter(s, env) {
  const l = await env.DB.prepare("SELECT pseudo, cree, vu, version, donnees, note, resolus, serie, badges, sprint, sem, sem_resolus, direct_v, direct_n, direct_d FROM comptes WHERE id = ?1").bind(s.id).first();
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM jetons WHERE compte_id = ?1").bind(s.id).first();
  let defis = [];
  try {
    defis = (await env.DB.prepare(
      "SELECT d.cree, d.repondu, d.exos, d.r1, d.t1, d.r2, d.t2, c1.pseudo AS de, c2.pseudo AS a FROM defis d " +
      "JOIN comptes c1 ON c1.id = d.de JOIN comptes c2 ON c2.id = d.a WHERE d.de = ?1 OR d.a = ?1 ORDER BY d.cree DESC"
    ).bind(s.id).all()).results || [];
  } catch (e) {}
  let enquetes = [];
  try { enquetes = (await env.DB.prepare("SELECT question, note, commentaire, langue, cree FROM enquetes WHERE compte_id = ?1 ORDER BY cree DESC").bind(s.id).all()).results || []; } catch (e) {}
  let bloques = [];
  try { bloques = (await env.DB.prepare("SELECT c.pseudo AS p FROM blocages b JOIN comptes c ON c.id = b.bloque_id WHERE b.compte_id = ?1 ORDER BY b.cree DESC").bind(s.id).all()).results || []; } catch (e) {}
  let amis = [];
  try { amis = (await env.DB.prepare("SELECT c.pseudo AS p FROM amis a JOIN comptes c ON c.id = a.ami_id WHERE a.compte_id = ?1 ORDER BY a.cree DESC").bind(s.id).all()).results || []; } catch (e) {}
  let ligue = null;
  try { ligue = await env.DB.prepare("SELECT sem, ligue, points, mouv FROM ligues WHERE compte_id = ?1").bind(s.id).first(); } catch (e) {}
  const export_ = {
    site: "chang64.com",
    a_propos: "Tout ce que chang64 garde sur ce compte. Le code et le code de secours ne sont gardes que sous forme d'empreintes, illisibles : ils ne figurent pas ici. Aucune adresse IP, aucun e-mail, aucun nom n'est enregistre.",
    pseudo: l.pseudo,
    pays: await paysLire(env, s.id),
    cree_le: new Date(l.cree).toISOString(),
    derniere_activite: new Date(l.vu).toISOString(),
    appareils_connectes: n ? n.n : 0,
    classement: { note: l.note, exercices_resolus: l.resolus, jours_de_suite: l.serie, badges: l.badges, record_sprint: l.sprint, semaine: l.sem, exercices_de_la_semaine: l.sem_resolus },
    parties_en_direct: Object.assign({ gagnees: l.direct_v, nulles: l.direct_n, perdues: l.direct_d }, await (async () => {
      const f = await directFamillesLire(env, s.id), un = x => ({ gagnees: x[0], nulles: x[1], perdues: x[2] });
      return f ? { par_cadence: { blitz: un(f.b), rapide: un(f.r), classique: un(f.c), correspondance: un(f.k) } } : {};
    })()),
    elo_entre_membres: await (async () => {
      const f = await eloFamillesLire(env, s.id), un = x => (x ? { elo: x.r, parties_comptees: x.n } : null);
      return f ? { blitz: un(f.b), rapide: un(f.r), classique: un(f.c), correspondance: un(f.k) } : null;
    })(),
    version: l.version,
    ligue: ligue ? { semaine: ligue.sem, ligue: ["Pion", "Cavalier", "Fou", "Tour", "Dame"][ligue.ligue] || "Pion", exercices_de_la_semaine: ligue.points, dernier_mouvement: ligue.mouv } : null,
    joueurs_bloques: bloques.map(x => x.p),
    amis: amis.map(x => x.p),
    reponses_aux_enquetes: enquetes.map(x => ({ le: new Date(x.cree).toISOString(), question: x.question, note: x.note, commentaire: x.commentaire, langue: x.langue })),
    defis_entre_membres: defis.map(x => ({ envoye_le: new Date(x.cree).toISOString(), de: x.de, a: x.a, exercices: x.exos, resultat_de: x.r1, secondes_de: x.t1, resultat_a: x.r2, secondes_a: x.t2 })),
    progression: l.donnees ? JSON.parse(l.donnees) : null
  };
  return new Response(JSON.stringify(export_, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="chang64-compte.json"' }
  });
}

async function effacer(env, id, now) {
  /* Le pseudo du compte supprime reste indisponible 30 jours, et les pseudos
     que ce compte avait quittes aussi (ils ne reviennent a personne). */
  try {
    const c = await env.DB.prepare("SELECT cle FROM comptes WHERE id = ?1").bind(id).first();
    if (c) await pseudoReserver(env, c.cle, 0, now || Date.now());
    await env.DB.prepare("UPDATE pseudos_quittes SET compte_id = 0 WHERE compte_id = ?1").bind(id).run();
  } catch (e) {}
  try { await env.DB.prepare("DELETE FROM defis WHERE de = ?1 OR a = ?1").bind(id).run(); } catch (e) {}
  try { await env.DB.prepare("DELETE FROM enquetes WHERE compte_id = ?1").bind(id).run(); } catch (e) {}
  try { await env.DB.prepare("DELETE FROM blocages WHERE compte_id = ?1 OR bloque_id = ?1").bind(id).run(); } catch (e) {}
  try { await env.DB.prepare("DELETE FROM amis WHERE compte_id = ?1 OR ami_id = ?1").bind(id).run(); } catch (e) {}
  try { await env.DB.prepare("DELETE FROM demandes_amis WHERE de = ?1 OR a = ?1").bind(id).run(); } catch (e) {}
  try { await env.DB.prepare("DELETE FROM ligues WHERE compte_id = ?1").bind(id).run(); } catch (e) {}
  try { await env.DB.prepare("DELETE FROM invitations WHERE de = ?1 OR a = ?1").bind(id).run(); } catch (e) {}
  /* Parties par correspondance (2026-11-21) : invitations, recherches et
     parties finies partent tout de suite. Une partie en cours reste le temps
     que l'adversaire revienne : le serveur des parties la lui donne gagnee,
     puis l'efface (worker-parties, corrListe). */
  try { await env.DB.prepare("DELETE FROM correspondances WHERE etat <> 1 AND (b = ?1 OR n = ?1 OR pour = ?1)").bind(id).run(); } catch (e) {}
  await env.DB.batch([
    env.DB.prepare("DELETE FROM jetons WHERE compte_id = ?1").bind(id),
    env.DB.prepare("DELETE FROM liens_appareil WHERE compte_id = ?1").bind(id),
    env.DB.prepare("DELETE FROM comptes WHERE id = ?1").bind(id)
  ]);
}
async function rSupprimer(s, d, env, now, request) {
  const r = await codeEssayer(env, s.id, d.code, now, request);
  if (r !== "ok") return reponseEssai(r, now);
  await effacer(env, s.id, now);
  return json({ ok: true }, 200, cookieOter());
}

/* Changer de code : l'ancien est exige, les autres appareils sont
   deconnectes. */
async function rCode(s, d, env, now, request) {
  if (!codeValide(d.nouveau)) return erreur("code", 400);
  const r = await codeEssayer(env, s.id, d.ancien, now, request);
  if (r !== "ok") return reponseEssai(r, now);
  await env.DB.batch([
    env.DB.prepare("UPDATE comptes SET pin_hash = ?2 WHERE id = ?1").bind(s.id, await codeHacher(d.nouveau, env)),
    env.DB.prepare("DELETE FROM jetons WHERE compte_id = ?1 AND hash <> ?2").bind(s.id, s.jeton)
  ]);
  return json({ ok: true });
}

/* Changer de pseudo. Le code etire par le navigateur est sale par le pseudo
   (compte.js) : il change donc avec lui, meme si le joueur garde le meme
   code. Le navigateur envoie les deux, l'ancien pour prouver qu'il connait
   le code, le nouveau pour la suite. Les regles du pseudo sont celles de la
   creation ; l'unicite est garantie par la base. Les sessions, le code de
   secours et la progression ne bougent pas. */
async function rPseudoChanger(s, d, env, now, request) {
  const v = pseudoValider(d.pseudo);
  if (!v.ok) return erreur("pseudo", 400, { raison: v.raison });
  if (!codeValide(d.nouveau)) return erreur("code", 400);
  const r = await codeEssayer(env, s.id, d.ancien, now, request);
  if (r !== "ok") return reponseEssai(r, now);
  if (await pseudoReserve(env, v.cle, s.id, now)) return erreur("pseudo", 409, { raison: "pris" });
  const ancien = await env.DB.prepare("SELECT cle FROM comptes WHERE id = ?1").bind(s.id).first();
  /* Une fois par semaine au plus (2026-11-17) : sinon un joueur pourrait
     changer de nom a repetition dans les tableaux. La condition est dans la
     mise a jour elle-meme. */
  let fait;
  try {
    fait = await env.DB.prepare("UPDATE comptes SET cle = ?2, pseudo = ?3, pin_hash = ?4, pseudo_change = ?5 WHERE id = ?1 AND pseudo_change <= ?6 RETURNING id")
      .bind(s.id, v.cle, v.pseudo, await codeHacher(d.nouveau, env), now, now - PSEUDO_DELAI).first();
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message))) return erreur("pseudo", 409, { raison: "pris" });
    throw e;
  }
  if (!fait) {
    const l = await env.DB.prepare("SELECT pseudo_change FROM comptes WHERE id = ?1").bind(s.id).first();
    return erreur("pseudo_recent", 429, { attendre: Math.max(1, Math.ceil(((l ? l.pseudo_change : now) + PSEUDO_DELAI - now) / 1000)) });
  }
  /* L'ancien pseudo reste reserve a ce compte ; s'il reprend un pseudo qu'il
     avait quitte, la reserve de celui-ci tombe. Un simple changement de
     majuscules ou d'accents garde la meme cle : rien a reserver. */
  if (ancien && ancien.cle !== v.cle) {
    await pseudoReserver(env, ancien.cle, s.id, now);
    try { await env.DB.prepare("DELETE FROM pseudos_quittes WHERE cle = ?1").bind(await pseudoEmpreinte(env, v.cle)).run(); } catch (e) {}
  }
  return json({ pseudo: v.pseudo });
}

/* Code oublie : le code de secours permet d'en choisir un nouveau. Il ne
   sert qu'une fois, un autre est rendu. Toutes les sessions tombent. Le code
   de secours fait 80 bits tires au hasard : aucune limite d'essais n'est
   utile, et un compte bloque par un tiers reste recuperable par son
   proprietaire. */
async function rSecours(d, env, now, request) {
  if (!codeValide(d.code)) return erreur("code", 400);
  const c = await compteParPseudo(env, d.pseudo);
  const donne = await secoursHacher(d.secours, env);
  if (!c || secoursNormaliser(d.secours).length !== 16 || !egal(donne, c.secours_hash)) return erreur("identifiants", 401);
  const secours = secoursCreer();
  const r = await env.DB.prepare(
    "UPDATE comptes SET pin_hash = ?2, secours_hash = ?3, echecs = 0, bloque_jusqu = 0, vu = ?5 WHERE id = ?1 AND secours_hash = ?4 RETURNING id"
  ).bind(c.id, await codeHacher(d.code, env), await secoursHacher(secours, env), c.secours_hash, now).first();
  if (!r) return erreur("identifiants", 401);
  try { await essaisOublier(env, await essaiEmpreintes(request, env, c.id, now), ["a", "c"]); } catch (e) {}
  await env.DB.prepare("DELETE FROM jetons WHERE compte_id = ?1").bind(c.id).run();
  const jeton = await sessionOuvrir(env, c.id, now);
  return json({ pseudo: c.pseudo, secours, version: c.version }, 200, cookiePoser(jeton));
}
/* Code de secours perdu mais code connu : on en refait un. */
async function rSecoursNouveau(s, d, env, now, request) {
  const r = await codeEssayer(env, s.id, d.code, now, request);
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

/* ---------- Defis entre membres ---------- */
/* Un membre joue cinq exercices puis envoie le defi a un autre membre, par
   son pseudo : les memes exercices, son resultat a battre. Le destinataire
   le trouve dans son compte, le releve, et les deux voient le resultat.
   Aucun texte libre ne circule : un pseudo, cinq exercices, un score.
   - exos : cinq numeros d'exercice, 4 caracteres en base 36 chacun ;
   - r : cinq chiffres, 2 = trouve du premier coup, 1 = trouve ensuite,
     0 = rate ; t : secondes (comme le defi par lien, duel.js).
   Limites, pour qu'on ne puisse pas inonder quelqu'un : 20 envois par jour,
   3 defis en attente vers un meme membre, 30 en attente dans une boite.
   Le destinataire peut effacer un defi recu, l'auteur un defi envoye. */
const defiExos = x => typeof x === "string" && /^[0-9a-z]{20}$/.test(x);
const defiScore = x => typeof x === "string" && /^[012]{5}$/.test(x);
const defiTemps = x => Number.isInteger(x) && x >= 0 && x <= 35999;
async function rDefis(s, env) {
  const lire = async (moi, autre) => (await env.DB.prepare(
    "SELECT d.id, c.pseudo AS p, d.exos, d.r1, d.t1, d.r2, d.t2, d.cree, d.repondu FROM defis d JOIN comptes c ON c.id = d." + autre +
    " WHERE d." + moi + " = ?1 ORDER BY d.cree DESC LIMIT ?2"
  ).bind(s.id, DEFIS_LISTE).all()).results || [];
  const bloques = (await env.DB.prepare("SELECT c.pseudo AS p FROM blocages b JOIN comptes c ON c.id = b.bloque_id WHERE b.compte_id = ?1 ORDER BY b.cree DESC").bind(s.id).all()).results || [];
  return json({ recus: await lire("a", "de"), envoyes: await lire("de", "a"), bloques: bloques.map(x => x.p) });
}
/* Ne plus recevoir de defis d'un joueur (2026-11-17). On bloque l'auteur d'un
   defi RECU : impossible de bloquer quelqu'un au hasard, et inutile de taper
   un pseudo. Ses defis en attente partent avec. L'auteur n'en est pas
   averti : ses envois suivants sont refuses comme si la boite etait pleine. */
async function rDefiBloquer(s, d, env, now) {
  if (!Number.isInteger(d.id)) return erreur("requete", 400);
  const l = await env.DB.prepare("SELECT de FROM defis WHERE id = ?1 AND a = ?2").bind(d.id, s.id).first();
  if (!l) return erreur("defi", 404);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO blocages (compte_id, bloque_id, cree) SELECT ?1, ?2, ?3 WHERE (SELECT COUNT(*) FROM blocages WHERE compte_id = ?1) < ?4 " +
      "ON CONFLICT(compte_id, bloque_id) DO NOTHING").bind(s.id, l.de, now, BLOCAGES_MAX),
    env.DB.prepare("DELETE FROM defis WHERE de = ?2 AND a = ?1 AND r2 IS NULL").bind(s.id, l.de)
  ]);
  return json({ ok: true });
}
async function rDefiDebloquer(s, d, env) {
  const c = await compteParPseudo(env, d.pseudo);
  if (c) await env.DB.prepare("DELETE FROM blocages WHERE compte_id = ?1 AND bloque_id = ?2").bind(s.id, c.id).run();
  return json({ ok: true });
}
async function rDefiEnvoyer(s, d, env, now) {
  if (!defiExos(d.exos) || !defiScore(d.r) || !defiTemps(d.t)) return erreur("requete", 400);
  const c = await compteParPseudo(env, d.a);
  if (!c) return erreur("membre", 404);
  if (c.id === s.id) return erreur("soi", 400);
  /* Fiche privee : seuls ses amis l'invitent ; pour les autres, un pseudo inconnu. */
  if (await fermeA(env, c.id, s.id)) return erreur("membre", 404);
  /* Les trois plafonds et l'insertion en une seule instruction : des envois
     simultanes ne passent pas entre les mailles. */
  const r = await env.DB.prepare(
    "INSERT INTO defis (de, a, exos, r1, t1, cree) SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE " +
    "(SELECT COUNT(*) FROM defis WHERE de = ?1 AND cree > ?7) < ?8 AND " +
    "(SELECT COUNT(*) FROM defis WHERE de = ?1 AND a = ?2 AND r2 IS NULL) < ?9 AND " +
    "(SELECT COUNT(*) FROM defis WHERE a = ?2 AND r2 IS NULL) < ?10 AND " +
    "NOT EXISTS (SELECT 1 FROM blocages WHERE compte_id = ?2 AND bloque_id = ?1) RETURNING id"
  ).bind(s.id, c.id, d.exos, d.r, d.t, now, now - JOUR, DEFIS_PAR_JOUR, DEFIS_MEME_MEMBRE, DEFIS_BOITE).first();
  if (!r) return erreur("trop", 429);
  return json({ id: r.id, a: c.pseudo }, 201);
}
async function rDefiRepondre(s, d, env, now) {
  if (!Number.isInteger(d.id) || !defiScore(d.r) || !defiTemps(d.t)) return erreur("requete", 400);
  /* Seul le destinataire repond, et une seule fois. */
  const r = await env.DB.prepare(
    "UPDATE defis SET r2 = ?3, t2 = ?4, repondu = ?5 WHERE id = ?1 AND a = ?2 AND r2 IS NULL RETURNING id"
  ).bind(d.id, s.id, d.r, d.t, now).first();
  return r ? json({ ok: true }) : erreur("defi", 404);
}
async function rDefiSupprimer(s, d, env) {
  if (!Number.isInteger(d.id)) return erreur("requete", 400);
  const r = await env.DB.prepare("DELETE FROM defis WHERE id = ?1 AND (a = ?2 OR de = ?2) RETURNING id").bind(d.id, s.id).first();
  return r ? json({ ok: true }) : erreur("defi", 404);
}

/* ---------- Mini-enquetes de satisfaction ---------- */
/* De temps en temps, un joueur connecte se voit poser UNE question : une
   note de 1 a 5 et, s'il le veut, un commentaire court. C'est le seul texte
   libre que le site recoit ; il n'est jamais montre a un autre joueur.
   - question : un identifiant de la liste ENQUETE_QUESTIONS (les libelles
     sont dans compte.js) ; toute autre valeur est refusee ;
   - une reponse au plus par compte tous les 25 jours, garantie par
     l'insertion elle-meme ;
   - les reponses partent avec le compte (suppression, effacement apres deux
     ans) et figurent dans l'export.
   Pour les lire : requetes en bas de compte-schema.sql. */
function enqueteTexte(x) {
  if (x === undefined || x === null) return "";
  if (typeof x !== "string") return null;
  /* Ni caracteres de controle ni retours a la ligne en rafale. */
  const t = x.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").replace(/\s{3,}/g, "  ").trim();
  return Array.from(t).length > ENQUETE_TEXTE_MAX ? null : t;
}
async function rEnqueteLire(s, env, now) {
  const l = (await env.DB.prepare("SELECT question, MAX(cree) AS t FROM enquetes WHERE compte_id = ?1 GROUP BY question").bind(s.id).all()).results || [];
  const dernieres = {};
  let recente = 0;
  for (const x of l) { dernieres[x.question] = x.t; recente = Math.max(recente, x.t); }
  return json({ possible: recente < now - ENQUETE_DELAI, dernieres });
}
async function rEnqueteEcrire(s, d, env, now) {
  const texte = enqueteTexte(d.commentaire);
  if (!ENQUETE_QUESTIONS.includes(d.question) || !Number.isInteger(d.note) || d.note < 1 || d.note > 5 || texte === null) return erreur("requete", 400);
  const langue = typeof d.langue === "string" && /^[a-z]{2}$/.test(d.langue) ? d.langue : "";
  const r = await env.DB.prepare(
    "INSERT INTO enquetes (compte_id, question, note, commentaire, langue, cree) SELECT ?1, ?2, ?3, ?4, ?5, ?6 " +
    "WHERE NOT EXISTS (SELECT 1 FROM enquetes WHERE compte_id = ?1 AND cree > ?7) RETURNING id"
  ).bind(s.id, d.question, d.note, texte || null, langue, now, now - ENQUETE_DELAI).first();
  return r ? json({ ok: true }, 201) : erreur("trop", 429);
}

/* ---------- Recherche de membres (2026-11-18) ---------- */
/* GET membres?q=<debut de pseudo> -> { membres: [pseudo, ...] }, huit au plus,
   les plus recemment actifs d'abord. Avec session seulement. Le debut saisi
   est ramene a la meme forme que la cle des pseudos (minuscules, sans
   accents, sosies cyrilliques), et les jokers de LIKE sont neutralises. */
async function rMembres(s, request, env) {
  const brut = (new URL(request.url).searchParams.get("q") || "").normalize("NFC").trim();
  const n = Array.from(brut).length;
  if (n < 2 || n > PSEUDO_MAX || !/^[\p{L}0-9_-]+$/u.test(brut)) return json({ membres: [] });
  const bas = brut.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  const cle = Array.from(bas).map(c => PSEUDO_SOSIES[c] || c).join("");
  const motif = cle.replace(/[\\%_]/g, c => "\\" + c) + "%";
  /* Fiche privee : absent de la recherche. */
  const l = await avecPrive(
    "SELECT pseudo FROM comptes WHERE cle LIKE ?1 ESCAPE '\\' AND id <> ?2 AND prive = 0 ORDER BY vu DESC LIMIT 8",
    "SELECT pseudo FROM comptes WHERE cle LIKE ?1 ESCAPE '\\' AND id <> ?2 ORDER BY vu DESC LIMIT 8",
    async sql => (await env.DB.prepare(sql).bind(motif, s.id).all()).results || []);
  return json({ membres: l.map(x => x.pseudo) });
}

/* ---------- Pays de la fiche (2026-11-18) ---------- */
/* Le joueur choisit son pays lui-meme, dans Mon compte : un code a deux
   lettres, ou rien. Rien n'est deduit de sa connexion. La lecture est a part
   et protegee : tant que la colonne n'existe pas dans la base, tout le reste
   du compte marche. */
const paysValide = p => typeof p === "string" && /^([A-Z]{2})?$/.test(p);
async function paysLire(env, id) {
  try { const l = await env.DB.prepare("SELECT pays FROM comptes WHERE id = ?1").bind(id).first(); return l && paysValide(l.pays) ? l.pays : ""; }
  catch (e) { return ""; }
}
async function rPays(s, d, env) {
  if (!paysValide(d.pays)) return erreur("requete", 400);
  await env.DB.prepare("UPDATE comptes SET pays = ?2 WHERE id = ?1").bind(s.id, d.pays).run();
  return json({ ok: true, pays: d.pays });
}

/* ---------- Amis (2026-11-18) ---------- */
/* Une liste privee : les joueurs qu'un membre a ajoutes a ses amis, pour les
   retrouver dans un tableau a part. Pas de demande, pas d'acceptation, pas de
   message : l'autre n'est pas prevenu et personne d'autre ne voit la liste.
   Elle ne montre rien de plus que la fiche publique de chacun (six chiffres).
   GET amis -> { moi: {p,s,n,r,j,b,k}, amis: [{p,s,n,r,j,b,k}] }
   POST ami-ajouter { pseudo } / POST ami-retirer { pseudo } */
const AMIS_CHIFFRES = "c.pseudo AS p, CASE WHEN c.sem = ?2 THEN c.sem_resolus ELSE 0 END AS s, c.note AS n, c.resolus AS r, c.serie AS j, c.badges AS b, c.sprint AS k";
/* m = 1 quand l'ami a lui aussi ajoute le joueur (2026-11-18) : les deux se
   voient alors comme amis. C'est le seul cas ou l'on apprend qu'un autre
   joueur vous a ajoute, et il faut l'avoir ajoute soi-meme. */
const AMIS_RECIPROQUE = "EXISTS (SELECT 1 FROM amis x WHERE x.compte_id = a.ami_id AND x.ami_id = a.compte_id) AS m";
/* Demandes d'amis (2026-11-19, decision d'Alexandre) : « Ajouter » envoie une
   demande, que l'autre accepte ou refuse. Accepter rend les deux amis d'un
   coup (une ligne dans chaque sens). Les amis ajoutes avant restent tels
   quels. Une demande vit 60 jours. Sans la table demandes_amis (pas encore
   creee), on retombe sur l'ajout direct d'avant.
   GET amis -> { moi, amis, demandes: [pseudo], envoyees: [pseudo] }
   POST ami-ajouter / ami-accepter / ami-refuser / ami-retirer { pseudo } */
const DEMANDES_DUREE = 60 * JOUR;
const DEMANDES_MAX = 30;             /* demandes envoyees en attente, par compte */
async function amisBloques(env, a, b) {
  try { return !!(await env.DB.prepare("SELECT 1 AS x FROM blocages WHERE (compte_id = ?1 AND bloque_id = ?2) OR (compte_id = ?2 AND bloque_id = ?1) LIMIT 1").bind(a, b).first()); } catch (e) { return false; }
}
/* Les deux deviennent amis ; le plafond de chacun est verifie dans l'insertion. */
async function amisLier(env, a, b, now) {
  const poser = "INSERT INTO amis (compte_id, ami_id, cree) SELECT ?1, ?2, ?3 WHERE (SELECT COUNT(*) FROM amis WHERE compte_id = ?1) < ?4 ON CONFLICT(compte_id, ami_id) DO NOTHING";
  await env.DB.batch([env.DB.prepare(poser).bind(a, b, now, AMIS_MAX), env.DB.prepare(poser).bind(b, a, now, AMIS_MAX)]);
  try { await env.DB.prepare("DELETE FROM demandes_amis WHERE (de = ?1 AND a = ?2) OR (de = ?2 AND a = ?1)").bind(a, b).run(); } catch (e) {}
}
async function rAmis(s, env, now) {
  const semaine = lundi(now);
  const moi = await env.DB.prepare("SELECT " + AMIS_CHIFFRES + " FROM comptes c WHERE c.id = ?1").bind(s.id, semaine).first();
  const amis = (await env.DB.prepare("SELECT " + AMIS_CHIFFRES + ", " + AMIS_RECIPROQUE + " FROM amis a JOIN comptes c ON c.id = a.ami_id WHERE a.compte_id = ?1 ORDER BY a.cree DESC LIMIT ?3").bind(s.id, semaine, AMIS_MAX).all()).results || [];
  let demandes = [], envoyees = [];
  try {
    await env.DB.prepare("DELETE FROM demandes_amis WHERE cree < ?1").bind(now - DEMANDES_DUREE).run();
    demandes = ((await env.DB.prepare("SELECT c.pseudo AS p FROM demandes_amis d JOIN comptes c ON c.id = d.de WHERE d.a = ?1 " +
      "AND NOT EXISTS (SELECT 1 FROM blocages b WHERE (b.compte_id = d.a AND b.bloque_id = d.de) OR (b.compte_id = d.de AND b.bloque_id = d.a)) ORDER BY d.cree DESC LIMIT 50").bind(s.id).all()).results || []).map(x => x.p);
    envoyees = ((await env.DB.prepare("SELECT c.pseudo AS p FROM demandes_amis d JOIN comptes c ON c.id = d.a WHERE d.de = ?1 ORDER BY d.cree DESC LIMIT 50").bind(s.id).all()).results || []).map(x => x.p);
  } catch (e) {}
  return json({ semaine, moi, amis, demandes, envoyees });
}
async function rAmiAjouter(s, d, env, now) {
  const c = await compteParPseudo(env, d.pseudo);
  if (!c) return erreur("inconnu", 404);
  if (c.id === s.id) return erreur("soi", 400);
  if (await env.DB.prepare("SELECT 1 AS x FROM amis WHERE compte_id = ?1 AND ami_id = ?2").bind(s.id, c.id).first()) return json({ ok: true, pseudo: c.pseudo, etat: "amis" }, 201);
  let table = true, recue = null;
  try { recue = await env.DB.prepare("SELECT 1 AS x FROM demandes_amis WHERE de = ?1 AND a = ?2").bind(c.id, s.id).first(); } catch (e) { table = false; }
  /* L'autre m'a deja demande, ou m'avait ajoute avant les demandes : on est amis. */
  const dejaLa = await env.DB.prepare("SELECT 1 AS x FROM amis WHERE compte_id = ?1 AND ami_id = ?2").bind(c.id, s.id).first();
  if (!table || recue || dejaLa) {
    if (table) await amisLier(env, s.id, c.id, now);
    else await env.DB.prepare("INSERT INTO amis (compte_id, ami_id, cree) SELECT ?1, ?2, ?3 WHERE (SELECT COUNT(*) FROM amis WHERE compte_id = ?1) < ?4 ON CONFLICT(compte_id, ami_id) DO NOTHING").bind(s.id, c.id, now, AMIS_MAX).run();
    const la = await env.DB.prepare("SELECT 1 AS x FROM amis WHERE compte_id = ?1 AND ami_id = ?2").bind(s.id, c.id).first();
    return la ? json({ ok: true, pseudo: c.pseudo, etat: "amis" }, 201) : erreur("trop", 429);
  }
  /* Un membre qui m'a bloque (ou que j'ai bloque) ne recoit rien, sans que cela se voie. */
  if (await amisBloques(env, s.id, c.id)) return json({ ok: true, pseudo: c.pseudo, etat: "demande" }, 202);
  /* Fiche privee : personne ne lui envoie de demande, sans que cela se voie non plus. */
  if (await prive(env, c.id)) return json({ ok: true, pseudo: c.pseudo, etat: "demande" }, 202);
  await env.DB.prepare("INSERT INTO demandes_amis (de, a, cree) SELECT ?1, ?2, ?3 WHERE (SELECT COUNT(*) FROM demandes_amis WHERE de = ?1) < ?4 ON CONFLICT(de, a) DO NOTHING").bind(s.id, c.id, now, DEMANDES_MAX).run();
  const posee = await env.DB.prepare("SELECT 1 AS x FROM demandes_amis WHERE de = ?1 AND a = ?2").bind(s.id, c.id).first();
  return posee ? json({ ok: true, pseudo: c.pseudo, etat: "demande" }, 202) : erreur("trop", 429);
}
async function rAmiAccepter(s, d, env, now) {
  const c = await compteParPseudo(env, d.pseudo);
  if (!c) return erreur("inconnu", 404);
  let recue = null;
  try { recue = await env.DB.prepare("SELECT 1 AS x FROM demandes_amis WHERE de = ?1 AND a = ?2").bind(c.id, s.id).first(); } catch (e) {}
  if (!recue) return erreur("inconnu", 404);
  await amisLier(env, s.id, c.id, now);
  const la = await env.DB.prepare("SELECT 1 AS x FROM amis WHERE compte_id = ?1 AND ami_id = ?2").bind(s.id, c.id).first();
  return la ? json({ ok: true, pseudo: c.pseudo, etat: "amis" }, 201) : erreur("trop", 429);
}
async function rAmiRefuser(s, d, env) {
  const c = await compteParPseudo(env, d.pseudo);
  if (c) { try { await env.DB.prepare("DELETE FROM demandes_amis WHERE de = ?1 AND a = ?2").bind(c.id, s.id).run(); } catch (e) {} }
  return json({ ok: true });
}
/* Retirer un ami defait le lien des deux cotes, et annule une demande envoyee. */
async function rAmiRetirer(s, d, env) {
  const c = await compteParPseudo(env, d.pseudo);
  if (c) {
    await env.DB.prepare("DELETE FROM amis WHERE (compte_id = ?1 AND ami_id = ?2) OR (compte_id = ?2 AND ami_id = ?1)").bind(s.id, c.id).run();
    try { await env.DB.prepare("DELETE FROM demandes_amis WHERE de = ?1 AND a = ?2").bind(s.id, c.id).run(); } catch (e) {}
  }
  return json({ ok: true });
}

/* ---------- Ligues (2026-11-18) ---------- */
/* Cinq ligues, de 0 (Pion) a 4 (Dame). Chaque lundi (UTC), les membres qui
   ont reussi au moins un exercice la semaine d'avant sont ranges, ligue par
   ligue, en groupes d'environ 20 selon ce nombre d'exercices. Le classement
   d'un groupe compte les exercices reussis dans la semaine. A la fin, les 5
   premiers montent, les 5 derniers descendent (moins dans un petit groupe :
   un tiers au plus), et qui n'a rien fait descend aussi.
   Pas de tache planifiee : le changement de semaine se fait a la premiere
   requete de la semaine, une seule fois (ligne de ligues_semaines posee en
   premier, ouvert = -1 tant que le calcul n'est pas ecrit).
   Les ligues n'ouvrent que la premiere semaine qui suit LIGUE_SEUIL membres
   actifs ; avant, rien n'est ecrit dans la table ligues. Une fois ouvertes,
   elles le restent.
   Tant que les deux tables n'existent pas dans la base, tout le reste du
   compte marche : chaque appel est protege. */
const LIGUES = 5, LIGUE_GROUPE = 20, LIGUE_MOUV = 5, LIGUE_SEUIL = 50;
const LIGUE_GROUPE_MAX = LIGUE_GROUPE + 5;   /* arrivees en cours de semaine */
function lundiAvant(sem) {
  const d = new Date(sem + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}
const ligueMouvements = n => Math.min(LIGUE_MOUV, Math.floor(n / 3));
/* Range des joueurs [{ id, ligue, points, mouv }] en groupes de taille
   voisine de LIGUE_GROUPE, ligue par ligue, les plus actifs ensemble.
   Rend des lignes [id, ligue, groupe, mouv]. */
function liguesRepartir(joueurs) {
  const lignes = [];
  for (let lg = 0; lg < LIGUES; lg++) {
    const l = joueurs.filter(j => j.ligue === lg).sort((a, b) => b.points - a.points || a.id - b.id);
    const g = Math.max(1, Math.round(l.length / LIGUE_GROUPE));
    l.forEach((j, i) => lignes.push([j.id, lg, Math.floor(i * g / l.length), j.mouv || 0]));
  }
  return lignes;
}
/* Fin de semaine : a partir des groupes de la semaine finie
   [{ id, ligue, groupe, points }], rend les lignes de la semaine suivante.
   Groupe -1 : le joueur n'a rien fait, il garde sa ligue (une de moins) et
   sera range dans un groupe a son retour. */
function liguesCalculer(anciens) {
  const groupes = new Map();
  for (const j of anciens) { const k = j.ligue + ":" + j.groupe; if (!groupes.has(k)) groupes.set(k, []); groupes.get(k).push(j); }
  const actifs = [], lignes = [];
  for (const l of groupes.values()) {
    l.sort((a, b) => b.points - a.points || a.id - b.id);
    const k = ligueMouvements(l.length);
    l.forEach((j, i) => {
      let mouv = 0;
      if (j.points > 0 && i < k) mouv = j.ligue < LIGUES - 1 ? 1 : 0;
      else if ((j.points <= 0 || i >= l.length - k) && j.ligue > 0) mouv = -1;
      const suite = { id: j.id, ligue: j.ligue + mouv, points: j.points, mouv };
      if (j.points > 0) actifs.push(suite); else lignes.push([j.id, suite.ligue, -1, mouv]);
    });
  }
  return lignes.concat(liguesRepartir(actifs));
}
const LIGUES_ECRIRE = "INSERT INTO ligues (compte_id, sem, ligue, groupe, points, mouv) " +
  "SELECT json_extract(value, '$[0]'), ?2, json_extract(value, '$[1]'), json_extract(value, '$[2]'), ?3, json_extract(value, '$[3]') FROM json_each(?1) WHERE true " +
  "ON CONFLICT(compte_id) DO UPDATE SET sem = excluded.sem, ligue = excluded.ligue, groupe = excluded.groupe, points = excluded.points, mouv = excluded.mouv";
async function liguesBascule(env, sem) {
  const avant = lundiAvant(sem);
  const deja = await env.DB.prepare("SELECT 1 AS x FROM ligues_semaines WHERE ouvert = 1 LIMIT 1").first();
  let lignes = [], actifs = 0, ouvert = 1;
  if (deja) {
    const anciens = (await env.DB.prepare("SELECT compte_id AS id, ligue, groupe, points FROM ligues WHERE sem = ?1 AND groupe >= 0").bind(avant).all()).results || [];
    actifs = anciens.filter(j => j.points > 0).length;
    lignes = liguesCalculer(anciens);
  } else {
    /* Pas encore ouvertes : on compte les membres actifs. Au seuil, tout le
       monde commence en ligue Pion. */
    const a = await avecPrive(
      "SELECT id, sem_resolus AS points FROM comptes WHERE sem IN (?1, ?2) AND sem_resolus > 0 AND prive = 0",
      "SELECT id, sem_resolus AS points FROM comptes WHERE sem IN (?1, ?2) AND sem_resolus > 0",
      async sql => (await env.DB.prepare(sql).bind(avant, sem).all()).results || []);
    actifs = a.length;
    ouvert = actifs >= LIGUE_SEUIL ? 1 : 0;
    if (ouvert) lignes = liguesRepartir(a.map(j => ({ id: j.id, ligue: 0, points: j.points, mouv: 0 })));
  }
  const fin = env.DB.prepare("UPDATE ligues_semaines SET ouvert = ?2, actifs = ?3 WHERE sem = ?1").bind(sem, ouvert, actifs);
  /* Un seul lot : ou tout est ecrit, ou rien. */
  await env.DB.batch(lignes.length ? [env.DB.prepare(LIGUES_ECRIRE).bind(JSON.stringify(lignes), sem, 0), fin] : [fin]);
}
/* Etat des ligues pour la semaine en cours, garde en memoire le temps que
   vit le serveur : { sem, ouvert, actifs }. Fait le changement de semaine si
   personne ne l'a fait. */
let liguesMemo = { sem: "" };
async function liguesEtat(env, now) {
  const sem = lundi(now);
  if (liguesMemo.sem === sem) return liguesMemo;
  try {
    let pris = await env.DB.prepare("INSERT OR IGNORE INTO ligues_semaines (sem, cree, actifs, ouvert) VALUES (?1, ?2, 0, -1)").bind(sem, now).run();
    /* Un calcul reste en plan depuis plus d'une minute : on le reprend. */
    if (!(pris.meta && pris.meta.changes === 1)) pris = await env.DB.prepare("UPDATE ligues_semaines SET cree = ?2 WHERE sem = ?1 AND ouvert = -1 AND cree < ?3").bind(sem, now, now - 60e3).run();
    if (pris.meta && pris.meta.changes === 1) await liguesBascule(env, sem);
    const l = await env.DB.prepare("SELECT ouvert, actifs FROM ligues_semaines WHERE sem = ?1").bind(sem).first();
    if (!l || l.ouvert < 0) return { sem, ouvert: false, actifs: 0 };
    liguesMemo = { sem, ouvert: l.ouvert === 1, actifs: l.actifs };
  } catch (e) {
    /* Tables absentes ou panne : ligues fermees, sans gener le reste. */
    return { sem, ouvert: false, actifs: 0, panne: true };
  }
  return liguesMemo;
}
/* Apres une synchronisation reussie : reporte les exercices de la semaine
   dans le groupe du joueur, ou le range dans un groupe s'il n'en a pas
   encore cette semaine (nouveau membre, ou retour apres une absence). */
async function liguesSuivre(env, id, now) {
  const e = await liguesEtat(env, now);
  if (!e.ouvert) return;
  /* Fiche privee : pas de ligue. */
  if (await prive(env, id)) return;
  const r = await env.DB.prepare("UPDATE ligues SET points = (SELECT sem_resolus FROM comptes WHERE id = ?1) WHERE compte_id = ?1 AND sem = ?2 AND groupe >= 0").bind(id, e.sem).run();
  if (r.meta && r.meta.changes === 1) return;
  const c = await env.DB.prepare("SELECT sem_resolus AS v FROM comptes WHERE id = ?1 AND sem = ?2").bind(id, e.sem).first();
  if (!c || c.v <= 0) return;
  const l = await env.DB.prepare("SELECT sem, ligue, mouv FROM ligues WHERE compte_id = ?1").bind(id).first();
  const ligue = l ? l.ligue : 0, mouv = l && l.sem === e.sem ? l.mouv : 0;
  const gs = (await env.DB.prepare("SELECT groupe, COUNT(*) AS n FROM ligues WHERE sem = ?1 AND ligue = ?2 AND groupe >= 0 GROUP BY groupe ORDER BY n ASC, groupe ASC").bind(e.sem, ligue).all()).results || [];
  const groupe = !gs.length ? 0 : gs[0].n < LIGUE_GROUPE_MAX ? gs[0].groupe : Math.max(...gs.map(x => x.groupe)) + 1;
  await env.DB.prepare(LIGUES_ECRIRE).bind(JSON.stringify([[id, ligue, groupe, mouv]]), e.sem, c.v).run();
}
/* GET ligue, avec session.
   Fermees : { ouvert: false, seuil, actifs }
   Ouvertes : { ouvert: true, semaine, ligue, mouv, groupe: [{ p, v }], monte, descend }
     ligue : 0 a 4 ; mouv : 1 monte, -1 descendu, 0 sinon, a l'issue de la
     semaine d'avant ; groupe : le classement de son groupe (pseudo et
     exercices de la semaine), vide tant que le joueur n'a rien reussi cette
     semaine ; monte / descend : combien de places montent et descendent. */
async function rLigue(s, env, now) {
  const e = await liguesEtat(env, now);
  if (!e.ouvert) return json({ ouvert: false, seuil: LIGUE_SEUIL, actifs: e.actifs || 0 });
  const l = await env.DB.prepare("SELECT sem, ligue, groupe, mouv FROM ligues WHERE compte_id = ?1").bind(s.id).first();
  const ici = l && l.sem === e.sem;
  let groupe = [];
  /* Un membre passe en fiche privee en cours de semaine disparait du groupe des autres. */
  if (ici && l.groupe >= 0) groupe = await avecPrive(
    "SELECT c.pseudo AS p, l.points AS v FROM ligues l JOIN comptes c ON c.id = l.compte_id WHERE l.sem = ?1 AND l.ligue = ?2 AND l.groupe = ?3 AND (c.prive = 0 OR c.id = ?4) ORDER BY l.points DESC, l.compte_id ASC LIMIT 60",
    "SELECT c.pseudo AS p, l.points AS v FROM ligues l JOIN comptes c ON c.id = l.compte_id WHERE l.sem = ?1 AND l.ligue = ?2 AND l.groupe = ?3 ORDER BY l.points DESC, l.compte_id ASC LIMIT 60",
    async sql => (await env.DB.prepare(sql).bind(e.sem, l.ligue, l.groupe, s.id).all()).results || []);
  const k = ligueMouvements(groupe.length), ligue = l ? l.ligue : 0;
  return json({ ouvert: true, semaine: e.sem, ligue, mouv: ici ? l.mouv : 0, groupe, monte: ligue < LIGUES - 1 ? k : 0, descend: ligue > 0 ? k : 0 });
}

/* ---------- Profil public d'un membre (2026-11-18) ---------- */
/* GET /api/compte/profil?p=<pseudo>, sans session :
     { p, depuis: "AAAA-MM", s, n, r, j, b, k, rangs: { s, n, r, j, b, k }, bl: [identifiants de badges], pays: "FR" ou "" }
   bl (2026-11-18) : les badges gagnes, du plus ancien au plus recent, lus dans
   la progression gardee ; seuls des identifiants simples sortent (lettres
   minuscules, chiffres, tiret bas), 400 au plus.
   Les six chiffres sont ceux des tableaux des joueurs (classement.js), avec
   le rang dans chacun : 1 + le nombre de comptes qui font strictement mieux,
   ou null si le joueur n'entre pas dans ce tableau (memes conditions que
   classement.js). C'est aussi ce qui donne son rang a un joueur au-dela des
   50 premiers. Rien d'autre ne sort : ni dates precises, ni progression.
   Une seule requete de comptage, a sous-requetes scalaires (pas de UNION :
   D1 en plafonne les termes). Garde cinq minutes dans le cache de Cloudflare,
   comme les tableaux. */
const PROFIL_RANGS = "SELECT " +
  "(SELECT COUNT(*) FROM comptes WHERE sem = ?1 AND sem_resolus > ?2) AS s, " +
  "(SELECT COUNT(*) FROM comptes WHERE resolus >= 10 AND note > ?3) AS n, " +
  "(SELECT COUNT(*) FROM comptes WHERE resolus > ?4) AS r, " +
  "(SELECT COUNT(*) FROM comptes WHERE serie > ?5) AS j, " +
  "(SELECT COUNT(*) FROM comptes WHERE badges > ?6) AS b, " +
  "(SELECT COUNT(*) FROM comptes WHERE sprint > ?7) AS k, " +
  "(SELECT COUNT(*) FROM comptes WHERE direct_v > ?8) AS d";
/* Les memes, parmi les fiches publiques (2026-11-24). */
const PROFIL_RANGS_PUBLICS = PROFIL_RANGS.replace(/FROM comptes WHERE /g, "FROM comptes WHERE prive = 0 AND ");
/* Elo entre membres d'un compte, ou null s'il n'a pas encore joue de partie
   comptee. Requete a part : la base peut ne pas avoir encore les colonnes. */
async function eloMembreLire(env, id) {
  try {
    const l = await env.DB.prepare("SELECT elo, elo_n FROM comptes WHERE id = ?1").bind(id).first();
    return l && l.elo > 0 && l.elo_n > 0 ? { r: l.elo, n: l.elo_n } : null;
  } catch (e) { return null; }
}
/* Un Elo entre membres par famille de cadences (2026-11-21 au soir) :
   { b: Blitz, r: Rapide, c: Classique, k: Correspondance }, chacun { r, n } ou
   null tant qu'aucune partie de la famille n'a compte ; null si le membre n'en
   a aucun. Une base sans les colonnes des familles ne rend que le Rapide. */
async function eloFamillesLire(env, id) {
  const un = (r, n) => (r > 0 && n > 0 ? { r, n } : null);
  let f;
  try {
    const l = await env.DB.prepare("SELECT elo, elo_n, elo_blitz, elo_blitz_n, elo_classique, elo_classique_n, elo_corr, elo_corr_n FROM comptes WHERE id = ?1").bind(id).first();
    if (!l) return null;
    f = { b: un(l.elo_blitz, l.elo_blitz_n), r: un(l.elo, l.elo_n), c: un(l.elo_classique, l.elo_classique_n), k: un(l.elo_corr, l.elo_corr_n) };
  } catch (e) { f = { b: null, r: await eloMembreLire(env, id), c: null, k: null }; }
  return f.b || f.r || f.c || f.k ? f : null;
}
/* Parties gagnees, nulles, perdues par famille de cadences (2026-11-23) :
   { b, r, c, k }, chacune [gagnees, nulles, perdues], comptees par le serveur
   des parties depuis ce jour. Requete a part : une base qui n'a pas encore
   les colonnes rend null, et la fiche ne porte alors que le total. */
async function directFamillesLire(env, id) {
  try {
    const l = await env.DB.prepare("SELECT direct_b_v, direct_b_n, direct_b_d, direct_r_v, direct_r_n, direct_r_d, direct_c_v, direct_c_n, direct_c_d, direct_k_v, direct_k_n, direct_k_d FROM comptes WHERE id = ?1").bind(id).first();
    if (!l) return null;
    const un = f => [l["direct_" + f + "_v"], l["direct_" + f + "_n"], l["direct_" + f + "_d"]];
    return { b: un("b"), r: un("r"), c: un("c"), k: un("k") };
  } catch (e) { return null; }
}
async function rProfil(request, env, now, waitUntil) {
  const v = pseudoValider(new URL(request.url).searchParams.get("p") || "");
  if (!v.ok) return erreur("inconnu", 404);
  const cache = typeof caches !== "undefined" && caches.default ? caches.default : null;
  const cle = new Request(new URL("/api/compte/profil?p=" + encodeURIComponent(v.cle), request.url).toString());
  if (cache) { const deja = await cache.match(cle); if (deja) return deja; }
  const c = await env.DB.prepare("SELECT id, pseudo, cree, note, resolus, serie, badges, sprint, sem, sem_resolus, donnees, direct_v, direct_n, direct_d FROM comptes WHERE cle = ?1").bind(v.cle).first();
  if (!c) return erreur("inconnu", 404);
  /* Fiche privee : ouverte seulement a lui et a ses amis, et jamais gardee
     dans le cache partage. */
  let secrete = false;
  if (await prive(env, c.id)) {
    const moi = await sessionLire(request, env, now);
    if (!moi || (moi.id !== c.id && !(await amiDe(env, c.id, moi.id)))) return erreur("prive", 403);
    secrete = true;
  }
  let bl = [], eo = null;
  try {
    const e = c.donnees ? eloOrdiPropre((JSON.parse(c.donnees).progress || {}).eloOrdi) : null;
    if (e) eo = { r: e.r, n: e.n };
  } catch (e) {}
  try {
    const liste = c.donnees ? (JSON.parse(c.donnees).progress || {}).badges : null;
    if (Array.isArray(liste)) bl = Array.from(new Set(liste.filter(x => typeof x === "string" && /^[a-z0-9_]{2,40}$/.test(x)))).slice(-400);
  } catch (e) {}
  const semaine = lundi(now), s = c.sem === semaine ? c.sem_resolus : 0;
  /* Les rangs se comptent parmi les fiches publiques, comme les tableaux. */
  const g = await avecPrive(PROFIL_RANGS_PUBLICS, PROFIL_RANGS,
    sql => env.DB.prepare(sql).bind(semaine, s, c.note, c.resolus, c.serie, c.badges, c.sprint, c.direct_v).first());
  const rang = (dedans, devant) => dedans ? devant + 1 : null;
  const ef = await eloFamillesLire(env, c.id), df = await directFamillesLire(env, c.id);
  const rep = json({
    p: c.pseudo, depuis: new Date(c.cree).toISOString().slice(0, 7),
    s, n: c.note, r: c.resolus, j: c.serie, b: c.badges, k: c.sprint, d: c.direct_v,
    /* Parties en direct : gagnees, nulles, perdues, comptees par le serveur des
       parties ; f : les memes par famille de cadences (depuis le 2026-11-23). */
    dir: Object.assign({ v: c.direct_v, n: c.direct_n, d: c.direct_d }, df ? { f: df } : {}),
    rangs: { s: rang(s > 0, g.s), n: rang(c.resolus >= 10, g.n), r: rang(c.resolus > 0, g.r), j: rang(c.serie > 0, g.j), b: rang(c.badges > 0, g.b), k: rang(c.sprint > 0, g.k), d: rang(c.direct_v > 0, g.d) },
    /* Elo contre l'ordinateur : declare par le navigateur du joueur, non verifie. */
    eo,
    /* Elo entre membres : calcule par le serveur des parties, donc verifie. */
    em: ef ? ef.r : null,
    /* Depuis l'Elo par famille : les quatre. em reste le Rapide, pour une
       page ouverte avant la mise a jour. */
    ef,
    bl, pays: await paysLire(env, c.id),
    /* Pour lui et ses amis : la fiche est privee (cle absente d'une fiche publique). */
    ...(secrete ? { prive: 1 } : {})
  }, 200, secrete ? {} : { "Cache-Control": "public, max-age=60, s-maxage=300" });
  if (cache && waitUntil && !secrete) waitUntil(cache.put(cle, rep.clone()));
  return rep;
}

export async function onRequest({ request, env, params, waitUntil }) {
  try {
    if (!env.DB) return erreur("indisponible", 503);
    const route = [].concat(params && params.route || []).join("/"), m = request.method, now = Date.now();
    const ecriture = m !== "GET" && m !== "HEAD";
    if (ecriture && !memeOrigine(request)) return erreur("origine", 403);

    /* Sans session. */
    if (m === "POST" && ["pseudo", "creer", "connexion", "secours", "lien-connexion"].includes(route)) {
      const d = await corps(request);
      if (!d) return erreur("requete", 400);
      if (route === "pseudo") return await rPseudo(d, env, now, request);
      if (route === "creer") return await rCreer(d, env, now, request);
      if (route === "connexion") return await rConnexion(d, env, now, request);
      if (route === "secours") return await rSecours(d, env, now, request);
      return await rLienConnexion(d, env, now);
    }
    if (m === "GET" && route === "profil") return await rProfil(request, env, now, waitUntil);
    if (m === "POST" && route === "deconnexion") {
      const jeton = cookieLire(request);
      if (jeton) await env.DB.prepare("DELETE FROM jetons WHERE hash = ?1").bind(await sha256(jeton)).run();
      return json({ ok: true }, 200, cookieOter());
    }

    /* Avec session. */
    const connues = { GET: ["etat", "synchro", "exporter", "defis", "enquete", "amis", "membres", "ligue"], PUT: ["synchro"], POST: ["pays", "prive", "ami-ajouter", "ami-retirer", "ami-accepter", "ami-refuser", "supprimer", "code", "secours-nouveau", "lien", "defi-envoyer", "defi-repondre", "defi-supprimer", "defi-bloquer", "defi-debloquer", "pseudo-changer", "enquete"] };
    if (!(connues[m] || []).includes(route)) return erreur("inconnu", 404);
    const s = await sessionLire(request, env, now);
    if (!s) return erreur("session", 401, null);
    if (m === "GET") {
      if (route === "etat") return json({ pseudo: s.pseudo, version: s.version, cree: s.cree, pays: await paysLire(env, s.id), prive: (await prive(env, s.id)) ? 1 : 0 });
      if (route === "synchro") return await rSynchroLire(s, env);
      if (route === "defis") return await rDefis(s, env);
      if (route === "enquete") return await rEnqueteLire(s, env, now);
      if (route === "amis") return await rAmis(s, env, now);
      if (route === "ligue") return await rLigue(s, env, now);
      if (route === "membres") return await rMembres(s, request, env);
      return await rExporter(s, env);
    }
    const d = await corps(request);
    if (!d) return erreur("requete", 400);
    if (route === "synchro") return await rSynchroEcrire(s, d, env, now);
    if (route === "supprimer") return await rSupprimer(s, d, env, now, request);
    if (route === "code") return await rCode(s, d, env, now, request);
    if (route === "secours-nouveau") return await rSecoursNouveau(s, d, env, now, request);
    if (route === "pseudo-changer") return await rPseudoChanger(s, d, env, now, request);
    if (route === "enquete") return await rEnqueteEcrire(s, d, env, now);
    if (route === "defi-envoyer") return await rDefiEnvoyer(s, d, env, now);
    if (route === "defi-repondre") return await rDefiRepondre(s, d, env, now);
    if (route === "defi-supprimer") return await rDefiSupprimer(s, d, env);
    if (route === "defi-bloquer") return await rDefiBloquer(s, d, env, now);
    if (route === "defi-debloquer") return await rDefiDebloquer(s, d, env);
    if (route === "pays") return await rPays(s, d, env);
    if (route === "prive") return await rPrive(s, d, env);
    if (route === "ami-ajouter") return await rAmiAjouter(s, d, env, now);
    if (route === "ami-retirer") return await rAmiRetirer(s, d, env);
    if (route === "ami-accepter") return await rAmiAccepter(s, d, env, now);
    if (route === "ami-refuser") return await rAmiRefuser(s, d, env);
    return await rLien(s, env, now);
  } catch (e) {
    /* Jamais de detail d'erreur dans la reponse. */
    return erreur("serveur", 500);
  }
}

/* Pour les tests seulement : Pages ne fait de route que de onRequest*. */
export const _essai = { eloOrdiPropre, CREATIONS_PAR_HEURE, CREATIONS_SOUS_PRESSION, ESSAIS_COMPTE_JOUR, ESSAIS_CODE, PSEUDO_RESERVE, liguesCalculer, liguesRepartir, liguesOublier: () => { liguesMemo = { sem: "" }; }, LIGUE_SEUIL, CREATIONS_PAR_ADRESSE, COMPTES_PAR_APPAREIL, APPAREIL_DUREE, pseudoValider, nettoyer, lundi, chiffres, secoursNormaliser, codeHacher, codeComparer, egal, INACTIF, DUREE_JETON, DUREE_LIEN, BLOCAGE, CREATIONS_PAR_HEURE, TAILLE_MAX };
