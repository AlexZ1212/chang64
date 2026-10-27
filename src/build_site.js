const fs = require("fs");
const path = require("path");
const { Game, pType, pColor } = require("./engine.js");
/* Langues du site (2026-10-25) : registre unique, et traduction des pages
   pour les langues autres que l'anglais et le francais. Voir
   langues/registre.js et langues/traduire.js. */
const { LANGUES, CODES, PAR_CODE } = require("./langues/registre.js");
const TRAD = require("./langues/traduire.js");
const { tr, T, choix } = TRAD;
/* Minification a la livraison (session du 29/08) : PageSpeed Insights
   relevait ~30 Ko d'economie possible (CSS+JS) sur l'app. Le code source
   reste intact et commente -- terser/le minifieur maison ne s'appliquent
   qu'au texte ecrit dans index.html, jamais aux fichiers .js eux-memes.
   Installation requise une seule fois : npm install terser --no-save
   (ou --save-dev si vous preferez le garder trace dans un package.json). */
let terser;
try { terser = require("terser"); } catch (e) {
  console.error("terser manquant : lancez `npm install terser --no-save` puis relancez le build.");
  process.exit(1);
}
function minifyJs(code, label) {
  const r = terser.minify_sync(code, { compress: {}, mangle: false });
  if (r.error) {
    console.error(`Minification JS echouee sur ${label}, fichier livre non minifie pour cette partie :`, r.error.message || r.error);
    return code;
  }
  return r.code;
}
/* CSS : minifieur maison plutot qu'une dependance de plus, volontairement
   prudent (pas de fusion de regles, pas de suppression de point-virgule
   ambigu) -- suffisant pour l'essentiel du gain (commentaires + espaces),
   sans le risque d'un minifieur CSS plus agressif sur un fichier qu'on ne
   revalide pas visuellement a chaque build. */
function minifyCss(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>])\s*/g, "$1")
    .replace(/;\}/g, "}")
    .trim();
}

const OUT = path.join(__dirname, "site");
const SITE = "https://chang64.com";
/* Definis ici, tout en haut, et pas a cote de leur premier usage : shell()
   les lit pendant la generation des pages, qui se termine bien avant la
   fin du fichier. Une const declaree plus bas serait en zone morte
   temporelle a ce moment-la et ferait echouer le build (piege deja
   rencontre plusieurs fois sur ce projet). */
const BUILD_DATE = new Date().toISOString().slice(0, 10);

/* ---------- registre des dates de contenu (2026-09-06) ----------
   Avant : dateModified valait la date de construction. Exact au sens strict,
   les pages etant regenerees a chaque build, mais inutilisable comme signal :
   les 467 pages remontaient toutes ensemble a chaque deploiement, y compris
   celles dont pas un mot n'avait change. Un signal de fraicheur qui se
   declenche partout a chaque fois ne dit plus rien. Et datePublished etait
   absent faute de date fiable, alors qu'il suffit de la retenir la premiere
   fois qu'on voit une page.
   Le registre est un fichier versionne, content-dates.json : pour chaque
   page, l'empreinte de son contenu, sa date de premiere publication et sa
   date de derniere vraie modification. Une page dont l'empreinte n'a pas
   bouge garde sa date. Ne pas supprimer ce fichier : il serait reconstruit
   avec la date du jour partout, et on perdrait tout l'historique. */
const DATES_PATH = path.join(__dirname, "content-dates.json");
const DATES = fs.existsSync(DATES_PATH) ? JSON.parse(fs.readFileSync(DATES_PATH, "utf8")) : {};
if (!fs.existsSync(DATES_PATH) && fs.existsSync(path.join(__dirname, "site", "openings"))) {
  /* Le registre manque alors qu'un site a deja ete construit ici : soit il
     n'a jamais ete commite, soit il a ete supprime. Dans les deux cas les 466
     pages vont repartir a la date du jour et tout l'historique de publication
     est perdu, sans que rien ne le signale au moment ou c'est reparable.
     On ne bloque pas la construction, on la rend impossible a rater. */
  console.log("\n" + "!".repeat(58));
  console.log("  content-dates.json est ABSENT.");
  console.log("  Toutes les pages vont etre datees d'aujourd'hui et");
  console.log("  l'historique de publication sera perdu.");
  console.log("  Ce fichier doit etre commite avec les sources.");
  console.log("  Si tu l'as supprime par erreur : recupere-le avant de pousser.");
  console.log("!".repeat(58) + "\n");
}
let datesNouvelles = 0, datesModifiees = 0;
/* Passage aux URL sans extension (2026-10-24). Cloudflare Pages redirige en
   308 toute URL en .html vers sa forme sans extension : les canoniques, le
   sitemap et les hreflang pointaient donc tous vers des redirections. Le
   registre est indexe par le chemin public, il change donc de cle :
   "/openings/ruy-lopez.html" devient "/openings/ruy-lopez".
   La migration se fait ici, au chargement, et l'historique suit sa page.
   Le meme changement modifie aussi le corps des pages (leurs liens internes
   perdent l'extension), donc leur empreinte : sans precaution, les 466 pages
   seraient toutes datees "mise a jour aujourd'hui" pour un simple changement
   d'adresse, exactement le faux signal que ce registre existe pour eviter.
   Tant que la migration est en cours, une empreinte qui change est donc
   reprise sans toucher a la date. La migration ne joue qu'une fois : des que
   le registre est reecrit, plus aucune cle ne finit en .html. */
const MIGRATION_SANS_HTML = Object.keys(DATES).some(k => k.endsWith(".html"));
if (MIGRATION_SANS_HTML) {
  for (const k of Object.keys(DATES)) {
    if (!k.endsWith(".html")) continue;
    const neuve = k.replace(/\.html$/, "");
    if (!DATES[neuve]) DATES[neuve] = DATES[k];
    delete DATES[k];
  }
}
/* Meme precaution pour le passage a six langues (2026-10-25) : les pages
   francaises pointent desormais vers /fr/ et non plus vers "/" (logo,
   boutons, pied de page), et l'index des ouvertures porte les messages de sa
   recherche. Leur corps change donc, sans un mot de contenu de plus : le
   premier build qui cree les pages des nouvelles langues reprend ces
   empreintes sans toucher aux dates. */
const MIGRATION_LANGUES = !Object.keys(DATES).some(k => k.startsWith("/es/"));
function datesDe(cheminPublic, contenu) {
  /* L'empreinte porte sur le CORPS de la page, pas sur le document entier :
     l'entete, le pied et le JSON-LD contiennent la date elle-meme et des
     elements communs, les inclure ferait changer l'empreinte a chaque build
     et ramenerait le probleme d'origine. */
  const sceau = require("crypto").createHash("sha1").update(contenu, "utf8").digest("hex").slice(0, 16);
  const connu = DATES[cheminPublic];
  if (!connu) { DATES[cheminPublic] = { sceau, publiee: BUILD_DATE, modifiee: BUILD_DATE }; datesNouvelles++; }
  else if (connu.sceau !== sceau) {
    connu.sceau = sceau;
    if (!MIGRATION_SANS_HTML && !(MIGRATION_LANGUES && cheminPublic !== "/")) { connu.modifiee = BUILD_DATE; datesModifiees++; }
  }
  return DATES[cheminPublic];
}
const MOIS_FR = ["janvier","février","mars","avril","mai","juin","juillet",
  "août","septembre","octobre","novembre","décembre"];
/* "2026-09-06" -> "6 septembre 2026". toLocaleDateString depend de la locale
   de la machine qui construit le site, ce qui donnerait un resultat different
   selon l'endroit d'ou on deploie. */
function frDate(iso) {
  const [a, m, j] = iso.split("-");
  return parseInt(j, 10) + " " + MOIS_FR[parseInt(m, 10) - 1] + " " + a;
}
/* Autres langues (2026-10-25) : Intl avec la locale explicite et le fuseau
   UTC, donc le meme resultat quelle que soit la machine de construction (le
   piege que frDate evite ci-dessus vient de toLocaleDateString sans
   locale). L'anglais garde la date ISO. */
function dateLongue(lang, iso) {
  if (lang === "en") return iso;
  if (lang === "fr") return frDate(iso);
  return new Intl.DateTimeFormat(PAR_CODE[lang].intl, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(iso + "T12:00:00Z"));
}
/* "Publiee le ..., mise a jour le ..." du pied des pages de contenu. */
function datesPied(lang, dates) {
  const p = dateLongue(lang, dates.publiee), m = dateLongue(lang, dates.modifiee);
  return dates.modifiee !== dates.publiee
    ? T(lang, "Published {p}, updated {m}", "Publiée le {p}, mise à jour le {m}", { p, m })
    : T(lang, "Published {p}", "Publiée le {p}", { p });
}
/* ---------- hachages de la CSP (2026-09-06) ----------
   script-src portait 'unsafe-inline', ce qui annulait la protection XSS que
   le reste de l'en-tete laissait croire : une injection reussie s'executait.
   Un premier chiffrage pendant l'audit avait conclu que la sortie coutait 936
   hachages, donc qu'elle etait impraticable. Ce chiffre etait faux : il
   comptait les blocs <script type="application/ld+json">, qui sont des blocs
   de DONNEES et ne sont pas executes, donc pas soumis a script-src. En ne
   comptant que le script reellement executable, il n'y en a qu'un par page et
   cinq empreintes distinctes en tout : le script commun des pages anglaises,
   celui des pages francaises, et trois pages a part.
   Les empreintes sont calculees APRES generation, sur le site tel qu'il est
   servi : les deduire des gabarits reviendrait a hacher ce qu'on croit avoir
   ecrit plutot que ce qui est livre, et le moindre ecart de minification
   couperait tout le JavaScript du site.
   Ne remets pas 'unsafe-inline' pour faire taire une erreur de console :
   c'est le signe qu'un script a change sans que cette fonction repasse, et la
   bonne reponse est de reconstruire. tests/check_csp.js garde la regle.
   style-src garde 'unsafe-inline' : les attributs style="..." ne peuvent pas
   etre couverts par un hachage, et une feuille de style injectee ne
   s'execute pas. Le risque n'est pas du meme ordre. */
function poserHachagesCSP() {
  const crypto = require("crypto");
  const vus = new Set();
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) { walk(p); continue; }
      if (!f.endsWith(".html")) continue;
      const h = fs.readFileSync(p, "utf8");
      for (const m of h.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
        const attrs = m[1] || "";
        if (/\ssrc=/.test(attrs)) continue;                                  /* script externe : couvert par 'self' */
        if (/type\s*=\s*"application\/(ld\+)?json"/.test(attrs)) continue;   /* bloc de donnees (JSON-LD, langue de la page), non execute */
        vus.add("'sha256-" + crypto.createHash("sha256").update(m[2], "utf8").digest("base64") + "'");
      }
    }
  })(OUT);
  const liste = [...vus].sort();
  const chemin = OUT + "/_headers";
  fs.writeFileSync(chemin, fs.readFileSync(chemin, "utf8").replace("__HACHAGES__", liste.join(" ")));
  console.log("Hachages CSP       : " + liste.length + " script(s) en ligne autorise(s), plus d'unsafe-inline");
}

function ecrireRegistreDates() {
  /* Trie a l'ecriture : sans cela l'ordre des cles suivrait l'ordre de
     generation et le fichier produirait un diff illisible a chaque build. */
  const trie = {};
  for (const k of Object.keys(DATES).sort()) trie[k] = DATES[k];
  fs.writeFileSync(DATES_PATH, JSON.stringify(trie, null, 1) + "\n");
  console.log("Dates de contenu   : " + Object.keys(trie).length + " pages, " +
    datesNouvelles + " nouvelle(s), " + datesModifiees + " modifiee(s)");
}
/* Meme identite que la page Mentions legales de l'application (PUBLISHER
   dans ui2.js). Duplique faute de module partage entre l'application et le
   generateur : a garder synchronise si elle change. */
const PUBLISHER = { name: "AlexZ1212" };

/* ---------- 1. application ---------- */
const THEMES = JSON.parse(fs.readFileSync(path.join(__dirname, "themes.json"), "utf8"));
const puzzles = require(path.join(__dirname, "banque.js")).charger();
for (const p of puzzles) if (THEMES[p.theme]) p.theme = THEMES[p.theme];

const engine = minifyJs(fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8"), "engine_browser.js");
const pieces = minifyJs(fs.readFileSync(path.join(__dirname, "pieces_browser.js"), "utf8"), "pieces_browser.js");
/* La banque complete n'est plus embarquee dans ui.js (etait __PUZZLES__,
   remplace par JSON.stringify(puzzles) -- 16 Mo bruts a 51638 exercices,
   embarques tels quels dans index.html). Chaque niveau devient un fichier a
   part sous site/data/, charge a la demande cote client (voir loadLevel/
   loadPuzzleById/loadRushPool dans ui.js) -- voir writePuzzleData() plus
   bas, appelee apres la creation de OUT. Seul le compte total reste
   necessaire tout de suite, pour __TOTAL_PUZZLES__ (juste un nombre, pas de
   cout). */
/* Decomptes par motif inscrits dans ui.js (2026-10-18), pour SEUIL_MOTIF :
   memes donnees que data/theme-counts.json, sans requete au demarrage. */
const comptesMotifs = {};
for (const p of puzzles) comptesMotifs[p.theme] = (comptesMotifs[p.theme] || 0) + 1;
let ui = minifyJs(fs.readFileSync(path.join(__dirname, "ui.js"), "utf8").replace("__TOTAL_PUZZLES__", String(puzzles.length))
  .replace("__COMPTES_MOTIFS__", JSON.stringify(comptesMotifs)), "ui.js");
let ui2 = minifyJs(fs.readFileSync(path.join(__dirname, "ui2.js"), "utf8"), "ui2.js");
// la table famille -> adresses de pages est construite plus bas, après le calcul des slugs
let ui3 = minifyJs(fs.readFileSync(path.join(__dirname, "ui3.js"), "utf8"), "ui3.js");
const i18n = minifyJs(fs.readFileSync(path.join(__dirname, "i18n.js"), "utf8"), "i18n.js");
const grammaire = minifyJs(fs.readFileSync(path.join(__dirname, "grammaire.js"), "utf8"), "grammaire.js");
/* Le nombre d'exercices etait ecrit en dur a neuf endroits : accueil, meta
   description, image de partage, donnees structurees, tuiles de navigation,
   dans les deux langues. Il devenait faux des qu'on enrichissait la banque.
   Un seul jeton, remplace ici a partir du fichier reel. */
const NP = String(puzzles.length);
let app = fs.readFileSync(path.join(__dirname, "template.html"), "utf8");
app = app.replace(/<style>[\s\S]*?<\/style>/, m => "<style>" + minifyCss(m.slice("<style>".length, -"</style>".length)) + "</style>");
/* Les jetons du nombre d'exercices (__NP__, __NP_EN__...) ne sont plus
   remplaces ici mais page par page, dans pageApplication() : depuis le
   2026-10-25 le dictionnaire de chaque langue est pose dans la page, et ses
   phrases portent le meme jeton (__NP_LOC__, groupe selon la langue). */
app = app
  .replace("/*__GRAMMAIRE__*/", grammaire)
  .replace("/*__I18N__*/", i18n)
  .replace("/*__ENGINE__*/", engine).replace("/*__PIECES__*/", pieces)
  .replace("/*__UI__*/", ui).replace("/*__UI2__*/", ui2).replace("/*__UI3__*/", ui3);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT + "/openings", { recursive: true });
fs.mkdirSync(OUT + "/engine", { recursive: true });
fs.mkdirSync(OUT + "/og", { recursive: true });
fs.mkdirSync(OUT + "/data", { recursive: true });
/* Livre d'ouvertures servi a part : 94 Ko retires de index.html, charges
   seulement quand une partie commence (voir loadOpeningBook dans ui2.js). */
fs.writeFileSync(OUT + "/openings-book.json", fs.readFileSync(path.join(__dirname, "openings.json"), "utf8"));
/* Meme principe applique a la banque d'exercices, a bien plus grande
   echelle (voir loadLevel/loadPuzzleById/loadRushPool/loadThemeCounts dans
   ui.js et ui2.js) : plus aucun exercice n'est embarque dans index.html,
   chaque fichier ici est charge a la demande cote client, mis en cache par
   le service worker comme le reste des assets statiques.
   - data/level-N.json (N=1..8) : exercices complets de ce niveau, pour
     Resoudre et la difficulte adaptative.
   - data/puzzle-index.json : { id: niveau } pour tous les exercices, seul
     moyen leger de retrouver le niveau d'un id (lien direct /#puzzle=...,
     revision d'une erreur de Sprint) sans charger toute la banque.
   - data/theme-counts.json : { theme: nombre total } pour le filtre par
     theme, sans avoir a charger un niveau juste pour compter.
   - data/rush-pool.json : echantillon dedie pour le Sprint (voir la note
     dans startRush, ui2.js) -- jusqu'a 400 exercices resolus en un coup par
     theme, tires de toute la banque plutot que d'un seul niveau, taille
     bornee plutot que la banque complete. */
