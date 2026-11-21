/* Verification automatique de chang64.
   Lancement : node tests/check_compte_securite.js

   Les trois points de securite du compte (2026-11-21, decisions d'Alexandre),
   contre le serveur du compte et une base SQLite en memoire :
   1. creations : quand le plafond de l'heure est atteint, une connexion
      nouvelle peut encore creer un compte (un script ne ferme plus les
      inscriptions a tout le monde) ;
   2. faux codes : comptes par connexion Internet, le proprietaire n'est plus
      bloque par quelqu'un d'autre ; plafond par compte et par jour ; le code
      de secours ouvre toujours ;
   3. pseudo quitte : reserve 30 jours, repris seulement par son ancien
      proprietaire. */
const path = require("path"), { pathToFileURL } = require("url");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const { fausseD1 } = require("../serveur_local.js");
const VRAI_NOW = Date.now;
/* Depart a midi UTC, pour que les essais d'un meme bloc tombent le meme jour. */
let decalage = Date.UTC(2031, 2, 10, 12, 0, 0) - VRAI_NOW();
Date.now = () => VRAI_NOW() + decalage;
const avancer = ms => { decalage += ms; };
const JOUR = 864e5;

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, "..", "functions", "api", "compte", "[[route]].js")).href);
  const E = mod._essai;
  const env = { DB: fausseD1(), POIVRE: "secret-de-test" };
  const lignes = (sql, ...a) => env.DB.brut.prepare(sql).all(...a);
  const code = n => Buffer.from(String(n).padStart(32, "x")).toString("base64url");
  /* o : { cookie, ip }. */
  async function appel(methode, route, corps, o) {
    o = o || {};
    const h = { Origin: "https://chang64.com" };
    if (corps !== undefined) h["Content-Type"] = "application/json";
    if (o.cookie) h.Cookie = o.cookie;
    if (o.ip) h["CF-Connecting-IP"] = o.ip;
    const rep = await mod.onRequest({ request: new Request("https://chang64.com/api/compte/" + route, { method: methode, headers: h, body: corps === undefined ? undefined : JSON.stringify(corps) }), env, params: { route: route.split("/") } });
    const texte = await rep.text(); let j = null; try { j = JSON.parse(texte); } catch (e) {}
    return { s: rep.status, j, texte, cookie: (rep.headers.get("Set-Cookie") || "").split(";")[0] };
  }
  const connexion = (pseudo, n, ip) => appel("POST", "connexion", { pseudo, code: code(n) }, { ip });
  const MAISON = "203.0.113.7", PIRATE = "198.51.100.9";

  console.log("Faux codes : comptes par connexion");
  let r = await appel("POST", "creer", { pseudo: "Alice", code: code(1) }, { ip: MAISON });
  T("compte cree", r.s === 201, r.texte);
  const session = r.cookie, secours = r.j.secours;
  for (let i = 0; i < 5; i++) r = await connexion("Alice", 900 + i, PIRATE);
  T("cinq faux codes depuis une connexion : encore 401 au cinquieme", r.s === 401);
  r = await connexion("Alice", 1, PIRATE);
  T("cette connexion est ensuite bloquee 15 minutes, meme avec le bon code", r.s === 429 && r.j.erreur === "bloque" && r.j.attendre > 800 && r.j.attendre <= 900, r.texte);
  r = await connexion("Alice", 1, MAISON);
  T("la proprietaire, depuis chez elle, entre toujours", r.s === 200 && !!r.cookie, r.texte);
  r = await connexion("Alice", 1, PIRATE);
  T("son entree ne debloque pas la connexion fautive", r.s === 429, r.texte);
  T("les sessions deja ouvertes ne sont pas touchees", (await appel("GET", "etat", undefined, { cookie: session, ip: MAISON })).s === 200);
  {
    const l = lignes("SELECT empreinte, jour, n, jusqu FROM essais");
    T("rien de lisible en base : ni adresse, ni pseudo, ni numero de compte", l.length >= 1 && l.every(x => /^[A-Za-z0-9_-]{22}$/.test(x.empreinte) && !x.empreinte.includes("198") && /^\d{4}-\d{2}-\d{2}$/.test(x.jour)) && !JSON.stringify(l).includes(PIRATE) && !/alice/i.test(JSON.stringify(l)), JSON.stringify(l));
  }
  avancer(E.BLOCAGE + 1000);
  r = await connexion("Alice", 950, PIRATE);
  T("apres 15 minutes, un nouvel essai rate", r.s === 401, r.texte);
  r = await connexion("Alice", 951, PIRATE);
  T("puis le blocage double (30 minutes)", r.s === 429 && r.j.attendre > 1700 && r.j.attendre <= 1800, r.texte);
  r = await appel("POST", "code", { ancien: code(77), nouveau: code(2) }, { cookie: session, ip: PIRATE });
  T("changer de code avec un faux ancien code, depuis la connexion bloquee : refuse aussi", r.s === 429, r.texte);
  r = await appel("POST", "code", { ancien: code(1), nouveau: code(2) }, { cookie: session, ip: MAISON });
  T("depuis chez elle, le changement de code passe", r.s === 200, r.texte);
  /* Un changement de code ferme les autres sessions : on garde celle qui l'a fait. */
  const session1 = (await connexion("Alice", 2, MAISON)).cookie;
  r = await appel("POST", "code", { ancien: code(2), nouveau: code(1) }, { cookie: session1, ip: MAISON });
  T("et le code d'origine est remis", r.s === 200, r.texte);

  console.log("Faux codes : plafond du compte sur la journee");
  avancer(JOUR);
  await E.nettoyer(env, Date.now());
  T("le lendemain, les compteurs de la veille sont effaces", lignes("SELECT COUNT(*) AS n FROM essais")[0].n === 0);
  let refus = 0;
  for (let ip = 0; ip < 6; ip++) for (let i = 0; i < 5; i++) { r = await connexion("Alice", 2000 + ip * 10 + i, "192.0.2." + (10 + ip)); if (r.s !== 401) refus++; }
  T("30 faux codes repartis sur 6 connexions : tous verifies", refus === 0, String(refus));
  r = await connexion("Alice", 1, MAISON);
  T("au-dela, le code ne suffit plus jusqu'au lendemain, meme le bon, meme de chez elle", r.s === 429 && r.j.erreur === "bloque" && r.j.attendre > 0 && r.j.attendre <= 12 * 3600, r.texte);
  T("ses sessions ouvertes continuent", (await appel("GET", "etat", undefined, { cookie: session1, ip: MAISON })).s === 200);
  r = await appel("POST", "secours", { pseudo: "Alice", secours, code: code(3) }, { ip: MAISON });
  T("le code de secours ouvre toujours le compte", r.s === 200 && !!r.cookie && !!r.j.secours, r.texte);
  const session2 = r.cookie;
  r = await connexion("Alice", 3, MAISON);
  T("et le nouveau code marche aussitot", r.s === 200, r.texte);
  avancer(JOUR);
  r = await connexion("Alice", 3, "192.0.2.10");
  T("le lendemain, tout est reparti de zero", r.s === 200, r.texte);

  console.log("Faux codes : base sans la table");
  env.DB.brut.exec("ALTER TABLE essais RENAME TO essais_x");
  for (let i = 0; i < 5; i++) r = await connexion("Alice", 3000 + i, PIRATE);
  r = await connexion("Alice", 3, MAISON);
  T("on retombe sur l'ancien blocage par compte, sans erreur", r.s === 429 && r.j.erreur === "bloque", r.texte);
  avancer(E.BLOCAGE + 1000);
  T("qui se leve comme avant", (await connexion("Alice", 3, MAISON)).s === 200);
  env.DB.brut.exec("ALTER TABLE essais_x RENAME TO essais");

  console.log("Creations : plafond de l'heure");
  avancer(2 * JOUR);
  const poser = n => { const st = env.DB.brut.prepare("INSERT INTO comptes (cle, pseudo, pin_hash, secours_hash, cree, vu) VALUES (?, ?, 'x', 'x', ?, ?)"); for (let i = 0; i < n; i++) st.run("masse" + i + "x" + Date.now(), "Masse" + i + "x" + Date.now(), Date.now() - 60e3, Date.now()); };
  const total = () => lignes("SELECT COUNT(*) AS n FROM comptes WHERE cree > ?", Date.now() - 3600e3)[0].n;
  poser(E.CREATIONS_PAR_HEURE - total());
  T("300 comptes crees dans l'heure", total() === E.CREATIONS_PAR_HEURE, String(total()));
  r = await appel("POST", "creer", { pseudo: "Nouveau1", code: code(1) }, { ip: "192.0.2.50" });
  T("une connexion nouvelle cree encore son compte", r.s === 201, r.texte);
  r = await appel("POST", "creer", { pseudo: "Nouveau2", code: code(1) }, { ip: "192.0.2.50" });
  T("et un second (frere, soeur)", r.s === 201, r.texte);
  r = await appel("POST", "creer", { pseudo: "Nouveau3", code: code(1) }, { ip: "192.0.2.50" });
  T("le troisieme de la meme connexion attend", r.s === 429 && r.j.erreur === "plus_tard", r.texte);
  r = await appel("POST", "creer", { pseudo: "Nouveau4", code: code(1) }, { ip: "192.0.2.51" });
  T("une autre connexion n'est pas genee par la premiere", r.s === 201, r.texte);
  r = await appel("POST", "creer", { pseudo: "Nouveau5", code: code(1) });
  T("sans adresse connue, on reste prudent : plus tard", r.s === 429 && r.j.erreur === "plus_tard", r.texte);
  poser(3000 - total());
  r = await appel("POST", "creer", { pseudo: "Nouveau6", code: code(1) }, { ip: "192.0.2.60" });
  T("plafond absolu (3000 dans l'heure) : plus personne, meme nouveau", r.s === 429 && r.j.erreur === "plus_tard", r.texte);
  avancer(3700e3);
  r = await appel("POST", "creer", { pseudo: "Nouveau6", code: code(1) }, { ip: "192.0.2.60" });
  T("une heure plus tard, les inscriptions reprennent", r.s === 201, r.texte);

  console.log("Pseudo quitte : reserve 30 jours");
  avancer(JOUR);
  r = await appel("POST", "creer", { pseudo: "Avant", code: code(11) }, { ip: MAISON });
  const cA = r.cookie;
  T("compte « Avant » cree", r.s === 201, r.texte);
  r = await appel("POST", "pseudo-changer", { pseudo: "Apres", ancien: code(11), nouveau: code(21) }, { cookie: cA, ip: MAISON });
  T("il devient « Apres »", r.s === 200 && r.j.pseudo === "Apres", r.texte);
  r = await appel("POST", "pseudo", { pseudo: "avant" });
  T("pour un visiteur, « Avant » est pris", r.j.libre === false && r.j.raison === "pris", r.texte);
  r = await appel("POST", "creer", { pseudo: "Avant", code: code(5) }, { ip: PIRATE });
  T("personne ne peut creer un compte « Avant »", r.s === 409 && r.j.raison === "pris", r.texte);
  r = await appel("POST", "creer", { pseudo: "Voisin", code: code(6) }, { ip: PIRATE });
  const cV = r.cookie;
  avancer(8 * JOUR);
  r = await appel("POST", "pseudo-changer", { pseudo: "Avant", ancien: code(6), nouveau: code(7) }, { cookie: cV, ip: PIRATE });
  T("ni le prendre en changeant de pseudo", r.s === 409 && r.j.raison === "pris", r.texte);
  T("le compte du voisin n'a pas bouge", (await appel("GET", "etat", undefined, { cookie: cV })).j.pseudo === "Voisin");
  r = await appel("POST", "pseudo", { pseudo: "Avant" }, { cookie: cA });
  T("pour son ancien proprietaire, il est libre", r.j.libre === true, r.texte);
  {
    const l = lignes("SELECT cle, compte_id FROM pseudos_quittes");
    T("la base ne garde pas le pseudo, seulement son empreinte", l.length === 1 && !/avant/i.test(l[0].cle) && /^[A-Za-z0-9_-]{32}$/.test(l[0].cle) && l[0].compte_id > 0, JSON.stringify(l));
  }
  r = await appel("POST", "pseudo-changer", { pseudo: "Avant", ancien: code(21), nouveau: code(11) }, { cookie: cA, ip: MAISON });
  T("il le reprend", r.s === 200 && r.j.pseudo === "Avant", r.texte);
  r = await appel("POST", "pseudo", { pseudo: "Apres" });
  T("c'est alors « Apres » qui est reserve, et « Avant » qui ne l'est plus", r.j.libre === false && lignes("SELECT COUNT(*) AS n FROM pseudos_quittes")[0].n === 1, r.texte);
  avancer(8 * JOUR);
  r = await appel("POST", "pseudo-changer", { pseudo: "AVANT", ancien: code(11), nouveau: code(11) }, { cookie: cA, ip: MAISON });
  T("changer seulement les majuscules ne reserve rien de plus", r.s === 200 && lignes("SELECT COUNT(*) AS n FROM pseudos_quittes")[0].n === 1, r.texte);
  avancer(E.PSEUDO_RESERVE);
  await E.nettoyer(env, Date.now());
  r = await appel("POST", "pseudo", { pseudo: "Apres" });
  T("apres 30 jours, le pseudo quitte redevient libre et la ligne est effacee", r.j.libre === true && lignes("SELECT COUNT(*) AS n FROM pseudos_quittes")[0].n === 0, r.texte);

  console.log("Pseudo d'un compte supprime");
  r = await appel("POST", "supprimer", { code: code(11) }, { cookie: cA, ip: MAISON });
  T("suppression du compte", r.s === 200, r.texte);
  r = await appel("POST", "pseudo", { pseudo: "Avant" });
  T("son pseudo reste indisponible", r.j.libre === false && r.j.raison === "pris", r.texte);
  T("pour tout le monde : la ligne n'appartient plus a personne", lignes("SELECT compte_id FROM pseudos_quittes").every(x => x.compte_id === 0) && (await appel("POST", "creer", { pseudo: "Avant", code: code(5) }, { ip: "192.0.2.77" })).s === 409);
  avancer(E.PSEUDO_RESERVE + 1000);
  r = await appel("POST", "creer", { pseudo: "Avant", code: code(5) }, { ip: "192.0.2.78" });
  T("30 jours plus tard, quelqu'un d'autre peut le prendre", r.s === 201, r.texte);

  console.log("Pseudo quitte : base sans la table");
  env.DB.brut.exec("ALTER TABLE pseudos_quittes RENAME TO pseudos_x");
  r = await appel("POST", "creer", { pseudo: "Sansrien", code: code(31) }, { ip: "192.0.2.80" });
  const cS = r.cookie;
  r = await appel("POST", "pseudo-changer", { pseudo: "Autrenom", ancien: code(31), nouveau: code(32) }, { cookie: cS, ip: "192.0.2.80" });
  T("le changement de pseudo marche", r.s === 200, r.texte);
  T("et l'ancien est libre aussitot, comme avant", (await appel("POST", "pseudo", { pseudo: "Sansrien" })).j.libre === true);
  T("la suppression de compte marche aussi", (await appel("POST", "supprimer", { code: code(32) }, { cookie: cS, ip: "192.0.2.80" })).s === 200);
  env.DB.brut.exec("ALTER TABLE pseudos_x RENAME TO pseudos_quittes");
  void session2;

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n" + ok + " OK, " + (ko + 1) + " FAIL"); process.exit(1); });
