/* Verification automatique de chang64.
   Lancement : node tests/check_connecte_ou_non.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce qui doit apparaitre connecte ou non (2026-11-19, signale par Alexandre :
   "Creer un compte" sous ses cinq dernieres parties alors qu'il etait
   connecte). La page est ouverte comme le fait un vrai navigateur, session
   deja gardee ou non, SANS forcer "cp" a la main : c'est le chargement qui
   etait faux. Les deux sens sont verifies, puis le passage de l'un a l'autre
   sans rechargement (deconnexion, connexion). */
const path = require("path"), fs = require("fs"), jd = require("jsdom");
const SITE = path.join(__dirname, "..", "site");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const PARTIES = Array.from({ length: 8 }, (x, i) => ({ m: "e2e4 e7e5", r: "w", c: "w", t: Date.now() - i * 1000 }));

function ouvrir(connecte) {
  const html = fs.readFileSync(path.join(SITE, "index.html"), "utf8");
  return new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/",
    virtualConsole: new jd.VirtualConsole(),
    beforeParse(w) {
      w.localStorage.setItem("chang64:games", JSON.stringify(PARTIES));
      if (connecte) w.localStorage.setItem("chang64:compte", JSON.stringify({ pseudo: "Moi", cle: "moi", version: 1, dev: "abc123", n: 0, sync: 0 }));
      w.fetch = (u, o) => {
        const url = new URL(u, "https://chang64.com/");
        const rep = (statut, corps) => Promise.resolve({ ok: statut === 200, status: statut, json: () => Promise.resolve(corps), text: () => Promise.resolve(JSON.stringify(corps)) });
        if (url.pathname === "/api/classement") return rep(200, { par: url.searchParams.get("par"), semaine: "2026-11-16", joueurs: [{ p: "Alice", v: 3 }] });
        /* Serveur injoignable : la session locale reste ouverte, rien n'est fusionne. */
        if (url.pathname.startsWith("/api/")) return Promise.reject(new Error("hors ligne"));
        if (o && o.method === "POST") return Promise.resolve({ ok: true, status: 204 });
        const f = path.join(SITE, url.pathname);
        if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return Promise.resolve({ ok: false, status: 404 });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(fs.readFileSync(f, "utf8"))) });
      };
      w.navigator.sendBeacon = () => true;
    } }).window;
}

/* L'etat de l'ecran, lu dans la page. */
function etat(w) {
  const d = w.document, q = s => d.querySelectorAll(s).length;
  return {
    parties: q("#historyList .history-item"),
    inviteParties: q("#historyList .membre-invite"),
    inviteBadges: q("#badgeGrid .membre-invite"),
    inviteGraphe: q("#ratingGraph .membre-invite"),
    inviteThemes: q("#themeChoix .membre-invite"),
    invites: q(".membre-invite")
  };
}
async function menu(w) {
  const d = w.document;
  w.eval('menuOuvrir();menuVue("joueurs");cpjCache={};cpjVue("resolus")');
  await attendre(400);
  const r = { amis: !!d.querySelector('#menuJoueursVue [data-cpj="amis"]'), ligue: !!d.querySelector('#menuJoueursVue [data-cpj="ligue"]'),
    profil: !!d.querySelector('#menuJoueursVue button[data-cpp="Moi"]'), creer: !!d.querySelector("#menuJoueursVue [data-vue-compte]") };
  w.eval('menuVue("badges")'); await attendre(300);
  r.collection = d.querySelectorAll("#menuBadgeGrid .bx-carte, #menuBadgeGrid .badge").length;
  r.inviteCollection = !!d.querySelector("#menuBadgeGrid .membre-invite");
  w.eval('menuVue("stats")'); await attendre(300);
  r.graphes = !!d.querySelector("#menuJoursGraph");
  r.inviteStats = !!d.querySelector("#menuStats .membre-invite, #menuRatingGraph .membre-invite");
  w.eval("menuFermer()");
  return r;
}
const dit = x => JSON.stringify(x);

