#!/usr/bin/env node
/* Passe les exercices de GAIN au Stockfish embarque et verifie que la
   solution stockee est bien le meilleur coup, avec la marge que le projet
   s'impose.

   Usage :
     node audit_moteur.js --n=300              (echantillon, pas regulier)
     node audit_moteur.js --tous
     node audit_moteur.js --tous --sortie=resultats.jsonl
     node audit_moteur.js --tous --sortie=resultats.jsonl --reprendre

   Pourquoi ce script et pas isClearlyBest(). Le moteur maison est peu
   profond et son verdict change avec la profondeur : verifie le 2026-09-09,
   le meme exercice passe a 3, echoue a 4, repasse a 5. Un controle dont la
   reponse depend d'un reglage n'est pas un controle. Stockfish tranche.

   Les mats ne passent pas par ici : "mate-t-il en n" est deterministe et
   audit_banque.js y repond deja de facon certaine.

   Critere : la solution doit etre le bestmove de Stockfish, ET devancer le
   deuxieme choix d'au moins MARGE centipions. C'est la meme exigence que
   isClearlyBest(), arbitree par un moteur autrement plus fort.

   LIMITE CONNUE, a lire avant d'interpreter le verdict "autre coup".
   Mesurer l'ecart impose MultiPV 2, qui desactive une partie des elagages :
   a profondeur egale, le coup annonce meilleur n'est pas toujours celui que
   rend MultiPV 1. Mesure du 2026-09-09 sur quinze exercices signales ici :
   trois changent de verdict entre MultiPV 1 et 2, tandis que le meme
   reglage repete deux fois donne zero difference. La categorie "autre coup"
   sur-signale donc, et il faut la repasser avec audit_second_tour.js, qui
   interroge en MultiPV 1 et, surtout, evalue si le coup stocke GAGNE
   ENCORE -- la seule question que l'exercice pose au joueur.
   La categorie "marge faible" n'a pas besoin de ce second tour : le coup
   stocke y est deja le meilleur, donc il gagne par construction. Elle dit
   seulement qu'un autre coup gagne presque autant.
*/
const path = require("path");
const fs = require("fs");

const arg = n => { const a = process.argv.find(x => x.startsWith("--" + n + "=")); return a ? a.split("=")[1] : null; };
const TOUS = process.argv.includes("--tous");
const N = +(arg("n") || 300);
const PROF = +(arg("profondeur") || 14);
const MARGE = +(arg("marge") || 200);
const BANQUE = arg("banque") || path.join(__dirname, "puzzles.json");
const SORTIE = arg("sortie") || path.join(__dirname, "audit_moteur_resultats.jsonl");
const REPRENDRE = process.argv.includes("--reprendre");

/* Le fichier de sortie s'ecrit exercice par exercice, une ligne JSON a la
   fois, et non d'un bloc a la fin. Une passe complete dure des heures : une
   coupure de courant ou un Ctrl-C ne doit pas tout effacer. --reprendre
   relit ce qui est deja la et saute ces exercices. */
const dejaVus = new Set();
if (REPRENDRE && fs.existsSync(SORTIE)) {
  for (const l of fs.readFileSync(SORTIE, "utf8").split("\n")) {
    if (!l.trim()) continue;
    try { dejaVus.add(JSON.parse(l).code); } catch (e) { /* ligne tronquee par une coupure */ }
  }
}

const banque = JSON.parse(fs.readFileSync(BANQUE, "utf8"));
const gains = banque.filter(p => p.type !== "mate" && p.sol && p.sol.length);
const lot = [];
if (TOUS) lot.push(...gains);
else { const pas = gains.length / Math.min(N, gains.length); for (let i = 0; i < Math.min(N, gains.length); i++) lot.push(gains[Math.floor(i * pas)]); }

if (REPRENDRE && dejaVus.size) console.log("Deja examines        :", dejaVus.size, "(reprise)");
console.log("Gains dans la banque :", gains.length);
console.log("A examiner           :", lot.length, "| profondeur", PROF, "| marge", MARGE, "cp\n");

/* Le module ecrit sur la sortie standard et n'expose pas de listener utile.
   On detourne stdout pendant la duree de l'audit : brutal, mais c'est le
   seul point de sortie du moteur et on le remet en place a la fin. */
const vraiWrite = process.stdout.write.bind(process.stdout);
let lignes = [];
let capture = false;
process.stdout.write = (chunk, ...r) => {
  if (capture) { String(chunk).split("\n").forEach(l => { if (l) lignes.push(l); }); return true; }
  return vraiWrite(chunk, ...r);
};
const dire = s => vraiWrite(s + "\n");

