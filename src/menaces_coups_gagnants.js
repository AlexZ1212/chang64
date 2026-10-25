#!/usr/bin/env node
/* Menaces des "Winning move" muets (2026-10-25).

   Usage :
     node menaces_coups_gagnants.js --compter          combien d'exercices
     node menaces_coups_gagnants.js [--profondeur=16]  analyse (longue : a
                                                       lancer hors de Claude)
     node menaces_coups_gagnants.js --reprendre        reprend une analyse
     node menaces_coups_gagnants.js --appliquer        ecrit explain.menace
                                                       dans la banque

   Pourquoi. explainSentence() (ui.js) tire la phrase d'un "Winning move" de
   la solution rejouee : materiel gagne, promotion, mat, echec. Il reste des
   exercices ou la solution ne prend rien, ne fait pas echec et ne promeut
   pas : rien d'exact a en dire sans savoir ce que le coup MENACE, donc pas
   de phrase du tout. Ce script le demande a Stockfish.

   La menace d'un coup, c'est ce que le joueur jouerait si l'adversaire
   passait son tour. On retourne donc le trait apres le coup et on prend le
   meilleur coup de Stockfish dans cette position. On ne le garde que s'il
   dit quelque chose de concret et de vrai :
     - un mat (le moteur annonce un mat pour nous), ou
     - une prise ou une promotion, ET laisser faire coute vraiment a
       l'adversaire : le score de la position retournee depasse d'au moins
       --seuil centipions (defaut 150) celui de la vraie position apres le
       coup, adversaire au trait. Sinon la "menace" n'est qu'un coup normal
       que l'adversaire n'a pas besoin de parer.
   Le reste garde le silence, comme aujourd'hui.

   Journal : menaces-coups-gagnants.jsonl (une ligne par exercice), relu par
   --reprendre et --appliquer. */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Game } = require(path.join(__dirname, "engine.js"));
const banque = require(path.join(__dirname, "banque.js"));

const ARGS = process.argv.slice(2);
const opt = (n, d) => { const a = ARGS.find(x => x.startsWith("--" + n + "=")); return a ? +a.split("=")[1] : d; };
const PROF = opt("profondeur", 16), SEUIL = opt("seuil", 150);
const JOURNAL = path.join(__dirname, "menaces-coups-gagnants.jsonl");

/* Meme decision que phraseLigne() dans ui.js pour un "Winning move" :
   muet s'il n'y a ni promotion, ni mat, ni gain de materiel net, et que le
   premier coup ne fait pas echec. Garder les deux en phase. */
function muet(p) {
  if (p.theme !== "Winning move" || !p.fen || !p.sol || !p.sol.length) return false;
  const compte = fen => { const c = { w: {}, b: {} }; for (const ch of fen.split(" ")[0]) { if (!/[pnbrq]/i.test(ch)) continue; const s = ch === ch.toUpperCase() ? "w" : "b", k = ch.toLowerCase(); c[s][k] = (c[s][k] || 0) + 1; } return c; };
  const g = new Game(p.fen), nous = p.fen.split(" ")[1], eux = nous === "w" ? "b" : "w";
  const avant = compte(p.fen), san = [];
  for (const u of p.sol) { const m = g.moves().find(x => g.uci(x) === u); if (!m) return false; san.push(g.san(m)); g.makeMove(m); }
  const apres = compte(g.fen()), K = "pnbrq", gagne = {}, perdu = {};
  for (const k of K) {
    const a = (avant[eux][k] || 0) - (apres[eux][k] || 0); if (a > 0) gagne[k] = a;
    const b = (avant[nous][k] || 0) - (apres[nous][k] || 0); if (b > 0) perdu[k] = b;
  }
  let promo = 0;
  for (const k of "qrbn") { const plus = (apres[nous][k] || 0) - (avant[nous][k] || 0); if (plus > 0) promo += plus; }
  if (promo) return false;
  let promoEux = 0;
  for (const k of "qrbn") { const plus = (apres[eux][k] || 0) - (avant[eux][k] || 0); if (plus > 0) promoEux += plus; }
  if (promoEux && gagne.p) { const r = Math.min(promoEux, gagne.p); gagne.p -= r; if (!gagne.p) delete gagne.p; }
  for (const k of K) if (gagne[k] && perdu[k]) { const m = Math.min(gagne[k], perdu[k]); gagne[k] -= m; perdu[k] -= m; }
  if (g.moves().length === 0 && g.inCheck()) return false;
  const v = { p: 1, n: 3, b: 3, r: 5, q: 9 }, somme = l => Object.keys(l).reduce((s, k) => s + v[k] * (l[k] || 0), 0);
  if (somme(gagne) > somme(perdu)) return false;
  if (/\+$/.test(san[0])) return false;
  return true;
}

