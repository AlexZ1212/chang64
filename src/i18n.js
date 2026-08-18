/* ==========================================================
   0. INTERNATIONALISATION
   ========================================================== */
const FR={
/* --- navigation et accueil --- */
"Home":"Accueil","Play":"Jouer","Puzzles":"Exercices","Challenges":"Défis","Give up the Sprint":"Abandonner le Sprint","Confirm give up":"Confirmer l'abandon","Given up.":"Sprint abandonné.","Start Chang Sprint":"Lancer le Chang Sprint","Three minutes to solve as many puzzles as you can. Three misses and it stops.":"Trois minutes pour résoudre le plus d'exercices possible. Trois erreurs et ça s'arrête.","Train":"S'entraîner","Friends":"Entre amis","Watch":"Vidéos",
"Play chess.":"Joue aux échecs.","Solve tactics.":"Travaille la tactique.","Get better.":"Progresse.",
"Bullet to daily time controls against a built-in engine, __NP__ puzzles verified move by move, and games against friends over a plain link. No account, no sign-up.":
 "Du bullet au jeu par correspondance contre un moteur intégré, __NP__ exercices vérifiés coup par coup, et des parties entre amis par simple lien. Sans compte, sans inscription.",
"Play now":"Jouer maintenant","Puzzle of the day":"Exercice du jour","Install the app":"Installer l'application",
"Time control":"Cadence","Play the computer":"Jouer contre l'ordinateur",
"Start a game →":"Commencer une partie →","Tactics trainer":"Entraînement tactique",
"puzzles, each one proved by the engine. Difficulty rises after three in a row and eases off when you stumble.":
 "exercices, chacun démontré par le moteur. La difficulté monte après trois réussites et redescend quand tu trébuches.",
"Solve a puzzle →":"Résoudre un exercice →","Play a friend":"Jouer contre un ami",
"Every move produces a link. Send it on WhatsApp or Messenger, your friend replies with theirs. Nothing to install.":
 "Chaque coup produit un lien. Tu l'envoies par WhatsApp ou Messenger, ton ami te renvoie le sien. Rien à installer.",
"Challenge a friend →":"Défier un ami →",
"Puzzle level":"Niveau","Solved":"Résolus","Best streak":"Record","Puzzle rating":"Classement","Day streak":"Jours d'affilée",

/* --- partie --- */
"Computer":"Ordinateur","You":"Toi","Your game":"Ta partie","Settings":"Réglages",
"Piece animation":"Animation des pièces","Pieces slide to their square when a move is played. Turn it off if you prefer an instant board.":"Les pièces glissent vers leur case quand un coup est joué. Désactive si tu préfères un échiquier instantané.","Sprint over":"Sprint terminé","New personal best":"Nouveau record","Time's up":"Temps écoulé","Play again":"Rejouer","Close":"Fermer","Score: {score}. Your best yet.":"Score : {score}. Ton meilleur à ce jour.","Score: {score}. Your best is {best}.":"Score : {score}. Ton record est {best}.","Random":"Au hasard","Four strengths, from a forgiving beginner to an engine that punishes loose moves. Legal moves shown, no assistance while you play.":"Quatre niveaux, du débutant indulgent au moteur qui punit les coups approximatifs. Les coups légaux sont affichés, aucune aide pendant que tu joues.","Play White":"Jouer les Blancs","Play Black":"Jouer les Noirs",
"Beginner":"Débutant","Casual":"Tranquille","Solid":"Sérieux","Tough":"Coriace",
"New game":"Nouvelle partie","Start game":"Lancer la partie","Not started yet.":"Partie non commencée.",
"Choose your colour, the engine's strength and a time control, then start.":"Choisis ta couleur, la force du moteur et une cadence, puis lance la partie.","Show the best move":"Voir le meilleur coup","Suggest a move":"Suggérer un coup",
"Scoresheet":"Feuille de partie","White":"Blancs","Black":"Noirs","No moves yet":"Aucun coup joué",
"Use the arrow keys to step through the game.":"Utilise les flèches du clavier pour parcourir la partie.",
"Pick a colour and a strength, then play.":"Choisis ta couleur et la force du moteur, puis joue.",
"White to move.":"Trait aux Blancs.","Black to move.":"Trait aux Noirs.","Game over.":"Partie terminée.",
"Even position":"Position équilibrée",
"White slightly better":"Les Blancs sont un peu mieux","Black slightly better":"Les Noirs sont un peu mieux",
"White is better":"Les Blancs ont l'avantage","Black is better":"Les Noirs ont l'avantage",
"White is winning":"Les Blancs gagnent","Black is winning":"Les Noirs gagnent",
"Checkmate. You win.":"Échec et mat, tu gagnes.","Checkmate. The computer wins.":"Échec et mat, l'ordinateur gagne.",
"Stalemate. The game is drawn.":"Pat : la partie est nulle.","The game is drawn.":"Partie nulle.",
"The computer is thinking…":"L'ordinateur réfléchit…","Check. Your move.":"Échec au roi. À toi de jouer.",
"Your move.":"À toi de jouer.","Move taken back. Your turn.":"Coup repris. À toi de jouer.",
"Analysing…":"Analyse en cours…",
"New game, {tc}. You start.":"Nouvelle partie, {tc}. À toi de commencer.",
"New game, {tc}. The computer opens.":"Nouvelle partie, {tc}. L'ordinateur ouvre.",
"Try {san}: {why}":"Essaie {san} : {why}",
"it is mate.":"c'est mat.","it wins material.":"tu gagnes du matériel.",
"it checks and keeps the initiative.":"tu donnes échec et gardes l'initiative.",
"it tucks your king away.":"tu mets ton roi à l'abri.","it is the soundest move here.":"c'est le coup le plus solide ici.",
"Your flag fell. The computer wins on time.":"Ton drapeau est tombé. L'ordinateur gagne au temps.",
"The computer's flag fell. You win on time.":"Le drapeau de l'ordinateur est tombé. Tu gagnes au temps.",
"Flag falls, but there is not enough material to mate. Draw.":"Le drapeau tombe, mais le matériel ne suffit pas pour mater. Nulle.",
"New time control applies to your next game.":"La nouvelle cadence s'appliquera à la partie suivante.",
"No clock":"Sans pendule","Unlimited":"Illimité","Bullet":"Bullet","Blitz":"Blitz","Rapid":"Rapide","Classical":"Classique","Daily":"Correspondance",
"Bullet: every second counts. The engine will move almost instantly.":"Bullet : chaque seconde compte. Le moteur répond presque instantanément.",
"Blitz: the most popular pace online.":"Blitz : la cadence la plus jouée en ligne.",
"Rapid: enough time to actually think. A good default.":"Rapide : le temps de réfléchir vraiment. Un bon choix par défaut.",
"Classical: long games, no rush.":"Classique : des parties posées, sans précipitation.",
"Daily games are played with a friend over a link, one move at a time.":"Les parties par correspondance se jouent avec un ami par lien, un coup à la fois.",
"No clock: take as long as you like.":"Sans pendule : prends tout ton temps.",
"{n} day/move":"{n} jour/coup","{n} days/move":"{n} jours/coup",

/* --- navigation dans la partie --- */
"Review":"Analyse","Analyse this game":"Analyser cette partie","Analysing with Stockfish…":"Analyse avec Stockfish…",
"Stockfish for review":"Stockfish pour l'analyse","Stockfish is only used to review a finished game, never to help you play.":"Stockfish ne sert qu'à analyser une partie terminée, jamais à t'aider pendant que tu joues.","Stockfish enabled":"Stockfish activé","Loading…":"Chargement…",
"The built-in engine reviews your game instantly. Stockfish is stronger but downloads about 7 MB the first time.":
 "Le moteur intégré analyse ta partie instantanément. Stockfish est plus fort mais télécharge environ 7 Mo la première fois.",
"Stockfish is ready. Game review will now use it instead of the built-in engine.":
 "Stockfish est prêt. L'analyse de partie l'utilisera désormais à la place du moteur intégré.",
"Stockfish could not start ({why}). The built-in engine stays in use.":
 "Stockfish n'a pas pu démarrer ({why}). Le moteur intégré reste en service.",
"Stockfish is only used to review a finished game, never to help you play. It is stronger than the built-in engine, and downloads about 7 MB the first time.":"Stockfish ne sert qu'à analyser une partie terminée, jamais à t'aider pendant que tu joues. Il est plus fort que le moteur intégré, et télécharge environ 7 Mo à la première utilisation.",
"Stockfish is already running.":"Stockfish tourne déjà.",
"Fetching the engine, this can take a moment on a first visit.":"Téléchargement du moteur, cela peut prendre un moment à la première visite.",
"Stockfish stopped responding, falling back to the built-in engine.":"Stockfish ne répond plus, retour au moteur intégré.",
"timed out":"délai dépassé","file not found":"fichier introuvable","blocked":"bloqué",
"Accuracy":"Précision","Blunders":"Gaffes","Mistakes":"Erreurs",
"Live position. Arrow keys step through the game.":"Position actuelle. Les flèches parcourent la partie.",
"Reviewing move {i} of {n}. Play a move or press End to return.":"Coup {i} sur {n}. Joue un coup ou appuie sur Fin pour revenir.",
"Play a few moves first.":"Joue d'abord quelques coups.",
"Your side: {b} blunder(s), {m} mistake(s), {i} inaccuracy(ies).":"De ton côté : {b} gaffe(s), {m} erreur(s), {i} imprécision(s).",
"The costliest was move {n} ({san}); the engine preferred {best}.":"La plus coûteuse est le coup {n} ({san}) ; le moteur préférait {best}.",
"Accuracy here is a rough guide from a shallow search, not a rating.":"La précision affichée vient d'une recherche peu profonde : c'est un repère, pas un classement.",
"Analysed with Stockfish at depth 12.":"Analysé par Stockfish à profondeur 12.",
"Evaluation over the game":"Évaluation au fil de la partie",

/* --- PGN --- */
"Copy PGN":"Copier le PGN","Download":"Télécharger","Load PGN":"Charger le PGN",
"Paste a PGN here to load and review it":"Colle ici un PGN pour le charger et l'analyser",
"PGN copied to the clipboard.":"PGN copié dans le presse-papiers.","Download started.":"Téléchargement lancé.",
"Download unavailable here, PGN copied instead.":"Téléchargement indisponible ici, PGN copié à la place.",
"No moves found in that PGN.":"Aucun coup trouvé dans ce PGN.",
"Could not read any legal move from that PGN.":"Impossible de lire un coup légal dans ce PGN.",
"Could not read that PGN: “{tok}” is not a legal move from the start.":"PGN illisible : « {tok} » n'est pas un coup légal depuis le début.",
"Loaded {n} half-moves. Step through with the arrows, or analyse it.":"{n} demi-coups chargés. Parcours-les avec les flèches, ou lance l'analyse.",
"Loaded {n} half-moves, then stopped: “{tok}” is not legal in that position.":"{n} demi-coups chargés, puis arrêt : « {tok} » n'est pas légal dans cette position.",

/* --- exercices --- */
"Theme":"Thème","All themes":"Tous les thèmes","Level":"Niveau","Streak":"Série","Best":"Record","Rating":"Classement","Sprint best":"Record Sprint","of":"sur",
"Next puzzle":"Exercice suivant","Hint":"Indice","Show solution":"Voir la solution",
"Restart puzzle":"Recommencer","Reset my progress":"Réinitialiser ma progression",
"Find the winning move.":"Trouve le coup gagnant.","Loading…":"Chargement…",
"First mates":"Premiers mats","Winning moves":"Coups gagnants","Forks and pins":"Fourchettes et clouages",
"Mate in two":"Mats en deux coups","Combinations":"Combinaisons",
"One move is enough.":"Un seul coup suffit.","Look for the loose piece.":"Cherche la pièce mal protégée.",
"One piece can attack two at once.":"Une pièce peut en attaquer deux à la fois.",
"Your first move forces the reply.":"Ton premier coup force la réponse.",
"A sacrifice often opens the door.":"Un sacrifice ouvre souvent la voie.",
"White to play and mate in {n} move.":"Les Blancs jouent et matent en {n} coup.",
"White to play and mate in {n} moves.":"Les Blancs jouent et matent en {n} coups.",
"Black to play and mate in {n} move.":"Les Noirs jouent et matent en {n} coup.",
"Black to play and mate in {n} moves.":"Les Noirs jouent et matent en {n} coups.",
"White to play and win material.":"Les Blancs jouent et gagnent du matériel.",
"Black to play and win material.":"Les Noirs jouent et gagnent du matériel.",
"Your move. {hint}":"À toi. {hint}",
"Not quite. Look at the enemy king and its escape squares.":"Pas tout à fait. Regarde le roi adverse et ses cases de fuite.",
"Still not it. A hint or the solution can help.":"Toujours pas. Un indice ou la solution peuvent aider.",
"{san} — checkmate.":"{san} : échec et mat.","{san} — material won. Nicely spotted.":"{san} : matériel gagné, bien vu.",
"{san}. The defence replies…":"{san}. La défense répond…",
"Correct. Now mate in {n} move.":"Bonne réponse. Maintenant mate en {n} coup.",
"Correct. Now mate in {n} moves.":"Bonne réponse. Maintenant mate en {n} coups.",
"Three in a row. Moving up to level {n}: {name}.":"Trois de suite. Tu passes au niveau {n} : {name}.",
"The piece to move is highlighted.":"La pièce à jouer est en surbrillance.",
"The answer is {san}. Play it to continue.":"La solution est {san}. Joue-la pour continuer.",
"Puzzle of the day · ":"Exercice du jour · ",

/* --- rush --- */
"Chang Sprint":"Chang Sprint","Stop Rush":"Arrêter","Left":"Restant","Score":"Score","Strikes":"Vies",
"Time is up.":"Temps écoulé.","Three misses.":"Trois échecs.","Stopped.":"Arrêté.","You cleared every puzzle.":"Tu as épuisé tous les exercices.",
"{why} Score: {score} — a new personal best.":"{why} Score : {score}, nouveau record personnel.",
"{why} Score: {score} (best: {best}).":"{why} Score : {score} (record : {best}).",

/* --- code de reprise --- */
"Continue on another device":"Reprendre sur un autre appareil",
"Your progress is stored on this device. To pick it up elsewhere, copy this code and paste it there.":
 "Ta progression est enregistrée sur cet appareil. Pour la retrouver ailleurs, copie ce code et colle-le là-bas.",
"Show my code":"Afficher mon code","Copy":"Copier","Restore progress":"Restaurer ma progression",
"Paste a transfer code here":"Colle ici un code de reprise",
"Your transfer code":"Ton code de reprise","Transfer code to restore":"Code de reprise à restaurer",
"Keep this code: it holds your progress and nothing else.":"Garde ce code : il contient ta progression, rien d'autre.",
"That code is not valid. Check it was copied in full.":"Ce code n'est pas valide. Vérifie qu'il est copié en entier.",
"Progress restored: level {lvl}, {n} puzzles solved.":"Progression restaurée : niveau {lvl}, {n} exercices résolus.",
"Code copied.":"Code copié.",

/* --- entraînement --- */
"Queen vs King":"Dame contre Roi","Rook vs King":"Tour contre Roi","Two rooks vs King":"Deux Tours contre Roi",
"Bishop and knight":"Fou et Cavalier","King and pawn":"Roi et pion",
"Push the lone king to the edge with the queen, then bring your own king up. Watch for stalemate.":
 "Repousse le roi seul vers le bord avec la dame, puis fais monter ton roi. Attention au pat.",
"Cut the king off with the rook and shrink the box one rank at a time.":
 "Coupe le roi avec la tour et resserre la boîte rangée par rangée.",
"The ladder: one rook cuts, the other checks, and they alternate.":
 "L'escalier : une tour coupe, l'autre donne échec, et elles alternent.",
"The hard one. Mate only happens in a corner your bishop controls.":
 "La difficile. Le mat n'arrive que dans un coin contrôlé par ton fou.",
"Promote the pawn, then mate. Opposition decides it.":"Promeus le pion, puis mate. L'opposition décide de tout.",
"Endgames":"Finales","Five you should know":"Les cinq à connaître","Endgame":"Finale","Moves used":"Coups joués","Target":"Objectif","Your best":"Ton record","New position":"Nouvelle position",
"Pick an endgame below.":"Choisis une finale ci-dessous.",
"Pick an endgame, or run the coordinate drill below.":"Choisis une finale, ou lance le drill de coordonnées ci-dessous.",
"Could not build a position, try again.":"Impossible de construire une position, réessaie.",
"New position. White to move.":"Nouvelle position. Trait aux Blancs.",
"White to move. Mate within {n} moves.":"Trait aux Blancs. Mat en {n} coups maximum.",
"Checkmate in {n} moves. Well done.":"Échec et mat en {n} coups. Bravo.",
"Stalemate. The lone king escaped with a draw.":"Pat. Le roi seul s'en sort par la nulle.",
"You lost your material. Draw.":"Tu as perdu ton matériel. Nulle.",
"Out of moves. The target was {n}.":"Plus de coups. L'objectif était {n}.",
"The defending king replies…":"Le roi adverse répond…",
"Your move. {n} moves left.":"À toi de jouer. Encore {n} coups.",
"You are mated. That should not happen here.":"Tu es maté. Cela ne devrait pas arriver ici.",
"Stalemate. The defence held.":"Pat. La défense a tenu.",
"Coordinates":"Coordonnées",
"Thirty seconds to click as many named squares as you can. Knowing the board by name makes everything else faster.":
 "Trente secondes pour cliquer un maximum de cases nommées. Connaître l'échiquier par cœur accélère tout le reste.",
"White's view":"Vue des Blancs","Black's view":"Vue des Noirs",
"Find":"Trouve","Seconds":"Secondes","Correct":"Justes","Missed":"Ratées",
"Start 30 seconds":"Lancer 30 secondes","Stop":"Arrêter","Personal best:":"Record personnel :",
"Coordinates: {n} correct in 30 seconds. Best: {best}.":"Coordonnées : {n} justes en 30 secondes. Record : {best}.",

/* --- entre amis --- */
"Each move produces a link. Send it, your friend plays, they send theirs back.":
 "Chaque coup produit un lien. Tu l'envoies, ton ami joue, il te renvoie le sien.",
"Start a game.":"Commence une partie.","Link to send":"Lien à envoyer","Pace":"Rythme",
"Create game":"Créer la partie","Undo my move":"Annuler mon coup","Invite to chang64":"Inviter sur chang64",
"Your move, then send the link.":"À toi de jouer, puis envoie le lien.",
"Move saved. Send this link to your friend.":"Coup enregistré. Envoie ce lien à ton ami.",
"Checkmate. You win this one.":"Échec et mat, tu gagnes cette partie.",
"Checkmate. Your friend wins.":"Échec et mat, ton ami gagne.",
"You start. Play your move, then send the link.":"À toi de commencer. Joue ton coup, puis envoie le lien.",
"Send this link so your friend opens with White.":"Envoie ce lien pour que ton ami commence avec les Blancs.",
"This file is open locally, so the link will only work for your friend once the site is online.":
 "Le fichier est ouvert en local : le lien ne fonctionnera chez ton ami qu'une fois le site en ligne.",
"Your friend opens the link, plays a move and sends theirs back.":
 "Ton ami ouvre le lien, joue son coup et te renvoie le sien.",
"Link copied — paste it into Messenger.":"Lien copié, colle-le dans Messenger.","Link copied.":"Lien copié.",
"Game link":"Lien de la partie","Share":"Partager",
"Chess on chang64 — your move ({pace}):":"Échecs sur chang64, à toi de jouer ({pace}) :",
"I challenge you on chang64 — you play White:":"Je te défie sur chang64, tu joues les Blancs :",
"Come play chess on chang64:":"Viens jouer aux échecs sur chang64 :",

/* --- vidéos --- */
"Chess on YouTube":"Les échecs sur YouTube",
"Nothing loads until you press play, so YouTube sets no cookies before you ask it to.":
 "Rien ne se charge avant que tu appuies sur lecture : YouTube ne dépose donc aucun cookie sans ton accord.",
"Pick a channel below. “Live” opens the current stream if the channel is broadcasting, “Latest” plays their most recent uploads.":
 "Choisis une chaîne ci-dessous. « Direct » ouvre le flux en cours si la chaîne émet, « Récent » lance ses dernières vidéos.",
"Live":"Direct","Latest":"Récent","Channel":"Chaîne",
"Now loading: {label}. YouTube is serving this player, so their terms and cookies apply from here on.":
 "Chargement de {label}. C'est YouTube qui sert ce lecteur : ses conditions et ses cookies s'appliquent à partir d'ici.",
"Game recaps, opening guides and the friendliest teaching on the platform.":
 "Résumés de parties, guides d'ouvertures et la pédagogie la plus accessible de la plateforme.",
"Super-grandmaster speed chess, tournament recaps and long live streams.":
 "Parties rapides d'un super grand maître, résumés de tournois et longs directs.",
"Calm, story-driven walkthroughs of historic and current games.":
 "Analyses posées et racontées, de parties historiques comme actuelles.",

/* --- thèmes des exercices --- */
"Mate in one":"Mat en un coup","Mate in two":"Mat en deux coups","Winning capture":"Prise gagnante",
"Knight fork":"Fourchette de cavalier","Pawn fork":"Fourchette de pion","Double attack":"Attaque double",
"Sacrifice":"Sacrifice","Long-range attack":"Attaque à distance","Winning move":"Coup gagnant",
"Back-rank mate":"Mat du couloir","Ladder mate":"Mat de l'escalier","Smothered mate":"Mat étouffé",
"Arabian mate":"Mat arabe","Rook and king mate":"Mat tour et roi","Queen and king mate":"Mat dame et roi",
"Queen mate":"Mat de la dame","Pin":"Clouage","Deflection":"Déviation","Skewer":"Enfilade",
"King attack":"Attaque sur le roi","Seventh rank":"Septième rangée","Open file":"Colonne ouverte",
"Diagonal":"Diagonale","Long diagonal":"Grande diagonale","Hanging piece":"Pièce en prise",
"Promotion":"Promotion","Central knight":"Cavalier central","Advanced knight":"Cavalier avancé",
"Mate defence":"Défense du mat","Opposition":"Opposition","Castling":"Roque","Doubled rooks":"Doublement des tours",
"Opera Game finish":"Finale de l'Opéra","Scholar's mate":"Mat du berger","Black to move":"Trait aux Noirs",

/* --- origine du nom --- */
"The elephant on the board":"L'éléphant sur l'échiquier",
"Chang (ช้าง) is the Thai word for elephant. It is also, by a long detour, a chess piece. The game began in India as chaturanga, whose four divisions were infantry, cavalry, chariots and elephants.":
 "Chang (ช้าง) est le mot thaï pour éléphant. C'est aussi, par un long détour, une pièce du jeu d'échecs. Le jeu est né en Inde sous le nom de chaturanga, dont les quatre corps d'armée étaient l'infanterie, la cavalerie, les chars et les éléphants.",
"The elephant travelled west and changed its name at every border: gaja in Sanskrit, al-fil in Arabic, alfil in Spanish, and at last the bishop in English and the fou in French. It never left Russian, where the same piece is still slon, elephant, nor Chinese chess, where it is written 象. Thailand kept a game of its own, makruk, played there to this day.":
 "L'éléphant a voyagé vers l'ouest en changeant de nom à chaque frontière : gaja en sanskrit, al-fil en arabe, alfil en espagnol, puis le fou en français et le bishop en anglais. Il n'a jamais quitté le russe, où la même pièce s'appelle toujours slon, l'éléphant, ni les échecs chinois, où elle s'écrit 象. La Thaïlande, elle, a gardé son propre jeu, le makruk, que l'on y pratique encore.",
"Sixty-four is the rest of the name: the squares. chang64 is the elephant on the sixty-four squares, a piece that crossed a thousand years and half the world, on a board that never changed.":
 "Soixante-quatre, c'est le reste du nom : les cases. chang64, c'est l'éléphant sur les soixante-quatre cases, une pièce qui a traversé mille ans et la moitié du monde, sur un échiquier qui n'a pas bougé.",

/* --- accroche et signature --- */
"No account. No ads. No noise. Just chess.":"Sans compte. Sans publicité. Sans bruit. Juste les échecs.",
"The elephant on 64 squares":"L'éléphant sur 64 cases",
"Tip: “Suggest a move” shows what the engine would play in the position you are looking at.":
 "Astuce : « Suggérer un coup » montre ce que le moteur jouerait dans la position que tu regardes.",

/* --- divers --- */
"Choose a promotion piece":"Choisis la pièce de promotion","Queen":"Dame","Rook":"Tour","Bishop":"Fou","Knight":"Cavalier",
"chang64 home":"Accueil chang64","First move":"Premier coup","Previous move":"Coup précédent",
"Next move":"Coup suivant","Last move":"Dernier coup","PGN to import":"PGN à importer",
"You win":"Tu gagnes","You lose":"Tu perds","Draw":"Partie nulle","Review":"Analyser","Dismiss":"Masquer",
"Opening played out. Continue the game from here.":"Ouverture jouée. Poursuis la partie à partir d'ici.",
"Your games":"Tes parties","No finished game yet.":"Aucune partie terminée pour l'instant.",
"Finished games are stored in this browser so you can replay and review them later.":"Les parties terminées sont conservées dans ce navigateur, pour les rejouer et les analyser plus tard.",
"{n} game(s) kept on this device. Pick one to replay and review it.":"{n} partie(s) conservée(s) sur cet appareil. Choisis-en une pour la rejouer et l'analyser.",
"Clear history":"Effacer l'historique","Confirm":"Confirmer","Game":"Partie","{n} moves":"{n} coups",
"W":"G","L":"P","D":"N",
"Replaying a saved game. Step through it or run the review.":"Relecture d'une partie enregistrée. Parcours-la ou lance l'analyse.",
"Explore":"Explorer","Every page below is built from the same engine that runs the board.":"Chaque page ci-dessous est construite par le moteur qui fait tourner l'échiquier.",
"Played":"Joué","Engine preferred":"Le moteur préférait","The engine agrees: best move.":"Le moteur est d'accord : meilleur coup.",
"Blunder":"Gaffe","Mistake":"Erreur","Inaccuracy":"Imprécision","{n} advantage lost.":"{n} d'avantage perdu.",
"Review, move suggestions and the evaluation bar unlock once the game is over. No engine help while you play.":"L'analyse, les suggestions de coup et la barre d'avantage se débloquent à la fin de la partie. Aucune aide du moteur pendant le jeu.",
"Review your game move by move. The engine flags what went wrong.":"Reprends ta partie coup par coup. Le moteur signale ce qui a dérapé.",
"Resign":"Abandonner","Confirm resignation":"Confirmer l'abandon","Resign this game":"Abandonner la partie",
"You resigned. The computer wins.":"Tu abandonnes. L'ordinateur gagne.","You resign":"Tu abandonnes",
"You resigned this game.":"Tu as abandonné cette partie.","Your friend resigned. You win.":"Ton ami a abandonné. Tu gagnes.",
"I resign, well played.":"J'abandonne, bien joué.",
"Your progress will show up here.":"Ta progression s'affichera ici.",
"Solve your first puzzle →":"Résous ton premier exercice →",
"Ready when you are":"Quand tu veux","Start":"Commencer","Three minutes · three misses and it stops":"Trois minutes · trois erreurs et ça s'arrête","Thirty seconds · click the square that is named":"Trente secondes · clique la case nommée","Start the game":"Commencer la partie","Change settings":"Changer les réglages","Press start when you are ready.":"Appuie sur Commencer quand tu es prêt.","You play White.":"Tu joues les Blancs.","You play Black.":"Tu joues les Noirs.",
"Legal notice":"Mentions légales","Privacy":"Confidentialité","Preferences":"Préférences","Accessibility":"Accessibilité","Publisher and hosting details.":"Éditeur et hébergeur.",
"chang64 · no account, no tracking · progress saved on this device":
 "chang64 · sans compte, sans traqueur · progression enregistrée sur cet appareil",
"Use your browser menu: Add to home screen":"Passe par le menu du navigateur : Ajouter à l'écran d'accueil"
};

