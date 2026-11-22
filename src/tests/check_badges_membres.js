/* Verification automatique de chang64.
   Lancement : node tests/check_badges_membres.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Badges des nouvelles fonctions (2026-11-22, liste et paliers valides par
   Alexandre) : parties entre membres, Blitz, correspondance, adversaire au
   hasard, Elo entre membres et contre l'ordinateur, ligues, amis, defis
   entre membres, coups prepares.
   - le catalogue : 30 badges, chacun avec sa medaille (sans transparence) et
     ses trois textes dans les 10 langues ;
   - le serveur des parties envoie a chacun ses compteurs avec l'etat final ;
   - les conditions, a partir de ces nombres et de ce que la partie montre ;
   - l'annonce : jamais pendant une partie, la fenetre Bravo a la fin ;
   - le rattrapage : ce qui a deja ete merite entre dans la collection sans
     fenetre, avec une seule annonce discrete ;
   - rien d'incoherent pour un visiteur sans compte ; les badges de ligue
     restent caches tant que les ligues sont fermees. */
const path = require("path"), fs = require("fs"), { pathToFileURL } = require("url"), crypto = require("crypto");
const { ouvrir, SITE } = require("./outils/page_langue.js");
const { fausseD1 } = require("../serveur_local.js");
const { fauxCloudflare } = require("../worker-parties/faux_cloudflare.js");
const { CODES } = require("../langues/registre.js");
const CATALOGUE = require("../badges-catalogue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const dit = x => JSON.stringify(x);

const NOUVEAUX = ["eo_etabli", "eo_900", "eo_1000", "eo_1200", "eo_1500", "pre_coup", "lec_membre", "lec_membre_temps", "mb_ami_partie", "mb_defi_gagne", "mb_amis5",
  "mp_1", "mp_victoire", "mp_10", "mp_50", "mp_david", "mp_revanche", "mp_hasard", "cad_blitz", "cad_corr", "cad_simul", "cad_toutes", "em_etabli", "em_900", "em_1000", "em_1200",
  "ligue_groupe", "ligue_monte", "ligue_tour", "ligue_dame"];
/* Un nom propre peut rester le meme d'une langue a l'autre ; pas une condition ni une anecdote. */
const COUPS = ["e2e4", "e7e5", "g1f3", "b8c6"];
const etat = o => Object.assign({ t: "etat", id: "aaaaaaaaaaaa", n: 1, cad: [600, 0], moi: "b", b: "Moi", nr: "Anna", coups: COUPS, tb: 600000, tn: 600000, maj: 0, h: 0,
  phase: "fin", fin: { r: "1-0", m: "mat" }, nulle: null, rev: { b: false, n: false }, la: { b: true, n: true }, elo: null, cpt: null, inv: null }, o || {});
const faits = w => w.eval("Object.keys(bxEtat().f)");
const gagnes = w => w.eval("prog.badges.slice()");
const fin = (w, o) => { w.__e = etat(o); w.eval("bxmFin(window.__e)"); };
const vider = w => w.eval("prog.badges=[];prog.badgeDates={};prog.bx={f:{},j:{},c:{}};bravoFermer();bravoFile=[];");

(async () => {
  console.log("--- Le catalogue, les medailles, les textes ---");
  T("30 badges nouveaux, tous au catalogue", NOUVEAUX.length === 30 && NOUVEAUX.every(id => CATALOGUE.some(b => b[0] === id)));
  T("aucun identifiant en double dans le catalogue", new Set(CATALOGUE.map(b => b[0])).size === CATALOGUE.length);
  {
    const doubles = CATALOGUE.filter(b => NOUVEAUX.includes(b[0]) && CATALOGUE.some(x => x !== b && x[3] === b[3])).map(b => b[3]);
    T("aucun badge nouveau ne reprend le nom d'un autre (francais)", !doubles.length, doubles.join(", "));
  }
  {
    /* Une famille tient d'un seul tenant dans la collection : sinon son titre s'y repete. */
    const fams = ["parties_membres", "ligues"].map(f => CATALOGUE.map((b, i) => (b[1] === f ? i : -1)).filter(i => i >= 0));
    T("les deux familles nouvelles sont d'un seul tenant", fams.every(l => l.length && l[l.length - 1] - l[0] === l.length - 1), dit(fams.map(l => l.length)));
    T("15 badges de parties entre membres, 4 de ligue", fams[0].length === 15 && fams[1].length === 4);
  }
  const M = JSON.parse(fs.readFileSync(path.join(SITE, "data", "badges-medailles.json"), "utf8"));
  T("chaque badge nouveau a sa medaille", NOUVEAUX.every(id => Array.isArray(M[id]) && ["bronze", "argent", "or"].includes(M[id][0]) && M[id][1].length > 40), NOUVEAUX.filter(id => !M[id]).join(","));
  T("aucune medaille nouvelle n'utilise la transparence", NOUVEAUX.every(id => !/opacity|rgba\(/.test(M[id][1])), NOUVEAUX.filter(id => /opacity|rgba\(/.test(M[id][1])).join(","));
  T("aucun dessin nouveau ne reprend tel quel une medaille existante", NOUVEAUX.every(id => Object.keys(M).every(k => k === id || M[k][1] !== M[id][1])),
    NOUVEAUX.filter(id => Object.keys(M).some(k => k !== id && M[k][1] === M[id][1])).join(","));
  const textes = {};
  for (const c of CODES) textes[c] = JSON.parse(fs.readFileSync(path.join(SITE, "data", "badges-" + c + ".json"), "utf8"));
  T("10 langues", CODES.length === 10);
  for (const c of CODES) {
    const t = textes[c], manque = NOUVEAUX.filter(id => !Array.isArray(t[id]) || t[id].length !== 3 || t[id].some(x => typeof x !== "string" || !x.trim()));
    T(c + " : nom, condition et anecdote pour les 30 badges", !manque.length, manque.join(","));
    if (c !== "en") {
      const pareil = NOUVEAUX.filter(id => t[id] && (t[id][1] === textes.en[id][1] || t[id][2] === textes.en[id][2]));
      T(c + " : conditions et anecdotes traduites, pas laissees en anglais", !pareil.length, pareil.join(","));
    }
    T(c + " : les deux familles ont leur nom", !!t._ui["famille:parties_membres"] && !!t._ui["famille:ligues"] && (c === "en" || t._ui["famille:parties_membres"] !== textes.en._ui["famille:parties_membres"]));
    T(c + " : aucun emoji", NOUVEAUX.every(id => !/[\u{1F000}-\u{1FFFF}\u2600-\u27BF]/u.test(t[id].join(" "))));
  }
  T("fr : la ligue porte le nom que le site lui donne (Tour, Dame)", /ligue\u00a0?Tour$| Tour$/.test(textes.fr.ligue_tour[1]) && / Dame$/.test(textes.fr.ligue_dame[1]), textes.fr.ligue_tour[1] + " | " + textes.fr.ligue_dame[1]);
  T("de, pl : idem avec Turm et Wie\u017ca", /Turm/.test(textes.de.ligue_tour[1]) && /Wie\u017ca/.test(textes.pl.ligue_tour[1]), textes.de.ligue_tour[1] + " | " + textes.pl.ligue_tour[1]);
  T("fr : ponctuation haute liee au mot qui precede", !/ [:;!?\u00bb]/.test(NOUVEAUX.map(id => textes.fr[id].join(" ")).join(" ")));
  {
    const N = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "nouveautes.json"), "utf8"))[0];
    T("une nouveaute en tete, dans les 10 langues", CODES.every(c => Array.isArray(N[c]) && N[c].length === 2 && N[c].every(x => x.trim())) && /badge/i.test(N.en[0] + N.en[1]), N.en && N.en[0]);
  }

  console.log("--- Le serveur des parties envoie les compteurs ---");
  {
    const mod = await import(pathToFileURL(path.join(__dirname, "..", "worker-parties", "index.js")).href);
    const env = { DB: fausseD1() };
    const faux = fauxCloudflare(mod.Partie, env);
    env.PARTIES = faux.espace;
    const cookies = {};
    let numero = 0;
    const membre = pseudo => {
      const jeton = crypto.randomBytes(32).toString("base64url"), id = ++numero, now = Date.now();
      env.DB.brut.prepare("INSERT INTO comptes (id, cle, pseudo, pin_hash, secours_hash, cree, vu, donnees) VALUES (?, ?, ?, 'x', 'x', ?, ?, NULL)").run(id, pseudo.toLowerCase(), pseudo, now, now);
      env.DB.brut.prepare("INSERT INTO jetons (hash, compte_id, cree, vu) VALUES (?, ?, ?, ?)").run(crypto.createHash("sha256").update(jeton).digest("base64url"), id, now, now);
      cookies[pseudo] = "__Secure-c64=" + jeton;
      return id;
    };
    membre("Anna"); membre("Bob");
    const appel = (methode, route, corps, qui) => mod.default.fetch(new Request("https://chang64.com/api/partie/" + route, {
      method: methode, headers: Object.assign({ Origin: "https://chang64.com" }, qui ? { Cookie: cookies[qui] } : {}, corps ? { "Content-Type": "application/json" } : {}),
      body: corps ? JSON.stringify(corps) : undefined
    }), env);
    const fil = async (id, qui) => (await mod.default.fetch(new Request("https://chang64.com/api/partie/ws?id=" + id, { headers: { Upgrade: "websocket", Origin: "https://chang64.com", Cookie: cookies[qui] } }), env)).webSocket;
    const partie = async cad => {
      const id = (await (await appel("POST", "creer", { cad: cad || 0 }, "Anna")).json()).id;
      const x = await fil(id, "Anna"), y = await fil(id, "Bob"), aBlanc = x.dernier().moi === "b";
      return { id, B: aBlanc ? x : y, N: aBlanc ? y : x };
    };
    const jouer = (g, coups) => coups.split(" ").reduce((p, c, i) => p.then(() => faux.envoyer(g.id, i % 2 ? g.N : g.B, { t: "coup", c })), Promise.resolve());
    /* Apres une revanche, les couleurs peuvent avoir tourne : on relit qui a les Blancs. */
    const couleurs = g => { const a = g.B, b = g.N; if (a.dernier().moi !== "b") { g.B = b; g.N = a; } };
    const MAT_NOIR = "f2f3 e7e5 g2g4 d8h4";
    let g = await partie(0);
    T("pendant la partie : pas de compteurs", g.B.dernier().cpt === null && g.N.dernier().cpt === null, dit(g.B.dernier().cpt));
    await jouer(g, MAT_NOIR);
    let vB = g.B.dernier(), vN = g.N.dernier();
    T("fin de partie : le gagnant recoit 1 victoire, 1 partie classee en Rapide", vN.phase === "fin" && dit(vN.cpt) === dit({ v: 1, n: 0, d: 0, f: [0, 1, 0, 0] }), dit(vN.cpt));
    T("le perdant recoit sa defaite, pas les chiffres de l'autre", dit(vB.cpt) === dit({ v: 0, n: 0, d: 1, f: [0, 1, 0, 0] }), dit(vB.cpt));
    T("l'Elo arrive dans le meme etat que les compteurs", !!vN.elo && vN.elo.n.r === 820);
    await faux.envoyer(g.id, g.B, { t: "revanche" });
    await faux.envoyer(g.id, g.N, { t: "revanche" });
    T("revanche : la nouvelle manche ne porte plus les compteurs", g.B.dernier().phase !== "fin" && g.B.dernier().cpt === null && g.B.dernier().n === 2, dit([g.B.dernier().phase, g.B.dernier().n]));
    couleurs(g);
    await jouer(g, MAT_NOIR);
    vN = g.N.dernier();
    T("la revanche finie compte a son tour (manche 2)", vN.n === 2 && vN.cpt && vN.cpt.v + vN.cpt.d === 2 && vN.cpt.f[1] === 2, dit(vN.cpt));
    g = await partie(9);
    await jouer(g, MAT_NOIR);
    vN = g.N.dernier();
    T("Blitz 3+2 : une partie classee dans la famille Blitz", vN.elo && vN.elo.f === "b" && vN.cpt && vN.cpt.f[0] === 1 && vN.cpt.f[1] === 2, dit(vN.cpt));
    env.DB.brut.exec("ALTER TABLE comptes RENAME COLUMN elo_corr_n TO elo_corr_x");
    g = await partie(0);
    await jouer(g, MAT_NOIR);
    vN = g.N.dernier();
    T("base sans une colonne : pas de compteurs, mais la partie finit et le resultat compte", vN.phase === "fin" && vN.cpt === null &&
      env.DB.brut.prepare("SELECT SUM(direct_v) AS v FROM comptes").get().v === 4, dit([vN.phase, vN.cpt]));
    env.DB.brut.exec("ALTER TABLE comptes RENAME COLUMN elo_corr_x TO elo_corr_n");
  }

  console.log("--- Les nombres du serveur ---");
  let w = await ouvrir("en", { attente: 2700, fetch: true });
  let d = w.document, $ = id => d.getElementById(id);
  T("les 30 badges sont dans la liste de l'application", NOUVEAUX.every(id => w.eval("BADGES.some(b=>b.id===" + dit(id) + ")")));
  const nombres = x => { w.__x = x; return w.eval("bxmNombres(window.__x)"); };
  T("rien pour un membre qui n'a jamais joue", nombres({ v: 0, n: 0, d: 0, f: [0, 0, 0, 0], r: 0 }).length === 0);
  T("une nulle : la premiere partie seulement", dit(nombres({ v: 0, n: 1, d: 0, f: [0, 1, 0, 0], r: 800 })) === dit(["mp_1"]));
  T("une victoire : premiere partie et premier point", dit(nombres({ v: 1, n: 0, d: 0, f: [0, 1, 0, 0], r: 820 })) === dit(["mp_1", "mp_victoire"]));
  T("9 parties : pas encore les 10", !nombres({ v: 3, n: 3, d: 3, f: [0, 9, 0, 0], r: 800 }).includes("mp_10"));
  T("10 parties : palier atteint, pas celui des 50", nombres({ v: 4, n: 3, d: 3, f: [0, 10, 0, 0], r: 800 }).includes("mp_10") && !nombres({ v: 40, n: 5, d: 4, f: [0, 49, 0, 0], r: 800 }).includes("mp_50"));
  T("50 parties", nombres({ v: 20, n: 10, d: 20, f: [0, 50, 0, 0], r: 800 }).includes("mp_50"));
  T("une defaite : la lecon", nombres({ v: 0, n: 0, d: 1, f: [0, 1, 0, 0], r: 780 }).includes("lec_membre"));
  T("Blitz et correspondance : chacun son badge", (l => l.includes("cad_blitz") && l.includes("cad_corr") && !l.includes("cad_toutes"))(nombres({ v: 2, n: 0, d: 0, f: [1, 0, 0, 1], r: 800 })));
  T("les quatre familles", nombres({ v: 4, n: 0, d: 0, f: [1, 1, 1, 1], r: 800 }).includes("cad_toutes") && !nombres({ v: 3, n: 0, d: 0, f: [1, 1, 0, 1], r: 800 }).includes("cad_toutes"));
  T("Elo etabli a 20 parties d'une meme famille, pas a 19, pas en additionnant", nombres({ v: 20, n: 0, d: 0, f: [0, 0, 20, 0], r: 800 }).includes("em_etabli") &&
    !nombres({ v: 19, n: 0, d: 0, f: [0, 19, 0, 0], r: 800 }).includes("em_etabli") && !nombres({ v: 30, n: 0, d: 0, f: [10, 10, 10, 0], r: 800 }).includes("em_etabli"));
  T("paliers d'Elo : 900, 1000, 1200", (l => l.includes("em_900") && l.includes("em_1000") && !l.includes("em_1200"))(nombres({ v: 9, n: 0, d: 0, f: [0, 9, 0, 0], r: 1199 })) &&
    nombres({ v: 9, n: 0, d: 0, f: [0, 9, 0, 0], r: 1200 }).includes("em_1200") && !nombres({ v: 1, n: 0, d: 0, f: [0, 1, 0, 0], r: 899 }).includes("em_900"));
  T("des nombres abimes ne donnent rien", nombres(null).length === 0 && nombres({ v: "x", n: -4, d: NaN, f: "non", r: {} }).length === 0);
  w.__j = { p: "Moi", dir: { v: 12, n: 1, d: 3 }, ef: { b: { r: 950, n: 2 }, r: { r: 1010, n: 21 }, c: null, k: { r: 800, n: 1 } } };
  T("la fiche du serveur est lue : parties, familles, meilleur Elo", dit(w.eval("bxmDepuisFiche(window.__j)")) === dit({ v: 12, n: 1, d: 3, f: [2, 21, 0, 1], r: 1010 }), dit(w.eval("bxmDepuisFiche(window.__j)")));
  w.__j = { p: "Moi", dir: { v: 1, n: 0, d: 0 }, em: { r: 905, n: 1 } };
  T("une fiche d'avant l'Elo par famille : le Rapide seul", dit(w.eval("bxmDepuisFiche(window.__j)")) === dit({ v: 1, n: 0, d: 0, f: [0, 1, 0, 0], r: 905 }));
  w.__j = { p: "Moi" };
  T("une fiche sans partie : des zeros", dit(w.eval("bxmDepuisFiche(window.__j)").f) === dit([0, 0, 0, 0]));

  console.log("--- La fin d'une partie entre membres ---");
  vider(w);
  w.eval('cp={pseudo:"Moi"};cpaCharger=()=>Promise.resolve({amis:[]});');
  fin(w, { phase: "jeu", fin: null });
  T("partie en cours : rien", faits(w).length === 0, dit(faits(w)));
  fin(w, { fin: { r: "", m: "annulee" } });
  T("partie annulee : rien", faits(w).length === 0, dit(faits(w)));
  fin(w, { coups: ["e2e4"] });
  T("moins de deux coups : rien", faits(w).length === 0);
  fin(w, { b: "Moi", nr: "Moi" });
  T("les deux places au meme compte : rien", faits(w).length === 0);
  fin(w, {});
  let f = faits(w);
  T("victoire : premiere partie et premier point", f.includes("mp_1") && f.includes("mp_victoire") && !f.includes("lec_membre"), dit(f));
  T("ni revanche, ni hasard, ni Blitz pour une premiere partie en Rapide", !f.includes("mp_revanche") && !f.includes("mp_hasard") && !f.includes("cad_blitz") && !f.includes("cad_corr"), dit(f));
  T("la partie compte comme une activite du jour", w.eval("Object.keys(bxEtat().j).length") === 1);
  vider(w);
  fin(w, { fin: { r: "0-1", m: "abandon" } });
  f = faits(w);
  T("defaite : la lecon, pas le point", f.includes("lec_membre") && !f.includes("mp_victoire") && !f.includes("lec_membre_temps"), dit(f));
  fin(w, { fin: { r: "0-1", m: "temps" } });
  T("defaite au temps : sa lecon", faits(w).includes("lec_membre_temps"));
  vider(w);
  fin(w, { moi: "n", b: "Anna", nr: "Moi", fin: { r: "0-1", m: "temps" } });
  T("gagner au temps avec les Noirs n'est pas une defaite", faits(w).includes("mp_victoire") && !faits(w).includes("lec_membre_temps"), dit(faits(w)));
  vider(w);
  fin(w, { fin: { r: "1/2", m: "accord" } });
  T("nulle : la partie compte, sans point ni lecon", dit(faits(w).filter(x => NOUVEAUX.includes(x))) === dit(["mp_1"]), dit(faits(w)));
  vider(w);
  fin(w, { n: 2 });
  T("deuxieme manche en direct : la revanche", faits(w).includes("mp_revanche"));
  vider(w);
  fin(w, { n: 2, cad: [259200, 0] });
  T("par correspondance : pas de revanche (c'est une autre partie), mais la carte postale", !faits(w).includes("mp_revanche") && faits(w).includes("cad_corr"), dit(faits(w)));
  vider(w);
  fin(w, { cad: [180, 2] });
  T("3+2 : le Blitz, meme si l'Elo n'est pas encore arrive", faits(w).includes("cad_blitz"));
  vider(w);
  w.eval('bxmHasard("bbbbbbbbbbbb");bxmHasard("pas un identifiant");');
  fin(w, {});
  T("une autre partie que celle tiree au hasard : pas de badge", !faits(w).includes("mp_hasard"));
  fin(w, { id: "bbbbbbbbbbbb" });
  T("la partie tiree au hasard, reconnue a sa fin", faits(w).includes("mp_hasard") && dit(w.eval("bxEtat().c.hasard")) === dit(["bbbbbbbbbbbb"]));
  w.eval('for(let i=0;i<30;i++)bxmHasard("cccccccccc"+String.fromCharCode(97+Math.floor(i/5))+String.fromCharCode(97+i%5));');
  T("on ne garde que les 20 dernieres parties tirees au hasard", w.eval("bxEtat().c.hasard.length") === 20);
  vider(w);
  fin(w, { elo: { f: "r", b: { d: 28, r: 828 }, n: { d: -28, r: 872 } } });
  T("battre un membre mieux classe de 100 points : David contre Goliath", faits(w).includes("mp_david"), dit(faits(w)));
  vider(w);
  fin(w, { elo: { f: "r", b: { d: 27, r: 827 }, n: { d: -27, r: 872 } } });
  T("99 points d'ecart : pas encore", !faits(w).includes("mp_david"));
  fin(w, { fin: { r: "0-1", m: "mat" }, elo: { f: "r", b: { d: -12, r: 788 }, n: { d: 12, r: 1012 } } });
  T("perdre contre un mieux classe ne donne pas David", !faits(w).includes("mp_david"));
  vider(w);
  fin(w, { elo: { f: "c", b: { d: 20, r: 1005 }, n: { d: -20, r: 965 } }, cpt: { v: 10, n: 0, d: 0, f: [0, 0, 10, 0] } });
  f = faits(w);
  T("l'etat final avec Elo et compteurs : paliers d'Elo et de parties au bon moment", f.includes("em_900") && f.includes("em_1000") && !f.includes("em_1200") && f.includes("mp_10") && !f.includes("em_etabli"), dit(f));
  vider(w);
  w.eval('cpaCharger=()=>Promise.resolve({amis:[{p:"Zoe"},{p:"Anna"}]});');
  fin(w, {});
  await attendre(50);
  T("contre un membre de ma liste d'amis : partie amicale", faits(w).includes("mb_ami_partie"));
  vider(w);
  fin(w, { nr: "Inconnu" });
  await attendre(50);
  T("contre un membre hors de ma liste : pas de partie amicale", !faits(w).includes("mb_ami_partie"));
  await attendre(2600);
  w.eval("bravoFermer()");

  console.log("--- Jamais pendant la partie, la fenetre a la fin ---");
  vider(w);
  w.eval('cpaCharger=()=>Promise.resolve({amis:[]});mode="friend";directId="aaaaaaaaaaaa";directE=null;');
  T("partie qu'on vient d'ouvrir, etat pas encore arrive : deja occupee", w.eval("bravoOccupe()") === true);
  w.__e = etat({ phase: "jeu", fin: null });
  w.eval("directRecu(window.__e)");
  T("partie en cours : occupee", w.eval("bravoOccupe()") === true && w.eval("directOccupe()") === true);
  w.eval('premoves=[{from:0,to:0}];bxMarquer("pre_coup");bxmCorr([{s:"jeu"},{s:"jeu"},{s:"jeu",atoi:true}]);bxVerifier();');
  T("coup prepare et trois parties par correspondance : notes", faits(w).includes("pre_coup") && faits(w).includes("cad_simul"));
  await attendre(2300);
  T("aucune fenetre pendant la partie", $("bravo").hidden === true);
  T("aucun badge de fin de partie tant qu'elle dure", !faits(w).includes("mp_1"));
  w.__e = etat({});
  w.eval("premoves=[];directRecu(window.__e)");
  T("l'etat final passe par directRecu : la partie est notee", faits(w).includes("mp_1") && faits(w).includes("mp_victoire"));
  T("la fenetre n'est pas encore la : elle attend l'Elo", $("bravo").hidden === true);
  w.__e = etat({ elo: { f: "r", b: { d: 20, r: 905 }, n: { d: -20, r: 880 } }, cpt: { v: 1, n: 0, d: 0, f: [0, 1, 0, 0] } });
  w.eval("directRecu(window.__e)");
  await attendre(2600);
  T("partie finie : la fenetre Bravo s'ouvre", $("bravo").hidden === false);
  let pages = w.eval("bxPages.map(b=>b.id)");
  T("une seule fenetre reunit les badges de la partie, le palier d'Elo et ce qui etait note", ["mp_1", "mp_victoire", "em_900", "pre_coup", "cad_simul"].every(id => pages.includes(id)), dit(pages));
  T("la medaille la plus precieuse ouvre la fenetre (argent avant bronze)", pages.indexOf("cad_simul") < pages.indexOf("mp_1"), dit(pages));
  T("le nom du badge est ecrit, pas son identifiant", !!$("bravoNoms").textContent.trim() && !/^[a-z]+_[a-z0-9_]+$/.test($("bravoNoms").textContent.trim()), $("bravoNoms").textContent);
  T("son anecdote aussi", $("bravoTexte").textContent.length > 30, $("bravoTexte").textContent);
  w.eval("bravoFermer()");
  w.__e = etat({ elo: { f: "r", b: { d: 20, r: 905 }, n: { d: -20, r: 880 } }, cpt: { v: 1, n: 0, d: 0, f: [0, 1, 0, 0] } });
  w.eval("directRecu(window.__e)");
  await attendre(2000);
  T("revoir la meme partie finie n'annonce rien une seconde fois", $("bravo").hidden === true && w.eval("(bravoFile||[]).length") === 0);
  w.__e = etat({ n: 2, fin: { r: "0-1", m: "temps" }, cpt: { v: 1, n: 0, d: 1, f: [0, 2, 0, 0] }, elo: { f: "r", b: { d: -20, r: 885 }, n: { d: 20, r: 900 } } });
  w.eval("directRecu(window.__e)");
  await attendre(2600);
  pages = w.eval("bxPages.map(b=>b.id)");
  T("revanche perdue au temps : la revanche, puis les deux lecons en dernier", $("bravo").hidden === false && pages[0] === "mp_revanche" && pages.slice(-2).sort().join() === "lec_membre,lec_membre_temps", dit(pages));
  w.eval('bravoFermer();directE=null;directId="";mode="jouer";');

  console.log("--- Elo contre l'ordinateur ---");
  vider(w);
  w.eval("prog.eloOrdi={r:890,n:5,pic:890,h:[[1,870],[2,890]]};");
  T("avant le palier : rien", w.eval('bxAcquis("eo_900")') === false && w.eval('bxAcquis("eo_etabli")') === false);
  w.__p = ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "d2d3", "d7d6"];
  w.eval("(function(){const c=window.__p;mode=\"play\";isReviewGame=false;gameSaved=false;resultDismissed=false;gameUci=c.slice();gameStartFen=null;myColor=W;eloPartieFixe=1100;resigned=B;" +
    "const g=new Game();for(const u of c){const m=g.moves().find(x=>g.uci(x)===u);if(m)g.makeMove(m);}game=g;resultInfo={kind:\"win\",title:\"x\",sub:\"y\"};renderResult(true);})()");
  T("une victoire fait passer 900", w.eval("prog.eloOrdi.r") >= 900, w.eval("prog.eloOrdi.r"));
  T("le palier est gagne a la fin de cette partie", gagnes(w).includes("eo_900") && !gagnes(w).includes("eo_1000"), dit(gagnes(w)));
  T("et annonce par la fenetre Bravo, pas par le rattrapage", w.eval("(bravoFile||[]).some(b=>b.id===\"eo_900\")") && w.eval("bxAdoptes") === 0);
  await attendre(1500);
  w.eval("bravoFermer()");
  w.eval("prog.eloOrdi={r:1180,n:20,pic:1210,h:[]};");
  T("le record compte, pas seulement l'Elo du moment", w.eval('bxAcquis("eo_1200")') === true && w.eval('bxAcquis("eo_1500")') === false && w.eval('bxAcquis("eo_etabli")') === true);
  w.eval("prog.eloOrdi={r:1600,n:0,pic:1600,h:[]};");
  T("un Elo sans partie comptee ne donne rien", w.eval('bxAcquis("eo_900")') === false);

  console.log("--- Rattrapage : sans fenetre, une annonce discrete ---");
  w = await ouvrir("en", { attente: 2700, fetch: true });
  d = w.document; $ = id => d.getElementById(id);
  vider(w);
  w.__j = { p: "Moi", dir: { v: 12, n: 1, d: 3 }, ef: { b: { r: 950, n: 2 }, r: { r: 1010, n: 21 }, c: null, k: { r: 800, n: 1 } }, rangs: {} };
  w.eval('cp={pseudo:"Moi"};window.__lu=0;cppLire=p=>{window.__lu++;return Promise.resolve(window.__j);};cpaCharger=()=>{const l={amis:[{p:"a"},{p:"b"},{p:"c"},{p:"d"},{p:"e"}]};bxmAmis(l);return Promise.resolve(l);};');
  w.eval("prog.eloOrdi={r:1010,n:25,pic:1040,h:[]};bxAdopterLocal();bxmRattraper();");
  await attendre(200);
  let g = gagnes(w);
  const attendus = ["mp_1", "mp_victoire", "mp_10", "lec_membre", "cad_blitz", "cad_corr", "em_etabli", "em_900", "em_1000", "mb_amis5", "eo_etabli", "eo_900", "eo_1000"];
  T("les badges deja merites entrent dans la collection", attendus.every(id => g.includes(id)), dit(attendus.filter(id => !g.includes(id))));
  T("et seulement ceux-la", ["mp_50", "cad_toutes", "em_1200", "eo_1200", "mp_david", "mp_revanche", "mp_hasard", "cad_simul", "mb_ami_partie"].every(id => !g.includes(id)), dit(g));
  T("chacun a sa date", attendus.every(id => w.eval("typeof prog.badgeDates[" + dit(id) + "]") === "number"));
  T("aucune fenetre Bravo", $("bravo").hidden === true && w.eval("(bravoFile||[]).length") === 0);
  await attendre(1500);
  T("toujours aucune fenetre, et pas encore d'annonce (les sources sont reunies)", $("bravo").hidden === true && !d.getElementById("objAnnonce"));
  w.eval("bxmRattraper();bxAdopterLocal();");
  T("le rattrapage ne relit pas la fiche deux fois dans la meme visite", w.eval("window.__lu") === 1);
  await attendre(3200);
  const an = d.getElementById("objAnnonce");
  T("une seule annonce discrete, qui dit combien", !!an && an.classList.contains("visible") && an.classList.contains("obj-badges") && /^13 badges added/.test(an.textContent), an && an.textContent);
  T("elle dit pourquoi", !!an && /already played/.test(an.textContent), an && an.textContent);
  T("pas de fenetre derriere l'annonce", $("bravo").hidden === true);
  an.click();
  T("un toucher ouvre la collection", $("menuTiroir") && $("menuTiroir").hidden === false && $("menuBadges").hidden === false);
  T("ou les badges rattrapes sont allumes", !!d.querySelector('#menuBadgeGrid [data-bx="mp_10"].unlocked') && !!d.querySelector('#menuBadgeGrid [data-bx="mp_50"]:not(.unlocked)'));
  w.eval("menuFermer();bxVerifier();");
  await attendre(1300);
  /* La carte de membre (mb_compte), elle, est gagnee a cette verification : c'est un vrai badge du moment. */
  T("une verification ordinaire, ensuite, ne les annonce pas", w.eval("(bravoFile||[]).every(b=>!" + dit(attendus) + ".includes(b.id))"), dit(w.eval("(bravoFile||[]).map(b=>b.id)")));
  w.eval("bravoFermer()");
  w.__j = { p: "Autre", dir: { v: 60, n: 0, d: 0 }, ef: null };
  w.eval('bxmRattrape="";bxmRattraper();');
  await attendre(100);
  T("la fiche d'un autre pseudo n'est jamais prise pour la mienne", !gagnes(w).includes("mp_50"));
  w.eval("prog.badges=prog.badges.filter(x=>x!==\"mp_10\");bxEtat().f.mp_10=1;bxmMinuteur=1;bxAdopter([\"mp_10\"]);");
  T("bxAdopter rend le nombre de badges ajoutes", w.eval("bxAdoptes") === 1);
  w.eval("bxmMinuteur=0;");

  console.log("--- Un seul badge rattrape : le singulier ---");
  w = await ouvrir("fr", { attente: 2700, fetch: true });
  d = w.document; $ = id => d.getElementById(id);
  vider(w);
  w.eval("prog.eloOrdi={r:905,n:3,pic:905,h:[]};bxAdopterLocal();");
  await attendre(4600);
  {
    const a = d.getElementById("objAnnonce"), txt = a ? a.textContent.replace(/\u00a0/g, " ") : "";
    T("fr : « 1 badge ajoute », au singulier", /^1 badge ajouté(?!s)/.test(txt), txt);
    T("fr : la phrase d'explication est traduite", /parties déjà jouées/.test(txt), txt);
  }

  console.log("--- Visiteur sans compte, ligues fermees ---");
  w = await ouvrir("en", { attente: 2700, fetch: true });
  d = w.document; $ = id => d.getElementById(id);
  vider(w);
  w.eval("window.__lu=0;cppLire=()=>{window.__lu++;return Promise.resolve({});};cp=null;bxmRattraper();");
  await attendre(100);
  T("sans compte : la fiche n'est pas demandee", w.eval("window.__lu") === 0 && gagnes(w).length === 0);
  T("sans compte : estMembre est faux et la collection montre un compte, pas des medailles", w.eval("estMembre()") === false &&
    (w.eval('menuOuvrir();menuVue("badges")'), !d.querySelector("#menuBadgeGrid .bx-carte") && /\d+\/\d+/.test($("menuBadgeGrid").textContent)), $("menuBadgeGrid").textContent.slice(0, 60));
  const total = () => w.eval("BADGES.filter(bxVisible).length");
  const avant = total();
  T("ligues fermees : leurs 4 badges ne sont pas montres", ["ligue_groupe", "ligue_monte", "ligue_tour", "ligue_dame"].every(id => !w.eval("bxVisible(BADGES.find(b=>b.id===" + dit(id) + "))")));
  w.eval('menuFermer();cp={pseudo:"Moi"};bxmLigue({ouvert:false,seuil:50,actifs:3},false);');
  T("l'ecran Ma ligue, ligues fermees : toujours caches, rien de note", total() === avant && faits(w).length === 0);
  w.eval("bxmLigue({ouvert:true,ligue:0,mouv:0,groupe:[]},false);");
  T("ligues ouvertes : les 4 badges apparaissent, a gagner", total() === avant + 4 && faits(w).length === 0, total() - avant);
  w.eval("bxmLigue({ouvert:true,ligue:0,mouv:0,groupe:[{p:\"Moi\",v:1}]},true);");
  T("range dans un groupe : note", dit(faits(w)) === dit(["ligue_groupe"]), dit(faits(w)));
  w.eval("bxmLigue({ouvert:true,ligue:3,mouv:1,groupe:[]},false);");
  T("monter, puis la ligue Tour ; pas encore la ligue Dame", faits(w).includes("ligue_monte") && faits(w).includes("ligue_tour") && !faits(w).includes("ligue_dame"));
  w.eval("bxmLigue({ouvert:true,ligue:4,mouv:0,groupe:[]},false);");
  T("la ligue Dame", faits(w).includes("ligue_dame"));
  T("ces badges sont notes, pas annonces au milieu du menu", gagnes(w).length === 0 && $("bravo").hidden === true);
  w.eval("cp=null;");

  console.log("--- Amis, defis, synchronisation ---");
  vider(w);
  w.eval('cp={pseudo:"Moi"};');
  T("4 amis : pas encore", w.eval("bxmAmis({amis:[1,2,3,4]})") === false && !faits(w).includes("mb_amis5"));
  T("5 amis : note", w.eval("bxmAmis({amis:[1,2,3,4,5]})") === true && faits(w).includes("mb_amis5"));
  T("trois parties par correspondance en cours : note ; deux, non", (vider(w), w.eval('bxmCorr([{s:"jeu"},{s:"jeu"},{s:"fin"},{s:"invite"}])'), !faits(w).includes("cad_simul")) &&
    (w.eval('bxmCorr([{s:"jeu"},{s:"jeu"},{s:"jeu"}])'), faits(w).includes("cad_simul")));
  vider(w);
  w.__x = { id: 7, p: "Anna", r1: "22222", t1: 40, r2: "22220", t2: 50 };
  w.eval("cpdResultat(window.__x,false)");
  T("defi envoye, mieux reussi que l'autre : defi remporte", faits(w).includes("mb_defi_gagne"));
  vider(w);
  w.eval("cpdResultat(window.__x,true)");
  T("le meme defi vu de l'autre cote : perdu, pas de badge", !faits(w).includes("mb_defi_gagne"));
  {
    const a = { bx: { f: { mp_1: 1 }, j: {}, c: { hasard: ["aaaaaaaaaaaa", "bbbbbbbbbbbb"] } } }, b = { bx: { f: { cad_corr: 1 }, j: {}, c: { hasard: ["bbbbbbbbbbbb", "cccccccccccc"], ligues: 1 } } };
    w.__a = a; w.__b = b;
    const o = w.eval("JSON.parse(JSON.stringify(cpFusionProg(window.__a,window.__b,null,false)))");
    T("synchronisation : les faits des deux appareils sont reunis", o.bx.f.mp_1 === 1 && o.bx.f.cad_corr === 1);
    T("les parties tirees au hasard aussi, sans doublon", o.bx.c.hasard.length === 3 && o.bx.c.hasard.includes("aaaaaaaaaaaa") && o.bx.c.hasard.includes("cccccccccccc"), dit(o.bx.c.hasard));
    T("les ligues ouvertes restent ouvertes, quel que soit le cote le plus recent", o.bx.c.ligues === 1 && w.eval("cpFusionProg(window.__b,window.__a,null,false).bx.c.ligues") === 1);
  }

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
