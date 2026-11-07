/* chang64 - anciennes pages d'exercices numerotees, version francaise
 * (/fr/exercices/53-prise-gagnante.html -> /fr/exercices/prise-gagnante),
 * voir functions/puzzles/[page].js.
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE */
export function onRequest({ request, params, next }) {
  const m = /^\d+-([a-z][a-z-]*)(?:\.html)?$/.exec(params.page || "");
  if (!m) return next();
  return Response.redirect(new URL("/fr/exercices/" + m[1], request.url).toString(), 301);
}
