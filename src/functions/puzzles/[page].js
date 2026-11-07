/* chang64 - anciennes pages d'exercices numerotees (2026-11-07)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Jusqu'au 2026-09-02, chaque exercice avait sa page : /puzzles/903-mate-in-two.html.
 * La fusion de la banque les a supprimees, et Google en signalait plus de
 * 2 000 en 404. On renvoie chacune, en 301, vers la page de son theme
 * (/puzzles/mate-in-two), qui existe toujours. Toute autre adresse continue
 * vers les fichiers statiques, donc vers la 404.
 *
 * _routes.json n'envoie ici que les adresses de ce dossier qui ne sont pas
 * des pages existantes : les pages de theme restent servies sans fonction.
 * Meme code dans functions/fr/exercices/[page].js : un fichier commun dans
 * functions/ deviendrait lui-meme une route. */
export function onRequest({ request, params, next }) {
  const m = /^\d+-([a-z][a-z-]*)(?:\.html)?$/.exec(params.page || "");
  if (!m) return next();
  return Response.redirect(new URL("/puzzles/" + m[1], request.url).toString(), 301);
}
