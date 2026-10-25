/* Verification automatique de chang64.
   Lancement : node tests/check_explication_coups.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Handoff 10, question ouverte : explainSentence() n'avait aucune phrase
   pour "Winning move" ni "Quiet move" (17 790 exercices au 24/10). Ces
   motifs n'ont aucun detail dans p.explain : la phrase est tiree de la
   solution rejouee (materiel gagne, promotion, mat, echec).
   Verifie : les tournures (qualite, pluriels, genre, bilan negatif) ; puis
   sur toute la banque, en francais et en anglais, qu'aucune phrase n'est
   cassee, qu'aucune n'annonce un gain quand la ligne perd du materiel,
   qu'une ligne qui mate le dit, et combien restent sans phrase. */
const path = require("path");
const fs = require("fs"), jd = require("jsdom");
const SITE = path.join(__dirname, "..", "site");
const html = fs.readFileSync(SITE + "/index.html", "utf8");
const { Game } = require(path.join(__dirname, "..", "engine.js"));
const banque = require(path.join(__dirname, "..", "banque.js")).charger();
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const nbsp = s => String(s).replace(/ /g, " ");

function ouvrir(langue) {
  const dom = new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/",
    virtualConsole: new jd.VirtualConsole(),
    beforeParse(w) {
      Object.defineProperty(w.navigator, "language", { value: langue, configurable: true });
      w.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error("hors test")) });
    } });
  return dom.window;
}

/* Bilan de reference, calcule ici sans ui.js : valeur materielle de chaque
   camp avant et apres la solution. */
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9 };
function reference(p) {
  const g = new Game(p.fen), nous = p.fen.split(" ")[1];
  const mat = fen => { const s = { w: 0, b: 0 }; for (const ch of fen.split(" ")[0]) { const k = ch.toLowerCase(); if (VAL[k]) s[ch === k ? "b" : "w"] += VAL[k]; } return s; };
  const a = mat(p.fen);
  for (const u of p.sol) g.makeMove(g.moves().find(x => g.uci(x) === u));
  const b = mat(g.fen()), eux = nous === "w" ? "b" : "w";
  return { net: (b[nous] - a[nous]) - (b[eux] - a[eux]), mat: g.moves().length === 0 && g.inCheck() };
}

