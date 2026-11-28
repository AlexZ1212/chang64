/* chang64 - tableaux des joueurs (2026-11-16)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * GET /api/classement?par=semaine|note|resolus|serie|badges|sprint|direct|duels
 *   -> { par, semaine, joueurs: [{ p: pseudo, v: valeur }] }   (50 au plus)
 * GET /api/classement?par=tout
 *   -> { par, semaine, joueurs: [{ p, s, n, r, j, b, k }] }
 *      les joueurs presents dans au moins un des six tableaux (300 au plus),
 *      avec leurs six chiffres : semaine, note, resolus, jours, badges,
 *      sprint. Pour le tableau complet, triable, de l'ecran en paysage.
 *
 * Seuls le pseudo et le chiffre demande sortent : c'est ce que la page
 * Confidentialite annonce a qui cree un compte. Les chiffres viennent de la
 * progression envoyee par les navigateurs (colonnes de la table comptes,
 * voir compte/[[route]].js) : ils sont bornes, pas verifies.
 *
 * "semaine" compte les exercices reussis depuis lundi (UTC), calcules par le
 * serveur a chaque synchronisation ; les autres tableaux sont des totaux.
 *
 * Chaque tableau est garde cinq minutes dans le cache de Cloudflare : sans
 * cela, une boucle d'appels lirait la table entiere a chaque fois et
 * epuiserait le quota gratuit de D1. */
const TABLEAUX = {
  semaine: "SELECT pseudo AS p, sem_resolus AS v FROM comptes WHERE sem = ?1 AND sem_resolus > 0 ORDER BY sem_resolus DESC, vu ASC LIMIT 50",
  note: "SELECT pseudo AS p, note AS v FROM comptes WHERE resolus >= 10 ORDER BY note DESC, vu ASC LIMIT 50",
  resolus: "SELECT pseudo AS p, resolus AS v FROM comptes WHERE resolus > 0 ORDER BY resolus DESC, vu ASC LIMIT 50",
  serie: "SELECT pseudo AS p, serie AS v FROM comptes WHERE serie > 0 ORDER BY serie DESC, vu ASC LIMIT 50",
  badges: "SELECT pseudo AS p, badges AS v FROM comptes WHERE badges > 0 ORDER BY badges DESC, vu ASC LIMIT 50",
  sprint: "SELECT pseudo AS p, sprint AS v FROM comptes WHERE sprint > 0 ORDER BY sprint DESC, vu ASC LIMIT 50",
  /* Parties en direct gagnees (2026-11-19) : le seul chiffre compte par le
     serveur lui-meme (Worker des parties), et non declare par le navigateur. */
  direct: "SELECT pseudo AS p, direct_v AS v FROM comptes WHERE direct_v > 0 ORDER BY direct_v DESC, vu ASC LIMIT 50",
  /* Duels d'exercices gagnes (2026-11-27), comptes par le serveur quand le
     destinataire d'un duel repond (compte/[[route]].js, duelCompter). */
  duels: "SELECT pseudo AS p, duel_v AS v FROM comptes WHERE duel_v > 0 ORDER BY duel_v DESC, vu ASC LIMIT 50"
};
/* Les six tableaux reunis : memes conditions et memes plafonds que chacun.
   Six sous-requetes reliees par OR, et non un UNION : D1 plafonne le nombre
   de termes d'une requete composee, et la version en UNION, qui passait sur
   SQLite en local, plantait en production (erreur 1101, 2026-11-18). */
