/* chang64 - tableaux des joueurs (2026-11-16)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * GET /api/classement?par=semaine|note|resolus|serie|badges|sprint
 *   -> { par, semaine, joueurs: [{ p: pseudo, v: valeur }] }   (50 au plus)
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
  sprint: "SELECT pseudo AS p, sprint AS v FROM comptes WHERE sprint > 0 ORDER BY sprint DESC, vu ASC LIMIT 50"
};
function lundi(ms) {
  const d = new Date(ms);
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export async function onRequestGet({ request, env, waitUntil }) {
  const url = new URL(request.url);
  const par = url.searchParams.get("par") || "semaine";
  if (!Object.prototype.hasOwnProperty.call(TABLEAUX, par)) return new Response(null, { status: 400 });
  const cache = typeof caches !== "undefined" && caches.default ? caches.default : null;
  const cle = new Request(new URL("/api/classement?par=" + par, request.url).toString());
  if (cache) { const deja = await cache.match(cle); if (deja) return deja; }
  if (!env.DB) return new Response(null, { status: 503 });
  const semaine = lundi(Date.now());
  const st = env.DB.prepare(TABLEAUX[par]);
  const { results } = await (par === "semaine" ? st.bind(semaine) : st).all();
  const rep = new Response(JSON.stringify({ par, semaine, joueurs: (results || []).map(r => ({ p: r.p, v: r.v })) }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60, s-maxage=300" }
  });
  if (cache && waitUntil) waitUntil(cache.put(cle, rep.clone()));
  return rep;
}