let LANG=(navigator.language||"en").toLowerCase().indexOf("fr")===0?"fr":"en";
/* Un mot court ne doit pas rester seul en fin de ligne : "Exercice du /
   jour" ou "Suggerer un / coup" se lisent mal dans un bouton etroit. On lie
   donc l'article au mot suivant par une espace insecable, une fois pour
   toutes plutot que dans chaque libelle. Regle typographique francaise
   courante, sans effet quand le texte tient sur une ligne. */
const MOTS_LIES=/(^|\s)(du|de|des|le|la|les|un|une|au|aux|en|et|ma|mon|ta|ton|sur|par|a|à|d'|l')(\s)(?=\S)/gi;
function lier(x){
  return String(x).replace(MOTS_LIES, function(_, av, mot, ap){
    return av + mot + (mot.endsWith("'") ? "" : "\u00a0");
  });
}
function t(s,v){
  let out=(LANG==="fr"&&FR[s])||s;
  if(v)for(const k in v)out=out.split("{"+k+"}").join(v[k]);
  return LANG==="fr" ? lier(out) : out;
}
/* textes statiques du document : relevés une fois, retraduits à la demande */
let i18nText=[],i18nAttr=[];
function collectI18n(){
  const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null);
  let n;
  while((n=walk.nextNode())){
    if(n.parentNode&&/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName))continue;
    const v=n.nodeValue,trimmed=v.trim();
    if(!trimmed||!/[A-Za-z]{3}/.test(trimmed))continue;
    i18nText.push({node:n,en:trimmed,raw:v,current:v});
  }
  for(const el of document.querySelectorAll("[placeholder],[aria-label]")){
    for(const a of ["placeholder","aria-label"]){
      const v=el.getAttribute(a);
      if(v&&/[A-Za-z]{3}/.test(v))i18nAttr.push({el:el,attr:a,en:v});
    }
  }
}
function applyI18n(){
  document.documentElement.lang=LANG;
  for(const r of i18nText){
    if(r.node.nodeValue!==r.current)continue;   // remplacé dynamiquement, on n'y touche pas
    const next=r.raw.replace(r.en,t(r.en));
    r.node.nodeValue=next;r.current=next;
  }
  for(const r of i18nAttr)r.el.setAttribute(r.attr,t(r.en));
  /* Les libelles statiques anglais laisses tels quels passent aussi par la
     regle quand on est en francais, sinon seuls les textes traduits en
     beneficieraient. */
  const box=document.getElementById("langSwitch");
  if(box)for(const b of box.children)b.setAttribute("aria-pressed",b.dataset.lang===LANG);
}
async function saveLang(){try{await window.storage.set("chang64:lang",LANG);}catch(e){}}
async function loadLang(){
  try{const r=await window.storage.get("chang64:lang");
    if(r&&r.value&&(r.value==="fr"||r.value==="en"))LANG=r.value;}catch(e){}
}
collectI18n();
applyI18n();
