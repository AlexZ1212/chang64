/* chang64 - signaler un exercice (2026-11-24)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Recoit {exo:"p123", raison:"solution"|"meilleur"|"explication"|"autre"}
 * quand un joueur signale un exercice, une fois celui-ci fini (signaler.js),
 * et incremente un compteur par exercice, raison et jour (UTC) dans la base
 * D1 liee au projet sous le nom DB. Rien d'autre n'est lu ni garde : ni
 * adresse IP, ni en-tete, ni compte, ni lien entre deux signalements. La page
 * Confidentialite du site le decrit. Choix d'Alexandre par QCM du 24/11 :
 * « Une petite table », SQL accepte tel quel (affiche dans la question) :
 *   CREATE TABLE IF NOT EXISTS signalements (exo TEXT NOT NULL,
 *     raison TEXT NOT NULL, jour TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 1,
 *     PRIMARY KEY (exo, raison, jour));
 *
 * Garde-fou : au plus SIGNALEMENTS_JOUR lignes nouvelles par jour. Au-dela,
 * un nouveau couple exercice + raison est refuse (429) ; un couple deja la
 * continue de compter. La table ne peut donc pas grossir sans fin.
 *
 * Fonction Pages Functions : ce fichier est copie dans chang64-site/functions
 * par build_site.js, et _routes.json limite les fonctions a /api/*. */
const RAISONS = ["solution", "meilleur", "explication", "autre"];
const SIGNALEMENTS_JOUR = 2000;
const vide = status => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

export async function onRequestPost({ request, env }) {
  /* Une page d'un autre site ne peut pas signaler a la place du joueur. */
  const o = request.headers.get("Origin");
  if (o) { try { if (new URL(o).host !== new URL(request.url).host) return vide(403); } catch (e) { return vide(403); } }
  const texte = await request.text();
  /* Un envoi legitime fait une quarantaine d'octets. */
  if (texte.length > 200) return vide(413);
  let d;
  try { d = JSON.parse(texte); } catch (e) { return vide(400); }
  const exo = d && typeof d.exo === "string" ? d.exo : "", raison = d && typeof d.raison === "string" ? d.raison : "";
  if (!/^p\d{1,7}$/.test(exo) || !RAISONS.includes(raison)) return vide(400);
  if (!env.DB) return vide(503);
  const jour = new Date().toISOString().slice(0, 10);
  const deja = await env.DB.prepare("SELECT n FROM signalements WHERE exo = ?1 AND raison = ?2 AND jour = ?3").bind(exo, raison, jour).first();
  if (deja) {
    await env.DB.prepare("UPDATE signalements SET n = n + 1 WHERE exo = ?1 AND raison = ?2 AND jour = ?3").bind(exo, raison, jour).run();
    return vide(204);
  }
  const c = await env.DB.prepare("SELECT COUNT(*) AS c FROM signalements WHERE jour = ?1").bind(jour).first();
  if (c && c.c >= SIGNALEMENTS_JOUR) return vide(429);
  await env.DB.prepare(
    "INSERT INTO signalements (exo, raison, jour, n) VALUES (?1, ?2, ?3, 1) " +
    "ON CONFLICT(exo, raison, jour) DO UPDATE SET n = n + 1"
  ).bind(exo, raison, jour).run();
  return vide(204);
}
