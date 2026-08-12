const fs = require("fs");
const path = require("path");
const { Game, pType, pColor } = require("./engine.js");

const OUT = path.join(__dirname, "site");
const SITE = "https://chang64.com";

/* ---------- 1. application ---------- */
const THEMES = JSON.parse(fs.readFileSync(path.join(__dirname, "themes.json"), "utf8"));
const puzzles = JSON.parse(fs.readFileSync(path.join(__dirname, "puzzles.json"), "utf8"));
for (const p of puzzles) if (THEMES[p.theme]) p.theme = THEMES[p.theme];

const engine = fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8");
const pieces = fs.readFileSync(path.join(__dirname, "pieces_browser.js"), "utf8");
let ui = fs.readFileSync(path.join(__dirname, "ui.js"), "utf8").replace("__PUZZLES__", JSON.stringify(puzzles));
let ui2 = fs.readFileSync(path.join(__dirname, "ui2.js"), "utf8");
// la table famille -> adresses de pages est construite plus bas, après le calcul des slugs
let ui3 = fs.readFileSync(path.join(__dirname, "ui3.js"), "utf8");
const i18n = fs.readFileSync(path.join(__dirname, "i18n.js"), "utf8");
/* Le nombre d'exercices etait ecrit en dur a neuf endroits : accueil, meta
   description, image de partage, donnees structurees, tuiles de navigation,
   dans les deux langues. Il devenait faux des qu'on enrichissait la banque.
   Un seul jeton, remplace ici a partir du fichier reel. */
const NP = String(puzzles.length);
let app = fs.readFileSync(path.join(__dirname, "template.html"), "utf8")
  .replace("/*__I18N__*/", i18n)
  .replace("/*__ENGINE__*/", engine).replace("/*__PIECES__*/", pieces)
  .replace("/*__UI__*/", ui).replace("/*__UI2__*/", ui2).replace("/*__UI3__*/", ui3)
  .split("__NP__").join(NP);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT + "/openings", { recursive: true });
fs.mkdirSync(OUT + "/engine", { recursive: true });
fs.mkdirSync(OUT + "/og", { recursive: true });
/* Livre d'ouvertures servi a part : 94 Ko retires de index.html, charges
   seulement quand une partie commence (voir loadOpeningBook dans ui2.js). */
fs.writeFileSync(OUT + "/openings-book.json", fs.readFileSync(path.join(__dirname, "openings.json"), "utf8"));
const ogJobs = [];
// index.html est écrit plus bas, après injection de la table des ouvertures

/* ---------- 2. Stockfish ---------- */
for (const f of ["stockfish-18-lite-single.js", "stockfish-18-lite-single.wasm"]) {
  fs.copyFileSync(path.join(__dirname, "sf/package/bin", f), OUT + "/engine/" + f);
}
fs.copyFileSync(path.join(__dirname, "sf/package/Copying.txt"), OUT + "/engine/LICENSE-GPLv3.txt");
/* chang64 distribue Stockfish, donc son propre code est sous GPL v3.
   Ces trois fichiers sont ecrits ici parce que le rmSync ci-dessus vide OUT
   a chaque construction : les poser a la main dans le site livre ne tiendrait
   pas. Les originaux vivent a cote des sources, dans licence/. */
fs.copyFileSync(path.join(__dirname, "sf/package/Copying.txt"), OUT + "/LICENSE");
for (const f of ["COPYING.CONTENT", "README.md"]) {
  /* Le README annonce lui aussi des quantites : on y substitue le meme jeton
     que dans le site, sinon il derive comme le reste. */
  const txt = fs.readFileSync(path.join(__dirname, "licence/") + f, "utf8").split("__NP__").join(NP);
  fs.writeFileSync(OUT + "/" + f, txt);
}
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

const PIECE_SHAPES = (() => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, "ds/pieces.json"), "utf8"));
  return { p: j.pawn, n: j.knight, b: j.bishop, r: j.rook, q: j.queen, k: j.king };
})();

