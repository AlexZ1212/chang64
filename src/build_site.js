const fs = require("fs");
const path = require("path");
const { Game, pType, pColor } = require("./engine.js");
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
/* Meme identite que la page Mentions legales de l'application (PUBLISHER
   dans ui2.js). Duplique faute de module partage entre l'application et le
   generateur : a garder synchronise si elle change. */
const PUBLISHER = { name: "AlexZ1212" };

/* ---------- 1. application ---------- */
const THEMES = JSON.parse(fs.readFileSync(path.join(__dirname, "themes.json"), "utf8"));
const puzzles = JSON.parse(fs.readFileSync(path.join(__dirname, "puzzles.json"), "utf8"));
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
let ui = minifyJs(fs.readFileSync(path.join(__dirname, "ui.js"), "utf8").replace("__TOTAL_PUZZLES__", String(puzzles.length)), "ui.js");
let ui2 = minifyJs(fs.readFileSync(path.join(__dirname, "ui2.js"), "utf8"), "ui2.js");
// la table famille -> adresses de pages est construite plus bas, après le calcul des slugs
let ui3 = minifyJs(fs.readFileSync(path.join(__dirname, "ui3.js"), "utf8"), "ui3.js");
const i18n = minifyJs(fs.readFileSync(path.join(__dirname, "i18n.js"), "utf8"), "i18n.js");
/* Le nombre d'exercices etait ecrit en dur a neuf endroits : accueil, meta
   description, image de partage, donnees structurees, tuiles de navigation,
   dans les deux langues. Il devenait faux des qu'on enrichissait la banque.
   Un seul jeton, remplace ici a partir du fichier reel. */
const NP = String(puzzles.length);
let app = fs.readFileSync(path.join(__dirname, "template.html"), "utf8");
app = app.replace(/<style>[\s\S]*?<\/style>/, m => "<style>" + minifyCss(m.slice("<style>".length, -"</style>".length)) + "</style>");
app = app
  .replace("/*__I18N__*/", i18n)
  .replace("/*__ENGINE__*/", engine).replace("/*__PIECES__*/", pieces)
  .replace("/*__UI__*/", ui).replace("/*__UI2__*/", ui2).replace("/*__UI3__*/", ui3)
  .split("__NP__").join(NP);

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
   - data/level-N.json (N=1..10) : exercices complets de ce niveau, pour
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
  const byLevel = {};
  const puzzleIndex = {};
  const themeCounts = {};
  for (const p of puzzles) {
    (byLevel[p.level] = byLevel[p.level] || []).push(p);
    puzzleIndex[p.id] = p.level;
    themeCounts[p.theme] = (themeCounts[p.theme] || 0) + 1;
  }
  for (const lvl in byLevel) {
    fs.writeFileSync(OUT + "/data/level-" + lvl + ".json", JSON.stringify(byLevel[lvl]));
  }
  fs.writeFileSync(OUT + "/data/puzzle-index.json", JSON.stringify(puzzleIndex));
  fs.writeFileSync(OUT + "/data/theme-counts.json", JSON.stringify(themeCounts));

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
  fs.writeFileSync(OUT + "/data/rush-pool.json", JSON.stringify(rushPool));
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
  "jetbrains-mono-v24-latin-500.woff2", "jetbrains-mono-v24-latin-700.woff2"
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
  pages.push({ family, nameFr, slugEn: slug(family), slugFr: slug(nameFr),
    main, fen, ecos, variations, count: list.length, side: sideOf(family, main.moves),
    note: FAMILY_NOTES[family] || null, noteFr: NOTES_FR[family] || null });
}
pages.sort((a, b) => b.count - a.count || a.family.localeCompare(b.family));
{
  const seen = new Set();
  for (const p of pages) { while (seen.has(p.slugFr)) p.slugFr += "-2"; seen.add(p.slugFr); }
}

