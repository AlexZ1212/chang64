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
    "Scholar's mate": "Mat du berger", "Black to move": "Trait aux Noirs",
    "Quiet move": "Coup silencieux", "Mate in three": "Mat en trois coups"
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
    { slug: { en: "time-controls", fr: "les-cadences-aux-echecs" },
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      title: { en: "Time controls: what blitz, rapid and 10+0 mean", fr: "Les cadences aux échecs : bullet, blitz, rapide, classique" },
      body: {
        en: ["Every timed game is written as two numbers: the minutes each side starts with, and the seconds given back after every move, the increment. 10+0 means ten minutes and no increment; 3+2 means three minutes plus two extra seconds on every move you make.",
             "The names blitz, rapid and so on are just buckets for that first number, the starting time. Roughly: <strong>bullet</strong> is under 3 minutes, <strong>blitz</strong> runs from 3 to 10, <strong>rapid</strong> from 10 to 30, and anything longer is <strong>classical</strong>, the pace of an over-the-board tournament game. The exact cutoffs vary a little from one site to another, but the idea stays the same.",
             "Faster games reward quick pattern recognition and punish hesitation. Slower ones leave room to actually calculate a line before playing it. Neither is more correct: bullet is closer to a reflex contest, classical closer to how serious chess is actually played, and most people settle somewhere in between.",
             "There is no obligation to play against a clock at all: chang64's own time control picker includes a \"no clock\" option for exactly that. A rapid game around 10+0 is a common place to start if you want a clock without the pressure of blitz."],
        fr: ["Toute partie chronométrée s'écrit avec deux nombres : le temps de départ de chaque camp, et les secondes rendues après chaque coup, l'incrément. 10+0 veut dire dix minutes sans incrément ; 3+2 veut dire trois minutes plus deux secondes de plus à chaque coup joué.",
             "Les noms bullet, blitz, rapide... ne sont que des tranches selon ce premier nombre, le temps de départ. Environ : le <strong>bullet</strong> c'est moins de 3 minutes, le <strong>blitz</strong> de 3 à 10, le <strong>rapide</strong> de 10 à 30, et au-delà c'est la cadence <strong>classique</strong>, celle d'une partie de tournoi sur échiquier. Les seuils exacts varient un peu d'un site à l'autre, mais l'idée reste la même.",
             "Une partie rapide récompense les réflexes et le sens du motif ; une partie lente laisse le temps de vraiment calculer une ligne avant de la jouer. Aucune des deux n'est \"la bonne\" : le bullet se rapproche d'un jeu de réflexes, le classique de la pratique sérieuse du jeu, et la plupart des joueurs se situent quelque part entre les deux.",
             "Rien n'oblige à jouer contre un chronomètre : le sélecteur de cadence de chang64 propose justement une option \"sans pendule\" pour ça. Une cadence rapide autour de 10+0 est un bon point de départ si tu veux un chronomètre sans la pression du blitz."] } },
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
             "Le diagramme montre le résultat : les Blancs ont trois pièces développées, un pion au centre et un roi roqué, en sept coups. Rien d'astucieux, juste les principes appliqués dans l'ordre."] } },
{ slug: { en: "spotting-a-hanging-piece", fr: "reperer-une-piece-qui-traine" },
    fen: "4k3/8/8/8/8/8/4q3/4R1K1 w - - 0 1",
    title: { en: "Spotting a hanging piece", fr: "Repérer une pièce qui traîne" },
    body: {
      en: ["A piece is <strong>hanging</strong> when it can be captured for free: nothing defends it, or what defends it is worth less than the attacker risks. Most tactics below build on top of this one skill, so it comes first.",
           "Before every move, form the habit of asking two questions in this order: what did my opponent's last move create or abandon, and is anything of mine or theirs currently undefended? The diagram is the simplest case: a rook takes a queen that nobody is watching.",
           "This sounds trivial written down, and it is exactly why it gets missed in a real game: nobody hangs a queen on purpose, it happens because attention was somewhere else. Scanning for hanging pieces after every single move, yours and theirs, catches far more than any pattern name below."],
      fr: ["Une pièce <strong>traîne</strong> quand elle peut être prise gratuitement : rien ne la défend, ou ce qui la défend vaut moins que ce que l'attaquant risque. Presque tous les motifs ci-dessous s'appuient sur ce seul réflexe, c'est pour ça qu'il vient en premier.",
           "Avant chaque coup, prends l'habitude de te poser deux questions, dans cet ordre : qu'est-ce que le dernier coup adverse a créé ou abandonné, et est-ce que quelque chose, à moi ou à l'adversaire, traîne sans défense en ce moment ? Le diagramme montre le cas le plus simple : une tour prend une dame que personne ne surveille.",
           "Ça paraît trivial une fois écrit, et c'est justement pour ça que ça passe inaperçu en vraie partie : personne ne laisse traîner sa dame exprès, ça arrive parce que l'attention était ailleurs. Scanner les pièces non défendues après chaque coup, le tien comme celui de l'adversaire, rapporte plus que n'importe quel motif nommé ci-dessous."] } },

  { slug: { en: "knight-fork", fr: "la-fourchette-de-cavalier" },
    fen: "4r1k1/8/8/7N/8/8/8/7K w - - 0 1",
    title: { en: "The knight fork", fr: "La fourchette de cavalier" },
    body: {
      en: ["A <strong>fork</strong> is one piece attacking two targets at once, so the opponent can only save one of them. The knight is the classic forking piece: its L-shaped move lets it attack squares that look completely unrelated to each other from anywhere else on the board.",
           "In the diagram, the knight jumps to f6. That move gives check to the king on g8, and from that same square it also attacks the rook on e8. The king must move first, since check always comes first, and the rook falls next move.",
           "What makes knight forks dangerous is exactly this: the two targets rarely look connected. A queen and a rook on opposite sides of the board can both be one knight jump away from the same square. Whenever a knight has just moved or is about to, it is worth checking every square it now attacks, not just the obvious one."],
      fr: ["Une <strong>fourchette</strong>, c'est une pièce qui attaque deux cibles à la fois : l'adversaire ne peut en sauver qu'une. Le cavalier est la pièce fourchette par excellence : son déplacement en L lui permet d'attaquer des cases qui n'ont, vues d'ailleurs sur l'échiquier, absolument aucun rapport entre elles.",
           "Sur le diagramme, le cavalier saute en f6. Ce coup met le roi en g8 en échec, et depuis cette même case, il attaque aussi la tour en e8. Le roi doit bouger en premier, l'échec passant toujours avant tout, et la tour tombe au coup suivant.",
           "Ce qui rend les fourchettes de cavalier dangereuses, c'est précisément ça : les deux cibles n'ont presque jamais l'air liées. Une dame et une tour aux deux bouts de l'échiquier peuvent très bien se retrouver à un seul saut de cavalier l'une de l'autre. Dès qu'un cavalier vient de bouger ou s'apprête à le faire, ça vaut le coup de vérifier toutes les cases qu'il attaque désormais, pas seulement la plus visible."] } },

  { slug: { en: "pawn-fork", fr: "la-fourchette-de-pion" },
    fen: "4k3/8/8/3q1r2/4P3/8/8/4K3 w - - 0 1",
    title: { en: "The pawn fork", fr: "La fourchette de pion" },
    body: {
      en: ["Pawns capture diagonally, one square forward. That single detail means a single pawn already attacks two squares at once, which makes it a natural forking piece the moment two enemy pieces line up on those two diagonals.",
           "In the diagram, the white pawn on e4 attacks both d5 and f5, where a queen and a rook happen to sit. Whichever one moves, the pawn takes the other. Neither piece can simply capture the pawn back for free without losing more material than it gains.",
           "Pawn forks are easy to miss because pawns look passive. A piece that can only inch forward one square rarely feels like a threat, right up until it is standing next to two pieces that both need to move at once."],
      fr: ["Les pions capturent en diagonale, une case en avant. Ce seul détail fait qu'un pion attaque déjà deux cases à la fois, ce qui en fait une pièce à fourchette naturelle dès que deux pièces adverses se retrouvent alignées sur ces deux diagonales.",
           "Sur le diagramme, le pion blanc en e4 attaque à la fois d5 et f5, où se trouvent justement une dame et une tour. Quelle que soit celle qui bouge, le pion prend l'autre. Aucune des deux ne peut simplement reprendre le pion gratuitement sans perdre plus qu'elle ne gagne.",
           "Les fourchettes de pion passent facilement inaperçues parce qu'un pion a l'air passif. Une pièce qui ne fait qu'avancer d'une case à la fois ne ressemble à une menace que trop tard, une fois qu'elle se retrouve juste à côté de deux pièces qui doivent bouger en même temps."] } },

  { slug: { en: "double-attack", fr: "la-double-attaque" },
    fen: "4r1k1/8/8/8/8/8/8/4Q1K1 w - - 0 1",
    title: { en: "Double attack: forks that aren't knight moves", fr: "La double attaque : les fourchettes sans cavalier" },
    body: {
      en: ["Any piece can create a fork, not only knights and pawns. A queen, rook or bishop attacking two targets at once from a single square works on exactly the same logic: the opponent has one move to save two things.",
           "A queen is especially good at this because it moves like a rook and a bishop combined, so it can line up threats along a file, a rank, and a diagonal all from the same square, something no other piece can do.",
           "The habit to build is the same as for a knight fork: after any queen, rook or bishop move, check every square that piece attacks from its new position, not only the one that motivated the move in the first place."],
      fr: ["N'importe quelle pièce peut créer une fourchette, pas seulement le cavalier et le pion. Une dame, une tour ou un fou qui attaquent deux cibles à la fois depuis une seule case obéissent exactement à la même logique : l'adversaire n'a qu'un coup pour en sauver deux.",
           "La dame excelle particulièrement à ça, puisqu'elle se déplace comme une tour et un fou réunis : elle peut aligner des menaces sur une colonne, une rangée et une diagonale depuis la même case, ce qu'aucune autre pièce ne sait faire.",
           "Le réflexe à prendre est le même que pour une fourchette de cavalier : après tout coup de dame, de tour ou de fou, vérifie toutes les cases attaquées depuis la nouvelle position, pas seulement celle qui a motivé le coup au départ."] } },

  { slug: { en: "the-pin", fr: "le-clouage" },
    fen: "4k3/8/4r3/8/4Q3/8/8/4K3 w - - 0 1",
    title: { en: "The pin: a piece that can't move", fr: "Le clouage : une pièce qui ne peut pas bouger" },
    body: {
      en: ["A piece is <strong>pinned</strong> when moving it would expose a more valuable piece behind it, usually the king, to attack. A pinned piece is not captured or threatened directly: it is simply frozen, unable to do its normal job.",
           "In the diagram, the black rook on e6 sits between the white queen and the black king, all three lined up on the e-file. The rook cannot move off that file at all: doing so would put its own king in check, which is illegal. It can only shuffle along the very file that traps it.",
           "A pin against the king, like this one, is absolute: there is no legal way around the rule. A pin against any other piece is merely costly to break, not illegal, but the practical effect is often the same: the pinned piece is removed from the game as long as the pin holds."],
      fr: ["Une pièce est <strong>clouée</strong> quand la bouger exposerait une pièce plus précieuse derrière elle, en général le roi, à une attaque. Une pièce clouée n'est ni capturée ni menacée directement : elle est simplement figée, incapable de jouer son rôle habituel.",
           "Sur le diagramme, la tour noire en e6 est prise en sandwich entre la dame blanche et le roi noir, tous trois alignés sur la colonne e. La tour ne peut absolument pas quitter cette colonne : le faire mettrait son propre roi en échec, ce qui est interdit. Elle ne peut que se déplacer le long de la colonne qui la piège.",
           "Un clouage contre le roi, comme ici, est absolu : il n'existe aucun moyen légal de le contourner. Un clouage contre une autre pièce est seulement coûteux à briser, pas interdit, mais l'effet pratique est souvent le même : la pièce clouée sort du jeu tant que le clouage tient."] } },

  { slug: { en: "the-skewer", fr: "l-enfilade" },
    fen: "4q3/8/8/8/4k3/8/8/4R2K b - - 0 1",
    title: { en: "The skewer: a pin turned around", fr: "L'enfilade : un clouage à l'envers" },
    body: {
      en: ["A <strong>skewer</strong> is a pin in reverse. Instead of a low-value piece shielding a high-value one, the high-value piece is in front and forced to move, uncovering something less valuable directly behind it on the same line.",
           "In the diagram it is White's rook giving check to the black king along the e-file, with the black queen sitting right behind it. The king has no choice but to move off the file to answer the check. Once it does, the rook simply takes the queen on the next move.",
           "The distinction between a pin and a skewer is entirely about which piece is in front. If the valuable piece is in front and forced to move, it's a skewer. If the valuable piece is behind and frozen in place, it's a pin. Both come from the exact same geometry: three pieces on one line."],
      fr: ["Une <strong>enfilade</strong> est un clouage à l'envers. Au lieu d'une pièce de faible valeur qui protège une pièce précieuse, c'est la pièce précieuse qui est devant et forcée de bouger, découvrant quelque chose de moins précieux juste derrière elle sur la même ligne.",
           "Sur le diagramme, c'est la tour blanche qui met le roi noir en échec le long de la colonne e, avec la dame noire juste derrière. Le roi n'a d'autre choix que de quitter la colonne pour répondre à l'échec. Une fois cela fait, la tour n'a qu'à prendre la dame au coup suivant.",
           "La différence entre un clouage et une enfilade tient entièrement à quelle pièce est devant. Si la pièce précieuse est devant et forcée de bouger, c'est une enfilade. Si la pièce précieuse est derrière et figée sur place, c'est un clouage. Les deux viennent exactement de la même géométrie : trois pièces sur une ligne."] } },

  { slug: { en: "back-rank-mate", fr: "le-mat-du-couloir" },
    fen: "6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1",
    title: { en: "The back-rank mate", fr: "Le mat du couloir" },
    body: {
      en: ["Castling tucks the king away safely, and the pawns in front of it feel like protection. They can just as easily become a wall with the king inside it: a king with no pawn moved in front of it has nowhere to go if a rook or queen reaches its back rank.",
           "In the diagram, the black king on g8 is boxed in by its own pawns on f7, g7 and h7. When the white rook arrives on e8, the king cannot step anywhere: every square is either occupied by a friendly pawn or attacked by the rook itself. That is checkmate.",
           "The fix is simple and worth doing on reflex once a game reaches this kind of position: push one pawn one square, usually the one nearest the king, to give it an escape square. Players call this <strong>luft</strong>, German for air, and forgetting it is one of the most common ways to lose an otherwise winning position."],
      fr: ["Le roque met le roi à l'abri, et les pions devant lui donnent une impression de protection. Ils peuvent tout aussi bien devenir un mur qui l'enferme : un roi dont aucun pion devant lui n'a bougé n'a nulle part où aller si une tour ou une dame atteint sa dernière rangée.",
           "Sur le diagramme, le roi noir en g8 est encerclé par ses propres pions en f7, g7 et h7. Quand la tour blanche arrive en e8, le roi ne peut aller nulle part : chaque case est soit occupée par un pion ami, soit attaquée par la tour elle-même. C'est échec et mat.",
           "La parade est simple et vaut le coup de devenir un réflexe dès qu'une partie atteint ce genre de position : avance un pion d'une case, en général celui le plus proche du roi, pour lui donner une case d'évasion. On appelle ça <strong>luft</strong> (l'air, en allemand), et l'oublier est l'une des façons les plus courantes de perdre une position pourtant gagnante."] } },

  { slug: { en: "deflection", fr: "la-deviation" },
    fen: "3q2k1/5ppp/8/3r4/8/5P2/8/3RR2K w - - 0 1",
    title: { en: "Deflection: one piece, two jobs", fr: "La déviation : une pièce, deux tâches" },
    body: {
      en: ["Some pieces end up doing two jobs at once without anyone intending it: a queen defending a piece on one line while also being the only thing stopping a checkmate on another. <strong>Deflection</strong> is attacking that piece to force it to choose.",
           "In the diagram, the black queen on d8 is the only piece guarding both the rook on d5 and the back rank behind it. Capturing the rook invites the natural recapture with the queen, but doing so would pull the queen off the back rank, and a white rook is waiting on e1 for exactly that moment.",
           "This is the pattern to look for, more than any single position: find a defender doing more than one job, and ask what happens to the job it's not currently doing if it's forced to move. The best defence isn't always to recapture, which is exactly why deflections work: giving up the material you deflected with is still worth it if the second job was more important than the piece you spent to expose it."],
      fr: ["Certaines pièces se retrouvent à faire deux travaux à la fois sans que personne ne l'ait vraiment prévu : une dame qui défend une pièce sur une ligne tout en étant aussi la seule chose empêchant un mat sur une autre. La <strong>déviation</strong> consiste à attaquer cette pièce pour la forcer à choisir.",
           "Sur le diagramme, la dame noire en d8 est la seule à garder à la fois la tour en d5 et la dernière rangée derrière elle. Prendre la tour invite à la reprise naturelle avec la dame, mais celle-ci quitterait alors la dernière rangée, et une tour blanche attend justement en e1 pour ce moment précis.",
           "C'est ce motif-là qu'il faut chercher, plus qu'une position précise : trouve un défenseur qui fait plus d'un travail, et demande-toi ce qui arrive au travail qu'il ne fait plus s'il est forcé de bouger. La meilleure défense n'est pas toujours de reprendre, et c'est exactement pour ça que les déviations fonctionnent : sacrifier le matériel qui a servi à dévier reste rentable si le second travail comptait plus que la pièce dépensée pour l'exposer."] } },

  { slug: { en: "the-quiet-move", fr: "le-coup-silencieux" },
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    title: { en: "The quiet move: the hardest kind to find", fr: "Le coup silencieux : le plus dur à trouver" },
    body: {
      en: ["Every pattern above starts the same way: a capture or a check, something forcing and loud. A <strong>quiet move</strong> does neither. It doesn't take anything and doesn't give check, which is exactly why it's the hardest kind of winning move to find.",
           "The human eye is trained, correctly, to look at captures and checks first: they are forcing, so they narrow down what the opponent can do in reply. A quiet move gives the opponent every option on the board, which makes it feel like it can't possibly be the strongest choice. Often it is anyway, because it sets something up two or three moves ahead that no amount of checking or capturing right now would achieve.",
           "There is no diagram that teaches this one the way a fork or a pin can be shown in a single frozen position: the whole point is that nothing dramatic is happening yet. The only real training is the habit itself: once the obvious captures and checks have been considered and rejected, force yourself to also look at moves that do neither, before deciding none of them work."],
      fr: ["Tous les motifs ci-dessus commencent de la même façon : une prise ou un échec, quelque chose de forçant et de visible. Un <strong>coup silencieux</strong> ne fait ni l'un ni l'autre. Il ne prend rien et ne fait pas échec, ce qui explique justement pourquoi c'est le type de coup gagnant le plus dur à trouver.",
           "L'œil humain est entraîné, à juste titre, à regarder les prises et les échecs en premier : ils sont forçants, donc ils réduisent ce que l'adversaire peut répondre. Un coup silencieux laisse toutes les options ouvertes à l'adversaire, ce qui donne l'impression qu'il ne peut pas être le meilleur choix. C'est pourtant souvent le cas, parce qu'il prépare quelque chose deux ou trois coups plus loin, quelque chose qu'aucun échec ni aucune prise immédiate n'obtiendrait.",
           "Aucun diagramme n'enseigne vraiment celui-là comme on peut montrer une fourchette ou un clouage sur une position figée : tout l'enjeu, c'est que rien de spectaculaire ne se passe encore. Le seul vrai entraînement, c'est le réflexe lui-même : une fois les prises et les échecs évidents examinés puis écartés, force-toi à regarder aussi les coups qui ne font ni l'un ni l'autre, avant de conclure qu'aucun ne fonctionne."] } }
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
     "Une série d'échecs à laquelle le défenseur ne peut pas échapper. La partie est nulle par répétition, ce qui en fait la bouée de sauvetage classique dans une position perdue.", "King attack"],
    ["blunder", "gaffe", "Blunder", "Gaffe",
     "A move that loses material or the game outright, usually because a threat or a hanging piece was missed. Most of chang64's tactics puzzles exist because a real player, somewhere, made exactly this mistake.",
     "Un coup qui perd du matériel ou la partie tout net, en général parce qu'une menace ou une pièce en prise est passée inaperçue. La plupart des exercices de chang64 existent parce qu'un vrai joueur, quelque part, a commis exactement cette erreur.", "Winning capture"],
    ["mistake", "erreur", "Mistake", "Erreur",
     "A move that makes the position clearly worse without losing outright, one notch below a blunder. It hands the opponent a real advantage rather than an immediate win.",
     "Un coup qui dégrade nettement la position sans pour autant tout perdre, un cran en dessous de la gaffe. Il offre un vrai avantage à l'adversaire, mais pas un gain immédiat.", "Winning move"],
    ["inaccuracy", "imprecision", "Inaccuracy", "Imprécision",
     "A move that is not the best available and quietly gives something back: a tempo, a square, a fraction of an advantage. Rarely punished on the spot, but a habit of inaccuracies is how good positions slip away.",
     "Un coup qui n'est pas le meilleur possible et qui cède discrètement quelque chose : un temps, une case, une fraction d'avantage. Rarement puni sur le moment, mais une habitude d'imprécisions, c'est ainsi qu'une bonne position finit par filer.", ""],
    ["best-move", "meilleur-coup", "Best move", "Meilleur coup",
     "The move an engine ranks above every alternative in a given position. Playing the best move every time is not the goal of a human game: playing well under time pressure with an imperfect view of the position is the actual skill.",
     "Le coup qu'un moteur classe au-dessus de tous les autres dans une position donnée. Jouer le meilleur coup à chaque fois n'est pas le but d'une partie humaine : la vraie compétence, c'est bien jouer sous la pression du temps avec une vue imparfaite de la position.", ""],
    ["only-move", "seul-coup", "Only move", "Seul coup",
     "A position where every other legal move loses, often by force. Spotting that a move is forced, rather than merely good, is itself a skill: it tells you how much room for error is actually left.",
     "Une position où tout autre coup légal perd, souvent de façon forcée. Repérer qu'un coup est forcé, et pas seulement bon, est une compétence en soi : ça indique la marge d'erreur qu'il reste réellement.", ""],
    ["brilliant-move", "coup-brillant", "Brilliant move", "Coup brillant",
     "A move that gives up material yet turns out to be objectively strong, often the only way to keep an advantage or force a win. What makes it brilliant is that giving up material almost never looks correct at first glance.",
     "Un coup qui cède du matériel tout en étant objectivement fort, souvent la seule façon de garder l'avantage ou de forcer le gain. Ce qui le rend brillant, c'est que céder du matériel n'a presque jamais l'air correct au premier regard.", "Deflection"],
    ["elo-rating", "le-classement-elo", "The Elo rating: what your number actually means", "Le classement Elo : ce que ton chiffre veut vraiment dire",
     "An Elo rating is a running estimate of skill built from one simple idea: each result nudges the number up or down by an amount that depends on how surprising it was. Beating someone much stronger moves it a lot; beating someone much weaker barely moves it at all. chang64 treats each puzzle level as an opponent of a fixed strength and updates your rating the same way after every attempt. Worth saying plainly: this number is a personal, relative tracker, not a certified skill measurement. Sites like Lichess calibrate their puzzle ratings against millions of real attempts from real players, cross-checked against each other; chang64 keeps no accounts and tracks nothing across players, by design, so there is no population to calibrate against. Your rating here is honest about your own progress over time — it isn't a claim that a given number equals the same strength on Lichess or in a FIDE-rated tournament. That doesn't make it meaningless: watching it rise still means exactly what it always has, that you're solving problems that used to be out of reach.",
     "Un classement Elo est une estimation continue du niveau, construite sur une idée simple : chaque résultat déplace le chiffre vers le haut ou le bas, d'autant plus que le résultat était surprenant. Battre bien plus fort que soi fait beaucoup bouger le curseur ; battre bien plus faible le bouge à peine. chang64 traite chaque niveau d'exercice comme un adversaire d'une force fixe, et met à jour ta notation de la même façon après chaque tentative. Autant le dire clairement : ce chiffre est un repère personnel et relatif, pas une mesure de niveau certifiée. Des sites comme Lichess calibrent leur classement de puzzles sur des millions de vraies tentatives de vrais joueurs, recoupées entre elles ; chang64 ne garde aucun compte et ne suit rien d'un joueur à l'autre, par choix, donc il n'existe aucune population à laquelle se calibrer. Ta notation ici est honnête sur ta propre progression dans le temps — ce n'est pas une affirmation qu'un chiffre donné équivaut à la même force sur Lichess ou dans un tournoi homologué FIDE. Ça ne la rend pas dénuée de sens pour autant : la voir monter veut toujours dire exactement la même chose, que tu résous des problèmes qui étaient hors de portée avant.", ""]
  ];

  const byTheme = {};
  for (const p of puzzles) (byTheme[p.theme] = byTheme[p.theme] || []).push(p);

  /* ================= EXEMPLES PAR CATEGORIE (remplace les pages 1/exercice) =================
     Ancien systeme : une page statique par exercice (2x banque, en+fr) -- tenable a 1779
     exercices (3558 pages), plus du tout a 51638 (103k+ pages, largement au-dessus du plafond
     Cloudflare Pages : 20k gratuit / 100k payant). Nouveau systeme : une page par categorie
     (10 categories x 2 langues = 20 pages), chacune montrant 3 exemples selectionnes et
     expliques en detail plutot qu'une fiche par exercice. La banque complete (51638) reste
     intacte comme donnees de jeu (Resoudre, Puzzle Rush, difficulte adaptative) -- seule la
     generation de pages statiques change. */
  /* 13 categories au total dans la banque (10 principales + 3 marginales en
     volume : Deflection 5, Quiet move 49, Mate in three 61) -- toutes ont
     desormais leur page, la taille du groupe ne changeant rien au nombre
     d'exemples affiches (toujours 3). */
  const THEME10 = ["Winning capture", "Double attack", "Skewer", "Mate in two", "Winning move",
                    "Knight fork", "Mate in one", "Back-rank mate", "Pin", "Pawn fork",
                    "Deflection", "Quiet move", "Mate in three"];

  function categorySlug(theme, lang) { return slug(themeOf(theme, lang)); }

  /* 3 exemples par categorie, choisis a des percentiles de difficulte fixes (15/50/85) sur le
     champ diff deja calcule par difficulty_v2.js -- un facile, un moyen, un plus dur, plutot
     que les 3 premiers rencontres (qui seraient quasi tous du meme niveau vu le tri par id). */
  const examplesByTheme = {};
  for (const th of THEME10) {
    const pool = (byTheme[th] || []).slice().sort((a, b) => a.diff - b.diff);
    const n = pool.length;
    if (!n) { examplesByTheme[th] = []; continue; }
    const idxs = [Math.floor(n * 0.15), Math.floor(n * 0.5), Math.floor(n * 0.85)];
    examplesByTheme[th] = idxs.map(i => pool[Math.min(i, n - 1)]);
  }

  const THEME_DEFS = {
    "Winning capture": {
      en: "The simplest tactic there is: a piece is undefended, or defended by less than it's worth, so it can just be taken for a clean material gain.",
      fr: "Le motif le plus simple qui soit : une pièce n'est pas défendue, ou l'est par moins qu'elle ne vaut, donc on la prend tout net, pour un gain de matériel sans contrepartie." },
    "Double attack": {
      en: "One move creates two threats at once, against two different targets. The defender can only deal with one of them, so the other falls.",
      fr: "Un seul coup crée deux menaces à la fois, sur deux cibles différentes. Le défenseur ne peut en parer qu'une : l'autre tombe." },
    "Skewer": {
      en: "The reverse of a pin: the valuable piece is in front and must move to avoid capture, leaving the piece behind it to be taken.",
      fr: "L'inverse du clouage : la pièce de valeur est devant et doit bouger pour ne pas être prise, ce qui abandonne la pièce qui se trouve juste derrière." },
    "Mate in two": {
      en: "A forced sequence: whatever the defender plays, checkmate follows exactly two moves later. Every possible reply has been checked by the engine, not just the most obvious one.",
      fr: "Une séquence forcée : quoi que joue le défenseur, le mat tombe exactement deux coups plus tard. Chaque réponse possible a été vérifiée par le moteur, pas seulement la plus évidente." },
    "Winning move": {
      en: "A position where the strongest move doesn't fit a single named pattern below — it may combine several ideas at once, or simply be the one move that keeps every option open. Verified by direct engine comparison against every alternative.",
      fr: "Une position où le coup le plus fort ne rentre dans aucun motif nommé ci-dessus — il peut combiner plusieurs idées à la fois, ou être tout simplement le seul coup qui garde toutes les options ouvertes. Vérifié par comparaison directe du moteur avec chaque alternative." },
    "Knight fork": {
      en: "One knight move attacks two enemy pieces at once. Because a knight's move can't be blocked by anything standing between the squares, there is no way to defend both — one of them has to fall.",
      fr: "Un coup de cavalier attaque deux pièces adverses à la fois. Comme le déplacement du cavalier ne peut être bloqué par rien de ce qui se trouve entre les cases, impossible de défendre les deux en même temps : l'une doit tomber." },
    "Mate in one": {
      en: "A single move delivers checkmate immediately: the king has no legal escape square, no piece can block the attack, and no piece can capture the attacker.",
      fr: "Un seul coup donne échec et mat immédiatement : le roi n'a aucune case de fuite légale, aucune pièce ne peut bloquer l'attaque, et aucune pièce ne peut prendre l'attaquant." },
    "Back-rank mate": {
      en: "A rook or queen mates a castled king trapped behind its own unmoved pawns. The most common mate in club chess, and the reason players open a small escape square early.",
      fr: "Une tour ou une dame mate un roi roqué, coincé derrière ses propres pions qui n'ont pas bougé. Le mat le plus fréquent en club, et la raison pour laquelle on ouvre tôt une case de fuite." },
    "Pin": {
      en: "A piece cannot move without exposing a more valuable piece standing behind it. If the piece behind is the king, the pin is absolute and the pinned piece is legally frozen in place.",
      fr: "Une pièce ne peut pas bouger sans exposer une pièce plus précieuse qui se trouve juste derrière elle. Si c'est le roi qui est derrière, le clouage est absolu et la pièce clouée est légalement immobilisée." },
    "Pawn fork": {
      en: "A humble pawn move attacks two pieces at once, one on each of its diagonal capture squares. Because it's only a pawn, the defender often doesn't see it coming — and can't save both pieces either way.",
      fr: "Un simple coup de pion attaque deux pièces à la fois, une sur chacune de ses deux cases de capture en diagonale. Comme ce n'est qu'un pion, le défenseur ne le voit souvent pas venir — et ne peut de toute façon pas sauver les deux pièces." },
    "Deflection": {
      en: "A move — often a sacrifice — attacks the one piece standing guard over something else. Forced to deal with the immediate threat, that piece abandons its post, and what it was protecting falls.",
      fr: "Un coup, souvent un sacrifice, attaque la seule pièce qui protégeait autre chose. Forcée de parer la menace immédiate, cette pièce abandonne son poste, et ce qu'elle gardait tombe." },
    "Quiet move": {
      en: "The winning move captures nothing and gives no check, which is exactly what makes it hard to find — nothing about it jumps out as a candidate. It still turns out to be the strongest move on the board.",
      fr: "Le coup gagnant ne capture rien et ne fait pas échec, ce qui explique pourquoi il est difficile à trouver — rien ne le distingue au premier regard. C'est pourtant le coup le plus fort de la position." },
    "Mate in three": {
      en: "A forced sequence: whatever the defender plays, checkmate follows exactly three moves later. Every possible defence at every step has been checked by the engine, not just the most obvious one.",
      fr: "Une séquence forcée : quoi que joue le défenseur, le mat tombe exactement trois coups plus tard. Chaque défense possible, à chaque étape, a été vérifiée par le moteur, pas seulement la plus évidente." }
  };

  const FR_PIECE = { p: ["pion", "m"], n: ["cavalier", "m"], b: ["fou", "m"], r: ["tour", "f"], q: ["dame", "f"], k: ["roi", "m"] };
  const EN_PIECE = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
  function pieceFr(letter) {
    const [w, g] = FR_PIECE[letter] || ["pièce", "f"];
    return { w, art: g === "f" ? "la" : "le", suf: g === "f" ? "e" : "" };
  }
  function pieceEn(letter) { return EN_PIECE[letter] || "piece"; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* Rejoue la solution complete pour recuperer le SAN de chaque coup et le camp au trait --
     ne fait AUCUNE hypothese sur la position, tout est recalcule depuis le fen reel. */
  function replaySolution(p) {
    const g = new Game(p.fen);
    const side = g.turn === 0 ? "w" : "b";
    const sans = [];
    for (const uci of p.sol) {
      const mv = g.moves().find(m => g.uci(m) === uci);
      if (!mv) break;
      sans.push(g.san(mv));
      g.makeMove(mv);
    }
    return { side, sans };
  }

  /* Explication specifique par theme, batie UNIQUEMENT sur des donnees reellement calculees
     par classify()/classifyBase() (champ p.explain) et sur le SAN rejoue ci-dessus -- jamais
     une affirmation tactique inventee au-dela de ce que ces deux sources etablissent. */
  function exampleExplanation(lang, p, side, sans) {
    const d = p.explain || {};
    const sideLabel = lang === "fr" ? (side === "w" ? "Les Blancs" : "Les Noirs") : (side === "w" ? "White" : "Black");
    const first = sans[0];
    if (p.theme === "Winning capture") {
      const pc = lang === "fr" ? pieceFr(d.piece) : null;
      return lang === "fr"
        ? `${sideLabel} jouent ${first}. ${cap(pc.art)} ${pc.w} adverse en ${d.sq} n'était pas suffisamment défendu${pc.suf} : il suffit de ${pc.art} prendre, pour un gain de matériel sans contrepartie.`
        : `${sideLabel} play ${first}. The ${pieceEn(d.piece)} on ${d.sq} wasn't defended enough to survive — it's simply captured, for a clean material gain.`;
    }
    if (p.theme === "Double attack" || p.theme === "Knight fork" || p.theme === "Pawn fork") {
      const [t1, t2] = d.targets || [];
      if (!t1 || !t2) return "";
      const pieceKind = p.theme === "Knight fork" ? (lang === "fr" ? "cavalier" : "knight")
        : p.theme === "Pawn fork" ? (lang === "fr" ? "pion" : "pawn") : null;
      if (lang === "fr") {
        const p1 = pieceFr(t1.piece), p2 = pieceFr(t2.piece);
        const via = pieceKind ? `Le ${pieceKind} en ${d.from}` : `Depuis ${d.from}, la pièce`;
        return `${sideLabel} jouent ${first}. ${via} attaque à la fois ${p1.art} ${p1.w} en ${t1.sq} et ${p2.art} ${p2.w} en ${t2.sq} : impossible de sauver les deux en un seul coup.`;
      }
      const via = pieceKind ? `The ${pieceKind} on ${d.from}` : `From ${d.from}, the piece`;
      return `${sideLabel} play ${first}. ${via} attacks both the ${pieceEn(t1.piece)} on ${t1.sq} and the ${pieceEn(t2.piece)} on ${t2.sq} at once — there's no single move that saves both.`;
    }
    if (p.theme === "Pin" || p.theme === "Skewer") {
      const pin = d.pinned, beh = d.behind;
      if (!pin || !beh) return "";
      if (d.captured) {
        /* Clouage DEJA present, exploite par le coup (pas cree par lui) : le
           defenseur ne pouvait pas reprendre, cloue contre son roi. Detail
           different (captured + pinned + behind) de celui du clouage cree
           par le coup (from + pinned + behind) -- meme theme, mecanique
           inverse, donc texte different. */
        const caught = d.captured;
        if (lang === "fr") {
          const pc1 = pieceFr(caught.piece), pc2 = pieceFr(pin.piece);
          return `${sideLabel} jouent ${first}. ${cap(pc1.art)} ${pc1.w} en ${caught.sq} n'était défendu${pc1.suf} que par ${pc2.art} ${pc2.w} en ${pin.sq} — mais celui-ci est cloué contre son roi et ne peut pas légalement reprendre : la prise est sûre.`;
        }
        return `${sideLabel} play ${first}. The ${pieceEn(caught.piece)} on ${caught.sq} was only defended by the ${pieceEn(pin.piece)} on ${pin.sq} — but that piece is pinned to its king and can't legally recapture: the capture is completely safe.`;
      }
      if (lang === "fr") {
        const p1 = pieceFr(pin.piece), p2 = pieceFr(beh.piece);
        return p.theme === "Pin"
          ? `${sideLabel} jouent ${first}. ${cap(p1.art)} ${p1.w} adverse en ${pin.sq} ne peut pas bouger sans exposer ${p2.art} ${p2.w}, juste derrière en ${beh.sq} : ${p1.art === "la" ? "elle" : "il"} est cloué${p1.suf}.`
          : `${sideLabel} jouent ${first}. ${cap(p1.art)} ${p1.w} adverse en ${pin.sq} doit bouger pour ne pas être pris${p1.suf}, ce qui abandonne ${p2.art} ${p2.w} qui se trouvait juste derrière, en ${beh.sq}.`;
      }
      return p.theme === "Pin"
        ? `${sideLabel} play ${first}. The ${pieceEn(pin.piece)} on ${pin.sq} can't move without exposing the ${pieceEn(beh.piece)} right behind it, on ${beh.sq} — it's pinned.`
        : `${sideLabel} play ${first}. The ${pieceEn(pin.piece)} on ${pin.sq} has to move to avoid capture, which abandons the ${pieceEn(beh.piece)} that was standing right behind it, on ${beh.sq}.`;
    }
    if (p.theme === "Back-rank mate") {
      return lang === "fr"
        ? `${sideLabel} jouent ${first} et matent. Le roi adverse en ${d.king} est coincé sur sa dernière rangée par ses propres pions : aucune case de fuite, mat immédiat.`
        : `${sideLabel} play ${first} and deliver mate. The enemy king on ${d.king} is trapped on the back rank by its own pawns — no escape square, immediate mate.`;
    }
    if (p.theme === "Mate in one") {
      return lang === "fr"
        ? `${sideLabel} jouent ${first} et matent d'un seul coup : le roi adverse n'a ni case de fuite légale, ni pièce pour bloquer ou prendre l'attaquant.`
        : `${sideLabel} play ${first} for immediate mate: the enemy king has no legal escape square, and no piece can block or capture the attacker.`;
    }
    if (p.theme === "Mate in two") {
      const line = sans.map((s, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : "") + s).join(" ");
      return lang === "fr"
        ? `${sideLabel} jouent ${first}. Quoi que réponde l'adversaire, le mat suit exactement deux coups plus tard (séquence complète : ${line}) — chaque défense possible a été vérifiée par le moteur.`
        : `${sideLabel} play ${first}. Whatever the defender tries, mate follows exactly two moves later (full line: ${line}) — every possible defence has been checked by the engine.`;
    }
    if (p.theme === "Winning move") {
      return lang === "fr"
        ? `${sideLabel} jouent ${first}. Ce coup ne rentre dans aucun motif nommé précis, mais c'est objectivement le meilleur : le moteur le préfère nettement à toute autre possibilité.`
        : `${sideLabel} play ${first}. This move doesn't fit one single named pattern, but it's objectively the strongest — the engine ranks it clearly above every alternative.`;
    }
    if (p.theme === "Deflection") {
      const df = d.deflected, gn = d.gained;
      const line = sans.map((s, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : "") + s).join(" ");
      if (!df) return "";
      if (lang === "fr") {
        const pd = pieceFr(df.piece);
        const gainTxt = gn ? ` Une fois déviée, elle ne défend plus ${gn.sq === df.sq ? "cette case" : `la case ${gn.sq}`}, qui tombe au coup suivant.` : "";
        return `${sideLabel} jouent ${first}. Ce coup attaque directement ${pd.art} ${pd.w} adverse en ${df.sq}, seule pièce qui protégeait autre chose : forcée de s'en occuper, elle abandonne son poste.${gainTxt} (séquence complète : ${line})`;
      }
      const gainTxt = gn ? ` Once deflected, it no longer guards ${gn.sq}, which falls on the next move.` : "";
      return `${sideLabel} play ${first}. This move attacks the ${pieceEn(df.piece)} on ${df.sq} directly — the one piece guarding something else. Forced to deal with it, that piece abandons its post.${gainTxt} (full line: ${line})`;
    }
    if (p.theme === "Quiet move") {
      return lang === "fr"
        ? `${sideLabel} jouent ${first}. Ce coup ne capture rien et ne fait pas échec — rien ne le distingue au premier regard — et pourtant c'est le meilleur coup de la position, qui gagne du matériel par la suite.`
        : `${sideLabel} play ${first}. This move captures nothing and gives no check — nothing about it stands out at first glance — yet it's the strongest move on the board, and it wins material.`;
    }
    if (p.theme === "Mate in three") {
      const line = sans.map((s, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : "") + s).join(" ");
      return lang === "fr"
        ? `${sideLabel} jouent ${first}. Quoi que réponde l'adversaire, le mat suit exactement trois coups plus tard (séquence complète : ${line}) — chaque défense possible, à chaque étape, a été vérifiée par le moteur.`
        : `${sideLabel} play ${first}. Whatever the defender tries, mate follows exactly three moves later (full line: ${line}) — every possible defence, at every step, has been checked by the engine.`;
    }
    return "";
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
    ${THEME10.includes(theme) ? `<a class="cta ghost" href="/${DIRS.puzzles[lang]}/${categorySlug(theme, lang)}.html">${lang === "fr" ? "Voir des exemples expliqués" : "See worked examples"}</a>` : ""}
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

  /* ================= 5. CATEGORY EXAMPLE PAGES (10 x 2 langues, remplace 1 page/exercice) ================= */
  for (const lang of ["en", "fr"]) {
    const dir = DIRS.puzzles[lang], u = UI[lang];
    for (const th of THEME10) {
      const examples = examplesByTheme[th];
      if (!examples.length) continue;
      const thLabel = themeOf(th, lang);
      const def = THEME_DEFS[th][lang];
      const title = lang === "fr" ? `${thLabel} : 3 exemples expliqués | chang64` : `${thLabel}: 3 worked examples | chang64`;
      const desc = metaDesc(lang === "fr"
        ? `${thLabel} aux échecs : la définition, et trois positions réelles expliquées coup par coup, vérifiées par le moteur.`
        : `${thLabel} in chess: the definition, and three real positions explained move by move, engine-verified.`);
      const canonical = `${SITE}/${dir}/${categorySlug(th, lang)}.html`;
      const alt = `${SITE}/${DIRS.puzzles[lang === "en" ? "fr" : "en"]}/${categorySlug(th, lang === "en" ? "fr" : "en")}.html`;
      const blocks = examples.map((p, i) => {
        const { side, sans } = replaySolution(p);
        const sideLabel = lang === "fr" ? (side === "w" ? "Blancs" : "Noirs") : (side === "w" ? "White" : "Black");
        const expl = exampleExplanation(lang, p, side, sans);
        const levelLabel = u.levels[p.level - 1];
        return `<section class="theme-bloc">
  <h2>${lang === "fr" ? "Exemple" : "Example"} ${i + 1} <span style="color:var(--sage);font-size:13px">(${esc(levelLabel)})</span></h2>
  <div class="cols">${diagram(p.fen, u.sideToMove(sideLabel))}
  <div>
    <p>${esc(expl)}</p>
    <details><summary style="cursor:pointer;color:#D9A83F;font-weight:600">${u.solution}</summary>
      <div class="moves" style="margin-top:10px">${esc(sans.join(" "))}</div></details>
    <a class="cta" href="/#puzzle=${p.id}">${lang === "fr" ? "Tester sur l'échiquier" : "Try it on the board"}</a>
  </div></div>
</section>`;
      }).join("\n");
      const body = `<h1>${esc(thLabel)}</h1>
<p class="lede">${esc(def)}</p>
${blocks}
<p><a class="cta ghost" href="/${dir}/">${u.back}</a></p>`;
      page(lang, dir, categorySlug(th, lang) + ".html", title, desc, body,
        { "@context": "https://schema.org", "@type": "LearningResource", name: title, inLanguage: lang,
          about: { "@type": "Thing", name: thLabel }, educationalLevel: "beginner" }, alt, canonical);
    }

    /* Index leger : 10 tuiles vers les pages de categorie, plutot que la grille complete des
       51638 exercices (l'ancienne approche, intenable a cette echelle -- voir la note en tete
       de section). D'autres categories/pages viendront s'y ajouter au fil du temps. */
    const t = lang === "fr" ? "Bibliothèque d'exemples tactiques" : "Tactics example library";
    const lede = lang === "fr"
      ? `Dix motifs tactiques, trois exemples expliqués pour chacun, tirés d'une banque de ${puzzles.length} positions vérifiées par le moteur.`
      : `Ten tactical patterns, three worked examples for each, drawn from a bank of ${puzzles.length} engine-verified positions.`;
    const body = `<h1>${esc(t)}</h1><p class="lede">${esc(lede)}</p><div class="grid">` +
      THEME10.filter(th => examplesByTheme[th].length).map(th =>
        `<a class="tile" href="/${dir}/${categorySlug(th, lang)}.html"><b>${esc(themeOf(th, lang))}</b><span>${lang === "fr" ? "3 exemples" : "3 examples"}</span></a>`
      ).join("") + `</div>`;
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
