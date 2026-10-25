/* chang64 - compteurs de la mesure de difficulte (2026-10-25)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Rend { "p123": [essais, reussites], ... } pour les exercices joues, lu par
 * difficulte_reelle.js au moment de recalibrer. Ce sont des compteurs
 * anonymes, publics sans dommage.
 *
 * La reponse est gardee un jour dans le cache de Cloudflare : lire toute la
 * table coute une ligne lue par exercice joue, et le quota gratuit de D1 est
 * de 5 millions de lignes lues par jour. Sans ce cache, quelques dizaines
 * d'appels en boucle suffiraient a l'epuiser. */
export async function onRequestGet({ request, env, waitUntil }) {
  const cache = caches.default;
  const cle = new Request(new URL("/api/stats", request.url).toString());
  const deja = await cache.match(cle);
  if (deja) return deja;
  if (!env.DB) return new Response(null, { status: 503 });
  const { results } = await env.DB.prepare("SELECT id, essais, reussites FROM resultats").all();
  const out = {};
  for (const r of results || []) out[r.id] = [r.essais, r.reussites];
  const rep = new Response(JSON.stringify(out), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=86400" }
  });
  waitUntil(cache.put(cle, rep.clone()));
  return rep;
}