(async () => {
  for (const [langue, att] of [
    ["fr-FR", { qualite: "la qualité", cp: "un cavalier contre un pion", deux: "deux pions", tour: "une tour", fou: "un fou",
      dame: "la dame contre une tour", trois: "du matériel", gagne: /gagne|prépare le mat/, mat: /mat/, menace: /menace/, suite: /La meilleure défense est .* ; la suite .* (gagne|mate)/ }],
    ["en-US", { qualite: "the exchange", cp: "a knight for a pawn", deux: "two pawns", tour: "a rook", fou: "a bishop",
      dame: "the queen for a rook", trois: "material", gagne: /wins|prepares checkmate/, mat: /checkmate|mate in|mates/, menace: /threatens/, suite: /The best defence is .*; the continuation .* (wins|mates)/ }]]) {
    const w = ouvrir(langue); await attendre(1500);
    console.log("\n--- " + langue + " : tournures ---");
    T("fonctions presentes", typeof w.phraseGain === "function" && typeof w.explainSentence === "function");
    const pg = (gagne, perdu) => nbsp(w.phraseGain({ gagne, perdu }));
    T("tour contre piece mineure : " + att.qualite, pg({ r: 1 }, { b: 1 }) === att.qualite, pg({ r: 1 }, { b: 1 }));
    T("cavalier contre pion", pg({ n: 1 }, { p: 1 }) === att.cp, pg({ n: 1 }, { p: 1 }));
    T("pluriel : " + att.deux, pg({ p: 2 }, {}) === att.deux, pg({ p: 2 }, {}));
    T("genre : " + att.tour, pg({ r: 1 }, {}) === att.tour, pg({ r: 1 }, {}));
    T("genre : " + att.fou, pg({ b: 1 }, {}) === att.fou, pg({ b: 1 }, {}));
    T("dame contre tour", pg({ q: 1 }, { r: 1 }) === att.dame, pg({ q: 1 }, { r: 1 }));
    T("trois sortes de pieces : " + att.trois, pg({ r: 1, n: 1, p: 1 }, {}) === att.trois, pg({ r: 1, n: 1, p: 1 }, {}));
    T("bilan negatif (tour contre dame) : rien", pg({ r: 1 }, { q: 1 }) === "", pg({ r: 1 }, { q: 1 }));
    T("bilan nul (fou contre cavalier) : rien", pg({ b: 1 }, { n: 1 }) === "", pg({ b: 1 }, { n: 1 }));

    console.log("\n--- " + langue + " : toute la banque ---");
    const cibles = banque.filter(p => p.theme === "Winning move" || p.theme === "Quiet move");
    let cassees = [], fausses = [], matsTus = [], vides = { "Winning move": 0, "Quiet move": 0 };
    for (const p of cibles) {
      const s = nbsp(w.explainSentence(p));
      if (!s) { vides[p.theme]++; continue; }
      if (/undefined|NaN|\{|\}/.test(s)) cassees.push(p.code + " " + s);
      const r = reference(p);
      if (/gagne|wins/.test(s) && !r.mat && r.net <= 0 && !(p.explain && p.explain.suite)) fausses.push(p.code + " net " + r.net + " : " + s);
      if (r.mat && !att.mat.test(s)) matsTus.push(p.code + " " + s);
    }
    T("aucune phrase cassee", !cassees.length, cassees.slice(0, 3).join(" | "));
    T("aucun gain annonce quand la ligne perd du materiel", !fausses.length, fausses.length + " : " + fausses.slice(0, 3).join(" | "));
    T("une ligne qui mate le dit", !matsTus.length, matsTus.length + " : " + matsTus.slice(0, 3).join(" | "));
    T("chaque Quiet move a sa phrase", vides["Quiet move"] === 0, vides["Quiet move"]);
    /* Restent muets : un seul coup, sans gain de materiel, sans echec, sans
       promotion. Rien d'exact a en dire sans relancer le moteur. Le gain se
       juge au bilan et non a la case d'arrivee : une prise en passant arrive
       sur une case vide (19 exercices au 24/10). */
    /* Depuis le 2026-10-25, ceux dont Stockfish a releve une menace concrete
       (explain.menace, menaces_coups_gagnants.js) ont leur phrase : seuls
       restent muets les coups de position sans menace. */
    const muetsAttendus = banque.filter(p => {
      if (p.theme !== "Winning move" || p.sol.length !== 1 || reference(p).net > 0) return false;
      if (p.explain && (p.explain.menace || p.explain.suite)) return false;
      const g = new Game(p.fen), m = g.moves().find(x => g.uci(x) === p.sol[0]);
      if (m.promo) return false;
      g.makeMove(m); return !g.inCheck();
    }).length;
    T("Winning move sans phrase : seulement les coups sans prise, echec, promotion ni menace (" + muetsAttendus + ")",
      vides["Winning move"] === muetsAttendus, vides["Winning move"]);
    const avecMenace = banque.filter(p => p.explain && p.explain.menace);
    const malDites = avecMenace.filter(p => {
      const s = nbsp(w.explainSentence(p)), me = p.explain.menace;
      return !s.includes(me.san) || !att.menace.test(s) || (me.mat && !att.mat.test(s));
    });
    T("chaque menace relevee est dite (" + avecMenace.length + ")", avecMenace.length > 0 && !malDites.length,
      malDites.slice(0, 3).map(p => p.code + " " + nbsp(w.explainSentence(p))).join(" | "));
    const ex = avecMenace.find(p => p.explain.menace.piece);
    if (ex) console.log("  exemple : " + nbsp(w.explainSentence(ex)));
    /* Lignes de Stockfish (explain.suite, 2026-10-25) : la reponse et toute
       la suite affichees, et un bilan reellement positif au bout. */
    const avecSuite = banque.filter(p => p.explain && p.explain.suite);
    const VALS = { p: 1, n: 3, b: 3, r: 5, q: 9 }, somme = l => Object.keys(l || {}).reduce((s, k) => s + VALS[k] * l[k], 0);
    const malSuites = avecSuite.filter(p => {
      const s = nbsp(w.explainSentence(p)), su = p.explain.suite;
      if (!su.san.every(x => s.includes(x)) || !att.suite.test(s)) return true;
      return !su.mat && somme(su.gagne) - somme(su.perdu) < 2;
    });
    T("chaque ligne relevee est dite, avec un vrai gain (" + avecSuite.length + ")", avecSuite.length > 0 && !malSuites.length,
      malSuites.slice(0, 3).map(p => p.code + " " + nbsp(w.explainSentence(p))).join(" | "));
    const ex2 = avecSuite.find(p => !p.explain.suite.mat && p.explain.suite.san.length > 2);
    if (ex2) console.log("  exemple : " + nbsp(w.explainSentence(ex2)));
    w.close();
  }
  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + e.stack); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
