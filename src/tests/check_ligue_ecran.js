/* Verification automatique de chang64.
   Lancement : node tests/check_ligue_ecran.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ecran « Ma ligue » de Meilleurs joueurs (2026-11-18), avec un serveur
   simule : reserve aux membres connectes ; avant l'ouverture, le nombre de
   joueurs actifs sur 50 ; ensuite la ligue, le groupe, les places qui montent
   et descendent, le message de montee ou de descente. Le serveur lui-meme
   est verifie dans check_ligues.js. */
const path = require("path"), fs = require("fs"), jd = require("jsdom");
const SITE = path.join(__dirname, "..", "site");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));

const MECHANT = '<img src=x onerror="window.pirate=1">';
let LIGUE = { ouvert: false, seuil: 50, actifs: 12 }, statut = 200, appels = 0;

function ouvrir(page) {
  const html = fs.readFileSync(path.join(SITE, page), "utf8");
  return new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/",
    virtualConsole: new jd.VirtualConsole(),
    beforeParse(w) {
      w.fetch = (u, o) => {
        const url = new URL(u, "https://chang64.com/");
        const rep = (s, corps) => Promise.resolve({ ok: s === 200, status: s, json: () => Promise.resolve(corps), text: () => Promise.resolve(JSON.stringify(corps)) });
        if (url.pathname === "/api/classement") return rep(200, { par: "semaine", semaine: "2026-11-16", joueurs: [{ p: "Alice", v: 3 }] });
        if (url.pathname === "/api/compte/ligue") { appels++; return rep(statut, statut === 200 ? LIGUE : { erreur: "serveur" }); }
        if (url.pathname.startsWith("/api/")) return rep(401, { erreur: "session" });
        if (o && o.method === "POST") return Promise.resolve({ ok: true, status: 204 });
        const f = path.join(SITE, url.pathname);
        if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return Promise.resolve({ ok: false, status: 404 });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(fs.readFileSync(f, "utf8"))) });
      };
      w.navigator.sendBeacon = () => true;
    } }).window;
}