function boardSvg(fen, size) {
  const S = size / 8;
  const rows = fen.split(" ")[0].split("/");
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
    const paths = PIECE_SHAPES[ch.toLowerCase()].map(d => `<path d="${d}"/>`).join("");
    defs += `<symbol id="p${white ? "w" : "b"}${ch.toLowerCase()}" viewBox="0 0 45 45">` +
      `<g fill="${white ? "#F7F4EC" : "#15201C"}" stroke="${white ? "#15201C" : "#D8D2C4"}"` +
      ` stroke-width="1" stroke-linejoin="round" stroke-linecap="round">${paths}</g></symbol>`;
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
    const paths = PIECE_SHAPES[t].map(p => `<path d="${p}"/>`).join("");
    for (const white of [true, false]) {
      d += `<symbol id="${white ? "w" : "b"}${t}" viewBox="0 0 45 45">` +
        `<g fill="${white ? "#F7F4EC" : "#15201C"}" stroke="${white ? "#15201C" : "#D8D2C4"}"` +
        ` stroke-width="1" stroke-linejoin="round" stroke-linecap="round">${paths}</g></symbol>`;
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
    <button type="button" data-act="prev" aria-label="${esc(labels.prev)}">&#8249;</button>
    <button type="button" data-act="play" aria-label="${esc(labels.play)}">&#9654;</button>
    <button type="button" data-act="next" aria-label="${esc(labels.next)}">&#8250;</button>
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

const pages = [];
for (const [family, list] of families) {
  const main = list.slice().sort((a, b) => a.moves.split(" ").length - b.moves.split(" ").length)[0];
  const fen = fenAfter(main.moves);
  if (!fen) continue;
  const ecos = [...new Set(list.map(l => l.eco))].sort();
  const variations = list.slice().sort((a, b) => a.moves.length - b.moves.length).slice(0, 40);
  const nameFr = FAMILY_FR[family] || family;
  pages.push({ family, nameFr, slugEn: slug(family), slugFr: slug(nameFr),
    main, fen, ecos, variations, count: list.length,
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

const CSS = `*{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#EDE4D2;--slate:#F5F0E5;--raise:#E3DAC7;--chalk:#15201C;--sage:#5A6862;
--bone:#EDE4D2;--board:#4B6B63;--brass:#7E5409;--jade:#1E7A4C;--brick:#A3382A;
--rule:rgba(21,32,28,.14);--r:8px}
body{background:var(--ink);color:var(--chalk);
font-family:'Archivo',ui-sans-serif,system-ui,sans-serif;font-size:16px;line-height:1.55;padding:20px 16px 60px}
.wrap{max-width:880px;margin:0 auto}
a{color:var(--brass)}
header{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:22px;
padding-bottom:14px;border-bottom:1px solid var(--rule)}
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
header nav{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin:0;min-width:0}
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
  width:30px;height:28px;font-size:13px;line-height:1;cursor:pointer;padding:0}
.animctl button:hover{background:var(--board);color:var(--slate)}
.animctl button:disabled{opacity:.38;cursor:default}
.animctl button:disabled:hover{background:var(--slate);color:var(--board)}
.animctl button:focus-visible{outline:2px solid var(--brass);outline-offset:2px}
.animply{font-size:12px;color:var(--sage);font-variant-numeric:tabular-nums}
.diagram svg{width:100%;height:auto;display:block;border-radius:2px}
.moves{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:14px;letter-spacing:.02em;background:var(--slate);
border:1px solid var(--rule);border-radius:var(--r);padding:12px 14px;margin-bottom:14px}
.eco{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:500;color:var(--brass);
border:1px solid var(--rule);border-radius:var(--r);padding:3px 9px;margin:0 6px 6px 0}
table{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:14px}
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
h2{scroll-margin-top:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.tile{background:var(--slate);border:1px solid var(--rule);border-radius:12px;padding:14px;text-decoration:none;display:block}
.tile:hover{border-color:var(--brass)}
.tile b{display:block;color:var(--chalk);font-size:15px;margin-bottom:3px}
.tile span{color:var(--sage);font-size:13px;font-family:'JetBrains Mono',monospace;font-weight:500}
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--rule);color:var(--sage);font-size:13px}
.filtre{margin-bottom:18px}
.filtre input{width:100%;max-width:520px;box-sizing:border-box;font:inherit;font-size:15px;
  padding:11px 14px;border:1px solid var(--rule);border-radius:10px;
  background:var(--slate);color:var(--chalk)}
.filtre input:focus{outline:2px solid var(--brass);outline-offset:1px;border-color:var(--brass)}
.filtre-etat{margin:8px 0 0;font-size:13px;color:var(--sage);min-height:1.2em}
/* Menu principal : une seule rangee, qui defile sur ecran etroit plutot que
   d'elargir la page. Meme mecanique que les onglets de l'application. */
.sitenav{display:flex;gap:8px 18px;overflow-x:auto;min-width:0;flex:1 1 auto;
  scrollbar-width:none;-webkit-overflow-scrolling:touch}
.sitenav::-webkit-scrollbar{display:none}
.sitenav a,.sitenav span{white-space:nowrap;text-decoration:none;color:var(--sage);font-size:14.5px}
.sitenav a:hover{color:var(--brass)}
.sitenav [aria-current="page"]{color:var(--chalk);font-weight:600}
/* Bascule de langue : meme forme que dans l'application, une pastille qui
   montre les deux langues et celle qui est active. Ici ce sont deux liens,
   chaque langue etant une page distincte. */
.langsw{display:flex;gap:2px;background:var(--slate);border:1px solid var(--rule);
  border-radius:999px;padding:3px;flex:none}
.langsw a{font-size:12.5px;font-weight:600;letter-spacing:.04em;text-decoration:none;
  color:var(--sage);padding:5px 11px;border-radius:999px;line-height:1}
.langsw a[aria-current="true"]{background:var(--raise);color:var(--chalk)}
.langsw a:hover{color:var(--chalk)}
.footnav{display:flex;flex-wrap:wrap;gap:8px 18px;margin-bottom:14px}
.footnav a{color:var(--chalk);text-decoration:none;font-weight:500}
.footnav a:hover{text-decoration:underline}
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

/* Liens vers toutes les sections, dans la langue de la page. La page en cours
   est signalee et non cliquable : un lien vers soi-meme n'apporte rien. */
const SECTIONS = {
  en: [
    ["/openings/", "Openings"], ["/puzzles/", "Puzzles"], ["/learn/", "Rules"],
    ["/endgames/", "Endgames"], ["/traps/", "Opening traps"], ["/glossary/", "Glossary"]
  ],
  fr: [
    ["/fr/ouvertures/", "Ouvertures"], ["/fr/exercices/", "Exercices"], ["/fr/apprendre/", "Apprendre"],
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
  return SECTIONS[lang === "fr" ? "fr" : "en"].map(([href, nom]) =>
    ici === href
      ? `<span aria-current="page">${nom}</span>`
      : `<a href="${href}">${nom}</a>`
  ).join("");
}

function shell(title, desc, canonical, body, jsonld, lang, alts, otherUrl, ogImage) {
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600&family=Archivo:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
${jsonld ? '<script type="application/ld+json">' + JSON.stringify(jsonld) + "</script>" : ""}
</head>
<body>
<div class="wrap">
<header>
  <a class="brand" href="/">${brandMark()}<span class="names"><span class="bname">chang<span class="sixtyfour">64</span></span><span class="tagline">${lang === "fr" ? "L'éléphant sur 64 cases" : "The elephant on 64 squares"}</span></span></a>
  <!-- Un seul menu, les memes six sections qu'ailleurs. "Jouer" a ete retire :
       le logo ramene deja a l'accueil, l'entree faisait doublon et prenait la
       place du contenu. Sur ecran etroit la rangee defile horizontalement,
       comme les onglets de l'application. -->
  <nav class="sitenav">${sectionLinks(lang, canonical)}</nav>
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
</header>
${body}
<footer>
  <!-- Plus de menu ici : les six sections sont desormais dans l'entete, le
       repeter en bas etait un doublon. Le pied de page garde son role
       classique, les liens legaux. -->
  <nav class="footnav" aria-label="${lang === "fr" ? "Informations légales" : "Legal information"}">
    <a href="/#legal">${lang === "fr" ? "Mentions légales" : "Legal notice"}</a>
    <a href="/#privacy">${lang === "fr" ? "Confidentialité" : "Privacy"}</a>
    <a href="/#prefs">${lang === "fr" ? "Préférences" : "Preferences"}</a>
    <a href="/#accessibilite">${lang === "fr" ? "Accessibilité" : "Accessibility"}</a>
    <a href="/">${lang === "fr" ? "Accueil" : "Home"}</a>
  </nav>
  <p class="footnote">${d.foot}</p>
</footer>
</div>
<script>
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

  function normalise(t){
    return String(t).normalize?String(t).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLowerCase().replace(/[^a-z0-9]+/g," ").trim()
      :String(t).toLowerCase();
  }
  function filtrer(){
    var q=normalise(champ.value);
    if(!q){
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
      var ok=true;
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
  function stop(){if(timer){clearInterval(timer);timer=null;}
    if(btn.play)btn.play.innerHTML="&#9654;";}
  function playFrom(n){
    stop(); show(n);
    if(btn.play)btn.play.innerHTML="&#10073;&#10073;";
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
        nav: ["Play", "Openings", "Puzzles"], all: "All openings", play: "Play this opening",
        namedLines: "Named lines", variation: "Variation", movesHead: "Moves",
        posAfter: "Position after", showing: (a, b) => `Showing the ${a} shortest of ${b} known lines.`,
        listIntro: (n, f) => `This page lists ${n} named line${n > 1 ? "s" : ""} in the ${f}, taken from the open Lichess opening database. You can play any of them against the built-in engine and have the game reviewed move by move afterwards.`,
        idxTitle: "Chess openings: every named line with moves and ECO codes | chang64",
        idxH1: "Chess openings",
        idxLede: (a, b) => `Every named opening family, with its moves, its variations and a board you can play from. ${a} families, ${b} named lines.`,
        idxDesc: (a, b) => `A complete index of ${a} chess opening families and ${b} named lines, each with its moves, ECO code and a playable board.`,
        foot: "chang64 : free chess, no account required. Opening data from the lichess-org/chess-openings project." },
  fr: { dir: "fr/ouvertures", index: "/fr/ouvertures/", label: "Français",
        nav: ["Jouer", "Ouvertures", "Exercices"], all: "Toutes les ouvertures", play: "Jouer cette ouverture",
        namedLines: "Variantes répertoriées", variation: "Variante", movesHead: "Coups",
        posAfter: "Position après", showing: (a, b) => `Les ${a} lignes les plus courtes sur ${b} répertoriées.`,
        listIntro: (n, f) => `Cette page recense ${n} ligne${n > 1 ? "s" : ""} répertoriée${n > 1 ? "s" : ""} dans la ${f}, d'après la base d'ouvertures libre de Lichess. Tu peux jouer chacune d'elles contre le moteur intégré, puis faire analyser la partie coup par coup.`,
        idxTitle: "Ouvertures d'échecs : variantes, coups et codes ECO | chang64",
        idxH1: "Ouvertures d'échecs",
        idxLede: (a, b) => `Toutes les familles d'ouvertures, avec leurs coups, leurs variantes et un échiquier pour les jouer. ${a} familles, ${b} lignes répertoriées.`,
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
    const desc = (note ? note + (lang === "fr" ? ` La ${name} couvre les codes ECO ${ecoRange}.` : ` The ${name} covers ECO ${ecoRange}.`) : fallback).replace(/\s+/g, " ").trim().slice(0, 300);
    const alsoKnown = (lang === "fr" && p.nameFr !== p.family)
      ? `<p style="font-size:13px;color:#93A99A">Nom anglais couramment utilisé : <strong>${esc(p.family)}</strong>.</p>` : "";
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
    <p style="font-size:12px;color:#93A99A;margin:8px 0 0">${d.posAfter} ${esc(numbered(p.main.moves))}</p>
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
<table><thead><tr><th>${d.variation}</th><th>${d.movesHead}</th><th>ECO</th></tr></thead><tbody>${rows}</tbody></table>
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
    fs.writeFileSync(`${OUT}/${d.dir}/${lang === "fr" ? p.slugFr : p.slugEn}.html`,
      shell(title, desc, urlFor(lang, p), body, jsonld, lang, altLinks(p), urlFor(other, p), `${SITE}/og/${ogName}.png`));
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
  return `<a class="tile" data-cle="${esc(cle)}" href="${d.index}${lang === "fr" ? p.slugFr : p.slugEn}.html"><b>${esc(lang === "fr" ? p.nameFr : p.family)}</b><span>${esc(numbered(p.main.moves))} · ${esc(p.ecos.join(" "))}</span></a>`;
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
fs.writeFileSync(OUT + "/_headers", `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: geolocation=(), microphone=(), camera=()

/engine/*
  Cache-Control: public, max-age=31536000, immutable

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

fs.writeFileSync(OUT + "/_redirects", `/fr            /fr/ouvertures/       302
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

const today = new Date().toISOString().slice(0, 10);
const extraUrls = require("./content.js")({
  fs, OUT, SITE, shell, boardSvg, esc, numbered, Game, puzzles, slug, L, sansAccent
});
console.log("Pages de contenu   :", extraUrls.length);
try {
  require("child_process").execSync(`python3 "${path.join(__dirname, "og_render.py")}"`, { stdio: "inherit" });
} catch (e) { console.log("ATTENTION : conversion des images de partage impossible"); }
console.log("Images de partage  :", ogJobs.length);

const urls = [
  { loc: SITE + "/", pri: "1.0", alt: null },
  { loc: SITE + "/openings/", pri: "0.9", alt: SITE + "/fr/ouvertures/", lang: "en" },
  { loc: SITE + "/fr/ouvertures/", pri: "0.9", alt: SITE + "/openings/", lang: "fr" },
  ...pages.map(p => ({ loc: urlFor("en", p), pri: "0.7", alt: urlFor("fr", p), lang: "en" })),
  ...pages.map(p => ({ loc: urlFor("fr", p), pri: "0.7", alt: urlFor("en", p), lang: "fr" })),
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
const size = p => fs.statSync(p).size;
console.log("index.html         :", Math.round(size(OUT + "/index.html") / 1024), "Ko");
let total = 0;
(function walk(d) { for (const f of fs.readdirSync(d)) { const fp = path.join(d, f); const st = fs.statSync(fp); st.isDirectory() ? walk(fp) : total += st.size; } })(OUT);
console.log("Poids du site      :", (total / 1048576).toFixed(1), "Mo");
