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
 * 2026-11-14 : la Search Console a refuse la correction le 10/11. Il restait
 * les adresses a "g" (/puzzles/g691-pin), d'une version plus ancienne, et des
 * themes qui n'ont plus de page (mat-etouffe, attaque-a-distance) : ceux-la
 * vont a la liste des themes plutot qu'a une 404.
 *
 * _routes.json n'envoie ici que les adresses de ce dossier qui ne sont pas
 * des pages existantes : les pages de theme restent servies sans fonction.
 * Meme code dans functions/fr/exercices/[page].js : un fichier commun dans
 * functions/ deviendrait lui-meme une route. */
const DOSSIER = "/puzzles/";
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