(function writePuzzleData() {
  /* ---------- Redecoupage des dix niveaux (2026-09-06) ----------
     Avant : les bandes etaient taillees sur le seul score diff du moteur.
     Mesure du resultat : "Mating attacks" contenait 8% de mats, "Forcing
     mates" 3%, "Grandmaster finishes" 4%, contre 26% pour "First steps", et
     la profondeur de calcul DIMINUAIT en montant, 18% d'exercices a plusieurs
     coups au niveau 6 contre 5% au niveau 10. L'echelle promettait donc
     exactement l'inverse de ce qu'elle servait.
     La cause n'est pas un mauvais reglage : diff n'est pas comparable d'une
     famille d'exercices a l'autre. Un mat obtient un score bas parce qu'il
     est forcant, pas parce qu'il est facile a trouver. Trier toute la banque
     sur cette seule valeur revient a melanger deux echelles.
     Le decoupage suit desormais ce que l'exercice demande au joueur : voir
     une prise, puis un mat immediat, puis un motif geometrique nomme, puis un
     motif a deux cibles, puis un coup sans capture, puis un calcul a deux
     coups. diff garde son role LA ou il est valable, a l'interieur d'une
     famille, pour ordonner et pour couper les prises en quatre paliers.
     Les niveaux n'ont volontairement pas la meme taille : une famille ne se
     coupe pas en morceaux egaux sans redevenir arbitraire. De 3790 a 7512.
     Si tu ajoutes un theme a la banque, ajoute-le ici : ce qui n'est declare
     nulle part atterrit au dernier niveau et la construction le signale.
     Garde par tests/check_bandes_niveaux.js.

     Refait le 2026-10-18 : HUIT niveaux, plus aucune prise en un coup.
     Les quatre paliers de "Winning capture" occupaient les niveaux 1 a 4,
     soit 40 % de la banque. La purge du 18/10 a retire les 28 143 prises
     triviales, puis, a la demande d'Alexandre, les 5 054 prises en un coup
     restantes : "je ne veux plus de capture en 1 coup, meme au niveau le
     plus bas". Il reste 30 Winning capture a plusieurs coups, rangees avec
     le coup gagnant, dont elles sont une variante.
     Pourquoi huit et pas dix : les familles restantes en donnent six, et
     les deux plus grosses (mats en un, mats en deux et plus, pres de 9 000
     chacune) se coupent en deux. Pour aller jusqu'a dix, il aurait fallu
     couper des familles sur diff seul, c'est-a-dire revenir a des degres
     sans contenu, le defaut corrige le 06/09.
     Les deux coupes suivent un critere qu'on peut nommer : le mat du couloir
     se separe du mat en un ordinaire (motif a part, avec sa page Apprendre),
     et les mats en deux se coupent sur diff, les mats en trois rejoignant le
     palier difficile (cle : longueur de la solution, puis diff).
     Si tu changes cette liste, change aussi LEVELS (ui.js), la table
     ANCIENS_NIVEAUX qui y migre la progression des joueurs, et le test. */
  {
    const BANDES = [
      { paliers: 1, themes: ["Mate in one"] },
      { paliers: 1, themes: ["Back-rank mate"] },
      { paliers: 1, themes: ["Knight fork", "Pawn fork"] },
      { paliers: 1, themes: ["Pin", "Skewer", "Deflection"] },
      { paliers: 1, themes: ["Double attack"] },
      { paliers: 1, themes: ["Winning move", "Quiet move", "Winning capture"] },
      { paliers: 2, themes: ["Mate in two", "Mate in three"] }
    ];
    const declares = new Set(BANDES.flatMap(b => b.themes));
    const NIVEAUX = BANDES.reduce((n, b) => n + b.paliers, 0);
    const orphelins = [...new Set(puzzles.map(p => p.theme))].filter(t => !declares.has(t));
    if (orphelins.length) console.log("ATTENTION themes non classes : " + orphelins.join(", ") + " -> dernier niveau");
    let niveau = 0;
    for (const b of BANDES) {
      const lot = puzzles.filter(p => b.themes.includes(p.theme));
      lot.sort((x, y) => (x.sol || []).length - (y.sol || []).length || (x.diff || 0) - (y.diff || 0));
      const par = Math.ceil(lot.length / b.paliers);
      for (let i = 0; i < b.paliers; i++) {
        niveau++;
        for (const p of lot.slice(i * par, (i + 1) * par)) p.level = niveau;
      }
    }
    for (const p of puzzles) if (!declares.has(p.theme)) p.level = NIVEAUX;
    const tailles = [];
    for (let l = 1; l <= NIVEAUX; l++) tailles.push(puzzles.filter(p => p.level === l).length);
    console.log("Niveaux redecoupes : " + tailles.join(", "));
  }
  const byLevel = {};
  const puzzleIndex = {};
  const themeCounts = {};
  /* Niveaux ou vit chaque motif (2026-09-07, liste depuis le 2026-09-13).
     Depuis le redecoupage par famille, un motif n'est plus reparti sur toute
     Pin en 7, Fourchette de cavalier en 6, Mat du couloir en 10. Le filtre
     par theme ne pouvait donc pas fonctionner sans savoir ou aller chercher :
     rester au niveau courant revenait a filtrer sur un lot qui n'en contient
     aucun.
     On publie la LISTE des niveaux et non plus le seul plus fourni
     (2026-09-13). Winning capture ne tient pas dans un niveau : ses 28 499
     exercices occupent les niveaux 1 a 4. L'ancienne table gardait le plus
     fourni, le niveau 1, et le mode "Travailler un motif" ne chargeait des
     morceaux que de celui-la : la tuile annoncait 28 499 exercices, le mode
     en servait 7 125, tous parmi les plus faciles. Les trois quarts restants
     etaient inaccessibles par ce chemin, sans que rien ne le signale.
     La liste reste triee par effectif decroissant : on commence par le
     niveau le plus fourni, et l'ordre de lecture ne change donc pas pour les
     douze motifs qui n'ont qu'un niveau. */
  const themeLevels = {}, themeParNiveau = {};
  for (const p of puzzles) {
    (byLevel[p.level] = byLevel[p.level] || []).push(p);
    /* valeur posee plus bas, au decoupage : [niveau, morceau] */
    themeCounts[p.theme] = (themeCounts[p.theme] || 0) + 1;
    (themeParNiveau[p.theme] = themeParNiveau[p.theme] || {})[p.level] =
      (themeParNiveau[p.theme][p.level] || 0) + 1;
  }
  for (const th in themeParNiveau) {
    themeLevels[th] = Object.keys(themeParNiveau[th])
      .sort((a, b) => themeParNiveau[th][b] - themeParNiveau[th][a])
      .map(Number);
  }
  /* ---------- Decoupage des shards (2026-09-06) ----------
     Chaque niveau tenait dans un seul fichier : 256 a 428 Ko gzip a
     telecharger pour afficher UN exercice. C'etait le plus gros poste de
     performance restant.
     Le decoupage n'est pas arbitraire : nextPuzzle() (ui.js) trie le niveau
     par difficulte croissante et le consomme dans cet ordre. En decoupant
     dans le MEME ordre, le joueur n'a besoin que du premier morceau pour
     commencer, et les suivants arrivent quand il progresse. Un morceau de
     500 exercices pese une vingtaine de Ko gzip.
     Ne decoupe pas dans un autre ordre : un decoupage aleatoire obligerait a
     tout charger pour retrouver la progression par difficulte, et on
     reviendrait au probleme d'origine en pire.
     Le fichier level-N.json n'est plus le tableau mais un manifeste ; l'index
     porte desormais [niveau, morceau] pour qu'un lien direct vers un exercice
     ne charge que son morceau. */
  const TAILLE_MORCEAU = 500;
  /* Ce qui part vers le navigateur, sans la source (2026-10-24) : le site
     n'en affiche rien, et elle pesait 36 a 44 % des donnees d'exercices, en
     publiant au passage les pseudos de milliers de joueurs. La source reste
     dans la banque, pour retrouver la partie d'origine. */
  const pourLeSite = lot => lot.map(p => { if (!p.source) return p; const q = Object.assign({}, p); delete q.source; return q; });
  let morceauxEcrits = 0;
  for (const lvl in byLevel) {
    const lot = byLevel[lvl].slice().sort((a, b) => (a.diff || 0) - (b.diff || 0));
    const morceaux = Math.ceil(lot.length / TAILLE_MORCEAU);
    for (let k = 0; k < morceaux; k++) {
      const tranche = lot.slice(k * TAILLE_MORCEAU, (k + 1) * TAILLE_MORCEAU);
      for (const p of tranche) puzzleIndex[p.id] = [+lvl, k];
      fs.writeFileSync(OUT + "/data/level-" + lvl + "-" + k + ".json", JSON.stringify(pourLeSite(tranche)));
      morceauxEcrits++;
    }
    fs.writeFileSync(OUT + "/data/level-" + lvl + ".json",
      JSON.stringify({ total: lot.length, taille: TAILLE_MORCEAU, morceaux: morceaux }));
  }
  console.log("Morceaux d'exercices : " + morceauxEcrits + " fichiers de " + TAILLE_MORCEAU + " exercices");
  /* puzzle-index.json (tout l'index id -> [niveau, morceau] en un fichier)
     est remplace le 2026-10-24 par deux choses plus legeres. Il pesait
     1,7 Mo et serait passe vers 3,6 Mo avec la banque de fin de minage, alors
     que chaque lien direct et chaque exercice du jour le chargeait en entier.

     1. data/ids/<k>.json : l'index par tranche de 10 000 identifiants
        (p0-p9999 dans 0.json...). Un lien direct ne lit que sa tranche. */
  /* puzzle-index.json n'est plus publie (2026-10-25). Il etait garde pour
     la transition : un visiteur deja venu lance encore l'ancienne
     application pendant sa premiere visite apres une mise en ligne, et
     celle d'avant le 25/10 le lisait. Deux publications l'ont servi depuis ;
     ses 3,8 Mo pesaient a chaque publication sans plus servir qu'a un
     visiteur absent depuis. */
  const TRANCHE_IDS = 10000;
  const tranchesIds = {};
  for (const id in puzzleIndex) {
    const k = Math.floor(+id.slice(1) / TRANCHE_IDS);
    (tranchesIds[k] = tranchesIds[k] || {})[id] = puzzleIndex[id];
  }
  fs.mkdirSync(OUT + "/data/ids", { recursive: true });
  for (const k in tranchesIds) fs.writeFileSync(OUT + "/data/ids/" + k + ".json", JSON.stringify(tranchesIds[k]));

  /* 2. data/jour.json : l'exercice du jour, deja tire, jour par jour.
     Formule d'origine inchangee (ids[n % ids.length], n = jour depuis
     1970, ids = l'index dans cet ordre), mais elle dependait du nombre
     d'exercices : chaque fusion changeait les exercices du jour PASSES, et
     le calendrier montrait un autre exercice que celui resolu ce jour-la.
     Les jours ecoules sont donc figes dans exercices-du-jour.json (versionne,
     comme content-dates.json) ; seuls les jours a venir suivent la banque.
     Le fichier publie couvre du premier jour du site a 60 jours apres la
     construction ; au-dela, ui.js reprend la liste en boucle. */
  const REGISTRE_JOURS = path.join(__dirname, "exercices-du-jour.json");
  const ordreIds = Object.keys(puzzleIndex);
  const jourDe = iso => Math.floor(Date.parse(iso + "T00:00:00Z") / 86400000);
  const registre = fs.existsSync(REGISTRE_JOURS) ? JSON.parse(fs.readFileSync(REGISTRE_JOURS, "utf8")) : {};
  const aujourdHui = jourDe(BUILD_DATE);
  const premierJour = Math.min(jourDe((DATES["/"] && DATES["/"].publiee) || BUILD_DATE),
    ...Object.keys(registre).map(Number));
  /* Difficulte croissante dans la semaine (2026-10-26, demande
     d'Alexandre, a la maniere de chess.com) : facile le lundi, de plus en
     plus dur jusqu'au dimanche. La banque est rangee par niveau puis par
     diff, et coupee en sept parts egales : le lundi pioche dans la plus
     facile, le dimanche dans la plus difficile. Dans sa part, le jour n
     prend un exercice designe par un hachage de n, pour ne pas enchainer
     des voisins de la liste. Seuls les jours a venir suivent cette regle :
     les jours ecoules restent figes dans le registre ci-dessus. */
  const parDifficulte = Object.keys(byLevel).sort((a, b) => a - b)
    .flatMap(l => byLevel[l].slice().sort((a, b) => (a.diff || 0) - (b.diff || 0)).map(p => p.id));
  const jourSemaine = n => (n + 3) % 7;          // 1970-01-01 etait un jeudi ; 0 = lundi
  const tirage = n => {
    const w = jourSemaine(n), N = parDifficulte.length;
    const debut = Math.floor(w * N / 7), fin = Math.floor((w + 1) * N / 7);
    return parDifficulte[debut + (Math.imul(n, 2654435761) >>> 0) % (fin - debut)];
  };
  let joursFiges = 0;
  for (let n = premierJour; n <= aujourdHui; n++) {
    /* Un exercice fige qui a quitte la banque (purge) est retire du
       registre : il ne pourrait plus s'afficher. */
    if (registre[n] && !puzzleIndex[registre[n]]) delete registre[n];
    if (!registre[n]) { registre[n] = tirage(n); joursFiges++; }
  }
  fs.writeFileSync(REGISTRE_JOURS, JSON.stringify(registre, null, 1) + "\n");
  const joursPublies = [];
  /* Au-dela de la liste, ui.js (idDuJour) la reprend en boucle : sa longueur
     est arrondie a un multiple de 7 pour que la boucle garde chaque exercice
     sur son jour de la semaine. */
  let dernierJour = aujourdHui + 60;
  while ((dernierJour - premierJour + 1) % 7) dernierJour++;
  for (let n = premierJour; n <= dernierJour; n++) joursPublies.push(registre[n] || tirage(n));
  fs.writeFileSync(OUT + "/data/jour.json", JSON.stringify({ debut: premierJour, ids: joursPublies }));
  console.log("Exercices du jour  : " + joursPublies.length + " jours publies, " + joursFiges + " nouveau(x) jour(s) fige(s)");
  /* Code affiche -> identifiant (2026-10-24). Le badge montre le code
     (#50C7L), mais #puzzle= n'acceptait que l'identifiant interne : un code
     partage ouvrait un autre exercice, sans message. Le code est une
     empreinte de la position, on ne peut pas en deduire l'id : il faut une
     table. Pas dans puzzle-index.json, que tout lien direct charge et qui
     grossit avec la banque : 36 petits fichiers, un par premier caractere
     du code, lus seulement quand un lien porte un code. */
  const parInitiale = {};
  for (const p of puzzles) {
    if (!p.code || !puzzleIndex[p.id]) continue;
    (parInitiale[p.code[0]] = parInitiale[p.code[0]] || {})[p.code] = p.id;
  }
  fs.mkdirSync(OUT + "/data/codes", { recursive: true });
  for (const c in parInitiale) fs.writeFileSync(OUT + "/data/codes/" + c + ".json", JSON.stringify(parInitiale[c]));
  fs.writeFileSync(OUT + "/data/theme-counts.json", JSON.stringify(themeCounts));
  fs.writeFileSync(OUT + "/data/theme-levels.json", JSON.stringify(themeLevels));

  const RUSH_CAP_PER_THEME = 400;
  const byThemeSingleMove = {};
  for (const p of puzzles) {
    if (p.sol.length > 1) continue;
    (byThemeSingleMove[p.theme] = byThemeSingleMove[p.theme] || []).push(p);
  }
  const rushPool = [];
  for (const th in byThemeSingleMove) {
    const list = byThemeSingleMove[th].slice();
    /* Echantillon aleatoire (pas les N premiers) : sinon on ne pioche que
       dans les identifiants les plus bas et le Sprint perd la variete de
       difficulte qu'il est cense avoir au sein d'un theme. Le melange final
       cote client (startRush, ui2.js) s'occupe de l'ordre de jeu ; celui-ci
       ne sert qu'a choisir QUELS exercices entrent dans l'echantillon. */
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    rushPool.push(...list.slice(0, RUSH_CAP_PER_THEME));
  }
  fs.writeFileSync(OUT + "/data/rush-pool.json", JSON.stringify(pourLeSite(rushPool)));
  console.log("Donnees d'exercices  :", Object.keys(byLevel).length, "niveaux,", rushPool.length, "dans le pool Sprint");
})();
const ogJobs = [];
// index.html est écrit plus bas, après injection de la table des ouvertures

/* ---------- 2. Stockfish ---------- */
for (const f of ["stockfish-18-lite-single.js", "stockfish-18-lite-single.wasm"]) {
  fs.copyFileSync(path.join(__dirname, "sf/package/bin", f), OUT + "/engine/" + f);
}
fs.copyFileSync(path.join(__dirname, "sf/package/Copying.txt"), OUT + "/engine/LICENSE-GPLv3.txt");
/* ---------- 2bis. Polices auto-hebergees ---------- */
/* Remplace le chargement depuis fonts.googleapis.com/fonts.gstatic.com le
   2026-09-05 (voir SESSION_HANDOFF, audit confidentialite : la page
   Confidentialite promet "aucun traqueur", Google Fonts recevait pourtant
   IP et user-agent de chaque visiteur a chaque page). Six fichiers, memes
   familles et poids qu'avant (Source Serif 4/600, Archivo/400,500,600,
   JetBrains Mono/500,700), en woff2 sous-jeu latin. Vivent a cote des
   sources dans fonts/, comme sf/package pour Stockfish, et sont recopies
   ici a chaque build puisque OUT est vide au depart. */
fs.mkdirSync(OUT + "/fonts", { recursive: true });
for (const f of [
  "source-serif-4-v14-latin-600.woff2",
  "archivo-v25-latin-400.woff2", "archivo-v25-latin-500.woff2", "archivo-v25-latin-600.woff2",
  "jetbrains-mono-v24-latin-500.woff2", "jetbrains-mono-v24-latin-700.woff2",
  /* Cyrillique (2026-10-25, pour le russe), declare avec unicode-range sous
     les memes noms de famille : le navigateur ne le charge que sur une page
     qui contient du cyrillique. Archivo n'a pas de cyrillique ; Golos Text,
     grotesque concue pour lui, en tient lieu. Polices variables pour Golos
     et JetBrains Mono : un fichier couvre toutes les graisses. */
  "source-serif-4-v15-cyrillic-600.woff2", "golos-text-v7-cyrillic-variable.woff2",
  "jetbrains-mono-v24-cyrillic-variable.woff2"
]) {
  fs.copyFileSync(path.join(__dirname, "fonts", f), OUT + "/fonts/" + f);
}
/* chang64 distribue Stockfish, donc son propre code est sous GPL v3.
   Ces trois fichiers sont ecrits ici parce que le rmSync ci-dessus vide OUT
   a chaque construction : les poser a la main dans le site livre ne tiendrait
   pas. Les originaux vivent a cote des sources, dans licence/. */
fs.copyFileSync(path.join(__dirname, "sf/package/Copying.txt"), OUT + "/LICENSE");
fs.writeFileSync(OUT + "/engine/README.txt",
`Stockfish 18 (lite, single-threaded) : https://stockfishchess.org
Licensed under the GNU General Public License v3, see LICENSE-GPLv3.txt.
Loaded only when the visitor presses "Enable Stockfish".
`);

/* ---------- 3. pages d'ouvertures ---------- */
const OP = JSON.parse(fs.readFileSync(path.join(__dirname, "openings.json"), "utf8"));
/* Chiffres annonces au public, calcules a partir des donnees reelles. Ils
   etaient ecrits en dur a onze endroits et devenaient faux des qu'on
   enrichissait le contenu. */
const NF = String(OP.f.length);
const NL = String(OP.o.split("\n").filter(Boolean).length);
const lines = OP.o.split("\n").map(l => {
  const p = l.split("\t");
  return { moves: p[0], family: OP.f[+p[1]], variation: p[2], eco: p[3] };
});
const families = new Map();
for (const l of lines) {
  if (!families.has(l.family)) families.set(l.family, []);
  families.get(l.family).push(l);
}
const slug = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* Rendu d'une piece du set officiel. Les formes viennent des SVG de l'auteur
   et sont reprises telles quelles : ni geometrie, ni proportions, ni
   epaisseurs de contour ne changent. Les formes marquees "fixe" (l'oeil et
   le naseau du cavalier) n'ont pas de fill dans le source et s'affichent en
   noir : les recolorer les ferait disparaitre dans une piece noire. */
const PIECE_FILL = { w: "#eceae3", b: "#232b28" };
const PIECE_STROKE = "#101413";
function pieceShapes(type, white) {
  const remplissage = white ? PIECE_FILL.w : PIECE_FILL.b;
  return (PIECE_SHAPES[type] || []).map(f => {
    const a = [];
    if (f.t === "circle") a.push(`cx="${f.cx}" cy="${f.cy}" r="${f.r}"`);
    else a.push(`d="${f.d}"`);
    if (!f.fixe) {
      a.push(`fill="${remplissage}"`, `stroke="${f.st || PIECE_STROKE}"`,
             'stroke-linecap="round" stroke-linejoin="round"');
    } else {
      /* Oeil et naseau du cavalier : remplissage a la couleur du contour,
         sans contour propre. */
      a.push(`fill="${PIECE_STROKE}"`);
    }
    if (f.sw) a.push(`stroke-width="${f.sw}"`);
    return `<${f.t} ${a.join(" ")}/>`;
  }).join("");
}

const PIECE_SHAPES = (() => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, "ds/pieces.json"), "utf8"));
  return { p: j.pawn, n: j.knight, b: j.bishop, r: j.rook, q: j.queen, k: j.king };
})();

/* flipped : oriente le diagramme du point de vue du camp au trait plutot que
   toujours depuis les Blancs (2026-09-04, demande d'Alexandre sur les pages
   Motifs) -- range 0 devient la 1ere rangee et les colonnes se lisent h->a
   au lieu de a->h, l'inverse exact d'un retournement d'echiquier normal. */
function boardSvg(fen, size, flipped) {
  const S = size / 8;
  let rows = fen.split(" ")[0].split("/");
  if (flipped) rows = rows.slice().reverse().map(row => row.split("").reverse().join(""));
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Chess position">`;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    svg += `<rect x="${f * S}" y="${r * S}" width="${S}" height="${S}" fill="${(f + r) % 2 ? "#4B6B63" : "#EDE4D2"}"/>`;
  }
  /* Les formes de pieces sont declarees une fois en <defs> et posees par
     <use>. Auparavant chaque piece repetait ses chemins complets, ce qui
     faisait 19 Ko par diagramme, soit 40 Mo pour les seules pages
     d'exercices. On ne declare que les pieces reellement presentes. */
  const need = new Set();
  rows.forEach(row => { for (const ch of row) if (!(ch >= "1" && ch <= "8")) need.add(ch); });
  let defs = "";
  for (const ch of need) {
    const white = ch === ch.toUpperCase();
    defs += `<symbol id="p${white ? "w" : "b"}${ch.toLowerCase()}" viewBox="0 0 45 45">` +
      pieceShapes(ch.toLowerCase(), white) + `</symbol>`;
  }
  svg += `<defs>${defs}</defs>`;
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (ch >= "1" && ch <= "8") { f += +ch; continue; }
      const white = ch === ch.toUpperCase();
      svg += `<use href="#p${white ? "w" : "b"}${ch.toLowerCase()}" x="${(f * S).toFixed(1)}" y="${(r * S).toFixed(1)}" width="${S}" height="${S}"/>`;
      f++;
    }
  });
  return svg + "</svg>";
}

/* ----------------------------------------------------------------------
   Echiquier anime des pages d'ouverture.

   Le diagramme statique montrait la position finale. Il joue desormais la
   ligne principale coup par coup. Contrainte : ces pages sont autonomes, il
   n'y a pas de bundle commun, et un diagramme complet pese 19 Ko a cause des
   chemins SVG des pieces. Dupliquer une position par demi-coup serait
   inacceptable.

   D'ou le procede : les 12 formes (6 pieces x 2 couleurs) sont declarees une
   seule fois dans <defs>, et chaque position n'est plus qu'une poignee de
   <use>. Une position revient alors a environ 1,5 Ko au lieu de 19.

   Sans JavaScript, seule la position finale est visible : le comportement
   actuel est preserve.
   ---------------------------------------------------------------------- */
function fensAlong(moveStr) {
  const g = new Game();
  const out = [{ fen: g.fen(), san: "", n: 0, w: true }];
  const list = moveStr.split(" ").filter(Boolean);
  for (let i = 0; i < list.length; i++) {
    const mv = g.moves().find(m => g.san(m).replace(/[+#]/g, "") === list[i]);
    if (!mv) return null;
    const white = i % 2 === 0;
    g.makeMove(mv);
    out.push({ fen: g.fen(), san: list[i], n: Math.floor(i / 2) + 1, w: white });
  }
  return out;
}

function pieceDefs() {
  let d = "";
  for (const t of ["p", "n", "b", "r", "q", "k"]) {
    for (const white of [true, false]) {
      d += `<symbol id="${white ? "w" : "b"}${t}" viewBox="0 0 45 45">` +
        pieceShapes(t, white) + `</symbol>`;
    }
  }
  return `<defs>${d}</defs>`;
}

function usesFor(fen, S) {
  let out = "";
  fen.split(" ")[0].split("/").forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (ch >= "1" && ch <= "8") { f += +ch; continue; }
      const white = ch === ch.toUpperCase();
      out += `<use href="#${white ? "w" : "b"}${ch.toLowerCase()}" x="${(f * S).toFixed(1)}" y="${(r * S).toFixed(1)}" width="${S}" height="${S}"/>`;
      f++;
    }
  });
  return out;
}

