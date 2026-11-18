/* Verification automatique de chang64.
   Lancement : node tests/check_profil_membre.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Fiche d'un membre et rang au-dela des 50 premiers (2026-11-18). Dans les
   tableaux des joueurs, chaque pseudo est un bouton qui ouvre la fiche : mois
   de creation, six chiffres, rang dans chaque tableau. Un joueur connecte
   absent des 50 premiers lit son rang sous la liste. Le serveur
   (/api/compte/profil) est verifie dans check_compte_serveur.js ; ici, les
   ecrans, avec un serveur simule. */
const path = require("path"), fs = require("fs"), jd = require("jsdom");
const SITE = path.join(__dirname, "..", "site");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));

const MECHANT = '<img src=x onerror="window.pirate=1">';
const JOUEURS = [{ p: "Alice", v: 300 }, { p: MECHANT, v: 200 }, { p: "Bob", v: 100 }];
const PROFILS = {
  Alice: { p: "Alice", depuis: "2026-03", s: 12, n: 1450, r: 300, j: 9, b: 31, k: 14, rangs: { s: 2, n: 1, r: 1, j: 4, b: 3, k: 7 } },
  Moi: { p: "Moi", depuis: "2026-11", s: 0, n: 820, r: 15, j: 1, b: 2, k: 0, rangs: { s: null, n: 73, r: 68, j: 80, b: 91, k: null } }
};
const demandes = [];