const VAR_FR = [
  [/\bMain line\b/g, "Ligne principale"], [/\bVariation\b/g, "Variante"], [/\bVariations\b/g, "Variantes"],
  [/\bAttack\b/g, "Attaque"], [/\bDefense\b/g, "Défense"], [/\bDefence\b/g, "Défense"],
  [/\bCountergambit\b/g, "Contre-gambit"], [/\bOpening\b/g, "Ouverture"], [/\bSystem\b/g, "Système"],
  [/\bGame\b/g, "Partie"], [/\bAccepted\b/g, "accepté"], [/\bDeclined\b/g, "refusé"],
  [/\bDeferred\b/g, "différé"], [/\bLine\b/g, "Ligne"], [/\bwith\b/g, "avec"],
  [/\bwithout\b/g, "sans"], [/\band\b/g, "et"], [/\bTrap\b/g, "Piège"], [/\bModern\b/g, "moderne"],
  [/\bClassical\b/g, "classique"], [/\bOld\b/g, "ancienne"], [/\bNormal\b/g, "normale"],
  [/\bDouble\b/g, "double"], [/\bCounterattack\b/g, "Contre-attaque"]
];
function varFr(name) {
  let out = name;
  for (const [re, to] of VAR_FR) out = out.replace(re, to);
  return out;
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
.brand{display:flex;align-items:center;gap:11px;text-decoration:none;color:var(--chalk)}
.brandmark{width:clamp(30px,6vw,40px);height:clamp(30px,6vw,40px);display:block;flex:none;color:var(--brass)}
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
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--rule);color:var(--sage);font-size:13px;text-align:center}
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
.langsw{display:flex;gap:3px;background-color:var(--ink);padding:3px;
  border-radius:8px;border:1px solid var(--rule);flex:none}
/* Reprise exacte de .langswitch button dans l'application : JetBrains Mono
   en 600, corps 11.5px, marges 7px 10px, flex:none. Ce n'est pas la police du
   corps de texte, c'est celle du "64" de la marque : le selecteur de langue
   appartient a la meme famille visuelle. */
.langsw a{flex:none;font-family:'JetBrains Mono',monospace;font-size:11.5px;
  font-weight:600;text-align:center;text-decoration:none;color:var(--sage);
  padding:7px 10px;border-radius:6px;white-space:nowrap;
  transition:background .18s,color .18s}
.langsw a[aria-current="true"]{background-color:var(--raise);color:var(--chalk);font-weight:600}
.langsw a:hover{color:var(--chalk)}