const dodo = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const init = require(path.join(__dirname, "sf", "package", "bin", "stockfish-18-lite-single.js"));
  /* Le binaire cherche "stockfish.wasm" a cote du .js : on lui prepare un
     dossier ou c'est le cas, sans toucher au dossier vendorise. */
  const dir = path.join(require("os").tmpdir(), "sf-audit");
  fs.mkdirSync(dir, { recursive: true });
  const src = path.join(__dirname, "sf", "package", "bin");
  fs.copyFileSync(path.join(src, "stockfish-18-lite-single.wasm"), path.join(dir, "stockfish.wasm"));
  fs.copyFileSync(path.join(src, "stockfish-18-lite-single.js"), path.join(dir, "stockfish-18-lite-single.js"));

  capture = true;
  const sf = await require(path.join(dir, "stockfish-18-lite-single.js"))()();
  const cmd = c => sf.ccall("command", null, ["string"], [c], { async: true });
  const attendre = async (motif, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const l = lignes.find(x => motif.test(x)); if (l) return l; await dodo(5); }
    return null;
  };

  await cmd("uci"); await attendre(/uciok/, 20000);
  await cmd("setoption name MultiPV value 2");
  await cmd("setoption name Hash value 64");
  capture = false;
  dire("moteur pret\n");

  const res = { conforme: 0, autreCoup: [], margeFaible: [], sansReponse: [] };
  const t0 = Date.now();
  const flux = fs.createWriteStream(SORTIE, { flags: REPRENDRE ? "a" : "w" });
  let faits = 0;

  for (let i = 0; i < lot.length; i++) {
    const p = lot[i];
    if (dejaVus.has(p.code)) continue;
    faits++;
    capture = true; lignes = [];
    await cmd("position fen " + p.fen);
    await cmd("go depth " + PROF);
    const bm = await attendre(/^bestmove/, 60000);
    const infos = lignes.filter(l => /^info depth \d+ .*multipv/.test(l));
    capture = false;

    if (!bm) {
      res.sansReponse.push(p.code);
      flux.write(JSON.stringify({ code: p.code, verdict: "sans reponse" }) + "\n");
      continue;
    }
    const meilleur = bm.split(" ")[1];

    /* Dernier info de chaque multipv a la profondeur atteinte. */
    const dernier = {};
    for (const l of infos) {
      const mp = /multipv (\d+)/.exec(l), sc = /score (cp|mate) (-?\d+)/.exec(l), pv = / pv (\S+)/.exec(l);
      if (mp && sc && pv) dernier[mp[1]] = { score: sc[1] === "mate" ? (sc[2] > 0 ? 100000 : -100000) : +sc[2], coup: pv[1] };
    }
    const un = dernier["1"], deux = dernier["2"];

    const ecart = un && deux ? un.score - deux.score : null;
    let verdict;
    if (meilleur !== p.sol[0]) {
      verdict = "autre coup";
      res.autreCoup.push(p.code + " (stocke " + p.sol[0] + ", moteur " + meilleur +
        (ecart !== null ? ", ecart " + ecart + "cp" : "") + ")");
    } else if (ecart !== null && ecart < MARGE) {
      verdict = "marge faible";
      res.margeFaible.push(p.code + " (" + ecart + "cp devant " + deux.coup + ")");
    } else { verdict = "conforme"; res.conforme++; }

    flux.write(JSON.stringify({
      code: p.code, verdict: verdict, theme: p.theme, niveau: p.level,
      stocke: p.sol[0], moteur: meilleur, ecart: ecart,
      deuxieme: deux ? deux.coup : null, fen: p.fen
    }) + "\n");

    if (faits % 25 === 0) {
      const ms = (Date.now() - t0) / faits;
      const reste = (lot.length - dejaVus.size - faits) * ms / 3600000;
      dire("  " + (i + 1) + "/" + lot.length + "   " + Math.round(ms) + " ms/exercice   " +
        "conformes " + res.conforme + ", autre coup " + res.autreCoup.length +
        ", marge faible " + res.margeFaible.length +
        "   reste ~" + reste.toFixed(1) + " h");
    }
  }
  /* On ATTEND la fermeture du flux avant de sortir. process.exit() tue les
     ecritures encore en tampon : le premier essai perdait les cinq derniers
     exercices sur trente, sans rien signaler. */
  await new Promise(r => flux.end(r));

  process.stdout.write = vraiWrite;
  const ms = (Date.now() - t0) / Math.max(1, faits);
  console.log("\n--- Resultat ---");
  console.log("  conformes                :", res.conforme, "/", faits,
    "(" + (100 * res.conforme / Math.max(1, faits)).toFixed(1) + " %)");
  console.log("  le moteur prefere un autre coup :", res.autreCoup.length);
  if (res.autreCoup.length) console.log("     " + res.autreCoup.slice(0, 15).join("\n     "));
  console.log("  meilleur mais marge < " + MARGE + "cp    :", res.margeFaible.length);
  if (res.margeFaible.length) console.log("     " + res.margeFaible.slice(0, 15).join("\n     "));
  if (res.sansReponse.length) console.log("  sans reponse du moteur   :", res.sansReponse.length);
  if (res.autreCoup.length) {
    console.log("\n  ATTENTION : la categorie \"autre coup\" sur-signale (MultiPV 2).");
    console.log("  Repasse-la avec :  node audit_second_tour.js " + path.basename(SORTIE));
  }
  console.log("\n  Detail complet ecrit dans :", path.basename(SORTIE));
  console.log("  " + Math.round(ms) + " ms par exercice, soit " +
    (ms * gains.length / 3600000).toFixed(1) + " h pour les " + gains.length + " gains de la banque.");
  process.exit(0);
})().catch(e => { process.stdout.write = vraiWrite; console.error("echec :", e); process.exit(1); });
