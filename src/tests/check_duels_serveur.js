/* Verification automatique de chang64.
   Lancement : node tests/check_duels_serveur.js

   Duels gagnes, nuls, perdus (2026-11-27, points 3 et 4 du lot d'Alexandre) :
   le serveur du compte les compte quand le destinataire d'un duel repond,
   le tableau des joueurs les classe et la fiche les montre avec leur rang.
   Execute tel quel contre la base SQLite en memoire qui imite D1. Les trois
   colonnes duel_v, duel_n, duel_d sont dans le schema depuis le 28/11 (ALTER
   TABLE execute en production) ; le test verifie aussi qu'une base sans elles
   (il les retire de SA base) continue de marcher. */
const path = require("path"), { pathToFileURL } = require("url");
process.removeAllListeners("warning"); process.on("warning", () => {});
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const { fausseD1 } = require("../serveur_local.js");

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, "..", "functions", "api", "compte", "[[route]].js")).href);
  const cl = await import(pathToFileURL(path.join(__dirname, "..", "functions", "api", "classement.js")).href);
  let env;
  const code = n => Buffer.from(String(n).padStart(32, "x")).toString("base64url");
  async function appel(methode, route, corps, o) {
    o = o || {};
    const h = { Origin: "https://chang64.com" };
    if (corps !== undefined) h["Content-Type"] = "application/json";
    if (o.cookie) h.Cookie = o.cookie;
    const req = new Request("https://chang64.com/api/compte/" + route, { method: methode, headers: h, body: corps === undefined ? undefined : JSON.stringify(corps) });
    const rep = await mod.onRequest({ request: req, env, params: { route: route.split("?")[0].split("/") } });
    const texte = await rep.text();
    let j = null; try { j = JSON.parse(texte); } catch (e) {}
    return { s: rep.status, j, texte, cookie: (rep.headers.get("Set-Cookie") || "").split(";")[0] };
  }
  const tableau = async par => JSON.parse(await (await cl.onRequestGet({ request: new Request("https://chang64.com/api/classement?par=" + par), env })).text());
  const ouvrir = async p => (await appel("POST", "creer", { pseudo: p, code: code(1) })).cookie;
  const EXOS = "000a000b000c000d000e";
  const duel = async (de, a, r1, t1, r2, t2) => {
    const e = await appel("POST", "defi-envoyer", { a: a.p, exos: EXOS, r: r1, t: t1 }, { cookie: de.c });
    return (await appel("POST", "defi-repondre", { id: e.j.id, r: r2, t: t2 }, { cookie: a.c })).s;
  };
  const compte = p => env.DB.brut.prepare("SELECT duel_v AS v, duel_n AS n, duel_d AS d FROM comptes WHERE pseudo = ?").get(p);

  console.log("\nAvec les colonnes (schema du 28/11)");
  env = { DB: fausseD1() };
  const A = { p: "Anna", c: await ouvrir("Anna") }, B = { p: "Boris", c: await ouvrir("Boris") }, C = { p: "Chloe", c: await ouvrir("Chloe") };
  T("Boris repond mieux (plus de premiers coups) : 200", await duel(A, B, "22102", 95, "22220", 120) === 200);
  T("Boris : 1 gagne ; Anna : 1 perdu", JSON.stringify(compte("Boris")) === '{"v":1,"n":0,"d":0}' && JSON.stringify(compte("Anna")) === '{"v":0,"n":0,"d":1}', JSON.stringify([compte("Anna"), compte("Boris")]));
  await duel(A, C, "22200", 60, "22200", 80);
  T("a egalite d'exercices, le plus rapide gagne (Anna)", compte("Anna").v === 1 && compte("Chloe").d === 1);
  await duel(B, C, "21100", 50, "21100", 50);
  T("meme score, meme temps : nul pour les deux", compte("Boris").n === 1 && compte("Chloe").n === 1);
  await duel(C, A, "11111", 40, "22222", 200);
  T("trouver du premier coup compte avant le temps (Anna gagne)", compte("Anna").v === 2 && compte("Chloe").d === 2);
  T("une seconde reponse au meme duel ne recompte rien", (await (async () => {
    const e = await appel("POST", "defi-envoyer", { a: "Boris", exos: EXOS, r: "00000", t: 10 }, { cookie: A.c });
    await appel("POST", "defi-repondre", { id: e.j.id, r: "22222", t: 10 }, { cookie: B.c });
    const v = compte("Boris").v;
    await appel("POST", "defi-repondre", { id: e.j.id, r: "22222", t: 10 }, { cookie: B.c });
    return compte("Boris").v === v && v === 2;
  })()));
  let t = await tableau("duels");
  T("tableau des duels gagnes : Anna 2, Boris 2, sans Chloe", t.joueurs.length === 2 && t.joueurs.every(x => x.v === 2) && !t.joueurs.some(x => x.p === "Chloe"), JSON.stringify(t.joueurs));
  t = await tableau("tout");
  T("grand tableau : la colonne u", t.joueurs.find(x => x.p === "Anna").u === 2 && t.joueurs.find(x => x.p === "Boris").u === 2 && !t.joueurs.some(x => x.p === "Chloe"), JSON.stringify(t.joueurs));
  let f = (await appel("GET", "profil?p=Anna")).j;
  T("fiche d'Anna : 2 gagnes, 0 nul, 2 perdus (Boris et le dernier), rang 1", f.u === 2 && JSON.stringify(f.du) === '{"v":2,"n":0,"d":2}' && f.rangs.u === 1, JSON.stringify([f.u, f.du, f.rangs]));
  f = (await appel("GET", "profil?p=Chloe")).j;
  T("fiche de Chloe : aucun duel gagne, pas de rang", f.u === 0 && f.rangs.u === null && f.du.d === 2, JSON.stringify([f.u, f.du, f.rangs.u]));
  env.DB.brut.exec("UPDATE comptes SET prive = 1 WHERE pseudo = 'Anna'");
  f = (await appel("GET", "profil?p=Boris")).j;
  T("une fiche privee ne compte pas dans le rang des autres", f.rangs.u === 1, JSON.stringify(f.rangs));
  T("l'export du compte porte ses duels", JSON.stringify((await appel("GET", "exporter", undefined, { cookie: B.c })).j.duels_d_exercices) === '{"gagnes":2,"nuls":1,"perdus":0}');

  console.log("\nSans les colonnes (base d'avant l'ALTER TABLE)");
  env = { DB: fausseD1() };
  for (const c of ["duel_v", "duel_n", "duel_d"]) env.DB.brut.exec("ALTER TABLE comptes DROP COLUMN " + c);
  const creerAvec = async p => (await appel("POST", "creer", { pseudo: p, code: code(2), donnees: { progress: { solved: 30, rating: 900, days: 2, badges: [], rushBest: 0 } } })).cookie;
  const A2 = { p: "Anna", c: await creerAvec("Anna") }, B2 = { p: "Boris", c: await creerAvec("Boris") };
  T("repondre a un duel marche encore", await duel(A2, B2, "22102", 95, "22220", 120) === 200);
  T("tableau des duels : vide, sans erreur", (await tableau("duels")).joueurs.length === 0);
  t = await tableau("tout");
  T("grand tableau : lu sans les duels", t.joueurs.length === 2 && t.joueurs.every(x => x.u === 0), JSON.stringify(t));
  f = (await appel("GET", "profil?p=Anna")).j;
  T("fiche : sans duels, sans rang, sans erreur", f && f.u === 0 && f.du === null && f.rangs.u === null, JSON.stringify(f && [f.u, f.du]));
  T("export : duels a null", (await appel("GET", "exporter", undefined, { cookie: A2.c })).j.duels_d_exercices === null);

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