.footnav{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 18px;margin-bottom:14px}
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
.footnote{margin:0}`;

/* La marque a l'elephant n'apparaissait que dans l'application : les pages
   d'ouvertures et de contenu n'affichaient que le texte "chang64". Rien ne
   justifiait cette difference, l'entete est le meme reperage d'un bout a
   l'autre du site. Fonction declaree (donc hoistee) pour ne pas dependre de
   l'ordre des constantes plus bas dans le fichier. */
let _mark = null;
function brandMark() {
  if (_mark === null) {
    const paths = (fs.readFileSync(path.join(__dirname, "ds/mark-on-dark.svg"), "utf8")
      .match(/<path d="[^"]+"/g) || []).map(m => m.slice(9, -1));
    /* Pas de width/height en attribut : c'est le CSS qui donne la taille,
       adaptative comme dans l'application (clamp 30 a 40 px). Des attributs
       fixes entreraient en conflit avec elle. */
    _mark = `<svg class="brandmark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">` +
      `<g fill="currentColor">${paths.map(d => `<path d="${d}"/>`).join("")}</g></svg>`;
  }
  return _mark;
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
app = app.split("/*__BRANDMARK__*/").join(brandMark());

/* Liens vers toutes les sections, dans la langue de la page. La page en cours
   est signalee et non cliquable : un lien vers soi-meme n'apporte rien.
   "Motifs"/"Patterns" plutot que "Exercices"/"Puzzles" (2026-09-04, remarque
   d'Alexandre) : la page elle-meme n'a jamais ete une liste d'exercices a
   resoudre mais 10 motifs tactiques avec 3 exemples expliques chacun -- son
   propre chapeau d'intro dit deja "Dix motifs tactiques", seul ce libelle de
   nav restait sur l'ancien mot. Chemin (/fr/exercices/, /puzzles/) inchange :
   seul le texte affiche change, pas l'URL. */
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
/* Retire accents, ponctuation et majuscules : la recherche doit trouver
   "Defense sicilienne" quand on tape "defense sicilien", et "1.e4 c5" quand
   on tape "e4c5". */
function sansAccent(t) {
  return String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
  return SECTIONS[lang === "fr" ? "fr" : "en"].map(([href, nom]) => {
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
function shell(title, desc, canonical, body, jsonld, lang, alts, otherUrl, ogImage, noindex) {
  lang = lang || "en";
  const d = L[lang];
  const other = lang === "fr" ? "en" : "fr";
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
${noindex ? '<meta name="robots" content="noindex,follow">' : ""}
<!-- Les icones existaient mais n'etaient declarees nulle part hors du
     manifeste : invisibles dans l'onglet du navigateur et dans les resultats
     de recherche. -->
<link rel="icon" href="/icon-192.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon-192.svg">
${alts || ""}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="${lang === "fr" ? "fr_FR" : "en_GB"}">
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
     Chemins relatifs a la racine ("/fonts/...", pas "${SITE}/fonts/...") :
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
@font-face{font-family:'Source Serif 4';font-style:normal;font-weight:600;font-display:optional;src:url(/fonts/source-serif-4-v14-latin-600.woff2) format('woff2')}
@font-face{font-family:'Archivo';font-style:normal;font-weight:400;font-display:optional;src:url(/fonts/archivo-v25-latin-400.woff2) format('woff2')}
@font-face{font-family:'Archivo';font-style:normal;font-weight:500;font-display:optional;src:url(/fonts/archivo-v25-latin-500.woff2) format('woff2')}
@font-face{font-family:'Archivo';font-style:normal;font-weight:600;font-display:optional;src:url(/fonts/archivo-v25-latin-600.woff2) format('woff2')}
@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:500;font-display:optional;src:url(/fonts/jetbrains-mono-v24-latin-500.woff2) format('woff2')}
@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:700;font-display:optional;src:url(/fonts/jetbrains-mono-v24-latin-700.woff2) format('woff2')}
${CSS}</style>
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
  if (d["@type"] === "Article" || d["@type"] === "LearningResource") {
    d.author = d.author || { "@type": "Person", name: PUBLISHER.name };
    d.publisher = d.publisher || { "@type": "Organization", name: "chang64", url: SITE };
    d.dateModified = d.dateModified || BUILD_DATE;
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
  if (!isIndex) items.push({ name: title.replace(/\s*\|\s*chang64\s*$/, ""), item: canonical });
  if (items.length < 2) return "";
  return '<script type="application/ld+json">' + JSON.stringify({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.item }))
  }) + "</script>";
})()}
</head>
<body>
<div class="wrap">
<header>
  <a class="brand" href="/">${brandMark()}<span class="names"><span class="bname">chang<span class="sixtyfour">64</span></span><span class="tagline">${lang === "fr" ? "L'éléphant sur 64 cases" : "The elephant on 64 squares"}</span></span></a>
  <!-- Un seul menu, les memes six sections qu'ailleurs. "Jouer" a ete retire :
       le logo ramene deja a l'accueil, l'entree faisait doublon et prenait la
       place du contenu. Sur ecran etroit la rangee defile horizontalement,
       comme les onglets de l'application. -->
  ${otherUrl ? (() => {
    /* Chaque langue est une page distincte : la pastille pointe vers la page
       courante pour la langue active, et vers son equivalent pour l'autre. */
    const ici = canonical.replace(SITE, "");
    const la = String(otherUrl).replace(SITE, "");
    const urlEn = lang === "en" ? ici : la;
    const urlFr = lang === "fr" ? ici : la;
    return `<div class="langsw" role="group" aria-label="${lang === "fr" ? "Langue" : "Language"}">
    <a href="${urlEn}" hreflang="en" rel="alternate"${lang === "en" ? ' aria-current="true"' : ""}>EN</a>
    <a href="${urlFr}" hreflang="fr" rel="alternate"${lang === "fr" ? ' aria-current="true"' : ""}>FR</a>
  </div>`;
  })() : ""}
  <nav class="sitenav">${sectionLinks(lang, canonical)}</nav>
</header>
${body}
<footer>
  <!-- Plus de menu ici : les six sections sont desormais dans l'entete, le
       repeter en bas etait un doublon. Le pied de page garde son role
       classique, les liens legaux. -->
  <nav class="footnav" aria-label="${lang === "fr" ? "Informations légales" : "Legal information"}">
    <a href="/">${lang === "fr" ? "Accueil" : "Home"}</a>
    <a href="/#legal">${lang === "fr" ? "Mentions légales" : "Legal notice"}</a>
    <a href="/#privacy">${lang === "fr" ? "Confidentialité" : "Privacy"}</a>
    <a href="/#prefs">${lang === "fr" ? "Préférences" : "Preferences"}</a>
    <a href="/#accessibilite">${lang === "fr" ? "Accessibilité" : "Accessibility"}</a>
  </nav>
  <p class="footnote">${d.foot}</p>
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
  var fr=document.documentElement.lang==="fr";
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
      .toLowerCase().replace(/[^a-z0-9]+/g," ").trim()
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
    etat.textContent = vus===0
      ? (fr?"Aucun résultat.":"No match.")
      : (fr?vus+" sur "+total:vus+" of "+total);
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

{
  const map = {};
  for (const p of pages) map[p.family] = { en: p.slugEn, fr: p.slugFr };
  ui2 = ui2.replace("__OPENING_SLUGS__", JSON.stringify(map));
  app = app.replace("__OPENING_SLUGS__", JSON.stringify(map));
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
function urlFor(lang, p) { return `${SITE}/${L[lang].dir}/${lang === "fr" ? p.slugFr : p.slugEn}.html`; }
function altLinks(p) {
  return `<link rel="alternate" hreflang="en" href="${urlFor("en", p)}">\n` +
         `<link rel="alternate" hreflang="fr" href="${urlFor("fr", p)}">\n` +
         `<link rel="alternate" hreflang="x-default" href="${urlFor("en", p)}">`;
}
fs.mkdirSync(OUT + "/fr/ouvertures", { recursive: true });

for (const lang of ["en", "fr"]) {
  const d = L[lang];
  for (const p of pages) {
    const name = lang === "fr" ? p.nameFr : p.family;
    const note = lang === "fr" ? p.noteFr : p.note;
    const ecoRange = p.ecos[0] + (p.ecos.length > 1 ? "\u2013" + p.ecos[p.ecos.length - 1] : "");
    const fallback = lang === "fr"
      ? `La ${name} commence par ${numbered(p.main.moves)} (ECO ${ecoRange}). Cette page recense ses ${p.count} variante${p.count > 1 ? "s" : ""} répertoriée${p.count > 1 ? "s" : ""} avec leurs coups et leurs codes ECO, sur un échiquier depuis lequel tu peux jouer contre le moteur.`
      : `The ${name} begins ${numbered(p.main.moves)} (ECO ${ecoRange}). This page lists its ${p.count} named variation${p.count > 1 ? "s" : ""} with their moves and ECO codes, on a board you can play from against the engine.`;
    const desc = metaDesc(note ? note + (lang === "fr" ? ` La ${name} couvre les codes ECO ${ecoRange}.` : ` The ${name} covers ECO ${ecoRange}.`) : fallback);
    const alsoKnown = (lang === "fr" && p.nameFr !== p.family)
      ? `<p style="font-size:13px;color:var(--sage)">Nom anglais couramment utilisé : <strong>${esc(p.family)}</strong>.</p>` : "";
    const rows = p.variations.map(v =>
      `<tr><td>${esc(v.variation ? (lang === "fr" ? varFr(v.variation) : v.variation) : (lang === "fr" ? "Ligne principale" : "Main line"))}</td><td class="mono">${esc(numbered(v.moves))}</td><td class="mono">${v.eco}</td></tr>`).join("");
    const other = lang === "fr" ? "en" : "fr";
    /* desc sert la balise meta et le referencement : elle contient la note
       d'ouverture, laquelle est aussi affichee dans le corps. La reprendre
       en chapo faisait relire la meme phrase deux fois de suite. Le chapo
       annonce donc ce que contient la page, la note reste a sa place. */
    const chapo = lang === "fr"
      ? `${numbered(p.main.moves)} · ${p.ecos.join(", ")} · ${p.count} ligne${p.count > 1 ? "s" : ""} répertoriée${p.count > 1 ? "s" : ""}, avec un échiquier pour les jouer.`
      : `${numbered(p.main.moves)} · ${p.ecos.join(", ")} · ${p.count} named line${p.count > 1 ? "s" : ""}, with a board to play them from.`;
    const body = `
