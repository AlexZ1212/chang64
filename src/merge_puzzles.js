/* Fusion d'une ou plusieurs fournees minees dans puzzles.json.
   Ecrit le 2026-09-07, apres deux fusions faites a la main qui avaient
   chacune coute des allers-retours.

   Usage :
     node merge_puzzles.js fournee1.json [fournee2.json ...] [--dry]

   Ce que le script fait, dans cet ordre, et pourquoi :

   1. SAUVEGARDE puzzles.json avant toute chose, horodatee. Une fusion rate
      sur 51 000 exercices n'est pas rattrapable autrement.
   2. DEDOUBLONNE sur (fen + premier coup solution). Deux passes de minage
      sur des extraits qui se recouvrent ressortent les memes positions ;
      sans ca la banque se remplit de doublons invisibles.
   3. VERIFIE chaque exercice entrant avec verifyFull(), le meme controle que
      la generation. Miner de vraies parties ne dispense d'aucun controle
      qualite. Un exercice qui ne passe pas est rejete, pas repare.
   4. RECLASSIFIE avec classifyBase() plutot que de faire confiance a
      l'etiquette de la fournee : le classificateur evolue, la banque doit
      etre homogene. Un exercice dont le motif est introuvable est rejete.
   5. NOTE la difficulte avec distractorScore(), la meme formule que le reste
      de la banque.
   6. RANGE au niveau du motif. Depuis le redecoupage par famille, un motif
      vit dans UN niveau : on lit la correspondance dans la banque existante
      plutot que de l'ecrire ici, pour qu'elle ne puisse pas diverger.
   7. ATTRIBUE identifiants et codes. Les codes EXISTANTS ne sont jamais
      regeneres : ils sont affiches aux gens ("#TAUXL", pour signaler un
      probleme sur un exercice) et quelqu'un a pu en noter un. Seuls les
      nouveaux exercices en recoivent, tires au hasard et verifies contre
      l'ensemble complet pour ecarter toute collision.
   8. RECOMPTE et affiche l'avant/apres par motif, pour que le gain reel soit
      visible AVANT de reconstruire le site.

   Le script ne touche ni au site ni aux morceaux : c'est build_site.js qui
   redecoupe, et il le fait tout seul au prochain lancement. */

const fs = require("fs");
const path = require("path");
const { Game } = require(path.join(__dirname, "engine.js"));
const { classifyBase, verifyFull } = require(path.join(__dirname, "gen_puzzles_v2.js"));
const { distractorScore } = require(path.join(__dirname, "difficulty_v2.js"));

const BANQUE = path.join(__dirname, "puzzles.json");
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function codeAuHasard() {
  let c = "";
  for (let i = 0; i < 5; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return c;
}
function cle(p) { return p.fen + "|" + (p.sol && p.sol[0]); }

const fichiers = process.argv.slice(2).filter(a => !a.startsWith("--"));
const dry = process.argv.includes("--dry");
if (!fichiers.length) {
  console.error("Usage: node merge_puzzles.js fournee1.json [fournee2.json ...] [--dry]");
  process.exit(1);
}

const banque = JSON.parse(fs.readFileSync(BANQUE, "utf8"));
console.log("Banque actuelle    :", banque.length, "exercices");

/* 1. Sauvegarde */
if (!dry) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const copie = BANQUE.replace(/\.json$/, "." + stamp + ".bak.json");
  fs.copyFileSync(BANQUE, copie);
  console.log("Sauvegarde         :", path.basename(copie));
}

/* Correspondance motif -> niveau, LUE dans la banque et non ecrite ici :
   elle ne peut donc pas diverger de la realite. On prend le niveau le plus
   fourni au cas ou un motif serait a cheval. */
const parMotif = {};
for (const p of banque) {
  (parMotif[p.theme] = parMotif[p.theme] || {})[p.level] = (parMotif[p.theme][p.level] || 0) + 1;
}
const niveauDuMotif = {};
for (const th in parMotif) {
  niveauDuMotif[th] = +Object.keys(parMotif[th]).sort((a, b) => parMotif[th][b] - parMotif[th][a])[0];
}

const vues = new Set(banque.map(cle));
const codes = new Set(banque.map(p => p.code).filter(Boolean));
let maxId = 0;
for (const p of banque) { const n = +String(p.id).slice(1); if (n > maxId) maxId = n; }

const avant = {};
for (const p of banque) avant[p.theme] = (avant[p.theme] || 0) + 1;

