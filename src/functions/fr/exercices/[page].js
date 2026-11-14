/* chang64 - anciennes pages d'exercices numerotees, version francaise
 * (/fr/exercices/53-prise-gagnante.html -> /fr/exercices/prise-gagnante),
 * voir functions/puzzles/[page].js, y compris pour les adresses a "g" et les
 * themes disparus (2026-11-14).
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE */
const DOSSIER = "/fr/exercices/";
export async function onRequest({ request, params, next, env }) {
  const m = /^g?\d+-([a-z][a-z-]*)(?:\.html)?$/.exec(params.page || "");
  if (!m) return next();
  let cible = new URL(DOSSIER + m[1], request.url);
  try {
    const r = await env.ASSETS.fetch(new Request(cible.toString()));
    if (r.status === 404) cible = new URL(DOSSIER, request.url);
  } catch (e) { /* en cas de doute, la page du theme */ }
  return Response.redirect(cible.toString(), 301);
}