(async () => {
  const w = ouvrir("index.html");
  await attendre(1500);
  const d = w.document, vue = () => d.getElementById("menuJoueursVue");
  const voir = async () => { w.eval('cpjCache={};cpjVue("ligue")'); await attendre(300); };

  console.log("\nSans compte");
  w.eval('menuOuvrir();menuVue("joueurs")');
  await attendre(400);
  T("pas de puce Ma ligue", !d.querySelector('#menuJoueursVue [data-cpj="ligue"]'));
  await voir();
  T("demander la ligue sans compte ramene au tableau de la semaine", appels === 0 && d.querySelector('#menuJoueursVue [aria-pressed="true"]').dataset.cpj === "semaine");

  console.log("\nAvant l'ouverture");
  w.eval('cp={pseudo:"Moi"}');
  await voir();
  T("la puce Ma ligue est proposee et active", d.querySelector('#menuJoueursVue [data-cpj="ligue"]').getAttribute("aria-pressed") === "true");
  T("12 sur 50 joueurs actifs", vue().querySelector(".cpl-attente b").textContent === "12 out of 50", vue().querySelector(".cpl-attente").textContent);
  T("la jauge suit", vue().querySelector(".cpl-jauge i").style.width === "24%");
  T("dit quand les ligues ouvrent", /open the Monday after 50 players/.test(vue().textContent));
  T("explique les ligues", /Five leagues, from Pawn to Queen/.test(vue().textContent));
  T("ni echelle ni classement", !vue().querySelector(".cpl-echelle") && !vue().querySelector(".cpl-liste"));
  LIGUE = { ouvert: false, seuil: 50, actifs: 80 };
  await voir();
  T("la jauge ne deborde jamais", vue().querySelector(".cpl-jauge i").style.width === "100%" && vue().querySelector(".cpl-attente b").textContent === "50 out of 50");

  console.log("\nLigues ouvertes");
  const groupe = Array.from({ length: 20 }, (_, i) => ({ p: i === 7 ? "Moi" : i === 2 ? MECHANT : "Joueur" + (i + 1), v: 40 - i }));
  LIGUE = { ouvert: true, semaine: "2026-11-16", ligue: 1, mouv: 1, monte: 5, descend: 5, groupe };
  await voir();
  const echelle = [...vue().querySelectorAll(".cpl-echelle li")];
  T("l'echelle des cinq ligues", echelle.map(x => x.textContent).join() === "Pawn,Knight,Bishop,Rook,Queen");
  T("sa ligue est marquee", echelle.filter(x => x.classList.contains("cpl-ici")).length === 1 && echelle[1].classList.contains("cpl-ici") && echelle[1].getAttribute("aria-current") === "true");
  T("message de montee", /You moved up a league/.test(vue().querySelector(".cpl-mouv").textContent));
  const lignes = [...vue().querySelectorAll(".cpl-liste > li")];
  const joueurs = lignes.filter(x => !x.classList.contains("cpl-zone"));
  T("les 20 joueurs du groupe, dans l'ordre", joueurs.length === 20 && joueurs[0].textContent.includes("Joueur1") && joueurs[0].querySelector("b").textContent === "40");
  T("sa ligne est mise en avant", joueurs[7].classList.contains("cpj-moi") && /\(You\)/.test(joueurs[7].textContent) && joueurs.filter(x => x.classList.contains("cpj-moi")).length === 1);
  T("la ligne de montee est apres le 5e", lignes[5].classList.contains("cpl-zone") && lignes[5].textContent === "The top 5 move up");
  T("la ligne de descente est avant les 5 derniers", lignes[16].classList.contains("cpl-zone") && lignes[16].textContent === "The bottom 5 move down" && lignes.length === 22);
  T("un pseudo piege reste du texte", joueurs[2].querySelector(".cpj-joueur").textContent === MECHANT && !vue().querySelector("img") && !w.pirate);
  T("chaque pseudo ouvre la fiche du joueur", joueurs.every(x => x.querySelector("button.cpj-joueur[data-cpp]")));

  LIGUE = { ouvert: true, semaine: "2026-11-16", ligue: 0, mouv: -1, monte: 5, descend: 0, groupe };
  await voir();
  T("message de descente", /You moved down a league/.test(vue().querySelector(".cpl-mouv").textContent));
  T("en ligue Pion : pas de ligne de descente", [...vue().querySelectorAll(".cpl-zone")].map(x => x.textContent).join() === "The top 5 move up");
  LIGUE = { ouvert: true, semaine: "2026-11-16", ligue: 2, mouv: 0, monte: 0, descend: 0, groupe: [] };
  await voir();
  T("pas encore de groupe : invite a reussir un exercice", /Solve one puzzle this week to join a group/.test(vue().textContent) && !vue().querySelector(".cpl-liste") && !vue().querySelector(".cpl-mouv") && vue().querySelectorAll(".cpl-ici").length === 1);
  LIGUE = { ouvert: true, ligue: 99, mouv: "x", monte: "a", descend: null, groupe: "non" };
  await voir();
  T("reponse abimee : pas d'erreur, ligue bornee", vue().querySelectorAll(".cpl-ici").length === 1 && vue().querySelectorAll(".cpl-echelle li")[4].classList.contains("cpl-ici"));

  console.log("\nPanne et cache");
  statut = 500;
  await voir();
  T("serveur en panne : message, pas d'ecran casse", /Could not load the list/.test(vue().textContent));
  statut = 200; LIGUE = { ouvert: false, seuil: 50, actifs: 3 };
  await voir();
  const avant = appels;
  w.eval('cpjVue("semaine")'); await attendre(200);
  w.eval('cpjVue("ligue")'); await attendre(200);
  T("revenir sur la puce dans la minute ne rappelle pas le serveur", appels === avant && /3 out of 50/.test(vue().textContent));
  w.close();

  console.log("\nTraductions");
  for (const l of ["fr", "es", "pt", "de", "ru", "it", "tr", "pl", "id"]) {
    const wl = ouvrir(l + "/index.html"); await attendre(600);
    const s = [wl.eval('t("My league")'), wl.eval('t("{n} out of {m}",{n:12,m:50})'), wl.eval('t("The top {n} move up",{n:5})'), wl.eval('t("The bottom {n} move down",{n:5})'), wl.eval('t("You moved up a league. Well played.")')];
    T(l + " : phrases traduites", !s.some(x => /league|out of|move/.test(x)) && /12/.test(s[1]) && /50/.test(s[1]) && /5/.test(s[2]) && /5/.test(s[3]), s.join(" | "));
    wl.close();
  }

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception : " + (e && e.stack || e)); process.exit(1); });
