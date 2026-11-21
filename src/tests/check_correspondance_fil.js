/* Verification automatique de chang64.
   Lancement : node tests/check_correspondance_fil.js

   Ce que ce test garde (2026-11-21) : la partie par correspondance de bout en
   bout, par de vrais WebSockets. Il lance le serveur local (serveur_local.js,
   qui fait tourner le Worker des parties et le compte), cree deux comptes par
   l'API, puis se sert du fil du navigateur (direct.js) : inviter, lire sa
   liste, accepter, jouer chacun son tour SANS que l'autre soit connecte,
   fermer et revenir (position, temps restant, trait retrouves), finir la
   partie et la retrouver dans la liste de l'absent. Les echeances en jours
   sont gardees par tests/check_correspondance.js, qui avance l'horloge. */
const path = require("path"), { spawn } = require("child_process");
process.removeAllListeners("warning"); process.on("warning", () => {});

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + (typeof d === "string" ? d : JSON.stringify(d)) : "")); } };
const PORT = 8074, BASE = "http://localhost:" + PORT;
const D = require("../direct.js");
const pause = ms => new Promise(r => setTimeout(r, ms));
async function jusqua(f, ms) { const fin = Date.now() + (ms || 4000); while (Date.now() < fin) { if (await f()) return true; await pause(20); } return false; }

const serveur = spawn(process.execPath, [path.join(__dirname, "..", "serveur_local.js"), String(PORT)], { stdio: ["ignore", "pipe", "inherit"] });
const fin = code => { serveur.kill(); process.exit(code); };

