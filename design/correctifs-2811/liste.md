# Correctifs notés par Alexandre le 27/11 au soir (à faire, rien commencé)

Consigne : « tu prends note et ne fais rien pour l'instant ». À publier le 28/11 avec la fenêtre « Prêt » (3936c430).

1. **Accueil, Ma progression** (01-ma-progression.jpg, téléphone) : « attention aux césures, et à l'interlignage qui est trop important ».
   Vu sur la capture : « NIVEAU EXER- / CICES » et « CONTRE L'ORDINA- / TEUR » coupés par un tiret dans les trois cases ; lignes trop espacées sous les chiffres (ELO, NIVEAU EXERCICES, JOURS D'AFFILÉE et leur sous-ligne).

2. **Badges pixelisés** (02-badge-pixelise.webp, iPhone, fenêtre Félicitations du badge « Têtu », Résoudre) : « certains badges sont pixelisés, confirmer qu'il s'agit d'un bug de chargement. Sinon faire une passe sur les badges pour vérifier que tout est ok ».
   Vu sur la capture : la grande médaille (poing) est floue et en gros pixels, alors que la même petite médaille, juste en dessous, est nette.

3. **Tableau « Meilleurs joueurs »** (03-tableau-duels.jpg) : « Dans le tableau, on pourrait ajouter les duels gagnés » (une colonne de plus, à côté de Cette semaine, Niveau exercices, Exercices, Série, Badges, Sprint…).
   À savoir : le tableau vient du serveur (classement.js) ; une colonne de duels gagnés demande sans doute une donnée côté base, donc SQL à montrer avant, et peut-être Fable.

4. **Fiche du joueur** (04-fiche-duels.jpg) : « ici aussi ajouter les duels ». Annoté « DU » dans la liste des rangs (Cette semaine… Parties en direct gagnées) et « DUEL » sur le bloc Parties en direct (Gagnées, Nulle, Perdue) : une ligne « Duels gagnés » avec son rang, et sans doute un bloc Duels gagnés/nuls/perdus comme celui des parties en direct. Même source que le point 3 (serveur, peut-être une donnée en base).

