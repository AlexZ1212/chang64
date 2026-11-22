/* Verification automatique de chang64.
   Lancement : node tests/check_elo_membres.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Elo verifie entre membres (2026-11-21, decisions d'Alexandre) : calcule par
   le serveur des parties (worker-parties/index.js) a la fin de chaque partie
   en direct, entre amis comme au hasard ; depart = Elo contre l'ordinateur
   declare, ramene entre 600 et 1400, sinon 800 ; K = 40 pendant 20 parties,
   puis 20 ; une base sans les colonnes continue de marcher. Puis ce que
   l'ecran en montre : carte de fin, fiche d'un joueur, Ma progression. */
const path = require("path"), fs = require("fs"), { pathToFileURL } = require("url"), crypto = require("crypto");
process.removeAllListeners("warning"); process.on("warning", () => {});
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const dit = x => JSON.stringify(x);
const attendre = ms => new Promise(r => setTimeout(r, ms));
const { fausseD1 } = require("../serveur_local.js");
const { fauxCloudflare } = require("../worker-parties/faux_cloudflare.js");
const { ouvrir: ouvrirPage, SITE } = require("./outils/page_langue.js");
const VRAI_NOW = Date.now;
let decalage = 0;
Date.now = () => VRAI_NOW() + decalage;
const avancer = ms => { decalage += ms; };

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, "..", "worker-parties", "index.js")).href);
  const E = mod.Partie._elo;

  console.log("La formule");
  T("a force egale, une victoire : +20 les 20 premieres parties", E.eloApres(800, 800, 1, 0) === 820 && E.eloApres(800, 800, 0, 19) === 780);
  T("puis +10 a partir de la 21e", E.eloApres(800, 800, 1, 20) === 810);
  T("une nulle a force egale ne change rien", E.eloApres(1000, 1000, 0.5, 3) === 1000);
  T("battre plus fort rapporte plus", E.eloApres(800, 1200, 1, 0) > E.eloApres(800, 800, 1, 0));
  T("jamais sous 100 ni au-dessus de 3000", E.eloApres(100, 3000, 0, 0) === 100 && E.eloApres(3000, 100, 1, 0) === 3000);
  T("depart : l'Elo declare, ramene entre 600 et 1400", E.eloDepart(2900) === 1400 && E.eloDepart(150) === 600 && E.eloDepart(1012.4) === 1012);
  T("depart : 800 sans Elo declare", E.eloDepart(null) === 800 && E.eloDepart(undefined) === 800 && E.eloDepart("1200") === 800);

  const env = { DB: fausseD1() };
  const faux = fauxCloudflare(mod.Partie, env);
  env.PARTIES = faux.espace;
  const cookies = {};
  let numero = 0;
  function membre(pseudo, donnees) {
    const jeton = crypto.randomBytes(32).toString("base64url"), id = ++numero, now = Date.now();
    env.DB.brut.prepare("INSERT INTO comptes (id, cle, pseudo, pin_hash, secours_hash, cree, vu, donnees) VALUES (?, ?, ?, 'x', 'x', ?, ?, ?)").run(id, pseudo.toLowerCase(), pseudo, now, now, donnees === undefined ? null : donnees);
    env.DB.brut.prepare("INSERT INTO jetons (hash, compte_id, cree, vu) VALUES (?, ?, ?, ?)").run(crypto.createHash("sha256").update(jeton).digest("base64url"), id, now, now);
    cookies[pseudo] = "__Secure-c64=" + jeton;
    return id;
  }
  const ids = {
    Anna: membre("Anna"), Bob: membre("Bob"),
    Gonfle: membre("Gonfle", JSON.stringify({ progress: { eloOrdi: { r: 2900, n: 90 } } })),
    Moyen: membre("Moyen", JSON.stringify({ progress: { eloOrdi: { r: 1012, n: 30 } } })),
    Abime: membre("Abime", "{pas du json"),
    Neuf: membre("Neuf", JSON.stringify({ progress: { solved: 3 } }))
  };
  const appel = (methode, route, corps, qui) => mod.default.fetch(new Request("https://chang64.com/api/partie/" + route, {
    method: methode, headers: Object.assign({ Origin: "https://chang64.com" }, qui ? { Cookie: cookies[qui] } : {}, corps ? { "Content-Type": "application/json" } : {}),
    body: corps ? JSON.stringify(corps) : undefined
  }), env);
  async function ouvrir(id, qui) {
    const r = await mod.default.fetch(new Request("https://chang64.com/api/partie/ws?id=" + id, { headers: { Upgrade: "websocket", Origin: "https://chang64.com", Cookie: cookies[qui] } }), env);
    return r.webSocket || null;
  }
  /* Deux membres assis ; rend les fils par couleur et le pseudo de chacun. */
  async function partie(a, b, cad) {
    const r = await appel("POST", "creer", { cad: cad || 0 }, a);
    const id = (await r.json()).id;
    const x = await ouvrir(id, a), y = await ouvrir(id, b);
    const aBlanc = x.dernier().moi === "b";
    return { id, B: aBlanc ? x : y, N: aBlanc ? y : x, blanc: aBlanc ? a : b, noir: aBlanc ? b : a };
  }
  const jouer = (g, coups) => coups.split(" ").reduce((p, c, i) => p.then(() => faux.envoyer(g.id, i % 2 ? g.N : g.B, { t: "coup", c })), Promise.resolve());
  const lire = qui => env.DB.brut.prepare("SELECT elo, elo_n AS n FROM comptes WHERE id = ?").get(ids[qui]);
  /* Mat du lion en quatre demi-coups : les Noirs gagnent. */
  const MAT_NOIR = "f2f3 e7e5 g2g4 d8h4";

  console.log("Une partie comptee");
  T("avant toute partie : pas d'Elo", lire("Anna").elo === 0 && lire("Anna").n === 0);
  let g = await partie("Anna", "Bob");
  await jouer(g, MAT_NOIR);
  T("mat : le gagnant passe a 820, le perdant a 780, une partie chacun", lire(g.noir).elo === 820 && lire(g.blanc).elo === 780 && lire("Anna").n === 1 && lire("Bob").n === 1, dit([lire(g.noir), lire(g.blanc)]));
  const vB = g.B.dernier(), vN = g.N.dernier();
  T("les deux joueurs recoivent la variation de chacun", vB.phase === "fin" && vB.elo && vB.elo.n.d === 20 && vB.elo.n.r === 820 && vB.elo.b.d === -20 && vB.elo.b.r === 780 && dit(vN.elo) === dit(vB.elo), dit(vB.elo));
  await faux.envoyer(g.id, g.B, { t: "abandon" });
  T("rien n'est compte deux fois", lire(g.noir).elo === 820 && lire(g.noir).n === 1);
  await faux.envoyer(g.id, g.B, { t: "revanche" });
  await faux.envoyer(g.id, g.N, { t: "revanche" });
  T("revanche : la nouvelle partie ne porte plus l'ancienne variation", g.B.dernier().phase !== "fin" && g.B.dernier().elo === null, dit(g.B.dernier().elo));
  await faux.envoyer(g.id, g.B, { t: "abandon" });
  T("partie annulee avant que chacun ait joue : aucun Elo ne bouge", lire("Anna").n === 1 && lire("Bob").n === 1, dit([lire("Anna"), lire("Bob")]));

  console.log("Nulle et ecart de niveau");
  const avantNulle = { h: lire(g.noir).elo, b: lire(g.blanc).elo, haut: g.noir, bas: g.blanc };
  g = await partie("Anna", "Bob");
  await jouer(g, "e2e4 e7e5");
  await faux.envoyer(g.id, g.B, { t: "nulle" });
  await faux.envoyer(g.id, g.N, { t: "nulle" });
  T("nulle : le mieux classe perd un peu, l'autre gagne autant", lire(avantNulle.haut).elo < avantNulle.h && lire(avantNulle.bas).elo > avantNulle.b && lire(avantNulle.haut).elo + lire(avantNulle.bas).elo === 1600, dit([lire("Anna"), lire("Bob")]));
  g = await partie("Anna", "Bob");
  await jouer(g, "e2e4 e7e5");
  avancer(601e3);
  await faux.sonner(Date.now());
  T("perte au temps, tombee par l'alarme : comptee", lire("Anna").n === 3 && lire("Bob").n === 3 && g.B.dernier().elo !== null, dit([lire("Anna"), lire("Bob")]));

  console.log("Depart d'un nouveau membre");
  g = await partie("Gonfle", "Neuf");
  await jouer(g, MAT_NOIR);
  const gagnant = g.noir, perdant = g.blanc;
  {
    const dG = 1400, dN = 800, e = (a, b, s) => E.eloApres(a, b, s, 0);
    const attendu = gagnant === "Gonfle" ? [e(dG, dN, 1), e(dN, dG, 0)] : [e(dN, dG, 1), e(dG, dN, 0)];
    T("un Elo ordinateur gonfle (2900) ne donne qu'un depart a 1400 ; sans Elo, 800", lire(gagnant).elo === attendu[0] && lire(perdant).elo === attendu[1], dit([gagnant, lire(gagnant), lire(perdant), attendu]));
  }
  g = await partie("Moyen", "Abime");
  await jouer(g, MAT_NOIR);
  {
    const dM = 1012, dA = 800, e = (a, b, s) => E.eloApres(a, b, s, 0);
    const attendu = g.noir === "Moyen" ? { Moyen: e(dM, dA, 1), Abime: e(dA, dM, 0) } : { Abime: e(dA, dM, 1), Moyen: e(dM, dA, 0) };
    T("Elo ordinateur plausible (1012) : repris tel quel ; progression illisible : 800", lire("Moyen").elo === attendu.Moyen && lire("Abime").elo === attendu.Abime, dit([lire("Moyen"), lire("Abime"), attendu]));
  }
  const apresPremiere = lire("Moyen").elo;
  env.DB.brut.prepare("UPDATE comptes SET donnees = ? WHERE id = ?").run(JSON.stringify({ progress: { eloOrdi: { r: 600, n: 99 } } }), ids.Moyen);
  g = await partie("Moyen", "Abime");
  await jouer(g, "e2e4 e7e5");
  await faux.envoyer(g.id, g.B, { t: "nulle" });
  await faux.envoyer(g.id, g.N, { t: "nulle" });
  T("une fois classe, l'Elo ordinateur ne sert plus de depart", Math.abs(lire("Moyen").elo - apresPremiere) <= 20 && lire("Moyen").n === 2, dit(lire("Moyen")));

  console.log("Apres 20 parties");
  env.DB.brut.prepare("UPDATE comptes SET elo = 1000, elo_n = 20 WHERE id = ?").run(ids.Anna);
  env.DB.brut.prepare("UPDATE comptes SET elo = 1000, elo_n = 5 WHERE id = ?").run(ids.Bob);
  g = await partie("Anna", "Bob");
  await jouer(g, MAT_NOIR);
  T("le pas depend de chacun : 10 pour l'ancien, 20 pour le nouveau", Math.abs(lire("Anna").elo - 1000) === 10 && Math.abs(lire("Bob").elo - 1000) === 20, dit([lire("Anna"), lire("Bob")]));

  console.log("Un Elo par famille de cadences");
  /* Decisions d'Alexandre du 2026-11-21 au soir : Blitz, Rapide, Classique,
     Correspondance ont chacun leur Elo ; elo et elo_n sont le Rapide ; un
     nouvel Elo part de l'Elo Rapide du joueur quand il en a un. */
  /* 2026-11-22 : le 5+3 (numero 1) est un Blitz, le 10+5 (numero 10) un Rapide. */
  T("chaque cadence a sa famille", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(E.famille).join("") === "rbrccckkkbr" && E.famille(42) === "r");
  T("les colonnes : elo et elo_n restent le Rapide", dit(E.ELO_COLONNES.r) === dit(["elo", "elo_n"]) && dit(E.ELO_COLONNES.c) === dit(["elo_classique", "elo_classique_n"]) && dit(E.ELO_COLONNES.b) === dit(["elo_blitz", "elo_blitz_n"]) && dit(E.ELO_COLONNES.k) === dit(["elo_corr", "elo_corr_n"]));
  ids.Rapi = membre("Rapi"); ids.Vide = membre("Vide");
  env.DB.brut.prepare("UPDATE comptes SET elo = 950, elo_n = 5 WHERE id = ?").run(ids.Rapi);
  const tout = qui => env.DB.brut.prepare("SELECT elo, elo_n, elo_blitz, elo_blitz_n, elo_classique, elo_classique_n, elo_corr, elo_corr_n FROM comptes WHERE id = ?").get(ids[qui]);
  g = await partie("Rapi", "Vide", 3);
  await jouer(g, MAT_NOIR);
  {
    const sR = g.noir === "Rapi" ? 1 : 0, r = tout("Rapi"), v = tout("Vide");
    T("premiere partie Classique : on part de son Elo Rapide (950), l'autre de 800", r.elo_classique === E.eloApres(950, 800, sR, 0) && v.elo_classique === E.eloApres(800, 950, 1 - sR, 0), dit([r, v]));
    T("l'Elo Rapide ne bouge pas, ni les autres familles", r.elo === 950 && r.elo_n === 5 && v.elo === 0 && r.elo_blitz === 0 && r.elo_corr === 0 && v.elo_blitz === 0);
    T("une partie comptee dans la famille, pour chacun", r.elo_classique_n === 1 && v.elo_classique_n === 1);
    const e = g.B.dernier().elo;
    T("l'etat dit la famille, et la variation depuis le depart", e && e.f === "c" && e[g.noir === "Rapi" ? "n" : "b"].d === r.elo_classique - 950 && e[g.noir === "Rapi" ? "n" : "b"].r === r.elo_classique, dit(e));
  }
  {
    const avant = tout("Rapi").elo_classique;
    env.DB.brut.prepare("UPDATE comptes SET elo = 1300 WHERE id = ?").run(ids.Rapi);
    g = await partie("Rapi", "Vide", 4);
    await jouer(g, "e2e4 e7e5");
    await faux.envoyer(g.id, g.B, { t: "nulle" });
    await faux.envoyer(g.id, g.N, { t: "nulle" });
    T("deuxieme partie Classique : on repart de son Elo Classique, plus du Rapide", Math.abs(tout("Rapi").elo_classique - avant) <= 20 && tout("Rapi").elo_classique_n === 2 && tout("Rapi").elo === 1300, dit(tout("Rapi")));
  }
  g = await partie("Rapi", "Vide", 9);
  await jouer(g, MAT_NOIR);
  {
    const sR = g.noir === "Rapi" ? 1 : 0, r = tout("Rapi"), v = tout("Vide");
    T("Blitz 3+2 : son propre Elo, parti du Rapide (1300) et de 800", g.B.dernier().elo.f === "b" && r.elo_blitz === E.eloApres(1300, 800, sR, 0) && v.elo_blitz === E.eloApres(800, 1300, 1 - sR, 0) && r.elo_blitz_n === 1, dit([r, v]));
    T("le Classique et le Rapide n'ont pas bouge", r.elo_classique_n === 2 && r.elo === 1300 && r.elo_n === 5);
  }
  {
    /* Par correspondance : invitation, acceptation sans fil, puis la partie. */
    const cree = await (await appel("POST", "creer", { cad: 6, adv: "Vide" }, "Rapi")).json();
    const acc = await appel("POST", "accepter", { id: cree.id }, "Vide");
    const x = await ouvrir(cree.id, "Rapi"), y = await ouvrir(cree.id, "Vide");
    const rBlanc = x.dernier().moi === "b", gc = { id: cree.id, B: rBlanc ? x : y, N: rBlanc ? y : x, noir: rBlanc ? "Vide" : "Rapi" };
    await jouer(gc, MAT_NOIR);
    const sR = gc.noir === "Rapi" ? 1 : 0, r = tout("Rapi"), v = tout("Vide");
    T("Correspondance : son propre Elo, parti du Rapide (1300) et de 800", acc.status === 200 && gc.B.dernier().elo && gc.B.dernier().elo.f === "k" && r.elo_corr === E.eloApres(1300, 800, sR, 0) && v.elo_corr === E.eloApres(800, 1300, 1 - sR, 0) && r.elo_corr_n === 1, dit([acc.status, gc.B.dernier().elo, r, v]));
  }
  g = await partie("Rapi", "Vide", 10);
  await jouer(g, MAT_NOIR);
  T("Rapide (10+5, la cadence ajoutee) : toujours les colonnes elo et elo_n", g.B.dernier().elo.f === "r" && tout("Rapi").elo_n === 6 && tout("Vide").elo_n === 1 && tout("Vide").elo > 0, dit([tout("Rapi"), tout("Vide")]));
  T("la partie se joue bien en 10 minutes plus 5 secondes", dit(g.B.dernier().cad) === "[600,5]", dit(g.B.dernier().cad));
  {
    const avant = tout("Rapi");
    g = await partie("Rapi", "Vide", 1);
    await jouer(g, MAT_NOIR);
    const r = tout("Rapi");
    T("5+3 : c'est un Blitz desormais, il compte pour l'Elo Blitz", g.B.dernier().elo.f === "b" && dit(g.B.dernier().cad) === "[300,3]" && r.elo_blitz_n === avant.elo_blitz_n + 1, dit([avant, r]));
    T("et plus pour l'Elo Rapide, qui ne bouge pas", r.elo === avant.elo && r.elo_n === avant.elo_n);
  }
  {
    const refus = await appel("POST", "creer", { cad: 11 }, "Rapi");
    T("une cadence qui n'existe pas est refusee", refus.status === 400, refus.status);
  }

  console.log("Base sans les colonnes");
  env.DB.brut.exec("ALTER TABLE comptes RENAME COLUMN elo TO elo_x");
  const vAvant = env.DB.brut.prepare("SELECT SUM(direct_v) AS v FROM comptes").get().v;
  g = await partie("Anna", "Bob");
  await jouer(g, MAT_NOIR);
  T("la partie se finit normalement, sans variation", g.B.dernier().phase === "fin" && g.B.dernier().fin.m === "mat" && g.B.dernier().elo === null);
  T("et la victoire reste comptee", env.DB.brut.prepare("SELECT SUM(direct_v) AS v FROM comptes").get().v === vAvant + 1);
  const compte = await import(pathToFileURL(path.join(__dirname, "..", "functions", "api", "compte", "[[route]].js")).href);
  const fiche = async p => (await compte.onRequest({ request: new Request("https://chang64.com/api/compte/profil?p=" + p + "&x=" + Math.random()), env, params: { route: ["profil"] } })).json();
  T("fiche d'un joueur sans les colonnes : elle repond, sans Elo entre membres", (await fiche("Anna")).p === "Anna" && (await fiche("Anna")).em === null);
  env.DB.brut.exec("ALTER TABLE comptes RENAME COLUMN elo_x TO elo");

  console.log("Fiche publique");
  let f = await fiche("Bob");
  T("fiche : l'Elo entre membres et le nombre de parties", f.em && f.em.r === lire("Bob").elo && f.em.n === lire("Bob").n, dit(f.em));
  T("fiche : les quatre familles, celles sans partie a null ; em reste le Rapide", f.ef && dit(f.ef.r) === dit(f.em) && f.ef.b === null && f.ef.c === null && f.ef.k === null, dit(f.ef));
  f = await fiche("Rapi");
  T("fiche d'un membre qui a joue dans les quatre familles", f.ef && f.ef.b.r === tout("Rapi").elo_blitz && f.ef.b.n === 2 && f.ef.c.n === 2 && f.ef.k.n === 1 && f.ef.r.r === tout("Rapi").elo && f.ef.r.n === 6, dit(f.ef));
  const idSeul = membre("Seul");
  f = await fiche("Seul");
  T("fiche d'un membre qui n'a jamais joue en direct : pas d'Elo entre membres", f.em === null && f.ef === null && idSeul > 0);
  env.DB.brut.prepare("UPDATE comptes SET elo_blitz = 870, elo_blitz_n = 3 WHERE id = ?").run(idSeul);
  f = await fiche("Seul");
  T("un membre qui n'a joue qu'en Blitz : ef porte le Blitz, em (Rapide) reste vide", f.em === null && f.ef && f.ef.b.r === 870 && f.ef.b.n === 3 && f.ef.r === null, dit(f.ef));

  console.log("Ecran");
  const w = await ouvrirPage("fr", { attente: 2600, avant(win) {
    win.localStorage.setItem("chang64:compte", JSON.stringify({ pseudo: "Moi", cle: "moi", version: 1, dev: "abc123", n: 0, sync: 0 }));
    win.fetch = u => {
      const url = new URL(u, "https://chang64.com/");
      const rep = (statut, corps) => Promise.resolve({ ok: statut === 200, status: statut, json: () => Promise.resolve(corps), text: () => Promise.resolve(JSON.stringify(corps)) });
      if (url.pathname === "/api/compte/profil") {
        const p = url.searchParams.get("p");
        return rep(200, { p, depuis: "2026-03", s: 1, n: 900, r: 5, j: 1, b: 1, k: 0, d: 2, dir: { v: 2, n: 0, d: 1 }, rangs: {}, bl: [], pays: null, eo: p === "Alice" ? { r: 1150, n: 25 } : null, em: p === "Bob" ? null : { r: 1012, n: 7 },
          ef: p === "Carl" || p === "Moi" ? { b: null, r: { r: 1012, n: 7 }, c: { r: 980, n: 1 }, k: null } : undefined });
      }
      if (url.pathname.startsWith("/api/")) return Promise.reject(new Error("hors ligne"));
      const fichier = path.join(SITE, url.pathname);
      if (!fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) return Promise.resolve({ ok: false, status: 404 });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(fs.readFileSync(fichier, "utf8"))) });
    };
  } });
  const d = w.document, $ = id => d.getElementById(id);
  w.eval("cppOuvrir(\"Alice\")");
  await attendre(500);
  let lignes = [...d.querySelectorAll("#cpProfilContenu .cpp-elo")].map(x => x.textContent);
  T("fiche : le titre « Elo entre membres », puis « ≈ 1150 contre l'ordinateur »", d.querySelector("#cpProfilContenu .cpp-elo-membres .tiroir-section").textContent === "Elo entre membres" && lignes.join(" | ") === "≈ 1150 contre l'ordinateur", lignes.join(" | "));
  /* Une ligne par famille : le nom, puis l'Elo ou un tiret. */
  const familles = racine => [...d.querySelectorAll(racine + " .elo-familles li")].map(li => li.dataset.f + ":" + li.querySelector("span").textContent + ":" + (li.querySelector("b.vide") ? "-" : li.querySelector("b").textContent)).join(" | ");
  T("reponse d'avant (em seul) : c'est le Rapide, les autres familles ont un tiret", familles("#cpProfilContenu") === "b:Blitz:- | r:Rapide:1012 | c:Classique:- | k:Correspondance:-", familles("#cpProfilContenu"));
  T("le tiret est dit aux lecteurs d'ecran", /Aucune partie de cette sorte/.test(d.querySelector("#cpProfilContenu .elo-familles b.vide .visually-hidden").textContent.replace(/\s+/g, " ")) && d.querySelector("#cpProfilContenu .elo-familles b.vide [aria-hidden]").textContent === "–");
  T("pas de nombre de parties sur la fiche d'un autre", !d.querySelector("#cpProfilContenu .elo-parties"));
  w.eval("cppFermer();cppOuvrir(\"Carl\")");
  await attendre(500);
  T("fiche avec les quatre familles : Rapide 1012, Classique 980", familles("#cpProfilContenu") === "b:Blitz:- | r:Rapide:1012 | c:Classique:980 | k:Correspondance:-", familles("#cpProfilContenu"));
  w.eval("cppFermer();cppOuvrir(\"Bob\")");
  await attendre(500);
  T("fiche sans Elo : aucune ligne", d.querySelectorAll("#cpProfilContenu .cpp-elo").length === 0 && !!d.querySelector("#cpProfilContenu .cpp-liste"));
  w.eval("cppFermer();menuOuvrir();menuVue(\"stats\")");
  await attendre(900);
  /* 2026-11-22 : dans les statistiques, les quatre Elo sont des tuiles (meme
     aspect que l'Elo contre l'ordinateur), sous le titre de categorie
     « Parties entre membres » ; la liste a lignes reste celle de la fiche. */
  const tuiles = racine => [...d.querySelectorAll(racine + " .menu-tuile")].map(x => x.dataset.f + ":" + x.querySelector(":scope > span").textContent + ":" + (x.querySelector("b.vide") ? "-" : x.querySelector("b").textContent)).join(" | ");
  T("Statistiques : le bloc « Elo entre membres », une tuile par famille", !$("menuEloMembres").hidden && !$("menuMembres").hidden && /Elo entre membres/.test($("menuEloMembres").textContent) && tuiles("#menuEloFamilles") === "b:Blitz:- | r:Rapide:1012 | c:Classique:980 | k:Correspondance:-" && !d.querySelector("#menuEloFamilles .elo-familles"), tuiles("#menuEloFamilles"));
  T("la categorie porte son titre", $("menuMembres").querySelector(".stats-cat").textContent.replace(/\s+/g, " ") === "Parties entre membres");
  T("le tiret d'une famille sans partie est dit aux lecteurs d'ecran", /Aucune partie de cette sorte/.test(d.querySelector("#menuEloFamilles b.vide .visually-hidden").textContent.replace(/\s+/g, " ")));
  const parties = [...d.querySelectorAll("#menuEloFamilles .elo-parties")].map(x => x.textContent.replace(/\s+/g, " "));
  T("avec le nombre de parties comptees, au singulier et au pluriel", parties.join("|") === "|7 parties|1 partie|", parties.join("|"));
  w.eval("menuFermer()");
  /* Fin d'une partie en direct : l'etat envoye par le serveur porte la variation. */
  w.eval("mode=\"friend\";directId=\"aaaaaaaaaaaa\";isReviewGame=false;resultDismissed=false;" +
    "directE={phase:\"fin\",moi:\"n\",fin:{r:\"0-1\",m:\"mat\"},elo:{f:\"c\",b:{d:-20,r:780},n:{d:20,r:820}},coups:[],rev:{b:false,n:false},la:{b:true,n:true},b:\"Anna\",nr:\"Moi\",cad:[600,0],id:\"aaaaaaaaaaaa\",n:1};" +
    "resultInfo={kind:\"win\",title:\"x\",sub:\"y\"};eloCarte();");
  const carte = () => $("resultElo").textContent.replace(/\s+/g, " ");
  T("carte de fin en direct : +20 Elo, 820 en Classique", !$("resultElo").classList.contains("hide") && carte() === "+20 Elo 820 en Classique", carte());
  w.eval("directE.moi=\"b\";eloCarte();");
  T("pour le perdant : la variation negative", carte() === "\u221220 Elo 780 en Classique", carte());
  const carteDe = fam => { w.eval("directE.elo.f=" + JSON.stringify(fam) + ";eloCarte();"); return carte(); };
  T("la famille est dite : Blitz, Rapide, Correspondance", carteDe("b") === "\u221220 Elo 780 en Blitz" && carteDe("r") === "\u221220 Elo 780 en Rapide" && carteDe("k") === "\u221220 Elo 780 par correspondance", [carteDe("b"), carteDe("r"), carteDe("k")].join(" | "));
  T("etat d'un serveur d'avant, sans famille : « entre membres »", carteDe(undefined) === "\u221220 Elo 780 entre membres", carteDe(undefined));
  T("jamais de rappel vers le compte en direct", $("resultEloNote").classList.contains("hide"));
  w.eval("directE.elo=null;eloCarte();");
  T("partie non comptee (ou base sans colonnes) : pas de ligne", $("resultElo").classList.contains("hide"));
  w.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