const TOUT = "SELECT pseudo AS p, CASE WHEN sem = ?1 THEN sem_resolus ELSE 0 END AS s, note AS n, resolus AS r, serie AS j, badges AS b, sprint AS k, direct_v AS d FROM comptes WHERE " +
  "id IN (SELECT id FROM comptes WHERE sem = ?1 AND sem_resolus > 0 ORDER BY sem_resolus DESC, vu ASC LIMIT 50) OR " +
  "id IN (SELECT id FROM comptes WHERE resolus >= 10 ORDER BY note DESC, vu ASC LIMIT 50) OR " +
  "id IN (SELECT id FROM comptes WHERE resolus > 0 ORDER BY resolus DESC, vu ASC LIMIT 50) OR " +
  "id IN (SELECT id FROM comptes WHERE serie > 0 ORDER BY serie DESC, vu ASC LIMIT 50) OR " +
  "id IN (SELECT id FROM comptes WHERE badges > 0 ORDER BY badges DESC, vu ASC LIMIT 50) OR " +
  "id IN (SELECT id FROM comptes WHERE sprint > 0 ORDER BY sprint DESC, vu ASC LIMIT 50) OR " +
  "id IN (SELECT id FROM comptes WHERE direct_v > 0 ORDER BY direct_v DESC, vu ASC LIMIT 50) ORDER BY resolus DESC, vu ASC";
/* Avec les duels (2026-11-27) : une colonne u et un huitieme tableau. Une
   base qui n'a pas encore la colonne duel_v repond avec TOUT. */
const TOUT_DUELS = TOUT.replace("direct_v AS d FROM", "direct_v AS d, duel_v AS u FROM")
  .replace(" ORDER BY resolus DESC, vu ASC", " OR id IN (SELECT id FROM comptes WHERE duel_v > 0 ORDER BY duel_v DESC, vu ASC LIMIT 50) ORDER BY resolus DESC, vu ASC");
/* Chaque « FROM comptes WHERE » ne garde que les fiches publiques. */
const publics = sql => sql.replace(/FROM comptes WHERE /g, "FROM comptes WHERE prive = 0 AND ");
function lundi(ms) {
  const d = new Date(ms);
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export async function onRequestGet({ request, env, waitUntil }) {
  const url = new URL(request.url);
  const par = url.searchParams.get("par") || "semaine";
  if (par !== "tout" && !Object.prototype.hasOwnProperty.call(TABLEAUX, par)) return new Response(null, { status: 400 });
  const cache = typeof caches !== "undefined" && caches.default ? caches.default : null;
  const cle = new Request(new URL("/api/classement?par=" + par, request.url).toString());
  if (cache) { const deja = await cache.match(cle); if (deja) return deja; }
  if (!env.DB) return new Response(null, { status: 503 });
  const semaine = lundi(Date.now());
  let results;
  try {
    /* Fiche privee (2026-11-24) : absente des tableaux. Une base qui n'a
       pas encore la colonne prive repond avec la requete d'avant. */
    const lire = async sql => { const st = env.DB.prepare(sql); return (await (par === "semaine" || par === "tout" ? st.bind(semaine) : st).all()).results; };
    const sql = par === "tout" ? TOUT_DUELS : TABLEAUX[par];
    try { results = await lire(publics(sql)); } catch (e) {
      try { results = await lire(sql); } catch (e2) {
        /* Colonne duel_v absente : le tableau des duels est vide, le grand
           tableau se lit sans eux. */
        if (par === "duels") results = [];
        else if (par === "tout") { try { results = await lire(publics(TOUT)); } catch (e3) { results = await lire(TOUT); } }
        else throw e2;
      }
    }
  } catch (e) {
    /* Une panne de la base ne doit pas devenir une page d'erreur de Cloudflare. */
    return new Response(JSON.stringify({ erreur: "serveur" }), { status: 500, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  }
  const joueurs = (results || []).map(r => par === "tout" ? { p: r.p, s: r.s, n: r.n, r: r.r, j: r.j, b: r.b, k: r.k, d: r.d, u: r.u || 0 } : { p: r.p, v: r.v });
  const rep = new Response(JSON.stringify({ par, semaine, joueurs }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60, s-maxage=300" }
  });
  if (cache && waitUntil) waitUntil(cache.put(cle, rep.clone()));
  return rep;
}
