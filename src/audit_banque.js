#!/usr/bin/env node
/* Audit exhaustif de puzzles.json, sur les seuls points ou une reponse
   CERTAINE est possible : legalite, exactitude des mats, coherence interne,
   et surtout veracite litterale de l'enonce affiche au joueur.

   Ce que ce script NE fait PAS : juger si le coup solution est le meilleur.
   Cela demande un moteur, donc une profondeur, donc un verdict qui change
   avec elle. Ce n'est pas une verification, c'est une opinion outillee. Elle
   est traitee ailleurs.

   Ce qu'il fait, et ou il est total :
     A. la position se lit, et le camp qui ne joue pas n'est pas en echec ;
     B. chaque coup de la solution est legal, promotion comprise ;
     C. un mat en n mate en n, et PAS en moins ;
     D. l'enonce dit vrai : les cases et les pieces que la phrase affichee
        nomme sont bien celles qui sont sur l'echiquier ;
     E. identifiants et codes uniques, motif declare dans BANDES.

   Le point D est le coeur de la question "les exercices vendent-ils ce
   qu'ils annoncent". explainSentence() ne lit pas la position : il recopie
   ce que explain contient. Si explain ment, la phrase ment, sans erreur.
*/
const fs = require("fs");
const path = require("path");
const { Game, sqName, pType, pColor, W, B, K } = require(path.join(__dirname, "engine.js"));
const { mateIn } = require(path.join(__dirname, "engine.js"));

const BANQUE = process.argv[2] || path.join(__dirname, "puzzles.json");
const banque = JSON.parse(fs.readFileSync(BANQUE, "utf8"));
console.log("Banque :", banque.length, "exercices\n");

const LETTRE = { 1: "p", 2: "n", 3: "b", 4: "r", 5: "q", 6: "k" };
const BANDES = {
  "Winning capture": 1, "Mate in one": 1, "Knight fork": 1, "Pawn fork": 1,
  "Pin": 1, "Skewer": 1, "Deflection": 1, "Double attack": 1,
  "Winning move": 1, "Quiet move": 1, "Mate in two": 1, "Mate in three": 1,
  "Back-rank mate": 1
};

const pb = {};
const ex = {};
function faute(cle, code, detail) {
  pb[cle] = (pb[cle] || 0) + 1;
  if (!ex[cle]) ex[cle] = [];
  if (ex[cle].length < 8) ex[cle].push(code + (detail ? " (" + detail + ")" : ""));
}

/* Cases attaquees par la piece posee en `caseF`. Geometrie explicite et non
   moves() : le generateur legal ne produit JAMAIS un coup vers la case du roi
   adverse (prendre le roi n'est pas un coup), donc s'en servir declarait non
   attaquee toute cible qui est un roi, c'est-a-dire la moitie des
   fourchettes. Il omet aussi les coups d'une piece clouee, qui attaque
   pourtant. Verifie contre le moteur avant usage. */
const SAUTS = { 2: [33, 31, 18, 14, -33, -31, -18, -14], 6: [17, 16, 15, 1, -1, -15, -16, -17] };
const GLISSE = { 3: [17, 15, -17, -15], 4: [16, -16, 1, -1], 5: [17, 16, 15, 1, -1, -15, -16, -17] };
function attaquesDepuis(jeu, caseF) {
  const pc = jeu.board[caseF];
  if (!pc) return null;
  const t = pType(pc), out = new Set();
  const surEchiquier = sq => (sq & 0x88) === 0;
  if (t === 1) {
    /* La rangee 8 est en haut : un pion blanc SOUSTRAIT. */
    const d = pColor(pc) === W ? -1 : 1;
    for (const c of [15, 17]) { const sq = caseF + d * c; if (surEchiquier(sq)) out.add(sq); }
    return out;
  }
  if (SAUTS[t]) {
    for (const d of SAUTS[t]) { const sq = caseF + d; if (surEchiquier(sq)) out.add(sq); }
    return out;
  }
  for (const d of GLISSE[t]) {
    let sq = caseF + d;
    while (surEchiquier(sq)) { out.add(sq); if (jeu.board[sq]) break; sq += d; }
  }
  return out;
}

const ids = new Set(), codes = new Set();
let vus = 0;