/* Picto play/pause du lecteur d'ouverture : une seule definition SVG (les
   deux formes dedans, chevrons pleins et coins arrondis, dans l'esprit des
   chevrons precedent/suivant) plutot que les glyphes typographiques
   &#9654;/&#10073;&#10073; d'origine, peu nets a cette taille. Les deux
   formes sont posees une fois dans le HTML ; le script client bascule
   juste une classe CSS pour choisir laquelle est visible, au lieu de
   reecrire le balisage a chaque clic -- ce lecteur vit aussi sur les pages
   d'exercices (1000 pages), dont le budget de poids moyen est deja serre :
   dupliquer un SVG verbeux dans le JS de bascule l'avait fait deraper. */
const PLAYPAUSE_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7V5Z"/><path d="M5 5h4v14H5zM15 5h4v14h-4z" style="display:none"/></svg>';

function animBoard(moveStr, size, labels) {
  const steps = fensAlong(moveStr);
  if (!steps || steps.length < 2) return null;
  const S = size / 8;
  let sq = "";
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++)
    sq += `<rect x="${f * S}" y="${r * S}" width="${S}" height="${S}" fill="${(f + r) % 2 ? "#4B6B63" : "#EDE4D2"}"/>`;
  const last = steps.length - 1;
  const groups = steps.map((st, i) =>
    `<g data-ply="${i}"${i === last ? "" : " hidden"}>${usesFor(st.fen, S)}</g>`).join("");
  const plyLabels = steps.map(st =>
    st.san ? st.n + (st.w ? "." : "\u2026") + st.san : labels.start);
  return `<div class="anim" data-plies='${JSON.stringify(plyLabels).replace(/'/g, "&#39;")}'>
  <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(labels.aria)}">
    ${pieceDefs()}<g>${sq}</g>${groups}
  </svg>
  <div class="animctl" hidden>
    <button type="button" data-act="prev" aria-label="${esc(labels.prev)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
    <button type="button" data-act="play" aria-label="${esc(labels.play)}">${PLAYPAUSE_SVG}</button>
    <button type="button" data-act="next" aria-label="${esc(labels.next)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
    <span class="animply"></span>
  </div>
</div>`;
}

