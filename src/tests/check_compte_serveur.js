/* Verification automatique de chang64.
   Lancement : node tests/check_compte_serveur.js

   Ce que ce test garde (2026-11-16) : le serveur du compte
   (functions/api/compte/[[route]].js), execute tel quel contre une vraie base
   SQLite en memoire qui imite D1 (node:sqlite, tables de compte-schema.sql).
   Tout ce qui protege un compte est verifie ici : limite d'essais meme sous
   requetes simultanees, rien de lisible en base (ni code, ni jeton, ni code
   de secours), cookie ferme au script, origine, version de synchronisation,
   code de secours a usage unique, lien d'appareil a usage unique, suppression
   complete, effacement apres deux ans. */
const fs = require("fs"), path = require("path"), { pathToFileURL } = require("url");
process.removeAllListeners("warning"); process.on("warning", () => {});

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };

const { fausseD1 } = require("../serveur_local.js");

const VRAI_NOW = Date.now;
let decalage = 0;
Date.now = () => VRAI_NOW() + decalage;
const avancer = ms => { decalage += ms; };

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, "..", "functions", "api", "compte", "[[route]].js")).href);
  const E = mod._essai;
  let env = { DB: fausseD1() };
  const lignes = (sql, ...a) => env.DB.brut.prepare(sql).all(...a);

  /* Un code etire, tel que le navigateur l'envoie : 32 octets en base64url. */
  const code = n => Buffer.from(String(n).padStart(32, "x")).toString("base64url");
  async function appel(methode, route, corps, o) {
    o = o || {};
    const h = { Origin: o.origine || "https://chang64.com" };
    if (corps !== undefined) h["Content-Type"] = o.type || "application/json";
    if (o.cookie) h.Cookie = o.cookie;
    const req = new Request("https://chang64.com/api/compte/" + route, { method: methode, headers: h, body: corps === undefined ? undefined : (typeof corps === "string" ? corps : JSON.stringify(corps)) });
    const rep = await mod.onRequest({ request: req, env, params: { route: route.split("/") } });
    const texte = await rep.text();
    let j = null; try { j = JSON.parse(texte); } catch (e) {}
    const sc = rep.headers.get("Set-Cookie") || "";
    return { s: rep.status, j, texte, sc, cookie: sc.split(";")[0], h: rep.headers };
  }

  console.log("\nPseudo");
  const pv = E.pseudoValider;
  T("un pseudo simple passe", pv("Tour_Noire-7").ok);
  T("trop court refuse", pv("ab").raison === "longueur");
  T("trop long refuse", pv("a".repeat(21)).raison === "longueur");
  T("espace refuse", pv("deux mots").raison === "caracteres");
  T("adresse e-mail refusee", pv("moi@exemple.fr").raison === "caracteres");
  T("balise refusee", pv("<b>x</b>").raison === "caracteres");
  T("que des tirets refuse", pv("---").raison === "caracteres");
  T("ecritures melangees refusees", pv("Аlex").raison === "melange", JSON.stringify(pv("Аlex")));
  T("cyrillique seul accepte", pv("Вова").ok);
  T("accents acceptes", pv("Élodie").ok && pv("Élodie").cle === "elodie");
  T("sosie cyrillique : meme cle que le latin", pv("сосо").cle === pv("coco").cle);
  T("majuscules : meme cle", pv("ALEX").cle === pv("alex").cle);
  T("i turc : meme cle", pv("Işık").cle === "isik");
  for (const m of ["Admin", "chang64_fan", "Moderateur", "xX_fuck_Xx", "sh1t", "p-u-t-e", "con", "Hitler88", "сука"])
    T("interdit : " + m, pv(m).raison === "interdit", JSON.stringify(pv(m)));
  for (const m of ["Concorde", "Bitebeat", "Assassin", "Grape", "Cavalier", "Analyse"])
    T("pas de faux positif : " + m, pv(m).ok, JSON.stringify(pv(m)));

  console.log("\nCreation");
  let r = await appel("POST", "pseudo", { pseudo: "Alexandre" });
  T("pseudo libre avant creation", r.s === 200 && r.j.libre === true);
  r = await appel("POST", "creer", { pseudo: "Alexandre", code: code(1), donnees: { progress: { solved: 40, rating: 950, days: 3, badges: ["a", "b"], rushBest: 7 } } });
  T("creation : 201", r.s === 201 && r.j.pseudo === "Alexandre" && r.j.version === 1, r.texte);
  T("code de secours rendu, 4 groupes de 4", /^([0-9A-HJKMNP-TV-Z]{4}-){3}[0-9A-HJKMNP-TV-Z]{4}$/.test(r.j.secours), r.j.secours);
  const secours1 = r.j.secours, cookieA = r.cookie;
  T("cookie HttpOnly, Secure, SameSite=Strict", /HttpOnly/.test(r.sc) && /Secure/.test(r.sc) && /SameSite=Strict/.test(r.sc) && /Path=\/api\//.test(r.sc), r.sc);
  T("reponse jamais gardee en cache", r.h.get("Cache-Control") === "no-store");
  let l = lignes("SELECT * FROM comptes")[0];
  T("la base ne contient ni le code ni le code de secours", !JSON.stringify(l).includes(code(1)) && !JSON.stringify(l).includes(secours1) && !JSON.stringify(l).includes(secours1.replace(/-/g, "")));
  T("la base ne contient pas le jeton de session", !JSON.stringify(lignes("SELECT * FROM jetons")).includes(cookieA.split("=")[1]));
  T("chiffres du classement lus a la creation", l.note === 950 && l.resolus === 40 && l.serie === 3 && l.badges === 2 && l.sprint === 7 && l.sem_resolus === 0, JSON.stringify(l));
  T("aucune colonne d'adresse IP ni d'e-mail", !Object.keys(l).some(k => /ip|mail|agent/i.test(k)));
  r = await appel("POST", "pseudo", { pseudo: "alexandre" });
  T("pseudo pris, sans casse", r.j.libre === false && r.j.raison === "pris");
  for (const p of ["ALEXANDRE", "Aléxandre", "Alexandrе" /* e cyrillique : melange */]) {
    r = await appel("POST", "creer", { pseudo: p, code: code(2) });
    T("doublon refuse : " + p, r.s === 409 || r.s === 400, r.texte);
  }
  T("un seul compte en base", lignes("SELECT COUNT(*) AS n FROM comptes")[0].n === 1);
  r = await appel("POST", "creer", { pseudo: "Autre", code: "123456" });
  T("code non etire refuse", r.s === 400 && r.j.erreur === "code");
  r = await appel("POST", "creer", { pseudo: "Autre", code: code(3), donnees: { x: "y".repeat(E.TAILLE_MAX) } });
  T("progression trop grosse refusee", r.s === 413);

  console.log("\nSession");
  r = await appel("GET", "etat", undefined, { cookie: cookieA });
  T("etat avec le cookie", r.s === 200 && r.j.pseudo === "Alexandre");
  r = await appel("GET", "etat");
  T("etat sans cookie : 401", r.s === 401);
  r = await appel("GET", "etat", undefined, { cookie: "__Secure-c64=" + "A".repeat(43) });
  T("jeton invente : 401", r.s === 401);
  r = await appel("POST", "connexion", { pseudo: "Alexandre", code: code(1) }, { origine: "https://mechant.example" });
  T("autre origine : 403", r.s === 403);
  r = await appel("POST", "connexion", JSON.stringify({ pseudo: "Alexandre", code: code(1) }), { type: "text/plain" });
  T("corps non JSON : 400", r.s === 400);
  r = await appel("GET", "nimportequoi", undefined, { cookie: cookieA });
  T("route inconnue : 404", r.s === 404);

  console.log("\nConnexion et limite d'essais");
  r = await appel("POST", "connexion", { pseudo: "aLEXANDRE", code: code(1) });
  T("connexion, pseudo sans casse", r.s === 200 && r.j.pseudo === "Alexandre" && !!r.cookie);
  const cookieB = r.cookie;
  const inconnu = await appel("POST", "connexion", { pseudo: "Personne", code: code(1) });
  const faux = await appel("POST", "connexion", { pseudo: "Alexandre", code: code(9) });
  T("pseudo inconnu et mauvais code : meme reponse", inconnu.s === 401 && faux.s === 401 && inconnu.texte === faux.texte, inconnu.texte + " / " + faux.texte);
  for (let i = 0; i < 4; i++) r = await appel("POST", "connexion", { pseudo: "Alexandre", code: code(9) });
  T("5e mauvais essai : encore 401", r.s === 401);
  r = await appel("POST", "connexion", { pseudo: "Alexandre", code: code(1) });
  T("ensuite bloque, meme avec le bon code", r.s === 429 && r.j.erreur === "bloque" && r.j.attendre > 800 && r.j.attendre <= 900, r.texte);
  r = await appel("GET", "etat", undefined, { cookie: cookieB });
  T("les appareils deja connectes restent connectes pendant le blocage", r.s === 200);
  avancer(E.BLOCAGE + 1000);
  r = await appel("POST", "connexion", { pseudo: "Alexandre", code: code(9) });
  T("apres 15 min, un essai rate", r.s === 401);
  r = await appel("POST", "connexion", { pseudo: "Alexandre", code: code(1) });
  T("puis blocage double (30 min)", r.s === 429 && r.j.attendre > 1700 && r.j.attendre <= 1800, r.texte);
  avancer(2 * E.BLOCAGE + 1000);
  r = await appel("POST", "connexion", { pseudo: "Alexandre", code: code(1) });
  T("apres le blocage, le bon code passe", r.s === 200);
  l = lignes("SELECT echecs, bloque_jusqu FROM comptes")[0];
  T("compteur remis a zero", l.echecs === 0 && l.bloque_jusqu === 0);
  /* 60 essais lances d'un coup, le bon code au milieu. */
  const salve = await Promise.all(Array.from({ length: 60 }, (_, i) => appel("POST", "connexion", { pseudo: "Alexandre", code: code(i === 40 ? 1 : 100 + i) })));
  const verifies = salve.filter(x => x.s === 401).length, passes = salve.filter(x => x.s === 200).length;
  T("salve de 60 essais simultanes : 5 verifies au plus, aucun succes", verifies <= 5 && passes === 0 && salve.filter(x => x.s === 429).length >= 55, verifies + " verifies, " + passes + " succes");
  avancer(E.BLOCAGE * 2000);
  r = await appel("POST", "connexion", { pseudo: "Alexandre", code: code(1) });
  T("blocage plafonne a 24 h", r.s === 200);
  env.DB.brut.exec("UPDATE comptes SET echecs = 30");
  await appel("POST", "connexion", { pseudo: "Alexandre", code: code(9) });
  l = lignes("SELECT bloque_jusqu FROM comptes")[0];
  T("meme apres 30 echecs, pas plus de 24 h", l.bloque_jusqu - Date.now() <= 864e5 && l.bloque_jusqu - Date.now() > 864e5 - 5000, String(l.bloque_jusqu - Date.now()));
  avancer(864e5 + 1000);
  await appel("POST", "connexion", { pseudo: "Alexandre", code: code(1) });

  console.log("\nSynchronisation");
  r = await appel("GET", "synchro", undefined, { cookie: cookieA });
  T("lecture : version 1 et la progression", r.s === 200 && r.j.version === 1 && r.j.donnees.progress.solved === 40);
  r = await appel("PUT", "synchro", { version: 1, donnees: { progress: { solved: 52, rating: 990, days: 4, badges: ["a", "b", "c"], rushBest: 9 } } }, { cookie: cookieA });
  T("ecriture a la bonne version", r.s === 200 && r.j.version === 2, r.texte);
  l = lignes("SELECT * FROM comptes")[0];
  T("chiffres mis a jour, 12 exercices cette semaine", l.note === 990 && l.resolus === 52 && l.badges === 3 && l.sem_resolus === 12, JSON.stringify([l.note, l.resolus, l.sem_resolus]));
  r = await appel("PUT", "synchro", { version: 1, donnees: { progress: { solved: 1 } } }, { cookie: cookieB });
  T("version perimee : 409 avec l'etat actuel", r.s === 409 && r.j.version === 2 && r.j.donnees.progress.solved === 52, r.texte);
  T("rien n'a ete ecrase", lignes("SELECT resolus FROM comptes")[0].resolus === 52);
  r = await appel("PUT", "synchro", { version: 2, donnees: { progress: { solved: 5000, rating: 99999, days: -4, rushBest: "x" } } }, { cookie: cookieB });
  l = lignes("SELECT * FROM comptes")[0];
  T("valeurs absurdes bornees, saut de la semaine plafonne", l.note === 3500 && l.serie === 0 && l.sprint === 0 && l.sem_resolus === 312, JSON.stringify([l.note, l.serie, l.sprint, l.sem_resolus]));
  avancer(8 * 864e5);
  r = await appel("PUT", "synchro", { version: 3, donnees: { progress: { solved: 5004 } } }, { cookie: cookieB });
  T("nouvelle semaine : le compteur repart", lignes("SELECT sem_resolus FROM comptes")[0].sem_resolus === 4);
  r = await appel("PUT", "synchro", { version: 4, donnees: [1, 2] }, { cookie: cookieA });
  T("progression qui n'est pas un objet refusee", r.s === 413 || r.s === 400);
  r = await appel("PUT", "synchro", { version: 4, donnees: { a: 1 } });
  T("synchro sans session : 401", r.s === 401);

  console.log("\nExport");
  r = await appel("GET", "exporter", undefined, { cookie: cookieA });
  T("export : pseudo, dates, progression", r.s === 200 && r.j.pseudo === "Alexandre" && r.j.progression.progress.solved === 5004 && /^\d{4}-/.test(r.j.cree_le));
  T("export : fichier a telecharger, sans empreinte", /attachment/.test(r.h.get("Content-Disposition")) && !/v1\.p0/.test(r.texte) && !/hash/.test(r.texte));

  console.log("\nChangement de code");
  r = await appel("POST", "code", { ancien: code(9), nouveau: code(5) }, { cookie: cookieA });
  T("ancien code faux : refuse", r.s === 401);
  r = await appel("POST", "code", { ancien: code(1), nouveau: code(5) }, { cookie: cookieA });
  T("changement accepte", r.s === 200, r.texte);
  T("l'appareil qui change reste connecte", (await appel("GET", "etat", undefined, { cookie: cookieA })).s === 200);
  T("les autres appareils sont deconnectes", (await appel("GET", "etat", undefined, { cookie: cookieB })).s === 401);
  T("l'ancien code ne marche plus", (await appel("POST", "connexion", { pseudo: "Alexandre", code: code(1) })).s === 401);
  T("le nouveau marche", (await appel("POST", "connexion", { pseudo: "Alexandre", code: code(5) })).s === 200);

  console.log("\nCode de secours");
  r = await appel("POST", "secours", { pseudo: "Alexandre", secours: "0000-0000-0000-0000", code: code(6) });
  T("mauvais code de secours : 401", r.s === 401);
  for (let i = 0; i < 6; i++) await appel("POST", "connexion", { pseudo: "Alexandre", code: code(9) });
  T("compte bloque par des essais", (await appel("POST", "connexion", { pseudo: "Alexandre", code: code(5) })).s === 429);
  r = await appel("POST", "secours", { pseudo: "alexandre", secours: secours1.toLowerCase().replace(/-/g, " "), code: code(6) });
  T("le code de secours passe, meme bloque, meme mal recopie", r.s === 200 && !!r.cookie && r.j.secours !== secours1, r.texte);
  const secours2 = r.j.secours, cookieC = r.cookie;
  T("toutes les anciennes sessions tombent", (await appel("GET", "etat", undefined, { cookie: cookieA })).s === 401);
  T("le nouveau code marche, le blocage est leve", (await appel("POST", "connexion", { pseudo: "Alexandre", code: code(6) })).s === 200);
  T("le code de secours ne sert qu'une fois", (await appel("POST", "secours", { pseudo: "Alexandre", secours: secours1, code: code(7) })).s === 401);
  r = await appel("POST", "secours-nouveau", { code: code(6) }, { cookie: cookieC });
  T("nouveau code de secours avec le code", r.s === 200 && r.j.secours !== secours2);
  T("l'ancien code de secours est perime", (await appel("POST", "secours", { pseudo: "Alexandre", secours: secours2, code: code(7) })).s === 401);
  T("le code est reste le meme", (await appel("POST", "connexion", { pseudo: "Alexandre", code: code(6) })).s === 200);

  console.log("\nAjout d'un appareil");
  r = await appel("POST", "lien", {}, { cookie: cookieC });
  T("code de 6 caracteres, 10 minutes", r.s === 200 && /^[A-HJKMNP-Z2-9]{6}$/.test(r.j.code) && r.j.expire - Date.now() <= E.DUREE_LIEN, r.texte);
  const lien1 = r.j.code;
  T("le code n'est pas en clair dans la base", !JSON.stringify(lignes("SELECT * FROM liens_appareil")).includes(lien1));
  T("sans session, pas de lien", (await appel("POST", "lien", {})).s === 401);
  T("mauvais code de lien : 401", (await appel("POST", "lien-connexion", { pseudo: "Alexandre", code: "AAAAAA" })).s === 401);
  r = await appel("POST", "lien-connexion", { pseudo: "alexandre", code: lien1.toLowerCase() });
  T("le nouvel appareil se connecte", r.s === 200 && !!r.cookie && r.j.pseudo === "Alexandre", r.texte);
  T("sa session marche", (await appel("GET", "etat", undefined, { cookie: r.cookie })).s === 200);
  T("le lien ne sert qu'une fois", (await appel("POST", "lien-connexion", { pseudo: "Alexandre", code: lien1 })).s === 401);
  r = await appel("POST", "lien", {}, { cookie: cookieC });
  for (let i = 0; i < 5; i++) await appel("POST", "lien-connexion", { pseudo: "Alexandre", code: "BBBBB" + "23456"[i] });
  T("5 essais rates tuent le lien", (await appel("POST", "lien-connexion", { pseudo: "Alexandre", code: r.j.code })).s === 401);
  r = await appel("POST", "lien", {}, { cookie: cookieC });
  avancer(E.DUREE_LIEN + 1000);
  T("lien perime apres 10 minutes", (await appel("POST", "lien-connexion", { pseudo: "Alexandre", code: r.j.code })).s === 401);
  r = await appel("POST", "lien", {}, { cookie: cookieC });
  const deux = await Promise.all([1, 2].map(() => appel("POST", "lien-connexion", { pseudo: "Alexandre", code: r.j.code })));
  T("deux appareils, un seul lien : un seul entre", deux.filter(x => x.s === 200).length === 1);

  console.log("\nSessions");
  for (let i = 0; i < 14; i++) { avancer(1000); await appel("POST", "connexion", { pseudo: "Alexandre", code: code(6) }); }
  T("10 sessions au plus par compte", lignes("SELECT COUNT(*) AS n FROM jetons")[0].n === 10, String(lignes("SELECT COUNT(*) AS n FROM jetons")[0].n));
  r = await appel("POST", "connexion", { pseudo: "Alexandre", code: code(6) });
  const cookieD = r.cookie;
  r = await appel("POST", "deconnexion", {}, { cookie: cookieD });
  T("deconnexion : cookie efface", r.s === 200 && /Max-Age=0/.test(r.sc));
  T("le jeton ne vaut plus rien", (await appel("GET", "etat", undefined, { cookie: cookieD })).s === 401);
  r = await appel("POST", "connexion", { pseudo: "Alexandre", code: code(6) });
  const cookieE = r.cookie;
  avancer(E.DUREE_JETON + 864e5);
  T("session inutilisee 6 mois : expiree", (await appel("GET", "etat", undefined, { cookie: cookieE })).s === 401);

  console.log("\nSecret hors de la base (POIVRE)");
  env.POIVRE = "un-secret-du-projet";
  r = await appel("POST", "connexion", { pseudo: "Alexandre", code: code(6) });
  T("le compte cree sans secret se connecte encore", r.s === 200);
  T("son empreinte est refaite avec le secret", /^v1\.p1\./.test(lignes("SELECT pin_hash FROM comptes")[0].pin_hash));
  const cookieF = r.cookie;
  delete env.POIVRE;
  T("sans le secret, la base seule ne permet plus de verifier", (await appel("POST", "connexion", { pseudo: "Alexandre", code: code(6) })).s === 401);
  env.POIVRE = "un-secret-du-projet";
  T("avec le secret, oui", (await appel("POST", "connexion", { pseudo: "Alexandre", code: code(6) })).s === 200);
  r = await appel("POST", "secours-nouveau", { code: code(6) }, { cookie: cookieF });
  const secours3 = r.j.secours;

  console.log("\nSuppression");
  r = await appel("POST", "supprimer", { code: code(9) }, { cookie: cookieF });
  T("suppression sans le bon code : refusee", r.s === 401 && lignes("SELECT COUNT(*) AS n FROM comptes")[0].n === 1);
  await appel("POST", "lien", {}, { cookie: cookieF });
  r = await appel("POST", "supprimer", { code: code(6) }, { cookie: cookieF });
  T("suppression avec le code", r.s === 200 && /Max-Age=0/.test(r.sc), r.texte);
  T("plus rien en base : compte, sessions, liens", ["comptes", "jetons", "liens_appareil"].every(t => lignes("SELECT COUNT(*) AS n FROM " + t)[0].n === 0));
  T("la session ne marche plus", (await appel("GET", "etat", undefined, { cookie: cookieF })).s === 401);
  T("le code de secours ne ressuscite rien", (await appel("POST", "secours", { pseudo: "Alexandre", secours: secours3, code: code(7) })).s === 401);
  T("le pseudo est de nouveau libre", (await appel("POST", "pseudo", { pseudo: "Alexandre" })).j.libre === true);

  console.log("\nEffacement apres deux ans");
  r = await appel("POST", "creer", { pseudo: "Dormeur", code: code(1) });
  const cookieG = r.cookie;
  r = await appel("POST", "creer", { pseudo: "Actif", code: code(1) });
  const cookieH = r.cookie;
  avancer(E.INACTIF - 30 * 864e5);
  r = await appel("POST", "connexion", { pseudo: "Actif", code: code(1) });
  T("un compte actif se reconnecte apres 23 mois", r.s === 200);
  avancer(60 * 864e5);
  await E.nettoyer(env, Date.now());
  const restants = lignes("SELECT pseudo FROM comptes").map(x => x.pseudo);
  T("le compte inactif depuis deux ans est efface, l'actif reste", restants.length === 1 && restants[0] === "Actif", restants.join(","));
  T("ses sessions aussi", lignes("SELECT COUNT(*) AS n FROM jetons j LEFT JOIN comptes c ON c.id = j.compte_id WHERE c.id IS NULL")[0].n === 0);
  T("le menage se fait a la creation d'un compte", (await appel("POST", "creer", { pseudo: "Dormeur", code: code(2) })).s === 201);

  console.log("\nGarde-fous");
  env = { DB: fausseD1() };
  env.DB.brut.exec("WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < " + E.CREATIONS_PAR_HEURE + ") " +
    "INSERT INTO comptes (cle, pseudo, pin_hash, secours_hash, cree, vu) SELECT 'robot' || i, 'robot' || i, 'x', 'x', " + Date.now() + ", " + Date.now() + " FROM n");
  r = await appel("POST", "creer", { pseudo: "Suivant", code: code(1) });
  T("trop de creations dans l'heure : 429", r.s === 429 && r.j.erreur === "plus_tard", r.texte);
  avancer(3700e3);
  T("une heure plus tard, ca repart", (await appel("POST", "creer", { pseudo: "Suivant", code: code(1) })).s === 201);
  env = { DB: { prepare() { throw new Error("secret interne : table comptes introuvable"); }, batch() { throw new Error("x"); } } };
  r = await appel("POST", "pseudo", { pseudo: "Alexandre" });
  T("une panne ne laisse rien fuir", r.s === 500 && r.texte === '{"erreur":"serveur"}', r.texte);
  env = {};
  T("sans base : 503", (await appel("POST", "pseudo", { pseudo: "Alexandre" })).s === 503);

  console.log("\nChangement de pseudo");
  {
    env = { DB: fausseD1() };
    /* Le navigateur etire le code avec le pseudo pour sel : ici, un code par pseudo. */
    let r = await appel("POST", "creer", { pseudo: "Avant", code: code(11) });
    const cA = r.cookie, secoursA = r.j.secours;
    const cAutre = (await appel("POST", "creer", { pseudo: "Voisin", code: code(12) })).cookie;
    r = await appel("POST", "connexion", { pseudo: "Avant", code: code(11) });
    const cA2 = r.cookie;
    T("sans session : 401", (await appel("POST", "pseudo-changer", { pseudo: "Apres", ancien: code(11), nouveau: code(21) })).s === 401);
    T("mauvais code : refuse", (await appel("POST", "pseudo-changer", { pseudo: "Apres", ancien: code(99), nouveau: code(21) }, { cookie: cA })).s === 401);
    T("pseudo interdit : refuse", (await appel("POST", "pseudo-changer", { pseudo: "Admin", ancien: code(11), nouveau: code(21) }, { cookie: cA })).s === 400);
    r = await appel("POST", "pseudo-changer", { pseudo: "voisin", ancien: code(11), nouveau: code(21) }, { cookie: cA });
    T("pseudo deja pris : 409", r.s === 409 && r.j.raison === "pris", r.texte);
    T("nouveau code non etire : refuse", (await appel("POST", "pseudo-changer", { pseudo: "Apres", ancien: code(11), nouveau: "123456" }, { cookie: cA })).s === 400);
    r = await appel("POST", "pseudo-changer", { pseudo: "Apres", ancien: code(11), nouveau: code(21) }, { cookie: cA });
    T("changement accepte", r.s === 200 && r.j.pseudo === "Apres", r.texte);
    T("la session reste ouverte, sous le nouveau pseudo", (await appel("GET", "etat", undefined, { cookie: cA })).j.pseudo === "Apres");
    T("l'autre appareil reste connecte et apprend le nouveau pseudo par la synchronisation", (await appel("GET", "synchro", undefined, { cookie: cA2 })).j.pseudo === "Apres");
    T("l'ancien pseudo ne permet plus de se connecter", (await appel("POST", "connexion", { pseudo: "Avant", code: code(11) })).s === 401);
    T("le nouveau pseudo, avec le code etire pour lui, oui", (await appel("POST", "connexion", { pseudo: "apres", code: code(21) })).s === 200);
    T("l'ancien pseudo est de nouveau libre", (await appel("POST", "pseudo", { pseudo: "Avant" })).j.libre === true);
    T("le voisin n'a pas bouge", (await appel("GET", "etat", undefined, { cookie: cAutre })).j.pseudo === "Voisin");
    r = await appel("POST", "pseudo-changer", { pseudo: "APRÈS", ancien: code(21), nouveau: code(21) }, { cookie: cA });
    T("changer seulement la casse ou un accent de son propre pseudo : accepte", r.s === 200 && r.j.pseudo === "APRÈS", r.texte);
    r = await appel("POST", "secours", { pseudo: "Après", secours: secoursA, code: code(31) });
    T("le code de secours marche toujours apres le changement", r.s === 200);
  }

  console.log("\nDefis entre membres");
  {
    env = { DB: fausseD1() };
    const ouvrir = async p => (await appel("POST", "creer", { pseudo: p, code: code(1) })).cookie;
    const cA = await ouvrir("Anna"), cB = await ouvrir("Boris"), cC = await ouvrir("Chloe");
    const EXOS = "000a000b000c000d000e", envoi = (a, o) => Object.assign({ a, exos: EXOS, r: "22102", t: 95 }, o || {});
    const liste = async c => (await appel("GET", "defis", undefined, { cookie: c })).j;
    T("sans session : 401", (await appel("GET", "defis")).s === 401 && (await appel("POST", "defi-envoyer", envoi("Boris"))).s === 401);
    T("membre inconnu : 404", (await appel("POST", "defi-envoyer", envoi("Personne"), { cookie: cA })).s === 404);
    T("se defier soi-meme : refuse", (await appel("POST", "defi-envoyer", envoi("anna"), { cookie: cA })).s === 400);
    for (const mauvais of [{ exos: "abc" }, { exos: EXOS + "<b>" }, { r: "22302" }, { r: "2210" }, { t: -1 }, { t: 99999 }, { t: "95" }])
      T("envoi mal forme refuse : " + JSON.stringify(mauvais), (await appel("POST", "defi-envoyer", envoi("Boris", mauvais), { cookie: cA })).s === 400);
    let r = await appel("POST", "defi-envoyer", envoi("boris"), { cookie: cA });
    T("Anna defie Boris", r.s === 201 && Number.isInteger(r.j.id) && r.j.a === "Boris", r.texte);
    const id1 = r.j.id;
    let lb = await liste(cB), la = await liste(cA);
    T("Boris le trouve dans ses defis recus, avec le resultat a battre", lb.recus.length === 1 && lb.recus[0].p === "Anna" && lb.recus[0].r1 === "22102" && lb.recus[0].t1 === 95 && lb.recus[0].exos === EXOS && lb.recus[0].r2 === null && lb.envoyes.length === 0);
    T("Anna le voit dans ses defis envoyes", la.envoyes.length === 1 && la.envoyes[0].p === "Boris" && la.recus.length === 0);
    T("Chloe ne voit rien", (await liste(cC)).recus.length === 0 && (await liste(cC)).envoyes.length === 0);
    T("la liste ne porte que pseudo, exercices, scores et dates", Object.keys(lb.recus[0]).sort().join() === "cree,exos,id,p,r1,r2,repondu,t1,t2");
    T("un tiers ne peut pas repondre", (await appel("POST", "defi-repondre", { id: id1, r: "22222", t: 10 }, { cookie: cC })).s === 404);
    T("l'auteur ne peut pas repondre a son propre defi", (await appel("POST", "defi-repondre", { id: id1, r: "22222", t: 10 }, { cookie: cA })).s === 404);
    T("reponse mal formee refusee", (await appel("POST", "defi-repondre", { id: id1, r: "9", t: 10 }, { cookie: cB })).s === 400);
    T("Boris repond", (await appel("POST", "defi-repondre", { id: id1, r: "22220", t: 120 }, { cookie: cB })).s === 200);
    T("une seule reponse par defi", (await appel("POST", "defi-repondre", { id: id1, r: "22222", t: 5 }, { cookie: cB })).s === 404);
    la = await liste(cA);
    T("Anna voit la reponse de Boris", la.envoyes[0].r2 === "22220" && la.envoyes[0].t2 === 120 && la.envoyes[0].repondu > 0);
    for (let i = 0; i < 3; i++) r = await appel("POST", "defi-envoyer", envoi("Boris"), { cookie: cA });
    T("trois defis en attente vers le meme membre : acceptes", r.s === 201);
    T("le quatrieme est refuse", (await appel("POST", "defi-envoyer", envoi("Boris"), { cookie: cA })).s === 429);
    const salve = await Promise.all(Array.from({ length: 10 }, () => appel("POST", "defi-envoyer", envoi("Anna"), { cookie: cC })));
    T("dix envois simultanes : trois passent", salve.filter(x => x.s === 201).length === 3 && salve.filter(x => x.s === 429).length === 7);
    const ids = n => lignes("SELECT id FROM comptes WHERE pseudo = ?", n)[0].id;
    const ins = env.DB.brut.prepare("INSERT INTO defis (de, a, exos, r1, t1, cree, r2) VALUES (?, ?, ?, '22222', 10, ?, ?)");
    env.DB.brut.exec("DELETE FROM defis WHERE a = " + ids("Chloe"));
    for (let i = 0; i < 30; i++) ins.run(ids("Boris"), ids("Chloe"), EXOS, Date.now() - 2 * 864e5, null);
    T("boite pleine (30 en attente) : envoi refuse", (await appel("POST", "defi-envoyer", envoi("Chloe"), { cookie: cA })).s === 429);
    env.DB.brut.exec("DELETE FROM defis WHERE a = " + ids("Chloe"));
    for (let i = 0; i < 16; i++) ins.run(ids("Anna"), ids("Boris"), EXOS, Date.now(), "22222");
    T("20 envois dans la journee : le suivant est refuse", (await appel("POST", "defi-envoyer", envoi("Chloe"), { cookie: cA })).s === 429, String(lignes("SELECT COUNT(*) AS n FROM defis WHERE de = ?", ids("Anna"))[0].n));
    avancer(864e5 + 1000);
    r = await appel("POST", "defi-envoyer", envoi("Chloe"), { cookie: cA });
    T("le lendemain, ca repart", r.s === 201);
    const id2 = r.j.id;
    T("un tiers ne peut pas effacer un defi", (await appel("POST", "defi-supprimer", { id: id2 }, { cookie: cB })).s === 404);
    T("le destinataire peut effacer un defi recu", (await appel("POST", "defi-supprimer", { id: id2 }, { cookie: cC })).s === 200 && (await liste(cA)).envoyes.every(x => x.id !== id2));
    r = await appel("POST", "defi-envoyer", envoi("Chloe"), { cookie: cA });
    T("l'auteur peut retirer un defi envoye", (await appel("POST", "defi-supprimer", { id: r.j.id }, { cookie: cA })).s === 200 && (await liste(cC)).recus.length === 0);
    T("la liste est plafonnee a 30", (await liste(cA)).envoyes.length <= 30);
    r = await appel("GET", "exporter", undefined, { cookie: cB });
    T("l'export contient les defis du compte, avec les pseudos", r.j.defis_entre_membres.length > 0 && r.j.defis_entre_membres.every(x => x.de === "Anna" || x.a === "Anna" || x.de === "Boris" || x.a === "Boris"));
    ins.run(ids("Boris"), ids("Chloe"), EXOS, Date.now() - 61 * 864e5, null);
    await E.nettoyer(env, Date.now());
    T("un defi de plus de 60 jours est efface", lignes("SELECT COUNT(*) AS n FROM defis WHERE cree < ?", Date.now() - 60 * 864e5)[0].n === 0);
    T("supprimer son compte efface ses defis, recus et envoyes", (await appel("POST", "supprimer", { code: code(1) }, { cookie: cA })).s === 200 && lignes("SELECT COUNT(*) AS n FROM defis WHERE de = ? OR a = ?", 1, 1)[0].n === 0 && (await liste(cB)).recus.length === 0);
    /* Une base ou la table defis n'existe pas encore (code publie avant le SQL). */
    env = { DB: fausseD1() };
    env.DB.brut.exec("DROP TABLE defis");
    r = await appel("POST", "creer", { pseudo: "Avant", code: code(1) });
    T("sans la table defis : la creation de compte marche encore", r.s === 201);
    T("sans la table defis : la liste echoue proprement", (await appel("GET", "defis", undefined, { cookie: r.cookie })).s === 500);
    T("sans la table defis : l'export et la suppression marchent encore", (await appel("GET", "exporter", undefined, { cookie: r.cookie })).s === 200 && (await appel("POST", "supprimer", { code: code(1) }, { cookie: r.cookie })).s === 200);
  }

  console.log("\nTableaux des joueurs");
  {
    const cl = await import(pathToFileURL(path.join(__dirname, "..", "functions", "api", "classement.js")).href);
    env = { DB: fausseD1() };
    const now = Date.now(), sem = E.lundi(now);
    const ins = env.DB.brut.prepare("INSERT INTO comptes (cle, pseudo, pin_hash, secours_hash, cree, vu, note, resolus, serie, badges, sprint, sem, sem_resolus) VALUES (?, ?, 'h', 's', ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (let i = 1; i <= 60; i++) ins.run("j" + i, "Joueur" + i, now, now, 800 + i, i * 3, i % 9, i % 12, i % 20, i % 2 ? sem : "2020-01-06", i);
    const tableau = async par => { const r = await cl.onRequestGet({ request: new Request("https://chang64.com/api/classement" + (par ? "?par=" + par : "")), env }); return { s: r.status, j: r.status === 200 ? await r.json() : null, h: r.headers }; };
    let r = await tableau("note");
    T("note : 50 joueurs au plus, du meilleur au moins bon", r.s === 200 && r.j.joueurs.length === 50 && r.j.joueurs[0].p === "Joueur60" && r.j.joueurs[0].v === 860 && r.j.joueurs[49].v === 811);
    T("seuls le pseudo et le chiffre sortent", r.j.joueurs.every(x => Object.keys(x).join() === "p,v"));
    T("mis en cache cinq minutes", /s-maxage=300/.test(r.h.get("Cache-Control")));
    r = await tableau("");
    T("par defaut : la semaine en cours, sans les semaines passees", r.j.par === "semaine" && r.j.semaine === sem && r.j.joueurs.length === 30 && r.j.joueurs[0].p === "Joueur59");
    r = await tableau("note");
    T("moins de 10 exercices : absent du tableau des notes", !r.j.joueurs.some(x => ["Joueur1", "Joueur2", "Joueur3"].includes(x.p)));
    for (const par of ["resolus", "serie", "badges", "sprint"]) { r = await tableau(par); T("tableau " + par, r.s === 200 && r.j.joueurs.length > 0 && r.j.joueurs.every((x, i, l) => !i || l[i - 1].v >= x.v)); }
    r = await tableau("tout");
    T("tableau complet : les six chiffres de chaque joueur, rien d'autre", r.s === 200 && r.j.par === "tout" && r.j.joueurs.length > 0 && r.j.joueurs.every(x => Object.keys(x).join() === "p,s,n,r,j,b,k"), JSON.stringify(r.j && r.j.joueurs[0]));
    const j59 = r.j.joueurs.find(x => x.p === "Joueur59"), j60 = r.j.joueurs.find(x => x.p === "Joueur60");
    T("tableau complet : valeurs exactes, semaine passee comptee zero", j59 && j59.s === 59 && j59.n === 859 && j59.r === 177 && j60 && j60.s === 0 && j60.n === 860, JSON.stringify([j59, j60]));
    T("tableau complet : reunion des six tableaux, sans doublon", r.j.joueurs.length <= 300 && new Set(r.j.joueurs.map(x => x.p)).size === r.j.joueurs.length);
    T("critere inconnu : 400", (await tableau("pin_hash")).s === 400 && (await tableau("note;DROP")).s === 400);
  }

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n" + ok + " OK, " + (ko + 1) + " FAIL"); process.exit(1); });
