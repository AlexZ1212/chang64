/* Verification automatique de chang64.
   Lancement : node tests/check_compte_synchro.js

   Ce que ce test garde (2026-11-16) : la partie navigateur du compte
   (compte.js) jouee pour de vrai contre le serveur du compte
   (functions/api/compte/[[route]].js) et une base SQLite en memoire. Deux
   "appareils" (deux contextes isoles, chacun son stockage et son cookie)
   partagent un compte. On verifie que la progression n'est jamais perdue ni
   comptee deux fois : fusion a trois voies, conflit de version, reponse
   perdue en route, premiere connexion d'un appareil qui a deja joue,
   remise a zero. Plus : les regles du pseudo identiques des deux cotes, le
   controle du code, le QR code (compare a une empreinte verifiee avec un
   lecteur independant). */
const fs = require("fs"), path = require("path"), vm = require("vm"), { pathToFileURL } = require("url");
process.removeAllListeners("warning"); process.on("warning", () => {});
const SRC = path.join(__dirname, "..");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };

const compteJs = fs.readFileSync(path.join(SRC, "compte.js"), "utf8");
const serveurJs = fs.readFileSync(path.join(SRC, "functions", "api", "compte", "[[route]].js"), "utf8");

const { fausseD1 } = require("../serveur_local.js");

