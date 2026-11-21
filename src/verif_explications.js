#!/usr/bin/env node
/* Verification des lignes d'explication des exercices (2026-11-21).

   Usage :
     node verif_explications.js --compter               combien d'exercices a analyser
     node verif_explications.js --analyser --part=1/4   analyse Stockfish (longue,
                                                        hors de Claude, une part par processus)
     node verif_explications.js --bilan                 ce qui est faux, par categorie
     node verif_explications.js --appliquer             corrige la banque

   Pourquoi. Alexandre, exercice #G59I2 : « Le roi en g3 ne peut pas bouger
   sans exposer le pion en g4. » La solution (Tg1+) est juste, mais le gain
   est la promotion en b1, pas le pion g4, defendu par h3 : le prendre
   perdrait la tour. classifyBase() (gen_puzzles_v2.js) etiquette les motifs
   par la seule geometrie (une piece alignee derriere une autre = enfilade),
   sans verifier que la suite gagne bien la piece annoncee. Un audit sur un
   echantillon a trouve le meme defaut dans chaque famille de phrases :
   enfilade ou clouage dont le gain est ailleurs, « rien ne defend X » alors
   que X est defendu, prise d'une piece clouee reprise par une autre,
   fourchette qui ne gagne aucune des deux cibles, « gagne la dame » alors
   que la suite en rend une partie.

   Ce que fait le script. Pour chaque exercice dont la phrase affirme un
   fait, il demande a Stockfish la ligne principale apres le premier coup
   de la solution, puis verifie l'affirmation :
     - enfilade / clouage (piece derriere) : la ligne prend la piece avant
       ou la piece derriere, et le bilan reste positif ;
     - clouage (prise) : aucune piece adverse ne peut reprendre ;
     - fourchette / double attaque : la ligne prend une des cibles, ou mate ;
     - prise gagnante (« rien ne defend ») : aucune reprise possible ;
     - coup gagnant / coup calme : le gain annonce par la solution tient
       apres la reponse adverse.
   Une affirmation fausse est remplacee par la suite de Stockfish (meme
   forme que menaces_coups_gagnants.js : « la meilleure defense est ...,
   la suite ... gagne ... »), ou par rien si la ligne ne dit rien de sur.
   Le motif faux (enfilade, clouage, fourchette) devient « Winning move ».
   Ni les identifiants, ni les codes, ni les solutions ne changent. */
const fs = require("fs"), path = require("path"), os = require("os");
const { Game } = require(path.join(__dirname, "engine.js"));
const banque = require(path.join(__dirname, "banque.js"));

const ARGS = process.argv.slice(2);
const opt = (n, d) => { const a = ARGS.find(x => x.startsWith("--" + n + "=")); return a ? a.split("=")[1] : d; };
const PROF = +opt("profondeur", 12);
const VALEUR = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const sqI = n => (8 - +n[1]) * 16 + (n.charCodeAt(0) - 97);
const journalDe = i => path.join(__dirname, "verif-explications-" + i + ".jsonl");

/* Famille de phrase d'un exercice (meme decoupage que explainSentence). */
function famille(p) {
  const ex = p.explain || {};
  if ((p.theme === "Skewer" || p.theme === "Pin") && ex.behind && !ex.captured) return "geometrie";
  if (p.theme === "Pin" && ex.captured) return "clouage-prise";
  if ((p.theme === "Knight fork" || p.theme === "Pawn fork" || p.theme === "Double attack") && ex.targets) return "fourchette";
  if (p.theme === "Winning capture" && ex.piece) return "prise";
  if ((p.theme === "Winning move" || p.theme === "Quiet move") && !ex.suite && !ex.menace) return "bilan";
  return null;
}
const bilanFen = fen => { const s = { w: {}, b: {} }; for (const ch of fen.split(" ")[0]) { const k = ch.toLowerCase(); if (!VALEUR[k]) continue; const c = ch === k ? "b" : "w"; s[c][k] = (s[c][k] || 0) + 1; } return s; };
/* Materiel net gagne depuis la position de depart (promotions comprises). */
function netDe(p, fen) {
  const a = bilanFen(p.fen), b = bilanFen(fen), nous = p.fen.split(" ")[1], eux = nous === "w" ? "b" : "w";
  let n = 0; for (const k in VALEUR) n += VALEUR[k] * (((b[nous][k] || 0) - (a[nous][k] || 0)) - ((b[eux][k] || 0) - (a[eux][k] || 0)));
  return n;
}
/* Gain annonce par la solution seule (meme regle que bilanLigne dans ui.js,
   promotions mises a part : elles ont leur propre phrase). */