function fenAfter(moveStr) {
  const g = new Game();
  for (const san of moveStr.split(" ")) {
    const mv = g.moves().find(m => g.san(m).replace(/[+#]/g, "") === san);
    if (!mv) return null;
    g.makeMove(mv);
  }
  return g.fen();
}
function numbered(moveStr) {
  const mv = moveStr.split(" ");
  let out = "";
  for (let i = 0; i < mv.length; i += 2) {
    out += (i / 2 + 1) + "." + mv[i] + (mv[i + 1] ? " " + mv[i + 1] : "") + " ";
  }
  return out.trim();
}


const FAMILY_FR = {
  "Sicilian Defense":"Défense sicilienne","French Defense":"Défense française","Caro-Kann Defense":"Défense Caro-Kann",
  "Ruy Lopez":"Partie espagnole","Italian Game":"Partie italienne","Queen's Gambit":"Gambit dame",
  "Queen's Gambit Declined":"Gambit dame refusé","Queen's Gambit Accepted":"Gambit dame accepté",
  "King's Indian Defense":"Défense est-indienne","Nimzo-Indian Defense":"Défense nimzo-indienne",
  "Queen's Indian Defense":"Défense ouest-indienne","English Opening":"Partie anglaise",
  "Scandinavian Defense":"Défense scandinave","Pirc Defense":"Défense Pirc","Scotch Game":"Partie écossaise",
  "Vienna Game":"Partie viennoise","London System":"Système de Londres","King's Gambit":"Gambit du roi",
  "Slav Defense":"Défense slave","Grünfeld Defense":"Défense Grünfeld","Alekhine Defense":"Défense Alekhine",
  "Bird Opening":"Ouverture Bird","Dutch Defense":"Défense hollandaise","Réti Opening":"Ouverture Réti",
  "Bishop's Opening":"Ouverture du fou","Philidor Defense":"Défense Philidor","Petrov's Defense":"Défense russe",
  "Four Knights Game":"Partie des quatre cavaliers","Benoni Defense":"Défense Benoni",
  "Modern Defense":"Défense moderne","Catalan Opening":"Ouverture catalane","Center Game":"Partie du centre",
  "Danish Gambit":"Gambit danois","Evans Gambit":"Gambit Evans","Two Knights Defense":"Défense des deux cavaliers",
  "Trompowsky Attack":"Attaque Trompowsky","Budapest Defense":"Gambit de Budapest","Old Indian Defense":"Ancienne défense indienne",
  "Bogo-Indian Defense":"Défense Bogo-indienne","Torre Attack":"Attaque Torre","Colle System":"Système Colle",
  "Ponziani Opening":"Ouverture Ponziani","Giuoco Piano":"Giuoco Piano","Latvian Gambit":"Gambit letton",
  "Nimzowitsch Defense":"Défense Nimzowitsch","Owen Defense":"Défense Owen","Polish Opening":"Ouverture polonaise",
  "Grob Opening":"Ouverture Grob","Hungarian Opening":"Ouverture hongroise","Van't Kruijs Opening":"Ouverture Van't Kruijs",
  "Zukertort Opening":"Ouverture Zukertort","Sicilian Defense: Alapin Variation":"Défense sicilienne, variante Alapin",

  /* Complement : les 94 familles qui restaient sans nom francais.
     Regle appliquee : forme francaise etablie quand elle existe, sinon
     traduction litterale, et conservation du nom propre anglais pour les
     ouvertures fantaisistes sans equivalent (Fried Fox, Bongcloud, Lemming).
     Notation des coups laissee a l'international (Bf5) pour coller aux
     listes de coups affichees sur la meme page. */
  "Amar Opening":"Ouverture Amar",
  "Amsterdam Attack":"Attaque d'Amsterdam",
  "Anderssen's Opening":"Ouverture Anderssen",
  "Barnes Opening":"Ouverture Barnes",
  "Clemenz Opening":"Ouverture Clemenz",
  "Creepy Crawly Formation":"Formation Creepy Crawly",
  "Global Opening":"Ouverture globale",
  "Kádas Opening":"Ouverture Kádas",
  "Lasker Simul Special":"Spéciale de simultanée Lasker",
  "Mieses Opening":"Ouverture Mieses",
  "Polish Opening, with d5":"Ouverture polonaise, avec d5",
  "Saragossa Opening":"Ouverture de Saragosse",
  "Sodium Attack":"Attaque du sodium",
  "Valencia Opening":"Ouverture de Valence",
  "Van Geet Opening":"Ouverture Van Geet",
  "Ware Opening":"Ouverture Ware",
  "Nimzo-Larsen Attack":"Attaque Nimzo-Larsen",
  "Zukertort Defense":"Défense Zukertort",
  "King's Indian Attack":"Attaque est-indienne",
  "King's Indian Attack, with Bf5":"Attaque est-indienne, avec Bf5",
  "King's Indian Attack, with e6":"Attaque est-indienne, avec e6",
  "English Orangutan":"Orang-outan anglais",
  "Australian Defense":"Défense australienne",
  "Borg Defense":"Défense Borg",
  "English Defense":"Défense anglaise",
  "Englund Gambit":"Gambit Englund",
  "Englund Gambit Declined":"Gambit Englund refusé",
  "Horwitz Defense":"Défense Horwitz",
  "Kangaroo Defense":"Défense kangourou",
  "Mikenas Defense":"Défense Mikenas",
  "Montevideo Defense":"Défense Montevideo",
  "Polish Defense":"Défense polonaise",
  "Pterodactyl Defense":"Défense ptérodactyle",
  "Queen's Pawn Game":"Partie du pion dame",
  "Slav Indian":"Slave indienne",
  "Zaire Defense":"Défense zaïroise",
  "Rat Defense":"Défense du rat",
  "Robatsch Defense":"Défense Robatsch",
  "Wade Defense":"Défense Wade",
  "Indian Defense":"Défense indienne",
  "Amazon Attack":"Attaque de l'amazone",
  "Basque Opening":"Ouverture basque",
  "Canard Opening":"Ouverture Canard",
  "Paleface Attack":"Attaque Paleface",
  "Döry Defense":"Défense Döry",
  "Yusupov-Rubinstein System":"Système Yusupov-Rubinstein",
  "Marienbad System":"Système de Marienbad",
  "Pseudo Queen's Indian Defense":"Pseudo-défense ouest-indienne",
  "East Indian Defense":"Défense indienne orientale",
  "Mexican Defense":"Défense mexicaine",
  "Queen's Indian Accelerated":"Ouest-indienne accélérée",
  "Vulture Defense":"Défense du vautour",
  "Benko Gambit":"Gambit Benko",
  "Benko Gambit Accepted":"Gambit Benko accepté",
  "Benko Gambit Declined":"Gambit Benko refusé",
  "Barnes Defense":"Défense Barnes",
  "Carr Defense":"Défense Carr",
  "Duras Gambit":"Gambit Duras",
  "Fried Fox Defense":"Défense Fried Fox",
  "Goldsmith Defense":"Défense Goldsmith",
  "Hippopotamus Defense":"Défense hippopotame",
  "King's Pawn Game":"Partie du pion roi",
  "Lemming Defense":"Défense Lemming",
  "Lion Defense":"Défense du Lion",
  "St. George Defense":"Défense Saint-Georges",
  "Ware Defense":"Défense Ware",
  "Czech Defense":"Défense tchèque",
  "Bongcloud Attack":"Attaque Bongcloud",
  "King's Pawn Opening":"Ouverture du pion roi",
  "Portuguese Opening":"Ouverture portugaise",
  "Center Game Accepted":"Partie du centre acceptée",
  "Danish Gambit Accepted":"Gambit danois accepté",
  "Danish Gambit Declined":"Gambit danois refusé",
  "Vienna Gambit, with Max Lange Defense":"Gambit viennois, avec la défense Max Lange",
  "King's Gambit Declined":"Gambit du roi refusé",
  "King's Gambit Accepted":"Gambit du roi accepté",
  "Elephant Gambit":"Gambit de l'éléphant",
  "Gunderam Defense":"Défense Gunderam",
  "King's Knight Opening":"Ouverture du cavalier roi",
  "Latvian Gambit Accepted":"Gambit letton accepté",
  "Dresden Opening":"Ouverture de Dresde",
  "Irish Gambit":"Gambit irlandais",
  "Three Knights Opening":"Partie des trois cavaliers",
  "Blackmar-Diemer Gambit":"Gambit Blackmar-Diemer",
  "Blackmar-Diemer Gambit Accepted":"Gambit Blackmar-Diemer accepté",
  "Blackmar-Diemer Gambit Declined":"Gambit Blackmar-Diemer refusé",
  "Rapport-Jobava System":"Système Rapport-Jobava",
  "Rapport-Jobava System, with e6":"Système Rapport-Jobava, avec e6",
  "Richter-Veresov Attack":"Attaque Richter-Veresov",
  "Semi-Slav Defense":"Défense semi-slave",
  "Tarrasch Defense":"Défense Tarrasch",
  "Neo-Grünfeld Defense":"Défense néo-Grünfeld",
  "Blumenfeld Countergambit":"Contre-gambit Blumenfeld",
  "Queen's Pawn, Mengarini Attack":"Pion dame, attaque Mengarini"
};
const NOTES_FR = {
  "Sicilian Defense":"Les Noirs répondent à 1.e4 par 1…c5 et refusent la symétrie au centre. C'est la réponse la plus jouée au pion roi à tous les niveaux, et elle mène à des positions déséquilibrées où les deux camps jouent pour la victoire.",
  "French Defense":"1…e6 construit une chaîne de pions solide et invite les Blancs à avancer. Les Noirs acceptent un fou de cases claires passif en échange d'une structure ferme et d'un contre-jeu net à l'aile dame.",
  "Caro-Kann Defense":"1…c6 prépare …d5 sans enfermer le fou de cases claires, ce qui la distingue de la française. Solide et réputée difficile à faire céder.",
  "Ruy Lopez":"1.e4 e5 2.Nf3 Nc6 3.Bb5 met aussitôt la pression sur le cavalier qui défend e5. L'une des plus anciennes ouvertures encore jouées au plus haut niveau, riche en plans positionnels de longue haleine.",
  "Italian Game":"3.Bc4 braque le fou sur la case f7. Elle mène soit à des manœuvres tranquilles dans le Giuoco Pianissimo, soit à un jeu franchement tranchant dans le gambit Evans.",
  "Queen's Gambit":"1.d4 d5 2.c4 offre un pion pour dévier le centre adverse. Ce n'est pas un vrai gambit : le pion se récupère en général, et les Blancs conservent une présence centrale durable.",
  "Queen's Gambit Declined":"Les Noirs tiennent le centre par …e6 plutôt que de prendre en c4. Un choix classique et robuste, qui a décidé de nombreux matchs de championnat du monde.",
  "King's Indian Defense":"Les Noirs laissent les Blancs bâtir un grand centre, puis frappent en retour, généralement par …e5 et une avalanche de pions à l'aile roi. Dynamique et à double tranchant.",
  "Nimzo-Indian Defense":"3…Bb4 cloue le cavalier et dispute le centre avec les pièces plutôt qu'avec les pions. Un favori des joueurs positionnels.",
  "English Opening":"1.c4 contrôle d5 depuis l'aile et transpose souvent vers d'autres ouvertures. Souple et difficile à préparer.",
  "Scandinavian Defense":"1…d5 conteste le centre immédiatement. La dame noire sort tôt, ce qui est moins risqué qu'il n'y paraît.",
  "Pirc Defense":"Les Noirs concèdent le centre et le minent ensuite avec les pièces et des poussées de pions. Un choix moderne, d'inspiration hypermoderne.",
  "Scotch Game":"3.d4 ouvre la position tout de suite, échange au centre et mène à un jeu clair et tactique.",
  "Vienna Game":"2.Nc3 garde toutes les options ouvertes et peut transposer vers plusieurs systèmes, souvent avec une poussée f4 rapide.",
  "London System":"Un dispositif plutôt qu'une ligne : Bf4, e3, Nf3, c3 et Bd3. Facile à apprendre et fiable, ce qui explique sa diffusion rapide.",
  "King's Gambit":"Les Blancs offrent le pion f pour déchirer le centre. Les échecs du dix-neuvième siècle à l'état pur, encore dangereux avec de la préparation.",
  "Slav Defense":"Les Noirs soutiennent d5 par …c6, en gardant ouverte la diagonale du fou de cases claires. Extrêmement solide.",
  "Grünfeld Defense":"Les Noirs offrent aux Blancs un large centre de pions, puis l'attaquent à distance. Tranchante et théoriquement exigeante.",
  "Alekhine Defense":"1…Nf6 invite les Blancs à chasser le cavalier et à trop avancer. Provocatrice par construction.",
  "Bird Opening":"1.f4 prend de l'espace à l'aile roi au prix d'un roi affaibli. Rare mais parfaitement jouable.",
  "Dutch Defense":"1…f5 revendique e4 et vise le jeu à l'aile roi, au prix d'une certaine fragilité du roque.",
  "Réti Opening":"1.Nf3 développe et attend, en gardant toutes les options centrales. Du nom d'un des pères des échecs hypermodernes.",
  "Bishop's Opening":"2.Bc4 vise f7 avant même de sortir les cavaliers, et transpose souvent vers la viennoise ou l'italienne.",
  "Philidor Defense":"2…d6 défend e5 solidement. Passive, mais réellement difficile à casser.",
  "Petrov's Defense":"2…Nf6 contre-attaque au lieu de défendre. Réputée nulle au sommet, elle a un excellent rendement pratique ailleurs.",
  "Four Knights Game":"Les deux camps se développent symétriquement. Tranquille en apparence, plus mordante que sa réputation.",
  "Benoni Defense":"Les Noirs acceptent un déficit d'espace en échange d'une majorité de pions à l'aile dame et de lignes ouvertes.",
  "Modern Defense":"Les Noirs fianchettent et retardent leur engagement au centre, pour contre-attaquer plus tard.",
  "Catalan Opening":"Les Blancs combinent d4 et c4 avec un fianchetto roi. Le fou en g2 peut peser pendant toute la partie."
};

const FAMILY_NOTES = {
  "Sicilian Defense": "Black meets 1.e4 with 1...c5, refusing to mirror White in the centre. It is the most played answer to the king's pawn at every level, and it leads to sharp, unbalanced positions where both sides play for a win.",
  "French Defense": "1...e6 builds a solid pawn chain and invites White to advance. Black accepts a passive light-squared bishop in exchange for a firm structure and clear counterplay on the queenside.",
  "Caro-Kann Defense": "1...c6 prepares ...d5 without shutting in the light-squared bishop, which is the main practical difference from the French. Solid and famously hard to break down.",
  "Ruy Lopez": "1.e4 e5 2.Nf3 Nc6 3.Bb5 puts immediate pressure on the knight defending e5. One of the oldest openings still in top-level use, rich in long-term positional plans.",
  "Italian Game": "3.Bc4 aims the bishop at the f7 square. It leads either to quiet manoeuvring in the Giuoco Pianissimo or to genuinely sharp play in the Evans Gambit.",
  "Queen's Gambit": "1.d4 d5 2.c4 offers a pawn to deflect Black's centre. It is not a true gambit: the pawn is usually recovered, and White gets a lasting central presence.",
  "Queen's Gambit Declined": "Black holds the centre with ...e6 rather than grabbing on c4. A classical, sturdy choice that has decided many world championship matches.",
  "King's Indian Defense": "Black allows a big White centre and then strikes back, usually with ...e5 and a kingside pawn storm. Dynamic and double-edged.",
  "Nimzo-Indian Defense": "3...Bb4 pins the knight and fights for the centre with pieces rather than pawns. A favourite of positional players.",
  "English Opening": "1.c4 controls d5 from the flank and often transposes into other openings. Flexible and hard to prepare against.",
  "Scandinavian Defense": "1...d5 challenges the centre immediately. Black's queen usually comes out early, which is less risky than it looks.",
  "Pirc Defense": "Black concedes the centre and undermines it later with pieces and pawn breaks. A modern, hypermodern-flavoured choice.",
  "Scotch Game": "3.d4 opens the position at once, trading in the centre and leading to clear, tactical play.",
  "Vienna Game": "2.Nc3 keeps options open and can transpose to several other systems, often with an early f4 push.",
  "London System": "A setup rather than a line: Bf4, e3, Nf3, c3 and Bd3. Easy to learn and reliable, which is why it spread so quickly.",
  "King's Gambit": "White offers the f-pawn to rip open the centre. Nineteenth-century chess in its purest form, still dangerous with preparation.",
  "Slav Defense": "Black supports d5 with ...c6, keeping the light-squared bishop's diagonal open. Extremely solid.",
  "Grünfeld Defense": "Black hands White a broad pawn centre and then attacks it from a distance. Sharp and theoretically demanding.",
  "Alekhine Defense": "1...Nf6 invites White to chase the knight and overextend. Provocative by design.",
  "Bird Opening": "1.f4 grabs kingside space at the cost of loosening the king. Rare but perfectly playable.",
  "Dutch Defense": "1...f5 stakes a claim on e4 and aims for kingside play, at the price of some king safety.",
  "Réti Opening": "1.Nf3 develops and waits, keeping every central option available. Named after one of the founders of hypermodern chess.",
  "Bishop's Opening": "2.Bc4 targets f7 before the knights come out, often transposing into the Vienna or Italian.",
  "Philidor Defense": "2...d6 solidly defends e5. Passive but genuinely difficult to crack.",
  "Petrov's Defense": "2...Nf6 counterattacks instead of defending. It has a drawish reputation at the top and a fine practical record everywhere else.",
  "Four Knights Game": "Both sides develop symmetrically. Quiet on the surface, with more bite than its reputation suggests.",
  "Benoni Defense": "Black accepts a space disadvantage in return for a queenside pawn majority and open lines.",
  "Modern Defense": "Black fianchettoes and delays committing in the centre, aiming to counterpunch later.",
  "Catalan Opening": "White combines d4 and c4 with a kingside fianchetto. The bishop on g2 can press for the whole game."
};

/* Camp auquel une ouverture appartient du point de vue d'un repertoire
   ("je joue ca avec les Blancs" / "je reponds ca avec les Noirs") : ni les
   Blancs ni les Noirs ne "possedent" une ouverture au sens strict (les
   deux camps y jouent), mais la tradition echiquéenne classe presque
   toujours une famille d'un cote ou de l'autre. Trois signaux, dans cet
   ordre :
   1. Le nom, mais seulement son segment principal (avant une eventuelle
      virgule) : "Defense"/"Défense" ou "Countergambit" est un signal noir
      quasi infaillible. Restreint au segment principal pour eviter un
      faux-positif comme "Vienna Gambit, with Max Lange Defense", ou
      "Defense" ne decrit que la reponse noire a l'interieur d'un gambit
      blanc.
   2. Heritage du parent pour les sous-lignes ("X Accepted", "X Declined",
      "X, with Y") : leur camp doit suivre celui du gambit ou systeme dont
      elles decoulent, pas leur propre parite, sans quoi "Benko Gambit
      Accepted" et "Benko Gambit Declined" pouvaient afficher des camps
      differents pour la meme idee.
   3. A defaut, la parite du dernier coup de la ligne de reference (impair
      = Blancs, pair = Noirs).
   Verifie une par une plutot que de faire confiance a l'automatique :
   quatre corrections manuelles restent necessaires la ou aucun des trois
   signaux ne suffit (SIDE_OVERRIDES ci-dessous), confirmees par recherche
   pour Amsterdam Attack et Colle System, par les regles theoriques deja
   solides pour Creepy Crawly Formation. Four Knights Game est le seul cas
   ou les deux camps developpent une position vraiment symetrique : "les
   deux" plutot qu'un choix arbitraire. */
const SIDE_OVERRIDES = {
  "Amsterdam Attack": "w",       /* ligne de reference longue (8 demi-coups) : le dernier coup tombe cote noir par coincidence, mais c'est un systeme blanc (ECO A00, rattache a l'English/Van't Kruijs). */
  "Colle System": "w",           /* systeme blanc bien connu (d4/Nf3/e3/Bd3/c3) ; la ligne enregistree va jusqu'a une reponse noire (Qa5). */
  "Creepy Crawly Formation": "w",/* formation lente blanche (h3+a3), analogue au Hippopotame ; la ligne de reference s'arrete sur une reponse noire. */
  "Four Knights Game": "both"    /* developpement rigoureusement symetrique des deux cotes, aucun camp ne "choisit" cette ouverture plus que l'autre. */
};
const familiesRaw = families;   /* Map complete, utilisee pour retrouver un parent independamment de l'ordre de traitement. */
function sideOf(family, moves) {
  if (SIDE_OVERRIDES[family]) return SIDE_OVERRIDES[family];
  const head = family.split(",")[0];
  if (/Defen[cs]e/i.test(head) || /Countergambit/i.test(head)) return "b";
  const parentMatch = family.match(/^(.*?)(?:\s(?:Accepted|Declined)|,\s.*)$/);
  if (parentMatch && parentMatch[1] !== family && familiesRaw.has(parentMatch[1])) {
    /* Recursif plutot que de lire pages[i].side : ce dernier peut ne pas
       encore avoir ete calcule selon l'ordre d'apparition dans les donnees
       brutes (trouve sur Queen's Gambit Declined, traite avant Queen's
       Gambit lui-meme). Une poignee de familles seulement s'embriquent
       ainsi, la recursion ne descend jamais profond. */
    const parentList = familiesRaw.get(parentMatch[1]);
    const parentMain = parentList.slice().sort((a, b) => a.moves.split(" ").length - b.moves.split(" ").length)[0];
    return sideOf(parentMatch[1], parentMain.moves);
  }
  return moves.split(" ").length % 2 === 0 ? "b" : "w";
}

const pages = [];
for (const [family, list] of families) {
  const main = list.slice().sort((a, b) => a.moves.split(" ").length - b.moves.split(" ").length)[0];
  const fen = fenAfter(main.moves);
  if (!fen) continue;
  const ecos = [...new Set(list.map(l => l.eco))].sort();
  const variations = list.slice().sort((a, b) => a.moves.length - b.moves.length).slice(0, 40);
  const nameFr = FAMILY_FR[family] || family;
  /* Nom, adresse et note dans chaque langue (2026-10-25). Anglais et
     francais comme avant ; les autres langues lisent leur table de noms
     (langues/<code>/pages.js, "familles") et de notes. Une famille sans nom
     traduit garde son nom anglais, comme le francais le fait deja pour les
     ouvertures fantaisistes (Bongcloud, Fried Fox...). Le russe garde le
     slug anglais : pas d'URL en cyrillique. */
  const noms = { en: family, fr: nameFr }, notes = { en: FAMILY_NOTES[family] || null, fr: NOTES_FR[family] || null };
  for (const l of LANGUES) {
    if (noms[l.code]) continue;
    noms[l.code] = TRAD.table(l.code, "familles", family) || family;
    notes[l.code] = notes.en ? (TRAD.table(l.code, "notes", family) || null) : null;
  }
  const slugs = {};
  for (const l of LANGUES) slugs[l.code] = l.slugsAnglais ? slug(family) : slug(TRAD.translit(l.code, noms[l.code]));
  pages.push({ family, nameFr, slugEn: slugs.en, slugFr: slugs.fr, noms, notes, slugs,
    main, fen, ecos, variations, count: list.length, side: sideOf(family, main.moves),
    note: notes.en, noteFr: notes.fr });
}
pages.sort((a, b) => b.count - a.count || a.family.localeCompare(b.family));
{
  for (const l of LANGUES) {
    if (l.code === "en") continue;
    const seen = new Set();
    for (const p of pages) { while (seen.has(p.slugs[l.code])) p.slugs[l.code] += "-2"; seen.add(p.slugs[l.code]); }
  }
  for (const p of pages) p.slugFr = p.slugs.fr;
}

/* Noms de variantes traduits (2026-10-26). Le francais passait par une
   substitution mot a mot (VAR_FR) qui donnait "Czerniak Attaque" ; les
   autres langues gardaient l'anglais. Chaque langue a maintenant un
   dictionnaire des morceaux de nom (langues/<code>/variantes.js) : un nom
   Lichess "Grob Gambit, Basman Gambit" se traduit morceau par morceau.
   Un morceau absent garde l'anglais et est releve (check_noms_variantes). */
const VARIANTES = {}, variantesManquantes = new Set();
function nomVariante(lang, name) {
  if (lang === "en") return name;
  if (!(lang in VARIANTES)) {
    try { VARIANTES[lang] = require(path.join(__dirname, "langues", lang, "variantes.js")); }
    catch (e) { if (e.code !== "MODULE_NOT_FOUND") throw e; VARIANTES[lang] = {}; }
  }
  return name.split(", ").map(p => {
    const t = VARIANTES[lang][p];
    if (t == null) { variantesManquantes.add(lang + " : " + p); return p; }
    return t;
  }).join(", ");
}
const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* Description meta : Google tronque au-dela d'environ 160 caracteres, sans
   prevenir ni chercher une coupure propre. Plusieurs pages (ouvertures,
   exercices, regles, glossaire, finales, pieges) construisaient la leur en
   prenant les 280 ou 300 premiers caracteres d'un texte plus long ecrit pour
   se lire en entier : la coupure tombait donc en plein milieu d'une phrase,
   parfois d'un mot. Cette fonction coupe a la fin de la derniere phrase
   entiere qui tient dans la limite ; si aucune ne tient (une seule longue
   phrase), elle coupe au dernier espace et ajoute une ellipse plutot que de
   trancher un mot en deux. */
function metaDesc(raw, max) {
  max = max || 160;
  const text = String(raw).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const fenetre = text.slice(0, max);
  const phrase = fenetre.match(/^.*[.!?](?=\s|$)/);
  if (phrase && phrase[0].length >= max * 0.5) return phrase[0].trim();
  let coupe = text.slice(0, max - 1);
  const esp = coupe.lastIndexOf(" ");
  if (esp > max * 0.5) coupe = coupe.slice(0, esp);
  return coupe.trim() + "…";
}

/* Chevrons precedent/suivant du lecteur d'ouvertures (.animctl svg) passes
   en SVG a trait epais, pour s'harmoniser avec le bandeau de coups de
   l'onglet Jouer : les caracteres typographiques <>etaient trop fins a
   cette taille. Commentaire volontairement HORS du template CSS ci-dessous :
   ce bloc est injecte tel quel (sans minification) dans chaque page
   statique, un commentaire a l'interieur se retrouve donc duplique sur des
   milliers de pages et alourdit la moyenne mesuree par les tests de poids. */
/* Entete des pages statiques (commentaire ici, HORS du template CSS, meme
   raison que ci-dessus) : le filet du bas etait trace avec --rule (gris
   fonce) et se voyait comme un contour net sur le fond clair, autour du bloc
   logo/langue/menu. Purement decoratif (aucun autre element n'en dependait),
   il est retire plutot que repeint de la couleur du fond : le repeindre
   aurait coute des octets (var(--rule) -> var(--ink), meme longueur) pour un
   resultat identique, invisible dans les deux cas. padding-top passe de 14px
   a 10px pour s'aligner sur le rythme vertical de l'application (le logo
   demarrait quelques pixels plus bas ici, sur mobile, qu'en fond sombre).
   Le box-shadow ajoute, pour 4 bytes nets sur l'entete entiere une fois le
   filet retire (poids serre sur ~2000 pages dupliquees, marge mesuree
   d'environ 38 bytes/page sur check_pages_exercices.js), un fondu flou de la
   couleur du fond sous l'entete : il adoucit la coupure quand le contenu
   defile sous la zone collante, au lieu d'un bord net. */
const CSS = `*{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#EDE4D2;--slate:#F5F0E5;--raise:#E3DAC7;--chalk:#15201C;--sage:#5A6862;
--bone:#EDE4D2;--board:#4B6B63;--brass:#7E5409;--jade:#1E7A4C;--brick:#A3382A;
--rule:rgba(21,32,28,.14);--r:8px}
body{background:var(--ink);color:var(--chalk);
font-family:'Archivo',ui-sans-serif,system-ui,sans-serif;font-size:16px;line-height:1.55;padding:20px 16px 60px}
.wrap{max-width:880px;margin:0 auto}
a{color:var(--brass)}
header{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:22px;
padding-bottom:14px;
position:sticky;top:0;z-index:30;background-color:var(--ink);padding-top:10px;
box-shadow:0 14px 14px -6px var(--ink)}
/* Meme logo que l'application : memes tailles, memes proportions, meme
   position relative des elements. Seules les couleurs changent, pour un fond
   clair : l'elephant et le 64 en laiton, "chang" et la baseline en gris
   fonce. */
/* Ecart logo / nom identique a l'application : 15 % de la taille du logo. */
.brand{display:flex;align-items:baseline;gap:calc(clamp(30px,6vw,40px) * .15);text-decoration:none;color:var(--chalk)}
.brandmark{width:clamp(30px,6vw,40px);height:calc(clamp(30px,6vw,40px) * 54 / 64);display:block;flex:none;color:var(--brass)}
.brand .names{display:flex;flex-direction:column;gap:2px}
.brand .bname{font-family:'Source Serif 4',Georgia,serif;font-weight:600;font-size:clamp(26px,5vw,32px);letter-spacing:-.015em;line-height:1.1;color:var(--chalk)}
.brand .sixtyfour{color:var(--brass);font-family:'JetBrains Mono',monospace;font-weight:600;font-size:.86em;letter-spacing:-.03em}
.brand .tagline{font-size:11px;letter-spacing:.06em;color:var(--sage);white-space:nowrap}
@media(max-width:620px){.brand .tagline{display:none}}
.brand span{color:var(--brass);font-family:'JetBrains Mono',monospace;font-weight:700;font-size:.78em}
/* Le menu depassait la largeur d'un telephone : quatre entrees plus le
   selecteur de langue reclament environ 458 px pour 362 disponibles. Les
   marges a gauche empechaient un retour a la ligne propre. On passe en
   disposition souple, qui replie naturellement au lieu de deborder. */
/* Cette regle generique s'appliquait aussi a .sitenav et son flex-wrap:wrap
   annulait le defilement horizontal : la rangee passait a la ligne au lieu de
   defiler. Elle est desormais limitee aux nav qui ne sont pas le menu
   principal. */
header nav:not(.sitenav){display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin:0;min-width:0}
nav a{font-size:13px;text-decoration:none;color:var(--sage)}
nav a:hover{color:var(--brass)}
h1{font-family:'Source Serif 4',Georgia,serif;font-size:clamp(34px,5vw,44px);font-weight:600;letter-spacing:-.015em;line-height:1.1;margin-bottom:10px}
h2{font-family:'Source Serif 4',Georgia,serif;font-size:22px;font-weight:600;line-height:1.22;margin:32px 0 12px}
p{margin-bottom:12px;max-width:66ch}
.lede{font-size:17px;color:var(--sage);margin-bottom:24px}
.cols{display:grid;grid-template-columns:300px 1fr;gap:24px;align-items:start}
@media(max-width:700px){.cols{grid-template-columns:1fr}}
.diagram{background:var(--slate);border:1px solid var(--rule);border-radius:12px;padding:10px}
.anim svg{display:block;width:100%;height:auto;border-radius:6px}
/* l'attribut hidden sur un <g> SVG depend de la feuille du navigateur :
   on l'impose explicitement plutot que d'en dependre */
.anim g[data-ply][hidden]{display:none}
/* Le filtrage masque les tuiles avec l'attribut hidden. Or la regle
   [hidden]{display:none} vient de la feuille par defaut du navigateur : elle
   est plus faible que n'importe quel selecteur de classe, et .tile{display:
   block} l'emportait. Les tuiles restaient donc visibles alors que l'attribut
   etait bien pose, et la recherche semblait ne rien faire.
   Meme piege que sur les groupes SVG de l'echiquier anime. */
[hidden],.tile[hidden],[data-theme][hidden],.toc[hidden]{display:none!important}
.animctl{display:flex;align-items:center;gap:6px;margin-top:8px}
/* Ces commandes avaient herite des jetons du theme sombre de l'application,
   posees telles quelles sur les pages d'ouvertures, qui sont claires. Les
   symboles etaient beiges sur blanc casse, soit un contraste de 1,11:1 pour
   un minimum recommande de 3:1 : quasiment invisibles. On reprend le vert
   ardoise des cases sombres de l'echiquier, juste au-dessus, ce qui rattache
   visuellement les commandes au diagramme qu'elles pilotent. */
.animctl button{background:var(--slate);color:var(--board);border:1px solid var(--board);border-radius:6px;
  width:30px;height:28px;cursor:pointer;padding:0;display:grid;place-items:center}
.animctl button:hover{background:var(--board);color:var(--slate)}
.animctl button:disabled{opacity:.38;cursor:default}
.animctl button:disabled:hover{background:var(--slate);color:var(--board)}
.animctl button:focus-visible{outline:2px solid var(--brass);outline-offset:2px}
.animply{font-size:12px;color:var(--sage);font-variant-numeric:tabular-nums}
.diagram svg{width:100%;height:auto;display:block;border-radius:2px}
.moves{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:14px;letter-spacing:.02em;background:var(--slate);
border:1px solid var(--rule);border-radius:var(--r);padding:12px 14px;margin-bottom:14px}
/* Separateur visuel entre les exemples d'une page categorie (Clouage,
   Enfilade...) : sans ca, les 2-3 exemples s'enchainaient sans aucune
   rupture visuelle, seul le h2 "Exemple N" les distinguait a l'oeil, et
   maigrement (meme taille que les autres h2 de la page). Trou de style
   preexistant, pas introduit par le passage aux pages categories -- l'ancien
   index filtrable groupait deja ses puzzles par theme dans des sections de
   cette meme classe, jamais stylee non plus. */
.theme-bloc{padding-top:20px;margin-top:20px;border-top:1px solid var(--rule)}
.theme-bloc:first-of-type{padding-top:0;margin-top:0;border-top:none}
.theme-bloc h2{margin-top:0}
.eco{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:500;color:var(--brass);
border:1px solid var(--rule);border-radius:var(--r);padding:3px 9px;margin:0 6px 6px 0}
/* Meme forme que .eco (theme, difficulte) mais en gris discret plutot qu'en
   laiton : c'est une reference technique pour signaler un exercice, pas une
   information de contenu au meme titre que les deux autres pastilles. */
.excode{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:500;color:var(--sage);
border:1px solid var(--rule);border-radius:var(--r);padding:3px 9px;margin:0 6px 6px 0;user-select:all}
table{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:14px}
/* Les lignes nommees d'une ouverture (colonne Coups) peuvent depasser un
   ecran de telephone sans jamais faire de retour a la ligne : sans ce
   conteneur, c'est toute la page qui defilait horizontalement au lieu du
   seul tableau. Meme logique que .sitenav : le debordement est contenu et
   devient un defilement local. */
.tablewrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:14px}
.tablewrap table{margin-bottom:0;width:auto;min-width:100%}
th{text-align:left;font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--sage);padding:8px;border-bottom:1px solid var(--rule)}
td{padding:8px;border-bottom:1px solid var(--rule);vertical-align:top}
td.mono{font-family:'JetBrains Mono',monospace;font-weight:500;color:var(--chalk);white-space:nowrap}
.cta{display:inline-block;background:var(--brass);color:#FFF;font-weight:600;font-size:14px;text-decoration:none;
padding:11px 20px;border-radius:var(--r);margin:6px 8px 6px 0}
.cta.ghost{background:none;color:var(--chalk);border:1px solid var(--rule)}
.toc{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 28px;padding:14px;background:var(--slate);
border:1px solid var(--rule);border-radius:12px}
.toc a{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;text-decoration:none;
color:var(--chalk);background:var(--ink);border:1px solid var(--rule);border-radius:999px;padding:6px 12px}
.toc a:hover{border-color:var(--brass);color:var(--brass)}
.toc a b{font-family:'JetBrains Mono',monospace;font-weight:500;color:var(--sage);font-size:12px}
html{
  /* L'entete est desormais ancree en haut (position:sticky). Sans ce
     decalage, un lien d'ancre (#un-titre) amenait sa cible pile a y=0,
     qui se retrouvait cachee sous l'entete plutot que sous les yeux.
     scroll-padding-top couvre toute ancre de la page, pas seulement les
     h2 : l'ancienne regle (scroll-margin-top:16px sur h2 seul) datait
     d'avant l'entete ancree et etait de toute facon bien trop courte.
     100px etait egalement une estimation, elle aussi trop courte : mesure
     sur plusieurs largeurs (320 a 1024px), l'entete des pages claires
     atteint jusqu'a 143px (nav sur deux lignes a partir de 900px), marge
     de securite comprise ici. */
  scroll-padding-top:150px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.tile{background:var(--slate);border:1px solid var(--rule);border-radius:12px;padding:14px;text-decoration:none;display:block}
.tile:hover{border-color:var(--brass)}
.tile b{display:block;color:var(--chalk);font-size:15px;margin-bottom:3px}
.tile span{color:var(--sage);font-size:13px;font-family:'JetBrains Mono',monospace;font-weight:500}
/* Memes mesures typographiques que le pied de page de l'application
   (template.html) : 12.5px, letter-spacing .03em, interligne 1.7. Le trait
   de separation reste, lui : sur une page de contenu il marque la fin du
   texte, la ou l'application est deja decoupee en panneaux. */
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--rule);color:var(--sage);
  font-size:12.5px;letter-spacing:.03em;line-height:1.7;text-align:center}
.filtre{margin-bottom:18px}
.filtre input{width:100%;max-width:520px;box-sizing:border-box;font:inherit;font-size:15px;
  padding:11px 14px;border:1px solid var(--rule);border-radius:10px;
  background:var(--slate);color:var(--chalk)}
.filtre input:focus{outline:2px solid var(--brass);outline-offset:1px;border-color:var(--brass)}
.filtre-etat{margin:8px 0 0;font-size:13px;color:var(--sage);min-height:1.2em}
/* Meme motif que .sitenav (le menu principal) : une pastille arrondie sur
   fond legerement contraste, l'option choisie surlignee en laiton. Reprise
   plutot qu'invention pour rester coherent avec le reste du site. */
.cotefiltre{display:flex;gap:3px;background-color:var(--slate);padding:4px;
  border-radius:999px;border:1px solid var(--rule);width:fit-content;margin-top:10px}
.cotefiltre button{font:inherit;font-size:13px;font-weight:500;color:var(--sage);
  background:none;border:0;cursor:pointer;padding:7px 14px;border-radius:999px;
  white-space:nowrap;transition:background .18s,color .18s}
.cotefiltre button:hover{color:var(--chalk)}
.cotefiltre button[aria-pressed="true"]{background-color:var(--brass);color:#FDF8EC;font-weight:600}
/* Menu principal : meme forme que les onglets de l'application, une pastille
   arrondie posee sur un fond legerement contraste, la section courante
   surlignee en laiton. Seules les couleurs changent, prises dans les jetons
   du theme clair. Sur ecran etroit la rangee defile plutot que d'elargir la
   page. */
.sitenav{display:flex;gap:3px;background-color:var(--slate);padding:4px;
  border-radius:999px;border:1px solid var(--rule);
  overflow-x:auto;max-width:100%;min-width:0;flex:1 1 100%;
  scrollbar-width:none;-webkit-overflow-scrolling:touch}
.sitenav::-webkit-scrollbar{display:none}
/* Indice de defilement, allege pour ~1900 pages. */
.sitenav::before,.sitenav::after{content:"";position:sticky;width:22px;
  flex:none;pointer-events:none;z-index:2;opacity:0;display:flex;align-items:center;
  font-size:13px;color:var(--sage)}
.sitenav::before{left:-4px;order:-1;margin-right:-22px;border-radius:999px 0 0 999px;
  background:linear-gradient(to right,var(--slate) 38%,transparent);content:"‹";padding-left:6px}
.sitenav::after{right:-4px;order:999;margin-left:-22px;border-radius:0 999px 999px 0;
  background:linear-gradient(to left,var(--slate) 38%,transparent);content:"›";
  justify-content:flex-end;padding-right:6px}
.sitenav.sl::before,.sitenav.sr::after{opacity:1}
.sitenav a,.sitenav span{font-size:13px;font-weight:500;color:var(--sage);
  text-decoration:none;padding:8px 15px;border-radius:999px;white-space:nowrap;
  transition:background .18s,color .18s}
.sitenav a:hover{color:var(--chalk)}
.sitenav [aria-current="page"]{background-color:var(--brass);color:#FDF8EC;font-weight:600}
@media(max-width:520px){.sitenav a,.sitenav span{padding:8px 11px;font-size:12.5px}}
/* Bascule de langue : meme pastille que dans l'application, avec le meme
   rayon et le meme fond. Ici ce sont deux liens, chaque langue etant une page
   distincte. */
.langsw{background-color:var(--ink);padding:3px;position:relative;
  border-radius:8px;border:1px solid var(--rule);flex:none}
/* Reprise exacte de .langswitch summary dans l'application : JetBrains Mono
   en 600, corps 11.5px, marges 7px 10px. Ce n'est pas la police du corps de
   texte, c'est celle du "64" de la marque : le selecteur de langue appartient
   a la meme famille visuelle. Depuis le 2026-10-25, la langue courante est
   affichee seule et la liste des six langues s'ouvre dessous. */
.langsw summary{list-style:none;cursor:pointer;font-family:'JetBrains Mono',monospace;
  font-size:11.5px;font-weight:600;padding:7px 10px;border-radius:6px;
  background-color:var(--raise);color:var(--chalk);white-space:nowrap}
.langsw summary::-webkit-details-marker{display:none}
.langsw summary::after{content:"";display:inline-block;width:5px;height:5px;margin:0 0 2px 7px;
  border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg)}
.langsw[open] summary::after{transform:rotate(-135deg);margin-bottom:-1px}
.langmenu{position:absolute;right:0;top:calc(100% + 6px);z-index:40;display:flex;flex-direction:column;
  min-width:150px;padding:4px;background-color:var(--ink);border:1px solid var(--rule);border-radius:8px}
.langmenu a{font-size:13px;color:var(--sage);text-decoration:none;padding:9px 12px;border-radius:6px;white-space:nowrap}
.langmenu a:hover{color:var(--chalk)}
.langmenu a[aria-current="true"]{background-color:var(--raise);color:var(--chalk);font-weight:600}

/* Meme construction que le pied de page de l'application : des liens en
   ligne separes par des points medians, et non une rangee flex a
   gouttieres -- deux mises en page differentes pour le meme pied de page
   se voyaient au passage d'une page a l'autre. */
.footnav{margin-bottom:14px}
/* Le dernier lien se retrouvait seul sur sa ligne sur telephone. Les deux
   derniers passent a la ligne ensemble ou pas du tout. */
.foot-pair{white-space:nowrap}
/* Aligne l'aspect sur les liens de pied de page de l'application a fond
   noir (.linkbtn, template.html : souligne, poids normal, 11.5px), la
   couleur restant seule adaptee au fond clair (chalk au lieu de sage,
   plus lisible ici). Avant (2026-09-04) : sans soulignement, graisse 500
   et taille heritee du pied de page (13px) -- un aspect plus "bouton" que
   les liens sobres et discrets du reste du site. */
/* inline-block + padding vertical le 2026-09-05 : mesures au navigateur
   reel, ces liens faisaient 18px de haut, sous le plancher de 24px de
   WCAG 2.2 (2.5.8, Target Size Minimum). Meme correctif que .linkbtn cote
   application, pour que les deux pieds de page aient la meme cible. */
.footnav a{color:var(--chalk);text-decoration:underline;font-weight:400;font-size:11.5px;display:inline-block;padding:6px 2px}
.footnav a:hover{color:var(--brass)}
.footnav [aria-current="page"]{color:var(--sage);font-weight:600}
/* Ces deux paragraphes heritaient du max-width:66ch pose sur tous les p pour
   la lisibilite du corps de texte. Dans un pied de page centre, ca donne une
   boite d'environ 473px calee a GAUCHE d'un conteneur de 880px : le texte
   etait bien centre, mais dans sa boite, donc decale d'environ 200px vers la
   gauche par rapport a la rangee de liens juste au-dessus, qui occupe elle
   toute la largeur. Visible uniquement sur ecran large, la ou 66ch est plus
   etroit que le conteneur. On garde la mesure de lecture et on centre la
   boite, plutot que de supprimer le max-width. */
.footnote,.pagedate{margin-left:auto;margin-right:auto}
.footnote{margin-top:0;margin-bottom:0}`;

/* La feuille de l'application passe par minifyCss() depuis longtemps (voir
   l'appel sur le <style> de template.html plus haut), mais pas celle des
   pages de contenu : elles embarquaient 6,5 Ko de commentaires chacune, soit
   38 % de leur feuille et environ 2,9 Mo sur les 466 pages. Les commentaires
   restent evidemment dans la source ci-dessus, ou ils servent ; ils ne
   servent a personne dans le fichier livre. Calcule une seule fois et non
   dans shell(), qui est appele une fois par page. */
const CSS_MIN = minifyCss(CSS);

/* La marque a l'elephant n'apparaissait que dans l'application : les pages
   d'ouvertures et de contenu n'affichaient que le texte "chang64". Rien ne
   justifiait cette difference, l'entete est le meme reperage d'un bout a
   l'autre du site. Fonction declaree (donc hoistee) pour ne pas dependre de
   l'ordre des constantes plus bas dans le fichier. */
/* Nouvelle identite (2026-10-24, design/identite) : un elephant geometrique de
   profil, a la place de la tete de face qui se lisait comme un champignon a
   petite taille. ds/signe.svg est le signe principal (24 px et plus) ; son
   oeil est un trou, d'ou fill-rule evenodd, a conserver sous peine d'un
   elephant sans oeil. */
function signe(fichier) {
  const svg = fs.readFileSync(path.join(__dirname, "ds", fichier), "utf8");
  return [...svg.matchAll(/<path\b([^>]*)\/?>/g)].map(m => {
    const d = (m[1].match(/\sd="([^"]+)"/) || [])[1];
    const regle = (m[1].match(/fill-rule="([^"]+)"/) || [])[1];
    return { d, regle };
  }).filter(p => p.d);
}
/* entete=true : cadre arrete aux pieds de l'elephant (viewBox 0 0 64 54,
   rien n'est dessine plus bas). Dans l'entete, le bas de la boite tombe
   ainsi sur les pieds, et l'alignement sur la ligne de base (.brand en
   align-items:baseline) pose les pieds exactement sur le bas du "c" de
   chang (demande d'Alexandre, 2026-10-25 ; ecart mesure : 12,9 px avant,
   0 apres). Le filigrane de "L'elephant sur l'echiquier" garde le cadre
   carre. */
const _marks = {};
function brandMark(entete) {
  const cle = entete ? "entete" : "carre";
  if (!_marks[cle]) {
    /* Pas de width/height en attribut : c'est le CSS qui donne la taille,
       adaptative comme dans l'application (clamp 30 a 40 px). Des attributs
       fixes entreraient en conflit avec elle. */
    _marks[cle] = `<svg class="brandmark" viewBox="0 0 64 ${entete ? 54 : 64}" aria-hidden="true" focusable="false">` +
      signe("signe.svg").map(p => `<path fill="currentColor"${p.regle ? ` fill-rule="${p.regle}"` : ""} d="${p.d}"/>`).join("") +
      `</svg>`;
  }
  return _marks[cle];
}

/* L'application posait la marque par JavaScript au demarrage
   ($("brandmark").innerHTML=markSVG(...) dans ui.js), contrairement aux
   pages claires ou brandMark() est deja posee ici, a la construction. Un
   visiteur qui affiche la page sans executer ce script (moteur d'indexation,
   extension qui bloque le JavaScript, previsualisation qui ne l'execute pas)
   voyait donc un entete sans logo, le temps que le script tourne ou pour de
   bon si ce script ne tourne jamais. Les deux emplacements (l'entete et le
   filigrane de la section "The elephant on the board") sont desormais poses
   ici, comme sur les pages claires : le logo fait partie du HTML, il n'a
   plus besoin du script pour exister. */
app = app.split("/*__BRANDMARK_ENTETE__*/").join(brandMark(true)).split("/*__BRANDMARK__*/").join(brandMark());

/* Liens vers toutes les sections, dans la langue de la page. La page en cours
   est signalee et non cliquable : un lien vers soi-meme n'apporte rien.
   "Motifs"/"Patterns" plutot que "Exercices"/"Puzzles" (2026-09-04, remarque
   d'Alexandre) : la page elle-meme n'a jamais ete une liste d'exercices a
   resoudre mais 10 motifs tactiques avec 3 exemples expliques chacun -- son
   propre chapeau d'intro dit deja "Dix motifs tactiques", seul ce libelle de
   nav restait sur l'ancien mot. Chemin (/fr/exercices/, /puzzles/) inchange :
   seul le texte affiche change, pas l'URL. */
/* Suffixes de gabarit du fil d'Ariane (2026-09-07).

   La feuille du fil reprenait le <title> entier, donc "Moulin · definition et
   exemple" ou "Partie viennoise : coups, variantes et codes ECO". Utile dans
   un onglet de navigateur, verbeux dans un resultat de recherche, ou le fil
   s'affiche sous le lien.

   Seuls les suffixes MECANIQUES sont listes ici, ceux que les generateurs
   collent a l'identique sur chaque page d'une section : lexique, ouvertures,
   motifs, dans les deux langues, soit 394 pages. Apprendre, Pieges et
   Finales en sont absents volontairement : leurs titres sont rediges, et ce
   qui suit les deux-points y porte du sens ("Le mat de Legal : le sacrifice
   de dame"). Couper la ferait perdre de l'information au lieu d'en retirer.

   La liste vit ici et pas dans les generateurs, pour la meme raison que le
   fil est deduit du canonical : une source unique. Faire remonter un nom
   court en parametre depuis chacun des huit generateurs marcherait aussi,
   mais une page ajoutee plus tard oublierait de le passer. */
const SUFFIXES_FIL = [
  " · définition et exemple", " · chess term explained",
  " : coups, variantes et codes ECO", " : moves, variations and ECO codes",
  " : 3 exemples expliqués", ": 3 worked examples"
];
/* Memes suffixes dans les autres langues (2026-10-25), traduits par les cles
   que content.js et la boucle des ouvertures emploient pour les titres. */
for (const l of LANGUES) {
  if (l.code === "en" || l.code === "fr") continue;
  SUFFIXES_FIL.push(" · " + tr(l.code, "chess term explained"), ": " + tr(l.code, "moves, variations and ECO codes"),
    ": " + tr(l.code, "3 worked examples"));
}
/* Le prefixe de section n'est jamais ajoute ici : le fil porte deja la
   section a son deuxieme niveau, et une feuille "Lexique · Moulin"
   afficherait "chang64 > Lexique > Lexique · Moulin". */
function nomCourtFil(title) {
  const n = title.replace(/\s*\|\s*chang64\s*$/, "");
  for (const s of SUFFIXES_FIL) if (n.endsWith(s) && n.length > s.length) return n.slice(0, -s.length).trim();
  return n;
}
const SECTIONS = {
  en: [
    ["/openings/", "Openings"], ["/puzzles/", "Patterns"], ["/learn/", "Rules"],
    ["/endgames/", "Endgames"], ["/traps/", "Opening traps"], ["/glossary/", "Glossary"]
  ],
  fr: [
    ["/fr/ouvertures/", "Ouvertures"], ["/fr/exercices/", "Motifs"], ["/fr/apprendre/", "Apprendre"],
    ["/fr/finales/", "Finales"], ["/fr/pieges/", "Pièges d'ouverture"], ["/fr/lexique/", "Lexique"]
  ]
};
/* Autres langues (2026-10-25) : memes six rubriques, dossiers du registre,
   libelles anglais traduits. */
for (const l of LANGUES) {
  if (SECTIONS[l.code]) continue;
  const RUB = ["openings", "puzzles", "learn", "endgames", "traps", "glossary"];
  SECTIONS[l.code] = SECTIONS.en.map(([, nom], i) => ["/" + l.dirs[RUB[i]] + "/", tr(l.code, nom)]);
}
/* Retire accents, ponctuation et majuscules : la recherche doit trouver
   "Defense sicilienne" quand on tape "defense sicilien", et "1.e4 c5" quand
   on tape "e4c5". */
/* Lettres de toute ecriture (2026-10-25) : [^a-z0-9] effacait le cyrillique,
   et la recherche des pages russes n'aurait rien trouve. NFD ramene aussi
   \u0451 a \u0435 et \u0439 a \u0438, comme e accent a e. */
function sansAccent(t) {
  return String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function sectionLinks(lang, canonical) {
  const ici = String(canonical || "").replace(SITE, "");
  /* La comparaison etait exacte : une page de detail comme
     /fr/finales/dame-contre-roi.html ne correspondait pas a /fr/finales/, et
     le menu ne signalait plus dans quelle section on se trouvait. On teste
     donc l'appartenance a la section, pas l'egalite.
     Le lien reste cliquable sur une page de detail : il ramene a l'index, ce
     qui est utile. Seul l'index lui-meme devient un simple texte, puisqu'il
     pointerait sur la page courante. */
  return (SECTIONS[lang] || SECTIONS.en).map(([href, nom]) => {
    if (ici === href) return `<span aria-current="page" id="cn">${nom}</span>`;
    if (ici.startsWith(href)) return `<a href="${href}" aria-current="page" id="cn">${nom}</a>`;
    return `<a href="${href}">${nom}</a>`;
  }).join("");
}

/* shell() genere l'enveloppe HTML commune a toutes les pages statiques (menu,
   pied de page, script partage). Note sur le script de recentrage du menu
   (recherche "sn=document.querySelector" plus bas) : le menu (.sitenav) est
   une rangee qui defile horizontalement sur ecran etroit. Sans ce script,
   chaque page repartait avec le menu scrolle tout a gauche -- cliquer sur
   une entree loin a droite (ex. Lexique) apres avoir scrolle le menu, puis
   arriver sur la nouvelle page, masquait justement la section dans laquelle
   on venait d'entrer : le menu s'etait remis a zero, un nouveau document
   HTML ne conserve pas la position de defilement d'un element interne comme
   le navigateur le fait pour la page entiere. block:"nearest" dans l'appel
   evite tout defilement vertical de la page elle-meme. */
/* Liens hreflang d'une page (2026-10-25) : une entree par langue ou la page
   existe, dans l'ordre du registre, et x-default sur l'anglais. Avant, chaque
   generateur ecrivait ses trois lignes en/fr/x-default a la main. */
function lignesHreflang(urls) {
  if (!urls) return "";
  const out = LANGUES.filter(l => urls[l.code]).map(l =>
    `<link rel="alternate" hreflang="${l.hreflang}" href="${urls[l.code]}">`);
  if (urls.en) out.push(`<link rel="alternate" hreflang="x-default" href="${urls.en}">`);
  return out.join("\n");
}
/* Selecteur de langue des pages statiques (2026-10-25) : meme forme que dans
   l'application, une liste repliee derriere le code de la langue courante.
   Liens ordinaires, qui marchent sans JavaScript. */
function selecteurLangue(lang, urls) {
  const ici = PAR_CODE[lang];
  return `<details class="langsw"><summary aria-label="${esc(T(lang, "Language: {name}", "Langue : {name}", { name: ici.nom }))}">${lang.toUpperCase()}</summary><div class="langmenu">` +
    LANGUES.filter(l => urls[l.code]).map(l =>
      `<a href="${String(urls[l.code]).replace(SITE, "")}" hreflang="${l.hreflang}" lang="${l.html}" rel="alternate"${l.code === lang ? ' aria-current="true"' : ""}>${l.nom}</a>`).join("") +
    `</div></details>`;
}
/* langUrls : adresse de la page dans chaque langue ou elle existe,
   {en: ..., fr: ..., es: ...}. Sert aux hreflang et au selecteur de langue.
   null pour une page sans equivalent (404, profils). */
function shell(title, desc, canonical, body, jsonld, lang, alts, langUrls, ogImage, noindex) {
  const dates = datesDe(canonical.replace(SITE, ""), body);
  /* Une page non indexable n'est pas du contenu : 404 et le profil ne portent
     donc pas de date. On teste aussi alts, parce que plusieurs appelants
     passent leur <meta robots> par ce parametre plutot que par le dixieme
     (voir l'appel de 404.html) : se fier au seul parametre noindex laissait
     une date sur des pages qui n'en veulent pas. */
  const horsContenu = !!noindex || /noindex/.test(String(alts || ""));
  lang = lang || "en";
  const d = libellesOuvertures(lang);
  const accueil = PAR_CODE[lang].accueil;
  return `<!DOCTYPE html>
<html lang="${PAR_CODE[lang].html}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
${noindex ? '<meta name="robots" content="noindex,follow">' : ""}
<!-- Icones de la nouvelle identite (2026-10-24) : le .ico pour les anciens
     navigateurs et Safari, le SVG (signe allege) pour les autres, et une
     image pleine pour l'ecran d'accueil iOS. -->
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
${lignesHreflang(langUrls)}
${alts || ""}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="${PAR_CODE[lang].og}">
<meta property="og:image" content="${ogImage || SITE + "/og/home.png"}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<!-- Auto-heberge depuis le 2026-09-05 (voir audit : la promesse "aucun
     traqueur" de la page Confidentialite etait fausse tant que Google
     Fonts recevait IP et user-agent de chaque visiteur). Le raisonnement
     display=optional ci-dessous reste identique et s'applique de la meme
     facon a des fichiers locaux : optional laisse un tres court delai
     (largement tenu ici, les fichiers etant sur la meme origine que la
     page) puis, s'il n'est pas tenu, garde la police de secours pour toute
     la vue sans jamais la remplacer plus tard.
     display=swap montrait d'abord la police de secours puis la remplacait
     par Archivo/Source Serif 4 des qu'elle arrivait : sur ces pages, chaque
     navigation recharge le document (ce ne sont pas des pages d'application
     a etat persistant), donc ce remplacement rejouait a chaque clic. Sur le
     menu du haut, une rangee de courtes pastilles cote a cote, l'ecart de
     largeur entre les deux polices (mesure : jusqu'a 40px sur les six
     entrees) se voyait comme un reflow du menu, comme si la page repartait
     de zero.
     Chemins relatifs a la racine ("/fonts/...", pas "${'${SITE}'}/fonts/...") :
     ces pages vivent a des profondeurs variees (/openings/*.html,
     /fr/lexique/*.html...), donc un chemin relatif au DOCUMENT casserait
     selon la profondeur, alors qu'un chemin relatif a la RACINE fonctionne
     partout tel quel. Fige sur le domaine de production aurait aussi rate
     tout apercu servi ailleurs (previsualisation de branche Cloudflare
     Pages, environnement local) -- constate en testant ce correctif : les
     six polices tombaient en erreur reseau des qu'on sortait de
     production.
     Regroupe dans le MEME <style> que ${'${CSS}'} depuis ce correctif : une
     balise separee decalait ce que plusieurs tests/check_*.js lisent comme
     "le premier bloc <style>", casse constatee sur check_pied_de_page.js
     (11 echecs, regles .sitenav/.tabs cherchees dans le mauvais bloc). -->
<style>
.skiplink{position:absolute;left:-9999px;top:0;z-index:100;background-color:var(--brass);color:#1b1508;font-weight:600;font-size:13.5px;padding:10px 16px;border-radius:0 0 8px 0;text-decoration:none}
.skiplink:focus{left:0}
.pagedate{margin:6px 0 0;font-size:12px;color:var(--sage)}
@font-face{font-family:'Source Serif 4';font-style:normal;font-weight:600;font-display:optional;src:url(/fonts/source-serif-4-v14-latin-600.woff2) format('woff2')}
@font-face{font-family:'Archivo';font-style:normal;font-weight:400;font-display:optional;src:url(/fonts/archivo-v25-latin-400.woff2) format('woff2')}
@font-face{font-family:'Archivo';font-style:normal;font-weight:500;font-display:optional;src:url(/fonts/archivo-v25-latin-500.woff2) format('woff2')}
@font-face{font-family:'Archivo';font-style:normal;font-weight:600;font-display:optional;src:url(/fonts/archivo-v25-latin-600.woff2) format('woff2')}
@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:500;font-display:optional;src:url(/fonts/jetbrains-mono-v24-latin-500.woff2) format('woff2')}
@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:700;font-display:optional;src:url(/fonts/jetbrains-mono-v24-latin-700.woff2) format('woff2')}
@font-face{font-family:'Source Serif 4';font-style:normal;font-weight:600;font-display:optional;src:url(/fonts/source-serif-4-v15-cyrillic-600.woff2) format('woff2');unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}
@font-face{font-family:'Archivo';font-style:normal;font-weight:400 600;font-display:optional;src:url(/fonts/golos-text-v7-cyrillic-variable.woff2) format('woff2');unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}
@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:500 700;font-display:optional;src:url(/fonts/jetbrains-mono-v24-cyrillic-variable.woff2) format('woff2');unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}
${CSS_MIN}</style>
${(() => {
  /* Complement automatique du JSON-LD (2026-09-05). Les Article emis par
     les huit generateurs ne portaient que headline, description et
     inLanguage : ni auteur, ni editeur, ni date, ni page d'appartenance.
     Schema.org les attend, et une fiche incomplete est moins susceptible
     d'etre reprise comme source. Complete ici plutot que dans chaque
     generateur : une seule source, et rien n'ecrase ce qu'un generateur a
     deja pose.
     dateModified vaut la date de construction, ce qui est exact : ces
     pages sont regenerees a chaque build. datePublished n'est PAS
     invente : faute de date de premiere publication fiable par page, mieux
     vaut ne rien declarer que declarer faux. */
  if (!jsonld) return "";
  const d = { ...jsonld };
  /* Elargi le 2026-09-06 : le complement ne visait qu'Article et
     LearningResource, alors que 100 pages emettent d'autres types de
     CreativeWork (CollectionPage pour les index de rubrique, DefinedTerm pour
     le lexique...). Elles portaient une date visible dans le pied mais rien
     de structure, et un moteur voyait donc deux versions de la meme page.
     ItemList et BreadcrumbList restent dehors : ce ne sont pas des
     CreativeWork, datePublished n'y a pas de sens. */
  const DATABLES = ["Article", "LearningResource", "CollectionPage", "WebPage",
    "DefinedTerm", "DefinedTermSet", "HowTo", "FAQPage", "CreativeWork", "Game"];
  if (DATABLES.includes(d["@type"])) {
    d.author = d.author || { "@type": "Person", name: PUBLISHER.name };
    /* author/publisher/image n'ont de sens que pour un vrai article ; sur une
       page de rubrique on se limite aux dates et au rattachement. */
    d.publisher = d.publisher || { "@type": "Organization", name: "chang64", url: SITE };
    d.datePublished = d.datePublished || dates.publiee;
    d.dateModified = d.dateModified || dates.modifiee;
    d.mainEntityOfPage = d.mainEntityOfPage || { "@type": "WebPage", "@id": canonical };
    d.image = d.image || (ogImage || SITE + "/og/home.png");
    d.isPartOf = d.isPartOf || { "@type": "WebSite", name: "chang64", url: SITE };
  }
  return '<script type="application/ld+json">' + JSON.stringify(d) + "</script>";
})()}
${(() => {
  /* Fil d'Ariane structure (2026-09-05). Le site n'en emettait aucun : les
     pages profondes se presentaient a Google comme des documents isoles,
     sans rattachement a leur rubrique, et les resultats de recherche
     affichaient l'URL brute au lieu du chemin lisible.
     Le fil est deduit du canonical plutot que passe en parametre par
     chacun des huit generateurs de pages : une seule source, et une page
     ajoutee plus tard l'obtient sans qu'on y pense. Les pages d'index de
     rubrique s'arretent a deux niveaux (accueil puis rubrique), les pages
     de detail en ont trois. */
  const items = [{ name: "chang64", item: SITE + "/" }];
  const path = canonical.replace(SITE, "");
  const sec = (SECTIONS[lang] || SECTIONS.en).find(s => path.startsWith(s[0]));
  if (sec) items.push({ name: sec[1], item: SITE + sec[0] });
  const isIndex = sec && (path === sec[0] || path === sec[0] + "index.html");
  if (!isIndex) items.push({ name: nomCourtFil(title), item: canonical });
  if (items.length < 2) return "";
  return '<script type="application/ld+json">' + JSON.stringify({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.item }))
  }) + "</script>";
})()}
</head>
<body>
${/* Lien d'evitement ajoute le 2026-09-06. L'application en avait un, ces
     466 pages non : au clavier il fallait retraverser les seize liens de
     l'entete a CHAQUE page avant d'atteindre le texte (critere WCAG 2.4.1).
     Le commentaire vit ici et pas dans le gabarit : tout ce qui est ecrit
     entre les accents graves part dans les 466 pages livrees, un premier
     essai avait alourdi le site de 400 Ko pour trois phrases.
     La cible est le <main id="contenu"> pose plus bas, qui sert aussi de
     repere de region principale. Aucune regle CSS ne vise main dans ces
     pages, l'ajout ne change donc rien a la mise en page. */""}<a class="skiplink" href="#contenu">${T(lang, "Skip to main content", "Aller au contenu")}</a>
<div class="wrap">
<header>
  <a class="brand" href="${accueil}">${brandMark(true)}<span class="names"><span class="bname">chang<span class="sixtyfour">64</span></span><span class="tagline">${T(lang, "The elephant on 64 squares", "L'éléphant sur 64 cases")}</span></span></a>
  <!-- Un seul menu, les memes six sections qu'ailleurs. "Jouer" a ete retire :
       le logo ramene deja a l'accueil, l'entree faisait doublon et prenait la
       place du contenu. Sur ecran etroit la rangee defile horizontalement,
       comme les onglets de l'application. -->
  ${langUrls ? selecteurLangue(lang, langUrls) : ""}
  <nav class="sitenav">${sectionLinks(lang, canonical)}</nav>
</header>
<main id="contenu">
${body}
</main>
<footer>
  <!-- Plus de menu ici : les six sections sont desormais dans l'entete, le
       repeter en bas etait un doublon. Le pied de page garde son role
       classique, les liens legaux. -->
  <nav class="footnav" aria-label="${T(lang, "Legal information", "Informations légales")}">
    <a href="${accueil}">${T(lang, "Home", "Accueil")}</a> &middot;
    <a href="${accueil}#legal">${T(lang, "Legal notice", "Mentions légales")}</a> &middot;
    <a href="${accueil}#privacy">${T(lang, "Privacy", "Confidentialité")}</a> &middot;
    <span class="foot-pair"><a href="${accueil}#prefs">${T(lang, "Preferences", "Préférences")}</a> &middot;
    <a href="${accueil}#accessibilite">${T(lang, "Accessibility", "Accessibilité")}</a></span>
  </nav>
  <p class="footnote">${d.foot}</p>
  ${horsContenu ? "" : `<p class="pagedate">${datesPied(lang, dates)}</p>`}
</footer>
</div>
<script>
/* L'application (accessible via le logo ou "Accueil") partage le meme
   stockage que ces pages, sous la cle "chang64:lang" (voir window.storage et
   loadLang dans i18n.js), mais ne le lisait jamais depuis ici : choisir
   l'anglais sur une page claire, puis revenir a l'accueil, retombait sur la
   langue du navigateur au lieu de respecter ce choix. On l'ecrit donc a
   chaque visite d'une page claire, dans le meme format qu'attend loadLang
   (chaine "fr" ou "en", pas de JSON). */
try{localStorage.setItem("chang64:lang","${lang}");var c=document.getElementById("cn"),sn=c.parentElement;c.scrollIntoView({block:"nearest"});var u=function(){sn.classList.toggle("sl",sn.scrollLeft>2);sn.classList.toggle("sr",sn.scrollLeft<sn.scrollWidth-sn.clientWidth-2);};u();sn.onscroll=u;}catch(e){}
${!/id="grille"/.test(body) ? "" : `
/* Filtrage de la liste des ouvertures.
   Le champ n'est revele qu'ici : sans JavaScript, il reste masque et la page
   se comporte comme avant. On compare sur une cle sans accents ni
   ponctuation, ce qui permet de trouver "Defense sicilienne" en tapant
   "defense sicilien", et "1.e4 c5" en tapant "e4c5". */
(function(){
  var bloc=document.getElementById("filtreBloc");
  var champ=document.getElementById("filtre");
  var grille=document.getElementById("grille");
  if(!bloc||!champ||!grille)return;
  var tuiles=[].slice.call(grille.querySelectorAll("[data-cle]"));
  if(tuiles.length<20)return;          /* inutile sur une liste courte */
  bloc.classList.remove("hide");
  var etat=document.getElementById("filtreEtat");
  /* Messages dans la langue de la page, poses par le build sur #filtreEtat
     (2026-10-25) : le script reste le meme d'une langue a l'autre. */
  var aucun=etat.getAttribute("data-aucun")||"No match.",sur=etat.getAttribute("data-sur")||"{a} of {b}";
  var total=tuiles.length;
  /* Bascule Blancs/Noirs/Les deux : absente des pages plus courtes que le
     seuil ci-dessus tout comme le champ de recherche, puisqu'elle partage
     le meme bloc masque par defaut. "both" (une seule ouverture reellement
     symetrique) reste visible quel que soit le camp choisi : elle n'est
     ni plus blanche ni plus noire que l'autre. */
  var coteFiltre=document.getElementById("coteFiltre");
  var coteActif="all";
  if(coteFiltre){
    var boutons=[].slice.call(coteFiltre.querySelectorAll("button"));
    for(var c=0;c<boutons.length;c++){
      boutons[c].addEventListener("click",function(){
        coteActif=this.getAttribute("data-side");
        for(var j=0;j<boutons.length;j++)boutons[j].setAttribute("aria-pressed",boutons[j]===this?"true":"false");
        filtrer();
      });
    }
  }

  function normalise(t){
    return String(t).normalize?String(t).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu," ").trim()
      :String(t).toLowerCase();
  }
  function correspondCote(tuile){
    if(coteActif==="all")return true;
    var cote=tuile.getAttribute("data-side");
    return cote===coteActif||cote==="both";
  }
  function filtrer(){
    var q=normalise(champ.value);
    if(!q&&coteActif==="all"){
      for(var i=0;i<total;i++)tuiles[i].hidden=false;
      var tousBlocs=grille.querySelectorAll("[data-theme]");
      for(var b=0;b<tousBlocs.length;b++)tousBlocs[b].hidden=false;
      var toc0=grille.querySelector(".toc");
      if(toc0)toc0.hidden=false;
      etat.textContent="";
      return;
    }
    /* Chaque mot tape doit se retrouver, dans n'importe quel ordre :
       "sicilienne e4" fonctionne comme "e4 sicilienne". */
    var mots=q.split(" ").filter(Boolean);
    var vus=0;
    for(var i=0;i<total;i++){
      var cle=tuiles[i].getAttribute("data-cle")||"";
      var ok=correspondCote(tuiles[i]);
      for(var k=0;k<mots.length;k++){if(cle.indexOf(mots[k])<0){ok=false;break;}}
      tuiles[i].hidden=!ok;
      if(ok)vus++;
    }
    /* Les exercices sont groupes par theme : un titre de section dont plus
       aucune tuile ne correspond doit disparaitre aussi, sinon la page se
       remplit d'intitules suivis de vide. Le sommaire des themes est masque
       pendant une recherche, il ne mene plus nulle part. */
    var blocs=grille.querySelectorAll("[data-theme]");
    for(var b=0;b<blocs.length;b++){
      var reste=blocs[b].querySelectorAll("[data-cle]:not([hidden])").length;
      blocs[b].hidden=(reste===0);
    }
    var toc=grille.querySelector(".toc");
    if(toc)toc.hidden=true;
    etat.textContent = vus===0 ? aucun : sur.replace("{a}",vus).replace("{b}",total);
  }
  champ.addEventListener("input",filtrer);
  /* Echap vide le champ, geste attendu sur un champ de recherche. */
  champ.addEventListener("keydown",function(e){
    if(e.key==="Escape"&&champ.value){champ.value="";filtrer();}
  });
})();
`}
/* Le bloc ci-dessus n'est emis que sur les pages d'index : il pesait 1,7 Ko
   repete sur 1 929 pages, soit 3 Mo, alors que deux pages seulement s'en
   servent. */

/* Pilote l'echiquier anime des pages d'ouverture.
   Sans ce script, la position finale reste affichee et les commandes sont
   masquees : la page fonctionne exactement comme avant. */
(function(){
  var box=document.querySelector(".anim"); if(!box)return;
  var plies=[]; try{plies=JSON.parse(box.getAttribute("data-plies"))||[];}catch(e){}
  var groups=box.querySelectorAll("svg > g[data-ply]");
  if(groups.length<2)return;
  var ctl=box.querySelector(".animctl"), lab=box.querySelector(".animply");
  var btn={}; if(ctl){ctl.hidden=false;
    ctl.querySelectorAll("button").forEach(function(b){btn[b.dataset.act]=b;});}
  var i=groups.length-1, timer=null;
  function show(n){
    i=Math.max(0,Math.min(groups.length-1,n));
    /* .hidden est une propriete de HTMLElement, pas de SVGElement : sur un
       <g> il faut passer par l'attribut, sinon rien ne se passe. */
    for(var k=0;k<groups.length;k++){
      if(k===i)groups[k].removeAttribute("hidden");
      else groups[k].setAttribute("hidden","");
    }
    if(lab)lab.textContent=plies[i]||"";
    if(btn.prev)btn.prev.disabled=(i===0);
    if(btn.next)btn.next.disabled=(i===groups.length-1);
  }
  var pp=btn.play&&btn.play.querySelectorAll("path");
  function tog(k){pp[k].style.display="";pp[1-k].style.display="none";}
  function stop(){if(timer){clearInterval(timer);timer=null;}
    if(pp)tog(0);}
  function playFrom(n){
    stop(); show(n);
    if(pp)tog(1);
    timer=setInterval(function(){
      if(i>=groups.length-1){stop();return;}
      show(i+1);
    },850);
  }
  if(btn.prev)btn.prev.onclick=function(){stop();show(i-1);};
  if(btn.next)btn.next.onclick=function(){stop();show(i+1);};
  if(btn.play)btn.play.onclick=function(){
    if(timer)stop(); else playFrom(i>=groups.length-1?0:i);
  };
  /* Une personne qui a demande moins d'animation garde la position finale
     et pilote elle-meme. Les autres voient la ligne se jouer une fois. */
  var calm=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(calm){show(groups.length-1);return;}
  show(0);
  var started=false;
  function go(){if(started)return;started=true;playFrom(0);}
  if("IntersectionObserver" in window){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){if(e.isIntersecting){go();io.disconnect();}});
    },{threshold:.35});
    io.observe(box);
  }else go();
})();
</script>
</body>
</html>`;
}

const L = {
  en: { dir: "openings", index: "/openings/", label: "English",
        nav: ["Play", "Openings", "Patterns"], all: "All openings", play: "Play this opening",
        namedLines: "Named lines", variation: "Variation", movesHead: "Moves",
        posAfter: "Position after", showing: (a, b) => `Showing the ${a} shortest of ${b} known lines.`,
        listIntro: (n, f) => `This page lists ${n} named line${n > 1 ? "s" : ""} in the ${f}, taken from the open Lichess opening database. You can play any of them against the built-in engine and have the game reviewed move by move afterwards.`,
        idxTitle: "Chess openings: every named line with moves and ECO codes | chang64",
        idxH1: "Chess openings",
        idxLede: (a, b) => `Every named opening family, with its moves and variations. Open one to see the position, replay the line move by move, or play it yourself against the engine. ${a} families, ${b} named lines.`,
        idxDesc: (a, b) => `A complete index of ${a} chess opening families and ${b} named lines, each with its moves, ECO code and a playable board.`,
        foot: "chang64 : free chess, no account required. Opening data from the lichess-org/chess-openings project." },
  fr: { dir: "fr/ouvertures", index: "/fr/ouvertures/", label: "Français",
        nav: ["Jouer", "Ouvertures", "Motifs"], all: "Toutes les ouvertures", play: "Jouer cette ouverture",
        namedLines: "Variantes répertoriées", variation: "Variante", movesHead: "Coups",
        posAfter: "Position après", showing: (a, b) => `Les ${a} lignes les plus courtes sur ${b} répertoriées.`,
        listIntro: (n, f) => `Cette page recense ${n} ligne${n > 1 ? "s" : ""} répertoriée${n > 1 ? "s" : ""} dans la ${f}, d'après la base d'ouvertures libre de Lichess. Tu peux jouer chacune d'elles contre le moteur intégré, puis faire analyser la partie coup par coup.`,
        idxTitle: "Ouvertures d'échecs : variantes, coups et codes ECO | chang64",
        idxH1: "Ouvertures d'échecs",
        idxLede: (a, b) => `Toutes les familles d'ouvertures, avec leurs coups et leurs variantes. Ouvre-en une pour voir la position, rejouer la ligne coup par coup, ou l'affronter toi-même contre le moteur. ${a} familles, ${b} lignes répertoriées.`,
        idxDesc: (a, b) => `Index complet de ${a} familles d'ouvertures d'échecs et ${b} variantes répertoriées, chacune avec ses coups, son code ECO et un échiquier jouable.`,
        foot: "chang64 : échecs gratuits, sans compte. Données d'ouvertures issues du projet lichess-org/chess-openings." }
};
/* Libelles des pages d'ouvertures dans les autres langues (2026-10-25),
   traduits depuis les gabarits anglais ci-dessous. Les pluriels passent par
   les formes plurielles de la traduction (variable n), pas par un "s" colle
   comme en anglais. Le nom de la famille est cite apres "l'ouverture" pour
   ne pas avoir a l'accorder ("la Defensa siciliana", "el Gambito de dama").
   Attention : ces gabarits sont des cles. Changer le texte anglais de L.en
   sans les changer ici laisserait les autres langues sur l'ancien sens. */
function libellesOuvertures(lang) {
  if (L[lang]) return L[lang];
  const x = (en, v) => tr(lang, en, v);
  const dir = PAR_CODE[lang].dirs.openings;
  return (L[lang] = {
    dir, index: "/" + dir + "/", label: PAR_CODE[lang].nom,
    nav: [x("Play"), x("Openings"), x("Patterns")], all: x("All openings"), play: x("Play this opening"),
    namedLines: x("Named lines"), variation: x("Variation"), movesHead: x("Moves"),
    posAfter: x("Position after"),
    showing: (a, b) => x("Showing the {a} shortest of {b} known lines.", { a, b }),
    listIntro: (n, f) => x("This page lists {n} named lines of the opening {f}, taken from the open Lichess opening database. You can play any of them against the built-in engine and have the game reviewed move by move afterwards.", { n, f }),
    idxTitle: x("Chess openings: every named line with moves and ECO codes") + " | chang64",
    idxH1: x("Chess openings"),
    idxLede: (a, b) => x("Every named opening family, with its moves and variations. Open one to see the position, replay the line move by move, or play it yourself against the engine. {a} families, {b} named lines.", { a, b }),
    idxDesc: (a, b) => x("A complete index of {a} chess opening families and {b} named lines, each with its moves, ECO code and a playable board.", { a, b }),
    foot: x("chang64 : free chess, no account required. Opening data from the lichess-org/chess-openings project.")
  });
}
function urlFor(lang, p) { return `${SITE}/${libellesOuvertures(lang).dir}/${p.slugs[lang]}`; }
/* Adresses d'une famille dans chaque langue, pour hreflang et selecteur. */
function urlsOuverture(p) { return Object.fromEntries(CODES.map(c => [c, urlFor(c, p)])); }
for (const l of LANGUES) fs.mkdirSync(OUT + "/" + l.dirs.openings, { recursive: true });

/* Une passe par langue du registre (2026-10-25). L'anglais et le francais
   gardent leurs phrases redigees ; les autres langues passent par tr(), avec
   des gabarits qui citent la famille apres "l'ouverture" plutot qu'avec un
   article a accorder. Les noms de variantes passent par nomVariante() (un
   dictionnaire par langue, voir plus haut). */
for (const { code: lang } of LANGUES) {
  const d = libellesOuvertures(lang);
  const accueil = PAR_CODE[lang].accueil;
  const autre = lang !== "en" && lang !== "fr";
  for (const p of pages) {
    const name = p.noms[lang];
    const note = p.notes[lang];
    const moves = numbered(p.main.moves);
    const ecoRange = p.ecos[0] + (p.ecos.length > 1 ? "–" + p.ecos[p.ecos.length - 1] : "");
    const fallback = lang === "fr"
      ? `La ${name} commence par ${moves} (ECO ${ecoRange}). Cette page recense ses ${p.count} variante${p.count > 1 ? "s" : ""} répertoriée${p.count > 1 ? "s" : ""} avec leurs coups et leurs codes ECO, sur un échiquier depuis lequel tu peux jouer contre le moteur.`
      : lang === "en"
      ? `The ${name} begins ${moves} (ECO ${ecoRange}). This page lists its ${p.count} named variation${p.count > 1 ? "s" : ""} with their moves and ECO codes, on a board you can play from against the engine.`
      : tr(lang, "The opening {name} begins {moves} (ECO {eco}). This page lists its {n} named variations with their moves and ECO codes, on a board you can play from against the engine.", { name, moves, eco: ecoRange, n: p.count });
    const desc = metaDesc(note ? note + " " + (lang === "fr" ? `La ${name} couvre les codes ECO ${ecoRange}.` : lang === "en" ? `The ${name} covers ECO ${ecoRange}.`
      : tr(lang, "The opening {name} covers ECO {eco}.", { name, eco: ecoRange })) : fallback);
    const alsoKnown = (lang !== "en" && name !== p.family)
      ? `<p style="font-size:13px;color:var(--sage)">${T(lang, "Commonly used English name: {name}.", "Nom anglais couramment utilisé : {name}.", { name: `<strong>${esc(p.family)}</strong>` })}</p>` : "";
    const rows = p.variations.map(v =>
      `<tr><td>${esc(v.variation ? nomVariante(lang, v.variation) : T(lang, "Main line", "Ligne principale"))}</td><td class="mono">${esc(numbered(v.moves))}</td><td class="mono">${v.eco}</td></tr>`).join("");
    /* desc sert la balise meta et le referencement : elle contient la note
       d'ouverture, laquelle est aussi affichee dans le corps. La reprendre
       en chapo faisait relire la meme phrase deux fois de suite. Le chapo
       annonce donc ce que contient la page, la note reste a sa place. */
    const chapo = lang === "fr"
      ? `${moves} · ${p.ecos.join(", ")} · ${p.count} ligne${p.count > 1 ? "s" : ""} répertoriée${p.count > 1 ? "s" : ""}, avec un échiquier pour les jouer.`
      : lang === "en"
      ? `${moves} · ${p.ecos.join(", ")} · ${p.count} named line${p.count > 1 ? "s" : ""}, with a board to play them from.`
      : `${moves} · ${p.ecos.join(", ")} · ` + tr(lang, "{n} named lines, with a board to play them from.", { n: p.count });
    const body = `
<h1>${esc(name)}</h1>
<p class="lede">${esc(chapo)}</p>
<div class="cols">
  <div class="diagram">${animBoard(p.main.moves, 300, {
      start: T(lang, "Starting position", "Position de départ"),
      aria:  T(lang, "Chessboard: {name} after {moves}", "Échiquier : {name} après {moves}", { name, moves }),
      prev:  T(lang, "Previous move", "Coup précédent"),
      play:  T(lang, "Replay the line", "Rejouer la ligne"),
      next:  T(lang, "Next move", "Coup suivant")
    }) || boardSvg(p.fen, 300)}
    <p style="font-size:12px;color:var(--sage);margin:8px 0 0">${d.posAfter} ${esc(moves)}</p>
    <p style="font-size:12px;color:var(--sage);margin:4px 0 0">${T(lang,
      "The arrows above replay this line, move by move. To try it yourself, use the button on the right.",
      "Les flèches ci-dessus rejouent cette ligne, coup par coup. Pour l'affronter toi-même, utilise le bouton à droite.")}</p>
  </div>
  <div>
    <div class="moves">${esc(moves)}</div>
    <div>${p.ecos.map(e => `<span class="eco">${e}</span>`).join("")}</div>
    ${alsoKnown}
    ${note ? `<p>${esc(note)}</p>` : ""}
    <p>${esc(d.listIntro(p.count, name))}</p>
    <a class="cta" href="${accueil}#line=${encodeURIComponent(p.main.moves.split(" ").join("_"))}">${d.play}</a>
    <a class="cta ghost" href="${d.index}">${d.all}</a>
  </div>
</div>
<h2>${d.namedLines}</h2>
<div class="tablewrap"><table><thead><tr><th>${d.variation}</th><th>${d.movesHead}</th><th>ECO</th></tr></thead><tbody>${rows}</tbody></table></div>
${p.count > p.variations.length ? `<p>${esc(d.showing(p.variations.length, p.count))}</p>` : ""}
`;
    const jsonld = { "@context": "https://schema.org", "@type": "Article",
      headline: lang === "fr" ? name + " : ouverture d'échecs" : lang === "en" ? name + " chess opening" : tr(lang, "{name} chess opening", { name }),
      description: desc, inLanguage: PAR_CODE[lang].html,
      about: { "@type": "Thing", name: name },
      isPartOf: { "@type": "WebSite", name: "chang64", url: SITE } };
    let title = lang === "fr"
      ? `${name} : coups, variantes et codes ECO | chang64`
      : lang === "en" ? `${name} : moves, variations and ECO codes | chang64`
      : `${name}: ${tr(lang, "moves, variations and ECO codes")} | chang64`;
    /* Pas d'espace avant les deux-points hors du francais (le titre anglais
       la garde, tel qu'il est depuis le debut). */
    if (title.length > 70) title = `${name}${lang === "fr" || lang === "en" ? " :" : ":"} ${T(lang, "moves and variations", "coups et variantes")} | chang64`;
    if (title.length > 70) title = `${name} | chang64`;
    const ogName = "op-" + p.slugEn;
    if (lang === "en") queueOg(ogName, p.family, moves + "  ·  ECO " + ecoRange, p.fen);
    /* noindex,follow sur les familles sans note redigee (2026-09-05).
       Mesure avant decision : similarite Jaccard de 0,67 a 0,88 entre ces
       pages, 150 a 240 mots dont l'essentiel est du texte de gabarit
       identique d'une page a l'autre. Elles sont utiles a qui navigue
       (l'echiquier rejoue la ligne, le tableau ECO est juste), mais elles
       n'apportent rien qu'un moteur puisse vouloir citer, et 112 pages
       quasi jumelles diluent les 29 qui, elles, disent quelque chose.
       "follow" est delibere : les liens sortants continuent de circuler.
       Le pilotage se fait tout seul par FAMILY_NOTES/NOTES_FR : ecrire une
       note retire sa page du noindex et la remet au sitemap au build
       suivant, sans toucher a ce fichier. */
    const sansNote = !note;
    fs.writeFileSync(`${OUT}/${d.dir}/${p.slugs[lang]}.html`,
      shell(title, desc, urlFor(lang, p), body, jsonld, lang, "", urlsOuverture(p), `${SITE}/og/${ogName}.png`, sansNote));
  }
  const idxBody = `
<h1>${d.idxH1}</h1>
<p class="lede">${esc(d.idxLede(pages.length, lines.length))}</p>
<!-- Champ de recherche. Masque par defaut et revele par le script : sans
     JavaScript la page reste exactement ce qu'elle etait, et personne ne se
     retrouve devant un champ inerte. Cent quarante et une entrees sur une
     seule page ne se parcourent pas a l'oeil. -->
<div class="filtre hide" id="filtreBloc">
  <input type="search" id="filtre" autocomplete="off"
         placeholder="${esc(T(lang, "Search: name, moves or ECO code", "Chercher : nom, coups ou code ECO"))}"
         aria-label="${esc(T(lang, "Filter openings", "Filtrer les ouvertures"))}"
         aria-controls="grille">
  <!-- Une ouverture implique toujours les deux camps : le classement
       Blancs/Noirs suit la tradition (qui choisit cette ouverture pour son
       repertoire), pas une propriete stricte de la position. Absent par
       defaut ("Toutes"), pour ne pas presenter un jugement comme un fait
       la ou une seule case le distinguerait mal. -->
  <div class="cotefiltre" id="coteFiltre" role="group" aria-label="${esc(T(lang, "Filter by side", "Filtrer par camp"))}">
    <button type="button" data-side="all" aria-pressed="true">${T(lang, "All", "Toutes")}</button>
    <button type="button" data-side="w" aria-pressed="false">${T(lang, "White", "Blancs")}</button>
    <button type="button" data-side="b" aria-pressed="false">${T(lang, "Black", "Noirs")}</button>
  </div>
  <p class="filtre-etat" id="filtreEtat" role="status" aria-live="polite" data-aucun="${esc(T(lang, "No match.", "Aucun résultat."))}" data-sur="${esc(T(lang, "{a} of {b}", "{a} sur {b}"))}"></p>
</div>
<div class="grid" id="grille">
${pages.map(p => {
  /* data-cle porte tout ce sur quoi on peut chercher : le nom dans la langue
     de la page et en anglais (et en francais sur la page francaise), les
     coups et les codes ECO. Sans accents ni ponctuation, pour que "defense"
     trouve "Défense" et "e4c5" trouve "1.e4 c5". */
  const cle = sansAccent([
    p.noms[lang],
    lang === "fr" ? p.family : lang === "en" ? p.nameFr : p.family,
    numbered(p.main.moves),
    p.ecos.join(" ")
  ].join(" "));
  return `<a class="tile" data-cle="${esc(cle)}" data-side="${p.side}" href="${d.index}${p.slugs[lang]}"><b>${esc(p.noms[lang])}</b><span>${esc(numbered(p.main.moves))} · ${esc(p.ecos.join(" "))}</span></a>`;
}).join("\n")}
</div>`;
  if (autre) queueOg("openings-" + lang, d.idxH1, tr(lang, "{a} families · {b} named lines", { a: pages.length, b: lines.length }), "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1");
  fs.writeFileSync(`${OUT}/${d.dir}/index.html`,
    shell(d.idxTitle, d.idxDesc(pages.length, lines.length), SITE + d.index, idxBody,
      { "@context": "https://schema.org", "@type": "CollectionPage", name: d.idxH1, url: SITE + d.index, inLanguage: PAR_CODE[lang].html },
      lang, "", Object.fromEntries(LANGUES.map(l => [l.code, SITE + "/" + l.dirs.openings + "/"])),
      SITE + "/og/" + (lang === "fr" ? "ouvertures" : lang === "en" ? "openings" : "openings-" + lang) + ".png"));
}

/* ---------- 4. manifest, service worker, robots, sitemap ---------- */
fs.writeFileSync(OUT + "/manifest.webmanifest", JSON.stringify({
  name: "chang64 : chess and tactics", short_name: "chang64",
  description: "Play chess, solve verified tactics puzzles and train endgames. No account required.",
  start_url: "/", scope: "/", display: "standalone",
  background_color: "#101413", theme_color: "#101413", orientation: "any",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
  ]
}, null, 2));

/* Icones de la nouvelle identite (2026-10-24), livrees toutes faites dans
   ds/icones (sources dans design/identite). Elles remplacent icon-192.svg et
   icon-512.svg, generes ici a partir de l'ancien signe :
   - favicon.ico (16, 32, 48 px) pour les anciens navigateurs et Safari ;
   - favicon.svg, le signe allege, lisible a 16 px ;
   - apple-touch-icon.png, plein cadre et sans transparence, pour iOS ;
   - icon-*.png (any) et maskable-*.png (decoupe par le systeme), separes :
     une meme image "any maskable" se faisait rogner l'elephant sur Android. */
for (const f of fs.readdirSync(path.join(__dirname, "ds/icones")))
  fs.copyFileSync(path.join(__dirname, "ds/icones", f), path.join(OUT, f));

const SW_VERSION = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
/* Version du cache de donnees tiree du CONTENU de data/ (2026-10-25), et non
   plus de l'heure du build : une publication qui ne touche que le code ne
   vide plus les exercices gardes hors ligne. Avant, chaque mise en ligne les
   effacait et un joueur passe en mode avion sans avoir rouvert les exercices
   entre-temps n'en avait plus aucun. Tout changement de donnees (banque,
   jour.json...) change l'empreinte, donc le cache repart a neuf, comme avant :
   pas de melange entre un ancien index de niveau et de nouveaux morceaux. */
const DATA_VERSION = (() => {
  const h = require("crypto").createHash("sha1");
  const parcourir = dossier => {
    for (const nom of fs.readdirSync(dossier).sort()) {
      const f = path.join(dossier, nom);
      if (fs.statSync(f).isDirectory()) parcourir(f);
      else h.update(path.relative(OUT, f).replace(/\\/g, "/") + "\n").update(fs.readFileSync(f));
    }
  };
  parcourir(path.join(OUT, "data"));
  return h.digest("hex").slice(0, 12);
})();
fs.writeFileSync(OUT + "/sw.js", `/* chang64 offline cache
 *
 * chang64 - a free chess website
 * Copyright (C) 2026 AlexZ1212
 * https://github.com/AlexZ1212/chang64
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version. See https://chang64.com/LICENSE
 *
 * La version du cache est calculee a la construction : chaque build invalide
 * automatiquement le cache des visiteurs. Ne pas figer cette valeur.
 */
const CACHE="chang64-${SW_VERSION}";
const DATA_CACHE="chang64-data-${DATA_VERSION}";
/* Plafond du cache de donnees en OCTETS (2026-10-25), et non plus en nombre
   d'entrees. Les trois entrees du 2026-09-06 visaient des shards de 1 a 2 Mo,
   soit environ 5 Mo, loin des 17 Mo qui avaient fait sauter le quota iOS et
   evince le cache ENTIER, coquille de l'application comprise. Depuis le
   decoupage de la banque, les fichiers pesent 3 Ko a 1,2 Mo et une seance
   ordinaire en demande neuf (index et morceau du niveau, jour.json, ids/,
   theme-counts, rush-pool...) : les trois derniers chassaient ceux du niveau
   et, en mode avion, les exercices ne se chargeaient plus. On garde donc
   l'enveloppe de 5 Mo, mesuree fichier par fichier. */
const DATA_PLAFOND=5*1024*1024;
/* Les ecritures du cache de donnees sont mises a la queue leu leu. Mesure
   avant serialisation : cinq shards demandes en meme temps laissaient six
   entrees au lieu de trois, chaque requete lisant keys() avant qu'aucune
   ecriture n'ait atterri, donc aucune ne voyait de raison d'evincer. Le
   plafond ne tenait pas du tout. Ne pas remplacer cette chaine par des
   appels paralleles. */
let fileDeco=Promise.resolve();
/* Range une reponse en fin de file, puis evince par le debut tant que le
   total depasse le plafond. keys() rend les entrees dans leur ordre
   d'insertion : la premiere est la moins recemment utilisee, parce qu'une
   lecture dans le cache repasse aussi par ici (sinon l'index d'un niveau,
   charge une fois puis toujours lu depuis le cache, restait en tete et
   partait le premier). La taille est notee dans un en-tete a l'ecriture,
   pour ne pas relire chaque corps a chaque eviction. L'entree qu'on vient
   de ranger n'est jamais evincee. */
function ranger(c,r,resp){
  fileDeco=fileDeco.then(()=>resp.blob()).then(b=>{
    const h=new Headers(resp.headers);
    h.set("x-chang64-octets",String(b.size));
    return c.delete(r).then(()=>c.put(r,new Response(b,{status:resp.status,statusText:resp.statusText,headers:h})));
  }).then(()=>c.keys()).then(ks=>Promise.all(ks.map(k=>c.match(k).then(x=>x&&+x.headers.get("x-chang64-octets")||0))).then(tailles=>{
    let total=tailles.reduce((a,t)=>a+t,0);
    const vieux=[];
    for(let i=0;i<ks.length-1&&total>DATA_PLAFOND;i++){total-=tailles[i];vieux.push(c.delete(ks[i]));}
    return Promise.all(vieux);
  })).catch(()=>{});
}
/* "/index.html" retire de CORE et du repli hors ligne (2026-10-24) : Pages le
   redirige en 308 vers "/", et une reponse redirigee servie a une navigation
   est refusee par le navigateur. Le repli tombait donc en erreur. */
const CORE=["/","/manifest.webmanifest","/favicon.svg","/favicon.ico","/icon-192.png","/icon-512.png","/openings/"];
self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()).catch(()=>{}));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==DATA_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",e=>{
  const r=e.request;
  if(r.method!=="GET")return;
  const url=new URL(r.url);
  if(url.origin!==location.origin)return;
  if(url.pathname.startsWith("/engine/"))return;   // 7 MB engine stays out of the cache
  if(url.pathname.startsWith("/api/"))return;      // compteurs du serveur : jamais en cache
  /* Les shards d'exercices (17 Mo au total : level-1..10, rush-pool,
     puzzle-index) etaient mis en cache sans plafond. Sur iOS le quota par
     origine est etroit et son depassement evince le cache ENTIER, coquille
     de l'application comprise : le site tombait alors hors ligne d'un coup.
     Les exclure a mis la coquille a l'abri, mais au prix d'une perte seche :
     sans reseau, /data/ ne repondait plus du tout, exQuest restait sur
     "Loading…" et le site affichait "Impossible de charger les exercices".
     Un utilisateur en avion perdait donc les exercices, c'est-a-dire la
     moitie du site. Mesure faite en bloquant /data/ : l'echiquier restait
     affiche, vide, sous un message d'erreur.
     Depuis le 2026-09-06 ils reviennent dans un cache A PART, plafonne
     (DATA_PLAFOND). Le cache separe et le plafond traitent la vraie cause
     du probleme iOS, qui etait le volume, pas la mise en cache elle-meme.
     Ne pas remettre ces fichiers dans CACHE : c'est ce melange qui faisait
     tomber la coquille avec les donnees. */
  if(url.pathname.startsWith("/data/")){
    e.respondWith(
      caches.open(DATA_CACHE).then(c=>c.match(r).then(hit=>{
        if(hit){ranger(c,r,hit.clone());return hit;}
        return fetch(r).then(resp=>{
          if(resp&&resp.ok)ranger(c,r,resp.clone());
          return resp;
        });
      }))
      /* Hors ligne et jamais mis en cache : on laisse l'echec remonter tel
         quel, fetchJSON le traduit en message lisible (puzzleDataError). */
    );
    return;
  }
  /* Pages HTML rangees sous leur seul chemin (2026-10-24). La cle etait la
     requete entiere, chaine de requete comprise : "/", "/?fbclid=..." et
     "/?utm_source=..." faisaient chacune une entree de la coquille, sans
     plafond, a chaque lien partage sur un reseau social. C'est exactement le
     gonflement qui fait sauter le quota iOS (voir DATA_PLAFOND plus haut). Aucune
     page ne lit sa chaine de requete cote serveur : le HTML est le meme, une
     seule entree suffit. Le reseau recoit toujours l'adresse complete. Les
     autres fichiers gardent leur requete pour cle. */
  const page=r.mode==="navigate"||(r.headers.get("accept")||"").includes("text/html");
  const cle=page?url.origin+url.pathname:r;
  /* Repli hors ligne dans la langue de la page demandee (2026-10-25) :
     l'accueil de cette langue s'il a deja ete visite, sinon "/". */
  const langue=/^\\/(${LANGUES.filter(l => l.code !== "en").map(l => l.code).join("|")})\\//.exec(url.pathname);
  e.respondWith(
    caches.match(cle).then(hit=>hit||fetch(r).then(resp=>{
      const copy=resp.clone();
      caches.open(CACHE).then(c=>c.put(cle,copy)).catch(()=>{});
      return resp;
    }).catch(()=>(langue?caches.match("/"+langue[1]+"/"):Promise.resolve()).then(h=>h||caches.match("/"))))
  );
});
`);

/* Date de l'application (2026-10-18). Les pages de contenu portaient
   "Publiee le ..., mise a jour le ..." en pied de page ; l'application, la
   page qu'on visite le plus, ne disait rien. Meme registre, cle "/".
   L'empreinte couvre la page ET la banque d'exercices : une purge ou une
   fournee fusionnee est une mise a jour, meme quand le gabarit ne bouge pas.
   Premiere entree : la date de publication reprend la plus ancienne du
   registre, celle de la mise en ligne du site, pas la date du jour.
   Une seule date pour toutes les langues : c'est la meme application. */
if (!DATES["/"]) {
  const premiere = Object.values(DATES).map(d => d.publiee).sort()[0] || BUILD_DATE;
  DATES["/"] = { sceau: "", publiee: premiere, modifiee: premiere };
}
const datesApp = datesDe("/", app + require(path.join(__dirname, "banque.js")).texte());

/* ---------- 4bis. une page d'accueil de l'application par langue ----------
   Decision d'Alexandre du 25/10 : "/" reste l'anglais, et chaque autre langue
   a sa page (/fr/, /es/...). Meme gabarit, meme script ; ce qui change d'une
   page a l'autre est pose ici :
   - l'entete : lang, canonical, hreflang, og:locale, titre et descriptions
     traduits (le texte du corps est traduit au chargement par applyI18n,
     comme le francais l'etait deja) ;
   - le bloc de langue (id="langue") : code, locale, dictionnaire de la langue
     et adresses de ses pages d'ouvertures. Seule cette langue y est : un
     visiteur ne telecharge pas les dictionnaires des autres ;
   - le selecteur de langue et le texte sans JavaScript ;
   - sur la page anglaise seulement, un court script en tete qui renvoie vers
     la langue retenue (choix deja fait sur le site, sinon langue du
     navigateur). Googlebot, en anglais et sans stockage, reste sur "/". */
const URLS_APP = Object.fromEntries(LANGUES.map(l => [l.code, SITE + l.accueil]));
function dictApp(lang) {
  if (lang === "en") return {};
  try { return require(path.join(__dirname, "langues", lang, "app.js")); }
  catch (e) { if (e.code !== "MODULE_NOT_FOUND") throw e; return {}; }
}
const NOSCRIPT_EN = "chang64 needs JavaScript to play, solve puzzles and analyse games. Without it, nothing on this page will respond.<br>" +
  "The content pages work without JavaScript: <a href=\"/{openings}/\">openings</a>, <a href=\"/{learn}/\">rules</a>, <a href=\"/{glossary}/\">glossary</a>, <a href=\"/{endgames}/\">endgames</a>.";
function pageApplication(lang) {
  const L_ = PAR_CODE[lang], dict = dictApp(lang);
  const tx = s => typeof dict[s] === "string" ? dict[s] : s;
  const attr = s => String(s).replace(/&quot;/g, "\"").replace(/&amp;/g, "&");
  let h = app.replace('<html lang="en">', `<html lang="${L_.html}">`);
  h = h.replace(/<title>([^<]*)<\/title>/, (m, x) => `<title>${esc(tx(x))}</title>`)
    .replace(/(<meta (?:name="description"|property="og:title"|property="og:description") content=")([^"]*)(")/g,
      (m, a, x, b) => a + esc(tx(attr(x))) + b)
    .replace(/("@type":"WebApplication"[\s\S]*?"description":)("(?:[^"\\]|\\.)*")/, (m, a, x) => a + JSON.stringify(tx(JSON.parse(x))));
  const ouvertures = {};
  for (const p of pages) ouvertures[p.family] = p.slugs[lang];
  const bloc = JSON.stringify({ lang, html: L_.html, intl: L_.intl, dirs: L_.dirs, ouvertures, dict })
    .replace(/</g, "\\u003c");
  const selecteur = `<details class="langswitch" id="langSwitch"><summary aria-label="${esc(T(lang, "Language: {name}", "Langue : {name}", { name: L_.nom }))}">${lang.toUpperCase()}</summary><div class="langmenu">` +
    LANGUES.map(l => `<a href="${l.accueil}" hreflang="${l.hreflang}" lang="${l.html}" data-lang="${l.code}"${l.code === lang ? ' aria-current="true"' : ""}>${l.nom}</a>`).join("") +
    `</div></details>`;
  const autres = LANGUES.filter(l => l.code !== "en").map(l => l.code);
  const redirection = lang !== "en" ? "" :
    `<script>try{var A=${JSON.stringify(autres)},l=localStorage.getItem("chang64:lang")||"";if(!l){var n=(navigator.language||"").toLowerCase();for(var i=0;i<A.length;i++)if(n.indexOf(A[i])===0)l=A[i];}if(A.indexOf(l)>=0)location.replace("/"+l+"/"+location.search+location.hash);}catch(e){}</script>`;
  h = h.split("__CANONICAL__").join(URLS_APP[lang])
    .replace("__OG_LOCALE__", L_.og)
    .replace("<!--__HREFLANG__-->", lignesHreflang(URLS_APP))
    .replace("<!--__REDIRECTION_LANGUE__-->", redirection)
    .replace("<!--__NOSCRIPT__-->", GRAMMAIRE_GABARIT(dict["@noscript"] || NOSCRIPT_EN, L_.dirs))
    .replace("<!--__LANGSWITCH__-->", selecteur)
    .replace("__LANGUE_JSON__", () => bloc);
  /* Jetons du nombre d'exercices, apres la pose du dictionnaire dont les
     phrases les portent aussi : groupe a l'anglaise (__NP_EN__), a la
     francaise (__NP_FR__, phrases deja redigees ainsi) ou dans la langue de
     la page (__NP_LOC__). Le texte de presentation de l'accueil groupe le
     nombre selon la langue (108,868 / 108 868), meme Intl que fmtEntier dans
     i18n.js. Les meta et donnees structurees gardent __NP__, le nombre brut.
     Les jetons de familles et de lignes dependent du livre d'ouvertures,
     charge apres l'assemblage. */
  h = h.split("__NP_EN__").join(Number(NP).toLocaleString("en-US"))
    .split("__NP_FR__").join(Number(NP).toLocaleString("fr-FR"))
    .split("__NP_LOC__").join(Number(NP).toLocaleString(L_.intl))
    .split("__NP__").join(NP)
    .split("__NF__").join(NF).split("__NL__").join(NL);
  return h.split("__APP_PUBLIEE__").join(datesApp.publiee).split("__APP_MODIFIEE__").join(datesApp.modifiee)
    .split("__APP_DATES_EN__").join(lang === "en"
      ? "Published " + datesApp.publiee + (datesApp.modifiee !== datesApp.publiee ? ", updated " + datesApp.modifiee : "")
      : datesPied(lang, datesApp));
}
const GRAMMAIRE_GABARIT = TRAD.GRAMMAIRE.gabarit;
for (const l of LANGUES) {
  const h = pageApplication(l.code);
  fs.mkdirSync(path.join(OUT, l.accueil), { recursive: true });
  fs.writeFileSync(path.join(OUT, l.accueil, "index.html"), h);
  if (l.code === "en") fs.writeFileSync(path.join(__dirname, "site-index.html"), h);
}

/* ---------- images de partage (Open Graph) ---------- */
function ogSvg(title, subtitle, fen) {
  const esc2 = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const board = fen ? boardSvg(fen, 470).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "") : "";
  const words = esc2(title).split(" ");
  const lines = []; let line = "";
  for (const wd of words) {
    if ((line + wd).length > 22) { lines.push(line.trim()); line = wd + " "; } else line += wd + " ";
    if (lines.length === 3) break;
  }
  if (line.trim() && lines.length < 3) lines.push(line.trim());
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#101413"/>
<g transform="translate(660,80)">${board}</g>
${lines.map((l, i) => `<text x="70" y="${190 + i * 62}" font-family="Georgia,serif" font-size="52" font-weight="600" fill="#ECEAE3">${l}</text>`).join("")}
<text x="70" y="${190 + lines.length * 62 + 26}" font-family="Helvetica,Arial,sans-serif" font-size="24" fill="#97A49D">${esc2(subtitle).slice(0, 46)}</text>
<text x="70" y="96" font-family="Georgia,serif" font-size="34" font-weight="600" fill="#ECEAE3">chang<tspan fill="#E0A93B" font-family="monospace" font-size="30">64</tspan></text>
<rect x="70" y="540" width="8" height="34" fill="#E0A93B"/>
<text x="92" y="566" font-family="Helvetica,Arial,sans-serif" font-size="22" fill="#97A49D">chang64.com</text>
</svg>`;
}
function queueOg(name, title, subtitle, fen) {
  fs.writeFileSync(`${OUT}/og/${name}.svg`, ogSvg(title, subtitle, fen));
  ogJobs.push(name);
}

{
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
  const ITALIAN = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1";
  queueOg("home", "Play chess. Solve tactics. Get better.", puzzles.length + " verified puzzles \u00b7 no account", START);
  queueOg("openings", "Chess openings", pages.length + " families \u00b7 " + lines.length + " named lines", ITALIAN);
  queueOg("ouvertures", "Ouvertures d'\u00e9checs", pages.length + " familles \u00b7 " + lines.length + " variantes", ITALIAN);
  queueOg("puzzles-index", "Verified tactics puzzles", puzzles.length + " engine-proved positions", puzzles[0] ? puzzles[0].fen : START);
  queueOg("learn", "Learn the rules of chess", "Castling, en passant, notation", START);
  queueOg("apprendre", "Apprendre les r\u00e8gles", "Roque, prise en passant, notation", START);
}

/* ---------- Cloudflare Pages : en-têtes, redirections, page 404 ---------- */
/* static.cloudflareinsights.com (script-src) et cloudflareinsights.com
   (connect-src) retires le 2026-09-05. La page Confidentialite affirme que
   le site "n'utilise aucun traqueur" et promet d'etre mise a jour AVANT
   qu'une mesure d'audience soit mise en service : garder ces deux origines
   autorisees revenait a laisser la porte ouverte a un mouchard tiers que le
   texte nie. La CSP fait maintenant respecter la promesse d'elle-meme, meme
   si Cloudflare Web Analytics venait a etre active par inadvertance dans le
   tableau de bord -- le script serait alors bloque, avec une erreur en
   console et aucune donnee envoyee. A desactiver aussi cote tableau de bord
   si jamais il tourne, la CSP n'etant qu'un filet de securite.
   La regle sans cache de l'application vise "/" et non plus "/index.html"
   (2026-10-24) : _headers s'applique au chemin demande, et Pages redirige
   "/index.html" vers "/". La regle ne touchait donc jamais la page servie.
   SVG (2026-10-25) : max-age=604800 seul, Cloudflare (qui met les .svg en
   cache par defaut, contrairement au JSON) les gardait 7 jours sur ses
   serveurs, nouveau deploiement ou non : apres la publication de la banque,
   og/home.svg annoncait encore "108868" (Age: 86534 s, cf-cache-status: HIT).
   Le navigateur garde un jour ; le CDN, via s-maxage, revalide toutes les
   5 minutes.
   X-Robots-Tag sur /engine/* (2026-10-27) : Cloudflare ajoute en tete de
   robots.txt son propre bloc (robots d'IA, "Managed robots.txt", garde avec
   l'accord d'Alexandre), qui ouvre un premier groupe "User-agent: *". Un
   robot qui ne lit que le premier groupe ignorerait notre Disallow:
   /engine/ ; l'en-tete vaut quel que soit le robots.txt. */
fs.writeFileSync(OUT + "/_headers", `/*
  X-Content-Type-Options: nosniff
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Content-Security-Policy: default-src 'self'; script-src 'self' __HACHAGES__ 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'self'; base-uri 'self'; form-action 'none'
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: geolocation=(), microphone=(), camera=()

/engine/*
  Cache-Control: public, max-age=31536000, immutable
  X-Robots-Tag: noindex, nofollow

/fonts/*
  Cache-Control: public, max-age=31536000, immutable
  Content-Type: font/woff2

/data/*
  Content-Type: application/json; charset=utf-8
  Cache-Control: public, max-age=600

/*.svg
  Cache-Control: public, max-age=86400, s-maxage=300

/*.webmanifest
  Content-Type: application/manifest+json

/engine/*.wasm
  Content-Type: application/wasm

/engine/*.js
  Content-Type: text/javascript

/
  Cache-Control: public, max-age=0, must-revalidate

/sw.js
  Cache-Control: public, max-age=0, must-revalidate

/openings-book.json
  Content-Type: application/json; charset=utf-8
  Cache-Control: public, max-age=604800

/LICENSE
  Content-Type: text/plain; charset=utf-8
  Cache-Control: public, max-age=86400

/COPYING.CONTENT
  Content-Type: text/plain; charset=utf-8
  Cache-Control: public, max-age=86400
`);

/* Redirections des anciennes URL francaises.
   Avant que les familles soient traduites, la page francaise portait le slug
   anglais : /fr/ouvertures/elephant-gambit.html. Elle porte desormais
   /fr/ouvertures/gambit-de-lelephant.html. Ces URL sont indexees par Google,
   d'ou une 301 pour chaque famille dont le slug francais differe du slug
   anglais. On saute les cas ou l'ancienne URL est aussi une URL actuelle,
   qui creeraient une boucle.
   La cible est la forme sans extension (2026-10-24) : Pages redirige en 308
   toute URL en .html, une cible en .html faisait donc une chaine 301 puis
   308. L'ancienne adresse est couverte sous ses deux formes, avec et sans
   .html, pour que chacune arrive en un seul saut. */
const frSlugs = new Set(pages.map(p => p.slugFr));
const oldFrRedirects = pages
  .filter(p => p.slugFr !== p.slugEn && !frSlugs.has(p.slugEn))
  .map(p => `/fr/ouvertures/${p.slugEn}.html  /fr/ouvertures/${p.slugFr}  301\n` +
            `/fr/ouvertures/${p.slugEn}  /fr/ouvertures/${p.slugFr}  301`)
  .join("\n");
console.log("Redirections FR    :", oldFrRedirects ? oldFrRedirects.split("\n").length / 2 : 0);

/* Pages Functions (2026-10-25) : mesure de la difficulte reelle, voir
   functions/api/resultat.js. Le projet Pages a chang64-site pour racine et
   pour sortie, et y cherche donc functions/ : on la recopie dans OUT, sinon
   la recopie miroir (robocopy /MIR) l'effacerait a chaque publication.
   _routes.json reserve les fonctions a /api/* : sans lui, chaque page et
   chaque fichier statique passerait par elles et compterait dans le quota
   gratuit de 100 000 appels par jour. */
fs.cpSync(path.join(__dirname, "functions"), path.join(OUT, "functions"), { recursive: true });
fs.writeFileSync(OUT + "/_routes.json", JSON.stringify({ version: 1, include: ["/api/*"], exclude: [] }, null, 2) + "\n");

/* "/fr" menait aux ouvertures francaises ; depuis le 2026-10-25 il mene a
   l'application en francais (/fr/), comme "/es" a l'espagnol, etc. */
fs.writeFileSync(OUT + "/_redirects", `${LANGUES.filter(l => l.code !== "en").map(l => `/${l.code}            /${l.code}/                   301`).join("\n")}
/openings      /openings/            301
/puzzles       /puzzles/             301
/learn         /learn/               301
/glossary      /glossary/            301
/endgames      /endgames/            301
/traps         /traps/               301
${oldFrRedirects}
`);

{
  const body = `
<h1>404</h1>
<p class="lede">This page does not exist. Cette page n'existe pas.${LANGUES.filter(l => l.code !== "en" && l.code !== "fr").map(l => " " + tr(l.code, "This page does not exist.")).join("")}</p>
<div class="grid">
  <a class="tile" href="/"><b>Play chess</b><span>chang64.com</span></a>
  <a class="tile" href="/openings/"><b>Openings</b><span>${NF} families</span></a>
  <a class="tile" href="/fr/ouvertures/"><b>Ouvertures</b><span>${NF} familles</span></a>
  <a class="tile" href="/puzzles/"><b>Puzzles</b><span>${puzzles.length} positions</span></a>
${/* Une tuile par autre langue (2026-10-25), vers son application. */
  LANGUES.filter(l => l.code !== "en").map(l => `  <a class="tile" href="${l.accueil}" lang="${l.html}"><b>${l.nom}</b><span>${esc(T(l.code, "Play chess", "Jouer aux échecs"))}</span></a>`).join("\n")}
</div>`;
  fs.writeFileSync(OUT + "/404.html",
    shell("Page not found | chang64", "This page does not exist on chang64.", SITE + "/404", body, null, "en", '<meta name="robots" content="noindex">', null));
}

fs.writeFileSync(OUT + "/robots.txt", `User-agent: *\nAllow: /\nDisallow: /engine/\n\nSitemap: ${SITE}/sitemap.xml\n`);

const today = BUILD_DATE;   /* meme date que dateModified des fiches JSON-LD */
const extraUrls = require("./content.js")({
  fs, OUT, SITE, shell, boardSvg, esc, numbered, Game, puzzles, slug, L, sansAccent, metaDesc
});
/* Etiquette corrigee le 2026-09-07 : ce nombre n'a jamais compte les pages
   ecrites par content.js, mais les URLs qu'il verse au sitemap, c'est-a-dire
   les seules pages indexables. L'ecart est large -- 180 contre 466 pages
   reellement produites, le reste portant un meta robots noindex -- et il a
   deja coute un aller-retour entre deux handoffs, ou le meme build semblait
   avoir perdu la moitie de ses pages d'une session a l'autre. Le compte reel
   est donne plus bas par "Dates de contenu". */
console.log("URLs de contenu    :", extraUrls.length);
/* Conversion des images de partage en PNG, par og_render.js (Node + sharp).
   Remplace og_render.py depuis le 2026-09-09 : la chaine Python + cairosvg +
   Cairo etait impraticable sous Windows, et build_site.js appelait de surcroit
   "python3", un nom que l'installeur de python.org ne pose pas.
   og_render.py reste dans le depot, inutilise, pour qui voudrait la chaine
   Python.
   Le compteur n'est affiche qu'en cas de succes : annoncer "Images de partage :
   147" apres un echec de conversion, comme le faisait la version d'avant,
   laissait croire que les PNG etaient produits alors que le dossier restait
   vide, et un build muet de ce cote est parti en ligne sans ses apercus. */
let ogFait = false;
try {
  require("child_process").execSync(
    `node "${path.join(__dirname, "og_render.js")}"`, { stdio: "inherit" });
  ogFait = true;
} catch (e) { /* message deja affiche par og_render.js */ }
if (ogFait) console.log("Images de partage  :", ogJobs.length);
else {
  console.log("ATTENTION : images de partage NON converties.");
  console.log("  Les " + ogJobs.length + " apercus de partage seront absents du site.");
  console.log("  A regler avant toute mise en ligne : npm install sharp --no-save");
}

/* Seules les familles pourvues d'une note redigee entrent au sitemap : les
   autres portent un meta robots noindex (voir plus haut), et declarer au
   sitemap une page qu'on demande par ailleurs de ne pas indexer est un
   signal contradictoire que la Search Console remonte comme une erreur.
   Meme condition des deux cotes, meme source (FAMILY_NOTES/NOTES_FR). */
/* Une entree par page et par langue, chacune avec toutes ses versions
   (2026-10-25) : Google attend des hreflang reciproques, donc la liste
   complete sous chaque adresse. Une version en noindex (famille sans note
   dans cette langue) n'est ni declaree ni citee en alternative. */
const altsOuverture = p => Object.fromEntries(LANGUES.filter(l => p.notes[l.code]).map(l => [l.code, urlFor(l.code, p)]));
const IDX_OUV = Object.fromEntries(LANGUES.map(l => [l.code, SITE + "/" + l.dirs.openings + "/"]));
const urls = [
  ...LANGUES.map(l => ({ loc: URLS_APP[l.code], pri: "1.0", alts: URLS_APP })),
  ...LANGUES.map(l => ({ loc: IDX_OUV[l.code], pri: "0.9", alts: IDX_OUV })),
  ...LANGUES.flatMap(l => pages.filter(p => p.notes[l.code]).map(p => ({ loc: urlFor(l.code, p), pri: "0.7", alts: altsOuverture(p) }))),
  ...extraUrls
];
fs.writeFileSync(OUT + "/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
  urls.map(u => {
    const v = u.alts || {};
    const alts = LANGUES.filter(l => v[l.code]).map(l =>
      `\n    <xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${v[l.code]}"/>`).join("") +
      (v.en ? `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${v.en}"/>` : "");
    return `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.pri}</priority>${alts}\n  </url>`;
  }).join("\n") + `\n</urlset>\n`);

/* .htaccess retire : le site est heberge sur Cloudflare Pages, qui ne lit pas
   ce fichier. Les types MIME sont declares dans _headers, la compression et
   les durees de cache sont geres par Cloudflare, et la page 404 fonctionne
   par convention grace a 404.html. */

console.log("Pages d'ouvertures :", pages.length);
console.log("Lignes indexees    :", lines.length);
console.log("URLs au sitemap    :", urls.length);
/* Meme piege que __NP__, trouve sur le tas : COPYING.CONTENT et README.md
   annoncaient aussi un nombre de pages ("1,353 pages"), fige en dur au lieu
   d'un jeton -- reste juste apres avoir corrige le nombre d'exercices,
   repere en verifiant les vrais fichiers de licence recuperes depuis le
   depot. urls.length (deja les deux langues confondues, comme le texte le
   dit) est la mesure la plus fidele a "le contenu redige de X pages" :
   openings + ouvertures FR + toutes les pages generees par content.js, un
   comptage qui derive sinon a chaque changement de structure du site (page
   par exercice -> pages par categorie, ajout du calendrier...). */
const NPAGES = String(urls.length);
for (const f of ["COPYING.CONTENT", "README.md"]) {
  const txt = fs.readFileSync(path.join(__dirname, "licence/") + f, "utf8")
    .split("__NP__").join(NP).split("__NPAGES__").join(NPAGES);
  fs.writeFileSync(OUT + "/" + f, txt);
}
const size = p => fs.statSync(p).size;
console.log("index.html         :", Math.round(size(OUT + "/index.html") / 1024), "Ko");
let total = 0;
(function walk(d) { for (const f of fs.readdirSync(d)) { const fp = path.join(d, f); const st = fs.statSync(fp); st.isDirectory() ? walk(fp) : total += st.size; } })(OUT);
poserHachagesCSP();
ecrireRegistreDates();
console.log("Poids du site      :", (total / 1048576).toFixed(1), "Mo");
/* Phrases des pages restees sans traduction, par langue (2026-10-25) : la
   page retombe alors sur l'anglais. Liste ecrite hors du site, dans
   langues/manquants.json (ignore par git), que lit check_traductions.js. */
{
  const manq = TRAD.rapport();
  /* Morceaux de noms de variantes sans traduction (nomVariante), francais
     compris : ils rejoignent la meme liste. */
  for (const m of variantesManquantes) { const [l, p] = m.split(" : "); (manq[l] = manq[l] || []).push("variantes:" + p); }
  fs.writeFileSync(path.join(__dirname, "langues", "manquants.json"), JSON.stringify(manq, null, 1) + "\n");
  for (const l of LANGUES) {
    if (l.code === "en" || l.code === "fr") continue;
    console.log(("Traductions " + l.code).padEnd(19) + ": " + ((manq[l.code] || []).length ? (manq[l.code] || []).length + " phrase(s) manquante(s)" : "complete"));
  }
}