function ouvrir(page) {
  const html = fs.readFileSync(path.join(SITE, page), "utf8");
  return new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/",
    virtualConsole: new jd.VirtualConsole(),
    beforeParse(w) {
      w.fetch = (u, o) => {
        const url = new URL(u, "https://chang64.com/");
        const rep = (statut, corps) => Promise.resolve({ ok: statut === 200, status: statut, json: () => Promise.resolve(corps), text: () => Promise.resolve(JSON.stringify(corps)) });
        if (url.pathname === "/api/classement") return rep(200, { par: url.searchParams.get("par"), semaine: "2026-11-16",
          joueurs: url.searchParams.get("par") === "tout" ? JOUEURS.map(x => ({ p: x.p, s: 1, n: 900, r: x.v, j: 1, b: 1, k: 1 })) : JOUEURS });
        if (url.pathname === "/api/compte/profil") {
          const p = url.searchParams.get("p"); demandes.push(p);
          return PROFILS[p] ? rep(200, PROFILS[p]) : rep(404, { erreur: "inconnu" });
        }
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
  const d = w.document, $ = id => d.getElementById(id);
  T("la fenetre de la fiche existe, fermee", !!$("cpProfil") && $("cpProfil").hidden && $("cpProfil").getAttribute("role") === "dialog");

  w.eval('menuOuvrir();menuVue("joueurs");cpjVue("resolus")');
  await attendre(400);
  const boutons = [...d.querySelectorAll("#menuJoueursVue .cpj-joueur")];
  T("chaque pseudo du tableau est un bouton", boutons.length === 3 && boutons.every(b => b.tagName === "BUTTON" && b.type === "button"));
  T("un pseudo piege reste du texte", boutons[1].textContent === MECHANT && !d.querySelector("#menuJoueursVue img") && !w.pirate);
  T("sans compte : ni rang ni bouton Ma fiche", !$("cpjMonRang") && !d.querySelector("#menuJoueursVue [data-cpp]:not(.cpj-joueur)"));

  boutons[0].click();
  await attendre(300);
  const fiche = $("cpProfilContenu").textContent;
  T("la fiche s'ouvre sur le bon joueur", !$("cpProfil").hidden && $("cpProfilTitre").textContent === "Alice" && demandes.includes("Alice"));
  T("mois de creation en toutes lettres", /March 2026/.test(fiche), fiche.slice(0, 120));
  const lignes = [...d.querySelectorAll("#cpProfilContenu .cpp-liste li")].map(li => li.textContent);
  T("six chiffres avec leur rang", lignes.length === 6 && /1450/.test(lignes[1]) && /#1/.test(lignes[1]) && /14/.test(lignes[5]) && /#7/.test(lignes[5]), JSON.stringify(lignes));
  T("sans compte : pas de bouton de defi", !d.querySelector("#cpProfilContenu [data-cpp-defier]"));
  T("le focus est dans la fiche", $("cpProfil").contains(d.activeElement));

  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  T("Echap ferme la fiche et laisse le menu ouvert", $("cpProfil").hidden && !$("menuTiroir").hidden);

  /* Pseudo piege et profil introuvable : message, rien d'execute. */
  boutons[1].click();
  await attendre(300);
  T("profil introuvable : message d'erreur, pseudo en texte", !$("cpProfil").hidden && /Could not load this profile/.test($("cpProfilContenu").textContent) && !d.querySelector("#cpProfilContenu img") && !w.pirate);
  d.querySelector("#cpProfilContenu [data-cpp-fermer]").click();
  T("le bouton Fermer ferme", $("cpProfil").hidden);

  /* Joueur connecte, hors des 50 premiers. */
  w.eval('cp={pseudo:"Moi"};cpjCache={};cpjVue("resolus")');
  await attendre(400);
  T("connecte, hors liste : son rang s'affiche", $("cpjMonRang") && $("cpjMonRang").textContent === "Your rank: 68", $("cpjMonRang") && $("cpjMonRang").textContent);
  T("bouton Ma fiche", !!d.querySelector('#menuJoueursVue button[data-cpp="Moi"]'));
  w.eval('cpjVue("sprint")');
  await attendre(400);
  T("pas de rang dans un tableau ou il n'entre pas : phrase d'origine", $("cpjMonRang") && /top 50/.test($("cpjMonRang").textContent), $("cpjMonRang") && $("cpjMonRang").textContent);

  d.querySelector("#menuJoueursVue .cpj-joueur").click();
  await attendre(300);
  const defier = d.querySelector("#cpProfilContenu [data-cpp-defier]");
  T("connecte : bouton pour defier le joueur", !!defier && defier.dataset.cppDefier === "Alice");
  d.querySelector("#cpProfilContenu [data-cpp-fermer]").click();
  d.querySelector('#menuJoueursVue button[data-cpp="Moi"]').click();
  await attendre(300);
  T("sa propre fiche : pas de bouton de defi, rang absent note par un tiret", !d.querySelector("#cpProfilContenu [data-cpp-defier]") && /–/.test(d.querySelector("#cpProfilContenu .cpp-liste li").textContent));
  w.eval("cppFermer()");

  /* Tableau complet. */
  w.eval('document.querySelector("[data-cpj-tout]").click()');
  await attendre(400);
  const grands = [...d.querySelectorAll("#cpjGrand .cpj-joueur")];
  T("tableau complet : pseudos en boutons, piege compris", grands.length === 3 && !d.querySelector("#cpjGrand img") && !w.pirate);
  grands.find(b => b.textContent === "Alice").click();
  await attendre(300);
  T("tableau complet : la fiche s'ouvre", !$("cpProfil").hidden && $("cpProfilTitre").textContent === "Alice");
  w.eval("menuFermer()");
  T("fermer le menu ferme aussi la fiche", $("cpProfil").hidden);

  /* Le serveur n'est appele qu'une fois par joueur dans la minute. */
  T("fiche gardee une minute", demandes.filter(p => p === "Alice").length === 1, demandes.join(","));

  /* Traductions. */
  const { LANGUES } = require("../langues/registre.js");
  for (const l of LANGUES) {
    if (l.code === "en") continue;
    const dict = require("../langues/" + l.code + "/app.js");
    const cles = ["Player profile", "Member since {date}", "Could not load this profile.", "Challenge this player", "Your rank: {n}", "My profile"];
    T(l.code + " : textes de la fiche traduits, variables gardees", cles.every(k => typeof dict[k] === "string" && dict[k] !== k) && dict["Member since {date}"].includes("{date}") && dict["Your rank: {n}"].includes("{n}"));
  }

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  w.close();
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n" + ok + " OK, " + (ko + 1) + " FAIL"); process.exit(1); });