/* Position apres le premier coup, trait retourne : "si l'adversaire passait". */
function retournee(fen) {
  const f = fen.split(" "); f[1] = f[1] === "w" ? "b" : "w"; f[3] = "-"; return f.join(" ");
}

const lot = banque.charger().filter(muet);
if (ARGS.includes("--compter")) { console.log(lot.length + " Winning move sans phrase"); process.exit(0); }

const lireJournal = () => {
  const m = new Map();
  if (fs.existsSync(JOURNAL)) for (const l of fs.readFileSync(JOURNAL, "utf8").split("\n")) { if (!l) continue; try { const o = JSON.parse(l); m.set(o.id, o); } catch (e) {} }
  return m;
};

/* Suites (2026-10-25, --suites). Les muets sans menace concrete sont des
   coups de position : ils ne menacent rien de precis si l'adversaire passe,
   mais la meilleure defense perd quand meme. On garde la ligne principale de
   Stockfish apres le coup (adversaire au trait), et on en tire le plus court
   debut qui, joue jusqu'a un coup a nous, mate ou gagne au moins deux points
   de materiel net -- et les garde encore apres la reponse adverse suivante,
   pour ne pas annoncer une prise aussitot reprise. Six demi-coups au plus :
   au-dela, la phrase ne se lirait plus. */