<h1>${esc(name)}</h1>
<p class="lede">${esc(chapo)}</p>
<div class="cols">
  <div class="diagram">${animBoard(p.main.moves, 300, {
      start: lang === "fr" ? "Position de départ" : "Starting position",
      aria:  lang === "fr" ? `Échiquier : ${name} après ${numbered(p.main.moves)}`
                           : `Chessboard: ${name} after ${numbered(p.main.moves)}`,
      prev:  lang === "fr" ? "Coup précédent" : "Previous move",
      play:  lang === "fr" ? "Rejouer la ligne" : "Replay the line",
      next:  lang === "fr" ? "Coup suivant" : "Next move"
    }) || boardSvg(p.fen, 300)}
    <p style="font-size:12px;color:var(--sage);margin:8px 0 0">${d.posAfter} ${esc(numbered(p.main.moves))}</p>
    <p style="font-size:12px;color:var(--sage);margin:4px 0 0">${lang === "fr"
      ? "Les flèches ci-dessus rejouent cette ligne, coup par coup. Pour l'affronter toi-même, utilise le bouton à droite."
      : "The arrows above replay this line, move by move. To try it yourself, use the button on the right."}</p>
  </div>
  <div>
    <div class="moves">${esc(numbered(p.main.moves))}</div>
    <div>${p.ecos.map(e => `<span class="eco">${e}</span>`).join("")}</div>
    ${alsoKnown}
    ${note ? `<p>${esc(note)}</p>` : ""}
    <p>${esc(d.listIntro(p.count, name))}</p>
    <a class="cta" href="/#line=${encodeURIComponent(p.main.moves.split(" ").join("_"))}">${d.play}</a>
    <a class="cta ghost" href="${d.index}">${d.all}</a>
  </div>
