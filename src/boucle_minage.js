#!/usr/bin/env node
/* Boucle de minage sans surveillance, en voies paralleles.

   Usage :
     node boucle_minage.js <parties.pgn> <dossier> <depart> <nb fenetres> [options]

   Options :
     --fenetre=100000   parties brutes par fenetre (defaut 500000, maximum 500000)
     --voies=6          nombre de minages lances en parallele (defaut 1)
     --voie=0           quelle voie EST ce processus (0 a voies-1)
     --minelo=1800      filtre de niveau

   Six voies : six consoles, memes arguments, seul --voie change (0 a 5).

   Pourquoi des voies. mine_puzzles.js est mono-cœur. Les voies se
   repartissent les fenetres en tourniquet (voie i : fenetres i, i+voies,
   i+2*voies...). Aucune fenetre traitee deux fois, aucune oubliee : c'est
   ce que garde tests/check_voies_minage.js.

   Pourquoi une fenetre reglable. Chaque minage charge sa fenetre en memoire
   d'un bloc : 5,1 Ko par partie, mesure. A 100 000 parties, six voies
   tiennent en environ 3 Go. La taille n'a aucun effet sur ce qui est mine,
   seulement sur la memoire et sur ce qu'une coupure fait perdre.

   Ce que cette boucle ne fait PAS : toucher a puzzles.json, au site, ou a
   quoi que ce soit de publie. Elle peut donc tourner des semaines seule.

   Reprise. Une fenetre n'est terminee que si son marqueur .fini existe.
   Couper et relancer avec les memes arguments reprend ou on en etait. */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const SURLECTURE = 30;
/* Une ligne de progression par voie dans le journal, toutes les 30 min. */
const PROGRESSION_MS = 30 * 60 * 1000;

/* Rang de la k-ieme fenetre d'une voie, en parties BRUTES. Sortie de la
   boucle pour etre testable : c'est elle qui garantit le pavage. */
function sauterDe(depart, voie, voies, fenetre, k) {
  return depart + (voie + k * voies) * fenetre;
}
module.exports = { sauterDe };

