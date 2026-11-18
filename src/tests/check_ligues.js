/* Verification automatique de chang64.
   Lancement : node tests/check_ligues.js

   Ce que ce test garde (2026-11-18) : les ligues du compte
   (functions/api/compte/[[route]].js), executees contre une base SQLite en
   memoire qui imite D1. Fermees sous 50 membres actifs ; ouverture le lundi
   qui suit ; groupes d'environ 20 ; les 5 premiers montent, les 5 derniers
   descendent ; qui n'a rien fait descend et sort des groupes ; un nouveau
   membre est range en cours de semaine ; rien ne casse sans les tables. */
const path = require("path"), { pathToFileURL } = require("url");
process.removeAllListeners("warning"); process.on("warning", () => {});

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };

const { fausseD1 } = require("../serveur_local.js");
const VRAI_NOW = Date.now;
/* Depart un mercredi a midi (UTC), pour rester loin des bords de semaine. */
let decalage = Date.UTC(2027, 0, 6, 12) - VRAI_NOW();
Date.now = () => VRAI_NOW() + decalage;
const SEMAINE = 7 * 864e5;

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, "..", "functions", "api", "compte", "[[route]].js")).href);
  const E = mod._essai;
  let env = { DB: fausseD1() };
  const lignes = (sql, ...a) => env.DB.brut.prepare(sql).all(...a);
  const code = n => Buffer.from(String(n).padStart(32, "x")).toString("base64url");
  async function appel(methode, route, corps, cookie) {
    const h = { Origin: "https://chang64.com" };
    if (corps !== undefined) h["Content-Type"] = "application/json";
    if (cookie) h.Cookie = cookie;
    const req = new Request("https://chang64.com/api/compte/" + route, { method: methode, headers: h, body: corps === undefined ? undefined : JSON.stringify(corps) });
    const rep = await mod.onRequest({ request: req, env, params: { route: route.split("/") } });
    const texte = await rep.text();
    let j = null; try { j = JSON.parse(texte); } catch (e) {}
    return { s: rep.status, j, texte, cookie: (rep.headers.get("Set-Cookie") || "").split(";")[0] };
  }
  /* Un membre : son cookie, sa version, son total d'exercices. */
  const membres = {};
  async function creer(pseudo) {
    /* Le plafond de creations par connexion ne regarde pas ce test. */
    env.DB.brut.exec("DELETE FROM creations");
    const r = await appel("POST", "creer", { pseudo, code: code(pseudo), donnees: { progress: { solved: 0 } } });
    if (r.s !== 201) throw new Error("creation de " + pseudo + " : " + r.texte);
    membres[pseudo] = { cookie: r.cookie, version: r.j.version, total: 0 };
  }
  /* Le membre reussit n exercices de plus, puis synchronise. */
  async function joue(pseudo, n) {
    const m = membres[pseudo];
    m.total += n;
    const r = await appel("PUT", "synchro", { version: m.version, donnees: { progress: { solved: m.total } } }, m.cookie);
    if (r.s !== 200) throw new Error("synchro de " + pseudo + " : " + r.texte);
    m.version = r.j.version;
  }
  const ligue = async pseudo => (await appel("GET", "ligue", undefined, membres[pseudo].cookie)).j;
  const ligne = pseudo => lignes("SELECT l.* FROM ligues l JOIN comptes c ON c.id = l.compte_id WHERE c.pseudo = ?", pseudo)[0];
  const semaineSuivante = () => { decalage += SEMAINE; };

  console.log("\nCalcul d'une fin de semaine");
  {
    const g = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, ligue: 1, groupe: 0, points: 40 - i }));
    const r = E.liguesCalculer(g), par = id => r.find(x => x[0] === id);
    T("les 5 premiers montent", [1, 2, 3, 4, 5].every(id => par(id)[1] === 2 && par(id)[3] === 1));
    T("le 6e reste", par(6)[1] === 1 && par(6)[3] === 0);
    T("les 5 derniers descendent", [16, 17, 18, 19, 20].every(id => par(id)[1] === 0 && par(id)[3] === -1));
    T("le 15e reste", par(15)[1] === 1 && par(15)[3] === 0);
    const haut = E.liguesCalculer(g.map(j => Object.assign({}, j, { ligue: 4 })));
    T("en ligue Dame, personne ne monte plus haut", haut.every(x => x[1] <= 4) && haut.find(x => x[0] === 1)[1] === 4 && haut.find(x => x[0] === 1)[3] === 0);
    const bas = E.liguesCalculer(g.map(j => Object.assign({}, j, { ligue: 0 })));
    T("en ligue Pion, personne ne descend", bas.every(x => x[1] >= 0) && bas.find(x => x[0] === 20)[1] === 0 && bas.find(x => x[0] === 20)[3] === 0);
    const petit = E.liguesCalculer(Array.from({ length: 7 }, (_, i) => ({ id: i + 1, ligue: 2, groupe: 0, points: 10 - i })));
    T("petit groupe de 7 : 2 montent, 2 descendent", petit.filter(x => x[3] === 1).length === 2 && petit.filter(x => x[3] === -1).length === 2);
    const zero = E.liguesCalculer([{ id: 1, ligue: 2, groupe: 0, points: 0 }, { id: 2, ligue: 2, groupe: 0, points: 3 }, { id: 3, ligue: 2, groupe: 0, points: 2 }, { id: 4, ligue: 2, groupe: 0, points: 1 }]);
    T("qui n'a rien fait descend et sort des groupes", zero.find(x => x[0] === 1).join() === "1,1,-1,-1", JSON.stringify(zero));
    T("personne ne monte avec zero exercice", E.liguesCalculer([{ id: 1, ligue: 0, groupe: 0, points: 0 }, { id: 2, ligue: 0, groupe: 0, points: 0 }, { id: 3, ligue: 0, groupe: 0, points: 0 }]).every(x => x[1] === 0));
    const tailles = n => { const r = E.liguesRepartir(Array.from({ length: n }, (_, i) => ({ id: i + 1, ligue: 0, points: n - i }))), c = {}; r.forEach(x => { c[x[2]] = (c[x[2]] || 0) + 1; }); return Object.values(c); };
    T("50 joueurs : groupes de 16 a 17 (3 groupes)", tailles(50).length === 3 && tailles(50).every(t => t >= 16 && t <= 17), tailles(50).join());
    T("130 joueurs : groupes de 18 a 19", tailles(130).every(t => t >= 18 && t <= 19), tailles(130).join());
    T("29 joueurs : un seul groupe ; 31 : deux", tailles(29).length === 1 && tailles(31).length === 2);
    const rr = E.liguesRepartir(Array.from({ length: 40 }, (_, i) => ({ id: i + 1, ligue: 0, points: 40 - i })));
    T("les plus actifs sont ensemble", rr.filter(x => x[0] <= 20).every(x => x[2] === 0) && rr.filter(x => x[0] > 20).every(x => x[2] === 1));
  }

  console.log("\nAvant l'ouverture");
  E.liguesOublier();
  const noms = Array.from({ length: 52 }, (_, i) => "Joueur" + String(i + 1).padStart(2, "0"));
  for (const n of noms.slice(0, 10)) await creer(n);
  for (let i = 0; i < 10; i++) await joue(noms[i], i + 1);
  let r = await ligue(noms[0]);
  T("sans session : refuse", (await appel("GET", "ligue")).s === 401);
  T("fermees sous le seuil, seuil annonce", r.ouvert === false && r.seuil === 50, JSON.stringify(r));
  T("rien d'ecrit dans la table ligues", lignes("SELECT COUNT(*) AS n FROM ligues")[0].n === 0);
  T("la semaine est notee une seule fois", lignes("SELECT COUNT(*) AS n FROM ligues_semaines")[0].n === 1);
  semaineSuivante(); E.liguesOublier();
  r = await ligue(noms[0]);
  T("semaine suivante, 10 actifs : toujours fermees, 10 comptes", r.ouvert === false && r.actifs === 10, JSON.stringify(r));

  console.log("\nOuverture a 50 membres actifs");
  for (const n of noms.slice(10)) await creer(n);
  /* Joueur01 est le plus actif (52 exercices), Joueur52 le moins (1). */
  for (let i = 0; i < 52; i++) await joue(noms[i], 52 - i);
  T("pas d'ouverture en cours de semaine", (await ligue(noms[0])).ouvert === false);
  semaineSuivante(); E.liguesOublier();
  r = await ligue(noms[0]);
  T("le lundi suivant : ouvertes", r.ouvert === true && r.ligue === 0 && r.mouv === 0, JSON.stringify(r).slice(0, 200));
  T("52 membres ranges, tous en ligue Pion", lignes("SELECT COUNT(*) AS n FROM ligues WHERE ligue = 0 AND groupe >= 0")[0].n === 52);
  const taillesG = lignes("SELECT groupe, COUNT(*) AS n FROM ligues GROUP BY groupe ORDER BY groupe").map(x => x.n);
  T("3 groupes de 17 ou 18", taillesG.length === 3 && taillesG.every(n => n === 17 || n === 18), taillesG.join());
  T("le groupe du joueur : pseudo et exercices, rien d'autre", r.groupe.length === taillesG[0] && r.groupe.every(x => Object.keys(x).join() === "p,v") && r.groupe.every(x => x.v === 0), JSON.stringify(r.groupe.slice(0, 3)));
  T("5 places montent, aucune ne descend en ligue Pion", r.monte === 5 && r.descend === 0);
  T("les plus actifs de la semaine d'avant sont ensemble", ligne(noms[0]).groupe === 0 && ligne(noms[51]).groupe === 2);
  T("deux appels : un seul changement de semaine", lignes("SELECT COUNT(*) AS n FROM ligues_semaines WHERE ouvert = 1")[0].n === 1);

  console.log("\nUne semaine de ligue");
  /* Groupe 0 = Joueur01 a Joueur18. Joueur18 fait le plus, Joueur01 rien. */
  const g0 = noms.filter(n => ligne(n).groupe === 0), g2 = noms.filter(n => ligne(n).groupe === 2);
  for (let i = 1; i < g0.length; i++) await joue(g0[i], i * 2);
  r = await ligue(g0[5]);
  T("le classement du groupe suit les exercices de la semaine", r.groupe[0].p === g0[g0.length - 1] && r.groupe[0].v === (g0.length - 1) * 2 && r.groupe[r.groupe.length - 1].p === g0[0], JSON.stringify(r.groupe.slice(0, 2)));
  for (const n of g2) await joue(n, 3);
  /* Un nouveau membre arrive en cours de semaine. */
  await creer("Nouvelle");
  r = await ligue("Nouvelle");
  T("nouveau membre sans exercice : pas encore de groupe", r.ouvert === true && r.groupe.length === 0 && !ligne("Nouvelle"));
  await joue("Nouvelle", 4);
  r = await ligue("Nouvelle");
  T("au premier exercice : range dans un groupe de la ligue Pion", ligne("Nouvelle").ligue === 0 && ligne("Nouvelle").groupe >= 0 && r.groupe.some(x => x.p === "Nouvelle" && x.v === 4), JSON.stringify(ligne("Nouvelle")));
  T("dans le groupe le moins rempli", ligne("Nouvelle").groupe === taillesG.indexOf(Math.min(...taillesG)));

  semaineSuivante(); E.liguesOublier();
  r = await ligue(g0[g0.length - 1]);
  T("le premier du groupe monte en ligue Cavalier", r.ligue === 1 && r.mouv === 1, JSON.stringify(r).slice(0, 120));
  T("5 montent dans ce groupe", g0.filter(n => ligne(n).ligue === 1).length === 5);
  T("celui qui n'a rien fait reste en Pion, hors groupe", ligne(g0[0]).ligue === 0 && ligne(g0[0]).groupe === -1);
  T("un groupe ou tout le monde est a egalite : 5 montent quand meme", g2.filter(n => ligne(n).ligue === 1).length === 5);
  T("les exercices repartent de zero", lignes("SELECT MAX(points) AS m FROM ligues WHERE groupe >= 0")[0].m === 0);
  r = await ligue(g0[g0.length - 1]);
  T("en ligue Cavalier, des places descendent", r.descend > 0 && r.monte > 0 && r.groupe.length >= 10, JSON.stringify({ m: r.monte, d: r.descend, n: r.groupe.length }));
  await joue(g0[0], 2);
  T("retour apres une semaine sans rien : range de nouveau", ligne(g0[0]).groupe >= 0 && ligne(g0[0]).points === 2);

  console.log("\nDescente");
  const cav = noms.filter(n => ligne(n).ligue === 1 && ligne(n).groupe >= 0);
  for (let i = 0; i < cav.length; i++) await joue(cav[i], cav.length - i);
  semaineSuivante(); E.liguesOublier();
  r = await ligue(cav[cav.length - 1]);
  T("le dernier d'un groupe Cavalier redescend en Pion", r.ligue === 0 && r.mouv === -1, JSON.stringify(r).slice(0, 120));
  T("le premier monte en ligue Fou", ligne(cav[0]).ligue === 2 && ligne(cav[0]).mouv === 1);
  T("jamais de ligue hors de 0 a 4", lignes("SELECT COUNT(*) AS n FROM ligues WHERE ligue < 0 OR ligue > 4")[0].n === 0);

  r = await appel("GET", "exporter", undefined, membres[cav[0]].cookie);
  T("l'export du compte donne sa ligue", r.s === 200 && r.j.ligue.ligue === "Fou" && r.j.ligue.dernier_mouvement === 1, JSON.stringify(r.j && r.j.ligue));

  console.log("\nSuppression et tables absentes");
  r = await appel("POST", "supprimer", { code: code("Nouvelle") }, membres.Nouvelle.cookie);
  T("supprimer son compte efface sa ligne de ligue", r.s === 200 && lignes("SELECT COUNT(*) AS n FROM ligues WHERE compte_id NOT IN (SELECT id FROM comptes)")[0].n === 0, r.texte);
  env.DB.brut.exec("DROP TABLE ligues; DROP TABLE ligues_semaines;");
  E.liguesOublier();
  r = await appel("GET", "ligue", undefined, membres[noms[3]].cookie);
  T("sans les tables : ligues fermees, pas d'erreur", r.s === 200 && r.j.ouvert === false, r.texte);
  let tient = true;
  try { await joue(noms[3], 1); } catch (e) { tient = false; }
  T("sans les tables : la synchronisation marche toujours", tient);
  r = await appel("GET", "exporter", undefined, membres[noms[3]].cookie);
  T("sans les tables : l'export marche, ligue vide", r.s === 200 && r.j.ligue === null);
  await creer("Sanstable");
  T("sans les tables : creer et supprimer un compte marche", (await appel("POST", "supprimer", { code: code("Sanstable") }, membres.Sanstable.cookie)).s === 200);

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception : " + (e && e.stack || e)); process.exit(1); });