const rejets = { doublon: 0, verification: 0, motif: 0, motifInconnu: 0, illisible: 0 };
const ajoutes = [];

for (const f of fichiers) {
  const lot = JSON.parse(fs.readFileSync(f, "utf8"));
  console.log("Fournee            :", path.basename(f), "-", lot.length, "candidats");
  let i = 0;
  for (const brut of lot) {
    if (++i % 200 === 0) process.stderr.write("\r  " + i + "/" + lot.length);
    if (!brut || !brut.fen || !brut.sol || !brut.sol.length) { rejets.illisible++; continue; }
    if (vues.has(cle(brut))) { rejets.doublon++; continue; }

    /* 3. Verification, identique a la generation. */
    if (!verifyFull(brut)) { rejets.verification++; continue; }

    /* 4. Reclassification. On ne fait pas confiance a l'etiquette recue. */
    let motif = null, detail = null;
    try {
      const g = new Game(brut.fen);
      const mv = g.moves().find(m => g.uci(m) === brut.sol[0]);
      if (mv) {
        const r = classifyBase(g, mv, brut.type === "mate", brut.n || 0);
        if (r) { motif = r.theme; detail = r.detail; }
      }
    } catch (e) { /* rejete juste apres */ }
    if (!motif) { rejets.motif++; continue; }
    if (!(motif in niveauDuMotif)) { rejets.motifInconnu++; continue; }

    /* 5. Difficulte, meme formule que le reste de la banque. */
    let diff = brut.diff;
    try { diff = distractorScore(brut.fen, brut.sol[0], brut.quiet).score; } catch (e) { /* garde la valeur recue */ }

    /* 7. Identifiant et code neufs. Le tirage est verifie contre TOUS les
       codes, anciens et deja attribues dans cette passe. */
    let code;
    do { code = codeAuHasard(); } while (codes.has(code));
    codes.add(code);

    const p = {
      id: "p" + (++maxId),
      fen: brut.fen,
      type: brut.type || "gain",
      n: brut.n || 0,
      sol: brut.sol,
      theme: motif,
      level: niveauDuMotif[motif],
      diff: diff,
      code: code,
      explain: brut.explain || detail || {}
    };
    if (brut.pedagogy) p.pedagogy = brut.pedagogy;
    if (brut.source) p.source = brut.source;
    ajoutes.push(p);
    vues.add(cle(p));
  }
  process.stderr.write("\r");
}

const fusion = banque.concat(ajoutes);
const apres = {};
for (const p of fusion) apres[p.theme] = (apres[p.theme] || 0) + 1;

console.log("\n--- Rejets ---");
console.log("  deja dans la banque :", rejets.doublon);
console.log("  verification echouee:", rejets.verification);
console.log("  motif introuvable   :", rejets.motif);
console.log("  motif inconnu       :", rejets.motifInconnu);
console.log("  entree illisible    :", rejets.illisible);

console.log("\n--- Motifs, avant et apres ---");
for (const th of Object.keys(apres).sort((a, b) => apres[b] - apres[a])) {
  const a = avant[th] || 0, b = apres[th], d = b - a;
  console.log("  " + th.padEnd(18) + String(a).padStart(6) + " -> " + String(b).padStart(6) + (d ? "   +" + d : ""));
}
console.log("\nTotal : " + banque.length + " -> " + fusion.length + "  (+" + ajoutes.length + ")");

/* Controles finaux. Un doublon d'identifiant ou de code casserait le lien
   profond #puzzle= et l'affichage du code, sans erreur visible. */
const ids = new Set(), dupIds = [], dupCodes = [], vusCodes = new Set();
for (const p of fusion) {
  if (ids.has(p.id)) dupIds.push(p.id); else ids.add(p.id);
  if (p.code) { if (vusCodes.has(p.code)) dupCodes.push(p.code); else vusCodes.add(p.code); }
}
console.log("Identifiants uniques :", dupIds.length === 0 ? "oui" : "NON (" + dupIds.slice(0, 5).join(",") + ")");
console.log("Codes uniques        :", dupCodes.length === 0 ? "oui" : "NON (" + dupCodes.slice(0, 5).join(",") + ")");
if (dupIds.length || dupCodes.length) {
  console.error("\nFusion ABANDONNEE : collision detectee, la banque n'est pas modifiee.");
  process.exit(1);
}

if (dry) {
  console.log("\n--dry : rien n'a ete ecrit.");
} else {
  fs.writeFileSync(BANQUE, JSON.stringify(fusion));
  console.log("\npuzzles.json ecrit. Etape suivante : node build_site.js");
}