if (require.main === module) {
  const opt = (n, d) => {
    const a = process.argv.find(x => x.startsWith("--" + n + "="));
    if (!a) return d;
    const v = +a.slice(n.length + 3);
    return Number.isFinite(v) ? v : d;
  };

  const PGN = process.argv[2];
  const SORTIE = process.argv[3];
  const DEPART = +process.argv[4];
  const NB = +process.argv[5];
  const FENETRE = Math.min(opt("fenetre", 500000), 500000);
  const VOIES = Math.max(1, opt("voies", 1));
  const VOIE = opt("voie", 0);
  const MINELO = opt("minelo", 1800);

  if (!PGN || !SORTIE || !Number.isFinite(DEPART) || !NB || NB < 1) {
    console.error("Usage : node boucle_minage.js <parties.pgn> <dossier> <depart> <nb fenetres> [--fenetre=500000] [--voies=1] [--voie=0] [--minelo=1800]");
    process.exit(1);
  }
  if (VOIE < 0 || VOIE >= VOIES) { console.error("--voie doit valoir entre 0 et " + (VOIES - 1)); process.exit(1); }
  if (!fs.existsSync(PGN)) { console.error("PGN introuvable : " + PGN); process.exit(1); }
  fs.mkdirSync(SORTIE, { recursive: true });

  /* mine_puzzles multiplie maxGames par la sur-lecture pour obtenir les
     parties BRUTES lues. On inverse ici pour que --fenetre compte bien des
     parties brutes, la seule unite comparable a --sauter. */
  const MAXGAMES = Math.max(1, Math.ceil(FENETRE / SURLECTURE));

  const JOURNAL = path.join(SORTIE, "boucle-voie" + VOIE + ".log");
  const noter = (s) => {
    const l = new Date().toISOString().replace("T", " ").slice(0, 19) + "  [voie " + VOIE + "] " + s;
    console.log(l);
    try { fs.appendFileSync(JOURNAL, l + "\n"); } catch (e) { /* non critique */ }
  };

  /* Piege evite : mine_puzzles.js reecrit sa sortie toutes les 50 parties.
     Une fenetre interrompue laisse donc un fichier VALIDE mais incomplet.
     Juger sur le seul fichier sauterait le reste de la fenetre a la
     reprise, sans erreur. Le marqueur n'est ecrit qu'apres un code 0. */
  const marqueurDe = (f) => f.replace(/\.json$/, "") + ".fini";
  const dejaFaite = (f) => {
    if (!fs.existsSync(marqueurDe(f))) return false;
    try { return Array.isArray(JSON.parse(fs.readFileSync(f, "utf8"))); }
    catch (e) { return false; }
  };

  const lance = (sauter, fichier) => new Promise((resolve) => {
    const args = [path.join(__dirname, "mine_puzzles.js"), PGN, fichier,
      String(MAXGAMES), String(MINELO), String(SURLECTURE), "--sauter=" + sauter];
    const p = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let dernier = "";
    /* mine_puzzles.js ecrit sa progression avec des \r : sans ce releve,
       une fenetre de 23 h n'a aucune trace dans le journal entre son debut
       et sa fin (2026-10-18). */
    p.stderr.on("data", d => { dernier = String(d).split(/[\r\n]/).map(s => s.trim()).filter(Boolean).pop() || dernier; });
    p.stdout.on("data", d => { dernier = String(d).trim() || dernier; });
    const releve = setInterval(() => { if (dernier) noter("    " + dernier); }, PROGRESSION_MS);
    p.on("close", code => { clearInterval(releve); resolve({ code, dernier }); });
    p.on("error", e => { clearInterval(releve); resolve({ code: -1, dernier: e.message }); });
  });

  (async () => {
    noter("Demarrage : " + NB + " fenetres de " + FENETRE + " parties, voie " + VOIE + " sur " + VOIES);
    noter("Memoire attendue pour cette voie : environ " + (FENETRE * 5.1 / 1e6).toFixed(1) + " Go");
    noter("PGN " + PGN + " -> " + SORTIE);

    const t0 = Date.now();
    let faites = 0, sautees = 0, echouees = 0, total = 0;

    for (let k = 0; k < NB; k++) {
      const sauter = sauterDe(DEPART, VOIE, VOIES, FENETRE, k);
      const fichier = path.join(SORTIE, "fournee-" + sauter + ".json");
      const nom = path.basename(fichier);

      if (dejaFaite(fichier)) { sautees++; noter("[" + (k + 1) + "/" + NB + "] " + nom + " deja faite"); continue; }

      noter("[" + (k + 1) + "/" + NB + "] debut, --sauter=" + sauter);
      const tf = Date.now();
      const { code, dernier } = await lance(sauter, fichier);
      const h = ((Date.now() - tf) / 3600000).toFixed(1);

      let n = 0;
      try { const t = JSON.parse(fs.readFileSync(fichier, "utf8")); n = Array.isArray(t) ? t.length : 0; } catch (e) { n = 0; }

      if (code !== 0) { echouees++; noter("[" + (k + 1) + "/" + NB + "] ECHEC (code " + code + ") apres " + h + " h, fenetre INCOMPLETE, elle sera refaite : " + dernier); continue; }
      fs.writeFileSync(marqueurDe(fichier), new Date().toISOString() + "  " + n + " exercices\n");
      total += n;
      faites++;
      noter("[" + (k + 1) + "/" + NB + "] terminee en " + h + " h, " + n + " exercices");
      if (n === 0) { noter("Fenetre vide : fin probable du PGN, arret de cette voie."); break; }
    }

    noter("---");
    noter("Bilan voie " + VOIE + " : " + faites + " minees, " + sautees + " deja faites, " + echouees
      + " en echec, " + total + " exercices, en " + ((Date.now() - t0) / 3600000).toFixed(1) + " h");
    noter("Aucun fichier publie n'a ete modifie.");
  })();
}
