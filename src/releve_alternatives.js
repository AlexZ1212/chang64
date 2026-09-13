#!/usr/bin/env node
/* Releve des coups EQUIVALENTS a la solution enregistree, pour l'ancienne
   moitie de la banque.

   Usage, dans l'ordre :
     node releve_alternatives.js --extraire
     node decouper_fournee.js anciens_gains.json 6
     node releve_alternatives.js anciens_gains-1.json --profondeur=18    (x6)
     node releve_alternatives.js --appliquer anciens_gains-1.alternatives.json ... --dry
     node releve_alternatives.js --appliquer anciens_gains-1.alternatives.json ...

   POURQUOI.
   La banque vit en deux regimes. Les 24 059 exercices ajoutes le 12 septembre
   sont passes par filtre_stockfish.js en exigence stricte : coup unique, et
   200 centipions d'avance sur le deuxieme choix. Les 51 189 plus anciens
   n'ont jamais vu Stockfish. L'audit du 9 septembre en a retire 430 faux,
   mais il ne posait pas la question du deuxieme coup : il reste environ
   12 116 exercices ou un AUTRE coup gagne presque autant. Sur ceux-la, le
   joueur qui trouve un coup aussi gagnant s'entend repondre "Pas tout a
   fait". C'est la meme famille de defaut que les promotions inversees, en
   plus doux et sur beaucoup plus d'exercices.

   Deux facons de refermer l'ecart : retirer ces 12 116, ou les accepter.
   Ce script sert la seconde. Il ne juge pas, il RELEVE : pour chaque
   exercice, la liste des coups que le moteur ne sait pas separer de la
   solution enregistree. L'interface s'en sert ensuite pour accepter ces
   coups-la (voir currentSolutions(), ui.js).

   CE QUI EST EXAMINE, ET CE QUI NE L'EST PAS.
   - Les gains a UN SEUL coup, soit 39 214 des 39 734 gains anciens (98,7 %).
     Un gain a un coup s'arrete des le coup joue : accepter un coup
     equivalent n'a aucune suite a rejouer, donc rien ne peut diverger.
   - Les 520 gains a trois demi-coups sont ECARTES. La suite enregistree
     (replique forcee, puis coup final) n'aurait plus de sens apres un
     premier coup different : il faudrait recalculer toute la ligne. Ils
     gardent donc l'exigence stricte actuelle.
   - Les MATS ne sont pas concernes du tout. currentSolutions() appelle deja
     matingMoves(), qui accepte TOUT coup matant en n : le probleme n'a
     jamais existe de ce cote.

   LA FRONTIERE ENTRE LES DEUX REGIMES.
   Aucun champ ne dit quel exercice vient de quelle fournee, mais les
   identifiants le disent : la fusion numerote a la suite. Les 812 zones de
   trous laissees par les purges s'arretent toutes avant p52307, et les
   identifiants sont rigoureusement contigus de p52307 a p76365, soit
   exactement 24 059 -- le nombre d'ajouts de la fournee du 12. La frontiere
   est donc p52306, verifiee par le comptage et non supposee.

   LE CRITERE.
   Un coup est retenu comme equivalent s'il gagne encore (au moins SEUIL
   centipions) ET s'il n'est pas plus bas que la solution enregistree de plus
   de MARGE centipions. La reference est la solution ENREGISTREE, pas le
   meilleur coup du moteur : la promesse faite au joueur est "trouve un coup
   qui gagne comme celui-la", pas "trouve le coup prefere de Stockfish". Un
   coup meilleur que la solution est donc accepte a plus forte raison.
   MARGE vaut 200 par defaut, exactement le seuil qui fait rejeter une
   fournee dans filtre_stockfish.js : ce que le filtre declare inseparable,
   le jeu l'accepte. Un seul chiffre, deux usages, pas de derive possible
   entre les deux.

   TROIS PIEGES DEJA PAYES, RESPECTES ICI.
   1. MultiPV change le meilleur coup annonce a profondeur egale. Il ne sert
      donc qu'a PROPOSER des candidats ; chaque candidat retenu est ensuite
      re-evalue seul, en MultiPV 1, avec searchmoves. C'est ce second score
      qui decide, jamais celui de la liste.
   2. La table de hachage contamine la recherche suivante : ucinewgame +
      isready avant chaque recherche, sans exception.
   3. La serialisation UCI passe par g.uci(), seule source de verite du
      moteur. Aucune table de lettres locale ici.

   Le journal .jsonl est ecrit au fil de l'eau et --reprendre le relit : une
   passe sur 39 000 exercices dure des heures, une coupure ne doit pas tout
   effacer.
*/
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Game } = require(path.join(__dirname, "engine.js"));
const { verifyFull } = require(path.join(__dirname, "gen_puzzles_v2.js"));

