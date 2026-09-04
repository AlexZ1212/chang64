/* ==========================================================
   0. INTERNATIONALISATION
   ========================================================== */
const FR={
"10 solved":"10 résolus",
"25 solved":"25 résolus",
"50 solved":"50 résolus",
"100 solved":"100 résolus",
"250 solved":"250 résolus",
"500 solved":"500 résolus",
"1000 solved":"1000 résolus",
"2000 solved":"2000 résolus",
"5000 solved":"5000 résolus",
"First day":"Premier jour",
"3-day streak":"3 jours de suite",
"7-day streak":"7 jours de suite",
"14-day streak":"14 jours de suite",
"30-day streak":"30 jours de suite",
"60-day streak":"60 jours de suite",
"100-day streak":"100 jours de suite",
"365-day streak":"365 jours de suite",
"900 rating":"900 de notation",
"1000 rating":"1000 de notation",
"1100 rating":"1100 de notation",
"1200 rating":"1200 de notation",
"1350 rating":"1350 de notation",
"1500 rating":"1500 de notation",
"1650 rating":"1650 de notation",
"1800 rating":"1800 de notation",
"2000 rating":"2000 de notation",
"2100 rating":"2100 de notation",
"2300 rating":"2300 de notation",
"{theme}: {n} solved":"{theme} : {n} résolus",
"This week:":"Cette semaine :",
"{n} puzzle":"{n} exercice","{n} puzzles":"{n} exercices",
"{d} rating":"{d} de notation",
"{n} new badge":"{n} nouveau badge",
"{n} new badges":"{n} nouveaux badges",
"Badges":"Badges",
"Rating over time":"Notation dans le temps",
"One point per exercise you complete. It only tracks your own progress against past-you, not a certified skill level. See the \"Elo rating\" glossary entry for more.":"Un point par exercice résolu. Ça ne suit que ta propre progression par rapport à toi-même, pas un niveau certifié. Voir l'entrée \"Le classement Elo\" du lexique pour en savoir plus.",
"Milestones for volume, daily streaks and rating. Once unlocked, a badge stays unlocked even if the number behind it later drops.":"Des paliers de volume, de séries quotidiennes et de notation. Une fois débloqué, un badge le reste même si le chiffre derrière redescend ensuite.",
"Personal records":"Records personnels",
"Fastest solve":"Exercice le plus rapide",
"Best day":"Meilleur jour",
"Your best-ever times: quickest first-try solve, and the most puzzles solved in a single day. These stay even if a later day is quieter.":"Tes meilleurs résultats : l'exercice résolu le plus vite du premier coup, et le plus grand nombre d'exercices résolus en une seule journée. Ils restent acquis même si un jour suivant est plus calme.",
"Mistakes to review":"Erreurs à revoir",
"Solve tactical exercises at your level, as much as you like. The level adjusts as you improve.":"Résous des exercices tactiques à ton niveau, à volonté. Le niveau s'ajuste à mesure que tu progresses.",
"One new puzzle every day. Come back to build your streak, and revisit any past day in the calendar.":"Un exercice nouveau chaque jour. Reviens pour construire ta série, retrouve n'importe quel jour passé dans le calendrier.",
"Recognise every square at a glance, the foundation of fast calculation.":"Reconnais chaque case en un clin d'œil, la base de tout calcul rapide.",
"Five essential endgames worth knowing cold, they matter in almost any game.":"Cinq finales essentielles à connaître par cœur, elles comptent dans presque toutes les parties.",
"Clears your level, badges, streaks and calendar on this device. This can't be undone.":"Efface ton niveau, tes badges, tes séries et ton calendrier sur cet appareil. C'est irréversible.",
"Reset everything":"Tout réinitialiser",
"Level {n} · {r} rating":"Niveau {n} · {r} de notation",
"Done today ✓ · {n}-day streak":"Fait aujourd'hui ✓ · série de {n} j",
"Not done yet · {n}-day streak":"À faire · série de {n} j",
"Best: {n}":"Record : {n}",
"{n}/5 mastered":"{n}/5 réussies",
"Chang Sprint: {n} solved":"Chang Sprint : {n} résolus",
"Coordinates: {n} correct":"Coordonnées : {n} correctes",
"My history":"Mon historique",
"See all badges":"Voir tous les badges",
"{n}/{total} unlocked":"{n}/{total} débloqués",
"Challenge a friend":"Défier un ami",
"Challenge link":"Lien du défi",
"I solved today's puzzle in {n} moves. Your turn:":"J'ai résolu l'exercice du jour en {n} coups, à toi :",
"Puzzles you've gotten wrong, from any mode. Tap one to try it again. Each success spaces it out further before it comes back. Solve it enough times and it drops off this list for good.":"Des exercices ratés, tous modes confondus. Touche-en un pour le retenter. Chaque réussite espace un peu plus son retour. Assez de réussites et il disparaît de cette liste pour de bon.",
"Solve a few puzzles to see your progress here.":"Résous quelques exercices pour voir ta progression ici.",
/* --- navigation et accueil --- */
"Home":"Accueil","Play":"Jouer","Puzzles":"Exercices","Challenges":"Défis","Give up the Sprint":"Abandonner le Sprint","Confirm give up":"Confirmer l'abandon","Given up.":"Sprint abandonné.","Start Chang Sprint":"Lancer le Chang Sprint","Three minutes to solve as many puzzles as you can. Three misses and it stops.":"Trois minutes pour résoudre le plus d'exercices possible. Trois erreurs et ça s'arrête.","Train":"S'entraîner","Friends":"Entre amis","Watch":"Regarder","Solve":"Résoudre","Invite":"Inviter",
"Loading puzzles…":"Chargement des exercices…","Couldn't load puzzles. Check your connection and try again.":"Impossible de charger les exercices. Vérifie ta connexion et réessaie.",
"Quiet move":"Coup silencieux","Mate in three":"Mat en trois coups",
"Play chess.":"Joue aux échecs.","Solve tactics.":"Travaille la tactique.","Get better.":"Progresse.",
"Bullet to daily time controls against a built-in engine, __NP__ puzzles verified move by move, and games against friends over a plain link. No account, no sign-up.":
 "Du bullet au jeu par correspondance contre un moteur intégré, __NP__ exercices vérifiés coup par coup, et des parties entre amis par simple lien. Sans compte, sans inscription.",
"Play now":"Jouer maintenant","Puzzle of the day":"Exercice du jour","Install the app":"Installer l'application",
"Time control":"Cadence","Bullet, blitz, rapid, classical: just categories by starting time. The numbers (like 10+0) are minutes, then seconds added back after each move. Slower means more time to think.":"Bullet, blitz, rapide, classique : ce sont juste des tranches selon le temps de départ. Les chiffres (comme 10+0) donnent les minutes, puis les secondes rendues après chaque coup. Plus c'est lent, plus tu as le temps de réfléchir.","Play the computer":"Jouer contre l'ordinateur",
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
"Game start":"Début",
"Pick a colour and a strength, then play.":"Choisis ta couleur et la force du moteur, puis joue.",
"White to move.":"Trait aux Blancs.","Black to move.":"Trait aux Noirs.","Game over.":"Partie terminée.",
"Even position":"Position équilibrée",
"White slightly better":"Les Blancs sont un peu mieux","Black slightly better":"Les Noirs sont un peu mieux",
"White is better":"Les Blancs ont l'avantage","Black is better":"Les Noirs ont l'avantage",
"White is winning":"Les Blancs gagnent","Black is winning":"Les Noirs gagnent",
"White mates in {n}":"Les Blancs matent en {n}","Black mates in {n}":"Les Noirs matent en {n}",
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
"The bar shows the engine's opinion, not certainty. \"M4\" means mate in 4 moves.":"La barre montre l'avis du moteur, pas une certitude. « M4 » signifie mat en 4 coups.",
"Downloading the engine…":"Téléchargement du moteur…","Stockfish is ready.":"Stockfish est prêt.",
"Analysing a finished game downloads Stockfish (about 7 MB, once) and uses it automatically. Stockfish never helps you while you play.":
 "Analyser une partie terminée télécharge Stockfish (environ 7 Mo, une seule fois) et l'utilise automatiquement. Stockfish ne t'aide jamais pendant que tu joues.",
"Stockfish could not start ({why}); this review uses the built-in engine instead.":
 "Stockfish n'a pas pu démarrer ({why}) ; cette analyse utilise le moteur intégré à la place.",
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
"PGN is the standard notation format for chess games, readable by most chess sites and software.":"Le PGN est le format standard de notation des parties d'échecs, lisible par la plupart des sites et logiciels d'échecs.",
"Paste a PGN here to load and review it":"Colle ici un PGN pour le charger et l'analyser",
"PGN copied to the clipboard.":"PGN copié dans le presse-papiers.","Download started.":"Téléchargement lancé.",
"Download unavailable here, PGN copied instead.":"Téléchargement indisponible ici, PGN copié à la place.",
"No moves found in that PGN.":"Aucun coup trouvé dans ce PGN.",
"Could not read any legal move from that PGN.":"Impossible de lire un coup légal dans ce PGN.",
"Could not read that PGN: “{tok}” is not a legal move from the start.":"PGN illisible : « {tok} » n'est pas un coup légal depuis le début.",
"Loaded {n} half-moves. Step through with the arrows, or analyse it.":"{n} demi-coups chargés. Parcours-les avec les flèches, ou lance l'analyse.",
"Loaded {n} half-moves, then stopped: “{tok}” is not legal in that position.":"{n} demi-coups chargés, puis arrêt : « {tok} » n'est pas légal dans cette position.",

/* --- exercices --- */
"Theme":"Thème","All themes":"Tous les thèmes","Level":"Niveau","Streak":"Série","Best":"Record","Rating":"Classement","of":"sur",
"Next puzzle":"Exercice suivant","Hint":"Indice","Show solution":"Voir la solution",
"Restart puzzle":"Recommencer","Reset my progress":"Réinitialiser ma progression",
"Find the winning move.":"Trouve le coup gagnant.","Loading…":"Chargement…",
"First steps":"Premiers pas","Building confidence":"Prendre confiance","Everyday tactics":"Tactiques du quotidien",
"Sharper eyes":"L'œil plus affûté","Wider board":"Voir tout l'échiquier",
"Real calculation":"Vrai calcul","Advanced tactics":"Tactiques avancées",
"Mating attacks":"Attaques de mat","Forcing mates":"Mats forcés","Grandmaster finishes":"Finitions de grand maître",
"Mate in two":"Mats en deux coups",
"One move is enough.":"Un seul coup suffit.","Look for the loose piece.":"Cherche la pièce mal protégée.",
"One piece can attack two at once.":"Une pièce peut en attaquer deux à la fois.",
"Your first move forces the reply.":"Ton premier coup force la réponse.",
"Two threats, only one defence.":"Deux menaces, une seule défense.",
"Force the bigger piece to move first.":"Force la pièce la plus forte à bouger la première.",
"Count every capture before you play.":"Compte chaque prise avant de jouer.",
"See two moves ahead, not one.":"Vois deux coups à l'avance, pas un seul.",
"The back rank is not as safe as it looks.":"La dernière rangée est moins sûre qu'il n'y paraît.",
"The quiet move is often the strongest.":"Le coup silencieux est souvent le plus fort.",
"The king is boxed in by its own pieces.":"Le roi est enfermé par ses propres pièces.",
"Nothing defends {piece}.":"Rien ne défend {piece}.",
"The piece on {from} attacks both {p1} and {p2} at once.":"La pièce en {from} attaque à la fois {p1} et {p2}.",
"{pinned} can't move without exposing {behind}.":"{pinned} ne peut pas bouger sans exposer {behind}.",
"{captured} was only defended by {pinned}, which is pinned and can't recapture.":"{captured} n'était défendu que par {pinned}, qui est cloué et ne peut pas reprendre.",
"The king on {sq} had no square to escape to.":"Le roi en {sq} n'avait aucune case pour s'échapper.",
"{deflected} was the only defender. Forced away, it can no longer help.":"{deflected} était l'unique défenseur. Forcé de s'écarter, il ne peut plus aider.",
"{candidate} looks tempting, but only {refutation} actually refutes it. Worth calculating a move further next time.":"{candidate} a l'air tentant, mais seul {refutation} le réfute vraiment. À calculer un coup plus loin la prochaine fois.",
"Careful with {candidate}: {refutation} punishes it.":"Attention à {candidate} : {refutation} le punit.",
"The king on {sq} was boxed in by its own pieces.":"Le roi en {sq} était enfermé par ses propres pièces.",
"This piece can't move without exposing something bigger behind it.":"Cette pièce ne peut pas bouger sans exposer quelque chose de plus gros derrière elle.",
"A piece far from the action can still reach this square.":"Une pièce éloignée de l'action peut quand même atteindre cette case.",
"White to play and mate in {n} move.":"Les Blancs jouent et matent en {n} coup.",
"White to play and mate in {n} moves.":"Les Blancs jouent et matent en {n} coups.",
"Black to play and mate in {n} move.":"Les Noirs jouent et matent en {n} coup.",
"Black to play and mate in {n} moves.":"Les Noirs jouent et matent en {n} coups.",
"White to play and win material.":"Les Blancs jouent et gagnent du matériel.",
"Black to play and win material.":"Les Noirs jouent et gagnent du matériel.",
"Your move. {hint}":"À toi. {hint}",
"Not quite. Look at the enemy king and its escape squares.":"Pas tout à fait. Regarde le roi adverse et ses cases de fuite.",
"Still not it. A hint or the solution can help.":"Toujours pas. Un indice ou la solution peuvent aider.",
"{san}: checkmate.":"{san} : échec et mat.","{san}: material won. Nicely spotted.":"{san} : matériel gagné, bien vu.",
"{san}. The defence replies…":"{san}. La défense répond…",
"Correct. Your move.":"Correct. À toi de jouer.",
"Correct. Now mate in {n} move.":"Bonne réponse. Maintenant mate en {n} coup.",
"Correct. Now mate in {n} moves.":"Bonne réponse. Maintenant mate en {n} coups.",
"Three in a row. Moving up to level {n}: {name}.":"Trois de suite. Tu passes au niveau {n} : {name}.",
"The piece to move is highlighted.":"La pièce à jouer est en surbrillance.",
"The answer is {san}. Play it to continue.":"La solution est {san}. Joue-la pour continuer.",
"The winning move was {san}.":"Le coup gagnant était {san}.",
"Mistake {a} of {b}":"Erreur {a} sur {b}",
"See full results":"Voir tous les résultats",
"Tap ✓ or ✗ to see how it was solved.":"Touche un ✓ ou un ✗ pour revoir comment le résoudre.",
"Exercise {n}, solved":"Exercice {n}, réussi",
"Exercise {n}, missed":"Exercice {n}, raté",
"Puzzle of the day · ":"Exercice du jour · ",
"Exercise ID: {code} · useful when reporting an issue":
 "Identifiant de l'exercice : {code}, utile en cas de signalement",
"This exercise is rated about {pr}. You: {yr}.":"Cet exercice est estimé à environ {pr}. Toi : {yr}.",
"({delta} rating)":"({delta} de notation)",

/* --- rush --- */
"Chang Sprint":"Chang Sprint","Left":"Restant","Score":"Score","Strikes":"Vies",
"Time is up.":"Temps écoulé.","Three misses.":"Trois échecs.","Stopped.":"Arrêté.","You cleared every puzzle.":"Tu as épuisé tous les exercices.",
"{why} Score: {score}, a new personal best.":"{why} Score : {score}, nouveau record personnel.",
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
"Start 30 seconds":"Lancer 30 secondes","Stop":"Arrêter","Personal best:":"Record personnel :","Personal best":"Record personnel",
"Coordinates: {n} correct in 30 seconds. Best: {best}.":"Coordonnées : {n} justes en 30 secondes. Record : {best}.",

/* --- entre amis --- */
"Each move produces a link. Send it, your friend plays, they send theirs back.":
 "Chaque coup produit un lien. Tu l'envoies, ton ami joue, il te renvoie le sien.",
"Start a game.":"Commence une partie.","Choose your colour, then create a game.":"Choisis ta couleur, puis crée la partie.","Link to send":"Lien à envoyer","Pace":"Rythme",
"Saved in this browser: you can close the tab and come back to it.":"Sauvegardé dans ce navigateur : tu peux fermer l'onglet et y revenir plus tard.",
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
"Link copied, paste it into Messenger.":"Lien copié, colle-le dans Messenger.","Link copied.":"Lien copié.",
"Game link":"Lien de la partie","Share":"Partager",
"Chess on chang64, your move ({pace}):":"Échecs sur chang64, à toi de jouer ({pace}) :",
"I challenge you on chang64, you play White:":"Je te défie sur chang64, tu joues les Blancs :",
"Come play chess on chang64:":"Viens jouer aux échecs sur chang64 :",

/* --- vidéos --- */
"Chess on YouTube":"Les échecs sur YouTube",
"The latest video from each channel, updated automatically.":
 "La dernière vidéo de chaque chaîne, mise à jour automatiquement.",
"See the channel":"Voir la chaîne",
"Game recaps, opening guides and the friendliest teaching on the platform.":
 "Résumés de parties, guides d'ouvertures et la pédagogie la plus accessible de la plateforme.",
"Super-grandmaster speed chess, tournament recaps and long live streams.":
 "Parties rapides d'un super grand maître, résumés de tournois et longs directs.",
"Calm, story-driven walkthroughs of historic and current games.":
 "Analyses posées et racontées, de parties historiques comme actuelles.",
"Practical lessons and rating-climb series built for beginner and intermediate players.":
 "Leçons pratiques et séries de progression de classement pour joueurs débutants et intermédiaires.",
"An advanced player working openly to cut out his own blunders, one honest game at a time.":
 "Un joueur avancé qui travaille ouvertement à éliminer ses propres gaffes, partie après partie.",
"Romanian IM breaking down openings, especially the London System and Caro-Kann, with tournament recaps.":
 "MI roumain qui décortique les ouvertures, notamment le système London et la Caro-Kann, avec des résumés de tournois.",
"Three coaches reviewing student games and teaching the fundamentals behind real improvement.":
 "Trois entraîneurs qui analysent des parties d'élèves et enseignent les fondamentaux d'une vraie progression.",
"GM Simon Williams brings aggressive attacking chess and lively commentary on his own games.":
 "Le grand maître Simon Williams propose des échecs d'attaque agressifs et des commentaires vivants sur ses propres parties.",
"Calm, friendly streaming highlights from an IM known for the Stafford Gambit and London System.":
 "Extraits de stream calmes et chaleureux d'un MI connu pour le gambit Stafford et le système London.",

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
"Choose a promotion piece":"Choisis la pièce de promotion","Queen":"Dame","Rook":"Tour","Bishop":"Fou","Knight":"Cavalier","King":"Roi","Pawn":"Pion",
"chang64 home":"Accueil chang64","First move":"Premier coup","Previous move":"Coup précédent",
"Next move":"Coup suivant","Last move":"Dernier coup","PGN to import":"PGN à importer",
"You win":"Tu gagnes","You lose":"Tu perds","Draw":"Partie nulle","Review":"Analyser","Dismiss":"Masquer",
"Opening played out. Continue the game from here.":"Ouverture jouée. Poursuis la partie à partir d'ici.",
"Your games":"Tes parties","Your friend games":"Tes parties entre amis","No finished game yet.":"Aucune partie terminée pour l'instant.",
"Saved only in this browser. No account: clearing your browsing data or switching devices loses it.":"Sauvegardé uniquement dans ce navigateur. Pas de compte : vider les données du site ou changer d'appareil fait tout perdre.",
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
"Ready when you are":"Quand tu veux","Start":"Commencer","Three minutes · three misses and it stops":"Trois minutes · trois erreurs et ça s'arrête","Thirty seconds · click the square that is named":"Trente secondes · clique la case nommée","Start the game":"Commencer la partie","Change settings":"Changer les réglages","Press \u201cStart the game\u201d when you are ready.":"Appuie sur « Commencer la partie » quand tu es prêt.","You play White.":"Tu joues les Blancs.","You play Black.":"Tu joues les Noirs.",
"You have an unfinished game":"Tu as une partie en cours","Resume the game":"Reprendre la partie","New game instead":"Nouvelle partie","Move {n}":"Coup {n}",
"Analyse":"Analyser","Board editor":"Éditeur de position","Flip the board":"Retourner l'échiquier",
"Set up any position to study it: check an idea from a book, a puzzle you saw elsewhere, or an endgame, without replaying a whole game to get there. Pick a piece below, then tap a square. Tap a piece already on the board to remove it.":"Compose n'importe quelle position pour l'étudier : reprends une idée vue dans un livre, un problème vu ailleurs, ou une finale, sans avoir à rejouer toute une partie pour y arriver. Choisis une pièce ci-dessous, puis touche une case. Touche une pièce déjà posée pour la retirer.",
"Pieces":"Pièces","Side to move":"Trait à jouer","Starting position":"Position de départ","Clear board":"Vider l'échiquier",
"Copy FEN":"Copier le FEN","Load FEN":"Charger le FEN","FEN copied to the clipboard.":"FEN copié dans le presse-papiers.",
"A short line of text that describes a position: which piece is on which square, whose turn it is. It's the standard way to save or share a position, readable by most chess sites and software.":"Une courte ligne de texte qui décrit une position : quelle pièce sur quelle case, à qui le trait. C'est la façon standard de sauvegarder ou partager une position, lisible par la plupart des sites et logiciels d'échecs.",
"Could not read that FEN.":"Ce FEN est illisible.","Each side needs exactly one king.":"Chaque camp doit avoir exactement un roi.",
"Place a king for each side.":"Place un roi pour chaque camp.","Place a white king.":"Place un roi blanc.","Place a black king.":"Place un roi noir.",
"Play against the bot from here":"Jouer contre le bot depuis ici",
"Analyse this position":"Analyser cette position","Back to the editor":"Retour à l'éditeur",
"Daily puzzle calendar":"Calendrier des exercices du jour",
"Every day you've solved the puzzle of the day. Tap a highlighted day to see it again.":"Chaque jour où tu as résolu l'exercice du jour. Touche un jour en surbrillance pour le revoir.",
"Highlighted days are puzzles of the day you've solved. Tap one to see it again with the solution shown.":"Les jours en surbrillance sont des exercices du jour résolus. Touches-en un pour le revoir, solution affichée.",
"See full calendar":"Voir le calendrier complet",
"Back to your progress":"Retour à ta progression",
"Previous month":"Mois précédent",
"Next month":"Mois suivant",
"Analysing…":"Analyse en cours…","Best move: {m}":"Meilleur coup : {m}",
"Leaving the page won't lose your game: it saves automatically in this browser, ready to pick up again.":"Tu ne perds pas ta partie en quittant la page : elle se sauvegarde automatiquement dans ce navigateur, prête à reprendre.","More info":"Plus d'infos",
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