function gainSolution(p) {
  const g = new Game(p.fen);
  for (const u of p.sol) { const m = g.moves().find(x => g.uci(x) === u); if (!m) return null; g.makeMove(m); }
  const a = bilanFen(p.fen), b = bilanFen(g.fen()), nous = p.fen.split(" ")[1], eux = nous === "w" ? "b" : "w";
  let promo = 0; for (const k of "qrbn") promo += Math.max(0, (b[nous][k] || 0) - (a[nous][k] || 0));
  if (promo || (!g.moves().length && g.inCheck())) return 0;
  let gagne = 0, perdu = 0;
  for (const k in VALEUR) { gagne += VALEUR[k] * Math.max(0, (a[eux][k] || 0) - (b[eux][k] || 0)); perdu += VALEUR[k] * Math.max(0, (a[nous][k] || 0) - (b[nous][k] || 0)); }
  return gagne - perdu;
}
/* Reprise legale possible sur une case, apres le premier coup. */
function reprise(p, sq) {
  const g = new Game(p.fen), m = g.moves().find(x => g.uci(x) === p.sol[0]); if (!m) return true;
  g.makeMove(m); const i = sqI(sq);
  return g.moves().some(x => x.to === i);
}
/* Faut-il Stockfish pour juger cet exercice ? Les familles « prise » et
   « clouage-prise » se jugent sans lui ; il ne sert alors qu'a la phrase de
   remplacement, donc seulement si l'affirmation est fausse. « bilan » ne
   demande rien si la solution n'annonce aucun gain. */
function aAnalyser(p) {
  const f = famille(p);
  if (!f) return false;
  if (f === "prise") return reprise(p, p.explain.sq);
  if (f === "clouage-prise") return reprise(p, p.explain.captured.sq);
  if (f === "bilan") { const g = gainSolution(p); return g != null && g > 0; }
  return true;
}

