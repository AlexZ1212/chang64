/* Verification automatique de chang64.
   Lancement : node tests/check_fiche_privee.js

   Fiche privee (2026-11-24, choix d'Alexandre par QCM : tout cacher, eteinte
   par defaut, phrase pour les parents dans Mon compte et Confidentialite).
   Colonne comptes.prive. Allumee :
   - la fiche (GET profil) ne s'ouvre qu'a lui et a ses amis, jamais en cache ;
   - absent des tableaux (classement.js), des rangs des autres fiches, des
     ligues et de la recherche de membres ;
   - seuls ses amis l'invitent (duel ici ; partie en direct ou par
     correspondance dans le Worker des parties, essaye par le serveur local) ;
     personne ne lui envoie de demande d'ami ; rien ne denonce le reglage ;
   - lui peut encore envoyer une demande d'ami ;
   - une base sans la colonne : tout le monde est public, rien ne casse. */
const path = require("path"), { pathToFileURL } = require("url"), { spawn } = require("child_process");
process.removeAllListeners("warning"); process.on("warning", () => {});
const { fausseD1 } = require("../serveur_local.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const code = n => Buffer.from(String(n).padStart(32, "x")).toString("base64url");

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, "..", "functions", "api", "compte", "[[route]].js")).href);
  const cl = await import(pathToFileURL(path.join(__dirname, "..", "functions", "api", "classement.js")).href);
  let env = { DB: fausseD1() };
  const lignes = (sql, ...a) => env.DB.brut.prepare(sql).all(...a);
  async function appel(methode, route, corps, cookie) {
    const h = { Origin: "https://chang64.com" };
    if (corps !== undefined) h["Content-Type"] = "application/json";
    if (cookie) h.Cookie = cookie;
    const [r0, q] = route.split("?");
    const req = new Request("https://chang64.com/api/compte/" + route, { method: methode, headers: h, body: corps === undefined ? undefined : JSON.stringify(corps) });
    const rep = await mod.onRequest({ request: req, env, params: { route: r0.split("/") } });
    const texte = await rep.text();
    let j = null; try { j = JSON.parse(texte); } catch (e) {}
    return { s: rep.status, j, cookie: (rep.headers.get("Set-Cookie") || "").split(";")[0], cache: rep.headers.get("Cache-Control") };
  }
  const tableau = async par => {
    const rep = await cl.onRequestGet({ request: new Request("https://chang64.com/api/classement?par=" + par), env });
    return (await rep.json()).joueurs.map(x => x.p);
  };
  const creer = async (p, solved) => (await appel("POST", "creer", { pseudo: p, code: code(1), donnees: { progress: { solved, rating: 900, days: 2 } } })).cookie;

  console.log("--- Eteinte par defaut ---");
  const cLea = await creer("Lea", 50), cBen = await creer("Ben", 20), cZoe = await creer("Zoe", 10);
  T("un nouveau compte est public", lignes("SELECT prive FROM comptes WHERE pseudo = 'Lea'")[0].prive === 0);
  T("l'etat du compte le dit", (await appel("GET", "etat", undefined, cLea)).j.prive === 0);
  T("dans les tableaux", (await tableau("resolus")).includes("Lea"));
  T("dans la recherche", (await appel("GET", "membres?q=Le", undefined, cZoe)).j.membres.includes("Lea"));

  console.log("--- Lea envoie une demande a Ben, Ben accepte ---");
  T("demande de Lea a Ben", (await appel("POST", "ami-ajouter", { pseudo: "Ben" }, cLea)).s === 202);
  T("Ben accepte", (await appel("POST", "ami-accepter", { pseudo: "Lea" }, cBen)).s < 300 && lignes("SELECT COUNT(*) AS n FROM amis")[0].n === 2);

  console.log("--- Lea allume la fiche privee ---");
  T("sans session : refuse", (await appel("POST", "prive", { prive: 1 })).s === 401);
  T("valeur farfelue : refusee", (await appel("POST", "prive", { prive: "oui" }, cLea)).s === 400);
  T("Lea l'allume", (await appel("POST", "prive", { prive: 1 }, cLea)).s === 200 && lignes("SELECT prive FROM comptes WHERE pseudo = 'Lea'")[0].prive === 1);
  T("l'etat du compte le dit", (await appel("GET", "etat", undefined, cLea)).j.prive === 1);

  console.log("--- Sa fiche ---");
  let r = await appel("GET", "profil?p=Lea");
  T("sans session : « fiche privee » (403), pas de chiffres", r.s === 403 && r.j.erreur === "prive" && r.j.r === undefined);
  r = await appel("GET", "profil?p=Lea", undefined, cZoe);
  T("Zoe, inconnue : 403 aussi", r.s === 403 && r.j.erreur === "prive");
  r = await appel("GET", "profil?p=Lea", undefined, cLea);
  T("Lea voit sa fiche, marquee privee, jamais en cache", r.s === 200 && r.j.p === "Lea" && r.j.prive === 1 && r.cache === "no-store");
  r = await appel("GET", "profil?p=Lea", undefined, cBen);
  T("Ben, son ami, la voit aussi", r.s === 200 && r.j.r === 50 && r.j.prive === 1);
  r = await appel("GET", "profil?p=Ben");
  T("la fiche publique de Ben : 1er des exercices resolus (Lea n'est plus comptee devant)", r.s === 200 && r.j.rangs.r === 1 && r.j.prive === undefined, JSON.stringify(r.j.rangs));

  console.log("--- Tableaux et recherche ---");
  for (const par of ["resolus", "note", "serie", "tout"]) T("tableau « " + par + " » : Lea absente", !(await tableau(par)).includes("Lea") && (await tableau(par)).includes("Ben"));
  T("recherche : Lea absente", !(await appel("GET", "membres?q=Le", undefined, cZoe)).j.membres.includes("Lea"));

  console.log("--- Les inconnus ---");
  r = await appel("POST", "ami-ajouter", { pseudo: "Lea" }, cZoe);
  T("demande d'ami de Zoe : repond « envoyee », rien n'est pose", r.s === 202 && r.j.etat === "demande" && lignes("SELECT COUNT(*) AS n FROM demandes_amis WHERE a = (SELECT id FROM comptes WHERE pseudo = 'Lea')")[0].n === 0);
  const EXOS = "000a000b000c000d000e", duel = a => ({ a, exos: EXOS, r: "22102", t: 95 });
  T("duel de Zoe : comme un pseudo inconnu (404)", (await appel("POST", "defi-envoyer", duel("Lea"), cZoe)).s === 404);
  T("duel de Ben, son ami : passe", (await appel("POST", "defi-envoyer", duel("Lea"), cBen)).s === 201);
  T("Lea peut encore demander Zoe en amie", (await appel("POST", "ami-ajouter", { pseudo: "Zoe" }, cLea)).s === 202 && lignes("SELECT COUNT(*) AS n FROM demandes_amis")[0].n === 1);

  console.log("--- Export ---");
  T("l'export de Lea contient ses donnees", (await appel("GET", "exporter", undefined, cLea)).s === 200);

  console.log("--- Elle l'eteint ---");
  T("Lea l'eteint", (await appel("POST", "prive", { prive: 0 }, cLea)).s === 200);
  T("sa fiche se rouvre a tous", (await appel("GET", "profil?p=Lea")).s === 200);
  T("elle revient dans les tableaux et la recherche", (await tableau("resolus")).includes("Lea") && (await appel("GET", "membres?q=Le", undefined, cZoe)).j.membres.includes("Lea"));

  console.log("--- Une base sans la colonne prive ---");
  env = { DB: fausseD1() };
  env.DB.brut.exec("ALTER TABLE comptes DROP COLUMN prive");
  const cA = await creer("Anna", 30), cB = await creer("Boris", 5);
  T("tableaux, recherche, fiche, etat, demande d'ami et duel marchent encore",
    (await tableau("resolus")).includes("Anna") && (await tableau("tout")).includes("Anna") &&
    (await appel("GET", "membres?q=An", undefined, cB)).j.membres.includes("Anna") &&
    (await appel("GET", "profil?p=Anna")).s === 200 && (await appel("GET", "etat", undefined, cA)).j.prive === 0 &&
    (await appel("POST", "ami-ajouter", { pseudo: "Anna" }, cB)).s === 202 && (await appel("POST", "defi-envoyer", duel("Anna"), cB)).s === 201);
  T("le reglage, lui, repond « indisponible »", (await appel("POST", "prive", { prive: 1 }, cA)).s === 503);

  console.log("--- Le serveur des parties (serveur local) ---");
  const serveur = spawn(process.execPath, [path.join(__dirname, "..", "serveur_local.js"), "0"], { stdio: ["ignore", "pipe", "inherit"] });
  try {
    const BASE = await new Promise((res, rej) => {
      let lu = ""; serveur.stdout.on("data", d => { lu += d; const m = lu.match(/http:\/\/localhost:\d+/); if (m) res(m[0]); });
      serveur.once("exit", () => rej(new Error("le serveur local ne demarre pas")));
    });
    const http = async (route, corps, cookie) => {
      const rep = await fetch(BASE + route, { method: "POST", headers: Object.assign({ Origin: BASE, "Content-Type": "application/json" }, cookie ? { Cookie: cookie } : {}), body: JSON.stringify(corps) });
      let j = null; try { j = await rep.json(); } catch (e) {}
      return { s: rep.status, j, cookie: (rep.headers.get("set-cookie") || "").split(";")[0] };
    };
    const ouvrir = async p => (await http("/api/compte/creer", { pseudo: p, code: code(1) })).cookie;
    const kLea = await ouvrir("Lea"), kBen = await ouvrir("Ben"), kZoe = await ouvrir("Zoe");
    await http("/api/compte/ami-ajouter", { pseudo: "Ben" }, kLea);
    await http("/api/compte/ami-accepter", { pseudo: "Lea" }, kBen);
    T("Lea allume sa fiche privee", (await http("/api/compte/prive", { prive: 1 }, kLea)).s === 200);
    r = await http("/api/partie/creer", { cad: 6, adv: "Lea" }, kZoe);
    T("invitation de Zoe (correspondance) : comme un pseudo inconnu", r.s === 404 && r.j && r.j.erreur === "adversaire", JSON.stringify(r));
    r = await http("/api/partie/creer", { cad: 0, adv: "Lea" }, kZoe);
    T("invitation de Zoe (en direct) : pareil", r.s === 404 && r.j && r.j.erreur === "adversaire", JSON.stringify(r));
    r = await http("/api/partie/creer", { cad: 6, adv: "Lea" }, kBen);
    T("invitation de Ben, son ami : passe", r.s < 300 && r.j && !r.j.erreur, JSON.stringify(r));
  } finally { serveur.kill(); }

  console.log("--- Dans la page ---");
  {
    const { ouvrir } = require("./outils/page_langue.js");
    const w = await ouvrir("fr"), d = w.document, $ = id => d.getElementById(id);
    const net = x => String(x).replace(/\s+/g, " ").trim();
    let fiche = { s: 403, j: { erreur: "prive" } };
    w.fetch = url => String(url).includes("/api/compte/profil") ? Promise.resolve({ status: fiche.s, ok: fiche.s === 200, json: () => Promise.resolve(fiche.j) }) : Promise.reject(new Error("non"));
    w.eval("cppCache={}"); await w.eval("cppOuvrir('Lea')");
    T("la fiche d'un membre prive : « Ce joueur a une fiche privee. », rien d'autre que Fermer",
      net($("cpProfilContenu").textContent).includes("Ce joueur a une fiche privée.") && !$("cpProfilContenu").querySelector("[data-cpa], [data-cpp-defier]"), net($("cpProfilContenu").textContent));
    w.eval("cppFermer()");
    fiche = { s: 500, j: { erreur: "serveur" } };
    w.eval("cppCache={}"); await w.eval("cppOuvrir('Ben')");
    T("une autre erreur garde son message", !net($("cpProfilContenu").textContent).includes("fiche privée"), net($("cpProfilContenu").textContent));
    w.eval("cppFermer()");
    w.eval("cp={pseudo:'Lea',pays:'',prive:1,sync:Date.now()};cpVue('connecte')");
    const b = $("cpPrive");
    T("Mon compte : l'interrupteur « Fiche privee », allume, avec la phrase pour les parents", !!b && b.getAttribute("role") === "switch" && b.getAttribute("aria-checked") === "true" &&
      net(b.textContent) === "Fiche privée" && net($("cpPriveAide").textContent).startsWith("Pour un enfant : allume-la."));
    w.close();
  }

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