(async () => {
  const serveur = await import(pathToFileURL(path.join(SRC, "functions", "api", "compte", "[[route]].js")).href);
  const env = { DB: fausseD1() };

  /* Un appareil : compte.js dans son propre contexte, avec le strict
     necessaire de l'application autour. */
  function appareil(nom) {
    const stock = new Map(), session = new Map();
    const a = { nom, cookie: "", panne: "", requetes: [] };
    const magasin = m => ({ getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); } });
    const ctx = {
      console, TextEncoder, crypto: globalThis.crypto, btoa, JSON, Math, Date, Promise, Set, Map, Array, Object, String, Number, RegExp, Error, parseInt, isFinite,
      localStorage: magasin(stock), sessionStorage: magasin(session),
      setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
      location: { hash: "", origin: "https://chang64.com", pathname: "/fr/", search: "", reload() { a.recharge = true; } },
      document: { addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, hidden: false },
      navigator: {},
      fetch: async (url, o) => {
        a.requetes.push(o.method + " " + url);
        if (a.panne === "hors-ligne") throw new Error("reseau");
        const h = Object.assign({ Origin: "https://chang64.com" }, o.headers);
        if (a.cookie) h.Cookie = a.cookie;
        const route = url.replace("/api/compte/", "");
        const rep = await serveur.onRequest({ request: new Request("https://chang64.com" + url, { method: o.method, headers: h, body: o.body }), env, params: { route: route.split("/") } });
        const sc = rep.headers.get("Set-Cookie");
        if (sc) a.cookie = /Max-Age=0/.test(sc) ? "" : sc.split(";")[0];
        if (a.panne === "reponse-perdue" && o.method === "PUT") { a.panne = ""; throw new Error("reponse perdue"); }
        const texte = await rep.text();
        return { status: rep.status, json: async () => JSON.parse(texte) };
      }
    };
    ctx.window = ctx; ctx.globalThis = ctx;
    ctx.window.storage = {
      set(k, v) { stock.set(k, typeof v === "string" ? v : JSON.stringify(v)); return Promise.resolve(); },
      get(k) { return Promise.resolve(stock.has(k) ? { value: stock.get(k) } : null); },
      delete(k) { stock.delete(k); return Promise.resolve(); }
    };
    ctx.window.addEventListener = () => {};
    ctx.window.history = { replaceState() {} };
    const prelude = `
      let prog={level:1,solved:0,streak:0,best:0,correctRun:0,wrongRun:0,seen:[],badges:[],badgeDates:{},ratingHistory:[],solveLog:[],dailyLog:{},themeSolved:{},endgames:{},mistakeQueue:[],rating:800,days:0,lastDay:"",rushBest:0,coordBest:0};
      const $=()=>null,t=(s,v)=>s,echapper=s=>String(s),poserHtml=()=>{},mouvementCalme=()=>true,copyText=()=>{},fmtDayMonth=()=>"";
      function ensureProgFields(){if(!Array.isArray(prog.badges))prog.badges=[];}
      function saveProg(){window.storage.set("chang64:progress",JSON.stringify(prog));}
      let menuVue=function(){},bilanOuvrir=function(){};function menuOuvrir(){}function bilanFermer(){}
      let duelVueCree=function(){},duelVueReponse=function(){},menuPoint=function(){};function menuFermer(){}
      const LANG="fr";
    `;
    const epilogue = `
      ;globalThis.api={cpFusion,cpFusionProg,cpSynchro,cpOuvrir,cpFermer,cpEnveloppe,cpAppliquer,cpEcraser,cpDemarrer,cpEtirer,cpCodeDefaut,pseudoValider,cpQrMatrice,cpContenu,cpApi,
        get prog(){return prog;},set prog(v){prog=v;},get cp(){return cp;},get etat(){return cpEtatSync;},sauver(){saveProg();}};
    `;
    vm.createContext(ctx);
    vm.runInContext(prelude + compteJs.replace("__COMPTE_PAGES__", "{}") + epilogue, ctx, { filename: "compte.js" });
    a.api = ctx.api; a.stock = stock; a.ctx = ctx;
    a.api.cpDemarrer();
    /* Jouer : n exercices reussis de plus, a une date donnee. */
    a.jouer = (n, quand) => {
      const p = a.api.prog;
      for (let i = 0; i < n; i++) { p.solved++; p.solveLog.push(quand + i); p.themeSolved.Pin = (p.themeSolved.Pin || 0) + 1; }
      a.api.sauver();
    };
    return a;
  }
  const lire = () => JSON.parse(env.DB.brut.prepare("SELECT donnees FROM comptes").get().donnees);
  const versionServeur = () => env.DB.brut.prepare("SELECT version FROM comptes").get().version;

  console.log("\nRegles du pseudo : meme texte des deux cotes");
  const bloc = s => { const m = s.match(/\/\* PSEUDO-DEBUT[\s\S]*?\/\* PSEUDO-FIN \*\//); return m ? m[0] : ""; };
  T("le bloc du pseudo est identique dans compte.js et sur le serveur", bloc(compteJs).length > 1000 && bloc(compteJs) === bloc(serveurJs));

  const A = appareil("A"), B = appareil("B");

  console.log("\nCode");
  for (const [c, r] of [["12345", "court"], ["12a456", "chiffres"], ["1234567890123", "long"], ["000000", "facile"], ["123456", "facile"], ["987654", "facile"], ["890123", "facile"], ["121212", "facile"], ["123123", "facile"], ["147258", "facile"], ["11111111", "facile"], ["583920", ""], ["2026110", ""], ["19870412", ""]])
    T("code " + c + " : " + (r || "accepte"), A.api.cpCodeDefaut(c) === r, A.api.cpCodeDefaut(c));
  const e1 = await A.api.cpEtirer("alexandre", "583920"), e2 = await A.api.cpEtirer("alexandre", "583920"), e3 = await A.api.cpEtirer("alexandra", "583920"), e4 = await A.api.cpEtirer("alexandre", "583921");
  T("etirement : 32 octets, stable", /^[A-Za-z0-9_-]{43}$/.test(e1) && e1 === e2);
  T("etirement : depend du pseudo et du code", e1 !== e3 && e1 !== e4);
  T("etirement : valeur de reference (ne doit jamais changer)", e1 === "YtBSBF57F0OL8CAX94MurJmHNPPGSCzy2_AtQYZqvaU", e1);

  console.log("\nFusion, regle par regle");
  const F = A.api.cpFusionProg;
  let f = F({ solved: 110 }, { solved: 105 }, { solved: 100 }, false);
  T("avec base : les deux avancees s'additionnent (115)", f.solved === 115, f.solved);
  f = F({ solved: 110 }, { solved: 105 }, null, false);
  T("sans base : le plus grand (110), jamais la somme", f.solved === 110, f.solved);
  f = F({ solved: 100 }, { solved: 100 }, { solved: 100 }, false);
  T("rien de neuf : rien ne bouge", f.solved === 100);
  f = F({ rushBest: 12, coordBest: 5, best: 9, fastestSolveMs: 4000 }, { rushBest: 9, coordBest: 14, best: 3, fastestSolveMs: 2500 }, null, false);
  T("records : le meilleur de chaque", f.rushBest === 12 && f.coordBest === 14 && f.best === 9 && f.fastestSolveMs === 2500);
  f = F({ endgames: { kq: 12, kr: 20 } }, { endgames: { kq: 15, kp: 8 } }, null, false);
  T("finales : le moins de coups, toutes reunies", f.endgames.kq === 12 && f.endgames.kr === 20 && f.endgames.kp === 8);
  f = F({ badges: ["a", "b"], badgeDates: { a: 10, b: 30 } }, { badges: ["c", "a"], badgeDates: { c: 20, a: 5 } }, null, false);
  T("badges reunis, dans l'ordre des dates, date la plus ancienne", f.badges.join() === "a,c,b" && f.badgeDates.a === 5, f.badges.join());
  f = F({ dailyLog: { "2026-11-01": true }, bx: { f: { x: 1 }, j: { "2026-11-01": 1 }, c: {} } }, { dailyLog: { "2026-11-02": true }, bx: { f: { y: 1 }, j: { "2026-11-02": 1 }, c: {} } }, null, false);
  T("jours et faits reunis", Object.keys(f.dailyLog).length === 2 && f.bx.f.x && f.bx.f.y && Object.keys(f.bx.j).length === 2);
  f = F({ rating: 900, ratingHistory: [{ t: 1, r: 850 }, { t: 5, r: 900 }], level: 3, streak: 4 }, { rating: 870, ratingHistory: [{ t: 1, r: 850 }, { t: 3, r: 870 }], level: 2, streak: 0 }, null, true);
  T("classement : celui du dernier point du journal, meme si l'autre appareil est dit plus recent", f.rating === 900 && f.ratingHistory.length === 3 && f.ratingHistory[2].t === 5);
  T("etat du moment : celui de l'appareil le plus recent", f.level === 2 && f.streak === 0);
  f = F({ days: 2, lastDay: "2026-11-10" }, { days: 1, lastDay: "2026-11-11" }, null, false);
  T("series de jours raboutees (3)", f.days === 3 && f.lastDay === "2026-11-11", f.days + " " + f.lastDay);
  f = F({ days: 5, lastDay: "2026-11-05" }, { days: 2, lastDay: "2026-11-11" }, null, false);
  T("series separees par un trou : la plus recente", f.days === 2 && f.lastDay === "2026-11-11");
  f = F({ days: 4, lastDay: "2026-11-11" }, { days: 9, lastDay: "2026-11-11" }, null, false);
  T("meme dernier jour : la plus longue", f.days === 9);
  f = F({ mistakeQueue: [{ id: 1, box: 2, ts: 1 }, { id: 2, box: 1, ts: 2 }] }, { mistakeQueue: [{ id: 1, box: 4, ts: 1 }, { id: 3, box: 1, ts: 3 }] }, { mistakeQueue: [{ id: 1, box: 2, ts: 1 }, { id: 3, box: 1, ts: 3 }, { id: 4, box: 5, ts: 0 }] }, false);
  T("file des erreurs : la plus avancee, et ce qui en est sorti n'y revient pas", f.mistakeQueue.map(x => x.id + ":" + x.box).join() === "1:4,2:1", JSON.stringify(f.mistakeQueue));
  f = F({ bx: { c: { vic: 5, gels: 1, jour: "2026-11-16", jourN: 4, ouvFam: ["a"], defis: { lundi: "2026-11-16", p: [3, 0, 8], ok: [false, false, true], jours: ["a"], objJours: [] } } } },
    { bx: { c: { vic: 4, gels: 2, jour: "2026-11-16", jourN: 3, ouvFam: ["b"], defis: { lundi: "2026-11-16", p: [5, 2, 0], ok: [true, false, false], jours: ["b"], objJours: [] } } } },
    { bx: { c: { vic: 3, gels: 2, jour: "2026-11-16", jourN: 1 } } }, false);
  T("victoires additionnees, gel depense non rendu, objectif du jour additionne", f.bx.c.vic === 6 && f.bx.c.gels === 1 && f.bx.c.jourN === 6, JSON.stringify([f.bx.c.vic, f.bx.c.gels, f.bx.c.jourN]));
  T("defis de la semaine : le meilleur de chaque", f.bx.c.defis.p.join() === "5,2,8" && f.bx.c.defis.ok.join() === "true,false,true" && f.bx.c.defis.jours.length === 2 && f.bx.c.ouvFam.length === 2);
  f = F({ champFutur: "local", autre: 1 }, { champFutur: "distant" }, null, true);
  T("champ inconnu : celui de l'appareil le plus recent, rien n'est jete", f.champFutur === "distant" && f.autre === 1);
  let g = A.api.cpFusion({ t: { prefs: 5, debut: 1 }, prefs: { board: "a" }, debut: { e: 2, x: 0, f: [0, 1] }, games: [{ t: 3, m: "e2e4" }], duels: [{ c: "x" }] },
    { t: { prefs: 9, debut: 4 }, prefs: { board: "b" }, debut: { e: 4, x: 1, f: [1, 3] }, games: [{ t: 7, m: "d2d4" }, { t: 3, m: "e2e4" }], duels: [{ c: "y" }] }, null);
  T("preferences : les plus recentes", g.prefs.board === "b");
  T("Je debute : etapes reunies, position la plus recente", g.debut.f.join() === "0,1,3" && g.debut.e === 4);
  T("parties reunies sans doublon, la plus recente d'abord", g.games.length === 2 && g.games[0].t === 7);
  const assoc = (x, y) => A.api.cpContenu(A.api.cpFusion(x, y, null)) === A.api.cpContenu(A.api.cpFusion(y, x, null));
  T("sans base, fusionner dans un sens ou dans l'autre donne le meme contenu", assoc({ t: { progress: 1 }, progress: { solved: 4, badges: ["a"], badgeDates: { a: 1 }, days: 2, lastDay: "2026-11-10", rushBest: 3 } }, { t: { progress: 1 }, progress: { solved: 9, badges: ["b"], badgeDates: { b: 2 }, days: 1, lastDay: "2026-11-11", rushBest: 1 } }));

  console.log("\nDeux appareils, un compte");
  A.jouer(40, 1000);
  A.api.prog.badges.push("solved_25"); A.api.prog.badgeDates.solved_25 = 1030; A.api.sauver();
  const pv = A.api.pseudoValider("Alexandre");
  let r = await A.api.cpApi("POST", "creer", { pseudo: "Alexandre", code: await A.api.cpEtirer(pv.cle, "583920"), donnees: A.api.cpEnveloppe() });
  T("A cree le compte avec sa progression", r.s === 201 && lire().progress.solved === 40);
  A.api.cpOuvrir(r.j.pseudo, r.j.version);
  T("A : rien a envoyer, tout est deja la", await A.api.cpSynchro({ tirer: true }) === true && versionServeur() === 1);
  r = await B.api.cpApi("POST", "connexion", { pseudo: "alexandre", code: await B.api.cpEtirer(pv.cle, "583920") });
  T("B se connecte avec le meme code", r.s === 200);
  B.api.cpOuvrir(r.j.pseudo, r.j.version);
  await B.api.cpSynchro({ tirer: true });
  T("B recoit la progression de A", B.api.prog.solved === 40 && B.api.prog.badges.includes("solved_25"), B.api.prog.solved);
  T("B n'a rien reecrit sur le serveur", versionServeur() === 1);

  A.jouer(10, 2000); B.jouer(5, 3000);
  T("A envoie ses 10 exercices", await A.api.cpSynchro() === true && lire().progress.solved === 50);
  T("B, en retard d'une version, fusionne puis envoie : 55", await B.api.cpSynchro() === true && lire().progress.solved === 55 && B.api.prog.solved === 55, lire().progress.solved);
  T("A relit : 55, sans rien renvoyer", await A.api.cpSynchro({ tirer: true }) === true && A.api.prog.solved === 55 && A.api.prog.themeSolved.Pin === 55);
  T("le journal des reussites est complet", A.api.prog.solveLog.length === 55);
  const v1 = versionServeur();
  await A.api.cpSynchro(); await B.api.cpSynchro({ tirer: true }); await A.api.cpSynchro({ tirer: true });
  T("au repos, plus aucune ecriture", versionServeur() === v1 && lire().progress.solved === 55);

  console.log("\nPannes");
  A.jouer(3, 4000);
  A.panne = "hors-ligne";
  T("hors ligne : la synchro echoue sans rien perdre", await A.api.cpSynchro() === false && A.api.etat === "hors-ligne" && A.api.prog.solved === 58);
  A.panne = "";
  T("retour du reseau : envoye, 58", await A.api.cpSynchro() === true && lire().progress.solved === 58);
  A.jouer(4, 5000);
  A.panne = "reponse-perdue";
  T("l'envoi arrive mais sa reponse se perd", await A.api.cpSynchro() === false && lire().progress.solved === 62);
  A.jouer(1, 6000);
  await A.api.cpSynchro({ tirer: true });
  T("au passage suivant, rien n'est compte deux fois (63, pas 67)", A.api.prog.solved === 63 && lire().progress.solved === 63, A.api.prog.solved + " / " + lire().progress.solved);
  /* Le pire cas : la reponse de A se perd, puis B ecrit par-dessus avant que
     A ne revienne. L'etat du serveur ne ressemble plus a ce que A a envoye,
     mais il porte son numero d'envoi. */
  A.jouer(2, 7000);
  A.panne = "reponse-perdue";
  await A.api.cpSynchro();
  B.jouer(6, 8000);
  await B.api.cpSynchro({ tirer: true });
  T("B a fusionne par-dessus l'envoi de A : 71", lire().progress.solved === 71, lire().progress.solved);
  A.jouer(1, 9000);
  await A.api.cpSynchro({ tirer: true });
  T("A revient : 72, ses 2 exercices ne sont pas recomptes", A.api.prog.solved === 72 && lire().progress.solved === 72, A.api.prog.solved + " / " + lire().progress.solved);
  await B.api.cpSynchro({ tirer: true });
  T("B aussi : 72", B.api.prog.solved === 72);

  console.log("\nUn troisieme appareil qui avait deja joue");
  const C = appareil("C");
  C.jouer(20, 500);
  C.api.prog.rushBest = 15; C.api.prog.badges.push("sprint_15"); C.api.prog.badgeDates.sprint_15 = 600; C.api.sauver();
  r = await C.api.cpApi("POST", "connexion", { pseudo: "Alexandre", code: await C.api.cpEtirer(pv.cle, "583920") });
  C.api.cpOuvrir(r.j.pseudo, r.j.version);
  await C.api.cpSynchro({ tirer: true });
  T("fusion sans base : le plus grand (72), pas la somme (92)", C.api.prog.solved === 72 && lire().progress.solved === 72, C.api.prog.solved);
  T("son record de Sprint et son badge rejoignent le compte", lire().progress.rushBest === 15 && lire().progress.badges.includes("sprint_15") && lire().progress.badges.includes("solved_25"));
  await A.api.cpSynchro({ tirer: true });
  T("A les recoit", A.api.prog.rushBest === 15 && A.api.prog.badges.includes("sprint_15"));
  C.jouer(2, 10000);
  await C.api.cpSynchro();
  T("ensuite C additionne comme les autres (74)", lire().progress.solved === 74);

  console.log("\nChangement de pseudo sur un appareil");
  {
    const nv = A.api.pseudoValider("Alexandre_II");
    r = await A.api.cpApi("POST", "pseudo-changer", { pseudo: nv.pseudo, ancien: await A.api.cpEtirer(pv.cle, "583920"), nouveau: await A.api.cpEtirer(nv.cle, "583920") });
    T("A change de pseudo en gardant son code", r.s === 200 && r.j.pseudo === "Alexandre_II", JSON.stringify(r));
    await B.api.cpSynchro({ tirer: true });
    T("B apprend le nouveau pseudo a la synchronisation suivante", B.api.cp.pseudo === "Alexandre_II" && B.api.cp.cle === nv.cle, JSON.stringify(B.api.cp));
    T("sa progression n'a pas bouge et sa base a suivi le pseudo", lire().progress.solved === 74 && B.api.prog.solved === 74 && JSON.parse(B.stock.get("chang64:compteBase")).cle === nv.cle, lire().progress.solved);
    /* On revient au pseudo d'origine pour la suite du test. */
    r = await B.api.cpApi("POST", "pseudo-changer", { pseudo: "Alexandre", ancien: await B.api.cpEtirer(nv.cle, "583920"), nouveau: await B.api.cpEtirer(pv.cle, "583920") });
    T("B, avec la nouvelle cle, peut a son tour changer le pseudo", r.s === 200, JSON.stringify(r));
    await A.api.cpSynchro({ tirer: true }); await B.api.cpSynchro({ tirer: true }); await C.api.cpSynchro({ tirer: true });
    T("tous les appareils sont revenus au pseudo d'origine", [A, B, C].every(x => x.api.cp.pseudo === "Alexandre"));
  }

  console.log("\nSession fermee ailleurs, deconnexion, remise a zero");
  await A.api.cpSynchro({ tirer: true });
  B.cookie = "";
  B.jouer(1, 11000);
  T("session perdue : signalee, la progression reste sur l'appareil", await B.api.cpSynchro() === false && B.api.etat === "session" && B.api.prog.solved === 75, B.api.prog.solved);
  r = await B.api.cpApi("POST", "connexion", { pseudo: "Alexandre", code: await B.api.cpEtirer(pv.cle, "583920") });
  B.api.cpOuvrir(r.j.pseudo, r.j.version);
  await B.api.cpSynchro({ tirer: true });
  T("reconnexion du meme appareil : sa base est gardee, l'exercice s'ajoute (75)", lire().progress.solved === 75 && B.api.prog.solved === 75, lire().progress.solved);
  A.api.prog = { level: 1, solved: 0, streak: 0, best: 0, correctRun: 0, wrongRun: 0, seen: [], badges: [], solveLog: [], themeSolved: {} }; A.api.sauver();
  await A.api.cpEcraser();
  T("Recommencer la progression : le compte repart de zero lui aussi", lire().progress.solved === 0);
  await A.api.cpSynchro({ tirer: true });
  T("et l'ancienne progression ne revient pas sur l'appareil", A.api.prog.solved === 0);
  /* B a encore l'ancienne progression (75) et sa base : sans la date de
     remise a zero, sa synchronisation la ferait revenir partout. */
  await B.api.cpSynchro({ tirer: true });
  T("un autre appareil recoit la remise a zero au lieu de la defaire", B.api.prog.solved === 0 && lire().progress.solved === 0, B.api.prog.solved + " / " + lire().progress.solved);
  B.jouer(2, 11500);
  await B.api.cpSynchro();
  await A.api.cpSynchro({ tirer: true });
  T("puis la progression repart normalement des deux cotes (2)", A.api.prog.solved === 2 && lire().progress.solved === 2, A.api.prog.solved);
  {
    const D = appareil("D");
    D.jouer(30, 400);
    const rc = await D.api.cpApi("POST", "connexion", { pseudo: "Alexandre", code: await D.api.cpEtirer(pv.cle, "583920") });
    D.api.cpOuvrir(rc.j.pseudo, rc.j.version);
    await D.api.cpSynchro({ tirer: true });
    T("un appareil qui se connecte pour la premiere fois apres une remise a zero garde ce qu'il apporte (30)", D.api.prog.solved === 30 && lire().progress.solved === 30, D.api.prog.solved);
    await A.api.cpSynchro({ tirer: true });
  }
  A.api.cpFermer(false);
  T("deconnexion en gardant : plus de session locale, progression en place", A.api.cp === null && A.stock.has("chang64:progress"));
  const avant = A.requetes.length;
  A.jouer(1, 12000); await A.api.cpSynchro();
  T("sans compte, aucune requete ne part", A.requetes.length === avant);
  C.api.cpFermer(true);
  T("deconnexion en effacant : plus rien sur l'appareil, page relue", !C.stock.has("chang64:progress") && !C.stock.has("chang64:compte") && C.recharge === true);

  console.log("\nQR code");
  const m = A.api.cpQrMatrice("https://chang64.com/fr/#lier=Alexandre~ABC234");
  const empreinte = require("crypto").createHash("sha1").update(m.map(l => l.join("")).join("\n")).digest("hex");
  T("QR de reference : 29 modules, empreinte verifiee avec un lecteur independant", m.length === 29 && empreinte === "a773ee5f8a27466b905ee18d1621649066c34000", m.length + " " + empreinte);
  let tropLong = false; try { A.api.cpQrMatrice("x".repeat(135)); } catch (e) { tropLong = true; }
  T("texte trop long pour un QR : refuse proprement", tropLong);

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n" + ok + " OK, " + (ko + 1) + " FAIL"); process.exit(1); });
