/* Génération des pages de contenu bilingues */
module.exports = function (H) {
  const { fs, OUT, SITE, shell, boardSvg, esc, numbered, Game, puzzles, slug, L, sansAccent, metaDesc } = H;
  const urls = [];
  const mk = d => fs.mkdirSync(OUT + "/" + d, { recursive: true });

  const DIRS = {
    learn:   { en: "learn",     fr: "fr/apprendre" },
    glossary:{ en: "glossary",  fr: "fr/lexique" },
    endgames:{ en: "endgames",  fr: "fr/finales" },
    puzzles: { en: "puzzles",   fr: "fr/exercices" },
    traps:   { en: "traps",     fr: "fr/pieges" }
  };
  for (const k in DIRS) for (const lang of ["en", "fr"]) mk(DIRS[k][lang]);
  mk("players");

  const UI = {
    /* Dix niveaux desormais (voir LEVELS dans ui.js) : ce descriptif de
       difficulte est propre aux pages de contenu, independant du nom de
       palier affiche dans l'application, mais doit couvrir les memes dix
       crans sous peine d'un u.levels[p.level-1] indefini sur les exercices
       les plus difficiles (level 6 a 10). */
    en: { play: "Play a game", back: "Back to the index", solution: "Show the solution",
          moves: "Moves", diagram: "Diagram", related: "Keep going", difficulty: "Difficulty",
          theme: "Theme", sideToMove: s => `${s} to move`, white: "White", black: "Black",
          levels: ["Very easy", "Easy", "Fairly easy", "Medium", "Fairly hard",
                   "Hard", "Quite hard", "Very hard", "Expert", "Master"] },
    fr: { play: "Jouer une partie", back: "Retour à l'index", solution: "Afficher la solution",
          moves: "Coups", diagram: "Diagramme", related: "Pour aller plus loin", difficulty: "Difficulté",
          theme: "Thème", sideToMove: s => `Trait aux ${s}`, white: "Blancs", black: "Noirs",
          levels: ["Très facile", "Facile", "Assez facile", "Moyen", "Assez difficile",
                   "Difficile", "Corsé", "Très difficile", "Expert", "Maître"] }
  };

  const THEME_FR = {
    "Mate in one": "Mat en un coup", "Mate in two": "Mat en deux coups", "Winning capture": "Prise gagnante",
    "Knight fork": "Fourchette de cavalier", "Pawn fork": "Fourchette de pion", "Double attack": "Attaque double",
    "Sacrifice": "Sacrifice", "Long-range attack": "Attaque à distance", "Winning move": "Coup gagnant",
    "Back-rank mate": "Mat du couloir", "Ladder mate": "Mat de l'escalier", "Smothered mate": "Mat étouffé",
    "Arabian mate": "Mat arabe", "Rook and king mate": "Mat tour et roi", "Queen and king mate": "Mat dame et roi",
    "Queen mate": "Mat de la dame", "Pin": "Clouage", "Deflection": "Déviation", "Skewer": "Enfilade",
    "King attack": "Attaque sur le roi", "Seventh rank": "Septième rangée", "Open file": "Colonne ouverte",
    "Diagonal": "Diagonale", "Long diagonal": "Grande diagonale", "Hanging piece": "Pièce en prise",
    "Promotion": "Promotion", "Central knight": "Cavalier central", "Advanced knight": "Cavalier avancé",
    "Mate defence": "Défense du mat", "Opposition": "Opposition", "Castling": "Roque",
    "Doubled rooks": "Doublement des tours", "Opera Game finish": "Finale de l'Opéra",
    "Scholar's mate": "Mat du berger", "Black to move": "Trait aux Noirs"
  };
  const themeOf = (th, lang) => lang === "fr" ? (THEME_FR[th] || th) : th;

  /* ---------- helpers ---------- */
  function page(lang, dir, file, title, desc, body, jsonld, altUrl, canonical) {
    const alts = altUrl
      ? `<link rel="alternate" hreflang="en" href="${lang === "en" ? canonical : altUrl}">\n` +
        `<link rel="alternate" hreflang="fr" href="${lang === "fr" ? canonical : altUrl}">\n` +
        `<link rel="alternate" hreflang="x-default" href="${lang === "en" ? canonical : altUrl}">`
      : "";
    fs.writeFileSync(`${OUT}/${dir}/${file}`, shell(title, desc, canonical, body, jsonld, lang, alts, altUrl));
    urls.push({ loc: canonical, pri: "0.6", alt: altUrl, lang });
  }
  function diagram(fen, caption) {
    return `<div class="diagram">${boardSvg(fen, 300)}${caption ? `<p style="font-size:12px;color:var(--sage);margin:8px 0 0">${esc(caption)}</p>` : ""}</div>`;
  }
  function sanLine(moves) {
    const g = new Game();
    const out = [];
    for (const san of moves) {
      const mv = g.moves().find(m => g.san(m).replace(/[+#]/g, "") === san.replace(/[+#!?]/g, ""));
      if (!mv) return null;
      out.push(g.san(mv));
      g.makeMove(mv);
    }
    return { san: out, fen: g.fen(), mate: g.isCheckmate() };
  }
  function numberLine(list) {
    let s = "";
    for (let i = 0; i < list.length; i += 2) s += (i / 2 + 1) + "." + list[i] + (list[i + 1] ? " " + list[i + 1] : "") + " ";
    return s.trim();
  }

  /* ================= 1. RULES ================= */
  const RULES = [
    { slug: { en: "how-the-pieces-move", fr: "deplacement-des-pieces" },
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      title: { en: "How the chess pieces move", fr: "Comment se déplacent les pièces d'échecs" },
      body: {
        en: ["Chess is played on 64 squares by two armies of sixteen pieces. Set the board so that each player has a light square in the bottom right corner, and put the queen on her own colour: the white queen on a light square, the black queen on a dark one.",
             "The <strong>rook</strong> moves any number of squares in a straight line, along a rank or a file. The <strong>bishop</strong> does the same along diagonals, which means each bishop stays on its starting colour for the whole game. The <strong>queen</strong> combines both and is by far the strongest piece.",
             "The <strong>knight</strong> moves in an L: two squares one way, then one square across. It is the only piece that jumps over others, which makes it awkward to defend against and dangerous in closed positions.",
             "The <strong>king</strong> moves one square in any direction. He is never captured, but he can never move into a square attacked by an enemy piece. The <strong>pawn</strong> moves forward one square, or two from its starting rank, but captures diagonally. That difference between how a pawn moves and how it takes is the source of most of the structure in a chess game."],
        fr: ["Les échecs se jouent sur 64 cases, avec deux armées de seize pièces. Oriente l'échiquier pour que chaque joueur ait une case claire en bas à droite, et pose la dame sur sa propre couleur : la dame blanche sur une case claire, la dame noire sur une case foncée.",
             "La <strong>tour</strong> se déplace d'autant de cases que l'on veut en ligne droite, sur une rangée ou une colonne. Le <strong>fou</strong> fait de même sur les diagonales, ce qui l'enferme sur la couleur de sa case de départ pour toute la partie. La <strong>dame</strong> combine les deux : c'est de loin la pièce la plus puissante.",
             "Le <strong>cavalier</strong> se déplace en L : deux cases dans une direction, puis une sur le côté. C'est la seule pièce qui saute par-dessus les autres, ce qui la rend difficile à contrer et redoutable dans les positions fermées.",
             "Le <strong>roi</strong> avance d'une case dans n'importe quelle direction. Il n'est jamais capturé, mais il ne peut jamais aller sur une case attaquée. Le <strong>pion</strong> avance d'une case, ou de deux depuis sa rangée de départ, mais capture en diagonale. Cette différence entre la façon dont il avance et celle dont il prend est à l'origine de presque toute la structure d'une partie."] } },
    { slug: { en: "castling", fr: "le-roque" },
      fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1",
      title: { en: "Castling: the rule and when to use it", fr: "Le roque : la règle et le bon moment" },
      body: {
        en: ["Castling is the only move where two pieces move at once. The king slides two squares towards a rook, and that rook jumps to the square the king crossed. Short castling goes towards the h-file, long castling towards the a-file.",
             "Four conditions must all hold: neither the king nor that rook has moved before, the squares between them are empty, the king is not currently in check, and he does not pass through or land on an attacked square. Note that the rook may be attacked, and may pass over an attacked square: only the king is restricted.",
             "In practice, castle early. It removes the king from the centre, where the files tend to open, and it connects the rooks. Most short games between beginners are decided by one side leaving the king in the middle for too long."],
        fr: ["Le roque est le seul coup où deux pièces bougent en même temps. Le roi glisse de deux cases vers une tour, et cette tour saute par-dessus lui pour se poser sur la case qu'il a traversée. Le petit roque se fait du côté de la colonne h, le grand roque du côté de la colonne a.",
             "Quatre conditions doivent être réunies : ni le roi ni cette tour n'ont bougé, les cases entre eux sont libres, le roi n'est pas en échec, et il ne traverse ni ne rejoint une case attaquée. À noter : la tour, elle, peut être attaquée et peut traverser une case attaquée. Seul le roi est contraint.",
             "En pratique, roque tôt. Cela éloigne le roi du centre, où les colonnes finissent par s'ouvrir, et cela relie les tours. La plupart des parties courtes entre débutants se décident parce qu'un camp a laissé son roi trop longtemps au milieu."] } },
    { slug: { en: "en-passant", fr: "la-prise-en-passant" },
      fen: "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3",
      title: { en: "En passant, the rule everyone forgets", fr: "La prise en passant, la règle que tout le monde oublie" },
      body: {
        en: ["When a pawn advances two squares from its starting rank and lands beside an enemy pawn, that enemy pawn may capture it as if it had only moved one square. The capture happens on the square the pawn skipped over.",
             "Two constraints make it easy to miss. It only works against a pawn that has just made a double step, and it must be played immediately: if you make any other move, the right is gone for good.",
             "The rule exists for a reason. Without it, the two-square first move introduced in the fifteenth century would have let pawns slip past enemy pawns unchallenged, which would have wrecked the balance of pawn structures."],
        fr: ["Quand un pion avance de deux cases depuis sa rangée de départ et se retrouve à côté d'un pion adverse, ce pion adverse peut le capturer comme s'il n'avait avancé que d'une case. La prise se fait sur la case survolée.",
             "Deux contraintes la rendent facile à rater. Elle ne vaut que contre un pion qui vient de faire son double pas, et elle doit être jouée immédiatement : si tu joues autre chose, le droit est perdu définitivement.",
             "La règle a une raison d'être. Sans elle, le double pas introduit au quinzième siècle aurait permis aux pions de franchir la ligne adverse sans être inquiétés, ce qui aurait déséquilibré toutes les structures de pions."] } },
    { slug: { en: "pawn-promotion", fr: "la-promotion-du-pion" },
      fen: "8/3P4/8/8/8/8/3k4/K7 w - - 0 1",
      title: { en: "Pawn promotion and the underpromotion trick", fr: "La promotion du pion et la sous-promotion" },
      body: {
        en: ["A pawn reaching the far rank must immediately become a queen, rook, bishop or knight of its own colour. It is not a choice between promoting and staying a pawn: the change is compulsory.",
             "You may have several queens at once; there is no limit tied to the pieces already captured. In a tournament an upside-down rook is not a queen, so ask an arbiter for a real one.",
             "Choosing anything other than a queen is called underpromotion, and it is rare but real. A knight is the classic case, because it is the only piece whose move a queen cannot copy: promoting to a knight with check can save a lost position. A rook is occasionally chosen to avoid stalemate."],
        fr: ["Un pion qui atteint la dernière rangée doit immédiatement devenir dame, tour, fou ou cavalier de sa couleur. Ce n'est pas un choix entre promouvoir et rester pion : le changement est obligatoire.",
             "Tu peux avoir plusieurs dames en même temps, sans lien avec les pièces déjà capturées. En tournoi, une tour retournée n'est pas une dame : il faut en demander une à l'arbitre.",
             "Choisir autre chose qu'une dame s'appelle une sous-promotion : c'est rare mais bien réel. Le cavalier en est le cas classique, car c'est la seule pièce dont la dame ne sait pas imiter le coup ; promouvoir en cavalier avec échec peut sauver une position perdue. La tour sert parfois à éviter le pat."] } },
    { slug: { en: "check-checkmate-stalemate", fr: "echec-mat-et-pat" },
      fen: "R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1",
      title: { en: "Check, checkmate and stalemate explained", fr: "Échec, mat et pat : la différence" },
      body: {
        en: ["A king is in <strong>check</strong> when an enemy piece attacks his square. You must answer a check at once, in one of three ways: move the king, capture the attacker, or block the line between them. A knight check can never be blocked, which is what makes knights so dangerous near a king.",
             "<strong>Checkmate</strong> is a check with no legal answer. The game ends immediately and the side giving mate wins. The diagram shows the commonest pattern of all, the back-rank mate: the black king is walled in by his own pawns.",
             "<strong>Stalemate</strong> is the trap on the other side. If the player to move is <em>not</em> in check but has no legal move at all, the game is a draw. Countless winning endgames have been thrown away by a player so busy attacking that they left the enemy king no square to go to."],
        fr: ["Un roi est en <strong>échec</strong> quand une pièce adverse attaque sa case. Il faut y répondre immédiatement, de trois façons possibles : bouger le roi, capturer l'attaquant, ou interposer une pièce sur la ligne. Un échec de cavalier ne peut jamais être bloqué, ce qui rend les cavaliers si dangereux près d'un roi.",
             "L'<strong>échec et mat</strong> est un échec auquel il n'existe aucune réponse légale. La partie s'arrête aussitôt et le camp qui mate gagne. Le diagramme montre le schéma le plus fréquent de tous, le mat du couloir : le roi noir est emmuré par ses propres pions.",
             "Le <strong>pat</strong> est le piège symétrique. Si le joueur au trait n'est <em>pas</em> en échec mais n'a aucun coup légal, la partie est nulle. D'innombrables finales gagnantes ont été gâchées par un joueur si occupé à attaquer qu'il n'a laissé aucune case au roi adverse."] } },
    { slug: { en: "how-games-are-drawn", fr: "les-parties-nulles" },
      fen: "8/8/4k3/8/8/2K1B3/8/8 w - - 0 1",
      title: { en: "Every way a chess game can be drawn", fr: "Toutes les façons de faire nulle aux échecs" },
      body: {
        en: ["A draw is not a failure, it is a result, and there are five routes to it. <strong>Stalemate</strong>: the side to move has no legal move and is not in check. <strong>Agreement</strong>: both players simply accept a draw.",
             "<strong>Insufficient material</strong>: neither side can force mate. King against king, king and bishop against king, king and knight against king are all immediate draws. The diagram shows one of them.",
             "<strong>Threefold repetition</strong>: the same position, with the same side to move and the same rights, occurs three times. <strong>The fifty-move rule</strong>: fifty moves by each side pass with no capture and no pawn move. Both of these have to be claimed by a player, or in most software, are applied automatically.",
             "A special case worth knowing: if your flag falls but your opponent has no material capable of mating you, the game is drawn rather than lost."],
        fr: ["La nulle n'est pas un échec, c'est un résultat, et cinq chemins y mènent. Le <strong>pat</strong> : le joueur au trait n'a aucun coup légal et n'est pas en échec. L'<strong>accord</strong> : les deux joueurs conviennent simplement de la nulle.",
             "Le <strong>matériel insuffisant</strong> : aucun camp ne peut forcer le mat. Roi contre roi, roi et fou contre roi, roi et cavalier contre roi sont nulles immédiates. Le diagramme en montre un cas.",
             "La <strong>triple répétition</strong> : la même position, avec le même trait et les mêmes droits, survient trois fois. La <strong>règle des cinquante coups</strong> : cinquante coups de chaque camp passent sans prise ni mouvement de pion. Ces deux-là doivent être réclamées par un joueur, ou sont appliquées automatiquement par les logiciels.",
             "Un cas particulier utile à connaître : si ton drapeau tombe mais que ton adversaire n'a pas de quoi mater, la partie est nulle et non perdue."] } },
    { slug: { en: "chess-notation", fr: "la-notation-des-coups" },
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      title: { en: "Reading and writing chess notation", fr: "Lire et écrire la notation des échecs" },
      body: {
        en: ["Every square has a name: files a to h from White's left, ranks 1 to 8 from White's side. The bottom-left square is a1, the top-right is h8.",
             "A move is written as the piece letter plus the arrival square: Nf3, Bb5, Qd2, Rae1, Kg1. Pawns have no letter, so e4 means a pawn to e4. A capture adds an x (Nxe5), a pawn capture names its file first (exd5). Castling is O-O short and O-O-O long. Check is +, checkmate is #, promotion is written =Q.",
             "When two identical pieces could reach the same square, add the file or rank that tells them apart: Nbd2, R1e2. Symbols like ! and ? are commentary, not part of the move.",
             "This is the international standard, so a scoresheet written in Paris is readable in Tokyo. Only the piece letters change with the language: in French the knight is C for cavalier, the bishop F for fou."],
        fr: ["Chaque case a un nom : les colonnes a à h depuis la gauche des Blancs, les rangées 1 à 8 depuis leur côté. La case en bas à gauche est a1, celle en haut à droite h8.",
             "Un coup s'écrit avec la lettre de la pièce suivie de la case d'arrivée : Nf3, Bb5, Qd2, Rae1, Kg1. Ces lettres viennent des noms anglais, et c'est la forme utilisée partout en ligne : N pour le cavalier (knight), B pour le fou (bishop), R pour la tour (rook), Q pour la dame (queen), K pour le roi (king). Les pions n'ont pas de lettre : e4 signifie un pion en e4. Une prise ajoute un x (Nxe5), une prise de pion nomme d'abord sa colonne (exd5). Le roque s'écrit O-O pour le petit, O-O-O pour le grand. L'échec est +, le mat #, la promotion =Q.",
             "Quand deux pièces identiques peuvent atteindre la même case, on ajoute la colonne ou la rangée qui les distingue : Nbd2, R1e2. Les symboles ! et ? sont des commentaires, pas une partie du coup.",
             "C'est une norme internationale : une feuille de partie écrite à Paris se lit à Tokyo. Les livres et revues en français emploient encore les lettres françaises (C pour cavalier, F pour fou, T pour tour, D pour dame, R pour roi), et tu les rencontreras forcément. Les cases, elles, ne changent jamais : c'est ce qui rend les deux formes interchangeables."] } },
    { slug: { en: "opening-principles", fr: "les-principes-d-ouverture" },
      fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 0 1",
      title: { en: "The four opening principles that matter", fr: "Les quatre principes d'ouverture qui comptent" },
      body: {
        en: ["You do not need opening theory to play a decent opening. Four ideas cover almost everything.",
             "<strong>Take the centre.</strong> A pawn on e4 or d4 controls squares the opponent wants. <strong>Develop every piece once.</strong> Knights and bishops out, towards the centre; moving the same piece twice in the opening usually costs you a move for nothing.",
             "<strong>Castle early.</strong> Ten moves in, the centre starts to open, and a king still sitting there becomes a target. <strong>Do not bring the queen out early.</strong> She is worth nine points, so every minor piece that attacks her gains time for free.",
             "The diagram shows the result: White has three pieces out, a pawn in the centre and a castled king, all in seven moves. Nothing clever, just principles applied in order."],
        fr: ["Nul besoin de théorie pour jouer une ouverture correcte. Quatre idées couvrent presque tout.",
             "<strong>Prends le centre.</strong> Un pion en e4 ou d4 contrôle des cases que l'adversaire convoite. <strong>Développe chaque pièce une fois.</strong> Cavaliers et fous vers le centre ; bouger deux fois la même pièce en ouverture revient le plus souvent à perdre un temps pour rien.",
             "<strong>Roque tôt.</strong> Au dixième coup, le centre commence à s'ouvrir, et un roi resté là devient une cible. <strong>Ne sors pas la dame trop vite.</strong> Elle vaut neuf points : chaque pièce mineure qui l'attaque gagne un temps gratuitement.",
             "Le diagramme montre le résultat : les Blancs ont trois pièces développées, un pion au centre et un roi roqué, en sept coups. Rien d'astucieux, juste les principes appliqués dans l'ordre."] } }
  ];

  for (const lang of ["en", "fr"]) {
    const dir = DIRS.learn[lang], u = UI[lang];
    const idxUrl = `${SITE}/${dir}/`;
    for (const r of RULES) {
      try { new Game(r.fen); } catch (e) { throw new Error("FEN invalide: " + r.fen); }
      const canonical = `${SITE}/${dir}/${r.slug[lang]}.html`;
      const alt = `${SITE}/${DIRS.learn[lang === "en" ? "fr" : "en"]}/${r.slug[lang === "en" ? "fr" : "en"]}.html`;
      const body = `
<h1>${esc(r.title[lang])}</h1>
<div class="cols">
  ${diagram(r.fen, "")}
  <div>${r.body[lang].map(p => `<p>${p}</p>`).join("\n")}
    <a class="cta" href="/">${u.play}</a>
    <a class="cta ghost" href="/${dir}/">${u.back}</a>
  </div>
</div>`;
      page(lang, dir, r.slug[lang] + ".html", r.title[lang] + " | chang64",
        metaDesc(r.body[lang][0]), body,
        { "@context": "https://schema.org", "@type": "Article", headline: r.title[lang], inLanguage: lang },
        alt, canonical);
    }
    const t = lang === "fr" ? "Apprendre les échecs : toutes les règles expliquées" : "Learn chess: every rule explained";
    const lede = lang === "fr"
      ? "Les règles du jeu, une page à la fois, avec un diagramme pour chacune. De quoi partir de zéro ou combler les trous."
      : "The rules of chess, one page at a time, each with a diagram. Enough to start from nothing, or to fill the gaps.";
    const body = `<h1>${esc(t)}</h1><p class="lede">${esc(lede)}</p><div class="grid">` +
      RULES.map(r => `<a class="tile" href="/${dir}/${r.slug[lang]}.html"><b>${esc(r.title[lang])}</b></a>`).join("\n") + `</div>`;
    page(lang, dir, "index.html", t + " | chang64", lede, body,
      { "@context": "https://schema.org", "@type": "CollectionPage", name: t, inLanguage: lang },
      `${SITE}/${DIRS.learn[lang === "en" ? "fr" : "en"]}/`, idxUrl);
  }

  /* ================= 2. GLOSSARY ================= */
  const TERMS = [
    ["fork", "fourchette", "Fork", "Fourchette",
     "One piece attacks two or more enemy pieces at the same time. Knights are the classic forkers because their move cannot be blocked, and a fork hitting the king and the queen wins material outright.",
     "Une pièce en attaque deux ou plus en même temps. Le cavalier est le champion de la fourchette, car son coup ne peut pas être bloqué : une fourchette sur le roi et la dame gagne du matériel sans discussion.", "Knight fork"],
    ["pin", "clouage", "Pin", "Clouage",
     "A piece cannot move without exposing a more valuable piece behind it. If the piece behind is the king, the pin is absolute and the pinned piece is legally frozen.",
     "Une pièce ne peut pas bouger sans exposer une pièce plus précieuse derrière elle. Si c'est le roi qui est derrière, le clouage est absolu et la pièce clouée est légalement immobilisée.", "Pin"],
    ["skewer", "enfilade", "Skewer", "Enfilade",
     "The reverse of a pin: the valuable piece is in front and must move, leaving the piece behind it to be taken.",
     "L'inverse du clouage : la pièce de valeur est devant, elle doit bouger, et celle qui se trouve derrière tombe.", "Skewer"],
    ["discovered-attack", "attaque-a-la-decouverte", "Discovered attack", "Attaque à la découverte",
     "Moving one piece uncovers an attack from another behind it. The moved piece is free to do something else entirely, which is what makes the motif so strong.",
     "En déplaçant une pièce, on démasque l'attaque d'une autre située derrière. La pièce qui bouge peut faire tout autre chose, ce qui fait la force du motif.", "Double attack"],
    ["double-check", "echec-double", "Double check", "Échec double",
     "Two pieces give check at once. Neither can be captured nor blocked out of both lines, so the king is forced to move. It is the most violent check in chess.",
     "Deux pièces donnent échec en même temps. On ne peut ni les prendre ni les bloquer toutes les deux : le roi doit bouger. C'est l'échec le plus brutal du jeu.", "King attack"],
    ["back-rank-mate", "mat-du-couloir", "Back-rank mate", "Mat du couloir",
     "A rook or queen mates a castled king trapped behind its own unmoved pawns. The commonest mate in club chess, and the reason players make a small escape square early.",
     "Une tour ou une dame mate un roi roqué, coincé derrière ses propres pions. Le mat le plus fréquent en club, et la raison pour laquelle on ouvre tôt une case de fuite.", "Back-rank mate"],
    ["smothered-mate", "mat-etouffe", "Smothered mate", "Mat étouffé",
     "A knight mates a king hemmed in entirely by its own pieces. Usually arrives after a queen sacrifice that forces the last escape square to be blocked.",
     "Un cavalier mate un roi entièrement enfermé par ses propres pièces. Il arrive généralement après un sacrifice de dame qui force le blocage de la dernière case de fuite.", "Smothered mate"],
    ["deflection", "deviation", "Deflection", "Déviation",
     "Forcing a defending piece away from the square or line it was guarding, usually with a sacrifice it cannot refuse.",
     "Forcer une pièce défensive à quitter la case ou la ligne qu'elle gardait, en général par un sacrifice qu'elle ne peut pas refuser.", "Deflection"],
    ["zugzwang", "zugzwang", "Zugzwang", "Zugzwang",
     "A position where any move makes things worse, but passing is not allowed. Mostly an endgame idea, and the engine of nearly every king and pawn ending.",
     "Une position où tout coup aggrave la situation, mais où l'on ne peut pas passer son tour. Surtout une notion de finale, et le moteur de presque toutes les finales de pions.", "Opposition"],
    ["opposition", "opposition", "Opposition", "Opposition",
     "Two kings face each other with one square between them. The player who does not have to move holds the opposition and usually controls the outcome of a pawn ending.",
     "Deux rois se font face avec une case entre eux. Celui qui n'a pas le trait détient l'opposition et contrôle en général l'issue d'une finale de pions.", "Opposition"],
    ["fianchetto", "fianchetto", "Fianchetto", "Fianchetto",
     "Developing a bishop to b2, g2, b7 or g7 after moving the knight pawn one square. The bishop then rakes the long diagonal for the rest of the game.",
     "Développer un fou en b2, g2, b7 ou g7 après avoir avancé d'une case le pion cavalier. Le fou balaie ensuite la grande diagonale pendant toute la partie.", "Long diagonal"],
    ["gambit", "gambit", "Gambit", "Gambit",
     "Offering material, usually a pawn, to gain time, space or open lines. A gambit is a bet that activity is worth more than a pawn.",
     "Offrir du matériel, en général un pion, pour gagner du temps, de l'espace ou ouvrir des lignes. Un gambit est un pari : l'activité vaut mieux qu'un pion.", "Sacrifice"],
    ["tempo", "tempo", "Tempo", "Tempo",
     "A single move seen as a unit of time. Attacking a piece that has to respond gains a tempo; moving the same piece twice for no reason loses one.",
     "Un coup considéré comme une unité de temps. Attaquer une pièce qui doit répondre fait gagner un tempo ; bouger deux fois la même pièce sans raison en fait perdre un.", "Winning move"],
    ["development", "developpement", "Development", "Développement",
     "Bringing pieces from their starting squares to useful ones. Counting how many pieces each side has developed is the fastest way to judge an opening.",
     "Amener les pièces de leur case de départ vers des cases utiles. Compter les pièces développées de chaque côté est la façon la plus rapide de juger une ouverture.", "Central knight"],
    ["open-file", "colonne-ouverte", "Open file", "Colonne ouverte",
     "A file with no pawns on it. Rooks belong there: an open file is the road by which a rook reaches the enemy position.",
     "Une colonne sans aucun pion. C'est la place des tours : une colonne ouverte est la route par laquelle une tour pénètre chez l'adversaire.", "Open file"],
    ["seventh-rank", "septieme-rangee", "Seventh rank", "Septième rangée",
     "A rook on the opponent's seventh rank attacks the pawns still at home and often traps the king on the back rank. Two rooks there are usually decisive.",
     "Une tour sur la septième rangée adverse attaque les pions restés au repos et enferme souvent le roi sur sa dernière rangée. Deux tours à cet endroit sont en général décisives.", "Seventh rank"],
    ["passed-pawn", "pion-passe", "Passed pawn", "Pion passé",
     "A pawn with no enemy pawn ahead of it on its own file or the two beside it. Nothing can stop it except pieces, which is why passed pawns decide endgames.",
     "Un pion qui n'a plus aucun pion adverse devant lui, ni sur sa colonne ni sur les deux voisines. Seules les pièces peuvent l'arrêter, ce qui fait des pions passés les arbitres des finales.", "Promotion"],
    ["hanging-piece", "piece-en-prise", "Hanging piece", "Pièce en prise",
     "A piece that is attacked and not defended. Scanning for hanging pieces before every move eliminates most blunders at club level.",
     "Une pièce attaquée et non défendue. Vérifier les pièces en prise avant chaque coup élimine la majorité des gaffes au niveau club.", "Hanging piece"],
    ["sacrifice", "sacrifice", "Sacrifice", "Sacrifice",
     "Giving up material on purpose for something worth more: mate, a decisive attack, or a winning endgame. A sacrifice you can calculate to the end is simply a good move.",
     "Céder du matériel volontairement pour quelque chose de plus précieux : le mat, une attaque décisive ou une finale gagnante. Un sacrifice que l'on calcule jusqu'au bout n'est qu'un bon coup.", "Sacrifice"],
    ["perpetual-check", "echec-perpetuel", "Perpetual check", "Échec perpétuel",
     "An unending series of checks the defender cannot escape. The game is drawn by repetition, which makes it the standard lifeline in a losing position.",
     "Une série d'échecs à laquelle le défenseur ne peut pas échapper. La partie est nulle par répétition, ce qui en fait la bouée de sauvetage classique dans une position perdue.", "King attack"]
  ];

  const byTheme = {};
  for (const p of puzzles) (byTheme[p.theme] = byTheme[p.theme] || []).push(p);

  function puzzleSlug(p, lang) {
    const th = themeOf(p.theme, lang);
    return `${p.id.replace("p", "")}-${slug(th)}`;
  }

  for (const lang of ["en", "fr"]) {
    const dir = DIRS.glossary[lang], u = UI[lang];
    for (const [sEn, sFr, tEn, tFr, dEn, dFr, theme] of TERMS) {
      const sl = lang === "fr" ? sFr : sEn, title = lang === "fr" ? tFr : tEn, def = lang === "fr" ? dFr : dEn;
      const sample = (byTheme[theme] || [])[0];
      const canonical = `${SITE}/${dir}/${sl}.html`;
      const alt = `${SITE}/${DIRS.glossary[lang === "en" ? "fr" : "en"]}/${lang === "en" ? sFr : sEn}.html`;
      const pz = sample ? `
  ${diagram(sample.fen, (lang === "fr" ? "Exemple : " : "Example: ") + themeOf(sample.theme, lang))}
  <div><p>${lang === "fr" ? "Le diagramme ci-contre en montre un exemple, tiré de la banque d'exercices de chang64. Chaque position y est démontrée par le moteur avant d'être proposée." : "The diagram shows an example, taken from the chang64 puzzle set. Every position there is proved by the engine before it is offered."}</p>
    <a class="cta" href="/#puzzle=${sample.id}">${lang === "fr" ? "Résoudre cet exercice" : "Solve this puzzle"}</a>
    <a class="cta ghost" href="/${DIRS.puzzles[lang]}/${puzzleSlug(sample, lang)}.html">${lang === "fr" ? "Voir la fiche" : "See the page"}</a>
    <a class="cta ghost" href="/${dir}/">${u.back}</a>
  </div>` : `<div><a class="cta" href="/">${u.play}</a></div>`;
      const body = `<h1>${esc(title)}</h1><p class="lede">${esc(def)}</p><div class="cols">${pz}</div>`;
      page(lang, dir, sl + ".html", `${title} \u2014 ${lang === "fr" ? "définition et exemple" : "chess term explained"} | chang64`,
        metaDesc(def), body,
        { "@context": "https://schema.org", "@type": "DefinedTerm", name: title, description: def, inLanguage: lang },
        alt, canonical);
    }
    const t = lang === "fr" ? "Lexique des échecs : les termes qui comptent" : "Chess glossary: the terms that matter";
    const lede = lang === "fr"
      ? "Vingt notions expliquées en deux phrases, chacune avec une position vérifiée et un exercice pour la mettre en pratique."
      : "Twenty ideas explained in two sentences, each with a verified position and a puzzle to practise it.";
    const body = `<h1>${esc(t)}</h1><p class="lede">${esc(lede)}</p><div class="grid">` +
      TERMS.map(x => `<a class="tile" href="/${dir}/${lang === "fr" ? x[1] : x[0]}.html"><b>${esc(lang === "fr" ? x[3] : x[2])}</b><span>${esc((lang === "fr" ? x[5] : x[4]).slice(0, 60))}…</span></a>`).join("\n") + `</div>`;
    page(lang, dir, "index.html", t + " | chang64", lede, body,
      { "@context": "https://schema.org", "@type": "CollectionPage", name: t, inLanguage: lang },
      `${SITE}/${DIRS.glossary[lang === "en" ? "fr" : "en"]}/`, `${SITE}/${dir}/`);
  }

  /* ================= 3. ENDGAMES ================= */
  const ENDS = [
    { id: "kq", slug: { en: "queen-vs-king", fr: "dame-contre-roi" }, fen: "8/8/8/4k3/8/8/3QK3/8 w - - 0 1",
      title: { en: "Queen and king versus king", fr: "Dame et roi contre roi" },
      body: { en: ["The first mate every player should own. The method never changes: use the queen to shrink the enemy king's box, one rank or file at a time, then walk your own king up to deliver the blow.",
                   "The single trap is stalemate. Never take away every square while the enemy king is not in check. A safe habit is the knight-move technique: keep the queen a knight's jump from the enemy king, and the box shrinks by itself.",
                   "From any position this takes at most ten moves. Practise it in the trainer until it costs you no thought at all."],
              fr: ["Le premier mat que tout joueur doit maîtriser. La méthode ne change jamais : la dame réduit la boîte du roi adverse, une rangée ou une colonne à la fois, puis ton roi monte porter le coup.",
                   "Le seul piège est le pat. Ne retire jamais toutes les cases si le roi adverse n'est pas en échec. Une habitude sûre : garder la dame à un saut de cavalier du roi adverse, et la boîte se resserre toute seule.",
                   "Depuis n'importe quelle position, cela prend au plus dix coups. Répète-le dans l'entraîneur jusqu'à ce que cela ne te coûte plus aucune réflexion."] } },
    { id: "kr", slug: { en: "rook-vs-king", fr: "tour-contre-roi" }, fen: "8/8/8/4k3/8/8/4K3/R7 w - - 0 1",
      title: { en: "Rook and king versus king", fr: "Tour et roi contre roi" },
      body: { en: ["Harder than the queen, because the rook cannot do it alone: the king must help on every move.",
                   "The technique is the box. Put the rook on a rank or file that cuts the enemy king off, then bring your king to face his. When the kings stand opposite each other with one square between them, a rook check pushes the defender back one rank, and you start again.",
                   "Expect around sixteen moves from a random position. If you find yourself checking without progress, stop checking and improve your king instead."],
              fr: ["Plus difficile que la dame, car la tour ne peut rien seule : le roi doit aider à chaque coup.",
                   "La technique est celle de la boîte. Place la tour sur une rangée ou une colonne qui coupe le roi adverse, puis amène ton roi face au sien. Quand les rois sont opposés avec une case entre eux, un échec de tour repousse le défenseur d'une rangée, et on recommence.",
                   "Compte environ seize coups depuis une position quelconque. Si tu donnes échec sans progresser, arrête les échecs et améliore ton roi."] } },
    { id: "krr", slug: { en: "two-rooks-vs-king", fr: "deux-tours-contre-roi" }, fen: "8/8/8/4k3/8/8/R7/R3K3 w - - 0 1",
      title: { en: "Two rooks versus king: the ladder mate", fr: "Deux tours contre roi : le mat de l'escalier" },
      body: { en: ["The easiest mate in chess, and the one to teach first because it needs no king help at all.",
                   "One rook cuts the king off on a rank. The other checks on the next rank, driving him back. Then the first rook jumps forward and checks again. The two rooks climb like the rungs of a ladder until the king runs out of board.",
                   "The only care needed: when the enemy king approaches a rook, move that rook far along its line rather than losing it. Eight moves is a normal result."],
              fr: ["Le mat le plus simple du jeu, et celui qu'il faut enseigner en premier, car il ne demande aucune aide du roi.",
                   "Une tour coupe le roi sur une rangée. L'autre donne échec sur la rangée suivante et le repousse. Puis la première tour saute devant et donne échec à son tour. Les deux tours grimpent comme les barreaux d'une échelle jusqu'à ce que le roi manque d'échiquier.",
                   "La seule précaution : quand le roi adverse approche d'une tour, éloigne-la le long de sa ligne plutôt que de la perdre. Huit coups est un résultat normal."] } },
    { id: "kbn", slug: { en: "bishop-and-knight-mate", fr: "mat-fou-et-cavalier" }, fen: "8/8/8/4k3/8/8/3BNK2/8 w - - 0 1",
      title: { en: "Bishop and knight mate: the hard one", fr: "Le mat fou et cavalier : le difficile" },
      body: { en: ["The only elementary mate most club players never learn, and the one that occasionally costs a full point.",
                   "The key fact: mate is only possible in a corner your bishop can attack. If the enemy king runs to the wrong corner, you must drive him along the edge to the right one, which is where the famous W manoeuvre of the knight comes in.",
                   "It can take over thirty moves, and the fifty-move rule is real, so hesitation loses the win. Worth an hour of practice once in your life."],
              fr: ["Le seul mat élémentaire que la plupart des joueurs de club n'apprennent jamais, et celui qui coûte parfois un point entier.",
                   "Le point clé : le mat n'est possible que dans un coin que ton fou peut attaquer. Si le roi adverse fuit vers le mauvais coin, il faut le pousser le long du bord jusqu'au bon, et c'est là qu'intervient la fameuse manœuvre en W du cavalier.",
                   "Cela peut demander plus de trente coups, et la règle des cinquante coups est bien réelle : l'hésitation coûte la victoire. Une heure de travail, une fois dans sa vie, suffit."] } },
    { id: "kp", slug: { en: "king-and-pawn-vs-king", fr: "roi-et-pion-contre-roi" }, fen: "8/8/8/3k4/8/3P4/3K4/8 w - - 0 1",
      title: { en: "King and pawn versus king", fr: "Roi et pion contre roi" },
      body: { en: ["The most important endgame of all, because every other one can simplify into it.",
                   "Everything hinges on the opposition. If your king reaches the sixth rank in front of his pawn, the pawn promotes. If the defending king takes the square in front of the pawn and holds the opposition, the game is drawn.",
                   "Rook pawns are the exception: an a-pawn or h-pawn with the defending king able to reach the corner is always a draw, however far ahead you are."],
              fr: ["La finale la plus importante de toutes, car toutes les autres peuvent s'y ramener.",
                   "Tout repose sur l'opposition. Si ton roi atteint la sixième rangée devant son pion, le pion passe. Si le roi défenseur occupe la case devant le pion et tient l'opposition, la partie est nulle.",
                   "Les pions tour font exception : un pion a ou h, avec un roi défenseur capable d'atteindre le coin, est toujours nul, quelle que soit ton avance."] } }
  ];

  for (const lang of ["en", "fr"]) {
    const dir = DIRS.endgames[lang], u = UI[lang];
    for (const e of ENDS) {
      try { new Game(e.fen); } catch (err) { throw new Error("FEN finale invalide"); }
      const canonical = `${SITE}/${dir}/${e.slug[lang]}.html`;
      const alt = `${SITE}/${DIRS.endgames[lang === "en" ? "fr" : "en"]}/${e.slug[lang === "en" ? "fr" : "en"]}.html`;
      const body = `<h1>${esc(e.title[lang])}</h1>
<div class="cols">${diagram(e.fen, "")}
<div>${e.body[lang].map(p => `<p>${p}</p>`).join("\n")}
<a class="cta" href="/#train=${e.id}">${lang === "fr" ? "S'entraîner sur cette finale" : "Train this endgame"}</a>
<a class="cta ghost" href="/${dir}/">${u.back}</a></div></div>`;
      page(lang, dir, e.slug[lang] + ".html", e.title[lang] + " | chang64",
        metaDesc(e.body[lang][0]), body,
        { "@context": "https://schema.org", "@type": "Article", headline: e.title[lang], inLanguage: lang }, alt, canonical);
    }
    const t = lang === "fr" ? "Les finales élémentaires expliquées" : "The elementary chess endgames";
    const lede = lang === "fr"
      ? "Cinq finales à connaître par cœur, chacune avec sa méthode et un entraîneur pour la répéter contre le moteur."
      : "Five endgames worth knowing by heart, each with its method and a trainer to drill it against the engine.";
    const body = `<h1>${esc(t)}</h1><p class="lede">${esc(lede)}</p><div class="grid">` +
      ENDS.map(e => `<a class="tile" href="/${dir}/${e.slug[lang]}.html"><b>${esc(e.title[lang])}</b></a>`).join("\n") + `</div>`;
    page(lang, dir, "index.html", t + " | chang64", lede, body,
      { "@context": "https://schema.org", "@type": "CollectionPage", name: t, inLanguage: lang },
      `${SITE}/${DIRS.endgames[lang === "en" ? "fr" : "en"]}/`, `${SITE}/${dir}/`);
  }

  /* ================= 4. TRAPS ================= */
  const TRAPS = [
    { slug: { en: "scholars-mate", fr: "mat-du-berger" },
      title: { en: "Scholar's mate, and how to stop it", fr: "Le mat du berger, et comment l'éviter" },
      moves: ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7"],
      body: { en: "White aims the queen and bishop at f7, the one square defended by nothing but the king. It works once. The cure is 3...g6, hitting the queen and gaining time, after which White's early queen sortie becomes a liability.",
              fr: "Les Blancs braquent dame et fou sur f7, la seule case que rien d'autre que le roi ne défend. Cela marche une fois. Le remède est 3…g6, qui attaque la dame et gagne du temps : la sortie précoce de la dame devient alors un handicap." } },
    { slug: { en: "legals-mate", fr: "mat-de-legal" },
      title: { en: "Legal's mate: the queen sacrifice", fr: "Le mat de Légal : le sacrifice de dame" },
      moves: ["e4", "e5", "Nf3", "d6", "Bc4", "Bg4", "Nc3", "g6", "Nxe5", "Bxd1", "Bxf7", "Ke7", "Nd5"],
      body: { en: "One of the oldest traps on record, from eighteenth-century Paris. White gives up the queen because the bishop on g4 was only pinning it in appearance: the mating net with two minor pieces is worth far more.",
              fr: "L'un des pièges les plus anciens qui soient, venu du Paris du dix-huitième siècle. Les Blancs abandonnent la dame parce que le fou en g4 ne la clouait qu'en apparence : le filet de mat à deux pièces mineures vaut bien davantage." } },
    { slug: { en: "blackburne-shilling-trap", fr: "piege-du-shilling" },
      title: { en: "The Blackburne Shilling trap", fr: "Le piège du shilling de Blackburne" },
      moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nd4", "Nxe5", "Qg5", "Nxf7", "Qxg2", "Rf1", "Qxe4", "Be2", "Nf3"],
      body: { en: "Black plays a move that looks like a beginner's mistake and invites the greedy capture on e5. The punishment is a smothered mate in the middle of the opening, delivered by a knight on f3.",
              fr: "Les Noirs jouent un coup qui ressemble à une erreur de débutant et invitent la prise gourmande en e5. La sanction est un mat étouffé en pleine ouverture, délivré par un cavalier en f3." } },
    { slug: { en: "englund-gambit-trap", fr: "piege-du-gambit-englund" },
      title: { en: "The Englund Gambit trap", fr: "Le piège du gambit Englund" },
      moves: ["d4", "e5", "dxe5", "Nc6", "Nf3", "Qe7", "Bf4", "Qb4", "Bd2", "Qxb2", "Bc3", "Bb4", "Qd2", "Bxc3", "Qxc3", "Qc1"],
      body: { en: "A gambit of dubious reputation with one very sharp point: if White defends naturally and grabs everything on offer, Black mates on c1 in sixteen moves. Knowing it is enough to avoid it.",
              fr: "Un gambit de réputation douteuse, mais doté d'une pointe très acérée : si les Blancs se défendent naturellement et prennent tout ce qu'on leur offre, les Noirs matent en c1 au seizième coup. Le connaître suffit à l'éviter." } },
    { slug: { en: "fried-liver-attack", fr: "attaque-fegatello" },
      title: { en: "The Fried Liver Attack", fr: "L'attaque Fegatello" },
      moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5", "d5", "exd5", "Nxd5", "Nxf7"],
      body: { en: "White sacrifices a knight on f7 to drag the black king into the open on move six. Black survives with accurate play, but over the board the practical results favour the attacker heavily.",
              fr: "Les Blancs sacrifient un cavalier en f7 pour tirer le roi noir à découvert dès le sixième coup. Avec une défense précise, les Noirs tiennent, mais sur l'échiquier les résultats pratiques favorisent nettement l'attaquant." } },
    { slug: { en: "damiano-defence-punished", fr: "defense-damiano-punie" },
      title: { en: "Why 2...f6 loses on the spot", fr: "Pourquoi 2…f6 perd sur-le-champ" },
      moves: ["e4", "e5", "Nf3", "f6", "Nxe5", "fxe5", "Qh5", "Ke7", "Qxe5", "Kf7", "Bc4", "Kg6", "Qf5", "Kh6", "d4"],
      body: { en: "Damiano wrote in 1512 that 2...f6 was the worst move on the board, and he was right. It weakens the king's diagonal and takes away the knight's best square in one go. White gives up a knight and the black king is hunted across the board.",
              fr: "Damiano écrivait en 1512 que 2…f6 était le pire coup de l'échiquier, et il avait raison. Le coup affaiblit la diagonale du roi et prive le cavalier de sa meilleure case d'un seul geste. Les Blancs offrent un cavalier et le roi noir est traqué à travers tout l'échiquier." } }
  ];

  const validTraps = [];
  for (const tr of TRAPS) {
    const line = sanLine(tr.moves);
    if (!line) { console.log("PIÈGE INVALIDE, ignoré :", tr.slug.en); continue; }
    validTraps.push({ ...tr, line });
  }

  for (const lang of ["en", "fr"]) {
    const dir = DIRS.traps[lang], u = UI[lang];
    for (const tr of validTraps) {
      const canonical = `${SITE}/${dir}/${tr.slug[lang]}.html`;
      const alt = `${SITE}/${DIRS.traps[lang === "en" ? "fr" : "en"]}/${tr.slug[lang === "en" ? "fr" : "en"]}.html`;
      /* La description sert la balise meta et le referencement. Elle ne doit
         pas etre reprise en chapo : c'etait les 280 premiers caracteres du
         texte affiche juste en dessous, donc le lecteur lisait deux fois le
         meme debut. */
      const desc = metaDesc(tr.body[lang]);
      const chapo = lang === "fr"
        ? `Le piège en ${tr.line.san.length} demi-coups, rejoué par le moteur, avec la position finale et l'explication.`
        : `The trap in ${tr.line.san.length} half-moves, replayed by the engine, with the final position and the explanation.`;
      const body = `<h1>${esc(tr.title[lang])}</h1><p class="lede">${esc(chapo)}</p>
<div class="cols">${diagram(tr.line.fen, (lang === "fr" ? "Position finale après " : "Final position after ") + numberLine(tr.line.san))}
<div><div class="moves">${esc(numberLine(tr.line.san))}${tr.line.mate ? "" : ""}</div>
<p>${esc(tr.body[lang])}</p>
<p>${lang === "fr" ? "Toute la séquence a été rejouée par le moteur de chang64 : chaque coup est légal et la position finale est celle du diagramme." : "The whole sequence was replayed by the chang64 engine: every move is legal and the final position is the one in the diagram."}${tr.line.mate ? (lang === "fr" ? " La position finale est un échec et mat." : " The final position is checkmate.") : ""}</p>
<a class="cta" href="/">${u.play}</a><a class="cta ghost" href="/${dir}/">${u.back}</a></div></div>`;
      page(lang, dir, tr.slug[lang] + ".html", tr.title[lang] + " | chang64", desc, body,
        { "@context": "https://schema.org", "@type": "Article", headline: tr.title[lang], inLanguage: lang }, alt, canonical);
    }
    const t = lang === "fr" ? "Pièges d'ouverture : les connaître, ou les subir" : "Opening traps: know them or fall for them";
    const lede = lang === "fr"
      ? "Les pièges classiques qui décident des parties rapides, chacun rejoué coup par coup et vérifié par le moteur."
      : "The classic traps that decide fast games, each replayed move by move and verified by the engine.";
    const body = `<h1>${esc(t)}</h1><p class="lede">${esc(lede)}</p><div class="grid">` +
      validTraps.map(tr => `<a class="tile" href="/${dir}/${tr.slug[lang]}.html"><b>${esc(tr.title[lang])}</b><span>${esc(numberLine(tr.line.san).slice(0, 40))}…</span></a>`).join("\n") + `</div>`;
    page(lang, dir, "index.html", t + " | chang64", lede, body,
      { "@context": "https://schema.org", "@type": "CollectionPage", name: t, inLanguage: lang },
      `${SITE}/${DIRS.traps[lang === "en" ? "fr" : "en"]}/`, `${SITE}/${dir}/`);
  }

  /* ================= 5. PUZZLE PAGES ================= */
  for (const lang of ["en", "fr"]) {
    const dir = DIRS.puzzles[lang], u = UI[lang];
    for (const p of puzzles) {
      const g = new Game(p.fen);
      const mv = g.moves().find(m => g.uci(m) === p.sol[0]);
      if (!mv) continue;
      const san = g.san(mv);
      const side = g.turn === 0 ? u.white : u.black;
      const th = themeOf(p.theme, lang);
      const goal = p.type === "mate"
        ? (lang === "fr" ? `matent en ${p.n} coup${p.n > 1 ? "s" : ""}` : `to play and mate in ${p.n}`)
        : (lang === "fr" ? "gagnent du matériel" : "to play and win material");
      const num = p.id.replace("p", "");
      let title = lang === "fr"
        ? `${th} nº${num} : ${side} jouent et ${goal} | chang64`
        : `${th} #${num}: ${side} ${goal} | chang64`;
      if (title.length > 75) title = lang === "fr"
        ? `${th} nº${num} : ${side} jouent et gagnent | chang64`
        : `${th} #${num}: ${side} to play and win | chang64`;
      if (title.length > 75) title = `${th} nº${num} | chang64`;
      /* Passait au-dessus de 160 caracteres des que le theme (ex. "fourchette
         de cavalier") et la difficulte (ex. "assez difficile", ajoutee avec
         le passage a dix niveaux) se cumulaient. Reformule plus court, et
         passe par metaDesc en filet de securite si une future combinaison
         depassait quand meme. */
      const desc = metaDesc(lang === "fr"
        ? `Exercice ${th.toLowerCase()} : ${side.toLowerCase()} jouent et ${goal}. Vérifié par le moteur, difficulté ${u.levels[p.level - 1].toLowerCase()}.`
        : `A ${th.toLowerCase()} puzzle: ${side.toLowerCase()} ${goal}. Engine-verified, ${u.levels[p.level - 1].toLowerCase()} difficulty.`);
      const canonical = `${SITE}/${dir}/${puzzleSlug(p, lang)}.html`;
      const alt = `${SITE}/${DIRS.puzzles[lang === "en" ? "fr" : "en"]}/${puzzleSlug(p, lang === "en" ? "fr" : "en")}.html`;
      const body = `<h1>${esc(lang === "fr" ? `${side} jouent et ${goal}` : `${side} ${goal}`)}</h1>
<p class="lede">${esc(desc)}</p>
<div class="cols">${diagram(p.fen, u.sideToMove(side))}
<div>
  <p><span class="eco">${esc(th)}</span> <span class="eco">${esc(u.levels[p.level - 1])}</span></p>
  <p>${lang === "fr" ? "Cette position vient de la banque d'exercices de chang64. Chaque exercice a été démontré par le moteur : pour un mat, toutes les défenses adverses ont été vérifiées ; pour un gain de matériel, la marge sur le deuxième meilleur coup a été mesurée." : "This position comes from the chang64 puzzle set. Every puzzle is proved by the engine: for a mate, every defence was checked; for a material win, the margin over the second-best move was measured."}</p>
  <details><summary style="cursor:pointer;color:#D9A83F;font-weight:600">${u.solution}</summary>
    <div class="moves" style="margin-top:10px">${esc(san)}</div></details>
  <a class="cta" href="/#puzzle=${p.id}">${lang === "fr" ? "Résoudre sur l'échiquier" : "Solve it on the board"}</a>
  <a class="cta ghost" href="/${dir}/">${u.back}</a>
</div></div>`;
      page(lang, dir, puzzleSlug(p, lang) + ".html", title, desc, body,
        { "@context": "https://schema.org", "@type": "Quiz", name: title, inLanguage: lang,
          about: { "@type": "Thing", name: th } }, alt, canonical);
    }
    const t = lang === "fr" ? `${puzzles.length} exercices de tactique vérifiés` : `${puzzles.length} verified chess tactics puzzles`;
    const lede = lang === "fr"
      /* Ce texte sert aussi de meta description sur cette page (voir plus bas
         dans ce fichier) : il doit rester sous la limite generale verifiee
         par check_seo_entete.js (160 caracteres), avec la meme marge que la
         page d'accueil plutot que de la longer au ras du seuil. Le passage a
         dix niveaux a failli faire deborder la version francaise (174
         caracteres avec "cinq"/"dix" a l'identique) : le texte est reformule
         plus court, pas juste le mot "cinq" remplace par "dix". */
      ? `Chaque position a été démontrée par le moteur : mats, fourchettes, clouages, enfilades, sacrifices, classés en dix niveaux.`
      : `Every position was proved by the engine: mates, forks, pins, skewers and sacrifices, sorted into ten levels.`;
    const groups = {};
    for (const p of puzzles) (groups[p.theme] = groups[p.theme] || []).push(p);
    const ordered = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
    const anchor = th => "t-" + slug(themeOf(th, "en"));
    const toc = `<nav class="toc" aria-label="${lang === "fr" ? "Thèmes" : "Themes"}">` +
      ordered.map(th => `<a href="#${anchor(th)}">${esc(themeOf(th, lang))} <b>${groups[th].length}</b></a>`).join("") + `</nav>`;
    /* Champ masque par defaut, revele par le script : sans JavaScript la page
       reste ce qu'elle etait. Mille exercices repartis en themes ne se
       parcourent pas a l'oeil. */
    const filtre = `<div class="filtre hide" id="filtreBloc">
  <input type="search" id="filtre" autocomplete="off"
         placeholder="${lang === "fr" ? "Chercher : thème, niveau ou numéro" : "Search: theme, level or number"}"
         aria-label="${lang === "fr" ? "Filtrer les exercices" : "Filter puzzles"}" aria-controls="grille">
  <p class="filtre-etat" id="filtreEtat" role="status" aria-live="polite"></p>
</div>`;
    const body = `<h1>${esc(t)}</h1><p class="lede">${esc(lede)}</p>` + filtre + `<div id="grille">` + toc +
      ordered.map(th =>
        `<section class="theme-bloc" data-theme><h2 id="${anchor(th)}">${esc(themeOf(th, lang))} <span style="color:var(--sage);font-size:13px">(${groups[th].length})</span></h2><div class="grid">` +
        groups[th].map(p => {
          /* Cle de recherche : theme dans les deux langues, niveau, numero.
             Sans accents ni ponctuation, pour que "clouage" trouve
             "Clouage" et "mat en un" trouve "Mat en un coup". */
          const cle = sansAccent([
            themeOf(p.theme, lang), themeOf(p.theme, lang === "fr" ? "en" : "fr"),
            UI[lang].levels[p.level - 1], "#" + p.id.replace("p", "")
          ].join(" "));
          return `<a class="tile" data-cle="${esc(cle)}" href="/${dir}/${puzzleSlug(p, lang)}.html"><b>${esc(themeOf(p.theme, lang))} #${p.id.replace("p", "")}</b><span>${esc(UI[lang].levels[p.level - 1])}</span></a>`;
        }).join("") +
        `</div></section>`).join("\n") + `</div>`;
    page(lang, dir, "index.html", t + " | chang64", lede, body,
      { "@context": "https://schema.org", "@type": "CollectionPage", name: t, inLanguage: lang },
      `${SITE}/${DIRS.puzzles[lang === "en" ? "fr" : "en"]}/`, `${SITE}/${dir}/`);
  }

  /* ================= 6. PUBLIC PROFILE TEMPLATE ================= */
  const profile = `<h1>Player profile</h1>
<p class="lede">This is the page layout a chang64 player will get once accounts exist. It is a working template, not a live profile: nothing here is stored on a server yet.</p>
<div class="cols">
  ${diagram("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 0 1", "Last game, move 7")}
  <div>
    <h2>chang64/players/your-name</h2>
    <p>Each profile is a public page carrying the player's puzzle rating, day streak, Chang Sprint record, endgame bests and recent games, each replayable move by move and reviewable with the engine.</p>
    <p><strong>What it needs:</strong> user accounts and a database. The design work is done; the plumbing is not. Until then, progress lives in your own browser and moves between devices with a transfer code.</p>
    <p><strong>Why it matters:</strong> a profile page is content the site does not have to write. Every active player creates one, each is indexable, and each gives that player a reason to come back and a link to share.</p>
    <a class="cta" href="/">Play a game</a>
  </div>
</div>`;
  fs.writeFileSync(OUT + "/players/index.html",
    shell("Player profiles | chang64", "Template for public chang64 player profiles: rating, streaks, records and replayable games.",
      SITE + "/players/", profile, null, "en", '<meta name="robots" content="noindex">', null));

  return urls;
};