for (const p of banque) {
  if (++vus % 2000 === 0) process.stderr.write("\r  " + vus + "/" + banque.length);

  /* --- E. coherence des identifiants --- */
  if (!p.code) faute("code absent", p.id);
  else if (codes.has(p.code)) faute("code en double", p.code); else codes.add(p.code);
  if (ids.has(p.id)) faute("identifiant en double", p.id); else ids.add(p.id);
  if (!BANDES[p.theme]) faute("motif non declare dans BANDES", p.code, p.theme);

  /* --- A. la position se lit --- */
  let g;
  try { g = new Game(p.fen); } catch (e) { faute("position illisible", p.code); continue; }
  if (g.inCheck(g.turn ^ 1)) { faute("camp qui ne joue pas deja en echec", p.code); continue; }
  if (p.type === "gain" && g.inCheck()) faute("gain avec le trait deja en echec", p.code);

  /* --- B. legalite de toute la sequence --- */
  const avantCoup = new Game(p.fen);
  const priseInitiale = g.board[(function () {
    const u = p.sol[0] || "";
    return "abcdefgh".indexOf(u[2]) + (8 - Number(u[3])) * 16;
  })()];
  let premier = null, illegal = false, fenPremier = null;
  for (let i = 0; i < p.sol.length; i++) {
    const mv = g.moves().find(m => g.uci(m) === p.sol[i]);
    if (!mv) { faute("coup de la solution illegal", p.code, "coup " + (i + 1) + " : " + p.sol[i]); illegal = true; break; }
    if (i === 0) premier = mv;
    g.makeMove(mv);
    if (i === 0) fenPremier = g.fen();
  }
  if (illegal) continue;
  const fenApres = g.fen();

  /* --- C. le mat est-il exactement celui annonce ? --- */
  if (p.type === "mate") {
    if (!(g.moves().length === 0 && g.inCheck())) faute("mat annonce qui ne mate pas", p.code);
    if (p.n > 1) {
      const court = mateIn(new Game(p.fen), p.n - 1);
      if (court) faute("mat plus court que celui annonce", p.code, "mat en " + (p.n - 1));
    }
    if (p.sol.length !== 2 * p.n - 1) faute("longueur de solution incoherente avec n", p.code, p.sol.length + " coups pour n=" + p.n);
  } else {
    if (p.sol.length % 2 === 0) faute("gain se terminant sur un coup adverse", p.code);
  }

  /* --- D. l'enonce dit-il vrai ? --- */
  const e = p.explain || {};
  /* classifyBase() calcule le detail sur la position d'apres le PREMIER coup.
     La comparer a la position finale d'un mat en trois est une faute de
     lecture, pas un defaut de la banque : le roi annonce a bouge depuis. */
  const apres = new Game(fenPremier);
  const caseDe = nom => "abcdefgh".indexOf(nom[0]) + (8 - Number(nom[1])) * 16;
  const pieceEn = (jeu, nom) => { const pc = jeu.board[caseDe(nom)]; return pc ? LETTRE[pType(pc)] : null; };

  if (p.theme === "Winning capture") {
    if (!e.sq || !e.piece) faute("prise annoncee sans detail", p.code);
    else {
      const pris = priseInitiale ? LETTRE[pType(priseInitiale)] : null;
      if (sqName(premier.to) !== e.sq) faute("prise : la case annoncee n'est pas celle du coup", p.code, e.sq + " vs " + sqName(premier.to));
      else if (pris !== e.piece) faute("prise : la piece annoncee n'est pas celle qui est prise", p.code, e.piece + " vs " + (pris || "rien"));
    }
  } else if (p.theme === "Knight fork" || p.theme === "Pawn fork" || p.theme === "Double attack") {
    if (!e.targets || e.targets.length < 2) faute("fourchette annoncee sans deux cibles", p.code);
    else {
      if (e.from !== sqName(premier.to)) faute("fourchette : la case annoncee n'est pas celle du coup", p.code, e.from + " vs " + sqName(premier.to));
      const att = attaquesDepuis(apres, premier.to);
      for (const t of e.targets) {
        const reelle = pieceEn(apres, t.sq);
        if (reelle !== t.piece) faute("fourchette : piece annoncee absente de la case", p.code, t.sq + " annonce " + t.piece + ", trouve " + (reelle || "vide"));
        else if (att && !att.has(caseDe(t.sq))) faute("fourchette : cible annoncee non attaquee", p.code, t.sq);
      }
    }
  } else if (p.theme === "Pin" || p.theme === "Skewer") {
    if (e.pinned && e.behind) {
      const a = pieceEn(apres, e.pinned.sq), b = pieceEn(apres, e.behind.sq);
      if (a !== e.pinned.piece) faute("clouage : piece clouee annoncee absente", p.code, e.pinned.sq + " annonce " + e.pinned.piece + ", trouve " + (a || "vide"));
      if (b !== e.behind.piece) faute("clouage : piece arriere annoncee absente", p.code, e.behind.sq + " annonce " + e.behind.piece + ", trouve " + (b || "vide"));
      if (e.from && e.from !== sqName(premier.to)) faute("clouage : la case annoncee n'est pas celle du coup", p.code);
    }
  }
}
process.stderr.write("\r");

const cles = Object.keys(pb).sort((a, b) => pb[b] - pb[a]);
if (!cles.length) console.log("Aucun probleme sur les points verifiables de facon certaine.");
else {
  console.log("--- Problemes ---");
  for (const c of cles) console.log("  " + String(pb[c]).padStart(6) + "  " + c + "\n            " + ex[c].join(" "));
}
const total = cles.reduce((s, c) => s + pb[c], 0);
console.log("\nTotal des signalements :", total, "sur", banque.length, "exercices");
