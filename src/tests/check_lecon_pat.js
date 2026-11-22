/* Verification automatique de chang64.
   Lancement : node tests/check_lecon_pat.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Lecon « Le pat et les nulles » (chapitre 2, lecon 5), defaut vu par
   Alexandre le 2026-11-22 :
   - la promotion en cavalier donne echec, pas pat, et etait refusee alors que
     la consigne demandait seulement « la piece qui laisse un coup au roi
     noir » : la consigne dit maintenant qu'il faut aussi pouvoir encore
     mater, et le refus du cavalier (comme du fou) dit pourquoi ;
   - les deux premiers exercices demandaient un mat : ils demandent un coup,
     n'importe lequel, qui ne fait pas pat.
   Le test joue la lecon dans l'application, coup par coup. */
const { ouvrir } = require("./outils/page_langue.js");
const { Game } = require("../engine.js");
const REGLES = require("../chemin/regles.json");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));
const net = s => String(s).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
const avec = o => ({ fetch: true, avant(w) { for (const k in o) w.localStorage.setItem(k, typeof o[k] === "string" ? o[k] : JSON.stringify(o[k])); } });

(async () => {
  const L = REGLES.etapes[4];
  console.log("--- Le contenu ---");
  T("la lecon est bien « Le pat et les nulles », trois exercices", L.titre.fr === "Le pat et les nulles" && L.exos.length === 3);
  for (const i of [0, 1]) {
    const ex = L.exos[i], g = new Game(ex.fen), pats = [], mats = [];
    for (const m of g.moves()) { g.makeMove(m); if (g.isCheckmate()) mats.push(g.uci(m)); else if (!g.moves().length) pats.push(g.uci(m)); g.undoMove(); }
    T("exercice " + (i + 1) + " : on ne demande plus un mat", ex.mat === undefined && ex.sansPat === true && !/mat\b/i.test(ex.consigne.fr.replace(/pat/g, "")) && /ne fait pas pat/.test(ex.consigne.fr), ex.consigne.fr);
    T("exercice " + (i + 1) + " : tout coup qui ne fait pas pat est accepte, mat compris", g.moves().length - pats.length === ex.sol.length && mats.every(u => ex.sol.includes(u)) && pats.every(u => !ex.sol.includes(u)), ex.sol.length + " / " + pats.length);
    T("exercice " + (i + 1) + " : plusieurs coups font pat (le piege existe)", pats.length >= 4, String(pats.length));
  }
  T("exercice 1 : le texte d'apres annonce le bon nombre de coups pieges", /^Pas de pat/.test(L.exos[0].apres.fr) && /Six coups de dame/.test(L.exos[0].apres.fr) && L.exos[0].pat.length === 6);
  T("exercice 2 : les autres nulles sont toujours dites", /nulle par accord/.test(L.exos[1].apres.fr) && /trois fois/.test(L.exos[1].apres.fr));
  const P = L.exos[2];
  T("promotion : la consigne ne dit plus seulement « laisse un coup au roi noir »", !/laisse un coup au roi noir/.test(P.consigne.fr) && /évite le pat/.test(P.consigne.fr) && /faire mat/.test(P.consigne.fr), P.consigne.fr);
  {
    const g = new Game(P.fen), m = g.moves().find(x => g.uci(x) === "c7c8n");
    g.makeMove(m);
    T("promotion : le cavalier donne bien echec, et ce n'est ni mat ni pat", g.inCheck() && !g.isCheckmate() && g.moves().length > 0);
  }
  T("promotion : le refus du cavalier dit qu'il evite le pat et donne echec, puis pourquoi il ne suffit pas", /évite le pat/.test(P.faux.c7c8n.fr) && /donne même échec/.test(P.faux.c7c8n.fr) && /ne peut plus faire mat/.test(P.faux.c7c8n.fr) && /nulle/.test(P.faux.c7c8n.fr), P.faux.c7c8n.fr);
  T("promotion : le refus du fou ne parle pas de cavalier, et inversement", !/cavalier/.test(P.faux.c7c8b.fr) && /fou/.test(P.faux.c7c8b.fr) && !/\bfou\b/.test(P.faux.c7c8n.fr));
  T("promotion : seule la dame est dite « Pat ! »", /^Pat/.test(P.faux.c7c8q.fr) && !/^Pat/.test(P.faux.c7c8n.fr) && !/^Pat/.test(P.faux.c7c8b.fr));

  console.log("--- Dans l'application ---");
  const w = await ouvrir("fr", avec({ "chang64:debut": { e: 6, x: 0, f: [0, 1, 2, 3, 4, 5] } }));
  const $ = id => w.document.getElementById(id), ev = s => w.eval(s);
  $("heroDebut").click(); await pause(700);
  T("le chapitre 2 s'ouvre", ev("mode") === "debut" && ev("leconCh") === "regles");
  const charger = async x => { ev("lecon.e=4;lecon.x=" + x + ";lecon.ok=false;debutCharger()"); await pause(120); };
  const jouer = async u => { w.__u = u; ev("(function(){const ex=leconEtapes()[lecon.e].exos[lecon.x];const m=legalCache.find(x=>game.uci(x)===window.__u);if(m)debutEssai(m,ex);})()"); await pause(40); };
  const statut = () => net($("debutStatus").textContent);

  await charger(0);
  T("exercice 1 : la consigne affichee demande un coup qui ne fait pas pat", /n'importe lequel/.test(statut()) && /ne fait pas pat/.test(statut()), statut());
  await jouer(L.exos[0].pat[0]);
  T("un coup qui fait pat est refuse, avec « Pat ! »", ev("lecon.ok") === false && /^Pat !/.test(statut()) && $("debutStatus").classList.contains("lose") && ev("game.history.length") === 0, statut());
  await jouer("a6b6");
  T("un simple coup de roi qui ne fait pas pat est accepte", ev("lecon.ok") === true && $("debutStatus").classList.contains("win") && /^Pas de pat/.test(statut()), statut());
  await charger(0);
  {
    const g = new Game(L.exos[0].fen), mat = g.moves().find(m => { g.makeMove(m); const k = g.isCheckmate(); g.undoMove(); return k; });
    await jouer(g.uci(mat));
    T("un mat est accepte aussi : ce n'est pas un pat", ev("lecon.ok") === true && ev("game.isCheckmate()") === true);
  }
  await charger(1);
  for (const u of L.exos[1].pat) { await jouer(u); if (ev("lecon.ok")) break; }
  T("exercice 2 : aucun des coups qui font pat ne passe", ev("lecon.ok") === false && /^Pat !/.test(statut()), statut());
  await jouer(L.exos[1].sol[L.exos[1].sol.length - 1]);
  T("exercice 2 : un coup sans pat est accepte, et les autres nulles sont dites", ev("lecon.ok") === true && /nulle par accord/.test(statut()), statut());

  await charger(2);
  T("promotion : la consigne affichee demande d'eviter le pat et de pouvoir encore mater", /évite le pat/.test(statut()) && /faire mat/.test(statut()), statut());
  await jouer("c7c8n");
  T("le cavalier est refuse, et l'explication dit qu'il donne echec sans faire pat", ev("lecon.ok") === false && /donne même échec/.test(statut()) && !/^Pat/.test(statut()), statut());
  await jouer("c7c8b");
  T("le fou est refuse avec sa propre explication", ev("lecon.ok") === false && /Le fou évite le pat/.test(statut()), statut());
  await jouer("c7c8q");
  T("la dame est refusee : pat", ev("lecon.ok") === false && /^Pat !/.test(statut()), statut());
  await jouer("c7c8r"); await pause(1800);
  T("la tour est acceptee, et la suite montre le mat", ev("lecon.ok") === true && ev("game.isCheckmate()") === true && /Pat évité/.test(statut()), statut());
  w.close();

  console.log("--- Les dix langues ---");
  const fs = require("fs"), path = require("path");
  for (const l of ["en", "fr", "es", "pt", "de", "ru", "it", "tr", "pl", "id"]) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "site", "data", "chemin-" + l + ".json"), "utf8"));
    const e = j.chapitres.find(c => c.id === "regles").etapes[4];
    T(l + " : la lecon construite porte les nouveaux exercices et les trois refus de la promotion", e.exos[0].sol.length === 22 && e.exos[0].mat === undefined && Object.keys(e.exos[0].faux).length === 6 &&
      e.exos[1].sol.length === 22 && ["c7c8q", "c7c8b", "c7c8n"].every(u => typeof e.exos[2].faux[u] === "string" && e.exos[2].faux[u].length > 30) && e.exos[2].faux.c7c8b !== e.exos[2].faux.c7c8n);
  }

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