</div>
<h2>${d.namedLines}</h2>
<div class="tablewrap"><table><thead><tr><th>${d.variation}</th><th>${d.movesHead}</th><th>ECO</th></tr></thead><tbody>${rows}</tbody></table></div>
${p.count > p.variations.length ? `<p>${esc(d.showing(p.variations.length, p.count))}</p>` : ""}
`;
    const jsonld = { "@context": "https://schema.org", "@type": "Article",
      headline: name + (lang === "fr" ? " : ouverture d'échecs" : " chess opening"),
      description: desc, inLanguage: lang,
      about: { "@type": "Thing", name: name },
      isPartOf: { "@type": "WebSite", name: "chang64", url: SITE } };
    let title = lang === "fr"
      ? `${name} : coups, variantes et codes ECO | chang64`
      : `${name} : moves, variations and ECO codes | chang64`;
    if (title.length > 70) title = `${name} : ${lang === "fr" ? "coups et variantes" : "moves and variations"} | chang64`;
    if (title.length > 70) title = `${name} | chang64`;
    const ogName = "op-" + p.slugEn;
    if (lang === "en") queueOg(ogName, p.family, numbered(p.main.moves) + "  \u00b7  ECO " + ecoRange, p.fen);
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
    fs.writeFileSync(`${OUT}/${d.dir}/${lang === "fr" ? p.slugFr : p.slugEn}.html`,
      shell(title, desc, urlFor(lang, p), body, jsonld, lang, altLinks(p), urlFor(other, p), `${SITE}/og/${ogName}.png`, sansNote));
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
         placeholder="${lang === "fr" ? "Chercher : nom, coups ou code ECO" : "Search: name, moves or ECO code"}"
         aria-label="${lang === "fr" ? "Filtrer les ouvertures" : "Filter openings"}"
         aria-controls="grille">
  <!-- Une ouverture implique toujours les deux camps : le classement
       Blancs/Noirs suit la tradition (qui choisit cette ouverture pour son
       repertoire), pas une propriete stricte de la position. Absent par
       defaut ("Toutes"), pour ne pas presenter un jugement comme un fait
       la ou une seule case le distinguerait mal. -->
  <div class="cotefiltre" id="coteFiltre" role="group" aria-label="${lang === "fr" ? "Filtrer par camp" : "Filter by side"}">
    <button type="button" data-side="all" aria-pressed="true">${lang === "fr" ? "Toutes" : "All"}</button>
    <button type="button" data-side="w" aria-pressed="false">${lang === "fr" ? "Blancs" : "White"}</button>
    <button type="button" data-side="b" aria-pressed="false">${lang === "fr" ? "Noirs" : "Black"}</button>
  </div>
  <p class="filtre-etat" id="filtreEtat" role="status" aria-live="polite"></p>
</div>
<div class="grid" id="grille">
${pages.map(p => {
  /* data-cle porte tout ce sur quoi on peut chercher : le nom dans les deux
     langues, les coups et les codes ECO. Sans accents ni ponctuation, pour
     que "defense" trouve "Défense" et "e4c5" trouve "1.e4 c5". */
  const cle = sansAccent([
    lang === "fr" ? p.nameFr : p.family,
    lang === "fr" ? p.family : p.nameFr,
    numbered(p.main.moves),
    p.ecos.join(" ")
  ].join(" "));
  return `<a class="tile" data-cle="${esc(cle)}" data-side="${p.side}" href="${d.index}${lang === "fr" ? p.slugFr : p.slugEn}.html"><b>${esc(lang === "fr" ? p.nameFr : p.family)}</b><span>${esc(numbered(p.main.moves))} · ${esc(p.ecos.join(" "))}</span></a>`;
}).join("\n")}
</div>`;
  const idxAlt = `<link rel="alternate" hreflang="en" href="${SITE}/openings/">\n<link rel="alternate" hreflang="fr" href="${SITE}/fr/ouvertures/">\n<link rel="alternate" hreflang="x-default" href="${SITE}/openings/">`;
  fs.writeFileSync(`${OUT}/${d.dir}/index.html`,
    shell(d.idxTitle, d.idxDesc(pages.length, lines.length), SITE + d.index, idxBody,
      { "@context": "https://schema.org", "@type": "CollectionPage", name: d.idxH1, url: SITE + d.index, inLanguage: lang },
      lang, idxAlt, SITE + (lang === "fr" ? "/openings/" : "/fr/ouvertures/"),
      SITE + "/og/" + (lang === "fr" ? "ouvertures" : "openings") + ".png"));
}