const arg = n => { const a = process.argv.find(x => x.startsWith("--" + n + "=")); return a ? a.split("=")[1] : null; };
const a_ = n => process.argv.includes("--" + n);

const PROF = +(arg("profondeur") || 18);
const MARGE = +(arg("marge") || 200);
const SEUIL = +(arg("seuil") || 100);
const LARGEUR = +(arg("largeur") || 6);      /* MultiPV : combien de candidats proposer */
const FRONTIERE = +(arg("frontiere") || 52306);
const REPRENDRE = a_("reprendre");
const DRY = a_("dry");

const F_BANQUE = path.join(__dirname, "puzzles.json");
const numId = p => +String(p.id).slice(1);

/* ================= MODE 1 : extraction du lot a examiner ================= */
if (a_("extraire")) {
  const banque = JSON.parse(fs.readFileSync(F_BANQUE, "utf8"));
  const tout = a_("tout");
  const lot = banque.filter(p =>
    p.type === "gain" && p.sol.length === 1 && (tout || numId(p) <= FRONTIERE));
  const sortie = path.join(__dirname, "anciens_gains.json");
  fs.writeFileSync(sortie, JSON.stringify(lot));
  const anciens = banque.filter(p => numId(p) <= FRONTIERE).length;
  console.log("Banque              :", banque.length, "exercices");
  console.log("Ancien regime       :", anciens, "(id <= p" + FRONTIERE + ")");
  console.log("Nouveau regime      :", banque.length - anciens, "(deja filtres, ecartes)");
  console.log("A examiner          :", lot.length, "gains a un seul coup");
  console.log("Ecrit               :", path.basename(sortie));
  console.log("\nEnsuite :\n  node decouper_fournee.js anciens_gains.json 6");
  process.exit(0);
}

/* ================= MODE 3 : application a la banque ================= */
if (a_("appliquer")) {
  const fichiers = process.argv.slice(2).filter(x => !x.startsWith("--"));
  if (!fichiers.length) { console.error("Donne au moins un fichier .alternatives.json"); process.exit(1); }
  /* Le releve enregistre TOUT ce que le moteur ne sait pas separer ; c'est
     ici, et seulement ici, qu'on decide quoi en faire. Le seuil se change
     sans relancer la moindre recherche.
     Pourquoi un plafond. Un exercice ou six coups differents gagnent autant
     n'est pas un exercice injuste, c'est un exercice sans question : la
     position est gagnee d'avance et "trouve le coup gagnant" ne veut plus
     rien dire. Accepter les six le rendrait trivial, les refuser le rend
     injuste ; le retirer est la seule reponse honnete. En dessous du
     plafond, au contraire, il reste une idee a trouver et plusieurs facons
     de l'executer : la c'est bien le refus qui est le defaut. */
  const MAXALT = +(arg("max-alt") || 2);
  const banque = JSON.parse(fs.readFileSync(F_BANQUE, "utf8"));
  const parCode = new Map(banque.map(p => [p.code, p]));
  let vus = 0, avecAlt = 0, totalAlt = 0, absents = 0;
  const nonGagnants = [], trop = [], distrib = {};
  for (const f of fichiers) {
    for (const r of JSON.parse(fs.readFileSync(f, "utf8"))) {
      vus++;
      const p = parCode.get(r.code);
      if (!p) { absents++; continue; }
      if (r.probleme) { nonGagnants.push({ code: r.code, id: r.id, probleme: r.probleme }); continue; }
      const n = (r.alt || []).length;
      distrib[n] = (distrib[n] || 0) + 1;
      if (n > MAXALT) { trop.push({ code: r.code, id: r.id, alt: r.alt }); continue; }
      if (n) {
        avecAlt++; totalAlt += n;
        if (!DRY) p.alt = r.alt;
      } else if (!DRY && p.alt) delete p.alt;
    }
  }
  console.log("Releves lus         :", vus);
  console.log("Introuvables        :", absents);
  console.log("Coups equivalents par exercice :",
    Object.keys(distrib).sort((a, b) => a - b).map(k => k + " -> " + distrib[k]).join(", "));
  console.log("Plafond             :", MAXALT, "alternative(s)");
  console.log("Exercices enrichis  :", avecAlt,
    "(" + (vus ? (100 * avecAlt / vus).toFixed(1) : 0) + " %), " + totalAlt + " coups ajoutes");
  console.log("Au-dessus du plafond:", trop.length,
    "(" + (vus ? (100 * trop.length / vus).toFixed(1) : 0) + " %) -- a retirer, position sans question");
  console.log("Solution qui ne gagne plus :", nonGagnants.length);
  if (!DRY) {
    if (trop.length) fs.writeFileSync(path.join(__dirname, "alternatives_sans_question.json"), JSON.stringify(trop, null, 1));
    if (nonGagnants.length) fs.writeFileSync(path.join(__dirname, "alternatives_a_revoir.json"), JSON.stringify(nonGagnants, null, 1));
    console.log("\nCes deux listes sont ECRITES, pas appliquees : aucun exercice");
    console.log("n'est retire ici. La purge passe par purge_puzzles.js, apres relecture.");
  }
  if (DRY) { console.log("\n--dry : puzzles.json n'a pas ete touche."); process.exit(0); }
  fs.writeFileSync(F_BANQUE, JSON.stringify(banque));
  console.log("puzzles.json reecrit. Ensuite : node build_site.js puis node run_tests.js");
  process.exit(0);
}