(async () => {
  console.log("--- Ouverture connecte ---");
  let w = ouvrir(true);
  await attendre(600);
  let e = etat(w);
  T("des l'ouverture (avant la lecture du compte) : les 8 parties, aucune invitation", e.parties === 8 && e.inviteParties === 0, dit(e));
  T("des l'ouverture : aucune invitation a creer un compte dans la page", e.invites === 0, dit(e));
  await attendre(1500);
  e = etat(w);
  T("le compte est lu", w.eval("!!cp&&cp.pseudo") === "Moi" && w.eval("estMembre()") === true);
  T("apres la lecture du compte : toujours les 8 parties, aucune invitation", e.parties === 8 && e.invites === 0, dit(e));
  w.eval("prog.badges.push('obj_gel');rendreThemes()");
  T("un theme gagne s'applique, sans invitation", (w.eval("choisirTheme('glace')"), w.eval("prefTheme") === "glace") && etat(w).inviteThemes === 0);
  w.eval("choisirTheme('chang')");
  let m = await menu(w);
  T("menu : Mes amis, Ma ligue et Ma fiche sont la, pas de Creer un compte", m.amis && m.ligue && m.profil && !m.creer, dit(m));
  T("menu : collection de badges et graphes ouverts, sans invitation", m.collection > 50 && !m.inviteCollection && m.graphes && !m.inviteStats, dit(m));

  console.log("--- Deconnexion, sans recharger ---");
  w.eval("cpFermer(false)");
  e = etat(w);
  T("le compte est ferme", w.eval("cp") === null && w.eval("estMembre()") === false);
  T("aussitot : cinq parties puis l'invitation", e.parties === 5 && e.inviteParties === 1, dit(e));
  T("aussitot : invitation a la place des badges, du graphe et des themes gagnes", e.inviteBadges === 1 && e.inviteGraphe === 1 && e.inviteThemes === 1, dit(e));
  T("le theme gagne ne s'applique plus", (w.eval("choisirTheme('glace')"), w.eval("prefTheme") !== "glace"));
  m = await menu(w);
  T("menu : plus de Mes amis, Ma ligue ni Ma fiche ; Creer un compte propose", !m.amis && !m.ligue && !m.profil && m.creer, dit(m));
  T("menu : collection et graphes remplaces par une invitation", m.collection === 0 && m.inviteCollection && !m.graphes && m.inviteStats, dit(m));

  console.log("--- Connexion, sans recharger ---");
  w.eval('cpOuvrir("Moi",1)');
  e = etat(w);
  T("aussitot : les 8 parties, plus aucune invitation", e.parties === 8 && e.invites === 0, dit(e));
  m = await menu(w);
  T("menu : tout est rouvert", m.amis && m.ligue && m.profil && !m.creer && m.collection > 50 && m.graphes && !m.inviteCollection && !m.inviteStats, dit(m));
  w.close();

  console.log("--- Ouverture non connecte ---");
  w = ouvrir(false);
  await attendre(600);
  e = etat(w);
  T("des l'ouverture : cinq parties puis l'invitation", e.parties === 5 && e.inviteParties === 1, dit(e));
  await attendre(1500);
  e = etat(w);
  T("aucun compte lu", w.eval("cp") === null && w.eval("estMembre()") === false);
  T("ensuite : toujours cinq parties et l'invitation", e.parties === 5 && e.inviteParties === 1, dit(e));
  T("invitation a la place des badges et du graphe", e.inviteBadges === 1 && e.inviteGraphe === 1, dit(e));
  m = await menu(w);
  T("menu : rien de reserve n'est visible", !m.amis && !m.ligue && !m.profil && m.creer && m.collection === 0 && m.inviteCollection && !m.graphes && m.inviteStats, dit(m));
  T("une session abimee ne vaut pas connexion", (w.localStorage.setItem("chang64:compte", "{oups"), w.eval("estMembre()") === false) && (w.localStorage.setItem("chang64:compte", '{"pseudo":5}'), w.eval("estMembre()") === false));
  w.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
