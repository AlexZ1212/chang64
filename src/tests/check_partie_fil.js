/* Verification automatique de chang64.
   Lancement : node tests/check_partie_fil.js

   Ce que ce test garde (2026-11-19) : la partie en direct de bout en bout, par
   de vrais WebSockets. Il lance le serveur local (serveur_local.js, qui fait
   tourner le Worker des parties), cree deux comptes par l'API du compte, puis
   se sert du fil du navigateur (direct.js) : creer, rejoindre, jouer, etre
   refuse sans session, revenir apres une coupure, renoncer quand la partie
   n'existe pas. */
const path = require("path"), { spawn } = require("child_process");
process.removeAllListeners("warning"); process.on("warning", () => {});

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
/* Port libre choisi par le systeme (2026-11-23) : un port fixe faisait echouer
   le test des qu'un serveur d'apercu l'occupait deja. */
let BASE = "";
const D = require("../direct.js");
const pause = ms => new Promise(r => setTimeout(r, ms));
async function jusqua(f, ms) { const fin = Date.now() + (ms || 4000); while (Date.now() < fin) { if (f()) return true; await pause(20); } return false; }

const serveur = spawn(process.execPath, [path.join(__dirname, "..", "serveur_local.js"), "0"], { stdio: ["ignore", "pipe", "inherit"] });
const fin = code => { serveur.kill(); process.exit(code); };

(async () => {
  BASE = await new Promise((res, rej) => {
    let lu = "";
    serveur.stdout.on("data", d => { lu += d; const m = lu.match(/http:\/\/localhost:\d+/); if (m) res(m[0]); });
    serveur.once("exit", () => rej(new Error("le serveur local ne demarre pas")));
  });
  const code = n => Buffer.from(String(n).padStart(32, "x")).toString("base64url");
  async function membre(pseudo) {
    const r = await fetch(BASE + "/api/compte/creer", { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE }, body: JSON.stringify({ pseudo, code: code(pseudo), donnees: { progress: { solved: 0 } } }) });
    if (r.status !== 201) throw new Error("creation de " + pseudo + " : " + r.status + " " + await r.text());
    return { Cookie: r.headers.getSetCookie().map(c => c.split(";")[0]).join("; "), Origin: BASE };
  }
  const anna = await membre("Annafil"), bob = await membre("Bobfil");
  const en = (qui, f) => { D.directRegler(BASE, qui, 60); return f(); };

  console.log("Par de vrais WebSockets");
  T("sans session, creer est refuse", (await en({ Origin: BASE }, () => D.directCreer(0))).erreur === "session");
  T("pseudo inconnu : erreur « adversaire »", (await en(anna, () => D.directCreer(0, "Personne"))).erreur === "adversaire");
  const c = await en(anna, () => D.directCreer(1));
  T("creer rend un identifiant", !!c.id, JSON.stringify(c));
  const vus = { a: [], b: [] }, erreurs = [];
  let coupes = 0;
  const A = en(anna, () => D.directOuvrir(c.id, { etat: e => vus.a.push(e), coupe: () => coupes++ }));
  T("la creatrice recoit l'etat « attente »", await jusqua(() => A.etat && A.etat.phase === "attente"));
  const B = en(bob, () => D.directOuvrir(c.id, { etat: e => vus.b.push(e), erreur: e => erreurs.push(e) }));
  T("a l'arrivee du second, les deux voient la partie commencer", await jusqua(() => A.etat.phase === "debut" && B.etat && B.etat.phase === "debut"));
  T("pseudos et cadence transmis", [A.etat.b, A.etat.nr].sort().join() === "Annafil,Bobfil" && A.etat.cad.join("+") === "300+3");
  const [blancs, noirs] = A.etat.moi === "b" ? [A, B] : [B, A];
  noirs.coup("e7e5");
  blancs.coup("e2e4");
  T("le coup des blancs arrive chez les noirs", await jusqua(() => noirs.etat.coups.join() === "e2e4"));
  B.coup("a1a8");
  T("un coup refuse revient en erreur a son auteur seulement", (B === noirs ? await jusqua(() => erreurs.includes("coup")) : true) && noirs.etat.coups.length === 1);
  noirs.coup("e7e5");
  T("la pendule tourne apres le premier coup de chacun", await jusqua(() => blancs.etat.phase === "jeu") && (await pause(300), blancs.reste(blancs.etat, "b") < 300000 && blancs.reste(blancs.etat, "b") > 298000 && blancs.reste(blancs.etat, "n") === 300000), blancs.reste(blancs.etat, "b"));

  console.log("Coupure et retour");
  A.couper();
  T("le joueur coupe est signale, puis revient tout seul", await jusqua(() => coupes === 1) && await jusqua(() => A.ouvert && A.etat.coups.length === 2 && A.etat.la.b && A.etat.la.n));
  blancs.coup("g1f3");
  T("la partie continue apres le retour", await jusqua(() => noirs.etat.coups.length === 3 && blancs.etat.coups.length === 3));
  noirs.abandon();
  T("abandon : les deux voient la fin", await jusqua(() => A.etat.phase === "fin" && B.etat.phase === "fin" && A.etat.fin.r === "1-0" && A.etat.fin.m === "abandon"));
  A.fermer(); B.fermer();

  console.log("Refus");
  let perdu = false;
  const X = en(anna, () => D.directOuvrir("aaaaaaaaaaaa", { perdu: () => { perdu = true; } }));
  T("partie introuvable : le fil renonce apres quelques essais", await jusqua(() => perdu, 6000));
  X.fermer();
  const r = await fetch(BASE + "/api/partie/ws?id=" + c.id, { headers: anna });
  T("la route du fil refuse une requete ordinaire (426)", r.status === 426);

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  fin(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception : " + (e && e.stack || e)); fin(1); });