/* ================= MODE 2 : la passe Stockfish ================= */
const ENTREE = process.argv[2];
if (!ENTREE || ENTREE.startsWith("--")) {
  console.error("Usage : node releve_alternatives.js <lot.json> [--profondeur=18] [--marge=200] [--seuil=100] [--largeur=6] [--reprendre]");
  console.error("        node releve_alternatives.js --extraire [--tout]");
  console.error("        node releve_alternatives.js --appliquer <*.alternatives.json> [--dry]");
  process.exit(1);
}
const base = ENTREE.replace(/\.json$/, "");
const F_SORTIE = base + ".alternatives.json";
const F_JOURNAL = base + ".alternatives.jsonl";

const lot = JSON.parse(fs.readFileSync(ENTREE, "utf8"));
console.log("Lot                 :", lot.length, "exercices");
console.log("Profondeur", PROF, "| seuil", SEUIL, "cp | marge", MARGE, "cp | MultiPV", LARGEUR);

const deja = new Map();
if (REPRENDRE && fs.existsSync(F_JOURNAL)) {
  for (const l of fs.readFileSync(F_JOURNAL, "utf8").split("\n")) {
    if (!l.trim()) continue;
    try { const o = JSON.parse(l); deja.set(o.code, o); } catch (e) { /* ligne tronquee */ }
  }
  console.log("Deja examines       :", deja.size, "(reprise)");
}