/* ---------- 4. manifest, service worker, robots, sitemap ---------- */
fs.writeFileSync(OUT + "/manifest.webmanifest", JSON.stringify({
  name: "chang64 : chess and tactics", short_name: "chang64",
  description: "Play chess, solve verified tactics puzzles and train endgames. No account required.",
  start_url: "/", scope: "/", display: "standalone",
  background_color: "#101413", theme_color: "#101413", orientation: "any",
  icons: [
    { src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
    { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" }
  ]
}, null, 2));

const markPaths = (fs.readFileSync(path.join(__dirname, "ds/mark-on-dark.svg"), "utf8").match(/<path d="[^"]+"/g) || [])
  .map(m => m.slice(9, -1));
for (const size of [192, 512]) {
  fs.writeFileSync(`${OUT}/icon-${size}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">` +
    `<rect width="64" height="64" rx="14" fill="#191F1D"/>` +
    `<g fill="#E0A93B">${markPaths.map(d => `<path d="${d}"/>`).join("")}</g></svg>`);
}

const SW_VERSION = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
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
const CORE=["/","/index.html","/manifest.webmanifest","/icon-192.svg","/icon-512.svg","/openings/"];
self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()).catch(()=>{}));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",e=>{
  const r=e.request;
  if(r.method!=="GET")return;
  const url=new URL(r.url);
  if(url.origin!==location.origin)return;
  if(url.pathname.startsWith("/engine/"))return;   // 7 MB engine stays out of the cache
  /* Les shards d'exercices (17 Mo au total : level-1..10, rush-pool,
     puzzle-index) etaient mis en cache sans plafond. Sur iOS le quota par
     origine est etroit et son depassement evince le cache ENTIER, coquille
     de l'application comprise : le site tombait alors hors ligne d'un coup.
     Ces fichiers sont deja gardes par le cache HTTP du navigateur, donc les
     exclure ici ne coute qu'un aller-retour au premier chargement et met la
     coquille a l'abri. */
  if(url.pathname.startsWith("/data/"))return;
  e.respondWith(
    caches.match(r).then(hit=>hit||fetch(r).then(resp=>{
      const copy=resp.clone();
      caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{});
      return resp;
    }).catch(()=>caches.match("/index.html")))
  );
});
`);

/* Les jetons de familles et de lignes ne peuvent etre substitues qu'ici :
   ils dependent du livre d'ouvertures, charge apres l'assemblage. */
app = app.split("__NF__").join(NF).split("__NL__").join(NL);
fs.writeFileSync(OUT + "/index.html", app);
fs.writeFileSync(path.join(__dirname, "site-index.html"), app);

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
   si jamais il tourne, la CSP n'etant qu'un filet de securite. */
fs.writeFileSync(OUT + "/_headers", `/*
  X-Content-Type-Options: nosniff
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; frame-src https://www.youtube-nocookie.com; frame-ancestors 'self'; base-uri 'self'; form-action 'none'
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: geolocation=(), microphone=(), camera=()

/engine/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable
  Content-Type: font/woff2

/*.svg
  Cache-Control: public, max-age=604800

/*.webmanifest
  Content-Type: application/manifest+json

/engine/*.wasm
  Content-Type: application/wasm

/engine/*.js
  Content-Type: text/javascript

/index.html
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
   qui creeraient une boucle. */
