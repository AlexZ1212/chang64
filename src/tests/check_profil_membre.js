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
  Alice: { pays: "FR", p: "Alice", depuis: "2026-03", s: 12, n: 1450, r: 300, j: 9, b: 31, k: 14, rangs: { s: 2, n: 1, r: 1, j: 4, b: 3, k: 7 },
    bl: ["solved_1", "days_3", "inconnu_xyz", "_profil", "<img src=x onerror=\"window.pirate=1\">"].concat(["solved_10", "solved_25", "solved_50", "solved_64", "solved_100", "days_1", "days_7", "days_14", "days_30", "eg_kq", "eg_kr", "eg_krr", "eg_kp", "mb_compte", "duel_lien"]) },
  Moi: { p: "Moi", depuis: "2026-11", s: 0, n: 820, r: 15, j: 1, b: 2, k: 0, rangs: { s: null, n: 73, r: 68, j: 80, b: 91, k: null } }
};
const demandes = [];
/* Amis : la liste tenue par le faux serveur, et ses appels. */
let AMIS = [], amisPleins = false;
const appelsAmis = [];

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
        if (url.pathname === "/api/compte/amis") return rep(200, { semaine: "2026-11-16", moi: { p: "Moi", s: 3, n: 820, r: 15, j: 1, b: 2, k: 0 }, amis: AMIS.map(p => ({ p, s: p === "Alice" ? 12 : 1, n: 900, r: 50, j: 1, b: 1, k: 1 })) });
        if (url.pathname === "/api/compte/ami-ajouter" || url.pathname === "/api/compte/ami-retirer") {
          const p = JSON.parse(o.body).pseudo; appelsAmis.push(url.pathname.slice(12) + ":" + p);
          if (url.pathname.endsWith("ajouter")) { if (amisPleins) return rep(429, { erreur: "trop" }); if (!AMIS.includes(p)) AMIS.push(p); return Promise.resolve({ ok: true, status: 201, json: () => Promise.resolve({ ok: true, pseudo: p }) }); }
          AMIS = AMIS.filter(x => x !== p); return rep(200, { ok: true });
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
  T("sans compte : pas de tableau Mes amis", !d.querySelector('#menuJoueursVue [data-cpj="amis"]'));
  T("sans compte : ni rang ni bouton Ma fiche", !$("cpjMonRang") && !d.querySelector("#menuJoueursVue [data-cpp]:not(.cpj-joueur)"));

  boutons[0].click();
  await attendre(300);
  const fiche = $("cpProfilContenu").textContent;
  T("la fiche s'ouvre sur le bon joueur", !$("cpProfil").hidden && $("cpProfilTitre").textContent === "Alice" && demandes.includes("Alice"));
  T("medaille de profil dans l'en-tete, or pour un premier rang, sans arc", !!d.querySelector("#cpProfilContenu .cpp-tete .cpp-medaille svg.bx-or") && !d.querySelector("#cpProfilContenu .cpp-avatar"));
  {
    const meds = [...d.querySelectorAll("#cpProfilContenu .cpp-badges li")];
    T("badges du joueur : 13 medailles, les plus recentes d'abord, puis le reste en nombre", meds.length === 14 && meds.slice(0, 13).every(li => li.querySelector("svg.bx-medaille")) && meds[13].textContent === "+4", meds.length + " " + (meds[13] && meds[13].textContent));
    T("badges du joueur : chaque medaille porte son nom", meds.slice(0, 13).every(li => li.getAttribute("title") && li.querySelector(".cp-sr").textContent.length > 1), meds[0] && meds[0].getAttribute("title"));
    T("badges du joueur : identifiants inconnus ou pieges ignores", !d.querySelector("#cpProfilContenu .cpp-badges img") && !w.pirate);
  }
  T("pays choisi par le joueur : affiche sous son nom", !!d.querySelector("#cpProfilContenu .cpp-pays") && /France/.test(d.querySelector("#cpProfilContenu .cpp-pays").textContent));
  T("code de pays inconnu : rien d'affiche", w.eval('cpyLigne("XX")') === "" && w.eval('cpyLigne("<b")') === "" && /France/.test(w.eval('cpyLigne("FR")')));
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
  T("joueur sans badge : pas de rangee de badges", !d.querySelector("#cpProfilContenu .cpp-badges"));
  T("sa propre fiche : pas de bouton de defi, rang absent note par un tiret", !d.querySelector("#cpProfilContenu [data-cpp-defier]") && /–/.test(d.querySelector("#cpProfilContenu .cpp-liste li").textContent));
  w.eval("cppFermer()");

  /* Amis : ajouter depuis la fiche, tableau Mes amis, retirer. */
  T("connecte : tableau Mes amis propose", !!d.querySelector('#menuJoueursVue [data-cpj="amis"]'));
  w.eval('cpjVue("amis")');
  await attendre(400);
  T("aucun ami : invitation a ouvrir une fiche", /No friends yet/.test($("menuJoueursVue").textContent) && !d.querySelector("#menuJoueursVue .cpj-liste:not(.cpj-trouves)"));
  w.eval('cpjVue("resolus")');
  await attendre(300);
  d.querySelector("#menuJoueursVue .cpj-joueur").click();
  await attendre(300);
  let ami = d.querySelector("#cpProfilContenu [data-cpa]");
  T("fiche d'un autre : bouton pour l'ajouter a ses amis", !!ami && ami.dataset.cpa === "ajouter" && ami.dataset.pseudo === "Alice" && /Add to my friends/.test(ami.textContent));
  amisPleins = true; ami.click(); await attendre(300);
  T("liste pleine : message, bouton rendu", /friends list is full/.test($("cppMsg").textContent) && !d.querySelector("#cpProfilContenu [data-cpa]").disabled);
  amisPleins = false; d.querySelector("#cpProfilContenu [data-cpa]").click(); await attendre(400);
  ami = d.querySelector("#cpProfilContenu [data-cpa]");
  T("ajoute : le bouton propose de le retirer", appelsAmis.includes("ami-ajouter:Alice") && !!ami && ami.dataset.cpa === "retirer" && /Remove from my friends/.test(ami.textContent), appelsAmis.join());
  T("badge d'ami : note, pas encore annonce (il attend la fin d'un exercice)", w.eval("bxEtat().f.mb_ami===1&&!prog.badges.includes('mb_ami')"));
  w.eval('cppFermer();cpjVue("amis")');
  await attendre(400);
  const rangees = [...d.querySelectorAll("#menuJoueursVue .cpj-liste li")].map(li => li.textContent);
  T("Mes amis : soi et ses amis, classes par exercices de la semaine", rangees.length === 2 && /Alice/.test(rangees[0]) && /12/.test(rangees[0]) && /Moi/.test(rangees[1]) && /You/.test(rangees[1]), JSON.stringify(rangees));
  d.querySelector('#menuJoueursVue .cpj-liste .cpj-joueur[data-cpp="Alice"]').click();
  await attendre(300);
  d.querySelector("#cpProfilContenu [data-cpa]").click();
  await attendre(400);
  T("retire : la liste se vide sans recharger", appelsAmis.includes("ami-retirer:Alice") && /No friends yet/.test($("menuJoueursVue").textContent) && d.querySelector("#cpProfilContenu [data-cpa]").dataset.cpa === "ajouter");
  d.querySelector('#cpProfilContenu [data-cpp-fermer]').click();
  d.querySelector('#menuJoueursVue button[data-cpp="Moi"]').click();
  await attendre(300);
  T("sa propre fiche : pas de bouton d'ami", !d.querySelector("#cpProfilContenu [data-cpa]"));
  w.eval('cppFermer();cp=null;cpjVue()');
  await attendre(300);
  T("deconnecte sur Mes amis : retour au tableau de la semaine", !d.querySelector('#menuJoueursVue [data-cpj="amis"]') && d.querySelector('#menuJoueursVue [data-cpj="semaine"]').getAttribute("aria-pressed") === "true");
  w.eval('cp={pseudo:"Moi"};cpjVue("resolus")');
  await attendre(300);

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

  /* Badges de membre et de defi (2026-11-18). */
  T("hors des 10 premiers : pas de badge du top 10", !w.eval("bxEtat().f.mb_top10"));
  PROFILS.Moi.rangs.b = 7;
  w.eval('cppCache={};cppLire("Moi")');
  await attendre(200);
  T("dans les 10 premiers d'un tableau : badge note", w.eval("bxEtat().f.mb_top10===1"));
  w.eval('cppCache={};cppLire("Alice")');
  await attendre(200);
  /* L'annonce (fenetre de felicitations) est neutralisee : elle retarderait la fin des defis simules plus bas. */
  w.eval("bravoAnnoncer=()=>{};checkBadges()");
  T("fin d'exercice avec un compte : badges de membre accordes", w.eval("['mb_compte','mb_ami','mb_top10'].every(x=>prog.badges.includes(x))"), w.eval("prog.badges.join()"));
  T("sans les avoir merites : ni defi envoye ni avis", !w.eval("prog.badges.includes('mb_defi')||prog.badges.includes('mb_avis')"));
  w.eval('duel={ids:["p1","p2","p3","p4","p5"],i:4,res:[2,2,2,2,2],ms:9000,debut:0,faute:false,adv:null,charge:false,fin:true};duelVueCree=()=>{};duelTenterFin();');
  T("defi termine sans faute : Gant jete et Cinq sur cinq", w.eval("bxEtat().f.duel_lien===1&&bxEtat().f.duel_parfait===1&&!bxEtat().f.duel_gagne"), w.eval("JSON.stringify(bxEtat().f)"));
  w.eval('duel={ids:["p1","p2","p3","p4","p5"],i:4,res:[2,1,2,0,2],ms:9000,debut:0,faute:false,adv:{r:"21100",t:50,n:"Al"},charge:false,fin:true};duelVueReponse=()=>{};duelTenterFin();');
  T("defi releve et gagne : Touche", w.eval("bxEtat().f.duel_gagne===1"));
  {
    const md = JSON.parse(fs.readFileSync(path.join(SITE, "data", "badges-medailles.json"), "utf8"));
    const ids = ["duel_lien", "duel_gagne", "duel_parfait", "mb_compte", "mb_defi", "mb_ami", "mb_top10", "mb_avis"];
    T("les huit badges ont leur medaille", ids.every(id => Array.isArray(md[id]) && ["bronze", "argent", "or"].includes(md[id][0]) && /<path /.test(md[id][1]) && !/<script|onw+=/.test(md[id][1])));
    for (const l of require("../langues/registre.js").LANGUES) {
      const tx = JSON.parse(fs.readFileSync(path.join(SITE, "data", "badges-" + l.code + ".json"), "utf8"));
      T(l.code + " : nom, condition et anecdote des huit badges, famille Membres", ids.every(id => Array.isArray(tx[id]) && tx[id].length === 3 && tx[id].every(x => typeof x === "string" && x.length > 2)) && !!tx._ui["famille:membres"]);
    }
  }

  /* Presentation du compte en trois etapes (2026-11-18) : seulement sans
     compte, deux fois au plus, a quatorze jours d'ecart. */
  w.eval('cp=null;localStorage.removeItem("chang64:compteInvite")');
  T("presentation du compte : due pour un joueur sans compte", w.eval("cpiDue()") === true);
  w.eval("cpiOuvrir()");
  T("presentation : trois etapes, la premiere ouverte", !$("cpInvite").hidden && d.querySelectorAll("#cpInviteContenu .cpi-points i").length === 3 && /Keep your progress/.test($("cpInviteTitre").textContent));
  d.querySelector('#cpInviteContenu [data-cpi="suite"]').click();
  d.querySelector('#cpInviteContenu [data-cpi="suite"]').click();
  T("presentation : la derniere etape propose de creer un compte", /A username and a code/.test($("cpInviteTitre").textContent) && !!d.querySelector('#cpInviteContenu [data-cpi="creer"]'));
  d.querySelector('#cpInviteContenu [data-cpi="fermer"]').click();
  T("presentation : Plus tard ferme, et elle ne revient pas tout de suite", $("cpInvite").hidden && w.eval("cpiDue()") === false);
  w.eval('localStorage.setItem("chang64:compteInvite",JSON.stringify({n:1,t:Date.now()-15*864e5}))');
  T("presentation : de nouveau due quatorze jours plus tard", w.eval("cpiDue()") === true);
  w.eval('localStorage.setItem("chang64:compteInvite",JSON.stringify({n:2,t:Date.now()-90*864e5}))');
  T("presentation : jamais plus de deux fois", w.eval("cpiDue()") === false);
  w.eval('localStorage.removeItem("chang64:compteInvite");cp={pseudo:"Moi"}');
  T("presentation : jamais avec un compte", w.eval("cpiDue()") === false);

  /* Le serveur n'est appele qu'une fois par joueur dans la minute. */
  T("fiche gardee une minute", demandes.filter(p => p === "Alice").length === 2, demandes.join(","));

  /* Traductions. */
  const { LANGUES } = require("../langues/registre.js");
  for (const l of LANGUES) {
    if (l.code === "en") continue;
    const dict = require("../langues/" + l.code + "/app.js");
    const cles = ["My friends", "Add to my friends", "Remove from my friends", "No friends yet. Open a player's profile to add them.", "You and your friends, by puzzles solved since Monday.", "Your friends list is full.", "Player profile", "Member since {date}", "Could not load this profile.", "Challenge this player", "Your rank: {n}", "My profile"];
    T(l.code + " : textes de la fiche traduits, variables gardees", cles.every(k => typeof dict[k] === "string" && dict[k] !== k) && dict["Member since {date}"].includes("{date}") && dict["Your rank: {n}"].includes("{n}"));
  }

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  w.close();
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n" + ok + " OK, " + (ko + 1) + " FAIL"); process.exit(1); });