const vraiWrite = process.stdout.write.bind(process.stdout);
let lignes = [], capture = false;
process.stdout.write = (c, ...r) => { if (capture) { String(c).split("\n").forEach(l => l && lignes.push(l)); return true; } return vraiWrite(c, ...r); };
const dire = s => vraiWrite(s + "\n");
const dodo = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(os.tmpdir(), "sf-alternatives");
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
  capture = false;
  dire("moteur pret\n");

  /* Dernier "info" de chaque rang MultiPV : le plus profond, donc le seul
     qui compte. Un mat compte comme 100000, borne au-dela de tout ecart. */
  const notes = () => {
    const out = {};
    for (const l of lignes.filter(x => /^info depth \d+ .*score/.test(x))) {
      const mp = /multipv (\d+)/.exec(l), sc = /score (cp|mate) (-?\d+)/.exec(l), pv = / pv (\S+)/.exec(l);
      if (!sc) continue;
      const val = sc[1] === "mate" ? (+sc[2] > 0 ? 100000 : -100000) : +sc[2];
      out[mp ? mp[1] : "1"] = { score: val, coup: pv ? pv[1] : null };
    }
    return out;
  };
  const neuf = async fen => {
    await cmd("ucinewgame"); await cmd("isready"); await attendre(/readyok/, 30000);
    lignes = []; await cmd("position fen " + fen);
  };
  /* Une recherche, eventuellement restreinte a un coup. Toujours MultiPV 1
     quand il s'agit d'obtenir un score qui fera foi. */
  const chercher = async (fen, coup) => {
    await neuf(fen);
    await cmd("go depth " + PROF + (coup ? " searchmoves " + coup : ""));
    const bm = await attendre(/^bestmove/, 120000);
    return { bestmove: bm ? bm.split(" ")[1] : null, notes: notes() };
  };

  const sortie = [];
  const journal = fs.createWriteStream(F_JOURNAL, { flags: REPRENDRE ? "a" : "w" });
  let faits = 0, avecAlt = 0, totalAlt = 0, problemes = 0;
  const t0 = Date.now();

  for (let i = 0; i < lot.length; i++) {
    const p = lot[i];
    const vu = deja.get(p.code);
    if (vu) { sortie.push(vu); if (vu.alt && vu.alt.length) { avecAlt++; totalAlt += vu.alt.length; } if (vu.probleme) problemes++; continue; }

    let res = { code: p.code, id: p.id, sol: p.sol[0], alt: [] };

    if (!verifyFull(p)) {
      res.probleme = "sequence illegale";
    } else {
      faits++;
      capture = true;
      /* 1. Score de reference : la solution enregistree, evaluee SEULE.
            La recherche complete d'ouverture a ete retiree (2026-09-12) :
            elle ne servait qu'a afficher "le moteur prefere X", et le
            handoff 8 rappelle que l'identite du meilleur coup lue en
            MultiPV ne vaut pas. Aucune decision ici n'en depend. Ce qui
            compte pour le joueur est : la solution qu'on lui demande
            gagne-t-elle encore ? C'est exactement ce que mesure cette
            recherche-la, et une recherche de moins par exercice retire un
            bon quart de la duree totale de la passe. */
      await cmd("setoption name MultiPV value 1");
      const rSol = await chercher(p.fen, p.sol[0]);
      const nSol = rSol.notes["1"];

      if (!nSol) res.probleme = "pas de reponse du moteur";
      else if (nSol.score < SEUIL) res.probleme = "la solution ne gagne pas (" + (nSol.score / 100).toFixed(2) + ")";
      else {
        res.scoreSol = nSol.score;
        const plancher = Math.max(SEUIL, nSol.score - MARGE);
        /* 2. Candidats, en MultiPV : proposition seulement, et large. Le
              filtre de proposition ne retient QUE "ce coup gagne encore"
              (SEUIL), pas le plancher final : un score de liste MultiPV et
              un score de searchmoves ne sont pas comparables. Mesure sur
              l'echantillon : jusqu'a 540 cp d'ecart pour le MEME coup entre
              une recherche complete et une recherche restreinte a ce coup,
              la seconde etant plus profonde en pratique puisqu'elle n'a
              qu'une branche a explorer. Pre-filtrer sur le plancher ferait
              donc manquer de vraies equivalences. Toutes les comparaisons
              qui DECIDENT se font ensuite entre scores de meme nature. */
        await cmd("setoption name MultiPV value " + LARGEUR);
        const rK = await chercher(p.fen);
        const cands = [];
        for (let k = 1; k <= LARGEUR; k++) {
          const n = rK.notes[String(k)];
          if (n && n.coup && n.coup !== p.sol[0] && n.score >= SEUIL && !cands.includes(n.coup)) cands.push(n.coup);
        }
        res.candidats = cands.length;
        /* 3. Chaque candidat re-evalue SEUL, en MultiPV 1 : c'est ce
              score-la qui decide, compare a celui de la solution obtenu de
              la meme facon. */
        await cmd("setoption name MultiPV value 1");
        for (const c of cands) {
          const rc = await chercher(p.fen, c);
          const nc = rc.notes["1"];
          if (nc && nc.score >= plancher) res.alt.push(c);
        }
      }
      capture = false;
    }

    if (res.probleme) problemes++;
    if (res.alt.length) { avecAlt++; totalAlt += res.alt.length; }
    journal.write(JSON.stringify(res) + "\n");
    sortie.push(res);

    if ((i + 1) % 25 === 0) {
      const ms = (Date.now() - t0) / Math.max(1, faits);
      dire("  " + (i + 1) + "/" + lot.length +
        "   avec alternative " + avecAlt + ", a revoir " + problemes +
        "   " + Math.round(ms) + " ms/exercice" +
        "   reste ~" + ((lot.length - i - 1) * ms / 3600000).toFixed(1) + " h");
    }
  }
  await new Promise(r => journal.end(r));
  process.stdout.write = vraiWrite;

  fs.writeFileSync(F_SORTIE, JSON.stringify(sortie));
  console.log("\nExamines            :", sortie.length);
  console.log("Avec alternative(s) :", avecAlt,
    "(" + (sortie.length ? (100 * avecAlt / sortie.length).toFixed(1) : 0) + " %)");
  console.log("Coups equivalents   :", totalAlt);
  console.log("A regarder a la main:", problemes);
  console.log("Ecrit               :", path.basename(F_SORTIE));
  process.exit(0);
})();