const SUITES = path.join(__dirname, "menaces-suites.jsonl");
const VALEUR = { p: 1, n: 3, b: 3, r: 5, q: 9 };
function suiteDe(p, pv) {
  const g = new Game(p.fen), nous = p.fen.split(" ")[1];
  const m0 = g.moves().find(x => g.uci(x) === p.sol[0]); if (!m0) return null;
  g.makeMove(m0);
  const bilan = fen => { const s = { w: {}, b: {} }; for (const ch of fen.split(" ")[0]) { const k = ch.toLowerCase(); if (!VALEUR[k]) continue; const c = ch === k ? "b" : "w"; s[c][k] = (s[c][k] || 0) + 1; } return s; };
  const avant = bilan(p.fen), eux = nous === "w" ? "b" : "w";
  const net = fen => { const a = bilan(fen); let n = 0; for (const k in VALEUR) n += VALEUR[k] * (((a[nous][k] || 0) - (avant[nous][k] || 0)) - ((a[eux][k] || 0) - (avant[eux][k] || 0))); return n; };
  const san = [], fens = [];
  for (const u of pv.slice(0, 7)) {
    const m = g.moves().find(x => g.uci(x) === u); if (!m) break;
    san.push(g.san(m)); g.makeMove(m); fens.push(g.fen());
    if (!g.moves().length) break;
  }
  /* Indices pairs = coups adverses, impairs = coups a nous. */
  for (let k = 1; k < san.length && k <= 5; k += 2) {
    if (/#$/.test(san[k])) return { san: san.slice(0, k + 1), mat: true };
    /* Une promotion dans la ligne se lirait "gagne la dame contre un pion" :
       faux. Ces lignes gardent le silence. */
    if (san.slice(0, k + 2).some(s => /=/.test(s))) return null;
    const ici = net(fens[k]), apres = k + 1 < fens.length ? net(fens[k + 1]) : ici;
    if (ici >= 2 && apres >= 2) {
      /* Si la reponse adverse reprend du materiel, elle fait partie du
         bilan : on l'affiche, sinon "gagne la dame contre une tour" ne
         se comprendrait pas (#p771 : Txh6, puis la tour est reprise). */
      const fin = k + 1 < fens.length && apres !== ici ? k + 1 : k;
      const a = bilan(fens[fin]), gagne = {}, perdu = {};
      for (const x in VALEUR) {
        const d = ((avant[eux][x] || 0) - (a[eux][x] || 0)) - ((avant[nous][x] || 0) - (a[nous][x] || 0));
        if (d > 0) gagne[x] = d; else if (d < 0) perdu[x] = -d;
      }
      return { san: san.slice(0, fin + 1), gagne, perdu };
    }
  }
  return null;
}

if (ARGS.includes("--appliquer")) {
  const j = lireJournal(), toute = banque.charger();
  const js = new Map();
  if (fs.existsSync(SUITES)) for (const l of fs.readFileSync(SUITES, "utf8").split("\n")) { if (!l) continue; try { const o = JSON.parse(l); js.set(o.id, o); } catch (e) {} }
  let poses = 0, retires = 0, suites = 0;
  for (const p of toute) {
    const o = j.get(p.id);
    const garde = o && o.menace && o.fen === p.fen && o.coup === p.sol[0] && muet(p);
    if (garde) { p.explain = Object.assign({}, p.explain, { menace: o.menace }); poses++; }
    else if (p.explain && p.explain.menace) { delete p.explain.menace; retires++; }
    const s = js.get(p.id);
    const suite = !garde && s && s.fen === p.fen && s.coup === p.sol[0] && s.pv && muet(p) ? suiteDe(p, s.pv) : null;
    if (suite) { p.explain = Object.assign({}, p.explain, { suite }); suites++; }
    else if (p.explain && p.explain.suite) delete p.explain.suite;
  }
  console.log("sauvegarde : " + banque.sauvegarder());
  const ecrits = banque.ecrire(toute);
  console.log(poses + " menaces posees, " + retires + " retirees, " + suites + " suites posees, " + ecrits.length + " tranches reecrites");
  process.exit(0);
}
if (ARGS.includes("--essai-suites")) {
  /* Ce que --appliquer poserait, sans rien ecrire. */
  const js = new Map(fs.readFileSync(SUITES, "utf8").split("\n").filter(Boolean).map(l => { const o = JSON.parse(l); return [o.id, o]; }));
  let n = 0;
  for (const p of lot) { const s = js.get(p.id); const r = s && s.pv ? suiteDe(p, s.pv) : null; if (r) { n++; if (n <= 12) console.log(p.id, p.sol[0], JSON.stringify(r)); } }
  console.log(n + " suites sur " + js.size + " lignes analysees");
  process.exit(0);
}

/* ---------- Analyse ---------- */
let lignes = [], capture = false;
const vraiWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (c, ...r) => { if (capture) { String(c).split("\n").forEach(l => l && lignes.push(l)); return true; } return vraiWrite(c, ...r); };
const dire = s => vraiWrite(s + "\n");
const dodo = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(os.tmpdir(), "sf-menaces");
  fs.mkdirSync(dir, { recursive: true });
  const src = path.join(__dirname, "sf", "package", "bin");
  fs.copyFileSync(path.join(src, "stockfish-18-lite-single.wasm"), path.join(dir, "stockfish.wasm"));
  fs.copyFileSync(path.join(src, "stockfish-18-lite-single.js"), path.join(dir, "stockfish-18-lite-single.js"));
  capture = true;
  const sf = await require(path.join(dir, "stockfish-18-lite-single.js"))()();
  const cmd = c => sf.ccall("command", null, ["string"], [c], { async: true });
  const attendre = async (m, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const l = lignes.find(x => m.test(x)); if (l) return l; await dodo(5); } return null; };
  await cmd("uci"); await attendre(/uciok/, 30000);
  await cmd("setoption name Hash value 64");
  await cmd("setoption name MultiPV value 1");
  capture = false;

  /* Meilleur coup et score (centipions, ou mat en n) du camp au trait. */
  const analyser = async fen => {
    capture = true;
    await cmd("ucinewgame"); await cmd("isready"); await attendre(/readyok/, 30000);
    lignes = []; await cmd("position fen " + fen); await cmd("go depth " + PROF);
    const bm = await attendre(/^bestmove/, 300000);
    let score = null, mat = null, pv = null;
    for (const l of lignes.filter(x => /^info depth \d+ .*score/.test(x))) {
      const sc = /score (cp|mate) (-?\d+)/.exec(l);
      if (!sc) continue;
      if (sc[1] === "mate") { mat = +sc[2]; score = +sc[2] > 0 ? 100000 : -100000; } else { mat = null; score = +sc[2]; }
      const v = / pv (.+)$/.exec(l); if (v) pv = v[1].trim().split(/\s+/);
    }
    capture = false;
    return { coup: bm ? bm.split(" ")[1] : null, score, mat, pv };
  };

  if (ARGS.includes("--suites")) {
    /* Les muets restes sans menace : ligne principale apres le coup. */
    const j = lireJournal();
    const cibles = lot.filter(p => !(j.get(p.id) && j.get(p.id).menace));
    const dejaS = new Set();
    if (ARGS.includes("--reprendre") && fs.existsSync(SUITES)) for (const l of fs.readFileSync(SUITES, "utf8").split("\n")) if (l) try { dejaS.add(JSON.parse(l).id); } catch (e) {}
    const js = fs.createWriteStream(SUITES, { flags: ARGS.includes("--reprendre") ? "a" : "w" });
    dire("suites : " + cibles.length + " exercices, profondeur " + PROF);
    let f = 0; const t1 = Date.now();
    for (const p of cibles) {
      if (dejaS.has(p.id)) continue;
      const g = new Game(p.fen);
      g.makeMove(g.moves().find(x => g.uci(x) === p.sol[0]));
      const r = await analyser(g.fen());
      js.write(JSON.stringify({ id: p.id, fen: p.fen, coup: p.sol[0], score: r.score, mat: r.mat, pv: r.pv }) + "\n");
      if (++f % 20 === 0) dire(f + "/" + cibles.length + "  reste ~" + Math.round((cibles.length - f) * (Date.now() - t1) / f / 60000) + " min");
    }
    js.end();
    dire("termine : " + f + " lignes. Ensuite : node menaces_coups_gagnants.js --essai-suites, puis --appliquer");
    process.exit(0);
  }

  const deja = ARGS.includes("--reprendre") ? lireJournal() : new Map();
  const journal = fs.createWriteStream(JOURNAL, { flags: ARGS.includes("--reprendre") ? "a" : "w" });
  dire("moteur pret, " + lot.length + " exercices, profondeur " + PROF + (deja.size ? ", " + deja.size + " deja faits" : ""));
  const t0 = Date.now(); let faits = 0, menaces = 0;
  const LIMITE = opt("limite", Infinity);   // essai : --limite=20
  for (const p of lot) {
    if (deja.has(p.id)) continue;
    if (faits >= LIMITE) break;
    const g = new Game(p.fen);
    g.makeMove(g.moves().find(x => g.uci(x) === p.sol[0]));
    const reel = await analyser(g.fen());                 // adversaire au trait
    const h = new Game(retournee(g.fen()));
    const passe = await analyser(h.fen());                // nous au trait
    let menace = null;
    const m = passe.coup && h.moves().find(x => h.uci(x) === passe.coup);
    if (m) {
      const san = h.san(m);
      /* Un mat n'est annonce comme tel que s'il est court (trois coups au
         plus) : "menace un mat en huit" serait vrai mais ne se voit pas.
         Plus long, il retombe sur la regle des prises ci-dessous. */
      if (passe.mat != null && passe.mat > 0 && passe.mat <= 3) menace = { coup: passe.coup, san, mat: passe.mat };
      else if ((m.captured || m.promo) && reel.score != null && passe.score != null && passe.score - (-reel.score) >= SEUIL) {
        menace = { coup: passe.coup, san };
        if (m.captured) {
          /* La piece visee et sa case, pour "prendre le cavalier en f6". */
          const fen0 = h.fen().split(" ")[0].split("/");
          const cible = passe.coup.slice(2, 4), col = cible.charCodeAt(0) - 97, rang = 8 - +cible[1];
          let x = 0, piece = null;
          for (const ch of fen0[rang]) { if (/\d/.test(ch)) x += +ch; else { if (x === col) piece = ch; x++; } }
          if (piece) { menace.piece = piece; menace.sq = cible; }
          else menace.ep = true;
        }
      }
    }
    if (menace) menaces++;
    journal.write(JSON.stringify({ id: p.id, fen: p.fen, coup: p.sol[0], reel, passe, menace }) + "\n");
    faits++;
    if (faits % 20 === 0) {
      const s = (Date.now() - t0) / 1000, reste = (lot.length - deja.size - faits) * s / faits;
      dire(faits + "/" + (lot.length - deja.size) + "  menaces : " + menaces + "  reste ~" + Math.round(reste / 60) + " min");
    }
  }
  journal.end();
  dire("termine : " + faits + " analyses, " + menaces + " menaces retenues. Ensuite : node menaces_coups_gagnants.js --appliquer");
  process.exit(0);
})();
