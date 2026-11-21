/* Verification automatique de chang64.
   Lancement : node tests/check_partie_directe.js

   Ce que ce test garde (2026-11-19) : la partie en direct entre deux membres
   (worker-parties/index.js), executee contre une base SQLite en memoire et un
   faux Cloudflare (worker-parties/faux_cloudflare.js). Membres seulement ;
   blocage applique ; coups verifies par le serveur ; pendule tenue par le
   serveur, avec increment ; premier coup dans la minute sinon partie annulee ;
   abandon, nulle proposee et acceptee, revanche couleurs inversees ; l'objet
   peut s'endormir entre deux messages ; peu d'ecritures ; message clair quand
   la limite du jour est atteinte. */
const path = require("path"), { pathToFileURL } = require("url"), crypto = require("crypto");
process.removeAllListeners("warning"); process.on("warning", () => {});

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };

const { fausseD1 } = require("../serveur_local.js");
const { fauxCloudflare } = require("../worker-parties/faux_cloudflare.js");
const VRAI_NOW = Date.now;
let decalage = 0;
Date.now = () => VRAI_NOW() + decalage;
const avancer = ms => { decalage += ms; };

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, "..", "worker-parties", "index.js")).href);
  const env = { DB: fausseD1() };
  const faux = fauxCloudflare(mod.Partie, env);
  env.PARTIES = faux.espace;

  /* Membres poses directement dans la base, avec une session chacun. */
  const cookies = {};
  let numero = 0;
  function membre(pseudo) {
    const jeton = crypto.randomBytes(32).toString("base64url"), id = ++numero, now = Date.now();
    env.DB.brut.prepare("INSERT INTO comptes (id, cle, pseudo, pin_hash, secours_hash, cree, vu) VALUES (?, ?, ?, 'x', 'x', ?, ?)").run(id, pseudo.toLowerCase(), pseudo, now, now);
    env.DB.brut.prepare("INSERT INTO jetons (hash, compte_id, cree, vu) VALUES (?, ?, ?, ?)").run(crypto.createHash("sha256").update(jeton).digest("base64url"), id, now, now);
    cookies[pseudo] = "__Secure-c64=" + jeton;
    return id;
  }
  const idAnna = membre("Anna"), idBob = membre("Bob"), idCleo = membre("Cleo"), idDan = membre("Dan");

  const appel = (methode, route, corps, qui, origine) => mod.default.fetch(new Request("https://chang64.com/api/partie/" + route, {
    method: methode,
    headers: Object.assign({ Origin: origine || "https://chang64.com" }, qui ? { Cookie: cookies[qui] } : {}, corps ? { "Content-Type": "application/json" } : {}),
    body: corps ? JSON.stringify(corps) : undefined
  }), env);
  async function creer(qui, cad, adv) {
    const r = await appel("POST", "creer", Object.assign({ cad }, adv ? { adv } : {}), qui);
    return { s: r.status, id: r.status === 200 ? (await r.json()).id : "" };
  }
  async function ouvrir(id, qui, origine) {
    const h = { Upgrade: "websocket" };
    if (origine !== null) h.Origin = origine || "https://chang64.com";
    if (qui) h.Cookie = cookies[qui];
    const r = await mod.default.fetch(new Request("https://chang64.com/api/partie/ws?id=" + id, { headers: h }), env);
    return { s: r.status, ws: r.webSocket || null };
  }
  /* Deux membres assis, rendus dans l'ordre [blancs, noirs]. */
  async function partie(cad, a, b) {
    const { id } = await creer(a || "Anna", cad);
    const x = (await ouvrir(id, a || "Anna")).ws, y = (await ouvrir(id, b || "Bob")).ws;
    return x.dernier().moi === "b" ? { id, B: x, N: y } : { id, B: y, N: x };
  }
  const jouer = (g, coups) => coups.split(" ").reduce((p, c, i) => p.then(() => faux.envoyer(g.id, i % 2 ? g.N : g.B, { t: "coup", c })), Promise.resolve());

  console.log("Acces");
  T("creer sans session : refuse (401)", (await creer(null, 0)).s === 401);
  T("creer depuis un autre site : refuse (403)", (await appel("POST", "creer", { cad: 0 }, "Anna", "https://ailleurs.example")).status === 403);
  T("cadence inconnue : refusee (400)", (await creer("Anna", 99)).s === 400);
  let c = await creer("Anna", 0);
  T("creer : rend un identifiant de 12 signes", c.s === 200 && /^[a-z2-9]{12}$/.test(c.id), c.id);
  T("rejoindre sans session : refuse (401)", (await ouvrir(c.id, null)).s === 401);
  T("WebSocket sans origine : refuse (403)", (await ouvrir(c.id, "Bob", null)).s === 403);
  T("WebSocket depuis un autre site : refuse (403)", (await ouvrir(c.id, "Bob", "https://ailleurs.example")).s === 403);
  T("partie inconnue : 404", (await ouvrir("aaaaaaaaaaaa", "Bob")).s === 404);
  T("route inconnue : 404", (await appel("GET", "autre", null, "Anna")).status === 404);

  console.log("Attente et arrivee");
  let a = (await ouvrir(c.id, "Anna")).ws;
  T("la creatrice attend son adversaire", a.dernier().phase === "attente" && a.dernier().cad.join("+") === "600+0");
  let b = (await ouvrir(c.id, "Bob")).ws;
  let e = a.dernier();
  T("a l'arrivee du second, la partie commence", e.phase === "debut" && [e.b, e.nr].sort().join() === "Anna,Bob" && e.tb === 600000 && e.tn === 600000);
  T("chacun connait sa couleur", a.dernier().moi !== b.dernier().moi && "bn".includes(b.dernier().moi));
  T("les deux sont presents", e.la.b && e.la.n);
  T("un troisieme membre est refuse (403)", (await ouvrir(c.id, "Cleo")).s === 403);
  const a2 = (await ouvrir(c.id, "Anna")).ws;
  T("un joueur peut ouvrir un second onglet", a2 && a2.dernier().moi === a.dernier().moi);

  console.log("Blocage et invitation");
  env.DB.brut.prepare("INSERT INTO blocages (compte_id, bloque_id, cree) VALUES (?, ?, ?)").run(idCleo, idDan, Date.now());
  c = await creer("Dan", 0);
  T("un membre bloque ne rejoint pas la partie (404)", (await ouvrir(c.id, "Cleo")).s === 404);
  c = await creer("Cleo", 0);
  T("ni dans l'autre sens", (await ouvrir(c.id, "Dan")).s === 404);
  T("inviter quelqu'un qui m'a bloque : comme un pseudo inconnu (404)", (await creer("Dan", 0, "Cleo")).s === 404 && (await creer("Dan", 0, "Personne")).s === 404);
  T("s'inviter soi-meme : refuse", (await creer("Dan", 0, "dan")).s === 404);
  c = await creer("Anna", 1, "bob");
  T("inviter par pseudo, sans tenir compte des majuscules", c.s === 200);
  T("la reponse rend le pseudo tel qu'il s'ecrit", (await (await appel("POST", "creer", { cad: 0, adv: "bob" }, "Cleo")).json()).adv === "Bob");
  T("la place est reservee a l'invite", (await ouvrir(c.id, "Cleo")).s === 403 && (await ouvrir(c.id, "Bob")).s === 101);

  console.log("Coups et pendule");
  let g = await partie(1);
  await faux.envoyer(g.id, g.N, { t: "coup", c: "e7e5" });
  T("les noirs ne jouent pas en premier", g.B.dernier().coups.length === 0);
  await faux.envoyer(g.id, g.B, { t: "coup", c: "e2e5" });
  T("un coup illegal est refuse", g.B.dernier().t === "erreur" && g.B.dernier().e === "coup" && g.N.dernier().coups.length === 0);
  avancer(20e3);
  await faux.envoyer(g.id, g.B, { t: "coup", c: "e2e4" });
  avancer(20e3);
  await faux.envoyer(g.id, g.N, { t: "coup", c: "e7e5" });
  e = g.B.dernier();
  T("les deux premiers coups ne coutent pas de temps", e.phase === "jeu" && e.tb === 300000 && e.tn === 300000 && e.coups.join() === "e2e4,e7e5");
  avancer(10e3);
  faux.dormir();
  await faux.envoyer(g.id, g.B, { t: "coup", c: "g1f3" });
  e = g.N.dernier();
  T("apres un sommeil de l'objet, le coup passe et la pendule est juste (10 s jouees, 3 s rendues)", e.coups.length === 3 && Math.abs(e.tb - 293000) < 50 && e.tn === 300000, e.tb);
  await faux.envoyer(g.id, g.B, { t: "coup", c: "f3e5" });
  T("on ne joue pas deux fois de suite", g.N.dernier().coups.length === 3);
  await faux.envoyer(g.id, g.N, "pas du json");
  await faux.envoyer(g.id, g.N, "x".repeat(300));
  T("un message illisible est ignore", g.N.dernier().coups.length === 3);

  console.log("Fin au temps");
  avancer(301e3);
  T("l'alarme sonne", (await faux.sonner(Date.now())) >= 1);
  e = g.B.dernier();
  T("temps ecoule : les noirs perdent", e.phase === "fin" && e.fin.r === "1-0" && e.fin.m === "temps" && e.tn === 0, JSON.stringify(e.fin));
  await faux.envoyer(g.id, g.N, { t: "coup", c: "b8c6" });
  T("plus de coup apres la fin", g.B.dernier().coups.length === 3);
  g = await partie(0);
  await jouer(g, "e2e4 e7e5");
  avancer(601e3);
  await faux.envoyer(g.id, g.B, { t: "coup", c: "g1f3" });
  e = g.N.dernier();
  T("un coup arrive trop tard perd au temps, meme sans alarme", e.phase === "fin" && e.fin.r === "0-1" && e.fin.m === "temps" && e.coups.length === 2);

  console.log("Premier coup dans la minute");
  g = await partie(0);
  avancer(61e3);
  await faux.sonner(Date.now());
  e = g.B.dernier();
  T("pas de premier coup en une minute : partie annulee, personne ne perd", e.phase === "fin" && e.fin.m === "annulee" && e.fin.r === "");
  g = await partie(0);
  avancer(30e3);
  await faux.envoyer(g.id, g.B, { t: "coup", c: "d2d4" });
  avancer(45e3);
  await faux.sonner(Date.now());
  T("la minute des noirs part du coup des blancs", g.B.dernier().phase === "debut");
  avancer(20e3);
  await faux.sonner(Date.now());
  T("les noirs ne repondent pas : annulee aussi", g.B.dernier().fin && g.B.dernier().fin.m === "annulee");

  console.log("Mat, abandon, nulle");
  g = await partie(0);
  await jouer(g, "f2f3 e7e5 g2g4 d8h4");
  e = g.B.dernier();
  T("mat : la partie est finie, les noirs gagnent", e.phase === "fin" && e.fin.r === "0-1" && e.fin.m === "mat");
  g = await partie(0);
  await faux.envoyer(g.id, g.B, { t: "abandon" });
  T("quitter avant que chacun ait joue annule la partie", g.N.dernier().fin.m === "annulee");
  g = await partie(0);
  await jouer(g, "e2e4 e7e5");
  await faux.envoyer(g.id, g.N, { t: "abandon" });
  T("abandon des noirs : les blancs gagnent", g.B.dernier().fin.r === "1-0" && g.B.dernier().fin.m === "abandon");
  g = await partie(0);
  await jouer(g, "e2e4 e7e5");
  await faux.envoyer(g.id, g.B, { t: "nulle" });
  T("nulle proposee par les blancs", g.N.dernier().nulle === "b" && g.N.dernier().phase === "jeu");
  await faux.envoyer(g.id, g.B, { t: "nulle" });
  T("on n'accepte pas sa propre proposition", g.N.dernier().phase === "jeu");
  await faux.envoyer(g.id, g.N, { t: "nulle-non" });
  T("refusee : la proposition disparait", g.B.dernier().nulle === null);
  await faux.envoyer(g.id, g.B, { t: "nulle" });
  T("une seule proposition par coup", g.N.dernier().nulle === null);
  await jouer(g, "g1f3");
  await faux.envoyer(g.id, g.N, { t: "nulle" });
  await faux.envoyer(g.id, g.B, { t: "nulle" });
  T("proposee puis acceptee : nulle par accord", g.B.dernier().fin.r === "1/2" && g.B.dernier().fin.m === "accord");
  g = await partie(0);
  await jouer(g, "g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1 f6g8");
  T("trois fois la meme position : nulle", g.B.dernier().phase === "fin" && g.B.dernier().fin.m === "repetition", JSON.stringify(g.B.dernier().fin));

  console.log("Revanche et reconnexion");
  const blancsAvant = g.B.dernier().b;
  await faux.envoyer(g.id, g.B, { t: "revanche" });
  T("revanche demandee par un seul : on attend", g.N.dernier().phase === "fin" && g.N.dernier().rev.b === true);
  faux.dormir();
  await faux.envoyer(g.id, g.N, { t: "revanche" });
  e = g.B.dernier();
  T("revanche acceptee : nouvelle partie, couleurs inversees", e.phase === "debut" && e.n === 2 && e.coups.length === 0 && e.nr === blancsAvant && e.moi === "n" && e.tb === 600000);
  await faux.envoyer(g.id, g.N, { t: "coup", c: "e2e4" });
  T("l'ancien joueur des noirs joue maintenant les blancs", g.B.dernier().coups.join() === "e2e4");
  await faux.envoyer(g.id, g.B, { t: "coup", c: "e7e5" });
  await faux.quitter(g.id, g.B);
  T("un joueur parti est signale a l'autre, la partie continue", g.N.dernier().la.n === false && g.N.dernier().phase === "jeu");
  const qui = g.N.dernier().nr;
  avancer(5e3);
  const retour = (await ouvrir(g.id, qui)).ws;
  e = retour.dernier();
  T("il revient pendant que la pendule tourne et retrouve la partie", e.moi === "n" && e.coups.length === 2 && e.la.n === true && e.h - e.maj >= 5000);

  console.log("Ecritures et menage");
  g = await partie(0);
  const avant = faux.ecritures;
  await jouer(g, "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d3 d7d6");
  T("dix coups = dix lignes ecrites, pas d'alarme reposee", faux.ecritures - avant === 10, faux.ecritures - avant);
  c = await creer("Anna", 0);
  a = (await ouvrir(c.id, "Anna")).ws;
  avancer(31 * 60e3);
  await faux.sonner(Date.now());
  T("personne ne vient en 30 minutes : la partie est effacee", a.pair.ferme && faux.objets.get(c.id).donnees.size === 0 && (await ouvrir(c.id, "Bob")).s === 404);
  T("une partie finie est effacee apres 30 minutes", faux.objets.get(g.id).donnees.size > 0 && (await faux.envoyer(g.id, g.B, { t: "abandon" }), avancer(31 * 60e3), await faux.sonner(Date.now()), await faux.sonner(Date.now()), faux.objets.get(g.id).donnees.size === 0));

  console.log("Resultats comptes par le serveur");
  env.DB.brut.exec("UPDATE comptes SET direct_v = 0, direct_n = 0, direct_d = 0");
  const bilan = id => { const l = env.DB.brut.prepare("SELECT direct_v AS v, direct_n AS n, direct_d AS d FROM comptes WHERE id = ?").get(id); return l.v + "/" + l.n + "/" + l.d; };
  const idDe = (g, cote) => ({ Anna: idAnna, Bob: idBob })[cote === "B" ? g.B.dernier().b : g.B.dernier().nr];
  g = await partie(0);
  await jouer(g, "f2f3 e7e5 g2g4 d8h4");
  T("mat : une victoire pour l'un, une defaite pour l'autre", bilan(idDe(g, "N")) === "1/0/0" && bilan(idDe(g, "B")) === "0/0/1", bilan(idAnna) + " " + bilan(idBob));
  await faux.envoyer(g.id, g.B, { t: "abandon" });
  T("rien n'est compte deux fois", bilan(idDe(g, "N")) === "1/0/0");
  const somme = () => { const l = env.DB.brut.prepare("SELECT SUM(direct_v) AS v, SUM(direct_n) AS n, SUM(direct_d) AS d FROM comptes").get(); return l.v + "/" + l.n + "/" + l.d; };
  g = await partie(0);
  await faux.envoyer(g.id, g.B, { t: "abandon" });
  T("partie annulee avant que chacun ait joue : rien n'est compte", somme() === "1/0/1", somme());
  g = await partie(0);
  await jouer(g, "e2e4 e7e5");
  await faux.envoyer(g.id, g.B, { t: "nulle" });
  await faux.envoyer(g.id, g.N, { t: "nulle" });
  T("nulle : une nulle chacun", somme() === "1/2/1", somme());
  g = await partie(0);
  await jouer(g, "e2e4 e7e5");
  avancer(601e3);
  await faux.sonner(Date.now());
  T("perte au temps, tombee par l'alarme : comptee", somme() === "2/2/2", somme());
  T("personne d'autre n'est touche", bilan(idCleo) === "0/0/0" && bilan(idDan) === "0/0/0");
  const clas = await import(pathToFileURL(path.join(__dirname, "..", "functions", "api", "classement.js")).href);
  const lire = async par => (await clas.onRequestGet({ request: new Request("https://chang64.com/api/classement?par=" + par), env })).json();
  let tab = await lire("direct");
  T("tableau « parties gagnees » : seuls ceux qui ont gagne, du plus au moins", tab.joueurs.length >= 1 && tab.joueurs.every(x => x.v > 0) && tab.joueurs.map(x => x.v).join() === tab.joueurs.map(x => x.v).sort((x, y) => y - x).join() && tab.joueurs.reduce((s, x) => s + x.v, 0) === 2, JSON.stringify(tab.joueurs));
  tab = await lire("tout");
  T("tableau complet : la colonne des parties gagnees y est", tab.joueurs.some(x => x.d > 0) && tab.joueurs.every(x => typeof x.d === "number"), JSON.stringify(tab.joueurs));
  const compte = await import(pathToFileURL(path.join(__dirname, "..", "functions", "api", "compte", "[[route]].js")).href);
  const fiche = await (await compte.onRequest({ request: new Request("https://chang64.com/api/compte/profil?p=" + tab.joueurs.find(x => x.d > 0).p), env, params: { route: ["profil"] } })).json();
  T("fiche du joueur : gagnees, nulles, perdues, et son rang", fiche.d > 0 && fiche.dir.v === fiche.d && typeof fiche.dir.n === "number" && typeof fiche.dir.d === "number" && fiche.rangs.d >= 1, JSON.stringify([fiche.dir, fiche.rangs]));
  env.DB.brut.exec("ALTER TABLE comptes RENAME COLUMN direct_v TO direct_x");
  g = await partie(0);
  await jouer(g, "f2f3 e7e5 g2g4 d8h4");
  T("sans les colonnes : la partie se finit normalement", g.B.dernier().phase === "fin" && g.B.dernier().fin.m === "mat");
  env.DB.brut.exec("ALTER TABLE comptes RENAME COLUMN direct_x TO direct_v");

  console.log("Couleur au choix et cadences classiques");
  {
    /* Dan cree ces parties : le quota d'Anna (20 creations par heure) sert aux controles suivants. */
    const creerAvec = async (qui, corps) => { const r = await appel("POST", "creer", corps, qui); return { s: r.status, id: r.status === 200 ? (await r.json()).id : "" }; };
    let k = await creerAvec("Dan", { cad: 0, coul: "b" });
    let x = (await ouvrir(k.id, "Dan")).ws, y = (await ouvrir(k.id, "Bob")).ws;
    T("le createur choisit les Blancs : il les a, l'autre a les Noirs", k.s === 200 && x.dernier().moi === "b" && y.dernier().moi === "n", x.dernier().moi + "/" + y.dernier().moi);
    k = await creerAvec("Dan", { cad: 0, coul: "n" });
    x = (await ouvrir(k.id, "Dan")).ws; y = (await ouvrir(k.id, "Bob")).ws;
    T("le createur choisit les Noirs : il les a", x.dernier().moi === "n" && y.dernier().moi === "b");
    T("« au hasard » est accepte, une couleur inconnue est refusee (400)", (await creerAvec("Dan", { cad: 0, coul: "h" })).s === 200 && (await creerAvec("Dan", { cad: 0, coul: "rouge" })).s === 400);
    k = await creerAvec("Dan", { cad: 3, coul: "b" });
    x = (await ouvrir(k.id, "Dan")).ws; y = (await ouvrir(k.id, "Bob")).ws;
    T("cadence classique 30+0 : trente minutes chacun", k.s === 200 && x.dernier().cad.join("+") === "1800+0" && x.dernier().tb === 1800e3 && x.dernier().tn === 1800e3, JSON.stringify(x.dernier().cad));
    k = await creerAvec("Dan", { cad: 4 });
    x = (await ouvrir(k.id, "Dan")).ws;
    T("cadence classique 30+20 : l'increment est de 20 secondes", x.dernier().cad.join("+") === "1800+20");
    T("60+0 existe, pas de septieme cadence", (await creerAvec("Dan", { cad: 5 })).s === 200 && (await creerAvec("Dan", { cad: 6 })).s === 400);
    env.DB.brut.exec("DELETE FROM invitations");
    k = await creerAvec("Dan", { cad: 4, coul: "b", adv: "Bob" });
    const inv = (await (await appel("GET", "invitations", null, "Bob")).json()).liste;
    T("l'invitation dit la cadence et la couleur de l'invite (Noirs)", inv.length === 1 && inv[0].id === k.id && inv[0].cad === 4 && inv[0].coul === "n", JSON.stringify(inv));
    env.DB.brut.prepare("UPDATE invitations SET cad = 2 WHERE partie = ?").run(k.id);
    const anc = (await (await appel("GET", "invitations", null, "Bob")).json()).liste;
    T("une ancienne invitation, sans couleur, se lit toujours", anc.length === 1 && anc[0].cad === 2 && anc[0].coul === null, JSON.stringify(anc));
    env.DB.brut.exec("DELETE FROM invitations");
  }

  console.log("Invitations");
  const recues = async qui => (await (await appel("GET", "invitations", null, qui)).json()).liste;
  const enBase = () => env.DB.brut.prepare("SELECT COUNT(*) AS n FROM invitations").get().n;
  T("lire ses invitations sans session : refuse (401)", (await appel("GET", "invitations", null, null)).status === 401);
  env.DB.brut.exec("DELETE FROM invitations");
  c = await creer("Anna", 2, "Bob");
  let l = await recues("Bob");
  T("l'invite voit l'invitation : qui, quelle cadence, quelle partie", l.length === 1 && l[0].id === c.id && l[0].p === "Anna" && l[0].cad === 2, JSON.stringify(l));
  T("personne d'autre ne la voit, pas meme celle qui invite", (await recues("Cleo")).length === 0 && (await recues("Anna")).length === 0);
  T("une partie par lien ne laisse aucune invitation", (await creer("Anna", 0), enBase() === 1));
  T("l'invite rejoint : l'invitation est effacee", (await ouvrir(c.id, "Bob")).s === 101 && enBase() === 0);
  c = await creer("Anna", 0, "Bob");
  T("refuser depuis un autre site : refuse (403)", (await appel("POST", "refuser", { id: c.id }, "Bob", "https://ailleurs.example")).status === 403);
  T("un tiers ne peut pas refuser a la place de l'invite", (await appel("POST", "refuser", { id: c.id }, "Cleo"), enBase() === 1));
  T("l'invite refuse : l'invitation disparait", (await appel("POST", "refuser", { id: c.id }, "Bob")).status === 200 && (await recues("Bob")).length === 0);
  c = await creer("Anna", 1, "Bob");
  a = (await ouvrir(c.id, "Anna")).ws;
  T("celle qui attend voit qui elle a invite", a.dernier().phase === "attente" && a.dernier().inv === "Bob");
  await appel("POST", "refuser", { id: c.id }, "Cleo");
  T("le refus d'un tiers ne change rien a la partie", a.dernier().phase === "attente");
  await appel("POST", "refuser", { id: c.id }, "Bob");
  T("l'invite refuse : celle qui a invite est prevenue, personne ne perd", a.dernier().phase === "fin" && a.dernier().fin.m === "refusee" && a.dernier().fin.r === "" && a.dernier().inv === "Bob");
  T("la partie refusee ne se rejoint plus", (await ouvrir(c.id, "Bob")).s === 403);
  c = await creer("Anna", 0);
  a = (await ouvrir(c.id, "Anna")).ws;
  await appel("POST", "refuser", { id: c.id }, "Bob");
  T("une partie par lien ne peut pas etre « refusee »", a.dernier().phase === "attente" && a.dernier().inv === null);
  for (let i = 0; i < 3; i++) await creer("Anna", 0, "Bob");
  let r4 = await appel("POST", "creer", { cad: 0, adv: "Bob" }, "Anna");
  T("trois invitations en attente vers le meme membre, la quatrieme est refusee (429)", r4.status === 429 && (await r4.json()).erreur === "invitations" && enBase() === 3);
  env.DB.brut.prepare("INSERT INTO blocages (compte_id, bloque_id, cree) VALUES (?, ?, ?)").run(idBob, idAnna, Date.now());
  T("celui qui bloque apres coup ne voit plus les invitations du membre bloque", (await recues("Bob")).length === 0);
  env.DB.brut.exec("DELETE FROM blocages WHERE compte_id = " + idBob);
  avancer(31 * 60e3);
  T("apres 30 minutes, l'invitation n'est plus montree", (await recues("Bob")).length === 0);
  await creer("Cleo", 0, "Bob");
  T("et les vieilles lignes sont effacees a l'invitation suivante", enBase() === 1);
  const sauve = env.DB.brut.prepare("SELECT sql FROM sqlite_master WHERE name = 'invitations'").get().sql;
  env.DB.brut.exec("DROP TABLE invitations");
  c = await creer("Anna", 0, "Bob");
  T("sans la table : la partie se cree, reste reservee, et la liste est vide", c.s === 200 && (await recues("Bob")).length === 0 && (await ouvrir(c.id, "Cleo")).s === 403 && (await ouvrir(c.id, "Bob")).s === 101);
  env.DB.brut.exec(sauve);

  console.log("Plafond de creations");
  avancer(3601e3);
  let statuts = [];
  for (let i = 0; i < 21; i++) statuts.push((await creer("Dan", 0)).s);
  T("20 parties creees dans l'heure passent, la 21e est refusee (429)", statuts.slice(0, 20).every(x => x === 200) && statuts[20] === 429, statuts.join());
  T("le plafond est par membre", (await creer("Cleo", 0)).s === 200);
  avancer(3601e3);
  T("une heure plus tard, on peut de nouveau creer", (await creer("Dan", 0)).s === 200);

  console.log("Limite du jour");
  g = await partie(0);
  faux.panne = true;
  await faux.envoyer(g.id, g.B, { t: "coup", c: "e2e4" });
  T("ecriture refusee : le joueur recoit un message clair", g.B.dernier().t === "erreur" && g.B.dernier().e === "limite");
  const r = await appel("POST", "creer", { cad: 0 }, "Anna");
  T("creer une partie repond 503 « limite », sans planter", r.status === 503 && (await r.json()).erreur === "limite");
  faux.panne = false;
  await faux.envoyer(g.id, g.B, { t: "coup", c: "e2e4" });
  T("la limite levee, la partie reprend dans l'etat garde", g.N.dernier().coups.join() === "e2e4");

  /* Adversaire au hasard (2026-11-19) : salle d'attente par cadence, priorite
     au niveau le plus proche. */
  console.log("Adversaire au hasard");
  {
    const chercher = async (qui, cad, origine) => { const r = await appel("POST", "chercher", { cad }, qui, origine); return Object.assign({ s: r.status }, r.status === 200 ? await r.json() : {}); };
    const fin = qui => appel("POST", "chercher-fin", {}, qui);
    const idEve = membre("Eve"), idFay = membre("Fay"), idGus = membre("Gus");
    env.DB.brut.prepare("UPDATE comptes SET note = 800 WHERE id = ?").run(idEve);
    env.DB.brut.prepare("UPDATE comptes SET note = 1500 WHERE id = ?").run(idFay);
    env.DB.brut.prepare("UPDATE comptes SET note = 900 WHERE id = ?").run(idGus);
    T("chercher sans session : refuse (401)", (await chercher(null, 0)).s === 401);
    T("chercher depuis un autre site : refuse (403)", (await chercher("Eve", 0, "https://ailleurs.example")).s === 403);
    T("cadence inconnue : refusee (400)", (await chercher("Eve", 99)).s === 400);
    const e1 = await chercher("Eve", 0);
    T("le premier qui cherche attend dans une partie ouverte", e1.s === 200 && e1.attente === true && /^[a-z2-9]{12}$/.test(e1.id), JSON.stringify(e1));
    T("il peut s'y asseoir : la partie attend un adversaire", (await ouvrir(e1.id, "Eve")).ws.dernier().phase === "attente");
    T("redemander en attendant : la meme partie, pas une nouvelle", (await chercher("Eve", 0)).id === e1.id);
    T("une autre cadence ne se melange pas", (await chercher("Fay", 1)).attente === true);
    await fin("Fay");
    const g1 = await chercher("Gus", 0);
    T("le second, a la meme cadence, recoit la partie du premier", g1.s === 200 && g1.attente === false && g1.id === e1.id, JSON.stringify(g1));
    const wsG = (await ouvrir(e1.id, "Gus")).ws;
    T("il la rejoint : la partie commence entre les deux", wsG && wsG.dernier().phase === "debut" && [wsG.dernier().b, wsG.dernier().nr].sort().join() === "Eve,Gus");
    T("la salle est vide ensuite : le suivant attend a son tour", (await chercher("Fay", 0)).attente === true);
    /* Deux membres attendent a des cadences... non : a la meme, c'est impossible
       sans blocage. On pose donc deux attentes a la main pour verifier le choix. */
    await fin("Fay");
    const salle = faux.objets.get("salle-attente").donnees;
    salle.set("salle", JSON.stringify([{ cad: 2, j: idFay, note: 1500, id: "aaaaaaaaaaaa", t: Date.now() }, { cad: 2, j: idGus, note: 900, id: "bbbbbbbbbbbb", t: Date.now() }]));
    const lire = () => JSON.parse(faux.objets.get("salle-attente").donnees.get("salle") || "[]");
    T("plusieurs en attente : le niveau le plus proche d'abord", (await chercher("Eve", 2)).id === "bbbbbbbbbbbb");
    T("celui qui reste attend toujours", lire().length === 1 && lire()[0].j === idFay);
    /* Blocage : deux membres qui se sont bloques ne sont jamais reunis. */
    env.DB.brut.prepare("INSERT INTO blocages (compte_id, bloque_id, cree) VALUES (?, ?, 1)").run(idFay, idEve);
    const e2 = await chercher("Eve", 2);
    T("un membre qui m'a bloque n'est pas propose", e2.attente === true && e2.id !== "aaaaaaaaaaaa");
    env.DB.brut.exec("DELETE FROM blocages");
    await fin("Eve"); await fin("Fay");
    /* Sans nouvelles pendant 40 secondes, on sort de la salle. */
    const e3 = await chercher("Eve", 0);
    avancer(41000);
    const f3 = await chercher("Fay", 0);
    T("quarante secondes sans nouvelles : on n'est plus propose", f3.attente === true && f3.id !== e3.id);
    await fin("Fay");
    T("arreter de chercher vide sa place", lire().length === 0);
  }

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception : " + (e && e.stack || e)); process.exit(1); });