5. **Pièces gagnées fausses** (05-pieces-gagnees.jpg, partie d'entraînement contre l'ordinateur Débutant, gagnée par mat au 63e coup) : « j'ai l'impression que l'affichage des pièces gagnées est faux ».
   Vu sur la capture : position finale roi blanc f1 + deux dames (a1, b8, entourées) contre roi noir seul. Le blanc mène donc d'environ 18 points de matériel, mais l'affichage dit « +8 » pour Chang (l'ordinateur) et « -8 » pour Toi (entouré en rouge). Piste : les promotions (deux dames) mal comptées, ce qui inverse le signe et fausse le total ; à vérifier en rejouant une partie avec promotion.

6. **Coach : dire pourquoi** (06-coach-pourquoi.jpg, partie contre l'ordinateur Adapté ≈ 750, coup 11. Cg5?? « Gaffe », « Le coach préférait Dd4. ») : « il faudrait penser à enrichir le vocabulaire du coach et qu'il puisse dire pourquoi. Ou bien pourquoi mon coup est mauvais. Cela de manière générale lorsque le mode coach est activé ».
   À savoir : règle de vérité du coach (décision du 22/11, mémoire coach-relecture) : une phrase seulement quand elle est vraie par construction, sinon « le coach préférait… ». Les explications devront donc être calculées (pièce laissée en prise, mat menacé, matériel perdu après la meilleure réponse…), jamais devinées. Chantier plutôt élevé.
   Ajout du 28/11 (06b-coup-silencieux-pourquoi.jpg, exercice du jour #D82T0, motif Coup silencieux, Blancs : Td7, Te5, Fou noir en e7, Roi noir en f7). Le message dit « Td7 ne prend rien et ne fait pas échec. Pourtant, c'est le meilleur coup de la position. » Alexandre : « il ne dit pas pourquoi, moi je sais que c'est car c'est un clouage, mais le joueur amateur ne sait peut-être pas cela ». Td7 cloue le Fou e7 sur le Roi f7. Le Fou, attaqué deux fois (Td7, Te5) et défendu une seule fois, est perdu. Le même chantier couvre donc aussi les explications des exercices : nommer le motif caché derrière un coup silencieux (clouage, menace de mat, attaque double à venir…), seulement quand c'est calculable et vrai.

7. **Barre d'évaluation fausse sur un mat** (07-barre-mat.jpg, partie contre l'ordinateur Adapté ≈ 750, 26. Txe8# joué par Alexandre avec les Blancs, « Le moteur est d'accord : meilleur coup ») : « c'est échec et mat et pourtant la barre d'évaluation est au milieu et j'ai une évaluation négative. À corriger partout où cela se produit ».
   Vu sur la capture : la barre affiche -1.3 et reste vers le milieu alors que les Blancs viennent de mater. Sur une position de mat, la barre doit être pleine du côté du gagnant (et afficher le mat, pas un chiffre). Chercher tous les endroits qui ont une barre ou une note (partie contre l'ordinateur, analyse, relecture, exercices, parties entre membres).

8. **Champ « Chercher un membre » caché par le clavier** (08-recherche-cachee.jpg, iPhone, menu Classement, onglet Cette semaine) : « le champ de recherche n'est pas visible quand on fait une recherche ».
   Vu sur la capture : le clavier de l'iPhone et sa barre (flèches, ✓) recouvrent le champ ; on ne voit que le haut du titre « Chercher un membre » (annoté « CHAMPS PAS VISIBLE »). À la prise du focus, faire défiler pour que le champ et ses résultats restent au-dessus du clavier (visualViewport sur iOS).

9. **Un texte de la barre d'onglets disparaît parfois** (09-onglet-invisible.jpg, iPhone, onglet Jouer, après « Tu abandonnes » d'une partie pas commencée, page défilée) : « Parfois un texte du menu disparaît ».
   Vu sur la capture : « Analyser » est presque invisible (texte sombre sur fond sombre) alors que Apprendre, Résoudre et Explorer sont lisibles. Piste : un état de l'onglet (désactivé, survol ou focus resté collé au toucher, animation d'arrivée) qui assombrit son texte. Intermittent : chercher quand ça arrive.

10. **Choisir la force de l'ordinateur depuis Analyser** (10-force-depuis-analyser.jpg, éditeur de position, bouton « Jouer contre l'ordinateur depuis ici » entouré, « FACILE » écrit au-dessus) : « Quand on veut jouer une position contre le bot depuis Analyser, ce serait bien de pouvoir choisir la force du bot ».
   Idée : une rangée des cinq forces (Tout doux… Coriace), la même qui défile que sur Contre l'ordinateur, juste au-dessus du bouton ; à confirmer par QCM (force seule, ou aussi couleur et cadence ?).

11. **Le coach s'arrête à 3 moments** (11-coach-trois-moments.jpg, relecture d'une partie contre l'ordinateur, « 3 moments à revoir » entouré) : « 3 moments à revoir, pourquoi pas plus quand cela le nécessite ».
   Vu sur la capture : la partie compte 3 gaffes, 1 erreur et 3 imprécisions (7 coups signalés), mais le coach n'en montre que 3 (6. d3, 11. Cg5, 24. Fxb4). Idée : montrer toutes les gaffes et erreurs (les imprécisions repliées sous « voir plus » ?), à décider par QCM. Lié au point 6 (« Le coach préférait Ff4 » sans dire pourquoi).

12. **Pictos des motifs peu parlants** (12-pictos-motifs.jpg, Résoudre > Travailler un motif, colonne surlignée en rouge) : « Les pictos surlignés ne sont pas pertinents avec le contenu. Refaire une recherche pour trouver des pictos plus pertinents ».
   Surlignés : Déviation (balance), Attaque double (cible), Coup silencieux (yin-yang), Mat du couloir (cadenas), Mat en un coup (porte), Mat en deux coups (note de musique). Mat en trois coups (parchemin) est au bord du trait, sans doute visé aussi. Hors capture : vérifier aussi les autres tuiles.
   À savoir : ces pictos sont les dessins des médailles des motifs (motif_*, lot du 24/11) ; en changer touche aussi les médailles, ou alors séparer picto de tuile et médaille. Planche de propositions + QCM avant de toucher.

13. **Chiffres qui débordent dans Statistiques** (13-stats-deborde.jpg, menu > Statistiques, bloc Activité) : « Attention à la taille des chiffres dans ce menu, ça déborde ».
   Vu sur la capture : « 114/286 » (Badges) sort de sa case à droite. Réduire la taille quand le nombre est long (comme les noms de badges), pour toutes les cases de ce menu et dans les 10 langues.
   Remarqué en passant (non signalé par Alexandre, à lui montrer) : « 37  % » et « 67  % » ont un grand blanc entre le nombre et « % » ; l'espace fine du 24/11 paraît large dans la police à chasse fixe des chiffres.

14. **Ordre « Signaler cet exercice » / boutons de partage** (14-signaler-ordre.jpg, exercice du jour résolu) : « Inverser Signaler cet exercice avec les deux boutons ».
   Aujourd'hui : le lien « Signaler cet exercice », puis en dessous « Partager mon résultat » et « Envoyer à un ami ». Voulu : les deux boutons d'abord, le lien « Signaler cet exercice » en dessous. Vérifier que c'est pareil sur tous les écrans d'exercice où le lien apparaît.

15. **Lien « Toutes mes statistiques → »** (15-lien-statistiques.jpg, accueil, bloc Ma progression) : « il pourrait avoir le même style visuel que d'autres boutons en texte présents sur le site ».
   Aujourd'hui : texte souligné avec flèche, aligné à droite. Voulu : le style commun des boutons-texte du site (relever lesquels : « Signaler cet exercice », liens de retour « ‹ », etc. ; montrer une maquette si plusieurs styles coexistent). Même capture : césures du bloc (point 1) toujours visibles.

16. **Plus d'espace avant « % »** (16-pourcent-sans-espace.jpg, Statistiques, « 67  % » entouré) : « Enlever les espaces entre le chiffre et pourcentage. De manière générale. C'est pas esthétique ».
   DÉCISION d'Alexandre (27/11) : revient sur l'espace fine ajoutée le 24/11 (pourcentTexte, i18n.js) ; « 67% » collé partout et dans toutes les langues (le turc garde « %67 », c'est son ordre). Répond aussi à la remarque en passant du point 13.

17. **Choix de la vue en double dans Coordonnées** (17-coordonnees-double-choix.jpg, Résoudre > Coordonnées) : « Double présence du choix des couleurs ».
   Vu sur la capture : « Vue des Blancs | Vue des Noirs » est à la fois dans la fenêtre « Coordonnées » (readySide) et dans le panneau sous l'échiquier (coordSide), synchronisés. En garder un seul (QCM : lequel ?).
   Remarqué en passant (à lui montrer) : « Vue des Noirs » est choisie mais l'échiquier derrière la fenêtre montre encore la vue des Blancs (8 en haut) ; à vérifier s'il se retourne bien au départ.

18. **Épaisseur des jauges** (18-epaisseur-jauges.jpg, menu > Défis de la semaine, « ÉPAISSEUR » écrit) : « Sur l'app en entier, mettre en cohérence les épaisseurs de jauges, certaines sont plus fines ou épaisses que d'autres ».
   Vu sur la capture : la jauge du 1er défi est plus épaisse que celles des 2e et 3e. Faire l'inventaire de toutes les jauges (défis, objectif, statistiques, maîtrise des Erreurs à revoir, Apprendre, sprint, chargement de Stockfish…), puis une seule épaisseur (QCM avec planche si besoin).

19. **Texte qui dépasse sous le dégradé de la rangée qui défile** (19-erreurs-defile-fuite.jpg, menu > Statistiques > Erreurs à revoir, rangée des pastilles « … × n » défilée vers la droite) : « Petit bug d'affichage sur ce menu. On voit le texte alors qu'il est censé être masqué ».
   Vu sur la capture (zoomée) : à gauche, le chevron « ‹ » et son dégradé ne masquent pas tout : un bout de lettre (« s ») reste visible à gauche du dégradé, et « oups » se lit à travers. Vérifier toutes les rangées qui défilent (.defile : cadences, niveaux de l'ordinateur, pastilles des erreurs…) : dégradé opaque jusqu'au bord et rien qui déborde à gauche.

20. **Coche de l'annonce « Objectif atteint ! »** (20-coche-objectif.webp, en haut de l'écran après le 3e exercice du jour) : « Mettre en cohérence le picto avec les autres pictos V » (les coches).
   Vu sur la capture : grosse boule verte brillante avec une coche fine, différente de la coche commune harmonisée le 24/11 (disque jade + coche pleine, comme dans Apprendre). L'aligner sur celle-là, et vérifier les autres annonces (défis…) qui utilisent la même pastille.
   Remarqué en passant (à lui demander) : une poignée grise « ‹ » collée au bord droit de l'échiquier ; vient-elle du site ou de Safari ?

21. **Chiffre visible sous la coche des étapes d'Apprendre** (21-chiffre-sous-coche.jpg, Apprendre, leçon « Le carré du pion », « ÉTAPE 3 SUR 6 », pastille de l'étape 3 entourée) : « On voit le chiffre au travers du V ».
   Vu sur la capture (zoomée) : sur la pastille de l'étape en cours, tout juste réussie, le « 3 » reste dessiné sous la coche. Quand la coche apparaît, le chiffre doit disparaître (vérifier aussi l'animation de la coche et les autres pastilles numérotées : test de placement, chemin).

Précision d'Alexandre (27/11) : « Toutes mes captures sont depuis mon iPhone ». Donc tous ces points sont à vérifier en premier dans Safari sur iPhone (mesures avec une police élargie comme Safari, et si possible sur son téléphone). Poignée grise « ‹ » du point 20 : réglé, c’était une vidéo en image dans l’image (Picture in Picture) rangée sur le bord par iOS, rien à voir avec le site (Alexandre, 27/11).
