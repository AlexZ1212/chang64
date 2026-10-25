/* chang64 - mesure de la difficulte reelle des exercices (2026-10-25)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Recoit {id:"p123", ok:0|1} quand un joueur termine (ok:1, reussi du
 * premier coup) ou rate (ok:0) un exercice, et incremente deux compteurs
 * pour cet exercice dans la base D1 liee au projet sous le nom DB. Rien
 * d'autre n'est lu ni garde : ni adresse IP, ni date, ni en-tete, ni lien
 * entre deux envois. La page Confidentialite du site le decrit.
 *
 * Table (creee une fois depuis la console D1) :
 *   CREATE TABLE resultats (id TEXT PRIMARY KEY,
 *     essais INTEGER NOT NULL DEFAULT 0, reussites INTEGER NOT NULL DEFAULT 0);
 *
 * Fonction Pages Functions : ce fichier est copie dans chang64-site/functions
 * par build_site.js, et _routes.json limite les fonctions a /api/*. */
export async function onRequestPost({ request, env }) {
  const texte = await request.text();
  /* Un envoi legitime fait une trentaine d'octets. */
  if (texte.length > 200) return new Response(null, { status: 413 });
  let d;
  try { d = JSON.parse(texte); } catch (e) { return new Response(null, { status: 400 }); }
  const id = d && typeof d.id === "string" ? d.id : "";
  if (!/^p\d{1,7}$/.test(id) || (d.ok !== 0 && d.ok !== 1)) return new Response(null, { status: 400 });
  if (!env.DB) return new Response(null, { status: 503 });
  await env.DB.prepare(
    "INSERT INTO resultats (id, essais, reussites) VALUES (?1, 1, ?2) " +
    "ON CONFLICT(id) DO UPDATE SET essais = essais + 1, reussites = reussites + ?2"
  ).bind(id, d.ok).run();
  return new Response(null, { status: 204 });
}