/* Ligne complete : premier coup de la solution, puis la PV de Stockfish. */
function rejouer(p, pv) {
  const g = new Game(p.fen), coups = [];
  const m0 = g.moves().find(x => g.uci(x) === p.sol[0]); if (!m0) return null;
  coups.push({ san: g.san(m0), pris: m0.captured ? "_pnbrqk"[m0.captured & 7] : "", fen: (g.makeMove(m0), g.fen()) });
  for (const u of (pv || []).slice(0, 8)) {
    const m = g.moves().find(x => g.uci(x) === u); if (!m) break;
    const san = g.san(m), pris = m.captured ? "_pnbrqk"[m.captured & 7] : "";
    g.makeMove(m); coups.push({ san, pris, fen: g.fen() });
    if (!g.moves().length) break;
  }
  return coups;
}
/* Verdict sur l'affirmation de la phrase. */
function verdict(p, s) {
  const f = famille(p), ex = p.explain || {};
  if (f === "prise") return !reprise(p, ex.sq);
  if (f === "clouage-prise") return !reprise(p, ex.captured.sq);
  const L = rejouer(p, s && s.pv); if (!L) return false;
  const nous = L.filter((c, i) => i % 2 === 0), fin = L[L.length - 1];
  const matPourNous = s && s.mat != null && s.mat < 0;     /* score vu de l'adversaire, au trait */
  if (f === "geometrie") {
    const vis = [ex.behind.piece, ex.pinned.piece].filter(x => x !== "k");
    return (nous.some(c => vis.includes(c.pris)) && netDe(p, fin.fen) >= 1) || (matPourNous && vis.length === 0);
  }
  if (f === "fourchette") {
    const vis = ex.targets.map(x => x.piece).filter(x => x !== "k");
    return matPourNous || (nous.some(c => vis.includes(c.pris)) && netDe(p, fin.fen) >= 1);
  }
  if (f === "bilan") {
    const annonce = gainSolution(p), n = p.sol.length;
    if (!annonce || annonce <= 0 || matPourNous) return true;
    /* Gain apres la solution ET la reponse adverse qui suit. */
    const apres = L[Math.min(L.length - 1, n)];
    return netDe(p, apres.fen) >= annonce - 1;
  }
  return true;
}
/* Phrase de remplacement : meme forme que menaces_coups_gagnants.js. */
function suiteDe(p, s) {
  const L = rejouer(p, s && s.pv); if (!L || L.length < 3) return null;
  const san = L.slice(1).map(c => c.san), fens = L.slice(1).map(c => c.fen);
  for (let k = 1; k < san.length && k <= 5; k += 2) {
    if (/#$/.test(san[k])) return { san: san.slice(0, k + 1), mat: true };
    if (san.slice(0, k + 2).some(x => /=/.test(x))) break;
    const ici = netDe(p, fens[k]), apres = k + 1 < fens.length ? netDe(p, fens[k + 1]) : ici;
    if (ici >= 2 && apres >= 2) {
      const fin = k + 1 < fens.length && apres !== ici ? k + 1 : k;
      const a = bilanFen(p.fen), b = bilanFen(fens[fin]), nous = p.fen.split(" ")[1], eux = nous === "w" ? "b" : "w", gagne = {}, perdu = {};
      for (const x in VALEUR) {
        const d = ((a[eux][x] || 0) - (b[eux][x] || 0)) - ((a[nous][x] || 0) - (b[nous][x] || 0));
        if (d > 0) gagne[x] = d; else if (d < 0) perdu[x] = -d;
      }
      return { san: san.slice(0, fin + 1), gagne, perdu };
    }
  }
  /* Repli : mat annonce, ou avantage d'au moins deux pions. */
  if (s.mat != null && s.mat < 0) return { san: san.slice(0, 1), matEn: -s.mat };
  if (s.mat == null && s.score != null && -s.score >= 200 && san.length >= 2) return { san: san.slice(0, 2), avantage: true };
  return null;
}
const lireJournaux = () => {
  const m = new Map();
  for (const f of fs.readdirSync(__dirname).filter(x => /^verif-explications-\d+\.jsonl$/.test(x)))
    for (const l of fs.readFileSync(path.join(__dirname, f), "utf8").split("\n")) { if (!l) continue; try { const o = JSON.parse(l); m.set(o.id, o); } catch (e) {} }
  return m;
};

const toute = banque.charger();
if (ARGS.includes("--compter")) {
  const c = {}; let n = 0;
  for (const p of toute) { const f = famille(p); if (!f) continue; c[f] = c[f] || [0, 0]; c[f][0]++; if (aAnalyser(p)) { c[f][1]++; n++; } }
  for (const [f, [a, b]] of Object.entries(c)) console.log(f.padEnd(14), a, "phrases,", b, "a analyser");
  console.log(n, "positions pour Stockfish");
  process.exit(0);
}
if (ARGS.includes("--bilan") || ARGS.includes("--appliquer")) {
  const j = lireJournaux(), appliquer = ARGS.includes("--appliquer");
  const c = {}, ex = {};
  let changes = 0, motifs = 0, suites = 0, tus = 0, manquants = 0;
  const journalChangements = [];
  for (const p of toute) {
    const f = famille(p); if (!f) continue;
    c[f] = c[f] || { juges: 0, faux: 0 };
    const besoin = aAnalyser(p), s = j.get(p.id);
    if (besoin && (!s || s.fen !== p.fen || s.coup !== p.sol[0])) { if (f !== "prise" && f !== "clouage-prise") { manquants++; continue; } }
    c[f].juges++;
    if (verdict(p, s)) continue;
    c[f].faux++;
    /* --hasard : des exemples tires au sort, avec la ligne de Stockfish, pour
       relire a la main (reservoir de 6 par famille). */
    ex[f] = ex[f] || []; c[f].vus = (c[f].vus || 0) + 1;
    const lig = () => { const L = rejouer(p, s && s.pv); return "#" + p.code + " " + p.id + " " + p.theme + " " + JSON.stringify(p.explain) + "\n      " + (L ? L.map(x => x.san).join(" ") : "?"); };
    if (ARGS.includes("--hasard")) { if (ex[f].length < 6) ex[f].push(lig()); else { const k = Math.floor(Math.random() * c[f].vus); if (k < 6) ex[f][k] = lig(); } }
    else if (ex[f].length < 15) ex[f].push("#" + p.code + " " + p.id + " " + p.theme);
    if (!appliquer) continue;
    const suite = s ? suiteDe(p, s) : null;
    const ancien = p.theme;
    if (f === "geometrie" || f === "fourchette" || f === "clouage-prise") { p.theme = "Winning move"; motifs++; }
    /* « prise » garde son motif (la prise gagne bien) mais perd « rien ne
       la defend » ; « bilan » garde son motif et gagne une suite, que
       phraseLigne() prefere alors au gain de la solution seule. */
    /* Sans suite sure : { taire: 1 }, la ligne se tait (phraseLigne), plutot
       que de retomber sur le gain de la seule solution, faux ici. */
    p.explain = suite ? { suite } : { taire: 1 };
    if (suite) suites++; else tus++;
    journalChangements.push({ id: p.id, code: p.code, de: ancien, vers: p.theme, suite: !!suite });
    changes++;
  }
  for (const [f, r] of Object.entries(c)) console.log(f.padEnd(14), "juges", String(r.juges).padStart(6), " faux", String(r.faux).padStart(6), " (" + (r.juges ? (100 * r.faux / r.juges).toFixed(1) : "0") + " %)");
  if (manquants) console.log(manquants + " exercices pas encore analyses (journal incomplet)");
  for (const [f, l] of Object.entries(ex)) console.log("\n== " + f + "\n  " + l.join("\n  "));
  if (appliquer) {
    if (manquants) { console.log("\nAnalyse incomplete : rien n'est ecrit."); process.exit(1); }
    console.log("sauvegarde : " + banque.sauvegarder());
    const ecrits = banque.ecrire(toute);
    fs.writeFileSync(path.join(__dirname, "verif-explications-changements.jsonl"), journalChangements.map(x => JSON.stringify(x)).join(String.fromCharCode(10)) + String.fromCharCode(10));
    console.log(changes + " exercices corriges : " + motifs + " motifs changes, " + suites + " suites posees, " + tus + " phrases retirees ; " + ecrits.length + " tranches reecrites");
  }
  process.exit(0);
}
if (!ARGS.includes("--analyser")) { console.log("voir l'en-tete du fichier pour l'usage"); process.exit(0); }

/* ---------- Analyse ---------- */
const [part, parts] = opt("part", "1/1").split("/").map(Number);
let lignes = [], capture = false;
const vraiWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (c, ...r) => { if (capture) { String(c).split("\n").forEach(l => l && lignes.push(l)); return true; } return vraiWrite(c, ...r); };
const dire = s => vraiWrite(s + "\n");
const dodo = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const dir = path.join(os.tmpdir(), "sf-verif-" + part);
  fs.mkdirSync(dir, { recursive: true });
  const src = path.join(__dirname, "sf", "package", "bin");
  fs.copyFileSync(path.join(src, "stockfish-18-lite-single.wasm"), path.join(dir, "stockfish.wasm"));
  fs.copyFileSync(path.join(src, "stockfish-18-lite-single.js"), path.join(dir, "stockfish-18-lite-single.js"));
  capture = true;
  const sf = await require(path.join(dir, "stockfish-18-lite-single.js"))()();
  const cmd = c => sf.ccall("command", null, ["string"], [c], { async: true });
  const attendre = async (m, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const l = lignes.find(x => m.test(x)); if (l) return l; await dodo(2); } return null; };
  await cmd("uci"); await attendre(/uciok/, 30000);
  await cmd("setoption name Hash value 32");
  capture = false;
  const analyser = async fen => {
    capture = true;
    await cmd("ucinewgame"); await cmd("isready"); await attendre(/readyok/, 30000);
    lignes = []; await cmd("position fen " + fen); await cmd("go depth " + PROF);
    await attendre(/^bestmove/, 300000);
    let score = null, mat = null, pv = null;
    for (const l of lignes.filter(x => /^info depth \d+ .*score/.test(x))) {
      const sc = /score (cp|mate) (-?\d+)/.exec(l); if (!sc) continue;
      if (sc[1] === "mate") { mat = +sc[2]; score = mat > 0 ? 100000 : -100000; } else { mat = null; score = +sc[2]; }
      const v = / pv (.+)$/.exec(l); if (v) pv = v[1].trim().split(/\s+/);
    }
    capture = false;
    return { score, mat, pv };
  };
  const journal = journalDe(part), deja = new Set();
  if (fs.existsSync(journal)) for (const l of fs.readFileSync(journal, "utf8").split("\n")) if (l) try { deja.add(JSON.parse(l).id); } catch (e) {}
  const lot = toute.filter((p, i) => i % parts === part - 1 && aAnalyser(p) && !deja.has(p.id));
  const out = fs.createWriteStream(journal, { flags: "a" });
  const LIMITE = +opt("limite", Infinity);
  dire("part " + part + "/" + parts + " : " + lot.length + " a analyser (" + deja.size + " deja faits), profondeur " + PROF);
  const t0 = Date.now(); let f = 0;
  for (const p of lot) {
    if (f >= LIMITE) break;
    const g = new Game(p.fen); g.makeMove(g.moves().find(x => g.uci(x) === p.sol[0]));
    const r = g.moves().length ? await analyser(g.fen()) : { score: null, mat: null, pv: [] };
    out.write(JSON.stringify({ id: p.id, fen: p.fen, coup: p.sol[0], score: r.score, mat: r.mat, pv: r.pv }) + "\n");
    if (++f % 200 === 0) dire(f + "/" + lot.length + "  reste ~" + Math.round((lot.length - f) * (Date.now() - t0) / f / 60000) + " min");
  }
  out.end(() => { dire("termine : " + f); process.exit(0); });
})();
