/* Verification automatique de chang64.
   Lancement : node tests/check_correspondance.js

   Ce que ce test garde (2026-11-21) : la partie par correspondance tenue par
   le serveur des parties (worker-parties/index.js), executee contre une base
   SQLite en memoire et un faux Cloudflare. Decisions d'Alexandre du 21/11 :
   1, 3 ou 7 jours PAR COUP ; delai depasse = partie perdue (annulee tant que
   chacun n'a pas joue son premier coup) ; 10 parties en cours au plus ;
   invitation par pseudo ET adversaire au hasard ; meme Elo entre membres que
   le direct. Le serveur tient l'echeance, meme quand personne n'est la ;
   l'annuaire (table correspondances) donne a chacun la liste de ses parties
   et lui dit quand c'est son tour. Les cadences du direct gardent leur numero. */
const path = require("path"), { pathToFileURL } = require("url"), crypto = require("crypto");
process.removeAllListeners("warning"); process.on("warning", () => {});

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + (typeof d === "string" ? d : JSON.stringify(d)) : "")); } };

const { fausseD1 } = require("../serveur_local.js");
const { fauxCloudflare } = require("../worker-parties/faux_cloudflare.js");
const VRAI_NOW = Date.now;
let decalage = 0;
Date.now = () => VRAI_NOW() + decalage;
const avancer = ms => { decalage += ms; };
const HEURE = 3600e3, JOUR = 24 * HEURE;

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, "..", "worker-parties", "index.js")).href);
  const env = { DB: fausseD1() };
  const faux = fauxCloudflare(mod.Partie, env);
  env.PARTIES = faux.espace;
  const sql = (q, ...a) => env.DB.brut.prepare(q).all(...a);
  const ligne = id => sql("SELECT * FROM correspondances WHERE partie = ?", id)[0];

  const cookies = {}, ids = {};
  let numero = 0;
  function membre(pseudo) {
    const jeton = crypto.randomBytes(32).toString("base64url"), id = ++numero, now = Date.now();
    env.DB.brut.prepare("INSERT INTO comptes (id, cle, pseudo, pin_hash, secours_hash, cree, vu) VALUES (?, ?, ?, 'x', 'x', ?, ?)").run(id, pseudo.toLowerCase(), pseudo, now, now);
    env.DB.brut.prepare("INSERT INTO jetons (hash, compte_id, cree, vu) VALUES (?, ?, ?, ?)").run(crypto.createHash("sha256").update(jeton).digest("base64url"), id, now, now);
    cookies[pseudo] = "__Secure-c64=" + jeton;
    return (ids[pseudo] = id);
  }
  for (const p of ["Anna", "Bob", "Cleo", "Dan", "Eve", "Fred"]) membre(p);

  const appel = (methode, route, corps, qui, origine) => mod.default.fetch(new Request("https://chang64.com/api/partie/" + route, {
    method: methode,
    headers: Object.assign({ Origin: origine || "https://chang64.com" }, qui ? { Cookie: cookies[qui] } : {}, corps ? { "Content-Type": "application/json" } : {}),
    body: corps ? JSON.stringify(corps) : undefined
  }), env);
  const post = async (route, corps, qui) => { const r = await appel("POST", route, corps, qui); return Object.assign({ s: r.status }, await r.json().catch(() => ({}))); };
  const liste = async qui => (await (await appel("GET", "invitations", null, qui)).json()).corr;
  const dans = async (qui, id) => (await liste(qui)).find(x => x.id === id);
  async function ouvrir(id, qui) {
    const r = await mod.default.fetch(new Request("https://chang64.com/api/partie/ws?id=" + id, { headers: { Upgrade: "websocket", Origin: "https://chang64.com", Cookie: cookies[qui] } }), env);
    return { s: r.status, ws: r.webSocket || null };
  }
  const coup = (id, ws, c) => faux.envoyer(id, ws, { t: "coup", c });
  /* Une partie lancee et acceptee, sans aucun fil ouvert. */
  async function lancee(cad, a, b, coul) {
    const c = await post("creer", { cad, adv: b, coul: coul || "b" }, a);
    await post("accepter", { id: c.id }, b);
    return c.id;
  }

  console.log("Cadences");
  T("les cadences du direct gardent leur numero (0 a 5)", await (async () => {
    const attendu = ["600+0", "300+3", "900+10", "1800+0", "1800+20", "3600+0"];
    for (let i = 0; i < 6; i++) {
      const c = await post("creer", { cad: i }, "Fred");
      if ((await ouvrir(c.id, "Fred")).ws.dernier().cad.join("+") !== attendu[i]) return false;
    }
    return true;
  })());
  T("la correspondance s'ajoute a la suite : 6, 7, 8 = 1, 3, 7 jours par coup", await (async () => {
    const jours = [];
    for (const cad of [6, 7, 8]) { const c = await post("creer", { cad, adv: "Eve" }, "Fred"); jours.push((await ouvrir(c.id, "Fred")).ws.dernier().cad[0] / 86400); await post("retirer", { id: c.id }, "Fred"); }
    return jours.join() === "1,3,7";
  })());
  /* Le numero 10 est le Rapide 10+5 depuis le 2026-11-22 : on prend plus loin. */
  T("cadence inconnue : refusee (400)", (await post("creer", { cad: 11, adv: "Bob" }, "Anna")).s === 400 && (await post("creer", { cad: 99, adv: "Bob" }, "Anna")).s === 400);
  {
    /* Blitz 3+2 (2026-11-21) : numero 9, apres la correspondance ; c'est une partie EN DIRECT. */
    const d = await post("creer", { cad: 9, coul: "b" }, "Fred");
    const fb = (await ouvrir(d.id, "Fred")).ws, fn = (await ouvrir(d.id, "Eve")).ws;
    T("le blitz 3+2 porte le numero 9 et se joue en direct", d.s === 200 && fb.dernier().cad.join("+") === "180+2" && fb.dernier().tb === 180000 && !ligne(d.id), fb.dernier().cad);
    await coup(d.id, fb, "e2e4"); await coup(d.id, fn, "e7e5");
    avancer(10e3);
    await coup(d.id, fb, "g1f3");
    T("sa pendule court et gagne 2 secondes par coup", Math.abs(fb.dernier().tb - 172000) < 500 && fb.dernier().phase === "jeu", fb.dernier().tb);
    await faux.envoyer(d.id, fb, { t: "revanche" });
    avancer(181e3);
    await faux.sonner(Date.now());
    T("le temps tombe en minutes, pas en jours", fb.dernier().phase === "fin" && fb.dernier().fin.m === "temps" && fb.dernier().fin.r === "1-0", fb.dernier().fin);
    T("l'adversaire au hasard existe aussi en blitz", (await post("chercher", { cad: 9 }, "Fred")).attente === true && (await post("chercher-fin", {}, "Fred")).s === 200);
  }
  T("par correspondance, creer demande un adversaire (400 sans pseudo)", (await post("creer", { cad: 7 }, "Anna")).s === 400);
  T("sans session : refuse (401)", (await post("creer", { cad: 7, adv: "Bob" }, null)).s === 401 && (await appel("POST", "accepter", { id: "aaaaaaaaaaaa" }, null)).status === 401);

  console.log("Invitation");
  let c = await post("creer", { cad: 7, adv: "bob", coul: "b" }, "Anna");
  T("inviter par pseudo : la partie est creee", c.s === 200 && /^[a-z2-9]{12}$/.test(c.id) && c.adv === "Bob", c);
  T("aucune ligne dans la table des invitations du direct", sql("SELECT COUNT(*) AS n FROM invitations WHERE partie = ?", c.id)[0].n === 0);
  let x = await dans("Anna", c.id);
  T("celle qui invite la voit « envoyee », avec le pseudo de l'invite", x && x.s === "envoyee" && x.adv === "Bob" && x.coul === "b" && x.cad === 7, x);
  x = await dans("Bob", c.id);
  T("l'invite la voit « invite », avec sa couleur et le delai", x && x.s === "invite" && x.adv === "Anna" && x.coul === "n" && x.cad === 7, x);
  T("l'invitation vaut 7 jours", x && Math.abs(x.ech - Date.now() - 7 * JOUR) < 5000, x && x.ech - Date.now());
  T("un autre membre ne la voit pas", !(await dans("Cleo", c.id)));
  T("un autre membre ne peut pas l'accepter (403)", (await post("accepter", { id: c.id }, "Cleo")).s === 403);
  T("partie inconnue : 404", (await post("accepter", { id: "aaaaaaaaaaaa" }, "Bob")).s === 404);
  let r = await post("accepter", { id: c.id }, "Bob");
  T("l'invite accepte, sans ouvrir la partie", r.s === 200 && r.id === c.id, r);
  x = await dans("Anna", c.id);
  T("la partie est en cours, a Anna de jouer (elle a les Blancs)", x && x.s === "jeu" && x.atoi === true && x.adv === "Bob", x);
  x = await dans("Bob", c.id);
  T("pour Bob ce n'est pas son tour", x && x.s === "jeu" && x.atoi === false && x.adv === "Anna", x);
  T("le delai du premier coup est celui de la partie (3 jours)", Math.abs(x.ech - Date.now() - 3 * JOUR) < 5000, x.ech - Date.now());

  console.log("Coups espaces, objet endormi entre deux");
  const id = c.id;
  faux.dormir();
  let a = (await ouvrir(id, "Anna")).ws;
  T("en revenant, on retrouve la partie", a && a.dernier().phase === "debut" && a.dernier().moi === "b" && a.dernier().cad[0] === 259200);
  await coup(id, a, "e2e4");
  await faux.quitter(id, a);
  T("apres le coup des Blancs, a Bob de jouer", (await dans("Bob", id)).atoi === true && (await dans("Anna", id)).atoi === false);
  avancer(2 * JOUR + 5 * HEURE);
  faux.dormir();
  await faux.sonner(Date.now());
  T("deux jours plus tard la partie tient toujours", ligne(id).etat === 1 && ligne(id).trait === ids.Bob && faux.objets.get(id).alarme > Date.now());
  let b = (await ouvrir(id, "Bob")).ws;
  let e = b.dernier();
  T("Bob retrouve la position et le coup joue", e.coups.join() === "e2e4" && e.moi === "n");
  T("il lui reste environ 19 heures", Math.abs(e.maj + e.tn - e.h - 19 * HEURE) < 60e3, (e.maj + e.tn - e.h) / HEURE);
  await coup(id, b, "e7e5");
  e = b.dernier();
  T("son coup passe, la pendule de chacun repart a 3 jours", e.phase === "jeu" && e.coups.length === 2 && e.tb === 259200000 && e.tn === 259200000, [e.tb, e.tn]);
  T("l'echeance de l'annuaire est repoussee de 3 jours", Math.abs(ligne(id).echeance - Date.now() - 3 * JOUR) < 5000 && ligne(id).trait === ids.Anna);
  await faux.quitter(id, b);
  avancer(2 * JOUR + 23 * HEURE);
  faux.dormir();
  a = (await ouvrir(id, "Anna")).ws;
  await coup(id, a, "g1f3");
  T("un coup joue une heure avant l'echeance est accepte", a.dernier().coups.length === 3 && a.dernier().phase === "jeu");
  T("le delai ne s'accumule pas : 3 jours, pas plus", a.dernier().tb === 259200000);
  await coup(id, a, "f3e5");
  T("on ne joue pas deux fois de suite", a.dernier().coups.length === 3);
  await faux.envoyer(id, a, { t: "revanche" });
  T("pas de revanche en cours de partie", a.dernier().phase === "jeu");
  await faux.quitter(id, a);

  console.log("Delai depasse");
  avancer(3 * JOUR + 60e3);
  faux.dormir();
  T("l'alarme sonne a l'echeance, sans personne", (await faux.sonner(Date.now())) >= 1);
  T("la partie est perdue au temps par Bob", ligne(id).etat === 2 && ligne(id).res === "1-0", ligne(id));
  x = await dans("Bob", id);
  T("Bob la trouve finie et perdue dans sa liste", x && x.s === "fin" && x.r === "loss", x);
  x = await dans("Anna", id);
  T("Anna la trouve finie et gagnee", x && x.s === "fin" && x.r === "win", x);
  T("les resultats sont comptes par le serveur", sql("SELECT direct_v FROM comptes WHERE id = ?", ids.Anna)[0].direct_v === 1 && sql("SELECT direct_d FROM comptes WHERE id = ?", ids.Bob)[0].direct_d === 1);
  /* Depuis l'Elo par famille (2026-11-21 au soir) : c'est l'Elo Correspondance qui bouge, pas le Rapide. */
  T("l'Elo Correspondance bouge, l'Elo Rapide non", sql("SELECT elo_corr FROM comptes WHERE id = ?", ids.Anna)[0].elo_corr === 820 && sql("SELECT elo_corr FROM comptes WHERE id = ?", ids.Bob)[0].elo_corr === 780 && sql("SELECT elo, elo_n, elo_corr_n FROM comptes WHERE id = ?", ids.Anna)[0].elo === 0 && sql("SELECT elo_corr_n FROM comptes WHERE id = ?", ids.Anna)[0].elo_corr_n === 1, sql("SELECT pseudo, elo, elo_corr, elo_corr_n FROM comptes WHERE id < 3"));
  a = (await ouvrir(id, "Anna")).ws;
  e = a.dernier();
  T("en l'ouvrant, Anna voit la fin : temps, 1-0, variation d'Elo", e.phase === "fin" && e.fin.r === "1-0" && e.fin.m === "temps" && e.elo && e.elo.b.d === 20, e.fin);
  T("une fois vue, elle quitte sa liste", !(await dans("Anna", id)));
  T("mais reste dans celle de Bob, qui ne l'a pas vue", !!(await dans("Bob", id)));
  await faux.envoyer(id, a, { t: "revanche" });
  T("pas de revanche dans la meme partie par correspondance", a.dernier().phase === "fin" && !a.dernier().rev.b);
  await faux.quitter(id, a);
  avancer(13 * JOUR);
  await faux.sonner(Date.now());
  T("13 jours apres la fin, la partie est encore la", !!ligne(id) && faux.objets.get(id).donnees.size > 0);
  avancer(JOUR + HEURE);
  await faux.sonner(Date.now()); await faux.sonner(Date.now());
  T("14 jours apres la fin, elle est effacee, sa ligne aussi", !ligne(id) && faux.objets.get(id).donnees.size === 0);

  console.log("Premier coup non joue");
  let g = await lancee(6, "Anna", "Bob");
  avancer(JOUR + 60e3);
  await faux.sonner(Date.now());
  T("personne n'a joue : la partie est annulee, personne ne perd", ligne(g).etat === 2 && ligne(g).res === "" && (await dans("Anna", g)).r === "annulee");
  g = await lancee(6, "Anna", "Bob");
  a = (await ouvrir(g, "Anna")).ws; await coup(g, a, "d2d4"); await faux.quitter(g, a);
  avancer(JOUR + 60e3);
  await faux.sonner(Date.now());
  T("les Noirs n'ont pas joue leur premier coup : annulee aussi", ligne(g).res === "" && sql("SELECT elo_corr_n FROM comptes WHERE id = ?", ids.Anna)[0].elo_corr_n === 1);

  console.log("Echeance verifiee meme sans alarme");
  g = await lancee(6, "Cleo", "Dan");
  a = (await ouvrir(g, "Cleo")).ws; await coup(g, a, "e2e4"); await faux.quitter(g, a);
  b = (await ouvrir(g, "Dan")).ws; await coup(g, b, "e7e5"); await faux.quitter(g, b);
  avancer(JOUR + 10e3);
  faux.objets.get(g).alarme = null;   /* l'alarme n'a pas sonne */
  x = await dans("Dan", g);
  T("la liste reveille une partie en retard : Cleo a perdu au temps", x && x.s === "fin" && x.r === "win" && ligne(g).res === "0-1", x);
  g = await lancee(6, "Cleo", "Dan");
  a = (await ouvrir(g, "Cleo")).ws; await coup(g, a, "e2e4");
  b = (await ouvrir(g, "Dan")).ws; await coup(g, b, "e7e5");
  avancer(JOUR + 10e3);
  faux.objets.get(g).alarme = null;
  await coup(g, a, "g1f3");
  T("un coup arrive apres l'echeance est refuse : le temps est tombe", a.dernier().phase === "fin" && a.dernier().fin.m === "temps" && a.dernier().fin.r === "0-1" && a.dernier().coups.length === 2);
  T("les deux etaient la : la fin est vue par les deux", ligne(g).vu === 3 && !(await dans("Cleo", g)) && !(await dans("Dan", g)));

  console.log("Fin de partie : mat, abandon, nulle");
  g = await lancee(7, "Cleo", "Dan");
  a = (await ouvrir(g, "Cleo")).ws; b = (await ouvrir(g, "Dan")).ws;
  for (const [k, cp] of ["f2f3", "e7e5", "g2g4", "d8h4"].entries()) { avancer(5 * HEURE); await coup(g, k % 2 ? b : a, cp); }
  T("mat : la partie finit, gagnee par les Noirs", a.dernier().phase === "fin" && a.dernier().fin.m === "mat" && ligne(g).res === "0-1" && ligne(g).trait === 0);
  g = await lancee(7, "Cleo", "Dan");
  a = (await ouvrir(g, "Cleo")).ws; await coup(g, a, "e2e4"); await faux.quitter(g, a);
  b = (await ouvrir(g, "Dan")).ws; await coup(g, b, "e7e5");
  await faux.envoyer(g, b, { t: "nulle" });
  await faux.quitter(g, b);
  avancer(JOUR);
  faux.dormir();
  a = (await ouvrir(g, "Cleo")).ws;
  T("une nulle proposee attend le retour de l'adversaire", a.dernier().nulle === "n");
  await faux.envoyer(g, a, { t: "nulle" });
  T("acceptee : nulle par accord", a.dernier().fin.r === "1/2" && a.dernier().fin.m === "accord" && (await dans("Dan", g)).r === "draw");
  g = await lancee(7, "Cleo", "Dan");
  a = (await ouvrir(g, "Cleo")).ws; await coup(g, a, "e2e4"); b = (await ouvrir(g, "Dan")).ws; await coup(g, b, "e7e5");
  await faux.quitter(g, a);
  await faux.envoyer(g, b, { t: "abandon" });
  T("abandon : perdu pour celui qui abandonne, l'autre le trouve dans sa liste", ligne(g).res === "1-0" && (await dans("Cleo", g)).r === "win" && !(await dans("Dan", g)));

  console.log("Refuser, retirer, laisser passer");
  c = await post("creer", { cad: 8, adv: "Dan" }, "Cleo");
  r = await post("refuser", { id: c.id }, "Dan");
  x = await dans("Cleo", c.id);
  T("invitation refusee : celle qui invitait le voit, sans autre detail", r.s === 200 && x && x.s === "fin" && x.r === "refus" && x.adv === "Dan", x);
  T("elle a quitte la liste de l'invite", !(await dans("Dan", c.id)));
  T("une invitation refusee ne peut plus etre acceptee", (await post("accepter", { id: c.id }, "Dan")).s === 403);
  c = await post("creer", { cad: 8, adv: "Dan" }, "Cleo");
  T("un autre que le createur ne retire pas l'invitation", (await post("retirer", { id: c.id }, "Dan")).s === 404 && !!ligne(c.id));
  r = await post("retirer", { id: c.id }, "Cleo");
  T("le createur retire son invitation : elle disparait des deux listes", r.s === 200 && !ligne(c.id) && !(await dans("Dan", c.id)) && !(await dans("Cleo", c.id)));
  c = await post("creer", { cad: 8, adv: "Dan" }, "Cleo");
  avancer(7 * JOUR + HEURE);
  T("apres 7 jours sans reponse, l'invitation n'est plus proposee", !(await dans("Dan", c.id)));
  await faux.sonner(Date.now());
  T("et elle est effacee", !ligne(c.id) && faux.objets.get(c.id).donnees.size === 0);
  env.DB.brut.prepare("INSERT INTO blocages (compte_id, bloque_id, cree) VALUES (?, ?, ?)").run(ids.Eve, ids.Fred, Date.now());
  T("inviter un membre qui m'a bloque : comme un pseudo inconnu", (await post("creer", { cad: 7, adv: "Eve" }, "Fred")).s === 404 && (await post("creer", { cad: 7, adv: "Personne" }, "Fred")).s === 404);
  T("s'inviter soi-meme : refuse", (await post("creer", { cad: 7, adv: "fred" }, "Fred")).s === 404);
  env.DB.brut.prepare("DELETE FROM blocages").run();

  console.log("Adversaire au hasard");
  r = await post("chercher", { cad: 7 }, "Eve");
  T("personne ne cherche : ma recherche est ouverte et attend", r.s === 200 && r.attente === true && (await dans("Eve", r.id)).s === "cherche", r);
  const rEve = r.id;
  T("redemander ne cree pas une seconde recherche", (await post("chercher", { cad: 7 }, "Eve")).id === rEve && sql("SELECT COUNT(*) AS n FROM correspondances WHERE etat = 0 AND pour = 0")[0].n === 1);
  r = await post("chercher", { cad: 6 }, "Fred");
  T("un autre delai ne rencontre pas cette recherche", r.attente === true && r.id !== rEve);
  await post("retirer", { id: r.id }, "Fred");
  avancer(2 * JOUR);
  r = await post("chercher", { cad: 7 }, "Fred");
  T("deux jours plus tard, un membre qui cherche le meme delai la rejoint", r.s === 200 && r.attente === false && r.id === rEve, r);
  x = await dans("Eve", rEve);
  T("la partie a commence pour les deux, sans qu'Eve soit la", x && x.s === "jeu" && x.adv === "Fred" && (await dans("Fred", rEve)).adv === "Eve");
  T("un seul des deux a le trait", [x.atoi, (await dans("Fred", rEve)).atoi].sort().join() === "false,true");
  env.DB.brut.prepare("INSERT INTO blocages (compte_id, bloque_id, cree) VALUES (?, ?, ?)").run(ids.Anna, ids.Bob, Date.now());
  r = await post("chercher", { cad: 8 }, "Anna");
  const r2 = await post("chercher", { cad: 8 }, "Bob");
  T("on ne tombe pas sur un membre bloque", r2.attente === true && r2.id !== r.id);
  env.DB.brut.prepare("DELETE FROM blocages").run();
  await post("retirer", { id: r.id }, "Anna"); await post("retirer", { id: r2.id }, "Bob");
  /* Le plus proche de mon niveau d'abord. */
  env.DB.brut.prepare("UPDATE comptes SET elo = 1500 WHERE id = ?").run(ids.Cleo);
  env.DB.brut.prepare("UPDATE comptes SET elo = 900 WHERE id = ?").run(ids.Dan);
  env.DB.brut.prepare("UPDATE comptes SET elo = 950 WHERE id = ?").run(ids.Eve);
  const rc = await post("chercher", { cad: 8 }, "Cleo");
  env.DB.brut.prepare("UPDATE correspondances SET pour = -1 WHERE partie = ?").run(rc.id);   /* cachee le temps que Dan ouvre la sienne */
  const rd = await post("chercher", { cad: 8 }, "Dan");
  env.DB.brut.prepare("UPDATE correspondances SET pour = 0 WHERE partie = ?").run(rc.id);
  r = await post("chercher", { cad: 8 }, "Eve");
  T("parmi plusieurs recherches, la plus proche de mon niveau", r.id === rd.id && r.attente === false, [r.id, rd.id, rc.id]);
  await post("retirer", { id: rc.id }, "Cleo");

  console.log("Dix parties au plus");
  for (const p of ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9", "G10", "G11", "G12", "Hugo"]) membre(p);
  let dernier = null;
  for (let i = 1; i <= 10; i++) dernier = await post("creer", { cad: 8, adv: "G" + i }, "Hugo");
  T("dix invitations envoyees : acceptees", dernier.s === 200 && (await liste("Hugo")).length === 10);
  r = await post("creer", { cad: 8, adv: "G11" }, "Hugo");
  T("la onzieme est refusee (« plein »)", r.s === 429 && r.erreur === "plein", r);
  T("chercher au hasard aussi", (await post("chercher", { cad: 8 }, "Hugo")).erreur === "plein");
  c = await post("creer", { cad: 8, adv: "Hugo" }, "G12");
  T("accepter une invitation aussi", (await post("accepter", { id: c.id }, "Hugo")).erreur === "plein");
  T("ouvrir le fil d'une invitation aussi (403)", (await ouvrir(c.id, "Hugo")).s === 403);
  T("le direct n'est pas concerne par ce plafond", (await post("creer", { cad: 0 }, "Hugo")).s === 200);
  await post("retirer", { id: dernier.id }, "Hugo");
  T("une place liberee : l'invitation recue peut etre acceptee", (await post("accepter", { id: c.id }, "Hugo")).s === 200);
  for (let i = 0; i < 3; i++) r = await post("creer", { cad: 8, adv: "G11" }, "G12");
  T("trois invitations en attente vers le meme membre, pas quatre", r.s === 200 && (await post("creer", { cad: 8, adv: "G11" }, "G12")).erreur === "invitations");

  console.log("Le direct n'est pas concerne");
  {
    const d = await post("creer", { cad: 0 }, "G7");
    const r1 = await post("accepter", { id: d.id }, "G8");
    const f = (await ouvrir(d.id, "G7")).ws;
    T("« accepter » ne permet pas de s'asseoir sans fil dans une partie en direct", r1.s === 403 && f.dernier().phase === "attente" && ![f.dernier().b, f.dernier().nr].includes("G8"), [r1.s, f.dernier().phase, f.dernier().b, f.dernier().nr]);
    T("par le fil, la place reste libre pour lui", (await ouvrir(d.id, "G8")).s === 101 && f.dernier().phase === "debut");
  }

  console.log("Compte supprime, annuaire abime");
  g = await lancee(7, "G1", "G2");
  a = (await ouvrir(g, "G1")).ws; await coup(g, a, "e2e4"); await faux.quitter(g, a);
  b = (await ouvrir(g, "G2")).ws; await coup(g, b, "e7e5"); await faux.quitter(g, b);
  env.DB.brut.prepare("DELETE FROM comptes WHERE id = ?").run(ids.G2);
  x = await dans("G1", g);
  T("l'adversaire a supprime son compte : la partie est gagnee par celui qui reste", x && x.s === "fin" && x.r === "win" && ligne(g).res === "1-0", x);
  g = await lancee(7, "G3", "G4");
  env.DB.brut.prepare("DELETE FROM correspondances WHERE partie = ?").run(g);
  a = (await ouvrir(g, "G3")).ws; await coup(g, a, "e2e4");
  T("une ligne disparue de l'annuaire est reposee au coup suivant", !!ligne(g) && ligne(g).etat === 1 && ligne(g).trait === ids.G4 && (await dans("G4", g)).atoi === true);
  env.DB.brut.prepare("INSERT INTO correspondances (partie, b, n, cad, etat, trait, echeance, cree) VALUES ('zzzzzzzzzzzz', ?, ?, 7, 1, ?, ?, ?)").run(ids.G3, ids.G4, ids.G3, Date.now() - HEURE, Date.now());
  T("une ligne sans partie derriere est effacee a la lecture", !(await dans("G3", "zzzzzzzzzzzz")) && !ligne("zzzzzzzzzzzz"));

  console.log("Balayage de chaque heure");
  {
    const stock = id => [...faux.objets.get(id).donnees.values()].join(" ");
    const g1 = await lancee(7, "G9", "G10");
    let x1 = (await ouvrir(g1, "G9")).ws; await coup(g1, x1, "e2e4"); await faux.quitter(g1, x1);
    x1 = (await ouvrir(g1, "G10")).ws; await coup(g1, x1, "e7e5"); await faux.quitter(g1, x1);
    T("tant que tout va bien, le balayage ne touche a rien", await (async () => { const av = faux.ecritures; await mod.default.scheduled({}, env); return faux.ecritures === av && ligne(g1).etat === 1 && /G10/.test(stock(g1)); })());
    env.DB.brut.prepare("DELETE FROM comptes WHERE id = ?").run(ids.G10);
    await mod.default.scheduled({}, env);
    T("compte supprime : sans attendre l'adversaire, la partie est finie et gagnee par celui qui reste", ligne(g1).etat === 2 && ligne(g1).res === "1-0" && ligne(g1).n === 0, ligne(g1));
    T("la partie ne garde plus le pseudo du compte supprime", !/G10/.test(stock(g1)) && /G9/.test(stock(g1)), stock(g1).slice(0, 200));
    x1 = (await ouvrir(g1, "G9")).ws;
    T("celui qui reste voit la fin, sans le pseudo de l'autre", x1.dernier().phase === "fin" && x1.dernier().fin.m === "abandon" && !x1.dernier().nr && x1.dernier().b === "G9", [x1.dernier().b, x1.dernier().nr]);
    T("un second passage ne refait rien", await (async () => { const av = faux.ecritures; await mod.default.scheduled({}, env); return faux.ecritures === av; })());
    /* Temoin du balayage (2026-11-22) : une seule ligne, l'heure du dernier passage. */
    {
      const lire = () => sql("SELECT id, dernier, traitees FROM balayages");
      const avant = lire();
      avancer(5000);
      await mod.default.scheduled({}, env);
      const apres = lire();
      T("chaque passage note son heure dans la table balayages, sur une seule ligne", avant.length === 1 && apres.length === 1 && apres[0].id === 1 && Date.now() - apres[0].dernier >= 0 && Date.now() - apres[0].dernier < 3000 && apres[0].dernier - avant[0].dernier >= 5000 && apres[0].traitees === 0, JSON.stringify([avant, apres, Date.now()]));
      env.DB.brut.exec("ALTER TABLE balayages RENAME TO balayages_x");
      let plante = false;
      try { await mod.default.scheduled({}, env); } catch (e) { plante = true; }
      env.DB.brut.exec("ALTER TABLE balayages_x RENAME TO balayages");
      T("une base sans la table ne gene pas le balayage", !plante);
    }
    /* Une partie deja finie dont un joueur supprime ensuite son compte. */
    const g2 = await lancee(7, "G11", "G12");
    let y = (await ouvrir(g2, "G11")).ws; await coup(g2, y, "e2e4");
    const y2 = (await ouvrir(g2, "G12")).ws; await coup(g2, y2, "e7e5");
    await faux.envoyer(g2, y, { t: "abandon" });
    env.DB.brut.prepare("DELETE FROM comptes WHERE id = ?").run(ids.G11);
    await mod.default.scheduled({}, env);
    T("partie deja finie : le pseudo du compte supprime en est retire aussi, le resultat reste", !/G11/.test(stock(g2)) && ligne(g2).b === 0 && ligne(g2).res === "0-1", stock(g2).slice(0, 200));
    /* Une echeance manquee par l'alarme. */
    const g3 = await lancee(6, "G5", "G6");
    let z = (await ouvrir(g3, "G5")).ws; await coup(g3, z, "e2e4"); await faux.quitter(g3, z);
    z = (await ouvrir(g3, "G6")).ws; await coup(g3, z, "e7e5"); await faux.quitter(g3, z);
    avancer(JOUR + 5 * 60e3);
    faux.objets.get(g3).alarme = null;
    await mod.default.scheduled({}, env);
    T("une echeance que l'alarme aurait manquee est rattrapee dans l'heure", ligne(g3).etat === 2 && ligne(g3).res === "0-1", ligne(g3));
  }

  console.log("Economie des ecritures");
  g = await lancee(7, "G5", "G6");
  a = (await ouvrir(g, "G5")).ws; b = (await ouvrir(g, "G6")).ws;
  await coup(g, a, "e2e4"); await coup(g, b, "e7e5");
  const avant = faux.ecritures;
  let ecrituresBase = 0;
  const prepare = env.DB.prepare;
  env.DB.prepare = q => { if (/^(INSERT|UPDATE|DELETE)/.test(q) && /correspondances/.test(q)) ecrituresBase++; return prepare(q); };
  for (const [k, cp] of ["g1f3", "b8c6", "f1c4", "f8c5", "c2c3", "g8f6"].entries()) await coup(g, k % 2 ? b : a, cp);
  env.DB.prepare = prepare;
  T("six coups = six lignes dans la partie, pas d'alarme reposee", faux.ecritures - avant === 6, faux.ecritures - avant);
  T("et six ecritures dans l'annuaire, une par coup", ecrituresBase === 6, ecrituresBase);
  await faux.envoyer(g, a, { t: "nulle" });
  T("lire sa liste n'ecrit rien", await (async () => { let n = 0; env.DB.prepare = q => { if (/^(INSERT|UPDATE|DELETE)/.test(q)) n++; return prepare(q); }; await liste("G5"); await liste("G6"); env.DB.prepare = prepare; return n === 0; })());

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception : " + (e && e.stack || e)); process.exit(1); });