(async () => {
  await new Promise((res, rej) => { serveur.stdout.once("data", res); serveur.once("exit", () => rej(new Error("le serveur local ne demarre pas"))); });
  const code = n => Buffer.from(String(n).padStart(32, "x")).toString("base64url");
  async function membre(pseudo) {
    const r = await fetch(BASE + "/api/compte/creer", { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE }, body: JSON.stringify({ pseudo, code: code(pseudo), donnees: { progress: { solved: 0 } } }) });
    if (r.status !== 201) throw new Error("creation de " + pseudo + " : " + r.status + " " + await r.text());
    return { Cookie: r.headers.getSetCookie().map(c => c.split(";")[0]).join("; "), Origin: BASE };
  }
  const anna = await membre("Annacorr"), bob = await membre("Bobcorr");
  const en = (qui, f) => { D.directRegler(BASE, qui, 60); return f(); };
  const liste = async qui => (await en(qui, () => D.directNouvelles())).corr;
  const JOUR = 86400000;

  console.log("Inviter et accepter, sans fil");
  T("sans session, la liste n'est pas rendue", (await en({ Origin: BASE }, () => D.directNouvelles())).ok === false);
  T("les trois delais sont a la suite des cadences du direct", D.DIRECT_CORR.join() === "6,7,8" && D.DIRECT_CORR.map(i => D.DIRECT_CADENCES[i][0] / 86400).join() === "1,3,7" && D.DIRECT_CADENCES.slice(0, 6).map(c => c.join("+")).join() === "600+0,300+3,900+10,1800+0,1800+20,3600+0");
  const c = await en(anna, () => D.directCreer(7, "bobcorr", "b"));
  T("inviter rend un identifiant et le pseudo", !!c.id && c.adv === "Bobcorr", c);
  let l = await liste(anna);
  T("celle qui invite voit son invitation en attente", l.length === 1 && l[0].id === c.id && l[0].s === "envoyee" && l[0].adv === "Bobcorr", l);
  l = await liste(bob);
  T("l'invite la trouve dans sa liste, avec sa couleur", l.length === 1 && l[0].s === "invite" && l[0].adv === "Annacorr" && l[0].coul === "n" && l[0].cad === 7, l);
  const r = await en(bob, () => D.directAccepter(c.id));
  T("accepter l'assoit", r.id === c.id, r);
  T("a Anna de jouer ; trois jours devant elle", await (async () => { const x = (await liste(anna))[0]; return x.s === "jeu" && x.atoi === true && Math.abs(x.ech - x.h - 3 * JOUR) < 10000; })());

  console.log("Chacun joue quand il veut");
  let A = en(anna, () => D.directOuvrir(c.id, {}));
  T("Anna ouvre la partie", await jusqua(() => A.etat && A.etat.phase === "debut" && A.etat.moi === "b" && A.etat.cad.join("+") === "259200+0"));
  T("son adversaire n'est pas la", A.etat.la.b === true && A.etat.la.n === false);
  A.coup("e2e4");
  T("son coup est pris", await jusqua(() => A.etat.coups.join() === "e2e4"));
  A.fermer();
  await pause(150);
  T("elle ferme : dans la liste de Bob, c'est a lui", await jusqua(async () => { const x = (await liste(bob))[0]; return x && x.s === "jeu" && x.atoi === true; }));
  let B = en(bob, () => D.directOuvrir(c.id, {}));
  T("Bob ouvre a son tour et retrouve le coup joue", await jusqua(() => B.etat && B.etat.coups.join() === "e2e4" && B.etat.moi === "n"));
  T("le temps restant est celui du serveur (pres de 3 jours)", B.reste(B.etat, "n") > 3 * JOUR - 60000 && B.reste(B.etat, "n") <= 3 * JOUR, B.reste(B.etat, "n"));
  B.coup("e7e5");
  T("son coup passe, la partie est lancee", await jusqua(() => B.etat.coups.length === 2 && B.etat.phase === "jeu"));
  B.coup("d7d5");
  await pause(200);
  T("pas deux coups de suite", B.etat.coups.length === 2);
  B.fermer();
  await pause(150);

  console.log("Reprise apres fermeture");
  A = en(anna, () => D.directOuvrir(c.id, {}));
  T("Anna revient : position, trait et pendules retrouves", await jusqua(() => A.etat && A.etat.coups.join() === "e2e4,e7e5" && A.etat.phase === "jeu" && A.etat.tb === 259200000 && A.etat.tn === 259200000));
  A.coup("g1f3");
  T("elle rejoue", await jusqua(() => A.etat.coups.length === 3));
  A.couper();
  T("une coupure du fil se rattrape toute seule", await jusqua(() => A.ouvert && A.etat.coups.length === 3, 6000));
  A.fermer();
  await pause(150);

  console.log("Fin de partie");
  B = en(bob, () => D.directOuvrir(c.id, {}));
  await jusqua(() => B.etat && B.etat.coups.length === 3);
  B.abandon();
  T("Bob abandonne : il voit la fin", await jusqua(() => B.etat.phase === "fin" && B.etat.fin.r === "1-0" && B.etat.fin.m === "abandon"));
  T("l'Elo entre membres est compte", await jusqua(() => B.etat.elo && B.etat.elo.n.d < 0 && B.etat.elo.b.d > 0), B.etat.elo);
  B.fermer();
  await pause(150);
  T("Anna, absente, trouve la partie finie et gagnee dans sa liste", await jusqua(async () => { const x = (await liste(anna))[0]; return x && x.s === "fin" && x.r === "win"; }));
  T("Bob, qui l'a vue, ne l'a plus dans la sienne", (await liste(bob)).length === 0);
  A = en(anna, () => D.directOuvrir(c.id, {}));
  T("en l'ouvrant elle voit la fin", await jusqua(() => A.etat && A.etat.phase === "fin" && A.etat.fin.m === "abandon"));
  A.fermer();
  await pause(200);
  T("et la partie quitte sa liste", await jusqua(async () => (await liste(anna)).length === 0));

  console.log("Adversaire au hasard, retrait");
  D.directRegler(BASE, anna, 60);
  const h = await D.directChercher(6);
  T("personne ne cherche : la recherche est ouverte", !!h.id && h.attente === true && (await liste(anna))[0].s === "cherche", h);
  D.directRegler(BASE, bob, 60);
  const h2 = await D.directChercher(6);
  T("un autre membre cherche le meme delai : ils jouent ensemble", h2.id === h.id && h2.attente === false, h2);
  T("la partie est en cours chez les deux", (await liste(anna))[0].s === "jeu" && (await liste(bob))[0].s === "jeu");
  const c2 = await en(anna, () => D.directCreer(8, "Bobcorr"));
  await en(anna, () => D.directRetirer(c2.id));
  T("une invitation retiree disparait des deux listes", !(await liste(anna)).some(x => x.id === c2.id) && !(await liste(bob)).some(x => x.id === c2.id));

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  fin(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception : " + (e && e.stack || e)); fin(1); });