const frSlugs = new Set(pages.map(p => p.slugFr));
const oldFrRedirects = pages
  .filter(p => p.slugFr !== p.slugEn && !frSlugs.has(p.slugEn))
  .map(p => `/fr/ouvertures/${p.slugEn}.html  /fr/ouvertures/${p.slugFr}.html  301`)
  .join("\n");
console.log("Redirections FR    :", oldFrRedirects ? oldFrRedirects.split("\n").length : 0);

fs.writeFileSync(OUT + "/_redirects", `/fr            /fr/ouvertures/       301
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
<p class="lede">This page does not exist. Cette page n'existe pas.</p>
<div class="grid">
  <a class="tile" href="/"><b>Play chess</b><span>chang64.com</span></a>
  <a class="tile" href="/openings/"><b>Openings</b><span>${NF} families</span></a>
  <a class="tile" href="/fr/ouvertures/"><b>Ouvertures</b><span>${NF} familles</span></a>
  <a class="tile" href="/puzzles/"><b>Puzzles</b><span>${puzzles.length} positions</span></a>
</div>`;
  fs.writeFileSync(OUT + "/404.html",
    shell("Page not found | chang64", "This page does not exist on chang64.", SITE + "/404.html", body, null, "en", '<meta name="robots" content="noindex">', null));
}

fs.writeFileSync(OUT + "/robots.txt", `User-agent: *\nAllow: /\nDisallow: /engine/\n\nSitemap: ${SITE}/sitemap.xml\n`);

const today = BUILD_DATE;   /* meme date que dateModified des fiches JSON-LD */
const extraUrls = require("./content.js")({
  fs, OUT, SITE, shell, boardSvg, esc, numbered, Game, puzzles, slug, L, sansAccent, metaDesc
});
console.log("Pages de contenu   :", extraUrls.length);
try {
  require("child_process").execSync(`python3 "${path.join(__dirname, "og_render.py")}"`, { stdio: "inherit" });
} catch (e) { console.log("ATTENTION : conversion des images de partage impossible"); }
console.log("Images de partage  :", ogJobs.length);

/* Seules les familles pourvues d'une note redigee entrent au sitemap : les
   autres portent un meta robots noindex (voir plus haut), et declarer au
   sitemap une page qu'on demande par ailleurs de ne pas indexer est un
   signal contradictoire que la Search Console remonte comme une erreur.
   Meme condition des deux cotes, meme source (FAMILY_NOTES/NOTES_FR). */
const pagesIndexables = pages.filter(p => p.note || p.noteFr);
const urls = [
  { loc: SITE + "/", pri: "1.0", alt: null },
  { loc: SITE + "/openings/", pri: "0.9", alt: SITE + "/fr/ouvertures/", lang: "en" },
  { loc: SITE + "/fr/ouvertures/", pri: "0.9", alt: SITE + "/openings/", lang: "fr" },
  ...pagesIndexables.map(p => ({ loc: urlFor("en", p), pri: "0.7", alt: urlFor("fr", p), lang: "en" })),
  ...pagesIndexables.map(p => ({ loc: urlFor("fr", p), pri: "0.7", alt: urlFor("en", p), lang: "fr" })),
  ...extraUrls
];
fs.writeFileSync(OUT + "/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
  urls.map(u => {
    const other = u.lang === "fr" ? "en" : "fr";
    const alts = u.alt
      ? `\n    <xhtml:link rel="alternate" hreflang="${u.lang}" href="${u.loc}"/>` +
        `\n    <xhtml:link rel="alternate" hreflang="${other}" href="${u.alt}"/>` +
        `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${u.lang === "en" ? u.loc : u.alt}"/>`
      : "";
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
console.log("Poids du site      :", (total / 1048576).toFixed(1), "Mo");
